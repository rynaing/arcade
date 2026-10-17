// The only bridge between the game page and the app. The page checks for window.lhmDesktop to know it runs on Steam.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lhmDesktop', {
  storeUrl: ipcRenderer.sendSync('lhm-store-url'),
  event: (name, data) => ipcRenderer.send('lhm-event', String(name), JSON.parse(JSON.stringify(data || {}))),
  quit: () => ipcRenderer.send('lhm-quit'),
});
