const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
});
const {db, asyncGet, asyncAll, asyncRun, asyncRunWithID} = require('./Database');

// ============================ AUTHENTICATION SETTINGS ============================
const TOKEN_VERIFICATION = false;
const ACCESS_TABLE = {
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
  if (typeof idToken != "string") throw 'Invalid idToken';
  // idToken comes from the client app
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
      let name = await asyncGet(`SELECT name FROM Users WHERE id=?`, [uid]);
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
    if (requireuser) {
      const user = await asyncGet(`SELECT business_id FROM Members WHERE id = ?`, [userid]);
      // const validbusinessids = new Set(user.BusinessIDs.split(','));
      // if (!validbusinessids.has(businessid)) return false; // user doesn't belong to the business
    }
    const business = await asyncGet(`SELECT roleaccess, usertable FROM Businesses WHERE id = ?`, [businessid]);
    const roleaccess = business.roleaccess;
    const roles = JSON.parse(roleaccess);
    const table = business.usertable;
    const role = (await asyncGet(`SELECT role from "${table}" WHERE userid = ?`, [userid])).role;
    if (!(role in roles)) return false; // if the role is invalid, user doesn't have access
    const access = roles[role];
    return (access['admin'] == requireadmin || !requireadmin) && (access['scanner'] == requirescanner || !requirescanner);
  } catch (err) {
    console.error("getAccess error: " + err);
    return false;
  }
}

// ============================ AUTHENTICATION ROUTES ============================
app.get("/isLoggedIn", (request, response) => {
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