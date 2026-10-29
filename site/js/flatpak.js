'use strict';
/* ================= Flatpak apps from Flathub =================
   App Center's Flatpak tab. NightOS for Windows installs them into WSL (Linux on Windows)
   and runs them as real windows. The website browses the same catalog and links to Flathub.
   The browser can't search Flathub directly, so the website uses store/flathub.json, which
   the deploy workflow refreshes. NightOS for Windows searches Flathub live. */
const FLAT = { snap: null, err: null, status: null, list: null, job: null, details: {}, rerender: null };
const FP_DOWNLOAD = 'https://github.com/NightWeb117/nightos/releases/latest';
const FP_CATS = [['', 'All'], ['audiovideo', 'Music & Video'], ['game', 'Games'], ['graphics', 'Graphics'], ['development', 'Developer'], ['office', 'Office'], ['network', 'Internet'], ['education', 'Education'], ['science', 'Science'], ['utility', 'Utilities'], ['system', 'System']];
const fpValid = id => typeof id === 'string' && /^[A-Za-z][\w-]*(\.[\w-]+){2,}$/.test(id);
const fpKey = id => 'fp:' + id;
function fpIcon(url, name) {
  return /^https:\/\/dl\.flathub\.org\//.test(url || '') ? `<svg viewBox="0 0 64 64" aria-hidden="true"><image href="${esc(url)}" x="3" y="3" width="58" height="58"/></svg>` : tileSVG('#4a86cf', name);
}
const fpSize = b => !b ? '' : b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB';
const fpInstalled = id => (FLAT.list || CFG.flatpaks || []).some(a => a.id === id);

async function loadFlathub() {
  if (FLAT.snap) return;
  try { const r = await fetch('store/flathub.json'); if (!r.ok) throw new Error('HTTP ' + r.status); FLAT.snap = await r.json(); FLAT.err = null; }
  catch (e) { FLAT.err = e.message || String(e); }
}
// Flathub's appstream endpoint allows any site, so details work on the website too.
async function fpDetails(id) {
  if (FLAT.details[id]) return FLAT.details[id];
  let d;
  if (NATIVE && NATIVE.flatpakDetails) d = await NATIVE.flatpakDetails(id);
  else {
    const r = await fetch('https://flathub.org/api/v2/appstream/' + encodeURIComponent(id)); if (!r.ok) throw new Error('Flathub said ' + r.status);
    const a = await r.json();
    d = { id, name: a.name, summary: a.summary || '', description: a.description || '', icon: a.icon || '', developer: a.developer_name || '', license: a.project_license || '', version: ((a.releases || [])[0] || {}).version || '', homepage: (a.urls || {}).homepage || '', categories: a.categories || [], screenshots: fpShots(a.screenshots) };
  }
  return FLAT.details[id] = d;
}
// Each screenshot comes in several sizes. Pick the one nearest 752 px wide.
const fpShots = list => (list || []).map(x => (Array.isArray(x.sizes) ? x.sizes : []).filter(z => /^https:\/\//.test(z.src || '')).sort((p, q) => Math.abs(p.width - 752) - Math.abs(q.width - 752))[0]).filter(Boolean).map(z => z.src).slice(0, 6);
// Appstream descriptions are a little HTML. Keep only the paragraphs and list items, as text.
function fpDesc(html) {
  const doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
  return [...doc.body.firstChild.children].map(n => n.tagName === 'UL' || n.tagName === 'OL' ? `<ul>${[...n.querySelectorAll('li')].map(li => `<li>${esc(li.textContent.trim())}</li>`).join('')}</ul>` : `<p>${esc(n.textContent.trim().replace(/\s+/g, ' '))}</p>`).join('') || `<p>${esc(doc.body.textContent.trim())}</p>`;
}

/* ---------- installed Flatpaks are NightOS apps too (desktop only) ---------- */
function fpRegister(a) {
  const k = fpKey(a.id);
  AI[k] = () => fpIcon(a.icon, a.name);
  APPS[k] = { name: a.name, proc: 'flatpak', kw: `flatpak linux ${a.id} ${a.summary || ''}`.toLowerCase(), launch: () => { fpRun(a.id); } };
  if (!GRID_APPS.includes(k)) GRID_APPS.push(k);
}
function fpSyncApps(list) {
  const known = id => (CFG.flatpaks || []).find(x => x.id === id) || (FLAT.snap && FLAT.snap.apps.find(x => x.id === id)) || FLAT.details[id] || {};
  const next = list.map(a => { const k = known(a.id); return { id: a.id, name: a.name || k.name || a.id, icon: k.icon || '', summary: k.summary || '', version: a.version }; });
  for (const old of CFG.flatpaks || []) if (!next.some(a => a.id === old.id)) { const k = fpKey(old.id); delete APPS[k]; delete AI[k]; const i = GRID_APPS.indexOf(k); if (i >= 0) GRID_APPS.splice(i, 1); }
  CFG.flatpaks = next; saveCfg(); next.forEach(fpRegister); updateDock();
}
async function fpRefresh() {
  if (!NATIVE || !NATIVE.flatpakList) return;
  try { FLAT.list = await NATIVE.flatpakList(); await loadFlathub(); fpSyncApps(FLAT.list); } catch (e) { }
}
function fpRun(id) {
  const a = (CFG.flatpaks || []).find(x => x.id === id) || { name: id };
  if (!NATIVE || !NATIVE.flatpakRun) return notify('store', 'Flatpak apps need NightOS for Windows', 'Get it from the NightOS download page, then install apps from App Center › Flatpak.');
  NATIVE.flatpakRun(id).then(() => notify('store', `Opening ${a.name}`, 'It opens in its own window. The first start can take a few seconds.'), e => notify('store', `Couldn't open ${a.name}`, String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')));
}
const fpErr = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
if (NATIVE && NATIVE.flatpakList) {
  (CFG.flatpaks || []).forEach(fpRegister);
  setTimeout(fpRefresh, 4000);
  NATIVE.onFlatpak(s => {
    FLAT.job = s.status === 'running' ? s : null;
    const bar = s.id != null && document.querySelector(`[data-fp-prog="${CSS.escape(s.id)}"]`);
    if (bar && s.status === 'running') { bar.querySelector('i').style.width = (s.progress || 0) + '%'; bar.querySelector('small').textContent = s.line || 'Working…'; return; }
    if (s.status === 'done' && s.op === 'install') { const d = FLAT.details[s.id] || {}; notify('store', `${d.name || s.id} installed`, 'Find it in Activities, or open it from App Center.'); }
    if (s.status === 'done' && s.op === 'uninstall') notify('store', 'Flatpak app removed');
    if (s.status === 'done' && s.op === 'setup') { FLAT.status = null; notify('store', 'Flatpak is ready', 'Install Linux apps from App Center › Flatpak.'); }
    if (s.status === 'error') notify('store', s.op === 'run' ? 'The app closed with an error' : s.op === 'setup' ? 'Couldn\'t set up Flatpak' : 'Flatpak couldn\'t finish', s.line || '');
    if (s.status !== 'running') fpRefresh().then(() => FLAT.rerender && FLAT.rerender());
    else if (FLAT.rerender) FLAT.rerender();
  });
}

/* ---------- the App Center tab ---------- */
function renderFlatpak(box, win, rerender) {
  win.setTitle('Flatpak');
  win._fpOn = true;
  const st = win._fp = win._fp || { view: 'popular', cat: '', q: '', detail: null, live: null, liveFor: null };
  FLAT.rerender = () => { if (WM.wins.includes(win) && win._fpOn) renderFlatpak(box, win, rerender); };
  if (!FLAT.snap && !FLAT.err) { box.innerHTML = '<div class="ap-empty"><span class="spinner" style="border-color:var(--press);border-top-color:var(--accent)"></span><p>Loading Flatpak apps…</p></div>'; loadFlathub().then(FLAT.rerender); return; }
  if (NATIVE && NATIVE.flatpakStatus && !FLAT.status) { FLAT.status = { checking: true }; NATIVE.flatpakStatus().then(s => { FLAT.status = s; if (s.flatpak) fpRefresh().then(FLAT.rerender); else FLAT.rerender(); }, e => { FLAT.status = { wsl: false, error: fpErr(e) }; FLAT.rerender(); }); }
  if (st.detail) return fpDetailPage(box, win, st);
  const desk = !!(NATIVE && NATIVE.flatpakStatus), s = FLAT.status || {};
  const ready = desk && s.flatpak && s.flathub;
  let banner = '';
  if (!desk) banner = `<div class="grp fp-banner"><div>${sym('info')}</div><p><b>Flatpak apps are real Linux programs.</b> They run in NightOS for Windows, which installs them into Linux on your PC (WSL). Here you can browse them and open them on Flathub.</p><a class="hbtn sug" href="${FP_DOWNLOAD}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">Get NightOS for Windows</a></div>`;
  else if (s.checking) banner = '<div class="grp fp-banner"><span class="spinner" style="border-color:var(--press);border-top-color:var(--accent)"></span><p>Checking Linux on this PC…</p></div>';
  else if (FLAT.job && FLAT.job.op === 'setup') banner = `<div class="grp fp-banner"><p><b>Setting up Flatpak…</b></p><div class="fp-prog" data-fp-prog=""><span class="fp-bar"><i style="width:${FLAT.job.progress || 0}%"></i></span><small>${esc(FLAT.job.line || 'Working…')}</small></div></div>`;
  else if (s.wslPending) banner = '<div class="grp fp-banner"><p><b>Finish installing Linux.</b> Follow the Windows window that opened, restart the PC, then open Ubuntu once from the Start menu to choose a user name and password. Come back here after that.</p><button class="hbtn" data-fp-recheck>Check Again</button></div>';
  else if (!s.wsl || !s.distro) banner = '<div class="grp fp-banner"><div>' + sym('info') + '</div><p><b>Flatpak apps need Linux on Windows (WSL).</b> Windows installs it in a few minutes and needs one restart.</p><button class="hbtn sug" data-fp-setup>Install Linux</button></div>';
  else if (!ready) banner = `<div class="grp fp-banner"><div>${sym('info')}</div><p><b>Set up Flatpak in ${esc(s.distro)}.</b> NightOS installs Flatpak in your Linux and adds Flathub, where the apps come from.</p><button class="hbtn sug" data-fp-setup>Set Up Flatpak</button></div>`;
  const chips = [['popular', 'Popular'], ['trending', 'Trending'], ...(ready ? [['installed', `Installed${FLAT.list ? ' (' + FLAT.list.length + ')' : ''}`]] : [])];
  let list = [], note = '';
  if (FLAT.err) note = `Couldn't load the Flatpak list (${esc(FLAT.err)}).`;
  else if (st.view === 'installed') list = (FLAT.list || []).map(a => ({ ...((CFG.flatpaks || []).find(x => x.id === a.id) || {}), ...a }));
  else if (st.q && desk) {
    if (st.liveFor !== st.q) { st.liveFor = st.q; st.live = null; const q = st.q; NATIVE.flatpakCatalog('search', q).then(r => { if (st.q === q) { st.live = r; FLAT.rerender(); } }, e => { if (st.q === q) { st.live = []; note = fpErr(e); FLAT.rerender(); } }); }
    list = st.live || [];
    if (!st.live) note = 'Searching Flathub…';
  } else {
    const apps = FLAT.snap.apps, ql = st.q.toLowerCase();
    list = st.view === 'trending' && !st.q ? FLAT.snap.trending.map(id => apps.find(a => a.id === id)).filter(Boolean) : apps;
    if (ql) list = list.filter(a => `${a.name} ${a.summary} ${a.developer} ${a.id}`.toLowerCase().includes(ql));
  }
  if (st.cat && st.view !== 'installed') list = list.filter(a => a.category === st.cat);
  const card = a => `<button class="ap-card" data-fp-open="${esc(a.id)}">${fpIcon(a.icon, a.name)}<span class="ap-t"><b>${esc(a.name)}</b><small>${esc(a.summary || a.id)}</small></span><span class="ap-k">${fpInstalled(a.id) ? 'Installed' : a.verified ? 'Verified' : 'Flatpak'}</span></button>`;
  box.innerHTML = `<div class="ap-page">${banner}
    <label class="ap-search">${sym('search')}<input id="fp-q-${win.id}" placeholder="${desk ? 'Search all of Flathub' : 'Search popular Flatpak apps'}" value="${esc(st.q)}" autocomplete="off" aria-label="Search Flatpak apps"></label>
    <div class="ap-chips">${chips.map(([v, l]) => `<button class="${st.view === v && !st.q ? 'on' : ''}" data-fp-view="${v}">${l}</button>`).join('')}<span style="width:1px;background:var(--line);margin:4px 2px"></span>${FP_CATS.map(([v, l]) => `<button class="${st.cat === v ? 'on' : ''}" data-fp-cat="${v}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="ap-grid">${list.slice(0, 240).map(card).join('')}</div>` : `<div class="ap-empty">${sym('search')}<b>${note ? esc(note) : st.view === 'installed' ? 'No Flatpak apps installed yet' : 'No apps found'}</b><p>${st.view === 'installed' ? 'Pick one from Popular or search Flathub.' : 'Try another search or category.'}</p></div>`}
    <p class="ap-note">Flatpak apps come from <a href="https://flathub.org" target="_blank" rel="noopener">Flathub</a> and are made by their own developers, not NightOS.${desk ? ' They install into your WSL Linux and open in their own windows.' : ''}</p>
  </div>`;
  const qi = $('#fp-q-' + win.id, box); let t = 0;
  qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { st.q = qi.value.trim(); if (st.view === 'installed') st.view = 'popular'; const pos = qi.selectionStart; FLAT.rerender(); const n = $('#fp-q-' + win.id, box); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, desk ? 400 : 120); };
  fpWire(box, win, st);
}
function fpWire(box, win, st) {
  box.onclick = async e => {
    const t = e.target, g = sel => t.closest(sel);
    if (g('[data-fp-view]')) { st.view = g('[data-fp-view]').dataset.fpView; st.q = ''; if (st.view === 'installed') fpRefresh().then(FLAT.rerender); return FLAT.rerender(); }
    if (g('[data-fp-cat]')) { st.cat = g('[data-fp-cat]').dataset.fpCat; return FLAT.rerender(); }
    if (g('[data-fp-open]')) { st.detail = g('[data-fp-open]').dataset.fpOpen; return FLAT.rerender(); }
    if (g('[data-fp-back]')) { st.detail = null; return FLAT.rerender(); }
    if (g('[data-fp-recheck]')) { FLAT.status = null; return FLAT.rerender(); }
    if (g('[data-fp-setup]')) {
      const b = g('[data-fp-setup]'); b.disabled = true;
      try { const r = await NATIVE.flatpakSetup(); if (r && r.status === 'wsl-installing') FLAT.status = { ...FLAT.status, wslPending: true }; else if (r && r.flatpak) FLAT.status = r; } catch (x) { notify('store', 'Couldn\'t set up Flatpak', fpErr(x)); }
      return FLAT.rerender();
    }
    if (g('[data-fp-run]')) return fpRun(g('[data-fp-run]').dataset.fpRun);
    if (g('[data-fp-launch]')) return launch(g('[data-fp-launch]').dataset.fpLaunch);
    if (g('[data-fp-install]')) {
      const id = g('[data-fp-install]').dataset.fpInstall, d = FLAT.details[id] || {};
      NATIVE.flatpakInstall(id, d.name || id).catch(x => notify('store', `Couldn't install ${d.name || id}`, fpErr(x)));
      return;
    }
    if (g('[data-fp-remove]')) {
      const id = g('[data-fp-remove]').dataset.fpRemove, d = FLAT.details[id] || (CFG.flatpaks || []).find(x => x.id === id) || {};
      const r = await winDialog(win, { title: `Remove ${d.name || id}?`, body: 'It\'s uninstalled from your WSL Linux. Its settings stay in case you install it again.', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Remove', cls: 'destr', value: 'ok' }] });
      if (r.btn === 'ok') NATIVE.flatpakUninstall(id).catch(x => notify('store', 'Couldn\'t remove it', fpErr(x)));
    }
  };
}
function fpDetailPage(box, win, st) {
  const id = st.detail, d = FLAT.details[id], desk = !!(NATIVE && NATIVE.flatpakInstall);
  if (!d) {
    box.innerHTML = '<div class="ap-empty"><span class="spinner" style="border-color:var(--press);border-top-color:var(--accent)"></span><p>Loading…</p></div>';
    fpDetails(id).then(FLAT.rerender, e => { box.innerHTML = `<div class="ap-empty">${sym('globe')}<b>Couldn't load this app</b><p>${esc(fpErr(e))}</p><button class="hbtn" data-fp-back>Back</button></div>`; fpWire(box, win, st); });
    return;
  }
  win.setTitle(d.name);
  const s = FLAT.status || {}, ready = desk && s.flatpak && s.flathub, inst = fpInstalled(id), job = FLAT.job && FLAT.job.id === id ? FLAT.job : null, busy = FLAT.job && !job;
  const flathub = `<a class="hbtn" href="https://flathub.org/apps/${encodeURIComponent(id)}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">Flathub ${sym('open')}</a>`;
  const acts = !desk ? `<a class="hbtn sug" href="${FP_DOWNLOAD}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">Get NightOS for Windows</a>${flathub}`
    : job ? `<div class="fp-prog" data-fp-prog="${esc(id)}"><span class="fp-bar"><i style="width:${job.progress || 0}%"></i></span><small>${esc(job.line || (job.op === 'uninstall' ? 'Removing…' : 'Installing…'))}</small></div>`
    : !ready ? `<button class="hbtn sug" data-fp-back>Set Up Flatpak First</button>${flathub}`
    : inst ? `<button class="hbtn sug" data-fp-run="${esc(id)}">Open</button><button class="hbtn destr" data-fp-remove="${esc(id)}">Remove</button>${flathub}`
    : `<button class="hbtn sug" data-fp-install="${esc(id)}" ${busy ? 'disabled title="Another install is running"' : ''}>Install</button>${flathub}`;
  const rows = [['Version', d.version], ['Developer', d.developer], ['License', d.license], ['Download', fpSize(d.download)], ['Installed size', fpSize(d.size)], ['App ID', id], ['Runs in', desk ? `WSL${s.distro ? ' · ' + s.distro : ''}, in its own window` : 'NightOS for Windows (through WSL), or any Linux with Flatpak']].filter(r => r[1]);
  box.innerHTML = `<div class="ap-page"><button class="hbtn fp-back" data-fp-back>${sym('back')} All Flatpak apps</button>
    <div class="ap-detail">${fpIcon(d.icon, d.name)}<div><h2>${esc(d.name)}</h2><p class="ap-by">${esc(d.summary)}</p><div class="ap-row">${acts}</div></div></div>
    ${fpTips(d)}
    ${d.screenshots.length ? `<div class="fp-shots">${d.screenshots.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}
    <div class="grp fp-desc">${fpDesc(d.description)}</div>
    <div class="grp">${rows.map(([k, v]) => `<div class="row"><div class="tx">${k}</div><span class="val" style="word-break:break-all">${esc(v)}</span></div>`).join('')}${d.homepage && /^https?:\/\//.test(d.homepage) ? `<div class="row"><div class="tx">Website</div><a class="val" href="${esc(d.homepage)}" target="_blank" rel="noopener">${esc(d.homepage)}</a></div>` : ''}</div>
  </div>`;
  fpWire(box, win, st);
}

// Flatpak apps in WSL can't use the graphics card, so warn on games and 3D apps, and point Sober users at Roblox for Windows.
const FP_WINDOWS_BETTER = { 'org.vinegarhq.Sober': { app: 'robloxapp', name: 'Roblox', get: 'https://www.roblox.com/download' } };
function fpTips(d) {
  const snap = FLAT.snap && FLAT.snap.apps.find(a => a.id === d.id), cats = d.categories || [];
  const heavy = cats.includes('Game') || cats.includes('3DGraphics') || (snap && snap.category === 'game');
  const alt = FP_WINDOWS_BETTER[d.id], have = alt && APPS[alt.app];
  let out = '';
  if (alt) out += `<div class="grp fp-banner"><div>${sym('info')}</div><p><b>Play ${alt.name} for Windows instead.</b> ${esc(d.name)} brings ${alt.name} to Linux PCs. On Windows, ${alt.name}'s own app uses your graphics card and runs much better.</p>${have ? `<button class="hbtn sug" data-fp-launch="${alt.app}">Open ${alt.name}</button>` : `<a class="hbtn sug" href="${alt.get}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">Get ${alt.name} for Windows</a>`}</div>`;
  else if (heavy) out += `<div class="grp fp-banner"><div>${sym('info')}</div><p><b>This may run slowly.</b> Flatpak apps in NightOS for Windows can't use your graphics card, so 3D games and graphics-heavy apps draw on the CPU. Simple 2D games are usually fine.</p></div>`;
  return out;
}

/* ---------- terminal: flatpak list / run / search / install ---------- */
CMDS.flatpak = async (c, a) => {
  const [sub, ...rest] = a, desk = !!(NATIVE && NATIVE.flatpakList);
  if (!sub || sub === '--help') { c.out('Usage: flatpak list | run APP-ID | search TEXT | install APP-ID | uninstall APP-ID'); return 0; }
  if (sub === 'list') { const l = desk ? await NATIVE.flatpakList() : []; if (!l.length) c.out(desk ? 'No Flatpak apps installed.' : 'Flatpak apps run in NightOS for Windows.'); else c.out(l.map(x => `${x.name.padEnd(28)} ${x.id.padEnd(36)} ${x.version}`).join('\n')); return 0; }
  if (sub === 'search') { await loadFlathub(); const q = rest.join(' ').toLowerCase(); const l = desk ? await NATIVE.flatpakCatalog('search', q) : ((FLAT.snap || {}).apps || []).filter(x => `${x.name} ${x.summary} ${x.id}`.toLowerCase().includes(q)); c.out(l.slice(0, 20).map(x => `${x.name.padEnd(28)} ${x.id.padEnd(36)} ${x.summary}`).join('\n') || 'No matches found'); return 0; }
  const id = rest.filter(x => !x.startsWith('-')).pop();
  if (['install', 'info', 'uninstall', 'remove', 'run'].includes(sub) && !fpValid(id)) { c.err(`error: Give an app ID, like org.gimp.GIMP`); return 1; }
  if (sub === 'run') { if (!desk) { c.err('error: Flatpak apps run in NightOS for Windows'); return 1; } try { await NATIVE.flatpakRun(id); c.out(`Opening ${id}…`); return 0; } catch (e) { c.err('error: ' + fpErr(e)); return 1; } }
  if (sub === 'install' || sub === 'info' || sub === 'uninstall' || sub === 'remove') { const w = launch('store', 'flatpak'); if (w && w.go) { w._fp = { view: 'popular', cat: '', q: '', ...(w._fp || {}), detail: id }; w.go('flatpak'); } c.out(`Opened ${id} in App Center.`); return 0; }
  c.err(`error: '${sub}' is not a flatpak command`); return 1;
};
DESC.flatpak = 'install and run Linux apps from Flathub';
