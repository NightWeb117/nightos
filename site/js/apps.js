'use strict';
/* ================= Files ================= */
APPS.files = { name: 'Files', proc: 'files', kw: 'nautilus folder explorer manager', launch: p => FilesApp(p) };
function FilesApp(start = HOME) {
  const win = openWin({ app: 'files', w: 880, h: 560, minW: 380, minH: 300, mem: 92 });
  const S = { path: start, back: [], fwd: [], sel: new Set(), view: CFG.files_view || 'grid', hidden: false };
  const backB = hbtn('back', 'Back', () => { if (S.back.length) { S.fwd.push(S.path); go(S.back.pop(), true); } });
  const fwdB = hbtn('fwd', 'Forward', () => { if (S.fwd.length) { S.back.push(S.path); go(S.fwd.pop(), true); } });
  win.hl.append(backB, fwdB);
  const pathbar = el('<div class="pathbar no-drag"></div>'); win.ht.innerHTML = ''; win.ht.style.alignItems = 'flex-start'; win.ht.append(pathbar);
  const viewB = hbtn('list', 'View', () => { S.view = S.view === 'grid' ? 'list' : 'grid'; CFG.files_view = S.view; saveCfg(); render(); });
  const menuB = hbtn('menu', 'Main Menu', () => menuAt(menuB, [
    { label: 'New Folder…', icon: 'folderNew', kb: 'Shift+Ctrl+N', action: newFolder }, { label: 'New Document', icon: 'doc', action: newDoc },
    { label: 'Import Files From Computer…', icon: 'download', action: () => pickFiles(S.path) }, '-',
    { label: 'Show Hidden Files', check: S.hidden, kb: 'Ctrl+H', action: () => { S.hidden = !S.hidden; render(); } },
    { label: 'Open in Terminal', icon: 'term', action: () => launch('terminal', { cwd: S.path }) }, '-',
    { label: 'New Window', action: () => FilesApp(S.path) }, { label: 'About Files', action: () => notify('files', 'Files 46.2', 'Access and organize your files.') }]));
  win.cwd = () => S.path;
  win.hr.append(hbtn('<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>', 'Import files from your computer', () => pickFiles(S.path)));
  win.hr.append(hbtn('search', 'Search', () => { const q = el('<input class="entry no-drag" placeholder="Search current folder" style="width:200px;height:32px" aria-label="Search">'); pathbar.replaceWith(q); q.focus(); q.oninput = () => { S.q = q.value.toLowerCase(); render(); }; q.onkeydown = e => { if (e.key === 'Escape') { S.q = ''; q.replaceWith(pathbar); render(); } }; q.onblur = () => { if (!q.value) { S.q = ''; q.replaceWith(pathbar); render(); } }; }), viewB, menuB);
  win.body.innerHTML = `<div class="fm"><nav class="fm-side" aria-label="Places"></nav><div class="fm-main"><div class="fm-banner" hidden></div><div class="fm-items" tabindex="0" role="listbox" aria-multiselectable="true"></div><div class="fm-status"></div></div></div>`;
  const side = $('.fm-side', win.body), items = $('.fm-items', win.body), status = $('.fm-status', win.body), banner = $('.fm-banner', win.body);
  const PLACES = [['Recent', null, 'reload'], ['Starred', null, 'star'], ['-'], ['Home', HOME, 'home'], ['Desktop', HOME + '/Desktop', 'desktop'], ['Documents', HOME + '/Documents', 'doc'], ['Downloads', HOME + '/Downloads', 'download'], ['Music', HOME + '/Music', 'music'], ['Pictures', HOME + '/Pictures', 'pic'], ['Videos', HOME + '/Videos', 'video'], ['Trash', TRASH, 'trash'], ['-'], ['Other Locations', '/', 'drive']];
  function go(p, hist) {
    const n = getNode(p); if (!n || n.type !== 'dir') return;
    if (!canRead(p, false)) return notify('files', 'Could not open “' + splitPath(p)[1] + '”', 'You do not have the permissions necessary to view the contents.');
    if (!hist && p !== S.path) { S.back.push(S.path); S.fwd = []; }
    S.path = p; S.sel.clear(); render(); items.scrollTop = 0;
  }
  win.go = go;
  const entries = () => {
    const n = getNode(S.path); if (!n) { S.path = HOME; return entries(); }
    return Object.keys(n.children).filter(k => (S.hidden || !k.startsWith('.')) && (!S.q || k.toLowerCase().includes(S.q)))
      .sort((a, b) => (n.children[b].type === 'dir') - (n.children[a].type === 'dir') || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map(k => ({ name: k, path: (S.path === '/' ? '' : S.path) + '/' + k, node: n.children[k] }));
  };
  function title() { return S.path === HOME ? 'Home' : S.path === TRASH ? 'Trash' : S.path === '/' ? 'Computer' : splitPath(S.path)[1]; }
  function render() {
    const isTrash = S.path === TRASH;
    win.setTitle(title()); backB.disabled = !S.back.length; fwdB.disabled = !S.fwd.length; viewB.innerHTML = sym(S.view === 'grid' ? 'list' : 'grid');
    side.innerHTML = PLACES.map(([l, p, ic]) => l === '-' ? '<hr>' : `<button class="${p === S.path ? 'on' : ''}" ${p ? `data-p="${esc(p)}"` : 'disabled style="opacity:.55"'}>${sym(ic)}<span>${l}</span></button>`).join('');
    // path bar
    let crumbs = [];
    if (S.path === TRASH) crumbs = [['Trash', TRASH, 'trash']];
    else if (inHome(S.path)) { crumbs = [['Home', HOME, 'home']]; let acc = HOME; S.path.slice(HOME.length).split('/').filter(Boolean).forEach(s => { acc += '/' + s; crumbs.push([s, acc]); }); }
    else { crumbs = [['Computer', '/', 'drive']]; let acc = ''; S.path.split('/').filter(Boolean).forEach(s => { acc += '/' + s; crumbs.push([s, acc]); }); }
    pathbar.innerHTML = crumbs.map(([l, p, ic], i) => `${i ? `<span class="sepc">/</span>` : ''}<button class="${i === crumbs.length - 1 ? 'cur' : ''}" data-p="${esc(p)}">${ic ? sym(ic) : ''}${esc(l)}</button>`).join('');
    pathbar.scrollLeft = 1e6;
    const es = entries();
    banner.hidden = !isTrash || !es.length;
    banner.innerHTML = isTrash ? `<span>Items in the Trash are kept until you empty it.</span><button class="hbtn destr" data-empty>Empty…</button>` : '';
    items.classList.toggle('list', S.view === 'list');
    if (!es.length) items.innerHTML = `<div class="fm-empty">${sym(isTrash ? 'trash' : S.q ? 'search' : 'folderNew')}<b>${isTrash ? 'Trash is Empty' : S.q ? 'No Results Found' : 'Folder is Empty'}</b></div>`;
    else items.innerHTML = es.map(e => `<button class="fi ${S.sel.has(e.path) ? 'sel' : ''}" data-p="${esc(e.path)}" role="option" aria-selected="${S.sel.has(e.path)}">${nodeIcon(e.path, e.node)}<span class="nm">${esc(e.name)}</span>${S.view === 'list' ? `<span class="meta">${e.node.type === 'dir' ? Object.keys(e.node.children).length + ' items' : humanSI(nodeSize(e.node))}</span><span class="meta d">${fmtFileDate(e.node.mtime)}</span>` : ''}</button>`).join('');
    updStatus(es);
  }
  function updStatus(es = entries()) {
    const sel = [...S.sel].map(getNode).filter(Boolean);
    if (sel.length === 1) { const p = [...S.sel][0], n = sel[0]; status.textContent = `“${splitPath(p)[1]}” selected (${n.type === 'dir' ? Object.keys(n.children).length + ' items' : humanSI(nodeSize(n))})`; }
    else if (sel.length) status.textContent = `${sel.length} items selected`;
    else { const st = REAL.storage; status.textContent = `${es.length} item${es.length === 1 ? '' : 's'}${S.path === '/' ? '' : `, Free space: ${st && st.quota ? humanSI(st.quota - (st.usage || 0)) : '349.2 GB'}`}`; }
  }
  function select(p, add) { if (!add) S.sel.clear(); if (add && S.sel.has(p)) S.sel.delete(p); else if (p) S.sel.add(p); $$('.fi', items).forEach(f => { const on = S.sel.has(f.dataset.p); f.classList.toggle('sel', on); f.setAttribute('aria-selected', on); }); updStatus(); }
  function openSel(p) { const n = getNode(p); if (!n) return; if (S.path === TRASH) return notify('files', 'Restore the item first', 'Files in the Trash can’t be opened.'); n.type === 'dir' ? go(p) : openPath(p); }
  async function rename(p) {
    const [d, name] = splitPath(p), dn = getNode(d), isDir = getNode(p).type === 'dir';
    const r = await winDialog(win, { title: isDir ? 'Rename Folder' : 'Rename File', entry: name, buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Rename', cls: 'sug', value: 'ok' }], validate: v => !v.trim() ? 'Name can’t be empty.' : v.includes('/') ? 'Names can’t contain “/”.' : v !== name && dn.children[v] ? `A ${dn.children[v].type === 'dir' ? 'folder' : 'file'} with that name already exists.` : '' });
    if (r.btn === 'ok' && r.value !== name) { fsMove(p, d + (d === '/' ? '' : '/') + r.value); S.sel = new Set([d + '/' + r.value]); }
  }
  async function newFolder() {
    if (!canWrite(S.path, false)) return notify('files', 'Can’t create a folder here', 'You don’t have permission to change this folder.');
    const r = await winDialog(win, { title: 'New Folder', body: 'Folder name', entry: uniqueName(S.path, 'Untitled Folder'), buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Create', cls: 'sug', value: 'ok' }], validate: v => !v.trim() ? 'Folder name can’t be empty.' : v.includes('/') ? 'Folder names can’t contain “/”.' : getNode(S.path).children[v] ? 'A folder with that name already exists.' : '' });
    if (r.btn === 'ok') { const p = S.path + (S.path === '/' ? '' : '/') + r.value; fsMkdir(p); S.sel = new Set([p]); render(); }
  }
  function newDoc() { if (!canWrite(S.path, false)) return; const n = uniqueName(S.path, 'Untitled Document', '.txt'); fsWrite(S.path + '/' + n, ''); S.sel = new Set([S.path + '/' + n]); render(); }
  function trashSel() { const ps = [...S.sel]; if (!ps.length) return; ps.forEach(p => { if (canWrite(p, false)) trashItem(p); }); S.sel.clear(); notify('files', ps.length === 1 ? `“${splitPath(ps[0])[1]}” moved to Trash` : `${ps.length} items moved to Trash`); }
  async function emptyTrash() { const r = await winDialog(win, { title: 'Empty all items from Trash?', body: 'All items in the Trash will be permanently deleted.', buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Empty Trash', cls: 'destr', value: 'ok' }] }); if (r.btn === 'ok') { getNode(TRASH).children = {}; fsChanged(); } }
  function props(p) {
    const n = getNode(p), [d, name] = splitPath(p);
    winDialog(win, { title: name, body: `<span style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;text-align:left;color:var(--fg)"><b>Type</b><span>${n.type === 'dir' ? 'Folder' : esc(({ text: 'Plain text document', md: 'Markdown document', script: 'Shell script', image: 'PNG image', sheet: 'CSV document', pdf: 'PDF document', iso: 'Raw CD image', archive: 'Zip archive', bin: 'Executable' })[fileKind(name, n)] || 'Document')}</span><b>Size</b><span>${n.type === 'dir' ? Object.keys(n.children).length + ' items' : humanSI(nodeSize(n)) + (nodeSize(n) >= 1000 ? ` (${nodeSize(n).toLocaleString()} bytes)` : '')}</span><b>Location</b><span style="word-break:break-all">${esc(tilde(d))}</span><b>Modified</b><span>${esc(new Date(n.mtime).toLocaleString())}</span></span>`, buttons: [{ label: 'Close', value: 'ok' }] });
  }
  side.onclick = e => { const b = e.target.closest('[data-p]'); if (b) go(b.dataset.p); };
  pathbar.onclick = e => { const b = e.target.closest('[data-p]'); if (b) go(b.dataset.p); };
  banner.onclick = e => { if (e.target.closest('[data-empty]')) emptyTrash(); };
  items.addEventListener('click', e => { const f = e.target.closest('.fi'); select(f ? f.dataset.p : null, f && (e.ctrlKey || e.metaKey)); if (f && e.pointerType === 'touch') openSel(f.dataset.p); });
  items.addEventListener('dblclick', e => { const f = e.target.closest('.fi'); if (f) openSel(f.dataset.p); });
  items.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation(); const f = e.target.closest('.fi'), isTrash = S.path === TRASH;
    if (f) {
      if (!S.sel.has(f.dataset.p)) select(f.dataset.p);
      const p = f.dataset.p, n = getNode(p), ro = !canWrite(p, false);
      showMenu(e.clientX, e.clientY, isTrash ? [{ label: 'Restore From Trash', action: () => { [...S.sel].forEach(x => restoreItem(splitPath(x)[1])); S.sel.clear(); } }, { label: 'Delete Permanently…', action: async () => { const r = await winDialog(win, { title: `Permanently delete “${splitPath(p)[1]}”?`, body: 'If you delete an item, it will be permanently lost.', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Delete', cls: 'destr', value: 'ok' }] }); if (r.btn === 'ok') { [...S.sel].forEach(x => fsRemove(x, { recursive: true })); S.sel.clear(); } } }] : [
        { label: 'Open', action: () => openSel(p) }, n.type === 'file' ? { label: 'Open With Text Editor', action: () => launch('editor', p) } : { label: 'Open in New Window', action: () => FilesApp(p) },
        n.type === 'dir' ? { label: 'Open in Terminal', action: () => launch('terminal', { cwd: p }) } : null, '-',
        { label: 'Copy Location', action: () => { navigator.clipboard && navigator.clipboard.writeText(p).catch(() => { }); } },
        n.type === 'file' ? { label: 'Download to Computer…', action: () => exportFile(p) } : null,
        { label: 'Rename…', kb: 'F2', disabled: ro, action: () => rename(p) }, { label: 'Move to Trash', kb: 'Delete', disabled: ro, action: trashSel }, '-',
        fileKind(p, n) === 'image' ? { label: 'Set as Background', action: () => { const id = n.blob ? 'img:' + n.blob : (n.content || '').replace('wall:', ''); if (WALLS[id] || n.blob) { CFG.wall = id; saveCfg(); renderWall(true); } } } : null,
        { label: 'Properties', action: () => props(p) }]);
    } else {
      select(null);
      showMenu(e.clientX, e.clientY, isTrash ? [{ label: 'Empty Trash…', disabled: !entries().length, action: emptyTrash }] : [
        { label: 'New Folder…', action: newFolder, disabled: !canWrite(S.path, false) }, { label: 'New Document', action: newDoc, disabled: !canWrite(S.path, false) },
        { label: 'Import Files From Computer…', action: () => pickFiles(S.path), disabled: !canWrite(S.path, false) }, '-',
        { label: 'Open in Terminal', action: () => launch('terminal', { cwd: S.path }) }, { label: 'Show Hidden Files', check: S.hidden, action: () => { S.hidden = !S.hidden; render(); } }, '-',
        { label: 'Properties', action: () => props(S.path) }]);
    }
  });
  win.body.addEventListener('keydown', e => {
    if (e.target.closest('input,.wdlg')) return;
    const sel = [...S.sel];
    if (e.key === 'Enter' && sel[0]) openSel(sel[0]);
    else if (e.key === 'Delete' && sel.length && S.path !== TRASH) trashSel();
    else if (e.key === 'F2' && sel[0]) rename(sel[0]);
    else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) { e.preventDefault(); backB.click(); }
    else if (e.altKey && e.key === 'ArrowUp') go(splitPath(S.path)[0]);
    else if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); S.hidden = !S.hidden; render(); }
    else if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); S.sel = new Set(entries().map(x => x.path)); render(); }
    else if (e.ctrlKey && e.shiftKey && (e.key === 'N' || e.key === 'n')) { e.preventDefault(); newFolder(); }
    else if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault(); const es = entries(); if (!es.length) return;
      const cols = S.view === 'list' ? 1 : Math.max(1, Math.round(items.clientWidth / (($('.fi', items) || {}).offsetWidth + 4 || 108)));
      let i = es.findIndex(x => x.path === sel[0]); i = i < 0 ? 0 : clamp(i + ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols })[e.key], 0, es.length - 1);
      select(es[i].path); const f = $$('.fi', items)[i]; f && f.scrollIntoView({ block: 'nearest' });
    }
  });
  const onFs = () => { for (const p of [...S.sel]) if (!getNode(p)) S.sel.delete(p); if (!getNode(S.path)) S.path = HOME; render(); };
  document.addEventListener('fs', onFs); win.onClose = () => document.removeEventListener('fs', onFs);
  win.onFocus = () => items.focus({ preventScroll: true });
  go(getNode(start) && getNode(start).type === 'dir' ? start : HOME, true);
  return win;
}

/* ================= Text Editor ================= */
APPS.editor = { name: 'Text Editor', proc: 'text-editor', kw: 'gedit notepad write text', launch: p => EditorApp(p) };
function EditorApp(path) {
  if (path) { const ex = WM.wins.find(w => w.app === 'editor' && w.path === path); if (ex) { focusWin(ex); return ex; } }
  const win = openWin({ app: 'editor', w: 720, h: 520, minW: 360, minH: 240, mem: 64 });
  win.path = path || null;
  let saved = path ? (getNode(path) || {}).content || '' : '';
  const openB = el(`<button class="hbtn" title="Open">Open ${sym('down')}</button>`);
  openB.onclick = () => {
    const docs = []; const walk = (p, depth) => { const n = getNode(p); if (!n || depth > 2) return; for (const [k, v] of Object.entries(n.children)) { if (k.startsWith('.')) continue; const cp = p + '/' + k; if (v.type === 'dir') walk(cp, depth + 1); else if (['text', 'md', 'script', 'sheet'].includes(fileKind(k, v)) && v.size == null) docs.push([cp, v.mtime]); } };
    walk(HOME, 0); docs.sort((a, b) => b[1] - a[1]);
    menuAt(openB, docs.slice(0, 10).map(([p]) => ({ label: splitPath(p)[1] + '  —  ' + tilde(splitPath(p)[0]), action: () => EditorApp(p) })).concat(['-', { label: 'Browse Files…', action: () => launch('files', HOME + '/Documents') }]));
  };
  win.hl.append(openB, hbtn('plus', 'New Window', () => EditorApp()));
  const saveB = tbtn('Save', () => save());
  const menuB = hbtn('menu', 'Main Menu', () => menuAt(menuB, [{ label: 'Save', kb: 'Ctrl+S', action: () => save() }, { label: 'Save As…', kb: 'Shift+Ctrl+S', action: () => save(true) }, '-', { label: 'Word Wrap', check: wrap, action: () => { wrap = !wrap; ta.style.whiteSpace = wrap ? 'pre-wrap' : 'pre'; gut.hidden = wrap; } }, { label: 'Show in Files', disabled: !win.path, action: () => launch('files', splitPath(win.path)[0]) }, { label: 'Download to Computer…', disabled: !win.path, action: async () => { if (dirty() && !(await save())) return; exportFile(win.path); } }, '-', { label: 'About Text Editor', action: () => notify('editor', 'Text Editor 46.1', 'A simple text editor for the Dusk desktop.') }]));
  win.hr.append(saveB, menuB);
  win.body.innerHTML = `<div class="ed"><div class="ed-gut" aria-hidden="true"></div><textarea class="ed-ta" spellcheck="false" aria-label="Document" id="ed-${win.id}"></textarea></div><div class="ed-status"><span class="ed-kind"></span><span>Tab Width: 4</span><span class="ed-pos">Ln 1, Col 1</span></div>`;
  const ta = $('textarea', win.body), gut = $('.ed-gut', win.body), pos = $('.ed-pos', win.body), kind = $('.ed-kind', win.body);
  let wrap = false;
  ta.value = saved;
  const dirty = () => ta.value !== saved;
  const upd = () => {
    const name = win.path ? splitPath(win.path)[1] : 'Untitled Document';
    win.setTitle((dirty() ? '•' : '') + name, win.path ? tilde(splitPath(win.path)[0]) : 'Draft');
    const n = ta.value.split('\n').length; if (gut.dataset.n != n) { gut.dataset.n = n; gut.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
    const before = ta.value.slice(0, ta.selectionStart), ln = before.split('\n').length, col = before.length - before.lastIndexOf('\n');
    pos.textContent = `Ln ${ln}, Col ${col}`;
    kind.textContent = { md: 'Markdown', script: 'sh', sheet: 'CSV' }[win.path ? fileKind(win.path, getNode(win.path)) : ''] || 'Plain Text';
  };
  ta.addEventListener('input', upd); ta.addEventListener('keyup', upd); ta.addEventListener('click', upd);
  ta.addEventListener('scroll', () => { gut.scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(e.shiftKey); }
    if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('\t', s, ta.selectionEnd, 'end'); upd(); }
  });
  async function save(as) {
    let p = win.path;
    if (!p || as) {
      const dir = p ? splitPath(p)[0] : HOME + '/Documents';
      const r = await winDialog(win, { title: 'Save File', body: `Saves to ${esc(tilde(dir))}`, entry: p ? splitPath(p)[1] : uniqueName(dir, 'Untitled Document', '.txt'), buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Save', cls: 'sug', value: 'ok' }], validate: v => !v.trim() ? 'Name can’t be empty.' : v.includes('/') ? 'Names can’t contain “/”.' : '' });
      if (r.btn !== 'ok') return false;
      p = dir + '/' + r.value;
    }
    try { fsWrite(p, ta.value); } catch (e) { notify('editor', 'Could not save the file', ERR[e] || String(e)); return false; }
    win.path = p; saved = ta.value; upd(); return true;
  }
  win.beforeClose = async () => {
    if (!dirty()) return true;
    focusWin(win);
    const r = await winDialog(win, { title: 'Save Changes?', body: `Open document “${win.path ? esc(splitPath(win.path)[1]) : 'Untitled Document'}” contains unsaved changes. Changes which are not saved will be permanently lost.`, buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Discard', cls: 'destr', value: 'discard' }, { label: 'Save', cls: 'sug', value: 'save' }] });
    if (r.btn === 'discard') return true; if (r.btn === 'save') return await save(); return false;
  };
  win.onFocus = () => ta.focus({ preventScroll: true });
  upd();
  return win;
}

/* ================= Image Viewer ================= */
APPS.viewer = { name: 'Image Viewer', proc: 'loupe', kw: 'photo picture image', launch: p => ViewerApp(p) };
function ViewerApp(path) {
  const win = openWin({ app: 'viewer', w: 820, h: 560, minW: 320, minH: 240, mem: 110 });
  win.body.innerHTML = '<div class="iv"></div>'; const box = $('.iv', win.body);
  const list = () => { const d = path ? splitPath(path)[0] : HOME + '/Pictures', n = getNode(d); return n ? Object.keys(n.children).filter(k => fileKind(k, n.children[k]) === 'image').sort().map(k => d + '/' + k) : []; };
  const prev = hbtn('cl', 'Previous', () => step(-1)), next = hbtn('cr', 'Next', () => step(1));
  win.hl.append(prev, next);
  const setB = tbtn('Set as Background', () => { const n = path && getNode(path), id = n && n.blob ? 'img:' + n.blob : cur(); if (id) { CFG.wall = id; saveCfg(); renderWall(true); notify('settings', 'Background changed', WALLS[id] ? WALLS[id].name : splitPath(path)[1]); } });
  let objURL = null; win.onClose = () => objURL && URL.revokeObjectURL(objURL);
  win.hr.append(setB, hbtn('trash', 'Move to Trash', () => { if (path) { const l = list(), i = l.indexOf(path); trashItem(path); const nl = list(); path = nl[Math.min(i, nl.length - 1)] || null; show(); } }));
  const cur = () => { const n = path && getNode(path); const id = n && (n.content || '').replace('wall:', ''); return WALLS[id] ? id : null; };
  function step(d) { const l = list(); if (!l.length) return; path = l[(l.indexOf(path) + d + l.length) % l.length]; show(); }
  function show() {
    if (!path || !getNode(path)) { box.innerHTML = `<div style="color:#aaa;text-align:center">${sym('pic')}<p>No image</p></div>`; win.setTitle('Image Viewer'); return; }
    const id = cur(), node = getNode(path); win.setTitle(splitPath(path)[1], id ? '3840 × 2160' : '');
    box.innerHTML = ''; prev.disabled = next.disabled = list().length < 2;
    if (node.blob) {
      setB.disabled = false; const img = new Image(); img.alt = splitPath(path)[1]; box.append(img);
      nodeURL(node).then(u => { if (objURL) URL.revokeObjectURL(objURL); objURL = u; if (u) img.src = u; else box.innerHTML = '<p style="color:#aaa">The image’s contents are no longer stored in this browser.</p>'; });
      img.onload = () => win.setTitle(splitPath(path)[1], `${img.naturalWidth} × ${img.naturalHeight} · ${humanSI(node.size)}`);
      return;
    }
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900; box.append(c);
    if (id) WALLS[id].draw(c.getContext('2d'), 1600, 900); else { const g = c.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, 1600, 900); g.fillStyle = '#888'; g.font = '40px sans-serif'; g.textAlign = 'center'; g.fillText('Could not load image', 800, 460); }
    setB.disabled = !id; prev.disabled = next.disabled = list().length < 2;
  }
  win.body.addEventListener('keydown', e => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
  if (!path) path = list()[0] || null;
  show(); return win;
}

/* ================= Calculator ================= */
APPS.calc = { name: 'Calculator', proc: 'calculator', kw: 'math numbers', launch: () => CalcApp() };
function CalcApp() {
  const win = openWin({ app: 'calc', w: 360, h: 520, minW: 300, minH: 420, mem: 38 });
  let mode = 'Basic';
  const modeB = el(`<button class="hbtn">${mode} ${sym('down')}</button>`); modeB.onclick = () => menuAt(modeB, [{ label: 'Basic', check: true }, { label: 'Advanced', disabled: true }, { label: 'Financial', disabled: true }, { label: 'Programming', disabled: true }]);
  win.ht.innerHTML = ''; win.ht.append(modeB); win.setTitle = t => { win.title = t; if (WM.active === win) updateTopApp(); }; win.setTitle('Calculator');
  win.body.innerHTML = `<div class="calc"><div class="calc-disp"><div class="calc-hist"></div><div class="calc-expr" aria-live="polite">0</div></div><div class="calc-keys"></div></div>`;
  const keys = [['7', 'n'], ['8', 'n'], ['9', 'n'], ['÷', ''], ['⌫', 'cl'], ['4', 'n'], ['5', 'n'], ['6', 'n'], ['×', ''], ['C', 'cl'], ['1', 'n'], ['2', 'n'], ['3', 'n'], ['−', ''], ['(', ''], ['0', 'n'], ['.', 'n'], ['%', ''], ['+', ''], [')', ''], ['x²', ''], ['√', ''], ['π', ''], ['!', ''], ['=', 'eq']];
  const kbox = $('.calc-keys', win.body), exE = $('.calc-expr', win.body), hE = $('.calc-hist', win.body);
  kbox.innerHTML = keys.map(([k, c]) => `<button class="${c}" data-k="${esc(k)}">${esc(k)}</button>`).join('');
  let expr = '', justEval = false;
  const show = () => { exE.textContent = expr || '0'; exE.scrollLeft = 1e6; };
  const fmt = v => { if (!isFinite(v)) return 'Division by zero'; const r = parseFloat(v.toPrecision(12)); return Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-9 && r !== 0) ? r.toExponential(6) : String(r); };
  function press(k) {
    if (k === '=') {
      if (!expr) return;
      try { const src = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt').replace(/²/g, '^2').replace(/(\d)%/g, '($1/100)'); const v = calcEval(src); hE.textContent = expr + ' ='; expr = fmt(v); justEval = true; }
      catch (e) { hE.textContent = 'Malformed expression'; }
      return show();
    }
    if (k === 'C') { expr = ''; hE.textContent = ''; return show(); }
    if (k === '⌫') { expr = expr.slice(0, -1); return show(); }
    if (justEval && /[\d.π√(]/.test(k)) expr = '';
    justEval = false;
    expr += k === 'x²' ? '²' : k === '√' ? '√(' : k; show();
  }
  kbox.onclick = e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
  win.frame.addEventListener('keydown', e => {
    if (e.target.closest('input')) return;
    const m = { '*': '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', Delete: 'C', '^': '²' };
    const k = m[e.key] || (/^[\d.+%()!]$/.test(e.key) ? e.key : null);
    if (k) { e.preventDefault(); press(k); const b = $(`[data-k="${CSS.escape(k === '²' ? 'x²' : k)}"]`, kbox); if (b) { b.style.filter = 'brightness(1.3)'; setTimeout(() => b.style.filter = '', 120); } }
  });
  return win;
}

/* ================= Tour ================= */
APPS.tour = { name: 'Tour', proc: 'dusk-tour', kw: 'welcome help intro', single: true, launch: () => TourApp() };
function TourApp() {
  const win = openWin({ app: 'tour', w: 640, h: 500, minW: 340, minH: 380, mem: 41 });
  const slides = [
    [AI.tour(), 'Welcome to NightOS 24.10', 'Umbra is a calm desktop built for long evenings. This short tour shows you around. It takes about a minute.'],
    [AI.apps(), 'Find your apps', 'Click <b>Activities</b> in the top-left corner, or push the pointer into that corner, to see open windows and search all apps. Your favorites live in the dock at the bottom.'],
    [`<svg viewBox="0 0 64 64"><rect x="4" y="12" width="26" height="40" rx="4" style="fill:var(--accent)"/><rect x="34" y="12" width="26" height="40" rx="4" fill="#6f7380"/></svg>`, 'Arrange windows', 'Drag a window to the top edge to maximize it, or to the left or right edge to tile it. Double-click a title bar to toggle maximize. Right-click it for more.'],
    [AI.terminal(), 'Meet the terminal', 'Press <code>Ctrl+Alt+T</code>. Try <code>neofetch</code>, <code>htop</code>, <code>ls -la</code>, or <code>sudo apt install cowsay</code>. Any password works for sudo.'],
    [AI.linux ? AI.linux() : AI.terminal(), 'Real Linux, too', 'Open <b>Linux Terminal</b> from the dock to boot Alpine Linux on a real kernel. It takes about a minute. Then <code>apt install htop</code> downloads real software from the internet.'],
    [AI.settings(), 'Make it yours', 'Open the system menu at the top right for Wi‑Fi, volume, Night Light and Dark Style. Settings has backgrounds and accent colors. Your files and changes stay in this browser.']
  ];
  let i = 0;
  const backB = tbtn('Previous', () => { if (i > 0) { i--; draw(); } }), nextB = tbtn('Next', () => { if (i < slides.length - 1) { i++; draw(); } else { CFG.toured = true; saveCfg(); closeWin(win); } }, 'sug');
  win.hl.append(backB); win.hr.append(nextB);
  win.body.innerHTML = '<div class="tour"></div>'; const box = $('.tour', win.body);
  function draw() {
    const [ic, h, p] = slides[i];
    box.innerHTML = `${ic.replace('<svg', '<svg class="big"')}<h2>${h}</h2><p>${p}</p><div class="tour-dots">${slides.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>`;
    backB.style.visibility = i ? 'visible' : 'hidden'; nextB.textContent = i === slides.length - 1 ? 'Done' : 'Next'; win.setTitle('Tour');
  }
  win.frame.addEventListener('keydown', e => { if (e.key === 'ArrowRight') nextB.click(); if (e.key === 'ArrowLeft') backB.click(); });
  draw(); return win;
}
