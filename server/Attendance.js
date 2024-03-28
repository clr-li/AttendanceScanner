'use strict';

// express for routing
const express = require('express'),
    router = express.Router();
// database access
const { asyncRun, asyncGet, asyncAll } = require('./Database');
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
 * @requiredPrivileges scanner for the business
 * @response 200 OK if successful
 */
router.get('/recordAttendance', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { scanner: true });
    if (!uid) return;

    const eventid = request.query.eventid;
    const businessId = request.query.businessId;
    const userid = request.query.userid;
    const status = request.query.status;

    const requireJoin = (
        await asyncGet('SELECT requireJoin FROM Businesses WHERE id = ?', [businessId])
    ).requireJoin;
    const access = await getAccess(userid, businessId, {});
    if (requireJoin && !access) {
        response.status(400).send('Cannot take attendance for non-member');
        return;
    }

    if (!requireJoin && !access) {
        await asyncRun(
            `INSERT OR IGNORE INTO Members (business_id, user_id, role) VALUES (?, ?, 'user')`,
            [businessId, userid],
        );
    }

    await asyncRun(
        `INSERT INTO Records (event_id, business_id, user_id, timestamp, status) VALUES (?, ?, ?, ?, ?)`,
        [eventid, businessId, userid, Math.round(Date.now() / 1000), status],
    );
    response.sendStatus(200);
});

// ============================ ADMIN MODIFY ATTENDANCE ============================
/**
 * Records a new attendance record for multiple users
 * @queryParams event - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @queryParams ids - comma separated string of userids to record attendance for
 * @queryParams status - the attendance status to note down
 * @requiredPrivileges write for the business
 * @response 200 OK if successful
 */
router.get('/alterAttendance', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const ids = request.query.ids;
    const event = request.query.event;
    const status = request.query.status;

    for (const id of ids.split(',')) {
        await asyncRun(
            `INSERT INTO Records(status, business_id, event_id, user_id, timestamp) VALUES (?, ?, ?, ?, ?)`,
            [status, businessId, event, id, Math.round(Date.now() / 1000)],
        );
    }
    response.sendStatus(200);
});

/**
 * Logged in user can mark themselves as absent for a future event if no status has already been marked for than event.
 * @queryParams eventId - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @requiredPrivileges member of the business
 * @response 200 OK if successful
 */
router.get('/markSelfAbsent', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, {});
    if (!uid) return;

    const businessId = request.query.businessId;
    const eventId = request.query.eventId;

    const { status, endtimestamp } = await asyncGet(
        `SELECT R.status, E.endtimestamp FROM Events as E LEFT OUTER JOIN Records as R ON E.id = R.event_id WHERE (R.status IS NULL OR R.user_id = ? AND R.business_id = ?) AND E.id = ?`,
        [uid, businessId, eventId],
    );
    if (status) {
        response.status(400).send('Attendance already recorded');
        return;
    }
    if (parseInt(endtimestamp) * 1000 < Date.now()) {
        response.status(400).send('Can only alter attendance for future events');
        return;
    }

    await asyncRun(
        `INSERT INTO Records(status, business_id, event_id, user_id, timestamp) VALUES (?, ?, ?, ?, ?)`,
        ['ABSENT(self-marked)', businessId, eventId, uid, Math.round(Date.now() / 1000)],
    );

    response.sendStatus(200);
});

// ============================ TEMPORARY ATTENDANCE CODES ============================
/**
 * Generates a new temporary attendance code for the specified business and event that can be used to record attendance.
 * @queryParams eventid - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @queryParams expiration - time from now in milliseconds to expire the code (default: 10 seconds)
 * @requiredPrivileges scanner for the business
 * @response the code to take attendance with
 */
router.get('/setNewTempAttendanceCode', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { scanner: true });
    if (!uid) return;

    const eventid = request.query.eventid;
    const businessid = request.query.businessId;
    const expiration = parseInt(request.query.expiration) || 10_000;
    const key = eventid + '-' + businessid;

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
 * @requiredPrivileges scanner for the business
 * @response 200 OK if successful, 400 if no code to refresh
 */
router.get('/refreshTempAttendanceCode', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { scanner: true });
    if (!uid) return;

    const eventid = request.query.eventid;
    const businessid = request.query.businessId;
    const expiration = parseInt(request.query.expiration) || 10_000;
    const clientCode = request.query.code;
    const key = eventid + '-' + businessid;

    const code = (await storage.getItem(key)) || clientCode;
    if (clientCode && clientCode !== code) {
        response.status(400).send('Invalid code, perhaps it was updated in another tab?');
        return;
    }
    if (!code) {
        response.status(400).send('No code to refresh');
        return;
    }
    storage.setItem(key, code, { ttl: expiration });

    response.sendStatus(200);
});

/**
 * Gets or sets the temporary attendance code for the specified business and event that can be used to record attendance.
 * @queryParams eventid - id of the event to record attendance for
 * @queryParams businessId - id of the business to record attendance for
 * @requiredPrivileges scanner for the business
 * @response the code to take attendance with, does not refresh expiration time.
 */
router.get('/getOrSetTempAttendanceCode', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { scanner: true });
    if (!uid) return;

    const eventid = request.query.eventid;
    const businessid = request.query.businessId;
    const key = eventid + '-' + businessid;

    if (!(await storage.getItem(key))) {
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
 * @requiredPrivileges member of the business
 * @response 200 OK if successful, 400 if invalid code
 */
router.get('/recordMyAttendance', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const eventid = request.query.eventid;
    const businessId = request.query.businessId;
    const status = request.query.status;
    const code = request.query.code;
    const key = eventid + '-' + businessId;

    const requireJoin = (
        await asyncGet('SELECT requireJoin FROM Businesses WHERE id = ?', [businessId])
    ).requireJoin;
    const access = await getAccess(uid, businessId, {});
    if (requireJoin && !access) {
        response.status(400).send('Cannot take attendance for non-member');
        return;
    }

    if (!requireJoin && !access) {
        await asyncRun(
            `INSERT OR IGNORE INTO Members (business_id, user_id, role) VALUES (?, ?, 'user')`,
            [businessId, uid],
        );
    }

    if ((await storage.getItem(key)) !== code || !code) {
        response.status(400).send('Invalid/Expired code');
        return;
    }

    if ((await storage.getItem(key)) !== code || !code) {
        response.status(400).send('Invalid/Expired code');
        return;
    }

    await asyncRun(
        `INSERT INTO Records (event_id, business_id, user_id, timestamp, status) VALUES (?, ?, ?, ?, ?)`,
        [eventid, businessId, uid, Math.round(Date.now() / 1000), status],
    );
    response.sendStatus(200);
});

// ============================ GET ATTENDANCE DATA ============================

/**
 * Returns all the attendance records for the specified business.
 * @queryParams businessId - id of the business to get attendance records for
 * @requiredPrivileges read for the business
 * @response json list of records for all users in the business as well as empty records for users with no attendance records.
 */
router.get('/attendancedata', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { read: true });
    if (!uid) return;

    const businessid = request.query.businessId;
    const attendanceinfo = await asyncAll(
        `
    SELECT 
      UserData.name, Records.*, UserData.role, UserData.email, UserData.custom_data
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
        [businessid, businessid],
    );
    response.send(
        attendanceinfo.concat(
            await asyncAll(
                `
                SELECT Users.name, Users.id, Users.email, role, Members.custom_data 
                FROM Members LEFT JOIN Users ON Members.user_id = Users.id 
                WHERE business_id = ? ORDER BY Members.role`,
                [businessid],
            ),
        ),
    );
});

router.get('/memberattendancedata', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { read: true });
    if (!uid) return;

    const businessid = request.query.businessId;
    // const starttimestamp = request.query.starttimestamp;
    // const endtimestamp = request.query.endtimestamp;
    // const role = request.query.role;
    const memberAttendance = await asyncAll(
        `
        SELECT 
            Users.name, Users.id as user_id, Records.status, Members.role, COUNT(*) AS total_count
        FROM
            Users, Records, Members, Events
        WHERE 
            Users.id = Records.user_id
            AND Members.user_id = Users.id
            AND Records.business_id = ?
            AND Members.business_id = ?
            AND Events.business_id = ?
            AND Records.event_id = Events.id
            AND Events.endtimestamp <= ?
        GROUP BY
            Records.user_id, Records.status
        ORDER BY
            Users.name ASC
        `,
        [businessid, businessid, businessid, Math.round(Date.now() / 1000)],
    );

    response.send(
        memberAttendance.concat(
            await asyncAll(
                `
        SELECT Users.name, Users.id as user_id, Users.email, role, Members.custom_data FROM Members LEFT JOIN Users ON Members.user_id = Users.id WHERE business_id = ? ORDER BY Members.role`,
                [businessid],
            ),
        ),
    );
});

router.get('/countPastEvents', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { read: true });
    if (!uid) return;

    const businessid = request.query.businessId;
    const num = await asyncGet(
        `
        SELECT 
            COUNT(*) AS total_count
        FROM
            Events
        WHERE 
            business_id = ?
            AND endtimestamp <= ?
        `,
        [businessid, Math.round(Date.now() / 1000)],
    );
    response.send(num);
});

// ============================ ATTENDANCE EXPORTS ============================
exports.attendanceRouter = router;
