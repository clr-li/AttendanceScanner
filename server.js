const express = require("express");
// const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());

const https = require('https');

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
         WHERE id = ?`;
  let id = 0;

  db.get(sql, id, (err, row) => {
    if (err) {
      return console.error(err.message);
    }
    console.log(row);
    response.send(row);
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});