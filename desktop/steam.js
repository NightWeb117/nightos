'use strict';
// Finds Steam and Discord on this PC and reads the installed Steam library from Steam's own files.
const fs = require('fs'), path = require('path'), { execFileSync, spawn } = require('child_process');
const { shell } = require('electron');

let steamRoot;
function steamPath() {
  if (steamRoot !== undefined) return steamRoot;
  steamRoot = null;
  const tries = [];
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
    const m = /SteamPath\s+REG_SZ\s+(.+)/i.exec(out); if (m) tries.push(m[1].trim().replace(/\//g, '\\'));
  } catch (e) { }
  tries.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  for (const p of tries) if (fs.existsSync(path.join(p, 'steamapps'))) { steamRoot = p; break; }
  return steamRoot;
}
function libraryFolders(root) {
  // The registry and libraryfolders.vdf spell the same folder differently, so compare normalized paths.
  const out = new Map(), add = p => { const n = path.resolve(p); out.set(n.toLowerCase(), n); };
  add(root);
  try {
    const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) add(m[1].replace(/\\\\/g, '\\'));
  } catch (e) { }
  return [...out.values()].filter(p => fs.existsSync(path.join(p, 'steamapps')));
}
function parseAcf(text) {
  const o = {}; for (const m of text.matchAll(/"(\w+)"\s+"([^"]*)"/g)) if (!(m[1] in o)) o[m[1]] = m[2];
  return o;
}
// Steam tools that show up as "apps" but aren't games.
const NOT_GAMES = /^(Steamworks Common Redistributables|Steam Linux Runtime.*|Proton.*|SteamVR.*|Steam Audio.*|.*Dedicated Server|Spacewar)$/i;
const NOT_GAME_IDS = new Set(['228980', '250820', '1070560', '1391110', '1628350', '1493710', '961940', '2180100', '480']);
function listGames() {
  const root = steamPath(); if (!root) return { steam: false, games: [] };
  const games = [];
  for (const lib of libraryFolders(root)) {
    const dir = path.join(lib, 'steamapps');
    let files = []; try { files = fs.readdirSync(dir).filter(f => /^appmanifest_\d+\.acf$/.test(f)); } catch (e) { continue; }
    for (const f of files) {
      try {
        const a = parseAcf(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!a.appid || !a.name || NOT_GAME_IDS.has(a.appid) || NOT_GAMES.test(a.name) || games.some(g => g.appid === a.appid)) continue;
        const flags = +a.StateFlags || 0;
        games.push({ appid: a.appid, name: a.name, size: +a.SizeOnDisk || 0, lastPlayed: (+a.LastPlayed || 0) * 1000, ready: (flags & 4) === 4, updating: (flags & 2) === 2 || (flags & 1024) === 1024, library: lib, cover: !!imagePath(a.appid, 'cover'), header: !!imagePath(a.appid, 'header') });
      } catch (e) { }
    }
  }
  games.sort((x, y) => (y.lastPlayed - x.lastPlayed) || x.name.localeCompare(y.name));
  return { steam: true, games };
}
function imagePath(appid, kind) {
  if (!/^\d{1,10}$/.test(String(appid))) return null;
  const root = steamPath(); if (!root) return null;
  const cache = path.join(root, 'appcache', 'librarycache');
  const names = { cover: ['library_600x900.jpg', 'library_capsule.jpg'], header: ['header.jpg', 'library_hero.jpg'], logo: ['logo.png'] }[kind];
  if (!names) return null;
  for (const n of names) {
    for (const p of [path.join(cache, `${appid}_${n}`), path.join(cache, String(appid), n)]) if (fs.existsSync(p)) return p;
  }
  // Newer Steam keeps each game's images in a folder, sometimes one level deeper.
  try { const d = path.join(cache, String(appid)); for (const sub of fs.readdirSync(d)) { const sp = path.join(d, sub); if (fs.statSync(sp).isDirectory()) for (const n of names) if (fs.existsSync(path.join(sp, n))) return path.join(sp, n); } } catch (e) { }
  return null;
}
const discordUpdater = () => process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Discord', 'Update.exe') : null;
function discordInstalled() { const u = discordUpdater(); return !!(u && fs.existsSync(u)); }
function launchDiscord() {
  const u = discordUpdater();
  if (u && fs.existsSync(u)) { spawn(u, ['--processStart', 'Discord.exe'], { detached: true, stdio: 'ignore', windowsHide: false }).unref(); return true; }
  return false;
}
module.exports = { steamPath, listGames, imagePath, discordInstalled, launchDiscord };
