import { GET } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
import { Popup } from './components/Popup.js';
import { initBusinessSelector, initEventSelector } from './util/selectors.js';
import { sanitizeText } from './util/util.js';
const QRCode = window.QRCode;
await requireLogin();

const attendanceTable = document.getElementById('table');
attendanceTable.addEventListener('reloadTable', () => {
    runTable();
});

const { get: getBusinessId } = await initBusinessSelector('businessId', async () => {
    updateJoinLink();
    await updateEvents();
    await runTable();
});

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
}
updateJoinLink();

async function runTable() {
    let attendancearr = await (await GET(`/attendancedata?businessId=${getBusinessId()}`)).json();
    attendanceTable.updateTable(attendancearr, events, getBusinessId());
}

async function setRecordSettings() {
    const res = await (await GET(`/getRecordSettings?businessId=${getBusinessId()}`)).json();
    const requireJoin = res.requireJoin;
    console.log(requireJoin);
    if (requireJoin) {
        document.getElementById("require-join").checked = true;
    }
    return requireJoin;
}

document.getElementById("require-join").onchange = async () => {
    const res = await (await GET(`/getRecordSettings?businessId=${getBusinessId()}`)).json();
    const requireJoin = res.requireJoin == 0 ? 1 : 0;
    await GET(`/changeRecordSettings?businessId=${getBusinessId()}&newStatus=${requireJoin}`);
};

function validateEventTime(startDate, endDate, startTime, endTime, isRepeating=false) {
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

Window.onload = runTable();
Window.onload = setRecordSettings();

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);
