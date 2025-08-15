import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { parseStringPromise } from "xml2js";

try { admin.initializeApp(); } catch {}

/** Runtime secrets (mounted via Google Secret Manager) */
const GMAIL_WEBHOOK_SECRET = defineSecret("GMAIL_WEBHOOK_SECRET");
const OPENAI_API_KEY       = defineSecret("OPENAI_API_KEY");

/** Health check */
export const health = onRequest({ region: "us-central1" }, (_req, res) => res.status(200).send("ok"));

/** Verify secrets are mounted (no values leaked) */
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

      lead.receivedAt = admin.firestore.FieldValue.serverTimestamp();
      await admin.firestore().collection("leads_v2").add(lead);

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, error: String(err) });
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
