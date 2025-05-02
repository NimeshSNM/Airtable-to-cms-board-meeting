const Airtable = require('airtable');
const Webflow = require('webflow-api');
require('dotenv').config();

// Setup Airtable
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY,
});
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
const tableName = process.env.AIRTABLE_TABLE_NAME;

// Setup Webflow
const webflow = new Webflow({ token: process.env.WEBFLOW_API_KEY });
const collectionId = process.env.WEBFLOW_COLLECTION_ID;

// Sleep function to avoid Webflow rate limits
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Create item in Webflow (only name field for now)
async function createWebflowItem(fields) {
  try {
    const response = await webflow.createItem({
      collectionId,
      fields: {
        name: String(fields.name || "Untitled"),
        _archived: false,
        _draft: false,
      },
      live: true,
    });

    console.log(`✅ Created Webflow item: ${response._id}`);
    return response._id;
  } catch (err) {
    console.error("❌ Error creating Webflow item:", err.response?.data || err.message);
    throw err;
  }
}

// Handle a single Airtable record
async function handleAirtableRecord(record) {
  try {
    // Debug: print all Airtable fields
    console.log("📦 Airtable Record Fields:", record.fields);

    const webflowFields = {
      name: String(record.fields["Council"] || "Untitled"),
    };

    await createWebflowItem(webflowFields);
  } catch (err) {
    console.error("❌ Error handling Airtable record:", err.message);
  }
}

// Fetch and process all records from Airtable
async function processAirtableRecords() {
  base(tableName)
    .select({ view: "Master Data" })
    .eachPage(
      async (records, fetchNextPage) => {
        for (const record of records) {
          await handleAirtableRecord(record);
          await sleep(1100); // Prevent Webflow rate limit
        }
        fetchNextPage();
      },
      (err) => {
        if (err) {
          console.error("❌ Error fetching Airtable records:", err);
        } else {
          console.log("✅ Finished processing all records.");
        }
      }
    );
}

// Start the script
processAirtableRecords();
