import { Component } from "../util/Component.js";
import { requireLogin, getCurrentUser } from '../util/Auth.js';
await requireLogin();
const user = getCurrentUser();

/**
 * Shows the user's QR Code
 * @requires module: <script src="util/qrcode.min.js"></script>
 */
 export class QRCode extends Component {
    initialHTML() {
        return /* html */`
        <link rel="stylesheet" href="/styles/reset.css">
        <link rel="stylesheet" href="/styles/button.css">
        <link rel="stylesheet" href="/styles/qrcode.css">
        <link rel="stylesheet" href="/styles/sections.css">
        <section id="myqr">
            <h1>My QR Code</h1>
            <p>Event hosts will scan your unique code to take your attendance!</p>
            <div class="img" id="qrcode"></div>
            <br>
            <button class="button" id="fullscreenToggle">Full Screen &nbsp;<i class="fa fa-expand"></i></button>
            <a id="downloadqr" class="button">Download &nbsp;<i class="fa fa-download"></i></a>
        </section>
        `;
    }
    connectedCallback() {
        new window.QRCode(this.shadowRoot.getElementById("qrcode"), user.uid);
        this.shadowRoot.getElementById("qrcode").getElementsByTagName('img')[0].onload = () => {
            this.shadowRoot.getElementById('downloadqr').download = user.name + '.png';
            this.shadowRoot.getElementById('downloadqr').href = this.shadowRoot.getElementById("qrcode").getElementsByTagName('img')[0].src;
        };
        this.shadowRoot.getElementById('fullscreenToggle').addEventListener('click', (e) => {
            if (document.fullscreenElement) { 
                document.exitFullscreen(); 
                e.target.innerHTML = 'Full Screen &nbsp;<i class="fa fa-expand"></i>' 
            } else { 
                this.shadowRoot.getElementById('myqr').requestFullscreen(); 
                e.target.innerHTML = 'Collapse &nbsp;<i class="fa-solid fa-compress"></i>';
            }
        });
        document.addEventListener("fullscreenchange", () => {
            if (document.fullscreenElement) {
                this.shadowRoot.getElementById('fullscreenToggle').innerHTML = 'Collapse &nbsp;<i class="fa-solid fa-compress"></i>';
            } else {
                this.shadowRoot.getElementById('fullscreenToggle').innerHTML = 'Full Screen &nbsp;<i class="fa fa-expand"></i>' 
            }
        });
    }
}
window.customElements.define('qr-code', QRCode);