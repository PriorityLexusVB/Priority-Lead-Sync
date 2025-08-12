const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const gmailWebhookSecret = defineSecret("GMAIL_WEBHOOK_SECRET");

admin.initializeApp();

const receiveEmailLeadHandler = async (req, res) => {
  try {
    const secret = gmailWebhookSecret.value();
    if (
      !req.headers["x-webhook-secret"] ||
      req.headers["x-webhook-secret"] !== secret
    ) {
      return res.status(401).send("Unauthorized");
    }

    if (typeof req.body !== "string") {
      return res.status(400).send("Body must be a string");
    }

    const bodyText = req.body.trim();
    if (!bodyText) {
      return res.status(400).send("Body cannot be empty");
    }

    const doc = {
      raw: bodyText,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "gmail-webhook",
      headers: { contentType: req.get("content-type") || null },
    };

    try {
      await admin.firestore().collection("leads_v2").add(doc);
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Firestore write failed:", error);
      return res.status(500).send("Internal error");
    }
  } catch (err) {
    console.error("Error handling email lead:", err);
    return res.status(500).send("Internal error");
  }
};

exports.receiveEmailLead = onRequest({ secrets: [gmailWebhookSecret] }, receiveEmailLeadHandler);

