// electron-app/main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const isDev = !!process.env.VITE_DEV_SERVER_URL; // set by our dev script

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      // preload compiled by esbuild -> dist/main/preload.cjs
      preload: path.join(__dirname, 'dist', 'main', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // Vite dev server. If your index.html lives in src/renderer/, point to it explicitly.
    const url = `${process.env.VITE_DEV_SERVER_URL}/src/renderer/index.html`;
    win.loadURL(url);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Packaged build produced by `npm run build`
    win.loadFile(path.join(__dirname, 'dist', 'renderer', 'index.html'));
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
