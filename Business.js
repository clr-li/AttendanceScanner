// express for routing
const express = require('express'),
  router = express.Router();
// database access
const { asyncGet, asyncAll, asyncRun, asyncRunWithID } = require('./Database');
// user auth
const handleAuth = require('./Auth').handleAuth;
// random universal unique ids for joincodes
const uuid = require('uuid');

// ============================ BUSINESS FUNCTIONS ============================
/**
 * Creates a new business by initializing all the necessary tables in the database.
 * @param {string} uid owner of the business to create
 * @param {string} name name of the business to create 
 * @param {string} subscriptionId id of the subscription used to buy the business
 * @returns the id of the business just created
 */
async function createBusiness(uid, name, subscriptionId) {
  const businessId = await asyncRunWithID(`INSERT INTO Businesses (name, joincode, subscriptionId) VALUES (?, ?, ?)`, [name, uuid.v4(), subscriptionId]);
  await asyncRun(`INSERT INTO Members (business_id, user_id, role) VALUES (?, ?, ?)`, [businessId, uid, 'owner']);
  console.log('Created new business with id: ' + businessId);
  return businessId;
}

/**
 * Deletes a business and all related tables.
 * @param {number} businessId the id of the business to delete
 */
async function deleteBusiness(businessId) { 
  await asyncRun(`DELETE FROM Businesses WHERE id = ?`, [businessId]);
  await asyncRun(`DELETE FROM Members WHERE business_id = ?`, [businessId]);
  await asyncRun(`DELETE FROM Events WHERE business_id = ?`, [businessId]);
  await asyncRun(`DELETE FROM Records WHERE business_id = ?`, [businessId]);
  console.log('Deleted the business with id: ' + businessId);
}

// ============================ BUSINESS ROUTES ============================
/**
 * Gets a list of businesses that the authenticated user is a member of.
 */
router.get("/businesses", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const rows = await asyncAll(`SELECT Businesses.id, Businesses.name, Members.role FROM Businesses INNER JOIN Members on Businesses.id = Members.business_id WHERE Members.user_id = ?`, [uid]);
  response.send(rows);
});

/**
 * Gets the joincode of the specified business.
 * @queryParams businessId - id of the business to get the joincode for
 * @requiredPriviledges read access to the specified business
 */
router.get("/joincode", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, { read: true });
  if (!uid) return;
  
  const businessId = request.query.businessId;

  const row = await asyncGet(`SELECT joincode FROM Businesses WHERE id = ?`, [businessId]);
  response.send(row);
});

/**
 * Joins the specified business if the specified joincode is correct.
 * @queryParams businessId - id of the business to join
 * @queryParams joincode - must be correct to join the business
 * @response 200 OK - if successful, 403 Incorrect joincode - if joincode was incorrect for the specified business.
 */
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
    response.statusMessage = "Incorrect joincode";
    response.sendStatus(403);
  }
});

/**
 * Leaves the specified business if user is not the owner.
 * @queryParams businessId - id of the business to leave
 * @requiredPriviledges member but not owner of the specified business
 * @response 200 - OK; or 403 - [access denied]
 */
router.get('/leave', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { owner: false });
    if (!uid) return;

    const businessId = request.query.businessId;

    await asyncRun(`DELETE FROM Members WHERE business_id = ? AND user_id = ?`, [businessId, uid]);

    response.sendStatus(200);
});

/**
 * Gets data for all the events for the user in the specified business.
 * @queryParams businessId - id of the business to get events for
 * @requiredPriviledges user must be a member of the specified business
 * @response json list of event objects.
 */
router.get("/events", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId);
  if (!uid) return;
  
  const events = await asyncAll(`SELECT id, name, starttimestamp, endtimestamp, description FROM Events WHERE business_id = ?`, [request.query.businessId]);
  
  response.send(events);
});

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

  await asyncRun(`INSERT INTO Records (event_id, business_id, user_id, timestamp, status) VALUES (?, ?, ?, ?, ?)`, [eventid, businessid, userid, Math.round(Date.now() / 1000), status]);
  response.sendStatus(200);
});

/**
 * Returns all the attendance records for the specified business.
 * @queryParams businessId - id of the business to get attendance records for
 * @requiredPriviledges read for the business
 * @response json list of records for all users in the business as well as empty records for users with no attendance records.
 */
router.get("/attendancedata", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, { read: true });
  if (!uid) return;
  
  const businessid = request.query.businessId;

  const attendanceinfo = await asyncAll(`SELECT Users.name, Records.* FROM Records LEFT JOIN Users ON Records.user_id = Users.id WHERE Records.business_id = ? GROUP BY Users.id, Records.event_id ORDER BY Records.timestamp DESC`, [businessid]);
  response.send(attendanceinfo.concat(await asyncAll(`SELECT Users.name, Users.id FROM Members LEFT JOIN Users ON Members.user_id = Users.id WHERE business_id = ?`, [businessid])));
});

router.get("/userdata", async function(request, response) {
    const uid = await handleAuth(request, response, request.query.businessId);
    if (!uid) return;
    
    const businessId = request.query.businessId;

    const numUsers = await asyncGet('SELECT COUNT() FROM Members WHERE business_id = ?', [businessId]);
    const ownerName = await asyncGet("SELECT Users.name FROM Members INNER JOIN Users on Members.user_id = Users.id WHERE Members.business_id = ? AND Members.role = 'owner'", [businessId]);
    const userEvents = await asyncAll(`SELECT Events.name, Events.starttimestamp, Events.endtimestamp, Records.status, Records.timestamp FROM Records RIGHT JOIN Events ON Events.id = Records.event_id WHERE (Records.user_id = ? OR Records.user_id is NULL) AND Events.business_id = ?`, [uid, businessId]);

    response.send({ numUsers: numUsers['COUNT()'], ownerName: ownerName.name, userEvents: userEvents });
});

/**
 * Gets all the attendance records for the current user within a business.
 * @queryParams businessId - id of the business to get attendance records within
 * @requiredPriviledges member of the business
 * @response json list of records for the current user within the specified business.
 */
router.get("/userEvents", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId);
  if (!uid) return;
  
  const businessId = request.query.businessId;

  response.send(await asyncAll(`SELECT Events.name, Events.starttimestamp, Events.endtimestamp, Records.status, Records.timestamp FROM Records RIGHT JOIN Events ON Events.id = Records.event_id WHERE (Records.user_id = ? OR Records.user_id is NULL) AND Events.business_id = ?`, [uid, businessId]));
});

/**
 * Creates a new event for the specified business.
 * @queryParams businessId - id of the business to create an event for
 * @queryParams name - name of the event to create
 * @queryParams description - description of the event to create
 * @queryParams starttimestamp - unix epoch timestamp in seconds for when the event is supposed to start
 * @queryParams endtimestamp - unix epoch timestamp in seconds for when the event is supposed to end
 * @requiredPriviledges write access for the business
 * @response id of the newly created event.
 */
router.get("/makeEvent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, { write: true });
  if (!uid) return;
  
  const businessId = request.query.businessId;
  const name = request.query.name;
  const description = request.query.description;
  const starttimestamp = request.query.starttimestamp;
  const endtimestamp = request.query.endtimestamp;

  const eventid = await asyncRunWithID('INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)', [businessId, name, description, starttimestamp, endtimestamp]);
  response.send("" + eventid);
});

function createEventSequence(startDate, endDate, businessId, name, description, repeatId, frequency, interval) {
    let current = startDate;
    while (current < endDate) {
        const currentEndDate = new Date(endDate);
        if (frequency === "monthly")
            currentEndDate.setMonth(current.getMonth());
        currentEndDate.setDate(current.getDate());
        asyncRunWithID('INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp, repeat_id) VALUES (?, ?, ?, ?, ?, ?)',
            [businessId, name, description, current.getTime() / 1000, currentEndDate.getTime() / 1000, repeatId]);
        if (frequency === "daily")
            current.setDate(current.getDate() + interval);
        else if (frequency === "weekly")
            current.setDate(current.getDate() + 7 * interval);
        else if (frequency === "monthly")
            current.setMonth(current.getMonth() + interval);
    }
}

/**
 * Creates a bunch of events for the specified business.
 * @queryParams businessId - id of the business to create an event for
 * @queryParams name - name of the event to create
 * @queryParams description - description of the event to create
 * @queryParams starttimestamp - unix epoch timestamp in seconds for when the event is supposed to start
 * @queryParams endtimestamp - unix epoch timestamp in seconds for when the event is supposed to end
 * @queryParams frequency - the unit of time to repeat (daily, weekly, monthly)
 * @queryParams interval - the number of frequency units between events
 * @queryParams daysoftheweek - comma-separated values from 0-6 indicating the day of the week starting from Sunday
 * @requiredPriviledges write access for the business
 * @response id of the newly created event.
 */
router.get("/makeRecurringEvent", async function(request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;
    
    const businessId = request.query.businessId;
    const name = request.query.name;
    const description = request.query.description;
    const startDate = new Date(parseInt(request.query.starttimestamp)*1000);
    const endDate = new Date(parseInt(request.query.endtimestamp)*1000);
    const frequency = request.query.frequency;
    const interval = parseInt(request.query.interval);
    const daysoftheweek = request.query.daysoftheweek;
    const repeatId = uuid.v4();

    if (frequency == "weekly" && daysoftheweek.length > 0) {
        for (const day of daysoftheweek.split(",")) {
            const newStartDate = new Date(startDate);
            const daysToAdd = (7 + parseInt(day) - newStartDate.getDay()) % 7;
            newStartDate.setDate(newStartDate.getDate() + daysToAdd);
            createEventSequence(newStartDate, endDate, businessId, name, description, repeatId, frequency, interval);
        }
    } else {
        createEventSequence(startDate, endDate, businessId, name, description, repeatId, frequency, interval);
    }

    response.sendStatus(200);
});

/**
 * Updates event info for the specified business and event.
 * @queryParams businessId - id of the business to update event info for
 * @queryParams eventid - id of the event to update
 * @queryParams name - updated event name
 * @queryParams description - updated event description
 * @queryParams starttimestamp - unix epoch timestamp in seconds for when the updated event is supposed to start
 * @queryParams endtimestamp - unix epoch timestamp in seconds for when the updated event is supposed to end
 * @requiredPriviledges write access for the business
 * @response 200 OK
 */
router.get("/updateevent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, { write: true });
  if (!uid) return;
  
  const businessId = request.query.businessId;
  const name = request.query.name;
  const description = request.query.description;
  const starttimestamp = request.query.starttimestamp;
  const endtimestamp = request.query.endtimestamp;
  const eventid = request.query.eventid;
  
  await asyncRun(`UPDATE Events SET name = ?, starttimestamp = ?, endtimestamp = ?, description = ? WHERE business_id = ? AND id = ? `,
                [name, starttimestamp, endtimestamp, description, businessId, eventid]);
  response.sendStatus(200);
});

/**
 * Deletes the specified event for the specified business.
 * @queryParams businessId - id of the business to delete the event from
 * @queryParams eventid - id of the event to delete
 * @requiredPriviledges write access for the business
 * @response 200 OK
 */
router.get("/deleteevent", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, { write: true });
  if (!uid) return;
  
  const businessId = request.query.businessId;
  const eventid = request.query.eventid;

  await asyncRun(`DELETE FROM Events WHERE business_id = ? AND id = ?`, [businessId, eventid]);
  response.sendStatus(200);
});

/**
 * Gets all info associated with the specified event 
 * @queryParams businessId - id of the business to get the event from
 * @queryParams eventid - id of the event to get
 * @requiredPriviledges read access for the business
 * @response json object representing the event info
 */
router.get("/eventdata", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, { read: true });
  if (!uid) return;
  
  const businessId = request.query.businessId;
  const eventid = request.query.eventid;
  
  const eventinfo = await asyncGet(`SELECT * FROM Events WHERE business_id = ? AND id = ?`, [businessId, eventid]);
  response.send(eventinfo);
});

// ============================ BUSINESS EXPORTS ============================
exports.businessRouter = router;
exports.createBusiness = createBusiness;
exports.deleteBusiness = deleteBusiness;