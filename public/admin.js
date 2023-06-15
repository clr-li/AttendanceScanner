import { GET } from './util/Client.js';
import { calcSimilarity } from './util/util.js';
import { requireLogin } from './util/Auth.js';
import { Popup } from './components/Popup.js';
await requireLogin();

const eventFilterSelector = document.getElementById("filterEventName");
let filteringEvent = null;
eventFilterSelector.addEventListener("select", (e) => {
    filteringEvent = e.detail;
})

const businessSelector = document.getElementById("businessname");
let selectedBusiness = null;
businessSelector.addEventListener("select", (e) => {
    selectedBusiness = e.detail;
    updateEvents();
    updateTable();
    getEventData();
})

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
    eventFilterSelector.replaceChildren(...[...eventNames].map((name) => {
        const option = document.createElement('option');
        option.value = name;
        return option;
    }));
}

function validateEventTime(startDate, endDate, startTime, endTime) {
    if (startDate > endDate) {
        Popup.alert('Invalid date. Start date can\'t be later than end date.', 'var(--error)');
        return false;
    } else if (startDate == endDate && startTime > endTime) {
        Popup.alert('Invalid time. Start time can\'t be later than end time', 'var(--error)');
        return false;
    }
    return true;
}

function showSuccessDialog() {
    document.getElementById('new-event-success').show();
    setTimeout(() => {
        document.getElementById('new-event-success').close();
    }, 3000);
}

document.getElementById('submitevent').addEventListener('click', () => {
    console.log("adding event");
    const name = document.getElementById('name').value;
    const description = document.getElementById('description').value;
    
    const startdate = document.getElementById('startdate').value;
    const starttime = document.getElementById('starttime').value;
    const enddate = document.getElementById('enddate').value;
    const endtime = document.getElementById('endtime').value;
    const starttimestamp = (new Date(startdate + 'T' + starttime)).getTime() / 1000;
    const endtimestamp = (new Date(enddate + 'T' + endtime)).getTime() / 1000;

    if (!startdate || !starttime || !enddate || !endtime) {
        Popup.alert('Please fill out all start and end times/dates.', 'var(--error)');
        return;
    }

    if (!validateEventTime(startdate, enddate, starttime, endtime)) {
        return;
    }

    if (document.getElementById("repeat").checked) {
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
            showSuccessDialog();
            updateEvents();
        });
    } else {
        GET(`/makeEvent?name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}`).then(async (res) => { 
            console.log(res.status);
            showSuccessDialog();
            let id = (await res.json())["last_insert_rowid()"];
            var startDate = new Date(starttimestamp*1000);
            var endDate = new Date(endtimestamp*1000);
            eventSelector.addOption(name + " (" + id + ")", startDate.toDateString() + " to " + endDate.toDateString(), {"data-id": id});
        });
    }
});
    
document.getElementById('submitfilter').onclick = () => {
    [...document.getElementById('displayattendance').firstChild.querySelectorAll("tr")].forEach ((row) => {
        if (row.firstChild.nodeName == 'TD' && document.getElementById('filtername').value != "") {
            sortStudents(document.getElementById('filtername').value);
        } else {
            row.style.display = "table-row";
        }
    });
    [...document.getElementsByClassName('cell')].forEach((cell) => {
        const showstart = document.getElementById("filterstart").value != "";
        const showend = document.getElementById("filterend").value != "";
        const eventName = filteringEvent ? filteringEvent.value : "";
        let showCell = true;
        if (showstart) {
            showCell = showCell && (new Date(document.getElementById("filterstart").value + 'T00:00')).getTime() / 1000 < cell.dataset.time;
        }
        if (showend) {
            showCell = showCell && (new Date(document.getElementById("filterend").value + 'T23:59')).getTime() / 1000 > cell.dataset.time;
        }
        if (eventName) {
            showCell = showCell && (cell.dataset.name === eventName);
        }
        if (showCell) {
            cell.style.display = "table-cell";
        } else {
            cell.style.display = "none";
        }
    });
}

function sortStudents(searchword) {
    searchword = searchword.toLowerCase();
    var table, rows, switching, i, x, y, shouldSwitch;
    table = document.getElementById("displayattendance");
    switching = true;
    /* Make a loop that will continue until
    no switching has been done: */
    while (switching) {
        // Start by saying: no switching is done:
        switching = false;
        rows = table.rows;
        /* Loop through all table rows (except the
        first, which contains table headers): */
        for (i = 1; i < (rows.length - 1); i++) {
        // Start by saying there should be no switching:
        shouldSwitch = false;
        /* Get the two elements you want to compare,
        one from current row and one from the next: */
        x = rows[i].getElementsByTagName("TD")[0];
        y = rows[i + 1].getElementsByTagName("TD")[0];
        // Check if the two rows should switch place:
        if (calcSimilarity(x.innerHTML.toLowerCase(), searchword) < calcSimilarity(y.innerHTML.toLowerCase(), searchword)) {
            // If so, mark as a switch and break the loop:
            shouldSwitch = true;
            break;
        }
        }
        if (shouldSwitch) {
        /* If a switch has been marked, make the switch
        and mark that a switch has been done: */
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
        }
    }
}

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
businessSelector.setAttribute("value", businessSelector.firstElementChild.value);
selectedBusiness = businessSelector.firstElementChild;
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
            <label class="radio">This event <input type="radio" checked="true" name="repeat-effect" value="1"></label>
            <label class="radio">This and future events <input type="radio" name="repeat-effect" value="2" ${eventinfo.repeat_id != null ? '' : 'disabled'}></label>
            <label class="radio">All events <input type="radio" name="repeat-effect" value="3" ${eventinfo.repeat_id != null ? '' : 'disabled'}></label>
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

            if (!validateEventTime(startdate, enddate, starttime, endtime)) {
                return;
            }

            GET(`/updateevent?eventid=${eventid}&name=${name}&description=${description}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&businessId=${getBusinessId()}&repeatId=${eventinfo.repeat_id}&repeatEffect=${repeatEffect}&starttimedelta=${starttimedelta}&endtimedelta=${endtimedelta}`).then((res) => {
                console.log(res.status);
                updateEvents();
            });
        }
    }));
}

Window.onload = updateTable();

async function updateTable() {
    let attendancearr = await (await GET(`/attendancedata?businessId=${getBusinessId()}`)).json();
    let map = new Map();
    for (let i = 0; i < attendancearr.length; i++) {
        if (attendancearr[i].user_id)
            attendancearr[i].id = attendancearr[i].user_id;
        if(!map.has(attendancearr[i].id)) {
            map.set(attendancearr[i].id, []);
        }
        map.get(attendancearr[i].id).push(attendancearr[i]);
    }
    let html = "<tr><th>Name (id)</th>"; 
    for (let i = 0; i < events.length; i++) {
        var startDate = new Date(events[i].starttimestamp*1000);
        var endDate = new Date(events[i].endtimestamp*1000);
        html += `<th class="cell" data-time="${events[i].starttimestamp}" data-name="${events[i].name}">${events[i].name}: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}</th>`;
    }
    html += "</tr>";
    for (let i = 0; i < [...map.keys()].length; i++) {
        let userid = [...map.keys()][i];
        let records = map.get(userid);
        html += `<tr><td>${records[0].name} (${userid.substr(0,4)})<br><select><option>owner</option><option>admin</option><option>moderator</option><option>scanner</option><option>user</option></select></td>`;
        for (let j = 0; j < events.length; j++) {   
            let statusupdate = false;
            for (let k = 0; k < records.length; k++) {
                if (records[k].event_id == events[j].id) {
                    html += `<td class="cell" data-time="${events[j].starttimestamp}" data-name="${events[j].name}">${records[k].status}</td>`;
                    statusupdate = true;
                    break;
                }
            }
            if (!statusupdate) {
                const status = Date.now() > parseInt(events[j].endtimestamp) * 1000 ? "ABSENT" : "N/A";
                html += `<td class="cell" data-time="${events[j].starttimestamp}" data-name="${events[j].name}">${status}</td>`;
            }
        }
        html += "</tr>";
    }
    document.getElementById("displayattendance").innerHTML = html;
}

document.getElementById("export").onclick = () => {
    // Variable to store the final csv data
    var csv_data = [];
 
    // Get each row data
    var rows = document.getElementsByTagName('tr');
    for (var i = 0; i < rows.length; i++) {
 
        // Get each column data
        var cols = rows[i].querySelectorAll('td,th');
 
        // Stores each csv row data
        var csvrow = [];
        for (var j = 0; j < cols.length; j++) {
 
            // Get the text data of each cell of
            // a row and push it to csvrow
            csvrow.push(cols[j].innerHTML);
        }
 
        // Combine each column value with comma
        csv_data.push(csvrow.join(","));
    }
    // combine each row data with new line character
    csv_data = csv_data.join('\n');

    downloadCSVFile(csv_data);
}

function downloadCSVFile(csv_data) {
    // Create CSV file object and feed our
    // csv_data into it
    let CSVFile = new Blob([csv_data], { type: "text/csv" });
 
    // Create to temporary link to initiate
    // download process
    var temp_link = document.createElement('a');
 
    // Download csv file
    temp_link.download = "cal.csv";
    var url = window.URL.createObjectURL(CSVFile);
    temp_link.href = url;
 
    // This link should not be displayed
    temp_link.style.display = "none";
    document.body.appendChild(temp_link);
 
    // Automatically click the link to trigger download
    temp_link.click();
    document.body.removeChild(temp_link);
}

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);