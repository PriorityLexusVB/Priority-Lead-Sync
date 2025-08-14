const assert = require('assert');
const request = require('supertest');

process.env.GMAIL_WEBHOOK_SECRET = 'expected-secret';
const { emailApp } = require('../index.js');

(async () => {
  const ONE_MB = 1024 * 1024;
  const bigBody = 'a'.repeat(ONE_MB + 1);
  const res = await request(emailApp)
    .post('/')
    .set('x-webhook-secret', 'expected-secret')
    .set('Content-Type', 'text/plain')
    .send(bigBody);
  assert.strictEqual(res.status, 413, 'should reject oversized body');

  console.log('Oversized body test passed');
})();
