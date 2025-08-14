const assert = require('assert');

// Backup global state before modification
const originalFetch = global.fetch;
const originalElectronCache = require.cache[require.resolve('electron')];
const originalEnv = { ...process.env };

// Stub Electron modules to capture IPC handler
let registeredHandler;
const ipcMainStub = {
  handle: (channel, handler) => {
    if (channel === 'request-ai-reply') {
      registeredHandler = handler;
    }
  },
};
const electronStub = {
  ipcMain: ipcMainStub,
  app: {
    whenReady: () => Promise.resolve(),
    setLoginItemSettings: () => {},
    on: () => {},
  },
  BrowserWindow: function () {
    return { loadFile: () => {}, webContents: {}, on: () => {} };
  },
  Tray: function () {
    this.setToolTip = () => {};
    this.setContextMenu = () => {};
    this.on = () => {};
  },
  Menu: { buildFromTemplate: () => ({}) },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
};
require.cache[require.resolve('electron')] = { exports: electronStub };

process.env.APP_FIREBASE_API_KEY = 'x';
process.env.APP_FIREBASE_AUTH_DOMAIN = 'x';
process.env.APP_FIREBASE_PROJECT_ID = 'proj';
process.env.APP_FIREBASE_STORAGE_BUCKET = 'x';
process.env.APP_FIREBASE_MESSAGING_SENDER_ID = 'x';
process.env.APP_FIREBASE_APP_ID = 'x';

let fetchArgs;
global.fetch = async (url, options) => {
  fetchArgs = { url, options };
  return { ok: true, json: async () => ({ reply: 'Hi there' }) };
};

// Require main.js after stubbing
require('../main.js');

(async () => {
  try {
    const lead = { comments: 'Interested' };
    const result = await registeredHandler(null, lead);
    assert.strictEqual(
      fetchArgs.url,
      'https://us-central1-proj.cloudfunctions.net/generateAIReply'
    );
    assert.strictEqual(fetchArgs.options.method, 'POST');
    assert.deepStrictEqual(JSON.parse(fetchArgs.options.body), lead);
    assert.strictEqual(result, 'Hi there');
    console.log('IPC handler test passed');
  } finally {
    // Restore global state
    global.fetch = originalFetch;
    if (originalElectronCache) {
      require.cache[require.resolve('electron')] = originalElectronCache;
    } else {
      delete require.cache[require.resolve('electron')];
    }
    Object.keys(process.env).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(originalEnv, key)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  }
})();
