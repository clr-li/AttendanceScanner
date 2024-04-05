// express for routing
const express = require('express'),
    router = express.Router();
// database access
const { db } = require('./Database');
const { SQL } = require('sql-strings');
// user auth
const { handleAuth } = require('./Auth');
// random universal unique ids for joincodes
const uuid = require('uuid');

// ============================ READ EVENTS ============================
/**
 * Gets data for all the events for the user in the specified business.
 * @pathParams businessId - id of the business to get events for
 * @requiredPrivileges user must be a member of the specified business
 * @response json list of event objects.
 */
router.get('/businesses/:businessId/events', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId);
    if (!uid) return;

    const businessId = request.params.businessId;

    const events = await db().all(
        ...SQL`SELECT id, name, starttimestamp, endtimestamp, description, tag 
        FROM Events WHERE business_id = ${businessId}`,
    );

    response.send(events);
});

/**
 * Counts the number of events for the specified business.
 * @pathParams businessId - id of the business to get the event count for
 * @queryParams start - unix epoch timestamp in seconds for the start of the time range to count events in
 * @queryParams end - unix epoch timestamp in seconds for the end of the time range to count events in
 * @requiredPrivileges read access for the business
 * @response json object with the total_count of events.
 */
router.get('/businesses/:businessId/events/count', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { read: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const start = request.query.start;
    const end = request.query.end;
    const tag = request.query.tag ? '%,' + request.query.tag + ',%' : '';
    const num = await db().get(
        ...SQL`
        SELECT 
            COUNT(*) AS total_count
        FROM
            Events
        WHERE 
            business_id = ${businessId}
            AND (${start} = '' OR Events.starttimestamp >= ${start})
            AND (${end} = '' OR Events.endtimestamp <= ${end})
            AND (${tag} = '' OR tag LIKE ${tag})
        `,
    );
    response.send(num);
});

/**
 * Gets all events with status for the current user within a business.
 * @pathParams businessId - id of the business to get events within
 * @requiredPrivileges member of the business
 * @response json list of records for the current user within the specified business.
 */
router.get('/businesses/:businessId/events/me', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId);
    if (!uid) return;

    const businessId = request.params.businessId;

    response.send(
        await db().all(
            ...SQL`SELECT Events.name, Events.id, Events.starttimestamp, Events.description, Events.endtimestamp, Records.status, Records.timestamp 
            FROM Records RIGHT JOIN Events ON Events.id = Records.event_id AND (Records.user_id = ${uid} OR Records.user_id is NULL) 
            WHERE Events.business_id = ${businessId}`,
        ),
    );
});

/**
 * Gets all info associated with the specified event
 * @pathParams businessId - id of the business to get the event from
 * @pathParams eventId - id of the event to get
 * @requiredPrivileges read access for the business
 * @response json object representing the event info
 */
router.get('/businesses/:businessId/events/:eventId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { read: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const eventId = request.params.eventId;

    const eventinfo = await db().get(
        ...SQL`SELECT * FROM Events WHERE business_id = ${businessId} AND id = ${eventId}`,
    );
    response.send(eventinfo);
});

// ============================ CREATE EVENTS ============================
/**
 * Creates a new event for the specified business.
 * @pathParams businessId - id of the business to create an event for
 * @queryParams name - name of the event to create
 * @queryParams description - description of the event to create
 * @queryParams starttimestamp - unix epoch timestamp in seconds for when the event is supposed to start
 * @queryParams endtimestamp - unix epoch timestamp in seconds for when the event is supposed to end
 * @requiredPrivileges write access for the business
 * @response id of the newly created event.
 */
router.post('/businesses/:businessId/events', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const name = request.query.name;
    const description = request.query.description;
    const starttimestamp = request.query.starttimestamp;
    const endtimestamp = request.query.endtimestamp;
    const tag = request.query.tag;

    const { lastID: eventId } = await db().run(
        ...SQL`INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp, tag) 
        VALUES (${businessId}, ${name}, ${description}, ${starttimestamp}, ${endtimestamp}, ${tag})`,
    );
    response.send('' + eventId);
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
        db().run(
            ...SQL`INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp, repeat_id, tag) 
            VALUES (${businessId}, ${name}, ${description}, ${
                (current.getTime() + timezoneOffsetMS) / 1000
            }, ${(currentEndDate.getTime() + timezoneOffsetMS) / 1000}, ${repeatId}, ${tag})`,
        );
        if (frequency === 'daily') current.setDate(current.getDate() + interval);
        else if (frequency === 'weekly') current.setDate(current.getDate() + 7 * interval);
        else if (frequency === 'monthly') current.setMonth(current.getMonth() + interval);
    }
}

/**
 * Creates a bunch of events for the specified business.
 * @pathParams businessId - id of the business to create an event for
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
router.post('/businesses/:businessId/events/recurring', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
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
 * @pathParams businessId - id of the business to update event info for
 * @pathParams eventId - id of the event to update
 * @queryParams name - updated event name
 * @queryParams description - updated event description
 * @queryParams starttimestamp - unix epoch timestamp in seconds for when the updated event is supposed to start
 * @queryParams endtimestamp - unix epoch timestamp in seconds for when the updated event is supposed to end
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.patch('/businesses/:businessId/events/:eventId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const eventId = request.params.eventId;
    const name = request.query.name;
    const description = request.query.description;
    const starttimestamp = request.query.starttimestamp;
    const endtimestamp = request.query.endtimestamp;
    const repeatId = request.query.repeatId;
    const repeatEffect = parseInt(request.query.repeatEffect);
    const starttimedelta = request.query.starttimedelta;
    const endtimedelta = request.query.endtimedelta;
    const tag = request.query.tag;

    if (repeatEffect === 1) {
        await db().run(
            ...SQL`UPDATE Events SET 
                name = ${name}, 
                starttimestamp = ${starttimestamp}, 
                endtimestamp = ${endtimestamp}, 
                description = ${description}, 
                tag = ${tag}
            WHERE business_id = ${businessId} AND id = ${eventId}`,
        );
    } else if (repeatEffect === 2) {
        await db().run(
            ...SQL`UPDATE Events SET 
                name = ${name}, 
                starttimestamp = CAST((CAST(starttimestamp as INTEGER) + CAST(${starttimedelta} as INTEGER)) as TEXT), 
                endtimestamp = CAST((CAST(endtimestamp as INTEGER) + CAST(${endtimedelta} as INTEGER)) as TEXT), 
                description = ${description}, 
                tag = ${tag}
            WHERE business_id = ${businessId} AND repeat_id = ${repeatId} AND starttimestamp >= ${starttimestamp}`,
        );
    } else if (repeatEffect === 3) {
        await db().run(
            ...SQL`UPDATE Events SET 
                name = ${name}, 
                starttimestamp = CAST((CAST(starttimestamp as INTEGER) + CAST(${starttimedelta} as INTEGER)) as TEXT), 
                endtimestamp = CAST((CAST(endtimestamp as INTEGER) + CAST(${endtimedelta} as INTEGER)) as TEXT), 
                description = ${description}, 
                tag = ${tag} 
            WHERE business_id = ${businessId} AND repeat_id = ${repeatId}`,
        );
    } else {
        response.sendStatus(400);
        return;
    }

    response.sendStatus(200);
});

/**
 * Deletes the specified event for the specified business.
 * @pathParams businessId - id of the business to delete the event from
 * @pathParams eventId - id of the event to delete
 * @queryParams repeatId - id of the repeat sequence to delete from
 * @queryParams repeatEffect - the effect of the deletion on the repeat sequence (1 = single event, 2 = all future events, 3 = all events)
 * @queryParams starttimestamp - unix epoch timestamp in seconds for the start of the repeat sequence
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.delete('/businesses/:businessId/events/:eventId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const eventId = request.params.eventId;
    const repeatId = request.query.repeatId;
    const repeatEffect = parseInt(request.query.repeatEffect);
    const starttimestamp = request.query.starttimestamp;

    if (repeatEffect === 1) {
        await db().run(
            ...SQL`DELETE FROM Events WHERE business_id = ${businessId} AND id = ${eventId}`,
        );
    } else if (repeatEffect === 2) {
        await db().run(
            ...SQL`DELETE FROM Events WHERE business_id = ${businessId} AND repeat_id = ${repeatId} AND starttimestamp >= ${starttimestamp}`,
        );
    } else if (repeatEffect === 3) {
        await db().run(
            ...SQL`DELETE FROM Events WHERE business_id = ${businessId} AND repeat_id = ${repeatId}`,
        );
    } else {
        response.sendStatus(400);
        return;
    }

    response.sendStatus(200);
});

/**
 * Gets all the eventtags for the specified business.
 * @pathParams businessId - id of the business to get tags for
 * @requiredPrivileges read access for the business
 * @response json list of tags for the specified business.
 */
router.get('/businesses/:businessId/eventtags', async (request, response) => {
    const uid = await handleAuth(request, response, request.params.businessId, { read: true });
    if (!uid) return;

    const businessId = request.params.businessId;

    const tags = await db().all(
        ...SQL`SELECT DISTINCT tag FROM Events WHERE business_id = ${businessId} AND tag <> ''`,
    );
    response.send(tags);
});

// ============================ EVENT EXPORTS ============================
exports.eventRouter = router;
