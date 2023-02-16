// firebase admin SDK to verify login tokens 
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
});
// database access for user registration and roles
const {db, asyncGet, asyncAll, asyncRun, asyncRunWithID} = require('./Database');
// express for routing
const express = require('express'),
  router = express.Router();

// ============================ AUTHENTICATION SETTINGS ============================
const TOKEN_VERIFICATION = false; // true => verify idToken with firebase, false => just decode it for development purposes
const ACCESS_TABLE = { // the various roles and their priviledges
  owner:   { owner: true , admin: true , scanner: true  },
  admin:   { owner: false, admin: true , scanner: true  },
  scanner: { owner: false, admin: false, scanner: true  },
  user:    { owner: false, admin: false, scanner: false }
}

// ============================ AUTHENTICATION LOGIC ============================
function parseJwt(token) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

async function getUID(idToken, registerIfNewUser=true) {
  if (typeof idToken != "string") throw 'Invalid idToken'; // idToken comes from the client app
  try {
    let truename;
    let uid;
    if (TOKEN_VERIFICATION) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid; 
      truename = decodedToken.name;
    } else {
      const decodedToken = parseJwt(idToken); // development purposes, don't require idToken to be valid
      uid = decodedToken.user_id;
      truename = decodedToken.name;
    }
    if (registerIfNewUser) {
      let name = await asyncGet(`SELECT name FROM Users WHERE id = ?`, [uid]);
      if (!name) {
        await asyncRun(`INSERT INTO Users (id, name) VALUES (?, ?)`, [uid, truename]);
      }
    }
    return uid;
  } catch(error) {
    console.error("getUID error: " + error);
    return false;
  };
}

async function getAccess(businessid, userid, requireadmin, requirescanner, requireuser=true) {
  try {
    if (!requireuser) {
      return true;
    }
    const role = (await asyncGet(`SELECT role from "${table}" WHERE userid = ?`, [userid])).role;
    if (!(role in ACCESS_TABLE)) return false; // if the role is invalid, user doesn't have access
    const access = ACCESS_TABLE[role];
    return (access['admin'] == requireadmin || !requireadmin) && (access['scanner'] == requirescanner || !requirescanner);
  } catch (err) {
    console.error("getAccess error: " + err);
    return false;
  }
}

// ============================ AUTHENTICATION ROUTES ============================
router.get("/isLoggedIn", (request, response) => {
  if (!request.headers.idtoken) {
    response.sendStatus(400);
    return;
  }
  getUID(request.headers.idtoken).then(uid => {
    console.log('logged in: ' + uid);
    response.status = uid ? 200 : 403;
    response.send(uid);
  });
});

// ============================ AUTHENTICATION EXPORTS ============================
exports.router = router