const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Debug tooling is enabled in development by default and disabled in packaged apps.
// You can override in development with: ELECTRON_DEBUG_TOOLS=0
const isDebugToolsEnabled = !app.isPackaged && process.env.ELECTRON_DEBUG_TOOLS !== '0';

function attachDebugShortcuts(win) {
  if (!isDebugToolsEnabled) return;

  win.webContents.on('before-input-event', (event, input) => {
    const key = String(input.key || '').toLowerCase();
    const isToggleDevTools =
      (input.control || input.meta) &&
      input.shift &&
      key === 'i' &&
      input.type === 'keyDown';
    const isReload = (input.control || input.meta) && key === 'r' && input.type === 'keyDown';

    if (isToggleDevTools) {
      event.preventDefault();
      win.webContents.toggleDevTools();
    }

    if (isReload) {
      event.preventDefault();
      win.webContents.reloadIgnoringCache();
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: path.join(__dirname, '../public/logo.jpg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (!app.isPackaged) {
    // Dev mode: load Vite server
    win.loadURL('http://localhost:5173');
  } else {
    // Production mode: load the built React app
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  attachDebugShortcuts(win);

  if (isDebugToolsEnabled) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

