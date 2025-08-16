// functions/index.js (Gen 2 + Gmail OAuth + tolerant JSON/XML)
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { google } from "googleapis";
import { parseStringPromise } from "xml2js";

// Initialize the Admin SDK once
if (getApps().length === 0) {
  initializeApp({ projectId: "priority-lead-sync" });
}

// Secrets (mounted via Google Secret Manager)
const GMAIL_WEBHOOK_SECRET = defineSecret("GMAIL_WEBHOOK_SECRET");
const OPENAI_API_KEY       = defineSecret("OPENAI_API_KEY");

const GMAIL_CLIENT_ID     = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN");
const GMAIL_REDIRECT_URI  = defineSecret("GMAIL_REDIRECT_URI");

// --- health ---
export const health = onRequest({ region: "us-central1" }, (_req, res) => res.status(200).send("ok"));

// --- testSecrets ---
export const testSecrets = onRequest(
  { region: "us-central1", secrets: [GMAIL_WEBHOOK_SECRET, OPENAI_API_KEY] },
  (_req, res) => {
    res.json({
      ok: Boolean(process.env.GMAIL_WEBHOOK_SECRET && process.env.OPENAI_API_KEY),
      checks: {
        GMAIL_WEBHOOK_SECRET: Boolean(process.env.GMAIL_WEBHOOK_SECRET),
        OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      },
      timestamp: new Date().toISOString(),
    });
  }
);

// --- Gmail: build an authenticated client from refresh token ---
function buildGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oauth2 });
}

// --- gmailHealth: verify creds by fetching profile + first label ---
export const gmailHealth = onRequest(
  {
    region: "us-central1",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_REDIRECT_URI],
    timeoutSeconds: 30
  },
  async (_req, res) => {
    try {
      const gmail = buildGmailClient();
      const profile = await gmail.users.getProfile({ userId: "me" });
      const labels = await gmail.users.labels.list({ userId: "me" });
      res.json({
        ok: true,
        emailAddress: profile.data.emailAddress,
        labelSample: labels.data.labels?.slice(0, 3) ?? []
      });
    } catch (err) {
      console.error("gmailHealth error:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  }
);

// --- receiveEmailLead: auth via x-webhook-secret; accepts JSON or ADF/XML; writes to Firestore ---
export const receiveEmailLead = onRequest(
  {
    region: "us-central1",
    secrets: [GMAIL_WEBHOOK_SECRET],
    timeoutSeconds: 30,
    maxInstances: 10
  },
  async (req, res) => {
    const provided = (req.header("x-webhook-secret") || "").trim();
    const expected = (process.env.GMAIL_WEBHOOK_SECRET || "").trim();
    if (!expected || provided !== expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const ct = String(req.headers["content-type"] || "").toLowerCase();
      // Normalize raw bytes to tolerate PowerShell/curl/body-parsing quirks
      const raw = typeof req.rawBody === "undefined"
        ? Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}), "utf8")
        : Buffer.from(req.rawBody);

      let lead;

      if (ct.includes("application/json")) {
        let obj = req.body;
        if (typeof obj === "string" || Buffer.isBuffer(obj)) {
          const s = Buffer.isBuffer(obj) ? obj.toString("utf8") : obj;
          obj = s.length ? JSON.parse(s) : {};
        }
        lead = { ...obj };
      } else {
        const xml = raw.toString("utf8");
        const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
        const p = parsed?.adf?.prospect || parsed?.prospect || {};
        const vehicle = p.vehicle || {};
        const contact = p.customer?.contact || p.customer || {};
        lead = {
          source: "webhook",
          format: "adf",
          requestDate: p.requestdate || p.requestDate || new Date().toISOString(),
          vehicle: {
            year: vehicle.year || null,
            make: vehicle.make || null,
            model: vehicle.model || null,
            vin: vehicle.vin || null
          },
          customer: {
            name: contact?.name?.["_"] || contact?.name || null,
            email: contact?.email || null,
            phone: contact?.phone || null
          }
        };
      }

      const db = getFirestore();
      lead.receivedAt = FieldValue.serverTimestamp();
      await db.collection("leads_v2").add(lead);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("receiveEmailLead error:", err);
      return res.status(400).json({ ok: false, error: "Bad request: " + (err instanceof Error ? err.message : String(err)) });
    }
  }
);

// --- AI stub (unchanged) ---
export const generateAIReply = onRequest(
  { region: "us-central1", secrets: [OPENAI_API_KEY], timeoutSeconds: 60 },
  async (_req, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });
    return res.json({ ok: true, msg: "AI reply generator is wired." });
  }
);

