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

async function getUID(idToken) {
  // idToken comes from the client app
  try {
    let decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    return uid;    
  } catch(error) {
    console.error(error);
    return false;
  };
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
const asyncGet = (sql) => {
  return new Promise((resolve, reject) => {
    db.get(sql, (result, err) => {
      if (err) return reject(err);
      else resolve(result);
    });
  });
};
const asyncAll = (sql) => {
  return new Promise((resolve, reject) => {
    db.all(sql, (result, err) => {
      if (err) return reject(err);
      else resolve(result);
    });
  });
};
const asyncRun = (sql) => {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) return reject(err);
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

    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id='${uid}'`);
    const sql = `SELECT Name FROM Businesses WHERE id = ${id.BusinessIDs}`;
    const row = await asyncGet(sql);
    console.log(row);
    response.send(row);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/events", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);

    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id='${uid}'`);
    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id=${id.BusinessIDs}`);
    const events = await asyncAll(`SELECT name, description, startdate, starttime, enddate, endtime FROM ${table.eventtable}`);
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
    
    const eventid = request.query.eventid;
    const userid = request.query.userid;
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id='${uid}'`);
    const table = await asyncGet(`SELECT AttendanceTable FROM Businesses WHERE id = ${id.BusinessIDs}`);
    await asyncRun(`INSERT INTO ${table.AttendanceTable} (eventid, userid, timestamp) VALUES (${eventid},${userid},'${Date.now()}');`);
    response.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/makeEvent", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);

    const name = request.query.name;
    const description = request.query.description;
    const startdate = request.query.startdate;
    const starttime = request.query.starttime;
    const enddate = request.query.enddate;
    const endtime = request.query.endtime;

    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id='${uid}'`);
    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ${id.BusinessIDs}`);
    await asyncRun(`INSERT INTO ${table.eventtable} (name, description, startdate, starttime, enddate, endtime) VALUES (${name},${description},'${startdate},'${starttime},'${enddate},'${endtime}');`);
    response.sendStatus(200);
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
//   - run `util.setCookie('idtoken', '[PASTE COOKIE STRING HERE]'', 1)`