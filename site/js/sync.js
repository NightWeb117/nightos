'use strict';
/* ================= Sync between the NightOS website and the Windows app =================
   Everything goes into one secret GitHub Gist ("NightOS Sync") on your own account, reached
   with a token that only has the gist permission. The token stays in this browser or app. */
const SY_FILE = 'nightos-sync.json', SY_DESC = 'NightOS Sync';
const SY = Object.assign({ token: '', gistId: '', login: '', last: 0, auto: true, status: '', error: '' }, store.get('sync', {}));
const sySave = () => { const { status, error, ...keep } = SY; store.set('sync', keep); };
const SY_KEYS = ['look', 'accent', 'style', 'theme', 'myThemes', 'installed', 'arcade', 'wallDance', 'mpViz', 'rec'];
let syApplying = false, syPushT = null, syBusy = false, syCfgHash = '';
const syCfgPart = () => { const o = {}; for (const k of SY_KEYS) if (CFG[k] !== undefined) o[k] = CFG[k]; o.wall = CFG.wall; return o; };
function syNoteChange(kind) {
  if (syApplying) return;
  if (kind === 'cfg') { const h = JSON.stringify(syCfgPart()); if (h === syCfgHash) return; syCfgHash = h; CFG._syncAt = Date.now(); store.set('cfg', CFG); }
  if (!SY.token || !SY.auto) return; clearTimeout(syPushT); syPushT = setTimeout(() => syncNow(true), 45000);
}
store.set = (orig => (k, v) => { orig(k, v); if (k === 'cfg' && !syApplying) syNoteChange('cfg'); if (k === 'fs1') syNoteChange('fs'); })(store.set.bind(store));
syCfgHash = JSON.stringify(syCfgPart());

async function gh(path, opt = {}) {
  const r = await fetch('https://api.github.com' + path, { ...opt, headers: { Authorization: 'Bearer ' + SY.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opt.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (r.status === 401) throw new Error('GitHub didn\'t accept the token. It may have expired or been deleted');
  if (r.status === 403 || r.status === 404) throw new Error(path.startsWith('/gists') ? 'The token doesn\'t have the gist permission' : 'GitHub refused the request (' + r.status + ')');
  if (!r.ok) throw new Error('GitHub answered ' + r.status);
  return r.status === 204 ? null : r.json();
}
// Text files in your home folder (not the Trash, caches or your Windows folders), up to 200 kB each.
function syFiles() {
  const out = {}; let total = 0;
  const walk = (n, p) => {
    if (n.type === 'dir') { if (n.winMount || n.winPath || p === TRASH || p.endsWith('/.cache')) return; for (const [k, c] of Object.entries(n.children)) walk(c, p + '/' + k); return; }
    if (n.blob || n.size != null || n.winPath) return; const c = n.content || ''; if (c.length > 200000 || total > 4e6) return;
    total += c.length; out[p] = { c, m: n.mtime || 0, x: !!n.exec };
  };
  const h = getNode(HOME); if (h) walk(h, HOME); return out;
}
function snapshot() {
  const cfg = syCfgPart();
  cfg.installed = (cfg.installed || []).filter(a => !a.local);
  if (String(cfg.wall).startsWith('img:')) delete cfg.wall;
  return { v: 1, at: Date.now(), cfgAt: CFG._syncAt || 0, from: NATIVE ? 'NightOS for Windows' : 'NightOS website', cfg, files: syFiles() };
}
function applySnapshot(r, { preferRemote = false } = {}) {
  if (!r || r.v !== 1) return { files: 0, cfg: false };
  syApplying = true; let files = 0, cfgDone = false;
  try {
    for (const [p, f] of Object.entries(r.files || {})) {
      if (!inHome(p) || p.includes('/../')) continue;
      const cur = getNode(p); if (cur && (cur.type !== 'file' || cur.blob || cur.winPath || (cur.mtime || 0) >= f.m)) continue;
      const [d, name] = splitPath(p); if (!getNode(d)) fsMkdir(d, { parents: true }); const dn = getNode(d); if (!dn || dn.type !== 'dir') continue;
      dn.children[name] = { type: 'file', content: String(f.c || ''), mtime: f.m || Date.now(), exec: !!f.x }; files++;
    }
    if (files) fsChanged();
    const c = r.cfg || {};
    if (preferRemote || (r.cfgAt || 0) > (CFG._syncAt || 0)) {
      if (c.look) CFG.look = mergeLook(LOOK_DEFAULT, { ...c.look, widgets: c.look.widgets || CFG.look.widgets });
      if (typeof c.accent === 'string') CFG.accent = c.accent; if (c.style === 'dark' || c.style === 'light') CFG.style = c.style;
      if (typeof c.theme === 'string') CFG.theme = c.theme; if (c.wall && WALLS[c.wall]) CFG.wall = c.wall;
      for (const k of ['wallDance', 'mpViz', 'rec']) if (c[k] !== undefined) CFG[k] = c[k];
      cfgDone = true;
    }
    // Lists merge both ways, so a theme or app added on either side is kept.
    const mine = myThemes(); for (const t of c.myThemes || []) if (t && t.id && !mine.some(m => m.id === t.id)) mine.push(t);
    for (const a of c.installed || []) if (a && a.id && !isInstalled(a.id)) { CFG.installed.push(a); registerApp(a); }
    CFG.arcade = CFG.arcade || {}; for (const [k, v] of Object.entries(c.arcade || {})) CFG.arcade[k] = Math.max(CFG.arcade[k] || 0, +v || 0);
    if (cfgDone) CFG._syncAt = r.cfgAt || Date.now();
    saveCfg(); syCfgHash = JSON.stringify(syCfgPart());
  } finally { syApplying = false; }
  if (cfgDone) { applyLook(); renderWall(true); }
  updateDock();
  return { files, cfg: cfgDone };
}
async function findGist() {
  if (SY.gistId) return SY.gistId;
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`); const g = list.find(x => x.description === SY_DESC && x.files[SY_FILE]);
    if (g) return (SY.gistId = g.id); if (list.length < 100) break;
  }
  return '';
}
async function readGist() {
  const g = await gh('/gists/' + SY.gistId), f = g.files[SY_FILE]; if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  try { return JSON.parse(text); } catch (e) { return null; }
}
const syRender = () => WM.wins.filter(w => w.app === 'settings' && w.show).forEach(w => { if ($('[data-sync-page]', w.body)) w.show('sync', true); });
async function syncNow(quiet, opts = {}) {
  if (!SY.token || syBusy) return; syBusy = true; SY.status = 'Syncing…'; SY.error = ''; syRender();
  try {
    await findGist();
    let got = { files: 0, cfg: false };
    if (SY.gistId) { const r = await readGist(); if (r) got = applySnapshot(r, opts); }
    const body = JSON.stringify({ description: SY_DESC, files: { [SY_FILE]: { content: JSON.stringify(snapshot()) } } });
    if (SY.gistId) await gh('/gists/' + SY.gistId, { method: 'PATCH', body });
    else SY.gistId = (await gh('/gists', { method: 'POST', body: JSON.stringify({ ...JSON.parse(body), public: false }) })).id;
    SY.last = Date.now(); SY.status = ''; sySave();
    if (!quiet || got.files || got.cfg) notify('settings', 'NightOS synced', got.files || got.cfg ? `Brought in ${[got.cfg ? 'your look and settings' : '', got.files ? `${got.files} file${got.files > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ')}.` : 'Everything is up to date.', { silent: quiet });
  } catch (e) { SY.status = ''; SY.error = e.message || String(e); if (!quiet) notify('settings', 'Couldn\'t sync', SY.error); }
  syBusy = false; syRender();
}
async function syConnect(token, win) {
  SY.token = token.trim(); SY.error = '';
  try {
    const u = await gh('/user'); SY.login = u.login; SY.gistId = ''; SY.last = 0;
    await findGist(); sySave();
    let prefer = false;
    if (SY.gistId) {
      const r = await readGist();
      if (r) { const c = await winDialog(win, { title: 'NightOS is already synced somewhere', body: `There's a sync from ${r.from || 'another NightOS'} (${fmtFileDate(r.at)}). Files from both are kept. Which look and settings should win?`, buttons: [{ label: 'Keep This One\'s', value: 'local' }, { label: 'Use the Synced Ones', cls: 'sug', value: 'remote' }] }); prefer = c.btn === 'remote'; }
    }
    await syncNow(false, { preferRemote: prefer });
  } catch (e) { SY.error = e.message || String(e); SY.token = ''; sySave(); }
}
// Pull now and then, and when NightOS starts.
setInterval(() => { if (SY.token && SY.auto && SYSTEM.state === 'desktop' && !document.hidden) syncNow(true); }, 10 * 60e3);
(function waitLogin() { if (SYSTEM.state === 'desktop') { if (SY.token && SY.auto) setTimeout(() => syncNow(true), 6000); } else setTimeout(waitLogin, 2000); })();

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=NightOS%20Sync';
SETTINGS_EXTRA.push({
  id: 'sync', label: 'Sync', icon: 'reload', group: 'system',
  render: () => SY.token ? `<div data-sync-page></div><div class="grp" style="padding:16px 18px;display:flex;gap:14px;align-items:center">${sym('reload').replace('class="sym', 'style="width:40px;height:40px;color:var(--accent);flex:none" class="sym')}<div style="flex:1"><b>Synced with GitHub as ${esc(SY.login)}</b><p style="margin:4px 0 0;color:var(--fg-dim)">${SY.status ? esc(SY.status) : SY.error ? `<span style="color:var(--bad)">${esc(SY.error)}</span>` : SY.last ? 'Last synced ' + esc(fmtFileDate(SY.last)) : 'Not synced yet'}</p></div><button class="hbtn sug" data-sync-now ${syBusy ? 'disabled' : ''}>Sync Now</button></div>
      <div class="grp">${ui.row('Sync automatically', 'When something changes, every 10 minutes, and when NightOS starts', `<button class="sw ${SY.auto ? 'on' : ''}" data-sync-auto role="switch" aria-checked="${SY.auto}" aria-label="Sync automatically"></button>`)}${ui.row('Disconnect', 'Removes the token from this ' + (NATIVE ? 'app' : 'browser') + '. Your sync gist stays on GitHub', '<button class="hbtn destr" data-sync-off>Disconnect</button>')}</div>
      <h4>What syncs</h4><div class="grp" style="padding:14px 18px;line-height:1.6;color:var(--fg-dim)">Your theme, colors, layout and your own themes · App Center apps · arcade best scores · text files in your home folder (up to 200 kB each).<br>Pictures, videos, music and apps you added from your computer stay on each device.</div>`
    : `<div data-sync-page></div><p style="color:var(--fg-dim);margin:0 0 4px;font-size:13px">Keep your look, your own themes, apps and text files the same on the NightOS website and NightOS for Windows. They're saved in a secret gist on your GitHub account.</p>
      <h4>Connect GitHub</h4><div class="grp" style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;line-height:1.5">
        <div><b>1.</b> Make a token that can only use gists. GitHub opens with the right box already ticked. Pick an expiry, then click <b>Generate token</b> at the bottom.</div>
        <div><a class="hbtn" href="${TOKEN_URL}" target="_blank" rel="noopener" style="background:var(--press);text-decoration:none;display:inline-flex">Create a Token on GitHub ${sym('open')}</a></div>
        <div><b>2.</b> Copy the token and paste it here.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="entry" type="password" data-sync-token placeholder="ghp_…" autocomplete="off" style="flex:1;min-width:200px" aria-label="GitHub token"><button class="hbtn sug" data-sync-connect>Connect</button></div>
        ${SY.error ? `<small style="color:var(--bad)">${esc(SY.error)}</small>` : ''}
        <small style="color:var(--fg-dim)">Do the same on your other NightOS with the same token, or a new one. The token stays in this ${NATIVE ? 'app' : 'browser'}, and App Center apps can't read it.</small>
      </div>`,
  bind: (main, ctx) => {
    const c = $('[data-sync-connect]', main);
    if (c) c.onclick = async () => { const t = $('[data-sync-token]', main).value; if (!t.trim()) return; c.disabled = true; c.textContent = 'Connecting…'; await syConnect(t, ctx.win); ctx.rerender(); };
    const n = $('[data-sync-now]', main); if (n) n.onclick = () => syncNow(false);
    const a = $('[data-sync-auto]', main); if (a) a.onclick = () => { SY.auto = !SY.auto; sySave(); ctx.rerender(); };
    const o = $('[data-sync-off]', main); if (o) o.onclick = () => { Object.assign(SY, { token: '', gistId: '', login: '', last: 0, error: '' }); sySave(); ctx.rerender(); notify('settings', 'Sync is off on this ' + (NATIVE ? 'app' : 'browser')); };
  }
});
