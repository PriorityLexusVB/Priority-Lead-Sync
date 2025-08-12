// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getEnv: (key) => (key === 'OPENAI_API_KEY' ? null : process.env[key] || null),
  generateAIReply: (lead) => ipcRenderer.invoke('generate-ai-reply', lead),
});
