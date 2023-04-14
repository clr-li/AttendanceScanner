import { Component } from "../util/Component.js";
import { getCurrentUser } from '../util/Auth.js';

const user = getCurrentUser();

/**
 * The UserIcon component displays basic user information and provides a login button when logged in, otherwise provides a login button
 */
 export class UserIcon extends Component {
    initialHTML() {
        if (!user) return /* html */`
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <a href="/login.html?redirect=${location.href}" class="button">Sign In</a>
            <style>
                :host {
                    display: flex;
                    align-items: center;
                }
            </style>
        `;
        return /* html */`
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/button.css">
            <div class="container">
                <img src="${user.picture}" referrerpolicy="no-referrer">
                <span id="profile" class="popup">
                    <p>Hi ${user.name}!</p>
                    <button class="button" onclick="import('./util/Auth.js').then(m => {m.logout(); location.href = '/login.html?redirect=/';});">
                        Switch Accounts
                    </button>
                    <button class="button" onclick="import('./util/Auth.js').then(m => {m.logout(); location.reload();});">
                        Logout
                    </button>
                </span>
            </div>
            <style>${CSS}</style>
        `;
    }
    /**
     * Toggle locking the popup in show mode when clicked
     */
    onClick() {
        this.shadowRoot.getElementById('profile').classList.toggle('show');
    }
    /**
     * Called when this component is attached to the DOM. Has access to attributes and properties of this component and can be used to attach event listeners.
     */
    connectedCallback() {
        this.addEventListener('click', this.onClick);
    }
    /**
     * Called when this component is removed from the DOM. Should be used to clean up resources such as event listeners.
     */
    disconnectedCallback() {
        this.removeEventListener("click", this.onClick);
    }
}

const CSS = /* css */`
.container {
    height: 100%;
    position: relative;
    cursor: pointer;
    aspect-ratio: 1 / 1;
}
img {
    height: 100%;
    border-radius: 50%;
    border: 3px ridge var(--secondary);
}
button {
    display: block;
    margin: auto;
    width: 80%;
}
.popup {
    visibility: hidden;
    width: 160px;
    background-color: var(--secondary);
    color: white;
    text-align: center;
    border-radius: 6px;
    padding: 8px 0;
    position: absolute;
    z-index: 1;
    top: 110%;
    left: 0;
    margin-left: -100%;
}
.popup::after {
    content: "";
    position: absolute;
    bottom: 100%;
    left: 78%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: transparent transparent var(--secondary) transparent;
}
.show::after {
    outline: 3px solid var(--accent);
}
.show, .container:hover .popup {
    visibility: visible;
    -webkit-animation: fadeIn 0.6s;
    animation: fadeIn 0.6s;
}
@-webkit-keyframes fadeIn {
    from {opacity: 0;} 
    to {opacity: 1;}
}
@keyframes fadeIn {
    from {opacity: 0;}
    to {opacity:1 ;}
}
`;

window.customElements.define('user-icon', UserIcon); // define custom <user-icon> tag, name must be lowercase and have one hyphen