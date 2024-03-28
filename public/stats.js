import { requireLogin } from './util/Auth.js';
import { GET } from './util/Client.js';
import { initBusinessSelector } from './util/selectors.js';
import { sanitizeText } from '../util/util.js';
await requireLogin();

const { get: getBusinessId } = await initBusinessSelector('business-selector', async () => {
    runMemberStatsTable();
});

async function runMemberStatsTable() {
    const res = await GET(`/memberattendancedata?businessId=${getBusinessId()}`);
    const memberAttArr = await res.json();
    const uidToUserinfo = new Map();
    const statuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    const absentAliases = ['ABSENT(self-marked)', 'ABSENT'];

    const numRes = await GET(`/countPastEvents?businessId=${getBusinessId()}`);
    const numPastEvents = (await numRes.json())['total_count'];
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
            html += `<td>${userinfo[status]}</td>`;
        }
        html += `<td>${numPastEvents}</td></tr>`;
    }
    const attendance = document.getElementById('user-stats-table');
    attendance.innerHTML = html;
}

runMemberStatsTable();

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);
