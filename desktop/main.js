'use strict';
// NightOS desktop: serves the website from disk over a private nightos:// scheme and gives the
// page a small, fixed set of native actions (see preload.js). Nothing else on the PC is reachable.
const { app, BrowserWindow, protocol, ipcMain, shell, session, Menu, dialog, nativeImage, desktopCapturer } = require('electron');
const path = require('path'), fs = require('fs'), { Readable } = require('stream');
const steam = require('./steam');

const SITE = app.isPackaged ? path.join(process.resourcesPath, 'site') : path.join(__dirname, '..', 'site');
const SELFTEST = process.argv.includes('--selftest');
const CONFIG_FILE = () => path.join(app.getPath('userData'), 'desktop.json');
const loadConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8')); } catch (e) { return { fullscreen: false }; } };
const saveConfig = c => { try { fs.writeFileSync(CONFIG_FILE(), JSON.stringify(c, null, 2)); } catch (e) { } };
let config = null, win = null;

// Sites that may use the microphone, camera and notifications inside NightOS windows.
const TRUSTED_WEB = /(^|\.)(discord\.com|discordapp\.com|discord\.gg|steampowered\.com|steamcommunity\.com|youtube\.com|spotify\.com|photopea\.com|excalidraw\.com|wikipedia\.org|github\.com)$/;

protocol.registerSchemesAsPrivileged([{ scheme: 'nightos', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
function serveFile(file, req) {
  const size = fs.statSync(file).size, type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || '');
  if (m) {
    const start = Math.min(+m[1], size - 1), end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers: { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' } });
}
function handleProtocol() {
  protocol.handle('nightos', req => {
    const u = new URL(req.url);
    if (u.host === 'steam') { // nightos://steam/<appid>/<cover|header|logo>
      const [, appid, kind] = u.pathname.split('/'), f = steam.imagePath(appid, kind);
      return f ? serveFile(f, req) : new Response('', { status: 404 });
    }
    if (u.host !== 'app') return new Response('Not found', { status: 404 });
    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
    const file = path.normalize(path.join(SITE, rel));
    if (!file.startsWith(SITE + path.sep)) return new Response('Forbidden', { status: 403 });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('Not found', { status: 404 });
    return serveFile(file, req);
  });
}
function setUpWebSession() {
  const web = session.fromPartition('persist:web');
  // Present a normal Chrome browser so sites like Discord don't refuse the embedded view.
  web.setUserAgent(web.getUserAgent().replace(/\s*Electron\/\S+/i, '').replace(/\s*nightos-desktop\/\S+/i, '').replace(/\s*NightOS\/\S+/i, ''));
  const allow = new Set(['media', 'notifications', 'fullscreen', 'clipboard-sanitized-write', 'pointerLock']);
  web.setPermissionRequestHandler((wc, perm, cb, details) => { let host = ''; try { host = new URL(details.requestingUrl || wc.getURL()).hostname; } catch (e) { } cb(allow.has(perm) && (perm === 'fullscreen' || TRUSTED_WEB.test(host))); });
  web.setPermissionCheckHandler((wc, perm, origin) => { let host = ''; try { host = new URL(origin).hostname; } catch (e) { } return allow.has(perm) && (perm === 'fullscreen' || TRUSTED_WEB.test(host)); });
}
/* ---------- Windows programs: .exe files, shortcuts (.lnk) and internet shortcuts (.url) ----------
   A program only runs after the user confirms it once in a native dialog, which page content
   can't fake. Approved paths are remembered in desktop.json. */
const PROGRAM = /\.(exe|lnk|url)$/i;
const normPath = p => path.resolve(String(p)).toLowerCase();
const approved = () => new Set((config.approvedPrograms || []).map(normPath));
function checkProgram(p) {
  if (typeof p !== 'string' || !PROGRAM.test(p) || !path.isAbsolute(p)) throw new Error('Only .exe, .lnk and .url files can be run');
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new Error('That program no longer exists');
}
async function describeProgram(p) {
  checkProgram(p);
  const ext = path.extname(p).toLowerCase(); let target = p;
  if (ext === '.lnk') { try { const s = shell.readShortcutLink(p); if (s.target && fs.existsSync(s.target)) target = s.target; } catch (e) { } }
  let icon = null;
  // Internet shortcuts (Steam games use these) name their real icon in an IconFile= line.
  if (ext === '.url') {
    try {
      const m = /^IconFile=(.+)$/mi.exec(fs.readFileSync(p, 'utf8'));
      if (m && fs.existsSync(m[1].trim())) { const img = nativeImage.createFromPath(m[1].trim()); if (!img.isEmpty()) icon = img.resize({ width: 64, height: 64, quality: 'best' }).toDataURL(); }
    } catch (e) { }
  }
  if (!icon) try { const img = await app.getFileIcon(target, { size: 'large' }); if (!img.isEmpty()) icon = img.toDataURL(); } catch (e) { }
  if (!icon) try { const img = await app.getFileIcon(p, { size: 'large' }); if (!img.isEmpty()) icon = img.toDataURL(); } catch (e) { }
  return { path: p, name: path.basename(p).replace(PROGRAM, ''), kind: ext.slice(1), target, icon, approved: approved().has(normPath(p)) };
}
async function desktopPrograms() {
  const dirs = [app.getPath('desktop'), process.env.PUBLIC && path.join(process.env.PUBLIC, 'Desktop')].filter(Boolean), seen = new Set(), out = [];
  for (const d of dirs) {
    let names = []; try { names = fs.readdirSync(d); } catch (e) { continue; }
    for (const n of names) {
      const p = path.join(d, n); if (!PROGRAM.test(n) || seen.has(normPath(p))) continue; seen.add(normPath(p));
      try { out.push(await describeProgram(p)); } catch (e) { }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
async function runProgram(p) {
  checkProgram(p);
  if (!approved().has(normPath(p))) {
    const r = await dialog.showMessageBox(win, {
      type: 'warning', buttons: ['Run', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true,
      title: 'Run a Windows program?', message: `Run “${path.basename(p)}”?`,
      detail: `${p}\n\nIt runs as a normal Windows program with full access to your PC, outside NightOS. Only run programs you trust.`,
      checkboxLabel: 'Don’t ask again for this program', checkboxChecked: true
    });
    if (r.response !== 0) return { ok: false, cancelled: true };
    if (r.checkboxChecked) { config.approvedPrograms = [...(config.approvedPrograms || []), p]; saveConfig(config); }
  }
  const err = await shell.openPath(p);
  return err ? { ok: false, error: err } : { ok: true };
}
function fromNightOS(e) { return !!(e.senderFrame && e.senderFrame.url.startsWith('nightos://app/')); }
function setUpIpc() {
  const guard = fn => (e, ...a) => { if (!fromNightOS(e)) throw new Error('Not allowed'); return fn(...a); };
  ipcMain.handle('native:info', guard(() => ({ desktop: true, version: app.getVersion(), electron: process.versions.electron, platform: process.platform, discord: steam.discordInstalled(), roblox: !!steam.robloxPlayer(), steam: !!steam.steamPath(), fullscreen: win ? win.isFullScreen() : false, startFullscreen: !!config.fullscreen })));
  ipcMain.handle('native:steamGames', guard(() => steam.listGames()));
  ipcMain.handle('native:launch', guard((kind, arg) => {
    const id = String(arg || '');
    if (kind === 'discord') return steam.launchDiscord();
    if (kind === 'roblox') return steam.launchRoblox();
    if (kind === 'steam') { shell.openExternal('steam://open/main'); return true; }
    if (kind === 'bigpicture') { shell.openExternal('steam://open/bigpicture'); return true; }
    if (kind === 'steamGame' && /^\d{1,10}$/.test(id)) { shell.openExternal(`steam://rungameid/${id}`); return true; }
    if (kind === 'steamPage' && /^\d{1,10}$/.test(id)) { shell.openExternal(`steam://nav/games/details/${id}`); return true; }
    throw new Error('Unknown launch target');
  }));
  ipcMain.handle('native:openExternal', guard(url => { if (!/^https?:\/\//i.test(String(url))) throw new Error('Only web links can be opened'); shell.openExternal(String(url)); return true; }));
  ipcMain.handle('native:fullscreen', guard(on => { if (win) win.setFullScreen(on == null ? !win.isFullScreen() : !!on); return win ? win.isFullScreen() : false; }));
  ipcMain.handle('native:setStartFullscreen', guard(on => { config.fullscreen = !!on; saveConfig(config); return config.fullscreen; }));
  ipcMain.handle('native:quit', guard(() => { app.quit(); return true; }));
  ipcMain.handle('native:desktopPrograms', guard(() => desktopPrograms()));
  ipcMain.handle('native:describeProgram', guard(p => describeProgram(p)));
  ipcMain.handle('native:runProgram', guard(p => runProgram(p)));
  ipcMain.handle('native:pickProgram', guard(async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose a program to add to NightOS', defaultPath: app.getPath('desktop'), buttonLabel: 'Add to NightOS', filters: [{ name: 'Programs and shortcuts', extensions: ['exe', 'lnk', 'url'] }], properties: ['openFile', 'multiSelections'] });
    if (r.canceled) return [];
    const out = []; for (const p of r.filePaths) { try { out.push(await describeProgram(p)); } catch (e) { } } return out;
  }));
  ipcMain.handle('native:forgetApprovals', guard(() => { config.approvedPrograms = []; saveConfig(config); return true; }));
  // Your Windows folders (winfs.js) and the program windows open on your PC (wintasks.js)
  ipcMain.handle('native:winRoots', guard(() => folders.roots()));
  ipcMain.handle('native:winGrant', guard(n => folders.grant(String(n))));
  ipcMain.handle('native:winForgetFolders', guard(() => folders.forget()));
  ipcMain.handle('native:winList', guard(p => folders.list(p)));
  ipcMain.handle('native:winReadText', guard(p => folders.readText(p)));
  ipcMain.handle('native:winReadBytes', guard(p => folders.readBytes(p)));
  ipcMain.handle('native:winWriteText', guard((p, t) => folders.writeText(p, t)));
  ipcMain.handle('native:winWriteBytes', guard((p, b) => folders.writeBytes(p, b)));
  ipcMain.handle('native:winMkdir', guard(p => folders.mkdir(p)));
  ipcMain.handle('native:winRename', guard((a, b) => folders.rename(a, b)));
  ipcMain.handle('native:winCopy', guard((a, b) => folders.copy(a, b)));
  ipcMain.handle('native:winTrash', guard(p => folders.trash(p)));
  ipcMain.handle('native:winWindows', guard(() => tasks.list()));
  ipcMain.handle('native:winWindowAction', guard((h, what) => tasks.act(h, String(what))));
  ipcMain.handle('native:setCaptureTarget', guard(k => { captureTarget = k === 'screen' ? 'screen' : 'nightos'; return captureTarget; }));
  ipcMain.handle('native:updateState', guard(() => updates.state()));
  ipcMain.handle('native:updateCheck', guard(() => { updates.check(); return true; }));
  ipcMain.handle('native:updateInstall', guard(() => updates.install()));
  ipcMain.handle('native:setAutoUpdate', guard(on => updates.setAuto(on)));
  ipcMain.handle('native:flatpakStatus', guard(() => flatpaks.status()));
  ipcMain.handle('native:flatpakSetup', guard(() => flatpaks.setup()));
  ipcMain.handle('native:flatpakCatalog', guard((kind, q) => flatpaks.catalog(String(kind), q)));
  ipcMain.handle('native:flatpakDetails', guard(id => flatpaks.details(id)));
  ipcMain.handle('native:flatpakList', guard(() => flatpaks.list()));
  ipcMain.handle('native:flatpakInstall', guard((id, name) => flatpaks.install(id, String(name || '').slice(0, 80))));
  ipcMain.handle('native:flatpakUninstall', guard(id => flatpaks.uninstall(id)));
  ipcMain.handle('native:flatpakRun', guard(id => flatpaks.run(id)));
  ipcMain.handle('native:flatpakJob', guard(() => flatpaks.current()));
}
let folders = null, tasks = null, flatpaks = null, captureTarget = 'nightos';
// Screen Recorder: NightOS's page can record its own window or the whole screen, with the PC's sound.
function setUpCapture() {
  session.defaultSession.setDisplayMediaRequestHandler((req, cb) => {
    if (!req.frame || !req.frame.url.startsWith('nightos://app/')) return cb({});
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then(srcs => {
      const own = win && srcs.find(s => s.id === win.getMediaSourceId()), screen = srcs.find(s => s.id.startsWith('screen:'));
      const src = captureTarget === 'screen' ? screen : own || screen;
      cb(src ? { video: src, audio: req.audioRequested ? 'loopback' : undefined } : {});
    }).catch(() => cb({}));
  });
}
let updates = null;
function setUpUpdates() {
  updates = require('./updater')({ config, saveConfig, send: s => { if (win && !win.isDestroyed()) win.webContents.send('native:update', s); } });
  if (!SELFTEST) updates.start();
}
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#000000', title: 'NightOS',
    fullscreen: !!config.fullscreen && !SELFTEST, autoHideMenuBar: true, icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: true, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  wc.on('will-navigate', (e, url) => { if (!url.startsWith('nightos://app/')) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); } });
  wc.on('will-attach-webview', (e, prefs, params) => {
    delete prefs.preload; prefs.nodeIntegration = false; prefs.contextIsolation = true; prefs.sandbox = true;
    if (!/^https?:\/\//i.test(params.src || '')) return e.preventDefault();
    params.partition = 'persist:web';
  });
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'I' && input.control && input.shift) { wc.toggleDevTools(); e.preventDefault(); }
  });
  win.loadURL('nightos://app/index.html');
  if (SELFTEST) require('./selftest')(win, app);
}
app.on('web-contents-created', (e, contents) => {
  if (contents.getType() !== 'webview') return;
  // Links that open new windows from inside a website go to the real browser.
  contents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => { config = loadConfig(); handleProtocol(); setUpWebSession(); setUpUpdates(); setUpCapture(); folders = require('./winfs')({ config, saveConfig, getWin: () => win }); tasks = require('./wintasks')(); flatpaks = require('./flatpak')({ getWin: () => win, send: s => { if (win && !win.isDestroyed()) win.webContents.send('native:flatpak', s); } }); setUpIpc(); createWindow(); });
  app.on('will-quit', () => { if (tasks) tasks.stop(); });
  app.on('window-all-closed', () => app.quit());
}
