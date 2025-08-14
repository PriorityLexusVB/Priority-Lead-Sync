const assert = require('assert');
const Module = require('module');

// Backup globals
const originalLoad = Module._load;
const originalEnv = { ...process.env };

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

try {
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return electronMock;
    }
    return originalLoad(request, parent, isMain);
  };

  // Set up environment variables
  process.env.APP_FIREBASE_API_KEY = 'allowed-value';
  process.env.SECRET_API_KEY = 'top-secret';

  // Require the preload script which will populate exposedApi
  const preloadPath = require.resolve('../preload.js');
  require(preloadPath);

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
} finally {
  // Restore original Module loader and environment
  Module._load = originalLoad;
  const preloadPath = require.resolve('../preload.js');
  delete require.cache[preloadPath];
  Object.keys(process.env).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(originalEnv, key)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, originalEnv);
}
