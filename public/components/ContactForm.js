import { Component } from "../util/Component.js";
import { Popup } from "./Popup.js";

class ContactForm extends Component {
    initialHTML() {
        return /* html */`
        <link rel="stylesheet" href="/styles/reset.css">
        <link rel="stylesheet" href="/styles/inputs.css">
        <link rel="stylesheet" href="/styles/button.css">
        <script type="module" src="/contactform.js"></script>
        <h1>
            Contact Us
        </h1>
        <form class="form" id="contactform">
            <label for="name">Name</label>
            <input id="name" type="text" required>
            <label for="email">Email</label>
            <input id="email" type="email" required><br>
            <label for="message">What would you like to say to us?</label><br>
            <textarea id="message" rows="3" required></textarea><br>
            <button class="button">Submit</button>
        </form>
        <style>
            h1 {
                font-size: 3rem;
                padding: 0.2em;
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
        Popup.alert('Form submitted. We will reach out to you by email.');
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