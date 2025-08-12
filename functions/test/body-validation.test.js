const assert = require('assert');

process.env.GMAIL_WEBHOOK_SECRET = 'expected-secret';
const { receiveEmailLead } = require('../index.js');

const run = async (body) => {
  let statusCode;
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
  await receiveEmailLead(req, res);
  return statusCode;
};

(async () => {
  const empty = await run('');
  assert.strictEqual(empty, 400, 'should reject empty string body');

  const notString = await run({});
  assert.strictEqual(notString, 400, 'should reject non-string body');

  console.log('Body validation tests passed');
})();
