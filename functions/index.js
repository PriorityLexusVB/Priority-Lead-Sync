// index.js (Gen-2, v2 API, CommonJS)

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { parseStringPromise } = require("xml2js");

// No global CPU settings here — avoids the Gen1 CPU error entirely
// (If you ever want min/max instances etc., do it per-function in the onRequest options)

// Spark mode & env
const SPARK_ONLY = process.env.SPARK_ONLY === "1";
const ENV = {
  GMAIL_WEBHOOK_SECRET: process.env.GMAIL_WEBHOOK_SECRET || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
};

// Admin init — bind to project + named DB 'leads'
let _app;
let _db;
function ensureAdmin() {
  if (!_app) {
    _app = admin.initializeApp({ projectId: "priority-lead-sync" });
    _db = admin.firestore(_app);
    _db.settings({ databaseId: "leads" });
  }
  return { app: _app, db: _db };
}

// health
exports.health = onRequest({ invoker: "public" }, (req, res) => {
  res.status(200).json({
    ok: true,
    node: process.version,
    at: new Date().toISOString(),
    mode: SPARK_ONLY ? "spark" : "other",
  });
});

// testSecrets (reads env only in Spark mode)
exports.testSecrets = onRequest({ invoker: "public" }, (_req, res) => {
  res.json({
    ok: Boolean(ENV.GMAIL_WEBHOOK_SECRET || ENV.OPENAI_API_KEY),
    checks: {
      GMAIL_WEBHOOK_SECRET: Boolean(ENV.GMAIL_WEBHOOK_SECRET),
      OPENAI_API_KEY: Boolean(ENV.OPENAI_API_KEY),
      // keep these if you set them in your .env; harmless otherwise:
      GMAIL_CLIENT_ID: Boolean(process.env.GMAIL_CLIENT_ID),
      GMAIL_CLIENT_SECRET: Boolean(process.env.GMAIL_CLIENT_SECRET),
      GMAIL_REFRESH_TOKEN: Boolean(process.env.GMAIL_REFRESH_TOKEN),
      GMAIL_REDIRECT_URI: Boolean(process.env.GMAIL_REDIRECT_URI),
    },
    timestamp: new Date().toISOString(),
  });
});

// firestoreHealth — writes a probe doc in DB 'leads'
exports.firestoreHealth = onRequest({ invoker: "public" }, async (_req, res) => {
  try {
    const { db } = ensureAdmin();
    const ref = db.collection("_health").doc("probe");
    await ref.set(
      {
        ping: admin.firestore.FieldValue.serverTimestamp(),
        node: process.version,
        projectId: "priority-lead-sync",
        databaseId: "leads",
        ranAt: new Date().toISOString(),
      },
      { merge: true }
    );
    const snap = await ref.get();
    res.json({ ok: true, exists: snap.exists, data: snap.data() || null });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// gmailHealth (stub for Spark)
exports.gmailHealth = onRequest({ invoker: "public" }, async (_req, res) => {
  res.json({ ok: true, note: "gmailHealth is stubbed for Spark mode" });
});

// receiveEmailLead — x-webhook-secret auth; JSON or ADF/XML
exports.receiveEmailLead = onRequest({ invoker: "public" }, async (req, res) => {
  const provided = (req.header("x-webhook-secret") || "").trim();
  const expected = (ENV.GMAIL_WEBHOOK_SECRET || "").trim();
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
        subject: p?.vehicle?.interest || undefined,
      };
    }

    lead.receivedAt = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection("leads_v2").add(lead);
    return res.status(200).json({ ok: true, id: ref.id });
  } catch (err) {
    logger.error(err);
    return res.status(400).json({ ok: false, error: "Bad request: " + String(err?.message || err) });
  }
});

// listLeads — GET, CORS, read-only for Electron polling
exports.listLeads = onRequest({ invoker: "public" }, async (req, res) => {
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
    logger.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// AI stub
exports.generateAIReply = onRequest({ invoker: "public" }, async (_req, res) => {
  if (!ENV.OPENAI_API_KEY) {
    return res.status(200).json({ ok: true, stub: true, note: "No OPENAI_API_KEY set; Spark-safe stub." });
  }
  return res.json({ ok: true, note: "OPENAI_API_KEY present. Add outbound call if on Blaze." });
});
