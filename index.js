const Airtable = require('airtable');
const Webflow = require('webflow-api');
require('dotenv').config();

// Initialize Airtable
Airtable.configure({
    apiKey: process.env.AIRTABLE_API_KEY,
});
const airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID);
const airtableTable = process.env.AIRTABLE_TABLE_NAME; // Name of the Airtable table to watch

// Initialize Webflow
const webflow = new Webflow({
    token: process.env.WEBFLOW_API_KEY,
});
const webflowCollectionId = process.env.WEBFLOW_COLLECTION_ID; // Webflow collection ID

// Function to update Webflow item
async function updateWebflowItem(webflowItemId, fields) {
    try {
        await webflow.updateItem({
            collectionId: webflowCollectionId,
            itemId: webflowItemId,
            fields: fields,
        });
        console.log(`Webflow item ${webflowItemId} updated successfully.`);
    } catch (error) {
        console.error(`Error updating Webflow item ${webflowItemId}:`, error);
        throw error;
    }
}

// Function to create Webflow item
async function createWebflowItem(fields) {
    try {
        const response = await webflow.createItem({
            collectionId: webflowCollectionId,
            fields: fields,
        });
        console.log(`Webflow item created successfully. ID: ${response._id}`);
        return response._id;
    } catch (error) {
        console.error("Error creating Webflow item:", error);
        throw error;
    }
}

// Function to find Webflow item by Airtable ID
async function findWebflowItemByAirtableId(airtableId) {
    try {
        const items = await webflow.items({ collectionId: webflowCollectionId });
        const matchingItem = items.items.find(item => item.airtable_record_id === airtableId);
        return matchingItem ? matchingItem._id : null;
    } catch (error) {
        console.error("Error finding Webflow item by Airtable ID:", error);
        throw error;
    }
}

// Function to handle Airtable record updates
async function handleAirtableUpdate(record) {
    try {
        const airtableId = record.id;
        let webflowItemId = await findWebflowItemByAirtableId(airtableId);

        // Map Airtable fields to Webflow fields
        const webflowFields = {
            'council': record.fields['council'], // Mapping Airtable's 'Council' to Webflow's 'council'
            'related-board-meeting': record.fields['Related Board Meeting'], // Mapping Airtable's 'Related Board Meeting' to Webflow's 'related-board-meeting'
            'agenda': record.fields['Agenda'] ? record.fields['Agenda'][0].url : null, // Mapping Airtable's 'Agenda' to Webflow's 'agenda' (URL of the attachment)
            'minutes': record.fields['Minutes'] ? record.fields['Minutes'][0].url : null, // Mapping Airtable's 'Minutes' to Webflow's 'minutes' (URL of the attachment)
            'google-drive-link': record.fields['Google Drive Link'], // Mapping Airtable's 'Google Drive Link' to Webflow's 'google-drive-link'
            'year': record.fields['Year'], // Mapping Airtable's 'Year' to Webflow's 'year'
            'status': record.fields['Status'], // Mapping Airtable's 'Status' to Webflow's 'status' (completed || upcoming)
            'airtable_record_id': airtableId, // Store Airtable record ID in Webflow (important for sync)
        };

        if (webflowItemId) {
            // Update existing Webflow item
            try {
                await updateWebflowItem(webflowItemId, webflowFields);
                if (record.fields['Webflow ID'] !== webflowItemId) {
                    await airtableBase(airtableTable).update(record.id, {
                        'Webflow ID': webflowItemId
                    });
                }
            } catch (error) {
                console.error("Error updating Webflow item:", error);
            }
        } else {
            // Create new Webflow item
            try {
                webflowItemId = await createWebflowItem(webflowFields);
                await airtableBase(airtableTable).update(record.id, {
                    'Webflow ID': webflowItemId,
                });
            } catch (error) {
                console.error("Error creating Webflow item:", error);
            }
        }
    } catch (error) {
        console.error("Error handling Airtable update:", error);
    }
}

// -------------------------------
// Polling Logic for Real-time-Like Updates
// -------------------------------

let lastCheckTime = new Date(); // Save the initial check time

function pollAirtableChanges() {
    console.log(`Polling for updates after ${lastCheckTime.toISOString()}...`);

    airtableBase(airtableTable)
        .select({
            view: 'Grid view',
            filterByFormula: `IS_AFTER({Last Modified}, "${lastCheckTime.toISOString()}")`
        })
        .eachPage((records, fetchNextPage) => {
            if (records.length > 0) {
                console.log(`Found ${records.length} updated records.`);
                records.forEach(record => {
                    handleAirtableUpdate(record);
                });
            } else {
                console.log('No updated records found.');
            }
            fetchNextPage();
        }, (error) => {
            console.error("Error polling Airtable:", error);
        });

    // Update the last check time
    lastCheckTime = new Date();
}

// Poll every 60 seconds
setInterval(pollAirtableChanges, 60 * 1000);

console.log(`Polling Airtable table "${airtableTable}" every 60 seconds for updates...`);
