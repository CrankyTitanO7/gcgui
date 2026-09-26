const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  connectSerialPort: (path, baudRate) => ipcRenderer.send('connect-serial-port', path, baudRate),
  disconnectSerialPort: () => ipcRenderer.send('disconnect-serial-port'),
  startLiveRecording: (protocol) => ipcRenderer.invoke('start-live-recording', protocol),
  stopLiveRecording: () => ipcRenderer.invoke('stop-live-recording'),
  
  onSerialData: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('serial-data', listener);
    return () => ipcRenderer.removeListener('serial-data', listener); // Returns the cleanup function
  },
  
  onSerialConnectionStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('serial-connection-status', listener);
    return () => ipcRenderer.removeListener('serial-connection-status', listener);
  },

  // Replay API
  loadCRTDFile: (filePath) => ipcRenderer.invoke('load-crtd-file', filePath),
  startReplay: (speed) => ipcRenderer.invoke('start-replay', speed),
  pauseReplay: () => ipcRenderer.invoke('pause-replay'),
  stopReplay: () => ipcRenderer.invoke('stop-replay'),
  getReplayStatus: () => ipcRenderer.invoke('get-replay-status'),
  seekReplay: (index) => ipcRenderer.invoke('seek-replay', index),
  injectSerialData: (data) => ipcRenderer.send('inject-serial-data', data),
  
  onReplayStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('replay-status', listener);
    return () => ipcRenderer.removeListener('replay-status', listener);
  }
});
