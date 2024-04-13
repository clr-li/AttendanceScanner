import { Component } from '../util/Component.js';

/**
 * A table component with pagination, sorting and selection.
 * @slot top-actions - Actions to show above the table
 * @slot bottom-actions - Actions to show below the table
 * @slot selection-actions - Actions to show when rows are selected
 * @fires edit - when a cell is edited
 * @fires table-[inputEvent] - when an input event is triggered on a cell assuming the inputEvent has been registered in an update() call
 * @requires fontawesome
 */
export class DataTable extends Component {
    constructor() {
        super(false);
    }

    initialHTML() {
        this.name = this.getAttribute('name');
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <link rel="stylesheet" href="/styles/tables.css">
            <div id="table-wrapper" class="table-wrapper">
                <div class="table-action-bar">
                    <h1 id="name" class="name">${this.name}</h1>
                    <slot name="top-actions">
                </div>
                <table id="table"></table>
                <div class="table-action-bar">
                    <div class="table-paginator">
                    <button id="prev-page" class="button" aria-label="Previous Page" disabled><i class="fa-solid fa-chevron-left"></i></button>
                        <input id="page" type="number" value="1" min="1" aria-label="Page Number">
                        <select id="rows-per-page" aria-label="Rows per Page">
                            <option value="4">4 / page</option>
                            <option value="10">10 / page</option>
                            <option value="20">20 / page</option>
                            <option value="50">50 / page</option>
                            <option value="100">100 / page</option>
                        </select>
                        <button id="next-page" class="button" aria-label="Next Page"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <slot name="bottom-actions">
                </div>
            </div>
        `;
    }

    /**
     * Render the table with the given columns and rows
     * @param {string[]} columns the column names (keys in the rows)
     * @param {Object[]} rows object with keys matching the columns
     * @param {string[]} [nonSortableColumns] columns that should not be sortable
     * @param {string[]} [editableColumns] columns that should be editable
     * @param {(col: string) => string} [formatHeader] function to format the header text
     * @param {(col: string, row: any) => string} [formatCell] function to format the cell text
     * @param {string[]} [inputEvents] events to listen for on each cell. They are repropagated as custom events with 'table-' prefixed names and row+column information
     * @returns {void}
     */
    update(
        columns,
        rows,
        nonSortableColumns = undefined,
        editableColumns = undefined,
        formatHeader = undefined,
        formatCell = undefined,
        inputEvents = undefined,
    ) {
        this.rows = rows ?? this.rows ?? [];
        this.columns = columns ?? this.columns ?? [];
        this.nonSortableColumns = nonSortableColumns ?? this.nonSortableColumns ?? [];
        this.editableColumns = editableColumns ?? this.editableColumns ?? [];
        this.formatHeader = formatHeader ?? this.formatHeader ?? (col => col.toUpperCase());
        this.formatCell = formatCell ?? this.formatCell ?? ((col, row) => row[col]);
        this.inputEvents = inputEvents ?? this.inputEvents ?? [];

        // Table and header
        const table = document.createElement('table');
        table.id = 'table';

        const header = document.createElement('tr');
        header.innerHTML = '<th><input type="checkbox"></th>';
        for (const [i, col] of Object.entries(this.columns)) {
            if (this.nonSortableColumns.includes(col)) {
                header.innerHTML += `<th>${this.formatHeader(col)}</th>`;
            } else {
                header.innerHTML += `<th data-colIx="${i}">
                ${this.formatHeader(col)}&nbsp;<i class="fa-solid fa-sort"></i>
            </th>`;
            }
        }
        // handle column sorting
        header.onclick = e => {
            const th = e.target.closest('th');
            const icon = th.querySelector('i');
            if (!icon) return;
            icon.classList.remove('fa-sort');
            if (icon.classList.contains('fa-sort-up')) {
                icon.classList.replace('fa-sort-up', 'fa-sort-down');
                this.sort(this.columns[th.dataset.colix], false);
            } else {
                icon.classList.add('fa-sort-up');
                icon.classList.remove('fa-sort-down');
                this.sort(this.columns[th.dataset.colix], true);
            }

            const icons = table.querySelectorAll('i');
            for (const otherIcon of icons) {
                if (otherIcon === icon) continue;
                otherIcon.classList.replace('fa-sort-up', 'fa-sort');
                otherIcon.classList.replace('fa-sort-down', 'fa-sort');
            }
        };
        // handle selecting all rows
        header.oninput = e => {
            for (const row of table.querySelectorAll('tr')) {
                row.querySelector('input').checked = e.target.checked;
            }
        };
        table.appendChild(header);

        // insert the table into the shadow DOM
        this.shadowRoot.getElementById('table').replaceWith(table);

        // Table name, row count and selection actions
        const name = this.shadowRoot.getElementById('name');
        name.innerHTML = `${this.name} <span class="table-pill">${this.rows.length}</span>`;
        table.oninput = () => {
            const selection = this.getSelection();
            if (selection.length !== 0) {
                name.innerHTML = `${this.name} <span class="table-pill">${selection.length}/${this.rows.length}</span> <slot name="selection-actions">`;
            } else {
                name.innerHTML = `${this.name} <span class="table-pill">${this.rows.length}</span>`;
            }
        };

        // Pagination
        const page = this.shadowRoot.getElementById('page');
        page.onchange = () => {
            this.showPage(page.value);
        };
        this.shadowRoot.getElementById('prev-page').onclick = () => {
            this.showPage(parseInt(page.value) - 1);
        };
        this.shadowRoot.getElementById('next-page').onclick = () => {
            this.showPage(parseInt(page.value) + 1);
        };
        this.shadowRoot.getElementById('rows-per-page').onchange = page.onchange;
        page.onchange(); // render the current rows

        // Scroll the action bars with the table
        const actionBars = this.shadowRoot
            .getElementById('table-wrapper')
            .getElementsByClassName('table-action-bar');
        const tableWrapper = this.shadowRoot.getElementById('table-wrapper');
        tableWrapper.onscroll = () => {
            const style = getComputedStyle(tableWrapper);
            for (const actionBar of actionBars) {
                actionBar.style.width =
                    tableWrapper.clientWidth -
                    2 * parseFloat(style.paddingLeft) -
                    2 * parseFloat(style.paddingRight) +
                    'px';
                const diff =
                    actionBar.clientWidth -
                    tableWrapper.clientWidth +
                    parseFloat(style.paddingLeft) * 2 +
                    parseFloat(style.paddingRight) * 2;
                const dist = tableWrapper.scrollLeft > diff ? tableWrapper.scrollLeft - diff : 0;
                actionBar.style.marginLeft = parseFloat(style.paddingLeft) + dist + 'px';
            }
        };
        tableWrapper.onscroll();
    }

    /**
     * Renders the table at the given page number
     * @param {number} page between 1 and maxPage inclusive, otherwise clamped
     */
    showPage(page) {
        // get the page number and clamp it
        const rowsPerPage = parseInt(this.shadowRoot.getElementById('rows-per-page').value);
        const maxPage = Math.max(1, Math.ceil(this.rows.length / rowsPerPage));
        page = Math.min(maxPage, Math.max(1, page));
        this.shadowRoot.getElementById('prev-page').disabled = page === 1;
        this.shadowRoot.getElementById('next-page').disabled = page === maxPage;

        const rows = this.rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const table = this.shadowRoot.getElementById('table');
        [...table.children].slice(1).forEach(row => row.remove()); // remove all rows except the header
        const rowElements = []; // we will append the rows here
        for (const [i, row] of Object.entries(rows)) {
            const rowElement = document.createElement('tr');
            rowElement.dataset.rowIx = (page - 1) * rowsPerPage + parseInt(i);
            rowElement.innerHTML = '<td><input type="checkbox"></td>';
            for (const [i, col] of Object.entries(this.columns)) {
                const formatted = this.formatCell(col, row);
                rowElement.innerHTML += `<td data-col-ix="${i}" contenteditable="${this.editableColumns.includes(
                    col,
                )}">${formatted ?? 'N/A'}</td>`;
            }
            // dispatch an edit event when a cell is typed into
            if (this.editableColumns.length) {
                for (const input of rowElement.querySelectorAll('td[contenteditable]')) {
                    input.onblur = e => {
                        const rowIx = parseInt(e.target.closest('tr').dataset.rowIx);
                        const colIx = parseInt(e.target.closest('td').dataset.colIx);
                        this.rows[rowIx][this.columns[colIx]] = e.target.textContent;
                        const editEvent = new CustomEvent('edit', {
                            detail: {
                                row: this.rows[rowIx],
                                col: this.columns[colIx],
                                value: e.target.textContent,
                                cause: e,
                            },
                        });
                        this.dispatchEvent(editEvent);
                    };
                }
            }
            // dispatch an input event when a cell input event is triggered
            // this is necessary for the input event to bubble up from the table component
            for (const inputEvent of this.inputEvents) {
                rowElement.addEventListener(inputEvent, async e => {
                    const rowIx = parseInt(e.target.closest('tr').dataset.rowIx);
                    const colIx = parseInt(e.target.closest('td').dataset.colIx);
                    const editEvent = new CustomEvent('table-' + inputEvent, {
                        detail: {
                            row: this.rows[rowIx],
                            col: this.columns[colIx],
                            value: e.target.value,
                            cause: e,
                        },
                    });
                    this.dispatchEvent(editEvent);
                });
            }
            rowElements.push(rowElement);
        }
        table.append(...rowElements);
        this.shadowRoot.getElementById('page').value = page;
    }

    /**
     * Get the selected rows
     * @returns {Object[]} the selected rows
     */
    getSelection() {
        return Array.from(this.shadowRoot.getElementById('table').querySelectorAll('input:checked'))
            .map(checkbox => checkbox.closest('tr').dataset.rowIx)
            .filter(ix => ix !== undefined)
            .map(ix => this.rows[ix]);
    }

    /**
     * Set the selection based on a condition
     * @param {(row: Object) => boolean} condition the selection condition
     */
    setSelection(condition) {
        const table = this.shadowRoot.getElementById('table');
        for (const row of table.querySelectorAll('tr')) {
            if (!row.dataset.rowIx) continue; // ignore the header row
            row.querySelector('input').checked = condition(this.rows[row.dataset.rowIx]);
        }
        table.oninput();
    }

    /**
     * Sorts the table by the given column
     * @param {number} col the name of the column to sort by
     * @param {boolean} asc true for ascending, false for descending
     */
    sort(col, asc) {
        this.rows.sort((a, b) => {
            const valA = a[col];
            const valB = b[col];
            if (!valA || valA < valB) return asc ? -1 : 1;
            if (!valB || valA > valB) return asc ? 1 : -1;
            return 0;
        });
        this.showPage(this.shadowRoot.getElementById('page').value);
    }

    /**
     * Download the table data as a CSV file
     * @param {string} [name='data.csv'] the name of the file
     * @param {string[]} [ignoreColumns=[]] columns to ignore
     * @param {(col: string) => string} [formatHeader] function to format the header text
     * @param {(col: string, val: any) => string} [formatCell] function to format the cell text
     */
    download(
        name = 'data.csv',
        ignoreColumns = [],
        formatHeader = col => col.replaceAll(',', ';'),
        formatCell = (col, row) => row[col].replaceAll(',', ';'),
    ) {
        const columns = this.columns.filter(col => !ignoreColumns.includes(col));
        const selection = this.getSelection();
        const csv = [columns.map(formatHeader).join(',')];
        for (const row of selection.length ? selection : this.rows) {
            csv.push(columns.map(col => formatCell(col, row)).join(','));
        }
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
    }
}
window.customElements.define('data-table', DataTable);
