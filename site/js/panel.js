'use strict';
/* ================= Panel layout, virtual desktops and the search launcher =================
   The panel replaces the top bar and dock when CFG.look.layout is 'panel'. Its widgets are
   listed in CFG.look.panelWidgets, in order. Pinned apps share the DOCK list in both layouts. */
const APP_CAT = { files: 'System', terminal: 'System', linux: 'System', monitor: 'System', settings: 'System', store: 'System', tour: 'System', hello: 'System', browser: 'Internet', editor: 'Utilities', calc: 'Utilities', viewer: 'Graphics', player: 'Multimedia', htmlplayer: 'Utilities' };
const appCat = k => APP_CAT[k] || (k.startsWith('app:') ? ((CFG.installed.find(a => appKey(a.id) === k) || {}).category || 'Apps').replace('Web Apps', 'Internet') : 'Apps');
const launchable = () => [...new Set([...GRID_APPS, 'hello'])].filter(k => APPS[k] && k !== 'htmlplayer');

// Pinned apps survive reloads in CFG.look.favs.
if (Array.isArray(CFG.look.favs)) { const f = CFG.look.favs.filter(k => APPS[k]); if (f.length) DOCK.splice(0, DOCK.length, ...f); }
function saveFavs() { CFG.look.favs = DOCK.filter(k => APPS[k]); saveCfg(); }
function toggleFav(k) {
  const i = DOCK.indexOf(k); if (i >= 0) DOCK.splice(i, 1); else DOCK.push(k);
  const a = CFG.installed.find(x => appKey(x.id) === k); if (a) a.pinned = DOCK.includes(k);
  saveFavs(); updateDock();
}

/* ---------- virtual desktops ---------- */
const WS = { cur: 0 };
function wsCount() { return clamp(LOOK().desktops | 0, 1, 6); }
openWin = (orig => o => { const w = orig(o); w.ws = WS.cur; return w; })(openWin);
focusWin = (orig => win => { if (win.ws != null && win.ws !== WS.cur) switchDesktop(win.ws, true); return orig(win); })(focusWin);
focusTop = function () {
  const vis = WM.wins.filter(w => !w.min && !w.closing && (w.ws == null || w.ws === WS.cur)).sort((a, b) => b.z - a.z);
  if (vis[0]) focusWin(vis[0]); else { WM.active = null; WM.wins.forEach(w => w.el.classList.remove('active')); updateTopApp(); updateDock(); }
};
function applyDesktops() { for (const w of WM.wins) { if (w.ws >= wsCount()) w.ws = wsCount() - 1; w.el.classList.toggle('ws-off', w.ws !== WS.cur); } }
function switchDesktop(i, quiet) {
  const n = wsCount(); i = ((i % n) + n) % n; if (i === WS.cur) return;
  WS.cur = i; applyDesktops();
  if (!quiet) { focusTop(); osd(`Desktop ${i + 1}`); }
  renderPanel(); renderWsDots();
}
function moveToDesktop(win, i) { win.ws = i; applyDesktops(); if (WM.active === win && i !== WS.cur) focusTop(); renderPanel(); }
function renderWsDots() { const d = $('#act .ws'); if (d) d.innerHTML = Array.from({ length: wsCount() }, (_, i) => `<i class="${i === WS.cur ? 'on' : ''}"></i>`).join(''); }
let osdT;
function osd(text) {
  let o = $('#osd'); if (!o) { o = el('<div id="osd" role="status"></div>'); $('#os').append(o); }
  o.textContent = text; o.classList.add('show'); clearTimeout(osdT); osdT = setTimeout(() => o.classList.remove('show'), 900);
}

/* ---------- panel ---------- */
const svgIcon = (d, extra = '') => `<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
function panelClock() {
  const L = LOOK(), d = new Date(), h = L.clock24 ? pad(d.getHours()) : (d.getHours() % 12 || 12), t = `${h}:${pad(d.getMinutes())}${L.clockSec ? ':' + pad(d.getSeconds()) : ''}${L.clock24 ? '' : d.getHours() < 12 ? ' AM' : ' PM'}`;
  return `<b>${t}</b>${L.clockDate ? `<small>${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}</small>` : ''}`;
}
function renderPanel() {
  const L = LOOK(), os = $('#os');
  let p = $('#panel');
  if (L.layout !== 'panel') { if (p) p.hidden = true; $('#topbar').hidden = false; $('#dock').hidden = false; renderWsDots(); setResVars(); return; }
  $('#topbar').hidden = true; $('#dock').hidden = true;
  if (!p) { p = el('<nav id="panel" aria-label="Panel"></nav>'); os.insertBefore(p, $('#toasts')); bindPanel(p); }
  p.hidden = false;
  p.innerHTML = `<div class="pn-in">${L.panelWidgets.map(w => {
    switch (w) {
      case 'launcher': return `<button class="pn-btn pn-launch" data-pn="launcher" aria-label="Application launcher" title="Applications">${LOGO}</button>`;
      case 'pager': return wsCount() > 1 ? `<div class="pn-pager" role="tablist" aria-label="Virtual desktops">${Array.from({ length: wsCount() }, (_, i) => { const n = WM.wins.filter(x => x.ws === i).length; return `<button data-ws="${i}" class="${i === WS.cur ? 'on' : ''}" title="Desktop ${i + 1}${n ? ` · ${n} window${n > 1 ? 's' : ''}` : ''}" aria-label="Desktop ${i + 1}">${'<i></i>'.repeat(Math.min(n, 4))}</button>`; }).join('')}</div>` : '';
      case 'tasks': return '<div class="pn-tasks" aria-label="Task manager"></div>';
      case 'spacer': return '<span class="pn-sp"></span>';
      case 'tray': return `<button class="pn-btn pn-tray" data-pn="tray" data-qs-anchor aria-label="System menu">${trayIcons()}</button>`;
      case 'clock': return `<button class="pn-btn pn-clock" data-pn="clock" data-cal-anchor aria-label="Calendar and notifications">${panelClock()}</button>`;
      case 'desktop': return `<button class="pn-btn pn-desk" data-pn="desktop" aria-label="Show desktop" title="Show Desktop">${svgIcon('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/>')}</button>`;
    }
    return '';
  }).join('')}</div>`;
  renderTasks(); setResVars();
}
function setResVars() {
  const r = RESERVE(), rs = document.documentElement.style;
  rs.setProperty('--res-top', r.top + 'px'); rs.setProperty('--res-bottom', r.bottom + 'px'); rs.setProperty('--res-left', r.left + 'px');
}
function renderTasks() {
  const box = $('#panel .pn-tasks'); if (!box) return;
  const L = LOOK(), here = WM.wins.filter(w => w.ws === WS.cur);
  const running = [...new Set(here.map(w => w.app))], items = [...DOCK.filter(k => APPS[k]), ...running.filter(k => !DOCK.includes(k))];
  const ico = k => AI[k] ? AI[k]() : AI.settings();
  if (!L.taskTitles) {
    box.innerHTML = items.map(k => { const n = here.filter(w => w.app === k).length, act = WM.active && WM.active.app === k; return `<button class="pn-task ${act ? 'act' : ''} ${n ? 'run' : ''}" data-app="${k}" title="${esc(APPS[k].name)}" aria-label="${esc(APPS[k].name)}">${ico(k)}<span class="pn-ind">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`; }).join('');
  } else {
    const pinnedIdle = DOCK.filter(k => APPS[k] && !running.includes(k));
    box.innerHTML = pinnedIdle.map(k => `<button class="pn-task" data-app="${k}" title="${esc(APPS[k].name)}" aria-label="${esc(APPS[k].name)}">${ico(k)}</button>`).join('')
      + here.slice().sort((a, b) => a.id - b.id).map(w => `<button class="pn-task wide run ${WM.active === w ? 'act' : ''} ${w.min ? 'minimized' : ''}" data-win="${w.id}" title="${esc(w.title)}">${ico(w.app)}<span class="pn-tt">${esc(w.title)}</span></button>`).join('');
  }
}
function bindPanel(p) {
  p.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ws) return switchDesktop(+b.dataset.ws);
    if (b.dataset.app) { closeKick(); return dockClick(b.dataset.app); }
    if (b.dataset.win) { const w = WM.wins.find(x => x.id === +b.dataset.win); if (!w) return; if (WM.active === w && !w.min) minimizeWin(w); else w.min ? restoreWin(w) : focusWin(w); return; }
    const k = b.dataset.pn;
    if (k === 'launcher') toggleKick();
    else if (k === 'tray') { closeKick(); toggleQS(); }
    else if (k === 'clock') { closeKick(); toggleCal(); }
    else if (k === 'desktop') showDesktop();
  });
  p.addEventListener('wheel', e => { if (e.target.closest('.pn-pager')) { e.preventDefault(); switchDesktop(WS.cur + (e.deltaY > 0 ? 1 : -1)); } }, { passive: false });
  p.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    const t = e.target.closest('[data-app],[data-win]');
    const below = LOOK().panelPos === 'bottom', at = (items) => { showMenu(e.clientX, below ? e.clientY - 12 - items.filter(Boolean).length * 34 : e.clientY + 8, items); };
    if (t) {
      const k = t.dataset.app || (WM.wins.find(x => x.id === +t.dataset.win) || {}).app, ws = WM.wins.filter(w => w.app === k);
      const items = [...ws.map(w => ({ label: w.title, action: () => focusWin(w) })), ws.length ? '-' : null,
        APPS[k].single && ws.length ? null : { label: 'New Window', action: () => APPS[k].launch() },
        { label: DOCK.includes(k) ? 'Unpin from Task Manager' : 'Pin to Task Manager', action: () => toggleFav(k) },
        ws.length && wsCount() > 1 ? { label: `Move to Desktop ${((WS.cur + 1) % wsCount()) + 1}`, action: () => ws.forEach(w => moveToDesktop(w, (WS.cur + 1) % wsCount())) } : null,
        ws.length ? '-' : null, ws.length ? { label: ws.length > 1 ? `Close ${ws.length} Windows` : 'Close', action: () => ws.forEach(w => closeWin(w)) } : null];
      return at(items);
    }
    at([{ label: 'Configure Panel…', icon: 'gear', action: () => launch('settings', 'panel') }, { label: 'Change Global Theme…', icon: 'palette', action: () => launch('settings', 'theme') },
      { label: 'Add Widgets to Desktop…', icon: 'plus', action: () => launch('settings', 'desktopcfg') }, '-',
      { label: 'Switch to Top Bar + Dock', action: () => setLook('layout', 'dock') }]);
  });
}
let shownDesk = null;
function showDesktop() {
  const here = WM.wins.filter(w => w.ws === WS.cur);
  if (shownDesk && shownDesk.length && here.every(w => w.min)) { shownDesk.forEach(w => WM.wins.includes(w) && restoreWin(w)); shownDesk = null; return; }
  shownDesk = here.filter(w => !w.min); shownDesk.forEach(w => minimizeWin(w));
}

/* ---------- app launcher menu ---------- */
let kickOpen = false, kickCat = 'Favorites';
function toggleKick() { kickOpen ? closeKick() : openKick(); }
function closeKick() { kickOpen = false; const k = $('#kick'); if (k) k.remove(); const b = $('#panel .pn-launch'); if (b) b.classList.remove('open'); }
function openKick() {
  closePops(); closeMenu(); kickOpen = true;
  const k = el(`<div class="pop" id="kick" role="dialog" aria-label="Application launcher">
    <label class="kk-search">${sym('search')}<input id="kk-q" placeholder="Search apps, files and settings" autocomplete="off" aria-label="Search"></label>
    <div class="kk-body"><nav class="kk-cats"></nav><div class="kk-list"></div></div>
    <div class="kk-foot"><span class="avatar" style="width:34px;height:34px;font-size:15px">N</span><b>Night</b><span class="sp"></span>
      <button class="circ" data-kp="settings" title="Settings" aria-label="Settings">${sym('gear')}</button><button class="circ" data-kp="lock" title="Lock" aria-label="Lock">${sym('lock')}</button><button class="circ" data-kp="logout" title="Log Out" aria-label="Log Out">${sym('logout')}</button><button class="circ" data-kp="restart" title="Restart" aria-label="Restart">${sym('restart')}</button><button class="circ" data-kp="off" title="Shut Down" aria-label="Shut Down">${sym('power')}</button></div></div>`);
  $('#os').append(k); $('#panel .pn-launch') && $('#panel .pn-launch').classList.add('open');
  const q = $('#kk-q', k), list = $('.kk-list', k), cats = $('.kk-cats', k);
  const CATS = ['Favorites', 'All Applications', ...new Set(launchable().map(appCat))].filter((c, i, a) => a.indexOf(c) === i);
  const drawCats = () => { cats.innerHTML = [...CATS, 'Places'].map(c => `<button class="${c === kickCat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join(''); };
  const tile = kk => `<button class="kk-app" data-launch="${kk}">${AI[kk] ? AI[kk]() : ''}<span>${esc(APPS[kk].name)}</span></button>`;
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    if (s) { cats.hidden = true; list.innerHTML = searchResults(s, 12).map(r => `<button class="kk-row" data-res="${r.i}">${r.icon}<span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span></button>`).join('') || `<p class="kk-none">No results for “${esc(q.value)}”</p>`; return; }
    cats.hidden = false; drawCats();
    if (kickCat === 'Places') { list.innerHTML = [['Home', HOME], ['Desktop', HOME + '/Desktop'], ['Documents', HOME + '/Documents'], ['Downloads', HOME + '/Downloads'], ['Pictures', HOME + '/Pictures'], ['Music', HOME + '/Music'], ['Trash', TRASH]].map(([n, p]) => `<button class="kk-row" data-place="${esc(p)}">${p === TRASH ? AI.trash() : nodeIcon(p, getNode(p) || { type: 'dir' })}<span><b>${n}</b><small>${esc(tilde(p))}</small></span></button>`).join(''); return; }
    const apps = kickCat === 'Favorites' ? DOCK.filter(x => APPS[x]) : kickCat === 'All Applications' ? launchable().sort((a, b) => APPS[a].name.localeCompare(APPS[b].name)) : launchable().filter(x => appCat(x) === kickCat);
    list.innerHTML = `<div class="kk-grid">${apps.map(tile).join('')}</div>`;
  };
  let results = [];
  const searchResults = (s, n) => { results = runnerResults(s).slice(0, n); return results.map((r, i) => ({ ...r, i })); };
  draw(); q.oninput = draw; setTimeout(() => q.focus(), 30);
  q.onkeydown = e => { if (e.key === 'Enter') { const f = $('[data-res],[data-launch]', list); if (f) f.click(); } if (e.key === 'Escape') closeKick(); };
  k.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'); if (c) { kickCat = c.dataset.cat; return draw(); }
    const l = e.target.closest('[data-launch]'); if (l) { closeKick(); return launch(l.dataset.launch); }
    const r = e.target.closest('[data-res]'); if (r) { closeKick(); return results[+r.dataset.res].run(); }
    const pl = e.target.closest('[data-place]'); if (pl) { closeKick(); return launch('files', pl.dataset.place); }
    const pw = e.target.closest('[data-kp]'); if (pw) { closeKick(); const a = pw.dataset.kp; if (a === 'settings') launch('settings'); else if (a === 'lock') SYSTEM.lock(); else SYSTEM.powerAction(a === 'off' ? 'off' : a); }
  });
  k.addEventListener('contextmenu', e => { const l = e.target.closest('[data-launch]'); if (!l) return; e.preventDefault(); e.stopPropagation(); const kk = l.dataset.launch; showMenu(e.clientX, e.clientY, [{ label: 'Open', action: () => { closeKick(); launch(kk); } }, { label: DOCK.includes(kk) ? 'Remove from Favorites' : 'Add to Favorites', action: () => { toggleFav(kk); draw(); } }]); });
}
document.addEventListener('pointerdown', e => { if (kickOpen && !e.target.closest('#kick,.pn-launch,.menu')) closeKick(); }, true);

/* ---------- search launcher (Alt+F2 or Ctrl+Space) ---------- */
const SETTING_PAGES = [['wifi', 'Wi‑Fi'], ['bt', 'Bluetooth'], ['displays', 'Displays'], ['sound', 'Sound'], ['power', 'Power'], ['theme', 'Global Theme'], ['colors', 'Colors & Fonts'], ['background', 'Wallpaper'], ['panel', 'Panel & Dock'], ['windows', 'Windows'], ['desktopcfg', 'Desktop & Widgets'], ['terminalcfg', 'Terminal'], ['notifications', 'Notifications'], ['snapshots', 'Snapshots'], ['linuxvm', 'Linux VM'], ['about', 'System']];
function runnerResults(s) {
  const out = [];
  if (/^[\d\s+\-*/().^%,πe]+$/.test(s.replace(/^=/, '')) && /\d/.test(s)) { try { const v = calcEval(s.replace(/^=/, '').replace(/,/g, '.')); if (isFinite(v)) { const r = String(parseFloat(v.toPrecision(12))); out.push({ icon: AI.calc(), title: `= ${r}`, sub: 'Calculator · press Enter to copy', run: () => { navigator.clipboard && navigator.clipboard.writeText(r).catch(() => { }); notify('calc', 'Copied ' + r); } }); } } catch (e) { } }
  if (s.startsWith('>')) { const cmd = s.slice(1).trim(); if (cmd) out.push({ icon: AI.terminal(), title: cmd, sub: 'Run in Terminal', run: () => runInTerminal(cmd) }); return out; }
  for (const k of launchable()) { const a = APPS[k], hay = `${a.name} ${a.kw || ''}`.toLowerCase(); if (hay.includes(s)) out.push({ icon: AI[k] ? AI[k]() : '', title: a.name, sub: appCat(k), run: () => launch(k), score: a.name.toLowerCase().startsWith(s) ? 0 : 1 }); }
  for (const [id, name] of SETTING_PAGES) if (name.toLowerCase().includes(s)) out.push({ icon: AI.settings(), title: name, sub: 'Settings', run: () => launch('settings', id), score: 2 });
  const files = []; const walk = (p, d) => { const n = getNode(p); if (!n || n.type !== 'dir' || d > 4 || files.length > 8) return; for (const [k, v] of Object.entries(n.children)) { if (k.startsWith('.')) continue; const cp = p + '/' + k; if (k.toLowerCase().includes(s)) files.push([cp, v]); if (v.type === 'dir') walk(cp, d + 1); } };
  if (s.length > 1) walk(HOME, 0);
  files.slice(0, 6).forEach(([p, v]) => out.push({ icon: nodeIcon(p, v), title: splitPath(p)[1], sub: tilde(splitPath(p)[0]), run: () => openPath(p), score: 3 }));
  out.sort((a, b) => (a.score || 0) - (b.score || 0));
  out.push({ icon: AI.terminal(), title: `Run “${s}” in Terminal`, sub: 'Terminal', run: () => runInTerminal(s), score: 8 });
  out.push({ icon: AI.browser(), title: `Search the web for “${s}”`, sub: 'Opens in a new browser tab', run: () => window.open('https://duckduckgo.com/?q=' + encodeURIComponent(s), '_blank', 'noopener'), score: 9 });
  return out;
}
function runInTerminal(cmd) { const w = launch('terminal'); setTimeout(() => { const T = w && w.T; if (T && T.runDisplay) T.runDisplay(cmd); }, 120); }
let runnerOpen = false;
function toggleRunner() { runnerOpen ? closeRunner() : openRunner(); }
function closeRunner() { runnerOpen = false; const r = $('#runner'); if (r) r.remove(); }
function openRunner() {
  if (SYSTEM.state !== 'desktop') return; closePops(); closeKick(); closeOverview(); runnerOpen = true;
  const r = el(`<div id="runner" role="dialog" aria-label="Search"><label class="rn-box">${sym('search')}<input id="rn-q" placeholder="Search apps, files, settings, or type = 2+2, > command" autocomplete="off" aria-label="Search"><kbd>Esc</kbd></label><div class="rn-list" role="listbox"></div></div>`);
  $('#os').append(r);
  const q = $('#rn-q', r), list = $('.rn-list', r); let res = [], sel = 0;
  const draw = () => { const s = q.value.trim().toLowerCase(); res = s ? runnerResults(s).slice(0, 9) : []; sel = Math.min(sel, Math.max(0, res.length - 1)); list.innerHTML = res.map((x, i) => `<button class="rn-row ${i === sel ? 'sel' : ''}" data-i="${i}" role="option" aria-selected="${i === sel}">${x.icon}<span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span></button>`).join(''); list.hidden = !res.length; };
  draw(); q.oninput = () => { sel = 0; draw(); }; setTimeout(() => q.focus(), 20);
  q.onkeydown = e => {
    if (e.key === 'Escape') { e.preventDefault(); closeRunner(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter' && res[sel]) { e.preventDefault(); const x = res[sel]; closeRunner(); x.run(); }
  };
  list.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { const x = res[+b.dataset.i]; closeRunner(); x.run(); } };
  r.addEventListener('pointerdown', e => { if (e.target === r) closeRunner(); });
}
document.addEventListener('keydown', e => {
  if (SYSTEM.state !== 'desktop') return;
  const k = e.key;
  if ((e.altKey && k === 'F2') || (e.ctrlKey && k === ' ') || (e.altKey && k === ' ')) { e.preventDefault(); toggleRunner(); }
  else if (e.ctrlKey && e.altKey && (k === 'ArrowRight' || k === 'ArrowLeft')) { e.preventDefault(); switchDesktop(WS.cur + (k === 'ArrowRight' ? 1 : -1)); }
  else if (e.ctrlKey && e.altKey && e.shiftKey && /^[1-6]$/.test(k) && WM.active) { e.preventDefault(); moveToDesktop(WM.active, +k - 1); }
  else if (e.ctrlKey && /^F[1-6]$/.test(k)) { e.preventDefault(); switchDesktop(+k.slice(1) - 1); }
  else if (k === 'Escape' && kickOpen) closeKick();
});

/* ---------- keep the panel in sync with the rest of the shell ---------- */
updateDock = (orig => () => { orig(); renderTasks(); const p = $('#panel .pn-pager'); if (p) renderPanelPager(); })(updateDock);
function renderPanelPager() { const box = $('#panel .pn-pager'); if (!box) return; $$('button', box).forEach((b, i) => { const n = WM.wins.filter(x => x.ws === i).length; b.innerHTML = '<i></i>'.repeat(Math.min(n, 4)); b.classList.toggle('on', i === WS.cur); }); }
renderTray = (orig => () => { orig(); const t = $('#panel .pn-tray'); if (t) t.innerHTML = trayIcons(); })(renderTray);
renderClock = (orig => () => { orig(); const c = $('#panel .pn-clock'); if (c) c.innerHTML = panelClock(); })(renderClock);
setInterval(() => { if (LOOK().clockSec) { const c = $('#panel .pn-clock'); if (c) c.innerHTML = panelClock(); } }, 1000);
updateTopApp = (orig => () => { orig(); renderTasks(); })(updateTopApp);
document.addEventListener('look', () => { applyDesktops(); renderWsDots(); });
addEventListener('resize', () => setResVars());
CMDS.krunner = () => { openRunner(); };
