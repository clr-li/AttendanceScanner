import { Component } from '../util/Component.js';
import { sanitizeText, getPattern, escapeQuotes } from '../util/util.js';

/**
 * The TypeSelect component allows selection of its children option tags through text search or a dropdown select.
 * @events "select" when a valid option is selected
 * @attribute label - the textContent of the label for this input
 * @attribute name - the name of the input
 * @attribute placeholder - the text to show when an empty/no value is selected
 * @attribute value - when set/changed, updates the selected value of this input
 */
export class TypeSelect extends Component {
    constructor() {
        super(false); // each instance has its own html
    }
    initialHTML() {
        const labelText = sanitizeText(this.getAttribute('label')) ?? '';
        const name = sanitizeText(this.getAttribute('name')) ?? 'selector';
        const placeholder =
            sanitizeText(this.getAttribute('placeholder')) ?? 'Type to search/Click to select';
        const value = sanitizeText(this.getAttribute('value')) ?? '';
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/inputs.css">
            <div class="form">
                <label for="select">${labelText}</label>
                <input
                    type="list" list="options" 
                    id="select" name="${name}" 
                    placeholder="${placeholder}"
                    value="${value}" pattern=""
                    style="min-width: fit-content;"
                >
            </div>
            <datalist id="options"></datalist>
            <style>
                input {
                    padding: 6px;
                    min-width: 40ch;
                    border: solid 2px;
                    border-radius: 5px;
                }
                input:invalid:not(:focus) {
                    background-color: var(--delete-lighter);
                    border-color: var(--delete);
                }
                input:valid:not(:placeholder-shown) {
                    border-color: var(--success);
                }
            </style>
        `;
    }
    static get observedAttributes() {
        return ['value'];
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'value') {
            this.shadowRoot.getElementById('select').value = newValue;
        }
    }
    /**
     * Updates the RegEx pattern of the input field to match all the available options (and empty).
     * @private
     */
    _updateRegex() {
        const values = Array.from(this.querySelectorAll('option'), elem => elem.value);
        this.shadowRoot.getElementById('select').pattern = '|' + getPattern(values);
    }
    /**
     * Called when the text selection is changed by the user. Dispatches a "select" event if a valid option has been selected.
     * @param {Event} e the change event
     * @private
     */
    _onChange(e) {
        if (e.target.validity.patternMismatch) return;
        const event = new CustomEvent('select', {
            detail: !e.target.value
                ? null
                : this.querySelector(`option[value="${escapeQuotes(e.target.value)}"]`),
        });
        this.dispatchEvent(event);
    }
    connectedCallback() {
        // initialize datalist with this.childNodes
        setTimeout(() => {
            // wait for end of event loop when innitialHTML has been parsed by dom
            this.shadowRoot
                .getElementById('options')
                .append(...Array.from(this.childNodes, elem => elem.cloneNode(true)));
            this._updateRegex();
        });

        // updates datalist of this node when this.childNodes change
        this.observer = new MutationObserver((mutationsRecords, observer) => {
            for (const mutationRecord of mutationsRecords) {
                for (const nodeToRemove of mutationRecord.removedNodes) {
                    this.shadowRoot
                        .querySelector('option[value="' + escapeQuotes(nodeToRemove.value) + '"]')
                        .remove();
                }
                this.shadowRoot
                    .getElementById('options')
                    .append(...Array.from(mutationRecord.addedNodes, elem => elem.cloneNode(true)));
            }
            this._updateRegex();
        });
        this.observer.observe(this, { characterData: false, childList: true, attributes: false });

        // listen to inputs
        this.shadowRoot.getElementById('select').addEventListener('change', e => this._onChange(e));
    }
    disconnectedCallback() {
        this.observer.disconnect();
        this.shadowRoot
            .getElementById('select')
            .removeEventListener('change', e => this._onChange(e));
    }
    /**
     * Creates an option element with the specified properties and appends it to this element as a child.
     * This can also be done manually with appendChild() and document.createElement().
     * @param {string} value should be unique
     * @param {string} textContent
     * @param {*} attributes
     */
    addOption(value, textContent, attributes = {}) {
        const option = document.createElement('option');
        for (const [attribute, val] of Object.entries(attributes)) {
            option.setAttribute(attribute, val);
        }
        option.value = value;
        option.textContent = textContent;
        this.appendChild(option);
    }
    /**
     * Sets the value of this input to the first option with the specified attribute.
     */
    setValue(attribute, value) {
        const option = this.querySelector(`option[${attribute}="${escapeQuotes(value)}"]`);
        if (!option) return this.shadowRoot.getElementById('select').value;
        this.setAttribute('value', option.value);
        return option.value;
    }
    /**
     * @returns the selected option of this input.
     */
    getSelected() {
        return this.querySelector(`option[value="${this.getAttribute('value')}"]`);
    }
    /**
     * @returns true if the inputted option is valid, false otherwise.
     */
    isValid() {
        return this.shadowRoot.getElementById('select').checkValidity();
    }
}
window.customElements.define('type-select', TypeSelect); // define custom <type-select> tag, name must be lowercase and have one hyphen
