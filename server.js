const https = require('https');

// express.js framework
const express = require("express");
const app = express();

// parsing post bodies
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// cors - make server endpoints available on firebase domain
const cors = require('cors')
let corsOptions = {
  origin: 'https://attendancescannerqr.web.app',
}
app.use(cors(corsOptions))

// ============================ PUBLIC (STATIC) FILES ============================
// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// ============================ AUTHENTICATION ============================
const { authRouter } = require('./Auth');
app.use('/', authRouter);

// ============================ PAYMENT ============================
const { paymentRouter } = require('./Payment');
app.use('/', paymentRouter);

// ============================ ATTENDANCE ============================
const { businessRouter } = require('./Business');
app.use('/', businessRouter);

// ============================ SERVER ============================
// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});