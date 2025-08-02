// preload.js

const { contextBridge } = require('electron');
const dotenv = require('dotenv');
dotenv.config();

contextBridge.exposeInMainWorld('electronAPI', {
  getEnv: (key) => process.env[key] || null,
});
