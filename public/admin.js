import { GET, sendEmail } from './util/Client.js';
import { requireLogin, requestGoogleCredential, getCurrentUser } from './util/Auth.js';
import { Popup } from './components/Popup.js';
import { initBusinessSelector, initEventSelector } from './util/selectors.js';
import { sanitizeText } from './util/util.js';
const QRCode = window.QRCode;
await requireLogin();
const user = await getCurrentUser();

const attendanceTable = document.getElementById('table');
attendanceTable.addEventListener('reloadTable', () => {
    runTable();
});

const { get: getBusinessId } = await initBusinessSelector('businessId', async () => {
    updateJoinLink();
    await updateEvents();
    await runTable();
    document.getElementById('genericScannerLink').href =
        `/scanner.html?businessId=${getBusinessId()}`;
});
if (getBusinessId()) {
    document.getElementById('genericScannerLink').href =
        `/scanner.html?businessId=${getBusinessId()}`;
}

let events;
const { get: getEventId, updateEvents } = await initEventSelector(
    'eventId',
    getBusinessId,
    async () => {
        getEventData();
    },
    async (newEvents, newOptions, newEventNames) => {
        events = newEvents;
        attendanceTable.replaceEvents(newOptions, newEventNames);
    },
);
if (getEventId()) getEventData();

async function updateJoinLink() {
    const res = await GET('/joincode?businessId=' + getBusinessId());
    const data = await res.json();
    const joincode = data.joincode;
    const joinlink =
        window.location.origin + '/groups.html?id=' + getBusinessId() + '&code=' + joincode;
    document.getElementById('qrcode').innerHTML = '';
    new QRCode(document.getElementById('qrcode'), joinlink);

    document.getElementById('joinlink').onfocus = () => {
        // onfocus instead of onclick fixes the clipboard DOM exception security issue
        window.navigator.clipboard.writeText(joinlink);
        document.getElementById('joinlink').classList.add('success');
        document.activeElement.blur();
        setTimeout(() => {
            document.getElementById('joinlink').classList.remove('success');
        }, 5000);
    };

    document.getElementById('resetJoincode').onclick = async () => {
        const allow = await Popup.confirm(
            "Are you sure you want to reset the group's join code? This will make the old join code and any pending email invites invalid.",
        );
        if (!allow) return;
        const res = await GET('/resetJoincode?businessId=' + getBusinessId());
        if (res.ok) {
            updateJoinLink();
        } else {
            Popup.alert(sanitizeText(await res.text()), 'var(--error)');
        }
    };

    document.getElementById('emailInvite').onclick = async () => {
        const emails = await Popup.prompt(
            'Enter comma separated email addresses of the people you want to invite:',
            'var(--primary)',
        );
        if (!emails) {
            Popup.alert('No emails entered.', 'var(--error)');
            return;
        }
        const credential = await requestGoogleCredential([
            'https://www.googleapis.com/auth/gmail.send',
        ]);
        let success = true;
        for (const email of emails.split(',')) {
            const res = await sendEmail(
                email.trim(),
                'Attendance Scanner Invitation',
                `
Hi!

You have been invited to join my group on Attendance Scanner QR.

Please click this link to join: ${joinlink}.

Best,
${sanitizeText(credential.name)}
(automatically sent via Attendance Scanner QR)
                `.trim(),
                credential,
            );
            if (!res.ok) {
                success = false;
                const obj = await res.json();
                const message = obj.error.message;
                Popup.alert(
                    `Email to ${sanitizeText(email)} failed to send. ` + message,
                    'var(--error)',
                );
            }
        }
        if (success) {
            Popup.alert('Emails sent successfully!', 'var(--success)');
        }
    };
}
updateJoinLink();

const members = new Set();
async function runTable() {
    let attendancearr = await (await GET(`/attendancedata?businessId=${getBusinessId()}`)).json();
    for (const user of attendancearr) {
        members.add({ name: user.name, email: user.email });
    }
    attendanceTable.updateTable(attendancearr, events, getBusinessId());
}

const email_notification = document.getElementById('email-notification');
email_notification.textContent = `
Hi [MEMBER_NAME],

We'll be having an extra rehearsal on Monday at XXXX. We hope to see you there!

Best,
${user.name}
(automatically sent via Attendance Scanner QR)
`.trim();
document.getElementById('sent-email').onclick = async () => {
    const credential = await requestGoogleCredential([
        'https://www.googleapis.com/auth/gmail.send',
    ]);
    let success = true;
    for (const member of members) {
        const res = await sendEmail(
            member.email,
            'Attendance Scanner Notification',
            email_notification.textContent.replace('[MEMBER_NAME]', member.name),
            credential,
        );
        if (!res.ok) {
            success = false;
            const obj = await res.json();
            const message = obj.error.message;
            Popup.alert(
                `Email to ${sanitizeText(member[1])} failed to send. ` + message,
                'var(--error)',
            );
        }
    }
    if (success) {
        Popup.alert('Emails sent successfully!', 'var(--success)');
    }
};

async function setRecordSettings() {
    const res = await (await GET(`/getRecordSettings?businessId=${getBusinessId()}`)).json();
    const requireJoin = res.requireJoin;
    if (requireJoin) {
        document.getElementById('require-join').checked = true;
    }
    return requireJoin;
}

document.getElementById('require-join').addEventListener('change', async e => {
    const requireJoin = e.target.checked ? 1 : 0;
    await GET(`/changeRecordSettings?businessId=${getBusinessId()}&newStatus=${requireJoin}`);
});

function validateEventTime(startDate, endDate, startTime, endTime, isRepeating = false) {
    if (startDate > endDate) {
        Popup.alert("Invalid date. Start date can't be later than end date.", 'var(--error)');
        return false;
    } else if ((isRepeating || startDate === endDate) && startTime > endTime) {
        Popup.alert("Invalid time. Start time can't be later than end time", 'var(--error)');
        return false;
    }
    return true;
}

function showSuccessDialog(id) {
    document.getElementById(id).show();
    setTimeout(() => {
        document.getElementById(id).close();
    }, 3000);
}

document.getElementById('startdate').value ||= new Date().toISOString().split('T')[0];
document.getElementById('enddate').value ||= new Date().toISOString().split('T')[0];
const defaultStartTime = new Date();
defaultStartTime.setMinutes(Math.round(defaultStartTime.getMinutes() / 30) * 30);
document.getElementById('starttime').value ||= defaultStartTime
    .toTimeString()
    .split(' ')[0]
    .slice(0, 5);
defaultStartTime.setHours(defaultStartTime.getHours() + 1);
document.getElementById('endtime').value ||= defaultStartTime
    .toTimeString()
    .split(' ')[0]
    .slice(0, 5);

document.getElementById('submitevent').addEventListener('click', () => {
    const name = document.getElementById('name').value;
    const description = document.getElementById('description').value;

    const startdate = document.getElementById('startdate').value;
    const starttime = document.getElementById('starttime').value;
    const enddate = document.getElementById('enddate').value;
    const endtime = document.getElementById('endtime').value;
    const starttimestamp = new Date(startdate + 'T' + starttime).getTime() / 1000;
    const endtimestamp = new Date(enddate + 'T' + endtime).getTime() / 1000;
    const isRepeating = document.getElementById('repeat').checked;

    if (!startdate || !starttime || !enddate || !endtime) {
        Popup.alert('Please fill out all start and end times/dates.', 'var(--error)');
        return;
    }

    if (!validateEventTime(startdate, enddate, starttime, endtime, isRepeating)) {
        return;
    }

    if (isRepeating) {
        const frequency = document.getElementById('frequency').value.toLowerCase();
        const interval = document.getElementById('interval').value;
        const timezoneOffsetMS = new Date().getTimezoneOffset() * 60 * 1000;
        let daysoftheweek = [];
        let counter = 0;
        if (interval < 1) {
            Popup.alert('Please enter a positive number.', 'var(--error)');
            return;
        }
        for (const dayElement of [
            ...document.getElementById('daysoftheweek').getElementsByTagName('input'),
        ]) {
            if (dayElement.checked) {
                daysoftheweek.push(counter);
            }
            counter++;
        }
        GET(
            `/makeRecurringEvent?name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}&frequency=${frequency}&interval=${interval}&daysoftheweek=${daysoftheweek.join(
                ',',
            )}&timezoneOffsetMS=${timezoneOffsetMS}`,
        ).then(async res => {
            if (res.ok) {
                showSuccessDialog('new-event-success');
                updateEvents();
                runTable();
            } else {
                Popup.alert(sanitizeText(await res.text()), 'var(--error)');
            }
        });
    } else {
        GET(
            `/makeEvent?name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}`,
        ).then(async res => {
            if (res.ok) {
                showSuccessDialog('new-event-success');
                updateEvents();
                runTable();
            } else {
                Popup.alert(sanitizeText(await res.text()), 'var(--error)');
            }
        });
    }
});

function getEventData() {
    GET(`/eventdata?eventid=${getEventId()}&businessId=${getBusinessId()}`).then(res =>
        res.json().then(eventinfo => {
            var startDate = new Date(eventinfo.starttimestamp * 1000);
            var endDate = new Date(eventinfo.endtimestamp * 1000);
            document.getElementById('eventdetails').innerHTML = /* html */ `
            <label for="update-name">Name:</label><br>
            <input style="min-width: min(850px, calc(95vw));" type="text" value="${sanitizeText(
                eventinfo.name,
            )}" id="update-name"><br>
            <label for="update-description">Description:</label><br>
            <textarea style="resize: vertical;" id="update-description" rows="2" name="update-description">${
                eventinfo.description
            }</textarea><br>
            <div class="cols">
                <label for="update-startdate">Start:</label>
                <input type="date" value="${sanitizeText(
                    startDate.toLocaleDateString('en-CA'),
                )}" id="update-startdate">
            </div>
            <div class="cols">
                <input type="time" value="${sanitizeText(
                    (startDate.getHours() + 100 + '').substr(-2),
                )}:${sanitizeText(
                    ('' + startDate.getMinutes()).padStart(2, '0'),
                )}" id="update-starttime">
            </div>
            <div class="cols">
                <label for="update-enddate">End:</label>
                <input type="date" value="${sanitizeText(
                    endDate.toLocaleDateString('en-CA'),
                )}" id="update-enddate">
            </div>
            <div class="cols">
                <input type="time" value="${sanitizeText(
                    (endDate.getHours() + 100 + '').substr(-2),
                )}:${sanitizeText(
                    ('' + endDate.getMinutes()).padStart(2, '0'),
                )}" id="update-endtime">
            </div><br>
            <div class="cols">
                <input id="curr" name="repeat-effect" type="radio" value="1" checked>
                <label for="curr" class="overlay">
                    <div class="circle"></div> 
                    <span class=text>This event</span>  
                </label>
            </div>
            <div class="cols">
                <input id="future" name="repeat-effect" type="radio" value="2" ${
                    eventinfo.repeat_id != null ? '' : 'disabled'
                }>
                <label for="future" class="overlay">
                    <div class="circle"></div> 
                    <span class=text>This and future events</span>  
                </label>
            </div>
            <div class="cols">
                <input id="all" name="repeat-effect" type="radio" value="3" ${
                    eventinfo.repeat_id != null ? '' : 'disabled'
                }>
                <label for="all" class="overlay">
                    <div class="circle"></div> 
                    <span class=text>All events</span>  
                </label>
            </div>
            <br><button id="update" class="button" type="button">Update Event</button>
            <button id="delete" class="button delete" type="button">Delete Event</button>
            <button id="scan" class="button" type="button">
            Scanner
            </button>
        `;
            document.getElementById('scan').onclick = () => {
                window.open(`scanner.html?eventId=${getEventId()}&businessId=${getBusinessId()}`);
            };
            document.getElementById('delete').onclick = () => {
                let repeatEffect;
                for (const radio of document.querySelectorAll('input[name="repeat-effect"]')) {
                    if (radio.checked) {
                        repeatEffect = radio.value;
                        break;
                    }
                }

                const startdate = document.getElementById('update-startdate').value;
                const starttime = document.getElementById('update-starttime').value;
                const starttimestamp = new Date(startdate + 'T' + starttime).getTime() / 1000;

                GET(
                    `/deleteevent?eventid=${getEventId()}&businessId=${getBusinessId()}&repeatEffect=${repeatEffect}&starttimestamp=${starttimestamp}&repeatId=${
                        eventinfo.repeat_id
                    }`,
                ).then(async res => {
                    if (res.ok) {
                        updateEvents();
                    } else {
                        Popup.alert(sanitizeText(await res.text()), 'var(--error)');
                    }
                });
            };
            document.getElementById('update').onclick = () => {
                const name = document.getElementById('update-name').value;
                const description = document.getElementById('update-description').value;

                let repeatEffect = '1';
                for (const radio of document.querySelectorAll('input[name="repeat-effect"]')) {
                    if (radio.checked) {
                        repeatEffect = radio.value;
                        break;
                    }
                }

                const startdate = document.getElementById('update-startdate').value;
                const starttime = document.getElementById('update-starttime').value;
                const enddate = document.getElementById('update-enddate').value;
                const endtime = document.getElementById('update-endtime').value;
                const starttimestamp = new Date(startdate + 'T' + starttime).getTime() / 1000;
                const endtimestamp = new Date(enddate + 'T' + endtime).getTime() / 1000;
                const starttimedelta = starttimestamp - eventinfo.starttimestamp;
                const endtimedelta = endtimestamp - eventinfo.endtimestamp;

                if (
                    !validateEventTime(startdate, enddate, starttime, endtime, '1' !== repeatEffect)
                ) {
                    return;
                }

                GET(
                    `/updateevent?eventid=${getEventId()}&name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}&repeatId=${
                        eventinfo.repeat_id
                    }&repeatEffect=${repeatEffect}&starttimedelta=${starttimedelta}&endtimedelta=${endtimedelta}`,
                ).then(async res => {
                    if (res.ok) {
                        updateEvents();
                    } else {
                        Popup.alert(sanitizeText(await res.text()), 'var(--error)');
                    }
                });
            };
        }),
    );
}

runTable();
setRecordSettings();

document.getElementById('changeName').onclick = async () => {
    const newName = await Popup.prompt('Enter a new name for your group');
    if (newName) {
        const res = await GET(`/renameBusiness?businessId=${getBusinessId()}&name=${newName}`);
        if (!res.ok) {
            Popup.alert(res.statusText, 'var(--error)');
        } else {
            await Popup.alert('Successfully renamed group to ' + newName, 'var(--success)', 2000);
        }
        location.assign('/admin.html');
    }
};

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);
