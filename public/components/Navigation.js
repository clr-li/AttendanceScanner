import { Component } from "../util/util.js";
import './UserIcon.js';

class Navbar extends Component {
    initialHTML() {
        return /* html */`
            <link rel="stylesheet" href="/style.css">
            <header>
                <img src="/assets/logo.png">
                <nav>
                    <a href="/" class="${location.pathname === '/' ? 'active' : ''}">Home</a>
                    <a href="/user.html" class="${location.pathname === '/user.html' ? 'active' : ''}">My Groups</a>
                    <a href="/">About</a>
                </nav>
                <user-icon></user-icon>
            </header>
            <style>
                header {
                    background-color: var(--primary);
                    height: 100%;
                    padding: 8px;
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                }
                img {
                    border-radius: 10px;
                    height: 80px;
                }
                user-icon {
                    height: 80px;
                }
                nav {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px;
                }
                a {
                    color: white;
                    text-align: center;
                    padding: 14px 16px;
                    text-decoration: none;
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

class Footer extends Component {
    initialHTML() {
        return /* html */`
            <link rel="stylesheet" href="/style.css">
            <footer>
                <div class="row">
                    <div class="colbig">
                        <img src="/assets/logo.png">
                    </div>
                    <div class="colsmall">
                        <h2>Get started</h2>
                        <ul>
                            <li><a href="/">Home</a></li>
                            <li><a href="/login.html?redirect=/">Sign Up</a></li>
                            <li><a href="/payment.html">Start a Group</a></li>
                        </ul>
                    </div>
                    <div class="colsmall">
                        <h2>Attendance</h2>
                        <ul>
                            <li><a href="/user.html">My Groups</a></li>
                            <li><a href="/user.html">My Calendar</a></li>
                            <li><a href="/admin.html">Admin Dashboard</a></li>
                        </ul>
                    </div>
                    <div class="colsmall">
                        <h2>About Us</h2>
                        <ul>
                            <li><a href="/">About Us</a></li>
                            <li><a href="/">FAQ</a></li>
                            <li><a href="/">Contact</a></li>
                        </ul>
                    </div>
                    <div class="colbig">
                        <div class="social-networks">
                            <a href="https://github.com/clr-li/AttendanceScanner"><i class="fa fa-github"></i></a>
                            <a href="tel:+1724383-6080"><i class="fa fa-phone"></i></a>
                            <a href="mailto:info.seattletutoring@gmail.com"><i class="fa fa-envelope"></i></a>
                        </div>
                        <h3>Attendance Scanner</h3>
                        <p>Seattle, WA 98195</p>
                        <p>+1 (724) 383-6080</p>
                    </div>
                    <div style="clear: both"></div>
                </div>
                <div class="copyright">
                    <p>© 2023. All rights reserved. Images, logos, and content cannot be used without permission.</p>
                </div>
            </footer>
            <style>
                * {
                    color: white;
                }
                a:hover, .fa:hover {
                    color: var(--info);
                }
                footer {
                    background-color: var(--secondary);
                    text-align: center;
                    position: relative;
                }
                .row {
                    max-width: 1000px; 
                    margin-left: auto;
                    margin-right: auto;
                    text-align: center;
                    margin-bottom: 20px;
                }
                img { width: 50%; border-radius: 10px; }
                ul { list-style-type: none; margin-left: 1em; }
                a { text-decoration: none; }
                .fa {
                    font-size: 2em;
                    padding: 10px;
                }
                .colbig, .colsmall {
                    display: inline-block;
                    margin-top: 30px;
                }
                .colbig {
                    width: 20%;
                    min-width: 200px;
                    text-align: center;
                }
                .colsmall {
                    width: 20%;
                    min-width: 160px;
                    text-align: left;
                }
                .copyright {
                    clear: both;
                    width: 100%;
                    background-color: var(--accent);
                    padding: 10px;
                }
                @media (min-width: 1050px) {
                    .colbig, .colsmall {
                        display: block;
                        float: left;
                    }
                }

                @media (max-width: 400px) {
                    .colbig, .colsmall {
                        float: none;
                        display: block;
                        margin-left: auto;
                        margin-right: auto;
                    }
                    .row{
                        padding-top: 10px;
                        padding-bottom: 10px;
                    }
                }
            </style>
        `;
    }
}
window.customElements.define('navigation-footer', Footer); // define custom <navigation-footer> tag, name must be lowercase and have one hyphen

/**
 * The Navigation component adds basic page navigation such as a navbar, footer, and hidden navigation links for accessibility
 */
export class NavigationManager extends Component {
    initialHTML() {
        return /* html */`
            <link rel="stylesheet" href="/style.css">
            <div class="wrapper">
                <a href="#main-content" class="skip">Skip to main content</a>
                <navigation-bar id="#navigation"></navigation-bar>
                <main id="main-content">
                    <slot></slot>
                </main>
                <a href="#main-content" class="skip">Skip back to main content</a>
                <a href="#navigation" class="skip">Skip back to navigation</a>
                <navigation-footer></navigation-footer>
            </div>
            <style>
                navigation-bar {
                    position: sticky; top: 0
                }
                .wrapper { /* makes sure the footer is always at the bottom */
                    min-height: 100vh;
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                }
            </style>
        `;
        // NOTE: <slot> is all the child-elements/innerHTML
    }
}
window.customElements.define('navigation-manager', NavigationManager); // define custom <navigation-manager> tag, name must be lowercase and have one hyphen