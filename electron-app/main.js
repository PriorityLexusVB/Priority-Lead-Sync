// electron-app/main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const isDev = Boolean(devUrl);

  console.log('[main] VITE_DEV_SERVER_URL =', devUrl || '(none)');
  console.log('[main] mode =', isDev ? 'DEV' : 'PROD');

  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'dist', 'main', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    console.log('[main] Loading dev URL ->', devUrl);
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexFile = path.join(__dirname, 'dist', 'renderer', 'index.html');
    console.log('[main] Loading prod file ->', indexFile);
    win.loadFile(indexFile);
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

