const assert = require('assert');
const express = require('express');

const app = express();
app.use(express.text({ type: '*/*', limit: '1mb' }));
app.post('/', (req, res) => {
  res.status(200).send('ok');
});

(async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const bigBody = 'a'.repeat(1024 * 1024 + 1);
  const res = await fetch(`http://127.0.0.1:${port}/`, {
    method: 'POST',
    body: bigBody,
    headers: { 'Content-Type': 'text/plain' },
  });
  assert.strictEqual(res.status, 413, 'should reject bodies over 1mb');
  console.log('Oversized body tests passed');
  server.close();
})();
