// electron-app/main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
  const devUrl = process.env.VITE_DEV_SERVER_URL; // e.g. http://localhost:5173

  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'dist', 'main', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && devUrl) {
    console.log('[main] DEV ->', devUrl);
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexFile = path.join(__dirname, 'dist', 'renderer', 'index.html');
    console.log('[main] PROD ->', indexFile);
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

