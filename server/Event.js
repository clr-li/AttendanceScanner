// express for routing
const express = require('express'),
    router = express.Router();
// database access
const { asyncGet, asyncAll, asyncRun, asyncRunWithID } = require('./Database');
// user auth
const { handleAuth } = require('./Auth');
// random universal unique ids for joincodes
const uuid = require('uuid');

// ============================ READ EVENTS ============================

/**
 * Gets data for all the events for the user in the specified business.
 * @queryParams businessId - id of the business to get events for
 * @requiredPrivileges user must be a member of the specified business
 * @response json list of event objects.
 */
router.get('/events', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId);
    if (!uid) return;

    const events = await asyncAll(
        `SELECT id, name, starttimestamp, endtimestamp, description, tag FROM Events WHERE business_id = ?`,
        [request.query.businessId],
    );

    response.send(events);
});

/**
 * Gets all info associated with the specified event
 * @queryParams businessId - id of the business to get the event from
 * @queryParams eventid - id of the event to get
 * @requiredPrivileges read access for the business
 * @response json object representing the event info
 */
router.get('/eventdata', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { read: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const eventid = request.query.eventid;

    const eventinfo = await asyncGet(`SELECT * FROM Events WHERE business_id = ? AND id = ?`, [
        businessId,
        eventid,
    ]);
    response.send(eventinfo);
});

/**
 * Gets all the attendance records for the current user within a business.
 * @queryParams businessId - id of the business to get attendance records within
 * @requiredPrivileges member of the business
 * @response json list of records for the current user within the specified business.
 */
router.get('/userEvents', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId);
    if (!uid) return;

    const businessId = request.query.businessId;

    response.send(
        await asyncAll(
            `SELECT Events.name, Events.id, Events.starttimestamp, Events.description, Events.endtimestamp, Records.status, Records.timestamp FROM Records RIGHT JOIN Events ON Events.id = Records.event_id AND (Records.user_id = ? OR Records.user_id is NULL) WHERE Events.business_id = ?`,
            [uid, businessId],
        ),
    );
});

// ============================ CREATE EVENTS ============================

/**
 * Creates a new event for the specified business.
 * @queryParams businessId - id of the business to create an event for
 * @queryParams name - name of the event to create
 * @queryParams description - description of the event to create
 * @queryParams starttimestamp - unix epoch timestamp in seconds for when the event is supposed to start
 * @queryParams endtimestamp - unix epoch timestamp in seconds for when the event is supposed to end
 * @requiredPrivileges write access for the business
 * @response id of the newly created event.
 */
router.get('/makeEvent', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const name = request.query.name;
    const description = request.query.description;
    const starttimestamp = request.query.starttimestamp;
    const endtimestamp = request.query.endtimestamp;
    const tag = request.query.tag;

    const eventid = await asyncRunWithID(
        'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp, tag) VALUES (?, ?, ?, ?, ?, ?)',
        [businessId, name, description, starttimestamp, endtimestamp, tag],
    );
    response.send('' + eventid);
});

function createEventSequence(
    startDate,
    endDate,
    businessId,
    name,
    description,
    repeatId,
    frequency,
    interval,
    timezoneOffsetMS,
    tag,
) {
    let current = startDate;
    while (current < endDate) {
        const currentEndDate = new Date(endDate);
        currentEndDate.setFullYear(current.getFullYear(), current.getMonth(), current.getDate());
        asyncRunWithID(
            'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp, repeat_id, tag) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                businessId,
                name,
                description,
                (current.getTime() + timezoneOffsetMS) / 1000,
                (currentEndDate.getTime() + timezoneOffsetMS) / 1000,
                repeatId,
                tag,
            ],
        );
        if (frequency === 'daily') current.setDate(current.getDate() + interval);
        else if (frequency === 'weekly') current.setDate(current.getDate() + 7 * interval);
        else if (frequency === 'monthly') current.setMonth(current.getMonth() + interval);
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
 * @queryParams timezoneOffsetMS - the timezone offset in milliseconds
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.get('/makeRecurringEvent', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const name = request.query.name;
    const description = request.query.description;
    const timezoneOffsetMS =
        parseInt(request.query.timezoneOffsetMS) - new Date().getTimezoneOffset() * 60 * 1000; // actual offset includes server offset
    const startDate = new Date(parseInt(request.query.starttimestamp) * 1000 - timezoneOffsetMS);
    const endDate = new Date(parseInt(request.query.endtimestamp) * 1000 - timezoneOffsetMS);
    const frequency = request.query.frequency;
    const interval = parseInt(request.query.interval);
    const daysoftheweek = request.query.daysoftheweek;
    const repeatId = uuid.v4();
    const tag = request.query.tag;

    if (frequency === 'weekly' && daysoftheweek.length > 0) {
        for (const day of daysoftheweek.split(',')) {
            const newStartDate = new Date(startDate);
            const daysToAdd = (7 + parseInt(day) - newStartDate.getDay()) % 7;
            newStartDate.setDate(newStartDate.getDate() + daysToAdd);
            createEventSequence(
                newStartDate,
                endDate,
                businessId,
                name,
                description,
                repeatId,
                frequency,
                interval,
                timezoneOffsetMS,
                tag,
            );
        }
    } else {
        createEventSequence(
            startDate,
            endDate,
            businessId,
            name,
            description,
            repeatId,
            frequency,
            interval,
            timezoneOffsetMS,
            tag,
        );
    }

    response.sendStatus(200);
});

// ============================ MODIFY EVENTS ============================

/**
 * Updates event info for the specified business and event.
 * @queryParams businessId - id of the business to update event info for
 * @queryParams eventid - id of the event to update
 * @queryParams name - updated event name
 * @queryParams description - updated event description
 * @queryParams starttimestamp - unix epoch timestamp in seconds for when the updated event is supposed to start
 * @queryParams endtimestamp - unix epoch timestamp in seconds for when the updated event is supposed to end
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.get('/updateevent', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const name = request.query.name;
    const description = request.query.description;
    const starttimestamp = request.query.starttimestamp;
    const endtimestamp = request.query.endtimestamp;
    const eventid = request.query.eventid;
    const repeatId = request.query.repeatId;
    const repeatEffect = parseInt(request.query.repeatEffect);
    const starttimedelta = request.query.starttimedelta;
    const endtimedelta = request.query.endtimedelta;
    const tag = request.query.tag;

    if (repeatEffect === 1) {
        await asyncRun(
            `UPDATE Events SET name = ?, starttimestamp = ?, endtimestamp = ?, description = ?, tag = ? WHERE business_id = ? AND id = ? `,
            [name, starttimestamp, endtimestamp, description, tag, businessId, eventid],
        );
    } else if (repeatEffect === 2) {
        await asyncRun(
            `UPDATE Events SET name = ?, starttimestamp = CAST((CAST(starttimestamp as INTEGER) + CAST(? as INTEGER)) as TEXT), endtimestamp = CAST((CAST(endtimestamp as INTEGER) + CAST(? as INTEGER)) as TEXT), description = ?, tag = ? WHERE business_id = ? AND repeat_id = ? AND starttimestamp >= ?`,
            [
                name,
                starttimedelta,
                endtimedelta,
                description,
                tag,
                businessId,
                repeatId,
                starttimestamp,
            ],
        );
    } else if (repeatEffect === 3) {
        await asyncRun(
            `UPDATE Events SET name = ?, starttimestamp = CAST((CAST(starttimestamp as INTEGER) + CAST(? as INTEGER)) as TEXT), endtimestamp = CAST((CAST(endtimestamp as INTEGER) + CAST(? as INTEGER)) as TEXT), description = ?, tag = ? WHERE business_id = ? AND repeat_id = ?`,
            [name, starttimedelta, endtimedelta, description, tag, businessId, repeatId],
        );
    } else {
        response.sendStatus(400);
        return;
    }

    response.sendStatus(200);
});

/**
 * Deletes the specified event for the specified business.
 * @queryParams businessId - id of the business to delete the event from
 * @queryParams eventid - id of the event to delete
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.get('/deleteevent', async function (request, response) {
    const uid = await handleAuth(request, response, request.query.businessId, { write: true });
    if (!uid) return;

    const businessId = request.query.businessId;
    const eventid = request.query.eventid;
    const repeatId = request.query.repeatId;
    const repeatEffect = parseInt(request.query.repeatEffect);
    const starttimestamp = request.query.starttimestamp;

    if (repeatEffect === 1) {
        await asyncRun(`DELETE FROM Events WHERE business_id = ? AND id = ?`, [
            businessId,
            eventid,
        ]);
    } else if (repeatEffect === 2) {
        await asyncRun(
            `DELETE FROM Events WHERE business_id = ? AND repeat_id = ? AND starttimestamp >= ?`,
            [businessId, repeatId, starttimestamp],
        );
    } else if (repeatEffect === 3) {
        await asyncRun(`DELETE FROM Events WHERE business_id = ? AND repeat_id = ?`, [
            businessId,
            repeatId,
        ]);
    } else {
        response.sendStatus(400);
        return;
    }

    response.sendStatus(200);
});

/**
 * Gets all the tags for the specified business.
 * @queryParams businessId - id of the business to get tags for
 * @requiredPrivileges read access for the business
 * @response json list of tags for the specified business.
 */
router.get('/eventtags', async (request, response) => {
    const uid = await handleAuth(request, response, request.query.businessId, { read: true });
    if (!uid) return;

    const tags = await asyncAll(
        `SELECT DISTINCT tag FROM Events WHERE business_id = ? AND tag <> ''`,
        [request.query.businessId],
    );
    response.send(tags);
});

// ============================ EVENT EXPORTS ============================
exports.eventRouter = router;
