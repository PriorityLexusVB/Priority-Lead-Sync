// Cloud Function for receiving email leads
const express = require("express");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const {
  parseAdfEmail,
  extractLeadFromContact,
} = require("./adfEmailHandler");

const GMAIL_WEBHOOK_SECRET = defineSecret("GMAIL_WEBHOOK_SECRET");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

admin.initializeApp();

const app = express();
app.use(express.text({ type: "*/*", limit: "10mb" }));

const receiveEmailLeadHandler = async (req, res) => {
  try {
    const secret = req.headers["x-webhook-secret"];
    if (!secret || secret !== GMAIL_WEBHOOK_SECRET.value()) {
      return res.status(401).send("Unauthorized");
    }

    if (typeof req.body !== "string") {
      return res.status(400).send("Body must be a string");
    }

    const bodyText = req.body.trim();
    if (!bodyText) {
      return res.status(400).send("Body cannot be empty");
    }

    const contentType = req.get("content-type") || null;
    const doc = {
      raw: bodyText,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "gmail-webhook",
      headers: { contentType },
    };

    const adf = parseAdfEmail(bodyText);
    if (adf?.prospect?.customer?.contact) {
      const lead = extractLeadFromContact(adf.prospect.customer.contact);
      Object.assign(doc, lead);
    }

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

app.post("*", receiveEmailLeadHandler);

exports.receiveEmailLead = onRequest(
  { region: "us-central1", secrets: [GMAIL_WEBHOOK_SECRET, OPENAI_API_KEY] },
  app
);
exports.receiveEmailLeadHandler = receiveEmailLeadHandler;

