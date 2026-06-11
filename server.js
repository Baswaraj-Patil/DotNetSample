const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5183;
// Read your Salesforce Consumer Secret from Render's environment variables
const CONSUMER_SECRET = process.env.CANVAS_CONSUMER_SECRET || 'your_fallback_local_secret';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to verify and decode Salesforce Canvas Signed Request
function decodeSignedRequest(signedRequest, secret) {
    if (!signedRequest || !secret) return null;
    const parts = signedRequest.split('.');
    if (parts.length !== 2) return null;

    const signature = parts[0];
    const payload = parts[1];

    // Validate Signature
    const hm = crypto.createHmac('sha256', secret);
    hm.update(payload);
    const check = hm.digest('base64');

    if (signature !== check) {
        console.error('Canvas Signature Validation Failed!');
        return null;
    }

    // Decode Payload Context
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
}

// 1. Endpoint that catches the initial Salesforce Canvas POST launch request
app.post('/canvas', (req, res) => {
    const signedRequestStr = req.body.signed_request;
    const canvasContext = decodeSignedRequest(signedRequestStr, CONSUMER_SECRET);

    if (!canvasContext) {
        return res.status(401).send('Invalid or unsigned Canvas request token context.');
    }

    // Extract the ephemeral authentication variables provided by Salesforce
    const oauthToken = canvasContext.client.oauthToken;
    const instanceUrl = canvasContext.client.instanceUrl;

    // Direct user profile to the input layout page with access variables attached to the query string
    res.redirect(`/index.html?token=${encodeURIComponent(oauthToken)}&instance=${encodeURIComponent(instanceUrl)}`);
});

// 2. Proxy endpoint called by our frontend button to run the secure Salesforce REST API upsert
app.post('/api/upsert-account', async (req, res) => {
    const { accountName, token, instanceUrl } = req.body;

    if (!accountName || !token || !instanceUrl) {
        return res.status(400).json({ error: 'Missing mandatory tracking operational attributes' });
    }

    // We will upsert an Account using the Name as the unique key via the standard REST API
    // Endpoint format: /services/data/v60.0/sobjects/Account/Name/External_Field_Value (using standard PATCH)
    const targetUrl = `${instanceUrl}/services/data/v60.0/sobjects/Account/Name/${encodeURIComponent(accountName)}`;

    try {
        const response = await fetch(targetUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Description: "Upserted cleanly via Node.js WebApp deployed on Render host using Canvas framework context parameters."
            })
        });

        if (response.status === 201 || response.status === 204) {
            return res.json({ success: true, message: `Account "${accountName}" successfully processed in Salesforce!` });
        } else {
            const errData = await response.json();
            return res.status(response.status).json({ success: false, errors: errData });
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Canvas Node App listening directly on port ${PORT}`));
