'use strict';
// Updates from the GitHub releases of NightWeb117/nightos.
// Installed copies download new versions in the background and install them on restart.
// The portable .exe can't replace itself while it runs, so it only checks and offers the download.
const { app, shell, net } = require('electron');

const REPO = 'NightWeb117/nightos';
const PORTABLE = !!process.env.PORTABLE_EXECUTABLE_FILE;
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

module.exports = function setUpUpdates({ config, saveConfig, send }) {
  const state = { kind: !app.isPackaged ? 'dev' : PORTABLE ? 'portable' : 'installer', status: 'idle', version: null, progress: 0, error: null, download: null, auto: config.autoUpdate !== false, current: app.getVersion() };
  const push = patch => { Object.assign(state, patch); send({ ...state }); };
  let updater = null, timer = null;

  if (state.kind === 'installer') {
    updater = require('electron-updater').autoUpdater;
    updater.autoDownload = true; updater.autoInstallOnAppQuit = true; updater.allowPrerelease = false; updater.logger = null;
    // NIGHTOS_UPDATE_FEED points an unreleased build at a test folder of update files.
    if (process.env.NIGHTOS_UPDATE_FEED) updater.setFeedURL({ provider: 'generic', url: process.env.NIGHTOS_UPDATE_FEED });
    updater.on('checking-for-update', () => push({ status: 'checking', error: null }));
    updater.on('update-available', i => push({ status: updater.autoDownload ? 'downloading' : 'available', version: i.version, progress: 0 }));
    updater.on('update-not-available', () => push({ status: 'none', version: null }));
    updater.on('download-progress', p => push({ status: 'downloading', progress: Math.round(p.percent || 0) }));
    updater.on('update-downloaded', i => push({ status: 'ready', version: i.version, progress: 100 }));
    updater.on('error', e => push({ status: 'error', error: String(e && e.message || e).split('\n')[0].slice(0, 200) }));
  }

  async function checkPortable() {
    push({ status: 'checking', error: null });
    try {
      const r = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'User-Agent': 'NightOS-desktop', Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error('GitHub answered ' + r.status);
      const j = await r.json(), v = String(j.tag_name || '').replace(/^v/, '');
      const asset = (j.assets || []).find(a => /portable\.exe$/i.test(a.name));
      if (v && newer(v, app.getVersion())) push({ status: 'available', version: v, download: asset ? asset.browser_download_url : j.html_url });
      else push({ status: 'none', version: null });
    } catch (e) { push({ status: 'error', error: String(e.message || e).slice(0, 200) }); }
  }
  const check = () => {
    if (state.kind === 'dev') return push({ status: 'none' });
    if (state.status === 'downloading' || state.status === 'ready') return;
    if (state.kind === 'portable') return checkPortable();
    return updater.checkForUpdates().catch(e => push({ status: 'error', error: String(e.message || e).slice(0, 200) }));
  };
  const schedule = () => {
    clearInterval(timer); timer = null;
    if (!state.auto || state.kind === 'dev') return;
    timer = setInterval(check, 6 * 3600e3);
  };
  if (state.kind === 'installer') updater.autoDownload = state.auto;

  return {
    state: () => ({ ...state }),
    check,
    start: () => { schedule(); if (state.auto && state.kind !== 'dev') setTimeout(check, 10000); },
    install: () => {
      if (state.kind === 'installer' && state.status === 'ready') { setImmediate(() => updater.quitAndInstall(false, true)); return true; }
      if (state.kind === 'installer' && state.status === 'available') { updater.downloadUpdate(); return true; }
      if (state.kind === 'portable' && state.download) { shell.openExternal(state.download); return true; }
      return false;
    },
    setAuto: on => {
      state.auto = !!on; config.autoUpdate = state.auto; saveConfig(config);
      if (updater) updater.autoDownload = state.auto;
      schedule(); push({}); return state.auto;
    }
  };
};
