import { getCurrentUser } from "./util/Auth.js";
import { QRCode } from "./components/QRCode.js";
const user = getCurrentUser();

if (user) {
    document.getElementById('getStarted').style.display = 'none';
    document.getElementById('navigation').prepend(new QRCode());
} else {
    document.getElementById('getStarted').style.opacity = '1';
}