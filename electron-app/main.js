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
require('dotenv').config({ path: path.join(__dirname, '.env') }); // ✅ Load .env for Firebase keys

// Ensure required environment variables are present
const REQUIRED_ENV_VARS = [
  'APP_FIREBASE_API_KEY',
  'APP_FIREBASE_AUTH_DOMAIN',
  'APP_FIREBASE_PROJECT_ID',
  'APP_FIREBASE_STORAGE_BUCKET',
  'APP_FIREBASE_MESSAGING_SENDER_ID',
  'APP_FIREBASE_APP_ID',
];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

let tray = null;
let win;

ipcMain.handle('request-ai-reply', async (_event, lead) => {
  const url = `https://us-central1-${process.env.APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/generateAIReply`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
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
