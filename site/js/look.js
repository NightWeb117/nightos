'use strict';
/* ================= Look: every visual choice about the desktop lives in CFG.look =================
   applyTheme() turns it into CSS variables and classes on #os, and resizes the space windows
   may use. Global themes are bundles of these settings plus accent, style and wallpaper. */
const LOOK_DEFAULT = {
  layout: 'panel', panelPos: 'bottom', panelFloat: true, panelH: 46, panelAlpha: .82,
  panelWidgets: ['launcher', 'pager', 'tasks', 'spacer', 'tray', 'clock', 'desktop'], taskTitles: false,
  clock24: true, clockSec: false, clockDate: true,
  dockPos: 'bottom', dockSize: 44,
  font: 'noto', radius: 10, btnSide: 'right', btnStyle: 'glyph', titleAlign: 'center', shadow: .5, anim: 'normal',
  desktops: 4, deskIcons: true, deskIconSize: 52, wallFx: 'none', hotCorner: true,
  wallAnim: true, particles: 'none', skin: 'none', titleFont: '', cursor: 'default', sound: '',
  widgets: [{ id: 'w1', type: 'clock', x: -330, y: 56 }, { id: 'w2', type: 'sysmon', x: -330, y: 236 }],
  term: { scheme: 'tidal', prompt: 'fish', fastfetch: true, suggest: true, size: 13.5 }
};
const LOOK = () => CFG.look;
const FONTS = {
  noto: { name: 'Noto Sans', stack: '"Noto Sans", "Segoe UI", system-ui, sans-serif', g: 'Noto+Sans:wght@400;700' },
  cantarell: { name: 'Cantarell', stack: '"Cantarell", "Noto Sans", system-ui, sans-serif' },
  fira: { name: 'Fira Sans', stack: '"Fira Sans", "Segoe UI", system-ui, sans-serif', g: 'Fira+Sans:wght@400;700' },
  ubuntu: { name: 'Ubuntu', stack: '"Ubuntu", "Segoe UI", system-ui, sans-serif', g: 'Ubuntu:wght@400;700' },
  atkinson: { name: 'Atkinson Hyperlegible', stack: '"Atkinson Hyperlegible", system-ui, sans-serif', g: 'Atkinson+Hyperlegible:wght@400;700' },
  system: { name: 'System default', stack: 'system-ui, "Segoe UI", sans-serif' }
};
const THEMES = {
  tidal: { name: 'Tidal', note: 'Teal on deep green-black, floating panel. The NightOS default.', accent: '#1fc3a7', style: 'dark', wall: 'tidal', look: { layout: 'panel', font: 'noto', btnStyle: 'glyph', radius: 10, term: { scheme: 'tidal' } } },
  dusk: { name: 'Dusk', note: 'The original NightOS: top bar, dock and round buttons.', accent: 'blue', style: 'dark', wall: 'umbra', look: { layout: 'dock', font: 'cantarell', btnStyle: 'circle', radius: 12, term: { scheme: 'night' } } },
  ember: { name: 'Ember', note: 'Warm orange over a dusk sky, with a full-width panel.', accent: '#f4a259', style: 'dark', wall: 'dusk', look: { layout: 'panel', panelFloat: false, font: 'fira', btnStyle: 'circle', radius: 8, term: { scheme: 'ember' } } },
  frost: { name: 'Frost', note: 'Cool blues under the aurora, panel on top.', accent: '#88c0d0', style: 'dark', wall: 'aurora', look: { layout: 'panel', panelPos: 'top', font: 'ubuntu', btnStyle: 'traffic', btnSide: 'left', titleAlign: 'center', radius: 12, term: { scheme: 'grape' } } },
  paper: { name: 'Paper', note: 'A light style for daytime, with the dock.', accent: '#3584e4', style: 'light', wall: 'ink', look: { layout: 'dock', font: 'atkinson', btnStyle: 'circle', radius: 12, term: { scheme: 'paper' } } }
};
const TERM_SCHEMES = [['tidal', 'Tidal'], ['night', 'Night'], ['ember', 'Ember'], ['grape', 'Grape'], ['paper', 'Paper']];
function mergeLook(base, over) { const o = { ...base, ...over }; o.term = { ...base.term, ...(over.term || {}) }; return o; }
function applyPreset(id, { keepWall = false } = {}) {
  const p = THEMES[id]; if (!p) return;
  CFG.look = mergeLook(mergeLook(LOOK_DEFAULT, { widgets: (CFG.look && CFG.look.widgets) || LOOK_DEFAULT.widgets }), p.look);
  CFG.accent = p.accent; CFG.style = p.style; if (!keepWall) CFG.wall = p.wall; CFG.theme = id;
  saveCfg(); applyLook(); if (!keepWall) renderWall(true);
}
// First run of this version: start everyone on the Tidal theme. Later runs fill in any new settings.
if (!CFG.look) { CFG.look = mergeLook(LOOK_DEFAULT, THEMES.tidal.look); CFG.accent = THEMES.tidal.accent; CFG.style = 'dark'; CFG.wall = 'tidal'; CFG.theme = 'tidal'; saveCfg(); }
else CFG.look = mergeLook(LOOK_DEFAULT, CFG.look);

const loadedFonts = new Set();
function loadFont(id) {
  const f = FONTS[id]; if (!f || !f.g || loadedFonts.has(id)) return; loadedFonts.add(id);
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`; document.head.append(l);
}
RESERVE = () => {
  const L = LOOK(), n = isNarrow();
  if (L.layout === 'dock') { const d = (n ? Math.min(L.dockSize, 36) : L.dockSize) + 22; return L.dockPos === 'left' && !n ? { top: 32, bottom: 0, left: d + 8, right: 0 } : { top: 32, bottom: d, left: 0, right: 0 }; }
  const p = L.panelH + (L.panelFloat ? 14 : 0);
  return L.panelPos === 'top' ? { top: p, bottom: 0, left: 0, right: 0 } : { top: 0, bottom: p, left: 0, right: 0 };
};
function refitWindows() {
  for (const w of WM.wins) {
    if (w.state === 'max' || w.state === 'tiled' || isNarrow()) applySnap(w, w.snap || 'max', false);
    else { const wa = workArea(); setRect(w, clamp(w.r.x, wa.x, Math.max(wa.x, wa.x + wa.w - 120)), clamp(w.r.y, wa.y, Math.max(wa.y, wa.y + wa.h - 60)), Math.min(w.r.w, wa.w), Math.min(w.r.h, wa.h)); }
  }
}
function applyTheme() {
  const L = LOOK(), os = $('#os'), rs = document.documentElement.style;
  rs.setProperty('--radius', L.radius + 'px');
  rs.setProperty('--shadow-a', String(L.shadow));
  rs.setProperty('--panel-h', L.panelH + 'px');
  rs.setProperty('--panel-alpha', String(L.panelAlpha));
  rs.setProperty('--dock-icon', L.dockSize + 'px');
  rs.setProperty('--desk-icon', L.deskIconSize + 'px');
  rs.setProperty('--font-ui', (FONTS[L.font] || FONTS.noto).stack); loadFont(L.font);
  const cls = {
    'lay-panel': L.layout === 'panel', 'lay-dock': L.layout === 'dock', 'panel-top': L.panelPos === 'top', 'panel-float': L.panelFloat,
    'btn-left': L.btnSide === 'left', 'btns-glyph': L.btnStyle === 'glyph', 'btns-traffic': L.btnStyle === 'traffic', 'title-left': L.titleAlign === 'left',
    'anim-off': L.anim === 'off', 'anim-fast': L.anim === 'fast', 'anim-slow': L.anim === 'slow', 'deskicons-off': !L.deskIcons,
    'wallfx-dim': L.wallFx === 'dim', 'wallfx-blur': L.wallFx === 'blur', 'dock-left': L.dockPos === 'left'
  };
  for (const [k, v] of Object.entries(cls)) os.classList.toggle(k, v);
  BAR = RESERVE().top;
  if (typeof renderPanel === 'function') renderPanel();
  if (typeof renderWidgets === 'function') renderWidgets();
  if (WM.wins.length) refitWindows();
  document.dispatchEvent(new Event('look'));
}
function setLook(path, v) {
  const parts = path.split('.'); let o = CFG.look; while (parts.length > 1) o = o[parts.shift()];
  o[parts[0]] = v; CFG.theme = 'custom'; saveCfg(); applyLook();
}
function exportLook() {
  return JSON.stringify({ nightosTheme: 1, look: CFG.look, accent: CFG.accent, style: CFG.style, wall: CFG.wall.startsWith('img:') ? 'tidal' : CFG.wall }, null, 2);
}
function importLook(text) {
  const j = JSON.parse(text); if (!j || j.nightosTheme !== 1 || !j.look) throw new Error('That isn\'t a NightOS theme file.');
  CFG.look = mergeLook(LOOK_DEFAULT, j.look);
  if (typeof j.accent === 'string' && (ACCENTS[j.accent] || /^#[0-9a-f]{6}$/i.test(j.accent))) CFG.accent = j.accent;
  if (j.style === 'dark' || j.style === 'light') CFG.style = j.style;
  if (WALLS[j.wall]) CFG.wall = j.wall;
  CFG.theme = 'custom'; saveCfg(); applyLook(); renderWall(true);
}

/* ---------- the Tidal wallpaper: slow teal currents over deep water ---------- */
WALLS.tidal = {
  name: 'Tidal', draw(ctx, w, h) {
    const r = rng(314), u = Math.max(.6, Math.min(w, h) / 1080);
    ctx.fillStyle = vgrad(ctx, h, [[0, '#020a0b'], [.55, '#04191a'], [1, '#062624']]); ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * .68, h * .62, 0, w * .68, h * .62, Math.max(w, h) * .7);
    glow.addColorStop(0, 'rgba(31,195,167,.22)'); glow.addColorStop(1, 'rgba(31,195,167,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    stars(ctx, r, w, h, Math.round(w * h / 9000), h * .45, u * .8);
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9; k++) {
      const base = h * (.5 + k * .055), amp = h * (.05 + r() * .06), fr = .6 + r() * .9, ph = r() * 6.28, thick = h * (.012 + r() * .03);
      const hue = 162 + k * 4 + r() * 10, a = .07 + r() * .07;
      for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) { const t = x / w, y = base + Math.sin(t * Math.PI * 2 * fr + ph) * amp + Math.sin(t * 9 + ph * 2) * amp * .2 + s * thick * .6; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = `hsla(${hue},80%,${52 + s * 6}%,${a * (1 - s * .3)})`; ctx.lineWidth = thick * (1 - s * .28); ctx.stroke();
      }
    }
    for (let i = 0; i < 160; i++) { const x = r() * w, y = h * (.45 + r() * .55), s = (.6 + r() * 1.6) * u; ctx.fillStyle = `rgba(150,255,230,${.05 + r() * .25})`; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    const fade = ctx.createLinearGradient(0, h * .82, 0, h); fade.addColorStop(0, 'rgba(2,10,11,0)'); fade.addColorStop(1, 'rgba(2,10,11,.7)'); ctx.fillStyle = fade; ctx.fillRect(0, h * .82, w, h * .18);
  }
};

/* ---------- Settings pages for customizing the desktop ---------- */
const SETTINGS_EXTRA = [];
const ui = {
  sw: (path, on) => `<button class="sw ${on ? 'on' : ''}" data-look-sw="${path}" role="switch" aria-checked="${!!on}" aria-label="${path}"></button>`,
  sel: (path, val, opts) => `<select data-look-sel="${path}" aria-label="${path}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`,
  range: (path, val, min, max, step, unit = '') => `<span style="display:flex;align-items:center;gap:10px"><input type="range" class="sl" data-look-range="${path}" min="${min}" max="${max}" step="${step}" value="${val}" style="width:160px" aria-label="${path}"><span class="val" style="min-width:42px">${val}${unit}</span></span>`,
  seg: (path, val, opts) => `<div class="seg" style="flex:none">${opts.map(([v, l]) => `<button type="button" class="${String(v) === String(val) ? 'on' : ''}" data-look-seg="${path}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`,
  row: (title, sub, right) => `<div class="row"><div class="tx">${title}${sub ? `<small>${sub}</small>` : ''}</div>${right}</div>`
};
const getPath = path => path.split('.').reduce((o, k) => o[k], CFG.look);
function bindLookControls(main, rerender) {
  main.querySelectorAll('[data-look-sw]').forEach(b => b.onclick = () => { setLook(b.dataset.lookSw, !getPath(b.dataset.lookSw)); rerender(); });
  main.querySelectorAll('[data-look-sel]').forEach(s => s.onchange = () => { const v = s.value, n = Number(v); setLook(s.dataset.lookSel, v !== '' && !isNaN(n) && /^-?[\d.]+$/.test(v) ? n : v); rerender(); });
  main.querySelectorAll('[data-look-seg]').forEach(b => b.onclick = () => { const v = b.dataset.v, n = Number(v); setLook(b.dataset.lookSeg, /^-?[\d.]+$/.test(v) ? n : v); rerender(); });
  main.querySelectorAll('[data-look-range]').forEach(r => {
    r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
    r.oninput = () => { const v = Number(r.value); r.style.setProperty('--v', ((v - r.min) / (r.max - r.min) * 100) + '%'); r.nextElementSibling.textContent = v + (r.nextElementSibling.textContent.replace(/^[\d.\-]+/, '')); setLook(r.dataset.lookRange, v); };
  });
}
function themeCard(id, p, on) {
  const accent = ACCENTS[p.accent] ? ACCENTS[p.accent][0] : p.accent, lay = p.look.layout;
  return `<button class="th-card ${on ? 'on' : ''}" data-theme="${id}"><div class="th-pv" style="background:url(${wallThumb(p.wall, 280, 170)}) center/cover">
    <i class="th-win" style="background:${p.style === 'light' ? '#f6f6f8' : '#1f2027'};border-radius:${p.look.radius / 2}px"><b style="background:${accent}"></b></i>
    ${lay === 'panel' ? `<i class="th-panel ${p.look.panelPos === 'top' ? 'top' : ''} ${p.look.panelFloat === false ? 'full' : ''}"><b style="background:${accent}"></b></i>` : '<i class="th-top"></i><i class="th-dock"></i>'}
  </div><span><b>${esc(p.name)}</b><small>${esc(p.note)}</small></span></button>`;
}
SETTINGS_EXTRA.push(
  {
    id: 'theme', label: 'Global Theme', icon: 'palette', group: 'look',
    render: () => `<div class="th-grid">${Object.entries(THEMES).map(([id, p]) => themeCard(id, p, CFG.theme === id)).join('')}</div>
      <p style="color:var(--fg-dim);margin:0;font-size:13px">A global theme sets the layout, colors, fonts, window buttons, wallpaper and terminal colors together. You can change any part of it afterwards.${CFG.theme === 'custom' ? ' <b style="color:var(--fg)">You are using a custom look.</b>' : ''}</p>
      <h4>Share your look</h4><div class="grp">${ui.row('Export theme', 'Copies your whole look as a small JSON file', '<button class="hbtn" data-exp style="background:var(--press)">Export</button>')}${ui.row('Import theme', 'Paste a theme someone shared, or choose a .json file', '<span style="display:flex;gap:8px"><button class="hbtn" data-imp-paste style="background:var(--press)">Paste</button><button class="hbtn" data-imp-file style="background:var(--press)">Choose File</button></span>')}${ui.row('Reset everything', 'Go back to the Tidal defaults', '<button class="hbtn destr" data-reset>Reset</button>')}</div>`,
    bind: (main, ctx) => {
      main.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { applyPreset(b.dataset.theme); ctx.rerender(); });
      $('[data-exp]', main).onclick = async () => {
        const txt = exportLook(); let copied = false; try { await navigator.clipboard.writeText(txt); copied = true; } catch (e) { }
        if (!window.claude) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'nightos-theme.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
        notify('settings', 'Theme exported', copied ? 'Copied to the clipboard and saved as nightos-theme.json.' : 'Saved as nightos-theme.json.');
      };
      const doImport = txt => { try { importLook(txt); notify('settings', 'Theme imported'); ctx.rerender(); } catch (e) { notify('settings', 'Couldn\'t import the theme', e.message); } };
      $('[data-imp-paste]', main).onclick = async () => { const r = await winDialog(ctx.win, { title: 'Import Theme', body: 'Paste the theme text here.', entry: '', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Import', cls: 'sug', value: 'ok' }] }); if (r.btn === 'ok' && r.value) doImport(r.value); };
      $('[data-imp-file]', main).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => { if (i.files[0]) doImport(await i.files[0].text()); }; i.click(); };
      $('[data-reset]', main).onclick = async () => { const r = await winDialog(ctx.win, { title: 'Reset the look?', body: 'Layout, colors, fonts, windows, widgets and terminal colors go back to the Tidal defaults. Your files are not touched.', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Reset', cls: 'destr', value: 'ok' }] }); if (r.btn === 'ok') { CFG.look = null; applyPreset('tidal'); CFG.look.widgets = JSON.parse(JSON.stringify(LOOK_DEFAULT.widgets)); saveCfg(); applyLook(); ctx.rerender(); } };
    }
  },
  {
    id: 'colors', label: 'Colors & Fonts', icon: 'palette', group: 'look',
    render: () => {
      const cur = ACCENTS[CFG.accent] ? ACCENTS[CFG.accent][0] : CFG.accent, L = LOOK();
      const sw = ['#1fc3a7', '#5ec7c1', '#6fd08c', '#a3d95f', '#f2cc5b', '#f4a259', '#f0756c', '#ef8fc4', '#b493f2', '#7c8cff', '#78aeed', '#9aa9c3'];
      return `<h4>Style</h4><div class="grp">${ui.row('Dark style', 'Dark windows and menus', `<button class="sw ${CFG.style === 'dark' ? 'on' : ''}" data-dark role="switch" aria-checked="${CFG.style === 'dark'}" aria-label="Dark style"></button>`)}</div>
      <h4>Accent color</h4><div class="grp" style="padding:16px;display:flex;flex-direction:column;gap:14px"><div class="accents">${sw.map(c => `<button class="${cur.toLowerCase() === c ? 'on' : ''}" data-acc="${c}" style="background:${c}" aria-label="Accent ${c}">${cur.toLowerCase() === c ? sym('check') : ''}</button>`).join('')}</div>
        <label style="display:flex;align-items:center;gap:12px;color:var(--fg-dim)">Any color <input type="color" value="${cur}" data-acc-pick style="width:48px;height:32px;border:0;background:none;padding:0" aria-label="Pick any accent color"><code style="font-family:var(--font-mono);color:var(--fg)">${esc(cur)}</code></label></div>
      <h4>Fonts</h4><div class="grp">${ui.row('Interface font', '', ui.sel('font', L.font, Object.entries(FONTS).map(([k, f]) => [k, f.name])))}</div>
      <div class="grp" style="padding:16px 18px"><div style="font-family:${(FONTS[L.font] || FONTS.noto).stack};font-size:22px;font-weight:700">The quick night owl flies.</div><div style="font-family:${(FONTS[L.font] || FONTS.noto).stack};color:var(--fg-dim)">AaBbCc 0123456789 · ${esc((FONTS[L.font] || FONTS.noto).name)}</div></div>`;
    },
    bind: (main, ctx) => {
      bindLookControls(main, ctx.rerender);
      $('[data-dark]', main).onclick = () => { CFG.style = CFG.style === 'dark' ? 'light' : 'dark'; CFG.theme = 'custom'; saveCfg(); applyLook(); ctx.rerender(); };
      main.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { CFG.accent = b.dataset.acc; CFG.theme = 'custom'; saveCfg(); applyLook(); ctx.rerender(); });
      const pk = $('[data-acc-pick]', main); pk.oninput = () => { CFG.accent = pk.value; CFG.theme = 'custom'; saveCfg(); applyLook(); pk.nextElementSibling.textContent = pk.value; }; pk.onchange = () => ctx.rerender();
    }
  },
  {
    id: 'panel', label: 'Panel & Dock', icon: 'desktop', group: 'look',
    render: () => {
      const L = LOOK(), W = { launcher: 'App launcher', pager: 'Virtual desktops', tasks: 'Task manager', spacer: 'Flexible space', tray: 'System tray', clock: 'Clock', desktop: 'Show desktop' };
      const all = Object.keys(W), used = L.panelWidgets, unused = all.filter(k => !used.includes(k));
      return `<h4>Layout</h4><div class="grp">${ui.row('Desktop layout', 'A panel with a launcher and taskbar, or a top bar with a dock', ui.seg('layout', L.layout, [['panel', 'Panel'], ['dock', 'Top bar + Dock']]))}</div>
      ${L.layout === 'panel' ? `<h4>Panel</h4><div class="grp">${ui.row('Position', '', ui.seg('panelPos', L.panelPos, [['bottom', 'Bottom'], ['top', 'Top']]))}${ui.row('Floating', 'Leaves a gap around the panel', ui.sw('panelFloat', L.panelFloat))}${ui.row('Height', '', ui.range('panelH', L.panelH, 34, 64, 1, 'px'))}${ui.row('Opacity', '', ui.range('panelAlpha', L.panelAlpha, .4, 1, .02))}${ui.row('Show window titles', 'Task manager buttons with names instead of icons only', ui.sw('taskTitles', L.taskTitles))}</div>
        <h4>Panel widgets</h4><div class="grp">${used.map((k, i) => `<div class="row"><div class="tx">${W[k]}</div><button class="hbtn" data-pw-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">${sym('up')}</button><button class="hbtn" data-pw-down="${i}" ${i < used.length - 1 ? '' : 'disabled'} aria-label="Move down">${sym('down')}</button><button class="hbtn" data-pw-rm="${i}" aria-label="Remove">${sym('close')}</button></div>`).join('')}${unused.length ? `<div class="row"><div class="tx">Add a widget</div><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${unused.map(k => `<button class="hbtn" data-pw-add="${k}" style="background:var(--press)">${sym('plus')} ${W[k]}</button>`).join('')}</span></div>` : ''}</div>
        <h4>Clock</h4><div class="grp">${ui.row('24-hour time', '', ui.sw('clock24', L.clock24))}${ui.row('Show seconds', '', ui.sw('clockSec', L.clockSec))}${ui.row('Show date', '', ui.sw('clockDate', L.clockDate))}</div>`
        : `<h4>Dock</h4><div class="grp">${ui.row('Position', '', ui.seg('dockPos', L.dockPos, [['bottom', 'Bottom'], ['left', 'Left']]))}${ui.row('Icon size', '', ui.range('dockSize', L.dockSize, 32, 64, 2, 'px'))}${ui.row('Hot corner', 'Move the pointer to the top-left corner to show Activities', ui.sw('hotCorner', L.hotCorner))}</div>`}`;
    },
    bind: (main, ctx) => {
      bindLookControls(main, ctx.rerender);
      const W = LOOK().panelWidgets, save = () => { CFG.theme = 'custom'; saveCfg(); applyLook(); ctx.rerender(); };
      main.querySelectorAll('[data-pw-up]').forEach(b => b.onclick = () => { const i = +b.dataset.pwUp; [W[i - 1], W[i]] = [W[i], W[i - 1]]; save(); });
      main.querySelectorAll('[data-pw-down]').forEach(b => b.onclick = () => { const i = +b.dataset.pwDown; [W[i + 1], W[i]] = [W[i], W[i + 1]]; save(); });
      main.querySelectorAll('[data-pw-rm]').forEach(b => b.onclick = () => { W.splice(+b.dataset.pwRm, 1); save(); });
      main.querySelectorAll('[data-pw-add]').forEach(b => b.onclick = () => { W.splice(Math.max(0, W.indexOf('tray')), 0, b.dataset.pwAdd); save(); });
    }
  },
  {
    id: 'windows', label: 'Windows', icon: 'grid', group: 'look',
    render: () => { const L = LOOK(); return `<h4>Title bar buttons</h4><div class="grp">${ui.row('Style', '', ui.seg('btnStyle', L.btnStyle, [['glyph', 'Plain'], ['circle', 'Round'], ['traffic', 'Colored']]))}${ui.row('Side', '', ui.seg('btnSide', L.btnSide, [['left', 'Left'], ['right', 'Right']]))}${ui.row('Title alignment', '', ui.seg('titleAlign', L.titleAlign, [['left', 'Left'], ['center', 'Center']]))}</div>
      <h4>Shape and depth</h4><div class="grp">${ui.row('Corner radius', '', ui.range('radius', L.radius, 0, 20, 1, 'px'))}${ui.row('Shadow strength', '', ui.range('shadow', L.shadow, 0, 1, .05))}</div>
      <h4>Motion</h4><div class="grp">${ui.row('Animation speed', 'Window, menu and dock animations', ui.seg('anim', L.anim, [['off', 'Off'], ['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']]))}</div>
      <h4>Virtual desktops</h4><div class="grp">${ui.row('Number of desktops', 'Switch with Ctrl+Alt+Left and Right, or the pager', ui.sel('desktops', L.desktops, [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]))}</div>`; },
    bind: (main, ctx) => bindLookControls(main, ctx.rerender)
  }
);
