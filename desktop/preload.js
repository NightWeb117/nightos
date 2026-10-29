'use strict';
// The only native powers NightOS's page gets. Each call is checked again in main.js.
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('nightosNative', {
  isDesktop: true,
  info: () => ipcRenderer.invoke('native:info'),
  steamGames: () => ipcRenderer.invoke('native:steamGames'),
  launch: (kind, arg) => ipcRenderer.invoke('native:launch', kind, arg),
  openExternal: url => ipcRenderer.invoke('native:openExternal', url),
  setFullscreen: on => ipcRenderer.invoke('native:fullscreen', on),
  setStartFullscreen: on => ipcRenderer.invoke('native:setStartFullscreen', on),
  quit: () => ipcRenderer.invoke('native:quit'),
  // Windows programs. Running one always needs the user's OK in a native dialog the first time.
  desktopPrograms: () => ipcRenderer.invoke('native:desktopPrograms'),
  pickProgram: () => ipcRenderer.invoke('native:pickProgram'),
  describeProgram: p => ipcRenderer.invoke('native:describeProgram', p),
  runProgram: p => ipcRenderer.invoke('native:runProgram', p),
  forgetApprovals: () => ipcRenderer.invoke('native:forgetApprovals'),
  // Updates from GitHub releases
  updateState: () => ipcRenderer.invoke('native:updateState'),
  checkForUpdates: () => ipcRenderer.invoke('native:updateCheck'),
  installUpdate: () => ipcRenderer.invoke('native:updateInstall'),
  setAutoUpdate: on => ipcRenderer.invoke('native:setAutoUpdate', on),
  onUpdate: cb => { ipcRenderer.on('native:update', (e, s) => cb(s)); },
  pathForFile: file => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } }
});
