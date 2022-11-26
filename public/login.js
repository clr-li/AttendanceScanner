import {getCookie, setCookie} from './util.js';

const form = document.getElementById("form"); function handleForm(event) { event.preventDefault(); }  form.addEventListener('submit', handleForm);

document.addEventListener('DOMContentLoaded', function() {
  try {
    let app = firebase.app();
    let features = [
      'auth', 
    ].filter(feature => typeof app[feature] === 'function');
    console.log(`Firebase SDK loaded with ${features.join(', ')}`);
    const auth = app.auth();
    auth.useDeviceLanguage();

    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    const signInWithMail = document.getElementById('signIn');

    // Sign in with email and password ----------------------------------
    const signInWithEmailFunction = () => {
      const email = emailField.value;
      const password = passwordField.value;

      //Built in firebase function responsible for authentication
      auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        //Signed in successfully
        console.log('You\'re successfully signed in !');
        handleLogin(auth);
      })
      .catch(error => {
        console.error(error);
      })
    }
    signInWithMail.addEventListener('click', signInWithEmailFunction);

    // Reset password ----------------------------------------------------
    const resetPassword = document.getElementById('resetPassword');
    const resetPasswordFunction = () => {
        const email = emailField.value;

        //Built in Firebase function that sends password reset emails
        auth.sendPasswordResetEmail(email)
        .then(() => {
            console.log('Password Reset Email Sent Successfully!');
        })
        .catch(error => {
            console.error(error);
        });
    }
    resetPassword.addEventListener('click', resetPasswordFunction);

    // Sign in with google ----------------------------------------------
    const signInWithGoogleBtn = document.getElementById('signInWithGoogle');
    const signInWithGoogle = () => {
      const googleProvider = new firebase.auth.GoogleAuthProvider();

      auth.signInWithPopup(googleProvider)
      .then(() => {
        console.log('You\'re now signed in !');
        handleLogin(auth);
      })
      .catch(error => {
        console.error(error);
      });
    }
    signInWithGoogleBtn.addEventListener('click', signInWithGoogle);

  } catch (e) {
    console.error(e);
  }
});

async function handleLogin(auth) {
  console.log(auth.currentUser.uid);
  auth.currentUser.getIdToken(/* forceRefresh */ true).then(function(idToken) {
    console.log(idToken);
    setCookie("idToken", idToken, 1);
    fetch('https://scanner2022.glitch.me/isLoggedIn').then(res => console.log(res));
  }).catch(function(error) {
    console.error(error);
  });
}