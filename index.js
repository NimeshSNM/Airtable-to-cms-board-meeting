const Airtable = require('airtable');
const Webflow = require('webflow-api');
require('dotenv').config();

// Initialize Airtable
Airtable.configure({
    apiKey: process.env.AIRTABLE_API_KEY,
});
const airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID);
const airtableTable = process.env.AIRTABLE_TABLE_NAME; // Airtable table name

// Initialize Webflow
const webflow = new Webflow({
    token: process.env.WEBFLOW_API_KEY,
});
const webflowCollectionId = process.env.WEBFLOW_COLLECTION_ID; // Webflow collection ID

// Function to create Webflow item
async function createWebflowItem(fields) {
    try {
        const response = await webflow.createItem({
            collectionId: webflowCollectionId,
            fields: fields,
        });
        console.log(`Webflow item created. ID: ${response._id}`);
        return response._id;
    } catch (error) {
        console.error("Error creating Webflow item:", error);
        throw error;
    }
}

// Process all Airtable records and create Webflow items
function createItemsFromAirtable() {
    airtableBase(airtableTable).select({
        view: 'Master Data',
    }).eachPage(async (records, fetchNextPage) => {
        for (const record of records) {
            try {
                const airtableId = record.id;

                // Map Airtable fields to Webflow fields
                const webflowFields = {
                    'council': record.fields['council'] || '',
                    'related-board-meeting': record.fields['Related Board Meeting'] || '',
                    'agenda': record.fields['Agenda'] ? record.fields['Agenda'][0].url : '',
                    'minutes': record.fields['Minutes'] ? record.fields['Minutes'][0].url : '',
                    'google-drive-link': record.fields['Google Drive Link'] || '',
                    'year': record.fields['Year'] || '',
                    'status': record.fields['Status'] || '',
                    'airtable_record_id': airtableId,
                };

                // Create item in Webflow
                const webflowItemId = await createWebflowItem(webflowFields);

                // Update Airtable with Webflow item ID
                await airtableBase(airtableTable).update(airtableId, {
                    'Webflow ID': webflowItemId,
                });

            } catch (error) {
                console.error(`Failed to process record ${record.id}`, error);
            }
        }

        fetchNextPage();
    }, (err) => {
        if (err) {
            console.error("Error reading Airtable records:", err);
        } else {
            console.log("All Airtable records processed.");
        }
    });
}

// Run the sync once
createItemsFromAirtable();
