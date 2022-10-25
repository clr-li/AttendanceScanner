const express = require("express");
// const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());

const https = require('https');

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

app.get("/hi", (request, response) => {
  response.send('hi');
});

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});