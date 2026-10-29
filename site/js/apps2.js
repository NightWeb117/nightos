'use strict';
/* ================= Nightfox browser ================= */
APPS.browser = { name: 'Nightfox', proc: 'nightfox', kw: 'browser web internet firefox', launch: u => BrowserApp(u) };
const SITE_INDEX = [
  { url: 'nightos.org', title: 'NightOS — a calm Linux desktop', desc: 'NightOS 24.10 "Umbra" is a calm, fast desktop for people who work late.', kw: 'nightos linux download desktop umbra' },
  { url: 'nightos.org/download', title: 'Download NightOS 24.10', desc: 'Get the desktop image for 64-bit PCs, the minimal installer, or the ARM64 build.', kw: 'download iso install usb' },
  { url: 'nightos.org/release-notes', title: 'NightOS 24.10 Release Notes', desc: 'What is new in Umbra: Dusk 46.3, Linux 6.8, Night Light schedules, accent colors.', kw: 'release notes changelog new features' },
  { url: 'docs.nightos.org', title: 'NightOS Documentation — Getting Started', desc: 'Keyboard shortcuts, window tiling, the terminal and package management.', kw: 'docs help shortcuts keyboard terminal apt' },
  { url: 'about:nightfox', title: 'About Nightfox', desc: 'Version information for the Nightfox web browser.', kw: 'nightfox browser version about' }
];
const DOWNLOADS = [];
function normURL(raw) {
  let s = raw.trim(); if (!s) return 'about:newtab';
  if (/^about:/.test(s)) return s;
  if (/\s/.test(s) || (!s.includes('.') && !/^localhost/.test(s))) return 'search.nightos.org/?q=' + encodeURIComponent(s);
  return s.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
function pageFor(url, tab) {
  const nav = `<div class="site-nav"><div class="wrap"><b>${LOGO}NightOS</b><span class="sp"></span><a data-go="nightos.org" class="opt">Home</a><a data-go="nightos.org/release-notes" class="opt">Release Notes</a><a data-go="docs.nightos.org">Docs</a><a data-go="nightos.org/download">Download</a></div></div>`;
  const foot = `<div class="site-foot"><div class="wrap">© 2026 The NightOS Project. NightOS is free software, made by volunteers.</div></div>`;
  const offline = !netUp();
  if (url === 'about:newtab' || url === 'about:home') return { title: 'New Tab', html: `<div class="pg nt"><div class="nt-logo">${AI.browser()}<span>Nightfox</span></div><form data-search><input id="nt-q-${tab.id}" placeholder="Search with NightSearch or enter address" aria-label="Search" autocomplete="off"></form><div class="nt-tiles">${[['N', 'NightOS', 'nightos.org'], ['↓', 'Download', 'nightos.org/download'], ['✦', 'Release Notes', 'nightos.org/release-notes'], ['?', 'Docs', 'docs.nightos.org'], ['i', 'About Nightfox', 'about:nightfox']].map(([i, t, u]) => `<a data-go="${u}"><i>${i}</i>${t}</a>`).join('')}</div></div>` };
  if (url === 'about:nightfox') return { title: 'About Nightfox', html: `<div class="pg"><div class="err-pg" style="text-align:center"><div style="width:96px;margin:0 auto">${AI.browser()}</div><h1>Nightfox ${CFG.upgraded ? '131.0.3' : '131.0.2'} (64-bit)</h1><p>Nightfox is up to date.</p><p style="font-size:13px">Built for NightOS 24.10 · Gecko-compatible engine · Sandbox mode</p></div></div>` };
  if (/^about:/.test(url)) return { title: 'Page not found', html: `<div class="pg"><div class="err-pg"><div class="big">⚠</div><h1>Hmm. That address isn’t right.</h1><p>Nightfox doesn’t know how to open <b>${esc(url)}</b>.</p></div></div>` };
  if (offline) return { title: 'Problem loading page', html: `<div class="pg"><div class="err-pg"><div class="big">📡</div><h1>No internet connection</h1><p>There is a problem with your network connection.</p><ul><li>Check that Wi‑Fi is turned on in the system menu.</li><li>Turn off Airplane Mode.</li></ul><button data-reload>Try Again</button></div></div>` };
  if (url.startsWith('search.nightos.org')) {
    const q = decodeURIComponent((url.split('q=')[1] || '')).trim(), words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = SITE_INDEX.filter(s => words.some(w => (s.title + s.desc + s.kw).toLowerCase().includes(w)));
    return { title: q + ' - NightSearch', html: `<div class="pg"><div class="site-nav"><div class="wrap"><b>${LOGO}NightSearch</b></div></div><div class="wrap sr"><p style="color:#6b7086;font-size:13px">${hits.length} result${hits.length === 1 ? '' : 's'} for “${esc(q)}”</p>${hits.map(s => `<div class="r"><small>https://${esc(s.url)}</small><a data-go="${s.url}">${esc(s.title)}</a><p>${esc(s.desc)}</p></div>`).join('') || `<p>No pages in the NightSearch index match your search.</p><p style="color:#6b7086">Nightfox runs inside the NightOS sandbox, so only NightOS project pages can be reached. You can still <a href="https://duckduckgo.com/?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">search for “${esc(q)}” in your real browser ↗</a>.</p>`}</div></div>` };
  }
  if (url === 'nightos.org') return { title: 'NightOS — a calm Linux desktop', html: `<div class="pg">${nav}<div class="hero"><div class="wrap"><div><p style="color:#8ab4ff;font-weight:700;margin:0 0 8px">Released October 2026</p><h1>NightOS 24.10 “Umbra”</h1><p>A calm, fast Linux desktop for people who work late. Dusk 46.3, Linux 6.8, and a Night Light that knows when the sun has set.</p><a class="cta" data-go="nightos.org/download">Download</a><a class="cta alt" data-go="nightos.org/release-notes">What’s new</a></div><img alt="NightOS desktop with the Umbra wallpaper" src="${wallThumb('umbra', 640, 400)}"></div></div><div class="wrap feat"><div><h3>Quiet by default</h3><p>No pop-ups, no nagging. Do Not Disturb and Night Light are one click away in the system menu.</p></div><div><h3>Tiling without thinking</h3><p>Drag a window to an edge to tile it. Drag it to the top to maximize. That’s the whole manual.</p></div><div><h3>A real terminal</h3><p>bash 5.2 with apt, htop, and the tools you expect. <code style="font-family:var(--font-mono)">sudo apt install</code> just works.</p></div><div><h3>Your colors</h3><p>Nine accent colors and five hand-tuned night wallpapers, from Aurora to Dusk.</p></div></div>${foot}</div>` };
  if (url === 'nightos.org/download') return { title: 'Download NightOS 24.10', html: `<div class="pg">${nav}<div class="wrap doc"><h1>Download NightOS 24.10</h1><p>Supported for 9 months, until July 2027. Need long-term support? 24.04 LTS is supported until 2029.</p>${[['nightos-24.10-desktop-amd64.iso', 'Desktop image', '64-bit PC (AMD64) · 6.1 GB', 6113427456], ['nightos-24.10-minimal-amd64.iso', 'Minimal installer', 'Installs a small base system · 2.1 GB', 2147483648], ['nightos-24.10-desktop-arm64.iso', 'Desktop for ARM64', 'For ARM laptops and boards · 5.4 GB', 5798205849]].map(([f, t, d, s]) => `<div class="dl-row"><div><b>${t}</b><br><small>${d}</small><br><small style="font-family:var(--font-mono)">${f}</small></div><button data-dl="${f}" data-size="${s}">Download</button></div>`).join('')}<h3>Verify your download</h3><p>Run <code>sha256sum nightos-24.10-desktop-amd64.iso</code> and compare it with SHA256SUMS on the mirror.</p></div>${foot}</div>` };
  if (url === 'nightos.org/release-notes') return { title: 'NightOS 24.10 Release Notes', html: `<div class="pg">${nav}<div class="wrap doc"><h1>NightOS 24.10 “Umbra” release notes</h1><h3>Desktop</h3><ul><li>Dusk 46.3 with a redesigned system menu and quick toggles.</li><li>Nine accent colors, picked in Settings › Appearance.</li><li>Night Light now has an adjustable color temperature.</li><li>The Files app gains a list view and a proper Trash with restore.</li></ul><h3>Under the hood</h3><ul><li>Linux 6.8 with improved Wi‑Fi power management.</li><li>bash 5.2.21, Python 3.12.3, apt 2.7.14.</li><li>htop, tree and cowsay are one <code>apt install</code> away.</li></ul><h3>Known issues</h3><ul><li>The dock may bounce twice on slow machines.</li><li>Nightfox can only reach NightOS project pages while in sandbox mode.</li></ul></div>${foot}</div>` };
  if (url === 'docs.nightos.org') return { title: 'Getting Started — NightOS Docs', html: `<div class="pg">${nav}<div class="wrap doc"><h1>Getting started</h1><h3>Keyboard shortcuts</h3><table><tr><th>Action</th><th>Shortcut</th></tr><tr><td>Open a terminal</td><td><kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>T</kbd></td></tr><tr><td>Show Activities</td><td><kbd>Alt</kbd> <kbd>F1</kbd>, or the top-left corner</td></tr><tr><td>Lock the screen</td><td><kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>L</kbd></td></tr><tr><td>Hide all windows</td><td><kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>D</kbd></td></tr><tr><td>Maximize a window</td><td>Double-click its title bar, or drag it to the top</td></tr><tr><td>Tile left or right</td><td>Drag the window to the screen edge</td></tr></table><h3>In the terminal</h3><table><tr><td><code>help</code></td><td>List every available command</td></tr><tr><td><code>neofetch</code></td><td>Show system information</td></tr><tr><td><code>sudo apt update &amp;&amp; sudo apt upgrade</code></td><td>Install updates</td></tr><tr><td><code>sudo apt install htop</code></td><td>Install a package</td></tr><tr><td><code>python3</code></td><td>Real Python 3.14 (Brython), with access to your NightOS files</td></tr><tr><td><code>node</code></td><td>Real JavaScript on your browser’s engine</td></tr><tr><td><code>cd ~/Documents/projects</code></td><td>Example bash, Python and JavaScript programs to run</td></tr><tr><td><code>screenshot</code></td><td>Save a real PNG of the desktop to ~/Pictures/Screenshots</td></tr></table><h3>Your real files</h3><p>Drag files from your computer onto the desktop or a Files window, or use <b>Import Files From Computer…</b>. Right-click a file and choose <b>Download to Computer…</b> to save it back out.</p></div>${foot}</div>` };
  const host = url.split('/')[0];
  if (host.endsWith('nightos.org')) return { title: 'Page Not Found', html: `<div class="pg">${nav}<div class="wrap doc"><h1>404 — page not found</h1><p>We couldn’t find <code>${esc(url)}</code>. <a data-go="nightos.org">Go to the home page</a>.</p></div>${foot}</div>` };
  return { title: 'Server Not Found', error: true, html: `<div class="pg"><div class="err-pg"><div class="big">🦊</div><h1>Hmm. We’re having trouble finding that site.</h1><p>We can’t connect to the server at <b>${esc(host)}</b>.</p><p>Nightfox runs inside the NightOS sandbox, so it can only reach NightOS project pages such as <a data-go="nightos.org">nightos.org</a>.</p><p>You can <a href="https://${esc(url)}" target="_blank" rel="noopener">open ${esc(host)} in your real browser ↗</a>.</p><button data-reload>Try Again</button></div></div>` };
}
function BrowserApp(startUrl) {
  const win = openWin({ app: 'browser', w: 1000, h: 640, minW: 420, minH: 300, mem: 310 });
  const tabs = []; let cur = null, tabSeq = 0;
  const strip = el('<div class="bw-tabs no-drag" role="tablist"></div>');
  win.ht.innerHTML = ''; win.ht.style.alignItems = 'stretch'; win.ht.append(strip);
  win.setTitle = t => { win.title = t + ' — Nightfox'; win.el.setAttribute('aria-label', win.title); if (WM.active === win) updateTopApp(); };
  win.hl.append(hbtn('plus', 'New Tab', () => newTab('about:newtab')));
  win.body.innerHTML = `<div class="bw-bar"><button class="hbtn" data-b="back" aria-label="Back">${sym('back')}</button><button class="hbtn" data-b="fwd" aria-label="Forward">${sym('fwd')}</button><button class="hbtn" data-b="reload" aria-label="Reload">${sym('reload')}</button><label class="bw-url">${sym('shield')}<input id="bw-url-${win.id}" spellcheck="false" autocomplete="off" aria-label="Address"></label><button class="hbtn dlb" data-b="dl" aria-label="Downloads" hidden>${sym('download')}<span class="ring"></span></button><button class="hbtn" data-b="menu" aria-label="Menu">${sym('menu')}</button></div><div class="bw-prog"></div><div class="bw-view"></div>`;
  const urlIn = $('input', win.body), view = $('.bw-view', win.body), prog = $('.bw-prog', win.body), bar = $('.bw-bar', win.body), dlB = $('[data-b=dl]', win.body);
  const fav = t => t.url.startsWith('about:') ? AI.browser().replace('<svg', '<svg class="fav"') : `<svg class="fav" viewBox="0 0 24 24">${t.err ? sym('globe').replace(/^<svg[^>]*>|<\/svg>$/g, '') : `<path d="${LOGO_PATH}" transform="scale(.375)" fill="#8ab4ff"/>`}</svg>`;
  function drawTabs() { strip.innerHTML = tabs.map(t => `<div class="bw-tab ${t === cur ? 'on' : ''}" data-t="${t.id}" role="tab" aria-selected="${t === cur}" title="${esc(t.title)}">${t.loading ? '<span class="spinner" style="width:14px;height:14px;border-color:var(--press);border-top-color:var(--accent)"></span>' : fav(t)}<span class="t">${esc(t.title)}</span><button class="x" data-x="${t.id}" aria-label="Close tab">${sym('close')}</button></div>`).join(''); }
  function newTab(u) { const t = { id: ++tabSeq, hist: [], idx: -1, title: 'New Tab', url: 'about:newtab', scroll: 0 }; tabs.push(t); cur = t; navigate(t, u || 'about:newtab'); return t; }
  function closeTab(id) { const i = tabs.findIndex(t => t.id === id); if (i < 0) return; tabs.splice(i, 1); if (!tabs.length) return closeWin(win); if (cur.id === id) { cur = tabs[Math.max(0, i - 1)]; show(cur); } drawTabs(); }
  function navigate(t, raw, fromHist) {
    const u = normURL(raw);
    if (!fromHist) { t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(u); t.idx = t.hist.length - 1; }
    t.url = u; t.loading = !u.startsWith('about:'); drawTabs();
    if (t === cur) { urlIn.value = u.startsWith('about:newtab') ? '' : (u.startsWith('about:') ? u : 'https://' + u); prog.style.transition = 'none'; prog.style.width = '0'; prog.style.opacity = 1; }
    const finish = () => {
      const pg = pageFor(u, t); t.title = pg.title; t.html = pg.html; t.err = pg.error; t.loading = false;
      if (t === cur) { show(t); prog.style.transition = 'width .2s, opacity .4s .2s'; prog.style.width = '100%'; prog.style.opacity = 0; } drawTabs();
    };
    if (t.loading) { requestAnimationFrame(() => { if (t === cur) { prog.style.transition = 'width .5s'; prog.style.width = '70%'; } }); setTimeout(finish, 280 + Math.random() * 380); } else finish();
  }
  function show(t) {
    view.innerHTML = t.html || ''; view.scrollTop = 0; win.setTitle(t.title);
    urlIn.value = t.url.startsWith('about:newtab') ? '' : (t.url.startsWith('about:') ? t.url : 'https://' + t.url);
    $('[data-b=back]', bar).disabled = t.idx <= 0; $('[data-b=fwd]', bar).disabled = t.idx >= t.hist.length - 1;
    const ntq = $('form[data-search] input', view); if (ntq && WM.active === win) setTimeout(() => ntq.focus(), 0);
  }
  strip.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) { e.stopPropagation(); return closeTab(+x.dataset.x); } const tb = e.target.closest('[data-t]'); if (tb) { cur = tabs.find(t => t.id === +tb.dataset.t); drawTabs(); show(cur); } });
  strip.addEventListener('auxclick', e => { const tb = e.target.closest('[data-t]'); if (tb && e.button === 1) closeTab(+tb.dataset.t); });
  strip.addEventListener('dblclick', e => { if (e.target === strip) newTab(); });
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-b]'); if (!b) return; const a = b.dataset.b;
    if (a === 'back' && cur.idx > 0) { cur.idx--; navigate(cur, cur.hist[cur.idx], true); }
    if (a === 'fwd' && cur.idx < cur.hist.length - 1) { cur.idx++; navigate(cur, cur.hist[cur.idx], true); }
    if (a === 'reload') navigate(cur, cur.url, true);
    if (a === 'dl') menuAt(b, DOWNLOADS.slice(-6).reverse().map(d => ({ label: `${d.name}  ${d.done ? humanSI(d.size) : Math.round(d.p * 100) + '%'}`, disabled: !d.done, action: () => launch('files', HOME + '/Downloads') })));
    if (a === 'menu') menuAt(b, [{ label: 'New Tab', kb: 'Ctrl+T', action: () => newTab() }, { label: 'New Window', kb: 'Ctrl+N', action: () => BrowserApp() }, '-', { label: 'Downloads', action: () => launch('files', HOME + '/Downloads') }, { label: 'About Nightfox', action: () => newTab('about:nightfox') }, '-', { label: 'Close Tab', kb: 'Ctrl+W', action: () => closeTab(cur.id) }]);
  });
  urlIn.addEventListener('keydown', e => { if (e.key === 'Enter') { navigate(cur, urlIn.value); urlIn.blur(); } if (e.key === 'Escape') { urlIn.value = cur.url; urlIn.blur(); } });
  urlIn.addEventListener('focus', () => setTimeout(() => urlIn.select(), 0));
  view.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); navigate(cur, g.dataset.go); return; }
    if (e.target.closest('[data-reload]')) return navigate(cur, cur.url, true);
    const d = e.target.closest('[data-dl]'); if (d) startDownload(d.dataset.dl, +d.dataset.size);
  });
  view.addEventListener('submit', e => { e.preventDefault(); const i = $('input', e.target); if (i && i.value.trim()) navigate(cur, i.value); });
  function startDownload(name, size) {
    if (DOWNLOADS.some(d => d.name === name && !d.done)) return;
    const d = { name, size, p: 0, done: false }; DOWNLOADS.push(d); dlB.hidden = false; win.busy = true; SYS.dl = 60;
    notify('browser', 'Download started', name);
    const iv = setInterval(() => {
      d.p = Math.min(1, d.p + .04 + Math.random() * .05); dlB.querySelector('.ring').style.setProperty('--p', d.p * 100 + '%');
      if (d.p >= 1) {
        clearInterval(iv); d.done = true; win.busy = false; SYS.dl = 0;
        const fn = uniqueName(HOME + '/Downloads', name.replace(/\.iso$/, ''), '.iso'); const n = getNode(HOME + '/Downloads');
        n.children[fn] = { type: 'file', content: '', size, mtime: Date.now() }; fsChanged();
        notify('browser', 'Download complete', `${fn} — ${humanSI(size)}`, { actionLabel: 'Show in Files', action: () => launch('files', HOME + '/Downloads') });
      }
    }, 400);
    win.onClose = () => clearInterval(iv);
  }
  win.frame.addEventListener('keydown', e => {
    if (!e.ctrlKey) return; const k = e.key.toLowerCase();
    if (k === 't') { e.preventDefault(); newTab(); } else if (k === 'w') { e.preventDefault(); closeTab(cur.id); } else if (k === 'l') { e.preventDefault(); urlIn.focus(); } else if (k === 'r') { e.preventDefault(); navigate(cur, cur.url, true); }
  });
  win.onFocus = () => { const q = $('form[data-search] input', view); (q || urlIn).focus({ preventScroll: true }); };
  newTab(startUrl || 'about:newtab');
  return win;
}

/* ================= Settings ================= */
APPS.settings = { name: 'Settings', proc: 'night-control-center', kw: 'preferences control wallpaper background wifi bluetooth display sound', single: true, launch: p => SettingsApp(p), reopen: (w, p) => p && w.show(p) };
const NETS = [['Night-5G', 4, true], ['Night-2.4', 3, true], ['Starlight_Guest', 2, false], ['Hollow-Lane', 2, true], ['DIRECT-41-Printer', 1, true]];
const BTDEV = [['Lumen Keys', 'Keyboard', true], ['Orbit Mouse', 'Mouse', false], ['Nova Buds', 'Headphones', false]];
function SettingsApp(page = 'wifi') {
  const win = openWin({ app: 'settings', w: 900, h: 600, minW: 380, minH: 360, mem: 88 });
  // Pages from look.js, desk.js and hello.js (SETTINGS_EXTRA) slot in by id.
  const EXTRA = Object.fromEntries((typeof SETTINGS_EXTRA !== 'undefined' ? SETTINGS_EXTRA : []).map(x => [x.id, x]));
  const PAGES = [['wifi', 'Wi‑Fi', 'wifi'], ['bt', 'Bluetooth', 'bt'], ['displays', 'Displays', 'display'], ['sound', 'Sound', 'vol'], ['power', 'Power', 'battery'], ['-'],
    ['theme', 'Global Theme', 'palette'], ['colors', 'Colors & Fonts', 'palette'], ['background', 'Wallpaper', 'pic'], ['panel', 'Panel & Dock', 'desktop'], ['windows', 'Windows', 'grid'], ['desktopcfg', 'Desktop & Widgets', 'desktop'], ['terminalcfg', 'Terminal', 'term'], ['-'],
    ['notifications', 'Notifications', 'bell'], ['snapshots', 'Snapshots', 'restart'], ['linuxvm', 'Linux VM', 'term'], ['about', 'System', 'info']].filter(([id]) => id === '-' || !['theme', 'colors', 'panel', 'windows', 'desktopcfg', 'terminalcfg', 'snapshots', 'linuxvm'].includes(id) || EXTRA[id]);
  if (page === 'appearance') page = EXTRA.colors ? 'colors' : 'appearance';
  win.body.innerHTML = `<div class="st"><nav class="st-side" aria-label="Settings sections"></nav><div class="st-main"><div class="st-page"></div></div></div>`;
  const side = $('.st-side', win.body), main = $('.st-page', win.body);
  let cur = page, meterIv = null;
  const sw = (id, on) => `<button class="sw ${on ? 'on' : ''}" data-sw="${id}" role="switch" aria-checked="${!!on}" aria-label="${id}"></button>`;
  const row = (title, sub, right, attrs = '') => `<div class="row" ${attrs}><div class="tx">${title}${sub ? `<small>${sub}</small>` : ''}</div>${right || ''}</div>`;
  function show(p, keepScroll) {
    if (p === 'appearance' && EXTRA.colors) p = 'colors';
    const scroll = main.parentElement.scrollTop;
    cur = p; clearInterval(meterIv);
    side.innerHTML = PAGES.map(([id, l, ic]) => id === '-' ? '<hr style="border:0;height:1px;background:var(--line);margin:6px 4px">' : `<button class="${id === cur ? 'on' : ''}" data-p="${id}">${sym(ic)}<span>${l}</span></button>`).join('');
    const label = (PAGES.find(x => x[0] === p) || [, 'Settings'])[1]; win.setTitle(label);
    main.innerHTML = EXTRA[p] ? EXTRA[p].render() : RENDER[p] ? RENDER[p]() : '';
    if (EXTRA[p] && EXTRA[p].bind) EXTRA[p].bind(main, { win, rerender: () => show(cur, true) });
    main.parentElement.scrollTop = keepScroll ? scroll : 0;
    $$('input[type=range]', main).forEach(r => r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min) * 100) + '%'));
    $$('img[data-blob]', main).forEach(img => BLOBS.get(img.dataset.blob).then(b => { if (b) img.src = URL.createObjectURL(b); }));
    if (p === 'sound') { const m = $('#st-mic i', main); meterIv = setInterval(() => { m.style.width = (Math.random() < .3 ? Math.random() * 60 : Math.random() * 12) + '%'; }, 120); }
  }
  win.show = show;
  const RENDER = {
    wifi: () => `${row('<b>Wi‑Fi</b>', CFG.plane ? 'Airplane Mode is on' : '', sw('wifi', CFG.wifi && !CFG.plane))}`.replace(/^/, '<div class="grp">') + '</div>' +
      (CFG.wifi && !CFG.plane ? `<h4>Visible Networks</h4><div class="grp">${NETS.map(([n, s, lk]) => row(`${esc(n)}`, n === CFG.net ? '<span style="color:var(--ok)">Connected</span>' : '', `${lk ? sym('lock') : ''}<span class="net-ic" style="opacity:${.35 + s * .16}">${sym('wifi')}</span>`, `data-net="${esc(n)}" class="row click"`)).join('')}</div>` : `<div style="text-align:center;color:var(--fg-dim);padding:40px 0">${sym('wifioff').replace('class="sym', 'style="width:64px;height:64px;opacity:.4" class="sym')}<p>Wi‑Fi is turned off</p></div>`),
    bt: () => `<div class="grp">${row('<b>Bluetooth</b>', CFG.bt && !CFG.plane ? 'Visible as “nightos”' : '', sw('bt', CFG.bt && !CFG.plane))}</div>` + (CFG.bt && !CFG.plane ? `<h4>Devices</h4><div class="grp">${BTDEV.map(([n, k, on], i) => row(esc(n), k, `<span class="val">${on ? 'Connected' : 'Not Connected'}</span>`, `data-bt="${i}" class="row click"`)).join('')}</div>` : ''),
    displays: () => { const W = Math.round((screen.width || innerWidth) * devicePixelRatio), H = Math.round((screen.height || innerHeight) * devicePixelRatio); return `<div class="grp" style="padding:24px;display:grid;place-items:center"><div style="width:220px;aspect-ratio:${W}/${H};max-width:100%;border-radius:8px;background:url(${wallThumb(CFG.wall)}) center/cover;box-shadow:0 0 0 3px var(--accent);display:grid;place-items:center;color:#fff;font-weight:700;font-size:28px;text-shadow:0 1px 4px #000">1</div><p style="margin:10px 0 0;color:var(--fg-dim)">Built-in display</p></div><div class="grp">${row('Resolution', '', `<span class="val">${W} × ${H} (${(W / H).toFixed(2) === '1.78' ? '16∶9' : (W / H).toFixed(2) === '1.60' ? '16∶10' : 'native'})</span>`)}${row('Refresh Rate', '', '<span class="val">60.00 Hz</span>')}${row('Scale', '', `<span class="val">${Math.round(devicePixelRatio * 100)} %</span>`)}${row('Orientation', '', '<span class="val">Landscape</span>')}</div><h4>Night Light</h4><div class="grp">${row('Night Light', 'Makes the screen warmer to reduce eye strain', sw('night', CFG.night))}${row('Color Temperature', '', `<input type="range" class="sl" id="st-temp" min="0" max="100" value="${CFG.nightTemp}" style="width:180px" aria-label="Color temperature">`)}${row('Brightness', '', `<input type="range" class="sl" id="st-bright" min="10" max="100" value="${CFG.bright}" style="width:180px" aria-label="Brightness">`)}</div>`; },
    sound: () => `<h4>Output</h4><div class="grp">${row('Output Device', '', '<select id="st-out" aria-label="Output device"><option>Speakers – Built-in Audio</option><option>HDMI / DisplayPort – Built-in Audio</option></select>')}${row('Volume', '', `<input type="range" class="sl" id="st-vol" min="0" max="100" value="${CFG.volume}" style="width:200px" aria-label="Volume">`)}${row('Balance', '', '<input type="range" class="sl" min="0" max="100" value="50" style="width:200px" aria-label="Balance">')}</div><h4>Input</h4><div class="grp">${row('Input Device', '', '<select aria-label="Input device"><option>Microphone – Built-in Audio</option></select>')}${row('Input Level', '', '<div class="meter" id="st-mic" style="max-width:200px"><i></i></div>')}</div><h4>Alert Sound</h4><div class="grp">${['Click', 'String', 'Swing', 'Hum'].map(s => row(s, '', `<span class="radio ${(CFG.alert || 'click') === s.toLowerCase() ? 'on' : ''}"></span>`, `class="row click" data-alert="${s.toLowerCase()}"`)).join('')}</div>`,
    power: () => `<div class="grp">${row(`<b>Battery</b>`, `${CFG.battery} % · ${(() => { const b = REAL.battery; if (!b) return 'simulated (this browser doesn’t share battery info)'; if (b.charging) return b.level >= 1 ? 'Fully charged' : isFinite(b.chargingTime) ? `Charging · ${Math.round(b.chargingTime / 60)} minutes until full` : 'Charging'; return isFinite(b.dischargingTime) ? `about ${Math.floor(b.dischargingTime / 3600)} hours ${Math.round(b.dischargingTime % 3600 / 60)} minutes remaining` : 'On battery power'; })()}`, `<div class="batbar" style="max-width:220px"><i style="width:${CFG.battery}%;background:${CFG.battery < 20 ? 'var(--bad)' : 'var(--ok)'}"></i></div>`)}</div><h4>Power Mode</h4><div class="grp">${[['perf', 'Performance', 'High performance and power usage'], ['balanced', 'Balanced', 'Standard performance and power usage'], ['saver', 'Power Saver', 'Reduced performance and power usage']].map(([k, t, s]) => row(t, s, `<span class="radio ${CFG.power === k ? 'on' : ''}"></span>`, `class="row click" data-power="${k}"`)).join('')}</div><h4>Power Saving</h4><div class="grp">${row('Automatic Screen Blank', 'Turns the screen off after a period of inactivity', '<select aria-label="Screen blank"><option>5 minutes</option><option>10 minutes</option><option>Never</option></select>')}${row('Automatic Suspend', 'Pauses the computer after a period of inactivity', '<span class="val">On Battery Power</span>')}${row('Show Battery Percentage', '', sw('pct', true))}</div>`,
    background: () => `<div class="grp" style="padding:18px"><div class="walls">${Object.keys(WALLS).map(id => `<button class="${CFG.wall === id ? 'on' : ''}" data-wall="${id}" aria-label="${WALLS[id].name}"><img alt="" src="${wallThumb(id)}"><span>${WALLS[id].name}</span></button>`).join('')}${CFG.wall.startsWith('img:') ? `<button class="on" data-wall="${CFG.wall}" aria-label="Your picture"><img alt="" data-blob="${CFG.wall.slice(4)}"><span>Your picture</span></button>` : ''}<button data-addpic style="display:grid;place-items:center;background:var(--press);color:var(--fg)">${sym('plus')}<span style="color:var(--fg);text-shadow:none">Add Picture…</span></button></div></div><p style="color:var(--fg-dim);margin:0;font-size:13px">Add Picture uses an image from your computer. You can also right-click any picture in Files and choose Set as Background.</p>`,
    appearance: () => `<h4>Style</h4><div class="grp"><div class="styles">${[['light', 'Default', '#f6f6f8', '#fff'], ['dark', 'Dark', '#1d1e24', '#2a2b33']].map(([k, l, bg, w]) => `<button class="${CFG.style === k ? 'on' : ''}" data-style="${k}"><div class="pv" style="background:url(${wallThumb(CFG.wall, 240, 150)}) center/cover"><i style="background:${w}"></i></div><span>${l}</span></button>`).join('')}</div></div><h4>Accent Color</h4><div class="grp" style="padding:16px"><div class="accents">${Object.entries(ACCENTS).map(([k, [c]]) => `<button class="${CFG.accent === k ? 'on' : ''}" data-accent="${k}" style="background:${c}" aria-label="${k}" title="${k[0].toUpperCase() + k.slice(1)}">${CFG.accent === k ? sym('check') : ''}</button>`).join('')}</div></div><h4>Startup</h4><div class="grp">${row('Boot Animation', 'Plays the spider and moon film when NightOS starts', sw('bootfilm', CFG.bootFilm !== false))}${row('Watch the Boot Animation', '', '<button class="hbtn" data-film style="background:var(--press)">Play</button>')}</div>`,
    notifications: () => `<div class="grp">${row('Do Not Disturb', 'Hides notification banners', sw('dnd', CFG.dnd))}${row('Lock Screen Notifications', '', sw('lsn', true))}</div><h4>App Notifications</h4><div class="grp">${['files', 'browser', 'terminal', 'editor', 'settings'].map(a => row(`<span style="display:flex;align-items:center;gap:10px"><svg viewBox="0 0 64 64" width="28" height="28">${AI[a]().replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>${APPS[a].name}</span>`, '', `<span class="val">On</span>`)).join('')}</div>`,
    about: () => `<div class="about-logo">${LOGO}<b>NightOS</b><span style="color:var(--fg-dim)">24.10 (Umbra)</span></div><div class="grp">${row('Device Name', '', '<span class="val">nightos</span>')}</div><div class="grp">${row('Hardware Model', 'The browser NightOS is running in', `<span class="val">${esc(REAL.host || 'Browser Virtual Machine')}</span>`)}${row('Memory', SYS.memReal ? 'Device memory as reported by the browser · NightOS heap limit ' + (SYS.memTotal / 1024).toFixed(1) + ' GiB' : '', `<span class="val">${navigator.deviceMemory ? (navigator.deviceMemory >= 8 ? '8 GB or more' : navigator.deviceMemory + ' GB') : (SYS.memTotal / 1024).toFixed(1) + ' GiB'}</span>`)}${row('Processor', 'Logical cores on your computer', `<span class="val">${CPU_NAME} × ${SYS.cores}</span>`)}${row('Graphics', '', `<span class="val">${esc(gpuName())}</span>`)}${row('Disk Capacity', REAL.storage && REAL.storage.quota ? `${humanSI(REAL.storage.usage || 0)} used · browser storage quota` : '', `<span class="val">${REAL.storage && REAL.storage.quota ? humanSI(REAL.storage.quota) : '512.1 GB'}</span>`)}</div><div class="grp">${row('OS Name', '', '<span class="val">NightOS 24.10</span>')}${row('OS Type', '', '<span class="val">64-bit</span>')}${row('Desktop', '', `<span class="val">Dusk ${CFG.upgraded ? '46.3' : '46.2'}</span>`)}${row('Windowing System', '', '<span class="val">Wayland</span>')}${row('Kernel Version', '', '<span class="val">Linux 6.8.0-45-night</span>')}</div><div class="grp">${row('Software Updates', CFG.upgraded ? 'Your system is up to date' : '3 updates available', CFG.upgraded ? '' : '<button class="hbtn sug" data-upd>Update…</button>')}</div>`
  };
  side.onclick = e => { const b = e.target.closest('[data-p]'); if (b) show(b.dataset.p); };
  main.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-sw="bootfilm"]')) { CFG.bootFilm = CFG.bootFilm === false; saveCfg(); show(cur); return; }
    if (t.closest('[data-film]')) { const b = $('#boot'); b.hidden = false; b.style.cursor = 'none'; const st = SYSTEM.state; SYSTEM.state = 'boot'; playIntro(b).then(() => { b.hidden = true; SYSTEM.state = st; }); return; }
    const s = t.closest('[data-sw]'); if (s) { const k = s.dataset.sw; if (['wifi', 'bt', 'night', 'dnd'].includes(k)) toggleSetting(k); else s.classList.toggle('on'); if (['wifi', 'bt', 'night', 'dnd'].includes(k)) show(cur); return; }
    const n = t.closest('[data-net]'); if (n && n.dataset.net !== CFG.net) { const sub = $('small', n) || el('<small></small>'); $('.tx', n).append(sub); sub.textContent = 'Connecting…'; setTimeout(() => { CFG.net = n.dataset.net; saveCfg(); show(cur); notify('settings', 'Connected to ' + CFG.net); }, 1400); return; }
    const b = t.closest('[data-bt]'); if (b) { const d = BTDEV[+b.dataset.bt]; d[2] = !d[2]; show(cur); if (d[2]) notify('settings', `${d[0]} connected`); return; }
    const w = t.closest('[data-wall]'); if (w) { CFG.wall = w.dataset.wall; saveCfg(); renderWall(true); show(cur); return; }
    const st = t.closest('[data-style]'); if (st) { CFG.style = st.dataset.style; saveCfg(); applyLook(); show(cur); return; }
    const ac = t.closest('[data-accent]'); if (ac) { CFG.accent = ac.dataset.accent; saveCfg(); applyLook(); show(cur); return; }
    const pw = t.closest('[data-power]'); if (pw) { CFG.power = pw.dataset.power; saveCfg(); show(cur); return; }
    const al = t.closest('[data-alert]'); if (al) { CFG.alert = al.dataset.alert; saveCfg(); playSound(CFG.alert); show(cur); return; }
    if (t.closest('[data-addpic]')) {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
      i.onchange = async () => { const f = i.files[0]; if (!f) return; const dir = HOME + '/Pictures/Wallpapers'; if (!getNode(dir)) fsMkdir(dir, { parents: true }); await importFiles([f], dir); const nm = Object.entries(getNode(dir).children).filter(([, v]) => v.blob).sort((a, b) => b[1].mtime - a[1].mtime)[0]; if (nm) { CFG.wall = 'img:' + nm[1].blob; saveCfg(); renderWall(true); show(cur); } };
      i.click(); return;
    }
    const rd = t.closest('[data-radio]'); if (rd) { $$(`[data-radio="${rd.dataset.radio}"] .radio`, main).forEach(r => r.classList.remove('on')); $('.radio', rd).classList.add('on'); return; }
    if (t.closest('[data-upd]')) { const tw = launch('terminal'); setTimeout(() => tw && tw.body && $('.t-in', tw.body) && (tw.body.querySelector('.t-in').value = 'sudo apt upgrade'), 50); }
  });
  main.addEventListener('input', e => {
    const r = e.target; if (r.type === 'range') r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
    if (r.id === 'st-temp') { CFG.nightTemp = +r.value; applyLook(); saveCfg(); }
    if (r.id === 'st-bright') { CFG.bright = +r.value; applyLook(); saveCfg(); }
    if (r.id === 'st-vol') { CFG.volume = +r.value; renderTray(); saveCfg(); }
  });
  const onCfg = () => { if (!main.contains(document.activeElement) || !['range', 'color', 'text'].includes(document.activeElement.type)) show(cur, true); };
  document.addEventListener('cfg', onCfg);
  win.onClose = () => { clearInterval(meterIv); document.removeEventListener('cfg', onCfg); };
  show(page); return win;
}

/* ================= System Monitor ================= */
APPS.monitor = { name: 'System Monitor', proc: 'system-monitor', kw: 'task manager process cpu memory htop', single: true, launch: () => MonitorApp() };
const CORE_COLORS = ['#78aeed', '#f4a259', '#6fd08c', '#ef8fc4', '#f2cc5b', '#b493f2', '#5ec7c1', '#f0756c', '#9aa9c3', '#c7925b', '#8ae234', '#34e2e2', '#d38ad8', '#fce94f', '#729fcf', '#e08a4f'];
function MonitorApp() {
  const win = openWin({ app: 'monitor', w: 860, h: 580, minW: 420, minH: 340, mem: 72 });
  let tab = 'proc', sortK = 'cpu', sortDir = -1, selPid = null, filter = '';
  const seg = el(`<div class="seg no-drag" role="tablist"><button data-tab="proc">Processes</button><button data-tab="res">Resources</button><button data-tab="fs">File Systems</button></div>`);
  win.ht.innerHTML = ''; win.ht.append(seg); win.setTitle = t => { win.title = t; if (WM.active === win) updateTopApp(); }; win.setTitle('System Monitor');
  const searchB = hbtn('search', 'Search processes', () => { const s = $('#mon-q-' + win.id, win.body); if (s) { s.hidden = !s.hidden; if (!s.hidden) s.focus(); else { filter = ''; s.value = ''; draw(); } } });
  win.hr.append(searchB);
  win.body.innerHTML = '<div class="mon"></div>'; const box = $('.mon', win.body);
  function setTab(t) {
    tab = t; $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.tab === t)); searchB.hidden = t !== 'proc';
    if (t === 'proc') box.innerHTML = `<input class="entry" id="mon-q-${win.id}" placeholder="Filter processes" hidden style="border-radius:0;height:38px" aria-label="Filter processes"><div class="tbl-wrap"><table class="tbl"><thead><tr><th data-k="name">Process Name</th><th data-k="user">User</th><th data-k="cpu" class="num">% CPU</th><th data-k="pid" class="num">ID</th><th data-k="mem" class="num">Memory</th></tr></thead><tbody></tbody></table></div><div class="mon-foot"><span class="mon-sum" style="font-size:12.5px;color:var(--fg-dim)"></span><span class="sp"></span><button class="hbtn destr" id="mon-end" disabled>End Process</button></div>`;
    else if (t === 'res') box.innerHTML = `<div class="res"><div><h5>CPU</h5><canvas class="chart" id="ch-cpu"></canvas><div class="legend" id="lg-cpu"></div></div><div><h5>Memory and Swap</h5><canvas class="chart" id="ch-mem"></canvas><div class="legend" id="lg-mem"></div></div><div><h5>Network</h5><canvas class="chart" id="ch-net"></canvas><div class="legend" id="lg-net"></div></div></div>`;
    else box.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Device</th><th>Directory</th><th>Type</th><th class="num">Total</th><th class="num">Available</th><th>Used</th></tr></thead><tbody>${[['/dev/nvme0n1p2', '/', 'ext4', 502.4, 382.1], ['/dev/nvme0n1p1', '/boot/efi', 'vfat', 1.1, 1.1]].map(([d, m, ty, tot, av]) => `<tr><td>${d}</td><td>${m}</td><td>${ty}</td><td class="num">${tot} GB</td><td class="num">${av} GB</td><td><span class="usebar"><i style="width:${Math.max(1, (1 - av / tot) * 100)}%"></i></span> ${Math.round((1 - av / tot) * 100)}%</td></tr>`).join('')}</tbody></table></div>`;
    if (t === 'proc') {
      const q = $('#mon-q-' + win.id, box); q.oninput = () => { filter = q.value.toLowerCase(); draw(); };
      $('thead', box).onclick = e => { const th = e.target.closest('[data-k]'); if (!th) return; if (sortK === th.dataset.k) sortDir *= -1; else { sortK = th.dataset.k; sortDir = ['name', 'user'].includes(sortK) ? 1 : -1; } draw(); };
      $('tbody', box).onclick = e => { const tr = e.target.closest('tr'); if (tr) { selPid = +tr.dataset.pid; draw(); } };
      $('tbody', box).oncontextmenu = e => { const tr = e.target.closest('tr'); if (!tr) return; e.preventDefault(); e.stopPropagation(); selPid = +tr.dataset.pid; draw(); showMenu(e.clientX, e.clientY, [{ label: 'Properties', action: () => notify('monitor', `PID ${selPid}`, (procList().find(p => p.pid === selPid) || {}).name || '') }, '-', { label: 'End', action: endSel }, { label: 'Kill', action: endSel }]); };
      $('#mon-end', box).onclick = endSel;
    }
    draw();
  }
  async function endSel() {
    const p = procList().find(x => x.pid === selPid); if (!p) return;
    if (p.user !== 'night') { await winDialog(win, { title: 'Authentication Required', body: `You don’t have permission to end “${esc(p.name)}” (PID ${p.pid}). It belongs to ${esc(p.user)}.`, buttons: [{ label: 'OK', cls: 'sug', value: 'ok' }] }); return; }
    const r = await winDialog(win, { title: `End “${esc(p.name)}”?`, body: 'Ending a process may destroy data, break the session or introduce a security risk. Only unresponsive processes should be ended.', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'End Process', cls: 'destr', value: 'ok' }] });
    if (r.btn === 'ok') { endProcess(p); selPid = null; setTimeout(draw, 200); }
  }
  function chart(cv, series, colors, max, fill) {
    const r = cv.getBoundingClientRect(); if (!r.width) return; const dpr = devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, cs = getComputedStyle(win.frame);
    g.clearRect(0, 0, W, H); g.strokeStyle = cs.getPropertyValue('--line'); g.lineWidth = 1 * dpr; g.fillStyle = cs.getPropertyValue('--fg-dim'); g.font = `${10.5 * dpr}px Cantarell, sans-serif`;
    for (let i = 0; i <= 4; i++) { const y = Math.round(H * i / 4) + .5; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillText(fill === 'net' ? max.toFixed(0) + ' KiB/s' : '100 %', 6 * dpr, 13 * dpr); g.textAlign = 'right'; g.fillText('60 secs', W - 6 * dpr, H - 6 * dpr); g.textAlign = 'left';
    series.forEach((s, si) => {
      g.beginPath(); s.forEach((v, i) => { const x = i / (s.length - 1) * W, y = H - clamp(v / max, 0, 1) * (H - 4 * dpr) - 2 * dpr; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = colors[si]; g.lineWidth = 1.8 * dpr; g.lineJoin = 'round'; g.stroke();
      if (fill) { g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.globalAlpha = .15; g.fillStyle = colors[si]; g.fill(); g.globalAlpha = 1; }
      const lv = s[s.length - 1], ly = H - clamp(lv / max, 0, 1) * (H - 4 * dpr) - 2 * dpr; g.beginPath(); g.arc(W - 3 * dpr, ly, 3 * dpr, 0, 7); g.fillStyle = colors[si]; g.fill();
    });
  }
  function draw() {
    if (tab === 'proc') {
      const tb = $('tbody', box); if (!tb) return; const wrap = $('.tbl-wrap', box), st = wrap.scrollTop;
      let l = procList().filter(p => !filter || p.name.toLowerCase().includes(filter));
      l.sort((a, b) => { const x = a[sortK], y = b[sortK]; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir; });
      tb.innerHTML = l.map(p => `<tr data-pid="${p.pid}" class="${p.pid === selPid ? 'sel' : ''}"><td><span class="pi">${p.win && !p.child ? AI[p.win.app]() : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="opacity:.6">${P.gear}</svg>`}${esc(p.name)}</span></td><td>${esc(p.user)}</td><td class="num">${p.cpu.toFixed(1)}</td><td class="num">${p.pid}</td><td class="num">${p.mem.toFixed(1)} MB</td></tr>`).join('');
      $$('th', box).forEach(th => th.textContent = th.textContent.replace(/ [▲▼]$/, '') + (th.dataset.k === sortK ? (sortDir > 0 ? ' ▲' : ' ▼') : ''));
      wrap.scrollTop = st;
      $('#mon-end', box).disabled = !l.some(p => p.pid === selPid);
      $('.mon-sum', box).textContent = `${l.length} processes · CPU ${(SYS.cpu.reduce((a, b) => a + b, 0) / SYS.cores).toFixed(1)} % · Memory ${(SYS.mem / 1024).toFixed(1)} of ${(SYS.memTotal / 1024).toFixed(1)} GiB`;
    } else if (tab === 'res') {
      const cv = $('#ch-cpu', box); if (!cv) return;
      chart(cv, SYS.hist, CORE_COLORS, 100);
      $('#lg-cpu', box).innerHTML = SYS.cpu.map((v, i) => `<span><i style="background:${CORE_COLORS[i]}"></i>CPU${i + 1}${i === 0 ? ' · NightOS main thread' : i === 1 ? ' · JavaScript worker' : ''} ${v.toFixed(1)}%</span>`).join('') + '<span style="color:var(--fg-dim)">Measured live from this browser tab.</span>';
      chart($('#ch-mem', box), [SYS.memHist, SYS.swapHist], ['#b493f2', '#6fd08c'], 100, true);
      $('#lg-mem', box).innerHTML = `<span><i style="background:#b493f2"></i>Memory ${SYS.mem >= 1024 ? (SYS.mem / 1024).toFixed(2) + ' GB' : SYS.mem.toFixed(1) + ' MB'} (${(SYS.mem / SYS.memTotal * 100).toFixed(1)}%) of ${(SYS.memTotal / 1024).toFixed(1)} GB${SYS.memReal ? ' · real JavaScript heap of this tab' : ' · simulated'}</span><span><i style="background:#6fd08c"></i>Swap 0 bytes (0.0%)</span>`;
      const mx = Math.max(16, ...SYS.rx, ...SYS.tx) * 1.2;
      chart($('#ch-net', box), [SYS.rx, SYS.tx], ['#78aeed', '#f4a259'], mx, 'net');
      $('#lg-net', box).innerHTML = `<span><i style="background:#78aeed"></i>Receiving ${SYS.net.rx.toFixed(1)} KiB/s · Total ${humanSI(Math.round(SYS.net.totRx))}</span><span style="color:var(--fg-dim)">Real bytes this page downloaded (fonts, Python, tools). ${navigator.connection && navigator.connection.downlink ? `Link estimate: ${navigator.connection.downlink} Mb/s, ${navigator.connection.rtt} ms` : ''}</span>`;
    }
  }
  seg.onclick = e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); };
  const onTick = () => { if (!win.min) draw(); };
  document.addEventListener('systick', onTick); win.onClose = () => document.removeEventListener('systick', onTick);
  win.onResize = () => tab === 'res' && draw();
  setTab('proc'); return win;
}
