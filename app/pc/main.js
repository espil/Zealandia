'use strict';
/* Espil Online: A to Zealandia - PC shell (Electron).
   Wraps the same app payload (www) the phone app ships. All game logic
   lives in the payload; this shell only serves it locally and hosts it
   in a desktop window. */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('./server');

if (process.env.ESPIL_PC_SOFTWARE_GL) {
  app.commandLine.appendSwitch('use-gl', 'angle');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function payloadDir() {
  const packaged = path.join(process.resourcesPath || '', 'www', 'index.html');
  if (app.isPackaged && fs.existsSync(packaged)) return path.join(process.resourcesPath, 'www');
  return path.join(__dirname, '..', 'www');
}

async function createWindow() {
  const { port } = await startServer(payloadDir());
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 540,
    title: 'Espil Online: A to Zealandia',
    backgroundColor: '#04070c',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith('http://127.0.0.1')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('did-finish-load', () => console.log('[pc] loaded', win.webContents.getURL()));
  win.webContents.on('did-fail-load', (e, code, desc) => console.log('[pc] load failed', code, desc));
  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
