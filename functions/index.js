// Cloud Function for receiving email leads
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  parseAdfEmail,
  extractLeadFromContact,
} = require("./adfEmailHandler");
const OpenAI = require("openai");

const gmailWebhookSecret = process.env.GMAIL_WEBHOOK_SECRET;

admin.initializeApp();

const receiveEmailLeadHandler = async (req, res) => {
  try {
    const secret = req.headers["x-webhook-secret"];
    if (!secret || secret !== gmailWebhookSecret) {
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

exports.receiveEmailLead = onRequest(receiveEmailLeadHandler);

exports.generateAIReply = onRequest(async (req, res) => {
  try {
    const { lead } = req.body || {};
    if (!lead) {
      return res.status(400).json({ error: "Missing lead" });
    }

    const prompt = lead.comments
      ? `Customer wrote: "${lead.comments}". Craft a helpful, concise reply to book an appointment at our Lexus dealership.`
      : `Generate a compelling message to follow up with a customer interested in a ${lead.vehicle}. Include dealership name and suggest a time to come in.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return res.status(500).send("Internal error");
  }
});

