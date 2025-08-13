// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getEnv: (key) => process.env[key] || null,
  fetchAIReply: (lead) => ipcRenderer.invoke('fetch-ai-reply', lead),
});
