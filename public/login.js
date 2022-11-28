import {GET, setCookie} from './util.js';

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

    const signInWithMail = document.getElementById('signIn');

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
    GET('/isLoggedIn').then(res => {
      if (res.status == 200) {
        redirect();
      } else {
        signInWithGoogle();
        document.getElementById('loader').style.display = "none";
      }
    });
  } catch (e) {
    console.error(e);
  }
  GET('/isLoggedIn').then(res => {
    if (res.status == 200) {
      redirect();
    } else {
      document.getElementById('loader').style.display = "none";
    }
  });
});

async function handleLogin(auth) {
  // console.log(auth.currentUser.uid);
  document.getElementById('loader').style.display = "block";
  let isLoggedIn = await login(auth);
  if (isLoggedIn) {
    redirect();
  } else {
    alert('Wrong password or username. Try again.');
    document.getElementById('loader').style.display = "none";
  }
}

async function login(auth) {
  try {
    let idToken = await auth.currentUser.getIdToken(/* forceRefresh */ true);
    setCookie("idtoken", idToken, 1);
    let res = await GET('/isLoggedIn');
    console.log(res.status == 200 ? "Server Approved" : "Server Did Not Approve");
    return res.status;
  } catch (error) {
    console.error(error);
    alert("Login failed. Try again later.");
    return false;
  }
}

function redirect() {
  const urlParams = new URLSearchParams(location.search);
  location.replace(urlParams.get('redirect'));
}