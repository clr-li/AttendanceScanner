import { Component } from '../util/Component.js';

/**
 * Shows a downloadable QR Code with fullscreen toggle.
 * @requires module: <script src="util/qrcode.min.js"></script>
 */
export class QRCode extends Component {
    constructor(qr_data, download_filename, sharedTemplate = false) {
        super(sharedTemplate);
        this.qr_data = qr_data;
        this.download_filename = download_filename;
    }

    initialHTML() {
        return /* html */ `
        <link rel="stylesheet" href="/styles/reset.css">
        <link rel="stylesheet" href="/styles/button.css">
        <link rel="stylesheet" href="/styles/qrcode.css">
        <link rel="stylesheet" href="/styles/sections.css">
        <section id="myqr">
            <slot></slot>
            <div class="img" id="qrcode"></div>
            <br>
            <button class="button" id="fullscreenToggle">Full Screen &nbsp;<i class="fa fa-expand"></i></button>
            <a id="downloadqr" class="button">Download &nbsp;<i class="fa fa-download"></i></a>
        </section>
        `;
    }

    connectedCallback() {
        this.update(this.qr_data);
        this.shadowRoot.getElementById('fullscreenToggle').addEventListener('click', e => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
                e.target.innerHTML = 'Full Screen &nbsp;<i class="fa fa-expand"></i>';
            } else {
                this.shadowRoot.getElementById('myqr').requestFullscreen();
                e.target.innerHTML = 'Collapse &nbsp;<i class="fa-solid fa-compress"></i>';
            }
        });
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                this.shadowRoot.getElementById('fullscreenToggle').innerHTML =
                    'Collapse &nbsp;<i class="fa-solid fa-compress"></i>';
            } else {
                this.shadowRoot.getElementById('fullscreenToggle').innerHTML =
                    'Full Screen &nbsp;<i class="fa fa-expand"></i>';
            }
        });
    }

    update(qr_data, download_filename) {
        this.qr_data = qr_data || this.qr_data;
        this.download_filename = download_filename || this.download_filename;
        this.shadowRoot.getElementById('qrcode').innerHTML = '';
        new window.QRCode(this.shadowRoot.getElementById('qrcode'), this.qr_data);
        this.shadowRoot.getElementById('qrcode').getElementsByTagName('img')[0].onload = () => {
            this.shadowRoot.getElementById('downloadqr').download = this.download_filename + '.png';
            this.shadowRoot.getElementById('downloadqr').href = this.shadowRoot
                .getElementById('qrcode')
                .getElementsByTagName('img')[0].src;
        };
    }
}
window.customElements.define('qr-code', QRCode);
