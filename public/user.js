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
async function handleBusinessLoad(business) {
    document.getElementById('leave-' + business.id).addEventListener('click', async () => {
        if (business.role === 'owner') {
            Popup.alert(`<h1>Warning!</h1>Can't leave a group you own. Please go to <a href="/payment.html" class="button">manage groups</a> if you want to delete the group.`);
            return;
        }
        const shouldLeave = await Popup.confirm("Are you sure you want to leave this group? Your attendance records will be kept but you wont be able to see events and take attendance for this group unless you re-join.");
        if (shouldLeave) {
            const res = await GET(`/leave?businessId=${business.id}`);
            if (!res.ok) {
                Popup.alert(`<h1>Failed to leave ${business.name}</h1> Try again later or <a href="/" class="button">Contact Us</a>`)
            }
        }
    });

    const userdata = await (await GET(`/userdata?businessId=${business.id}`)).json();
    
    const description = document.getElementById('description-' + business.id);
    description.classList.remove('load-wrapper');
    description.innerHTML = `<span style="white-space: nowrap; margin: 30px">Created by ${userdata.ownerName}</span> <span style="white-space: nowrap;">With ${userdata.numUsers} current members</span> <span style="white-space: nowrap; margin: 30px">And ${userdata.userEvents.length} planned events!</span>`;

    let absentCount = 0, presentCount = 0, lateCount = 0;
    const dayOfTheWeekAbsentCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayOfTheWeekPresentCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayOfTheWeekLateCounts = [0, 0, 0, 0, 0, 0, 0];
    const now = Date.now();
    for (const event of userdata.userEvents) {
        const starttimestamp = event.starttimestamp * 1000
        const start = new Date(starttimestamp);
        if (event.status === 'PRESENT') {
            dayOfTheWeekPresentCounts[start.getDay()]++;
            presentCount++;
        } else if (event.status === 'LATE') {
            dayOfTheWeekLateCounts[start.getDay()]++;
            lateCount++;
        } else if (starttimestamp <= now) {
            dayOfTheWeekAbsentCounts[start.getDay()]++;
            absentCount++;
        }
    }

    Chart.overrides['doughnut'].plugins.legend.display = false;
    Chart.overrides['doughnut'].responsive = false;
    new Chart(document.getElementById('status-' + business.id), {
        type: 'doughnut',
        data: {
            labels: [
                'PRESENT',
                'ABSENT',
                'LATE'
            ],
            datasets: [{
                label: 'Events',
                data: [presentCount, absentCount, lateCount],
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Attendance Status'
                }
            }
        }
    });

    new Chart(document.getElementById('attendance-' + business.id), {
        type: 'bar',
        data: {
            labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            datasets: [
                {
                    label: 'Present',
                    data: dayOfTheWeekPresentCounts,
                    borderWidth: 1
                },
                {
                    label: 'Absent',
                    data: dayOfTheWeekAbsentCounts,
                    borderWidth: 1
                },
                {
                    label: 'Late',
                    data: dayOfTheWeekLateCounts,
                    borderWidth: 1
                }
            ]
        },
        options: {
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => { if (value % 1 === 0) { return value; } }
                    },
                    stacked: true
                }
            },
            maintainAspectRatio: false
        }
    });

    document.getElementById('upcoming-' + business.id).innerHTML = /* html */`
        <br>
        <h1>Upcoming Events:</h1>
        <br>
        <ul style="width: fit-content; margin: auto; list-style-type: none">
            ${
                userdata.userEvents.sort((a, b) => a.starttimestamp - b.starttimestamp).filter(ev => ev.starttimestamp * 1000 >= now).slice(0, 10).map(ev => '<li>' + ev.name + ' - ' + (new Date(ev.starttimestamp * 1000)).toDateString() + '</li>').join('')
            }
        </ul>
        <br>
        <a href="/calendar.html" class="button">See all in Calendar</a>
    `;

    [...document.getElementById('card-' + business.id).getElementsByClassName('load-wrapper')].forEach(elem => elem.classList.remove('load-wrapper'));
}

const userBusinesses = await (await GET(`/businesses`)).json();
let businessHTML = '';
userBusinesses.forEach((business) => {
    businessHTML += /* html */ `
        <div class="business-card" id="card-${business.id}">
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
            <div style="min-height: 1.5rem;" class="load-wrapper">
                <div class="activity"></div>
                <div id="description-${business.id}"></div>
            </div>
            <div style="display: flex; flex-wrap: wrap">
                <div style="flex-grow: 1; min-width: 30%; min-height: 100px;" class="load-wrapper">
                    <div class="activity"></div>
                    <canvas id="status-${business.id}" style="margin: auto"></canvas>
                </div>
                <div style="flex-grow: 1; min-width: 30%; min-height: 100px;" class="load-wrapper">
                    <div class="activity"></div>
                    <canvas id="attendance-${business.id}"></canvas>
                </div>
                <div style="flex-grow: 1; min-width: 30%; min-height: 100px;" class="load-wrapper">
                    <div class="activity"></div>
                    <div id="upcoming-${business.id}"></div>
                </div>
            </div>
        </div>
    `;
    setTimeout(() => {
        handleBusinessLoad(business);
    });
})
document.getElementById("businesses").innerHTML = businessHTML;