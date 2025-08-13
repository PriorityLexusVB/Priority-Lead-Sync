// main.js
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
} = require('electron');
const path = require('path');
require('dotenv').config(); // ✅ Load .env for Firebase keys

// Ensure required environment variables are present
const REQUIRED_ENV_VARS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

let tray = null;
let win;

ipcMain.handle('fetch-ai-reply', async (_event, lead) => {
  try {
    const url = `https://us-central1-${process.env.FIREBASE_PROJECT_ID}.cloudfunctions.net/generateAIReply`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead }),
    });

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.reply;
  } catch (error) {
    console.error('AI endpoint error:', error);
    return null;
  }
});

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Enables contextBridge
      nodeIntegration: false, // ⚠️ Stay secure
      contextIsolation: true,
    },
  });

  win.loadFile('index.html');
  // Uncomment below to show window on launch (optional)
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // ✅ Tray icon setup
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, 'icon.png')); // optional
  tray = new Tray(trayIcon.isEmpty() ? undefined : trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => win.show() },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('Priority Lead Alert');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => win.isVisible() ? win.hide() : win.show());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ✅ Ensure background behavior
app.setLoginItemSettings({
  openAtLogin: true,
  path: process.execPath,
});

app.on('window-all-closed', () => {
  // Mac usually keeps app open in tray
  if (process.platform !== 'darwin') app.quit();
});
