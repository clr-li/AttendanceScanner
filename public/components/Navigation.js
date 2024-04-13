import { Component } from '../util/Component.js';
import './Navbar.js';
import './Footer.js';

/**
 * The Navigation component adds basic page navigation such as a navbar, footer, and hidden navigation links for accessibility
 */
export class NavigationManager extends Component {
    initialHTML() {
        const mainStyle = this.getAttribute('main-style') ?? '';
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <link rel="stylesheet" href="/styles/navigation.css">
            <a href="#main-content" class="skip">Skip to main content</a>
            <navigation-bar id="navigation-bar"></navigation-bar>
            <main id="main-content" style="${mainStyle}">
                <slot></slot>
            </main>
            <a href="#main-content" class="skip">Skip back to main content</a>
            <a href="#navigation-bar" class="skip">Skip back to navigation</a>
            <navigation-footer></navigation-footer>
            <style>
                navigation-bar {
                    position: sticky; top: 0;
                }
                :host { /* makes sure the footer is always at the bottom, :host refers to the shadowRoot of this component @see https://stackoverflow.com/questions/42627939/css-selector-for-shadow-root-or-all-top-level-elements-in-shadow-root */
                    min-height: 100vh;
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    align-items: stretch;
                }
                #main-content {
                    position: relative;
                }
            </style>
        `;
        // NOTE: <slot> is all the child-elements/innerHTML
    }
}
window.customElements.define('navigation-manager', NavigationManager); // define custom <navigation-manager> tag, name must be lowercase and have one hyphen
