const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors')
let corsOptions = {
  origin: 'https://attendancescannerqr.web.app',
}
app.use(cors(corsOptions))
const uuid = require('uuid');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const https = require('https');

// ============================ PUBLIC (STATIC) FILES ============================
// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// ============================ DATABASE ============================
const {db, asyncGet, asyncAll, asyncRun, asyncRunWithID} = require('./Database');

// ============================ AUTHENTICATION ============================
// How to add idToken to glitch preview:
// 1. From firebase url:
//   - login
//   - copy idtoken cookie
// 2. In glitch preview devtools console
//   - run `import('./util.js').then(m => util = m);`
//   - run `util.setCookie('idtoken', '[PASTE COOKIE STRING HERE]', 24)`
//
// cliuw@uw.edu token: eyJhbGciOiJSUzI1NiIsImtpZCI6ImQwNWI0MDljNmYyMmM0MDNlMWY5MWY5ODY3YWM0OTJhOTA2MTk1NTgiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQ2xhaXJlIENsaXV3QFVXLkVkdSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BRWRGVHA0d1R5UVJFNU13dVhNa1B1MGpkZV9ma1FHRllxTDlyTTE3cHBLZT1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9hdHRlbmRhbmNlc2Nhbm5lcnFyIiwiYXVkIjoiYXR0ZW5kYW5jZXNjYW5uZXJxciIsImF1dGhfdGltZSI6MTY3NTIwNjM5MCwidXNlcl9pZCI6IkEySVN4WktRVU9nSlRhQkpmM2pHMEVjNUNMdzIiLCJzdWIiOiJBMklTeFpLUVVPZ0pUYUJKZjNqRzBFYzVDTHcyIiwiaWF0IjoxNjc1MjA2MzkwLCJleHAiOjE2NzUyMDk5OTAsImVtYWlsIjoiY2xpdXdAdXcuZWR1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDIzNDg1MDIyODIwMzg4OTQ5MzUiXSwiZW1haWwiOlsiY2xpdXdAdXcuZWR1Il19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.RA4rqYq1fGfU58OthW1zdb76zfSbvmYTf2al-gwQei8d0sZ5YgUKvXt-wHRAsYCzah1mUebmvfG8U2n_wFcIIZG5W48EN2G4idvHtKJNV149SA5H-QZ9MxaYK3FdY68wtKRcl9IExX0tNth7-4gKHfMWF15Yz8ja2MxH8Xp_RgXmEd1gxKD-86-hT0VADM7ccMbIrURK2d9GCpUoCjCgdzLJVuJ62CotCUjF5QoMwL2IeK-pIBwp2eyh-Hsy1BB3bwcgtxf926bD3MLuWjSNJNjntvcqTbtpD-38xt2TzyWIA6t9xkGHTRCMhFlm8dmv_CPXzN12nLqg6xjp-CYCnQ
// alexander.le@outlook.dk: eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk1MWMwOGM1MTZhZTM1MmI4OWU0ZDJlMGUxNDA5NmY3MzQ5NDJhODciLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQWxleGFuZGVyIE1ldHpnZXIiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUxtNXd1MEs1SW5aZElPYmhWTW95UDVtaWFzQkxMeFlPRV9KalI4aXg4Y1o9czk2LWMiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYXR0ZW5kYW5jZXNjYW5uZXJxciIsImF1ZCI6ImF0dGVuZGFuY2VzY2FubmVycXIiLCJhdXRoX3RpbWUiOjE2Njk5NjEzMTUsInVzZXJfaWQiOiJmRlN1dkVuSFpiaGtwYUU0Y1F2eWJDUElPUlYyIiwic3ViIjoiZkZTdXZFbkhaYmhrcGFFNGNRdnliQ1BJT1JWMiIsImlhdCI6MTY2OTk2MTMxNSwiZXhwIjoxNjY5OTY0OTE1LCJlbWFpbCI6ImFsZXhhbmRlci5sZUBvdXRsb29rLmRrIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDc5NzQzODUyNDExMjU1ODQwODUiXSwiZW1haWwiOlsiYWxleGFuZGVyLmxlQG91dGxvb2suZGsiXX0sInNpZ25faW5fcHJvdmlkZXIiOiJnb29nbGUuY29tIn19.r50SDswArj53NJbwO8vWAYjWVq7uvo_56RBRyt2ZLKyLrHAOWDsj8Muxg1N2OuAOX5ZOZscXttqPb9wwvnh79tYlciZru5GuBcDXYHuMM18HsOBTkqsdWQlnsneDLawMZYP4u5U9dx2NZSCQIpDmfv8CckPfav7izCcdUxAZaKs6ngzBjpz9O7dpKW8pFscaWtncqyH9PXGtChlDd4kOdYO-YJWkA3-ZZ7_S_AviCHbAG-veyTzoacyCPdDJrNzNq9tiWGvILFtmClpMLqf9v9GdvlRt0dPTHx7p-Q6uTlhXvFGIG8ggqbIxbVxVr_sonbV4Nl47lsoDp0icLLjEuQ
const {authRouter, handleAuth} = require('./Auth');
app.use('/', authRouter);

// ============================ PAYMENT ============================


// ============================ ATTENDANCE ============================
async function createBusiness(uid, name) {
  const user = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
  if (user.BusinessIDs) return
  
  const rand = uuid.v4();
  const attendanceTableName = "ATT" + rand;
  const eventTableName = "EVT" + rand;
  const userTableName = "USR" + rand;
  await asyncRun(`
    CREATE TABLE "${userTableName}" (
        "userid"        TEXT NOT NULL UNIQUE,
        "role"  TEXT,
        FOREIGN KEY("userid") REFERENCES "Users"("id"),
        PRIMARY KEY("userid")
    );
  `);
  await asyncRun(`
    CREATE TABLE "${eventTableName}" (
        "id"    INTEGER NOT NULL UNIQUE,
        "name"  TEXT,
        "starttimestamp"        TEXT NOT NULL,
        "userids"       TEXT,
        "description"   TEXT,
        "endtimestamp"  TEXT,
        PRIMARY KEY("id" AUTOINCREMENT)
    );
  `);
  await asyncRun(`
    CREATE TABLE "${attendanceTableName}" (
        "eventid"       INTEGER NOT NULL,
        "userid"        INTEGER NOT NULL,
        "timestamp"     TEXT NOT NULL,
        "status"        TEXT NOT NULL,
        FOREIGN KEY("userid") REFERENCES "${userTableName}"("userid"),
        FOREIGN KEY("eventid") REFERENCES "${eventTableName}"("id")
    );
  `); 
  const businessID = await asyncRunWithID(`INSERT INTO Businesses (Name, AttendanceTable, usertable, eventtable, roleaccess, joincode) VALUES (?, ?, ?, ?, ?, ?) `, [
    name, attendanceTableName, userTableName, eventTableName, '{"admin":{"admin":true,"scanner":true}}', uuid.v4()
  ]);
  console.log('Created new business with id: ' + businessID);
  await asyncRun('UPDATE Users SET BusinessIDs = ? WHERE id = ?', [businessID, uid]);
  await asyncRun(`INSERT INTO "${userTableName}" (userid, role) VALUES (?, ?)`, [uid, 'admin']);
}

async function deleteBusiness(uids, businessID) {
  await asyncRun(`UPDATE Users SET BusinessIDs = NULL WHERE id IN ('${uids.join("', '")}')`);
 
  const tables = await asyncGet(`SELECT AttendanceTable, usertable, eventtable FROM Businesses WHERE id = ?`, [businessID]);
  await asyncRun(`DROP TABLE "${tables.AttendanceTable}"`);
  await asyncRun(`DROP TABLE "${tables.usertable}"`);
  await asyncRun(`DROP TABLE "${tables.eventtable}"`);
  await asyncRun(`DELETE FROM Businesses WHERE id = ?`, [businessID]);
  
  console.log('Deleted the business with id: ' + businessID);
}

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
    
    const table = await asyncGet(`SELECT AttendanceTable, usertable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    console.log(table)
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
    if (userid == "*") {
      let userids = new Set();
      attendanceinfo.forEach((attendanceRecord) => {
        userids.add(attendanceRecord.userid);
      });
      sql = `SELECT Users.firstname, Users.lastname, "${table.usertable}".userid FROM "${table.usertable}" LEFT JOIN Users ON "${table.usertable}".userid = Users.id WHERE `;
      userids.forEach((uID) => {
        sql += `"${uID}" != "${table.usertable}".userid AND `;
      });
      if (userids.size === 0) {
        sql = sql.substr(0, sql.length - 7);
      } else {
        sql = sql.substr(0, sql.length - 5);
      }
      attendanceinfo = attendanceinfo.concat(await asyncAll(sql));
    }
    response.send(attendanceinfo);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

// app.get("/getBusinesses", async function(request, response) {
//   let sql = `SELECT`
// });

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