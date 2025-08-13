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
  assert.strictEqual(addedDoc.firstName, 'Jane');
  assert.strictEqual(addedDoc.lastName, 'Doe');
  assert.strictEqual(addedDoc.phone, '555-1234');
  assert.strictEqual(addedDoc.email, 'jane@example.com');

  const fallbackStatus = await run('Just some text');
  assert.strictEqual(fallbackStatus, 200, 'should accept plain text');
  assert.ok(addedDoc, 'document should be written');
  assert.strictEqual(addedDoc.firstName, undefined);
  assert.strictEqual(addedDoc.lastName, undefined);
  assert.strictEqual(addedDoc.phone, undefined);
  assert.strictEqual(addedDoc.email, undefined);

  console.log('ADF parsing tests passed');
})();
