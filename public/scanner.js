import { GET } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
await requireLogin();

let url = new URL(window.location);
let params = url.searchParams;
let eventid = params.get('eventid');
let businessId = params.get('businessId');
const res = await GET(`/eventdata?eventid=${eventid}&businessId=${businessId}`); 
const eventInfo = await res.json();
console.log(eventInfo);
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
        const status = Date.now() <= parseInt(eventInfo.starttimestamp) * 1000 ? "PRESENT" : "LATE";
        const res = await GET(`/recordAttendance?eventid=${eventid}&userid=${decodedText}&status=${status}&businessId=${businessId}`);
        console.log(res.status);
        if (!fileMode) html5QrcodeScanner.resume();
        lastUserId = decodedText;
    } else {
        if (!fileMode) html5QrcodeScanner.resume();
    }
}

let html5QrcodeScanner = new Html5QrcodeScanner(
  "qr-reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess);