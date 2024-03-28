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
    const businessId = await asyncRunWithID(
        `INSERT INTO Businesses (name, joincode, subscriptionId) VALUES (?, ?, ?)`,
        [name, uuid.v4(), subscriptionId],
    );
    await asyncRun(`INSERT INTO Members (business_id, user_id, role) VALUES (?, ?, ?)`, [
        businessId,
        uid,
        'owner',
    ]);
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
router.get('/businesses', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const rows = await asyncAll(
        `SELECT Businesses.id, Businesses.name, Members.role FROM Businesses INNER JOIN Members on Businesses.id = Members.business_id AND Members.user_id = ?`,
        [uid],
    );
    response.send(rows);
});

router.get('/renameBusiness', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { owner: true });
    if (!uid) return;

    const name = request.query.name;
    const businessId = request.query.businessId;

    await asyncRun('UPDATE Businesses SET name = ? WHERE id = ?', [name, businessId]);
    response.sendStatus(200);
});

/**
 * Gets the joincode of the specified business.
 * @queryParams businessId - id of the business to get the joincode for
 * @requiredPrivileges read access to the specified business
 * @response json object with the joincode of the specified business
 */
router.get('/joincode', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { read: true });
    if (!uid) return;

    const businessId = request.query.businessId;

    const row = await asyncGet(`SELECT joincode FROM Businesses WHERE id = ?`, [businessId]);
    response.send(row);
});

/**
 * Regenerates the joincode of the specified business (invalidating the old joincode).
 * @queryParams businessId - id of the business to reset the joincode for
 * @requiredPrivileges write access to the specified business
 * @response 200 OK - if successful, 403 - [access denied], 401 - [not logged in], 400 - [bad request]
 */
router.get('/resetJoincode', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;

    const changes = await asyncRunWithChanges(`UPDATE Businesses SET joincode = ? WHERE id = ?`, [
        uuid.v4(),
        businessId,
    ]);
    response.sendStatus(changes === 1 ? 200 : 400);
});

/**
 * Joins the specified business if the specified joincode is correct.
 * @queryParams businessId - id of the business to join
 * @queryParams joincode - must be correct to join the business
 * @response 200 OK - if successful, 403 Incorrect joincode - if joincode was incorrect for the specified business.
 */
router.get('/join', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const businessId = request.query.businessId;
    const joincode = request.query.code;

    const row = await asyncGet(`SELECT joincode FROM Businesses WHERE id = ?`, [businessId]);

    const currCustomData = await asyncGet(
        `SELECT custom_data FROM Members WHERE business_id = ? LIMIT 1`,
        [businessId],
    );
    const jsonCustomData = JSON.parse(currCustomData['custom_data']);
    let customData = jsonCustomData;
    for (const key of Object.keys(jsonCustomData)) {
        customData[key] = 'N/A';
    }
    console.log(JSON.stringify(customData));
    if (row.joincode === joincode) {
        await asyncRun(
            `INSERT OR IGNORE INTO Members (business_id, user_id, role, custom_data) VALUES (?, ?, 'user', ?)`,
            [businessId, uid, JSON.stringify(customData)],
        );
        response.sendStatus(200);
    } else {
        response
            .status(403)
            .send('Incorrect joincode. Please check for typos or reach out to your group admin.');
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
        await asyncRun(`DELETE FROM Members WHERE business_id = ? AND user_id = ?`, [
            businessId,
            userId,
        ]);
        response.sendStatus(200);
    } else {
        response.status(400).send('Cannot remove non-members or owners');
    }
});

/**
 * Gets all the metadata of a business that a user is a member of.
 * @queryParams businessId - id of the business to get metadata for
 * @requiredPrivileges member of the business
 * @response json object with a user count `numUsers` number, an `ownerName` string, and a list of `userEvents`.
 */
router.get('/userdata', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId);
    if (!uid) return;

    const businessId = request.query.businessId;

    const numUsers = await asyncGet('SELECT COUNT() FROM Members WHERE business_id = ?', [
        businessId,
    ]);
    const ownerName = await asyncGet(
        "SELECT Users.name FROM Members INNER JOIN Users on Members.user_id = Users.id WHERE Members.business_id = ? AND Members.role = 'owner'",
        [businessId],
    );
    const userEvents = await asyncAll(
        `SELECT Events.name, Events.starttimestamp, Events.endtimestamp, Records.status, Records.timestamp FROM Records RIGHT JOIN Events ON Events.id = Records.event_id AND (Records.user_id = ? OR Records.user_id is NULL) WHERE Events.business_id = ?`,
        [uid, businessId],
    );

    response.send({
        numUsers: numUsers['COUNT()'],
        ownerName: ownerName.name,
        userEvents: userEvents,
    });
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
    const uid = await handleAuth(request, response, request.query.businessId, {
        assignRoles: true,
    });
    if (!uid) return;

    const businessId = parseInt(request.query.businessId);
    const userid = request.query.userId;
    const role = request.query.role;

    if (role === 'owner') {
        response.status(403).send('Cannot assign owner role');
        return;
    }

    const changes = await asyncRunWithChanges(
        `UPDATE Members SET role = ? WHERE business_id = ? AND user_id = ? AND role != 'owner'`,
        [role, businessId, userid],
    );

    if (changes !== 0) {
        response.status(200).send('Role assigned');
    } else {
        response.status(403).send('Role not changed. Check your role and its privileges.');
    }
});

// ============================ USER ROUTES ============================
router.post('/importCustomData', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const data = request.body.data;
    const mergeCol = request.body.mergeCol;
    const lines = data.split('\n');
    const overwrite = request.body.overwrite;

    if (!['name', 'email', 'id'].includes(mergeCol)) {
        response.sendStatus(400);
        return;
    }

    const headers = lines[0].split(',').map(header => header.trim());
    for (const header of headers) {
        if (header.toLowerCase() === mergeCol) {
            headers[headers.indexOf(header)] = mergeCol;
            break;
        }
    }

    const mergeColToJson = new Map();
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].split(',');
        let headerToLine = {};
        for (let j = 0; j < headers.length; j++) {
            headerToLine[headers[j]] = line[j];
        }
        const key = headerToLine[mergeCol];
        delete headerToLine[mergeCol];
        mergeColToJson.set(key, JSON.stringify(headerToLine));
    }
    for (const [key, value] of mergeColToJson.entries()) {
        if (overwrite) {
            await asyncRun(
                `UPDATE Members 
                SET custom_data = ?
                FROM (SELECT id
                    FROM Users
                    WHERE Users.${mergeCol} = ?) AS U
                WHERE business_id = ? AND U.id = user_id`,
                [value, key, businessId],
            );
        } else {
            await asyncRun(
                `UPDATE Members 
                SET custom_data = json_patch(custom_data, ?)
                FROM (SELECT id
                    FROM Users
                    WHERE Users.${mergeCol} = ?) AS U
                WHERE business_id = ? AND U.id = user_id`,
                [value, key, businessId],
            );
        }
    }

    response.sendStatus(200);
});

/**
 * Updates the name of the authenticated user.
 * @queryParams name - the new name of the user.
 * @response 200 OK - if successful.
 */
router.get('/changeName', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const name = request.query.name;

    await asyncRun('UPDATE Users SET name = ? WHERE id = ?', [name, uid]);
    response.sendStatus(200);
});

router.get('/getRecordSettings', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { read: true });
    if (!uid) return;

    const businessId = request.query.businessId;

    const requireJoin = await asyncGet('SELECT requireJoin FROM Businesses WHERE id = ?', [
        businessId,
    ]);
    response.send(requireJoin);
});

router.get('/changeRecordSettings', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const newStatus = request.query.newStatus;

    await asyncRun('UPDATE Businesses SET requireJoin = ? WHERE id = ?', [newStatus, businessId]);
    response.sendStatus(200);
});

/**
 * Gets the name of the user
 * @response the name of the user as a json object { name: `name` }
 */
router.get('/getName', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const name = await asyncGet('SELECT name FROM Users WHERE id = ?', [uid]);
    response.send(name);
});

// ============================ BUSINESS EXPORTS ============================
exports.businessRouter = router;
exports.createBusiness = createBusiness;
exports.deleteBusiness = deleteBusiness;
