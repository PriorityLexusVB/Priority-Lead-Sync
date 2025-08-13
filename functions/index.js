const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { parseAdfEmail, extractLeadFromContact } = require('./adfEmailHandler');

admin.initializeApp();

exports.helloWorld = onRequest((request, response) => {
  logger.info('Hello logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});

exports.receiveEmailLead = async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.GMAIL_WEBHOOK_SECRET) {
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
