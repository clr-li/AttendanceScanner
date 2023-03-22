import { htmlToElements } from "../util/util.js";

// @see Web Components: https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#high-level_view
class CircleLoader extends HTMLElement {
    constructor() {
        super(); // initialize component (should always be called first)

        // Create the shadow root (root of the shadow DOM representing the DOM nodes of this component)
        const shadow = this.attachShadow({ mode: "closed" }); // sets and returns 'this.shadowRoot'; mode: "open" means the internal HTML is accessible outside the component, "closed" means its not
        
        // Create HTML for this component
        const html = htmlToElements(/* html */`
            <div class="container">
                <div class="lds-default"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
            </div>
        `);

        // Apply CSS to this shadow DOM
        const style = document.createElement('style');
        style.textContent = CSS;

        // attach the created elements to the shadow DOM
        shadow.append(style, ...html);
    }
}

const CSS = /* css */`
.container {
    z-index: 999999; 
    position: absolute; 
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