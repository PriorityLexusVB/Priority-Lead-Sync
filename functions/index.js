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
const SPARK_ONLY = process.env.SPARK_ONLY === "1";

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


// ----- listLeads: public read endpoint with CORS -----
export const listLeads = onRequest(
  { region: "us-central1", timeoutSeconds: 30 },
  async (req, res) => {
    try {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") return res.status(204).end();

      const { db } = ensureAdmin();

      const limitParam = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "50"), 10)));
      const sinceParam = String(req.query.since || "").trim();
      const since = sinceParam ? new Date(sinceParam) : null;

      let q = db.collection("leads_v2").orderBy("receivedAt", "desc");
      if (since && !isNaN(since.getTime())) {
        q = q.where("receivedAt", ">", since);
      }
      q = q.limit(limitParam);

      const snap = await q.get();
      const items = snap.docs.map((doc) => {
        const d = doc.data();
        const ts = typeof d.receivedAt?.toDate === "function"
          ? d.receivedAt.toDate()
          : (d.receivedAt && new Date(d.receivedAt)) || null;
        return {
          id: doc.id,
          receivedAt: ts ? ts.toISOString() : null,
          subject: d.subject ?? null,
          vehicle: d.vehicle ?? null,
          customer: d.customer ?? null,
          source: d.source ?? null,
        };
      });

      return res.json({ ok: true, items });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  }
);

export let receiveEmailLead;
export let testSecrets;
export let gmailHealth;
export let generateAIReply;

if (!SPARK_ONLY) {
  // ----- Webhook: receiveEmailLead (JSON or ADF/XML) -----
  receiveEmailLead = onRequest(
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

  // Verify secrets without leaking values
  testSecrets = onRequest(
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

  // Stubbed Gmail health — keep your current implementation or simple ok
  gmailHealth = onRequest(
    { region: "us-central1", secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_REDIRECT_URI] },
    async (_req, res) => {
      res.json({ ok: true, note: "gmailHealth stubbed; OAuth verified separately" });
    }
  );

  // AI reply stub unchanged
  generateAIReply = onRequest(
    { region: "us-central1", secrets: [OPENAI_API_KEY], timeoutSeconds: 60 },
    async (_req, res) => {
      if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });
      return res.json({ ok: true, msg: "AI reply generator is wired." });
    }
  );
}


