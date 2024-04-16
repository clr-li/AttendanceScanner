import { GET } from './Client.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js';
import {
    getAuth,
    setPersistence,
    browserSessionPersistence,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
} from 'https://www.gstatic.com/firebasejs/9.18.0/firebase-auth.js';

// Initialize the current auth session and Firebase app
const app = initializeApp({
    // see https://stackoverflow.com/questions/37482366/is-it-safe-to-expose-firebase-apikey-to-the-public#:~:text=The%20apiKey%20in%20this%20configuration,interact%20with%20your%20Firebase%20project.
    apiKey: 'AIzaSyBwrJdz4Ht-QMAzWQ3q3Eb02l69QQAIR9c', // gitleaks:allow
    projectId: 'attendancescannerqr',
    authDomain: 'attendancescannerqr.firebaseapp.com',
});
const auth = getAuth(app);
auth.useDeviceLanguage();
const googleProvider = new GoogleAuthProvider(); // sign in with Google, could easily replace (or add) other identity providers like Facebook
// Got rid of await for setPersistence and getRedirectResult because Safari spasms and an if(false) still runs the two lines
setPersistence(auth, browserSessionPersistence); // auth session ends when browser session ends (closing window/browser will end session, refresh and closing tab will not)
getRedirectResult(auth); // initialize auth with redirect login results if available
console.log('Initialized auth!');

/**
 * Parses the main body of a JWT bearer token.
 * @param {string} token the base64 encoded token to parse
 * @returns the decoded and parsed token body as a JavaScript object.
 */
function parseJwt(token) {
    return JSON.parse(window.atob(token.split('.')[1]));
}

let user = null;
/**
 * Gets the current user profile.
 * @returns an object representing the currently logged in user or null if no user has logged in.
 */
export async function getCurrentUser() {
    if (user) return await user;
    user = new Promise(resolve => {
        const token = auth.currentUser
            ? auth.currentUser.accessToken
            : sessionStorage.getItem('idtoken');
        if (!token) return resolve(null);
        const decoded = parseJwt(token);
        GET('/username').then(res => {
            if (!res.ok) return resolve(null);
            res.json().then(name => {
                user = {
                    name: name.name,
                    picture: decoded.picture,
                    uid: decoded.user_id,
                    email: decoded.email_verified ? decoded.email : null,
                };
                resolve(user);
            });
        });
    });
    return await user;
}

/**
 * Checks if the current auth session is logged in (either by a redirect or through previous browsing).
 * @returns true if the current session/user is logged in and the server approves, false otherwise.
 * @effects updates the idtoken session storage item if necessary
 */
export async function login() {
    try {
        console.log('Logging in...');
        if (auth.currentUser) {
            // use firebase auth information if available (otherwise we rely on the existing idtoken session storage item if it has been set)
            const idToken = await auth.currentUser.getIdToken(/* forceRefresh */ true);
            sessionStorage.setItem('idtoken', idToken);
        } else if (!sessionStorage.getItem('idtoken')) return false;
        const res = await GET('/isLoggedIn');
        console.log(res.status === 200 ? 'Server Approved' : 'Server Did Not Approve');
        return res.status === 200;
    } catch (error) {
        console.error(error);
        return false;
    }
}

/**
 * Guarantees the user is logged in by redirecting to the login page if the user is not logged in.
 * Should be called before using any features that require the user to be logged in.
 *
 * Automatically reruns itself when the token expires.
 */
export async function requireLogin() {
    if (!(await login()))
        location.assign('/login.html?redirect=' + encodeURIComponent(location.href));
    else if (auth.currentUser)
        setTimeout(requireLogin, parseJwt(auth.currentUser.accessToken).exp * 1000 - Date.now());
    else console.log('Using dev login');
}

/**
 * Redirects to google.com to login through oauth2 and then redirects back to the current page where `login()` should then be called to handle the login.
 * @requires the browser has enabled 3rd party storage when used outside `attendancescannerqr.firebaseapp.com` so a fallback like `popUpLogin` is recommended.
 */
export function redirectLogin() {
    try {
        signInWithRedirect(auth, googleProvider);
    } catch (e) {
        // TODO: Error handling
        console.error(e);
    }
}

/**
 * Opens a popup window with google.com to login through oath2. Calls `handleLogin` when the user has logged in.
 * @param {(isLoggedIn: boolean) => void} handleLogin called when login has finished
 */
export async function popUpLogin(handleLogin) {
    try {
        await signInWithPopup(auth, googleProvider);
        handleLogin(await login());
    } catch (e) {
        // TODO: Error handling
        console.error(e);
    }
}

/**
 * Logs in manually with a specific token and calls `handleLogin` once that is done.
 * @param {(isLoggedIn: boolean) => void} handleLogin called when login has finished
 * @param {string} token the token to set manually
 */
export async function devLogin(handleLogin, token) {
    await auth.signOut();
    sessionStorage.setItem('idtoken', token);
    let res = await GET('/isLoggedIn');
    console.log(res.status === 200 ? 'Server Approved' : 'Server Did Not Approve');
    handleLogin(res.status === 200);
}

/**
 * Logs out of the current auth session.
 */
export async function logout() {
    try {
        const signout = auth.signOut();
        sessionStorage.removeItem('idtoken');
        sessionStorage.removeItem('user');
        await signout;
        console.log('Signed out!');
    } catch (e) {
        console.error(e);
    }
}

/**
 * Prompts the user to log in to a google account and give permission for the specified scopes.
 * @param {string[]} scopes Google API scopes to request permission for (if we already have them, the user will not be prompted for them)
 * @returns the user's Google credential (with the user's name and email) if the user has logged in and given permission, otherwise null.
 */
export async function requestGoogleCredential(scopes) {
    for (const scope of scopes) {
        googleProvider.addScope(scope);
    }
    const signinResult = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(signinResult);

    return { ...credential, name: signinResult.user.displayName, email: signinResult.user.email };
}
