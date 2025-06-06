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

const getWebflowItem = async (itemId) => {
    try {
        const response = await axios.get(`https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`, {
            headers: {
                Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                'accept-version': '2.0.0',
            },
        });
        return response.data;
    } catch (error) {
        console.error('❌ Error fetching Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to fetch Webflow item: ${error.message}`);
    }
};

const createWebflowItem = async (airtableRecordFields) => {
    
    let webflowName = 'untitled';
    if (airtableRecordFields['Council Name']) {
        if (Array.isArray(airtableRecordFields['Council Name'])) {
            webflowName = airtableRecordFields['Council Name'][0] || 'untitled';
        } else {
            webflowName = airtableRecordFields['Council Name'] || 'untitled';
        }
    }

    const webflowSlug = `${webflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`;
    const agendaUrl = Array.isArray(airtableRecordFields['Agenda']) && airtableRecordFields['Agenda'].length > 0 ? airtableRecordFields['Agenda'][0].url : '';
    const webflowPayload = {
        fieldData: {
            name: webflowName,
            slug: webflowSlug,
            "board-meeting": airtableRecordFields['Related Board meeting'] || '',
            "status": airtableRecordFields['Status'] || '',
            "year": airtableRecordFields['Year'] || '',
            "agenda": agendaUrl
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
        console.log('✅ Webflow item created:', response.data);
        return response.data.id;
    } catch (error) {
        console.error('❌ Error creating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to create Webflow item: ${error.message}`);
    }
};

const updateWebflowItem = async (webflowItemId, airtableRecordFields) => {
    let webflowName = airtableRecordFields['Council Name'];
    const agendaUrl = Array.isArray(airtableRecordFields['Agenda']) && airtableRecordFields['Agenda'].length > 0 ? airtableRecordFields['Agenda'][0].url : '';
    if (Array.isArray(webflowName)) {
        webflowName = webflowName[0] || 'untitled';
    }

    const existingItem = await getWebflowItem(webflowItemId);
    const currentSlug = existingItem?.fieldData?.slug;

    const webflowPayload = {
        fieldData: {
            name: webflowName,
            slug: currentSlug,
            "board-meeting": airtableRecordFields['Related Board meeting'] || '',
            "status": airtableRecordFields['Status'] || '',
            "year": airtableRecordFields['Year'] || '',
            "agenda": agendaUrl || '',
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

const handleAirtableWebhook = async (req, res) => {
    try {
        console.log('📥 Received webhook payload:', req.body);

        const { councilName, relatedBoardMeeting, year, status, agenda, recordId, webflowId } = req.body;
        if (!councilName || !recordId) {
            return res.status(400).send('Missing required fields');
        }

        const airtableRecordFields = {
            'Council Name': councilName,
            'Related Board meeting': relatedBoardMeeting,
            'Year': year,
            'Status': status,
            'Agenda': Array.isArray(agenda) && agenda.length > 0 ? agenda[0].url : '',
        };
        console.log(airtableRecordFields);
        let webflowItemId = webflowId;

        if (webflowItemId) {
            await updateWebflowItem(webflowItemId, airtableRecordFields);
        } else {
            webflowItemId = await createWebflowItem(airtableRecordFields);
            await updateAirtableRecord(recordId, webflowItemId);
        }

        res.status(200).json({ message: '✅ Success' });
    } catch (error) {
        console.error('❌ Error handling Airtable webhook:', error);
        res.status(500).json({ error: error.message });
    }
};

app.post('/airtable-webhook', handleAirtableWebhook);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
});
