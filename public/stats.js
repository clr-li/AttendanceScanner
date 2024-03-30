import { requireLogin } from './util/Auth.js';
import { GET } from './util/Client.js';
import { initBusinessSelector, initEventSelector } from './util/selectors.js';
import { sanitizeText } from '../util/util.js';
import { Popup } from './components/Popup.js';
await requireLogin();

const { get: getBusinessId } = await initBusinessSelector('business-selector', async () => {
    const res = await GET(`/memberattendancedata?businessId=${getBusinessId()}&tag=&role=`);
    const memberAttArr = await res.json();
    const numRes = await GET(`/countAllEvents?businessId=${getBusinessId()}&tag=`);
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
    for (const userid of uidToUserinfo.keys()) {
        const userinfo = uidToUserinfo.get(userid);
        html += `<tr id="row-${sanitizeText(userid)}"><td data-name="${userinfo.name}" data-csv="${
            userinfo.name
        }">${sanitizeText(userinfo.name)} (${sanitizeText(userid.substr(0, 4))}`;
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
}

document.getElementById('show-filter').onclick = async () => {
    const filter = new Popup();
    filter.innerHTML = /* html */ `
    <form id="filterform" class="form" onsubmit="return false;">
        <h1>Filter</h1>
        <type-select label="Event Tag:" name="event-tag" id="filter-tag" placeholder="select/type event tag"></type-select>
        <type-select label="Role:" name="role" id="filter-role" placeholder="select/type role"></type-select>
        <!--<label for="filter-start">Start Date: </label>
        <input type="date" id="filter-start" name="filter-start">
        <label for="filter-end">End Date: </label>
        <input type="date" id="filter-end" name="filter-end"><br>-->
        <button type="button" value="Submit" id="submit-filterform" class="button">Apply</button>
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
    const res = await GET(`/eventtags?businessId=${getBusinessId()}`);
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
        const start = document.getElementById('filter-start').value;
        const end = document.getElementById('filter-end').value;
        const res = await GET(
            `/memberattendancedata?businessId=${getBusinessId()}&tag=${tag}&role=${role}&start=${start}&end=${end}`,
        );
        const memberAttArr = await res.json();
        const numRes = await GET(`/countAllEvents?businessId=${getBusinessId()}&tag=${tag}`);
        const numPastEvents = (await numRes.json())['total_count'];
        runMemberStatsTable(memberAttArr, numPastEvents);
    };
};

const res = await GET(`/memberattendancedata?businessId=${getBusinessId()}&tag=&role=`);
const memberAttArr = await res.json();
const numRes = await GET(`/countAllEvents?businessId=${getBusinessId()}&tag=`);
const numPastEvents = (await numRes.json())['total_count'];
runMemberStatsTable(memberAttArr, numPastEvents);

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);
