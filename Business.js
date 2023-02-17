// express for routing
const express = require('express'),
  router = express.Router();
// database access
const {db, asyncGet, asyncAll, asyncRun, asyncRunWithID} = require('./Database');
// user auth
const handleAuth = require('./Auth').handleAuth;
// random universal unique ids for joincodes
const uuid = require('uuid');

// ============================ BUSINESS SETTINGS ============================


// ============================ BUSINESS FUNCTIONS ============================
async function createBusiness(uid, name) {
  const user = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
  if (user.BusinessIDs) return
  
  const businessID = await asyncRunWithID(`INSERT INTO Businesses (Name, AttendanceTable, usertable, eventtable, roleaccess, joincode) VALUES (?, ?, ?, ?, ?, ?) `, [
    name, attendanceTableName, userTableName, eventTableName, '{"admin":{"admin":true,"scanner":true}}', uuid.v4()
  ]);
  console.log('Created new business with id: ' + businessId);
  await asyncRun('UPDATE Users SET BusinessIDs = ? WHERE id = ?', [businessID, uid]);
  await asyncRun(`INSERT INTO "${userTableName}" (userid, role) VALUES (?, ?)`, [uid, 'admin']);
}

async function deleteBusiness(uids, businessID) {
  await asyncRun(`UPDATE Users SET BusinessIDs = NULL WHERE id IN ('${uids.join("', '")}')`);
 
  const tables = await asyncGet(`SELECT AttendanceTable, usertable, eventtable FROM Businesses WHERE id = ?`, [businessID]);
  await asyncRun(`DROP TABLE "${tables.AttendanceTable}"`);
  await asyncRun(`DROP TABLE "${tables.usertable}"`);
  await asyncRun(`DROP TABLE "${tables.eventtable}"`);
  await asyncRun(`DELETE FROM Businesses WHERE id = ?`, [businessID]);
  
  console.log('Deleted the business with id: ' + businessID);
}

// ============================ BUSINESS ROUTES ============================
router.get("/business", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
  const row = await asyncGet(`SELECT Name FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  response.send(row);
});

router.get("/joincode", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
  const row = await asyncGet(`SELECT id, joincode FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  response.send(row);
});

router.get("/join", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const businessId = request.query.businessId;
  const joincode = request.query.code;
  // const email = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
  const row = await asyncGet(`SELECT joincode, usertable, pendingemails FROM Businesses WHERE id = ?`, [businessId]);
  if (row.joincode === joincode) {
      await asyncRun(`INSERT OR IGNORE INTO "${row.usertable}" (userid, role) VALUES (?, 'user')`, [uid]);
    response.sendStatus(200);
  } else {
    response.sendStatus(403);
  }
});

router.get("/events", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, {scanner: true});
  if (!uid) return;
  
  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);

  const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  const events = await asyncAll(`SELECT id, name, starttimestamp, endtimestamp, userids, description FROM "${table.eventtable}"`);
  response.status = 200;
  response.send(events);
});

router.get("/recordAttendance", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, {scanner: true});
  if (!uid) return;
  
  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);

  const eventid = request.query.eventid;
  const userid = request.query.userid;
  const status = request.query.status;

  const table = await asyncGet(`SELECT AttendanceTable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  await asyncRun(`INSERT INTO "${table.AttendanceTable}" (eventid, userid, timestamp, status) VALUES (?, ?, ?, ?)`, [eventid, userid, Date.now(), status]);
  response.sendStatus(200);
});

router.get("/attendancedata", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {admin: true});
  if (!uid) return;
  
  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
  
  const eventid = request.query.eventid;
  const userid = request.query.userid;

  const table = await asyncGet(`SELECT AttendanceTable, usertable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  console.log(table)
  let sql = `SELECT Users.firstname, Users.lastname, "${table.AttendanceTable}".* FROM "${table.AttendanceTable}" LEFT JOIN Users ON "${table.AttendanceTable}".userid = Users.id GROUP BY Users.id, "${table.AttendanceTable}".eventid ORDER BY "${table.AttendanceTable}".timestamp DESC`;
  if (eventid == "*" && userid == "*") {
    var attendanceinfo = await asyncAll(sql);
  } else if (eventid == "*") {
    var attendanceinfo = await asyncAll(sql + "WHERE userid = ?", [userid]);
  } else if (userid == "*") {
    var attendanceinfo = await asyncAll(sql + "WHERE eventid = ?", [eventid]);
  } else {
    var attendanceinfo = await asyncAll(sql + "WHERE eventid = ? AND userid = ?", [eventid, userid]);
  }
  if (userid == "*") {
    let userids = new Set();
    attendanceinfo.forEach((attendanceRecord) => {
      userids.add(attendanceRecord.userid);
    });
    sql = `SELECT Users.firstname, Users.lastname, "${table.usertable}".userid FROM "${table.usertable}" LEFT JOIN Users ON "${table.usertable}".userid = Users.id WHERE `;
    userids.forEach((uID) => {
      sql += `"${uID}" != "${table.usertable}".userid AND `;
    });
    if (userids.size === 0) {
      sql = sql.substr(0, sql.length - 7);
    } else {
      sql = sql.substr(0, sql.length - 5);
    }
    attendanceinfo = attendanceinfo.concat(await asyncAll(sql));
  }
  response.send(attendanceinfo);
});

// router.get("/getBusinesses", async function(request, response) {
//   let sql = `SELECT`
// });

router.get("/makeEvent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {admin: true});
  if (!uid) return;
  
  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);

  const name = request.query.name;
  const description = request.query.description;
  const starttimestamp = request.query.starttimestamp;
  const endtimestamp = request.query.endtimestamp;
  const userids = request.query.userids;

  const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  await asyncRun(`INSERT INTO "${table.eventtable}" (name, starttimestamp, endtimestamp, userids, description) VALUES (?, ?, ?, ?, ?)`,
                [name, starttimestamp, endtimestamp, userids, description]);
  const eventid = await asyncGet(`SELECT last_insert_rowid() FROM "${table.eventtable}"`);
  response.status(200);
  response.send(eventid);
});

router.get("/updateevent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {admin: true});
  if (!uid) return;
  
  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);

  const name = request.query.name;
  const description = request.query.description;
  const starttimestamp = request.query.starttimestamp;
  const endtimestamp = request.query.endtimestamp;
  const eventid = request.query.eventid;

  const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  await asyncRun(`UPDATE "${table.eventtable}" SET name = ?, starttimestamp = ?, endtimestamp = ?, description = ? WHERE id = ?`,
                [name, starttimestamp, endtimestamp, description, eventid]);
  response.sendStatus(200);
});

router.get("/deleteevent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {admin: true});
  if (!uid) return;
  
  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);

  const eventid = request.query.eventid;

  const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  await asyncRun(`DELETE FROM "${table.eventtable}" WHERE id = ?`, [eventid]);
  response.sendStatus(200);
});

router.get("/eventdata", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {admin: true});
  if (!uid) return;
  
  const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);

  const eventid = request.query.eventid;
  
  const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
  const eventinfo = await asyncGet(`SELECT * FROM "${table.eventtable}" WHERE id = ?`, [eventid]);
  response.send(eventinfo);
});

// ============================ BUSINESS EXPORTS ============================
exports.businessRouter = router;