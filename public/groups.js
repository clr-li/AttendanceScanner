import { requireLogin } from './util/Auth.js';
import { GET, PUT, POST, DELETE } from './util/Client.js';
import { Popup } from './components/Popup.js';
import { sanitizeText } from './util/util.js';
const Html5QrcodeScanner = window.Html5QrcodeScanner;
const Html5QrcodeSupportedFormats = window.Html5QrcodeSupportedFormats;
const Chart = window.Chart;
await requireLogin();

// ================== Join Logic ==================
async function joinFromUrl(urlstr) {
    const url = new URL(urlstr);
    const params = url.searchParams;
    const businessId = params.get('id');
    const joincode = params.get('code');
    if (businessId && joincode) {
        console.log('joined: ' + businessId + '_' + joincode);
        const res = await POST(`/businesses/${businessId}/members?joincode=${joincode}`);
        if (!res.ok) {
            await Popup.alert(sanitizeText(await res.text()), 'var(--error)');
        } else {
            location.assign('/groups.html');
        }
    }
}
joinFromUrl(window.location.href);

function onScanSuccess(decodedText, decodedResult) {
    // Handle on success condition with the decoded text or result.
    html5QrcodeScanner.pause();
    console.log(`Scan result: ${decodedText}`, decodedResult);
    if (decodedText.startsWith('https://' + window.location.hostname + '/groups.html?')) {
        joinFromUrl(decodedText);
    } else {
        html5QrcodeScanner.resume();
    }
}
let html5QrcodeScanner = new Html5QrcodeScanner('qr-reader', {
    fps: 10,
    qrbox: Math.min(window.innerWidth, 400) / 2,
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
});
document.getElementById('join').addEventListener('click', e => {
    if (e.target.classList.contains('scanning')) {
        html5QrcodeScanner.clear();
        e.target.textContent = 'Scan QR Code to Join';
    } else {
        html5QrcodeScanner.render(onScanSuccess);
        e.target.textContent = 'Stop Join Code Scanner';
    }
    e.target.classList.toggle('scanning');
});

// ================== Display Groups ==================
async function handleBusinessLoad(business) {
    document.getElementById('leave-' + business.id).addEventListener('click', async () => {
        if (business.role === 'owner') {
            Popup.alert(
                `<h1>Warning!</h1>Can't leave a group you own. Please go to <a href="/payment.html" class="button">manage groups</a> if you want to delete the group.`,
                'var(--warning)',
            );
            return;
        }
        const shouldLeave = await Popup.confirm(
            'Are you sure you want to leave this group? Your attendance records will be kept but you wont be able to see events and take attendance for this group unless you re-join.',
        );
        if (shouldLeave) {
            const res = await DELETE(`/businesses/${business.id}/members/me`);
            if (!res.ok) {
                Popup.alert(
                    `<h1>Failed to leave ${sanitizeText(
                        business.name,
                    )}</h1> Try again later or <a href="/#contact" class="button">Contact Us</a>`,
                    'var(--error)',
                );
            }
            location.assign('/groups.html');
        }
    });

    const userdata = await (await GET(`/businesses/${business.id}`)).json();

    const description = document.getElementById('description-' + business.id);
    description.classList.remove('load-wrapper');
    description.innerHTML = `<span style="white-space: nowrap; margin: 30px">Created by ${sanitizeText(
        userdata.ownerName,
    )}</span> <span style="white-space: nowrap;">With ${sanitizeText(
        userdata.numUsers,
    )} current members</span> <span style="white-space: nowrap; margin: 30px">And ${sanitizeText(
        userdata.userEvents.length,
    )} planned events!</span>`;

    const now = Date.now();
    const alwaysShowStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'N/A'];
    const extraStatuses = [...new Set(userdata.userEvents.map(ev => ev.status))].filter(
        status => status && !alwaysShowStatuses.includes(status),
    );
    const statuses = alwaysShowStatuses.concat(extraStatuses);

    const statusCounts = {};
    const dayOfTheWeekCounts = {};
    for (const status of statuses) {
        statusCounts[status] = 0;
        dayOfTheWeekCounts[status] = [0, 0, 0, 0, 0, 0, 0];
    }
    for (const event of userdata.userEvents) {
        const start = new Date(+event.starttimestamp);
        const status = event.status || (start <= now ? 'ABSENT' : 'N/A');
        statusCounts[status]++;
        dayOfTheWeekCounts[status][start.getDay()]++;
    }

    Chart.overrides['doughnut'].plugins.legend.display = false;
    Chart.overrides['doughnut'].responsive = false;
    new Chart(document.getElementById('status-' + business.id), {
        type: 'doughnut',
        data: {
            labels: statuses,
            datasets: [
                {
                    label: 'Events',
                    data: statuses.map(status => statusCounts[status]),
                },
            ],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Attendance Status',
                },
            },
        },
    });

    new Chart(document.getElementById('attendance-' + business.id), {
        type: 'bar',
        data: {
            labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            datasets: statuses.map(status => ({
                label: status,
                data: dayOfTheWeekCounts[status],
                borderWidth: 1,
            })),
        },
        options: {
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => {
                            if (value % 1 === 0) {
                                return value;
                            }
                        },
                    },
                    stacked: true,
                },
            },
            maintainAspectRatio: false,
        },
    });

    document.getElementById('upcoming-' + business.id).innerHTML = /* html */ `
        <br>
        <h1>Upcoming Events:</h1>
        <br>
        <ul style="width: fit-content; margin: auto; list-style-type: none">
            ${
                userdata.userEvents
                    .sort((a, b) => a.starttimestamp - b.starttimestamp)
                    .filter(ev => ev.starttimestamp >= now)
                    .slice(0, 10)
                    .map(
                        ev =>
                            '<li>' +
                            sanitizeText(ev.name) +
                            ' - ' +
                            sanitizeText(new Date(+ev.starttimestamp).toDateString()) +
                            '</li>',
                    )
                    .join('') || 'No upcoming events'
            }
        </ul>
        <br>
        <a href="/calendar.html" class="button">See all in Calendar</a>
    `;

    [
        ...document.getElementById('card-' + business.id).getElementsByClassName('load-wrapper'),
    ].forEach(elem => elem.classList.remove('load-wrapper'));
}

const userBusinesses = await (await GET(`/businesses`)).json();
let businessHTML = '';
const ownedBusinessIds = [];
userBusinesses.forEach(business => {
    business.id = sanitizeText(business.id);
    business.name = sanitizeText(business.name);
    business.role = sanitizeText(business.role);
    let renameHTML = '';
    if (business.role === 'owner') {
        renameHTML = /* html */ `
            <button id="${business.id}" type="button" style="background: none; border: none;"><i class="fa-regular fa-pen-to-square" style="font-size: 1rem;"></i></button>
        `;
        ownedBusinessIds.push(business.id);
    }
    businessHTML += /* html */ `
        <div class="business-card" id="card-${business.id}">
            <button id="leave-${
                business.id
            }" class="button delete" style="position: absolute; right: 6px; top: 6px; min-width: 0">Leave&nbsp;<i class="fa fa-sign-out" aria-hidden="true"></i></button>
            <h1>
                ${business.name}
                <span>(${
                    business.role !== 'user'
                        ? `<a title="navigate to dashboard" href="/admin.html?businessId=` +
                          business.id +
                          '">' +
                          business.role +
                          '</a>'
                        : business.role
                })</span>
                ${renameHTML}
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
});
document.getElementById('businesses').innerHTML = businessHTML;
for (const businessId of ownedBusinessIds) {
    document.getElementById(businessId).addEventListener('click', async () => {
        const newName = await Popup.prompt('Enter a new name for your group');
        if (newName) {
            const res = await PUT(`/businesses/${businessId}/name?new=${newName}`);
            if (!res.ok) {
                Popup.alert(res.statusText, 'var(--error)');
            } else {
                await Popup.alert(
                    'Successfully renamed group to ' + newName,
                    'var(--success)',
                    2000,
                );
            }
            location.assign('/groups.html');
        } else {
            Popup.alert('Please enter a valid name.', 'var(--error)', 2000);
        }
    });
}

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);
