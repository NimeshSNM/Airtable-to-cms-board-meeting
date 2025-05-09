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

// Function to create a Webflow item (Webflow API v2)
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

    console.log('📤 Sending to Webflow (Create):', JSON.stringify(webflowPayload, null, 2));

    try {
        const response = await axios.post(
            `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live`,
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                    'accept-version': '2.0.0',
                },
            }
        );
        console.log('✅ Webflow created item:', response.data);
        return response.data.id;
    } catch (error) {
        console.error('❌ Error creating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to create Webflow item: ${error.message}`);
    }
};

// Function to update a Webflow item
const updateWebflowItem = async (webflowItemId, airtableRecordFields) => {
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

    console.log('📤 Sending to Webflow (Update):', JSON.stringify(webflowPayload, null, 2));

    try {
        await axios.patch(
            `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${webflowItemId}/live`,
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                    'accept-version': '2.0.0',
                },
            }
        );
        console.log(`✅ Webflow item ${webflowItemId} updated`);
    } catch (error) {
        console.error('❌ Error updating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to update Webflow item: ${error.message}`);
    }
};

// Function to update Airtable with the Webflow Item ID
const updateAirtableRecord = async (airtableRecordId, webflowItemId) => {
    const payload = {
        fields: {
            'Webflow ID': webflowItemId,
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
        console.log(`✅ Airtable record ${airtableRecordId} updated with Webflow ID ${webflowItemId}`);
    } catch (error) {
        console.error('❌ Error updating Airtable record:', error.response?.data || error.message);
        throw new Error(`Failed to update Airtable record: ${error.message}`);
    }
};

// Webhook handler for Airtable
const handleAirtableWebhook = async (req, res) => {
    try {
        console.log('📥 Received webhook payload:', req.body);
        const { recordId } = req.body;

        if (!recordId) {
            return res.status(400).send('Missing recordId.');
        }

        // ✅ Fetch full Airtable record
        const airtableResponse = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`,
            {
                headers: {
                    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                },
            }
        );

        const recordFields = airtableResponse.data.fields;
        const councilName = recordFields['Council Name'];
        const existingWebflowId = recordFields['Webflow ID'];

        const airtableRecordFields = {
            'Council Name': councilName,
        };

        let webflowItemId;

        if (existingWebflowId) {
            console.log(`🛠 Updating existing Webflow item: ${existingWebflowId}`);
            await updateWebflowItem(existingWebflowId, airtableRecordFields);
            webflowItemId = existingWebflowId;
        } else {
            console.log('📦 Creating new Webflow item...');
            webflowItemId = await createWebflowItem(airtableRecordFields);
        }

        // ✅ Update Airtable with Webflow ID
        await updateAirtableRecord(recordId, webflowItemId);

        res.status(200).json({ message: '✅ Success' });
    } catch (error) {
        console.error('❌ Error handling Airtable webhook:', error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
};

// ✅ Airtable will POST to this route
app.post('/airtable-webhook', handleAirtableWebhook);

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
});
