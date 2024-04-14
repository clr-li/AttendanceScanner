// express for routing
const express = require('express'),
    router = express.Router();
// database access
const { db } = require('./Database');
const { SQL } = require('sql-strings');
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
    const { lastID: businessId } = await db().run(
        ...SQL`INSERT INTO Businesses (name, joincode, subscriptionId) VALUES (${name}, ${uuid.v4()}, ${subscriptionId})`,
    );
    await db().run(
        ...SQL`INSERT INTO Members (business_id, user_id, role) VALUES (${businessId}, ${uid}, 'owner')`,
    );
    return businessId;
}

/**
 * Deletes a business and all related data.
 * @param {number} businessId the id of the business to delete
 */
async function deleteBusiness(businessId) {
    await db().run(...SQL`DELETE FROM Records WHERE business_id = ${businessId}`);
    await db().run(...SQL`DELETE FROM Events WHERE business_id = ${businessId}`);
    await db().run(...SQL`DELETE FROM Members WHERE business_id = ${businessId}`);
    await db().run(...SQL`DELETE FROM Businesses WHERE id = ${businessId}`);
}

// ============================ BUSINESS ROUTES ============================
/** Gets a list of businesses that the authenticated user is a member of */
router.get('/businesses', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const rows = await db().all(
        ...SQL`
        SELECT Businesses.id, Businesses.name, Members.role
        FROM Businesses INNER JOIN Members on Businesses.id = Members.business_id AND Members.user_id = ${uid}
        `,
    );
    response.send(rows);
});

/**
 * Gets all the metadata of a business that a user is a member of.
 * @pathParams businessId - id of the business to get metadata for
 * @requiredPrivileges member of the business
 * @response json object with a user count `numUsers` number, an `ownerName` string, and a list of `userEvents`.
 */
router.get('/businesses/:businessId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId);
    if (!uid) return;

    const businessId = request.params.businessId;

    const numUsers = await db().get(
        ...SQL`SELECT COUNT() FROM Members WHERE business_id = ${businessId}`,
    );
    const ownerName = await db().get(
        ...SQL`SELECT Users.name FROM Members INNER JOIN Users on Members.user_id = Users.id WHERE Members.business_id = ${businessId} AND Members.role = 'owner'`,
    );
    const userEvents = await db().all(
        ...SQL`SELECT Events.name, Events.starttimestamp, Events.endtimestamp, Records.status, Records.timestamp 
        FROM Records RIGHT JOIN Events ON Events.id = Records.event_id AND (Records.user_id = ${uid} OR Records.user_id is NULL) 
        WHERE Events.business_id = ${businessId}`,
    );

    response.send({
        numUsers: numUsers['COUNT()'],
        ownerName: ownerName.name,
        userEvents: userEvents,
    });
});

/**
 * Changes the name of the specified business
 * @pathParams businessId - id of the business to change the name of
 * @queryParams new - new name of the business
 * @requiredPrivileges owner of the specified business
 */
router.put('/businesses/:businessId/name', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { owner: true });
    if (!uid) return;

    const name = request.query.new;
    const businessId = request.params.businessId;

    const { changes } = await db().run(
        ...SQL`UPDATE Businesses SET name = ${name} WHERE id = ${businessId}`,
    );
    response.sendStatus(changes === 1 ? 200 : 400);
});

/**
 * Gets the joincode of the specified business.
 * @pathParams businessId - id of the business to get the joincode for
 * @requiredPrivileges read access to the specified business
 * @response json object with the joincode of the specified business
 */
router.get('/businesses/:businessId/joincode', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { read: true });
    if (!uid) return;

    const businessId = request.params.businessId;

    const row = await db().get(...SQL`SELECT joincode FROM Businesses WHERE id = ${businessId}`);
    response.send(row);
});

/**
 * Regenerates the joincode of the specified business (invalidating the old joincode).
 * @pathParams businessId - id of the business to reset the joincode for
 * @requiredPrivileges write access to the specified business
 * @response 200 OK - if successful, 403 - [access denied], 401 - [not logged in], 400 - [bad request]
 */
router.patch('/businesses/:businessId/joincode', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;

    const { changes } = await db().run(
        ...SQL`UPDATE Businesses SET joincode = ${uuid.v4()} WHERE id = ${businessId}`,
    );
    response.sendStatus(changes === 1 ? 200 : 400);
});

router.get('/businesses/:businessId/members', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { read: true });
    if (!uid) return;

    const businessId = request.params.businessId;

    const rows = await db().all(
        ...SQL`SELECT Users.id, Users.name, Users.email, Members.role, Members.custom_data
        FROM Members INNER JOIN Users on Members.user_id = Users.id WHERE Members.business_id = ${businessId}`,
    );
    response.send(rows);
});

/**
 * Joins the specified business if the specified joincode is correct.
 * @pathParams businessId - id of the business to join
 * @queryParams joincode - must be correct to join the business
 * @response 200 OK - if successful, 403 Incorrect joincode - if joincode was incorrect for the specified business.
 */
router.post('/businesses/:businessId/members', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const businessId = request.params.businessId;
    const joincode = request.query.joincode;

    const row = await db().get(...SQL`SELECT joincode FROM Businesses WHERE id = ${businessId}`);

    const currCustomData = await db().get(
        ...SQL`SELECT custom_data FROM Members WHERE business_id = ${businessId} LIMIT 1`,
    );
    const jsonCustomData = JSON.parse(currCustomData['custom_data']);
    const customData = jsonCustomData;
    for (const key of Object.keys(jsonCustomData)) {
        customData[key] = 'N/A';
    }
    if (row.joincode === joincode) {
        await db().run(
            ...SQL`INSERT OR IGNORE INTO Members (business_id, user_id, role, custom_data) 
            VALUES (${businessId}, ${uid}, 'user', ${JSON.stringify(customData)})`,
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
 * @pathParams businessId - id of the business to leave
 * @requiredPrivileges member but not owner of the specified business
 * @response 200 - OK; or 403 - [access denied]
 */
router.delete('/businesses/:businessId/members/me', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { owner: false });
    if (!uid) return;

    const businessId = request.params.businessId;

    await db().run(
        ...SQL`DELETE FROM Members WHERE business_id = ${businessId} AND user_id = ${uid}`,
    );

    response.sendStatus(200);
});

/**
 * Removes a user from the specified business.
 * @pathParams businessId - id of the business to remove the user from
 * @pathParams userId - id of the user to remove from the business
 * @requiredPrivileges write access to the specified business
 */
router.delete('/businesses/:businessId/members/:userId', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const userId = request.params.userId;

    if (await getAccess(userId, businessId, { owner: false })) {
        await db().run(
            ...SQL`DELETE FROM Members WHERE business_id = ${businessId} AND user_id = ${userId}`,
        );
        response.sendStatus(200);
    } else {
        response.status(400).send('Cannot remove non-members or owners');
    }
});

/**
 * Assign a role to a user in the specified business.
 * @pathParams businessId - id of the business to assign a role in
 * @pathParams userId - id of the user to assign a role to
 * @queryParams new - role to assign to the user
 * @requiredPrivileges assignRoles for the business
 * @response 200 OK if successful, 403 if user is an owner or nothing changed
 */
router.put('/businesses/:businessId/members/:userId/role', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, {
        assignRoles: true,
    });
    if (!uid) return;

    const businessId = parseInt(request.params.businessId);
    const userId = request.params.userId;
    const role = request.query.new;

    if (role === 'owner') {
        response.status(403).send('Cannot assign owner role');
        return;
    }

    const { changes } = await db().run(
        ...SQL`UPDATE Members SET role = ${role} WHERE business_id = ${businessId} AND user_id = ${userId} AND role != 'owner'`,
    );

    if (changes !== 0) {
        response.status(200).send('Role assigned');
    } else {
        response.status(403).send('Role not changed. Check your role and its privileges.');
    }
});

/**
 * Gets the requireJoin setting for the specified business.
 * @pathParams businessId - id of the business to get the role in
 * @requiredPrivileges read access to the specified business
 * @response json object with the requireJoin setting of the specified business
 */
router.get('/businesses/:businessId/settings/requirejoin', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { read: true });
    if (!uid) return;

    const businessId = request.params.businessId;

    const requireJoin = await db().get(
        ...SQL`SELECT requireJoin FROM Businesses WHERE id = ${businessId}`,
    );
    response.send(requireJoin);
});

/**
 * Updates the requireJoin setting for the specified business.
 * @pathParams businessId - id of the business to update the role in
 * @queryParams new - new requireJoin setting for the business
 * @requiredPrivileges write access to the specified business
 */
router.put('/businesses/:businessId/settings/requirejoin', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const newRequireJoin = request.query.new;

    const { changes } = await db().run(
        ...SQL`UPDATE Businesses SET requireJoin = ${newRequireJoin} WHERE id = ${businessId}`,
    );
    response.sendStatus(changes === 1 ? 200 : 400);
});

/**
 * Sets the custom data for a user in the specified business.
 * @pathParams businessId - id of the business to set custom data in
 * @pathParams userId - id of the user to set custom data for
 * @requiredPrivileges write access to the specified business
 * @response 200 OK if successful
 */
router.patch('/businesses/:businessId/customdata/:userId', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const userId = request.params.userId;
    const customData = request.body;

    const { changes } = await db().run(
        ...SQL`UPDATE Members SET custom_data = ${JSON.stringify(customData)}
        WHERE business_id = ${businessId} AND user_id = ${userId}`,
    );
    response.sendStatus(changes === 1 ? 200 : 400);
});

/**
 * Imports custom columns into the specified business.
 * @pathParams businessId - id of the business to import custom columns into
 * @queryParams data - the data to import as a csv string
 * @queryParams overwrite - whether to overwrite existing data
 * @queryParams mergeCol - the column to merge on (name, email, or id)
 * @requiredPrivileges write access to the specified business
 * @response 200 OK if successful
 */
router.post('/businesses/:businessId/customdata', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const data = request.body.data;
    const mergeCol = request.body.mergeCol;
    const lines = data.split('\n');
    const overwrite = request.body.overwrite;

    if (!['name', 'email'].includes(mergeCol)) {
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
            await db().run(
                ...SQL`UPDATE Members 
                SET custom_data = ${value}
                FROM (SELECT id
                    FROM Users
                    WHERE Users."`(mergeCol)`" = ${key}) AS U
                WHERE business_id = ${businessId} AND U.id = user_id`,
            );
        } else {
            await db().run(
                ...SQL`UPDATE Members 
                SET custom_data = json_patch(custom_data, ${value})
                FROM (SELECT id
                    FROM Users
                    WHERE Users."`(mergeCol)`" = ${key}) AS U
                WHERE business_id = ${businessId} AND U.id = user_id`,
            );
        }
    }

    response.sendStatus(200);
});

// ============================ USER ROUTES ============================
/**
 * Gets the name of the user
 * @response the name of the user as a json object { name: `name` }
 */
router.get('/username', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const name = await db().get(...SQL`SELECT name FROM Users WHERE id = ${uid}`);
    response.send(name);
});

/**
 * Updates the name of the authenticated user.
 * @queryParams new - the new name of the user.
 * @response 200 OK - if successful.
 */
router.put('/username', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const name = request.query.new;

    await db().run(...SQL`UPDATE Users SET name = ${name} WHERE id = ${uid}`);
    response.sendStatus(200);
});

// ============================ BUSINESS EXPORTS ============================
exports.businessRouter = router;
exports.createBusiness = createBusiness;
exports.deleteBusiness = deleteBusiness;
