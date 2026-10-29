'use strict';
// The only native powers NightOS's page gets. Each call is checked again in main.js.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nightosNative', {
  isDesktop: true,
  info: () => ipcRenderer.invoke('native:info'),
  steamGames: () => ipcRenderer.invoke('native:steamGames'),
  launch: (kind, arg) => ipcRenderer.invoke('native:launch', kind, arg),
  openExternal: url => ipcRenderer.invoke('native:openExternal', url),
  setFullscreen: on => ipcRenderer.invoke('native:fullscreen', on),
  setStartFullscreen: on => ipcRenderer.invoke('native:setStartFullscreen', on),
  quit: () => ipcRenderer.invoke('native:quit')
});
