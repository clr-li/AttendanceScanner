import { requireLogin } from './util/Auth.js';
import { GET } from './util/Client.js';
import { initBusinessSelector } from './util/selectors.js';
import { calcSimilarity, sanitizeText } from '../util/util.js';
import { Popup } from './components/Popup.js';
const Chart = window.Chart;
await requireLogin();

const { get: getBusinessId } = await initBusinessSelector('business-selector', async () => {
    const res = await GET(
        `/businesses/${getBusinessId()}/attendance/statuscounts?tag=&role=&start=&end=${Math.round(
            Date.now() / 1000,
        )}`,
    );
    const memberAttArr = await res.json();
    const numRes = await GET(
        `/businesses/${getBusinessId()}/events/count?tag=&start=&end=${Math.round(
            Date.now() / 1000,
        )}`,
    );
    const numPastEvents = (await numRes.json())['total_count'];
    runMemberStatsTable(memberAttArr, numPastEvents);
});

async function runMemberStatsTable(memberAttArr, numPastEvents) {
    const uidToUserinfo = new Map();
    const statuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    const absentAliases = ['ABSENT(self-marked)', 'ABSENT'];

    for (let i = 0; i < memberAttArr.length; i++) {
        if (!uidToUserinfo.has(memberAttArr[i].user_id)) {
            uidToUserinfo.set(memberAttArr[i].user_id, {
                PRESENT: 0,
                ABSENT: numPastEvents,
                LATE: 0,
                EXCUSED: 0,
                name: memberAttArr[i].name,
                role: memberAttArr[i].role,
            });
        }
        const userinfo = uidToUserinfo.get(memberAttArr[i].user_id);
        if (!absentAliases.includes(memberAttArr[i].status)) {
            userinfo[memberAttArr[i].status] = memberAttArr[i].total_count;
            if (memberAttArr[i].total_count) {
                userinfo['ABSENT'] -= memberAttArr[i].total_count;
            }
        }
    }

    let html =
        '</th><th data-csv="Name">Name (id)</th><th data-csv="Present Count">Present Count</th><th data-csv="Absent Count">Absent Count</th><th data-csv="Late Count">Late Count</th><th data-csv="Excused Count">Excused Count</th><th data-csv="Total Count">Total Count</th></tr>';
    for (const uid of uidToUserinfo.keys()) {
        const userinfo = uidToUserinfo.get(uid);
        html += `<tr id="row-${sanitizeText(uid)}"><td data-name="${userinfo.name}" data-csv="${
            userinfo.name
        }">${sanitizeText(userinfo.name)} (${sanitizeText(uid.substr(0, 4))}`;
        if (userinfo.role === 'user') {
            html += `)`;
        } else {
            html += ` - ${userinfo.role})`;
        }
        html += `</td>`;

        for (const status of statuses) {
            html += `<td class="cell">${userinfo[status]}</td>`;
        }
        html += `<td class="cell">${numPastEvents}</td></tr>`;
    }
    const attendance = document.getElementById('user-stats-table');
    attendance.innerHTML = html;
    runMemberStatsChart(uidToUserinfo);
}

function runMemberStatsChart(uidToUserInfo) {
    let xValues = [];
    // get all present values for each user
    let yPresent = [];
    let yAbsent = [];
    let yLate = [];
    let yExcused = [];
    for (const user of uidToUserInfo.keys()) {
        const userinfo = uidToUserInfo.get(user);
        yPresent.push(userinfo.PRESENT);
        yAbsent.push(userinfo.ABSENT);
        yLate.push(userinfo.LATE);
        yExcused.push(userinfo.EXCUSED);
        xValues.push(userinfo.name);
    }

    new Chart(document.getElementById('member-chart'), {
        type: 'bar',
        data: {
            labels: xValues,
            datasets: [
                {
                    label: 'PRESENT',
                    data: yPresent,
                    borderWidth: 1,
                },
                {
                    label: 'ABSENT',
                    data: yAbsent,
                    borderWidth: 1,
                },
                {
                    label: 'LATE',
                    data: yLate,
                    borderWidth: 1,
                },
                {
                    label: 'EXCUSED',
                    data: yExcused,
                    borderWidth: 1,
                },
            ],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Member Attendance',
                },
            },
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                },
            },
        },
    });
}

function sortStudents(searchword) {
    searchword = searchword.toLowerCase();
    var table, rows, switching, i, x, y, shouldSwitch;
    table = document.getElementById('user-stats-table');
    switching = true;
    /* Make a loop that will continue until
    no switching has been done: */
    while (switching) {
        // Start by saying: no switching is done:
        switching = false;
        rows = table.rows;
        /* Loop through all table rows (except the
        first, which contains table headers): */
        for (i = 1; i < rows.length - 1; i++) {
            // Start by saying there should be no switching:
            shouldSwitch = false;
            /* Get the two elements you want to compare,
            one from current row and one from the next: */
            x = rows[i].getElementsByTagName('TD')[0];
            y = rows[i + 1].getElementsByTagName('TD')[0];
            /** @type {string} */
            let xName = x.dataset.name.toLowerCase();
            let yName = y.dataset.name.toLowerCase();
            // Check if the two rows should switch place:
            if (!xName.includes(searchword) && yName.includes(searchword)) {
                shouldSwitch = true;
                break;
            } else if (xName.includes(searchword) && !yName.includes(searchword)) {
                // Do nothing
            } else if (calcSimilarity(xName, searchword) < calcSimilarity(yName, searchword)) {
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

document.getElementById('show-filter').onclick = async () => {
    const filter = new Popup();
    filter.innerHTML = /* html */ `
    <form id="filterform" class="form" onsubmit="return false;">
        <h1>Filter</h1>
        <div class="rows">
        <div class="cols">
            <label for="filter-name">Name: </label>
            <input type="text" id="filter-name" name="filter-name" placeholder="person name"><br>
            <type-select label="Role:" name="role" id="filter-role" placeholder="select/type role"></type-select>
        </div>
        <div class="cols">
            <type-select label="Event Tag:" name="event-tag" id="filter-tag" placeholder="select/type tag"></type-select>
            <label for="filter-start">Start Date: </label>
            <input type="date" id="filter-start" name="filter-start"><br>
            <label for="filter-end">End Date: </label>
            <input type="date" id="filter-end" name="filter-end">
        </div>  
        </div>
        <div class="rows">  
            <button type="button" value="Submit" id="submit-filterform" class="button">Apply</button>
        </div>    
    </form>
    `;
    document.body.appendChild(filter);
    const roleFilter = document.getElementById('filter-role');
    const tagFilter = document.getElementById('filter-tag');
    setTimeout(() => {
        roleFilter.addOption('user', 'user');
        roleFilter.addOption('admin', 'admin');
        roleFilter.addOption('scanner', 'scanner');
        roleFilter.addOption('owner', 'owner');
        roleFilter.addOption('moderator', 'moderator');
    });
    const res = await GET(`/businesses/${getBusinessId()}/eventtags`);
    const tags = await res.json();
    let tagSet = new Set();
    for (let tag of tags) {
        tag = tag.tag;
        tag.split(',').forEach(tag => {
            if (!tagSet.has(tag)) {
                tagFilter.addOption(tag, tag);
                tagSet.add(tag);
            }
        });
    }
    let role = '';
    let tag = '';
    roleFilter.addEventListener('select', e => {
        role = e.detail.value;
    });
    tagFilter.addEventListener('select', e => {
        tag = e.detail.value;
    });
    document.getElementById('submit-filterform').onclick = async () => {
        let start = document.getElementById('filter-start').value;
        let end = document.getElementById('filter-end').value;
        start = new Date(start + 'T00:00').getTime() / 1000;
        const month = new Date(Date.now()).getMonth() + 1;
        let monthString = month.toString();
        if (month < 10) monthString = '0' + month;
        if (
            end ===
            new Date(Date.now()).getFullYear() +
                '-' +
                monthString +
                '-' +
                new Date(Date.now()).getDate()
        ) {
            end =
                new Date(
                    end + 'T' + new Date().getHours() + ':' + new Date().getMinutes(),
                ).getTime() / 1000;
        } else {
            end = new Date(end + 'T23:59').getTime() / 1000;
        }
        if (isNaN(start)) start = '';
        if (isNaN(end)) end = Math.round(Date.now() / 1000);
        if (end != '' && start != '' && end < start) {
            Popup.alert('End date must be after start date', 'var(--error)');
            return;
        } else if (end > Math.round(Date.now() / 1000) || start > Math.round(Date.now() / 1000)) {
            Popup.alert('Start and end date must be before today', 'var(--error)');
            return;
        }
        const res = await GET(
            `/businesses/${getBusinessId()}/attendance/statuscounts?tag=${tag}&role=${role}&start=${start}&end=${end}`,
        );
        const memberAttArr = await res.json();
        const numRes = await GET(
            `/businesses/${getBusinessId()}/events/count?tag=${tag}&start=${start}&end=${end}`,
        );
        const numPastEvents = (await numRes.json())['total_count'];
        runMemberStatsTable(memberAttArr, numPastEvents);
        [...document.getElementById('user-stats-table').firstChild.querySelectorAll('tr')].forEach(
            row => {
                if (
                    row.firstChild.nodeName === 'TD' &&
                    document.getElementById('filter-name').value
                ) {
                    sortStudents(document.getElementById('filter-name').value);
                } else {
                    row.style.display = 'table-row';
                }
            },
        );
    };
};

const res = await GET(
    `/businesses/${getBusinessId()}/attendance/statuscounts?tag=&role=&start=&end=${Math.round(
        Date.now() / 1000,
    )}`,
);
const memberAttArr = await res.json();
const numRes = await GET(
    `/businesses/${getBusinessId()}/events/count?tag=&start=&end=${Math.round(Date.now() / 1000)}`,
);
const numPastEvents = (await numRes.json())['total_count'];
runMemberStatsTable(memberAttArr, numPastEvents);

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);
