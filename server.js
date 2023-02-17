const https = require('https');

// express.js framework
const express = require("express");
const app = express();

// parsing post bodies
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// cors - make server endpoints available on firebase domain
const cors = require('cors')
let corsOptions = {
  origin: 'https://attendancescannerqr.web.app',
}
app.use(cors(corsOptions))

// ============================ PUBLIC (STATIC) FILES ============================
// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// ============================ AUTHENTICATION ============================
// How to add idToken to glitch preview:
// 1. From firebase url:
//   - login
//   - copy idtoken cookie
// 2. In glitch preview devtools console
//   - run `import('./util.js').then(m => util = m);`
//   - run `util.setCookie('idtoken', '[PASTE COOKIE STRING HERE]', 24)`
//
// cliuw@uw.edu token: eyJhbGciOiJSUzI1NiIsImtpZCI6ImQwNWI0MDljNmYyMmM0MDNlMWY5MWY5ODY3YWM0OTJhOTA2MTk1NTgiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQ2xhaXJlIENsaXV3QFVXLkVkdSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BRWRGVHA0d1R5UVJFNU13dVhNa1B1MGpkZV9ma1FHRllxTDlyTTE3cHBLZT1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9hdHRlbmRhbmNlc2Nhbm5lcnFyIiwiYXVkIjoiYXR0ZW5kYW5jZXNjYW5uZXJxciIsImF1dGhfdGltZSI6MTY3NTIwNjM5MCwidXNlcl9pZCI6IkEySVN4WktRVU9nSlRhQkpmM2pHMEVjNUNMdzIiLCJzdWIiOiJBMklTeFpLUVVPZ0pUYUJKZjNqRzBFYzVDTHcyIiwiaWF0IjoxNjc1MjA2MzkwLCJleHAiOjE2NzUyMDk5OTAsImVtYWlsIjoiY2xpdXdAdXcuZWR1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDIzNDg1MDIyODIwMzg4OTQ5MzUiXSwiZW1haWwiOlsiY2xpdXdAdXcuZWR1Il19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.RA4rqYq1fGfU58OthW1zdb76zfSbvmYTf2al-gwQei8d0sZ5YgUKvXt-wHRAsYCzah1mUebmvfG8U2n_wFcIIZG5W48EN2G4idvHtKJNV149SA5H-QZ9MxaYK3FdY68wtKRcl9IExX0tNth7-4gKHfMWF15Yz8ja2MxH8Xp_RgXmEd1gxKD-86-hT0VADM7ccMbIrURK2d9GCpUoCjCgdzLJVuJ62CotCUjF5QoMwL2IeK-pIBwp2eyh-Hsy1BB3bwcgtxf926bD3MLuWjSNJNjntvcqTbtpD-38xt2TzyWIA6t9xkGHTRCMhFlm8dmv_CPXzN12nLqg6xjp-CYCnQ
// alexander.le@outlook.dk: eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk1MWMwOGM1MTZhZTM1MmI4OWU0ZDJlMGUxNDA5NmY3MzQ5NDJhODciLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQWxleGFuZGVyIE1ldHpnZXIiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUxtNXd1MEs1SW5aZElPYmhWTW95UDVtaWFzQkxMeFlPRV9KalI4aXg4Y1o9czk2LWMiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYXR0ZW5kYW5jZXNjYW5uZXJxciIsImF1ZCI6ImF0dGVuZGFuY2VzY2FubmVycXIiLCJhdXRoX3RpbWUiOjE2Njk5NjEzMTUsInVzZXJfaWQiOiJmRlN1dkVuSFpiaGtwYUU0Y1F2eWJDUElPUlYyIiwic3ViIjoiZkZTdXZFbkhaYmhrcGFFNGNRdnliQ1BJT1JWMiIsImlhdCI6MTY2OTk2MTMxNSwiZXhwIjoxNjY5OTY0OTE1LCJlbWFpbCI6ImFsZXhhbmRlci5sZUBvdXRsb29rLmRrIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDc5NzQzODUyNDExMjU1ODQwODUiXSwiZW1haWwiOlsiYWxleGFuZGVyLmxlQG91dGxvb2suZGsiXX0sInNpZ25faW5fcHJvdmlkZXIiOiJnb29nbGUuY29tIn19.r50SDswArj53NJbwO8vWAYjWVq7uvo_56RBRyt2ZLKyLrHAOWDsj8Muxg1N2OuAOX5ZOZscXttqPb9wwvnh79tYlciZru5GuBcDXYHuMM18HsOBTkqsdWQlnsneDLawMZYP4u5U9dx2NZSCQIpDmfv8CckPfav7izCcdUxAZaKs6ngzBjpz9O7dpKW8pFscaWtncqyH9PXGtChlDd4kOdYO-YJWkA3-ZZ7_S_AviCHbAG-veyTzoacyCPdDJrNzNq9tiWGvILFtmClpMLqf9v9GdvlRt0dPTHx7p-Q6uTlhXvFGIG8ggqbIxbVxVr_sonbV4Nl47lsoDp0icLLjEuQ
const {authRouter, handleAuth} = require('./Auth');
app.use('/', authRouter);

// ============================ PAYMENT ============================
const {paymentRouter, verifySubscription, PLAN_IDS} = require('./Payment');
app.use('/', paymentRouter);

// ============================ ATTENDANCE ============================


// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});