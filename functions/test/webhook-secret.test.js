const assert = require('assert');
const { createReceiveEmailLeadHandler } = require('../index.js');

const receiveEmailLead = createReceiveEmailLeadHandler({
  value: () => 'expected-secret',
});

const run = async (headers) => {
  let statusCode;
  const res = {
    status: (code) => {
      statusCode = code;
      return { send: () => {} };
    },
  };
  await receiveEmailLead({ headers }, res);
  return statusCode;
};

(async () => {
  const missing = await run({});
  assert.strictEqual(missing, 401, 'should reject when secret missing');

  const wrong = await run({ 'x-webhook-secret': 'wrong' });
  assert.strictEqual(wrong, 401, 'should reject when secret mismatched');

  console.log('Webhook secret tests passed');
})();
