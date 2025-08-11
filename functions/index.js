require("dotenv").config();
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Optional: verify webhook signatures or authenticate with Gmail API
const gmailWebhookSecret = process.env.GMAIL_WEBHOOK_SECRET;

admin.initializeApp();

exports.receiveCallDripLead = functions.https.onRequest(async (req, res) => {
  try {
    console.log("✅ Raw Payload Received:", JSON.stringify(req.body, null, 2));

    let data = {};

    // Detect common formats
    if (req.body.lead) {
      data = req.body.lead;
    } else if (req.body) {
      data = req.body;
    } else {
      throw new Error("❌ No recognizable lead data.");
    }

    const {
      first_name,
      last_name,
      phone,
      phone_number, // fallback if it's named this
      email,
      comments,
      vehicle,
      trade
    } = data;

    const leadData = {
      first_name: first_name || "Missing",
      last_name: last_name || "Missing",
      phone: phone || phone_number || "Missing",
      email: email || "Missing",
      comments: comments || "",
      vehicle: vehicle || "",
      trade: trade || "",
      receivedAt: new Date().toISOString()
    };

    console.log("📋 Final Parsed Lead Data:", leadData);

    // Optionally: Write to Firestore for later use
    await admin.firestore().collection("leads").add(leadData);

    res.status(200).send("✅ Lead received and parsed.");
  } catch (err) {
    console.error("❌ Error handling webhook:", err);
    res.status(500).send("❌ Failed to process webhook.");
  }
});
