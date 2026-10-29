'use strict';
/* ================= NightOS Hello, snapshots and the Linux VM manager ================= */
AI.hello = () => `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="16" style="fill:var(--accent)"/><rect x="6" y="6" width="52" height="52" rx="16" fill="rgba(0,0,0,.35)"/><g transform="translate(13 12) scale(.62)"><path d="${LOGO_PATH}" fill="#fff"/></g><circle cx="44" cy="20" r="2.2" fill="#fff"/></svg>`;
APPS.hello = { name: 'NightOS Hello', proc: 'nightos-hello', kw: 'welcome hello tweaks help start getting started', single: true, launch: t => HelloApp(t), reopen: (w, t) => t && w.go(t) };
if (!GRID_APPS.includes('hello')) GRID_APPS.unshift('hello');
APP_CAT.hello = 'System';

function HelloApp(start = 'welcome') {
  const win = openWin({ app: 'hello', w: 800, h: 580, minW: 380, minH: 400, mem: 45 });
  let tab = start;
  const seg = el('<div class="seg no-drag"><button data-t="welcome">Welcome</button><button data-t="tweaks">Tweaks</button><button data-t="apps">Apps</button></div>');
  win.ht.innerHTML = ''; win.ht.append(seg); win.setTitle = t => { win.title = t; if (WM.active === win) updateTopApp(); }; win.setTitle('NightOS Hello');
  win.body.innerHTML = '<div class="ap hl"></div>'; const box = $('.hl', win.body);
  const tile = (act, icon, t, s) => `<button class="hl-tile" data-act="${act}">${icon}<span><b>${t}</b><small>${s}</small></span></button>`;
  function render() {
    $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    if (tab === 'welcome') box.innerHTML = `<div class="ap-page"><div class="hl-hero">${LOGO}<div><h2>Welcome to NightOS</h2><p>A calm desktop that runs in your browser, with real Linux, real Python and your own apps. Here's where to start.</p></div></div>
      <div class="hl-grid">${tile('theme', AI.settings(), 'Make it yours', 'Themes, colors, panel and windows')}${tile('store', AI.store(), 'Install apps', 'Discord, games, tools and your own')}${tile('linux', AI.linux(), 'Real Linux', 'Boot Alpine Linux and use apt')}${tile('snap', fileSVG('archive'), 'Snapshots', 'Save and restore your whole system')}${tile('tour', AI.tour(), 'Take the tour', 'Five quick tips about NightOS')}${tile('docs', AI.browser(), 'Documentation', 'Shortcuts and how-tos')}${tile('search', AI.apps(), 'Search everything', 'Press Alt+F2 or Ctrl+Space')}${tile('issue', fileSVG('md'), 'Report a problem', 'Opens GitHub in a new tab')}</div>
      <div class="grp">${ui.row('Show NightOS Hello when I log in', '', `<button class="sw ${CFG.helloOnStart !== false ? 'on' : ''}" data-hs role="switch" aria-checked="${CFG.helloOnStart !== false}" aria-label="Show on login"></button>`)}</div></div>`;
    else if (tab === 'tweaks') {
      const L = LOOK();
      box.innerHTML = `<div class="ap-page"><h4 class="ap-h">Desktop</h4><div class="grp">${ui.row('Layout', '', ui.seg('layout', L.layout, [['panel', 'Panel'], ['dock', 'Top bar + Dock']]))}${ui.row('Animations', '', ui.seg('anim', L.anim, [['off', 'Off'], ['fast', 'Fast'], ['normal', 'Normal']]))}${ui.row('Wallpaper effect', '', ui.seg('wallFx', L.wallFx, [['none', 'None'], ['dim', 'Dim'], ['blur', 'Blur']]))}${ui.row('Hot corner', 'Top-left corner opens Activities', ui.sw('hotCorner', L.hotCorner))}</div>
        <h4 class="ap-h">System</h4><div class="grp">${ui.row('Boot animation', 'The spider and moon film at startup', `<button class="sw ${CFG.bootFilm !== false ? 'on' : ''}" data-tw="bootFilm" role="switch" aria-checked="${CFG.bootFilm !== false}" aria-label="Boot animation"></button>`)}${ui.row('System sounds', 'Notification, login and volume sounds', `<button class="sw ${CFG.sounds !== false ? 'on' : ''}" data-tw="sounds" role="switch" aria-checked="${CFG.sounds !== false}" aria-label="System sounds"></button>`)}${ui.row('Snapshot at every login', 'Keeps the last three automatic snapshots', `<button class="sw ${CFG.autoSnap ? 'on' : ''}" data-tw="autoSnap" role="switch" aria-checked="${!!CFG.autoSnap}" aria-label="Automatic snapshots"></button>`)}</div>
        <h4 class="ap-h">Terminal</h4><div class="grp">${ui.row('Fish-style autosuggestions', '', ui.sw('term.suggest', L.term.suggest))}${ui.row('fastfetch when a terminal opens', '', ui.sw('term.fastfetch', L.term.fastfetch))}${ui.row('Prompt', '', ui.seg('term.prompt', L.term.prompt, [['fish', 'Fish'], ['bash', 'Bash'], ['arrow', 'Arrow']]))}</div></div>`;
      bindLookControls(box, render);
      box.querySelectorAll('[data-tw]').forEach(b => b.onclick = () => { const k = b.dataset.tw; CFG[k] = k === 'autoSnap' ? !CFG[k] : CFG[k] === false; saveCfg(); render(); });
    } else {
      box.innerHTML = '<div class="ap-page"><div class="ap-empty"><span class="spinner" style="border-color:var(--press);border-top-color:var(--accent)"></span></div></div>';
      loadCatalog().then(() => {
        if (tab !== 'apps') return;
        const picks = ['discord', 'steam', 'spotify', 'youtube', 'fireflies', 'sketch', 'photopea', 'excalidraw'].map(id => STORE.catalog.find(a => a.id === id)).filter(Boolean);
        box.innerHTML = `<div class="ap-page"><p style="margin:0;color:var(--fg-dim)">Popular picks. One click installs; everything else is in App Center.</p><div class="ap-grid">${picks.map(a => `<div class="ap-card">${tileSVG(a.color, a.letter || a.name)}<span class="ap-t"><b>${esc(a.name)}</b><small>${esc(a.summary)}</small></span>${isInstalled(a.id) ? `<button class="hbtn" data-run="${a.id}" style="background:var(--press)">Open</button>` : `<button class="hbtn sug" data-inst="${a.id}">Install</button>`}</div>`).join('')}</div><div style="text-align:center"><button class="hbtn sug" data-act="store">Open App Center</button></div></div>`;
      });
    }
  }
  box.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (a) {
      const k = a.dataset.act;
      if (k === 'theme') launch('settings', 'theme'); else if (k === 'store') launch('store'); else if (k === 'linux') launch('linux'); else if (k === 'snap') launch('settings', 'snapshots');
      else if (k === 'tour') launch('tour'); else if (k === 'docs') launch('browser', 'docs.nightos.org'); else if (k === 'search') openRunner();
      else if (k === 'issue') window.open('https://github.com/NightWeb117/nightos/issues/new', '_blank', 'noopener');
      return;
    }
    if (e.target.closest('[data-hs]')) { CFG.helloOnStart = CFG.helloOnStart === false; saveCfg(); render(); return; }
    const i = e.target.closest('[data-inst]'); if (i) { installApp(STORE.catalog.find(x => x.id === i.dataset.inst)); render(); return; }
    const r = e.target.closest('[data-run]'); if (r) runStoreApp(CFG.installed.find(x => x.id === r.dataset.run));
  });
  seg.onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; render(); } };
  win.go = t => { tab = t; render(); };
  render(); return win;
}

/* ---------- snapshots: restore points for files, settings and installed apps ---------- */
CFG.snapshots = CFG.snapshots || [];
function usedBlobs() { const s = new Set(); const walk = n => { if (n.type === 'dir') Object.values(n.children).forEach(walk); else if (n.blob) s.add(n.blob); }; walk(FS); CFG.installed.forEach(a => a.blob && s.add(a.blob)); return [...s]; }
async function createSnapshot(name, auto = false) {
  const id = 's' + Date.now().toString(36), cfg = { ...CFG }; delete cfg.snapshots;
  const json = JSON.stringify({ v: 1, fs: FS, cfg, hist: store.get('hist', []), pkgs: [...INSTALLED] });
  await BLOBS.put('snap:' + id, new Blob([json], { type: 'application/json' }));
  CFG.snapshots.unshift({ id, name, time: Date.now(), size: json.length, auto, blobs: usedBlobs() });
  if (auto) { const autos = CFG.snapshots.filter(s => s.auto); for (const old of autos.slice(3)) await deleteSnapshot(old.id, true); }
  saveCfg(); return id;
}
async function deleteSnapshot(id, quiet) { await BLOBS.del('snap:' + id); CFG.snapshots = CFG.snapshots.filter(s => s.id !== id); if (!quiet) saveCfg(); }
async function restoreSnapshot(id) {
  const b = await BLOBS.get('snap:' + id); if (!b) throw new Error('This snapshot\'s data is missing from the browser.');
  const data = JSON.parse(await b.text());
  await createSnapshot('Before restoring “' + (CFG.snapshots.find(s => s.id === id) || {}).name + '”');
  const keep = CFG.snapshots;
  FS = data.fs; store.set('fs1', FS);
  for (const k of Object.keys(CFG)) delete CFG[k];
  Object.assign(CFG, data.cfg, { snapshots: keep }); saveCfg();
  store.set('hist', data.hist || []); store.set('pkgs', data.pkgs || []);
  location.reload();
}
const fmtWhen = t => { const d = new Date(t); return `${MON[d.getMonth()]} ${d.getDate()}, ${hhmm(d)}`; };
SETTINGS_EXTRA.push({
  id: 'snapshots', label: 'Snapshots', icon: 'restart', group: 'system',
  render: () => `<div class="grp" style="padding:16px 18px;display:flex;gap:14px;align-items:center"><div style="flex:1"><b>Snapshots</b><p style="margin:4px 0 0;color:var(--fg-dim);line-height:1.45">A snapshot saves your files, settings, look, installed apps and terminal history. Restoring one puts NightOS back exactly as it was. They're stored in this browser.</p></div><button class="hbtn sug" data-snap-new>Create Snapshot</button></div>
    <div class="grp">${ui.row('Snapshot at every login', 'Keeps the last three automatic snapshots', `<button class="sw ${CFG.autoSnap ? 'on' : ''}" data-snap-auto role="switch" aria-checked="${!!CFG.autoSnap}" aria-label="Automatic snapshots"></button>`)}</div>
    <h4>Saved snapshots</h4><div class="grp">${CFG.snapshots.length ? CFG.snapshots.map(s => `<div class="row"><div class="tx">${esc(s.name)}<small>${fmtWhen(s.time)} · ${humanSI(s.size)}${s.auto ? ' · automatic' : ''}</small></div><button class="hbtn" data-snap-restore="${s.id}" style="background:var(--press)">Restore</button><button class="hbtn" data-snap-del="${s.id}" aria-label="Delete snapshot">${sym('trash')}</button></div>`).join('') : '<div class="row"><div class="tx" style="color:var(--fg-dim)">No snapshots yet</div></div>'}</div>`,
  bind: (main, ctx) => {
    $('[data-snap-new]', main).onclick = async () => {
      const r = await winDialog(ctx.win, { title: 'Create Snapshot', body: 'Name it so you can find it later.', entry: `Snapshot – ${fmtWhen(Date.now())}`, buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Create', cls: 'sug', value: 'ok' }], validate: v => v.trim() ? '' : 'Give the snapshot a name.' });
      if (r.btn === 'ok') { await createSnapshot(r.value.trim()); notify('settings', 'Snapshot created', r.value.trim()); ctx.rerender(); }
    };
    $('[data-snap-auto]', main).onclick = () => { CFG.autoSnap = !CFG.autoSnap; saveCfg(); ctx.rerender(); };
    main.querySelectorAll('[data-snap-restore]').forEach(b => b.onclick = async () => {
      const s = CFG.snapshots.find(x => x.id === b.dataset.snapRestore);
      const r = await winDialog(ctx.win, { title: `Restore “${esc(s.name)}”?`, body: `NightOS goes back to how it was on ${fmtWhen(s.time)} and reloads. Your current state is saved as a snapshot first, so you can undo this.`, buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Restore', cls: 'destr', value: 'ok' }] });
      if (r.btn === 'ok') { try { await restoreSnapshot(s.id); } catch (e) { notify('settings', 'Couldn\'t restore the snapshot', e.message); } }
    });
    main.querySelectorAll('[data-snap-del]').forEach(b => b.onclick = async () => { await deleteSnapshot(b.dataset.snapDel); ctx.rerender(); });
  }
});

/* ---------- Linux VM manager ---------- */
CFG.vm = Object.assign({ mem: navigator.deviceMemory && navigator.deviceMemory < 4 ? 256 : 512, cmdline: '', autostart: false }, CFG.vm || {});
SETTINGS_EXTRA.push({
  id: 'linuxvm', label: 'Linux VM', icon: 'term', group: 'system',
  render: () => {
    const on = typeof LINUX !== 'undefined' && LINUX.emu && LINUX.state !== 'off', up = on ? Math.round((Date.now() - LINUX.startedAt) / 60000) : 0;
    return `<div class="grp" style="padding:16px 18px;display:flex;gap:16px;align-items:center">${AI.linux().replace('<svg', '<svg style="width:56px;height:56px;flex:none"')}<div style="flex:1"><b>Alpine Linux 3.24 · kernel 6.18</b><p style="margin:4px 0 0;color:var(--fg-dim)">${on ? `Running for ${up} min · ${LINUX.memMB} MB RAM · ${LINUX.state === 'ready' ? 'ready' : 'booting'}` : 'Powered off'}</p></div>${on ? '<button class="hbtn" data-vm="restart" style="background:var(--press)">Restart</button><button class="hbtn destr" data-vm="off">Power Off</button>' : '<button class="hbtn sug" data-vm="on">Start</button>'}</div>
      <h4>Hardware</h4><div class="grp">${ui.row('Memory', 'More memory lets bigger programs run. Takes effect on the next start', `<div class="seg" style="flex:none">${[256, 512, 768, 1024].map(m => `<button class="${CFG.vm.mem === m ? 'on' : ''}" data-vm-mem="${m}">${m < 1024 ? m + ' MB' : '1 GB'}</button>`).join('')}</div>`)}${ui.row('Network relay', esc(CFG.relay === 'off' ? 'Off' : CFG.relay || RELAY_DEFAULT), '<button class="hbtn" data-vm-relay style="background:var(--press)">Change…</button>')}</div>
      <h4>Boot</h4><div class="grp">${ui.row('Kernel parameters', 'Added to the boot line, for example “quiet” or “loglevel=3”', `<input class="entry" data-vm-cmd value="${esc(CFG.vm.cmdline)}" placeholder="none" style="max-width:240px;font-family:var(--font-mono)" spellcheck="false">`)}${ui.row('Start Linux when I log in', 'Boots in the background so it is ready when you need it', `<button class="sw ${CFG.vm.autostart ? 'on' : ''}" data-vm-auto role="switch" aria-checked="${CFG.vm.autostart}" aria-label="Start at login"></button>`)}</div>`;
  },
  bind: (main, ctx) => {
    main.querySelectorAll('[data-vm-mem]').forEach(b => b.onclick = () => { CFG.vm.mem = +b.dataset.vmMem; saveCfg(); ctx.rerender(); });
    const cmd = $('[data-vm-cmd]', main); cmd.onchange = () => { CFG.vm.cmdline = cmd.value.replace(/[^\w=.,:\- /]/g, '').trim(); saveCfg(); };
    $('[data-vm-auto]', main).onclick = () => { CFG.vm.autostart = !CFG.vm.autostart; saveCfg(); ctx.rerender(); };
    $('[data-vm-relay]', main).onclick = async () => {
      const r = await winDialog(ctx.win, { title: 'Network Relay', body: 'Leave empty for the public v86 relay, type “off” to disconnect, or enter your own wss:// address.', entry: CFG.relay && CFG.relay !== RELAY_DEFAULT ? CFG.relay : '', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Save', cls: 'sug', value: 'ok' }], validate: v => !v.trim() || v.trim() === 'off' || /^wss?:\/\//.test(v.trim()) ? '' : 'Use a ws:// or wss:// address, or “off”.' });
      if (r.btn === 'ok') { CFG.relay = r.value.trim() || RELAY_DEFAULT; saveCfg(); ctx.rerender(); }
    };
    main.querySelectorAll('[data-vm]').forEach(b => b.onclick = () => {
      const a = b.dataset.vm;
      if (a === 'on') launch('linux');
      else if (a === 'off') { linuxPowerOff(); }
      else { linuxPowerOff(); if (LINUX.term) LINUX.term.reset(); linuxBoot(); }
      setTimeout(ctx.rerender, 300);
    });
  }
});
