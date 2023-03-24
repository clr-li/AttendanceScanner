import { Component } from "../util/util.js";

class Navbar extends Component {
    initialHTML() {
        return /* html */`
            <link rel="stylesheet" href="/style.css">
            <nav>
                <p>Hello World<p>
            </nav>
            <style>
                nav {
                    background-color: var(--primary);
                    height: 80px;
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
                        <h2>Col 1</h2>
                        <ul>
                            <li><a href="/">Link 1</a></li>
                            <li><a href="/">Link 2</a></li>
                            <li><a href="/">Link 3</a></li>
                        </ul>
                    </div>
                    <div class="colsmall">
                        <h2>Col 2</h2>
                        <ul>
                            <li><a href="/">Link 1</a></li>
                            <li><a href="/">Link 2</a></li>
                            <li><a href="/">Link 3</a></li>
                        </ul>
                    </div>
                    <div class="colsmall">
                        <h2>Col 3</h2>
                        <ul>
                            <li><a href="/">Link 1</a></li>
                            <li><a href="/">Link 2</a></li>
                            <li><a href="/">Link 3</a></li>
                        </ul>
                    </div>
                    <div class="colbig">
                        <div class="social-networks">
                            <a href="/notimplemented.html?feature=No Social Media Yet"><i class="fa fa-instagram"></i></a>
                            <a href="tel:+1724383-6080"><i class="fa fa-phone"></i></a>
                            <a href="mailto:info.seattletutoring@gmail.com"><i class="fa fa-envelope"></i></a>
                        </div>
                        <div style="text-align: center; margin-top: 8px; white-space: nowrap; width: fit-content; margin-left: -8px">
                        <h3>Attendance Scanner</h3>
                        <p>[email]</p>
                        <p>Seattle, WA 98195</p>
                        <p>+1 (724) 383-6080</p>
                        </div>
                    </div>
                    <div style="clear: both"></div>
                </div>
                <div class="copyright">
                    <p>© 2022. All rights reserved. Images, logos, and content cannot be used without permission.</p>
                </div>
            </footer>
            <style>
                footer {
                    background-color: var(--secondary);
                    text-align: center;
                    color: white;
                }
                .row {
                    max-width: 1000px; 
                    margin-left: auto;
                    margin-right: auto;
                    text-align: center;
                    margin-bottom: 20px;
                }
                img { width: 80%; }
                ul { list-style-type: none; }
                a { text-decoration: none; }
                .fa {
                    color: white;
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
                    transform: translate(-1em,0);
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
            <navigation-bar style="position: sticky; top: 0"></navigation-bar>
            <main style="min-height: calc(100vh - 500px)">
                <slot></slot>
            </main>
            <navigation-footer></navigation-footer>
        `;
        // NOTE: <slot> is all the child-elements/innerHTML
    }
}
window.customElements.define('navigation-manager', NavigationManager); // define custom <navigation-manager> tag, name must be lowercase and have one hyphen