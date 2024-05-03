const express = require('express'),
    router = express.Router();
const fetch = require('node-fetch');
const { handleAuth } = require('./Auth');

// ===================== Email API =====================
async function email(to_email, subject, text) {
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
                    email: to_email,
                },
            ],
            subject: subject,
            text: text,
            html: text.replace(/\n/g, '<br>'),
        }),
    });
    return { status: response.status, text: await response.text() };
}
/**
 * Sends an email using the MailerSend API (https://app.mailersend.com/).
 * @param {Object} message the email message to send
 * @requiredPrivileges the user to be logged in
 * @returns the response from the Gmail API
 */
router.post('/email', async (req, res) => {
    await handleAuth(req, res);

    const message = req.body.message;
    console.log(message);
    const response = email(message.to_email, message.subject, message.text);
    let resJSON = res.json(response);
    res.status(resJSON.status).send(resJSON.text);
});

// ===================== Router =====================
exports.thirdPartyRouter = router;

// ===================== THIRDPARTY EXPORTS =====================
exports.email = email;
