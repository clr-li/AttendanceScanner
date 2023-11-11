import { Component } from "../util/Component.js";

class Footer extends Component {
    initialHTML() {
        return /* html */`
            <link rel="stylesheet" href="/styles/reset.css">
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
                            <li><a href="/groups.html">My Groups</a></li>
                            <li><a href="/calendar.html">My Calendar</a></li>
                            <li><a href="/admin.html">Admin Dashboard</a></li>
                        </ul>
                    </div>
                    <div class="colsmall">
                        <h2>About Us</h2>
                        <ul>
                            <li><a href="/about.html">About Us</a></li>
                            <li><a href="/">FAQ</a></li>
                            <li><a href="/#contact">Contact</a></li>
                        </ul>
                    </div>
                    <div class="colbig">
                        <div class="social-networks">
                            <a href="https://github.com/clr-li/AttendanceScanner"><i class="fa-brands fa-github"></i></a>
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
                a:hover, .fa:hover, .fa-brands:hover {
                    color: var(--info);
                }
                footer {
                    background-color: var(--secondary);
                    text-align: center;
                    position: relative;
                }
                .row {
                    max-width: var(--max-width); 
                    margin-left: auto;
                    margin-right: auto;
                    text-align: center;
                    margin-bottom: 20px;
                }
                img { width: 50%; border-radius: 10px; }
                ul { list-style-type: none; margin-left: 1em; }
                a { text-decoration: none; }
                .fa, .fa-brands {
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