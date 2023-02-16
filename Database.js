// ============================ DATABASE ============================
// init sqlite db
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