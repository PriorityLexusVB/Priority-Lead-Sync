import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { parseStringPromise } from "xml2js";

// ----- Secrets -----
const GMAIL_WEBHOOK_SECRET = defineSecret("GMAIL_WEBHOOK_SECRET");
const OPENAI_API_KEY       = defineSecret("OPENAI_API_KEY");
const GMAIL_CLIENT_ID      = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET  = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN  = defineSecret("GMAIL_REFRESH_TOKEN");
const GMAIL_REDIRECT_URI   = defineSecret("GMAIL_REDIRECT_URI");

// ----- Admin (named Firestore DB: leads) -----
let app;
let db;
function ensureAdmin() {
  if (!app) {
    app = admin.initializeApp({
      projectId: "priority-lead-sync",
    });
    db = admin.firestore(app);
    // IMPORTANT: target the existing named db 'leads'
    db.settings({ databaseId: "leads" });
  }
  return { app, db };
}

// ----- Health -----
export const health = onRequest({ region: "us-central1" }, (_req, res) => {
  res.status(200).json({ ok: true, node: process.version, at: new Date().toISOString() });
});

// Verify secrets without leaking values
export const testSecrets = onRequest(
  { region: "us-central1", secrets: [GMAIL_WEBHOOK_SECRET, OPENAI_API_KEY, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_REDIRECT_URI] },
  (_req, res) => {
    res.json({
      ok: Boolean(process.env.GMAIL_WEBHOOK_SECRET),
      checks: {
        GMAIL_WEBHOOK_SECRET: !!process.env.GMAIL_WEBHOOK_SECRET,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        GMAIL_CLIENT_ID: !!process.env.GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET: !!process.env.GMAIL_CLIENT_SECRET,
        GMAIL_REFRESH_TOKEN: !!process.env.GMAIL_REFRESH_TOKEN,
        GMAIL_REDIRECT_URI: !!process.env.GMAIL_REDIRECT_URI,
      },
      at: new Date().toISOString(),
    });
  }
);

// Minimal Firestore health against DB 'leads'
export const firestoreHealth = onRequest({ region: "us-central1" }, async (_req, res) => {
  try {
    const { db } = ensureAdmin();
    const col = db.collection("_health");
    const docRef = col.doc("probe");
    await docRef.set({
      ping: admin.firestore.FieldValue.serverTimestamp(),
      node: process.version,
      projectId: "priority-lead-sync",
      databaseId: "leads",
    }, { merge: true });
    const snap = await docRef.get();
    res.json({ ok: true, data: snap.data() || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Stubbed Gmail health — keep your current implementation or simple ok
export const gmailHealth = onRequest({ region: "us-central1" }, async (_req, res) => {
  res.json({ ok: true, note: "gmailHealth stubbed; OAuth verified separately" });
});

// ----- Webhook: receiveEmailLead (JSON or ADF/XML) -----
export const receiveEmailLead = onRequest(
  { region: "us-central1", secrets: [GMAIL_WEBHOOK_SECRET], timeoutSeconds: 30, maxInstances: 10 },
  async (req, res) => {
    const provided = (req.header("x-webhook-secret") || "").trim();
    const expected = (process.env.GMAIL_WEBHOOK_SECRET || "").trim();
    if (!expected || provided !== expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const { db } = ensureAdmin();
      const ct = (req.headers["content-type"] || "").toLowerCase();
      let lead;

      if (ct.includes("application/json")) {
        lead = { ...req.body, source: req.body?.source || "webhook", format: "json" };
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
          subject: p?.vehicle?.interest || undefined
        };
      }

      lead.receivedAt = admin.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection("leads_v2").add(lead);

      return res.status(200).json({ ok: true, id: ref.id });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ ok: false, error: "Bad request: " + String(err?.message || err) });
    }
  }
);

// ----- NEW: listLeads endpoint (server reads, secured) -----
export const listLeads = onRequest(
  { region: "us-central1", secrets: [GMAIL_WEBHOOK_SECRET], timeoutSeconds: 30, maxInstances: 10 },
  async (req, res) => {
    const provided = (req.header("x-webhook-secret") || "").trim();
    const expected = (process.env.GMAIL_WEBHOOK_SECRET || "").trim();
    if (!expected || provided !== expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const { db } = ensureAdmin();
      const limit = Math.min(parseInt(String(req.query.limit || "25"), 10) || 25, 100);
      const since = req.query.since ? new Date(String(req.query.since)) : null;

      let q = db.collection("leads_v2").orderBy("receivedAt", "desc").limit(limit);
      if (since && !isNaN(since.getTime())) {
        // Note: querying by serverTimestamp requires it to be materialized,
        // so we filter post-query as a simple fallback.
        const snap = await q.get();
        const items = [];
        snap.forEach(doc => {
          const d = doc.data();
          const ts = d.receivedAt?.toDate?.() || d.receivedAt;
          if (!since || (ts && ts > since)) {
            items.push({
              id: doc.id,
              receivedAt: ts ? ts.toISOString() : null,
              subject: d.subject || null,
              vehicle: d.vehicle || null,
              customer: d.customer || null,
              source: d.source || null
            });
          }
        });
        return res.json({ ok: true, items });
      } else {
        const snap = await q.get();
        const items = [];
        snap.forEach(doc => {
          const d = doc.data();
          const ts = d.receivedAt?.toDate?.() || d.receivedAt;
          items.push({
            id: doc.id,
            receivedAt: ts ? ts.toISOString() : null,
            subject: d.subject || null,
            vehicle: d.vehicle || null,
            customer: d.customer || null,
            source: d.source || null
          });
        });
        return res.json({ ok: true, items });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  }
);

// AI reply stub unchanged
export const generateAIReply = onRequest(
  { region: "us-central1", secrets: [OPENAI_API_KEY], timeoutSeconds: 60 },
  async (_req, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });
    return res.json({ ok: true, msg: "AI reply generator is wired." });
  }
);

