// express for routing
const express = require('express'),
    router = express.Router();
// braintree for payments
const braintree = require('braintree');
const gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: process.env.MERCHANTID,
    publicKey: process.env.MERCHANTPUBLIC,
    privateKey: process.env.MERCHANTPRIVATE,
});
// database access
const { db } = require('./Database');
const { SQL } = require('sql-strings');
// user auth
const handleAuth = require('./Auth').handleAuth;
// business creation and deletion
const { createBusiness, deleteBusiness } = require('./Business');

// ============================ PAYMENT SETTINGS ============================
// subscription plans
const PLAN_IDS = {
    STANDARD: 'n2wg',
    FREE: '388r',
};
const PLAN_NAME = new Map(Object.entries(PLAN_IDS).map(keyval => [keyval[1], keyval[0]])); // reverse lookup plan name from plan id

// ============================ PAYMENT FUNCTIONS ============================
/**
 * Gets custumer id of the specified user.
 * @param {string} uid
 * @returns customer_id of user with uid if it exists, otherwise returns false.
 */
async function getCustomerId(uid) {
    const user = await db().get(...SQL`SELECT customer_id FROM Users WHERE id = ${uid}`);
    if (!user) return false;
    return user.customer_id;
}

/**
 * Gets the business name associated with a subscription.
 * @param {string} subscriptionId
 * @returns name of the business paid for by the given subscriptionId.
 */
async function getBusinessName(subscriptionId) {
    const business = await db().get(
        ...SQL`SELECT name FROM Businesses WHERE subscriptionId = ${subscriptionId}`,
    );
    return business.name;
}

// returns true if the user (specified by uid) subscribes at least once to the planId
// throws any error that's not a "notFoundError" (the user hasn't signed up as a customer yet)
// returns false otherwise
// eslint-disable-next-line no-unused-vars
async function verifySubscription(uid, planId) {
    const customerId = await getCustomerId(uid);
    if (!customerId) return false;
    try {
        var customer = await gateway.customer.find('' + customerId);
    } catch (err) {
        if (err.type === 'notFoundError') return false; // this should not be necessary?
        throw err;
    }
    customer.paymentMethods.forEach(paymentMethod => {
        paymentMethod.subscriptions.forEach(subscription => {
            if (subscription.status === 'Active' && subscription.planId === planId) {
                return true;
            }
        });
    });
    return false;
}

// this token authorizes the client to access the payment portal and modify customer payment information
// if the client is already a customer, we give them access to their braintree customer via the stored customer_id
async function getClientToken(uid) {
    const customerId = await db()
        .get(...SQL`SELECT customer_id FROM Users WHERE id = ${uid}`)
        .then(row => row?.customer_id);
    const tokenOptions = {};
    if (customerId) {
        tokenOptions.customerId = customerId;
        tokenOptions.options = {
            failOnDuplicatePaymentMethod: true,
            makeDefault: true,
            verifyCard: true,
        };
    }

    let res = await gateway.clientToken.generate(tokenOptions);
    return res.clientToken;
}

// ============================ PAYMENT ROUTES ============================

// @see getClientToken()
router.get('/clientToken', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    response.send(await getClientToken(uid));
});

// we get the paymentNonce from the client (a secure way to communicate payment information)
// and use it to create a customer in the braintree vault
// or if the client already has a customer, we get that customer using the stored id
// then we select the default payment method (as set by the client SDK) of the customer
// and use the corresponding paymentMethodToken to subscribe to the payment plan
router.post('/checkout', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const nonceFromTheClient = request.body.nonce;
    const deviceData = request.body.deviceData;
    const businessName = request.body.businessName;
    const TYPE = request.body.subscriptionType;

    if (!TYPE) {
        response.status(400).send('No subscription type specified');
        return;
    } else if (!businessName) {
        response.status(400).send('No business name specified');
        return;
    }
    const user = await db().get(...SQL`SELECT customer_id, name FROM Users WHERE id = ${uid}`);

    let paymentToken;
    if (user.customer_id) {
        // customer already exists in braintree vault
        const result = await gateway.paymentMethod.create({
            customerId: user.customer_id,
            paymentMethodNonce: nonceFromTheClient,
            options: {
                failOnDuplicatePaymentMethod: true,
                makeDefault: true,
                verifyCard: true,
            },
        });
        if (!result.success) {
            response
                .status(401)
                .send(
                    'Customer validation failed: customer validations, payment method validations or card verification is NOT in order',
                );
            return;
        }
        paymentToken = result.paymentMethod.token;
    } else {
        // customer doesn't exist, so we use the paymentMethodNonce to create them!
        const spaceIX = user.name.indexOf(' ');
        const result = await gateway.customer.create({
            firstName: user.name.substring(0, spaceIX),
            lastName: user.name.substring(spaceIX),
            paymentMethodNonce: nonceFromTheClient,
            deviceData: deviceData,
        });
        if (!result.success) {
            response
                .status(401)
                .send(
                    'Customer creation failed: customer validations, payment method validations or card verification is NOT in order',
                );
            return;
        }
        const customer = result.customer;
        const customerId = customer.id; // e.g 160923
        paymentToken = customer.paymentMethods[0].token; // e.g f28wm

        // save customer id in database so we can find their information in the braintree vault later
        await db().run(...SQL`UPDATE Users SET customer_id = ${customerId} WHERE id = ${uid}`);
    }

    const subscriptionResult = await gateway.subscription.create({
        paymentMethodToken: paymentToken,
        planId: PLAN_IDS[TYPE],
    });

    if (!subscriptionResult.success) {
        response
            .status(401)
            .send(
                'Subscription creation failed: customer validations, payment method validations or card verification is NOT in order',
            );
        return;
    }
    const businessId = await createBusiness(uid, businessName, subscriptionResult.subscription.id);

    response.status(200);
    response.send({ businessId: businessId });
});

// gets the noncanceled subscriptions
router.get('/subscriptions', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const customerId = await getCustomerId(uid);
    if (!customerId) {
        response.status(401).send('Customer not registered in database');
        return;
    }
    const customer = await gateway.customer.find('' + customerId);
    let subscriptions = [];

    customer.paymentMethods.forEach(paymentMethod => {
        subscriptions = [...subscriptions, ...paymentMethod.subscriptions];
    });

    subscriptions = subscriptions.filter(subscription => subscription.status !== 'Canceled');
    subscriptions = await Promise.all(
        subscriptions.map(async subscription => {
            return {
                plan: PLAN_NAME.get(subscription.planId),
                nextBillingDate: subscription.nextBillingDate,
                nextBillAmount: subscription.nextBillAmount,
                status: subscription.status,
                id: subscription.id,
                businessName: await getBusinessName(subscription.id),
            };
        }),
    );

    response.send(subscriptions);
});

router.get('/cancelSubscription', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const subscriptionId = request.query.id;

    const customerId = await getCustomerId(uid);
    if (!customerId) {
        response.status(401).send('Customer not registered in database');
        return;
    }
    const customer = await gateway.customer.find('' + customerId);

    let subscriptions = [];
    customer.paymentMethods.forEach(paymentMethod => {
        subscriptions = [...subscriptions, ...paymentMethod.subscriptions];
    });

    for (let i = 0; i < subscriptions.length; i++) {
        let subscription = subscriptions[i];
        if (subscription.id === subscriptionId) {
            await gateway.subscription.cancel(subscriptionId);
            const business = await db().get(
                ...SQL`SELECT id FROM Businesses WHERE subscriptionId = ${subscriptionId}`,
            );
            deleteBusiness(business.id);
            response.sendStatus(200);
            return;
        }
    }

    response.sendStatus(403); // subscription is not owned by customer
});

// ============================ PAYMENT EXPORTS ============================
exports.paymentRouter = router;
