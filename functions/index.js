import * as functions from "firebase-functions"; // v1 API
import * as admin from "firebase-admin";
import { parseStringPromise } from "xml2js";
import crypto from "crypto";

/**
 * Spark mode:
 * - No Secret Manager; read from process.env (bundled by Firebase CLI .env support).
 * - Bind Firestore Admin to the EXISTING named DB "leads" (do NOT touch default).
 */
const SPARK_ONLY = process.env.SPARK_ONLY === "1";
const ENV = {
  GMAIL_WEBHOOK_SECRET: (process.env.GMAIL_WEBHOOK_SECRET || "").trim(),
  OPENAI_API_KEY: (process.env.OPENAI_API_KEY || "").trim(), // optional
};

// --- Admin init: project + named DB "leads"
let _app;
let _db;
function ensureAdmin() {
  if (!_app) {
    _app = admin.initializeApp({ projectId: "priority-lead-sync" });
    _db = admin.firestore(_app);
    _db.settings({ databaseId: "leads" }); // <- IMPORTANT
  }
  return { app: _app, db: _db };
}

// ---------- health ----------
export const health = functions
  .region("us-central1")
  .https.onRequest((_req, res) => {
    res.status(200).json({ ok: true, node: process.version, at: new Date().toISOString(), gen: "v1" });
  });

// ---------- testSecrets (Spark: just env checks) ----------
export const testSecrets = functions
  .region("us-central1")
  .https.onRequest((_req, res) => {
    res.json({
      ok: Boolean(ENV.GMAIL_WEBHOOK_SECRET || ENV.OPENAI_API_KEY),
      checks: {
        GMAIL_WEBHOOK_SECRET: !!ENV.GMAIL_WEBHOOK_SECRET,
        OPENAI_API_KEY: !!ENV.OPENAI_API_KEY,
      },
      mode: SPARK_ONLY ? "spark" : "blaze",
      at: new Date().toISOString(),
    });
  });

// ---------- firestoreHealth (writes _health/probe in 'leads') ----------
export const firestoreHealth = functions
  .region("us-central1")
  .https.onRequest(async (_req, res) => {
    try {
      const { db } = ensureAdmin();
      const ref = db.collection("_health").doc("probe");
      await ref.set(
        {
          ping: admin.firestore.FieldValue.serverTimestamp(),
          node: process.version,
          projectId: "priority-lead-sync",
          databaseId: "leads",
          gen: "v1",
        },
        { merge: true }
      );
      const snap = await ref.get();
      res.json({ ok: true, data: snap.data() || null });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

// ---------- gmailHealth (stub) ----------
export const gmailHealth = functions
  .region("us-central1")
  .https.onRequest(async (_req, res) => {
    res.json({ ok: true, note: "gmailHealth is stubbed for Spark mode", gen: "v1" });
  });

// ---------- receiveEmailLead (JSON or ADF/XML) ----------
export const receiveEmailLead = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    // cheap auth
    const provided = (req.header("x-webhook-secret") || "").trim();
    const expected = ENV.GMAIL_WEBHOOK_SECRET;
    if (!expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized: secret not configured." });
    }
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const { db } = ensureAdmin();
      const ct = (req.headers["content-type"] || "").toLowerCase();
      let lead;

      if (ct.includes("application/json")) {
        lead = { ...req.body, source: req.body?.source || "webhook", format: "json" };
      } else {
        const xml = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.rawBody || "");
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
          subject: p?.vehicle?.interest || undefined,
        };
      }

      lead.receivedAt = admin.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection("leads_v2").add(lead);
      return res.status(200).json({ ok: true, id: ref.id });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ ok: false, error: "Bad request: " + String(err?.message || err) });
    }
  });

// ---------- listLeads (CORS, read-only) ----------
export const listLeads = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
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
      if (since && !isNaN(since.getTime())) q = q.where("receivedAt", ">", since);
      q = q.limit(limitParam);

      const snap = await q.get();
      const items = snap.docs.map((doc) => {
        const d = doc.data();
        const ts =
          typeof d.receivedAt?.toDate === "function"
            ? d.receivedAt.toDate()
            : (d.receivedAt && new Date(d.receivedAt)) || null;
        return {
          id: doc.id,
          receivedAt: ts ? ts.toISOString() : null,
          subject: d.subject || null,
          vehicle: d.vehicle || null,
          customer: d.customer || null,
          source: d.source || null,
        };
      });

      return res.json({ ok: true, items });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

// ---------- AI stub ----------
export const generateAIReply = functions
  .region("us-central1")
  .https.onRequest(async (_req, res) => {
    if (!ENV.OPENAI_API_KEY) {
      return res.status(200).json({ ok: true, stub: true, note: "No OPENAI_API_KEY set; Spark-safe stub.", gen: "v1" });
    }
    return res.json({ ok: true, note: "OPENAI_API_KEY present. Add outbound call if on Blaze.", gen: "v1" });
  });

