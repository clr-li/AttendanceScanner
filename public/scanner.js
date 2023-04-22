import { GET } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
await requireLogin();

const url = new URL(window.location);
const params = url.searchParams;
const eventid = params.get('eventid');
const businessId = params.get('businessId');
const res = await GET(`/eventdata?eventid=${eventid}&businessId=${businessId}`); 
const eventInfo = await res.json();

let status = Date.now() <= parseInt(eventInfo.starttimestamp) * 1000 ? "PRESENT" : "LATE";

let lastUserId = -1;
async function onScanSuccess(decodedText, decodedResult) {
    // Handle on success condition with the decoded text or result.
    let fileMode = false;
    try {
        html5QrcodeScanner.pause();
    } catch {
        fileMode = true; // scanner is in file mode
    }
    console.log(`Scan result: ${decodedText}`, decodedResult);

    if (lastUserId != decodedText) {
        const res = await GET(`/recordAttendance?eventid=${eventid}&userid=${decodedText}&status=${status}&businessId=${businessId}`);
        console.log(res.status);
        if (!fileMode) html5QrcodeScanner.resume();
        lastUserId = decodedText;
    } else {
        if (!fileMode) html5QrcodeScanner.resume();
    }
}

const statusSelector = document.getElementById("status");
statusSelector.addEventListener("select", (e) => {
    status = e.detail;
})
statusSelector.setAttribute("value", status);

let html5QrcodeScanner = new Html5QrcodeScanner(
  "qr-reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess);