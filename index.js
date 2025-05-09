const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Load environment variables

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

const app = express();
app.use(express.json());

// Create Webflow item
const createWebflowItem = async (airtableRecordFields) => {
    let webflowName = 'untitled';

    if (airtableRecordFields['Council Name']) {
        if (Array.isArray(airtableRecordFields['Council Name'])) {
            webflowName = airtableRecordFields['Council Name'][0] || 'untitled';
        } else {
            webflowName = airtableRecordFields['Council Name'];
        }
    }

    const webflowFields = {
        name: webflowName,
        slug: webflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled',
    };

    const webflowPayload = { fields: webflowFields };

    console.log('📤 Sending to Webflow:', JSON.stringify(webflowPayload, null, 2));

    try {
        const response = await axios.post(
            `https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items`,
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                    'accept-version': '1.0.0',
                },
            }
        );
        console.log('✅ Webflow item created:', response.data);
        return response.data._id;
    } catch (error) {
        console.error('❌ Error creating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to create Webflow item: ${error.message}`);
    }
};

// Update Airtable record with Webflow Item ID
const updateAirtableRecord = async (recordId, webflowItemId) => {
    const payload = {
        fields: {
            'Webflow Item ID': webflowItemId,
        },
    };

    try {
        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`✅ Airtable record ${recordId} updated with Webflow Item ID ${webflowItemId}`);
    } catch (error) {
        console.error('❌ Error updating Airtable record:', error.response?.data || error.message);
        throw new Error(`Failed to update Airtable record: ${error.message}`);
    }
};

// Handle webhook from Airtable
app.post('/airtable-webhook', async (req, res) => {
    console.log('📥 Received webhook payload:', JSON.stringify(req.body, null, 2));

    const { councilName, recordId } = req.body;

    if (!councilName || !recordId) {
        console.log('⚠️ Missing councilName or recordId in payload.');
        return res.status(400).send('Missing councilName or recordId.');
    }

    try {
        const airtableFields = { 'Council Name': councilName };

        // Create in Webflow
        const webflowItemId = await createWebflowItem(airtableFields);

        // Update Airtable
        await updateAirtableRecord(recordId, webflowItemId);

        res.status(200).json({ message: '✅ Success' });
    } catch (err) {
        console.error('❌ Error handling Airtable webhook:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
