/* node:coverage disable */
// import test utils
const { describe, it, before, beforeEach } = require('node:test'); // read about the builtin Node.js test framework here: https://nodejs.org/docs/latest-v18.x/api/test.html
const assert = require('node:assert');
const request = require('supertest'); // we use supertest to test HTTP requests/responses. Read more here: https://github.com/ladjs/supertest
const { v4 } = require('uuid');
const { captureConsole } = require('./utils.js');
captureConsole('./test.server.log');

// import code to test
const { app, listener } = require('../server/server.js');
const { db, reinitializeIfNotExists } = require('../server/Database.js');
const { createBusiness, deleteBusiness } = require('../server/Business.js');
const auth = require('../server/Auth.js');

// ============================ TESTS ============================
describe('Server', () => {
    const TEST_DB_FILE = ':memory:';

    const EXPIRED_TOKEN =
        'eyJhbGciOiJSUzI1NiIsImtpZCI6ImQwNWI0MDljNmYyMmM0MDNlMWY5MWY5ODY3YWM0OTJhOTA2MTk1NTgiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQ2xhaXJlIENsaXV3QFVXLkVkdSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BRWRGVHA0d1R5UVJFNU13dVhNa1B1MGpkZV9ma1FHRllxTDlyTTE3cHBLZT1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9hdHRlbmRhbmNlc2Nhbm5lcnFyIiwiYXVkIjoiYXR0ZW5kYW5jZXNjYW5uZXJxciIsImF1dGhfdGltZSI6MTY3NTIwNjM5MCwidXNlcl9pZCI6IkEySVN4WktRVU9nSlRhQkpmM2pHMEVjNUNMdzIiLCJzdWIiOiJBMklTeFpLUVVPZ0pUYUJKZjNqRzBFYzVDTHcyIiwiaWF0IjoxNjc1MjA2MzkwLCJleHAiOjE2NzUyMDk5OTAsImVtYWlsIjoiY2xpdXdAdXcuZWR1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDIzNDg1MDIyODIwMzg4OTQ5MzUiXSwiZW1haWwiOlsiY2xpdXdAdXcuZWR1Il19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.RA4rqYq1fGfU58OthW1zdb76zfSbvmYTf2al-gwQei8d0sZ5YgUKvXt-wHRAsYCzah1mUebmvfG8U2n_wFcIIZG5W48EN2G4idvHtKJNV149SA5H-QZ9MxaYK3FdY68wtKRcl9IExX0tNth7-4gKHfMWF15Yz8ja2MxH8Xp_RgXmEd1gxKD-86-hT0VADM7ccMbIrURK2d9GCpUoCjCgdzLJVuJ62CotCUjF5QoMwL2IeK-pIBwp2eyh-Hsy1BB3bwcgtxf926bD3MLuWjSNJNjntvcqTbtpD-38xt2TzyWIA6t9xkGHTRCMhFlm8dmv_CPXzN12nLqg6xjp-CYCnQ';
    const INVALID_TOKEN = v4();
    const VALID_TOKEN =
        'eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk1MWMwOGM1MTZhZTM1MmI4OWU0ZDJlMGUxNDA5NmY3MzQ5NDJhODciLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQWxleGFuZGVyIE1ldHpnZXIiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUxtNXd1MEs1SW5aZElPYmhWTW95UDVtaWFzQkxMeFlPRV9KalI4aXg4Y1o9czk2LWMiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYXR0ZW5kYW5jZXNjYW5uZXJxciIsImF1ZCI6ImF0dGVuZGFuY2VzY2FubmVycXIiLCJhdXRoX3RpbWUiOjE2Njk5NjEzMTUsInVzZXJfaWQiOiJmRlN1dkVuSFpiaGtwYUU0Y1F2eWJDUElPUlYyIiwic3ViIjoiZkZTdXZFbkhaYmhrcGFFNGNRdnliQ1BJT1JWMiIsImlhdCI6MTY2OTk2MTMxNSwiZXhwIjoxNjY5OTY0OTE1LCJlbWFpbCI6ImFsZXhhbmRlci5sZUBvdXRsb29rLmRrIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDc5NzQzODUyNDExMjU1ODQwODUiXSwiZW1haWwiOlsiYWxleGFuZGVyLmxlQG91dGxvb2suZGsiXX0sInNpZ25faW5fcHJvdmlkZXIiOiJnb29nbGUuY29tIn19.r50SDswArj53NJbwO8vWAYjWVq7uvo_56RBRyt2ZLKyLrHAOWDsj8Muxg1N2OuAOX5ZOZscXttqPb9wwvnh79tYlciZru5GuBcDXYHuMM18HsOBTkqsdWQlnsneDLawMZYP4u5U9dx2NZSCQIpDmfv8CckPfav7izCcdUxAZaKs6ngzBjpz9O7dpKW8pFscaWtncqyH9PXGtChlDd4kOdYO-YJWkA3-ZZ7_S_AviCHbAG-veyTzoacyCPdDJrNzNq9tiWGvILFtmClpMLqf9v9GdvlRt0dPTHx7p-Q6uTlhXvFGIG8ggqbIxbVxVr_sonbV4Nl47lsoDp0icLLjEuQ';
    const VALID_AUTH = auth.parseJwt(VALID_TOKEN);

    /**
     * Mock the verifyIdToken method once so that it doesn't verify the token with firebase when our special "VALID_TOKEN" is used
     * @param {TestContext} t the test context of the test method to mock within
     * @param {number} times the number of times to mock the method
     */
    function mockToken(t, times = 1) {
        const _verifyIdToken = auth.verifyIdToken;
        t.mock.method(
            auth,
            'verifyIdToken',
            idToken => {
                if (idToken === VALID_TOKEN)
                    return [VALID_AUTH.user_id, VALID_AUTH.name, VALID_AUTH.email];
                else return _verifyIdToken(idToken);
            },
            { times: times },
        );
    }

    /**
     * Skips the token verification step and returns the specified uid and name instead
     * @param {TestContext} t the test context of the test method to mock within
     * @param {string} uid the uid to return when the token is verified
     * @param {string} name the name of the user to return when the token is verified
     * @param {number} times the number of times to mock the method
     */
    function skipTokenVerification(t, uid, name, email, times = 1) {
        t.mock.method(
            auth,
            'verifyIdToken',
            idToken => {
                return [uid, name, email];
            },
            { times: times },
        );
    }

    before(async () => {
        // close the default server that server.js starts so that we can start our own server for testing
        await new Promise((resolve, reject) => listener.close(resolve));
    });

    describe('General Functionality', () => {
        it('Should return a 404 when route is invalid', (t, done) => {
            request(app).post('/api/notfound').expect(404).end(done);
        });
    });

    describe('Database', () => {
        beforeEach(async () => {
            await reinitializeIfNotExists(TEST_DB_FILE, './server/schema.sql');
        });

        it('Should return a value when db().get() called', async () => {
            const result = await db().get('SELECT 1');
            assert.strictEqual(result['1'], 1);
        });
        it('Should return the rowid when db().run() called', async () => {
            const { lastID: result1 } = await db().run(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid1', 'testname1', 'testemail1', 'testcustomerid1'],
            );
            assert.strictEqual(result1, 1);
            const { lastID: result2 } = await db().run(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid2', 'testname2', 'testemail2', 'testcustomerid2'],
            );
            assert.strictEqual(result2, 2);
        });
        it('Should return the number of rows changed when db().run() called', async () => {
            const { changes: result1 } = await db().run(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid1', 'testname', 'testemail1', 'testcustomerid1'],
            );
            assert.strictEqual(result1, 1);
            const { changes: result2 } = await db().run(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid2', 'testname', 'testemail2', 'testcustomerid2'],
            );
            assert.strictEqual(result2, 1);
            const { changes: result3 } = await db().run(
                'UPDATE Users SET name = ? WHERE name = ?',
                ['testname_changed', 'testname'],
            );
            assert.strictEqual(result3, 2);
        });
        it('Should get all the correct rows when db().all() called', async () => {
            const result1 = await db().all('SELECT * FROM Users');
            assert.strictEqual(result1.length, 0);
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testid1',
                'testname1',
                'testemail1',
                'testcustomerid1',
            ]);
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testid2',
                'testname2',
                'testemail2',
                'testcustomerid2',
            ]);
            const result2 = await db().all('SELECT * FROM Users');
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
        beforeEach(async () => {
            await reinitializeIfNotExists(TEST_DB_FILE, './server/schema.sql');
        });

        it('Should return 400 Invalid Input when no token is provided', (t, done) => {
            request(app).get('/isLoggedIn').expect(400).end(done);
        });
        it('Should return 401 Unauthorized when an invalid token is provided', (t, done) => {
            request(app).get('/isLoggedIn').set('idtoken', INVALID_TOKEN).expect(401).end(done);
        });
        it('Should return 401 Unauthorized when a valid but expired token is provided', (t, done) => {
            request(app).get('/isLoggedIn').set('idToken', EXPIRED_TOKEN).expect(401).end(done);
        });
        it('Should return 200 OK and the correct userid when a valid token is provided', (t, done) => {
            mockToken(t);
            request(app)
                .get('/isLoggedIn')
                .set('idToken', VALID_TOKEN)
                .expect(200)
                .expect('Content-Type', /text/)
                .expect(VALID_AUTH.user_id)
                .end(done);
        });
        it('Should correctly enforce single privileges when getAccess is called', async () => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                VALID_AUTH.user_id,
            ]);
            await db().run(
                'INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)',
                [1, 'testbusiness', 'testjoincode', 'testsubscriptionid'],
            );
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                1,
                'owner',
            ]);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { owner: true }), true);
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, { owner: false }),
                false,
            );
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { read: true }), true);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { read: false }), false);
            assert.strictEqual(await auth.getAccess(VALID_AUTH.user_id, 1, { write: true }), true);
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, { write: false }),
                false,
            );
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, { scanner: true }),
                true,
            );
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, { scanner: false }),
                false,
            );
        });
        it('Should correctly enforce multiple privileges when getAccess is called', async () => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                VALID_AUTH.user_id,
            ]);
            await db().run(
                'INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)',
                [1, 'testbusiness', 'testjoincode', 'testsubscriptionid'],
            );
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                1,
                'scanner',
            ]);
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, { owner: true, scanner: true }),
                false,
            );
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, { owner: false, scanner: true }),
                true,
            );
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, { read: true, scanner: true }),
                true,
            );
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, { read: true, scanner: false }),
                false,
            );
        });
        it('Should correctly return false when getAccess is called with invalid privileges', async () => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                VALID_AUTH.user_id,
            ]);
            await db().run(
                'INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)',
                [1, 'testbusiness', 'testjoincode', 'testsubscriptionid'],
            );
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                1,
                'scanner',
            ]);
            assert.strictEqual(
                await auth.getAccess(VALID_AUTH.user_id, 1, {
                    owner: true,
                    scanner: true,
                    invalid: true,
                }),
                false,
            );
        });
        it('Should not let a user access the joincode', async t => {
            mockToken(t);
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                VALID_AUTH.user_id,
            ]);
            await db().run(
                'INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)',
                [1, 'testbusiness', 'testjoincode', 'testsubscriptionid'],
            );
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                1,
                'user',
            ]);
            await request(app)
                .get('/businesses/1/joincode')
                .set('idToken', VALID_TOKEN)
                .expect(403);
        });
        it('Should create a new user when handleAuth is called with a valid but unseen userid', async t => {
            mockToken(t);
            await request(app)
                .get('/isLoggedIn')
                .set('idToken', VALID_TOKEN)
                .expect(200)
                .expect('Content-Type', /text/)
                .expect(VALID_AUTH.user_id);
            const result = await db().all('SELECT COUNT(*) FROM Users');
            assert.strictEqual(result[0]['COUNT(*)'], 1);
        });
    });

    describe('Business', () => {
        beforeEach(async () => {
            await reinitializeIfNotExists(TEST_DB_FILE, './server/schema.sql');
        });

        it('Should create a business with the correct values when createBusiness called', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            const businessId = await createBusiness('testuid', 'testname', 'testsubscriptionid');
            const business = await db().get('SELECT * FROM Businesses WHERE id = ?', [businessId]);
            assert.strictEqual(business.name, 'testname');
            assert.strictEqual(business.joincode.length, 36);
            assert.strictEqual(business.subscriptionId, 'testsubscriptionid');
        });
        it('Should automatically make the user an owner when createBusiness called', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            const businessId = await createBusiness('testuid', 'testname', 'testsubscriptionid');
            const members = await db().all(
                'SELECT * FROM Members WHERE user_id = ? AND business_id = ?',
                ['testuid', businessId],
            );
            assert.strictEqual(members[0].role, 'owner');
            assert.strictEqual(members.length, 1);
            assert.strictEqual(members[0].user_id, 'testuid');
        });
        it('Should delete the business, members, attendance records, and events when deleteBusiness called', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            const businessId = await createBusiness('testuid', 'testname', 'testsubscriptionid');
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId,
                'user',
            ]);
            await db().run(
                'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)',
                [businessId, 'testevent', 'testdescription', 0, 0],
            );
            await db().run(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                ['testuid', businessId, 1, 0, 'teststatus'],
            );
            await deleteBusiness(businessId);
            const business = await db().get('SELECT * FROM Businesses WHERE id = ?', [businessId]);
            assert.strictEqual(business, undefined);
            const members = await db().all('SELECT * FROM Members WHERE business_id = ?', [
                businessId,
            ]);
            assert.strictEqual(members.length, 0);
            const events = await db().all('SELECT * FROM Events WHERE business_id = ?', [
                businessId,
            ]);
            assert.strictEqual(events.length, 0);
            const records = await db().all('SELECT * FROM Records WHERE business_id = ?', [
                businessId,
            ]);
            assert.strictEqual(records.length, 0);
        });
        it('Should get the businesses that the user is a member of when /businesses is requested', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                'testcustomerid',
            ]);
            const businessId1 = await createBusiness(
                VALID_AUTH.user_id,
                'testname1',
                'testsubscriptionid1',
            );
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            const businessId2 = await createBusiness('testuid', 'testname2', 'testsubscriptionid2');
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                businessId2,
                'user',
            ]);
            mockToken(t);
            await request(app)
                .get('/businesses')
                .set('idToken', VALID_TOKEN)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect([
                    { id: businessId1, name: 'testname1', role: 'owner' },
                    { id: businessId2, name: 'testname2', role: 'user' },
                ]);
        });
        it('Should require owner privileges to rename a business', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                'testcustomerid',
            ]);
            // works with owner privileges
            const businessId1 = await createBusiness(
                VALID_AUTH.user_id,
                'testname',
                'testsubscriptionid1',
            );
            mockToken(t);
            await request(app)
                .put('/businesses/' + businessId1 + '/name')
                .set('idToken', VALID_TOKEN)
                .query({ new: 'testname2' })
                .expect(200);

            // doesn't work when not a member
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuserid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            const businessId2 = await createBusiness(
                'testuserid',
                'testname',
                'testsubscriptionid2',
            );
            mockToken(t);
            await request(app)
                .put('/businesses/' + businessId2 + '/name')
                .set('idToken', VALID_TOKEN)
                .query({ new: 'testname2' })
                .expect(403);

            // doesn't work with user privileges
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                businessId2,
                'user',
            ]);
            mockToken(t);
            await request(app)
                .put('/businesses/' + businessId2 + '/name')
                .set('idToken', VALID_TOKEN)
                .query({ new: 'testname2' })
                .expect(403);
        });
        it('Should join with the correct joincode even when multiple businesses exist', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            await createBusiness('testuid', 'testname', 'testsubscriptionid1');
            const businessId = await createBusiness('testuid', 'testname', 'testsubscriptionid2');
            await createBusiness('testuid', 'testname', 'testsubscriptionid3');
            skipTokenVerification(t, 'testuid', 'testname', 'testemail');
            const res = await request(app)
                .get('/businesses/' + businessId + '/joincode')
                .set('idToken', 'testtoken')
                .expect(200)
                .expect('Content-Type', /json/);
            mockToken(t);
            const joincode = JSON.parse(res.text).joincode;
            await request(app)
                .post('/businesses/' + businessId + '/members')
                .set('idToken', VALID_TOKEN)
                .query({ joincode: joincode })
                .expect(200);
            const members = await db().all(
                'SELECT * FROM Members WHERE user_id = ? AND business_id = ?',
                [VALID_AUTH.user_id, businessId],
            );
            assert.strictEqual(members.length, 1);
            assert.strictEqual(members[0].role, 'user');
        });
        it('Should not join with the joincode of another business', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            const businessId1 = await createBusiness('testuid', 'testname', 'testsubscriptionid1');
            const businessId2 = await createBusiness('testuid', 'testname', 'testsubscriptionid2');
            skipTokenVerification(t, 'testuid', 'testname', 'testemail');
            const res = await request(app)
                .get('/businesses/' + businessId1 + '/joincode')
                .set('idToken', 'testtoken')
                .expect(200)
                .expect('Content-Type', /json/);
            mockToken(t);
            const joincode = JSON.parse(res.text).joincode;
            await request(app)
                .post('/businesses/' + businessId2 + '/members')
                .set('idToken', VALID_TOKEN)
                .query({ joincode: joincode })
                .expect(403);
            const members = await db().all(
                'SELECT * FROM Members WHERE user_id = ? AND business_id = ?',
                [VALID_AUTH.user_id, businessId1],
            );
            assert.strictEqual(members.length, 0);
        });
        it('Should only allow non-owners to leave their business', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            const businessId1 = await createBusiness('testuid', 'testname', 'testsubscriptionid1');
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                'testcustomerid',
            ]);
            const businessId2 = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid2',
            );
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                businessId1,
                'user',
            ]);
            mockToken(t, 2);
            await request(app)
                .delete('/businesses/' + businessId1 + '/members/me')
                .set('idToken', VALID_TOKEN)
                .expect(200);
            await request(app)
                .delete('/businesses/' + businessId2 + '/members/me')
                .set('idToken', VALID_TOKEN)
                .expect(403);
        });
        it('Should only allow kicking non-owner members', async t => {
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                'testcustomerid',
            ]);
            const businessId = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid1',
            );
            await db().run('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
                'testcustomerid',
            ]);
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId,
                'user',
            ]);
            mockToken(t, 3);
            // owner can't be removed
            await request(app)
                .delete('/businesses/' + businessId + '/members/' + VALID_AUTH.user_id)
                .set('idToken', VALID_TOKEN)
                .expect(400);
            // member can be removed
            await request(app)
                .delete('/businesses/' + businessId + '/members/testuid')
                .set('idToken', VALID_TOKEN)
                .expect(200);
            // non-member can't be removed
            await request(app)
                .delete('/businesses/' + businessId + '/members/testuid')
                .set('idToken', VALID_TOKEN)
                .expect(400);
        });
        it('Should return the correct attendance data for a business', async t => {
            await db().run('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
            ]);
            const businessId = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid1',
            );
            await db().run('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
            ]);
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId,
                'user',
            ]);
            await db().run(
                'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)',
                [businessId, 'testevent', 'testdescription', 0, 0],
            );
            await db().run(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                ['testuid', businessId, 1, 0, 'teststatus'],
            );
            await db().run(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                [VALID_AUTH.user_id, businessId, 1, 0, 'teststatus'],
            );
            mockToken(t, 1);
            await request(app)
                .get('/businesses/' + businessId + '/attendance')
                .set('idToken', VALID_TOKEN)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect([
                    {
                        name: VALID_AUTH.name,
                        event_id: 1,
                        business_id: businessId,
                        user_id: VALID_AUTH.user_id,
                        timestamp: '0',
                        status: 'teststatus',
                        role: 'owner',
                        email: VALID_AUTH.email,
                        custom_data: '{}',
                    },
                    {
                        name: 'testname',
                        event_id: 1,
                        business_id: businessId,
                        user_id: 'testuid',
                        timestamp: '0',
                        status: 'teststatus',
                        role: 'user',
                        email: 'testemail',
                        custom_data: '{}',
                    },
                    {
                        name: VALID_AUTH.name,
                        id: VALID_AUTH.user_id,
                        role: 'owner',
                        email: VALID_AUTH.email,
                        custom_data: '{}',
                    },
                    {
                        name: 'testname',
                        id: 'testuid',
                        role: 'user',
                        email: 'testemail',
                        custom_data: '{}',
                    },
                ]);
        });
        it('Should return metadata correctly with multiple businesses', async t => {
            await db().run('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
            ]);
            const businessId1 = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid1',
            );
            const businessId2 = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid2',
            );
            await db().run('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
            ]);
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId1,
                'user',
            ]);
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId2,
                'user',
            ]);
            await db().run(
                'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)',
                [businessId1, 'testevent', 'testdescription', 0, 0],
            );
            await db().run(
                'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)',
                [businessId2, 'testevent', 'testdescription', 0, 0],
            );
            await db().run(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                [VALID_AUTH.user_id, businessId1, 1, 0, 'teststatus'],
            );
            await db().run(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                ['testuid', businessId2, 2, 0, 'teststatus'],
            );
            mockToken(t, 1);
            await request(app)
                .get('/businesses/' + businessId1)
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId1 })
                .expect(200)
                .expect('Content-Type', /json/)
                .expect({
                    numUsers: 2,
                    ownerName: VALID_AUTH.name,
                    userEvents: [
                        {
                            name: 'testevent',
                            starttimestamp: '0',
                            endtimestamp: '0',
                            status: 'teststatus',
                            timestamp: '0',
                        },
                    ],
                });
        });
        it('Should assign the correct role unless the role is owner', async t => {
            await db().run('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
            ]);
            const businessId = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid1',
            );
            await db().run('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
            ]);
            await db().run('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId,
                'user',
            ]);
            mockToken(t, 3);
            // don't allow setting owner role
            await request(app)
                .put('/businesses/' + businessId + '/members/testuid/role')
                .set('idToken', VALID_TOKEN)
                .query({ new: 'owner' })
                .expect(403);
            // don't allow changing the owner's role
            await request(app)
                .put('/businesses/' + businessId + '/members/' + VALID_AUTH.user_id + '/role')
                .set('idToken', VALID_TOKEN)
                .query({ new: 'admin' })
                .expect(403);
            // allow setting other roles
            await request(app)
                .put('/businesses/' + businessId + '/members/testuid/role')
                .set('idToken', VALID_TOKEN)
                .query({ new: 'admin' })
                .expect(200);
            const members = await db().all(
                'SELECT * FROM Members WHERE user_id = ? AND business_id = ?',
                ['testuid', businessId],
            );
            assert.strictEqual(members.length, 1);
            assert.strictEqual(members[0].role, 'admin');
        });
        it('Should correctly store and retrieve the application specific username', async t => {
            mockToken(t, 2);
            await request(app)
                .put('/username')
                .set('idToken', VALID_TOKEN)
                .query({ new: 'testname' })
                .expect(200);
            await request(app)
                .get('/username')
                .set('idToken', VALID_TOKEN)
                .expect(200)
                .expect('Content-Type', /json/)
                .expect({ name: 'testname' });
        });
    });
});
