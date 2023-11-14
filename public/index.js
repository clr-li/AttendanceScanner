import { getCurrentUser } from "./util/Auth.js";
const user = getCurrentUser();

if (user) {
    const QRCode = (await import('./components/QRCode.js')).QRCode;
    const myqr = new QRCode(user.uid, user.name);
    myqr.innerHTML = /* html */`
        <h1>My QR Code</h1>
        <p>Event hosts will scan your unique code to take your attendance!</p>
    `;
    document.getElementById('navigation').prepend(myqr);

    for (const element of document.getElementsByClassName('only-logged-in')) {
        element.style.display = 'block';
    };

    for (const element of document.getElementsByClassName('not-logged-in')) {
        element.style.display = 'none';
    };
}

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);