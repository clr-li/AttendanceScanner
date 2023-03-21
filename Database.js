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
const asyncGet = (sql, params=[]) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, result) => {
            if (err) { console.log("sql error: " + sql); reject(err); }
            else resolve(result);
        });
    });
};

const asyncAll = (sql, params=[]) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, result) => {
            if (err) { console.log("sql error: " + sql); reject(err); }
            else resolve(result);
        });
    });
};

const asyncRun = (sql, params=[]) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) { console.log("sql error: " + sql); reject(err); }
            else resolve();
        });
    });
};

const asyncRunWithID = (sql, params=[]) => {
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