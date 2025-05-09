const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Load environment variables from .env

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

const app = express();
app.use(express.json()); // Enable JSON parsing

// --- Create Webflow Item ---
const createWebflowItem = async (airtableRecordFields) => {
    let webflowName = 'Untitled';

    if (airtableRecordFields && airtableRecordFields['Council Name']) {
        const councilName = airtableRecordFields['Council Name'];
        if (Array.isArray(councilName)) {
            webflowName = councilName[0] || 'Untitled';
        } else {
            webflowName = councilName;
        }
    }

    const webflowFields = {
        name: webflowName,
        slug: webflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled',
        description: airtableRecordFields?.Description || 'No description',
    };

    const webflowPayload = {
        fields: webflowFields,
    };

    try {
        const response = await axios.post(
            `https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items`,
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

// --- Update Airtable Record ---
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
        console.error('Error updating Airtable record:', error.response?.data || error.message);
        throw new Error(`Failed to update Airtable record: ${error.message}`);
    }
};

// --- Handle Airtable Webhook ---
const handleAirtableWebhook = async (req, res) => {
    try {
        console.log('📥 Incoming webhook payload:', JSON.stringify(req.body, null, 2));

        const { records } = req.body;
        if (!records || records.length === 0) {
            console.log('⚠️ No records found in webhook.');
            return res.status(200).send('OK');
        }

        const newRecord = records[0];
        const airtableRecordId = newRecord.id;
        const airtableRecordFields = newRecord.fields;

        if (!airtableRecordFields) {
            throw new Error('⚠️ No "fields" object found in record.');
        }

        console.log('📄 Record Fields:', airtableRecordFields);

        const webflowItemId = await createWebflowItem(airtableRecordFields);
        await updateAirtableRecord(airtableRecordId, webflowItemId);

        res.status(200).json({
            message: '✅ Successfully processed webhook and updated Webflow and Airtable.',
        });
    } catch (error) {
        console.error('❌ Error handling webhook:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- Setup Route ---
app.post('/airtable-webhook', handleAirtableWebhook);

// --- Start Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
});
