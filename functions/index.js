import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { parseStringPromise } from "xml2js";
import { google } from "googleapis";

// Initialize Admin SDK exactly once, bound to the correct project
if (getApps().length === 0) {
  initializeApp({ projectId: "priority-lead-sync" });
}

/** Runtime secrets (mounted via Google Secret Manager) */
const GMAIL_WEBHOOK_SECRET = defineSecret("GMAIL_WEBHOOK_SECRET");
const OPENAI_API_KEY       = defineSecret("OPENAI_API_KEY");
const GMAIL_CLIENT_ID      = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET  = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN  = defineSecret("GMAIL_REFRESH_TOKEN");
const GMAIL_REDIRECT_URI   = defineSecret("GMAIL_REDIRECT_URI");

/** Health check */
export const health = onRequest({ region: "us-central1" }, (_req, res) => res.status(200).send("ok"));

/** Verify secrets are mounted (no values leaked) */
export const testSecrets = onRequest(
  { region: "us-central1", secrets: [GMAIL_WEBHOOK_SECRET, OPENAI_API_KEY, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_REDIRECT_URI] },
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

/** Firestore health: create+read a small probe to prove DB exists and perms are OK */
export const firestoreHealth = onRequest(
  { region: "us-central1" },
  async (_req, res) => {
    try {
      const db = getFirestore();
      const ref = db.collection("__health").doc("__writecheck");
      const now = new Date().toISOString();
      await ref.set({ now, source: "firestoreHealth" }, { merge: true });
      const got = await ref.get();
      res.json({
        ok: true,
        projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "unknown",
        databaseId: "(default)",
        wroteAt: now,
        readBack: got.exists ? got.data() : null,
      });
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      res.status(500).json({
        ok: false,
        code: e?.code || e?.status || "UNKNOWN",
        error: msg,
        hint: msg.includes("NOT_FOUND")
          ? "Firestore database likely not created. In Firebase Console → Firestore → Create Database (Native)."
          : "Check service account perms and projectId initialization.",
      });
    }
  }
);

/** Primary webhook: auth via x-webhook-secret; accepts JSON or ADF/XML; writes to Firestore */
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
        lead = { ...req.body };
      } else {
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
        };
      }

      // Firestore write (modular API)
      const db = getFirestore();
      lead.receivedAt = FieldValue.serverTimestamp();
      await db.collection("leads_v2").add(lead);

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      const msg = String(err && err.message ? err.message : err);
      // Common field diagnosis: NOT_FOUND => DB not created
      return res.status(400).json({ ok: false, error: `Bad request: ${msg}` });
    }
  }
);

/** Stubbed AI reply — verifies key presence */
export const generateAIReply = onRequest(
  { region: "us-central1", secrets: [OPENAI_API_KEY], timeoutSeconds: 60 },
  async (_req, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });
    return res.json({ ok: true, msg: "AI reply generator is wired." });
  }
);

/** Gmail OAuth health (profile + top labels) */
export const gmailHealth = onRequest(
  { region: "us-central1", secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_REDIRECT_URI] },
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
      const labels  = await gmail.users.labels.list({ userId: "me" });
      res.json({
        ok: true,
        emailAddress: profile.data.emailAddress,
        labelSample: (labels.data.labels || []).slice(0, 3),
      });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: String(e),
        hint: "Ensure Client ID/Secret/Redirect URI/Refresh Token are from the same OAuth client, Gmail API is enabled, and your account is an allowed test user."
      });
    }
  }
);
