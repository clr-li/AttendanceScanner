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
            <link rel="stylesheet" href="/font-alexesome/icon.css">
            <div class="cols" style="margin-bottom: 16px; width: 190px;">
                <div role="link" class="actions" onclick="location.assign('${link}')">
                    <i class="${actionIcon}"></i>
                </div>
                
                <h3>${actionName}
                    <span style="position: relative;">
                        <i role="button" id="info-btn" class="fa-solid fa-circle-info smaller-text"></i>
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
h3 {
    white-space: nowrap;
}

.cols {
    margin: auto;
    text-align: center;
}

#info-btn {
    cursor: pointer;
}

.actions {
    font-size: 80px;
    color: var(--accent);
    border-radius: 15px;
    cursor: pointer;
    width: 120px;
    padding: 20px;
    aspect-ratio: 1/1;
    box-shadow: rgba(45, 35, 66, .4) 0 2px 4px, rgba(45, 35, 66, .3) 0 7px 13px -3px, rgba(58, 65, 111, .5) 0 -3px 0 inset;
    margin-bottom: 8px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    transition: transform .15s;
    background-color: var(--secondary);
}

.actions > i {
    background-image: radial-gradient(100% 100% at 100% 0, #5adaff 0, #5468ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    -webkit-text-stroke: 3px var(--accent);
}

.actions:hover:not(:active) {
    box-shadow: rgba(45, 35, 66, .4) 0 4px 8px, rgba(45, 35, 66, .3) 0 7px 13px -3px, rgba(58, 65, 111, .5) 0 -3px 0 inset;
    transform: translateY(-2px);
}

.actions:active {
    transform: translateY(2px);
}

.action-info {
    white-space: normal;
    width: 150px;
    border-radius: 6px;
    padding: 8px;
    position: absolute;
    z-index: 5;
    margin-left: -900%;
    margin-top: 35%;
    border: none;
    border-left: 10px solid var(--primary);
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