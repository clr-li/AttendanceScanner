// import test utils
const { describe, it, after, before, beforeEach } = require('node:test'); // read about the builtin Node.js test framework here: https://nodejs.org/docs/latest-v18.x/api/test.html
const assert = require('node:assert');
const request = require('supertest'); // we use supertest to test HTTP requests/responses. Read more here: https://github.com/ladjs/supertest
const { v4 } = require("uuid");

// import code to test
const { app, listener } = require('../server.js');
const { asyncGet, asyncRun, asyncAll, asyncRunWithChanges, asyncRunWithID, reinitializeIfNotExists, close } = require('../Database.js');
const auth = require('../Auth.js');

// ============================ SETUP ============================
/** Capture console log output in a separate file so it doesn't conflict with test output */
const { createWriteStream } = require('fs');
createWriteStream('./test.log', {flags: 'w'}).write('')
console.log = async (message) => {
  const tty = createWriteStream('./test.log', {flags: 'a'});
  const msg = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
  return tty.write(msg + '\n')
}
console.error = console.log
console.log('# Test logs created on ' + new Date().toISOString())

// ============================ TESTS ============================
describe('Server', () => {
    before(async () => {
        // close the default server that server.js starts so that we can start our own server for testing
        await new Promise((resolve, reject) => listener.close(resolve));
    });

    after(async () => {
        // close the last db connection after all tests are done
        await new Promise((resolve, reject) => close(resolve));
    });

    describe('General Functionality', () => {
        it('Should return a 404 when route is invalid', (t, done) => {
            request(app)
                .post('/api/notfound')
                .expect(404)
                .end(done);
        });
    });

    describe('Database', () => {
        beforeEach(() => {
            // use an in-memory database for testing that is reinitialized before each test
            reinitializeIfNotExists(':memory:', './databaseSchema.sql');
        });

        it('Should not return a value when asyncRun called', async () => {
            const result = await asyncRun('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', ['testid', 'testname', 'testcustomerid']);
            assert.strictEqual(result, undefined);
        });
        it('Should return a value when asyncGet called', async () => {
            const result = await asyncGet('SELECT 1');
            assert.strictEqual(result['1'], 1);
        });
        it('Should return the rowid when asyncRunWithID called', async () => {
            const result1 = await asyncRunWithID('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', ['testid1', 'testname1', 'testcustomerid1']);
            assert.strictEqual(result1, 1);
            const result2 = await asyncRunWithID('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', ['testid2', 'testname2', 'testcustomerid2']);
            assert.strictEqual(result2, 2);
        });
        it("Should return the number of rows changed when asyncRunWithChanges called", async () => {
            const result1 = await asyncRunWithChanges('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', ['testid1', 'testname', 'testcustomerid1']);
            assert.strictEqual(result1, 1);
            const result2 = await asyncRunWithChanges('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', ['testid2', 'testname', 'testcustomerid2']);
            assert.strictEqual(result2, 1);
            const result3 = await asyncRunWithChanges('UPDATE Users SET name = ? WHERE name = ?', ['testname_changed', 'testname']);
            assert.strictEqual(result3, 2);
        });
        it("Should get all the correct rows when asyncAll called", async () => {
            const result1 = await asyncAll('SELECT * FROM Users');
            assert.strictEqual(result1.length, 0);
            await asyncRun('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', ['testid1', 'testname1', 'testcustomerid1']);
            await asyncRun('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', ['testid2', 'testname2', 'testcustomerid2']);
            const result2 = await asyncAll('SELECT * FROM Users');
            assert.strictEqual(result2.length, 2);
            assert.strictEqual(result2[0].id, 'testid1');
            assert.strictEqual(result2[0].name, 'testname1');
            assert.strictEqual(result2[0].customer_id, 'testcustomerid1');
            assert.strictEqual(result2[1].id, 'testid2');
            assert.strictEqual(result2[1].name, 'testname2');
            assert.strictEqual(result2[1].customer_id, 'testcustomerid2');
        });
    });

    describe('Authentication', () => {
        const EXPIRED_TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImQwNWI0MDljNmYyMmM0MDNlMWY5MWY5ODY3YWM0OTJhOTA2MTk1NTgiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQ2xhaXJlIENsaXV3QFVXLkVkdSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BRWRGVHA0d1R5UVJFNU13dVhNa1B1MGpkZV9ma1FHRllxTDlyTTE3cHBLZT1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9hdHRlbmRhbmNlc2Nhbm5lcnFyIiwiYXVkIjoiYXR0ZW5kYW5jZXNjYW5uZXJxciIsImF1dGhfdGltZSI6MTY3NTIwNjM5MCwidXNlcl9pZCI6IkEySVN4WktRVU9nSlRhQkpmM2pHMEVjNUNMdzIiLCJzdWIiOiJBMklTeFpLUVVPZ0pUYUJKZjNqRzBFYzVDTHcyIiwiaWF0IjoxNjc1MjA2MzkwLCJleHAiOjE2NzUyMDk5OTAsImVtYWlsIjoiY2xpdXdAdXcuZWR1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDIzNDg1MDIyODIwMzg4OTQ5MzUiXSwiZW1haWwiOlsiY2xpdXdAdXcuZWR1Il19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.RA4rqYq1fGfU58OthW1zdb76zfSbvmYTf2al-gwQei8d0sZ5YgUKvXt-wHRAsYCzah1mUebmvfG8U2n_wFcIIZG5W48EN2G4idvHtKJNV149SA5H-QZ9MxaYK3FdY68wtKRcl9IExX0tNth7-4gKHfMWF15Yz8ja2MxH8Xp_RgXmEd1gxKD-86-hT0VADM7ccMbIrURK2d9GCpUoCjCgdzLJVuJ62CotCUjF5QoMwL2IeK-pIBwp2eyh-Hsy1BB3bwcgtxf926bD3MLuWjSNJNjntvcqTbtpD-38xt2TzyWIA6t9xkGHTRCMhFlm8dmv_CPXzN12nLqg6xjp-CYCnQ";
        const INVALID_TOKEN = v4();
        const VALID_TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk1MWMwOGM1MTZhZTM1MmI4OWU0ZDJlMGUxNDA5NmY3MzQ5NDJhODciLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQWxleGFuZGVyIE1ldHpnZXIiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUxtNXd1MEs1SW5aZElPYmhWTW95UDVtaWFzQkxMeFlPRV9KalI4aXg4Y1o9czk2LWMiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYXR0ZW5kYW5jZXNjYW5uZXJxciIsImF1ZCI6ImF0dGVuZGFuY2VzY2FubmVycXIiLCJhdXRoX3RpbWUiOjE2Njk5NjEzMTUsInVzZXJfaWQiOiJmRlN1dkVuSFpiaGtwYUU0Y1F2eWJDUElPUlYyIiwic3ViIjoiZkZTdXZFbkhaYmhrcGFFNGNRdnliQ1BJT1JWMiIsImlhdCI6MTY2OTk2MTMxNSwiZXhwIjoxNjY5OTY0OTE1LCJlbWFpbCI6ImFsZXhhbmRlci5sZUBvdXRsb29rLmRrIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDc5NzQzODUyNDExMjU1ODQwODUiXSwiZW1haWwiOlsiYWxleGFuZGVyLmxlQG91dGxvb2suZGsiXX0sInNpZ25faW5fcHJvdmlkZXIiOiJnb29nbGUuY29tIn19.r50SDswArj53NJbwO8vWAYjWVq7uvo_56RBRyt2ZLKyLrHAOWDsj8Muxg1N2OuAOX5ZOZscXttqPb9wwvnh79tYlciZru5GuBcDXYHuMM18HsOBTkqsdWQlnsneDLawMZYP4u5U9dx2NZSCQIpDmfv8CckPfav7izCcdUxAZaKs6ngzBjpz9O7dpKW8pFscaWtncqyH9PXGtChlDd4kOdYO-YJWkA3-ZZ7_S_AviCHbAG-veyTzoacyCPdDJrNzNq9tiWGvILFtmClpMLqf9v9GdvlRt0dPTHx7p-Q6uTlhXvFGIG8ggqbIxbVxVr_sonbV4Nl47lsoDp0icLLjEuQ";
        const VALID_AUTH = auth.parseJwt(VALID_TOKEN);

        beforeEach(() => {
            reinitializeIfNotExists(':memory:', './databaseSchema.sql');
        });

        it('Should return 400 Invalid Input when no token is provided', (t, done) => {
            request(app)
                .get('/isLoggedIn')
                .expect(400)
                .end(done);
        });
        it('Should return 401 Unauthorized when an invalid token is provided', (t, done) => {
            request(app)
                .get('/isLoggedIn')
                .set('idtoken', INVALID_TOKEN)
                .expect(401)
                .end(done);
        });
        it('Should return 401 Unauthorized when a valid but expired token is provided', (t, done) => {            
            request(app)
                .get('/isLoggedIn')
                .set('idToken', EXPIRED_TOKEN)
                .expect(401)
                .end(done);
        });
        it('Should return 200 OK and the correct userid when a valid token is provided', (t, done) => {
            // we mock the getUID method once so that it doesn't verify the token with firebase
            t.mock.method(auth, 'getUID', (idToken) => idToken === VALID_TOKEN ? VALID_AUTH.user_id : false, { times: 1 });
            request(app)
                .get('/isLoggedIn')
                .set('idToken', VALID_TOKEN)
                .expect(200)
                .expect('Content-Type', /text/)
                .expect(VALID_AUTH.user_id)
                .end(done);
        });
        it('Should correctly enforce single privileges when getAccess is called', async () => {
            await asyncRun('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', [VALID_AUTH.user_id, VALID_AUTH.name, VALID_AUTH.user_id]);
            await asyncRun('INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)', [1, 'testbusiness', 'testjoincode', 'testsubscriptionid']);
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [VALID_AUTH.user_id, 1, 'owner']);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { owner: true }), true);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { owner: false }), false);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { read: true }), true);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { read: false }), false);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { write: true }), true);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { write: false }), false);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { scanner: true }), true);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { scanner: false }), false);
        });
        it("Should correctly enforce multiple privileges when getAccess is called", async () => {
            await asyncRun('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', [VALID_AUTH.user_id, VALID_AUTH.name, VALID_AUTH.user_id]);
            await asyncRun('INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)', [1, 'testbusiness', 'testjoincode', 'testsubscriptionid']);
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [VALID_AUTH.user_id, 1, 'scanner']);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { owner: true, scanner: true }), false);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { owner: false, scanner: true }), true);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { read: true, scanner: true }), true);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { read: true, scanner: false }), false);
        });
        it("Should correctly return false when getAccess is called with invalid privileges", async () => {
            await asyncRun('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', [VALID_AUTH.user_id, VALID_AUTH.name, VALID_AUTH.user_id]);
            await asyncRun('INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)', [1, 'testbusiness', 'testjoincode', 'testsubscriptionid']);
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [VALID_AUTH.user_id, 1, 'scanner']);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { owner: true, scanner: true, invalid: true }), false);
        });
        it("Should return 403 Access denied when /joincode is called as a user", async (t) => {
            // we mock the getUID method once so that it doesn't verify the token with firebase
            t.mock.method(auth, 'getUID', (idToken) => idToken === VALID_TOKEN ? VALID_AUTH.user_id : false, { times: 1 });
            await asyncRun('INSERT INTO Users (id, name, customer_id) VALUES (?, ?, ?)', [VALID_AUTH.user_id, VALID_AUTH.name, VALID_AUTH.user_id]);
            await asyncRun('INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)', [1, 'testbusiness', 'testjoincode', 'testsubscriptionid']);
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [VALID_AUTH.user_id, 1, 'user']);
            await request(app)
                .get('/joincode')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: 1 })
                .expect(403);
        });
    });
});