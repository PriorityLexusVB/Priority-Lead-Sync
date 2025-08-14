const assert = require('assert');
const request = require('supertest');
const express = require('express');

// Set dummy API key before loading the app
process.env.OPENAI_API_KEY = 'test-key';

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

const aiApp = express();
aiApp.use(express.json());
aiApp.post('/', generateAIReplyHandler);

(async () => {
  const res = await request(aiApp)
    .post('/')
    .send({ comments: 'Hello from lead' })
    .expect(200);

  assert.strictEqual(constructorKey, 'test-key', 'should use the dummy API key');
  assert.ok(capturedPrompt.includes('Hello from lead'), 'prompt should include lead comments');
  assert.deepStrictEqual(res.body, { reply: 'Test reply' });

  console.log('generateAIReply tests passed');
})();
