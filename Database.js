const fs = require("fs");
// ============================ INIT SQLite DATABASE ============================
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

// ============================ ASYNC DATABASE FUNCTIONS ============================
const asyncGet = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve(result);
    });
  });
};
const asyncAll = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, result) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve(result);
    });
  });
};
const asyncRun = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve();
    });
  });
};
const asyncRunWithID = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) { console.log("error: " + sql); reject(err); }
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