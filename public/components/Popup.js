import { Component } from "../util/Component.js";

class Popup extends Component {
    initialHTML() {
        return /* html */`
        <link rel="stylesheet" href="/styles/reset.css">
        <div>
            <i class="fa fa-circle-xmark" id="cross"></i>
            <slot></slot>
        </div>
        <style>
            ::slotted(*) {
                font-size: 1.2rem;
            }
            div {
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

    connectedCallback() {
        this.shadowRoot.getElementById('cross').addEventListener('click', () => {
            this.remove();
        });
    }

    disconnectedCallback() {
        this.shadowRoot.getElementById("cross").removeEventListener("click", () => {
            this.remove();
        });
    }
}

window.customElements.define('pop-up', Popup);