const assert = require('assert');
const request = require('supertest');

process.env.GMAIL_WEBHOOK_SECRET = 'expected-secret';
const { emailApp } = require('../index.js');

(async () => {
  const missing = await request(emailApp)
    .post('/')
    .set('Content-Type', 'text/plain')
    .send('body');
  assert.strictEqual(missing.status, 401, 'should reject when secret missing');

  const wrong = await request(emailApp)
    .post('/')
    .set('x-webhook-secret', 'wrong')
    .set('Content-Type', 'text/plain')
    .send('body');
  assert.strictEqual(wrong.status, 401, 'should reject when secret mismatched');

  console.log('Webhook secret tests passed');
})();
