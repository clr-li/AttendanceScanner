'use strict';

// express.js framework
const express = require('express');
const app = express();

// parsing post bodies
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// cors - make server endpoints available on firebase domain
const cors = require('cors');
let corsOptions = {
    origin: 'https://attendancescannerqr.web.app',
};
app.use(cors(corsOptions));

// ============================ PUBLIC (STATIC) FILES ============================
// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// ============================ DATABASE ============================
const schemaFile = './server/databaseSchema.sql'; // filepath for the database schema
module.exports.initPromise = require('./Database').reinitializeIfNotExists(
    process.env.DB_FILE,
    schemaFile,
);

// ============================ SUPER ADMIN ============================
// for modifying and viewing database contents without manually running SQL commands
// go to http://localhost:3000/super_admin/ to view
if (process.env.DB_FILE !== ':memory:') {
    module.exports.initPromise.then(() => {
        const { superAdminRouter } = require('./SuperAdmin');
        app.use('/super_admin', superAdminRouter);
    });
}

// ============================ AUTHENTICATION ============================
const { authRouter } = require('./Auth');
app.use('/', authRouter);

// ============================ PAYMENT ============================
const { paymentRouter } = require('./Payment');
app.use('/', paymentRouter);

// ============================ BUSINESS ============================
const { businessRouter } = require('./Business');
app.use('/', businessRouter);

// ============================ ATTENDANCE ============================
const { attendanceRouter } = require('./Attendance');
app.use('/', attendanceRouter);

// ============================ EVENTS ============================
const { eventRouter } = require('./Event');
app.use('/', eventRouter);

// ============================ SERVER ============================
// listen for requests :)
module.exports.app = app;
module.exports.listener = app.listen(process.env.PORT, () => {
    console.log(`Your app is listening on port ${module.exports.listener.address().port}`);
});
