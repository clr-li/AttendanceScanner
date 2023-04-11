import { GET, POST } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
await requireLogin();

async function unsubscribe(id) {
    document.getElementById("loader").style.display = "block";
    await GET("/cancelSubscription?id=" + id);
    document.getElementById("subscriptions").removeChild(document.getElementById(id));
    document.getElementById("loader").style.display = "none";
}

async function showSubscriptions() {
    document.getElementById("loader").style.display = "block";
    try {
        const res = await GET("/subscriptions");
        var subscriptions = await res.json();
    } catch (err) {
        var subscriptions = [];
    }
    
    document.getElementById("subscriptions").innerHTML = "<h1>Manage Subscriptions</h1>";
    subscriptions.forEach(sub => {
        const div = document.createElement("div");
        div.id = sub.id;
        div.innerHTML = `
        <h3>${sub.plan} PLAN</h3>
        <ul>
            <li>Business: ${sub.businessName}</li>
            <li>Status: ${sub.status}</li>
            <li>Next Billing Date: ${new Intl.DateTimeFormat(undefined).format(new Date(sub.nextBillingDate))}</li>
            <li>Next Billing Amount: ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(parseInt(sub.nextBillAmount))}</li>
        </ul>
        <button aria-label="delete" id="btn-${sub.id}" style="background:none;border:none;position:absolute;top:10px;right:10px;width:auto;min-width:0">❌</button>
        `;
        div.style = "border: 1px solid black; border-radius: 20px; padding: 10px; margin: 8px; position: relative";
        document.getElementById("subscriptions").appendChild(div);
        document.getElementById("btn-" + sub.id).addEventListener("click", () => { if (confirm("This will cancel this subscription and delete all data of its associated business. Proceed?")) unsubscribe(sub.id) });
    });
    document.getElementById("loader").style.display = "none";
}

const form = document.getElementById('payment-form');
const res = await GET("/clientToken");
const token = await res.text();

// Braintree client instance to handle payments
const clientInstance = await braintree.client.create({
    authorization: token
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
    client: clientInstance
})
const deviceData = dataCollectorInstance.deviceData;
localStorage.setItem("device-data", deviceData);

// Payment Request
form.addEventListener('submit', async event => {
    event.preventDefault();

    document.getElementById("loader").style.display = "block";
    try {
        const payload = await dropinInstance.requestPaymentMethod();
        payload.deviceData = localStorage.getItem("device-data");
        payload.businessName = document.getElementById("businessName").value;
        await POST("/checkout", payload)
    } finally {
        showSubscriptions();
    }
});

showSubscriptions();