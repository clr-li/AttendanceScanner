'use strict';

// express for routing
const express = require('express'),
  router = express.Router();
// database access
const { asyncGet, asyncAll, asyncRun, asyncRunWithID, asyncRunWithChanges } = require('./Database');
// user auth
const { handleAuth, getAccess } = require('./Auth');
// random universal unique ids for joincodes
const uuid = require('uuid');
// persistent storage for temporary attendance codes
const storage = require('node-persist');
storage.init({
  dir: '.data/tempEventAttendanceCodesByBusiness',
  ttl: 300_000, // 5 minutes
});

// ============================ SCAN ATTENDANCE ============================

/**
 * Records an attendance scan of a user for a specific business and event.
 * @queryParams eventid - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @queryParams userid - the user to record attendance of
 * @queryParams status - the attendance status to note down
 * @requiredPriviledges scanner for the business
 * @response 200 OK if successful
 */
router.get("/recordAttendance", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, { scanner: true });
  if (!uid) return;
  
  const eventid = request.query.eventid;
  const businessid = request.query.businessId;
  const userid = request.query.userid;
  const status = request.query.status;

  if (!(await getAccess(userid, businessid, {}))) {
    response.statusMessage = "Cannot take attendance for non-member";
    response.sendStatus(400);
    return;
  }

  await asyncRun(`INSERT INTO Records (event_id, business_id, user_id, timestamp, status) VALUES (?, ?, ?, ?, ?)`, [eventid, businessid, userid, Math.round(Date.now() / 1000), status]);
  response.sendStatus(200);
});

// ============================ ADMIN MODIFY ATTENDANCE ============================
/**
 * Records a new attendance record for multiple users
 * @queryParams event - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @queryParams ids - comma separated string of userids to record attendance for
 * @queryParams status - the attendance status to note down
 * @requiredPriviledges write for the business
 * @response 200 OK if successful
 */
router.get("/alterAttendance", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, { write: true });
  if (!uid) return;
  
  const businessId = request.query.businessId;
  const ids = request.query.ids;
  const event = request.query.event;
  const status = request.query.status;

  for (const id of ids.split(',')) {
    await asyncRun(`INSERT INTO Records(status, business_id, event_id, user_id, timestamp) VALUES (?, ?, ?, ?, ?)`, [status, businessId, event, id, Math.round(Date.now() / 1000)]);
  }
  response.sendStatus(200);
});


// ============================ TEMPORARY ATTENDANCE CODES ============================
/**
 * Generates a new temporary attendance code for the specified business and event that can be used to record attendance.
 * @queryParams eventid - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @queryParams expiration - time from now in milliseconds to expire the code (default: 10 seconds)
 * @requiredPriviledges scanner for the business
 * @response the code to take attendance with
 */
router.get("/setNewTempAttendanceCode", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, { scanner: true });
  if (!uid) return;

  const eventid = request.query.eventid;
  const businessid = request.query.businessId;
  const expiration = parseInt(request.query.expiration) || 10_000;
  const key = eventid + "-" + businessid;

  const code = uuid.v4().split('-')[0];
  await storage.setItem(key, code, { ttl: expiration });
  
  response.status(200);
  response.send(code);
});

/**
 * Refresh attendance code for the specified business and event that can be used to record attendance.
 * @queryParams eventid - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @queryParams expiration - time from now in milliseconds to expire the code (default: 10 seconds)
 * @queryParams code - the attendance code to refresh to if no code is present
 * @requiredPriviledges scanner for the business
 * @response 200 OK if successful, 400 if no code to refresh
 */
router.get("/refreshTempAttendanceCode", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, { scanner: true });
  if (!uid) return;

  const eventid = request.query.eventid;
  const businessid = request.query.businessId;
  const expiration = parseInt(request.query.expiration) || 10_000;
  const clientCode = request.query.code;
  const key = eventid + "-" + businessid;

  const code = await storage.getItem(key) || clientCode;
  if (clientCode && clientCode !== code) {
    response.statusMessage = "Invalid code, perhaps it was updated in another tab?";
    response.sendStatus(400);
    return;
  }
  if (!code) {
    response.statusMessage = "No code to refresh";
    response.sendStatus(400);
    return;
  }
  storage.setItem(key, code, { ttl: expiration });
  
  response.sendStatus(200);
});

/**
 * Gets or sets the temporary attendance code for the specified business and event that can be used to record attendance.
 * @queryParams eventid - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @requiredPriviledges scanner for the business
 * @response the code to take attendance with, does not refresh expiration time.
 */
router.get("/getOrSetTempAttendanceCode", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, { scanner: true });
  if (!uid) return;

  const eventid = request.query.eventid;
  const businessid = request.query.businessId;
  const key = eventid + "-" + businessid;

  if (!await storage.getItem(key)) {
    const code = uuid.v4().split('-')[0];
    await storage.setItem(key, code);
    response.status(200);
    response.send(code);
    return;
  }

  response.status(200);
  response.send(await storage.getItem(key));
});

/**
 * Records an attendance scan for the currently logged in user for a specific business and event.
 * @queryParams eventid - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @queryParams code - the attendance code to check against
 * @queryParams status - the attendance status to note down
 * @requiredPriviledges member of the business
 * @response 200 OK if successful, 400 if invalid code
 */
router.get("/recordMyAttendance", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, {});
  if (!uid) return;
  
  const eventid = request.query.eventid;
  const businessId = request.query.businessId;
  const status = request.query.status;
  const code = request.query.code;
  const key = eventid + "-" + businessId;

  if (await storage.getItem(key) !== code || !code) {
    response.statusMessage = "Invalid/Expired code";
    response.sendStatus(400);
    return;
  }

  await asyncRun(`INSERT INTO Records (event_id, business_id, user_id, timestamp, status) VALUES (?, ?, ?, ?, ?)`, [eventid, businessId, uid, Math.round(Date.now() / 1000), status]);
  response.sendStatus(200);
});

// ============================ ATTENDANCE EXPORTS ============================
exports.attendanceRouter = router;