// functions/index.js (Node 20, ESM)

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { parseStringPromise } from "xml2js";

// Initialize Admin SDK only once and bind to the DEFAULT app/db
try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore(); // default DB only

// Secrets (already in Secret Manager)
const GMAIL_WEBHOOK_SECRET = defineSecret("GMAIL_WEBHOOK_SECRET");
const OPENAI_API_KEY       = defineSecret("OPENAI_API_KEY");

// Minimal boot log
console.log("[functions] boot", {
  node: process.version,
  ts: new Date().toISOString(),
  projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT
});

// --- Health: Firestore (default DB) ---
export const firestoreHealth = onRequest({ region: "us-central1" }, async (_req, res) => {
  try {
    const ref = db.collection("ci-checks").doc("last-run");
    await ref.set({ ranAt: admin.firestore.FieldValue.serverTimestamp(), databaseId: "(default)" }, { merge: true });
    const snap = await ref.get();
    return res.json({ ok: true, exists: snap.exists, data: snap.data() || null });
  } catch (e) {
    const msg = String(e);
    const code = /NOT_FOUND/.test(msg) ? 5 : 2;
    return res.status(500).json({ ok: false, code, error: msg, hint: "Default Firestore database must exist." });
  }
});

// --- Health: basic ---
export const health = onRequest({ region: "us-central1" }, (_req, res) =>
  res.status(200).send("ok")
);

// --- Secrets check ---
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

// --- Webhook (JSON or ADF/XML) writes to default DB ---
export const receiveEmailLead = onRequest(
  {
    region: "us-central1",
    secrets: [GMAIL_WEBHOOK_SECRET],
    timeoutSeconds: 30,
    maxInstances: 10,
  },
  async (req, res) => {
    // header auth
    const provided = (req.header("x-webhook-secret") || "").trim();
    const expected = (process.env.GMAIL_WEBHOOK_SECRET || "").trim();
    if (!expected || provided !== expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      let lead;
      const ct = (req.headers["content-type"] || "").toLowerCase();

      if (ct.includes("application/json")) {
        lead = { ...req.body, source: req.body?.source || "webhook", format: req.body?.format || "json" };
      } else {
        // ADF/XML
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

      lead.receivedAt = admin.firestore.FieldValue.serverTimestamp();
      await db.collection("leads_v2").add(lead);

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  }
);

// --- Stub AI reply (just checks OPENAI key) ---
export const generateAIReply = onRequest(
  { region: "us-central1", secrets: [OPENAI_API_KEY], timeoutSeconds: 60 },
  async (_req, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });
    return res.json({ ok: true, msg: "AI reply generator is wired." });
  }
);

// --- Gmail OAuth health remains in default DB context (if present) ---
export const gmailHealth = onRequest({ region: "us-central1" }, async (_req, res) => {
  // Keep your existing gmail profile/labels check here if needed.
  return res.json({ ok: true, note: "gmailHealth placeholder (no-op here)" });
});
