export const IS_DEVELOPMENT =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
export const IS_FIREBASE_DOMAIN =
    location.hostname === 'attendancescannerqr.web.app' ||
    location.hostname === 'attendancescannerqr.firebase.com';
export const SERVER_URL = IS_DEVELOPMENT ? '' : 'https://attendqr.fly.dev'; // use local server in development
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

let errorHandler = null;
/** Sets an error handler to be called on any non 2xx status code response */
export function setErrorHandler(handler) {
    errorHandler = handler;
}

/** Requests a resource from the server. Should only retrieve data */
export async function GET(url) {
    const res = await fetch(SERVER_URL + url, {
        headers: { Authorization: 'Bearer ' + sessionStorage.getItem('idtoken') },
    });
    if (!res.ok && errorHandler) errorHandler(res);
    return res;
}

/** Posts an entry to the specified server resource, often causing a change in state or side effects on the server */
export async function POST(url, data) {
    const res = await fetch(SERVER_URL + url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + sessionStorage.getItem('idtoken'),
        },
        body: JSON.stringify(data),
    });
    if (!res.ok && errorHandler) errorHandler(res);
    return res;
}

/** Modifies a server resource */
export async function PATCH(url, data) {
    const res = await fetch(SERVER_URL + url, {
        method: 'PATCH',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + sessionStorage.getItem('idtoken'),
        },
        body: JSON.stringify(data),
    });
    if (!res.ok && errorHandler) errorHandler(res);
    return res;
}

/** Deletes a server resource */
export async function DELETE(url) {
    const res = await fetch(SERVER_URL + url, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + sessionStorage.getItem('idtoken') },
    });
    if (!res.ok && errorHandler) errorHandler(res);
    return res;
}

/** Replaces a server resource */
export async function PUT(url, data) {
    const res = await fetch(SERVER_URL + url, {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + sessionStorage.getItem('idtoken'),
        },
        body: JSON.stringify(data),
    });
    if (!res.ok && errorHandler) errorHandler(res);
    return res;
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

// polyfills
if (!Object.groupBy) {
    Object.groupBy = (values, keyFinder) => {
        return values.reduce((a, b) => {
            const key = keyFinder(b);
            a[key] = a[key] ? [...a[key], b] : [b];
            return a;
        }, {});
    };
}
