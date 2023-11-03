import { GET } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
import { Popup } from './components/Popup.js';
await requireLogin();

const attendanceTable = document.getElementById("table");

const businessSelector = document.getElementById("businessname");
let selectedBusiness = null;
businessSelector.addEventListener("select", (e) => {
    selectedBusiness = e.detail;
    updateEvents();
    runTable();
    getEventData();
    let inputUrl = new URL(window.location);
    inputUrl.searchParams.set('businessId', getBusinessId());
    location.search = inputUrl.search;
})

async function runTable() {
    let attendancearr = await (await GET(`/attendancedata?businessId=${getBusinessId()}`)).json();
    attendanceTable.updateTable(attendancearr, events, selectedBusiness.dataset.id);
}

function getBusinessId() {
    return selectedBusiness.dataset.id;
}

const eventSelector = document.getElementById("events");
let selectedEvent = null;
eventSelector.addEventListener("select", (e) => {
    selectedEvent = e.detail;
    getEventData();
})
let events;
async function updateEvents() {
    let res = await GET('/events?businessId=' + getBusinessId());
    events = await res.json();
    const eventNames = new Set();
    const options = events.map(event => {
        var startDate = new Date(event.starttimestamp*1000);
        var endDate = new Date(event.endtimestamp*1000);
        eventNames.add(event.name);
        const option = document.createElement('option');
        option.value = event.name + " (" + event.id + ")";
        option.textContent = startDate.toDateString() + " to " + endDate.toDateString();
        option.setAttribute("data-id", event.id);
        return option;
    });
    eventSelector.replaceChildren(...options);
    attendanceTable.addEvents(eventNames);
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
        GET(`/makeRecurringEvent?name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}&frequency=${frequency}&interval=${interval}&daysoftheweek=${daysoftheweek.join(',')}`).then(() => {
            showSuccessDialog('new-event-success');
            updateEvents();
        });
    } else {
        GET(`/makeEvent?name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}`).then(async (res) => { 
            console.log(res.status);
            showSuccessDialog('new-event-success');
            let id = (await res.json())["last_insert_rowid()"];
            var startDate = new Date(starttimestamp*1000);
            var endDate = new Date(endtimestamp*1000);
            eventSelector.addOption(name + " (" + id + ")", startDate.toDateString() + " to " + endDate.toDateString(), {"data-id": id});
        });
        location.assign("/admin.html#eventform");
    }
});

let res2 = await GET('/businesses');
let o = await res2.json();
let noBusinesses = true;
o.forEach(business => {
    if (business.role != 'user') {
        noBusinesses = false;
        businessSelector.addOption(business.name, business.role, {"data-id": business.id});
    }
});
if (noBusinesses) {
    document.body.style.opacity = '1';
    const shouldRedirect = await Popup.confirm("You own no groups. You'll be redirected to the start-a-group page");
    if (shouldRedirect) location.assign('/payment.html');
    else history.back();
}

const urlstr = window.location.href;
const url = new URL(urlstr);
const params = url.searchParams;
const businessId = params.get('businessId');

let child = businessSelector.firstElementChild;
for (let i = 0; i < businessSelector.childNodes.length; i++) {
    if (businessSelector.childNodes[i].dataset.id == businessId) {
        child = businessSelector.childNodes[i];
        break;
    }
}

businessSelector.setAttribute("value", child.value);
selectedBusiness = child;
await updateEvents();

if (eventSelector.firstElementChild) {
    let item = eventSelector.firstElementChild;
    const url = new URL(window.location);
    const params = url.searchParams;
    const eventid = params.get('eventId');
    if (eventid) {
        item = eventSelector.shadowRoot.querySelector('option[data-id="' + eventid + '"]');
    }
    eventSelector.setAttribute("value",item.value);
    selectedEvent = item;
    getEventData();
}

let res = await GET('/joincode?businessId=' + getBusinessId());
let data = await res.json();
let joincode = data.joincode;
let joinlink = window.location.origin + "/user.html?id=" + getBusinessId() + "&code=" + joincode;
new QRCode(document.getElementById("qrcode"), joinlink);

document.getElementById("joinlink").onfocus = () => { // onfocus instead of onclick fixes the clipboard DOM exception security issue
    window.navigator.clipboard.writeText(joinlink);
    document.getElementById("joinlink").classList.add("success");
    document.activeElement.blur();
    setTimeout(() => {
        document.getElementById("joinlink").classList.remove("success");
    }, 5000);
};

function getEventData() {
    let eventid = selectedEvent.dataset.id;
    GET(`/eventdata?eventid=${eventid}&businessId=${getBusinessId()}`).then((res) => res.json().then((eventinfo) => {
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
            window.open(`scanner.html?eventid=${eventid}&businessId=${getBusinessId()}`)
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

            GET(`/deleteevent?eventid=${eventid}&businessId=${getBusinessId()}&repeatEffect=${repeatEffect}&starttimestamp=${starttimestamp}&repeatId=${eventinfo.repeat_id}`).then((res) => {
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

            GET(`/updateevent?eventid=${eventid}&name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}&repeatId=${eventinfo.repeat_id}&repeatEffect=${repeatEffect}&starttimedelta=${starttimedelta}&endtimedelta=${endtimedelta}`).then((res) => {
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