import { getCurrentUser } from "./util/Auth.js";
const user = getCurrentUser();

if (user) {
    document.getElementById('getStarted').style.display = 'none';
    const QRCode = (await import('./components/QRCode.js')).QRCode;
    document.getElementById('navigation').prepend(new QRCode());
} else {
    document.getElementById('getStarted').style.opacity = '1';
}

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);