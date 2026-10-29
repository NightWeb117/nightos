'use strict';
/* ================= Windows programs (desktop app only) =================
   Lists the shortcuts and .exe files on your Windows desktop, plus programs you add, and runs
   them through the desktop app. The first run of each program is confirmed in a native dialog. */
const WINP = { desk: [], loaded: false };
const winId = p => { let h = 5381; for (const c of p.toLowerCase()) h = (h * 33 ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
const winKey = p => 'win:' + winId(p.path);
const winIcon = p => p.icon ? `<svg viewBox="0 0 64 64"><image href="${p.icon}" x="10" y="10" width="44" height="44"/></svg>` : tileSVG('#3a6ea5', p.name);

if (NATIVE) {
  CFG.winApps = CFG.winApps || [];
  if (CFG.winOnDesk === undefined) CFG.winOnDesk = true;
  AI.winapps = () => `<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="44" rx="8" fill="#1d3b5e"/><rect x="6" y="10" width="52" height="10" rx="8" fill="#2c5a8a"/><g fill="#7cc4f0"><rect x="15" y="26" width="15" height="10" rx="2"/><rect x="34" y="26" width="15" height="10" rx="2"/><rect x="15" y="39" width="15" height="10" rx="2"/><rect x="34" y="39" width="15" height="10" rx="2"/></g></svg>`;
  APPS.winapps = { name: 'Windows Programs', proc: 'windows-programs', kw: 'windows programs exe apps desktop shortcuts run', single: true, launch: () => WinAppsApp() };
  APP_CAT.winapps = 'Windows';
  if (!GRID_APPS.includes('winapps')) GRID_APPS.splice(1, 0, 'winapps');
  CFG.winApps.forEach(registerWin);
  loadWinDesktop();
  // Windows desktop items appear on the NightOS desktop after Home and before Trash.
  renderDesktop = (orig => () => {
    orig();
    if (!CFG.winOnDesk || !WINP.desk.length) return;
    const d = $('#desk'), trash = d.lastElementChild;
    for (const p of WINP.desk) d.insertBefore(el(`<button class="di" data-path="winexe:${esc(p.path)}" title="${esc(p.path)}">${winIcon(p)}<span>${esc(p.name)}</span></button>`), trash);
  })(renderDesktop);
  openPath = (orig => p => { if (String(p).startsWith('winexe:')) { const prog = findWin(p.slice(7)); return prog && runWin(prog); } return orig(p); })(openPath);
  $('#desk').addEventListener('contextmenu', e => {
    const b = e.target.closest('.di[data-path^="winexe:"]'); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const prog = findWin(b.dataset.path.slice(7));
    showMenu(e.clientX, e.clientY, [{ label: 'Run', action: () => runWin(prog) }, { label: DOCK.includes(winKey(prog)) ? 'Unpin from Task Manager' : 'Pin to Task Manager', action: () => { registerWin(prog); toggleFav(winKey(prog)); } }, '-', { label: 'Open Windows Programs', action: () => launch('winapps') }, { label: 'Hide Windows Shortcuts from This Desktop', action: () => { CFG.winOnDesk = false; saveCfg(); renderDesktop(); } }]);
  }, true);
  // Programs dragged in from File Explorer are added instead of copied into NightOS's files.
  addEventListener('drop', async e => {
    const files = [...((e.dataTransfer && e.dataTransfer.files) || [])]; if (!files.length || !files.every(f => /\.(exe|lnk|url)$/i.test(f.name))) return;
    e.preventDefault(); e.stopImmediatePropagation();
    for (const f of files) { const p = NATIVE.pathForFile(f); if (!p) continue; try { addWin(await NATIVE.describeProgram(p)); } catch (err) { notify('winapps', `Couldn't add ${f.name}`, err.message); } }
  }, true);
}
function findWin(path) { const n = path.toLowerCase(); return [...WINP.desk, ...CFG.winApps].find(p => p.path.toLowerCase() === n); }
function registerWin(p) {
  const k = winKey(p);
  APPS[k] = { name: p.name, proc: (p.target || p.path).split('\\').pop(), kw: 'windows program ' + p.kind, launch: () => runWin(p) };
  AI[k] = () => winIcon(p); APP_CAT[k] = 'Windows';
  if (!GRID_APPS.includes(k)) GRID_APPS.push(k);
}
async function loadWinDesktop() {
  try { WINP.desk = await NATIVE.desktopPrograms(); } catch (e) { WINP.desk = []; WINP.error = e.message; }
  WINP.loaded = true; WINP.desk.forEach(registerWin);
  renderDesktop(); updateDock(); document.dispatchEvent(new Event('winapps'));
}
function addWin(p) {
  if (!CFG.winApps.some(x => x.path.toLowerCase() === p.path.toLowerCase())) { CFG.winApps.push({ path: p.path, name: p.name, kind: p.kind, target: p.target, icon: p.icon }); saveCfg(); }
  registerWin(p); updateDock(); document.dispatchEvent(new Event('winapps'));
  notify('winapps', `${p.name} added`, 'Find it in Windows Programs and the app launcher.');
}
function removeWin(p) {
  CFG.winApps = CFG.winApps.filter(x => x.path.toLowerCase() !== p.path.toLowerCase()); saveCfg();
  if (!WINP.desk.some(x => x.path.toLowerCase() === p.path.toLowerCase())) { const k = winKey(p); delete APPS[k]; const i = GRID_APPS.indexOf(k); if (i >= 0) GRID_APPS.splice(i, 1); const j = DOCK.indexOf(k); if (j >= 0) { DOCK.splice(j, 1); saveFavs(); } }
  updateDock(); document.dispatchEvent(new Event('winapps'));
}
async function runWin(p) {
  try {
    const r = await NATIVE.runProgram(p.path);
    if (r.cancelled) return;
    if (r.ok) notify('winapps', `Opening ${p.name}`, 'It opens in its own window on top of NightOS.');
    else notify('winapps', `Couldn't open ${p.name}`, r.error || 'Windows refused to start it.');
  } catch (e) { notify('winapps', `Couldn't open ${p.name}`, e.message); }
}

/* ---------- Windows Programs app ---------- */
function WinAppsApp() {
  const win = openWin({ app: 'winapps', w: 860, h: 580, minW: 380, minH: 320, mem: 40 });
  let q = '', sel = null;
  const qi = el(`<label class="gl-q no-drag">${sym('search')}<input placeholder="Search programs" aria-label="Search programs" autocomplete="off"></label>`);
  win.hl.append(qi);
  win.hr.append(hbtn('reload', 'Refresh', () => { WINP.loaded = false; render(); loadWinDesktop(); }), tbtn('Add Program…', async () => { const list = await NATIVE.pickProgram(); list.forEach(addWin); }, 'sug'));
  win.body.innerHTML = '<div class="ap wp" tabindex="0"></div>'; const box = $('.wp', win.body);
  const card = (p, mine) => `<button class="wp-card ${sel === p.path ? 'sel' : ''}" data-p="${esc(p.path)}" data-mine="${mine ? 1 : 0}" title="${esc(p.path)}">${winIcon(p)}<b>${esc(p.name)}</b><small>${p.kind === 'lnk' ? 'Shortcut' : p.kind === 'url' ? 'Internet shortcut' : 'Program'}</small></button>`;
  function render() {
    win.setTitle('Windows Programs');
    const match = p => !q || p.name.toLowerCase().includes(q);
    const desk = WINP.desk.filter(match), mine = CFG.winApps.filter(match);
    box.innerHTML = `<div class="ap-page">
      <div class="wp-note">${sym('info')}<span>These are real Windows programs. They open in their own windows on top of NightOS, with full access to your PC. NightOS asks you to confirm each one the first time.</span></div>
      <h3 class="ap-h">On your Windows desktop</h3>
      ${!WINP.loaded ? '<div class="ap-empty"><span class="spinner" style="border-color:var(--press);border-top-color:var(--accent)"></span></div>' : desk.length ? `<div class="wp-grid">${desk.map(p => card(p, false)).join('')}</div>` : `<p class="ap-note" style="text-align:left">${q ? 'No matches.' : 'No programs or shortcuts on your Windows desktop.'}</p>`}
      <h3 class="ap-h">Added programs</h3>
      ${mine.length ? `<div class="wp-grid">${mine.map(p => card(p, true)).join('')}</div>` : `<div class="wp-add"><p>${q ? 'No matches.' : 'Add any program from your PC, or drag an .exe or shortcut from File Explorer onto NightOS.'}</p><button class="hbtn sug" data-add>Add Program…</button></div>`}
    </div>`;
  }
  const progAt = b => findWin(b.dataset.p);
  $('input', qi).oninput = e => { q = e.target.value.trim().toLowerCase(); render(); };
  box.addEventListener('click', async e => {
    if (e.target.closest('[data-add]')) { (await NATIVE.pickProgram()).forEach(addWin); return; }
    const b = e.target.closest('.wp-card'); if (!b) return;
    sel = b.dataset.p; $$('.wp-card', box).forEach(x => x.classList.toggle('sel', x === b));
    if (e.detail >= 2 || e.pointerType === 'touch') runWin(progAt(b));
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && sel) { const p = findWin(sel); if (p) runWin(p); } });
  box.addEventListener('contextmenu', e => {
    const b = e.target.closest('.wp-card'); if (!b) return; e.preventDefault(); e.stopPropagation();
    const p = progAt(b), k = winKey(p), mine = b.dataset.mine === '1';
    showMenu(e.clientX, e.clientY, [{ label: 'Run', action: () => runWin(p) }, { label: DOCK.includes(k) ? 'Unpin from Task Manager' : 'Pin to Task Manager', action: () => toggleFav(k) }, mine ? '-' : null, mine ? { label: 'Remove from NightOS', action: () => removeWin(p) } : null]);
  });
  const onUpd = () => render(); document.addEventListener('winapps', onUpd); win.onClose = () => document.removeEventListener('winapps', onUpd);
  win.onFocus = () => box.focus({ preventScroll: true });
  render(); return win;
}
