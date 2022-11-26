const express = require("express");
const app = express();
const fs = require("fs");
const cookieParser = require("cookie-parser")
app.use(cookieParser())
const cors = require('cors')
let corsOptions = {
  origin: 'https://attendancescannerqr.web.app'
}
app.use(cors(corsOptions))

const https = require('https');
const { exec } = require("child_process"); 


var admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
});

async function getLoggedInUser(idToken) {
  // idToken comes from the client app
  admin.auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      const uid = decodedToken.uid;
      return uid;
    })
    .catch((error) => {
      return false;
    });
}

app.get("/isLoggedIn", (request, response) => {
  console.log(request.cookies.idToken)
  if (request.cookies.idtoken) {
    let idToken = request.cookies.idtoken;
  } else if (request.headers.idtoken) {
    response.cookie("idToken", request.headers.idtoken, {
      secure: true,
      httpOnly: true,
      expires: 3600000,
    });
    let idToken = request.headers.idtoken;
  } else {
    response.sendStatus(400);
    return
  }
  let loggedInUser = getLoggedInUser(idToken);
  response.status = loggedInUser ? 200 : 403;
  response.send(loggedInUser);
});

// init sqlite db
const dbFile = "./.data/AttendanceSoftware.db";
const exists = fs.existsSync(dbFile);
let db = null;
if (!exists) {
  console.log("no database file found :(");
}
else {
  const sqlite3 = require("sqlite3").verbose();
  db = new sqlite3.Database(dbFile);
}

// db.run("CREATE TABLE Businesses", (err) => { console.log(err) });

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

app.get("/businessRow", (request, response) => {
  
  let sql = `SELECT Name
         FROM Businesses
         WHERE id = ?;`;
  let id = 0;

  db.get(sql, id, (err, row) => {
    if (err) {
      console.error(err.message);
      response.sendStatus(400);
      return;
    }
    console.log(row);
    response.send(row);
  });
});

app.get("/events", (request, response) => {
  
  let sql = `SELECT eventtable
         FROM Businesses
         WHERE id = ?;`;
  let id = 0;

  db.get(sql, id, (err, table) => {
    if (err) {
      console.error(err.message);
      response.sendStatus(400);
      return;
    }
    sql = `SELECT id, name FROM ${table.eventtable}`;
    console.log(sql);
    db.all(sql, (err, events) => {
        if (err) {
          console.error(err.message);
          response.sendStatus(400);
          return;
        }
        response.send(events);
    });
  });
});

app.get("/makeRecord", (request, response) => {
  let eventid = request.query.eventid;
  let businessid = request.query.id;
  let userid = request.query.userid;
  let sql = `SELECT AttendanceTable
       FROM Businesses
       WHERE id = ${businessid};`;
  console.log(request.query)
  db.get(sql, (err, table) => {
    if (err) {
      console.error(err.message);
      response.sendStatus(400);
      return;
    }
    let sql = `INSERT INTO ${table.AttendanceTable} (eventid, userid, timestamp) VALUES (${eventid},${userid},'${Date.now()}');`;
    db.run(sql, (err) => {
        if (err) {
          console.error(err.message);
          response.sendStatus(400);
          return;
        }
        response.sendStatus(200);
    });
  });
});

app.get("/makeEvent", (request, response) => {
  let name = request.query.name;
  let description = request.query.description;
  let startdate = request.query.startdate;
  let starttime = request.query.starttime;
  let enddate = request.query.enddate;
  let endtime = request.query.endtime;
  let sql=`SELECT eventtable FROM Businesses WHERE id = 0`;
  db.get(sql, (err, table) => {
    if (err) {
      console.error(err.message);
      response.sendStatus(400);
      return;
    }
    let sql = `INSERT INTO ${table.eventtable} (name, description, startdate, starttime, enddate, endtime) VALUES (${name},${description},'${startdate},'${starttime},'${enddate},'${endtime}');`;
    db.run(sql, (err) => {
        if (err) {
          console.error(err.message);
          response.sendStatus(400);
          return;
        }
        response.sendStatus(200);
    });
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});