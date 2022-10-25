const express = require("express");
// const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());

const https = require('https');

// init sqlite db
const dbFile = "./.data/businesses.db";
const exists = fs.existsSync(dbFile);
let db = null;
if (!exists) {
  console.log("no database file found :(");
}
else {
  const sqlite3 = require("sqlite3").verbose();
  db = new sqlite3.Database(dbFile);
}

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

app.get("/hi", (request, response) => {
  response.send('hi');
});

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});