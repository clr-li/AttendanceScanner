'use strict';

// express for routing
const express = require('express'),
    router = express.Router();
// database access
const { db } = require('./Database');
const { SQL } = require('sql-strings');
// user auth
const { handleAuth, getAccess } = require('./Auth');
// random universal unique ids for temporary attendance codes
const uuid = require('uuid');
// persistent storage for temporary attendance codes
const storage = require('node-persist');
storage.init({
    dir: process.env.ATT_CODE_DIR,
    ttl: 300_000, // 5 minutes
});

// ============================ SCAN ATTENDANCE ============================
/**
 * Records an attendance scan of a user for a specific business and event.
 * @pathParams eventId - id of the event to record attendance for
 * @pathParams businessId - id of the business to record attendance for
 * @queryParams userId - the user to record attendance of
 * @queryParams status - the attendance status to note down
 * @requiredPrivileges scanner for the business
 * @response 200 OK if successful
 */
router.post('/businesses/:businessId/events/:eventId/attendance', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { scanner: true });
    if (!uid) return;

    const eventId = request.params.eventId;
    const businessId = request.params.businessId;
    const userId = request.query.userId;
    const status = request.query.status;

    const requireJoin = await db()
        .get(...SQL`SELECT requireJoin FROM Businesses WHERE id = ${businessId}`)
        .then(row => row?.requireJoin);
    const access = await getAccess(userId, businessId, {});
    if (requireJoin && !access) {
        response.status(400).send('Cannot take attendance for non-member');
        return;
    }

    if (!requireJoin && !access) {
        await db().run(
            ...SQL`INSERT OR IGNORE INTO Members (business_id, user_id, role) VALUES (${businessId}, ${userId}, 'user')`,
        );
    }

    await db().run(
        ...SQL`INSERT INTO Records (event_id, business_id, user_id, timestamp, status) 
        VALUES (${eventId}, ${businessId}, ${userId}, ${Date.now()}, ${status})`,
    );
    response.sendStatus(200);
});

// ============================ ADMIN MODIFY ATTENDANCE ============================
/**
 * Records a new attendance record for multiple users
 * @pathParams eventId - id of the event to record attendance for
 * @pathParams businessId - id of the business to record attendance for
 * @queryParams ids - comma separated string of userids to record attendance for
 * @queryParams status - the attendance status to note down
 * @requiredPrivileges write for the business
 * @response 200 OK if successful
 */
router.patch('/businesses/:businessId/events/:eventId/attendance', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const eventId = request.params.eventId;
    const ids = request.query.ids;
    const status = request.query.status;

    for (const id of ids.split(',')) {
        await db().run(
            ...SQL`INSERT INTO Records(status, business_id, event_id, user_id, timestamp) 
            VALUES (${status}, ${businessId}, ${eventId}, ${id}, ${Date.now()})`,
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
router.put(
    '/businesses/:businessId/events/:eventId/attendance/markabsent',
    async (request, response) => {
        const uid = await handleAuth(request, response, request.params.businessId, {});
        if (!uid) return;

        const businessId = request.params.businessId;
        const eventId = request.params.eventId;

        const existingRecord = await db().get(
            ...SQL`SELECT R.status, E.endtimestamp 
            FROM Events as E LEFT OUTER JOIN Records as R ON E.id = R.event_id 
            WHERE (R.status IS NULL OR R.user_id = ${uid} AND R.business_id = ${businessId}) AND E.id = ${eventId}`,
        );
        if (existingRecord?.status) {
            response.status(400).send('Attendance already recorded');
            return;
        }
        if (existingRecord && parseInt(existingRecord.endtimestamp) < Date.now()) {
            response.status(400).send('Can only alter attendance for future events');
            return;
        }

        await db().run(
            ...SQL`INSERT INTO Records(status, business_id, event_id, user_id, timestamp) 
            VALUES ('ABSENT(self)', ${businessId}, ${eventId}, ${uid}, ${Date.now()})`,
        );

        response.sendStatus(200);
    },
);

// ============================ TEMPORARY ATTENDANCE CODES ============================
/**
 * Generates a new temporary attendance code for the specified business and event that can be used to record attendance.
 * @pathParams eventId - id of the event to record attendance for
 * @pathParams businessId - id of the business to record attendance for
 * @queryParams expiration - time from now in milliseconds to expire the code (default: 10 seconds)
 * @requiredPrivileges scanner for the business
 * @response the code to take attendance with
 */
router.put('/businesses/:businessId/events/:eventId/attendance/code', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { scanner: true });
    if (!uid) return;

    const eventId = request.params.eventId;
    const businessId = request.params.businessId;
    const expiration = parseInt(request.query.expiration) || 10_000;
    const key = eventId + '-' + businessId;

    const code = uuid.v4().split('-')[0];
    await storage.setItem(key, code, { ttl: expiration });

    response.status(200);
    response.send(code);
});

/**
 * Refresh attendance code for the specified business and event that can be used to record attendance.
 * @pathParams eventId - id of the event to record attendance for
 * @pathParams businessId - id of the business to record attendance for
 * @queryParams expiration - time from now in milliseconds to expire the code (default: 10 seconds)
 * @queryParams code - the attendance code to refresh to if no code is present
 * @requiredPrivileges scanner for the business
 * @response 200 OK if successful, 400 if no code to refresh
 */
router.patch(
    '/businesses/:businessId/events/:eventId/attendance/code/refresh',
    async (request, response) => {
        const uid = await handleAuth(request, response, request.params.businessId, {
            scanner: true,
        });
        if (!uid) return;

        const eventId = request.params.eventId;
        const businessId = request.params.businessId;
        const expiration = parseInt(request.query.expiration) || 10_000;
        const clientCode = request.query.code;
        const key = eventId + '-' + businessId;

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
    },
);

/**
 * Gets or sets the temporary attendance code for the specified business and event that can be used to record attendance.
 * @pathParams eventId - id of the event to record attendance for
 * @pathParams businessId - id of the business to record attendance for
 * @requiredPrivileges scanner for the business
 * @response the code to take attendance with, does not refresh expiration time.
 */
router.get('/businesses/:businessId/events/:eventId/attendance/code', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { scanner: true });
    if (!uid) return;

    const eventId = request.params.eventId;
    const businessId = request.params.businessId;
    const key = eventId + '-' + businessId;

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
 * @pathParams eventId - id of the event to record attendance for
 * @pathParams businessId - id of the business to record attendance for
 * @queryParams code - the attendance code to check against
 * @queryParams status - the attendance status to note down
 * @requiredPrivileges member of the business
 * @response 200 OK if successful, 400 if invalid code
 */
router.post('/businesses/:businessId/events/:eventId/attendance/me', async (request, response) => {
    const uid = await handleAuth(request, response);
    if (!uid) return;

    const eventId = request.params.eventId;
    const businessId = request.params.businessId;
    const status = request.query.status;
    const code = request.query.code;
    const key = eventId + '-' + businessId;

    const requireJoin = await db()
        .get(...SQL`SELECT requireJoin FROM Businesses WHERE id = ${businessId}`)
        .then(row => row?.requireJoin);
    const access = await getAccess(uid, businessId, {});
    if (requireJoin && !access) {
        response.status(400).send('Cannot take attendance for non-member');
        return;
    }

    if (!requireJoin && !access) {
        await db().get(
            ...SQL`INSERT OR IGNORE INTO Members (business_id, user_id, role) VALUES (${businessId}, ${uid}, 'user')`,
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

    await db().run(
        ...SQL`INSERT INTO Records (event_id, business_id, user_id, timestamp, status) 
        VALUES (${eventId}, ${businessId}, ${uid}, ${Date.now()}, ${status})`,
    );
    response.sendStatus(200);
});

// ============================ GET ATTENDANCE DATA ============================
/**
 * Returns all the attendance records for the specified business.
 * @pathParams businessId - id of the business to get attendance records for
 * @requiredPrivileges read for the business
 * @response json list of records for all users in the business as well as empty records for users with no attendance records.
 */
router.get('/businesses/:businessId/attendance', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { read: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const attendanceRecords = await db().all(
        ...SQL`
        SELECT 
            Records.user_id as id, Records.event_id, Records.status, Records.timestamp
        FROM
            Records
        WHERE 
            Records.business_id = ${businessId}`,
    );
    const userInfo = await db().all(
        ...SQL`SELECT Users.id, Users.name, Members.role, Users.email, Members.custom_data 
        FROM Members LEFT JOIN Users ON Members.user_id = Users.id 
        WHERE business_id = ${businessId} ORDER BY Members.role ASC, Users.name ASC`,
    );
    response.send(userInfo.concat(attendanceRecords));
});

/**
 * Aggregates the status counts for all events and users within the specified business.
 * @pathParams businessId - id of the business to get attendance records for
 * @queryParams tag - tag to filter events by
 * @queryParams starttimestamp - start time to filter events by
 * @queryParams endtimestamp - end time to filter events by
 * @requiredPrivileges read for the business
 * @response json list of status counts for all users and events within the business.
 */
router.get('/businesses/:businessId/attendance/statuscounts', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { read: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const tag = request.query.tag ? '%,' + request.query.tag + ',%' : '';
    const start = request.query.starttimestamp;
    const end = request.query.endtimestamp;
    const statusCounts = await db().all(
        ...SQL`
        SELECT
            Users.id, Records.status, COUNT(*) AS count
        FROM
            Users, Records, Members, Events
        WHERE
            Users.id = Records.user_id
            AND Members.user_id = Users.id
            AND Records.business_id = ${businessId}
            AND Members.business_id = ${businessId}
            AND Events.business_id = ${businessId}
            AND Records.event_id = Events.id
            AND (${tag} = '' OR Events.tag LIKE ${tag})
            AND (${start} = '' OR Events.starttimestamp >= ${start})
            AND (${end} = '' OR Events.endtimestamp <= ${end})
        GROUP BY
            Records.user_id, Records.status
        `,
    );
    const numEvents = await db()
        .get(
            ...SQL`
            SELECT COUNT(*) AS total_count
            FROM Events
            WHERE business_id = ${businessId}
                AND (${start} = '' OR Events.starttimestamp >= ${start})
                AND (${end} = '' OR Events.endtimestamp <= ${end})
                AND (${tag} = '' OR tag LIKE ${tag})`,
        )
        .then(row => row.total_count);
    const numPastEvents = await db()
        .get(
            ...SQL`
            SELECT COUNT(*) AS past_count 
            FROM Events WHERE business_id = ${businessId} 
                AND endtimestamp <= ${Date.now()}
                AND (${tag} = '' OR tag LIKE ${tag})
                AND (${start} = '' OR starttimestamp >= ${start})`,
        )
        .then(row => row.past_count);
    const userInfo = await db().all(
        ...SQL`SELECT Users.id, Users.name, Users.email, role, Members.custom_data, ${numPastEvents} as past_count, ${numEvents} as total_count
        FROM Members LEFT JOIN Users ON Members.user_id = Users.id 
        WHERE business_id = ${businessId}
        ORDER BY Members.role ASC, Users.name ASC`,
    );

    response.send(userInfo.concat(statusCounts));
});

// ============================ ATTENDANCE EXPORTS ============================
exports.attendanceRouter = router;
