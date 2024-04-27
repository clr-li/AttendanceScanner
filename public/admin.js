import { Component } from './util/Component.js';
import { Popup } from './components/Popup.js';

/** @typedef {import('./components/DataTable.js').DataTable} DataTable */

// import HTTP methods and add error handling
import { GET, DELETE, PUT, PATCH, POST, sendGmail, setErrorHandler } from './util/Client.js';
setErrorHandler(async res => {
    await Popup.alert(await res.text(), 'var(--error)');
});

import { sanitizeText, html, print, stringToColor } from './util/util.js';
import { useURL } from './util/StateManager.js';

import { requireLogin, getCurrentUser, requestGoogleCredential } from './util/Auth.js';
await requireLogin();
const user = await getCurrentUser();

import { initBusinessSelector } from './util/selectors.js';
const updateOnGroupChange = [];
const { get: getBusinessId } = await initBusinessSelector('businessId', async () => {
    updateOnGroupChange.forEach(u => u.update());
});

// ================== A Component for Each Tab ==================
// Each component has initialHTML, an update() method responsible
// for loading data (will be called on group change) and a
// connectedCallback() method responsible for adding event listeners.

/** A component that shows the group settings and allows the user to change them */
class GroupSettings extends Component {
    initialHTML() {
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <link rel="stylesheet" href="/styles/inputs.css">
            <link rel="stylesheet" href="/styles/tables.css">
            <link rel="stylesheet" href="/font-alexsome/icon.css">
            <h1>Group Settings</h1>
            <div class="form" style="padding: 1em;">
                <label style="display: flex; justify-content: space-evenly;">
                    <span>
                        Only take attendance for members
                        <span style="position: relative;">
                            <i role="button" onclick="this.nextElementSibling.show(); event.preventDefault()" class="fa-solid fa-circle-info smaller-text"></i>
                            <dialog onblur="this.close()" class="tooltip-info" style="font-size: medium;">When enabled, you won't be able to scan/take attendance for non-members. When disabled, non-members are automatically added to the group when you scan/take their attendance.</dialog>
                        </span>
                    </span>
                    <div class="checkbox-wrapper-6">
                        <input id="require-join" class="tgl tgl-light" type="checkbox" />
                        <div class="tgl-btn" style="font-size: 16px; width: 4em; height: 2em"></div>
                    </div>
                </label>
                <br><hr><br>
                <a class="button" href="/payment.html">Manage Subscription &nbsp; <i class="fa-regular fa-money-bill-1"></i></a>
                <a class="button" id="genericScannerLink" href="/scanner.html">Take Attendance &nbsp; <i class="icon-scanner"></i></a>
                <a class="button" href="/#contact">Contact Support &nbsp; <i class="fa-regular fa-envelope"></i></a>
                <button id="changeName" class="button">Change Name &nbsp; <i class="fa-regular fa-pen-to-square"></i></button>
                <a class="button delete" href="/payment.html">Delete Everything &nbsp; <i class="fa-solid fa-trash"></i></a>
                <br><br><hr><br>
                <label for="email-notification">
                    Send email notification to group members
                    <span style="position: relative;">
                        <i role="button" onclick="this.nextElementSibling.show(); event.preventDefault()" class="fa-solid fa-circle-info smaller-text"></i>
                        <dialog onblur="this.close()" class="tooltip-info" style="font-size: medium;">Enter the email text below. It will be sent out to every current member with '[MEMBER_NAME]' replaced with their actual name. Note: these are subject to the rate limits on your Google account, so if you need to send more than ~300/day, you'll have to apply for an increased limit from Google.</dialog>
                    </span>
                </label><br>
                <textarea
                    id="email-notification"
                    style="resize: vertical"
                    rows="7"
                    name="email-notification"
                ></textarea><br>
                <button id="sent-email" class="button">Send Email to Everyone</button>
            </div>
        `;
    }

    async update() {
        // initialize settings
        const requireJoin = await GET(`/businesses/${getBusinessId()}/settings/requirejoin`).then(
            res => res.json(),
        );
        this.shadowRoot.getElementById('require-join').checked = requireJoin.requireJoin === 1;

        // initialize email notification
        this.shadowRoot.getElementById('email-notification').textContent = `
            Hi [MEMBER_NAME],

            Insert email body here.

            Best,
            ${user.name}
            (automatically sent via Attendance Scanner QR)
        `
            .trim()
            .split('\n')
            .map(l => l.trim())
            .join('\n');
        this.members = await GET(`/businesses/${getBusinessId()}/members`).then(res => res.json());
    }

    connectedCallback() {
        updateOnGroupChange.push(this);
        this.update();

        // settings eventlisteners
        const requireJoin = this.shadowRoot.getElementById('require-join');
        requireJoin.onchange = async () => {
            await PUT(
                `/businesses/${getBusinessId()}/settings/requirejoin?new=${
                    requireJoin.checked ? 1 : 0
                }`,
            );
        };
        // send email notification
        const emailNotification = this.shadowRoot.getElementById('email-notification');
        this.shadowRoot.getElementById('sent-email').onclick = async () => {
            const credential = await requestGoogleCredential([
                'https://www.googleapis.com/auth/gmail.send',
            ]);
            let success = true;
            for (const member of this.members) {
                const res = await sendGmail(
                    member.email,
                    'Attendance Scanner Notification',
                    emailNotification.textContent.replace('[MEMBER_NAME]', member.name),
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
    }
}
window.customElements.define('group-settings', GroupSettings);

// ----------------------------------------------------------------
/** Table of members: manages kicking, role changes, invites, qr codes and data import/export */
class MembersTable extends Component {
    initialHTML() {
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <link rel="stylesheet" href="/styles/tables.css">
            <data-table name="Members" id="table">
                <span slot="selection-actions">
                    <button id="kick-users" class="table-pill table-pill__color"><i class="fa-solid fa-trash"></i>&nbsp;Kick</button>
                    <select id="change-role" class="table-pill table-pill__color">
                        <option value="" disabled selected>Change Roles</option>
                        <option value="admin">admin</option>
                        <option value="moderator">moderator</option>
                        <option value="scanner">scanner</option>
                        <option value="user">user</option>
                    </select>
                </span>
                <div slot="top-actions">
                    <button id="import-data" class="button"><i class="fa-solid fa-file-import"></i>&nbsp;Import Data</button>
                    <button id="invite-users" class="button"><i class="fa-solid fa-user-plus"></i>&nbsp;Invite Members</button>
                </div>
                <div slot="bottom-actions">
                    <button id="export-csv" class="button"><i class="fa-solid fa-file-export"></i>&nbsp;Export CSV</button>
                    <button id="print-codes" class="button"><i class="fa-solid fa-print"></i>&nbsp;Print QR Codes</button>
                </div>
            </data-table>
            <p style="text-align: left; padding: 1em; max-width: var(--max-width); margin: auto">
                <strong>TIPS</strong>: Click on custom imported cells to change their values &mdash; Click on the qr code icon to show the qr code &mdash; Select multiple rows to kick members or change roles in bulk.
            </p>
        `;
    }

    async update() {
        // load data
        const data = await GET(`/businesses/${getBusinessId()}/members`);
        this.users = await data.json();
        const [dataColumns, customColumns] = mergeCustomData(this.users);
        const columns = addQRCodeColumn(this.users, dataColumns);

        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');
        table.update(
            columns,
            this.users,
            ['qr'],
            customColumns,
            undefined,
            (col, row) => {
                if (col !== 'role') return row[col];
                if (row.role === 'owner') return html`<span>owner</span>`;
                return html` <label style="position: relative">
                    <span style="border-bottom: 2px dashed black;">${row[col]}</span>
                    <br />
                    <select class="table-dropdown">
                        <option value="admin" ${row[col] === 'admin' ? 'selected' : ''}>
                            admin
                        </option>
                        <option value="moderator" ${row[col] === 'moderator' ? 'selected' : ''}>
                            moderator
                        </option>
                        <option value="scanner" ${row[col] === 'scanner' ? 'selected' : ''}>
                            scanner
                        </option>
                        <option value="user" ${row[col] === 'user' ? 'selected' : ''}>user</option>
                    </select>
                </label>`;
            },
            ['change'],
            ['name'],
        );
    }

    connectedCallback() {
        updateOnGroupChange.push(this);
        this.update();

        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');

        // setup actions
        // download the members data as a csv file (excluding the qr code column):
        this.shadowRoot.getElementById('export-csv').onclick = () => {
            table.download('members.csv', ['qr']);
        };
        // print the qr codes of the selected users (or all users if none are selected):
        this.shadowRoot.getElementById('print-codes').onclick = () => {
            const selection = table.getSelection();
            printQrCodes(selection.length ? selection : this.users);
        };
        // import custom data from a csv file:
        this.shadowRoot.getElementById('import-data').onclick = async () => {
            await importCustomData();
            this.update();
        };
        // show the member invitation modal with email invites, copy joinlink, and joinlink QR code:
        this.shadowRoot.getElementById('invite-users').onclick = showInviteModal;
        this.shadowRoot.getElementById('kick-users').onclick = async () => {
            await kickUsers(table.getSelection());
            this.update();
        };
        // change the role of the selected users to the selected new role:
        const changeRole = this.shadowRoot.getElementById('change-role');
        changeRole.onchange = async () => {
            const newRole = changeRole.value;
            const users = table.getSelection();
            await changeRoles(users, newRole);
            changeRole.value = '';
            this.update();
        };
        // handle edits of custom data
        table.addEventListener('edit', async e => {
            const uid = e.detail.row.id;
            const costumData = { ...e.detail.row.custom_data, [e.detail.col]: e.detail.value };
            await PATCH(`/businesses/${getBusinessId()}/customdata/${uid}`, costumData);
        });
        // handle role change
        table.addEventListener('table-change', async e => {
            if (e.detail.col === 'role') {
                await changeRoles([e.detail.row], e.detail.value);
                e.detail.row[e.detail.col] = [e.detail.value];
                table.update();
            }
        });
    }
}
window.customElements.define('members-table', MembersTable);

// ----------------------------------------------------------------
/** Table of attendance statuses for each event (columns) and user (rows). Manages changing attendance status. */
class AttendanceTable extends Component {
    initialHTML() {
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <link rel="stylesheet" href="/styles/tables.css">
            <link rel="stylesheet" href="/styles/inputs.css">
            <link rel="stylesheet" href="/font-alexsome/icon.css">
            <data-table name="Attendance" id="table">
                <span slot="selection-actions">
                    <select id="change-status" class="table-pill table-pill__color">
                        <option value="" disabled selected>Change Statuses</option>
                        <option value="PRESENT">PRESENT</option>
                        <option value="LATE">LATE</option>
                        <option value="EXCUSED">EXCUSED</option>
                        <option value="ABSENT">ABSENT</option>
                    </select>
                </span>
                <div slot="top-actions">
                    <select id="filter-role" class="stylish" style="vertical-align: bottom;">
                        <option value="">Show All Roles</option>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="moderator">Moderator</option>
                        <option value="scanner">Scanner</option>
                        <option value="user">User</option>
                    </select>
                    <select id="filter-tags" class="stylish" style="vertical-align: bottom;">
                        <option value="" disabled selected>Filter by Tags</option>
                        <hr />
                        <optgroup id="available-tags" label="Select:"></optgroup>
                        <optgroup id="selected-tags" label="Deselect:"></optgroup>
                    </select>
                    <input type="date" id="start-date" class="stylish" aria-label="Show events before this date" />
                    to
                    <input type="date" id="end-date" class="stylish" aria-label="Show events after this date" />
                </div>
                <div slot="bottom-actions">
                    <label style="display: inline-flex; align-items: center; vertical-align: middle">
                        Show user info:&nbsp;<div class="checkbox-wrapper-6"><input id="show-columns" type="checkbox" class="tgl tgl-light" /><div class="tgl-btn"></div></div>
                    </label>
                    <a class="button" id="genericScannerLink" href="/scanner.html"><i class="icon-scanner"></i>&nbsp;Take Attendance</a>
                    <button id="export-csv" class="button"><i class="fa-solid fa-file-export"></i>&nbsp;Export CSV</button>
                </div>
            </data-table>
            <p style="text-align: left; padding: 1em; max-width: var(--max-width); margin: auto">
                <strong>TIPS</strong>: Select which rows to export or export all data by not selecting any rows &mdash; Click on a cell to change its attendance status.
            </p>
        `;
    }

    async update() {
        // load data
        const [columns, users, formatHeader, formatCell, events, tags] = await loadAttendanceData();
        this.events = events;
        this.tags = tags;
        this.columns = columns;
        this.users = users;

        // role filter from url
        const role = useURL('role', '').get();
        this.shadowRoot.getElementById('filter-role').value = role;

        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');
        table.update(
            columns,
            users.filter(u => !role || u.role === role),
            events.map(e => e.id),
            [],
            formatHeader,
            formatCell,
            ['change'],
            ['name'],
        );

        // remove any selected tags that are not in the current attendance data
        const selectedTags = useURL('tags', '').get().match(/[^,]+/g) || [];
        useURL('tags', '').set(selectedTags.filter(t => tags.includes(t)).join(','));

        // apply current filters
        this.filterColumns();
    }

    connectedCallback() {
        updateOnGroupChange.push(this);
        this.update();

        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');

        // setup actions
        // show/hide the data columns (email/role) in the table:
        this.shadowRoot.getElementById('show-columns').onchange = this.filterColumns.bind(this);
        // download the attendance data as a csv file:
        this.shadowRoot.getElementById('export-csv').onclick = () => {
            table.download(
                'attendance.csv',
                [],
                col => this.events.find(e => e.id === col)?.name ?? col,
                (col, row) => (this.events.find(e => e.id === col) ? row[col][0] : row[col]),
            );
        };
        // change status of selected users for all visible events in bulk:
        const changeStatus = this.shadowRoot.getElementById('change-status');
        changeStatus.onchange = async () => {
            const newStatus = changeStatus.value;
            const users = table.getSelection();
            const eventsIds = table.columns.filter(c => this.events.find(e => e.id === c));
            await changeStatuses(users, eventsIds, newStatus);
            changeStatus.value = '';
            this.update();
        };
        // change status of a single user for a single event:
        table.addEventListener('table-change', async e => {
            await changeStatuses([e.detail.row], [e.detail.col], e.detail.value, false);
            e.detail.row[e.detail.col] = [
                e.detail.value,
                new Date().toLocaleString([], {
                    timeStyle: 'short',
                    dateStyle: 'short',
                }),
            ];
            table.update();
        });
        // filter events by start and end date:
        const startDate = this.shadowRoot.getElementById('start-date');
        const endDate = this.shadowRoot.getElementById('end-date');
        const [setstart, setend] = initEventRange(startDate, endDate);

        this.filterInterval = events => filterInterval(events, startDate.value, endDate.value);
        startDate.onchange = endDate.onchange = () => {
            setstart(startDate.value);
            setend(endDate.value);
            this.filterColumns();
        };
        // filter events by tag:
        const tagFilter = this.shadowRoot.getElementById('filter-tags');
        const availableTags = this.shadowRoot.getElementById('available-tags');
        const selectedTags = this.shadowRoot.getElementById('selected-tags');
        this.filterTags = events =>
            filterTags(events, this.tags, availableTags, selectedTags, tagFilter);
        tagFilter.onchange = () => {
            toggleTag(tagFilter.value);
            this.filterColumns();
        };
        // filter events by role:
        const filterRole = this.shadowRoot.getElementById('filter-role');
        filterRole.onchange = () => {
            const role = filterRole.value;
            useURL('role', '').set(role);
            table.update(
                undefined,
                this.users.filter(u => !role || u.role === role),
            );
        };
    }

    // applies the event filters (tags and date range) and hides the email/role columns if necessary
    filterColumns() {
        const table = this.shadowRoot.getElementById('table');
        const showUserColumns = this.shadowRoot.getElementById('show-columns');
        table.update([
            ...(showUserColumns.checked
                ? [...this.columns.filter(c => !this.events.find(e => e.id === parseInt(c)))]
                : ['name']),
            ...this.filterInterval(this.filterTags(this.events)).map(e => e.id),
        ]);
    }
}
window.customElements.define('attendance-table', AttendanceTable);

// ----------------------------------------------------------------
/** Table of events: manages editing, deleting, and creating events */
class EventTable extends Component {
    initialHTML() {
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <link rel="stylesheet" href="/styles/inputs.css">
            <link rel="stylesheet" href="/styles/tables.css">
            <data-table name="Events" id="table">
                <span slot="selection-actions">
                    <button id="delete-events" class="table-pill table-pill__color"><i class="fa-solid fa-trash"></i>&nbsp;Delete</button>
                </span>
                <div slot="top-actions">
                    <label style="display: inline-flex; align-items: center; vertical-align: middle">
                        Expand Repeats:&nbsp;<div class="checkbox-wrapper-6"><input id="expand-repeat" type="checkbox" class="tgl tgl-light" /><div class="tgl-btn"></div></div>
                    </label>
                    <select id="filter-tags" class="stylish" style="vertical-align: bottom;">
                        <option value="" disabled selected>Filter by Tags</option>
                        <hr />
                        <optgroup id="available-tags" label="Select:"></optgroup>
                        <optgroup id="selected-tags" label="Deselect:"></optgroup>
                    </select>
                    <input type="date" id="start-date" class="stylish" aria-label="Show events before this date" />
                    to
                    <input type="date" id="end-date" class="stylish" aria-label="Show events after this date" />
                </div>
                <div slot="bottom-actions">
                    <select id="edit-mode" class="stylish" style="vertical-align: top;">
                        <option value="" disabled>Changes to Repeating Events will</option>
                        <hr />
                        <option value="events">Modify the Current Event on Edit</option>
                        <option value="futureevents">Modify Current+Future Events on Edit</option>
                        <option value="allevents" selected>Modify All Events on Edit</option>
                    </select>
                    <button id="add-event" class="button"><i class="fa-solid fa-plus"></i>&nbsp;Add Event</button>
                    <button id="export-csv" class="button"><i class="fa-solid fa-file-export"></i>&nbsp;Export CSV</button>
                </div>
            </data-table>
            <p style="text-align: left; padding: 1em; max-width: var(--max-width); margin: auto">
                <strong>TIP</strong>: Click on a cell to edit its value.
            </p>
        `;
    }

    async update() {
        // load data
        const data = await GET(`/businesses/${getBusinessId()}/events`);
        this.events = await data.json();
        this.events.sort((a, b) => a.starttimestamp - b.starttimestamp);
        const columns = ['name', 'repeat_id', 'tag', 'starttimestamp', 'description'];

        // parse tags (and filter out any invalid tags from the url)
        const tags = new Set(this.events.map(e => e.tag.match(/[^,]+/g) || []).flat());
        const tagFilter = this.shadowRoot.getElementById('filter-tags');
        const availableTagsEl = this.shadowRoot.getElementById('available-tags');
        const selectedTagsEl = this.shadowRoot.getElementById('selected-tags');
        this.events = filterTags(this.events, tags, availableTagsEl, selectedTagsEl, tagFilter);

        // start and end date
        const startDate = this.shadowRoot.getElementById('start-date');
        const endDate = this.shadowRoot.getElementById('end-date');
        this.events = filterInterval(this.events, startDate.value, endDate.value);

        // expand/collapse repeat events
        const repeatExpand = this.shadowRoot.getElementById('expand-repeat');
        this.collapsedRepeatEvents = collapseEvents(this.events);

        // take eventId from url and move to the first row
        const eventId = useURL('eventId', '').get();
        if (eventId) {
            const index = this.events.findIndex(e => e.id === parseInt(eventId));
            if (index > 0) {
                this.events.unshift(this.events.splice(index, 1)[0]);
                repeatExpand.checked = true;
            }
            useURL('eventId', '').set('');
        }

        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');
        table.update(
            columns,
            repeatExpand.checked ? this.events : this.collapsedRepeatEvents,
            [],
            ['name', 'description'],
            this.formatHeader,
            this.formatCell,
            ['click'],
            ['name'],
        );
    }

    connectedCallback() {
        updateOnGroupChange.push(this);
        this.update();

        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');

        // setup actions
        // export csv
        this.shadowRoot.getElementById('export-csv').onclick = () => {
            table.download('events.csv', [], this.formatHeaderCSV, this.formatCellCSV);
        };
        // edit the name and description by typing into the event table cells:
        const editModeSelect = this.shadowRoot.getElementById('edit-mode');
        table.addEventListener('edit', async e => {
            const editMode = e.detail.row.repeat_id === null ? 'events' : editModeSelect.value;
            const eventId = editMode === 'events' ? e.detail.row.id : e.detail.row.repeat_id;
            await PATCH(
                `/businesses/${getBusinessId()}/${editMode}/${eventId}?starttimestamp=${
                    e.detail.row.starttimestamp
                }`,
                {
                    [e.detail.col]: e.detail.value,
                },
            );
            if (editMode !== 'events') {
                this.update();
            }
        });
        // handle cell clicks
        table.addEventListener('table-click', async e => {
            const editMode = e.detail.row.repeat_id === null ? 'events' : editModeSelect.value;
            const eventId = editMode === 'events' ? e.detail.row.id : e.detail.row.repeat_id;
            if (e.detail.col === 'tag' && ['BUTTON', 'I'].includes(e.detail.cause.target.tagName)) {
                // adding tags
                const newTag = await Popup.prompt('Enter a new tag:');
                if (!newTag) return;
                const tags = e.detail.row.tag.match(/[^,]+/g) || [];
                tags.push(newTag);
                e.detail.row.tag = ',' + tags.join(',') + ',';
                await PATCH(
                    `/businesses/${getBusinessId()}/${editMode}/${eventId}?starttimestamp=${
                        e.detail.row.starttimestamp
                    }`,
                    {
                        tag: e.detail.row.tag,
                    },
                );
                table.update();
            } else if (e.detail.col === 'tag' && e.detail.cause.target.tagName === 'SPAN') {
                // removing tags
                const tag = e.detail.cause.target.textContent.trim();
                const tags = e.detail.row.tag.match(/[^,]+/g) || [];
                tags.splice(tags.indexOf(tag), 1);
                e.detail.row.tag = ',' + tags.join(',') + ',';
                await PATCH(
                    `/businesses/${getBusinessId()}/${editMode}/${eventId}?starttimestamp=${
                        e.detail.row.starttimestamp
                    }`,
                    {
                        tag: e.detail.row.tag,
                    },
                );
                table.update();
            } else if (e.detail.col === 'starttimestamp') {
                // editing the start time and end time of the event
                const newDates = await promptForNewDates(e.detail.row, editMode);
                if (!newDates) return;
                await PATCH(
                    `/businesses/${getBusinessId()}/${editMode}/${eventId}?starttimestamp=${
                        e.detail.row.starttimestamp
                    }`,
                    newDates,
                );
                this.update();
            } else if (e.detail.col === 'repeat_id') {
                // toggle selection of all visible events with the same repeat_id
                const repeatGroup = row =>
                    e.detail.row.repeat_id
                        ? row.repeat_id === e.detail.row.repeat_id
                        : row.id === e.detail.row.id;
                if (table.getSelection().filter(repeatGroup).length) {
                    table.setSelection(() => false);
                } else {
                    table.setSelection(repeatGroup);
                }
            }
        });
        // toggle repeat collapse/expand
        this.shadowRoot.getElementById('expand-repeat').onchange = e => {
            if (e.target.checked) {
                table.update(undefined, this.events);
                editModeSelect.value = 'events';
            } else {
                table.update(undefined, this.collapsedRepeatEvents);
                editModeSelect.value = 'allevents';
            }
        };
        // date range filter
        const startDate = this.shadowRoot.getElementById('start-date');
        const endDate = this.shadowRoot.getElementById('end-date');
        const [setstart, setend] = initEventRange(startDate, endDate);

        startDate.onchange = endDate.onchange = () => {
            setstart(startDate.value);
            setend(endDate.value);
            this.update();
        };
        // tag filter
        const tagFilter = this.shadowRoot.getElementById('filter-tags');
        tagFilter.onchange = () => {
            toggleTag(tagFilter.value);
            this.update();
        };
        // delete selected events
        this.shadowRoot.getElementById('delete-events').onclick = async () => {
            const events = table.getSelection();
            if (await Popup.confirm('Are you sure you want to delete the selected events?')) {
                for (const event of events) {
                    const editMode = event.repeat_id === null ? 'events' : editModeSelect.value;
                    const eventId = editMode === 'events' ? event.id : event.repeat_id;
                    await DELETE(`/businesses/${getBusinessId()}/${editMode}/${eventId}`);
                }
                this.update();
            }
        };
        // add a new event
        this.shadowRoot.getElementById('add-event').onclick = async () => {
            const newEvent = await createNewEvent();
            if (!newEvent) return;
            setTimeout(this.update.bind(this));
        };
    }

    formatHeader(col) {
        return {
            name: 'NAME',
            repeat_id: 'REPEAT',
            tag: 'TAGS',
            starttimestamp: 'TIME',
            description: 'DESCRIPTION',
        }[col];
    }

    formatHeaderCSV(col) {
        return {
            name: 'NAME',
            repeat_id: 'REPEAT ID',
            tag: 'TAGS',
            starttimestamp: 'START,END',
            description: 'DESCRIPTION',
        }[col];
    }

    formatCell(col, row) {
        if (col === 'repeat_id') {
            if (row.num_repeats) {
                return html`<span style="display: block; margin: auto; width: fit-content"
                    >${row.num_repeats}</span
                >`;
            }
            return html`<span
                style="display: block; width: 1em; height: 1em; border-radius: 50%; background-color: ${stringToColor(
                    row[col],
                )}; border: 1px solid var(--secondary); margin: auto;"
            ></span>`;
        } else if (col === 'starttimestamp') {
            const start = new Date(+row[col]);
            const end = new Date(+row['endtimestamp']);
            const startstr = start.toLocaleString([], {
                timeStyle: 'short',
                dateStyle: 'short',
            });
            const endstr = end.toLocaleString(
                [],
                Object.assign(
                    {
                        timeStyle: 'short',
                    },
                    start.toLocaleDateString() !== end.toLocaleDateString()
                        ? { dateStyle: 'short' }
                        : {},
                ),
            );
            if (row.firstDate) {
                const startdatestr = row.firstDate.toLocaleDateString([], {
                    dateStyle: 'short',
                });
                const enddatestr = row.lastDate.toLocaleDateString([], {
                    dateStyle: 'short',
                });
                return html`${startstr} &mdash; ${endstr}<br /><span class="smaller-text"
                        >${startdatestr} &mdash; ${enddatestr}</span
                    >`;
            }
            return html`${startstr} &mdash; ${endstr}`;
        } else if (col === 'tag') {
            return (
                '<div style="line-height: 28px">' +
                (row[col].match(/[^,]+/g) || [])
                    .map(
                        t =>
                            html`<span class="table-pill table-pill__color delete-on-hover"
                                >${t}</span
                            > `,
                    )
                    .join('') +
                '<button class="table-pill table-pill__color" style="cursor: pointer"><i class="fa-solid fa-plus"></button></div>'
            );
        }
        return sanitizeText(row[col]);
    }

    formatCellCSV(col, row) {
        if (col === 'starttimestamp') {
            const start = new Date(+row[col]);
            const end = new Date(+row['endtimestamp']);
            return (
                start
                    .toLocaleString([], { timeStyle: 'short', dateStyle: 'short' })
                    .replaceAll(',', ';') +
                ',' +
                end
                    .toLocaleString([], { timeStyle: 'short', dateStyle: 'short' })
                    .replaceAll(',', ';')
            );
        } else if (col === 'tag') {
            return (row[col].match(/[^,]+/g) || []).map(t => t.replaceAll(',', ';')).join(';');
        } else if (col === 'repeat_id') {
            return row[col] ? row[col] : '---';
        }
        return row[col].replaceAll(',', ';');
    }
}
window.customElements.define('event-table', EventTable);

// ----------------------------------------------------------------
/** Table of stats: shows attendance counts */
class StatsTable extends Component {
    initialHTML() {
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <link rel="stylesheet" href="/styles/inputs.css">
            <data-table name="Stats" id="table">
                <div slot="top-actions">
                    <select id="filter-role" class="stylish" style="vertical-align: bottom;">
                        <option value="">Show All Roles</option>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="moderator">Moderator</option>
                        <option value="scanner">Scanner</option>
                        <option value="user">User</option>
                    </select>
                    <select id="filter-tags" class="stylish" style="vertical-align: bottom;">
                        <option value="" disabled selected>Filter by Tags</option>
                        <hr />
                        <optgroup id="available-tags" label="Select:"></optgroup>
                        <optgroup id="selected-tags" label="Deselect:"></optgroup>
                    </select>
                    <input type="date" id="start-date" class="stylish" aria-label="Show events before this date" />
                    to
                    <input type="date" id="end-date" class="stylish" aria-label="Show events after this date" />
                </div>
                <div slot="bottom-actions">
                    <label style="display: inline-flex; align-items: center; vertical-align: middle">
                        Show user info:&nbsp;<div class="checkbox-wrapper-6"><input id="show-columns" type="checkbox" class="tgl tgl-light" /><div class="tgl-btn"></div></div>
                    </label>
                    <button id="export-csv" class="button">
                        <i class="fa-solid fa-file-export"></i>&nbsp;Export CSV
                    </button>
                </div>
            </data-table>
            <p style="text-align: left; padding: 1em; max-width: var(--max-width); margin: auto">
                <strong>NOTE</strong>: the total might be greater than the sum of the status counts if the date range includes future events that don't have attendance status yet. It might also be less than the sum of the columns if some of the future events have an attendance status (e.g. a member reported an anticipated absence).
            </p>
        `;
    }

    async update() {
        // parse tags (and filter out any invalid tags from the url)
        const { tags, validSelectedTags } = await fetchTags();
        const tagFilter = this.shadowRoot.getElementById('filter-tags');
        const availableTagsEl = this.shadowRoot.getElementById('available-tags');
        const selectedTagsEl = this.shadowRoot.getElementById('selected-tags');
        filterTags([], tags, availableTagsEl, selectedTagsEl, tagFilter);

        // start and end date
        const startDate = this.shadowRoot.getElementById('start-date');
        const endDate = this.shadowRoot.getElementById('end-date');
        const starttimestamp = new Date(startDate.value + 'T00:00').getTime();
        const endtimestamp = new Date(endDate.value + 'T23:59').getTime();

        // load data
        const cells = await GET(
            `/businesses/${getBusinessId()}/attendance/statuscounts?tag=${validSelectedTags}&starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}`,
        ).then(res => res.json());
        const userInfo = new Map();
        for (const cell of cells) {
            if (!userInfo.has(cell.id)) {
                userInfo.set(cell.id, {
                    id: cell.id,
                    name: cell.name,
                    email: cell.email,
                    role: cell.role,
                    custom_data: cell.custom_data,
                    PRESENT: 0,
                    LATE: 0,
                    EXCUSED: 0,
                    ABSENT: cell.past_count, // default is absent for past events
                    FUTURE: cell.total_count - cell.past_count,
                    TOTAL: cell.total_count,
                });
            } else {
                if (['PRESENT', 'LATE', 'EXCUSED'].includes(cell.status)) {
                    userInfo.get(cell.id)[cell.status] = cell.count;
                    userInfo.get(cell.id).ABSENT -= cell.count;
                }
            }
        }
        this.users = [...userInfo.values()];
        const columns = mergeCustomData(this.users)[0];
        // put the counts at the end
        this.countColumns = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT', 'FUTURE', 'TOTAL'];
        columns.splice(columns.indexOf(this.countColumns[0]), this.countColumns.length);
        this.dataColumns = columns;

        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');
        table.update(
            ['name', ...this.countColumns],
            this.users,
            undefined,
            [],
            undefined,
            undefined,
            [],
            ['name'],
        );
        this.filterRole();
    }

    connectedCallback() {
        updateOnGroupChange.push(this);
        this.update();

        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');

        // setup actions
        // download the stats data as a csv file:
        this.shadowRoot.getElementById('export-csv').onclick = () => {
            table.download('stats.csv');
        };
        // show/hide the data columns in the table:
        const showColumns = this.shadowRoot.getElementById('show-columns');
        showColumns.onchange = () => {
            table.update(
                showColumns.checked
                    ? [...this.dataColumns, ...this.countColumns]
                    : ['name', ...this.countColumns],
            );
        };
        // date range filter
        const startDate = this.shadowRoot.getElementById('start-date');
        const endDate = this.shadowRoot.getElementById('end-date');
        const [setstart, setend] = initEventRange(startDate, endDate);

        startDate.onchange = endDate.onchange = () => {
            setstart(startDate.value);
            setend(endDate.value);
            this.update();
        };
        // tag filter
        const tagFilter = this.shadowRoot.getElementById('filter-tags');
        tagFilter.onchange = () => {
            toggleTag(tagFilter.value);
            this.update();
        };
        // role filter
        const roleFilter = this.shadowRoot.getElementById('filter-role');
        roleFilter.onchange = () => {
            useURL('role', '').set(roleFilter.value);
            this.filterRole();
        };
    }

    filterRole() {
        /** @type {DataTable} */
        const table = this.shadowRoot.getElementById('table');
        const roleFilter = this.shadowRoot.getElementById('filter-role');
        const role = useURL('role', '').get();
        if (role) {
            table.update(
                undefined,
                this.users.filter(u => u.role === role),
            );
        } else {
            table.update(undefined, this.users);
        }
        roleFilter.value = role;
    }
}
window.customElements.define('stats-table', StatsTable);

// ================== Utility Functions ==================
/** Unwraps the values in the custom_data field, returns the full column set */
function mergeCustomData(users) {
    const columns = Object.keys(users[0]).filter(col => !['custom_data', 'id'].includes(col));
    const customColumns = [];
    for (const user of users) {
        user.custom_data = JSON.parse(user.custom_data);
        for (const col of Object.keys(user.custom_data)) {
            if (!columns.includes(col)) {
                columns.push(col);
                customColumns.push(col);
            }
        }
        Object.assign(user, user.custom_data);
        for (const key of columns) {
            user[key] = typeof user[key] === 'string' ? sanitizeText(user[key]) : user[key];
        }
    }
    return [columns, customColumns];
}

/** Adds a QR code column to the users data */
function addQRCodeColumn(users, columns) {
    for (const user of users) {
        user.qr = html`<i
            aria-label="Show QR Code"
            role="button" tabindex="0"
            class="fa-solid fa-qrcode"
            style="cursor: pointer"
            onclick="this.firstChild.open ? this.firstChild.close() : this.firstChild.showModal(); !this.firstChild.firstChild.children?.length ? new window.QRCode(this.firstChild.firstChild, '${user.id}') : '';"
            ><dialog style="margin: auto; padding: 1em; border: 8px ridge var(--accent); min-width: fit-content; outline: none"><div></div></dialog
        ></i>`; // prettier-ignore
    }
    return [columns[0], 'qr', ...columns.slice(1)];
}

/** Opens a print dialog with the QR codes well aligned for printing */
function printQrCodes(users) {
    let codes = '';
    const div = document.createElement('div');
    for (const user of users) {
        const qr = new window.QRCode(div, user.id);
        const src = qr._oDrawing._elCanvas.toDataURL();
        codes += html`<span
            style="display: flex; flex-direction: column; width: min-content; height: min-content; margin: 0.2in;"
        >
            <img src="${src}" style="width: 2in;" />
            <br />
            ${user.name} (${user.email})
        </span>`;
    }
    print(codes);
}

/** Shows the member invitation modal with email invites, copy joinlink, and joinlink QR code */
async function showInviteModal() {
    const joincode = await GET('/businesses/' + getBusinessId() + '/joincode')
        .then(res => res.json())
        .then(data => data.joincode);
    const joinlink =
        window.location.origin + '/groups.html?id=' + getBusinessId() + '&code=' + joincode;
    const joinqr = document.createElement('div');
    joinqr.classList.add('img');
    new window.QRCode(joinqr, joinlink);

    const p = document.createElement('p');
    p.textContent = 'Have others scan the qr code, copy the';

    const copyButton = document.createElement('button');
    copyButton.classList.add('button');
    copyButton.textContent = 'Join Link';
    copyButton.style.verticalAlign = 'middle';
    copyButton.onfocus = () => {
        // focus event prevents permission issues with clipboard
        window.navigator.clipboard.writeText(joinlink);
        copyButton.classList.add('success');
        document.activeElement.blur();
        setTimeout(() => {
            copyButton.classList.remove('success');
        }, 5000);
    };
    p.appendChild(copyButton);

    const resetButton = document.createElement('button');
    resetButton.classList.add('button', 'delete');
    resetButton.textContent = 'Reset Joincode';
    resetButton.onclick = async () => {
        if (
            await Popup.confirm(
                'Are you sure you want to reset the joincode? This will invalidate any pending invites.',
            )
        ) {
            await PATCH('/businesses/' + getBusinessId() + '/joincode');
            const joincode = await GET('/businesses/' + getBusinessId() + '/joincode')
                .then(res => res.json())
                .then(data => data.joincode);
            const joinlink =
                window.location.origin + '/groups.html?id=' + getBusinessId() + '&code=' + joincode;
            joinqr.innerHTML = '';
            new window.QRCode(joinqr, joinlink);
        }
    };
    p.appendChild(resetButton);

    const emails = await Popup.prompt(
        'or enter comma separated email addresses to invite yourself:',
        joinqr,
        p,
    );
    if (!emails) return;
    const credential = await requestGoogleCredential([
        'https://www.googleapis.com/auth/gmail.send',
    ]);
    let success = true;
    for (const email of emails.split(',')) {
        const res = await sendGmail(
            email.trim(),
            'Attendance Scanner Invitation',
            `
            Hi!

            You have been invited to join my group on Attendance Scanner QR.

            Please click this link to join: ${joinlink}.

            Best,
            ${sanitizeText(credential.name)}
            (automatically sent via Attendance Scanner QR)
            `
                .trim()
                .split('\n')
                .map(l => l.trim())
                .join('\n'),
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
}

/** Prompts for confirmation and then kicks the provided users */
async function kickUsers(users) {
    if (
        await Popup.confirm(
            'Are you sure you want to kick the selected members? Data will be preserved but not viewable unless they rejoin.',
        )
    ) {
        for (const row of users) {
            if (row.role === 'owner') {
                await Popup.alert(
                    'Skipping the owner of the business. You cannot kick the owner.',
                    'var(--warning)',
                );
                continue;
            }
            await DELETE(`/businesses/${getBusinessId()}/members/${row.id}`);
        }
    }
}

/** Changes the role of the provided users to newRole, warning about changing to/from owner role as that is not allowed */
async function changeRoles(users, newRole) {
    if (!['user', 'admin', 'scanner', 'moderator'].includes(newRole)) return;
    for (const user of users) {
        if (user.role === 'owner') {
            await Popup.alert(
                'Skipping the owner of the business. You cannot change the owner role.',
                'var(--warning)',
            );
            continue;
        }
        await PUT(`/businesses/${getBusinessId()}/members/${user.id}/role?new=${newRole}`);
    }
}

/** Imports custom data from a csv file, allowing the user to select a merge column and whether to overwrite existing data */
async function importCustomData() {
    const popup = new Popup();

    popup.innerHTML = html`
        <h2 style="margin-bottom: 0.5em">Import Custom Data</h2>
        <p>Click to browse or drag in any csv file:</p>
        <label
            id="drop-area"
            style="padding: 1em; border: 2px dashed var(--secondary); display: block; margin: 1em;"
        >
            <i
                id="file-icon"
                class="fa-solid fa-file-csv"
                style="color: var(--secondary); font-size: 2em"
            ></i>
            <input id="file" type="file" accept=".csv" style="display: none" />
        </label>
        <select id="merge-col" class="themify" style="margin-bottom: 1em">
            <option disabled selected>
                Select Merge Column (must also be in your uploaded csv)
            </option>
            <option value="name">Name</option>
            <option value="email">Email</option>
        </select>
        <label style="display: flex; justify-content: space-evenly; align-items: center">
            Overwrite all existing custom data:
            <div class="checkbox-wrapper-6">
                <input id="overwrite" type="checkbox" class="tgl tgl-light" />
                <div class="tgl-btn"></div>
            </div>
        </label>
        <button id="submit" class="button">Import</button>
    `;

    const fileInput = popup.querySelector('#file');
    fileInput.onchange = () => {
        popup.querySelector('#file-icon').classList.replace('fa-file-csv', 'fa-check');
    };
    popup.querySelector('#drop-area').ondragover = e => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    };
    popup.querySelector('#drop-area').ondrop = e => {
        e.preventDefault();
        e.stopPropagation();
        const fileInput = popup.querySelector('#file');
        fileInput.files = e.dataTransfer.files;
        fileInput.onchange();
    };

    const mergeColInput = popup.querySelector('#merge-col');
    const overwriteInput = popup.querySelector('#overwrite');
    popup.querySelector('#submit').onclick = async () => {
        const file = fileInput.files[0];
        const mergeCol = mergeColInput.value;
        const overwrite = overwriteInput.checked;
        if (!file) {
            Popup.alert('Please select a file first.', 'var(--warning)');
            return;
        }
        const data = await file.text();
        await POST(`/businesses/${getBusinessId()}/customdata`, {
            data: data,
            mergeCol: mergeCol,
            overwrite: overwrite,
        });
        popup.close();
    };
    document.body.appendChild(popup);
    return await popup.willClose();
}

/** Loads the attendance data as an array of user objects with event_ids as fields */
async function loadAttendanceData() {
    const records = await GET(`/businesses/${getBusinessId()}/attendance`).then(res => res.json());
    const events = await GET(`/businesses/${getBusinessId()}/events`).then(res => res.json());
    const sortedEvents = events
        .sort((a, b) => a.starttimestamp - b.starttimestamp)
        .map(e => {
            return {
                ...e,
                tag: e.tag
                    ?.split(',')
                    .filter(t => t && t.length)
                    .map(sanitizeText),
            };
        });
    const tags = new Set(sortedEvents.map(e => e.tag).flat());

    const statusColor = {
        PRESENT: 'green',
        LATE: 'orange',
        EXCUSED: 'blue',
        ABSENT: 'red',
        'N/A': 'lightgray',
    };
    const userInfo = new Map();
    for (const record of records) {
        if (!userInfo.has(record.id)) {
            const userinfo = {
                id: sanitizeText(record.id),
                name: sanitizeText(record.name),
                email: sanitizeText(record.email),
                role: sanitizeText(record.role),
                custom_data: record.custom_data,
            };
            for (const event of sortedEvents) {
                userinfo[event.id] = [event.endtimestamp < Date.now() ? 'ABSENT' : 'N/A', null];
            }
            userInfo.set(record.id, userinfo);
        } else {
            userInfo.get(record.id)[record.event_id] = [
                record.status,
                new Date(+record.timestamp).toLocaleString([], {
                    timeStyle: 'short',
                    dateStyle: 'short',
                }),
            ];
        }
    }
    const users = [...userInfo.values()];
    const columns = mergeCustomData(users)[0];

    function formatHeader(col) {
        const event = sortedEvents.find(e => e.id === col);
        if (!event) return col.toString().toUpperCase();
        return html`${event.name.toUpperCase()}<br /><span class="smaller-text"
                >${new Date(+event.starttimestamp).toLocaleDateString()}</span
            >`;
    }

    function formatCell(col, row) {
        const event = sortedEvents.find(e => e.id === col);
        if (!event) return row[col];
        const [status, datetimestring] = row[col];
        const display = datetimestring
            ? html`
                  <span
                      style="color: ${statusColor[status] ??
                      'red'}; border-bottom: 2px dashed ${statusColor[status] ?? 'red'}"
                      >${status}</span
                  >
                  <br />
                  <span class="smaller-text" style="white-space: nowrap">${datetimestring}</span>
              `
            : html`
                  <span
                      style="color: ${statusColor[status] ??
                      'red'}; border-bottom: 2px dashed ${statusColor[status] ?? 'red'}"
                      >${status}</span
                  >
              `;
        const statusOptions = Object.keys(statusColor);
        const curIx = statusOptions.indexOf(status);
        if (curIx !== -1) {
            statusOptions.splice(curIx, 1);
        }
        return /* html */ `
            <label style="position: relative">
                ${display}
                <select class="table-dropdown">
                    <option value="${sanitizeText(status)}" selected disabled>${sanitizeText(
                        status,
                    )}</option>
                    ${statusOptions.map(s => html`<option value="${s}">${s}</option>`)}
                </select>
            </label>
        `;
    }

    return [columns, users, formatHeader, formatCell, sortedEvents, [...tags]];
}

/** Changes the status of the provided users to newStatus for the provided events */
async function changeStatuses(users, eventIds, newStatus, askForConfirmation = true) {
    const confirm =
        !askForConfirmation ||
        (await Popup.confirm(
            `Are you sure you want to change the status of ${users
                .map(u => u.name)
                .join(', ')} to ${newStatus} for all selected events?`,
        ));
    if (confirm) {
        for (const eventId of eventIds) {
            await PATCH(
                `/businesses/${getBusinessId()}/events/${eventId}/attendance?ids=${users
                    .map(u => u.id)
                    .join(',')}&status=${newStatus}`,
            );
        }
    }
}

/** Initializes the start and end date inputs for filtering events */
function initEventRange(startDate, endDate) {
    const { start, set: setstart } = useURL('start');
    const firstDayOfTheYear = new Date(new Date().getFullYear(), 0, 1);
    startDate.value = start || firstDayOfTheYear.toISOString().split('T')[0];

    const { end, set: setend } = useURL('end');
    const lastDayOfTheYear = new Date(new Date().getFullYear(), 11, 31);
    endDate.value = end || lastDayOfTheYear.toISOString().split('T')[0];

    return [setstart, setend];
}

/** Filters the events to only those that are within the start and end date */
function filterInterval(events, start, end) {
    return events.filter(
        e =>
            e.starttimestamp >= new Date(start + 'T00:00').getTime() &&
            e.endtimestamp <= new Date(end + 'T23:59').getTime(),
    );
}

/** Filters the events to only contain the selected tags from the url and updates the ui elements appropriately */
function filterTags(events, tags, availableTags, selectedTags, tagFilter) {
    const selected = useURL('tags', '').get().match(/[^,]+/g) || [];
    availableTags.innerHTML = '';
    selectedTags.innerHTML = '';
    for (const tag of tags) {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        if (!selected.includes(tag)) {
            availableTags.appendChild(option);
        } else {
            selectedTags.appendChild(option);
        }
    }

    tagFilter.value = '';
    if (!selected.length) {
        tagFilter.firstElementChild.textContent = 'Filter by Tags';
        return events;
    } else {
        tagFilter.firstElementChild.textContent = selected.join(', ');
        return events.filter(e => selected.every(t => e.tag.includes(t)));
    }
}

/** toggles whether the given tag is selected */
function toggleTag(tag) {
    const tags = useURL('tags', '').get().match(/[^,]+/g) || [];
    if (tags.includes(tag)) {
        tags.splice(tags.indexOf(tag), 1);
    } else {
        tags.push(tag);
    }
    useURL('tags', '').set(tags.join(','));
}

/** Fetches the tags of the current business, removes any invalid selected tags from the url, and returns the valid selected tags */
async function fetchTags() {
    const res = await GET(`/businesses/${getBusinessId()}/eventtags`);
    const data = await res.json();
    const tags = new Set(
        data
            .map(t =>
                sanitizeText(t.tag)
                    .split(',')
                    .filter(t => t.length),
            )
            .flat(),
    );
    const selectedTags = useURL('tags', '').get().match(/[^,]+/g) || [];
    const validSelectedTags = selectedTags.filter(t => tags.has(t)).join(',');
    useURL('tags', '').set(validSelectedTags);
    return { tags, validSelectedTags };
}

/** Groups events into objects by repeat id */
function collapseEvents(events) {
    return Object.entries(Object.groupBy(events, e => e.repeat_id))
        .map(([id, group]) => {
            if (id === 'null') return Object.values(group).map(e => ({ ...e, num_repeats: 1 }));
            const nearestUpcoming = structuredClone(
                group.reduce((a, b) =>
                    a.starttimestamp < b.starttimestamp && a.starttimestamp > Date.now() ? a : b,
                ),
            );
            nearestUpcoming.num_repeats = group.length;
            nearestUpcoming.firstDate = new Date(+group[0].starttimestamp);
            nearestUpcoming.lastDate = new Date(+group[group.length - 1].endtimestamp);
            return [nearestUpcoming];
        })
        .flat();
}

/** Prompts the user to change the start and end of an event. Resolves to the new event info or null if the user cancels. */
async function promptForNewDates(event, editMode = 'events') {
    const timezoneOffsetMS = new Date().getTimezoneOffset() * 60000; // datetime inputs only work in local time
    const start = new Date(event.starttimestamp - timezoneOffsetMS);
    const end = new Date(event.endtimestamp - timezoneOffsetMS);
    const popup = new Popup();
    popup.innerHTML = html`
        <h1>Edit the time of ${event.name}</h1>
        <label>
            From
            <input
                type="datetime-local"
                id="start"
                class="stylish"
                value="${start.toISOString().slice(0, -8)}"
            />
        </label>
        <label>
            to
            <input
                type="datetime-local"
                id="end"
                class="stylish"
                value="${end.toISOString().slice(0, -8)}"
            />
        </label>
        <button id="submit" class="button">Submit</button><br />
        ${editMode !== 'events'
            ? 'NOTE: relative changes to the current event will be applied to ' +
              editMode.replace('events', ' events') +
              ' from the same repeat sequence.'
            : 'NOTE: changes will only apply to this event from the repeat sequence.'}
    `;
    document.body.appendChild(popup);
    const startInput = popup.querySelector('#start');
    const endInput = popup.querySelector('#end');
    const submit = popup.querySelector('#submit');
    let dateinfo = null;
    submit.onclick = () => {
        const newStart = new Date(startInput.valueAsNumber + timezoneOffsetMS);
        const newEnd = new Date(endInput.valueAsNumber + timezoneOffsetMS);
        dateinfo = {
            starttimestamp: newStart.getTime(),
            endtimestamp: newEnd.getTime(),
            starttimedelta: newStart.getTime() - event.starttimestamp,
            endtimedelta: newEnd.getTime() - event.endtimestamp,
        };
        popup.close();
    };
    await popup.willClose();
    return dateinfo;
}

/** Prompts the user for new event information and creates new events */
async function createNewEvent() {
    const timezoneOffsetMS = new Date().getTimezoneOffset() * 60000; // datetime inputs only work in local time
    const popup = new Popup();
    popup.innerHTML = html`
        <h1 style="margin-bottom: 10px">Add a New Event</h1>
        <label>
            Name<br />
            <input type="text" id="name" class="stylish" style="width: 100%; margin-bottom: 10px" />
        </label>
        <br />
        <label>
            Description<br />
            <textarea
                id="description"
                class="stylish"
                style="width: 100%; margin-bottom: 10px"
            ></textarea>
        </label>
        <br />
        <label>
            From
            <input
                type="datetime-local"
                id="start"
                class="stylish"
                value="${new Date(Date.now() - timezoneOffsetMS).toISOString().slice(0, -8)}"
            />
        </label>
        <label>
            to
            <input
                type="datetime-local"
                id="end"
                class="stylish"
                style="margin-bottom: 10px"
                value="${new Date(Date.now() + 3600000 - timezoneOffsetMS)
                    .toISOString()
                    .slice(0, -8)}"
            />
        </label>
        <br />
        <label>
            Comma Separated Tags<br />
            <input type="text" id="tag" class="stylish" style="width: 100%; margin-bottom: 10px" />
        </label>
        <br />
        <select id="repeat" class="stylish" style="margin-bottom: 10px">
            <option value="">No Repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
        </select>
        <input
            type="number"
            id="interval"
            class="stylish"
            value="1"
            style="margin-bottom: 10px"
            disabled
        />
        <div id="daysoftheweek" class="weekdays-selector" style="margin-bottom: 10px">
            <input type="checkbox" id="sunday" name="sunday" value="0" disabled />
            <label for="sunday" style="padding: 0">S</label>
            <input type="checkbox" id="monday" name="monday" value="1" disabled />
            <label for="monday" style="padding: 0">M</label>
            <input type="checkbox" id="tuesday" name="tuesday" value="2" disabled />
            <label for="tuesday" style="padding: 0">T</label>
            <input type="checkbox" id="wednesday" name="wednesday" value="3" disabled />
            <label for="wednesday" style="padding: 0">W</label>
            <input type="checkbox" id="thursday" name="thursday" value="4" disabled />
            <label for="thursday" style="padding: 0">T</label>
            <input type="checkbox" id="friday" name="friday" value="5" disabled />
            <label for="friday" style="padding: 0">F</label>
            <input type="checkbox" id="saturday" name="saturday" value="6" disabled />
            <label for="saturday" style="padding: 0">S</label>
        </div>
        <button id="submit" class="button">Submit</button>
    `;
    document.body.appendChild(popup);
    const name = popup.querySelector('#name');
    const description = popup.querySelector('#description');
    const startInput = popup.querySelector('#start');
    const endInput = popup.querySelector('#end');
    const submit = popup.querySelector('#submit');
    const tags = popup.querySelector('#tag');
    const unit = popup.querySelector('#repeat');
    const interval = popup.querySelector('#interval');
    const weekdaySelector = popup.querySelector('.weekdays-selector');
    const weekdays = weekdaySelector.querySelectorAll('input');
    unit.onchange = e => {
        interval.disabled = e.target.value === '';
        weekdays.forEach(d => (d.disabled = e.target.value !== '7'));
    };
    let event = null;
    submit.onclick = () => {
        const start = new Date(startInput.valueAsNumber + timezoneOffsetMS);
        const end = new Date(endInput.valueAsNumber + timezoneOffsetMS);
        event = {
            name: name.value,
            description: description.value,
            starttimestamp: start.getTime(),
            endtimestamp: end.getTime(),
            tag: ',' + tags.value + ',',
            frequency: unit.value,
            interval: interval.value,
            daysoftheweek: [...weekdays].filter(d => d.checked).map(d => d.value),
            timezoneOffsetMS: timezoneOffsetMS,
        };
        popup.close();
    };
    await popup.willClose();
    if (!event) return null;
    await POST(
        `/businesses/${getBusinessId()}/events${event.frequency !== '' ? '/recurring' : ''}`,
        event,
    );
    return event;
}
