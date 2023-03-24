import { requireLogin, getCurrentUser } from './util/Auth.js';
import { GET } from './util/Client.js';
await requireLogin();
const user = getCurrentUser();
      
async function joinFromUrl(urlstr) {
    let url = new URL(urlstr);
    let params = url.searchParams;
    let businessId = params.get('id');
    let joincode = params.get('code');
    if (businessId && joincode) {
        console.log("joined: " + businessId + "_" + joincode);
        await GET(`/join?businessId=${businessId}&code=${joincode}`);
    }
}
joinFromUrl(window.location.href);

new QRCode(document.getElementById("qrcode"), user.uid);

function onScanSuccess(decodedText, decodedResult) {
    // Handle on success condition with the decoded text or result.
    html5QrcodeScanner.pause();
    console.log(`Scan result: ${decodedText}`, decodedResult);
    if (decodedText.startsWith("https://" + window.location.hostname + "/user.html?")) {
        joinFromUrl(decodedText);
    } else {
        html5QrcodeScanner.resume();
    }
}
let html5QrcodeScanner = new Html5QrcodeScanner(
"reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess);

window.handleBusinessClick = async (id) => {
    let html = "";
    const records = await (await GET(`/userdata?businessId=${id}`)).json();
    console.log(records);
    
    records.forEach((record) => {
       html += `Event: ${record.name} Status: ${record.status} Logged: ${record.timestamp} Event start: ${record.starttimestamp} Event end: ${record.endtimestamp}<br>`;
    });
    document.getElementById("events").innerHTML = html;
}

let html = "<tr><th>Business Name</th></tr>";
let userBusinesses = await (await GET(`/businesses`)).json();
userBusinesses.forEach((business) => {
    html += `<td onclick="handleBusinessClick(${business.id})">${business.name}, ${business.role}</td>`;
});
document.getElementById("businesses").innerHTML = html;