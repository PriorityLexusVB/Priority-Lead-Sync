const assert = require('assert');

// Stub OpenAI to avoid network calls and capture usage
let constructorKey;
let capturedPrompt;
class OpenAIStub {
  constructor(opts) {
    constructorKey = opts.apiKey;
  }
  chat = {
    completions: {
      create: async (opts) => {
        capturedPrompt = opts.messages[0].content;
        return { choices: [{ message: { content: 'Test reply' } }] };
      },
    },
  };
}
require.cache[require.resolve('openai')] = { exports: OpenAIStub };

process.env.OPENAI_API_KEY = 'server-secret';
const { generateAIReplyHandler } = require('../index.js');

(async () => {
  let jsonResponse;
  const req = { body: { comments: 'Hello' } };
  const res = {
    json: (data) => {
      jsonResponse = data;
    },
    status: (code) => ({ send: () => { throw new Error('Unexpected error ' + code); } }),
  };

  await generateAIReplyHandler(req, res);

  assert.strictEqual(constructorKey, 'server-secret', 'should use server-side API key');
  assert.ok(capturedPrompt.includes('Hello'), 'prompt should include lead comments');
  assert.deepStrictEqual(jsonResponse, { reply: 'Test reply' });

  console.log('generateAIReply tests passed');
})();
