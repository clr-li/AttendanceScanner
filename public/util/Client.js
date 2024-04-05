export const IS_DEVELOPMENT =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
export const IS_FIREBASE_DOMAIN =
    location.hostname === 'attendancescannerqr.web.app' ||
    location.hostname === 'attendancescannerqr.firebase.com';
export const SERVER_URL = IS_DEVELOPMENT ? '' : 'https://scanner2022.glitch.me'; // use local server in development, otherwise use Glitch server in deployment
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/** Requests a resource from the server. Should only retrieve data */
export async function GET(url) {
    return await fetch(SERVER_URL + url, {
        headers: { Authorization: 'Bearer ' + sessionStorage.getItem('idtoken') },
    });
}

/** Posts an entry to the specified server resource, often causing a change in state or side effects on the server */
export async function POST(url, data) {
    return await fetch(SERVER_URL + url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + sessionStorage.getItem('idtoken'),
        },
        body: JSON.stringify(data),
    });
}

/** Modifies a server resource */
export async function PATCH(url, data) {
    return await fetch(SERVER_URL + url, {
        method: 'PATCH',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + sessionStorage.getItem('idtoken'),
        },
        body: JSON.stringify(data),
    });
}

/** Deletes a server resource */
export async function DELETE(url) {
    return await fetch(SERVER_URL + url, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + sessionStorage.getItem('idtoken') },
    });
}

/** Replaces a server resource */
export async function PUT(url, data) {
    return await fetch(SERVER_URL + url, {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + sessionStorage.getItem('idtoken'),
        },
        body: JSON.stringify(data),
    });
}

export async function sendGmail(to_email, subject, text, credential) {
    const message = {
        to_email: to_email,
        from_email: credential.email,
        subject: subject,
        text: text,
    };

    return await POST('/gmail', { message: message, accessToken: credential.accessToken });
}
