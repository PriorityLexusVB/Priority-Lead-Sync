const assert = require('assert');

let addedDoc;
const adminStub = {
  initializeApp: () => {},
  firestore: () => ({
    collection: () => ({
      add: (doc) => {
        addedDoc = doc;
        return Promise.resolve();
      },
    }),
  }),
};
adminStub.firestore.FieldValue = { serverTimestamp: () => 'ts' };
require.cache[require.resolve('firebase-admin')] = { exports: adminStub };

process.env.GMAIL_WEBHOOK_SECRET = 'expected-secret';
const { receiveEmailLeadHandler } = require('../index.js');

const run = async (body) => {
  let statusCode;
  addedDoc = null;
  const req = {
    headers: { 'x-webhook-secret': 'expected-secret' },
    body,
    get: () => null,
  };
  const res = {
    status: (code) => {
      statusCode = code;
      return { send: () => {} };
    },
  };
  await receiveEmailLeadHandler(req, res);
  return statusCode;
};

(async () => {
  const validAdf = `<adf>\n  <prospect>\n    <customer>\n      <contact>\n        <name part="first">Jane</name>\n        <name part="last">Doe</name>\n        <email>jane@example.com</email>\n        <phone>555-1234</phone>\n      </contact>\n    </customer>\n  </prospect>\n</adf>`;

  const successStatus = await run(validAdf);
  assert.strictEqual(successStatus, 200, 'should accept valid ADF body');
  assert.strictEqual(addedDoc.first_name, 'Jane');
  assert.strictEqual(addedDoc.last_name, 'Doe');
  assert.strictEqual(addedDoc.phone, '555-1234');
  assert.strictEqual(addedDoc.email, 'jane@example.com');

  const malformedStatus = await run('Just some text');
  assert.strictEqual(malformedStatus, 400, 'should reject malformed body');
  assert.strictEqual(addedDoc, null, 'document should not be written');

  console.log('ADF parsing tests passed');
})();
