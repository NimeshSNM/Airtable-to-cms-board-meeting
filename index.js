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
        throw error; // Re-throw to be caught by the caller
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
        return response._id; // Return the ID of the newly created item
    } catch (error) {
        console.error("Error creating Webflow item:", error);
        throw error;
    }
}

// Function to find Webflow item by Airtable ID
async function findWebflowItemByAirtableId(airtableId) {
    try {
        const items = await webflow.items({ collectionId: webflowCollectionId });
        const matchingItem = items.items.find(item => item.airtable_record_id === airtableId); // airtable_record_id is the name of the field in Webflow
        return matchingItem ? matchingItem._id : null;
    } catch (error) {
        console.error("Error finding Webflow item by Airtable ID:", error);
        throw error;
    }
}
//
// Function to handle Airtable record updates
async function handleAirtableUpdate(record) {
    try {
        const airtableId = record.id;
        let webflowItemId = await findWebflowItemByAirtableId(airtableId);

        // Map Airtable fields to Webflow fields.  Adjust this mapping as needed.
        const webflowFields = {
            'council': record.fields.council ? record.fields.council[0] : null, // Map the 'council' linked record.  Important: get the ID.
            'related-board-meeting': record.fields['Related Board Meeting'], // Map the 'Related Board Meeting' select field.
            'agenda': record.fields.Agenda ? record.fields.Agenda[0].url : null, // Map the 'Agenda' attachment.  Get the URL.
            'minutes': record.fields.Minutes ? record.fields.Minutes[0].url : null, // Map the 'Minutes' attachment. Get the URL
            'status': record.fields.Status, // Map the 'Status' select field.
            'year': record.fields.Year, // Map the 'Year' field.
            'google-drive-link': record.fields['Google Drive Link'], // Map the 'Google Drive Link'
            'airtable_record_id': airtableId, // Store Airtable record ID in Webflow - VERY IMPORTANT
        };

        if (webflowItemId) {
            // Update existing item
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
            // Create new item
            try {
                webflowItemId = await createWebflowItem(webflowFields);
                await airtableBase(airtableTable).update(record.id, {  //update the airtable record with webflow ID
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

// Watch Airtable for changes using the "watch" method
base2(airtableTable) // Access the Airtable table
    .select({
        view: 'Grid view', // Or the name of your view
    })
    .watch((records, fetchNextPage) => { // Use the watch method
        if (records) {
            records.forEach(record => {
                handleAirtableUpdate(record); // Handle the record update
            });
        }
        fetchNextPage();
    }, (error) => {
        console.error("Error watching Airtable records:", error);
        // Consider restarting the watch or using a more robust error handling mechanism.
    });

console.log(`Watching Airtable table "${airtableTable}" for any changes...`);
