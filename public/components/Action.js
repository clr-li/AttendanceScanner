import { Component } from "../util/Component.js";
import { sanitizeText } from "../util/util.js";

 export class ActionIcon extends Component {
    constructor() {
        super(false);
    }
    initialHTML() {
        const actionName = sanitizeText(this.getAttribute('name')) ?? "Action Name";
        const actionIcon = sanitizeText(this.getAttribute('icon') ?? "fa-solid fa-users");
        const link = sanitizeText(this.getAttribute('link') ?? "payment.html");
        const description = sanitizeText(this.getAttribute('description') ?? "Description");
        return /* html */`
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/tables.css">
            <div role="link" class="cols" style="margin-bottom: 16px; cursor: pointer; width: 190px;">
                <i class="${actionIcon} actions" onclick="location.assign('${link}')"></i>
                    <h3>${actionName}
                        <span style="position: relative;">
                            <i id="info-btn" class="fa-solid fa-circle-info smaller-text"></i>
                            <dialog id="info-dialog" class="action-info">${description}</dialog>
                        </span>
                    </h3>
            </div>
            <style>${CSS}</style>
        `;
    }
    
    /**
     * Called when this component is attached to the DOM. Has access to attributes and properties of this component and can be used to attach event listeners.
     */
    connectedCallback() {
        const infoBtn = this.shadowRoot.getElementById('info-btn');
        const actionInfo = this.shadowRoot.getElementById('info-dialog');
        infoBtn.addEventListener('click', () => {
            console.log(actionInfo.open);
            actionInfo.show();
        });
        document.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() !== 'action-icon') {
                actionInfo.close();
            }
        });
        actionInfo.addEventListener('click', (e) => {
            actionInfo.close();
        });
    }
    /**
     * Called when this component is removed from the DOM. Should be used to clean up resources such as event listeners.
     */
    disconnectedCallback() {
        // TODO: remove event listeners
    }
}

const CSS = /* css */`
.actions {
    font-size: 80px;
    color: var(--accent);
    border: 3px solid black;
    border-radius: 8px;
    padding: 5px;
    background-color: whitesmoke;
    min-width: 125px;
}

.actions:hover {
    color: var(--primary);
    background-color: var(--accent-lighter);
}

.action-info {
    width: 150px;
    border-radius: 6px;
    padding: 8px;
    position: absolute;
    z-index: 5;
    margin-left: -900%;
    margin-top: 35%;
    border: none;
    border-left: 10px solid var(--secondary);
    color: white;
    background-color: var(--dark-background);
    font-size: 0.8em;
}

.action-info:focus {
    outline: none;
}

.action-info::after {
    content: "";
    position: absolute;
    bottom: 100%;
    left: 78%;
    margin-left: -7px;
    border-width: 10px;
    border-style: solid;
    border-color: transparent transparent var(--dark-background) transparent;
}
`;

window.customElements.define('action-icon', ActionIcon); // define custom <action-icon> tag, name must be lowercase and have one hyphen