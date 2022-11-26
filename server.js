const express = require("express");
// const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());

const https = require('https');
// const { createProxyMiddleware } = require('http-proxy-middleware');
const { exec } = require("child_process"); 


var admin = require("firebase-admin");

var serviceAccount = require(process.env.ADMINKEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function getLoggedInUser(idToken) {
  // idToken comes from the client app
  admin.getAuth()
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

// host static files in /public/ with firebase
// const firebaseport = parseInt(process.env.PORT) + 1;
// exec("firebase serve -o 127.0.0.1 --token " + process.env.TOKEN + " --port=" + firebaseport, (error, stdout, stderr) => {
//     if (error) {
//         console.log(error.message);
//         return;
//     }
//     if (stderr) {
//         console.log(stderr);
//         return;
//     }
//     console.log(`Output: ${stdout}`);
// });

// var fireProxy = createProxyMiddleware('/', {
//     target: `127.0.0.1:${firebaseport}`,
// });

// app.use('/', fireProxy);


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