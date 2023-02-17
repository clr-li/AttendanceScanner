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
  owner:       { owner: true , admin: true , scanner: true  },
  admin:       { owner: false, admin: true , scanner: true  },
  moderator:   { owner: false, admin: true , scanner: false },
  scanner:     { owner: false, admin: false, scanner: true  },
  user:        { owner: false, admin: false, scanner: false }
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

// Handles the authentication (and authorization if requiredPriviledges is not false) of the user
// @param businessid the id of the business to check access for
// @param requiredPriviledges an object of which priviledges are required
// @requires request and response are valid, businessid is a valid id if requiredPriviledges is not false
// @return the uid of the user if auth succeeded, false otherwise
// @effects sends response status error codes for failed auth
async function handleAuth(request, response, businessid=false, requiredPriviledges=false) {
  if (!request.headers.idtoken) { 
    response.sendStatus(400); // no idToken
    return false;
  }
  const uid = await getUID(request.headers.idtoken);
  if (!uid) {
    response.sendStatus(401); // invalid idToken
    return false;
  }
  if (requiredPriviledges && !(await getAccess(uid, businessid, requiredPriviledges))) {
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