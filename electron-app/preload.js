// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  generateAIReply: (lead) => ipcRenderer.invoke('generate-ai-reply', lead),
});
