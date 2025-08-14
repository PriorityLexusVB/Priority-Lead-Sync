const assert = require('assert');
const request = require('supertest');
const express = require('express');

// Set dummy server-side API key before loading the handler
process.env.OPENAI_API_KEY = 'server-secret';

// Stub OpenAI to avoid network calls and capture usage
let constructorKey;
let capturedPrompt;
class OpenAIStub {
  constructor(opts) {
    constructorKey = opts.apiKey;
  }
  chat = {
    completions: {
      create: async ({ messages }) => {
        capturedPrompt = messages[0].content;
        return { choices: [{ message: { content: 'Test reply' } }] };
      },
    },
  };
}
require.cache[require.resolve('openai')] = { exports: OpenAIStub };

const { generateAIReplyHandler } = require('../index.js');

const run = async (body) => {
  constructorKey = undefined;
  capturedPrompt = undefined;
  let statusCode;
  let jsonResponse;
  const req = { body };
  const res = {
    json: (data) => {
      jsonResponse = data;
    },
    status: (code) => {
      statusCode = code;
      return { send: () => {} };
    },
  };
  await generateAIReplyHandler(req, res);
  return { statusCode, jsonResponse };
};

(async () => {
  // With comments
  const withComments = await run({ comments: 'Hello' });
  assert.strictEqual(constructorKey, 'server-secret', 'should use server-side API key');
  assert.ok(capturedPrompt.includes('Hello'), 'prompt should include lead comments');
  assert.deepStrictEqual(withComments.jsonResponse, { reply: 'Test reply' });

  // Without comments but with vehicle
  const noComments = await run({ vehicle: 'RX 350' });
  assert.ok(capturedPrompt.includes('RX 350'), 'prompt should mention vehicle when no comments');
  assert.deepStrictEqual(noComments.jsonResponse, { reply: 'Test reply' });

  // Invalid body
  const invalid = await run(null);
  assert.strictEqual(invalid.statusCode, 400, 'should reject malformed body');
  assert.strictEqual(invalid.jsonResponse, undefined, 'should not return JSON on error');
  assert.strictEqual(capturedPrompt, undefined, 'should not call OpenAI for invalid body');

  // Express route through Supertest
  constructorKey = undefined;
  capturedPrompt = undefined;
  const app = express();
  app.use(express.json());
  app.post('/', generateAIReplyHandler);

  const res = await request(app)
    .post('/')
    .send({ comments: 'Hello from lead' })
    .expect(200);

  assert.strictEqual(constructorKey, 'server-secret', 'should use server-side API key');
  assert.ok(capturedPrompt.includes('Hello from lead'), 'prompt should include lead comments');
  assert.deepStrictEqual(res.body, { reply: 'Test reply' });

  console.log('generateAIReply tests passed');
})();

