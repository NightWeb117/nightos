'use strict';
/* ================= Night Arcade: three small original games in the theme's colors ================= */
AI.arcade = () => `<svg viewBox="0 0 64 64"><rect x="6" y="16" width="52" height="34" rx="14" fill="#3b2a6b"/><rect x="14" y="30" width="14" height="4" rx="2" fill="#fff"/><rect x="19" y="25" width="4" height="14" rx="2" fill="#fff"/><circle cx="42" cy="28" r="4" fill="#ff7eb6"/><circle cx="49" cy="36" r="4" fill="#5ff0e0"/></svg>`;
APPS.arcade = { name: 'Night Arcade', proc: 'night-arcade', kw: 'games play arcade snake match puzzle fun', single: true, launch: g => ArcadeApp(g), reopen: (w, g) => g && w.play(g) };
APP_CAT.arcade = 'Games'; GRID_APPS.push('arcade');
CMDS.arcade = () => { launch('arcade'); }; DESC.arcade = 'play Night Arcade games';
CFG.arcade = CFG.arcade || {};

const GAMES = {
  catcher: { name: 'Star Catcher', note: 'Swing the spider on its thread to catch falling stars. Dodge the embers.', how: 'Move with the mouse or ← →', make: StarCatcher },
  crawler: { name: 'Glow Crawler', note: 'Eat glowing orbs and grow longer. Don\'t bite your own tail.', how: 'Arrow keys or WASD · swipe on touch screens', make: GlowCrawler },
  lanterns: { name: 'Lantern Link', note: 'Swap lanterns to line up three or more of a color. Score as much as you can in 90 seconds.', how: 'Click two lanterns next to each other', make: LanternLink }
};

function ArcadeApp(start) {
  const win = openWin({ app: 'arcade', w: 760, h: 560, minW: 420, minH: 420, mem: 70 });
  let game = null;
  const backB = hbtn('back', 'All games', () => menu()); win.hl.append(backB);
  win.body.innerHTML = '<div class="arc"></div>';
  const box = $('.arc', win.body);
  function stop() { if (game) { game.stop(); game = null; } }
  function menu() {
    stop(); backB.hidden = true; win.setTitle('Night Arcade');
    box.innerHTML = `<div class="arc-menu"><h2>Night Arcade</h2><div class="arc-list">${Object.entries(GAMES).map(([k, g]) => `<button class="arc-card" data-g="${k}"><canvas width="240" height="130" data-pv="${k}"></canvas><b>${g.name}</b><small>${g.note}</small><span>Best: ${CFG.arcade[k] || 0}</span></button>`).join('')}</div></div>`;
    box.querySelectorAll('[data-pv]').forEach(c => previewArt(c, c.dataset.pv));
    box.onclick = e => { const b = e.target.closest('[data-g]'); if (b) play(b.dataset.g); };
  }
  function play(k) {
    stop(); const G = GAMES[k]; if (!G) return menu(); backB.hidden = false; win.setTitle(G.name, G.how); box.onclick = null;
    box.innerHTML = `<div class="arc-game"><div class="arc-hud"><span data-score>0</span><span data-info></span><span>Best <b data-best>${CFG.arcade[k] || 0}</b></span></div><canvas tabindex="0"></canvas><div class="arc-over" hidden></div></div>`;
    const cv = $('canvas', box), hud = { score: $('[data-score]', box), info: $('[data-info]', box) }, over = $('.arc-over', box);
    const end = score => {
      const best = Math.max(score, CFG.arcade[k] || 0), rec = score > (CFG.arcade[k] || 0) && score > 0; CFG.arcade[k] = best; saveCfg(); $('[data-best]', box).textContent = best;
      over.hidden = false; over.innerHTML = `<b>${rec ? 'New best!' : 'Game over'}</b><span>Score ${score}</span><div><button class="hbtn sug" data-again>Play Again</button><button class="hbtn" data-menu style="background:var(--press)">All Games</button></div>`;
      $('[data-again]', over).onclick = () => play(k); $('[data-menu]', over).onclick = menu; $('[data-again]', over).focus();
    };
    game = G.make(cv, { score: s => { hud.score.textContent = s; }, info: s => { hud.info.textContent = s; }, end, color: accentHex() });
    cv.focus();
  }
  win.play = play;
  win.onClose = stop; win.onFocus = () => { const c = $('canvas[tabindex]', box); if (c) c.focus(); };
  start && GAMES[start] ? play(start) : menu();
  return win;
}
function previewArt(c, k) {
  const g = c.getContext('2d'), acc = accentHex(); g.fillStyle = '#0c0d14'; g.fillRect(0, 0, 240, 130);
  if (k === 'catcher') { g.strokeStyle = '#aab'; g.beginPath(); g.moveTo(120, 0); g.lineTo(120, 70); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.arc(120, 78, 10, 0, 7); g.fill(); g.fillStyle = '#ffe680'; [[60, 40], [180, 30], [90, 100], [200, 90]].forEach(([x, y]) => star(g, x, y, 7)); g.fillStyle = '#ff6a2a'; g.beginPath(); g.arc(40, 80, 5, 0, 7); g.fill(); }
  else if (k === 'crawler') { g.fillStyle = acc; for (let i = 0; i < 9; i++) g.fillRect(40 + i * 14, 70, 12, 12); g.fillStyle = '#ffe680'; g.beginPath(); g.arc(200, 76, 6, 0, 7); g.fill(); }
  else { const cols = ['#ff7eb6', '#5ff0e0', '#ffd35a', '#9a8cff', '#7dff9a']; for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) { g.fillStyle = cols[(x * 3 + y * 2) % 5]; g.beginPath(); g.arc(30 + x * 26, 25 + y * 27, 10, 0, 7); g.fill(); } }
}
function star(g, x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
// Shared canvas plumbing: keeps the canvas sized to its box and runs a frame loop.
function arcLoop(cv, frame) {
  const g = cv.getContext('2d'); let raf = 0, last = performance.now(), dead = false;
  const fit = () => { const r = cv.parentElement.getBoundingClientRect(), s = devicePixelRatio || 1; const w = Math.max(200, r.width), h = Math.max(200, r.height - 34); if (cv.width !== Math.round(w * s)) { cv.width = Math.round(w * s); cv.height = Math.round(h * s); cv.style.width = w + 'px'; cv.style.height = h + 'px'; } return { w, h, s }; };
  const tick = now => { if (dead) return; raf = requestAnimationFrame(tick); const dt = Math.min(.05, (now - last) / 1000); last = now; const d = fit(); g.setTransform(d.s, 0, 0, d.s, 0, 0); frame(g, d.w, d.h, dt); };
  raf = requestAnimationFrame(tick);
  return () => { dead = true; cancelAnimationFrame(raf); };
}

/* ---------- Star Catcher ---------- */
function StarCatcher(cv, ui) {
  let x = .5, score = 0, lives = 3, t = 0, spawn = 0, items = [], over = false, keys = {}, hit = 0;
  const move = e => { const r = cv.getBoundingClientRect(); x = clamp((e.clientX - r.left) / r.width, .05, .95); };
  const kd = e => { keys[e.key] = true; }, ku = e => { keys[e.key] = false; };
  cv.addEventListener('pointermove', move); cv.addEventListener('keydown', kd); cv.addEventListener('keyup', ku);
  ui.info('♥♥♥');
  const stop = arcLoop(cv, (g, w, h, dt) => {
    if (!over) {
      t += dt; spawn -= dt;
      if (keys.ArrowLeft || keys.a) x = Math.max(.05, x - dt * .9); if (keys.ArrowRight || keys.d) x = Math.min(.95, x + dt * .9);
      if (spawn <= 0) { const bad = Math.random() < Math.min(.45, .18 + t / 200); items.push({ x: .05 + Math.random() * .9, y: -.05, v: .18 + Math.random() * .12 + t / 400, bad, r: Math.random() * 6 }); spawn = Math.max(.28, .9 - t / 90); }
    }
    g.fillStyle = '#0a0b14'; g.fillRect(0, 0, w, h);
    const px = x * w, py = h * .78, sw = Math.sin(t * 3) * 6;
    g.strokeStyle = 'rgba(220,225,255,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px - sw * .3, 0); g.lineTo(px, py - 14); g.stroke();
    g.fillStyle = hit > 0 ? '#ff5a5a' : '#20222e'; g.strokeStyle = ui.color; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 14, 0, 7); g.fill(); g.stroke();
    for (const d of [-1, 1]) for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(px + d * 10, py - 4 + k * 4); g.quadraticCurveTo(px + d * 22, py - 14 + k * 6, px + d * 26, py + 2 + k * 6); g.stroke(); }
    hit = Math.max(0, hit - dt);
    for (const it of items) {
      if (!over) it.y += it.v * dt; it.r += dt * 2; const ix = it.x * w, iy = it.y * h;
      if (it.bad) { const gr = g.createRadialGradient(ix, iy, 0, ix, iy, 12); gr.addColorStop(0, '#ffd27a'); gr.addColorStop(.4, '#ff6a2a'); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(ix, iy, 12, 0, 7); g.fill(); }
      else { g.save(); g.translate(ix, iy); g.rotate(it.r); g.fillStyle = '#ffe680'; g.shadowColor = '#ffe680'; g.shadowBlur = 12; star(g, 0, 0, 10); g.restore(); }
      if (!over && Math.hypot(ix - px, iy - py) < 24) { it.done = true; if (it.bad) { lives--; hit = .4; ui.info('♥'.repeat(Math.max(0, lives))); if (lives <= 0) { over = true; ui.end(score); } } else { score += 10; ui.score(score); } }
      if (it.y > 1.08) it.done = true;
    }
    items = items.filter(i => !i.done);
  });
  return { stop: () => { stop(); cv.removeEventListener('pointermove', move); } };
}

/* ---------- Glow Crawler (the classic grow-longer genre) ---------- */
function GlowCrawler(cv, ui) {
  const N = 22; let snake = [{ x: 8, y: 11 }, { x: 7, y: 11 }, { x: 6, y: 11 }], dir = { x: 1, y: 0 }, next = dir, food = null, acc = 0, score = 0, over = false, speed = 7, t = 0, started = false;
  const place = () => { do food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; while (snake.some(s => s.x === food.x && s.y === food.y)); };
  place();
  const turn = (x, y) => { if (!started) { started = true; ui.info('Length ' + snake.length); } if (x !== -dir.x || y !== -dir.y) next = { x, y }; };
  const kd = e => { const k = e.key.toLowerCase(), m = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k]; if (m) { e.preventDefault(); turn(...m); } };
  let ts = null; const tdn = e => { ts = { x: e.clientX, y: e.clientY }; }, tup = e => { if (!ts) return; const dx = e.clientX - ts.x, dy = e.clientY - ts.y; if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy)); ts = null; };
  cv.addEventListener('keydown', kd); cv.addEventListener('pointerdown', tdn); cv.addEventListener('pointerup', tup);
  ui.info('Press an arrow key to start');
  const stop = arcLoop(cv, (g, w, h, dt) => {
    t += dt;
    if (!over && started) { acc += dt; while (acc > 1 / speed) {
      acc -= 1 / speed; dir = next; const hd = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (hd.x < 0 || hd.y < 0 || hd.x >= N || hd.y >= N || snake.some(s => s.x === hd.x && s.y === hd.y)) { over = true; ui.end(score); break; }
      snake.unshift(hd); if (hd.x === food.x && hd.y === food.y) { score += 10; speed = Math.min(16, speed + .35); ui.score(score); ui.info('Length ' + snake.length); place(); } else snake.pop();
    } }
    const S = Math.floor(Math.min(w, h) / N), ox = (w - S * N) / 2, oy = (h - S * N) / 2;
    g.fillStyle = '#0a0b14'; g.fillRect(0, 0, w, h); g.fillStyle = '#11131f'; g.fillRect(ox, oy, S * N, S * N);
    g.fillStyle = 'rgba(255,255,255,.03)'; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) g.fillRect(ox + i * S, oy + j * S, S, S);
    g.shadowColor = '#ffe680'; g.shadowBlur = 16; g.fillStyle = '#ffe680'; g.beginPath(); g.arc(ox + (food.x + .5) * S, oy + (food.y + .5) * S, S * (.3 + .06 * Math.sin(t * 6)), 0, 7); g.fill();
    g.shadowColor = ui.color; g.shadowBlur = 12;
    snake.forEach((s, i) => { g.globalAlpha = 1 - i / (snake.length * 1.6); g.fillStyle = i ? ui.color : '#fff'; const p = i ? 2 : 1; g.beginPath(); g.roundRect(ox + s.x * S + p, oy + s.y * S + p, S - p * 2, S - p * 2, S * .3); g.fill(); });
    g.globalAlpha = 1; g.shadowBlur = 0;
  });
  return { stop: () => { stop(); cv.removeEventListener('keydown', kd); } };
}

/* ---------- Lantern Link (match-three genre) ---------- */
function LanternLink(cv, ui) {
  const N = 8, COLS = ['#ff7eb6', '#5ff0e0', '#ffd35a', '#9a8cff', '#7dff9a', '#ff8a3d'];
  const rnd = () => Math.floor(Math.random() * COLS.length);
  let B = [], sel = null, score = 0, time = 90, over = false, anim = [], combo = 0, busy = 0;
  for (let y = 0; y < N; y++) { B[y] = []; for (let x = 0; x < N; x++) { let c; do c = rnd(); while ((x > 1 && B[y][x - 1] === c && B[y][x - 2] === c) || (y > 1 && B[y - 1][x] === c && B[y - 2][x] === c)); B[y][x] = c; } }
  const fall = {}; // drop animation offsets per cell
  const matches = () => {
    const hit = new Set();
    for (let y = 0; y < N; y++) for (let x = 0; x < N - 2; x++) { const c = B[y][x]; if (c >= 0 && c === B[y][x + 1] && c === B[y][x + 2]) { let k = x; while (k < N && B[y][k] === c) hit.add(y * N + k++); } }
    for (let x = 0; x < N; x++) for (let y = 0; y < N - 2; y++) { const c = B[y][x]; if (c >= 0 && c === B[y + 1][x] && c === B[y + 2][x]) { let k = y; while (k < N && B[k][x] === c) hit.add(k++ * N + x); } }
    return hit;
  };
  const resolve = () => {
    const hit = matches(); if (!hit.size) { combo = 0; return false; }
    combo++; score += hit.size * 10 * combo; ui.score(score);
    for (const i of hit) { const x = i % N, y = Math.floor(i / N); anim.push({ x, y, c: B[y][x], t: 0 }); B[y][x] = -1; }
    for (let x = 0; x < N; x++) { let w2 = N - 1; for (let y = N - 1; y >= 0; y--) if (B[y][x] >= 0) { if (w2 !== y) { B[w2][x] = B[y][x]; fall[w2 * N + x] = (fall[w2 * N + x] || 0) + (w2 - y); } w2--; } for (let y = w2; y >= 0; y--) { B[y][x] = rnd(); fall[y * N + x] = w2 + 1; } }
    return true;
  };
  let geo = { S: 40, ox: 0, oy: 0 };
  const down = e => {
    if (over || busy > 0) return; const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left - geo.ox) / geo.S), y = Math.floor((e.clientY - r.top - geo.oy) / geo.S);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    if (!sel) { sel = { x, y }; return; }
    if (Math.abs(sel.x - x) + Math.abs(sel.y - y) !== 1) { sel = { x, y }; return; }
    const a = sel; sel = null; [B[a.y][a.x], B[y][x]] = [B[y][x], B[a.y][a.x]];
    if (!matches().size) { [B[a.y][a.x], B[y][x]] = [B[y][x], B[a.y][a.x]]; osd('No match'); return; }
    busy = .01;
  };
  cv.addEventListener('pointerdown', down);
  const stop = arcLoop(cv, (g, w, h, dt) => {
    if (!over) { time -= dt; ui.info(`${Math.ceil(Math.max(0, time))} s`); if (time <= 0) { over = true; ui.end(score); } }
    if (busy > 0) { busy -= dt; if (busy <= 0) { if (resolve()) busy = .28; else busy = 0; } }
    for (const k in fall) { fall[k] = Math.max(0, fall[k] - dt * 9); if (!fall[k]) delete fall[k]; }
    const S = Math.floor(Math.min(w, h) / N), ox = (w - S * N) / 2, oy = (h - S * N) / 2; geo = { S, ox, oy };
    g.fillStyle = '#0a0b14'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = B[y][x]; if (c < 0) continue; const cx = ox + (x + .5) * S, cy = oy + (y + .5 - (fall[y * N + x] || 0)) * S, on = sel && sel.x === x && sel.y === y;
      g.shadowColor = COLS[c]; g.shadowBlur = on ? 22 : 10; g.fillStyle = COLS[c];
      g.beginPath(); g.ellipse(cx, cy, S * .32, S * .38, 0, 0, 7); g.fill();
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(cx - S * .1, cy - S * .14, S * .08, S * .12, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(cx - S * .12, cy - S * .44, S * .24, S * .07); g.fillRect(cx - S * .12, cy + S * .37, S * .24, S * .07);
      if (on) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(ox + x * S + 2, oy + y * S + 2, S - 4, S - 4); }
    }
    for (const a of anim) { a.t += dt; const cx = ox + (a.x + .5) * S, cy = oy + (a.y + .5) * S; g.globalAlpha = Math.max(0, 1 - a.t * 3); g.fillStyle = COLS[a.c]; g.beginPath(); g.arc(cx, cy, S * (.35 + a.t * 1.4), 0, 7); g.fill(); g.globalAlpha = 1; }
    anim = anim.filter(a => a.t < .34);
  });
  return { stop: () => { stop(); cv.removeEventListener('pointerdown', down); } };
}
