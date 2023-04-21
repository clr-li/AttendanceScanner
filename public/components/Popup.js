import { Component } from "../util/Component.js";

export class Popup extends Component {
    initialHTML() {
        return /* html */`
        <link rel="stylesheet" href="/styles/reset.css">
        <div id="popup">
            <i class="fa fa-circle-xmark" id="cross"></i>
            <div>
                <slot></slot>
            </div>
        </div>
        <style>
            
            ::slotted(p) {
                font-size: 1.2rem;
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
                border: 8px solid var(--accent);
                display: flex;
                justify-content: center;
                align-items: center;
                border-radius: 10px;
            }
            :host:before {
                content: '';
                backdrop-filter: blur(5px);
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

    static alert(message) {
        const popup = document.createElement('pop-up');
        popup.textContent = message;
        document.body.appendChild(popup);
    }

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
}

window.customElements.define('pop-up', Popup);