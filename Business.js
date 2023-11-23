// express for routing
const express = require('express'),
  router = express.Router();
// database access
const { asyncGet, asyncAll, asyncRun, asyncRunWithID, asyncRunWithChanges } = require('./Database');
// user auth
const { handleAuth, getAccess } = require('./Auth');
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

  const rows = await asyncAll(`SELECT Businesses.id, Businesses.name, Members.role FROM Businesses INNER JOIN Members on Businesses.id = Members.business_id AND Members.user_id = ?`, [uid]);
  response.send(rows);
});

router.get("/renameBusiness", async (request, response) => {
  const uid = await handleAuth(request, response, request.query.businessId, { owner: true });
  if (!uid) return;

  const name = request.query.name;
  const businessId = request.query.businessId;

  await asyncRun("UPDATE Businesses SET name = ? WHERE id = ?", [name, businessId]);
  response.sendStatus(200);
}); 

/**
 * Gets the joincode of the specified business.
 * @queryParams businessId - id of the business to get the joincode for
 * @requiredPrivileges read access to the specified business
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
    response.status(403).send("Incorrect joincode. Please check for typos or reach out to your group admin.");
  }
});

/**
 * Leaves the specified business if user is not the owner.
 * @queryParams businessId - id of the business to leave
 * @requiredPrivileges member but not owner of the specified business
 * @response 200 - OK; or 403 - [access denied]
 */
router.get('/leave', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { owner: false });
    if (!uid) return;

    const businessId = request.query.businessId;

    await asyncRun(`DELETE FROM Members WHERE business_id = ? AND user_id = ?`, [businessId, uid]);

    response.sendStatus(200);
});

router.get('/removeMember', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const userId = request.query.userId;

    if (await getAccess(userId, businessId, { owner: false })) {
        await asyncRun(`DELETE FROM Members WHERE business_id = ? AND user_id = ?`, [businessId, userId]);
        response.sendStatus(200);
    } else {
        response.status(400).send("Cannot remove non-members or owners");
    }
});

/**
 * Returns all the attendance records for the specified business.
 * @queryParams businessId - id of the business to get attendance records for
 * @requiredPrivileges read for the business
 * @response json list of records for all users in the business as well as empty records for users with no attendance records.
 */
router.get("/attendancedata", async function(request, response) {
  const uid = await handleAuth(request, response, request.query.businessId, { read: true });
  if (!uid) return;
  
  const businessid = request.query.businessId;
  const attendanceinfo = await asyncAll(`
    SELECT 
      UserData.name, Records.*, UserData.role
    FROM
      Records 
      INNER JOIN (SELECT * FROM Users INNER JOIN Members ON Members.user_id = Users.id WHERE Members.business_id = ?) as UserData ON Records.user_id = UserData.id
    WHERE 
      Records.business_id = ? 
    GROUP BY 
      UserData.id,
      Records.event_id,
      UserData.role
    ORDER BY
      UserData.role ASC,
      Records.timestamp DESC`, 
    [businessid, businessid]);
  response.send(attendanceinfo.concat(await asyncAll(`SELECT Users.name, Users.id, role FROM Members LEFT JOIN Users ON Members.user_id = Users.id WHERE business_id = ? ORDER BY Members.role`, [businessid])));
});

/**
 * Gets all the metadata of a business that a user is a member of.
 * @queryParams businessId - id of the business to get metadata for
 * @requiredPrivileges member of the business
 * @response json object with a user count `numUsers` number, an `ownerName` string, and a list of `userEvents`.
 */
router.get("/userdata", async function(request, response) {
    const uid = await handleAuth(request, response, request.query.businessId);
    if (!uid) return;
    
    const businessId = request.query.businessId;

    const numUsers = await asyncGet('SELECT COUNT() FROM Members WHERE business_id = ?', [businessId]);
    const ownerName = await asyncGet("SELECT Users.name FROM Members INNER JOIN Users on Members.user_id = Users.id WHERE Members.business_id = ? AND Members.role = 'owner'", [businessId]);
    const userEvents = await asyncAll(`SELECT Events.name, Events.starttimestamp, Events.endtimestamp, Records.status, Records.timestamp FROM Records RIGHT JOIN Events ON Events.id = Records.event_id AND (Records.user_id = ? OR Records.user_id is NULL) WHERE Events.business_id = ?`, [uid, businessId]);

    response.send({ numUsers: numUsers['COUNT()'], ownerName: ownerName.name, userEvents: userEvents });
});

/**
 * Assign a role to a user in the specified business.
 * @queryParams businessId - id of the business to assign a role in
 * @queryParams userId - id of the user to assign a role to
 * @queryParams role - role to assign to the user
 * @requiredPrivileges assignRoles for the business
 * @response 200 OK if successful, 403 if user is an owner or nothing changed
 */
router.get('/assignRole', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { assignRoles: true });
    if (!uid) return;

    const businessId = parseInt(request.query.businessId);
    const userid = request.query.userId;
    const role = request.query.role;

    if (role === "owner") {
        response.status(403).send("Cannot assign owner role");
        return;
    }

    const changes = await asyncRunWithChanges(`UPDATE Members SET role = ? WHERE business_id = ? AND user_id = ? AND role != 'owner'`,
        [role, businessId, userid]);
    
    if (changes != 0) {
        response.status(200).send("Role assigned");
    } else {
        response.status(403).send("Role not changed. Check your role and its privileges.");
    }
});

// ============================ USER ROUTES ============================
/**
 * Updates the name of the authenticated user.
 * @queryParams name - the new name of the user.
 * @response 200 OK - if successful.
 */
router.get("/changeName", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const name = request.query.name;

  await asyncRun("UPDATE Users SET name = ? WHERE id = ?", [name, uid]);
  response.sendStatus(200);
}); 

/**
 * Gets the name of the user
 * @queryParams name - the new name of the user.
 * @response 200 OK - if successful.
 */
router.get("/getName", async (request, response) => {
  const uid = await handleAuth(request, response);
  if (!uid) return;

  const name = await asyncGet("SELECT name FROM Users WHERE id = ?", [uid]);
  response.send(name);
}); 

// ============================ BUSINESS EXPORTS ============================
exports.businessRouter = router;
exports.createBusiness = createBusiness;
exports.deleteBusiness = deleteBusiness;