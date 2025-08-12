process.env.GMAIL_WEBHOOK_SECRET = 'expected-secret';
const admin = require('firebase-admin');
const { receiveEmailLead } = require('../index.js');

afterAll(async () => {
  await admin.app().delete();
});

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

describe('receiveEmailLead body validation', () => {
  test('rejects empty string body', async () => {
    const empty = await run('');
    expect(empty).toBe(400);
  });
});
