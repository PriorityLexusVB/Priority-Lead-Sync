// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Only expose explicitly allowed Firebase config variables to the renderer.
// Any key not in this list returns null to prevent leaking secrets.
const ALLOWED_ENV_KEYS = new Set([
  'APP_FIREBASE_API_KEY',
  'APP_FIREBASE_AUTH_DOMAIN',
  'APP_FIREBASE_PROJECT_ID',
  'APP_FIREBASE_STORAGE_BUCKET',
  'APP_FIREBASE_MESSAGING_SENDER_ID',
  'APP_FIREBASE_APP_ID',
]);

const getEnv = (key) => {
  if (ALLOWED_ENV_KEYS.has(key)) {
    return process.env[key] || null;
  }
  return null;
};

contextBridge.exposeInMainWorld('electronAPI', {
  getEnv,
  requestAIReply: (lead) => ipcRenderer.invoke('request-ai-reply', lead),
});
