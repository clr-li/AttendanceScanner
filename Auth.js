// firebase admin SDK to verify login tokens 
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
});
// database access for user registration and roles
const { asyncGet, asyncRun } = require('./Database');
// express for routing
const express = require('express'),
  router = express.Router();

// ============================ AUTHENTICATION SETTINGS ============================
const TOKEN_VERIFICATION = process.env.DEVELOPMENT !== 'true'; // true => verify idToken with firebase, false => just decode it for development purposes
console.log("TOKEN VERIFICATION: " + TOKEN_VERIFICATION);
const ACCESS_TABLE = { // the various roles and their priviledges
  owner:       { owner: true , read: true , write: true , scanner: true  },
  admin:       { owner: false, read: true , write: true , scanner: true  },
  moderator:   { owner: false, read: true , write: true , scanner: false },
  scanner:     { owner: false, read: true , write: false, scanner: true  },
  user:        { owner: false, read: false, write: false, scanner: false }
}
// read: permission to read sensitive business data
// write: permission to write sensitive (non-scanner) business data

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

async function getAccess(userid, businessid, requiredPriviledges={admin: true}) {
  try {
    const role = (await asyncGet(`SELECT role from Members WHERE user_id = ? AND business_id = ?`, [userid, businessid])).role;
    if (!(role in ACCESS_TABLE)) return false; // if the role is invalid, user doesn't have access
    const access = ACCESS_TABLE[role];
    for (const [priviledge, isRequired] of Object.entries(requiredPriviledges)) {
      if (isRequired && !access[priviledge]) return false;
    }
    return true;
  } catch (err) {
    console.error("getAccess error: " + err);
    return false;
  }
}

// Handles the authentication and authorization of the user
// @params businessid the id of the business to check access for; true => checks if user is member of business_id, false => only checks if user_id is valid 
// @params requiredPriviledges an object of which priviledges are required, empty if no priviledges are required, ignored if business_id is false
// @requires request and response are valid, businessid is a valid id if requiredPriviledges is not empty
// @returns the uid of the user if auth succeeded, false otherwise
// @effects sends response status error codes for failed auth
async function handleAuth(request, response, businessid=false, requiredPriviledges={}) {
  if (!request.headers.idtoken) { 
    response.sendStatus(400); // no idToken
    return false;
  }
  const uid = await getUID(request.headers.idtoken);
  if (!uid) {
    response.sendStatus(401); // invalid idToken
    return false;
  }
  if (businessid && !(await getAccess(uid, businessid, requiredPriviledges))) {
    response.sendStatus(403); // don't have access
    return false;
  }
  return uid;
}

// ============================ AUTHENTICATION ROUTES ============================
router.get("/isLoggedIn", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;
  console.log('logged in: ' + uid);
  response.send(uid);
});

// ============================ AUTHENTICATION EXPORTS ============================
exports.authRouter = router;
exports.handleAuth = handleAuth;