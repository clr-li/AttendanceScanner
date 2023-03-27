import { Component } from "../util/Component.js";

/**
 * The MessageContainer component formats a simple message
 */
 export class MessageContainer extends Component {
    initialHTML() {
        const actionColor = this.getAttribute("color") ?? "var(--info)";
        return /* html */`
            <div id="container">
                <div id="message">
                    <slot></slot>
                </div>
            </div>
            <style>
                #container { background: #ECEFF1; color: rgba(0,0,0,0.87); position: relative; margin: 0; padding: 0; height: 100%; padding-top: 100px; }
                #message { background: white; max-width: 360px; margin: 0 auto 16px; padding: 32px 24px 16px; border-radius: 3px; }
                ::slotted(h2) { color: ${actionColor}; font-weight: bold; font-size: 16px; margin: 0 0 8px; }
                ::slotted(h1) { font-size: 22px; font-weight: 300; color: rgba(0,0,0,0.6); margin: 0 0 16px;}
                ::slotted(p) { line-height: 140%; margin: 16px 0 24px; font-size: 14px; }
                #message { box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24); }
                @media (max-width: 600px) {
                    #container, #message { margin-top: 0; background: white; box-shadow: none; }
                    #container { padding-top: 0; border-top: 16px solid ${actionColor}; }
                }
            </style>
        `;
    }
}
window.customElements.define('message-container', MessageContainer); // define custom <message-container> tag, name must be lowercase and have one hyphen