'use strict';
/* ================= Desktop widgets =================
   Each widget is { id, type, x, y, ...options } in CFG.look.widgets. A negative x counts
   from the right edge, so widgets placed on the right stay there when the window resizes. */
const WIDGET_TYPES = {
  clock: { name: 'Clock', w: 300 },
  sysmon: { name: 'System Monitor', w: 300 },
  note: { name: 'Sticky Note', w: 260 },
  photo: { name: 'Photo Frame', w: 300 }
};
function addWidget(type) {
  const n = CFG.look.widgets.length;
  CFG.look.widgets.push({ id: 'w' + Date.now().toString(36), type, x: 120 + n * 30, y: RESERVE().top + 60 + n * 30, text: type === 'note' ? 'Write something here…' : undefined, style: type === 'clock' ? 'digital' : undefined });
  saveCfg(); renderWidgets();
}
function removeWidget(id) { CFG.look.widgets = CFG.look.widgets.filter(w => w.id !== id); saveCfg(); renderWidgets(); }
function widgetBody(w) {
  if (w.type === 'clock') return w.style === 'analog'
    ? `<svg class="wg-analog" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="rgba(0,0,0,.25)" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>${Array.from({ length: 12 }, (_, i) => `<line x1="50" y1="8" x2="50" y2="${i % 3 ? 13 : 16}" stroke="rgba(255,255,255,.6)" stroke-width="${i % 3 ? 1.2 : 2.4}" transform="rotate(${i * 30} 50 50)"/>`).join('')}<line class="wg-h" x1="50" y1="50" x2="50" y2="27" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><line class="wg-m" x1="50" y1="50" x2="50" y2="17" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><line class="wg-s" x1="50" y1="56" x2="50" y2="14" style="stroke:var(--accent)" stroke-width="1.2" stroke-linecap="round"/><circle cx="50" cy="50" r="3" style="fill:var(--accent)"/></svg><div class="wg-date"></div>`
    : '<div class="wg-time"></div><div class="wg-date"></div>';
  if (w.type === 'sysmon') return `<div class="wg-mon"><div><span>CPU</span><b class="wg-cpu">0%</b></div><canvas class="wg-spark" width="260" height="54"></canvas><div class="wg-bar"><span>Memory</span><i><b class="wg-mem"></b></i><em class="wg-memt"></em></div><div class="wg-bar"><span>Storage</span><i><b class="wg-disk"></b></i><em class="wg-diskt"></em></div><div class="wg-bar"><span>Battery</span><i><b class="wg-bat"></b></i><em class="wg-batt"></em></div></div>`;
  if (w.type === 'note') return `<textarea class="wg-note" spellcheck="false" aria-label="Sticky note">${esc(w.text || '')}</textarea>`;
  if (w.type === 'photo') return '<div class="wg-photo"><img alt=""></div>';
  return '';
}
function renderWidgets() {
  let host = $('#widgets'); if (!host) { host = el('<div id="widgets"></div>'); $('#os').insertBefore(host, $('#windows')); }
  host.innerHTML = '';
  for (const w of CFG.look.widgets) {
    const t = WIDGET_TYPES[w.type]; if (!t) continue;
    const node = el(`<section class="wg wg-${w.type}" data-id="${w.id}" aria-label="${t.name} widget" style="width:${t.w}px"><header class="wg-hd"><span>${t.name}</span><button class="wg-x" aria-label="Remove ${t.name}">${sym('close')}</button></header><div class="wg-bd">${widgetBody(w)}</div></section>`);
    host.append(node); placeWidget(node, w);
    $('.wg-x', node).onclick = () => removeWidget(w.id);
    $('.wg-hd', node).addEventListener('pointerdown', e => dragWidget(e, node, w));
    if (w.type === 'note') { const ta = $('textarea', node); let tt; ta.oninput = () => { clearTimeout(tt); tt = setTimeout(() => { w.text = ta.value; saveCfg(); }, 400); }; }
    if (w.type === 'photo') nextPhoto(node);
  }
  tickWidgets();
}
function placeWidget(node, w) {
  const W = node.offsetWidth || 300, H = node.offsetHeight || 160;
  const x = w.x < 0 ? innerWidth + w.x : w.x, r = RESERVE();
  node.style.left = clamp(x, 4, innerWidth - W - 4) + 'px';
  node.style.top = clamp(w.y, r.top + 4, innerHeight - r.bottom - H - 4) + 'px';
}
function dragWidget(e, node, w) {
  if (e.button !== 0 || e.target.closest('button')) return;
  e.preventDefault(); const sx = e.clientX, sy = e.clientY, ox = node.offsetLeft, oy = node.offsetTop;
  node.classList.add('drag'); document.body.classList.add('wm-drag');
  const mv = ev => { node.style.left = (ox + ev.clientX - sx) + 'px'; node.style.top = (oy + ev.clientY - sy) + 'px'; };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); node.classList.remove('drag'); document.body.classList.remove('wm-drag');
    const left = node.offsetLeft, right = innerWidth - (left + node.offsetWidth);
    w.x = right < left ? -(right + node.offsetWidth) : left; w.y = node.offsetTop; saveCfg(); placeWidget(node, w);
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
const photoState = new WeakMap();
async function nextPhoto(node) {
  const img = $('img', node); if (!img) return;
  const pics = []; const dir = getNode(HOME + '/Pictures');
  const walk = (p, n, d) => { if (!n || n.type !== 'dir' || d > 2) return; for (const [k, v] of Object.entries(n.children)) { if (v.type === 'dir') walk(p + '/' + k, v, d + 1); else if (fileKind(k, v) === 'image') pics.push(v); } };
  walk(HOME + '/Pictures', dir, 0);
  if (!pics.length) { img.src = wallThumb(CFG.wall.startsWith('img:') ? 'tidal' : CFG.wall, 600, 380); return; }
  const i = ((photoState.get(node) ?? -1) + 1) % pics.length; photoState.set(node, i);
  const n = pics[i];
  if (n.blob) { const b = await BLOBS.get(n.blob); if (b) { if (img.dataset.url) URL.revokeObjectURL(img.dataset.url); img.dataset.url = URL.createObjectURL(b); img.src = img.dataset.url; } }
  else { const id = (n.content || '').replace('wall:', ''); img.src = wallThumb(WALLS[id] ? id : 'tidal', 600, 380); }
}
function spark(cv, data) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1fc3a7';
  g.beginPath(); data.forEach((v, i) => { const x = i / (data.length - 1) * W, y = H - 2 - clamp(v, 0, 100) / 100 * (H - 4); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.strokeStyle = acc; g.lineWidth = 2; g.stroke(); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.globalAlpha = .18; g.fillStyle = acc; g.fill(); g.globalAlpha = 1;
}
function tickWidgets() {
  const host = $('#widgets'); if (!host) return;
  const d = new Date(), L = LOOK();
  for (const node of host.children) {
    const w = CFG.look.widgets.find(x => x.id === node.dataset.id); if (!w) continue;
    if (w.type === 'clock') {
      const tm = $('.wg-time', node), dt = $('.wg-date', node);
      if (tm) tm.textContent = `${L.clock24 ? pad(d.getHours()) : (d.getHours() % 12 || 12)}:${pad(d.getMinutes())}`;
      if (dt) dt.textContent = `${WDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
      const hh = $('.wg-h', node); if (hh) { const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = d.getHours() % 12 + m / 60; hh.setAttribute('transform', `rotate(${h * 30} 50 50)`); $('.wg-m', node).setAttribute('transform', `rotate(${m * 6} 50 50)`); $('.wg-s', node).setAttribute('transform', `rotate(${s * 6} 50 50)`); }
    } else if (w.type === 'sysmon') {
      $('.wg-cpu', node).textContent = SYS.cpu[0] != null ? SYS.cpu[0].toFixed(0) + '%' : '0%'; spark($('.wg-spark', node), SYS.hist[0] || []);
      const mp = SYS.mem / SYS.memTotal * 100; $('.wg-mem', node).style.width = mp + '%'; $('.wg-memt', node).textContent = `${SYS.mem < 1024 ? Math.round(SYS.mem) + ' MB' : (SYS.mem / 1024).toFixed(1) + ' GB'} of ${(SYS.memTotal / 1024).toFixed(1)} GB`;
      const st = REAL.storage, dp = st && st.quota ? st.usage / st.quota * 100 : 24; $('.wg-disk', node).style.width = Math.max(1, dp) + '%'; $('.wg-diskt', node).textContent = st && st.quota ? `${humanSI(st.usage || 0)} used` : 'simulated';
      $('.wg-bat', node).style.width = CFG.battery + '%'; $('.wg-batt', node).textContent = `${CFG.battery}%${REAL.battery && REAL.battery.charging ? ' · charging' : ''}`;
    }
  }
}
setInterval(() => { if (SYSTEM.state === 'desktop') tickWidgets(); }, 1000);
setInterval(() => { $$('#widgets .wg-photo').forEach(p => nextPhoto(p.closest('.wg'))); }, 12000);
addEventListener('resize', () => { const host = $('#widgets'); if (!host) return; for (const node of host.children) { const w = CFG.look.widgets.find(x => x.id === node.dataset.id); if (w) placeWidget(node, w); } });

SETTINGS_EXTRA.push(
  {
    id: 'desktopcfg', label: 'Desktop & Widgets', icon: 'desktop', group: 'look',
    render: () => {
      const L = LOOK();
      return `<h4>Desktop</h4><div class="grp">${ui.row('Show desktop icons', 'Home, Trash and the files in ~/Desktop', ui.sw('deskIcons', L.deskIcons))}${ui.row('Icon size', '', ui.range('deskIconSize', L.deskIconSize, 36, 80, 2, 'px'))}${ui.row('Wallpaper effect', 'Makes windows and widgets stand out', ui.seg('wallFx', L.wallFx, [['none', 'None'], ['dim', 'Dim'], ['blur', 'Blur']]))}</div>
      <h4>Widgets on the desktop</h4><div class="grp">${L.widgets.length ? L.widgets.map(w => `<div class="row"><div class="tx">${esc((WIDGET_TYPES[w.type] || {}).name || w.type)}<small>Drag it by its title to move it</small></div>${w.type === 'clock' ? `<select data-wstyle="${w.id}" aria-label="Clock style"><option value="digital" ${w.style !== 'analog' ? 'selected' : ''}>Digital</option><option value="analog" ${w.style === 'analog' ? 'selected' : ''}>Analog</option></select>` : ''}<button class="hbtn" data-wrm="${w.id}" aria-label="Remove">${sym('trash')}</button></div>`).join('') : '<div class="row"><div class="tx" style="color:var(--fg-dim)">No widgets yet</div></div>'}
        <div class="row"><div class="tx">Add a widget</div><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${Object.entries(WIDGET_TYPES).map(([k, t]) => `<button class="hbtn" data-wadd="${k}" style="background:var(--press)">${sym('plus')} ${t.name}</button>`).join('')}</span></div></div>`;
    },
    bind: (main, ctx) => {
      bindLookControls(main, ctx.rerender);
      main.querySelectorAll('[data-wadd]').forEach(b => b.onclick = () => { addWidget(b.dataset.wadd); ctx.rerender(); });
      main.querySelectorAll('[data-wrm]').forEach(b => b.onclick = () => { removeWidget(b.dataset.wrm); ctx.rerender(); });
      main.querySelectorAll('[data-wstyle]').forEach(s => s.onchange = () => { const w = CFG.look.widgets.find(x => x.id === s.dataset.wstyle); if (w) { w.style = s.value; saveCfg(); renderWidgets(); } });
    }
  },
  {
    id: 'terminalcfg', label: 'Terminal', icon: 'term', group: 'look',
    render: () => {
      const T = LOOK().term, schemes = [['tidal', 'Tidal'], ['night', 'Night'], ['ember', 'Ember'], ['grape', 'Grape'], ['paper', 'Paper']];
      return `<h4>Colors</h4><div class="grp" style="padding:14px"><div class="ts-grid">${schemes.map(([k, n]) => `<button class="ts-card ts-${k} ${T.scheme === k ? 'on' : ''}" data-look-seg="term.scheme" data-v="${k}"><code><span class="c-g b">night@nightos</span> <span class="c-b b">~</span>&gt; ls</code><code><span class="c-b b">Documents</span>  <span class="c-g b">run.sh</span>  notes.txt</code><span>${n}</span></button>`).join('')}</div></div>
      <h4>Shell</h4><div class="grp">${ui.row('Prompt style', '', ui.seg('term.prompt', T.prompt, [['fish', 'Fish'], ['bash', 'Bash'], ['arrow', 'Arrow']]))}${ui.row('Autosuggestions', 'Shows a grey suggestion from your history. Press → to accept it', ui.sw('term.suggest', T.suggest))}${ui.row('System info on open', 'Runs fastfetch when a new terminal opens', ui.sw('term.fastfetch', T.fastfetch))}${ui.row('Font size', '', ui.range('term.size', T.size, 10, 20, .5, 'px'))}</div>`;
    },
    bind: (main, ctx) => bindLookControls(main, ctx.rerender)
  }
);
