import { getCurrentUser } from "./util/Auth.js";
const user = getCurrentUser();

if (user) {
    document.getElementById('getStarted').style.display = 'none';
    const QRCode = (await import('./components/QRCode.js')).QRCode;
    document.getElementById('navigation').prepend(new QRCode());
} else {
    document.getElementById('getStarted').style.opacity = '1';
}

setTimeout(() => {
    document.body.style.opacity = '1';
}, 100)