// electron-app/main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

async function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'dist', 'main', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  let targetDesc = '';
  try {
    if (devUrl && /^https?:\/\/.+/i.test(devUrl)) {
      targetDesc = `dev server → ${devUrl}`;
      console.log(`[electron] Loading renderer from ${targetDesc}`);
      await win.loadURL(devUrl);
      win.webContents.openDevTools({ mode: 'detach' });
    } else {
      const indexPath = path.join(__dirname, 'dist', 'renderer', 'index.html');
      targetDesc = `packaged file → ${indexPath}`;
      console.log(`[electron] Loading renderer from ${targetDesc}`);
      await win.loadFile(indexPath);
    }
  } catch (err) {
    console.error(`[electron] Failed to load renderer (${targetDesc})`, err);
    const msg = [
      '<h1>Lead Notifier</h1>',
      '<p>Failed to load the renderer.</p>',
      devUrl
        ? `<p><strong>VITE_DEV_SERVER_URL</strong>: ${devUrl}</p>`
        : '<p>No dev server URL; expected packaged index.html under dist/renderer/.</p>',
      `<pre style="white-space:pre-wrap">${String(err)}</pre>`
    ].join('');
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(msg));
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

