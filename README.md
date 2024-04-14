# Attendance Scanner

[![LOC](./.badges/lines-of-code.svg)](https://github.com/clr-li/AttendanceScanner)
[![FileCount](./.badges/file-count.svg)](https://github.com/clr-li/AttendanceScanner)
[![WebsiteStatus](https://img.shields.io/website?url=https%3A%2F%2Fattendancescannerqr.web.app%2F)](https://attendancescannerqr.web.app)
![Tests](https://github.com/clr-li/AttendanceScanner/actions/workflows/tests.yml/badge.svg)
[![Coverage](./.badges/coverage.svg)](https://github.com/clr-li/AttendanceScanner)

This project uses QR codes to take attendance and a SQLite database to store data of groups, attendees, and events. It uses oauth2 through Firebase Auth to authenticate users has custom authorization logic. Braintree is used as the payment gateway for the electronic payment/subscription system. Automated tests are written using Node Test Runner and Selenium and run through Github Actions. Deployment is done via a docker container with the Node.js express app on Fly.io and static files via Firebase Hosting.
URL: https://attendancescannerqr.web.app

# Development

## Recommended VS Code plugins

-   [es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html) - syntax highlighting for template literals, useful for HTML, CSS, SQL, and more!
-   [Esbenp Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - automatically format code on save and via VS Code commands!

## Branches

-   `main` - main development branch - latest stable version of the code, hosted on Github

## Local Development

### Setup

1. `git clone https://github.com/clr-li/AttendanceScanner.git`
2. Add the `.data` directory and `.env` file
    - These are `.gitignore`'d to avoid leaking API keys, secrets and user data
3. `npm ci` to install the necessary dependencies from the package lock
4. `npm run dev` (this will run the local server using the local .env file; `npm start` is only for production)
5. Use a browser to go to the localhost port printed (this should automatically open on most systems)

### Common Commands

-   To run the server locally: `npm run dev`
-   To run formatting and build fonts and other resources: `npm run build`
-   To run tests and linting: `npm test`
-   To deploy both server and static files: `npm run deploy`
    -   To only deploy static files: `npm run deploy:fire`
-   To run the server locally with production settings: `npm run docker:build && npm run docker:run`

### Update Database

-   To update the database schema, change the `schema.sql` file accordingly (note this file should only contain DDL statements). If you are running the `npm run dev` server, a new migration file will automatically be created in the `migration` folder and applied locally. Otherwise, you can run `sam make` to create it and `sam migrate` to apply it locally. Run `sam status` to verify your changes and optionally inspect the autocreated migration file. Once you are satisfied everything is in order, `npm run deploy` changes like normal and the production server will automatically apply the new migration file.
-   To purge the Braintree payment vault test data, login to the Braintree sandbox, click the gear icon and select "Purge Test Data"

## Manage Deployment

-   Configure server: [fly.io](https://fly.io/apps/attendqr)
    -   [Memory usage and requests dashboard](https://fly-metrics.net/d/fly-app/fly-app?orgId=726754)
    -   [View logs](https://fly-metrics.net/d/fly-logs/fly-logs?orgId=726754&var-app=attendqr)
    -   [Invite team members](https://fly.io/dashboard/alexander-metzger/team)
-   Configure firebase: [firebase console](https://console.firebase.google.com/u/0/project/attendancescannerqr/overview)
    -   [Configure auth](https://console.firebase.google.com/u/0/project/attendancescannerqr/authentication/users)
    -   [Configure hosting](https://console.firebase.google.com/u/0/project/attendancescannerqr/hosting/sites/attendancescannerqr)
-   Configure Braintree: [sandbox](https://sandbox.braintreegateway.com/login)
    -   [Docs for testing](https://developers.braintreepayments.com/start/hello-server/node)
    -   [Docs for production](https://developer.paypal.com/braintree/docs/start/go-live/node)
-   Configure Cloudflare: [domains](https://dash.cloudflare.com/ff1b48a9d7c023abb7950e2e6f3a7f7e/domains/attendqr.com)
    -   [attendqr.com](https://dash.cloudflare.com/ff1b48a9d7c023abb7950e2e6f3a7f7e/attendqr.com)

## Automated Testing

1. Before running tests, run `npm install` (freshly installs dependencies from package.json) or `npm ci` (install specific dependency versions from package-lock) to make sure dependencies are installed.

2. Then run `npm test` and check the output in the console for the status of the tests. Console logs during test execution will pipe to `test.log` instead of standard out so you wont see logs in the terminal.

3. Linting and automatic formatting can be run with `npm run lint` and `npm run format`.

4. Tests live in the `/test` directory and use the builtin [Node Test Runner](https://nodejs.org/docs/latest-v18.x/api/test.html) framework. New tests are always welcome!

### Github Actions

The tests will automatically run in an environment closely mirroring the production environment when commits are pushed or branches merged. See `.github/workflows/tests.yml` for details. The status of these tests can be seen in the badge at the top of this readme. The coverage badge shows the percentage of lines, branches, and functions covered by the automated tests and will update everytime tests are run locally.

### Server Side Tests

Server-side tests live in `server.test.js` and are unit tests of exported functions and endpoints. The endpoints are tested using [Supertest](https://www.npmjs.com/package/supertest) to spin up temporary instances of the HTTPServer to make fast test requests to. The tests use [in-memory SQLite databases](https://www.sqlite.org/inmemorydb.html) so they can easily be cleared between tests (SQLite automatically clears the previous in-memory database when a new one is instantiated). Firebase token verification is mocked since the full OAuth flow can only meaningfully be tested using a client which falls into the next category of tests.

### Cross Browser Client Side Tests

We use [Selenium](https://www.npmjs.com/package/selenium-webdriver) for cross browser tests of the web interface and client side components. By default, tests are run with `chrome` but running tests via `SELENIUM_BROWSER=[insert browser name] npm test` where `[insert browser name]` is replaced with `safari`, `edge`, `firefox`, `opera`, or `ie` (Internet Explorer requires Windows) will test with those respective browsers (make sure to have the browser installed and on path before running tests). The github action tests have been configured to run with `chrome`.

#### Setup Safari Tests

0. Use a mac (with Safari on it) and doublecheck `npm ci` has been run
1. Run `sudo safaridriver --enable` in your terminal and enter your computer password as prompted
2. Enable the 'Allow Remote Automation' option in Safari's Develop menu

#### Setup Tests of the OAuth Flow

By default tests mock the Firebase Authentication layer (to run faster and not require storing Google account credentials). To test with a real Google account, run tests with an account email (`TEST_EMAIL=xxxx@xxxx.xxx`) and password (`TEST_PASSWORD=xxxx`) in the `.env` file. The tests will attempt to automatically login for these test, but they may still require manual input during the login phase if your account has MFA enabled or other security settings that interfere. Currently only supported for Google Chrome.
