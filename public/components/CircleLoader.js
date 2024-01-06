import { htmlToElements } from '../util/Component.js';

/**
 * The CircleLoader component blocks the screen with a loading animation when visible.
 * @link Web Components: https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#high-level_view
 */
export class CircleLoader extends HTMLElement {
    constructor() {
        super(); // initialize component (should always be called first)
        const tips = [
            'Have one member/account in the group just for scanning for a more secure business',
            "Download your QR code on your phone so you don't have to login every time",
            'Change your name by clicking on your profile icon',
            'If you are an owner, you can change your business name on the Groups page',
            'Filter by attendance status on the Groups page by clicking the status labels',
        ];
        const randomTip = Math.floor(Math.random() * tips.length);

        // Create the shadow root (root of the shadow DOM representing the DOM nodes of this component)
        const shadow = this.attachShadow({ mode: 'closed' }); // sets and returns 'this.shadowRoot'; mode: "open" means the internal HTML is accessible outside the component, "closed" means it is not

        // Create HTML for this component
        const html = htmlToElements(/* html */ `
            <div class="center">
                <div class="tip"><p style="font-size: 18px;"><span style="color: var(--secondary); font-size: 22px; font-weight: 1000">&#9432;&#160;&#160;</span>${
                    tips[randomTip]
                }</p></div>
            </div>
            <div class="container">
                <div class="lds-default">${/* html */ `<div></div>`.repeat(12)}</div>
            </div>
            <style>${CSS}</style>
        `);

        // attach the created elements to the shadow DOM
        shadow.append(...html);
    }
}

const CSS = /* css */ `
.tip {
    border-radius: 5px;
    border-left: 10px solid var(--secondary);
    color: white;
    background-color: var(--dark-background);
    width: fit-content;
    height: fit-content;
    text-align: center;
    padding: 15px;
}
.center {
    z-index: 9999999; 
    width: 100%;
    position: absolute;
    position: fixed;
    display: flex;
    justify-content: center;
    bottom: 60%;
}
.container {
    z-index: 999999; 
    position: absolute;
    position: fixed;
    width: 100vw; height: 100vh; 
    top: 0; left: 0; 
    background-color: black; 
    opacity: 0.3;
    display: flex; 
    justify-content: center; 
    align-items: center;
}
.lds-default {
    display: inline-block;
    position: relative;
    width: 80px;
    height: 80px;
}
.lds-default div {
    position: absolute;
    width: 6px;
    height: 6px;
    background: #fff;
    border-radius: 50%;
    animation: lds-default 1.2s linear infinite;
}
.lds-default div:nth-child(1) {
    animation-delay: 0s;
    top: 37px;
    left: 66px;
}
.lds-default div:nth-child(2) {
    animation-delay: -0.1s;
    top: 22px;
    left: 62px;
}
.lds-default div:nth-child(3) {
    animation-delay: -0.2s;
    top: 11px;
    left: 52px;
}
.lds-default div:nth-child(4) {
    animation-delay: -0.3s;
    top: 7px;
    left: 37px;
}
.lds-default div:nth-child(5) {
    animation-delay: -0.4s;
    top: 11px;
    left: 22px;
}
.lds-default div:nth-child(6) {
    animation-delay: -0.5s;
    top: 22px;
    left: 11px;
}
.lds-default div:nth-child(7) {
    animation-delay: -0.6s;
    top: 37px;
    left: 7px;
}
.lds-default div:nth-child(8) {
    animation-delay: -0.7s;
    top: 52px;
    left: 11px;
}
.lds-default div:nth-child(9) {
    animation-delay: -0.8s;
    top: 62px;
    left: 22px;
}
.lds-default div:nth-child(10) {
    animation-delay: -0.9s;
    top: 66px;
    left: 37px;
}
.lds-default div:nth-child(11) {
    animation-delay: -1s;
    top: 62px;
    left: 52px;
}
.lds-default div:nth-child(12) {
    animation-delay: -1.1s;
    top: 52px;
    left: 62px;
}
@keyframes lds-default {
    0%, 20%, 80%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.5);
    }
}
`;

window.customElements.define('circle-loader', CircleLoader); // define custom <circle-loader> tag, name must be lowercase and have one hyphen
