// electron-app/main.js
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const DEV_URL = (process.env.VITE_DEV_SERVER_URL || '').trim();
const IS_DEV = !!DEV_URL;

console.log('[main] VITE_DEV_SERVER_URL =', DEV_URL || '(not set)');
console.log('[main] IS_DEV =', IS_DEV);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'dist', 'main', 'preload.cjs'),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const load = async () => {
    try {
      if (IS_DEV) {
        console.log('[main] Loading renderer from dev server →', DEV_URL);
        await win.loadURL(DEV_URL);
        win.webContents.openDevTools({ mode: 'detach' });
      } else {
        const indexPath = path.join(__dirname, 'dist', 'renderer', 'index.html');
        console.log('[main] Loading packaged renderer →', indexPath);
        await win.loadFile(indexPath);
      }
    } catch (e) {
      console.error('[main] Failed to load renderer:', e);
      const message = `
        <html><body>
          <h2>Renderer failed to load</h2>
          <pre>${String(e)}</pre>
          <p>IS_DEV=${IS_DEV}, DEV_URL=${DEV_URL || '(not set)'}</p>
        </body></html>`;
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(message));
    }
  };

  load();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
