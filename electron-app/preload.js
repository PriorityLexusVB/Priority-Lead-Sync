// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Only expose explicitly allowed Firebase config variables to the renderer.
// This frozen list ensures runtime code cannot add more keys.
// Any key not in this list returns null to prevent leaking secrets.
const FIREBASE_ENV_ALLOW_LIST = Object.freeze([
  'APP_FIREBASE_API_KEY',
  'APP_FIREBASE_AUTH_DOMAIN',
  'APP_FIREBASE_PROJECT_ID',
  'APP_FIREBASE_STORAGE_BUCKET',
  'APP_FIREBASE_MESSAGING_SENDER_ID',
  'APP_FIREBASE_APP_ID',
]);

// Helper to safely read only whitelisted keys from the environment
const getEnv = (key) =>
  FIREBASE_ENV_ALLOW_LIST.includes(key) ? process.env[key] ?? null : null;

contextBridge.exposeInMainWorld('electronAPI', {
  getEnv,
  requestAIReply: (lead) => ipcRenderer.invoke('request-ai-reply', lead),
});
