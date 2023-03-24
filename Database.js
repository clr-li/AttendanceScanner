const fs = require("fs");
const sqlite3 = require('sqlite3').verbose();

// ============================ DATABASE SETTINGS ============================
const dbFile = "./.data/ATT.db"; // filepath for the database

// ============================ INIT SQLite DATABASE ============================
const exists = fs.existsSync(dbFile);
const db = new sqlite3.Database(dbFile);
if (!exists) {
    console.log("no database file found, writing a new one!");
    const schema = fs.readFileSync('./databaseSchema.sql', 'utf8');
    db.serialize(() => {
        for (const sql of schema.split(";")) {
            if (sql) db.run(sql, (err) => {
                if (err) console.error("Failed to initialize database: " + err + "\n SQL: " + sql);
            });
        }
    });
}

// ============================ ASYNC DATABASE FUNCTIONS ============================
/**
 * Gets the first result of the sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns a Promise of an object representing the first result of the sql query.
 */
function asyncGet(sql, params=[]) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, result) => {
            if (err) { console.log("sql error: " + sql); reject(err); }
            else resolve(result);
        });
    });
};

/**
 * Gets all the results of the sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns a Promise of an array representing all the results of the sql query.
 */
function asyncAll(sql, params=[]) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, result) => {
            if (err) { console.log("sql error: " + sql); reject(err); }
            else resolve(result);
        });
    });
};

/**
 * Runs a sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns Promise<void>
 */
function asyncRun(sql, params=[]) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) { console.log("sql error: " + sql); reject(err); }
            else resolve();
        });
    });
};

/**
 * Runs a sql query on the database and gets the id of the last inserted row.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @requires sql should be an INSERT statement
 * @returns a Promise of the id of the last inserted row (if the sql query was an INSERT statement!).
 */
function asyncRunWithID(sql, params=[]) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) { console.log("sql error: " + sql); reject(err); }
            else resolve(this.lastID);
        });
    });
};

// ============================ MODULE EXPORTS ============================
exports.db = db
exports.asyncGet = asyncGet
exports.asyncAll = asyncAll
exports.asyncRun = asyncRun
exports.asyncRunWithID = asyncRunWithID