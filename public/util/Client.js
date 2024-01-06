export const IS_DEVELOPMENT =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
export const IS_FIREBASE_DOMAIN =
    location.hostname === 'attendancescannerqr.web.app' ||
    location.hostname === 'attendancescannerqr.firebase.com';
export const SERVER_URL = IS_DEVELOPMENT ? '' : 'https://scanner2022.glitch.me'; // use local server in development, otherwise use Glitch server in deployment
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export async function GET(url) {
    return await fetch(SERVER_URL + url, {
        headers: { idtoken: sessionStorage.getItem('idtoken') },
    });
}

export async function POST(url, data) {
    return await fetch(SERVER_URL + url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            idtoken: sessionStorage.getItem('idtoken'),
        },
        body: JSON.stringify(data),
    });
}
