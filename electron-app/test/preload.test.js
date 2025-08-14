const assert = require('assert');
const Module = require('module');

// Stub the electron module to capture the exposed API
let exposedApi;
const electronMock = {
  contextBridge: {
    exposeInMainWorld: (_name, api) => {
      exposedApi = api;
    },
  },
  ipcRenderer: {
    invoke: () => {},
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron') {
    return electronMock;
  }
  return originalLoad(request, parent, isMain);
};

// Set up environment variables
process.env.APP_FIREBASE_API_KEY = 'allowed-value';
process.env.SECRET_API_KEY = 'top-secret';

// Require the preload script which will populate exposedApi
require('../preload.js');

// Restore original Module loader
Module._load = originalLoad;

assert.strictEqual(
  exposedApi.getEnv('APP_FIREBASE_API_KEY'),
  'allowed-value',
  'Allowed env vars should return their value'
);
assert.strictEqual(
  exposedApi.getEnv('SECRET_API_KEY'),
  null,
  'Disallowed env vars should return null'
);

console.log('preload.js getEnv tests passed');
