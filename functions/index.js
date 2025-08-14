const express = require('express');
const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { parseAdfEmail, extractLeadFromContact } = require('./adfEmailHandler');

admin.initializeApp();

// Define secrets with firebase-functions/params.
const GMAIL_WEBHOOK_SECRET = defineSecret('GMAIL_WEBHOOK_SECRET');
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

exports.helloWorld = onRequest((request, response) => {
  logger.info('Hello logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});

const app = express();
app.use(express.text({ type: '*/*', limit: '1mb' }));

const receiveEmailLeadHandler = async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== GMAIL_WEBHOOK_SECRET.value()) {
    return res.status(401).send('Unauthorized');
  }

  const body = req.body;
  if (typeof body !== 'string' || body.trim() === '') {
    return res.status(400).send('Invalid body');
  }

  const adf = parseAdfEmail(body);
  let lead = {};
  const contact = adf?.prospect?.customer?.contact;
  if (contact) {
    lead = extractLeadFromContact(contact);
  }

  await admin.firestore().collection('leads_v2').add({
    ...lead,
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.status(200).send('OK');
};

app.post('/', receiveEmailLeadHandler);

exports.receiveEmailLeadHandler = receiveEmailLeadHandler;

exports.receiveEmailLead = onRequest(
  { region: 'us-central1', secrets: [GMAIL_WEBHOOK_SECRET, OPENAI_API_KEY] },
  app
);
