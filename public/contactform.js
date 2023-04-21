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

function validate(e) { // called when submit is pressed
    e.preventDefault();
    let name = document.getElementById('name').value;
    let email = document.getElementById('email').value;
    let message = document.getElementById('message').value;
    let url = getGoogleFormURL(name, email, message);
    submitGoogleForm(url);
}

const contactForm = document.getElementById('contactform');
contactForm.addEventListener('submit', validate);