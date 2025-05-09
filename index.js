const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Load environment variables

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

const app = express();
app.use(express.json()); // Parse JSON requests

// Function to create a Webflow item (using Webflow API v2)
const createWebflowItem = async (airtableRecordFields) => {
    let webflowName = 'untitled';
    if (airtableRecordFields['Council Name']) {
        if (Array.isArray(airtableRecordFields['Council Name'])) {
            webflowName = airtableRecordFields['Council Name'][0] || 'untitled';
        } else {
            webflowName = airtableRecordFields['Council Name'] || 'untitled';
        }
    }

    const webflowSlug = webflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled';

    const webflowPayload = {
        fieldData: {
            name: webflowName,
            slug: webflowSlug,
            description: 'No description available', // Assuming no description in Airtable
        },
    };

    console.log('Sending to Webflow:', JSON.stringify(webflowPayload, null, 2));

    try {
        const response = await axios.post(
            `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`,
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                    'accept-version': '2.0.0', // Webflow API v2
                },
            }
        );
        return response.data._id;
    } catch (error) {
        console.error('❌ Error creating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to create Webflow item: ${error.message}`);
    }
};

// Function to update Airtable with the Webflow Item ID
const updateAirtableRecord = async (airtableRecordId, webflowItemId) => {
    const payload = {
        fields: {
            'Webflow Item ID': webflowItemId,
        },
    };

    try {
        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${airtableRecordId}`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`✅ Airtable record ${airtableRecordId} updated with Webflow Item ID ${webflowItemId}`);
    } catch (error) {
        console.error('❌ Error updating Airtable record:', error.response?.data || error.message);
        throw new Error(`Failed to update Airtable record: ${error.message}`);
    }
};

// Webhook handler for Airtable
const handleAirtableWebhook = async (req, res) => {
    try {
        console.log('📥 Received webhook payload:', req.body);

        const { councilName, recordId } = req.body;
        if (!councilName || !recordId) {
            console.log('⚠️ Received Airtable webhook with missing fields.');
            return res.status(400).send('Missing councilName or recordId.');
        }

        const airtableRecordFields = {
            'Council Name': councilName,
        };

        // Create a new Webflow item using Webflow API v2
        const webflowItemId = await createWebflowItem(airtableRecordFields);

        // Update the Airtable record with Webflow item ID
        await updateAirtableRecord(recordId, webflowItemId);

        res.status(200).json({ message: '✅ Success' });
    } catch (error) {
        console.error('❌ Error handling Airtable webhook:', error);
        res.status(500).json({ error: error.message });
    }
};

// ✅ THIS is the route Airtable will POST to
app.post('/airtable-webhook', handleAirtableWebhook);

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
});
