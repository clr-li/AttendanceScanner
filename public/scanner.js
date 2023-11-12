import { GET } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
import { Popup } from './components/Popup.js';
import { QRCode } from './components/QRCode.js';
import { useURL } from './util/StateManager.js';
import { initBusinessSelector, initEventSelector } from './util/selectors.js';
await requireLogin();

const { get: getEventid, set: setEventId } = useURL('eventId');
const { get: getBusinessId } = useURL('businessId');

function canCreateEvent(role) {
    return ['admin', 'owner', 'moderator'].includes(role);
}

async function autoCreateEvent() {
    const date = new Date(); // current date and time
    const starttimestamp = date.getTime() / 1000;
    const endtimestamp = starttimestamp + 3600; // 1 hour
    const name = date.toDateString();
    const description = "Auto generated event created on " + date.toString();

    const res = await GET(`/makeEvent?name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}`)
    const id = await res.json()
    setEventId(id);
    useURL('status').set("PRESENT");
    location.reload();
}

if (location.hash === "#new") {
    const pop = new Popup();
    pop.innerHTML = /* html */`
        <type-select id="businessId" name="businesses" label="Please select a business: "></type-select>
        <button class="button" id="create">Create New Event</button>
    `;
    document.body.appendChild(pop);

    const { selector } = await initBusinessSelector("businessId", async (e) => {}, true, canCreateEvent);
    if (selector.childElementCount === 1) {
        await autoCreateEvent();
    } else {
        document.getElementById("create").addEventListener("click", autoCreateEvent);
    }
} else if (!getEventid() || !getBusinessId()) {
    const pop = new Popup();
    pop.innerHTML = /* html */`
        <type-select id="businessId" name="businesses" label="Please select a business: "></type-select>
        <type-select id="eventId" name="events" label="Optionally select an event: "></type-select>
        <span title="Can only create events for businesses where you have write priviledges">
            <button class="button" id="create">Create New</button>
        </span>
        <span title="You must select an event to use it">
            <button class="button" id="selected" disabled>Use Selected</button>
        </span>
    `;
    document.body.appendChild(pop);

    await initBusinessSelector("businessId", async (e) => {
        setEventId(undefined);
        await updateEvents();
        document.getElementById("selected").disabled = getEventid() == null;
        document.getElementById("create").disabled = !canCreateEvent(e.detail.textContent);
    });
    const { updateEvents } = await initEventSelector("eventId", getBusinessId);

    document.getElementById("selected").disabled = getEventid() == null;
    document.getElementById("create").disabled = !canCreateEvent(document.getElementById("businessId").getSelected().textContent);

    document.getElementById("create").addEventListener("click", autoCreateEvent);
    document.getElementById("selected").addEventListener("click", () => location.reload());

    throw new Error("No eventid or businessId"); // stop execution
}

const res = await GET(`/eventdata?eventid=${getEventid()}&businessId=${getBusinessId()}`); 
const eventInfo = await res.json();

const { get: getStatus, set: setStatus } = useURL('status', Date.now() <= parseInt(eventInfo.starttimestamp) * 1000 ? "PRESENT" : "LATE");
const statusSelector = document.getElementById("status");
statusSelector.addEventListener("select", (e) => {
    setStatus(e.detail.value);
})
statusSelector.setAttribute("value", getStatus());

// ========= Scanner =========
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
        const res = await GET(`/recordAttendance?eventid=${getEventid()}&userid=${decodedText}&status=${getStatus()}&businessId=${getBusinessId()}`);
        console.log(res.status);
        if (!res.ok) {
            Popup.alert(res.statusText, 'var(--error)');
        } else {
            if (fileMode)
                Popup.alert(`Successfully recorded attendance!`, 'var(--success)', 2000);
        }
        if (!fileMode) html5QrcodeScanner.resume();
        lastUserId = decodedText;
    } else {
        if (!fileMode) html5QrcodeScanner.resume();
    }
}

let html5QrcodeScanner = new Html5QrcodeScanner(
  "qr-reader", { fps: 10, qrbox: 250 });

function initScanner() {
    html5QrcodeScanner.render(onScanSuccess);
    document.getElementById("qr-reader").style.border = "none";
}


// ========= QR Code - Member Scan =========
const scan_button = document.getElementById("scan-button");
const qr_button = document.getElementById("qr-button");
const member_scan = document.getElementById("member-scan");
const scanner = document.getElementById("scan");

const codeRes = await GET(`/getOrSetTempAttendanceCode?eventid=${getEventid()}&businessId=${getBusinessId()}`);
const code = await codeRes.text();
const qrElement = new QRCode(`${location.origin}/userAttendance.html?eventid=${getEventid()}&businessId=${getBusinessId()}&status=${getStatus()}&code=${code}`, "attendanceCode");
qrElement.innerHTML = /* html */`
    <span title="Will also expire if the tab is deactivated - e.g. hidden from rendering or another url is visited">
    <label>
    Expires 
    <select class="themify" id="expiration-select">
        <option value="300000">5 minutes</option>
        <option value="1800000">30 minutes</option>
        <option value="3600000">1 hour</option>
        <option value="7200000">2 hours</option>
        <option value="14400000">4 hours</option>
        <option value="28800000">8 hours</option>
        <option value="86400000">1 day</option>
    </select>
    after closing this tab or <button class="themify" id="regen-button">regen now</button>
    </label>
    </span>
`;
member_scan.append(qrElement);

const { get: getExpiration, set: setExpiration } = useURL('expiration', 300_000);

async function refreshTempAttendanceCode() {
    const res = await GET(`/refreshTempAttendanceCode?eventid=${getEventid()}&businessId=${getBusinessId()}&expiration=${getExpiration()}&code=${code}`);
    if (!res.ok) {
        Popup.alert(res.statusText, 'var(--error)');
    }
}

document.getElementById("expiration-select").value = getExpiration();
document.getElementById("expiration-select").addEventListener("change", async (e) => {
    setExpiration(e.target.value);
    refreshTempAttendanceCode();
});

setInterval(() => {
    setExpiration(document.getElementById("expiration-select").value);
    refreshTempAttendanceCode();
}, 250_000);

document.getElementById("regen-button").addEventListener("click", async () => {
    const codeRes = await GET(`/setNewTempAttendanceCode?eventid=${getEventid()}&businessId=${getBusinessId()}&expiration=${getExpiration()}`);
    const code = await codeRes.text();
    qrElement.update(`${location.origin}/userAttendance.html?eventid=${getEventid()}&businessId=${getBusinessId()}&status=${getStatus()}&code=${code}`);
});

// ========= Switch between QR Code and Scanner =========
const { get: getActiveTab, set: setActiveTab } = useURL('active', 'scanner');

function activateScanner() {
    scanner.style.display = 'block'; member_scan.style.display = 'none';
    scan_button.classList.add("active");
    qr_button.classList.remove("active");
    try {
        html5QrcodeScanner.resume();
    } catch {
        // scanner is in file mode
    }
    setActiveTab('scanner');
    initScanner();
}

function activateQR() {
    scanner.style.display = 'none'; member_scan.style.display = 'block';
    qr_button.classList.add("active");
    scan_button.classList.remove("active");
    try {
        html5QrcodeScanner.pause();
    } catch {
        // scanner is in file mode
    }
    setActiveTab('qr');
}

if (getActiveTab() === "scanner") {
    activateScanner();
} else {
    activateQR();
}
scan_button.onclick = activateScanner;
qr_button.onclick = activateQR;