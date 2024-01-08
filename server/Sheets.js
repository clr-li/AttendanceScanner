// express for routing
const express = require('express'),
    router = express.Router();
// database access
const { asyncGet, asyncAll, asyncRun, asyncRunWithID, asyncRunWithChanges } = require('./Database');
// user auth
const { handleAuth, getAccess } = require('./Auth');
// random universal unique ids for joincodes
const uuid = require('uuid');

router.get('/sheet/:bid/', async (req, res) => {
    const businessId = req.params.bid;

    const events = await asyncAll(
        `
    SELECT
        Events.id,
        Events.name
    FROM
        Events
    WHERE
        Events.business_id = ?`,
        [businessId],
    );

    const concatArr = [];
    for (let i = 0; i < events.length; i++) {
        concatArr.push(
            `group_concat(case when Events.id = ${events[i].id} then IFNULL(Records.status, case when CAST(strftime('%s', 'now') AS INT) > Events.endtimestamp then 'ABSENT' else 'N/A' end) end) as "z${events[i].id}"`,
        );
    }

    const tableData = await asyncAll(
        `
    SELECT
        Users.name AS Name,
        ${concatArr.join(', ')}
    FROM
        Members
        INNER JOIN Users ON Members.user_id = Users.id
        JOIN Events ON Events.business_id = Members.business_id
        LEFT JOIN Records ON Events.id = Records.event_id AND Records.user_id = Users.id
    WHERE
        Members.business_id = ?
    GROUP BY
        Users.id
    ORDER BY
        Users.name`,
        [businessId],
    );

    const tableCSV = [['Name', ...events.map(x => "'" + x.name)]].concat(tableData);
    res.set('Content-Type', 'text/csv');
    res.send(
        tableCSV
            .map(it => {
                return Object.values(it).toString();
            })
            .join('\n'),
    );
});

// ============================ SHEETS EXPORTS ============================
exports.sheetsRouter = router;
