import { GET, POST } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
import { Popup } from './components/Popup.js';
import { sanitizeText } from './util/util.js';
const braintree = window.braintree;
await requireLogin();

let subscriptionType = null;

function showLoader() {
    document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

async function unsubscribe(id) {
    showLoader();
    await GET('/cancelSubscription?id=' + id);
    document.getElementById('subscriptions').removeChild(document.getElementById(id));
    hideLoader();
}

async function showSubscriptions() {
    showLoader();
    let subscriptions = [];
    try {
        const res = await GET('/subscriptions');
        subscriptions = await res.json();
    } catch (err) {
        subscriptions = [];
    }

    subscriptions.forEach(sub => {
        const div = document.createElement('div');
        div.id = sub.id;
        div.classList.add('business-card');
        div.innerHTML = /* html */ `
        <h3 style="margin-bottom: 5px;">${sanitizeText(sub.businessName)}</h3>
        <hr>
        <div style="text-align: center; max-width: fit-content; margin: auto;">
            <li style="text-align: left; margin-bottom: 3px;">Subscription: ${sanitizeText(
                sub.plan,
            )}</li>
            <li style="text-align: left; margin-bottom: 3px;">Status: ${sanitizeText(
                sub.status,
            )}</li>
            <li style="text-align: left; margin-bottom: 3px;">Next Billing Date: ${sanitizeText(
                new Intl.DateTimeFormat(undefined).format(new Date(sub.nextBillingDate)),
            )}</li>
            <li style="text-align: left; margin-bottom: 3px;">Next Billing Amount: ${sanitizeText(
                new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
                    parseInt(sub.nextBillAmount),
                ),
            )}</li>
        </div>
        <button aria-label="delete" id="btn-${
            sub.id
        }" style="background:none;border:none;position:absolute;top:10px;right:10px;width:auto;min-width:0">❌</button>
        `;
        document.getElementById('subscriptions').appendChild(div);
        document.getElementById('btn-' + sub.id).addEventListener('click', async () => {
            if (
                await Popup.confirm(
                    `This will cancel this subscription and delete all data of its associated group. Proceed?`,
                )
            )
                unsubscribe(sub.id);
        });
    });
    hideLoader();
}

const form = document.getElementById('payment-form');
const res = await GET('/clientToken');
const token = await res.text();

// Braintree client instance to handle payments
const clientInstance = await braintree.client.create({
    authorization: token,
});

// Payment Dropin UI
const dropinInstance = await braintree.dropin.create({
    authorization: token,
    container: document.getElementById('dropin-container'),
    // paypal: { -- paypal, apple pay, etc. requires signing up for their services and connecting to braintree
    //   flow: 'vault'
    // },
    // venmo: {} -- does not allow subscription services
});

// Device data collection
const dataCollectorInstance = await braintree.dataCollector.create({
    client: clientInstance,
});
const deviceData = dataCollectorInstance.deviceData;
localStorage.setItem('device-data', deviceData);

// Payment Request
form.addEventListener('submit', async event => {
    event.preventDefault();

    showLoader();
    try {
        const payload = await dropinInstance.requestPaymentMethod();
        payload.subscriptionType = subscriptionType;
        payload.deviceData = localStorage.getItem('device-data');
        payload.businessName = document.getElementById('businessName').value;
        const res = await POST('/checkout', payload);
        if (res.ok) {
            location.assign('/admin.html?businessId=' + (await res.json()).businessId);
        } else {
            Popup.alert(sanitizeText(await res.text()), 'var(--error)');
        }
    } finally {
        showSubscriptions();
    }
});

const freeSubscription = document.getElementById('free');
const standardSubscription = document.getElementById('standard');

freeSubscription.addEventListener('click', async () => {
    console.log('free subscription');
    freeSubscription.classList.add('active-subscription');
    standardSubscription.classList.remove('active-subscription');
    document.getElementById('purchase-btn').textContent = 'Create Free Group';
    document.getElementById('purchase-subscription').style.display = 'block';
    subscriptionType = 'FREE';
});

standardSubscription.addEventListener('click', async () => {
    console.log('standard subscription');
    freeSubscription.classList.remove('active-subscription');
    standardSubscription.classList.add('active-subscription');
    document.getElementById('purchase-btn').textContent = 'Purchase Standard Subscription';
    document.getElementById('purchase-subscription').style.display = 'block';
    subscriptionType = 'STANDARD';
});

showSubscriptions();
