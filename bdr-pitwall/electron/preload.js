const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  connectSerialPort: (path, baudRate) => ipcRenderer.send('connect-serial-port', path, baudRate),
  disconnectSerialPort: () => ipcRenderer.send('disconnect-serial-port'),
  
  onSerialData: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('serial-data', listener);
    return () => ipcRenderer.removeListener('serial-data', listener); // Returns the cleanup function
  },
  
  onSerialConnectionStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('serial-connection-status', listener);
    return () => ipcRenderer.removeListener('serial-connection-status', listener);
  }
});