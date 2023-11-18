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

// ============================ AUTH SETTINGS ============================
const TOKEN_VERIFICATION = process.env.DEVELOPMENT !== 'true'; // true => verify idToken with firebase, false => just decode it for development purposes
console.log("TOKEN VERIFICATION: " + TOKEN_VERIFICATION);
const ACCESS_TABLE = { // the various roles and their privileges
    owner:       { owner: true , assignRoles: true , read: true , write: true , scanner: true  },
    admin:       { owner: false, assignRoles: true , read: true , write: true , scanner: true  },
    moderator:   { owner: false, assignRoles: false, read: true , write: true , scanner: false },
    scanner:     { owner: false, assignRoles: false, read: true , write: false, scanner: true  },
    user:        { owner: false, assignRoles: false, read: false, write: false, scanner: false }
}
// read: permission to read sensitive business data
// write: permission to write sensitive (non-scanner) business data

// ============================ AUTH LOGIC ============================
/**
 * Parses the main body of a JWT bearer token.
 * @param {string} token the base64 encoded token to parse
 * @returns the decoded and parsed token body as a JavaScript object.
 */
function parseJwt(token) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

/**
 * Gets the uid of the currently logged in user.
 * @param {string} idToken Firebase access token from the client app to get the current user from
 * @param {boolean} registerIfNewUser adds the user to the database if their uid is not in the database yet
 * @returns the uid of the user represented by the idToken if the user is logged in and the token is valid, otherwise returns false.
 */
module.exports.getUID = async function getUID(idToken, registerIfNewUser=true) {
    if (typeof idToken !== "string" || idToken === "null") return false;
    try {
        let truename;
        let uid;
        if (TOKEN_VERIFICATION) {
            const decodedToken = await admin.auth().verifyIdToken(idToken, true);
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

/**
 * Checks that the given user has the specified privileges for the given business.
 * @param {string} userid the uid of the user to check access for
 * @param {number} businessid the business to check access within
 * @param {{owner?: boolean , read?: boolean , write?: boolean , scanner?: boolean}} requiredPrivileges the privileges to check if they are allowed the users role
 * @returns true if the user is a member of the specified business and has a role with at least the privileges specified as true in requiredPrivileges (and none of the priveledges specified as false), false otherwise.
 */
async function getAccess(userid, businessid, requiredPrivileges={}) {
  try {
    const role = (await asyncGet(`SELECT role FROM Members WHERE user_id = ? AND business_id = ?`, [userid, businessid])).role;
    if (!(role in ACCESS_TABLE)) return false; // if the role is invalid, user doesn't have access
    const access = ACCESS_TABLE[role];
    for (const [priviledge, isRequired] of Object.entries(requiredPrivileges)) {
      if (isRequired != access[priviledge]) return false;
    }
    return true;
  } catch (err) {
    console.error("getAccess error: " + err);
    return false;
  }
}

/**
 * Handles the authentication and authorization of the user.
 * @param {Request} request the request object
 * @param {Response} response the response object
 * @param {number} businessid the id of the business to check access for; true => checks if user is member of business_id, false => only checks if user_id is valid
 * @param {{owner?: boolean , read?: boolean , write?: boolean , scanner?: boolean}} requiredPrivileges  an object of which privileges are required, empty if no privileges are required, ignored if business_id is false
 * @requires request and response are valid, businessid is a valid id if requiredPrivileges is not empty
 * @returns the uid of the user if auth succeeded, false otherwise.
 * @effects sends response status error codes for failed auth
 */
async function handleAuth(request, response, businessid=false, requiredPrivileges={}) {
  if (!request.headers.idtoken) {
    response.status(400).send("No idtoken provided, user does not appear to be signed in");
    return false;
  }
  const uid = await module.exports.getUID(request.headers.idtoken);
  if (!uid) {
    response.status(401).send("Idtoken is invalid, login has likely expired");
    return false;
  }
  if (businessid && !(await getAccess(uid, businessid, requiredPrivileges))) {
    response.status(403).send("Access denied, user does not have the necessary privileges for this endpoint");
    return false;
  }
  return uid;
}

// ============================ AUTH ROUTES ============================
/**
 * Endpoint to check if the client has a valid idtoken header set.
 */
router.get("/isLoggedIn", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;
  console.log('logged in: ' + uid);
  response.send(uid);
});

// ============================ AUTH EXPORTS ============================
exports.authRouter = router;
exports.handleAuth = handleAuth;
exports.getAccess = getAccess;
exports.parseJwt = parseJwt;