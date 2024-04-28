const express = require('express'),
    router = express.Router();
const fetch = require('node-fetch');
const { handleAuth } = require('./Auth');

// ===================== Email API =====================
/**
 * Sends an email using the MailerSend API (https://app.mailersend.com/).
 * @param {Object} message the email message to send
 * @requiredPrivileges the user to be logged in
 * @returns the response from the Gmail API
 */
router.post('/email', async (req, res) => {
    await handleAuth(req, res);

    const message = req.body.message;
    const response = await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + process.env.MAILERSEND_API_KEY,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
            from: {
                email: process.env.MAILERSEND_EMAIL,
            },
            to: [
                {
                    email: message.to_email,
                },
            ],
            subject: message.subject,
            text: message.text,
            html: message.text.replace(/\n/g, '<br>'),
        }),
    });
    res.status(response.status).send(await response.text());
});

// ===================== Router =====================
exports.thirdPartyRouter = router;
