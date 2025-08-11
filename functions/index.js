require("dotenv").config();
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { XMLParser } = require("fast-xml-parser");

// Optional: verify webhook signatures or authenticate with Gmail API
const gmailWebhookSecret = process.env.GMAIL_WEBHOOK_SECRET;

admin.initializeApp();

exports.receiveEmailLead = functions.https.onRequest(async (req, res) => {
  try {
    let bodyText = "";

    if (typeof req.body === "string") {
      bodyText = req.body;
    } else if (req.body && req.body.text) {
      bodyText = req.body.text;
    } else if (req.rawBody) {
      bodyText = req.rawBody.toString();
    }

    let lead = {
      first_name: "Missing",
      last_name: "Missing",
      phone: "Missing",
      email: "Missing",
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
      const prospect = json.adf.prospect?.[0];
      const customer = prospect?.customer?.[0];
      const contact = customer?.contact?.[0];

      const name = contact?.name?.[0] || {};
      const firstName = name.first?.[0] || "";
      const lastName = name.last?.[0] || "";
      const email = contact?.email?.[0] || "";
      const phone = contact?.phone?.[0]?._ || contact?.phone?.[0] || "";
      const comments = prospect?.comments?.[0] || "";
      const vehicle = prospect?.vehicle?.[0]?.description?.[0] || "";
      const trade = prospect?.trade_in?.[0]?.description?.[0] || "";

      lead = {
        ...lead,
        first_name: firstName || "Missing",
        last_name: lastName || "Missing",
        phone: phone || "Missing",
        email: email || "Missing",
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
      const [firstName = "Missing", lastName = ""] = fullName.split(" ");
      lead.first_name = firstName || "Missing";
      lead.last_name = lastName || "Missing";
      lead.phone = getValue("Phone") || "Missing";
      lead.email = getValue("Email") || "Missing";
      lead.comments = getValue("Comments");
      lead.vehicle = getValue("Vehicle");
      lead.trade = getValue("Trade");
    }

    await admin.firestore().collection("leads").add(lead);
    res.status(200).send("✅ Lead received and parsed.");
  } catch (err) {
    console.error("❌ Error handling email lead:", err);
    res.status(500).send("❌ Failed to process email lead.");
  }
});

