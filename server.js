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

    let id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id='${uid}'`);
    let sql = `SELECT Name FROM Businesses WHERE id = ${id.BusinessIDs}`;
    let row = await asyncGet(sql);
    console.log(row);
    response.send(row);
  } catch (err) {
    if (err) {
      console.error(err.message);
      response.sendStatus(400);
      return;
    }
  }
});

app.get("/events", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);

    let id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id='${uid}'`);
    let table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id=${id.BusinessIDs}`);
    let events = await asyncAll(`SELECT name, description, startdate, starttime, enddate, endtime FROM ${table.eventtable}`);
    response.status = 200;
    response.send(events);  
  } catch (err) {
    if (err) {
      console.error(err.message);
      response.sendStatus(400);
      return;
    }
  }    
});

app.get("/makeRecord", async (request, response) => {
  const uid = await getUID(request.headers.idtoken);
    
  let eventid = request.query.eventid;
  let userid = request.query.userid;
  let id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id='${uid}'`);
  let table = await asyncGet(`SELECT AttendanceTable FROM Businesses WHERE id = ${id.BusinessIDs}`);
      let sql = `INSERT INTO ${table.AttendanceTable} (eventid, userid, timestamp) VALUES (${eventid},${userid},'${Date.now()}');`;
      db.run(sql, (err) => {
          if (err) {
            console.error(err.message);
            response.sendStatus(400);
            return;
          }
          response.sendStatus(200);
});

app.get("/makeEvent", async function(request, response) {
  let uid = await getUID(request.headers.idtoken);

  let name = request.query.name;
  let description = request.query.description;
  let startdate = request.query.startdate;
  let starttime = request.query.starttime;
  let enddate = request.query.enddate;
  let endtime = request.query.endtime;
  db.get(`SELECT BusinessIDs FROM Users WHERE id='${uid}'`, (id, err) => {
    if (err) {
      console.error(err.message);
      response.sendStatus(400);
      return;
    }
    let sql = `SELECT eventtable FROM Businesses WHERE id = ${id.BusinessIDs}`;
    db.get(sql).then
    sql = `INSERT INTO ${table.eventtable} (name, description, startdate, starttime, enddate, endtime) VALUES (${name},${description},'${startdate},'${starttime},'${enddate},'${endtime}');`;
    await run(sql);
    response.sendStatus(200);
  });
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