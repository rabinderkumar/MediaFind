const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const PORT = process.env.MEDIAFIND_PORT || 3000;
const isDev = !app.isPackaged;

// Where the built frontend (dist/) and bundled node_modules live.
// In dev this is the project root; in a packaged app (asar disabled) electron-builder
// puts it at resources/app.
const APP_ROOT = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app');

// Writable per-user folder for the local JSON "database", photo uploads, and thumbnails.
const DATA_DIR = path.join(app.getPath('userData'), 'data');

// Small local config file (currently just holds the Gemini API key).
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

let mainWindow = null;
let settingsWindow = null;
let serverStarted = false;

function startServer() {
  if (serverStarted) return;
  serverStarted = true;

  const config = loadConfig();

  fs.mkdirSync(DATA_DIR, { recursive: true });

  process.env.NODE_ENV = 'production';
  process.env.PORT = String(PORT);
  process.env.MEDIAFIND_APP_ROOT = APP_ROOT;
  process.env.MEDIAFIND_DATA_DIR = DATA_DIR;
  if (config.geminiApiKey) {
    process.env.GEMINI_API_KEY = config.geminiApiKey;
  }

  // Loads and starts the bundled Express server (dist/server.cjs) inside this
  // same Node process — no need to spawn a separate node child process.
  require(path.join(APP_ROOT, 'dist', 'server.cjs'));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'MediaFind',
    backgroundColor: '#111827',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Open any target="_blank" / window.open links in the OS browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 260,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'MediaFind Settings',
    parent: mainWindow || undefined,
    modal: !!mainWindow,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

ipcMain.handle('get-api-key', () => {
  const config = loadConfig();
  return config.geminiApiKey || '';
});

ipcMain.handle('set-api-key', async (event, key) => {
  const config = loadConfig();
  config.geminiApiKey = key || '';
  saveConfig(config);

  const { response } = await dialog.showMessageBox(settingsWindow, {
    type: 'question',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    message: 'API key saved.',
    detail: 'MediaFind needs to restart to apply the new Gemini API key.',
  });

  if (response === 0) {
    app.relaunch();
    app.exit(0);
  }
  return true;
});

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { label: 'Settings…', accelerator: 'Cmd+,', click: openSettingsWindow },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        ...(process.platform !== 'darwin'
          ? [{ label: 'Settings…', click: openSettingsWindow }, { type: 'separator' }]
          : []),
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();

  if (isDev) {
    // In dev, run `npm run dev` in a separate terminal first — this just opens
    // a window pointing at the Vite/Express dev server it starts.
    createMainWindow();
  } else {
    startServer();
    createMainWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
