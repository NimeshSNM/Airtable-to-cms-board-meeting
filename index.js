const axios = require('axios');

// Use environment variables from Render
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

/**
 * Creates a new item in Webflow.
 *
 * @param {object} airtableRecordFields - The fields from the Airtable record.
 * @returns {Promise<string>} The ID of the newly created Webflow item.
 * @throws {Error} If the Webflow API call fails.
 */
const createWebflowItem = async (airtableRecordFields) => {
    // Map Airtable fields to Webflow fields.  Adjust this mapping as needed!
    let webflowName = 'Untitled';
    if (airtableRecordFields['Council Name']) {
        // Lookup fields in Airtable return an array of linked record names.
        //  We'll take the first one, or you could modify this to handle multiple.
        if (Array.isArray(airtableRecordFields['Council Name'])) {
            webflowName = airtableRecordFields['Council Name'][0] || 'Untitled';
        } else {
             webflowName = airtableRecordFields['Council Name'] || 'Untitled';
        }
    }

    const webflowFields = {
        name: webflowName, // Use the value from the "Council Name" lookup field
        slug: webflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled',
        description: airtableRecordFields.Description || 'No description',
        // Add more mappings as needed for your Webflow collection fields
        // 'webflow-field-id': airtableRecordFields['Airtable Field Name'],
    };

    const webflowPayload = {
        fields: webflowFields,
    };

    try {
        const response = await axios.post(
            `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live`,
            webflowPayload,
            {
                headers: {
                    Authorization: `Bearer ${WEBFLOW_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data.id;
    } catch (error) {
        console.error('Error creating Webflow item:', error.response?.data || error.message);
        throw new Error(`Failed to create Webflow item: ${error.message}`);
    }
};

/**
 * Updates an Airtable record with a Webflow Item ID.
 *
 * @param {string} airtableRecordId - The ID of the Airtable record to update.
 * @param {string} webflowItemId - The ID of the Webflow item.
 * @returns {Promise<void>}
 * @throws {Error} If the Airtable API call fails.
 */
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

/**
 * Handles the Airtable webhook event when a new record is created.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
const handleAirtableWebhook = async (req, res) => {
    try {
        // 1. Get the data from the Airtable webhook payload.
        const { records } = req.body;

        if (!records || records.length === 0) {
            console.log('Received Airtable webhook with no records.  Exiting.');
            return res.status(200).send('OK');
        }
        const newRecord = records[0];

        const airtableRecordId = newRecord.id;
        const airtableRecordFields = newRecord.fields;

        console.log('Received new Airtable record:', { airtableRecordId, airtableRecordFields });

        // 2. Create a new item in Webflow.
        const webflowItemId = await createWebflowItem(airtableRecordFields);

        // 3. Update the Airtable record with the Webflow Item ID.
        await updateAirtableRecord(airtableRecordId, webflowItemId);

        // 4. Send a success response.
        res.status(200).json({ message: 'Successfully processed Airtable webhook and updated Webflow and Airtable.' });
    } catch (error) {
        // 5. Handle errors.
        console.error('Error handling Airtable webhook:', error);
        res.status(500).json({ error: error.message });
    }
};

//  Express route for the Airtable webhook.
//  Important:  Configure your Airtable webhook to send POST requests to this endpoint.
const express = require('express');
const app = express();
app.use(express.json());

app.post('/airtable-webhook', handleAirtableWebhook);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
