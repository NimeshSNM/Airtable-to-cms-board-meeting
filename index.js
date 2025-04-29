const Airtable = require('airtable');
const Webflow = require('webflow-api');
require('dotenv').config();

// Initialize Airtable
Airtable.configure({
    apiKey: process.env.AIRTABLE_API_KEY,
});
const airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID);
const airtableTable = process.env.AIRTABLE_TABLE_NAME; // Airtable Table Name

// Initialize Webflow
const webflow = new Webflow({
    token: process.env.WEBFLOW_API_KEY,
});
const webflowCollectionId = process.env.WEBFLOW_COLLECTION_ID; // Webflow Collection ID

// Function to create Webflow item
async function createWebflowItem(fields) {
    try {
        console.log("🔄 Creating Webflow item with fields:", fields);

        const response = await webflow.createItem({
            collectionId: webflowCollectionId,
            fields: {
                ...fields,
                _archived: false,
                _draft: false,
            },
            live: true, // Immediately publish the item
        });

        console.log(`✅ Webflow item created. ID: ${response._id}`);
        return response._id;
    } catch (error) {
        console.error("❌ Error creating Webflow item:", error.response?.data || error.message);
        throw error;
    }
}

// Function to handle a single Airtable record
async function handleAirtableRecord(record) {
    try {
        const airtableId = record.id;

        // Map Airtable fields to Webflow field slugs
        const webflowFields = {
            'name': record.fields['Council'] || 'Untitled', // Airtable 'Council' → Webflow 'Name'
            'board-meeting': record.fields['Related Board meeting'] || '', // Airtable 'Related Board meeting' → Webflow 'Board Meeting'
            'agenda': record.fields['Agenda'] ? record.fields['Agenda'][0].url : '', // Airtable 'Agenda' → Webflow 'Agenda'
            'minutes': record.fields['Minutes'] ? record.fields['Minutes'][0].url : '', // Airtable 'Minutes' → Webflow 'Minutes'
            'drive-link': record.fields['Google Drive link'] || '', // Airtable 'Google Drive link' → Webflow 'Drive Link'
            'year': record.fields['Year'] || '', // Airtable 'Year' → Webflow 'Year'
            'status': record.fields['Status'] || '', // Airtable 'Status' → Webflow 'Status'
            'airtable_record_id': record.id, // Airtable Record ID → Webflow 'airtable_record_id' (custom field)
        };

        // Create the Webflow item with the mapped fields
        const webflowItemId = await createWebflowItem(webflowFields);

        // Update the Airtable record with the Webflow item ID
        await airtableBase(airtableTable).update(record.id, {
            'Webflow ID': webflowItemId,
        });
    } catch (error) {
        console.error("❌ Error handling Airtable record:", error.message);
    }
}

// Fetch Airtable records and create items in Webflow
airtableBase(airtableTable)
    .select({
        view: 'Master Data', // Ensure this view exists
    })
    .eachPage(
        async (records, fetchNextPage) => {
            for (const record of records) {
                await handleAirtableRecord(record);
            }
            fetchNextPage();
        },
        (error) => {
            if (error) {
                console.error("❌ Error fetching Airtable records:", error);
            } else {
                console.log("✅ All records processed.");
            }
        }
    );
