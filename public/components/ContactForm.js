import { Component } from "../util/Component.js";
import { Popup } from "./Popup.js";

class ContactForm extends Component {
    initialHTML() {
        return /* html */`
        <link rel="stylesheet" href="/styles/reset.css">
        <link rel="stylesheet" href="/styles/inputs.css">
        <link rel="stylesheet" href="/styles/button.css">
        <div>
            <h1>
                Contact Us
            </h1>
            <hr><br>
            <p>Experiencing any technological issues with the service? Have a question or feature request? We're happy to hear from you!</p>
            <br>
            <p>NOTE: You'll have to contact the groups you're part of directly to dispute attendance records since we don't decide whether or you should be marked absent.</p>
            <br>
            <form class="form" id="contactform">
                <label for="name">Name</label><br>
                <input id="name" type="text" required>
                <br>
                <label for="email">Email</label><br>
                <input id="email" type="email" required><br>
                <label for="message">What would you like to say to us?</label><br>
                <textarea style="resize: vertical;" id="message" rows="3" required></textarea><br><br>
                <button class="button">Submit</button>
            </form>
        </div>
        <style>
            h1 {
                font-size: 3rem;
                padding: 0.2em;
            }
            hr {
                width: 3rem;
                border: 2px solid var(--accent);
                margin: 0 auto;
            }
            div {
                width: 100%;
                height: 100%;
                color: var(--accent);
                padding: 1em;
            }
            p, .form input, .form input[type="text"], .form textarea {
                min-width: 90%;
                width: 90%;
                max-width: 90%;
                margin: 0 auto;
                text-align: left;
                color: black;
            }
            input:focus, textarea:focus {
                outline: 2px solid var(--accent);
            }
        </style>
        `;
    }
    
    validate(e) { // called when submit is pressed
        e.preventDefault();
        let name = this.shadowRoot.getElementById('name').value;
        let email = this.shadowRoot.getElementById('email').value;
        let message = this.shadowRoot.getElementById('message').value;
        let url = getGoogleFormURL(name, email, message);
        submitGoogleForm(url);
        Popup.alert('<h1>Success!</h1>Form submitted. We will reach out to you by email.', "var(--success");
    }

    connectedCallback() {
        const contactForm = this.shadowRoot.getElementById('contactform');
        contactForm.addEventListener('submit', (e) => { this.validate(e) });
    }
}

window.customElements.define('contact-form', ContactForm);

function submitGoogleForm(url) {
    let iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    iframe.onload = () => { document.body.removeChild(iframe) };
}

function getGoogleFormURL(NAME, EMAIL, MESSAGE) {
    let url = `https://docs.google.com/forms/d/e/1FAIpQLScM7JPB_XvhgJgbMuZ7FZ-sriG8RNP_K1YlAtO5hpVAeYKmOA/formResponse?usp=pp_url&entry.1419434417=${NAME.replaceAll(' ', '+')}&entry.882784535=${EMAIL.replaceAll(' ', '+')}&entry.1786088673=${MESSAGE.replaceAll(' ', '+')}&submit=Submit`;
    return url;
}