// express for routing
const express = require('express'),
  router = express.Router();
// braintree for payments
const braintree = require("braintree");
const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.MERCHANTID,
  publicKey: process.env.MERCHANTPUBLIC,
  privateKey: process.env.MERCHANTPRIVATE
});
// database access
const {db, asyncGet, asyncAll, asyncRun, asyncRunWithID} = require('./Database');
// user auth
const handleAuth = require('./Auth').handleAuth;

// ============================ PAYMENT SETTINGS ============================
const PLAN_IDS = { // subscription plans
  STANDARD: "n2wg"
};
const PLAN_NAME = new Map(Object.entries(PLAN_IDS).map(keyval => [keyval[1], keyval[0]])); // reverse lookup plan name from plan id

// ============================ PAYMENT FUNCTIONS ============================

// returns true if the user (specified by uid) subscribes at least once to the planId 
// (allowtrial specifies whether trial subscriptions should count)
// throws any error that's not a "notFoundError" (the user hasn't signed up as a customer yet)
// returns false otherwise
async function verifySubscription(uid, planId, allowtrial=true) {
  const user = await asyncGet(`SELECT customer_id FROM Users WHERE id = ?`, [uid]);
  if (!user.Customer_id) return false;
  try {
    var customer = await gateway.customer.find("" + user.Customer_id);
  } catch (err) {
    if (err.type === "notFoundError") return false;
    throw err;
  }
  customer.paymentMethods.forEach(paymentMethod => {
    paymentMethod.subscriptions.forEach(subscription => {
      if (subscription.status === "Active" 
          && subscription.planId === planId 
          && (allowtrial || !subscription.trialPeriod)) {
          return true;
      }
    });
  });
  return false;
}

// ============================ PAYMENT ROUTES ============================

// this token authorizes the client to access the payment portal and modify customer payment information
// if the client is already a customer, we give them access to their braintree customer via the stored customer_id
router.get("/clientToken", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const customerId = (await asyncGet(`SELECT customer_id FROM Users WHERE id = ?`, [uid])).customer_id;
  const tokenOptions = {};
  console.log("CustomerId requested a client token: " + customerId)
  if (customerId) {
    tokenOptions.customerId = customerId;
    tokenOptions.options = {
      failOnDuplicatePaymentMethod: true,
      makeDefault: true,
      verifyCard: true
    };
  }

  let res = await gateway.clientToken.generate(tokenOptions);
  const clientToken = res.clientToken;
  response.send(clientToken);
});

// we get the paymentNonce from the client (a secure way to communicate payment information)
// and use it to create a customer in the braintree vault
// or if the client already has a customer, we get that customer using the stored id
// then we select the default payment method (as set by the client SDK) of the customer 
// and use the corresponding paymentMethodToken to subscribe to the payment plan
router.post("/checkout", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const nonceFromTheClient = request.body.nonce;
  const deviceData = request.body.deviceData;
  const businessName = request.body.businessName;

  const user = await asyncGet(`SELECT customer_id, name FROM Users WHERE id = ?`, [uid]);

  let paymentToken;
  if (user.customer_id) { // customer already exists in braintree vault
    const result = await gateway.paymentMethod.create({
      customerId: user.customer_id,
      paymentMethodNonce: nonceFromTheClient,
      options: {
        failOnDuplicatePaymentMethod: true,
        makeDefault: true,
        verifyCard: true
      }
    });
    if (!result.success) {
        // customer validations, payment method validations or card verification is NOT in order
        response.sendStatus(401);
        return;
    }
    paymentToken = result.paymentMethod.token;
  } else { // customer doesn't exist, so we use the paymentMethodNonce to create them!
    const spaceIX = user.name.indexOf(' ');
    const result = await gateway.customer.create({
      firstName: user.name.substring(0, spaceIX),
      lastName: user.name.substring(spaceIX),
      paymentMethodNonce: nonceFromTheClient,
      deviceData: deviceData
    });
    if (!result.success) {
        // customer validations, payment method validations or card verification is NOT in order
        response.sendStatus(401);
        return;
    }
    const customer = result.customer;
    const customerId = customer.id; // e.g 160923
    paymentToken = customer.paymentMethods[0].token; // e.g f28wm

    console.log("Created customer with id: " + customerId);

    // save customer id in database so we can find their information in the braintree vault later
    await asyncRun(`UPDATE Users SET customer_id = ? WHERE id = ?`, [customerId, uid]);
  }

  const subscriptionResult = await gateway.subscription.create({
    paymentMethodToken: paymentToken,
    planId: PLAN_IDS.STANDARD,
  });
  if (!subscriptionResult.success) {
      // customer validations, payment method validations or card verification is NOT in order
      response.sendStatus(401);
      return;
  }
  console.log("Added subscription via paymentToken: " + paymentToken)
  await createBusiness(uid, businessName);

  response.sendStatus(200);
});

// get's the noncanceled subscriptions
router.get("/subscriptions", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    
    const customerId = (await asyncGet(`SELECT Customer_id FROM Users WHERE id = ?`, [uid])).Customer_id;
    if (!customerId) {
        response.sendStatus(401);
        return;
    }
    const customer = await gateway.customer.find("" + customerId);
    let subscriptions = [];
    
    customer.paymentMethods.forEach(paymentMethod => {
      subscriptions = [...subscriptions, ...paymentMethod.subscriptions];
    });
    
    subscriptions = subscriptions.filter(subscription => subscription.status != "Canceled");
    
    subscriptions = subscriptions.map(subscription => {
      return {
        plan: PLAN_NAME.get(subscription.planId),
        nextBillingDate: subscription.nextBillingDate,
        nextBillAmount: subscription.nextBillAmount,
        status: subscription.status,
        trialPeriod: subscription.trialPeriod,
        id: subscription.id
      };
    });
    
    response.send(subscriptions);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

router.get("/cancelSubscription", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    
    const subscriptionId = request.query.id;
    
    const customerId = (await asyncGet(`SELECT Customer_id FROM Users WHERE id = ?`, [uid])).Customer_id;
    if (!customerId) {
        response.sendStatus(401);
        return;
    }
    const customer = await gateway.customer.find("" + customerId);
    
    let subscriptions = [];
    customer.paymentMethods.forEach(paymentMethod => {
      subscriptions = [...subscriptions, ...paymentMethod.subscriptions];
    });
    
    for (let i = 0; i < subscriptions.length; i++) {
      let subscription = subscriptions[i];
      if (subscription.id === subscriptionId) {
        await gateway.subscription.cancel(subscriptionId);
        response.sendStatus(200);
        return
      }
    }
    
    response.sendStatus(403); // subscription is not owned by customer
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

// ============================ PAYMENT EXPORTS ============================
exports.paymentRouter = router;
exports.verifySubscription = verifySubscription;
exports.PLAN_IDS = PLAN_IDS;