const express = require('express');
const axios = require('axios');
require('dotenv').config(); // To load environment variables from .env file

// Use environment variables from Render or local environment
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

const app = express();
app.use(express.json()); // Parse incoming JSON payloads

// Webflow item creation function (already provided in your code)
const createWebflowItem = async (airtableRecordFields) => {
    let webflowName = 'Untitled';
    if (airtableRecordFields['Council Name']) {
        if (Array.isArray(airtableRecordFields['Council Name'])) {
            webflowName = airtableRecordFields['Council Name'][0] || 'Untitled';
        } else {
            webflowName = airtableRecordFields['Council Name'] || 'Untitled';
        }
    }

    const webflowFields = {
        name: webflowName,
        slug: webflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled',
        description: airtableRecordFields.Description || 'No description',
    };

    const webflowPayload = {
        fields: webflowFields,
    };

    try {
        const response = await axios.post(
            `https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items`,  // Use v3 API
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data._id;
    } catch (error) {
        console.error('Error creating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to create Webflow item: ${error.message}`);
    }
};

// Airtable record update function (already provided in your code)
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
        console.log(`Airtable record ${airtableRecordId} updated with Webflow Item ID ${webflowItemId}`);
    } catch (error) {
        console.error('Error updating Airtable record:', error.response?.data || error.message);
        throw new Error(`Failed to update Airtable record: ${error.message}`);
    }
};

// Handle the Airtable webhook event
const handleAirtableWebhook = async (req, res) => {
    console.log("Received webhook payload:", req.body); // Log the incoming payload for inspection
    try {
        const { records } = req.body;
        if (!records || records.length === 0) {
            console.log('Received Airtable webhook with no records.');
            return res.status(200).send('OK');
        }

        const newRecord = records[0];
        const airtableRecordId = newRecord.id;
        const airtableRecordFields = newRecord.fields;

        console.log('Received new Airtable record:', { airtableRecordId, airtableRecordFields });

        // Create a new Webflow item
        const webflowItemId = await createWebflowItem(airtableRecordFields);

        // Update Airtable record with Webflow Item ID
        await updateAirtableRecord(airtableRecordId, webflowItemId);

        res.status(200).json({ message: 'Successfully processed Airtable webhook and updated Webflow and Airtable.' });
    } catch (error) {
        console.error('Error handling Airtable webhook:', error);
        res.status(500).json({ error: error.message });
    }
};

// Define route for Airtable webhook (this is where POST requests are handled)
app.post('/airtable-webhook', handleAirtableWebhook);

// Start the Express server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
