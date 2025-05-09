const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Load environment variables (replace with actual values if not using .env)
const AIRTABLE_API_KEY = 'YOUR_AIRTABLE_API_KEY';
const AIRTABLE_BASE_ID = 'YOUR_AIRTABLE_BASE_ID';
const AIRTABLE_TABLE_NAME = 'Committee and Council Meeting Agendas';
const WEBFLOW_API_KEY = 'YOUR_WEBFLOW_API_KEY';
const WEBFLOW_COLLECTION_ID = 'YOUR_WEBFLOW_COLLECTION_ID';

app.use(bodyParser.json());

// Airtable update function
const updateAirtableRecord = async (recordId, webflowItemId) => {
  try {
    const response = await axios.patch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`,
      {
        fields: {
          WebflowItemID: webflowItemId // Adjust field name if different
        }
      },
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    console.log('✅ Airtable record updated:', response.data);
  } catch (error) {
    console.error('❌ Error updating Airtable:', error.response?.data || error.message);
  }
};

// Webhook handler
const handleAirtableWebhook = async (req, res) => {
  console.log("📦 Received webhook payload:", req.body);

  try {
    const { councilName, recordId } = req.body;

    if (!recordId || !councilName) {
      console.log('❌ Missing councilName or recordId in the request.');
      return res.status(400).json({ error: 'Missing councilName or recordId' });
    }

    const name = councilName[0] || 'Untitled';

    const webflowFields = {
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: 'No description' // Optional
    };

    console.log('➡️ Sending to Webflow:', webflowFields);

    const response = await axios.post(
      `https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items`,
      { fields: webflowFields },
      {
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    const webflowItemId = response.data._id;
    console.log('✅ Created Webflow item:', webflowItemId);

    await updateAirtableRecord(recordId, webflowItemId);

    res.status(200).json({ message: 'Success', webflowItemId });
  } catch (error) {
    console.error('❌ Error handling webhook:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
};

// Webhook route
app.post('/webhook', handleAirtableWebhook);

// Root route
app.get('/', (req, res) => {
  res.send('✅ Airtable to Webflow Webhook Server is running.');
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
