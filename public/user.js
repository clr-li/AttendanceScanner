import { requireLogin, getCurrentUser } from './util/Auth.js';
import { GET } from './util/Client.js';
await requireLogin();
const user = getCurrentUser();
      
// ================== Join Logic ==================
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
        e.target.textContent = "Hide QR Join Code Scanner";
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