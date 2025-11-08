const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => console.log('pong from preload'),
});
