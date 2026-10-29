'use strict';
/* ================= menus ================= */
let menuEl = null;
function showMenu(x, y, items) {
  closeMenu();
  const m = el('<div class="menu" role="menu"></div>');
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { m.append(el('<hr>')); continue; }
    const b = el(`<button role="menuitem">${it.icon ? sym(it.icon) : ''}<span>${esc(it.label)}</span>${it.kb ? `<span class="kb">${esc(it.kb)}</span>` : ''}${it.check !== undefined ? `<span class="kb">${it.check ? sym('check') : ''}</span>` : ''}</button>`);
    if (it.disabled) b.disabled = true;
    b.addEventListener('click', () => { closeMenu(); it.action && it.action(); });
    m.append(b);
  }
  $('#os').append(m);
  const r = m.getBoundingClientRect();
  m.style.left = clamp(x, 4, innerWidth - r.width - 4) + 'px';
  m.style.top = clamp(y, BAR, innerHeight - r.height - 4) + 'px';
  menuEl = m;
}
function closeMenu() { if (menuEl) menuEl.remove(); menuEl = null; }
function menuAt(btn, items) { const r = btn.getBoundingClientRect(); showMenu(r.left, r.bottom + 4, items); }

/* ================= notifications ================= */
const NOTES = [];
function notify(app, title, body = '', opts = {}) {
  const n = { app, title, body, time: Date.now(), action: opts.action, actionLabel: opts.actionLabel };
  NOTES.unshift(n); if (NOTES.length > 30) NOTES.pop();
  renderClock();
  if (CFG.dnd && !opts.urgent) return;
  if (SYSTEM.state === 'desktop' && !opts.silent) playSound();
  const icon = AI[app] ? AI[app]() : AI.settings();
  const t = el(`<div class="toast" role="status"><svg class="ai" viewBox="0 0 64 64">${icon.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg><div><b><span>${esc(title)}</span><small>now</small></b>${body ? `<p>${esc(body)}</p>` : ''}${n.actionLabel ? `<button class="act">${esc(n.actionLabel)}</button>` : ''}</div></div>`);
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  t.addEventListener('click', e => { if (e.target.closest('.act') && n.action) n.action(); kill(); });
  $('#toasts').prepend(t); setTimeout(kill, opts.ms || 5200);
  while ($('#toasts').children.length > 3) $('#toasts').lastChild.remove();
}

/* ================= shell modal (power dialogs) ================= */
function shellDialog({ title, body, buttons, countdown }) {
  $('#modal') && $('#modal').remove();
  const m = el(`<div id="modal"><div class="mcard" role="alertdialog"><h2>${esc(title)}</h2><p></p><div class="mbtns"></div></div></div>`);
  const p = $('p', m), bx = $('.mbtns', m); let iv;
  const close = () => { clearInterval(iv); m.remove(); };
  buttons.forEach(b => { const x = el(`<button class="${b.cls || ''}">${esc(b.label)}</button>`); x.onclick = () => { close(); b.action && b.action(); }; bx.append(x); });
  if (countdown) {
    let n = countdown.secs; const upd = () => p.textContent = body.replace('{n}', n);
    upd(); iv = setInterval(() => { n--; if (n <= 0) { close(); countdown.done(); } else upd(); }, 1000);
  } else p.textContent = body;
  m.addEventListener('pointerdown', e => { if (e.target === m) close(); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $('#os').append(m); setTimeout(() => bx.lastChild.focus(), 30);
}

/* ================= top bar ================= */
function trayIcons() {
  const net = CFG.plane ? sym('plane') : netUp() ? sym('wifi') : sym('wifioff');
  const vol = CFG.volume === 0 ? sym('mute') : CFG.volume < 45 ? sym('vollow') : sym('vol');
  return net + vol + batterySym(CFG.battery) + sym('power');
}
function renderTray() { $('#tray').innerHTML = trayIcons(); const lb = $('.lk-tray'); if (lb) lb.innerHTML = trayIcons().replace(sym('power'), ''); }
function clockText(d = new Date()) { return `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}  ${hhmm(d)}`; }
function renderClock() {
  const d = new Date();
  $('#clock').innerHTML = `${CFG.dnd ? sym('belloff') : NOTES.length && !calOpen ? '<i class="dnd"></i>' : ''}<span><span class="cl-date">${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}&nbsp;&nbsp;</span>${hhmm(d)}</span>`;
}
function updateTopApp() {
  const w = WM.active, t = $('#tbapp');
  t.innerHTML = w ? `${AI[w.app] ? AI[w.app]() : ''}<span>${esc(APPS[w.app].name)}</span>` : '';
}
let lastMinute = -1;
setInterval(() => {
  const d = new Date();
  if (d.getMinutes() !== lastMinute) { lastMinute = d.getMinutes(); renderClock(); if (window.renderLockClock) renderLockClock(); }
}, 1000);

/* ================= popovers: quick settings + calendar ================= */
let qsOpen = false, calOpen = false, qsPower = false, calMonth = null;
function closePops() {
  qsOpen = calOpen = false; $('#qs') && $('#qs').remove(); $('#cal') && $('#cal').remove();
  $('#tray').classList.remove('open'); $('#clock').classList.remove('open'); renderClock();
}
document.addEventListener('pointerdown', e => {
  if (menuEl && !menuEl.contains(e.target)) closeMenu();
  if (qsOpen && !e.target.closest('#qs,#tray,[data-qs-anchor]')) closePops();
  if (calOpen && !e.target.closest('#cal,#clock,[data-cal-anchor]')) closePops();
}, true);
function setSlider(inp, v) { inp.value = v; inp.style.setProperty('--v', v + '%'); }
function toggleQS() {
  if (qsOpen) return closePops();
  closePops(); qsOpen = true; qsPower = false; $('#tray').classList.add('open'); renderQS();
}
function renderQS() {
  let q = $('#qs'); if (!q) { q = el('<div class="pop" id="qs" role="dialog" aria-label="System menu"></div>'); $('#os').append(q); }
  const pw = { balanced: 'Balanced', saver: 'Power Saver', perf: 'Performance' }[CFG.power];
  q.innerHTML = `
  <div class="qs-top"><span class="qs-bat">${batterySym(CFG.battery)}${CFG.battery} %</span><span class="sp"></span>
    <button class="circ" data-q="shot" aria-label="Take Screenshot" title="Take Screenshot">${sym('pic')}</button><button class="circ" data-q="settings" aria-label="Settings">${sym('gear')}</button><button class="circ" data-q="lock" aria-label="Lock">${sym('lock')}</button><button class="circ" data-q="power" aria-label="Power Off">${sym('power')}</button></div>
  ${qsPower ? `<div class="qs-power"><button data-p="suspend">${sym('suspend')}Suspend</button><button data-p="restart">${sym('restart')}Restart…</button><button data-p="off">${sym('power')}Power Off…</button><hr style="border:0;height:1px;background:rgba(255,255,255,.1);margin:4px 8px"><button data-p="logout">${sym('logout')}Log Out…</button></div>` : ''}
  <div class="qs-slider">${sym(CFG.volume === 0 ? 'mute' : 'vol')}<input type="range" class="sl" id="qs-vol" min="0" max="100" aria-label="Volume"></div>
  <div class="qs-slider">${sym('sun')}<input type="range" class="sl" id="qs-bright" min="10" max="100" aria-label="Brightness"></div>
  <div class="qs-grid">
    <button class="qt ${CFG.wifi && !CFG.plane ? 'on' : ''}" data-t="wifi">${sym(netUp() ? 'wifi' : 'wifioff')}<span><b>Wi‑Fi</b><small>${CFG.plane ? 'Airplane Mode' : !CFG.wifi ? 'Off' : REAL.online ? esc(CFG.net) : 'Disconnected'}</small></span></button>
    <button class="qt ${CFG.bt && !CFG.plane ? 'on' : ''}" data-t="bt">${sym('bt')}<span><b>Bluetooth</b><small>${CFG.bt && !CFG.plane ? 'Lumen Keys' : 'Off'}</small></span></button>
    <button class="qt ${CFG.power !== 'balanced' ? 'on' : ''}" data-t="power">${sym('bolt')}<span><b>Power Mode</b><small>${pw}</small></span></button>
    <button class="qt ${CFG.night ? 'on' : ''}" data-t="night">${sym('moon')}<span><b>Night Light</b><small>${CFG.night ? 'On' : 'Off'}</small></span></button>
    <button class="qt ${CFG.style === 'dark' ? 'on' : ''}" data-t="style">${sym('palette')}<span><b>Dark Style</b><small>${CFG.style === 'dark' ? 'On' : 'Off'}</small></span></button>
    <button class="qt ${CFG.plane ? 'on' : ''}" data-t="plane">${sym('plane')}<span><b>Airplane Mode</b></span></button>
    <button class="qt ${CFG.dnd ? 'on' : ''}" data-t="dnd">${sym(CFG.dnd ? 'belloff' : 'bell')}<span><b>Do Not Disturb</b></span></button>
  </div>`;
  const vol = $('#qs-vol', q), br = $('#qs-bright', q);
  setSlider(vol, CFG.volume); setSlider(br, CFG.bright);
  vol.oninput = () => { CFG.volume = +vol.value; setSlider(vol, CFG.volume); renderTray(); saveCfg(); document.dispatchEvent(new Event('cfg')); };
  vol.onchange = () => { playSound('pop'); renderQS(); };
  br.oninput = () => { CFG.bright = +br.value; setSlider(br, CFG.bright); applyLook(); saveCfg(); document.dispatchEvent(new Event('cfg')); };
  q.onclick = e => {
    const t = e.target.closest('[data-t]'), c = e.target.closest('[data-q]'), p = e.target.closest('[data-p]');
    if (t) { toggleSetting(t.dataset.t); renderQS(); }
    if (c) {
      if (c.dataset.q === 'shot') { closePops(); setTimeout(takeScreenshot, 250); }
      if (c.dataset.q === 'settings') { closePops(); launch('settings'); }
      if (c.dataset.q === 'lock') { closePops(); SYSTEM.lock(); }
      if (c.dataset.q === 'power') { qsPower = !qsPower; renderQS(); }
    }
    if (p) { closePops(); SYSTEM.powerAction(p.dataset.p); }
  };
}
function toggleSetting(k) {
  if (k === 'wifi') { if (CFG.plane) CFG.plane = false; CFG.wifi = !CFG.wifi; if (CFG.wifi) setTimeout(() => notify('settings', 'Connected to ' + CFG.net, 'Wi‑Fi network is now available'), 900); }
  else if (k === 'bt') { if (CFG.plane) CFG.plane = false; CFG.bt = !CFG.bt; }
  else if (k === 'power') CFG.power = { balanced: 'saver', saver: 'perf', perf: 'balanced' }[CFG.power];
  else if (k === 'night') CFG.night = !CFG.night;
  else if (k === 'style') CFG.style = CFG.style === 'dark' ? 'light' : 'dark';
  else if (k === 'plane') CFG.plane = !CFG.plane;
  else if (k === 'dnd') CFG.dnd = !CFG.dnd;
  saveCfg(); applyLook(); renderTray(); renderClock(); document.dispatchEvent(new Event('cfg'));
}
function toggleCal() {
  if (calOpen) return closePops();
  closePops(); calOpen = true; calMonth = new Date(); calMonth.setDate(1); $('#clock').classList.add('open'); renderCal();
}
function renderCal() {
  let c = $('#cal'); if (!c) { c = el('<div class="pop" id="cal" role="dialog" aria-label="Notifications and calendar"></div>'); $('#os').append(c); }
  const today = new Date(), y = calMonth.getFullYear(), m = calMonth.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), prevDays = new Date(y, m, 0).getDate();
  let cells = WD.map(d => `<span class="wd">${d[0]}</span>`).join('');
  for (let i = 0; i < 42; i++) {
    const dn = i - first + 1; let cls = '', txt;
    if (dn < 1) { txt = prevDays + dn; cls = 'om'; } else if (dn > days) { txt = dn - days; cls = 'om'; } else { txt = dn; if (dn === today.getDate() && m === today.getMonth() && y === today.getFullYear()) cls = 'td'; }
    cells += `<span class="${cls}">${txt}</span>`;
  }
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : hhmm(new Date(t)); };
  c.innerHTML = `<div class="cal-n">${NOTES.length ? `<div class="cal-list">${NOTES.map(n => `<div class="ncard"><svg class="ai" viewBox="0 0 64 64">${(AI[n.app] ? AI[n.app]() : AI.settings()).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg><div><b><span>${esc(n.title)}</span><small>${ago(n.time)}</small></b>${n.body ? `<p>${esc(n.body)}</p>` : ''}</div></div>`).join('')}</div>` : `<div class="empty">${sym('bell')}<span>No Notifications</span></div>`}
    <div class="cal-foot"><span>Do Not Disturb</span><button class="sw ${CFG.dnd ? 'on' : ''}" id="cal-dnd" role="switch" aria-checked="${CFG.dnd}" aria-label="Do Not Disturb"></button><span class="sp"></span><button class="hbtn" id="cal-clear" style="background:var(--sh-pop-2)" ${NOTES.length ? '' : 'disabled'}>Clear</button></div></div>
    <div class="cal-r"><div class="cal-day">${WDAYS[today.getDay()]}</div><div class="cal-big">${MONTHS[today.getMonth()]} ${today.getDate()} ${today.getFullYear()}</div>
    <div class="cal-head"><button class="hbtn" id="cal-prev" aria-label="Previous month">${sym('cl')}</button><span>${MONTHS[m]}${y !== today.getFullYear() ? ' ' + y : ''}</span><button class="hbtn" id="cal-next" aria-label="Next month">${sym('cr')}</button></div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-card"><b>Today</b>No events</div><div class="cal-card"><b>Uptime</b>${uptimeStr()}</div></div>`;
  $('#cal-prev', c).onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCal(); };
  $('#cal-next', c).onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCal(); };
  $('#cal-dnd', c).onclick = () => { toggleSetting('dnd'); renderCal(); };
  $('#cal-clear', c).onclick = () => { NOTES.length = 0; renderCal(); renderClock(); };
}

/* ================= dock ================= */
const DOCK = ['files', 'browser', 'terminal', 'editor', 'monitor', 'calc', 'settings'];
function updateDock() {
  const d = $('#dock'); if (!d) return;
  const running = [...new Set(WM.wins.map(w => w.app))].filter(a => !DOCK.includes(a));
  const items = [...DOCK, ...(running.length ? ['|', ...running] : []), '|', 'apps'];
  d.innerHTML = items.map(a => {
    if (a === '|') return '<span class="dk-sep"></span>';
    if (a === 'apps') return `<button class="dk" data-app="__apps" aria-label="Show Apps">${AI.apps()}<span class="tip">Show Apps</span></button>`;
    const n = WM.wins.filter(w => w.app === a).length, f = WM.active && WM.active.app === a;
    return `<button class="dk ${f ? 'focus' : ''}" data-app="${a}" aria-label="${esc(APPS[a].name)}">${AI[a]()}<span class="tip">${esc(APPS[a].name)}</span><span class="dots">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`;
  }).join('');
}
function bounceDock(app) { const b = $(`.dk[data-app="${app}"]`); if (b) { b.classList.remove('launch'); void b.offsetWidth; b.classList.add('launch'); setTimeout(() => b.classList.remove('launch'), 1300); } }
function dockClick(app) {
  if (app === '__apps') return toggleOverview(true);
  const ws = WM.wins.filter(w => w.app === app);
  if (!ws.length) { launch(app); return; }
  if (WM.active && WM.active.app === app) {
    if (ws.length > 1) { focusWin(ws.slice().sort((a, b) => a.z - b.z)[0]); } else minimizeWin(WM.active);
    return;
  }
  const top = ws.slice().sort((a, b) => b.z - a.z)[0]; top.min ? restoreWin(top) : focusWin(top);
}
function initDock() {
  const d = $('#dock');
  d.addEventListener('click', e => { const b = e.target.closest('.dk'); if (b) { closeOverview(); dockClick(b.dataset.app); } });
  d.addEventListener('contextmenu', e => {
    e.preventDefault(); const b = e.target.closest('.dk'); if (!b || b.dataset.app === '__apps') return;
    const a = b.dataset.app, ws = WM.wins.filter(w => w.app === a), r = b.getBoundingClientRect();
    const items = [...ws.map(w => ({ label: w.title, action: () => focusWin(w) })), ws.length ? '-' : null,
    APPS[a].single && ws.length ? null : { label: 'New Window', action: () => APPS[a].launch() },
    { label: 'App Details', action: () => launch('settings', 'about') }, ws.length ? '-' : null, ws.length ? { label: ws.length > 1 ? `Quit ${ws.length} Windows` : 'Quit', action: () => ws.forEach(w => closeWin(w)) } : null];
    showMenu(r.left, r.top - 10 - (items.filter(Boolean).length * 34 + 12), items);
  });
  updateDock();
}

/* ================= overview ================= */
let ovOpen = false;
const GRID_APPS = ['files', 'browser', 'terminal', 'editor', 'monitor', 'calc', 'settings', 'viewer', 'player', 'tour'];
function toggleOverview(appsFocus) { ovOpen ? closeOverview() : openOverview(appsFocus); }
function openOverview() {
  if (SYSTEM.state !== 'desktop') return;
  closePops(); closeMenu(); ovOpen = true;
  const ov = el(`<div id="ov"><label class="ov-search">${sym('search')}<input id="ov-q" placeholder="Type to search" aria-label="Search apps" autocomplete="off"></label><div class="ov-wins"></div><div class="ov-grid" role="list"></div></div>`);
  const wins = $('.ov-wins', ov);
  WM.wins.slice().sort((a, b) => a.id - b.id).forEach(w => {
    const tw = Math.min(220, Math.max(120, w.r.w * .22)), sc = tw / w.r.w, th = w.r.h * sc;
    const card = el(`<button class="ov-win"><div class="ov-thumb" style="width:${tw}px;height:${th}px"></div><span>${AI[w.app]()}${esc(w.title)}</span></button>`);
    const clone = w.frame.cloneNode(true); clone.style.width = w.r.w + 'px'; clone.style.height = w.r.h + 'px'; clone.style.transform = `scale(${sc})`;
    $$('canvas', clone).forEach(cv => cv.remove()); $$('[id]', clone).forEach(n => n.removeAttribute('id'));
    $('.ov-thumb', card).append(clone);
    card.onclick = e => { e.stopPropagation(); closeOverview(); w.min ? restoreWin(w) : focusWin(w); };
    wins.append(card);
  });
  const grid = $('.ov-grid', ov), q = $('#ov-q', ov);
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const list = GRID_APPS.filter(a => !s || APPS[a].name.toLowerCase().includes(s) || (APPS[a].kw || '').includes(s));
    grid.innerHTML = list.length ? list.map((a, i) => `<button class="ov-app ${s && i === 0 ? 'sel' : ''}" data-app="${a}" role="listitem">${AI[a]()}<span>${esc(APPS[a].name)}</span></button>`).join('') : `<div class="ov-none">No results for “${esc(q.value)}”</div>`;
    wins.hidden = !!s;
  };
  draw(); q.oninput = draw;
  q.onkeydown = e => { if (e.key === 'Enter') { const f = $('.ov-app', grid); if (f) { closeOverview(); launch(f.dataset.app); } } };
  grid.onclick = e => { const b = e.target.closest('.ov-app'); if (b) { e.stopPropagation(); closeOverview(); launch(b.dataset.app); } };
  ov.addEventListener('click', e => { if (e.target === ov || e.target === grid || e.target === wins) closeOverview(); });
  $('#os').insertBefore(ov, $('#toasts')); setTimeout(() => q.focus(), 30);
  $('#act').classList.add('open');
}
function closeOverview() { if (!ovOpen) return; ovOpen = false; $('#ov') && $('#ov').remove(); $('#act').classList.remove('open'); }

/* ================= desktop icons ================= */
let deskSel = null;
function renderDesktop() {
  const d = $('#desk'), dn = getNode(HOME + '/Desktop');
  const items = [{ name: 'Home', path: HOME, svg: AI.home() }, ...(dn ? Object.keys(dn.children).filter(k => !k.startsWith('.')).sort().map(k => ({ name: k, path: HOME + '/Desktop/' + k, svg: nodeIcon(HOME + '/Desktop/' + k, dn.children[k]) })) : []), { name: 'Trash', path: TRASH, svg: AI.trash() }];
  d.innerHTML = items.map(i => `<button class="di ${deskSel === i.path ? 'sel' : ''}" data-path="${esc(i.path)}">${i.svg}<span>${esc(i.name)}</span></button>`).join('');
}
function initDesktop() {
  const d = $('#desk');
  d.addEventListener('click', e => { const b = e.target.closest('.di'); deskSel = b ? b.dataset.path : null; $$('.di', d).forEach(x => x.classList.toggle('sel', x === b)); if (b && e.pointerType === 'touch') openPath(b.dataset.path); });
  d.addEventListener('dblclick', e => { const b = e.target.closest('.di'); if (b) openPath(b.dataset.path); });
  d.addEventListener('keydown', e => { const b = e.target.closest('.di'); if (b && e.key === 'Enter') openPath(b.dataset.path); });
  d.addEventListener('contextmenu', e => {
    const b = e.target.closest('.di'); if (!b) return; e.preventDefault(); e.stopPropagation();
    const p = b.dataset.path, sys = p === HOME || p === TRASH;
    showMenu(e.clientX, e.clientY, [{ label: 'Open', action: () => openPath(p) }, !sys && getNode(p) && getNode(p).type === 'file' ? { label: 'Open With Text Editor', action: () => launch('editor', p) } : null,
    sys ? null : '-', sys ? null : { label: 'Move to Trash', action: () => trashItem(p) },
    p === TRASH ? '-' : null, p === TRASH ? { label: 'Empty Trash', disabled: !Object.keys(getNode(TRASH).children).length, action: () => { getNode(TRASH).children = {}; fsChanged(); notify('files', 'Trash emptied'); } } : null]);
  });
  $('#wallhost').addEventListener('pointerdown', () => { deskSel = null; $$('.di').forEach(x => x.classList.remove('sel')); });
  const bgMenu = e => {
    if (e.target.closest('.win,.di,#dock,#topbar,.menu,.pop,#ov')) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY, [
      { label: 'New Folder', icon: 'folderNew', action: () => { const n = uniqueName(HOME + '/Desktop', 'Untitled Folder'); fsMkdir(HOME + '/Desktop/' + n); } },
      { label: 'New Document', icon: 'doc', action: () => { const n = uniqueName(HOME + '/Desktop', 'Untitled Document', '.txt'); fsWrite(HOME + '/Desktop/' + n, ''); launch('editor', HOME + '/Desktop/' + n); } }, '-',
      { label: 'Open in Terminal', icon: 'term', action: () => launch('terminal', { cwd: HOME + '/Desktop' }) },
      { label: 'Show Desktop in Files', icon: 'home', action: () => launch('files', HOME + '/Desktop') },
      { label: 'Import Files From Computer…', icon: 'download', action: () => pickFiles(HOME + '/Desktop') }, '-',
      { label: 'Add Widgets…', icon: 'plus', action: () => launch('settings', 'desktopcfg') },
      { label: 'Change Background…', icon: 'pic', action: () => launch('settings', 'background') },
      { label: 'Customize the Look…', icon: 'palette', action: () => launch('settings', 'theme') },
      { label: 'Display Settings', icon: 'display', action: () => launch('settings', 'displays') },
      { label: 'Settings', icon: 'gear', action: () => launch('settings') }]);
  };
  $('#os').addEventListener('contextmenu', bgMenu);
  document.addEventListener('fs', renderDesktop);
  renderDesktop();
}
function openPath(p) {
  const n = getNode(p); if (!n) return;
  if (n.type === 'dir') return launch('files', p);
  const k = fileKind(splitPath(p)[1], n);
  if (k === 'image') return launch('viewer', p);
  if (k === 'audio' || k === 'video') return launch('player', p);
  if (['text', 'md', 'script', 'sheet'].includes(k) && n.size == null) return launch('editor', p);
  const e = extOf(p);
  notify('files', `Could not open “${splitPath(p)[1]}”`, e ? `No installed app can open .${e} files.` : 'This file type is not supported.');
}

/* ================= wiring ================= */
function initShell() {
  $('#act').onclick = () => toggleOverview();
  $('#tray').onclick = toggleQS;
  $('#clock').onclick = toggleCal;
  let hot = false;
  document.addEventListener('pointermove', e => {
    if (e.clientX <= 1 && e.clientY <= 1) { if (!hot && SYSTEM.state === 'desktop' && e.buttons === 0 && (!CFG.look || CFG.look.hotCorner)) { hot = true; toggleOverview(); } }
    else if (e.clientX > 12 || e.clientY > 12) hot = false;
  });
  document.addEventListener('keydown', e => {
    if (SYSTEM.state !== 'desktop') return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey && e.altKey && k === 't') { e.preventDefault(); closeOverview(); launch('terminal'); }
    else if (e.ctrlKey && e.altKey && k === 'l') { e.preventDefault(); SYSTEM.lock(); }
    else if (e.ctrlKey && e.altKey && k === 'd') { e.preventDefault(); WM.wins.forEach(w => !w.min && minimizeWin(w)); }
    else if (e.altKey && e.key === 'F1') { e.preventDefault(); toggleOverview(); }
    else if (e.key === 'PrintScreen') { e.preventDefault(); takeScreenshot(); }
    else if (e.key === 'Escape') { if (menuEl) closeMenu(); else if (ovOpen) closeOverview(); else if (qsOpen || calOpen) closePops(); }
  });
  initDock(); initDesktop(); renderTray(); renderClock();
}
