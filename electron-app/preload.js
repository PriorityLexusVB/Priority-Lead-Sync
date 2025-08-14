// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getEnv: (key) => process.env[key] || null,
  requestAIReply: (lead) => ipcRenderer.invoke('request-ai-reply', lead),
});
