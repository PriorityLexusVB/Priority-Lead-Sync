const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const { XMLParser } = require("fast-xml-parser");
const { extractLeadFromContact } = require("./adfEmailHandler");
const { getFirst, getText } = require("./utils");
const { setSecretOnce } = require("./setSecretOnce");

const app = express();
app.use(express.text({ type: "*/*", limit: "10mb" }));

// Optional: verify webhook signatures or authenticate with Gmail API
const gmailWebhookSecret = process.env.GMAIL_WEBHOOK_SECRET;

admin.initializeApp();

exports.setSecretOnce = functions.https.onRequest((req, res) => {
  try {
    setSecretOnce();
    res.status(200).send("Secret set");
  } catch (err) {
    console.error("Error in setSecretOnce:", err);
    res.status(500).send("Failed to set secret");
  }
});

const receiveEmailLeadHandler = async (req, res) => {
  try {
    if (
      !req.headers["x-webhook-secret"] ||
      req.headers["x-webhook-secret"] !== gmailWebhookSecret
    ) {
      return res.status(401).send("Unauthorized");
    }

    let bodyText = "";

    if (typeof req.body === "string") {
      bodyText = req.body;
    } else if (req.body && req.body.text) {
      bodyText = req.body.text;
    } else if (req.rawBody) {
      bodyText = req.rawBody.toString();
    }

    let lead = {
      first_name: null,
      last_name: null,
      phone: null,
      email: null,
      comments: "",
      vehicle: "",
      trade: "",
      receivedAt: new Date().toISOString()
    };

    if (/(<adf>|<\?xml)/i.test(bodyText) || (req.headers["content-type"] || "").includes("xml")) {
      const parser = new XMLParser({ ignoreAttributes: false, isArray: () => true });
      const json = parser.parse(bodyText);
      if (!json?.adf) {
        console.error("❌ Parsing error: json.adf not found.");
        return res.status(400).send("❌ Failed to process email lead.");
      }
      const adf = json.adf;
      const prospect = getFirst(adf.prospect);
      const customer = getFirst(prospect?.customer);
      const contact = getFirst(customer?.contact);

      const { firstName, lastName, phone, email } = extractLeadFromContact(contact || {});
      const comments = getText(prospect?.comments);
      const vehicle = getText(getFirst(prospect?.vehicle)?.description);
      const trade = getText(getFirst(prospect?.trade_in)?.description);

      lead = {
        ...lead,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        email: email || null,
        comments,
        vehicle,
        trade
      };
    } else {
      const lines = bodyText.split(/\r?\n/);
      const getValue = (label) => {
        const line = lines.find((l) => l.toLowerCase().startsWith(label.toLowerCase()));
        return line ? line.split(":").slice(1).join(":").trim() : "";
      };

      const fullName = getValue("Name");
      const [firstName = "", lastName = ""] = fullName.split(" ");
      lead.first_name = firstName || null;
      lead.last_name = lastName || null;
      lead.phone = getValue("Phone") || null;
      lead.email = getValue("Email") || null;
      lead.comments = getValue("Comments");
      lead.vehicle = getValue("Vehicle");
      lead.trade = getValue("Trade");
    }

    const requiredFields = ["first_name", "last_name", "phone", "email"];
    const missingFields = requiredFields.filter((field) => !lead[field]);

    if (missingFields.length > 0) {
      return res.status(400).send(`Missing required fields: ${missingFields.join(", ")}`);
    }

    try {
      await admin.firestore().collection("leads_v2").add({
        ...lead,
        ingestor: "receiveLead_v2",
      });
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

app.post("/", receiveEmailLeadHandler);

exports.receiveEmailLead = onRequest(receiveEmailLeadHandler);

