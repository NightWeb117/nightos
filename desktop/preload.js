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
  // Your Windows folders, open program windows and screen recording
  winRoots: () => ipcRenderer.invoke('native:winRoots'),
  winGrant: name => ipcRenderer.invoke('native:winGrant', name),
  winForgetFolders: () => ipcRenderer.invoke('native:winForgetFolders'),
  winList: p => ipcRenderer.invoke('native:winList', p),
  winReadText: p => ipcRenderer.invoke('native:winReadText', p),
  winReadBytes: p => ipcRenderer.invoke('native:winReadBytes', p),
  winWriteText: (p, t) => ipcRenderer.invoke('native:winWriteText', p, t),
  winWriteBytes: (p, b) => ipcRenderer.invoke('native:winWriteBytes', p, b),
  winMkdir: p => ipcRenderer.invoke('native:winMkdir', p),
  winRename: (a, b) => ipcRenderer.invoke('native:winRename', a, b),
  winCopy: (a, b) => ipcRenderer.invoke('native:winCopy', a, b),
  winTrash: p => ipcRenderer.invoke('native:winTrash', p),
  winWindows: () => ipcRenderer.invoke('native:winWindows'),
  winWindowAction: (hwnd, what) => ipcRenderer.invoke('native:winWindowAction', hwnd, what),
  setCaptureTarget: kind => ipcRenderer.invoke('native:setCaptureTarget', kind),
  // Updates from GitHub releases
  updateState: () => ipcRenderer.invoke('native:updateState'),
  checkForUpdates: () => ipcRenderer.invoke('native:updateCheck'),
  installUpdate: () => ipcRenderer.invoke('native:updateInstall'),
  setAutoUpdate: on => ipcRenderer.invoke('native:setAutoUpdate', on),
  onUpdate: cb => { ipcRenderer.on('native:update', (e, s) => cb(s)); },
  // Flatpak apps from Flathub, installed into WSL. Installing needs the user's OK in a native dialog.
  flatpakStatus: () => ipcRenderer.invoke('native:flatpakStatus'),
  flatpakSetup: () => ipcRenderer.invoke('native:flatpakSetup'),
  flatpakCatalog: (kind, q) => ipcRenderer.invoke('native:flatpakCatalog', kind, q),
  flatpakDetails: id => ipcRenderer.invoke('native:flatpakDetails', id),
  flatpakList: () => ipcRenderer.invoke('native:flatpakList'),
  flatpakInstall: (id, name) => ipcRenderer.invoke('native:flatpakInstall', id, name),
  flatpakUninstall: id => ipcRenderer.invoke('native:flatpakUninstall', id),
  flatpakRun: id => ipcRenderer.invoke('native:flatpakRun', id),
  flatpakJob: () => ipcRenderer.invoke('native:flatpakJob'),
  onFlatpak: cb => { ipcRenderer.on('native:flatpak', (e, s) => cb(s)); },
  pathForFile: file => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } }
});
