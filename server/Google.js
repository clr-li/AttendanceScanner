const express = require('express'),
    router = express.Router();
const fetch = require('node-fetch');
const { handleAuth } = require('./Auth');

// ===================== Gmail API =====================
/**
 * Sends an email using the Gmail API.
 * @param {Object} message the email message to send
 * @param {string} accessToken the access token to use to send the email
 * @requiredPrivileges the user to be logged in
 * @returns the response from the Gmail API
 */
router.post('/sendEmail', async (req, res) => {
    await handleAuth(req, res);

    const message = req.body.message;
    const accessToken = req.body.accessToken;
    const response = await callGmailAPI(message, accessToken);
    res.status(response.status).send(await response.json());
});

function callGmailAPI(message, accessToken) {
    const emailLines = [];
    emailLines.push(`From: ${message.from_email}`);
    emailLines.push(`To: ${message.to_email}`);
    emailLines.push(`Subject: ${message.subject}`);
    emailLines.push('');
    emailLines.push(message.text);

    const email = emailLines.join('\r\n');
    const encodedEmail = encode(email);

    return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            raw: encodedEmail,
        }),
    });
}

function encode(str, urlSafe = false) {
    const encoded = Buffer.from(str).toString('base64');
    return urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_') : encoded;
}

// ===================== Router =====================
exports.googleRouter = router;
