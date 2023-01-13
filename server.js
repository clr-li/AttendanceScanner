const express = require("express");
const app = express();
const fs = require("fs");
const cors = require('cors')
let corsOptions = {
  origin: 'https://attendancescannerqr.web.app',
}
app.use(cors(corsOptions))

const https = require('https');
const { exec } = require("child_process"); 


var admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
});

function parseJwt(token) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

async function getUID(idToken) {
  if (typeof idToken != "string") throw 'Invalid idToken';
  // idToken comes from the client app
  try {
    // let decodedToken = await admin.auth().verifyIdToken(idToken);
    // const uid = decodedToken.uid;
    // return uid;    
    let decodedToken = parseJwt(idToken); // development purposes, don't require idToken to be valid
    return decodedToken.user_id;
  } catch(error) {
    console.error("getUID error: " + error);
    return false;
  };
}

async function getAccess(businessid, userid, requireadmin, requirescanner, requireuser=true) {
  try {
    if (requireuser) {
      const user = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [userid]);
      const validbusinessids = new Set(user.BusinessIDs.split(','));
      if (!validbusinessids.has(businessid)) return false; // user doesn't belong to the business
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

// init sqlite db
const dbFile = "./.data/AttendanceSoftware.db";
const exists = fs.existsSync(dbFile);
let db = null;
if (!exists) {
  console.log("no database file found :(");
}
else {
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database(dbFile);
}
const asyncGet = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve(result);
    });
  });
};
const asyncAll = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, result) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve(result);
    });
  });
};
const asyncRun = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve();
    });
  });
};

// db.run("CREATE TABLE Businesses", (err) => { console.log(err) });

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

app.get("/business", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }

    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    const row = await asyncGet(`SELECT Name FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    response.send(row);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/joincode", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }

    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    const row = await asyncGet(`SELECT id, joincode FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    response.send(row);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/join", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }

    const businessId = request.query.id;
    const joincode = request.query.code;
    // const email = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    const row = await asyncGet(`SELECT joincode, usertable, pendingemails FROM Businesses WHERE id = ?`, [businessId]);
    if (row.joincode === joincode) {
        await asyncRun(`INSERT OR IGNORE INTO "${row.usertable}" (userid, role) VALUES (?, 'user')`, [uid]);
      response.sendStatus(200);
    } else {
      response.sendStatus(403);
    }
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/events", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, false, true))) {
      response.sendStatus(403);
      return;
    }

    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    const events = await asyncAll(`SELECT id, name, starttimestamp, endtimestamp, userids, description FROM "${table.eventtable}"`);
    response.status = 200;
    response.send(events);  
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }    
});

app.get("/recordAttendance", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, false, true))) {
      response.sendStatus(403);
      return;
    }
    
    const eventid = request.query.eventid;
    const userid = request.query.userid;
    const status = request.query.status;
    if (typeof status != "string" || typeof userid != "string" || (typeof eventid != "number" && typeof eventid != "string")) throw "Invalid input";
    
    const table = await asyncGet(`SELECT AttendanceTable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    await asyncRun(`INSERT INTO "${table.AttendanceTable}" (eventid, userid, timestamp, status) VALUES (?, ?, ?, ?)`, [eventid, userid, Date.now(), status]);
    response.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/attendancedata", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }
    const eventid = request.query.eventid;
    const userid = request.query.userid;
    if (typeof userid != "string") throw new Error("Invalid input");
    
    const table = await asyncGet(`SELECT AttendanceTable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    let sql = `SELECT Users.firstname, Users.lastname, "${table.AttendanceTable}".* FROM "${table.AttendanceTable}" LEFT JOIN Users ON "${table.AttendanceTable}".userid = Users.id GROUP BY Users.id, "${table.AttendanceTable}".eventid ORDER BY "${table.AttendanceTable}".timestamp DESC`;
    if (eventid == "*" && userid == "*") {
      var attendanceinfo = await asyncAll(sql);
    } else if (eventid == "*") {
      var attendanceinfo = await asyncAll(sql + "WHERE userid = ?", [userid]);
    } else if (userid == "*") {
      var attendanceinfo = await asyncAll(sql + "WHERE eventid = ?", [eventid]);
    } else {
      var attendanceinfo = await asyncAll(sql + "WHERE eventid = ? AND userid = ?", [eventid, userid]);
    }
    response.send(attendanceinfo);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/makeEvent", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }

    const name = request.query.name;
    const description = request.query.description;
    const starttimestamp = request.query.starttimestamp;
    const endtimestamp = request.query.endtimestamp;
    const userids = request.query.userids;
    if (typeof name != "string" || typeof description != "string" || typeof userids != "string" || (typeof starttimestamp != "number" && typeof starttimestamp != "string") || (typeof endtimestamp != "number" && typeof endtimestamp != "string")) throw "Invalid input";

    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    await asyncRun(`INSERT INTO "${table.eventtable}" (name, starttimestamp, endtimestamp, userids, description) VALUES (?, ?, ?, ?, ?)`,
                  [name, starttimestamp, endtimestamp, userids, description]);
    const eventid = await asyncGet(`SELECT last_insert_rowid() FROM "${table.eventtable}"`);
    response.status(200);
    response.send(eventid);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/updateevent", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }

    const name = request.query.name;
    const description = request.query.description;
    const starttimestamp = request.query.starttimestamp;
    const endtimestamp = request.query.endtimestamp;
    const eventid = request.query.eventid;
    if (typeof name != "string" || typeof description != "string" || (typeof starttimestamp != "number" && typeof starttimestamp != "string") || (typeof endtimestamp != "number" && typeof endtimestamp != "string")) throw "Invalid input";

    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    await asyncRun(`UPDATE "${table.eventtable}" SET name = ?, starttimestamp = ?, endtimestamp = ?, description = ? WHERE id = ?`,
                  [name, starttimestamp, endtimestamp, description, eventid]);
    response.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/deleteevent", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }

    const eventid = request.query.eventid;

    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    await asyncRun(`DELETE FROM "${table.eventtable}" WHERE id = ?`, [eventid]);
    response.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/eventdata", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }
    
    const eventid = request.query.eventid;
    if (typeof eventid != "string" && typeof eventid != "number") throw "Invalid input";
    
    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    const eventinfo = await asyncGet(`SELECT * FROM "${table.eventtable}" WHERE id = ?`, [eventid]);
    response.send(eventinfo);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});

// How to add idToken to glitch preview:
// from firebase url:
//   - login
//   - copy idtoken cookie
// in glitch preview devtools console
//   - run `import('./util.js').then(m => util = m);`
//   - run `util.setCookie('idtoken', '[PASTE COOKIE STRING HERE]', 24)`