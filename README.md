# Attendance Scanner 
This project (in progress) uses QR codes to take attendance and a SQLite database to store data of businesses, attendees, and events. It uses oauth2 through Firebase Auth to authenticate users using Google as the identity provider and has custom authorization logic. Braintree is used as the payment gateway for the electronic payment/subscription system. 
URL: https://attendancescannerqr.web.app

# Source Control and Workflow
## Branches
- `master` - production branch - clone of Glitch branch (Glitch is currently used for hosting the server)
- `main` - main development branch - latest stable version of the code, hosted on Git

## Local Development
### Setup
1. `git clone https://github.com/clr-li/AttendanceScanner.git`
2. `git remote add glitch [INSERT GLITCH API URL HERE AND REMOVE THESE BRACKETS]`
3. Add the `.data` directory and `.env` file (can be found on Glitch)
    - These are already `.gitignore`'d to avoid leaking API keys and secrets and user data
4. `npm install --no-audit` the necessary dependencies
5. `npm run dev` (this will run the local server using the local .env file; `npm start` is only for Glitch)
    - After running `npm run dev`, use a browser to go to the localhost port printed

### Workflow
0. Start with `git pull`, and make sure you are on the right branch, e.g. `git checkout main`

&nbsp;&nbsp;For small changes:
1. Make changes to the local `main` branch
2. `git add` and `git commit` any changes locally
3. `git push origin` to push to the Github `main` branch

&nbsp;&nbsp;For larger changes:
1. `git checkout -b [NAME OF NEW DEVELOPMENT BRANCH]` to create a separate branch
2. Make changes and `git add` and `git commit` locally
3. Either `git push origin main` if no conflicts, or `git push origin` and create a pull request

&nbsp;&nbsp;Then to deploy Github `main` to Glitch and Firebase:<br>
<span style="white-space: pre; font-size: 0.8rem">&#9;</span>4. `npm run deploy`<br>
<span style="white-space: pre; font-size: 0.8rem">&#9;&#9;</span>- Or to only deploy to Glitch: `npm run glitch`<br>
<span style="white-space: pre; font-size: 0.8rem">&#9;&#9;</span>- Or to only deploy static files to Firebase: `npm run fire`

### Update database
 - To reset the database and its schema, change the `databaseSchema.sql` file accordingly, `npm run deploy` changes like normal, then delete the `.data/ATT.db` file on Glitch and restart the server. The database will automatically get reinitialized.
 - To make updates while keeping the existing data, add an update script to the `migrations` folder with the version number and date in its name. Then run it on Glitch.
 - To purge the Braintree payment vault test data, login to the Braintree sandbox, click the gear icon and select "Purge Test Data"

## Glitch Development
Preferably don't edit directly on Glitch except to change the production `.data` or `.env`. If necessary,
1. Make changes on Glitch
2. Locally `git checkout master` and `git pull glitch` to obtain changes locally
3. `git push origin` changes to the Github `master` branch
4. On Github, create a pull request and merge changes with the Github `main`

### To change the production (Glitch server) `.data` or `.env`
If the changes only apply to Glitch and not local development, just change directly. Otherwise, make sure leave a note somewhere lol