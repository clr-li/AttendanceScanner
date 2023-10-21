import { getCurrentUser } from "./util/Auth.js";
const user = getCurrentUser();

if (user) {
    const QRCode = (await import('./components/QRCode.js')).QRCode;
    document.getElementById('navigation').prepend(new QRCode());

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

if (!(/^((?!chrome|android).)*safari/i.test(navigator.userAgent))) {
    document.getElementById("safari-nav").style.display = "none";
}