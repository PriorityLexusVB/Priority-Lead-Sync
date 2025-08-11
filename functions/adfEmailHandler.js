const { ImapFlow } = require('imapflow');
const { XMLParser } = require('fast-xml-parser');
const admin = require('firebase-admin');

const parser = new XMLParser({ ignoreAttributes: false });

async function pollAdfInbox() {
  const client = new ImapFlow({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 993),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await client.connect();

  try {
    await client.mailboxOpen(process.env.EMAIL_BOX || 'INBOX');

    // Fetch unseen messages
    for await (const msg of client.fetch('UNSEEN', { source: true })) {
      const raw = msg.source.toString();
      const start = raw.indexOf('<adf');
      const end = raw.indexOf('</adf>');
      if (start === -1 || end === -1) {
        // Not an ADF email; mark seen and continue
        await client.messageFlagsAdd(msg.uid, ['\\Seen']);
        continue;
      }

      const xml = raw.substring(start, end + 6);
      let payload;
      try {
        const json = parser.parse(xml);
        const prospect = json.adf.prospect || {};
        const customer = prospect.customer || {};
        const contact = customer.contact || {};
        const name = contact.name || {};

        payload = {
          first_name: name.first || 'Missing',
          last_name: name.last || 'Missing',
          phone: contact.phone?._ || contact.phone || 'Missing',
          email: contact.email || 'Missing',
          comments: prospect.comments || '',
          vehicle: prospect.vehicle?.description || '',
          trade: prospect.trade_in?.description || '',
          receivedAt: new Date().toISOString()
        };
      } catch (err) {
        console.error('Failed to parse ADF XML', err);
        await client.messageFlagsAdd(msg.uid, ['\\Seen']);
        continue;
      }

      try {
        await admin.firestore().collection('leads').add(payload);
        console.log('Lead stored:', payload.email);
      } catch (err) {
        console.error('Failed to store lead', err);
      }

      // Mark message as processed
      await client.messageFlagsAdd(msg.uid, ['\\Seen']);
    }
  } finally {
    await client.logout();
  }
}

module.exports = {
  pollAdfInbox
};
