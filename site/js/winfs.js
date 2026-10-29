'use strict';
/* ================= Your Windows folders inside NightOS (desktop app only) =================
   ~/Windows holds your real Desktop, Documents, Downloads, Pictures, Music and Videos. Folders load
   when you open them; files are read and written straight on your PC. The first time, Windows
   asks you (in a dialog NightOS can't fake) to let NightOS use each folder. Deleting sends
   things to the Windows Recycle Bin. */
const WIN_MOUNT = HOME + '/Windows';
if (NATIVE && NATIVE.winRoots) {
  const W = { roots: [] };
  const sep = '\\', join = (a, b) => a.replace(/[\\/]+$/, '') + sep + b;
  const TEXTISH = TEXT_EXT, BLOCK = /\.(exe|bat|cmd|com|scr|msi|ps1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|url|reg|cpl|jar|pif)$/i;
  const fail = (what, e) => notify('files', what, String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
  const mount = () => getNode(WIN_MOUNT);
  const winOf = p => { const n = getNode(p); if (n && n.winPath) return n.winPath; const [d, name] = splitPath(p), dn = getNode(d); return dn && dn.winPath ? join(dn.winPath, name) : null; };
  const inMount = p => p === WIN_MOUNT || p.startsWith(WIN_MOUNT + '/');
  function ensureMount() {
    const h = getNode(HOME); if (!h) return;
    let m = mount(); if (!m || m.type !== 'dir') m = h.children.Windows = { type: 'dir', children: {}, mtime: Date.now() };
    m.winMount = true;
    for (const r of W.roots) { const c = m.children[r.name]; if (!c || c.winPath !== r.path) m.children[r.name] = { type: 'dir', children: {}, mtime: Date.now(), winPath: r.path, winRoot: r.name, loaded: false }; }
  }
  // Your Windows files are never copied into NightOS's own storage.
  const strip = n => n.type !== 'dir' ? n : n.winMount ? { ...n, children: {} } : { ...n, children: Object.fromEntries(Object.entries(n.children).map(([k, v]) => [k, strip(v)])) };
  window.stripWin = strip;
  fsChanged = () => { clearTimeout(fsSaveT); fsSaveT = setTimeout(() => store.set('fs1', strip(FS)), 300); document.dispatchEvent(new Event('fs')); };
  window.EXTRA_PLACES = () => [['-'], ['Windows Folders', WIN_MOUNT, 'drive']];

  const mimeOf = name => ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', pdf: 'application/pdf', zip: 'application/zip' })[extOf(name)] || 'application/octet-stream';
  async function loadDir(p, force) {
    const n = getNode(p); if (!n || n.type !== 'dir' || !n.winPath || n.loading) return;
    if (n.loaded && !force && Date.now() - n.loaded < 4000) return;
    n.loading = true;
    try {
      const list = await NATIVE.winList(n.winPath), kids = {}, reads = [];
      for (const e of list) {
        const wp = join(n.winPath, e.name), old = n.children[e.name];
        if (e.dir) kids[e.name] = old && old.type === 'dir' && old.winPath === wp ? old : { type: 'dir', children: {}, mtime: e.mtime, winPath: wp, loaded: false };
        else if (TEXTISH.test(e.name) && e.size < 262144) {
          const node = { type: 'file', content: old && old.mtime === e.mtime ? old.content : '', mtime: e.mtime, winPath: wp, exec: /\.(sh|py)$/i.test(e.name) };
          if (!(old && old.mtime === e.mtime)) { node.winLazy = true; if (reads.length < 60) reads.push(NATIVE.winReadText(wp).then(t => { node.content = t; delete node.winLazy; }).catch(() => { })); }
          kids[e.name] = node;
        } else kids[e.name] = { type: 'file', content: '', blob: 'win:' + wp, size: e.size, mime: mimeOf(e.name), mtime: e.mtime, winPath: wp };
      }
      await Promise.all(reads);
      n.children = kids; n.loaded = Date.now();
    } catch (e) { n.loaded = 0; fail(`Couldn't open “${splitPath(p)[1]}”`, e); }
    n.loading = false; fsChanged();
  }
  window.onDirOpen = async p => {
    if (!inMount(p) || p === WIN_MOUNT) return;
    const n = getNode(p); if (!n || !n.winPath) return;
    const root = W.roots.find(r => n.winPath === r.path || n.winPath.startsWith(r.path + sep));
    if (root && !root.granted) {
      const ok = await NATIVE.winGrant(root.name); if (!ok) return notify('files', `NightOS can't use your ${root.name} folder`, 'You can allow it the next time you open it.');
      root.granted = true;
    }
    loadDir(p, true);
  };
  // Blobs named win:<path> are read from the PC when something opens them.
  BLOBS.get = (orig => async id => {
    if (!String(id).startsWith('win:')) return orig(id);
    if (BLOBS.mem.has(id)) return BLOBS.mem.get(id);
    try { const bytes = await NATIVE.winReadBytes(id.slice(4)), b = new Blob([bytes], { type: mimeOf(id) }); if (b.size < 25e6) BLOBS.mem.set(id, b); return b; } catch (e) { fail('Couldn\'t read the file', e); return null; }
  })(BLOBS.get.bind(BLOBS));
  openPath = (orig => async p => {
    const n = getNode(p);
    if (n && n.winLazy) { try { n.content = await NATIVE.winReadText(n.winPath); delete n.winLazy; } catch (e) { return fail('Couldn\'t read the file', e); } }
    return orig(p);
  })(openPath);

  /* ---------- changes made in NightOS go to the PC ---------- */
  const bytesOf = async n => n.blob ? new Uint8Array(await (await BLOBS.get(n.blob)).arrayBuffer()) : new TextEncoder().encode(n.content || '');
  async function writeOut(wp, n) {
    if (BLOCK.test(wp)) throw new Error('NightOS doesn\'t put programs or scripts into your Windows folders');
    if (n.type === 'dir') { await NATIVE.winMkdir(wp); for (const [k, c] of Object.entries(n.children)) await writeOut(join(wp, k), c); return; }
    if (n.size != null && !n.blob) return; // simulated files have nothing to copy
    if (!n.blob) await NATIVE.winWriteText(wp, n.content || ''); else await NATIVE.winWriteBytes(wp, await bytesOf(n));
  }
  const refresh = p => { const d = getNode(p); if (d && d.winPath) { d.loaded = 0; loadDir(p, true); } };
  fsWrite = (orig => (p, content, o) => {
    const wp = winOf(p); if (wp && BLOCK.test(wp)) throw 'EACCES';
    orig(p, content, o);
    if (wp) { const n = getNode(p); n.winPath = wp; delete n.winLazy; NATIVE.winWriteText(wp, n.content || '').catch(e => fail(`Couldn't save “${splitPath(p)[1]}” to your PC`, e)); }
  })(fsWrite);
  fsMkdir = (orig => (p, o) => {
    const wp = !getNode(p) && winOf(p); orig(p, o);
    if (wp) { const n = getNode(p); Object.assign(n, { winPath: wp, loaded: Date.now() }); NATIVE.winMkdir(wp).catch(e => fail('Couldn\'t make the folder on your PC', e)); }
  })(fsMkdir);
  const toBin = (p, n) => NATIVE.winTrash(n.winPath).then(() => notify('files', `“${splitPath(p)[1]}” is in the Windows Recycle Bin`, 'Restore it from the Recycle Bin on your PC.')).catch(e => fail('Couldn\'t delete it on your PC', e));
  fsRemove = (orig => (p, o) => {
    const n = getNode(p); if (n && n.winRoot) throw 'EACCES';
    if (n && n.winPath) { if (n.type === 'dir' && !(o && o.recursive)) throw 'EISDIR'; toBin(p, n); const [d, name] = splitPath(p); delete getNode(d).children[name]; return fsChanged(); }
    orig(p, o);
  })(fsRemove);
  trashItem = (orig => p => {
    const n = getNode(p); if (!n) return; if (n.winRoot || n.winMount) return notify('files', 'This folder stays', 'Your Windows folders can\'t be moved to the Trash.');
    if (n.winPath) { toBin(p, n); const [d, name] = splitPath(p); delete getNode(d).children[name]; return fsChanged(); }
    orig(p);
  })(trashItem);
  fsMove = (orig => (src, dst, o = {}) => {
    const sn = getNode(src); if (!sn) throw 'ENOENT';
    if (sn.winRoot || sn.winMount) throw 'EACCES';
    const dn = getNode(dst), target = dn && dn.type === 'dir' ? dst + (dst === '/' ? '' : '/') + splitPath(src)[1] : dst;
    const sw = sn.winPath, tw = winOf(target), [td] = splitPath(target);
    if (!sw && !tw) return orig(src, dst, o);
    if (sw && tw) { // inside your Windows folders: a real rename, move or copy
      (o.copy ? NATIVE.winCopy(sw, tw) : NATIVE.winRename(sw, tw)).then(() => { refresh(td); if (!o.copy) refresh(splitPath(src)[0]); }).catch(e => { fail('Couldn\'t do that on your PC', e); refresh(td); refresh(splitPath(src)[0]); });
      const r = orig(src, dst, o), n = getNode(r); n.winPath = tw; if (n.type === 'dir') { n.children = {}; n.loaded = 0; } return r;
    }
    if (tw) { // from NightOS into Windows: write a real copy, keep NightOS's own unless it's a move
      writeOut(tw, sn).then(() => { refresh(td); if (!o.copy) { const [d, name] = splitPath(src); const pn = getNode(d); if (pn && pn.children[name] === sn) { delete pn.children[name]; fsChanged(); } } }).catch(e => fail('Couldn\'t copy it to your PC', e));
      return target;
    }
    // from Windows into NightOS: copy the contents in. The file stays on your PC.
    if (sn.type === 'dir') { notify('files', 'Copy files, not folders', 'Open the folder and copy the files you want into NightOS.'); throw 'EINVAL'; }
    const copy = { type: 'file', content: sn.content || '', mtime: Date.now(), exec: !!sn.exec };
    const put = () => { const t = getNode(td); if (!t || t.type !== 'dir') return; t.children[splitPath(target)[1]] = copy; fsChanged(); };
    if (sn.blob) BLOBS.get(sn.blob).then(async b => { if (!b) return; const id = newBlobId(); await BLOBS.put(id, b); Object.assign(copy, { blob: id, size: b.size, mime: b.type }); put(); });
    else put();
    if (!o.copy) notify('files', 'Copied into NightOS', 'The original stays in your Windows folder.');
    return target;
  })(fsMove);
  importFiles = (orig => async (list, dir) => {
    const dn = getNode(dir); if (!dn || !dn.winPath) return orig(list, dir);
    let n = 0;
    for (const f of list) { try { const wp = join(dn.winPath, f.name); if (BLOCK.test(wp)) throw new Error('NightOS doesn\'t put programs or scripts into your Windows folders'); await NATIVE.winWriteBytes(wp, new Uint8Array(await f.arrayBuffer())); n++; } catch (e) { fail(`Couldn't copy “${f.name}”`, e); } }
    if (n) notify('files', n === 1 ? `Copied “${list[0].name}” to your PC` : `Copied ${n} files to your PC`, dn.winPath);
    refresh(dir);
  })(importFiles);

  NATIVE.winRoots().then(r => { W.roots = r; ensureMount(); fsChanged(); }).catch(() => { });
  window.WINFS = { reset: async () => { W.roots = await NATIVE.winRoots(); const m = mount(); if (m) for (const c of Object.values(m.children)) { c.children = {}; c.loaded = 0; } fsChanged(); } };
  CMDS['windows-folders'] = () => launch('files', WIN_MOUNT); DESC['windows-folders'] = 'open your Windows folders in Files';
}
