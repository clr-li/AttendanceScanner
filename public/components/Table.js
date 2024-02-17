import { Component } from '../util/Component.js';
import { Popup } from './Popup.js';
import { calcSimilarity, sanitizeText } from '../util/util.js';
import { GET, POST } from '../util/Client.js';
import { useURL } from '../util/StateManager.js';

/**
 * The Table component represents a table to store data
 */
export class Table extends Component {
    initialHTML() {
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <link rel="stylesheet" href="/styles/inputs.css">
            <link rel="stylesheet" href="/styles/tables.css">
            <link rel="stylesheet" href="/styles/qrcode.css">
            <form id="filterform" class="form" onsubmit="return false;">
                <label for="filtername">Name: </label>
                <input type="text" id="filtername" name="filtername" placeholder="person name"><br>
                <type-select label="Event Name:" name="eventName" id="filterEventName" placeholder="select/type event"></type-select><br>
                <label for="filterstart">Start Date: </label>
                <input type="date" id="filterstart" name="filterstart">
                <label for="filterend">End Date: </label>
                <input type="date" id="filterend" name="filterend"><br>
                <button type="button" value="Submit" id="submitfilter" class="button">Filter</button>
            </form>
            <div class="scroll">
                <table id="displayattendance" class="calendar"></table>
            </div><br>
            <div class="scanner-container" style="width: 671px; height: 276px;">
                <button class="button-tab active" id="alter-tab">Alter Checked</button>
                <button class="button-tab" id="import-tab">Import Data</button>
                <button class="button-tab" id="export-tab">Export Data</button>
                <hr style="border-color: var(--accent); margin-bottom: 5px;" />
                <div id="alter-container">
                    <type-select label="Event Name:" name="eventNameAlter" id="alter-events" placeholder="select/type event"></type-select>
                    <type-select id="status" name="status" label="STATUS: " placeholder="select">
                        <option value="PRESENT">PRESENT</option>
                        <option value="ABSENT">ABSENT</option>
                        <option value="EXCUSED">EXCUSED</option>
                        <option value="LATE">LATE</option>
                    </type-select>
                    <button class="button" id="alter-button">Alter Checked</button>
                </div>
                <div id="import-container" style="display: none;">
                    <form id="import-form" class="form" onsubmit="return false;">
                        <label for="csv-file">Choose CSV: </label>
                        <input type="file" id="csv-file" name="csv-file"><br>
                        <type-select label="Join On:" name="merge-col" id="merge-col" placeholder="select/type column"></type-select>
                        <div style="display: flex; justify-content: center; margin-bottom: 12px">
                        <label style="font-size: 1.5rem; padding: 0.2rem">Overwrite: </label>
                        <div class="checkbox-wrapper-6">
                            <input id="overwrite" class="tgl tgl-light" type="checkbox" />
                            <label class="tgl-btn" style="font-size: 16px" for="overwrite"></label>
                        </div>
                    </div>
                    <button type="button" value="Submit" id="import-merge" class="button">Import and Merge</button>
                    </form>
                </div>
                <div id="export-container" style="display: none;">
                <button type="button" class="button" id="export">Export to CSV</button>
                </div>
            </div>
            <dialog id="role-success" style="z-index: 10; width: fit-content; height: fit-content; background: white; position: fixed; bottom: 0; top: 0; left: 0; right: 0; margin: auto; color: var(--success); animation: fadeInAndOut 3s; font-weight: bold;">
                <p>role changed</p>
            </dialog>
            <dialog id="success" style="z-index: 10; width: fit-content; height: fit-content; background: white; position: fixed; bottom: 0; top: 0; left: 0; right: 0; margin: auto; color: var(--success); animation: fadeInAndOut 3s; font-weight: bold;">
                <p>success</p>
            </dialog>
        `;
    }

    showSuccessDialog(id) {
        this.shadowRoot.getElementById(id).show();
        setTimeout(() => {
            this.shadowRoot.getElementById(id).close();
        }, 3000);
    }

    activateAlter(
        alterTab,
        importTab,
        exportTab,
        alterContainer,
        importContainer,
        exportContainer,
        setActiveTab,
    ) {
        alterTab.classList.add('active');
        importTab.classList.remove('active');
        exportTab.classList.remove('active');
        alterContainer.style.display = 'block';
        importContainer.style.display = 'none';
        exportContainer.style.display = 'none';
        setActiveTab('alter');
    }

    activateImport(
        alterTab,
        importTab,
        exportTab,
        alterContainer,
        importContainer,
        exportContainer,
        setActiveTab,
    ) {
        alterTab.classList.remove('active');
        importTab.classList.add('active');
        exportTab.classList.remove('active');
        alterContainer.style.display = 'none';
        importContainer.style.display = 'block';
        exportContainer.style.display = 'none';
        setActiveTab('import');
    }

    activateExport(
        alterTab,
        importTab,
        exportTab,
        alterContainer,
        importContainer,
        exportContainer,
        setActiveTab,
    ) {
        alterTab.classList.remove('active');
        importTab.classList.remove('active');
        exportTab.classList.add('active');
        alterContainer.style.display = 'none';
        importContainer.style.display = 'none';
        exportContainer.style.display = 'block';
        setActiveTab('export');
    }

    async updateTable(attendancearr, events, businessID) {
        this.businessID = businessID;
        let map = new Map();
        let userIds = [];
        let statusColor = {
            PRESENT: 'green',
            ABSENT: 'red',
            EXCUSED: 'gray',
            LATE: 'orange',
            'N/A': 'lightgray',
            'ABSENT(self-marked)': '#fc6060',
        };
        for (let i = 0; i < attendancearr.length; i++) {
            if (attendancearr[i].user_id) attendancearr[i].id = attendancearr[i].user_id;
            if (!map.has(attendancearr[i].id)) {
                map.set(attendancearr[i].id, []);
            }
            map.get(attendancearr[i].id).push(attendancearr[i]);
        }
        let html = `<tr><th><input type="checkbox" id="select-all" class="selectedrows"></th><th data-csv="Name">Name (id)</th><th data-csv="Email">Email</th>`;

        // Custom data headers
        const customHeaders = attendancearr[0].custom_data;
        for (const [key, value] of Object.entries(JSON.parse(customHeaders))) {
            html += `<th data-csv="${sanitizeText(key)}">${sanitizeText(key)}</th>`;
        }
        // Event headers
        for (let i = 0; i < events.length; i++) {
            var startDate = new Date(events[i].starttimestamp * 1000);
            var endDate = new Date(events[i].endtimestamp * 1000);
            let eventName = events[i].name || '[Unnamed]';
            html += `<th class="cell" data-time="${sanitizeText(
                events[i].starttimestamp,
            )}" data-name="${sanitizeText(events[i].name)}" data-csv="${sanitizeText(
                eventName,
            )}"><b>${sanitizeText(eventName)}</b><br><p class="smaller-text">${sanitizeText(
                startDate.toLocaleDateString(),
            )} - ${sanitizeText(endDate.toLocaleDateString())}</p></th>`;
        }
        html += '</tr>';
        for (let i = 0; i < [...map.keys()].length; i++) {
            let userid = [...map.keys()][i];
            userIds.push(userid);
            let records = map.get(userid);
            const roleChangeHTML = `<br>
            <form>
                <select class="newrole" style="border-radius: 10px; border: 2px solid var(--accent); font-size: 1rem;">
                    <option value="admin">admin</option>
                    <option value="moderator">moderator</option>
                    <option value="scanner">scanner</option>
                    <option value="user">user</option>
                </select>
                <button type="button" class="kickuser" style="background: none; border: none;">&nbsp;<i class="fa-regular fa-trash-can"></i></button>
            </form>
            `;
            html += `<tr id="row-${sanitizeText(
                userid,
            )}"><td><input type="checkbox" id="select-${sanitizeText(
                userid,
            )}" class="selectedrows"></td><td data-name="${records[0].name}" data-csv="${
                records[0].name
            }">${sanitizeText(records[0].name)} (${sanitizeText(userid.substr(0, 4))}`;
            if (records[0].role !== 'owner') {
                html += `)${roleChangeHTML}`;
            } else {
                html += ` - owner)`;
            }
            html += `</td><td data-csv="${sanitizeText(records[0].email)}">${sanitizeText(
                records[0].email,
            )}</td>`;

            // Custom data
            let customData = JSON.parse(records[0].custom_data);
            for (const [key, value] of Object.entries(customData)) {
                html += `<td data-csv="${sanitizeText(value)}">${sanitizeText(value)}</td>`;
            }

            for (let j = 0; j < events.length; j++) {
                let statusupdate = false;
                let color = 'lightgray';
                for (let k = 0; k < records.length; k++) {
                    if (records[k].event_id === events[j].id) {
                        if (statusColor[records[k].status]) {
                            color = statusColor[records[k].status];
                        }
                        let recordTimestamp = new Date(records[k].timestamp * 1000)
                            .toString()
                            .split(' ')
                            .slice(1, 5)
                            .toString()
                            .replace(',', ' ')
                            .replaceAll(',', ', ');
                        html += `<td class="cell" data-time="${sanitizeText(
                            events[j].starttimestamp,
                        )}" data-name="${sanitizeText(events[j].name)}" data-csv="${sanitizeText(
                            records[k].status,
                        )}">
                            <p style="color: ${color}; font-weight: bold;">${sanitizeText(
                                records[k].status,
                            )}</p>
                            <p class="smaller-text">${sanitizeText(recordTimestamp)}</p>
                        </td>`;
                        statusupdate = true;
                        break;
                    }
                }
                if (!statusupdate) {
                    const status =
                        Date.now() > parseInt(events[j].endtimestamp) * 1000 ? 'ABSENT' : 'N/A';
                    if (statusColor[status]) {
                        color = statusColor[status];
                    }
                    html += `<td class="cell" data-time="${sanitizeText(
                        events[j].starttimestamp,
                    )}" data-name="${sanitizeText(events[j].name)}" data-csv="${sanitizeText(
                        status,
                    )}"><p style="color: ${color}; font-weight: bold;">${status}</p></td>`;
                }
            }
            html += '</tr>';
        }
        const attendance = this.shadowRoot.getElementById('displayattendance');
        attendance.innerHTML = html;
        this.shadowRoot.getElementById('select-all').addEventListener('input', e => {
            for (const checkbox of [...attendance.getElementsByClassName('selectedrows')]) {
                checkbox.checked = e.target.checked;
            }
        });
        const allRoleSelects = attendance.getElementsByClassName('newrole');
        const allKickButtons = attendance.getElementsByClassName('kickuser');
        let button_index = 0;
        for (let i = 0; i < userIds.length; i++) {
            if (map.get(userIds[i])[0].role !== 'owner') {
                let id = userIds[i];
                let b_id = button_index;
                allRoleSelects[button_index].value = map.get(userIds[i])[0].role;
                allRoleSelects[button_index].addEventListener('change', () => {
                    let role = allRoleSelects[b_id].value;
                    GET(`/assignRole?businessId=${businessID}&userId=${id}&role=${role}`).then(
                        async res => {
                            console.log(res.status);
                            if (res.ok) {
                                this.showSuccessDialog('role-success');
                            } else {
                                Popup.alert(sanitizeText(await res.text()), 'var(--error)');
                            }
                        },
                    );
                });
                allKickButtons[button_index].addEventListener('click', () => {
                    GET(`/removeMember?businessId=${businessID}&userId=${id}`).then(async res => {
                        console.log(res.status);
                        if (res.ok) {
                            this.showSuccessDialog('success');
                            this.shadowRoot.getElementById('row-' + id).remove();
                        } else {
                            Popup.alert(sanitizeText(await res.text()), 'var(--error)');
                        }
                    });
                });
                button_index++;
            }
        }
        const { get: getActiveTab, set: setActiveTab } = useURL('active', 'alter');
        const alterTab = this.shadowRoot.getElementById('alter-tab');
        const importTab = this.shadowRoot.getElementById('import-tab');
        const exportTab = this.shadowRoot.getElementById('export-tab');
        const alterContainer = this.shadowRoot.getElementById('alter-container');
        const importContainer = this.shadowRoot.getElementById('import-container');
        const exportContainer = this.shadowRoot.getElementById('export-container');
        this.shadowRoot.getElementById('alter-tab').addEventListener('click', e => {
            this.activateAlter(
                alterTab,
                importTab,
                exportTab,
                alterContainer,
                importContainer,
                exportContainer,
                setActiveTab,
            );
        });
        this.shadowRoot.getElementById('import-tab').addEventListener('click', e => {
            this.activateImport(
                alterTab,
                importTab,
                exportTab,
                alterContainer,
                importContainer,
                exportContainer,
                setActiveTab,
            );
        });
        this.shadowRoot.getElementById('export-tab').addEventListener('click', e => {
            this.activateExport(
                alterTab,
                importTab,
                exportTab,
                alterContainer,
                importContainer,
                exportContainer,
                setActiveTab,
            );
        });
        if (getActiveTab() === 'alter') {
            this.activateAlter(
                alterTab,
                importTab,
                exportTab,
                alterContainer,
                importContainer,
                exportContainer,
                setActiveTab,
            );
        } else if (getActiveTab() === 'import') {
            this.activateImport(
                alterTab,
                importTab,
                exportTab,
                alterContainer,
                importContainer,
                exportContainer,
                setActiveTab,
            );
        } else {
            this.activateExport(
                alterTab,
                importTab,
                exportTab,
                alterContainer,
                importContainer,
                exportContainer,
                setActiveTab,
            );
        }
        this.options = ['Email', 'Id', 'Name'];
        this.mergeOptions = this.shadowRoot.getElementById('merge-col');
        for (let i = 0; i < this.options.length; i++) {
            let option = document.createElement('option');
            option.value = this.options[i];
            this.mergeOptions.appendChild(option);
        }

        this.mergeCol = '';
        this.mergeOptions.addEventListener('select', e => {
            this.mergeCol = e.detail.value;
        });

        const csvFile = this.shadowRoot.getElementById('csv-file');
        this.shadowRoot.getElementById('import-merge').addEventListener('click', () => {
            // Get file text
            const file = csvFile.files[0];
            let reader = new FileReader();
            const overwrite = this.shadowRoot.getElementById('overwrite').checked;
            reader.addEventListener(
                'load',
                async () => {
                    const res = await POST(`/importCustomData?businessId=${businessID}`, {
                        data: reader.result,
                        mergeCol: this.mergeCol.toLowerCase(),
                        overwrite: overwrite,
                    });
                    if (res.ok) {
                        this.showSuccessDialog('success');
                        const event = new CustomEvent('reloadTable', {});
                        this.dispatchEvent(event);
                    } else {
                        Popup.alert(sanitizeText(await res.text()), 'var(--error)');
                    }
                },
                false,
            );
            if (file) {
                reader.readAsText(file);
            }
        });
    }

    sortStudents(searchword) {
        searchword = searchword.toLowerCase();
        var table, rows, switching, i, x, y, shouldSwitch;
        table = this.shadowRoot.getElementById('displayattendance');
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
                x = rows[i].getElementsByTagName('TD')[1];
                y = rows[i + 1].getElementsByTagName('TD')[1];
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

    replaceEvents(options, eventNames) {
        this.eventFilterSelector.replaceChildren(
            ...[...eventNames].map(name => {
                const option = document.createElement('option');
                option.value = name;
                return option;
            }),
        );
        this.alterEventSelector.replaceChildren(...options.map(o => o.cloneNode(true)));
    }

    downloadCSVFile(csv_data) {
        // Create CSV file object and feed our
        // csv_data into it
        let CSVFile = new Blob([csv_data], { type: 'text/csv' });

        // Create to temporary link to initiate
        // download process
        var temp_link = document.createElement('a');

        // Download csv file
        temp_link.download = 'cal.csv';
        var url = window.URL.createObjectURL(CSVFile);
        temp_link.href = url;

        // This link should not be displayed
        temp_link.style.display = 'none';
        document.body.appendChild(temp_link);

        // Automatically click the link to trigger download
        temp_link.click();
        document.body.removeChild(temp_link);
    }

    connectedCallback() {
        this.eventFilterSelector = this.shadowRoot.getElementById('filterEventName');
        this.alterEventSelector = this.shadowRoot.getElementById('alter-events');
        this.event_to_alter = null;
        this.alterEventSelector.addEventListener('select', e => {
            this.event_to_alter = e.detail;
        });
        let filteringEvent = null;
        this.eventFilterSelector.addEventListener('select', e => {
            filteringEvent = e.detail;
        });
        this.shadowRoot.getElementById('submitfilter').onclick = () => {
            [
                ...this.shadowRoot
                    .getElementById('displayattendance')
                    .firstChild.querySelectorAll('tr'),
            ].forEach(row => {
                if (
                    row.firstChild.nodeName === 'TD' &&
                    this.shadowRoot.getElementById('filtername').value
                ) {
                    this.sortStudents(this.shadowRoot.getElementById('filtername').value);
                } else {
                    row.style.display = 'table-row';
                }
            });
            [
                ...this.shadowRoot
                    .getElementById('displayattendance')
                    .getElementsByClassName('cell'),
            ].forEach(cell => {
                const showstart = !!this.shadowRoot.getElementById('filterstart').value;
                const showend = !!this.shadowRoot.getElementById('filterend').value;
                const eventName = filteringEvent ? filteringEvent.value : '';
                let showCell = true;
                if (showstart) {
                    showCell =
                        showCell &&
                        new Date(
                            this.shadowRoot.getElementById('filterstart').value + 'T00:00',
                        ).getTime() /
                            1000 <
                            cell.dataset.time;
                }
                if (showend) {
                    showCell =
                        showCell &&
                        new Date(
                            this.shadowRoot.getElementById('filterend').value + 'T23:59',
                        ).getTime() /
                            1000 >
                            cell.dataset.time;
                }
                if (eventName) {
                    showCell = showCell && cell.dataset.name === eventName;
                }
                if (showCell) {
                    cell.style.display = 'table-cell';
                } else {
                    cell.style.display = 'none';
                }
            });
        };

        this.status = 'EXCUSED';
        const statusSelector = this.shadowRoot.getElementById('status');
        statusSelector.addEventListener('select', e => {
            this.status = e.detail.value;
        });
        statusSelector.setAttribute('value', this.status);

        const alterButton = this.shadowRoot.getElementById('alter-button');
        alterButton.addEventListener('click', async e => {
            const ids_to_alter = [];
            for (const checkbox of [
                ...this.shadowRoot
                    .getElementById('displayattendance')
                    .getElementsByClassName('selectedrows'),
            ]) {
                if (checkbox.checked) {
                    ids_to_alter.push(checkbox.id.split('-')[1]);
                }
            }
            if (ids_to_alter.length === 0) {
                Popup.alert('Please select the users/rows to alter first.', 'var(--warning)');
                return;
            }
            if (!this.event_to_alter) {
                Popup.alert('Please select an event to alter first.', 'var(--warning)');
                return;
            }
            if (!statusSelector.isValid()) {
                Popup.alert('Please select a valid status.', 'var(--warning)');
                return;
            }
            const res = await GET(
                `/alterAttendance?businessId=${this.businessID}&ids=${ids_to_alter.join(
                    ',',
                )}&status=${this.status}&event=${this.event_to_alter.dataset.id}`,
            );
            if (res.ok) {
                const event = new CustomEvent('reloadTable', {});
                dispatchEvent(event);
            } else {
                Popup.alert(sanitizeText(await res.text()), 'var(--error)');
            }
        });

        this.shadowRoot.getElementById('export').onclick = () => {
            // Variable to store the final csv data
            var csv_data = [];

            // Get each row data
            var rows = this.shadowRoot
                .getElementById('displayattendance')
                .getElementsByTagName('tr');
            let cellData;
            for (var i = 0; i < rows.length; i++) {
                // Get each column data
                var cols = rows[i].querySelectorAll('td,th');

                // Stores each csv row data
                var csvrow = [];
                for (var j = 0; j < cols.length; j++) {
                    // Get the text data of each cell of
                    // a row and push it to csvrow
                    cellData = cols[j].dataset.csv;
                    if (cellData) {
                        csvrow.push(cellData);
                    }
                }

                // Combine each column value with comma
                csv_data.push(csvrow.join(','));
            }
            // combine each row data with new line character
            csv_data = csv_data.join('\n');
            this.downloadCSVFile(csv_data);
        };
    }
}

window.customElements.define('attendance-table', Table);
