import { GET } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
import { Popup } from './components/Popup.js';
import { initBusinessSelector, initEventSelector } from './util/selectors.js';
await requireLogin();

const attendanceTable = document.getElementById("table");
attendanceTable.addEventListener("reloadTable", () => {
    runTable();
});

const { get: getBusinessId } = await initBusinessSelector("businessId", async () => {
    updateJoinLink();
    await updateEvents();
    await runTable();
});

let events;
const { get: getEventId, selector: eventSelector, updateEvents } = await initEventSelector("eventId", getBusinessId, async () => {
    getEventData();
}, async (newEvents, newOptions, newEventNames) => {
    events = newEvents;
    attendanceTable.replaceEvents(newOptions, newEventNames);
});
if (getEventId()) getEventData();


async function updateJoinLink() {
    const res = await GET('/joincode?businessId=' + getBusinessId());
    const data = await res.json();
    const joincode = data.joincode;
    const joinlink = window.location.origin + "/groups.html?id=" + getBusinessId() + "&code=" + joincode;
    document.getElementById("qrcode").innerHTML = "";
    new QRCode(document.getElementById("qrcode"), joinlink);

    document.getElementById("joinlink").onfocus = () => { // onfocus instead of onclick fixes the clipboard DOM exception security issue
        window.navigator.clipboard.writeText(joinlink);
        document.getElementById("joinlink").classList.add("success");
        document.activeElement.blur();
        setTimeout(() => {
            document.getElementById("joinlink").classList.remove("success");
        }, 5000);
    };
}
updateJoinLink();

async function runTable() {
    let attendancearr = await (await GET(`/attendancedata?businessId=${getBusinessId()}`)).json();
    attendanceTable.updateTable(attendancearr, events, getBusinessId());
}

function validateEventTime(startDate, endDate, startTime, endTime, isRepeating=false) {
    if (startDate > endDate) {
        Popup.alert('Invalid date. Start date can\'t be later than end date.', 'var(--error)');
        return false;
    } else if ((isRepeating || startDate == endDate) && startTime > endTime) {
        Popup.alert('Invalid time. Start time can\'t be later than end time', 'var(--error)');
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
    const starttimestamp = (new Date(startdate + 'T' + starttime)).getTime() / 1000;
    const endtimestamp = (new Date(enddate + 'T' + endtime)).getTime() / 1000;
    const isRepeating = document.getElementById("repeat").checked;

    if (!startdate || !starttime || !enddate || !endtime) {
        Popup.alert('Please fill out all start and end times/dates.', 'var(--error)');
        return;
    }

    if (!validateEventTime(startdate, enddate, starttime, endtime, isRepeating)) {
        return;
    }

    if (isRepeating) {
        const frequency = document.getElementById("frequency").value.toLowerCase();
        const interval = document.getElementById("interval").value;
        const timezoneOffsetMS = new Date().getTimezoneOffset() * 60 * 1000;
        let daysoftheweek = [];
        let counter = 0;
        if (interval < 1) {
            Popup.alert('Please enter a positive number.', 'var(--error)');
            return;
        }
        for (const dayElement of [...document.getElementById("daysoftheweek").getElementsByTagName('input')]) {
            if (dayElement.checked) {
                daysoftheweek.push(counter);
            }
            counter++;
        }
        GET(`/makeRecurringEvent?name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}&frequency=${frequency}&interval=${interval}&daysoftheweek=${daysoftheweek.join(',')}&timezoneOffsetMS=${timezoneOffsetMS}`).then(() => {
            showSuccessDialog('new-event-success');
            updateEvents();
        });
    } else {
        GET(`/makeEvent?name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}`).then(() => { 
            showSuccessDialog('new-event-success');
            updateEvents();
        });
    }
});

function getEventData() {
    GET(`/eventdata?eventid=${getEventId()}&businessId=${getBusinessId()}`).then((res) => res.json().then((eventinfo) => {
        var startDate = new Date(eventinfo.starttimestamp*1000);
        var endDate = new Date(eventinfo.endtimestamp*1000);
        document.getElementById("eventdetails").innerHTML = /* html */`
            <label for="update-name">Name:</label>
            <input type="text" value="${eventinfo.name}" id="update-name"><br>
            <label for="update-startdate">Start Date:</label>
            <input type="date" value="${startDate.toLocaleDateString('en-CA')}" id="update-startdate">
            <label for="update-starttime">Start Time:</label>
            <input type="time" value="${(startDate.getHours()+100+"").substr(-2)}:${("" + startDate.getMinutes()).padStart(2, '0')}" id="update-starttime"><br>
            <label for="update-enddate">End Date:</label>
            <input type="date" value="${endDate.toLocaleDateString('en-CA')}" id="update-enddate">
            <label for="update-endtime">End Time:</label>
            <input type="time" value="${(endDate.getHours()+100+"").substr(-2)}:${("" + endDate.getMinutes()).padStart(2, '0')}" id="update-endtime"><br>
            <label for="update-description">Description: </label>
            <input type="text" value="${eventinfo.description}" id="update-description"><br>
            <div class="radios">
                <div>
                    <input id="curr" name="repeat-effect" type="radio" class="open" value="1" checked>
                    <label for="curr" class="overlay">
                        <div class="circle"></div> 
                        <span class=text>This event</span>  
                    </label>
                </div>
                <div>
                    <input id="future" name="repeat-effect" type="radio" class="open" value="2"  ${eventinfo.repeat_id != null ? '' : 'disabled'}>
                    <label for="future" class="overlay">
                        <div class="circle"></div> 
                        <span class=text>This and future events</span>  
                    </label>
                </div>
                <div>
                    <input id="all" name="repeat-effect" type="radio" class="open" value="3"  ${eventinfo.repeat_id != null ? '' : 'disabled'}>
                    <label for="all" class="overlay">
                        <div class="circle"></div> 
                        <span class=text>All events</span>  
                    </label>
                </div>
            </div>
            <br><button id="update" class="button" type="button">Update Event</button>
            <button id="delete" class="button delete" type="button">Delete Event</button>
            <button id="scan" class="button" type="button">
            Scanner
            </button>
        `;
        document.getElementById('scan').onclick = () => {
            window.open(`scanner.html?eventId=${getEventId()}&businessId=${getBusinessId()}`)
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
            const starttimestamp = (new Date(startdate + 'T' + starttime)).getTime() / 1000;

            GET(`/deleteevent?eventid=${getEventId()}&businessId=${getBusinessId()}&repeatEffect=${repeatEffect}&starttimestamp=${starttimestamp}&repeatId=${eventinfo.repeat_id}`).then((res) => {
                console.log(res.status);
                updateEvents();
            });
        };
        document.getElementById('update').onclick = () => {
            const name = document.getElementById('update-name').value;
            const description = document.getElementById('update-description').value;

            let repeatEffect = "1";
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
            const starttimestamp = (new Date(startdate + 'T' + starttime)).getTime() / 1000;
            const endtimestamp = (new Date(enddate + 'T' + endtime)).getTime() / 1000;
            const starttimedelta = starttimestamp - eventinfo.starttimestamp;
            const endtimedelta = endtimestamp - eventinfo.endtimestamp;

            if (!validateEventTime(startdate, enddate, starttime, endtime, "1" != repeatEffect)) {
                return;
            }

            GET(`/updateevent?eventid=${getEventId()}&name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}&repeatId=${eventinfo.repeat_id}&repeatEffect=${repeatEffect}&starttimedelta=${starttimedelta}&endtimedelta=${endtimedelta}`).then((res) => {
                console.log(res.status);
                updateEvents();
            });
        }
    }));
}

Window.onload = runTable();

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);