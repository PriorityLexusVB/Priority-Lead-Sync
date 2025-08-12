const assert = require('assert');
const { createReceiveEmailLeadHandler } = require('../index.js');

const receiveEmailLead = createReceiveEmailLeadHandler({
  value: () => 'expected-secret',
});

const run = async (body) => {
  let statusCode;
  const headers = { 'x-webhook-secret': 'expected-secret' };
  const req = {
    headers,
    body,
    get: (name) => headers[name.toLowerCase()] || null,
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

  console.log('Body validation tests passed');
})();
