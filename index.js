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

// Sleep function to avoid rate limits
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Create only the name field in Webflow
async function createWebflowItem(fields) {
  try {
    const response = await webflow.createItem({
      collectionId,
      fields: {
        name: fields.name,
        _archived: false,
        _draft: false,
      },
      live: true,
    });

    console.log(`✅ Created item: ${response._id}`);
    return response._id;
  } catch (err) {
    console.error("❌ Error creating Webflow item:", err.response?.data || err.message);
    throw err;
  }
}

// Handle each Airtable record
async function handleAirtableRecord(record) {
  try {
    // Log all fields for debugging
    console.log("📦 Airtable Record Fields:", record.fields);

    // Prepare fields for Webflow
    const webflowFields = {
      name: String(record.fields["Council Name"]?.[0] || "Untitled"),
    };

    // Create item in Webflow
    await createWebflowItem(webflowFields);
  } catch (err) {
    console.error("❌ Error handling Airtable record:", err.message);
  }
}

// Process all Airtable records
async function processAirtableRecords() {
  base(tableName)
    .select({ view: "Master Data" })
    .eachPage(
      async (records, fetchNextPage) => {
        for (const record of records) {
          await handleAirtableRecord(record);
          await sleep(1100); // avoid Webflow rate limits
        }
        fetchNextPage();
      },
      (err) => {
        if (err) {
          console.error("❌ Error fetching records:", err);
        } else {
          console.log("✅ Finished processing.");
        }
      }
    );
}

// Run the script
processAirtableRecords();
