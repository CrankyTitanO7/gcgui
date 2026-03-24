const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

// Debug tooling is enabled in development by default and disabled in packaged apps.
// You can override in development with: ELECTRON_DEBUG_TOOLS=0
const isDebugToolsEnabled = !app.isPackaged && process.env.ELECTRON_DEBUG_TOOLS !== '0';

// Global variables
let win = null;
let port = null;
let parser = null;

// Import serial port modules at the top level
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Function to list available serial ports
function listSerialPorts() {
  console.log('Scanning for serial ports...');
  return SerialPort.list().then(ports => {
    console.log('Found ports:', ports);
    return ports.map(port => ({
      path: port.path,
      manufacturer: port.manufacturer || 'Unknown',
      pnpId: port.pnpId || '',
      vendorId: port.vendorId || '',
      productId: port.productId || ''
    }));
  }).catch(error => {
    console.error('Error scanning ports:', error);
    return [];
  });
}

// Function to connect to a serial port
// Function to connect to a serial port - IMPROVED VERSION
// Function to connect to a serial port - DEBUGGED VERSION
// Function to connect to a serial port - WITH ARDUINO RESET DELAY
function connectToPort(portPath) {
  console.log('========================================');
  console.log('🔌 CONNECT REQUEST:', portPath);
  console.log('========================================');

  // Close existing port if open
  if (port && port.isOpen) {
    console.log('⚠️  Closing existing port...');
    try {
      port.close();
    } catch (err) {
      console.error('Error closing port:', err);
    }
  }

  try {
    // Create new port connection with error handling
    console.log('📡 Creating SerialPort instance...');
    port = new SerialPort({
      path: portPath,
      baudRate: 115200,
      autoOpen: true
    });

    console.log('📡 SerialPort created, setting up parser...');
    parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    // Handle data reception
    parser.on('data', (line) => {
      console.log('📥 RAW DATA RECEIVED:', line);
      console.log('   Length:', line.length, 'bytes');
      console.log('   Content:', JSON.stringify(line));
      
      // Send to renderer via IPC
      if (win && win.webContents) {
        console.log('   ✅ Sending to renderer...');
        win.webContents.send('serial-data', line);
        console.log('   ✅ Data sent to renderer');
      } else {
        console.log('   ❌ Window not available!');
      }
    });

    // Handle connection events
    port.on('open', () => {
      console.log('✅ Serial port OPENED:', portPath);
      console.log('   Baud rate:', port.baudRate);
      console.log('   Path:', port.path);
      console.log('⏳ Waiting 2 seconds for Arduino to reset...');
      
      // Arduino resets when serial connection opens (DTR/RTS)
      // Wait for bootloader to finish before marking as connected
      setTimeout(() => {
        console.log('✅ Arduino should be ready now');
        if (win && win.webContents) {
          win.webContents.send('serial-connection-status', true);
          console.log('   ✅ Connection status sent to renderer');
        }
      }, 2000); // Wait 2 seconds for Arduino to reset
    });

    port.on('close', () => {
      console.log('❌ Serial port CLOSED');
      if (win && win.webContents) {
        win.webContents.send('serial-connection-status', false);
      }
    });

    port.on('error', (err) => {
      console.error('❌ SERIAL PORT ERROR:', err.message);
      console.error('   Full error:', err);
      if (win && win.webContents) {
        win.webContents.send('serial-connection-status', false);
      }
    });

    console.log('✅ Port setup complete, waiting for data...');
  } catch (error) {
    console.error('❌ FAILED to create serial port:', error);
    if (win && win.webContents) {
      win.webContents.send('serial-connection-status', false);
    }
  }
}

// IPC handlers
ipcMain.handle('get-serial-ports', async () => {
  try {
    const ports = await listSerialPorts();
    return ports;
  } catch (error) {
    console.error('Error listing serial ports:', error);
    return [];
  }
});

ipcMain.on('connect-serial-port', (event, portPath) => {
  connectToPort(portPath);
});

ipcMain.on('disconnect-serial-port', () => {
  if (port && port.isOpen) {
    port.close();
  }
});

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
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: path.join(__dirname, '../public/logo.jpg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
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

