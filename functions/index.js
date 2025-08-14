const express = require('express');
const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const OpenAI = require('openai');
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
  if (!adf) {
    return res.status(400).send('Invalid ADF body');
  }

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
  { region: 'us-central1', secrets: [GMAIL_WEBHOOK_SECRET] },
  app
);

const aiApp = express();
aiApp.use(express.json());

const generateAIReplyHandler = async (req, res) => {
  const lead = req.body;
  if (!lead || typeof lead !== 'object') {
    return res.status(400).send('Invalid body');
  }

  const prompt = lead.comments
    ? `Customer wrote: "${lead.comments}". Craft a helpful, concise reply to book an appointment at our Lexus dealership.`
    : `Generate a compelling message to follow up with a customer interested in a ${lead.vehicle}. Include dealership name and suggest a time to come in.`;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).send('AI generation failed');
  }
};

aiApp.post('/', generateAIReplyHandler);

exports.generateAIReply = onRequest(
  { region: 'us-central1', secrets: [OPENAI_API_KEY] },
  aiApp
);
