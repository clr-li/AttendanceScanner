import { GET, setCookie } from '../util.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'https://www.gstatic.com/firebasejs/9.18.0/firebase-auth.js';

// Initialize the current auth session and Firebase app
const app = initializeApp({
    apiKey: "AIzaSyBwrJdz4Ht-QMAzWQ3q3Eb02l69QQAIR9c",  // Auth / General Use (see https://stackoverflow.com/questions/37482366/is-it-safe-to-expose-firebase-apikey-to-the-public#:~:text=The%20apiKey%20in%20this%20configuration,interact%20with%20your%20Firebase%20project.)
    projectId: "attendancescannerqr",                   // General Use
    authDomain: "attendancescannerqr.firebaseapp.com",  // Auth with
});
const auth = getAuth(app);
auth.useDeviceLanguage();
const googleProvider = new GoogleAuthProvider();
await getRedirectResult(auth); // initialize auth with redirect login results if available
console.log("Initialized auth!");

/**
 * Checks if the current auth session is logged in (either by a redirect or through previous browsing).
 * @returns true if the current session/user is logged in and the server approves, false otherwise.
 * @effects updates the idToken cookie if necessary
 */
export async function login() {
    try {
        console.log("Logging in...");
        let idToken = await auth.currentUser.getIdToken(/* forceRefresh */ true);
        setCookie("idtoken", idToken, 1);
        let res = await GET('/isLoggedIn');
        console.log(res.status == 200 ? "Server Approved" : "Server Did Not Approve");
        return res.status === 200;
    } catch (error) {
        console.error(error);
        return false;
    }
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
        console.error(error);
    }
}

/**
 * Opens a popup window with google.com to login through oath2. Calls `handleLogin` when the user has logged in.
 * @param {(isLoggedIn: boolean) => void} handleLogin called when login has finished
 */
export async function popUpLogin(handleLogin) {
    try {
        await signInWithPopup(auth, googleProvider)
        handleLogin(await login());
    } catch (e) {
        // TODO: Error handling
        console.error(error);
    }
}

/**
 * Logs in manually with a specific token and calls `handleLogin` once that is done.
 * @param {(isLoggedIn: boolean) => void} handleLogin called when login has finished
 * @param {string} token the token to set manually
 */
export async function devLogin(handleLogin, token) {
    setCookie("idtoken", token, 24);
    handleLogin(true);
}


/**
 * Logs out of the current auth session.
 */
export async function logout() {
    try {
        const signout = auth.signOut();
        setCookie("idtoken", "", -1);
        await signout;
        console.log("Signed out!");
    } catch (e){
        console.error(e);
    } 
}