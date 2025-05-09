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
        },
    };

    console.log('Sending to Webflow:', JSON.stringify(webflowPayload, null, 2));

    try {
        const response = await axios.post(
            `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live`,
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                    'accept-version': '2.0.0', // Webflow API v2
                },
            }
        );
        console.log('Webflow response:', response.data);
        return response.data.id; // Return the Webflow Item ID
    } catch (error) {
        console.error('❌ Error creating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to create Webflow item: ${error.message}`);
    }
};

// Function to update Webflow item (if it already exists)
const updateWebflowItem = async (webflowId, airtableRecordFields) => {
    const webflowPayload = {
        fieldData: {
            name: airtableRecordFields['Council Name'],
        },
    };

    console.log('Sending update to Webflow:', JSON.stringify(webflowPayload, null, 2));

    try {
        const response = await axios.patch(
            `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${webflowId}`,
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                    'accept-version': '2.0.0', // Webflow API v2
                },
            }
        );
        console.log('Webflow item updated:', response.data);
    } catch (error) {
        console.error('❌ Error updating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to update Webflow item: ${error.message}`);
    }
};

// Function to update Airtable record with Webflow Item ID
const updateAirtableRecord = async (airtableRecordId, webflowItemId) => {
    const payload = {
        fields: {
            'Webflow ID': webflowItemId, // Store the Webflow Item ID
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

        const { councilName, recordId, webflowId } = req.body;
        if (!councilName || !recordId) {
            console.log('⚠️ Received Airtable webhook with missing fields.');
            return res.status(400).send('Missing councilName or recordId.');
        }

        const airtableRecordFields = {
            'Council Name': councilName,
        };

        // If the Airtable record has a Webflow ID, update the Webflow item
        if (webflowId) {
            console.log(`Webflow ID found: ${webflowId}, updating item.`);
            await updateWebflowItem(webflowId, airtableRecordFields);

            // After updating Webflow item, update the Airtable record
            await updateAirtableRecord(recordId, webflowId);
        } else {
            // Otherwise, create a new Webflow item and store the Webflow Item ID in Airtable
            console.log('No Webflow ID found, creating new item.');
            const webflowItemId = await createWebflowItem(airtableRecordFields);

            // Update the Airtable record with the new Webflow Item ID
            await updateAirtableRecord(recordId, webflowItemId); // Store the new Webflow ID
        }

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
