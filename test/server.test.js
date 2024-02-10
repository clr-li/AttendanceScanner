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
const {
    asyncGet,
    asyncRun,
    asyncAll,
    asyncRunWithChanges,
    asyncRunWithID,
    reinitializeIfNotExists,
} = require('../server/Database.js');
const { createBusiness, deleteBusiness } = require('../server/Business.js');
const auth = require('../server/Auth.js');

// ============================ TESTS ============================
describe('Server', () => {
    const TEST_DB_FILE = process.env.DB_FILE || ':memory:';

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
            await reinitializeIfNotExists(TEST_DB_FILE, './server/databaseSchema.sql');
        });

        it('Should not return a value when asyncRun called', async () => {
            const result = await asyncRun(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid', 'testname', 'testemail', 'testcustomerid'],
            );
            assert.strictEqual(result, undefined);
        });
        it('Should return a value when asyncGet called', async () => {
            const result = await asyncGet('SELECT 1');
            assert.strictEqual(result['1'], 1);
        });
        it('Should return the rowid when asyncRunWithID called', async () => {
            const result1 = await asyncRunWithID(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid1', 'testname1', 'testemail1', 'testcustomerid1'],
            );
            assert.strictEqual(result1, 1);
            const result2 = await asyncRunWithID(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid2', 'testname2', 'testemail2', 'testcustomerid2'],
            );
            assert.strictEqual(result2, 2);
        });
        it('Should return the number of rows changed when asyncRunWithChanges called', async () => {
            const result1 = await asyncRunWithChanges(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid1', 'testname', 'testemail1', 'testcustomerid1'],
            );
            assert.strictEqual(result1, 1);
            const result2 = await asyncRunWithChanges(
                'INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)',
                ['testid2', 'testname', 'testemail2', 'testcustomerid2'],
            );
            assert.strictEqual(result2, 1);
            const result3 = await asyncRunWithChanges('UPDATE Users SET name = ? WHERE name = ?', [
                'testname_changed',
                'testname',
            ]);
            assert.strictEqual(result3, 2);
        });
        it('Should get all the correct rows when asyncAll called', async () => {
            const result1 = await asyncAll('SELECT * FROM Users');
            assert.strictEqual(result1.length, 0);
            await asyncRun('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testid1',
                'testname1',
                'testemail1',
                'testcustomerid1',
            ]);
            await asyncRun('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                'testid2',
                'testname2',
                'testemail2',
                'testcustomerid2',
            ]);
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
        beforeEach(async () => {
            await reinitializeIfNotExists(TEST_DB_FILE, './server/databaseSchema.sql');
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
            await asyncRun('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                VALID_AUTH.user_id,
            ]);
            await asyncRun(
                'INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)',
                [1, 'testbusiness', 'testjoincode', 'testsubscriptionid'],
            );
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
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
            await asyncRun('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                VALID_AUTH.user_id,
            ]);
            await asyncRun(
                'INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)',
                [1, 'testbusiness', 'testjoincode', 'testsubscriptionid'],
            );
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
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
            await asyncRun('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                VALID_AUTH.user_id,
            ]);
            await asyncRun(
                'INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)',
                [1, 'testbusiness', 'testjoincode', 'testsubscriptionid'],
            );
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
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
        it('Should return 403 Access denied when /joincode is called as a user', async t => {
            mockToken(t);
            await asyncRun('INSERT INTO Users (id, name, email, customer_id) VALUES (?, ?, ?, ?)', [
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                VALID_AUTH.email,
                VALID_AUTH.user_id,
            ]);
            await asyncRun(
                'INSERT INTO Businesses (id, name, joincode, subscriptionId) VALUES (?, ?, ?, ?)',
                [1, 'testbusiness', 'testjoincode', 'testsubscriptionid'],
            );
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                1,
                'user',
            ]);
            await request(app)
                .get('/joincode')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: 1 })
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
            const result = await asyncAll('SELECT COUNT(*) FROM Users');
            assert.strictEqual(result[0]['COUNT(*)'], 1);
        });
    });

    describe('Business', () => {
        beforeEach(async () => {
            await reinitializeIfNotExists(TEST_DB_FILE, './server/databaseSchema.sql');
        });

        it('Should create a business with the correct values when createBusiness called', async t => {
            const businessId = await createBusiness('testuid', 'testname', 'testsubscriptionid');
            const business = await asyncGet('SELECT * FROM Businesses WHERE id = ?', [businessId]);
            assert.strictEqual(business.name, 'testname');
            assert.strictEqual(business.joincode.length, 36);
            assert.strictEqual(business.subscriptionId, 'testsubscriptionid');
        });
        it('Should automatically make the user an owner when createBusiness called', async t => {
            const businessId = await createBusiness('testuid', 'testname', 'testsubscriptionid');
            const members = await asyncAll(
                'SELECT * FROM Members WHERE user_id = ? AND business_id = ?',
                ['testuid', businessId],
            );
            assert.strictEqual(members[0].role, 'owner');
            assert.strictEqual(members.length, 1);
            assert.strictEqual(members[0].user_id, 'testuid');
        });
        it('Should delete the business, members, attendance records, and events when deleteBusiness called', async t => {
            const businessId = await createBusiness('testuid', 'testname', 'testsubscriptionid');
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId,
                'user',
            ]);
            await asyncRun(
                'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)',
                [businessId, 'testevent', 'testdescription', 0, 0],
            );
            await asyncRun(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                ['testuid', businessId, 1, 0, 'teststatus'],
            );
            await deleteBusiness(businessId);
            const business = await asyncGet('SELECT * FROM Businesses WHERE id = ?', [businessId]);
            assert.strictEqual(business, undefined);
            const members = await asyncAll('SELECT * FROM Members WHERE business_id = ?', [
                businessId,
            ]);
            assert.strictEqual(members.length, 0);
            const events = await asyncAll('SELECT * FROM Events WHERE business_id = ?', [
                businessId,
            ]);
            assert.strictEqual(events.length, 0);
            const records = await asyncAll('SELECT * FROM Records WHERE business_id = ?', [
                businessId,
            ]);
            assert.strictEqual(records.length, 0);
        });
        it('Should get the businesses that the user is a member of when /businesses is requested', async t => {
            const businessId1 = await createBusiness(
                VALID_AUTH.user_id,
                'testname1',
                'testsubscriptionid1',
            );
            const businessId2 = await createBusiness('testuid', 'testname2', 'testsubscriptionid2');
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
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
        it('Should require owner privileges when /renameBusiness is requested', async t => {
            // works with owner privileges
            const businessId1 = await createBusiness(
                VALID_AUTH.user_id,
                'testname',
                'testsubscriptionid1',
            );
            mockToken(t);
            await request(app)
                .get('/renameBusiness')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId1, name: 'testname2' })
                .expect(200);

            // doesn't work when not a member
            const businessId2 = await createBusiness(
                'testuserid',
                'testname',
                'testsubscriptionid2',
            );
            mockToken(t);
            await request(app)
                .get('/renameBusiness')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId2, name: 'testname2' })
                .expect(403);

            // doesn't work with user privileges
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                businessId2,
                'user',
            ]);
            mockToken(t);
            await request(app)
                .get('/renameBusiness')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId2, name: 'testname2' })
                .expect(403);
        });
        it('Should join when /join is requested with the correct joincode even when multiple businesses exist', async t => {
            await createBusiness('testuid', 'testname', 'testsubscriptionid1');
            const businessId = await createBusiness('testuid', 'testname', 'testsubscriptionid2');
            await createBusiness('testuid', 'testname', 'testsubscriptionid3');
            skipTokenVerification(t, 'testuid', 'testname', 'testemail');
            const res = await request(app)
                .get('/joincode')
                .set('idToken', 'testtoken')
                .query({ businessId: businessId })
                .expect(200)
                .expect('Content-Type', /json/);
            mockToken(t);
            const joincode = JSON.parse(res.text).joincode;
            await request(app)
                .get('/join')
                .set('idToken', VALID_TOKEN)
                .query({ code: joincode, businessId: businessId })
                .expect(200);
            const members = await asyncAll(
                'SELECT * FROM Members WHERE user_id = ? AND business_id = ?',
                [VALID_AUTH.user_id, businessId],
            );
            assert.strictEqual(members.length, 1);
            assert.strictEqual(members[0].role, 'user');
        });
        it('Should not join when /join is requested with the joincode of another business', async t => {
            const businessId1 = await createBusiness('testuid', 'testname', 'testsubscriptionid1');
            const businessId2 = await createBusiness('testuid', 'testname', 'testsubscriptionid2');
            skipTokenVerification(t, 'testuid', 'testname', 'testemail');
            const res = await request(app)
                .get('/joincode')
                .set('idToken', 'testtoken')
                .query({ businessId: businessId1 })
                .expect(200)
                .expect('Content-Type', /json/);
            mockToken(t);
            const joincode = JSON.parse(res.text).joincode;
            await request(app)
                .get('/join')
                .set('idToken', VALID_TOKEN)
                .query({ code: joincode, businessId: businessId2 })
                .expect(403);
            const members = await asyncAll(
                'SELECT * FROM Members WHERE user_id = ? AND business_id = ?',
                [VALID_AUTH.user_id, businessId1],
            );
            assert.strictEqual(members.length, 0);
        });
        it('Should only allow non-owners to leave their business when /leave is requested', async t => {
            const businessId1 = await createBusiness('testuid', 'testname', 'testsubscriptionid1');
            const businessId2 = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid2',
            );
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                VALID_AUTH.user_id,
                businessId1,
                'user',
            ]);
            mockToken(t, 2);
            await request(app)
                .get('/leave')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId1 })
                .expect(200);
            await request(app)
                .get('/leave')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId2 })
                .expect(403);
        });
        it('Should only allow kicking non-owner members when /removeMember is requested', async t => {
            const businessId = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid1',
            );
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId,
                'user',
            ]);
            mockToken(t, 3);
            // owner can't be removed
            await request(app)
                .get('/removeMember')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId, userId: VALID_AUTH.user_id })
                .expect(400);
            // member can be removed
            await request(app)
                .get('/removeMember')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId, userId: 'testuid' })
                .expect(200);
            // non-member can't be removed
            await request(app)
                .get('/removeMember')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId, userId: 'testuid' })
                .expect(400);
        });
        it('Should return the correct attendance data when /attendancedata is requested', async t => {
            const businessId = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid1',
            );
            await asyncRun('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
            ]);
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId,
                'user',
            ]);
            await asyncRun(
                'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)',
                [businessId, 'testevent', 'testdescription', 0, 0],
            );
            await asyncRun(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                ['testuid', businessId, 1, 0, 'teststatus'],
            );
            await asyncRun(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                [VALID_AUTH.user_id, businessId, 1, 0, 'teststatus'],
            );
            mockToken(t, 1);
            await request(app)
                .get('/attendancedata')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId })
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
                    },
                    {
                        name: 'testname',
                        event_id: 1,
                        business_id: businessId,
                        user_id: 'testuid',
                        timestamp: '0',
                        status: 'teststatus',
                        role: 'user',
                    },
                    {
                        name: VALID_AUTH.name,
                        id: VALID_AUTH.user_id,
                        role: 'owner',
                    },
                    { name: 'testname', id: 'testuid', role: 'user' },
                ]);
        });
        it('Should return metadata when /userdata requested with multiple businesses', async t => {
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
            await asyncRun('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
            ]);
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId1,
                'user',
            ]);
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId2,
                'user',
            ]);
            await asyncRun(
                'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)',
                [businessId1, 'testevent', 'testdescription', 0, 0],
            );
            await asyncRun(
                'INSERT INTO Events (business_id, name, description, starttimestamp, endtimestamp) VALUES (?, ?, ?, ?, ?)',
                [businessId2, 'testevent', 'testdescription', 0, 0],
            );
            await asyncRun(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                [VALID_AUTH.user_id, businessId1, 1, 0, 'teststatus'],
            );
            await asyncRun(
                'INSERT INTO Records (user_id, business_id, event_id, timestamp, status) VALUES (?, ?, ?, ?, ?)',
                ['testuid', businessId2, 2, 0, 'teststatus'],
            );
            mockToken(t, 1);
            await request(app)
                .get('/userdata')
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
        it('Should assign the correct role when /assignRole is requested unless the role is owner', async t => {
            const businessId = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid1',
            );
            await asyncRun('INSERT INTO Users (id, name, email) VALUES (?, ?, ?)', [
                'testuid',
                'testname',
                'testemail',
            ]);
            await asyncRun('INSERT INTO Members (user_id, business_id, role) VALUES (?, ?, ?)', [
                'testuid',
                businessId,
                'user',
            ]);
            mockToken(t, 3);
            // don't allow setting owner role
            await request(app)
                .get('/assignRole')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId, userId: 'testuid', role: 'owner' })
                .expect(403);
            // don't allow changing the owner's role
            await request(app)
                .get('/assignRole')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId, userId: VALID_AUTH.user_id, role: 'admin' })
                .expect(403);
            // allow setting other roles
            await request(app)
                .get('/assignRole')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId, userId: 'testuid', role: 'admin' })
                .expect(200);
            const members = await asyncAll(
                'SELECT * FROM Members WHERE user_id = ? AND business_id = ?',
                ['testuid', businessId],
            );
            assert.strictEqual(members.length, 1);
            assert.strictEqual(members[0].role, 'admin');
        });
        it('Should return the name set with /changeName when /getName is requested', async t => {
            const businessId = await createBusiness(
                VALID_AUTH.user_id,
                VALID_AUTH.name,
                'testsubscriptionid1',
            );
            mockToken(t, 2);
            await request(app)
                .get('/changeName')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId, name: 'testname' })
                .expect(200);
            await request(app)
                .get('/getName')
                .set('idToken', VALID_TOKEN)
                .query({ businessId: businessId })
                .expect(200)
                .expect('Content-Type', /json/)
                .expect({ name: 'testname' });
        });
    });
});
