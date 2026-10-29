'use strict';
// NightOS desktop: serves the website from disk over a private nightos:// scheme and gives the
// page a small, fixed set of native actions (see preload.js). Nothing else on the PC is reachable.
const { app, BrowserWindow, protocol, ipcMain, shell, session, Menu } = require('electron');
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
function fromNightOS(e) { return !!(e.senderFrame && e.senderFrame.url.startsWith('nightos://app/')); }
function setUpIpc() {
  const guard = fn => (e, ...a) => { if (!fromNightOS(e)) throw new Error('Not allowed'); return fn(...a); };
  ipcMain.handle('native:info', guard(() => ({ desktop: true, version: app.getVersion(), electron: process.versions.electron, platform: process.platform, discord: steam.discordInstalled(), steam: !!steam.steamPath(), fullscreen: win ? win.isFullScreen() : false, startFullscreen: !!config.fullscreen })));
  ipcMain.handle('native:steamGames', guard(() => steam.listGames()));
  ipcMain.handle('native:launch', guard((kind, arg) => {
    const id = String(arg || '');
    if (kind === 'discord') return steam.launchDiscord();
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
  app.whenReady().then(() => { config = loadConfig(); handleProtocol(); setUpWebSession(); setUpIpc(); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
