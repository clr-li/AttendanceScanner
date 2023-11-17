import { Component } from "../util/Component.js";

/**
 * The Popup component represents a popup message box that blurs the background content.
 */
export class Popup extends Component {
    constructor() {
        super(false); // each instance has its own html to allow multiple popups
    }
    initialHTML() {
        const borderColor = this.getAttribute("color") ?? "var(--accent)";
        return /* html */`
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/animations.css">
            <div id="popup">
                <i class="fa fa-circle-xmark" id="cross"></i>
                <div>
                    <slot></slot>
                </div>
            </div>
            <style>
                :host {
                    position: absolute;
                    z-index: 99999;
                }

                ::slotted(p) {
                    font-size: 1.2rem;
                }

                .fa-circle-xmark {
                    cursor: pointer;
                }

                #popup {
                    position: fixed;
                    left: 0;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    margin: auto;
                    min-width: 300px;
                    width: 30%;
                    max-width: var(--max-width);
                    aspect-ratio: 1/1;
                    min-height: 300px;
                    max-height: var(--max-width);
                    background-color: white;
                    text-align: center;
                    padding: 5px;
                    border: 8px solid ${borderColor};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 10px;
                }

                :host:before {
                    content: '';
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                    position: fixed;
                    top: 0; left: 0;
                    width: 100vw;
                    height: 100vh;
                }

                i {
                    position: absolute;
                    right: 5px;
                    top: 5px;
                    font-size: 1.5rem;
                    color: var(--delete-darker);
                    aspect-ratio: 1/1;
                }
            </style>
        `;
    }
    static get observedAttributes() {
        return ['color'];
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "color") {
            this.shadowRoot.getElementById("popup").style.borderColor = newValue;
        };
    }

    /**
     * Closes this popup and removes it from the DOM.
     */
    close() {
        if (this.handleCancel) this.handleCancel();
        else this.remove();
    }

    connectedCallback() {
        this.shadowRoot.getElementById('cross').addEventListener('click', () => {
            this.close();
        });
    }

    disconnectedCallback() {
        this.shadowRoot.getElementById("cross").removeEventListener("click", () => {
            this.close();
        });
    }

    /**
     * Creates a popup with the given message and appends it to the DOM.
     * @param {string} message 
     * @param {string} color
     * @param {number} timout_ms 
     */
    static alert(message, color, timout_ms=null) {
        return new Promise((resolve, reject) => {
            const popup = document.createElement('pop-up');
            if (color) {
                popup.setAttribute('color', color);
            }
            popup.innerHTML = message;
            if (timout_ms) {
                popup.shadowRoot.getElementById('popup').style.animation = "fadeInAndOut " + timout_ms + "ms";
                setTimeout(() => {
                    popup.close();
                    resolve(false);
                }, timout_ms);
            }
            document.body.appendChild(popup);
            const handleCancel = () => {
                const crossButton = popup.shadowRoot.getElementById('cross');
                crossButton.removeEventListener('click', handleCancel);
                popup.remove();
                resolve(false);
        }});
    }

    /**
     * Creates a confirmation popup with the given message.
     * @param {string} message the message to prompt the user with.
     * @returns a Promise that resolves to true if the user clicks 'CONFIRM' and false otherwise.
     */
    static confirm(message) {
        return new Promise((resolve, reject) => {
            const popup = document.createElement('pop-up');
            const messageP = document.createElement('p');
            messageP.textContent = message
            const cancelBtn = document.createElement('button');
            cancelBtn.classList.add('button');
            cancelBtn.textContent = "CANCEL";
            const confirmBtn = document.createElement('button');
            confirmBtn.classList.add('button');
            confirmBtn.textContent = "CONFIRM";
            const handleCancel = () => {
                cancelBtn.removeEventListener('click', handleCancel);
                confirmBtn.removeEventListener('click', handleConfirm);
                popup.remove();
                resolve(false);
            }
            const handleConfirm = () => {
                cancelBtn.removeEventListener('click', handleCancel);
                confirmBtn.removeEventListener('click', handleConfirm);
                popup.remove();
                resolve(true);
            }
            cancelBtn.addEventListener('click', handleCancel);
            confirmBtn.addEventListener('click', handleConfirm);
            popup.handleCancel = handleCancel;
            popup.append(messageP, cancelBtn, confirmBtn);
            document.body.appendChild(popup);
        });
    }

    /**
     * Creates a text input popup with the given message.
     * 
     * @param {string} message the prompt message to display to the user.
     * @returns the text entered by the user or null if the user clicks 'CANCEL'.
     */
    static prompt(message) {
        return new Promise((resolve, reject) => {
            const popup = document.createElement('pop-up');
            const messageP = document.createElement('p');
            messageP.textContent = message
            const input = document.createElement('input');
            input.classList.add('basic-input');
            const br = document.createElement('br');
            const cancelBtn = document.createElement('button');
            cancelBtn.classList.add('button');
            cancelBtn.textContent = "CANCEL";
            const confirmBtn = document.createElement('button');
            confirmBtn.classList.add('button');
            confirmBtn.textContent = "CONFIRM";
            const handleCancel = () => {
                cancelBtn.removeEventListener('click', handleCancel);
                confirmBtn.removeEventListener('click', handleConfirm);
                popup.remove();
                resolve(null);
            }
            const handleConfirm = () => {
                cancelBtn.removeEventListener('click', handleCancel);
                confirmBtn.removeEventListener('click', handleConfirm);
                popup.remove();
                resolve(input.value);
            }
            cancelBtn.addEventListener('click', handleCancel);
            confirmBtn.addEventListener('click', handleConfirm);
            popup.handleCancel = handleCancel;
            popup.append(messageP, input, br, cancelBtn, confirmBtn);
            document.body.appendChild(popup);
        });
    }
}

window.customElements.define('pop-up', Popup);