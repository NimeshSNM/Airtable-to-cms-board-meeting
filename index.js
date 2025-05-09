const express = require('express');
const axios = require('axios');
require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

const app = express();
app.use(express.json());

const createWebflowItem = async (airtableRecordFields) => {
    let webflowName = 'untitled';

    const councilName = airtableRecordFields?.['Council Name'];
    if (Array.isArray(councilName)) {
        webflowName = councilName[0] || 'untitled';
    } else if (typeof councilName === 'string') {
        webflowName = councilName || 'untitled';
    }

    const webflowFields = {
        name: webflowName,
        slug: webflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled',
        description: airtableRecordFields?.['Description'] || 'No description',
        // Add additional fields here if required by your Webflow collection
    };

    const webflowPayload = { fields: webflowFields };
    console.log("📤 Sending to Webflow:", JSON.stringify(webflowPayload, null, 2));

    try {
        const response = await axios.post(
            `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`,
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                    'accept-version': '1.0.0'  // Include if using Webflow v2+ API
                },
            }
        );
        return response.data._id;
    } catch (error) {
        console.error('❌ Error creating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to create Webflow item: ${error.response?.data?.msg || error.message}`);
    }
};

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

const handleAirtableWebhook = async (req, res) => {
    try {
        const { records } = req.body;

        if (!records || records.length === 0) {
            console.log('ℹ️ Received Airtable webhook with no records.');
            return res.status(200).send('OK');
        }

        const newRecord = records[0];
        const airtableRecordId = newRecord.id;
        const airtableRecordFields = newRecord.fields;

        console.log('📩 Received Airtable record:', { airtableRecordId, airtableRecordFields });

        const webflowItemId = await createWebflowItem(airtableRecordFields);
        await updateAirtableRecord(airtableRecordId, webflowItemId);

        res.status(200).json({ message: 'Successfully processed Airtable webhook.' });
    } catch (error) {
        console.error('❌ Error handling Airtable webhook:', error);
        res.status(500).json({ error: error.message });
    }
};

app.post('/airtable-webhook', handleAirtableWebhook);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
});
