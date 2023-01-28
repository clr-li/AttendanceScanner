const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const fs = require("fs");
const cors = require('cors')
let corsOptions = {
  origin: 'https://attendancescannerqr.web.app',
}
app.use(cors(corsOptions))
const uuid = require('uuid');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const https = require('https');
const { exec } = require("child_process"); 

const braintree = require("braintree");

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.MERCHANTID,
  publicKey: process.env.MERCHANTPUBLIC,
  privateKey: process.env.MERCHANTPRIVATE
});

const PLAN_IDS = {
  STANDARD: "n2wg"
};
const PLAN_NAME = new Map(Object.entries(PLAN_IDS).map(keyval => [keyval[1], keyval[0]])); // reverse lookup plan name from plan id

var admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
});

function parseJwt(token) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

async function getUID(idToken) {
  if (typeof idToken != "string") throw 'Invalid idToken';
  // idToken comes from the client app
  try {
    // let decodedToken = await admin.auth().verifyIdToken(idToken);
    // const uid = decodedToken.uid;
    // return uid;    
    let decodedToken = parseJwt(idToken); // development purposes, don't require idToken to be valid
    let name = await asyncGet(`SELECT FirstName FROM Users WHERE id=?`, [decodedToken.user_id]);
    if (!name) {
      await asyncRun(`INSERT INTO Users (FirstName, LastName, BusinessIDs, id) VALUES (?, ?, ?, ?)`, [decodedToken.name.split(" ")[0], decodedToken.name.split(" ")[1], "", decodedToken.user_id]);
    }
    return decodedToken.user_id;
  } catch(error) {
    console.error("getUID error: " + error);
    return false;
  };
}

async function getAccess(businessid, userid, requireadmin, requirescanner, requireuser=true) {
  try {
    if (requireuser) {
      const user = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [userid]);
      // const validbusinessids = new Set(user.BusinessIDs.split(','));
      // if (!validbusinessids.has(businessid)) return false; // user doesn't belong to the business
    }
    const business = await asyncGet(`SELECT roleaccess, usertable FROM Businesses WHERE id = ?`, [businessid]);
    const roleaccess = business.roleaccess;
    const roles = JSON.parse(roleaccess);
    const table = business.usertable;
    const role = (await asyncGet(`SELECT role from "${table}" WHERE userid = ?`, [userid])).role;
    if (!(role in roles)) return false; // if the role is invalid, user doesn't have access
    const access = roles[role];
    return (access['admin'] == requireadmin || !requireadmin) && (access['scanner'] == requirescanner || !requirescanner);
  } catch (err) {
    console.error("getAccess error: " + err);
    return false;
  }
}

app.get("/isLoggedIn", (request, response) => {
  if (!request.headers.idtoken) {
    response.sendStatus(400);
    return;
  }
  getUID(request.headers.idtoken).then(uid => {
    console.log('logged in: ' + uid);
    response.status = uid ? 200 : 403;
    response.send(uid);
  });
});

// init sqlite db
const dbFile = "./.data/AttendanceSoftware.db";
const exists = fs.existsSync(dbFile);
let db = null;
if (!exists) {
  console.log("no database file found :(");
}
else {
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database(dbFile);
}
const asyncGet = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve(result);
    });
  });
};
const asyncAll = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, result) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve(result);
    });
  });
};
const asyncRun = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve();
    });
  });
};
const asyncRunWithID = (sql, params=[]) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) { console.log("error: " + sql); reject(err); }
      else resolve(this.lastID);
    });
  });
};

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// this token authorizes the client to access the payment portal and modify customer payment information
// if the client is already a customer, we give them access to their braintree customer via the stored id
app.get("/clientToken", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    
    const customerId = (await asyncGet(`SELECT Customer_id FROM Users WHERE id = ?`, [uid])).Customer_id;
    const tokenOptions = {};
    console.log("CustomerId requested a client token: " + customerId)
    if (customerId) {
      tokenOptions.customerId = customerId;
      tokenOptions.options = {
        failOnDuplicatePaymentMethod: true,
        makeDefault: true,
        verifyCard: true
      };
    }
    
    let res = await gateway.clientToken.generate(tokenOptions);
    const clientToken = res.clientToken;
    response.send(clientToken);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

// we get the paymentNonce from the client (a secure way to communicate payment information)
// and use it to create a customer in the braintree vault
// or if the client already has a customer, we get that customer using the stored id
// then we select the default payment method (as set by the client SDK) of the customer 
// and use the corresponding paymentMethodToken to subscribe to the payment plan
app.post("/checkout", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    
    const nonceFromTheClient = request.body.nonce;
    const deviceData = request.body.deviceData;
    const businessName = request.body.businessName;
    
    const user = await asyncGet(`SELECT Customer_id, FirstName, LastName FROM Users WHERE id = ?`, [uid]);
    
    let paymentToken;
    if (user.Customer_id) { // customer already exists in braintree vault
      const result = await gateway.paymentMethod.create({
        customerId: user.Customer_id,
        paymentMethodNonce: nonceFromTheClient,
        options: {
          failOnDuplicatePaymentMethod: true,
          makeDefault: true,
          verifyCard: true
        }
      });
      if (!result.success) {
          // customer validations, payment method validations or card verification is NOT in order
          response.sendStatus(401);
          return;
      }
      paymentToken = result.paymentMethod.token;
    } else { // customer doesn't exist, so we use the paymentMethodNonce to create them!
      const result = await gateway.customer.create({
        firstName: user.FirstName,
        lastName: user.LastName,
        paymentMethodNonce: nonceFromTheClient,
        deviceData: deviceData
      });
      if (!result.success) {
          // customer validations, payment method validations or card verification is NOT in order
          response.sendStatus(401);
          return;
      }
      const customer = result.customer;
      const customerId = customer.id; // e.g 160923
      paymentToken = customer.paymentMethods[0].token; // e.g f28wm
      
      console.log("Created customer with id: " + customerId);
      
      // save customer id in database so we can find their information in the braintree vault later
      asyncRun(`UPDATE Users SET Customer_id = ? WHERE id = ?`, [customerId, uid]);
    }
    
    const subscriptionResult = await gateway.subscription.create({
      paymentMethodToken: paymentToken,
      planId: PLAN_IDS.STANDARD,
    });
    if (!subscriptionResult.success) {
        // customer validations, payment method validations or card verification is NOT in order
        response.sendStatus(401);
        return;
    }
    console.log("Added subscription via paymentToken: " + paymentToken)
    createBusiness(uid, businessName);
    
    response.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

async function createBusiness(uid, name) {
  const user = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
  if (user.BusinessIDs != "") return
  
  const rand = uuid.v4();
  const attendanceTableName = "ATT" + rand;
  const eventTableName = "EVT" + rand;
  const userTableName = "USR" + rand;
  await asyncRun(`
    CREATE TABLE "${userTableName}" (
        "userid"        TEXT NOT NULL UNIQUE,
        "role"  TEXT,
        FOREIGN KEY("userid") REFERENCES "Users"("id"),
        PRIMARY KEY("userid")
    );
  `);
  await asyncRun(`
    CREATE TABLE "${eventTableName}" (
        "id"    INTEGER NOT NULL UNIQUE,
        "name"  TEXT,
        "starttimestamp"        TEXT NOT NULL,
        "userids"       TEXT,
        "description"   TEXT,
        "endtimestamp"  TEXT,
        PRIMARY KEY("id" AUTOINCREMENT)
    );
  `);
  await asyncRun(`
    CREATE TABLE "${attendanceTableName}" (
        "eventid"       INTEGER NOT NULL,
        "userid"        INTEGER NOT NULL,
        "timestamp"     TEXT NOT NULL,
        "status"        TEXT NOT NULL,
        FOREIGN KEY("userid") REFERENCES "${userTableName}"("userid"),
        FOREIGN KEY("eventid") REFERENCES "${eventTableName}"("id")
    );
  `); 
  const businessID = await asyncRunWithID(`INSERT INTO Businesses (Name, AttendanceTable, usertable, eventtable, roleaccess, joincode) VALUES (?, ?, ?, ?, ?, ?) `, [
    name, attendanceTableName, userTableName, eventTableName, '{"admin":{"admin":true,"scanner":true}}', uuid.v4()
  ]);
  console.log('Created new business with id: ' + businessID);
  await asyncRun('UPDATE Users SET BusinessIDs = ? WHERE id = ?', [businessID, uid]);
}

async function deleteBusiness(uids, businessID) {
  await asyncRun(`UPDATE Users SET BusinessIDs = NULL WHERE id IN (${arr.join(", ")})`);
 
  const rand = uuid.v4();
  const attendanceTableName = "ATT" + rand;
  const eventTableName = "EVT" + rand;
  const userTableName = "USR" + rand;
  
  console.log('Deleted the business with id: ' + businessID);
  
}

// returns true if the user (specified by uid) subscribes at least once to the planId 
// (allowtrial specifies whether trial subscriptions should count)
// throws any error that's not a "notFoundError" (the user hasn't signed up as a customer yet)
// returns false otherwise
async function verifySubscription(uid, planId, allowtrial=true) {
  const user = await asyncGet(`SELECT Customer_id FROM Users WHERE id = ?`, [uid]);
  if (!user.Customer_id) return false;
  try {
    var customer = await gateway.customer.find("" + user.Customer_id);
  } catch (err) {
    if (err.type === "notFoundError") return false;
    throw err;
  }
  customer.paymentMethods.forEach(paymentMethod => {
    paymentMethod.subscriptions.forEach(subscription => {
      if (subscription.status === "Active" 
          && subscription.planId === planId 
          && (allowtrial || !subscription.trialPeriod)) {
          return true;
      }
    });
  });
  return false;
}

// get's the noncanceled subscriptions
app.get("/subscriptions", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    
    const customerId = (await asyncGet(`SELECT Customer_id FROM Users WHERE id = ?`, [uid])).Customer_id;
    if (!customerId) {
        response.sendStatus(401);
        return;
    }
    const customer = await gateway.customer.find("" + customerId);
    let subscriptions = [];
    
    customer.paymentMethods.forEach(paymentMethod => {
      subscriptions = [...subscriptions, ...paymentMethod.subscriptions];
    });
    
    subscriptions = subscriptions.filter(subscription => subscription.status != "Canceled");
    
    subscriptions = subscriptions.map(subscription => {
      return {
        plan: PLAN_NAME.get(subscription.planId),
        nextBillingDate: subscription.nextBillingDate,
        nextBillAmount: subscription.nextBillAmount,
        status: subscription.status,
        trialPeriod: subscription.trialPeriod,
        id: subscription.id
      };
    });
    
    response.send(subscriptions);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/cancelSubscription", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    
    const subscriptionId = request.query.id;
    
    const customerId = (await asyncGet(`SELECT Customer_id FROM Users WHERE id = ?`, [uid])).Customer_id;
    if (!customerId) {
        response.sendStatus(401);
        return;
    }
    const customer = await gateway.customer.find("" + customerId);
    
    let subscriptions = [];
    customer.paymentMethods.forEach(paymentMethod => {
      subscriptions = [...subscriptions, ...paymentMethod.subscriptions];
    });
    
    for (let i = 0; i < subscriptions.length; i++) {
      let subscription = subscriptions[i];
      if (subscription.id === subscriptionId) {
        await gateway.subscription.cancel(subscriptionId);
        response.sendStatus(200);
        return
      }
    }
    
    response.sendStatus(403); // subscription is not owned by customer
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});


// =================== ATTENDANCE LOGIC =========================

app.get("/business", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }

    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    const row = await asyncGet(`SELECT Name FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    response.send(row);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/joincode", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }

    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    const row = await asyncGet(`SELECT id, joincode FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    response.send(row);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/join", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }

    const businessId = request.query.id;
    const joincode = request.query.code;
    // const email = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    const row = await asyncGet(`SELECT joincode, usertable, pendingemails FROM Businesses WHERE id = ?`, [businessId]);
    if (row.joincode === joincode) {
        await asyncRun(`INSERT OR IGNORE INTO "${row.usertable}" (userid, role) VALUES (?, 'user')`, [uid]);
      response.sendStatus(200);
    } else {
      response.sendStatus(403);
    }
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/events", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, false, true))) {
      response.sendStatus(403);
      return;
    }

    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    const events = await asyncAll(`SELECT id, name, starttimestamp, endtimestamp, userids, description FROM "${table.eventtable}"`);
    response.status = 200;
    response.send(events);  
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }    
});

app.get("/recordAttendance", async (request, response) => {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, false, true))) {
      response.sendStatus(403);
      return;
    }
    
    const eventid = request.query.eventid;
    const userid = request.query.userid;
    const status = request.query.status;
    if (typeof status != "string" || typeof userid != "string" || (typeof eventid != "number" && typeof eventid != "string")) throw "Invalid input";
    
    const table = await asyncGet(`SELECT AttendanceTable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    await asyncRun(`INSERT INTO "${table.AttendanceTable}" (eventid, userid, timestamp, status) VALUES (?, ?, ?, ?)`, [eventid, userid, Date.now(), status]);
    response.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/attendancedata", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }
    const eventid = request.query.eventid;
    const userid = request.query.userid;
    if (typeof userid != "string") throw new Error("Invalid input");
    
    const table = await asyncGet(`SELECT AttendanceTable, usertable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    console.log(table)
    let sql = `SELECT Users.firstname, Users.lastname, "${table.AttendanceTable}".* FROM "${table.AttendanceTable}" LEFT JOIN Users ON "${table.AttendanceTable}".userid = Users.id GROUP BY Users.id, "${table.AttendanceTable}".eventid ORDER BY "${table.AttendanceTable}".timestamp DESC`;
    if (eventid == "*" && userid == "*") {
      var attendanceinfo = await asyncAll(sql);
    } else if (eventid == "*") {
      var attendanceinfo = await asyncAll(sql + "WHERE userid = ?", [userid]);
    } else if (userid == "*") {
      var attendanceinfo = await asyncAll(sql + "WHERE eventid = ?", [eventid]);
    } else {
      var attendanceinfo = await asyncAll(sql + "WHERE eventid = ? AND userid = ?", [eventid, userid]);
    }
    if (userid == "*") {
      let userids = new Set();
      attendanceinfo.forEach((attendanceRecord) => {
        userids.add(attendanceRecord.userid);
      });
      sql = `SELECT Users.firstname, Users.lastname, "${table.usertable}".userid FROM "${table.usertable}" LEFT JOIN Users ON "${table.usertable}".userid = Users.id WHERE `;
      userids.forEach((uID) => {
        sql += `"${uID}" != "${table.usertable}".userid AND `;
      });
      if (userids.size === 0) {
        sql = sql.substr(0, sql.length - 7);
      } else {
        sql = sql.substr(0, sql.length - 5);
      }
      attendanceinfo = attendanceinfo.concat(await asyncAll(sql));
    }
    response.send(attendanceinfo);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/makeEvent", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }

    const name = request.query.name;
    const description = request.query.description;
    const starttimestamp = request.query.starttimestamp;
    const endtimestamp = request.query.endtimestamp;
    const userids = request.query.userids;
    if (typeof name != "string" || typeof description != "string" || typeof userids != "string" || (typeof starttimestamp != "number" && typeof starttimestamp != "string") || (typeof endtimestamp != "number" && typeof endtimestamp != "string")) throw "Invalid input";

    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    await asyncRun(`INSERT INTO "${table.eventtable}" (name, starttimestamp, endtimestamp, userids, description) VALUES (?, ?, ?, ?, ?)`,
                  [name, starttimestamp, endtimestamp, userids, description]);
    const eventid = await asyncGet(`SELECT last_insert_rowid() FROM "${table.eventtable}"`);
    response.status(200);
    response.send(eventid);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/updateevent", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }

    const name = request.query.name;
    const description = request.query.description;
    const starttimestamp = request.query.starttimestamp;
    const endtimestamp = request.query.endtimestamp;
    const eventid = request.query.eventid;
    if (typeof name != "string" || typeof description != "string" || (typeof starttimestamp != "number" && typeof starttimestamp != "string") || (typeof endtimestamp != "number" && typeof endtimestamp != "string")) throw "Invalid input";

    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    await asyncRun(`UPDATE "${table.eventtable}" SET name = ?, starttimestamp = ?, endtimestamp = ?, description = ? WHERE id = ?`,
                  [name, starttimestamp, endtimestamp, description, eventid]);
    response.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/deleteevent", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }

    const eventid = request.query.eventid;

    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    await asyncRun(`DELETE FROM "${table.eventtable}" WHERE id = ?`, [eventid]);
    response.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

app.get("/eventdata", async function(request, response) {
  try {
    const uid = await getUID(request.headers.idtoken);
    if (!uid) {
      response.sendStatus(403);
      return;
    }
    const id = await asyncGet(`SELECT BusinessIDs FROM Users WHERE id = ?`, [uid]);
    if (!(await getAccess(id.BusinessIDs, uid, true, false))) {
      response.sendStatus(403);
      return;
    }
    
    const eventid = request.query.eventid;
    if (typeof eventid != "string" && typeof eventid != "number") throw "Invalid input";
    
    const table = await asyncGet(`SELECT eventtable FROM Businesses WHERE id = ?`, [id.BusinessIDs]);
    const eventinfo = await asyncGet(`SELECT * FROM "${table.eventtable}" WHERE id = ?`, [eventid]);
    response.send(eventinfo);
  } catch (err) {
    console.error(err.message);
    response.sendStatus(400);
  }
});

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});

// How to add idToken to glitch preview:
// from firebase url:
//   - login
//   - copy idtoken cookie
// in glitch preview devtools console
//   - run `import('./util.js').then(m => util = m);`
//   - run `util.setCookie('idtoken', '[PASTE COOKIE STRING HERE]', 24)`