'use strict';
// Your Windows folders for NightOS's Files app. Only the six standard folders can be reached, each
// one only after you allow it in a native dialog, and nothing outside them (links that point
// elsewhere are refused). Deleting sends things to the Recycle Bin.
const { app, dialog, shell } = require('electron');
const path = require('path'), fs = require('fs'), fsp = fs.promises;

const ROOTS = { Desktop: 'desktop', Documents: 'documents', Downloads: 'downloads', Pictures: 'pictures', Music: 'music', Videos: 'videos' };
const BLOCK = /\.(exe|bat|cmd|com|scr|msi|ps1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|url|reg|cpl|jar|pif)$/i;
const SKIP = /^(desktop\.ini|thumbs\.db|\$recycle\.bin|ntuser\..*)$/i;

module.exports = function winfs({ config, saveConfig, getWin }) {
  const roots = () => Object.entries(ROOTS).map(([name, key]) => { let p = ''; try { p = app.getPath(key); } catch (e) { } return { name, path: p, granted: (config.grantedFolders || []).includes(name) }; }).filter(r => r.path && fs.existsSync(r.path));
  const low = p => path.resolve(p).toLowerCase();
  // A path is allowed when it, and the real place it points to, sit inside a folder you allowed.
  async function check(p, { mustExist = true } = {}) {
    if (typeof p !== 'string' || !path.isAbsolute(p)) throw new Error('Not a full path');
    const abs = path.resolve(p), ok = roots().filter(r => r.granted);
    const inside = (x, r) => low(x) === low(r.path) || low(x).startsWith(low(r.path) + path.sep);
    const root = ok.find(r => inside(abs, r)); if (!root) throw new Error('NightOS isn\'t allowed to use that folder');
    let real = abs;
    try { real = await fsp.realpath(abs); } catch (e) { if (mustExist) throw new Error('That file or folder no longer exists'); try { real = path.join(await fsp.realpath(path.dirname(abs)), path.basename(abs)); } catch (e2) { throw new Error('That folder no longer exists'); } }
    if (!inside(real, { path: await fsp.realpath(root.path) })) throw new Error('That item points outside your allowed folders');
    return abs;
  }
  const checkWrite = async p => { const a = await check(p, { mustExist: false }); if (BLOCK.test(a)) throw new Error('NightOS doesn\'t put programs or scripts into your Windows folders'); return a; };
  return {
    roots,
    async grant(name) {
      const r = roots().find(x => x.name === name); if (!r) return false; if (r.granted) return true;
      const res = await dialog.showMessageBox(getWin(), { type: 'question', buttons: ['Allow', 'Don’t Allow'], defaultId: 0, cancelId: 1, noLink: true, title: 'Let NightOS use a folder?', message: `Let NightOS use your ${name} folder?`, detail: `${r.path}\n\nNightOS's Files app can then open, change and add files there. Deleted files go to the Recycle Bin. You can take this back in Settings › Desktop App.` });
      if (res.response !== 0) return false;
      config.grantedFolders = [...new Set([...(config.grantedFolders || []), name])]; saveConfig(config); return true;
    },
    forget() { config.grantedFolders = []; saveConfig(config); return true; },
    async list(p) {
      const d = await check(p), out = [];
      for (const e of await fsp.readdir(d, { withFileTypes: true })) {
        if (SKIP.test(e.name) || e.name.startsWith('~$')) continue;
        try { const st = await fsp.stat(path.join(d, e.name)); out.push({ name: e.name, dir: st.isDirectory(), size: st.isDirectory() ? 0 : st.size, mtime: Math.round(st.mtimeMs) }); } catch (x) { }
      }
      return out;
    },
    async readText(p) { const a = await check(p); const st = await fsp.stat(a); if (st.size > 4 * 1024 * 1024) throw new Error('That file is too big to open as text'); return fsp.readFile(a, 'utf8'); },
    async readBytes(p) { const a = await check(p); const st = await fsp.stat(a); if (st.size > 512 * 1024 * 1024) throw new Error('That file is over 512 MB'); return new Uint8Array(await fsp.readFile(a)); },
    async writeText(p, s) { const a = await checkWrite(p); await fsp.writeFile(a, String(s), 'utf8'); return true; },
    async writeBytes(p, bytes) { const a = await checkWrite(p); if (!(bytes instanceof Uint8Array)) throw new Error('Bad data'); await fsp.writeFile(a, bytes); return true; },
    async mkdir(p) { const a = await check(p, { mustExist: false }); await fsp.mkdir(a, { recursive: true }); return true; },
    async rename(a, b) { const x = await check(a), y = await checkWrite(b); if (roots().some(r => low(r.path) === low(x))) throw new Error('Your Windows folders themselves can’t be moved'); await fsp.rename(x, y); return true; },
    async copy(a, b) { const x = await check(a), y = await checkWrite(b); await fsp.cp(x, y, { recursive: true, errorOnExist: true, force: false }); return true; },
    async trash(p) { const a = await check(p); if (roots().some(r => low(r.path) === low(a))) throw new Error('Your Windows folders themselves can’t be deleted'); await shell.trashItem(a); return true; }
  };
};
