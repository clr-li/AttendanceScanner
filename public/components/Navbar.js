import { Component } from '../util/Component.js';
import './UserIcon.js';

const SIZE_THRESHOLD = 470;

class Navbar extends Component {
    initialHTML() {
        return /* html */ `
            <link rel="stylesheet" href="/styles/reset.css">
            <header>
                <img style="height: 100%" src="/assets/logo.png">
                <nav>
                    <a href="/" class="${location.pathname === '/' ? 'active' : ''}">${
                        window.innerWidth > SIZE_THRESHOLD ? 'Home' : '<i class="fa fa-home"></i>'
                    }</a>
                    <a href="/groups.html" class="${
                        location.pathname === '/groups.html' ? 'active' : ''
                    }">${
                        window.innerWidth > SIZE_THRESHOLD
                            ? 'Groups'
                            : '<i class="fa fa-users"></i>'
                    }</a>
                    <a href="/calendar.html" class="${
                        location.pathname === '/calendar.html' ? 'active' : ''
                    }">${
                        window.innerWidth > SIZE_THRESHOLD
                            ? 'Calendar'
                            : '<i class="fa fa-calendar"></i>'
                    }</a>
                    <a href="/admin.html" class="${
                        location.pathname === '/admin.html' ? 'active' : ''
                    }">${
                        window.innerWidth > SIZE_THRESHOLD
                            ? 'Admin'
                            : '<i class="fa fa-user-gear"></i>'
                    }</a>
                </nav>
                <user-icon></user-icon>
            </header>
            <style>
                :host {
                    z-index: 10;
                    width: 100%;
                    background-color: var(--primary);
                }
                header {
                    height: 60px;
                    max-width: var(--max-width);
                    padding: 8px;
                    margin: auto;
                    display: flex;
                    justify-content: space-between;
                }
                img {
                    border-radius: 10px;
                    max-width: 80px;
                }
                user-icon {
                    max-width: 80px;
                    width: fit-content;
                }
                nav {
                    flex-grow: 3;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px;
                }
                a {
                    color: white;
                    text-align: center;
                    height: 42px;
                    padding: 0 clamp(6px, 4%, 16px);
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                }
                @media (max-width: ${SIZE_THRESHOLD}px) {
                    a {
                        padding: 0 clamp(6px, 10%, 16px);
                    }
                }
                a:hover:not(.active) {
                    background-color: var(--secondary);
                }
                .active {
                    background-color: var(--accent);
                }
            </style>
        `;
    }
}
window.customElements.define('navigation-bar', Navbar); // define custom <navigation-bar> tag, name must be lowercase and have one hyphen
