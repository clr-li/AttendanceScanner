// express for routing
const express = require('express'),
  router = express.Router();
// database access
const {db, asyncGet, asyncAll, asyncRun, asyncRunWithID} = require('./Database');
// user auth
const handleAuth = require('./Auth').handleAuth;
// random universal unique ids for joincodes
const uuid = require('uuid');

// ============================ BUSINESS FUNCTIONS ============================
async function createBusiness(uid, name) {
  const businessId = await asyncRunWithID(`INSERT INTO Businesses (name, joincode) VALUES (?, ?)`, [name, uuid.v4()]);
  await asyncRun(`INSERT INTO Members (business_id, user_id, role) VALUES (?, ?, ?)`, [businessId, uid, 'owner']);
  console.log('Created new business with id: ' + businessId);
}

async function deleteBusiness(uids, businessId) { 
  await asyncRun(`DELETE FROM Businesses WHERE id = ?`, [businessId]);
  await asyncRun(`DELETE FROM Members WHERE business_id = ?`, [businessId]);
  await asyncRun(`DELETE FROM Events WHERE business_id = ?`, [businessId]);
  await asyncRun(`DELETE FROM Records WHERE business_id = ?`, [businessId]);
  console.log('Deleted the business with id: ' + businessId);
}

// ============================ BUSINESS ROUTES ============================
router.get("/businesses", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const rows = await asyncAll(`SELECT Businesses.id, Businesses.name, Members.role FROM Businesses INNER JOIN Members on Businesses.id = Members.business_id WHERE Members.user_id = ?`, [uid]);
  response.send(rows);
});

router.get("/joincode", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, {read: true});
  if (!uid) return;
  
  const businessId = request.query.businessId;

  const row = await asyncGet(`SELECT joincode FROM Businesses WHERE id = ?`, [businessId]);
  response.send(row);
});

router.get("/join", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const businessId = request.query.businessId;
  const joincode = request.query.code;

  const row = await asyncGet(`SELECT joincode FROM Businesses WHERE id = ?`, [businessId]);
  if (row.joincode === joincode) {
    await asyncRun(`INSERT OR IGNORE INTO Members (business_id, user_id, role) VALUES (?, ?, 'user')`, [businessId, uid]);
    response.sendStatus(200);
  } else {
    response.sendStatus(403);
  }
});

router.get("/events", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId);
  if (!uid) return;
  
  const events = await asyncAll(`SELECT id, name, starttimestamp, endtimestamp, description FROM Events WHERE business_id = ?`, [request.query.businessId]);
  
  response.send(events);
});

router.get("/recordAttendance", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, {scanner: true});
  if (!uid) return;
  
  const eventid = request.query.eventid;
  const businessid = request.query.businessId;
  const userid = request.query.userid;
  const status = request.query.status;

  await asyncRun(`INSERT INTO Records (event_id, business_id, user_id, timestamp, status) VALUES (?, ?, ?, ?, ?)`, [eventid, businessid, userid, Math.round(Date.now() / 1000), status]);
  response.sendStatus(200);
});

router.get("/attendancedata", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {read: true});
  if (!uid) return;
  
  const eventid = request.query.eventid;
  const userid = request.query.userid;
  const businessid = request.query.businessId;

  const attendanceinfo = await asyncAll(`SELECT Users.name, Records.* FROM Records LEFT JOIN Users ON Records.user_id = Users.id WHERE Records.business_id = ? GROUP BY Users.id, Records.event_id ORDER BY Records.timestamp DESC`, [businessid]);
  response.send(attendanceinfo.concat(await asyncAll(`SELECT Users.name, Users.id FROM Members LEFT JOIN Users ON Members.user_id = Users.id WHERE business_id = ?`, [businessid])));
});

router.get("/userdata", async function(request, response) {
  const uid = await handleAuth(request, response);
  if (!uid) return;
  
  const businessId = request.query.businessId;
  response.send(await asyncAll(`SELECT Events.name, Events.starttimestamp, Events.endtimestamp, Records.status, Records.timestamp FROM Records, Events WHERE Records.user_id = ? AND Records.business_id = ?`, [uid, businessId]));
})

router.get("/makeEvent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {write: true});
  if (!uid) return;
  
  const id = request.query.businessId;
  const name = request.query.name;
  const description = request.query.description;
  const starttimestamp = request.query.starttimestamp;
  const endtimestamp = request.query.endtimestamp;
  const userids = request.query.userids;

  const eventid = await asyncRunWithID('INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)', [id, name, description, starttimestamp, endtimestamp]);
  response.status(200);
  response.send(eventid);
});

router.get("/updateevent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {write: true});
  if (!uid) return;
  
  const id = request.query.businessId;

  const name = request.query.name;
  const description = request.query.description;
  const starttimestamp = request.query.starttimestamp;
  const endtimestamp = request.query.endtimestamp;
  const eventid = request.query.eventid;
  
  await asyncRun(`UPDATE Events SET name = ?, starttimestamp = ?, endtimestamp = ?, description = ? WHERE business_id = ? AND id = ? `,
                [name, starttimestamp, endtimestamp, description, id, eventid]);
  response.sendStatus(200);
});

router.get("/deleteevent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {write: true});
  if (!uid) return;
  
  const id = request.query.businessId;
  const eventid = request.query.eventid;

  await asyncRun(`DELETE FROM Events WHERE business_id = ? AND id = ?`, [id, eventid]);
  response.sendStatus(200);
});

router.get("/eventdata", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, {read: true});
  if (!uid) return;
  
  const id = request.query.businessId;
  const eventid = request.query.eventid;
  
  const eventinfo = await asyncGet(`SELECT * FROM Events WHERE business_id = ? AND id = ?`, [id, eventid]);
  response.send(eventinfo);
});

// ============================ BUSINESS EXPORTS ============================
exports.businessRouter = router;
exports.createBusiness = createBusiness;
exports.deleteBusiness = deleteBusiness;