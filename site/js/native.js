'use strict';
/* ================= Desktop app features =================
   Active only inside NightOS.exe, whose preload script provides window.nightosNative.
   It launches real Discord, Steam and Steam games, and shows real websites in NightOS windows. */
const NATIVE = window.nightosNative || null;
// Nightfox asks this for every address: a real https URL means "load the actual website".
function nativeRealUrl(u, raw) {
  if (!NATIVE || u.startsWith('about:')) return null;
  if (u.startsWith('search.nightos.org')) { const q = decodeURIComponent((u.split('q=')[1] || '')); return 'https://duckduckgo.com/?q=' + encodeURIComponent(q); }
  const host = u.split('/')[0];
  if (/(^|\.)nightos\.org$/.test(host)) return null;
  return /^https?:\/\//i.test(raw.trim()) ? raw.trim() : 'https://' + u;
}
const STEAM = { games: [], scanned: false, found: false };
const fmtSize = b => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e6) + ' MB';
const ago = t => { if (!t) return 'Never played'; const d = (Date.now() - t) / 864e5; return d < 1 ? 'Played today' : d < 2 ? 'Played yesterday' : d < 30 ? `Played ${Math.floor(d)} days ago` : `Played ${MON[new Date(t).getMonth()]} ${new Date(t).getFullYear()}`; };

if (NATIVE) {
  document.documentElement.classList.add('is-desktop');
  AI.games = () => `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="14" fill="#1b2838"/><path d="M20 24h24a9 9 0 0 1 8.7 11.3l-2.2 8.2a5 5 0 0 1-8.6 2L38 41H26l-3.9 4.5a5 5 0 0 1-8.6-2l-2.2-8.2A9 9 0 0 1 20 24z" style="fill:var(--accent)"/><path d="M21 30v8M17 34h8" stroke="#0b1418" stroke-width="3" stroke-linecap="round"/><circle cx="41" cy="31" r="2.3" fill="#0b1418"/><circle cx="46" cy="36" r="2.3" fill="#0b1418"/></svg>`;
  AI.discordapp = () => tileSVG('#5865f2', 'D');
  AI.steamapp = () => tileSVG('#1b2838', 'S');
  AI.webapp = () => AI.browser();
  APPS.games = { name: 'Game Library', proc: 'game-library', kw: 'steam games play library launch', single: true, launch: () => GameLibraryApp() };
  APPS.discordapp = { name: 'Discord', proc: 'Discord.exe', kw: 'discord chat voice friends', launch: () => nativeDiscord() };
  APPS.steamapp = { name: 'Steam', proc: 'steam.exe', kw: 'steam store games', launch: () => nativeLaunch('steam', null, 'Steam is opening in its own window.') };
  APPS.webapp = { name: 'Web App', proc: 'webview', kw: '', launch: a => a && WebAppWindow(a) };
  Object.assign(APP_CAT, { games: 'Games', steamapp: 'Games', discordapp: 'Internet' });
  for (const k of ['games', 'steamapp', 'discordapp']) if (!GRID_APPS.includes(k)) GRID_APPS.splice(1, 0, k);
  if (!CFG.desktopSetup) { CFG.desktopSetup = true; const i = DOCK.indexOf('store'); DOCK.splice(i < 0 ? DOCK.length : i, 0, 'games'); saveFavs(); }
  // Web apps from App Center open as real NightOS windows instead of browser tabs.
  runStoreApp = (orig => a => a && a.kind === 'web' ? WebAppWindow(a, appKey(a.id)) : orig(a))(runStoreApp);
  // Power Off leaves the app after the shutdown sequence.
  SYSTEM.poweroff = async () => { await SYSTEM.shutdownSeq(false); NATIVE.quit(); };
  updateDock();
  scanSteam();
}
async function nativeLaunch(kind, arg, msg) {
  try { const ok = await NATIVE.launch(kind, arg); if (msg) notify(kind === 'steamGame' ? 'games' : 'store', ok === false ? 'Couldn\'t start it' : msg.split('|')[0], msg.split('|')[1] || ''); return ok; }
  catch (e) { notify('store', 'Couldn\'t start it', e.message); return false; }
}
async function nativeDiscord() {
  const ok = await nativeLaunch('discord');
  if (ok) notify('discordapp', 'Opening Discord', 'Discord starts in its own window.');
  else { notify('discordapp', 'Discord isn\'t installed', 'Opening Discord in a NightOS window instead.'); WebAppWindow({ id: 'discord', name: 'Discord', url: 'https://discord.com/app', color: '#5865f2', letter: 'D' }); }
}
async function scanSteam() {
  try {
    const r = await NATIVE.steamGames(); STEAM.found = r.steam; STEAM.games = r.games || []; STEAM.scanned = true;
    for (const g of STEAM.games) {
      const k = 'steam:' + g.appid;
      APPS[k] = { name: g.name, proc: 'steam game', kw: 'game steam play', launch: () => playGame(g) };
      AI[k] = () => g.header ? `<svg viewBox="0 0 64 64"><rect x="4" y="8" width="56" height="48" rx="10" fill="#0e141b"/><image href="nightos://steam/${g.appid}/header" x="6" y="17" width="52" height="30" preserveAspectRatio="xMidYMid slice"/></svg>` : tileSVG('#1b2838', g.name);
      APP_CAT[k] = 'Games';
      if (!GRID_APPS.includes(k)) GRID_APPS.push(k);
    }
    updateDock(); document.dispatchEvent(new Event('steam'));
  } catch (e) { STEAM.scanned = true; STEAM.error = e.message; document.dispatchEvent(new Event('steam')); }
}
function playGame(g) {
  if (!g.ready) return notify('games', `${g.name} isn't ready`, g.updating ? 'Steam is still downloading or updating it.' : 'Open Steam to finish installing it.');
  nativeLaunch('steamGame', g.appid, `Starting ${g.name}|Steam opens the game in its own window. NightOS is here when you quit.`);
  g.lastPlayed = Date.now();
}

/* ---------- Game Library ---------- */
function GameLibraryApp() {
  const win = openWin({ app: 'games', w: 1040, h: 660, minW: 420, minH: 360, mem: 60 });
  let q = '', sort = 'recent';
  const qi = el(`<label class="gl-q no-drag">${sym('search')}<input placeholder="Search your games" aria-label="Search games" autocomplete="off"></label>`);
  win.hl.append(qi);
  const sortB = el(`<select class="gl-sort no-drag" aria-label="Sort"><option value="recent">Recently played</option><option value="name">Name</option><option value="size">Size</option></select>`);
  win.hr.append(sortB, hbtn('reload', 'Rescan library', () => { STEAM.scanned = false; render(); scanSteam(); }),
    tbtn('Big Picture', () => nativeLaunch('bigpicture', null, 'Opening Steam Big Picture|Controller-friendly Steam opens in its own window.')),
    tbtn('Open Steam', () => nativeLaunch('steam', null, 'Opening Steam|Steam opens in its own window.'), 'sug'));
  win.body.innerHTML = '<div class="ap gl"></div>'; const box = $('.gl', win.body);
  function render() {
    win.setTitle('Game Library', STEAM.found ? `${STEAM.games.length} installed game${STEAM.games.length === 1 ? '' : 's'}` : '');
    if (!STEAM.scanned) { box.innerHTML = '<div class="ap-empty"><span class="spinner" style="border-color:var(--press);border-top-color:var(--accent)"></span><p>Reading your Steam library…</p></div>'; return; }
    if (!STEAM.found) { box.innerHTML = `<div class="ap-empty">${AI.games()}<b>Steam isn't installed</b><p>Install Steam, sign in and install a game. It shows up here automatically.</p><button class="hbtn sug" data-get-steam>Get Steam</button></div>`; return; }
    let list = STEAM.games.filter(g => !q || g.name.toLowerCase().includes(q));
    list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : sort === 'size' ? (a, b) => b.size - a.size : (a, b) => (b.lastPlayed - a.lastPlayed) || a.name.localeCompare(b.name));
    if (!STEAM.games.length) { box.innerHTML = `<div class="ap-empty">${AI.games()}<b>No games installed yet</b><p>Games you install in Steam appear here, ready to play.</p><button class="hbtn sug" data-open-steam>Open Steam</button></div>`; return; }
    const recent = sort === 'recent' && !q ? list.filter(g => g.lastPlayed).slice(0, 1)[0] : null;
    box.innerHTML = `<div class="gl-page">${recent ? `<div class="gl-hero" style="--img:url('nightos://steam/${recent.appid}/header')"><div><small>Continue playing</small><h2>${esc(recent.name)}</h2><p>${ago(recent.lastPlayed)} · ${fmtSize(recent.size)}</p><button class="hbtn sug gl-play" data-play="${recent.appid}">${playIcon()} Play</button></div></div>` : ''}
      <div class="gl-grid">${list.map(g => `<button class="gl-card ${g.ready ? '' : 'notready'}" data-play="${g.appid}" title="${esc(g.name)}">
        <span class="gl-art">${g.cover ? `<img alt="" src="nightos://steam/${g.appid}/cover" loading="lazy">` : g.header ? `<img alt="" class="wide" src="nightos://steam/${g.appid}/header" loading="lazy">` : `<span class="gl-ph">${esc(g.name)}</span>`}<span class="gl-hover">${playIcon()}</span>${g.ready ? '' : `<span class="gl-badge">${g.updating ? 'Updating' : 'Not ready'}</span>`}</span>
        <b>${esc(g.name)}</b><small>${ago(g.lastPlayed)} · ${fmtSize(g.size)}</small></button>`).join('') || '<p class="kk-none">No games match your search.</p>'}</div></div>`;
  }
  const playIcon = () => '<svg class="sym" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  $('input', qi).oninput = e => { q = e.target.value.trim().toLowerCase(); render(); };
  sortB.onchange = () => { sort = sortB.value; render(); };
  box.addEventListener('click', e => {
    const p = e.target.closest('[data-play]'); if (p) { const g = STEAM.games.find(x => x.appid === p.dataset.play); if (g) playGame(g); render(); return; }
    if (e.target.closest('[data-get-steam]')) NATIVE.openExternal('https://store.steampowered.com/about/');
    if (e.target.closest('[data-open-steam]')) nativeLaunch('steam', null, 'Opening Steam');
  });
  box.addEventListener('contextmenu', e => {
    const p = e.target.closest('[data-play]'); if (!p) return; e.preventDefault(); e.stopPropagation();
    const g = STEAM.games.find(x => x.appid === p.dataset.play), k = 'steam:' + g.appid;
    showMenu(e.clientX, e.clientY, [{ label: 'Play', action: () => playGame(g) }, { label: 'Game Details in Steam', action: () => nativeLaunch('steamPage', g.appid) }, '-', { label: DOCK.includes(k) ? 'Unpin from Task Manager' : 'Pin to Task Manager', action: () => toggleFav(k) }]);
  });
  const onSteam = () => render(); document.addEventListener('steam', onSteam); win.onClose = () => document.removeEventListener('steam', onSteam);
  render(); return win;
}

/* ---------- web apps in NightOS windows ---------- */
function WebAppWindow(a, appId) {
  const win = openWin({ app: appId && APPS[appId] ? appId : 'webapp', w: 1100, h: 720, minW: 420, minH: 320, mem: 240 });
  win.setTitle(a.name, new URL(a.url).hostname);
  const back = hbtn('back', 'Back', () => wv.canGoBack() && wv.goBack()), fwd = hbtn('fwd', 'Forward', () => wv.canGoForward() && wv.goForward());
  win.hl.append(back, fwd, hbtn('reload', 'Reload', () => wv.reload()));
  win.hr.append(hbtn('open', 'Open in your web browser', () => NATIVE.openExternal(wv.getURL() || a.url)));
  win.body.innerHTML = `<webview class="appweb" partition="persist:web" allowpopups src="${esc(a.url)}"></webview>`;
  const wv = $('webview', win.body);
  const upd = () => { try { back.disabled = !wv.canGoBack(); fwd.disabled = !wv.canGoForward(); } catch (e) { } };
  wv.addEventListener('did-navigate', upd); wv.addEventListener('did-navigate-in-page', upd); wv.addEventListener('dom-ready', upd);
  wv.addEventListener('page-title-updated', e => win.setTitle(a.name, e.title));
  win.onFocus = () => wv.focus();
  return win;
}

/* ---------- updates from GitHub releases ---------- */
const UPDATE = { s: null, told: '' };
function updateText(s) {
  if (!s) return 'Checking…';
  if (s.kind === 'dev') return 'Updates are off while running from source';
  return {
    idle: `Version ${s.current}`, checking: 'Checking for updates…', none: `Version ${s.current} is the latest`,
    available: s.kind === 'portable' ? `Version ${s.version} is available. Download it and run it instead of this copy` : `Version ${s.version} is available`,
    downloading: `Downloading version ${s.version}… ${s.progress || 0}%`, ready: `Version ${s.version} is ready. It installs when you restart NightOS`,
    error: 'Couldn’t check for updates' + (s.error ? `: ${s.error}` : '')
  }[s.status] || '';
}
function updateButton(s) {
  if (!s || s.kind === 'dev') return '';
  if (s.status === 'ready') return '<button class="hbtn sug" data-up-install>Restart to Update</button>';
  if (s.status === 'available') return `<button class="hbtn sug" data-up-install>${s.kind === 'portable' ? 'Download' : 'Download Update'}</button>`;
  return `<button class="hbtn" data-up-check style="background:var(--press)" ${s.status === 'checking' || s.status === 'downloading' ? 'disabled' : ''}>Check Now</button>`;
}
if (NATIVE && NATIVE.onUpdate) {
  const onState = s => {
    UPDATE.s = s;
    const key = s.status + s.version;
    if ((s.status === 'ready' || s.status === 'available') && UPDATE.told !== key) {
      UPDATE.told = key;
      if (s.status === 'ready') notify('settings', `NightOS ${s.version} is ready`, 'Restart NightOS to install the update.', { actionLabel: 'Restart Now', action: () => NATIVE.installUpdate() });
      else notify('settings', `NightOS ${s.version} is available`, s.kind === 'portable' ? 'Download the new portable version and run it instead of this one.' : 'Download it from Settings › Desktop App.', { actionLabel: s.kind === 'portable' ? 'Download' : 'Download Update', action: () => NATIVE.installUpdate() });
    }
    WM.wins.filter(w => w.app === 'settings' && w.show).forEach(w => {
      const r = w.body.querySelector('[data-up-row]'); if (!r) return;
      r.querySelector('small').textContent = updateText(s); r.querySelector('[data-up-btn]').innerHTML = updateButton(s);
    });
  };
  NATIVE.onUpdate(onState); NATIVE.updateState().then(onState);
}

/* ---------- Settings › Desktop App ---------- */
if (NATIVE) SETTINGS_EXTRA.push({
  id: 'desktopapp', label: 'Desktop App', icon: 'desktop', group: 'system',
  render: () => `<div class="grp" style="padding:16px 18px;display:flex;gap:14px;align-items:center">${LOGO.replace('<svg', '<svg style="width:48px;height:48px;color:var(--accent);flex:none"')}<div style="flex:1"><b>NightOS for Windows</b><p style="margin:4px 0 0;color:var(--fg-dim)" data-ver>Desktop app</p></div></div>
    ${NATIVE.onUpdate ? `<h4>Updates</h4><div class="grp"><div class="row" data-up-row><div class="tx">Software updates<small>${esc(updateText(UPDATE.s))}</small></div><span data-up-btn>${updateButton(UPDATE.s)}</span></div>${ui.row(UPDATE.s && UPDATE.s.kind === 'portable' ? 'Check for updates automatically' : 'Install updates automatically', UPDATE.s && UPDATE.s.kind === 'portable' ? 'The portable version tells you when a new one is out' : 'Downloads new versions in the background and installs them when NightOS restarts', `<button class="sw ${!UPDATE.s || UPDATE.s.auto ? 'on' : ''}" data-up-auto role="switch" aria-checked="${!UPDATE.s || UPDATE.s.auto}" aria-label="Automatic updates"></button>`)}</div>` : ''}
    <h4>Window</h4><div class="grp">${ui.row('Start in full screen', 'NightOS fills the screen like its own desktop. Press F11 any time to switch', `<button class="sw" data-fs-start role="switch" aria-label="Start in full screen"></button>`)}${ui.row('Full screen now', '', '<button class="hbtn" data-fs-now style="background:var(--press)">Toggle (F11)</button>')}</div>
    <h4>Your apps</h4><div class="grp">${ui.row('Steam', STEAM.found ? `${STEAM.games.length} installed games found` : STEAM.scanned ? 'Not found on this PC' : 'Checking…', '<button class="hbtn" data-rescan style="background:var(--press)">Rescan</button>')}${ui.row('Discord', '<span data-dc>Checking…</span>', '<button class="hbtn" data-dc-open style="background:var(--press)">Open</button>')}${ui.row('Websites', 'Nightfox and web apps load real sites. Logins are kept between sessions', '')}</div>
    <h4>Windows programs</h4><div class="grp">${ui.row('Show Windows desktop shortcuts', 'Your Windows desktop programs and shortcuts appear on the NightOS desktop', `<button class="sw ${CFG.winOnDesk ? 'on' : ''}" data-wd role="switch" aria-checked="${!!CFG.winOnDesk}" aria-label="Show Windows desktop shortcuts"></button>`)}${ui.row('Windows Programs', 'Run, add and pin programs from your PC', '<button class="hbtn" data-wp style="background:var(--press)">Open</button>')}${ui.row('Show running programs in the taskbar', 'Windows open on your PC appear in the NightOS panel or dock. Click to switch, right-click to close', `<button class="sw ${CFG.winTasks !== false ? 'on' : ''}" data-wtk role="switch" aria-checked="${CFG.winTasks !== false}" aria-label="Show running Windows programs"></button>`)}${ui.row('Forget approved programs', 'NightOS asks again before running each program', '<button class="hbtn" data-wf style="background:var(--press)">Forget</button>')}</div>
    ${NATIVE.winRoots ? `<h4>Windows folders</h4><div class="grp">${ui.row('Your PC folders in Files', 'Desktop, Documents, Downloads, Pictures, Music and Videos, under Files › Windows Folders. NightOS asks before using each one', '<button class="hbtn" data-wfo style="background:var(--press)">Open</button>')}${ui.row('Forget folder access', 'NightOS asks again before opening each folder', '<button class="hbtn" data-wff style="background:var(--press)">Forget</button>')}</div>` : ''}
    <p style="color:var(--fg-dim);font-size:12.5px;margin:0">Games and the Discord and Steam apps run in their own windows on top of NightOS. NightOS can start them but not draw them inside its windows.</p>`,
  bind: (main, ctx) => {
    NATIVE.info().then(i => {
      const s = $('[data-fs-start]', main); if (s) { s.classList.toggle('on', i.startFullscreen); s.setAttribute('aria-checked', i.startFullscreen); }
      const v = $('[data-ver]', main); if (v) v.textContent = `Version ${i.version} · Electron ${i.electron}`;
      const d = $('[data-dc]', main); if (d) d.textContent = i.discord ? 'Installed, opens in its own window' : 'Not installed, opens in a NightOS window';
    });
    $('[data-fs-start]', main).onclick = async e => { const on = !e.currentTarget.classList.contains('on'); await NATIVE.setStartFullscreen(on); ctx.rerender(); };
    $('[data-fs-now]', main).onclick = () => NATIVE.setFullscreen();
    if (NATIVE.onUpdate) {
      // set as a property, not a listener, so re-rendering the page doesn't stack handlers
      main.onclick = e => { if (e.target.closest('[data-up-check]')) NATIVE.checkForUpdates(); if (e.target.closest('[data-up-install]')) NATIVE.installUpdate(); };
      $('[data-up-auto]', main).onclick = async e => { const on = !e.currentTarget.classList.contains('on'); await NATIVE.setAutoUpdate(on); UPDATE.s = await NATIVE.updateState(); ctx.rerender(); };
    }
    $('[data-rescan]', main).onclick = () => { STEAM.scanned = false; scanSteam().then(ctx.rerender); ctx.rerender(); };
    $('[data-dc-open]', main).onclick = () => nativeDiscord();
    $('[data-wd]', main).onclick = () => { CFG.winOnDesk = !CFG.winOnDesk; saveCfg(); renderDesktop(); ctx.rerender(); };
    $('[data-wp]', main).onclick = () => launch('winapps');
    const wt = $('[data-wtk]', main); if (wt) wt.onclick = () => { CFG.winTasks = CFG.winTasks === false; saveCfg(); if (window.WINTASKS) WINTASKS.refresh(); ctx.rerender(); };
    const wo = $('[data-wfo]', main); if (wo) wo.onclick = () => launch('files', HOME + '/Windows');
    const wf2 = $('[data-wff]', main); if (wf2) wf2.onclick = async () => { await NATIVE.winForgetFolders(); notify('files', 'Folder access cleared', 'NightOS will ask again before opening your Windows folders.'); if (window.WINFS) WINFS.reset(); };
    $('[data-wf]', main).onclick = async () => { await NATIVE.forgetApprovals(); notify('winapps', 'Approvals cleared', 'NightOS will ask before running each program again.'); };
  }
});
