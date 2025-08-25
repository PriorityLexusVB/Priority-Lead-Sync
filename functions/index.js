import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import crypto from "crypto";
import { parseStringPromise } from "xml2js";

/**
 * Spark mode:
 * - If SPARK_ONLY=1, we DO NOT depend on Secret Manager and read directly from process.env.
 * - Keep Firestore bound to the existing named database "leads" so we don't create default DB.
 */
const SPARK_ONLY = process.env.SPARK_ONLY === "1";

/** Env values (always read from process.env in Spark mode) */
const ENV = {
  GMAIL_WEBHOOK_SECRET: process.env.GMAIL_WEBHOOK_SECRET || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
};

/** Admin init – bind to project + named DB "leads" */
let app;
let db;
function ensureAdmin() {
  if (!app) {
    app = admin.initializeApp({
      projectId: "priority-lead-sync",
    });
    db = admin.firestore(app);
    db.settings({ databaseId: "leads" }); // <— IMPORTANT: use existing named DB
  }
  return { app, db };
}

/** Health */
export const health = onRequest({ region: "us-central1" }, (_req, res) => {
  res.status(200).json({ ok: true, node: process.version, at: new Date().toISOString() });
});

/** Verify "secrets" (in Spark we just check envs — nothing hits Secret Manager) */
export const testSecrets = onRequest({ region: "us-central1" }, (_req, res) => {
  res.json({
    ok: Boolean(ENV.GMAIL_WEBHOOK_SECRET || ENV.OPENAI_API_KEY),
    checks: {
      GMAIL_WEBHOOK_SECRET: Boolean(ENV.GMAIL_WEBHOOK_SECRET),
      OPENAI_API_KEY: Boolean(ENV.OPENAI_API_KEY),
    },
    at: new Date().toISOString(),
    mode: SPARK_ONLY ? "spark" : "blaze",
  });
});

/** Firestore health – read/write a probe doc in DB "leads" */
export const firestoreHealth = onRequest({ region: "us-central1" }, async (_req, res) => {
  try {
    const { db } = ensureAdmin();
    const ref = db.collection("_health").doc("probe");
    await ref.set(
      {
        ping: admin.firestore.FieldValue.serverTimestamp(),
        node: process.version,
        projectId: "priority-lead-sync",
        databaseId: "leads",
      },
      { merge: true }
    );
    const snap = await ref.get();
    res.json({ ok: true, data: snap.data() || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/** Gmail health (stubbed – no OAuth work in Spark) */
export const gmailHealth = onRequest({ region: "us-central1" }, async (_req, res) => {
  res.json({ ok: true, note: "gmailHealth is stubbed for Spark mode" });
});

/**
 * receiveEmailLead
 * Auth via x-webhook-secret; accepts JSON or ADF/XML; writes to Firestore (leads_v2)
 */
export const receiveEmailLead = onRequest(
  { region: "us-central1", timeoutSeconds: 30, maxInstances: 10 },
  async (req, res) => {
    // cheap auth with timing-safe comparison
    const provided = (req.header("x-webhook-secret") || "").trim();
    const expected = (ENV.GMAIL_WEBHOOK_SECRET || "").trim();
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
        // ADF/XML path
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
  }
);

/**
 * listLeads – HTTPS GET, CORS enabled, read-only list for Electron polling
 * Query params:
 *   - limit=1..100 (default 50)
 *   - since=ISO date string (optional)
 */
export const listLeads = onRequest({ region: "us-central1", timeoutSeconds: 30 }, async (req, res) => {
  try {
    // CORS for Electron (file:// origin → 'null'), so keep permissive
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();

    const { db } = ensureAdmin();

    const limitQuery = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitParam = Math.max(1, Math.min(100, parseInt(String(limitQuery || "50"), 10)));
    const sinceQuery = Array.isArray(req.query.since) ? req.query.since[0] : req.query.since;
    const sinceParam = String(sinceQuery || "").trim();
    const since = sinceParam ? new Date(sinceParam) : null;

    let q = db.collection("leads_v2").orderBy("receivedAt", "desc");
    if (since && !isNaN(since.getTime())) {
      q = q.where("receivedAt", ">", since);
    }
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

/** AI stub – don’t break if key missing; you can wire fetch→openai later */
export const generateAIReply = onRequest({ region: "us-central1", timeoutSeconds: 60 }, async (_req, res) => {
  if (!ENV.OPENAI_API_KEY) {
    return res.status(200).json({ ok: true, stub: true, note: "No OPENAI_API_KEY set; Spark-safe stub." });
  }
  // (Optional) In Blaze you can call OpenAI here. In Spark, outbound might be limited.
  return res.json({ ok: true, note: "OPENAI_API_KEY present. Add outbound call if on Blaze." });
});
