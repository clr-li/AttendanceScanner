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
        ...SQL`SELECT id, name, starttimestamp, endtimestamp, description, tag, repeat_id
        FROM Events WHERE business_id = ${businessId}`,
    );

    response.send(events);
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
 * @bodyParams name - name of the event to create
 * @bodyParams description - description of the event to create
 * @bodyParams starttimestamp - unix epoch timestamp in seconds for when the event is supposed to start
 * @bodyParams endtimestamp - unix epoch timestamp in seconds for when the event is supposed to end
 * @requiredPrivileges write access for the business
 * @response id of the newly created event.
 */
router.post('/businesses/:businessId/events', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const name = request.body.name;
    const description = request.body.description;
    const starttimestamp = request.body.starttimestamp;
    const endtimestamp = request.body.endtimestamp;
    const tag = request.body.tag;

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
                current.getTime() + timezoneOffsetMS
            }, ${currentEndDate.getTime() + timezoneOffsetMS}, ${repeatId}, ${tag})`,
        );
        if (frequency === 'daily') current.setDate(current.getDate() + interval);
        else if (frequency === 'weekly') current.setDate(current.getDate() + 7 * interval);
        else if (frequency === 'monthly') current.setMonth(current.getMonth() + interval);
    }
}

/**
 * Creates a bunch of events for the specified business.
 * @pathParams businessId - id of the business to create an event for
 * @bodyParams name - name of the event to create
 * @bodyParams description - description of the event to create
 * @bodyParams starttimestamp - unix epoch timestamp in seconds for when the event is supposed to start
 * @bodyParams endtimestamp - unix epoch timestamp in seconds for when the event is supposed to end
 * @bodyParams frequency - the unit of time to repeat (daily, weekly, monthly)
 * @bodyParams interval - the number of frequency units between events
 * @bodyParams daysoftheweek - list of values from 0-6 indicating the day of the week starting from Sunday
 * @bodyParams timezoneOffsetMS - the timezone offset in milliseconds
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.post('/businesses/:businessId/events/recurring', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const name = request.body.name;
    const description = request.body.description;
    const timezoneOffsetMS =
        parseInt(request.body.timezoneOffsetMS) - new Date().getTimezoneOffset() * 60_000; // actual offset includes server offset
    const startDate = new Date(request.body.starttimestamp - timezoneOffsetMS);
    const endDate = new Date(request.body.endtimestamp - timezoneOffsetMS);
    const frequency = request.body.frequency;
    const interval = parseInt(request.body.interval);
    const daysoftheweek = request.body.daysoftheweek;
    const repeatId = uuid.v4();
    const tag = request.body.tag;

    if (frequency === 'weekly' && daysoftheweek.length > 0) {
        for (const day of daysoftheweek) {
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
 * @bodyParams name - updated event name. If not provided, the name will not be updated.
 * @bodyParams description - updated event description. If not provided, the description will not be updated.
 * @bodyParams starttimestamp - unix epoch timestamp in seconds for when the updated event is supposed to start. If not provided, the starttimestamp will not be updated.
 * @bodyParams endtimestamp - unix epoch timestamp in seconds for when the updated event is supposed to end. If not provided, the endtimestamp will not be updated.
 * @bodyParams tag - updated event tags. If not provided, the tag will not be updated.
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.patch('/businesses/:businessId/events/:eventId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const eventId = request.params.eventId;
    const name = request.body.name;
    const description = request.body.description;
    const starttimestamp = request.body.starttimestamp;
    const endtimestamp = request.body.endtimestamp;
    const tag = request.body.tag;

    await db().run(
        ...SQL`UPDATE Events SET
            name = coalesce(${name}, name),
            starttimestamp = coalesce(${starttimestamp}, starttimestamp),
            endtimestamp = coalesce(${endtimestamp}, endtimestamp),
            description = coalesce(${description}, description),
            tag = coalesce(${tag}, tag)
        WHERE business_id = ${businessId} AND id = ${eventId}`,
    );

    response.sendStatus(200);
});

/**
 * Updates event info for the specified business and the current event + all future events with the same repeat_id.
 * @pathParams businessId - id of the business to update event info for
 * @pathParams repeatId - id of the repeat sequence to update
 * @queryParams starttimestamp - unix epoch timestamp in seconds for the time of the first event to update
 * @bodyParams name - updated event name. If not provided, the name will not be updated.
 * @bodyParams description - updated event description. If not provided, the description will not be updated.
 * @bodyParams starttimedelta - number of seconds to add to the starttimestamp. If not provided, the starttimestamp will not be updated.
 * @bodyParams endtimedelta - number of seconds to add to the endtimestamp. If not provided, the endtimestamp will not be updated.
 * @bodyParams tag - updated event tags. If not provided, the tag will not be updated.
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.patch('/businesses/:businessId/futureevents/:repeatId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const repeatId = request.params.repeatId;
    const starttimestamp = request.query.starttimestamp;

    const name = request.body.name;
    const description = request.body.description;
    const starttimedelta = request.body.starttimedelta ?? 0;
    const endtimedelta = request.body.endtimedelta ?? 0;
    const tag = request.body.tag;

    await db().run(
        ...SQL`UPDATE Events SET 
                name = coalesce(${name}, name), 
                starttimestamp = CAST((CAST(starttimestamp as INTEGER) + CAST(${starttimedelta} as INTEGER)) as TEXT), 
                endtimestamp = CAST((CAST(endtimestamp as INTEGER) + CAST(${endtimedelta} as INTEGER)) as TEXT), 
                description = coalesce(${description}, description), 
                tag = coalesce(${tag}, tag)
            WHERE business_id = ${businessId} AND repeat_id = ${repeatId} AND starttimestamp >= ${starttimestamp}`,
    );

    response.sendStatus(200);
});

/**
 * Updates event info for the specified business and all events with the same repeat_id.
 * @pathParams businessId - id of the business to update event info for
 * @pathParams repeatId - id of the repeat sequence to update
 * @bodyParams name - updated event name. If not provided, the name will not be updated.
 * @bodyParams description - updated event description. If not provided, the description will not be updated.
 * @bodyParams starttimedelta - number of seconds to add to the starttimestamp. If not provided, the starttimestamp will not be updated.
 * @bodyParams endtimedelta - number of seconds to add to the endtimestamp. If not provided, the endtimestamp will not be updated.
 * @bodyParams tag - updated event tags. If not provided, the tag will not be updated.
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.patch('/businesses/:businessId/allevents/:repeatId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const repeatId = request.params.repeatId;

    const name = request.body.name;
    const description = request.body.description;
    const starttimedelta = request.body.starttimedelta ?? 0;
    const endtimedelta = request.body.endtimedelta ?? 0;
    const tag = request.body.tag;

    await db().run(
        ...SQL`UPDATE Events SET 
                name = coalesce(${name}, name), 
                starttimestamp = CAST((CAST(starttimestamp as INTEGER) + CAST(${starttimedelta} as INTEGER)) as TEXT), 
                endtimestamp = CAST((CAST(endtimestamp as INTEGER) + CAST(${endtimedelta} as INTEGER)) as TEXT), 
                description = coalesce(${description}, description),
                tag = coalesce(${tag}, tag)
            WHERE business_id = ${businessId} AND repeat_id = ${repeatId}`,
    );

    response.sendStatus(200);
});

/**
 * Deletes the specified event for the specified business.
 * @pathParams businessId - id of the business to delete the event from
 * @pathParams eventId - id of the event to delete
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.delete('/businesses/:businessId/events/:eventId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const eventId = request.params.eventId;

    await db().run(
        ...SQL`DELETE FROM Events WHERE business_id = ${businessId} AND id = ${eventId}`,
    );

    response.sendStatus(200);
});

/**
 * Deletes the specified event for the specified business and all future events with the same repeat_id.
 * @pathParams businessId - id of the business to delete the event from
 * @pathParams repeatId - id of the repeat sequence to delete
 * @queryParams starttimestamp - unix epoch timestamp in seconds for the start of the repeat sequence
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.delete('/businesses/:businessId/futureevents/:repeatId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const repeatId = request.params.repeatId;
    const starttimestamp = request.query.starttimestamp;

    await db().run(
        ...SQL`DELETE FROM Events WHERE business_id = ${businessId} AND repeat_id = ${repeatId} AND starttimestamp >= ${starttimestamp}`,
    );
});

/**
 * Deletes the specified event for the specified business and all events with the same repeat_id.
 * @pathParams businessId - id of the business to delete the event from
 * @pathParams repeatId - id of the repeat sequence to delete
 * @requiredPrivileges write access for the business
 * @response 200 OK
 */
router.delete('/businesses/:businessId/allevents/:repeatId', async function (request, response) {
    const uid = await handleAuth(request, response, request.params.businessId, { write: true });
    if (!uid) return;

    const businessId = request.params.businessId;
    const repeatId = request.params.repeatId;

    await db().run(
        ...SQL`DELETE FROM Events WHERE business_id = ${businessId} AND repeat_id = ${repeatId}`,
    );
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
