# Attendance Scanner

<!-- [![LineCount](https://tokei.ekzhang.com/b1/github/clr-li/AttendanceScanner)](https://github.com/clr-li/AttendanceScanner)
[![FileCount](https://tokei.ekzhang.com/b1/github/clr-li/AttendanceScanner?category=files)](https://github.com/clr-li/AttendanceScanner) -->

[![LOC](./.badges/lines-of-code.svg)](https://github.com/clr-li/AttendanceScanner)
[![FileCount](./.badges/file-count.svg)](https://github.com/clr-li/AttendanceScanner)
[![WebsiteStatus](https://img.shields.io/website?url=https%3A%2F%2Fattendancescannerqr.web.app%2F)](https://github.com/clr-li/AttendanceScanner)
![Tests](https://github.com/clr-li/AttendanceScanner/actions/workflows/tests.yml/badge.svg)
[![Coverage](./.badges/coverage.svg)](https://raw.githubusercontent.com/clr-li/AttendanceScanner/main/public/assets/coverage.svg)

This project (in progress) uses QR codes to take attendance and a SQLite database to store data of businesses, attendees, and events. It uses oauth2 through Firebase Auth to authenticate users using Google as the identity provider and has custom authorization logic. Braintree is used as the payment gateway for the electronic payment/subscription system. Automated tests are written using Node Test Runner and Selenium and CI/CD run through Github Actions.
URL: https://attendancescannerqr.web.app

# Development

## Recommended VS Code plugins

-   [es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html) - syntax highlighting for template literals, useful for HTML, CSS, SQL, and more!
-   [Esbenp Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - automatically format code on save and via VS Code commands!

## Branches

-   `master` - production branch - clone of Glitch branch (Glitch is currently used for hosting the server)
-   `main` - main development branch - latest stable version of the code, hosted on Github

## Local Development

### Setup

1. `git clone https://github.com/clr-li/AttendanceScanner.git`
2. `git remote add glitch [INSERT GLITCH API URL HERE AND REMOVE THESE BRACKETS]`
3. Add the `.data` directory and `.env` file (can be found on Glitch)
    - These are already `.gitignore`'d to avoid leaking API keys and secrets and user data
4. `npm ci` to install the necessary dependencies from the package lock
5. `npm run dev` (this will run the local server using the local .env file; `npm start` is only for Glitch)
    - After running `npm run dev`, use a browser to go to the localhost port printed (this should automatically open on most systems)

### Workflow

0. Start with `git pull`, and make sure you are on the right branch, e.g. `git checkout main`

&nbsp;&nbsp;For small changes:

1. Make changes to the local `main` branch
2. `git add` and `git commit` any changes locally
3. `git push origin` to push to the Github `main` branch

&nbsp;&nbsp;For larger changes:

1. `git checkout -b [NAME OF NEW DEVELOPMENT BRANCH]` to create a separate branch
2. Make changes and `git add` and `git commit` locally
3. `git push origin` and create a pull request for others to review and merge into `main` after review

&nbsp;&nbsp;Then to deploy Github `main` to Glitch and Firebase:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;4. `npm run deploy`<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Or to only deploy to Glitch: `npm run glitch`<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Or to only deploy static files to Firebase: `npm run fire`

### Update database

-   To reset the database and its schema, change the `databaseSchema.sql` file accordingly, `npm run deploy` changes like normal, then delete the `.data/ATT.db` file on Glitch and restart the server. The database will automatically get reinitialized.
-   To make updates while keeping the existing data, add an update script to the `migrations` folder with the version number and date in its name. Then run it on Glitch.
-   To purge the Braintree payment vault test data, login to the Braintree sandbox, click the gear icon and select "Purge Test Data"

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

## Glitch Development

Preferably don't edit directly on Glitch except to change the production `.data` or `.env`. If necessary,

1. Make changes on Glitch
2. Locally `git checkout master` and `git pull glitch` to obtain changes locally
3. `git push origin` changes to the Github `master` branch
4. On Github, create a pull request and merge changes with the Github `main`

### To change the production (Glitch server) `.data` or `.env`

If the changes only apply to Glitch and not local development, just change directly. Otherwise, make sure leave a note somewhere lol
