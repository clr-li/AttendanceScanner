import { requireLogin, getCurrentUser } from './util/Auth.js';
import { GET } from './util/Client.js';
import { Popup } from './components/Popup.js';
await requireLogin();
const user = getCurrentUser();
      
// ================== Join Logic ==================
async function joinFromUrl(urlstr) {
    const url = new URL(urlstr);
    const params = url.searchParams;
    const businessId = params.get('id');
    const joincode = params.get('code');
    if (businessId && joincode) {
        console.log("joined: " + businessId + "_" + joincode);
        await GET(`/join?businessId=${businessId}&code=${joincode}`);
    }
}
joinFromUrl(window.location.href);

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
    "qr-reader", { 
        fps: 10, 
        qrbox: Math.min(window.innerWidth, 1000) / 2,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
    });
document.getElementById('join').addEventListener('click', (e) => {
    if (e.target.classList.contains('scanning')) {
        html5QrcodeScanner.clear();
        e.target.textContent = "Scan QR Code to Join";
    } else {
        html5QrcodeScanner.render(onScanSuccess);
        e.target.textContent = "Stop Join Code Scanner";
    }
    e.target.classList.toggle('scanning');
});

// ================== Identity QR Code ==================
new QRCode(document.getElementById("qrcode"), user.uid);
document.getElementById("qrcode").getElementsByTagName('img')[0].onload = () => {
    document.getElementById('downloadqr').download = user.name + '.png';
    document.getElementById('downloadqr').href = document.getElementById("qrcode").getElementsByTagName('img')[0].src;
};
document.getElementById('fullscreenToggle').addEventListener('click', (e) => {
    if (document.fullscreenElement) { 
        document.exitFullscreen(); 
        e.target.innerHTML = 'Full Screen &nbsp;<i class="fa fa-expand"></i>' 
    } else { 
        document.getElementById('myqr').requestFullscreen(); 
        e.target.innerHTML = 'Collapse &nbsp;<i class="fa-solid fa-compress"></i>';
    }
});
document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) {
        document.getElementById('fullscreenToggle').innerHTML = 'Collapse &nbsp;<i class="fa-solid fa-compress"></i>';
    } else {
        document.getElementById('fullscreenToggle').innerHTML = 'Full Screen &nbsp;<i class="fa fa-expand"></i>' 
    }
});

// ================== Display Groups ==================
async function handleBusinessLoad(id) {
    document.getElementById('leave-' + id).addEventListener('click', async () => {
        const shouldLeave = await Popup.confirm("Are you sure you want to leave this group? Your attendance records will be kept but you wont be able to see events and take attendance for this group unless you re-join.");
        console.log(shouldLeave);
    });

    const records = await (await GET(`/userdata?businessId=${id}`)).json();
    console.log(records);
    
    // records.forEach((record) => {
    //    html += `Event: ${record.name} Status: ${record.status} Logged: ${record.timestamp} Event start: ${record.starttimestamp} Event end: ${record.endtimestamp}<br>`;
    // });
    // document.getElementById("events").innerHTML = html;
}

const userBusinesses = await (await GET(`/businesses`)).json();
let businessHTML = '';
userBusinesses.forEach((business) => {
    businessHTML += /* html */ `
        <div class="business-card">
            <button id="leave-${business.id}" class="button delete" style="position: absolute; right: 6px; top: 6px; min-width: 0">Leave&nbsp;<i class="fa fa-sign-out" aria-hidden="true"></i></button>
            <h1>
                ${business.name}
                <span>(${
                    (business.role !== 'user') ?
                        '<a href="/admin.html?businessId=' + business.id + '">' + business.role + '</a>'
                    : 
                        business.role
                })</span>
            </h1>
            <hr>
            <div style="height: 2rem;" class="load-wraper">
                <div class="activity"></div>
            </div>
            <div style="display: flex">
                <div style="width: 100%; aspect-ratio: 2 / 1" class="load-wraper">
                    <div class="activity"></div>
                </div>
                <div style="width: 100%; aspect-ratio: 2 / 1" class="load-wraper">
                    <div class="activity"></div>
                </div>
                <div style="width: 100%; aspect-ratio: 2 / 1" class="load-wraper">
                    <div class="activity"></div>
                </div>
            </div>
        </div>
    `;
    setTimeout(() => {
        handleBusinessLoad(business.id);
    });
})
document.getElementById("businesses").innerHTML = businessHTML;