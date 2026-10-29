'use strict';
/* ================= App Center: browse, install and run apps =================
   Catalog apps live in site/store and arrive through reviewed GitHub submissions.
   Apps you add from your own computer are stored in this browser (IndexedDB).
   HTML apps run in a sandboxed iframe with an opaque origin, so they can't read
   NightOS's files, settings or storage. */
const STORE = { catalog: [], featured: null, loaded: false, error: null };
const SUBMIT_URL = 'https://github.com/NightWeb117/nightos/issues/new?template=app-submission.yml';
const appKey = id => 'app:' + id;
const safeColor = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#6b7280';
function tileSVG(color, letter) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="6" width="52" height="52" rx="14" fill="${safeColor(color)}"/><path d="M6 20a14 14 0 0 1 14-14h24a14 14 0 0 1 14 14v6H6z" fill="rgba(255,255,255,.13)"/><text x="32" y="43" text-anchor="middle" font-family="Cantarell, sans-serif" font-weight="700" font-size="28" fill="#fff">${esc(String(letter || '?').slice(0, 1).toUpperCase())}</text></svg>`;
}
AI.store = () => `<svg viewBox="0 0 64 64"><path d="M13 22h38l-3.2 31.5a4 4 0 0 1-4 3.5H20.2a4 4 0 0 1-4-3.5z" fill="#f4a259"/><path d="M13 22h38l-.6 6H13.6z" fill="#d9783f"/><path d="M24 25v-7a8 8 0 0 1 16 0v7" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><path d="M27 40l4 4 7-8" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
AI.htmlplayer = () => `<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="44" rx="9" fill="#2a2440"/><path d="M22 26l-7 6 7 6M42 26l7 6-7 6M35 22l-6 20" fill="none" stroke="#b493f2" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
APPS.store = { name: 'App Center', proc: 'app-center', kw: 'store software install apps games download submit upload', single: true, launch: p => StoreApp(p), reopen: (w, p) => p && w.go(p) };
APPS.htmlplayer = { name: 'HTML Player', proc: 'html-player', kw: 'html game run', launch: a => a && HtmlAppWindow(a, 'htmlplayer') };
DOCK.splice(DOCK.indexOf('settings'), 0, 'store');
GRID_APPS.splice(GRID_APPS.indexOf('settings'), 0, 'store');
CMDS['app-center'] = () => { launch('store'); };
DESC['app-center'] = 'browse and install apps';

/* ---------- installed apps ---------- */
CFG.installed = CFG.installed || [];
const isInstalled = id => CFG.installed.some(a => a.id === id);
function registerApp(a) {
  const k = appKey(a.id);
  AI[k] = () => tileSVG(a.color, a.letter || a.name);
  APPS[k] = { name: a.name, proc: a.kind === 'web' ? 'web-app' : 'html-app', kw: `${a.category || ''} ${a.summary || ''}`.toLowerCase(), launch: () => runStoreApp(a) };
  if (!GRID_APPS.includes(k)) GRID_APPS.push(k);
  if (a.pinned && !DOCK.includes(k)) DOCK.splice(DOCK.indexOf('settings'), 0, k);
}
function unregisterApp(id) {
  const k = appKey(id);
  WM.wins.filter(w => w.app === k).forEach(w => closeWin(w, true));
  delete APPS[k]; delete AI[k];
  for (const list of [GRID_APPS, DOCK]) { const i = list.indexOf(k); if (i >= 0) list.splice(i, 1); }
  updateDock();
}
function installApp(entry) {
  if (isInstalled(entry.id)) return;
  const a = { ...entry, pinned: false, installedAt: Date.now() };
  CFG.installed.push(a); saveCfg(); registerApp(a); updateDock();
  notify('store', `${a.name} installed`, a.kind === 'web' ? 'Find it in Activities. It opens in a new browser tab.' : 'Find it in Activities, or open it from App Center.');
}
function removeApp(id) {
  const a = CFG.installed.find(x => x.id === id); if (!a) return;
  CFG.installed = CFG.installed.filter(x => x.id !== id); saveCfg(); unregisterApp(id);
  if (a.local && a.blob) BLOBS.del(a.blob);
}
function togglePin(id) {
  const a = CFG.installed.find(x => x.id === id); if (!a) return;
  a.pinned = !a.pinned; saveCfg();
  const k = appKey(id), i = DOCK.indexOf(k);
  if (a.pinned && i < 0) DOCK.splice(DOCK.indexOf('settings'), 0, k); else if (!a.pinned && i >= 0) DOCK.splice(i, 1);
  updateDock();
}
CFG.installed.forEach(registerApp);

/* ---------- running apps ---------- */
function runStoreApp(a) {
  if (a.kind === 'web') {
    const w = window.open(a.url, '_blank', 'noopener');
    notify('store', w === null ? `Couldn't open ${a.name}` : `Opened ${a.name}`, w === null ? 'Your browser blocked the new tab. Allow pop-ups for NightOS and try again.' : 'It opened in a new browser tab.');
    return;
  }
  return HtmlAppWindow(a);
}
function HtmlAppWindow(a, appId) {
  const win = openWin({ app: appId || appKey(a.id), w: 880, h: 600, minW: 320, minH: 240, mem: 90 });
  win.setTitle(a.name, a.local ? 'Your app' : a.author ? `by ${a.author}` : '');
  win.body.innerHTML = `<iframe class="appframe" sandbox="allow-scripts allow-pointer-lock allow-downloads allow-forms allow-modals" allow="fullscreen; autoplay; gamepad" title="${esc(a.name)}"></iframe>`;
  const frame = $('iframe', win.body);
  const fsIcon = '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  win.hr.append(hbtn('reload', 'Restart', () => load()), hbtn(fsIcon, 'Full Screen', () => { if (frame.requestFullscreen) frame.requestFullscreen().catch(() => notify('store', 'Full screen is not available here')); }));
  async function load() {
    if (a.html != null) { frame.srcdoc = a.html; return; }
    if (a.local) {
      const b = await BLOBS.get(a.blob);
      frame.srcdoc = b ? await b.text() : '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#15161c;color:#bbb;font:15px sans-serif">This app\'s file is no longer stored in this browser. Remove it and add it again.</body>';
      return;
    }
    // Fetch the page and hand it to the sandbox as srcdoc. A <base> tag keeps the app's own
    // relative images and scripts working, and some browsers block framed navigations anyway.
    try {
      const url = new URL(a.path, location.href), r = await fetch(url.href + '?v=' + Date.now()); if (!r.ok) throw new Error('HTTP ' + r.status);
      const base = `<base href="${esc(new URL('.', url).href)}">`, html = await r.text();
      frame.srcdoc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + base) : base + html;
    } catch (e) { frame.srcdoc = `<body style="margin:0;display:grid;place-items:center;height:100vh;background:#15161c;color:#bbb;font:15px sans-serif">Couldn't load ${esc(a.name)} (${esc(e.message || e)}).</body>`; }
  }
  load();
  win.onFocus = () => frame.focus();
  return win;
}
// Double-clicking an .html file in Files runs it in the sandboxed player.
openPath = (orig => p => {
  const n = getNode(p);
  if (n && n.type === 'file' && /\.html?$/i.test(p) && n.size == null) return launch('htmlplayer', { id: 'file', name: splitPath(p)[1], html: n.content || '', local: true });
  return orig(p);
})(openPath);

/* ---------- catalog ---------- */
async function loadCatalog(force) {
  if (STORE.loaded && !force) return;
  try {
    const r = await fetch('store/catalog.json?v=' + Date.now()); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); STORE.catalog = j.apps || []; STORE.featured = j.featured; STORE.loaded = true; STORE.error = null;
  } catch (e) { STORE.error = e.message || String(e); }
}

/* ---------- App Center window ---------- */
function StoreApp(start) {
  const win = openWin({ app: 'store', w: 940, h: 620, minW: 380, minH: 360, mem: 70 });
  let view = 'explore', cat = 'All', q = '', detailId = null;
  const seg = el('<div class="seg no-drag" role="tablist"><button data-v="explore">Explore</button><button data-v="themes">Themes</button><button data-v="installed">Installed</button><button data-v="submit">Add Apps</button></div>');
  win.ht.innerHTML = ''; win.ht.append(seg);
  win.setTitle = t => { win.title = t; if (WM.active === win) updateTopApp(); };
  const backB = hbtn('back', 'Back', () => { detailId = null; render(); });
  win.hl.append(backB);
  const searchB = hbtn('search', 'Search', () => { view = 'explore'; detailId = null; render(); const s = $('#ap-q-' + win.id, win.body); if (s) s.focus(); });
  win.hr.append(searchB);
  win.body.innerHTML = '<div class="ap" tabindex="-1"></div>';
  const box = $('.ap', win.body);
  const card = a => `<button class="ap-card" data-open="${esc(a.id)}">${tileSVG(a.color, a.letter || a.name)}<span class="ap-t"><b>${esc(a.name)}</b><small>${esc(a.summary || '')}</small></span><span class="ap-k">${a.kind === 'web' ? 'Web app' : a.category === 'Games' ? 'Game' : 'App'}</span></button>`;
  const actBtn = a => isInstalled(a.id) ? `<button class="hbtn sug" data-run="${esc(a.id)}">Open</button>` : `<button class="hbtn sug" data-install="${esc(a.id)}">Install</button>`;
  function render() {
    win.setTitle('App Center');
    $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.v === view && !detailId));
    backB.hidden = !detailId;
    if (detailId) return renderDetail();
    if (view === 'themes') return renderThemeGallery(box, win, render);
    if (view === 'installed') return renderInstalled();
    if (view === 'submit') return renderSubmit();
    renderExplore();
  }
  function renderExplore() {
    if (!STORE.loaded) {
      box.innerHTML = STORE.error ? `<div class="ap-empty">${sym('globe')}<b>Couldn't load the app catalog</b><p>${esc(STORE.error)}. Check your connection and try again.</p><button class="hbtn sug" data-retry>Try Again</button></div>` : '<div class="ap-empty"><span class="spinner" style="border-color:var(--press);border-top-color:var(--accent)"></span><p>Loading apps…</p></div>';
      if (!STORE.error) loadCatalog().then(render);
      return;
    }
    const f = STORE.catalog.find(a => a.id === STORE.featured);
    const cats = ['All', ...new Set(STORE.catalog.map(a => a.category))];
    const list = STORE.catalog.filter(a => (cat === 'All' || a.category === cat) && (!q || `${a.name} ${a.summary} ${a.author} ${a.category}`.toLowerCase().includes(q)));
    box.innerHTML = `<div class="ap-page">
      <label class="ap-search">${sym('search')}<input id="ap-q-${win.id}" placeholder="Search apps and games" value="${esc(q)}" autocomplete="off" aria-label="Search apps"></label>
      ${f && !q && cat === 'All' ? `<div class="ap-hero" style="--c:${safeColor(f.color)}">${tileSVG(f.color, f.letter || f.name)}<div><small>Featured</small><h2>${esc(f.name)}</h2><p>${esc(f.summary)}</p><div class="ap-row">${actBtn(f)}<button class="hbtn" data-open="${esc(f.id)}">Details</button></div></div></div>` : ''}
      <div class="ap-chips">${cats.map(c => `<button class="${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${list.length ? `<div class="ap-grid">${list.map(card).join('')}</div>` : `<div class="ap-empty">${sym('search')}<b>No apps found</b><p>Try another search, or add your own app.</p></div>`}
      <p class="ap-note">Web apps open in a new browser tab. Games and tools run inside NightOS in a sealed box that can't see your files.</p>
    </div>`;
    const qi = $('#ap-q-' + win.id, box);
    qi.oninput = () => { q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; render(); const n = $('#ap-q-' + win.id, box); n.focus(); n.setSelectionRange(pos, pos); };
  }
  function renderDetail() {
    const a = STORE.catalog.find(x => x.id === detailId) || CFG.installed.find(x => x.id === detailId);
    if (!a) { detailId = null; return render(); }
    win.setTitle(a.name);
    box.innerHTML = `<div class="ap-page"><div class="ap-detail">${tileSVG(a.color, a.letter || a.name)}<div><h2>${esc(a.name)}</h2><p class="ap-by">${a.local ? 'Added by you' : `by ${esc(a.author || 'Unknown')}`} · ${esc(a.category || 'Your Apps')}</p>
      <div class="ap-row">${actBtn(a)}${isInstalled(a.id) ? `<button class="hbtn" data-pin="${esc(a.id)}">${CFG.installed.find(x => x.id === a.id).pinned ? 'Unpin from Dock' : 'Pin to Dock'}</button><button class="hbtn destr" data-remove="${esc(a.id)}">Remove</button>` : ''}</div></div></div>
      <div class="grp" style="padding:16px 18px"><p style="margin:0;line-height:1.55">${esc(a.description || a.summary || '')}</p></div>
      <div class="grp">${[['Type', a.kind === 'web' ? 'Web app · opens in a new browser tab' : 'HTML app · runs inside NightOS'], a.kind === 'web' ? ['Address', a.url] : ['Privacy', 'Runs sealed off from your files, settings and accounts'], ['Source', a.local ? 'Your computer' : 'NightOS App Center (reviewed)']].map(([k, v]) => `<div class="row"><div class="tx">${k}</div><span class="val" style="word-break:break-all">${esc(v)}</span></div>`).join('')}</div></div>`;
  }
  function renderInstalled() {
    const list = CFG.installed;
    box.innerHTML = `<div class="ap-page">${list.length ? `<div class="grp">${list.map(a => `<div class="row"><span class="ap-ic">${tileSVG(a.color, a.letter || a.name)}</span><div class="tx"><b>${esc(a.name)}</b><small>${a.local ? 'Added by you' : esc(a.author || '')} · ${a.kind === 'web' ? 'Web app' : 'Runs in NightOS'}</small></div><button class="hbtn sug" data-run="${esc(a.id)}">Open</button><button class="hbtn" data-pin="${esc(a.id)}" title="${a.pinned ? 'Unpin from Dock' : 'Pin to Dock'}">${a.pinned ? 'Unpin' : 'Pin'}</button><button class="hbtn" data-remove="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">${sym('trash')}</button></div>`).join('')}</div>` : `<div class="ap-empty">${AI.store()}<b>No apps installed yet</b><p>Install something from Explore, or add your own game or website.</p><button class="hbtn sug" data-goto="explore">Explore Apps</button></div>`}</div>`;
  }
  function renderSubmit() {
    const colors = ['#e8b04b', '#e5322d', '#1db954', '#5865f2', '#7c8cff', '#18a497', '#ef8fc4', '#5b5f66'];
    box.innerHTML = `<div class="ap-page">
      <h3 class="ap-h">Add an app to your NightOS</h3>
      <form class="grp ap-form" id="ap-form-${win.id}" autocomplete="off">
        <div class="row"><div class="tx">Type</div><div class="seg" style="flex:none"><button type="button" class="on" data-type="html">HTML file</button><button type="button" data-type="web">Website</button></div></div>
        <div class="row"><div class="tx">Name</div><input class="entry" id="ap-name-${win.id}" maxlength="40" placeholder="My Game" style="max-width:260px"></div>
        <div class="row" data-for="html"><div class="tx">File<small>A single .html file, up to 8 MB. Games that bundle their code and images into one file work best.</small></div><input type="file" id="ap-file-${win.id}" accept=".html,.htm,text/html"></div>
        <div class="row" data-for="web" hidden><div class="tx">Address</div><input class="entry" id="ap-url-${win.id}" placeholder="https://example.com" style="max-width:320px"></div>
        <div class="row"><div class="tx">Icon color</div><div class="accents">${colors.map((c, i) => `<button type="button" data-color="${c}" class="${i === 0 ? 'on' : ''}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div></div>
        <div class="row"><div class="tx"><small class="ap-err" id="ap-err-${win.id}" style="color:var(--bad)"></small></div><button class="hbtn sug" type="submit">Add to NightOS</button></div>
      </form>
      <p class="ap-note" style="margin-top:-8px">Apps you add here stay in this browser only. Nobody else sees them.</p>
      <h3 class="ap-h">Share an app with everyone</h3>
      <div class="grp" style="padding:16px 18px;display:flex;flex-direction:column;gap:10px;line-height:1.5">
        <p style="margin:0">Submit a game or app you made. Each submission is reviewed before it appears in App Center for all NightOS users.</p>
        <ul style="margin:0;padding-left:20px;color:var(--fg-dim)"><li>You need a free GitHub account.</li><li>Attach your .html file (or a .zip of a folder with an index.html), a name and a short description.</li><li>Only submit things you made or have permission to share. No malware, trackers or copied games.</li></ul>
        <div><a class="hbtn sug" href="${SUBMIT_URL}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">Open the Submission Form ${sym('open')}</a></div>
      </div>
    </div>`;
    const form = $('form', box); let type = 'html', color = colors[0];
    form.addEventListener('click', e => {
      const t = e.target.closest('[data-type]'); if (t) { type = t.dataset.type; $$('[data-type]', form).forEach(b => b.classList.toggle('on', b === t)); $$('[data-for]', form).forEach(r => r.hidden = r.dataset.for !== type); }
      const c = e.target.closest('[data-color]'); if (c) { color = c.dataset.color; $$('[data-color]', form).forEach(b => b.classList.toggle('on', b === c)); }
    });
    form.onsubmit = async e => {
      e.preventDefault();
      const err = $('#ap-err-' + win.id, box), name = $('#ap-name-' + win.id, box).value.trim();
      const fail = m => { err.textContent = m; };
      if (!name) return fail('Give your app a name.');
      const id = 'local-' + newBlobId();
      if (type === 'web') {
        let url = $('#ap-url-' + win.id, box).value.trim(); if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
        try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; } catch (x) { return fail('Enter a website address, like https://example.com'); }
        installApp({ id, name, kind: 'web', url, color, letter: name, local: true, category: 'Your Apps', summary: url });
      } else {
        const f = $('#ap-file-' + win.id, box).files[0];
        if (!f) return fail('Choose an .html file.');
        if (!/\.html?$/i.test(f.name)) return fail('That file isn\'t an .html file.');
        if (f.size > 8 * 1024 * 1024) return fail('That file is over 8 MB.');
        await BLOBS.put(id, new Blob([await f.text()], { type: 'text/html' }));
        installApp({ id, name, kind: 'html', blob: id, color, letter: name, local: true, category: 'Your Apps', summary: f.name });
        runStoreApp(CFG.installed.find(a => a.id === id));
      }
      view = 'installed'; render();
    };
  }
  seg.onclick = e => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; detailId = null; render(); } };
  box.addEventListener('click', e => {
    const t = e.target;
    const c = t.closest('[data-cat]'); if (c) { cat = c.dataset.cat; return render(); }
    const run = t.closest('[data-run]'); if (run) { const a = CFG.installed.find(x => x.id === run.dataset.run); if (a) runStoreApp(a); return; }
    const ins = t.closest('[data-install]'); if (ins) { const a = STORE.catalog.find(x => x.id === ins.dataset.install); if (a) { installApp(a); render(); } return; }
    const op = t.closest('[data-open]'); if (op) { detailId = op.dataset.open; return render(); }
    const pin = t.closest('[data-pin]'); if (pin) { togglePin(pin.dataset.pin); return render(); }
    const rm = t.closest('[data-remove]'); if (rm) { const a = CFG.installed.find(x => x.id === rm.dataset.remove); winDialog(win, { title: `Remove ${a ? a.name : 'this app'}?`, body: a && a.local ? 'Its file is deleted from this browser.' : 'You can install it again from Explore.', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Remove', cls: 'destr', value: 'ok' }] }).then(r => { if (r.btn === 'ok') { removeApp(rm.dataset.remove); if (detailId === rm.dataset.remove && !STORE.catalog.some(x => x.id === detailId)) detailId = null; render(); } }); return; }
    if (t.closest('[data-retry]')) { STORE.error = null; return render(); }
    const go = t.closest('[data-goto]'); if (go) { view = go.dataset.goto; return render(); }
  });
  win.go = p => { if (['explore', 'themes', 'installed', 'submit'].includes(p)) { view = p; detailId = null; } else detailId = p; render(); };
  if (start) win.go(start); else render();
  loadCatalog().then(() => { if (view === 'explore' && !detailId) render(); });
  return win;
}
