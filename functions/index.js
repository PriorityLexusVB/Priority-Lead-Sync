// functions/index.js
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getApps, initializeApp, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { google } from "googleapis";
import { parseStringPromise } from "xml2js";

/** ---------- Admin SDK bootstrap (explicit project binding) ---------- */
if (getApps().length === 0) {
  initializeApp({ projectId: "priority-lead-sync" });
}
const db = getFirestore(undefined, "leads");

// (If you reference FieldValue elsewhere, switch to the imported one)
// example:
// lead.receivedAt = FieldValue.serverTimestamp();

/** ---------- Secrets (mounted from Secret Manager at runtime) ---------- */
const GMAIL_WEBHOOK_SECRET = defineSecret("GMAIL_WEBHOOK_SECRET");
const OPENAI_API_KEY       = defineSecret("OPENAI_API_KEY");
const GMAIL_CLIENT_ID      = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET  = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN  = defineSecret("GMAIL_REFRESH_TOKEN");
const GMAIL_REDIRECT_URI   = defineSecret("GMAIL_REDIRECT_URI");

/** ---------- Health (simple) ---------- */
export const health = onRequest({ region: "us-central1" }, (_req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

/** ---------- Secrets check (no values leaked) ---------- */
export const testSecrets = onRequest(
  {
    region: "us-central1",
    secrets: [
      GMAIL_WEBHOOK_SECRET,
      OPENAI_API_KEY,
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REFRESH_TOKEN,
      GMAIL_REDIRECT_URI,
    ],
  },
  (_req, res) => {
    res.json({
      ok: true,
      checks: {
        GMAIL_WEBHOOK_SECRET: Boolean(process.env.GMAIL_WEBHOOK_SECRET),
        OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
        GMAIL_CLIENT_ID: Boolean(process.env.GMAIL_CLIENT_ID),
        GMAIL_CLIENT_SECRET: Boolean(process.env.GMAIL_CLIENT_SECRET),
        GMAIL_REFRESH_TOKEN: Boolean(process.env.GMAIL_REFRESH_TOKEN),
        GMAIL_REDIRECT_URI: Boolean(process.env.GMAIL_REDIRECT_URI),
      },
      timestamp: new Date().toISOString(),
    });
  }
);

/** ---------- Firestore health: default DB (no custom databaseId) ---------- */
export const firestoreHealth = onRequest({ region: "us-central1" }, async (_req, res) => {
  try {
    const ref = db.collection("ci-checks").doc("last-run");
    await ref.set(
      {
        ranAt: new Date().toISOString(),
        // record where this ran, for sanity
        projectId: getApp().options.projectId || "unknown",
        node: process.version,
      },
      { merge: true }
    );
    const snap = await ref.get();
    return res.status(200).json({
      ok: true,
      exists: snap.exists,
      data: snap.exists ? snap.data() : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/** ---------- Gmail OAuth health ---------- */
export const gmailHealth = onRequest(
  {
    region: "us-central1",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_REDIRECT_URI],
    timeoutSeconds: 30,
  },
  async (_req, res) => {
    try {
      const oauth2 = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
      );
      oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
      const gmail = google.gmail({ version: "v1", auth: oauth2 });

      const profile = await gmail.users.getProfile({ userId: "me" });
      const labels = await gmail.users.labels.list({ userId: "me" });

      res.json({
        ok: true,
        emailAddress: profile.data.emailAddress,
        labelSample: (labels.data.labels || []).slice(0, 3),
      });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: String(e),
        hint:
          "Ensure Gmail API is enabled, and the refresh token matches this OAuth client (client id/secret & redirect URI).",
      });
    }
  }
);

/** ---------- Receive lead (JSON or ADF/XML) → Firestore ---------- */
export const receiveEmailLead = onRequest(
  {
    region: "us-central1",
    secrets: [GMAIL_WEBHOOK_SECRET],
    timeoutSeconds: 30,
    maxInstances: 10,
  },
  async (req, res) => {
    const provided = (req.header("x-webhook-secret") || "").trim();
    const expected = (process.env.GMAIL_WEBHOOK_SECRET || "").trim();
    if (!expected || provided !== expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      let lead;
      const ct = (req.headers["content-type"] || "").toLowerCase();

      if (ct.includes("application/json")) {
        // Raw JSON body
        lead = { ...req.body, source: req.body?.source || "webhook", format: req.body?.format || "json" };
      } else {
        // ADF/XML (uses rawBody)
        const xml = req.rawBody?.toString("utf8") || "";
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
            vin: vehicle.vin || null,
          },
          customer: {
            name: contact?.name?.["_"] || contact?.name || null,
            email: contact?.email || null,
            phone: contact?.phone || null,
          },
          raw: p || null,
        };
      }

      // Firestore write
      lead.receivedAt = FieldValue.serverTimestamp();
      await db.collection("leads_v2").add(lead);

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      const msg = String(err && err.message ? err.message : err);
      return res.status(400).json({ ok: false, error: `Bad request: ${msg}` });
    }
  }
);

/** ---------- Stubbed AI reply (key presence check) ---------- */
export const generateAIReply = onRequest(
  { region: "us-central1", secrets: [OPENAI_API_KEY], timeoutSeconds: 60 },
  async (_req, res) => {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });
    }
    return res.json({ ok: true, msg: "AI reply generator is wired." });
  }
);
