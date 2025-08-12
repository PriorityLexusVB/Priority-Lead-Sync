process.env.GMAIL_WEBHOOK_SECRET = 'expected-secret';
const admin = require('firebase-admin');
const { receiveEmailLead } = require('../index.js');

afterAll(async () => {
  await admin.app().delete();
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

describe('receiveEmailLead webhook secret', () => {
  test('rejects when secret missing', async () => {
    const missing = await run({});
    expect(missing).toBe(401);
  });

  test('rejects when secret mismatched', async () => {
    const wrong = await run({ 'x-webhook-secret': 'wrong' });
    expect(wrong).toBe(401);
  });
});
