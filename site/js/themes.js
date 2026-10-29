'use strict';
/* ================= Theme packs =================
   Animated wallpapers run on a second canvas over the still one. Floating effects, window skins,
   title fonts, pointers and sound kits are all part of CFG.look, so global themes, your own
   themes and exported theme files carry them. */

/* ---------- floating effects that work over any wallpaper, your own pictures and videos too ---------- */
const particleFx = (n, spawn, step) => ({
  init: (w, h) => { const r = rng(n * 7 + 1); return { p: Array.from({ length: n }, () => spawn(w, h, r, true)) }; },
  frame: (g, w, h, t, dt, S) => { const u = U(w, h); for (const q of S.p) if (step(g, q, w, h, t, dt, u)) Object.assign(q, spawn(w, h, Math.random, false)); }
});
const glowDot = (g, x, y, R, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); };
const PARTICLES = {
  none: { name: 'None' },
  petals: { name: 'Cherry petals', ...particleFx(60, (w, h, r, f) => ({ x: r() * w * 1.2 - w * .2, y: f ? r() * h : -20, s: .7 + r() * 1.1, rot: r() * 6, vr: (r() - .5) * 3, ph: r() * 6.28 }), (g, q, w, h, t, dt, u) => {
    q.y += (28 + q.s * 30) * dt * u; q.x += (22 + Math.sin(t * .8 + q.ph) * 34) * dt * u; q.rot += q.vr * dt;
    g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.scale(1, .55 + .45 * Math.sin(t * 3 + q.ph)); g.globalAlpha = .9; g.fillStyle = '#ffb6d6'; g.beginPath(); g.ellipse(0, 0, 6 * q.s * u, 3.6 * q.s * u, 0, 0, 7); g.fill(); g.restore();
    return q.y > h + 20 || q.x > w + 30;
  }) },
  embers: { name: 'Embers', ...particleFx(70, (w, h, r, f) => ({ x: r() * w, y: f ? r() * h : h + 10, s: .6 + r() * 1.6, v: 30 + r() * 60, ph: r() * 6.28 }), (g, q, w, h, t, dt, u) => {
    q.y -= q.v * dt * u; q.x += Math.sin(t * 1.5 + q.ph) * 20 * dt * u; g.globalCompositeOperation = 'lighter';
    glowDot(g, q.x, q.y, 5 * q.s * u, '255,140,50', .5 + .4 * Math.sin(t * 9 + q.ph)); return q.y < -10;
  }) },
  snow: { name: 'Snow', ...particleFx(120, (w, h, r, f) => ({ x: r() * w, y: f ? r() * h : -10, s: .6 + r() * 2, v: 20 + r() * 40, ph: r() * 6.28 }), (g, q, w, h, t, dt, u) => {
    q.y += q.v * dt * u * q.s * .6; q.x += Math.sin(t + q.ph) * 15 * dt * u; g.globalAlpha = .8; g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, q.s * 1.3 * u, 0, 7); g.fill(); return q.y > h + 10;
  }) },
  rain: { name: 'Rain', ...particleFx(140, (w, h, r, f) => ({ x: r() * w * 1.2, y: f ? r() * h : -40, v: 900 + r() * 500, l: 14 + r() * 16 }), (g, q, w, h, t, dt, u) => {
    q.y += q.v * dt * u; q.x -= q.v * .18 * dt * u; g.strokeStyle = 'rgba(180,200,255,.35)'; g.lineWidth = 1.2 * u; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x + q.l * .18 * u, q.y - q.l * u); g.stroke(); return q.y > h;
  }) },
  fireflies: { name: 'Fireflies', ...particleFx(40, (w, h, r) => ({ x: r() * w, y: h * (.35 + r() * .6), ph: r() * 6.28, sp: .3 + r() * .6, a: r() * 6.28 }), (g, q, w, h, t, dt, u) => {
    q.a += (Math.random() - .5) * 2 * dt; q.x += Math.cos(q.a) * 20 * dt * u; q.y += Math.sin(q.a) * 14 * dt * u; g.globalCompositeOperation = 'lighter';
    glowDot(g, q.x, q.y, 9 * u, '215,255,120', Math.max(0, Math.sin(t * q.sp * 3 + q.ph)) * .8); return q.x < -20 || q.x > w + 20 || q.y < h * .2 || q.y > h + 20;
  }) },
  bubbles: { name: 'Bubbles', ...particleFx(45, (w, h, r, f) => ({ x: r() * w, y: f ? r() * h : h + 20, s: 1 + r() * 4, v: 30 + r() * 50, ph: r() * 6.28 }), (g, q, w, h, t, dt, u) => {
    q.y -= q.v * dt * u; q.x += Math.sin(t * 2 + q.ph) * 8 * dt * u; const R = q.s * 2 * u; g.strokeStyle = 'rgba(190,235,255,.45)'; g.lineWidth = 1 * u; g.beginPath(); g.arc(q.x, q.y, R, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(q.x - R * .35, q.y - R * .35, R * .25, 0, 7); g.fill(); return q.y < -20;
  }) },
  bats: { name: 'Bats', ...particleFx(9, (w, h, r, f) => ({ x: f ? r() * w : -40, y: h * (.08 + r() * .45), s: .6 + r() * .9, v: 60 + r() * 90, ph: r() * 6.28, dy: (r() - .5) * 20 }), (g, q, w, h, t, dt, u) => {
    q.x += q.v * dt * u; q.y += (Math.sin(t * 1.7 + q.ph) * 18 + q.dy) * dt * u; const f = Math.sin(t * 14 + q.ph), s = q.s * u;
    g.fillStyle = 'rgba(5,2,8,.88)'; g.save(); g.translate(q.x, q.y); g.beginPath(); g.ellipse(0, 0, 3 * s, 5 * s, 0, 0, 7); g.fill();
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(0, -2 * s); g.quadraticCurveTo(d * 10 * s, -10 * s * f - 4 * s, d * 20 * s, -f * 10 * s); g.quadraticCurveTo(d * 15 * s, -f * 4 * s + 3 * s, d * 12 * s, 2 * s); g.quadraticCurveTo(d * 8 * s, -1 * s, d * 6 * s, 4 * s); g.quadraticCurveTo(d * 3 * s, 1 * s, 0, 3 * s); g.fill(); }
    g.restore(); return q.x > w + 50;
  }) },
  stars: { name: 'Twinkling stars', ...twinkleAnim(1, 160) }
};

/* ---------- window skins, title fonts and themed pointers ---------- */
const SKINS = {
  none: { name: 'Plain' },
  accent: { name: 'Accent glow', tint: 'var(--accent)', hb: 'linear-gradient(90deg,color-mix(in srgb,var(--accent) 30%,transparent),transparent 70%),var(--surface-2)', edge: 'color-mix(in srgb,var(--accent) 50%,transparent)', glow: 'color-mix(in srgb,var(--accent) 26%,transparent)', ts: '0 0 10px color-mix(in srgb,var(--accent) 60%,transparent)' },
  sakura: { name: 'Sakura', tint: '#ff7eb6', hb: 'linear-gradient(90deg,rgba(255,126,182,.28),rgba(130,80,210,.22)),var(--surface-2)', edge: 'rgba(255,150,200,.5)', glow: 'rgba(255,110,180,.3)', ts: '0 0 10px rgba(255,140,200,.65)' },
  webcity: { name: 'Comic hero', tint: '#2b3fb8', hb: 'radial-gradient(rgba(255,255,255,.09) 1px,transparent 1.5px) 0 0/6px 6px,linear-gradient(90deg,rgba(200,24,40,.6),rgba(30,44,150,.6)),var(--surface-2)', edge: 'rgba(226,54,64,.65)', glow: 'rgba(70,90,255,.25)', ts: '2px 2px 0 #000', ls: '.06em' },
  slasher: { name: 'Halloween', tint: '#5a1206', hb: 'linear-gradient(180deg,rgba(70,10,4,.75),rgba(22,4,2,.75)),var(--surface-2)', edge: 'rgba(255,100,20,.4)', glow: 'rgba(255,80,10,.2)', ts: '0 0 8px rgba(255,70,0,.8)', ls: '.04em' },
  carnival: { name: 'Carnival', tint: '#7a1022', hb: 'repeating-linear-gradient(90deg,rgba(170,16,38,.55) 0 18px,rgba(46,34,32,.55) 18px 36px),var(--surface-2)', edge: 'rgba(255,200,120,.45)', glow: 'rgba(232,56,79,.22)', ts: '0 1px 0 #000,0 0 10px rgba(255,200,120,.55)' },
  synthwave: { name: 'Neon', tint: '#5a1aa0', hb: 'linear-gradient(90deg,rgba(255,63,191,.38),rgba(80,40,200,.38),rgba(60,230,255,.32)),var(--surface-2)', edge: 'rgba(90,230,255,.6)', glow: 'rgba(255,63,191,.35)', ts: '0 0 6px #ff3fbf,0 0 14px rgba(255,63,191,.6)', ls: '.08em' },
  abyss: { name: 'Deep sea', tint: '#0b5a7a', hb: 'linear-gradient(180deg,rgba(20,100,130,.5),rgba(4,30,50,.5)),var(--surface-2)', edge: 'rgba(63,208,255,.45)', glow: 'rgba(63,208,255,.25)', ts: '0 0 10px rgba(63,208,255,.65)' }
};
const TITLE_FONTS = {
  '': { name: 'Same as the interface' },
  mplus: { name: 'M PLUS Rounded', stack: '"M PLUS Rounded 1c"', g: 'M+PLUS+Rounded+1c:wght@500;800', w: 800 },
  bangers: { name: 'Bangers (comic)', stack: '"Bangers"', g: 'Bangers', w: 400, size: '16px' },
  creepster: { name: 'Creepster (horror)', stack: '"Creepster"', g: 'Creepster', w: 400, size: '17px' },
  rye: { name: 'Rye (circus)', stack: '"Rye"', g: 'Rye', w: 400 },
  orbitron: { name: 'Orbitron (neon)', stack: '"Orbitron"', g: 'Orbitron:wght@500;800', w: 700 },
  exo: { name: 'Exo 2', stack: '"Exo 2"', g: 'Exo+2:wght@500;800', w: 700 },
  cinzel: { name: 'Cinzel (fantasy)', stack: '"Cinzel"', g: 'Cinzel:wght@500;800', w: 700 }
};
function loadTitleFont(id) {
  const f = TITLE_FONTS[id]; if (!f || !f.g || loadedFonts.has('t:' + id)) return; loadedFonts.add('t:' + id);
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`; document.head.append(l);
}
const accentHex = () => ACCENTS[CFG.accent] ? ACCENTS[CFG.accent][0] : CFG.accent;
function cursorURL(fill) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M3 2l15 9.5-6.5 1.2 3.8 7.3-2.6 1.4-3.8-7.4L4 18z' fill='${fill}' stroke='#0b0b10' stroke-width='1.4' stroke-linejoin='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 2, default`;
}

/* ---------- sound kits: a login jingle and an alert for each theme ---------- */
// each note is [frequency, start, duration, wave, slide-to frequency]
const KIT = {
  chime: { name: 'Chimes', alert: [[1318, 0, .5], [1760, .08, .6]], login: [[784, 0, .5], [988, .15, .5], [1175, .3, .5], [1568, .45, 1]] },
  thwip: { name: 'Web shot', alert: [[2400, 0, .14, 'triangle', 500]], login: [[300, 0, .25, 'triangle', 1800], [523, .25, .3, 'square'], [659, .4, .3, 'square'], [784, .55, .6, 'square']] },
  sting: { name: 'Horror sting', alert: [[110, 0, .9, 'sawtooth'], [117, 0, .9, 'sawtooth']], login: [[55, 0, 1.8, 'sawtooth'], [58, 0, 1.8, 'sawtooth'], [1760, .3, 1.4], [1865, .3, 1.4]] },
  calliope: { name: 'Music box', alert: [[880, 0, .15, 'square'], [831, .1, .25, 'square']], login: [[659, 0, .25, 'square'], [622, .2, .25, 'square'], [659, .4, .25, 'square'], [494, .6, .3, 'square'], [587, .8, .3, 'square'], [523, 1, .3, 'square'], [440, 1.2, .7, 'square']] },
  synth: { name: 'Synth', alert: [[440, 0, .25, 'sawtooth'], [660, .06, .3, 'sawtooth']], login: [[220, 0, .3, 'sawtooth'], [277, .15, .3, 'sawtooth'], [330, .3, .3, 'sawtooth'], [440, .45, .9, 'sawtooth', 445]] },
  bloop: { name: 'Bubbles', alert: [[300, 0, .18, 'sine', 900]], login: [[260, 0, .2, 'sine', 700], [340, .18, .2, 'sine', 900], [420, .36, .4, 'sine', 1200]] }
};
function playNotes(notes) {
  if (!CFG.volume || CFG.sounds === false) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { return; }
  const t = AC.currentTime, base = CFG.volume / 100 * .22;
  for (const [f, st, dur, type = 'sine', f2] of notes) {
    const o = AC.createOscillator(), g = AC.createGain(), v = type === 'sawtooth' || type === 'square' ? base * .45 : base;
    o.type = type; o.frequency.setValueAtTime(f, t + st); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + st + dur);
    g.gain.setValueAtTime(.0001, t + st); g.gain.linearRampToValueAtTime(v, t + st + .01); g.gain.exponentialRampToValueAtTime(.0001, t + st + dur);
    o.connect(g); g.connect(AC.destination); o.start(t + st); o.stop(t + st + dur + .05);
  }
}
playSound = (orig => kind => {
  const kit = KIT[LOOK().sound];
  if (kit && (kind === 'login' || !kind)) return playNotes(kind === 'login' ? kit.login : kit.alert);
  return orig(kind);
})(playSound);

/* ---------- the themes ---------- */
Object.assign(THEMES, {
  sakura: { name: 'Neon Sakura', animated: true, note: 'Anime-style sunset over a neon city, with cherry petals drifting past.', accent: '#ff7eb6', style: 'dark', wall: 'sakura', look: { layout: 'panel', font: 'noto', titleFont: 'mplus', btnStyle: 'circle', radius: 16, skin: 'sakura', cursor: 'accent', sound: 'chime', term: { scheme: 'sakura' } } },
  webcity: { name: 'Web Slinger', animated: true, note: 'A comic-book city at night: a giant web, searchlights and a hero swinging past.', accent: '#e23640', style: 'dark', wall: 'webcity', look: { layout: 'panel', panelFloat: false, font: 'fira', titleFont: 'bangers', btnStyle: 'glyph', radius: 6, skin: 'webcity', cursor: 'accent', sound: 'thwip', term: { scheme: 'web' } } },
  slasher: { name: 'Slasher Night', animated: true, note: 'Halloween in a quiet town. Fog, bats, a flickering streetlight, and someone under it when the lightning flashes.', accent: '#ff7a1a', style: 'dark', wall: 'slasher', look: { layout: 'dock', font: 'noto', titleFont: 'creepster', btnStyle: 'circle', radius: 4, skin: 'slasher', particles: 'bats', cursor: 'accent', sound: 'sting', term: { scheme: 'blood' } } },
  carnival: { name: 'Dark Carnival', animated: true, note: 'An empty fairground after closing. The lights chase, the wheel turns, and something watches from the tent.', accent: '#e8384f', style: 'dark', wall: 'carnival', look: { layout: 'panel', font: 'fira', titleFont: 'rye', btnStyle: 'traffic', radius: 10, skin: 'carnival', cursor: 'accent', sound: 'calliope', term: { scheme: 'carnival' } } },
  synthwave: { name: 'Retrowave', animated: true, note: 'A neon sun over an endless scrolling grid.', accent: '#ff3fbf', style: 'dark', wall: 'synthwave', look: { layout: 'panel', panelPos: 'top', font: 'ubuntu', titleFont: 'orbitron', btnStyle: 'glyph', radius: 4, skin: 'synthwave', cursor: 'accent', sound: 'synth', term: { scheme: 'retro' } } },
  abyss: { name: 'Abyss', animated: true, note: 'Deep water with glowing jellyfish, swaying kelp and rising bubbles.', accent: '#3fd0ff', style: 'dark', wall: 'abyss', look: { layout: 'dock', font: 'noto', titleFont: 'exo', btnStyle: 'circle', radius: 14, skin: 'abyss', cursor: 'accent', sound: 'bloop', term: { scheme: 'abyss' } } }
});
TERM_SCHEMES.push(['sakura', 'Sakura'], ['web', 'Web'], ['blood', 'Blood Moon'], ['carnival', 'Carnival'], ['retro', 'Retrowave'], ['abyss', 'Abyss']);
const myThemes = () => (CFG.myThemes = CFG.myThemes || []);
const themeById = id => THEMES[id] || myThemes().find(t => t.id === id);
applyPreset = function (id, { keepWall = false } = {}) {
  const p = themeById(id); if (!p) return;
  CFG.look = mergeLook(mergeLook(LOOK_DEFAULT, { widgets: (CFG.look && CFG.look.widgets) || LOOK_DEFAULT.widgets }), p.look);
  CFG.accent = p.accent; CFG.style = p.style; if (!keepWall) CFG.wall = p.wall; CFG.theme = id;
  saveCfg(); applyLook(); if (!keepWall) renderWall(true);
};

/* ---------- the wallpaper engine: still canvas, optional picture or video, animated overlay ---------- */
const WFX = { raf: 0, fx: null, media: null, sig: '' };
const wallSig = () => { const L = LOOK(); return [CFG.wall, L.particles, L.wallAnim, L.anim].join('|'); };
const animAllowed = () => { const L = LOOK(); return L.wallAnim !== false && L.anim !== 'off'; };
function drawCover(g, src, W, H) {
  const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height; if (!sw || !sh) return;
  const s = Math.max(W / sw, H / sh); g.drawImage(src, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
}
function mirrorLock() {
  const lb = $('#lockbg'); if (!lb || !lb.isConnected || SYSTEM.state === 'desktop') return;
  const g = lb.getContext('2d');
  if (WFX.media && WFX.media.tagName === 'VIDEO') drawCover(g, WFX.media, lb.width, lb.height); else g.drawImage(wallCanvas, 0, 0, lb.width, lb.height);
  if (WFX.fx) g.drawImage(WFX.fx, 0, 0, lb.width, lb.height);
}
function stopWallAnim() { cancelAnimationFrame(WFX.raf); WFX.raf = 0; }
function startWallAnim() {
  stopWallAnim(); WFX.sig = wallSig();
  const m = WFX.media; if (m && m.tagName === 'VIDEO') { if (animAllowed() && !document.hidden) m.play().catch(() => { }); else m.pause(); }
  const c = WFX.fx; if (!c) return;
  const w = c.width, h = c.height, g = c.getContext('2d'); g.clearRect(0, 0, w, h);
  const wall = !CFG.wall.startsWith('img:') && WALLS[CFG.wall], parts = PARTICLES[LOOK().particles], list = [];
  if (animAllowed()) { if (wall && wall.anim) list.push(wall.anim); if (parts && parts.frame) list.push(parts); }
  const video = m && m.tagName === 'VIDEO' && animAllowed();
  if (!list.length && !video) return;
  const layers = list.map(a => ({ a, S: a.init ? a.init(w, h) : {} }));
  let last = performance.now(), t = 0;
  const tick = now => {
    WFX.raf = requestAnimationFrame(tick);
    const dt = (now - last) / 1000; if (dt < 1 / 31) return; last = now; const d = Math.min(dt, .1); t += d;
    if (layers.length) { g.clearRect(0, 0, w, h); for (const L of layers) { g.save(); try { L.a.frame(g, w, h, t, d, L.S); } catch (e) { console.warn(e); } g.restore(); } }
    mirrorLock();
  };
  WFX.raf = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopWallAnim(); if (WFX.media && WFX.media.pause) WFX.media.pause(); } else startWallAnim(); });
function mediaWall(box, c, id) {
  BLOBS.get(id).then(b => {
    if (!b || !box.isConnected && wallCanvas !== c) return;
    const vid = /^video\//.test(b.type), gif = b.type === 'image/gif';
    if (!vid && !(gif && animAllowed())) return drawImageWall(c, id);
    const url = URL.createObjectURL(b), m = document.createElement(vid ? 'video' : 'img'); m.className = 'wallc wall-media'; box._url = url;
    if (vid) { m.muted = true; m.loop = true; m.playsInline = true; m.setAttribute('muted', ''); m.preload = 'auto'; }
    const paint = () => { drawCover(c.getContext('2d'), m, c.width, c.height); const lb = $('#lockbg'); if (lb && wallCanvas === c) lb.getContext('2d').drawImage(c, 0, 0, lb.width, lb.height); };
    if (vid) m.addEventListener('loadeddata', paint, { once: true }); else m.onload = paint;
    m.src = url; box.insertBefore(m, box.lastChild);
    if (wallCanvas === c) { WFX.media = m; startWallAnim(); }
  });
}
renderWall = function (fade) {
  const s = Math.min(devicePixelRatio || 1, 2, 2560 / innerWidth), W = Math.round(innerWidth * s), H = Math.round(innerHeight * s), fs = Math.min(s, 1.25);
  const box = document.createElement('div'); box.className = 'wallc wall-box';
  const c = document.createElement('canvas'); c.className = 'wallc'; c.width = W; c.height = H;
  const fx = document.createElement('canvas'); fx.className = 'wallc wall-fx'; fx.width = Math.round(innerWidth * fs); fx.height = Math.round(innerHeight * fs);
  box.append(c, fx);
  if (CFG.wall.startsWith('img:')) { WALLS.ink.draw(c.getContext('2d'), W, H); mediaWall(box, c, CFG.wall.slice(4)); }
  else (WALLS[CFG.wall] || WALLS.umbra).draw(c.getContext('2d'), W, H);
  const host = $('#wallhost'), old = host.lastElementChild;
  const drop = o => { if (!o) return; if (o._url) URL.revokeObjectURL(o._url); o.remove(); };
  if (fade && old) { box.style.opacity = 0; host.append(box); requestAnimationFrame(() => requestAnimationFrame(() => { box.style.opacity = 1; })); setTimeout(() => drop(old), 800); }
  else { [...host.children].forEach(drop); host.append(box); }
  wallCanvas = c; WFX.fx = fx; WFX.media = null; startWallAnim();
};

/* ---------- apply skins, fonts and pointers whenever the look changes ---------- */
document.addEventListener('look', () => {
  const L = LOOK(), os = $('#os'), rs = document.documentElement.style, sk = SKINS[L.skin] || SKINS.none;
  [...os.classList].filter(c => c.startsWith('skin-')).forEach(c => os.classList.remove(c));
  os.classList.toggle('skinned', !!sk.hb); if (sk.hb) os.classList.add('skin-' + L.skin);
  rs.setProperty('--skin-hb', sk.hb || 'var(--surface-2)'); rs.setProperty('--skin-edge', sk.edge || 'transparent'); rs.setProperty('--skin-glow', sk.glow || 'transparent');
  rs.setProperty('--skin-tint', sk.tint || 'transparent'); rs.setProperty('--skin-ts', sk.ts || 'none'); rs.setProperty('--title-ls', sk.ls || '0');
  const tf = TITLE_FONTS[L.titleFont] || TITLE_FONTS[''];
  rs.setProperty('--font-title', tf.stack ? `${tf.stack}, var(--font-ui)` : 'var(--font-ui)'); rs.setProperty('--title-w', String(tf.w || 700)); rs.setProperty('--title-size', tf.size || '14px'); loadTitleFont(L.titleFont);
  os.classList.toggle('cur-custom', L.cursor === 'accent'); if (L.cursor === 'accent') rs.setProperty('--cur', cursorURL(accentHex()));
  if (WFX.fx && WFX.sig !== wallSig()) startWallAnim();
});

/* ---------- making your own theme from a picture, GIF or video ---------- */
function loadMediaEl(blob) {
  return new Promise(res => {
    const url = URL.createObjectURL(blob), done = el => res({ el, url });
    if (/^video\//.test(blob.type)) {
      const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true;
      v.onloadeddata = () => { v.onseeked = () => done(v); v.currentTime = Math.min(.5, (v.duration || 1) / 2); }; v.onerror = () => done(null); v.src = url;
    } else { const i = new Image(); i.onload = () => done(i); i.onerror = () => done(null); i.src = url; }
  });
}
// The accent is the strongest vivid color in the picture, brightened enough to read on dark windows.
function pickColors(src) {
  const c = document.createElement('canvas'); c.width = 48; c.height = 30; const g = c.getContext('2d'); drawCover(g, src, 48, 30);
  const d = g.getImageData(0, 0, 48, 30).data, bins = Array.from({ length: 24 }, () => [0, 0, 0, 0]); let lum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), s = mx ? (mx - mn) / mx : 0;
    lum += .2126 * r + .7152 * gg + .0722 * b; if (mx < .22 || s < .2) continue;
    let hue = mx === mn ? 0 : mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; hue = (hue * 60 + 360) % 360;
    const k = Math.floor(hue / 15) % 24, w = s * s * mx * mx * mx; bins[k][0] += r * w; bins[k][1] += gg * w; bins[k][2] += b * w; bins[k][3] += w;
  }
  const best = bins.reduce((a, b) => b[3] > a[3] ? b : a), style = lum / (d.length / 4) > .62 ? 'light' : 'dark';
  if (best[3] < .5) return { accent: '#9aa9c3', style };
  let [r, gg, b] = best.slice(0, 3).map(v => v / best[3]);
  const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  let hue = mx === mn ? 0 : mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; hue = (hue * 60 + 360) % 360;
  const L2 = clamp(l, .55, .68), S2 = Math.max(s, .62), C = (1 - Math.abs(2 * L2 - 1)) * S2, X = C * (1 - Math.abs(hue / 60 % 2 - 1)), m = L2 - C / 2;
  const [a1, a2, a3] = hue < 60 ? [C, X, 0] : hue < 120 ? [X, C, 0] : hue < 180 ? [0, C, X] : hue < 240 ? [0, X, C] : hue < 300 ? [X, 0, C] : [C, 0, X];
  return { accent: '#' + [a1, a2, a3].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join(''), style };
}
function thumbFrom(src) { const c = document.createElement('canvas'); c.width = 280; c.height = 170; drawCover(c.getContext('2d'), src, 280, 170); return c.toDataURL('image/jpeg', .8); }
const blobToDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(b); });
function dataURLToBlob(u) {
  const m = /^data:((?:image|video)\/[\w.+-]+);base64,(.*)$/s.exec(u || ''); if (!m) return null;
  const bin = atob(m[2]), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: m[1] });
}
let DRAFT = null;
function newDraft() {
  const L = LOOK(), media = CFG.wall.startsWith('img:') ? CFG.wall.slice(4) : null, cur = themeById(CFG.theme);
  return { name: '', media, mime: '', wall: media ? 'tidal' : CFG.wall, thumb: media && cur && cur.thumb || '', accent: accentHex(), style: CFG.style, particles: L.particles || 'none', skin: L.skin && L.skin !== 'none' ? L.skin : 'accent', titleFont: L.titleFont || '', scheme: L.term.scheme, sound: L.sound || '', cursor: L.cursor || 'accent' };
}
async function draftFromFile(f) {
  if (f.size > 80e6) return notify('settings', 'That file is too big', 'Pick a picture or video under 80 MB.');
  const id = newBlobId(); if (!await BLOBS.put(id, f)) notify('settings', 'Kept for this session only', 'Your browser blocked storage, so the picture disappears when you reload.');
  const r = await loadMediaEl(f); if (!r.el) { URL.revokeObjectURL(r.url); return notify('settings', 'Couldn\'t open that file', 'Try a JPG, PNG, GIF, WebP, MP4 or WebM file.'); }
  const col = pickColors(r.el);
  Object.assign(DRAFT, { media: id, mime: f.type, thumb: thumbFrom(r.el), accent: col.accent, style: col.style, name: DRAFT.name || f.name.replace(/\.[^.]+$/, '').slice(0, 40) });
  URL.revokeObjectURL(r.url);
}
function draftLook() {
  const look = JSON.parse(JSON.stringify(CFG.look)); delete look.widgets;
  return Object.assign(look, { skin: DRAFT.skin, particles: DRAFT.particles, titleFont: DRAFT.titleFont, sound: DRAFT.sound, cursor: DRAFT.cursor, wallAnim: true, term: { ...look.term, scheme: DRAFT.scheme } });
}
function tryDraft() {
  CFG.look = mergeLook(CFG.look, draftLook()); CFG.accent = DRAFT.accent; CFG.style = DRAFT.style; CFG.wall = DRAFT.media ? 'img:' + DRAFT.media : DRAFT.wall; CFG.theme = 'custom';
  saveCfg(); applyLook(); renderWall(true);
}
function saveDraft() {
  const t = { id: 'my' + Date.now().toString(36), mine: true, name: DRAFT.name.trim() || 'My theme', note: DRAFT.media ? (/^video|gif/.test(DRAFT.mime) ? 'Your own animated background' : 'Your own picture') : 'Made by you', accent: DRAFT.accent, style: DRAFT.style, wall: DRAFT.media ? 'img:' + DRAFT.media : DRAFT.wall, thumb: DRAFT.thumb || wallThumb(DRAFT.wall, 280, 170), animated: !!(/^video|gif/.test(DRAFT.mime) || DRAFT.particles !== 'none' || (!DRAFT.media && WALLS[DRAFT.wall] && WALLS[DRAFT.wall].anim)), look: draftLook() };
  myThemes().push(t); applyPreset(t.id); return t;
}

/* ---------- export and import, with the picture or video inside the file ---------- */
async function exportTheme() {
  const cur = themeById(CFG.theme), j = { nightosTheme: 1, name: cur ? cur.name : 'My NightOS theme', look: CFG.look, accent: CFG.accent, style: CFG.style, wall: CFG.wall.startsWith('img:') ? 'tidal' : CFG.wall };
  if (CFG.wall.startsWith('img:')) { const b = await BLOBS.get(CFG.wall.slice(4)); if (b && b.size < 40e6) j.media = await blobToDataURL(b); }
  return JSON.stringify(j, null, j.media ? 0 : 2);
}
async function importTheme(text) {
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error('That isn\'t a NightOS theme file.'); }
  if (!j || j.nightosTheme !== 1 || !j.look) throw new Error('That isn\'t a NightOS theme file.');
  const { media, ...rest } = j; importLook(JSON.stringify(rest));
  let thumb = wallThumb(CFG.wall, 280, 170), mime = '';
  const b = media && dataURLToBlob(media);
  if (b) { const id = newBlobId(); await BLOBS.put(id, b); CFG.wall = 'img:' + id; mime = b.type; const r = await loadMediaEl(b); if (r.el) thumb = thumbFrom(r.el); URL.revokeObjectURL(r.url); }
  const look = JSON.parse(JSON.stringify(CFG.look)); delete look.widgets;
  const t = { id: 'my' + Date.now().toString(36), mine: true, name: String(j.name || 'Imported theme').slice(0, 40), note: 'Imported', accent: CFG.accent, style: CFG.style, wall: CFG.wall, thumb, animated: /^video|gif/.test(mime) || (look.particles || 'none') !== 'none' || !!(WALLS[CFG.wall] && WALLS[CFG.wall].anim), look };
  myThemes().push(t); CFG.theme = t.id; saveCfg(); renderWall(true); return t;
}

/* ---------- Settings: Global Theme with sections, and Create Theme ---------- */
function bigCard(id, p, on) {
  const accent = ACCENTS[p.accent] ? ACCENTS[p.accent][0] : p.accent, img = p.thumb || wallThumb(p.wall, 280, 170);
  return `<button class="th-card ${on ? 'on' : ''}" data-theme="${esc(id)}"><div class="th-pv" style="background:url(${img}) center/cover">
    <i class="th-win" style="background:${p.style === 'light' ? '#f6f6f8' : '#1f2027'};border-radius:${(p.look.radius || 10) / 2}px"><b style="background:${accent}"></b></i>
    ${p.animated ? '<em class="th-badge">Animated</em>' : ''}${p.mine ? `<span class="th-del" role="button" tabindex="0" data-deltheme="${esc(id)}" aria-label="Delete ${esc(p.name)}">${sym('close')}</span>` : ''}
  </div><span><b>${esc(p.name)}</b><small>${esc(p.note)}</small></span></button>`;
}
const TP = SETTINGS_EXTRA.find(x => x.id === 'theme'), resetBind = TP.bind;
TP.render = () => {
  const ent = Object.entries(THEMES), L = LOOK();
  return `<h4>Animated themes</h4><div class="th-grid">${ent.filter(([, p]) => p.animated).map(([id, p]) => bigCard(id, p, CFG.theme === id)).join('')}</div>
    <h4>Your themes</h4><div class="th-grid">${myThemes().map(t => bigCard(t.id, t, CFG.theme === t.id)).join('')}<button class="th-card th-new" data-newtheme>${sym('plus')}<b>Create a theme</b><small>From your own picture, GIF or video</small></button></div>
    <h4>Classic themes</h4><div class="th-grid">${ent.filter(([, p]) => !p.animated).map(([id, p]) => bigCard(id, p, CFG.theme === id)).join('')}</div>
    <p style="color:var(--fg-dim);margin:0;font-size:13px">A theme sets the wallpaper and its animation, colors, fonts, window style, pointer, terminal colors and sounds together. You can change any part afterwards.${CFG.theme === 'custom' ? ' <b style="color:var(--fg)">You are using a custom look.</b>' : ''}</p>
    <h4>Motion and extras</h4><div class="grp">${ui.row('Animated wallpaper', 'Turn off to save battery. Windows Settings › Animation speed › Off also stops it', ui.sw('wallAnim', L.wallAnim !== false))}${ui.row('Floating effect', 'Drifts over any wallpaper, including your own', ui.sel('particles', L.particles || 'none', Object.entries(PARTICLES).map(([k, p]) => [k, p.name])))}${ui.row('Window style', 'Title bar colors and glow', ui.sel('skin', L.skin || 'none', Object.entries(SKINS).map(([k, s]) => [k, s.name])))}${ui.row('Title font', 'Used for window titles, widgets and the lock screen clock', ui.sel('titleFont', L.titleFont || '', Object.entries(TITLE_FONTS).map(([k, f]) => [k, f.name])))}${ui.row('Themed pointer', 'A pointer in your accent color', ui.sw('cursor', L.cursor === 'accent'))}${ui.row('Theme sounds', 'Login jingle and alert sound', ui.sel('sound', L.sound || '', [['', 'Standard'], ...Object.entries(KIT).map(([k, s]) => [k, s.name])]))}</div>
    <h4>Share your look</h4><div class="grp">${ui.row('Export theme', 'Saves your whole look as a .json file, with your own picture or video inside', '<button class="hbtn" data-exp style="background:var(--press)">Export</button>')}${ui.row('Import theme', 'Paste a theme someone shared, or choose a .json file', '<span style="display:flex;gap:8px"><button class="hbtn" data-imp-paste style="background:var(--press)">Paste</button><button class="hbtn" data-imp-file style="background:var(--press)">Choose File</button></span>')}${ui.row('Reset everything', 'Go back to the Tidal defaults', '<button class="hbtn destr" data-reset>Reset</button>')}</div>`;
};
TP.bind = (main, ctx) => {
  resetBind(main, ctx); bindLookControls(main, ctx.rerender);
  // the themed pointer is a two-way switch over a string setting
  const cs = $('[data-look-sw="cursor"]', main); if (cs) cs.onclick = () => { setLook('cursor', LOOK().cursor === 'accent' ? 'default' : 'accent'); ctx.rerender(); };
  const ws = $('[data-look-sw="wallAnim"]', main); if (ws) ws.onclick = () => { setLook('wallAnim', LOOK().wallAnim === false); ctx.rerender(); };
  $('[data-newtheme]', main).onclick = () => { DRAFT = null; ctx.win.show('maketheme'); };
  main.querySelectorAll('[data-deltheme]').forEach(x => {
    const del = async e => {
      e.stopPropagation(); const t = themeById(x.dataset.deltheme); if (!t) return;
      const r = await winDialog(ctx.win, { title: `Delete “${t.name}”?`, body: 'The theme is removed from Your themes. Your current look stays as it is.', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Delete', cls: 'destr', value: 'ok' }] });
      if (r.btn !== 'ok') return; CFG.myThemes = myThemes().filter(m => m !== t); if (CFG.theme === t.id) CFG.theme = 'custom'; saveCfg(); ctx.rerender();
    };
    x.onclick = del; x.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') del(e); };
  });
  $('[data-exp]', main).onclick = async () => {
    const txt = await exportTheme(), big = txt.length > 2e5; let copied = false;
    if (!big) try { await navigator.clipboard.writeText(txt); copied = true; } catch (e) { }
    if (!window.claude) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'nightos-theme.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
    notify('settings', 'Theme exported', copied ? 'Copied to the clipboard and saved as nightos-theme.json.' : 'Saved as nightos-theme.json.');
  };
  const doImport = async txt => { try { const t = await importTheme(txt); notify('settings', 'Theme imported', `“${t.name}” is in Your themes.`); ctx.rerender(); } catch (e) { notify('settings', 'Couldn\'t import the theme', e.message); } };
  $('[data-imp-paste]', main).onclick = async () => { const r = await winDialog(ctx.win, { title: 'Import Theme', body: 'Paste the theme text here.', entry: '', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Import', cls: 'sug', value: 'ok' }] }); if (r.btn === 'ok' && r.value) doImport(r.value); };
  $('[data-imp-file]', main).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => { if (i.files[0]) doImport(await i.files[0].text()); }; i.click(); };
};
SETTINGS_EXTRA.push({
  id: 'maketheme', label: 'Create Theme', icon: 'plus', group: 'look',
  render: () => {
    const D = DRAFT = DRAFT || newDraft(), opt = (o, v) => Object.entries(o).map(([k, x]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const pv = D.media ? `<div class="tc-pv" data-pv>${/^video\//.test(D.mime) ? '' : `<img alt="" data-blob="${D.media}">`}</div>` : `<div class="tc-pv" style="background:url(${wallThumb(D.wall, 560, 340)}) center/cover"></div>`;
    return `<p style="color:var(--fg-dim);margin:0 0 4px;font-size:13px">Make a theme from any picture, GIF or video on your computer, including fan art you have. It stays in this browser unless you export it. NightOS picks matching colors for you.</p>
    <h4>Background</h4><div class="grp" style="padding:16px;display:flex;flex-direction:column;gap:12px">${pv}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="hbtn sug" data-tc-file>${sym('pic')} Choose Picture, GIF or Video…</button><span style="color:var(--fg-dim)">or</span><select data-tc="wall" aria-label="Built-in wallpaper"><option value="">Use a built-in wallpaper…</option>${Object.entries(WALLS).map(([k, w]) => `<option value="${k}" ${!D.media && D.wall === k ? 'selected' : ''}>${esc(w.name)}${w.anim ? ' (animated)' : ''}</option>`).join('')}</select></div></div>
    <h4>Colors</h4><div class="grp">${ui.row('Accent color', D.media ? 'Picked from your background. Change it if you like' : '', `<span style="display:flex;align-items:center;gap:10px"><input type="color" value="${D.accent}" data-tc="accent" style="width:48px;height:32px;border:0;background:none;padding:0" aria-label="Accent color"><code style="font-family:var(--font-mono)">${esc(D.accent)}</code></span>`)}${ui.row('Style', '', `<div class="seg" style="flex:none">${[['dark', 'Dark'], ['light', 'Light']].map(([v, l]) => `<button type="button" class="${D.style === v ? 'on' : ''}" data-tc-seg="style" data-v="${v}">${l}</button>`).join('')}</div>`)}</div>
    <h4>Style and motion</h4><div class="grp">${ui.row('Floating effect', 'Animates over your background', `<select data-tc="particles" aria-label="Floating effect">${opt(PARTICLES, D.particles)}</select>`)}${ui.row('Window style', '', `<select data-tc="skin" aria-label="Window style">${opt(SKINS, D.skin)}</select>`)}${ui.row('Title font', '', `<select data-tc="titleFont" aria-label="Title font">${opt(TITLE_FONTS, D.titleFont)}</select>`)}${ui.row('Terminal colors', '', `<select data-tc="scheme" aria-label="Terminal colors">${TERM_SCHEMES.map(([k, n]) => `<option value="${k}" ${k === D.scheme ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`)}${ui.row('Sounds', '', `<select data-tc="sound" aria-label="Sounds"><option value="">Standard</option>${opt(KIT, D.sound)}</select>`)}${ui.row('Themed pointer', '', `<button class="sw ${D.cursor === 'accent' ? 'on' : ''}" data-tc-cursor role="switch" aria-checked="${D.cursor === 'accent'}" aria-label="Themed pointer"></button>`)}</div>
    <h4>Save</h4><div class="grp">${ui.row('Name', '', `<input class="entry" data-tc="name" value="${esc(D.name)}" placeholder="My theme" maxlength="40" style="width:220px" aria-label="Theme name">`)}<div class="row" style="justify-content:flex-end;gap:8px"><button class="hbtn" data-tc-try style="background:var(--press)">Try It</button><button class="hbtn sug" data-tc-save>Save Theme</button></div></div>`;
  },
  bind: (main, ctx) => {
    const D = DRAFT, pv = $('[data-pv]', main);
    if (pv && /^video\//.test(D.mime)) BLOBS.get(D.media).then(b => { if (!b) return; const v = document.createElement('video'); v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.src = URL.createObjectURL(b); pv.append(v); });
    $('[data-tc-file]', main).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*,video/*'; i.onchange = async () => { if (i.files[0]) { await draftFromFile(i.files[0]); ctx.rerender(); } }; i.click(); };
    main.querySelectorAll('[data-tc]').forEach(x => {
      const k = x.dataset.tc;
      x.oninput = () => { if (k === 'accent') { D.accent = x.value; x.nextElementSibling.textContent = x.value; } else if (k === 'name') D.name = x.value; };
      x.onchange = () => { if (k === 'wall') { if (!x.value) return; D.wall = x.value; D.media = null; D.mime = ''; D.thumb = ''; } else if (k !== 'name' && k !== 'accent') D[k] = x.value; if (k !== 'name') ctx.rerender(); };
    });
    main.querySelectorAll('[data-tc-seg]').forEach(b => b.onclick = () => { D[b.dataset.tcSeg] = b.dataset.v; ctx.rerender(); });
    $('[data-tc-cursor]', main).onclick = () => { D.cursor = D.cursor === 'accent' ? 'default' : 'accent'; ctx.rerender(); };
    $('[data-tc-try]', main).onclick = () => { tryDraft(); notify('settings', 'Trying your theme', 'Save it to keep it in Your themes.'); };
    $('[data-tc-save]', main).onclick = () => { const t = saveDraft(); DRAFT = null; notify('settings', `Saved “${t.name}”`, 'It\'s in Global Theme › Your themes.'); ctx.win.show('theme'); };
  }
});
