// electron-app/main.js
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEV_URL = (process.env.VITE_DEV_SERVER_URL || '').trim();
const IS_DEV = !!DEV_URL;

console.log('[main] VITE_DEV_SERVER_URL =', DEV_URL || '(not set)');
console.log('[main] IS_DEV =', IS_DEV);

async function resolvePreload() {
  const preloadPath = path.join(__dirname, 'dist', 'main', 'preload.cjs');

  if (fs.existsSync(preloadPath)) return preloadPath;

  if (!IS_DEV) {
    console.warn('[main] Preload not found at', preloadPath);
    return preloadPath;
  }

  console.log('[main] Waiting for preload build…');
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (fs.existsSync(preloadPath)) return preloadPath;
  }

  console.warn('[main] Preload still missing after waiting →', preloadPath);
  return preloadPath;
}

async function createWindow() {
  const preloadPath = await resolvePreload();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // must be false so preload has Node built-ins
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
