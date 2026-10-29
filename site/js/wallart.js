'use strict';
/* ================= Animated theme wallpapers =================
   Each wallpaper paints a still scene once (draw) and, if it has `anim`, a light overlay every
   frame (anim.init builds state, anim.frame draws it). All art here is original. */
const U = (w, h) => Math.max(.35, Math.min(w, h) / 1080);
function cityLayout(seed, w, h, base, minH, maxH, density = .3) {
  const r = rng(seed), u = U(w, h), b = [], wins = [];
  for (let x = -10; x < w + 10;) { const bw = (26 + r() * 70) * u, bh = h * (minH + r() * (maxH - minH)); b.push({ x, w: bw, h: bh, y: base - bh, spire: r() < .15 }); x += bw + r() * 5 * u; }
  for (const d of b) {
    const cw = 9 * u, ch = 13 * u, cols = Math.max(1, Math.floor((d.w - 6 * u) / cw)), rows = Math.max(0, Math.floor((d.h - 12 * u) / ch));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() < density) wins.push({ x: d.x + 4 * u + i * cw, y: d.y + 8 * u + j * ch, w: cw * .55, h: ch * .45, c: r(), ph: r() * 6.28 });
  }
  return { b, wins };
}
function drawCity(ctx, L, color) { ctx.fillStyle = color; for (const d of L.b) { ctx.fillRect(d.x, d.y, d.w, d.h + 2000); if (d.spire) { ctx.fillRect(d.x + d.w * .45, d.y - d.h * .18, d.w * .1, d.h * .18); } } }
function sunBands(ctx, sky, cx, cy, R, n, from) { ctx.fillStyle = sky; for (let i = 0; i < n; i++) { const y = cy + R * (from + i * (1 - from) / n), bh = R * (.02 + i * .022); ctx.fillRect(cx - R - 2, y, R * 2 + 4, bh); } }
// shared star twinkle + shooting stars, used by the night-sky wallpapers
const twinkleAnim = (maxY = .6, count = 110) => ({
  init: (w, h) => { const r = rng(9); return { s: Array.from({ length: count }, () => ({ x: r() * w, y: Math.pow(r(), 1.3) * h * maxY, z: .5 + r() * 1.6, ph: r() * 6.28, sp: .6 + r() * 2 })), shoot: null, next: 3 }; },
  frame: (g, w, h, t, dt, S) => {
    const u = U(w, h);
    for (const s of S.s) { const a = Math.max(0, Math.sin(t * s.sp + s.ph)); if (a < .15) continue; g.globalAlpha = a * .9; g.fillStyle = '#eef3ff'; g.beginPath(); g.arc(s.x, s.y, s.z * u, 0, 7); g.fill(); }
    g.globalAlpha = 1; S.next -= dt;
    if (!S.shoot && S.next <= 0) { const r = Math.random; S.shoot = { x: w * (.1 + r() * .7), y: h * r() * maxY * .6, vx: (600 + r() * 500) * u, vy: (180 + r() * 160) * u, life: 0 }; S.next = 5 + Math.random() * 7; }
    if (S.shoot) { const s = S.shoot; s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; const gr = g.createLinearGradient(s.x, s.y, s.x - s.vx * .12, s.y - s.vy * .12); gr.addColorStop(0, `rgba(255,255,255,${Math.max(0, .9 - s.life)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = gr; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * .12, s.y - s.vy * .12); g.stroke(); if (s.life > 1) S.shoot = null; }
  }
});
['umbra', 'aurora', 'nebula', 'dusk'].forEach(k => { if (WALLS[k]) WALLS[k].anim = twinkleAnim(k === 'dusk' ? .3 : .6, k === 'nebula' ? 160 : 110); });
if (WALLS.tidal) WALLS.tidal.anim = {
  init: (w, h) => { const r = rng(17); return { p: Array.from({ length: 70 }, () => ({ x: r() * w, y: h * (.4 + r() * .6), s: .6 + r() * 1.8, v: 8 + r() * 22, ph: r() * 6.28 })) }; },
  frame: (g, w, h, t, dt, S) => { const u = U(w, h); g.globalCompositeOperation = 'lighter'; for (const p of S.p) { p.y -= p.v * dt * u; p.x += Math.sin(t * .6 + p.ph) * 12 * dt * u; if (p.y < h * .35) { p.y = h; p.x = Math.random() * w; } const a = .25 + .25 * Math.sin(t * 2 + p.ph); g.fillStyle = `rgba(140,255,225,${a})`; g.beginPath(); g.arc(p.x, p.y, p.s * u * 1.4, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over'; }
};

/* ---------- Neon Sakura: an anime-style sunset with falling cherry blossoms ---------- */
WALLS.sakura = {
  name: 'Neon Sakura', draw(ctx, w, h) {
    const r = rng(41), u = U(w, h);
    const sky = vgrad(ctx, h, [[0, '#140a2c'], [.42, '#4a1d62'], [.66, '#c2559a'], [.8, '#f6a0c4'], [.92, '#ffd9e8']]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    stars(ctx, r, w, h, Math.round(w * h / 9000), h * .35, u * .8);
    const cx = w * .63, cy = h * .58, R = h * .2;
    const gl = ctx.createRadialGradient(cx, cy, R * .6, cx, cy, R * 3); gl.addColorStop(0, 'rgba(255,200,225,.5)'); gl.addColorStop(1, 'rgba(255,200,225,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    const sg = ctx.createLinearGradient(0, cy - R, 0, cy + R); sg.addColorStop(0, '#fff3f8'); sg.addColorStop(1, '#ff8dbd'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    sunBands(ctx, sky, cx, cy, R, 7, .15);
    fillRidge(ctx, ridge(r, w, h * .76, h * .07, .6), w, h, '#7d3a80');
    fillRidge(ctx, ridge(r, w, h * .82, h * .05, .8), w, h, '#552560');
    const L = cityLayout(7, w, h, h * .93, .06, .2, .32); drawCity(ctx, L, '#1d0f2c');
    for (const wn of L.wins) { ctx.fillStyle = wn.c < .5 ? 'rgba(255,170,215,.65)' : 'rgba(120,230,255,.6)'; ctx.fillRect(wn.x, wn.y, wn.w, wn.h); }
    ctx.fillStyle = '#120a1e'; ctx.fillRect(0, h * .93, w, h * .07);
    // cherry branch reaching in from the top left
    ctx.strokeStyle = '#26121f'; ctx.lineCap = 'round';
    const branch = (x, y, a, len, wid, d) => { if (d > 6 || len < 8 * u) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; ctx.lineWidth = wid; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + x2) / 2 + (r() - .5) * len * .3, (y + y2) / 2 + (r() - .5) * len * .3, x2, y2); ctx.stroke();
      if (d > 2) for (let k = 0; k < 5; k++) { const bx = x2 + (r() - .5) * 26 * u, by = y2 + (r() - .5) * 20 * u, s = (5 + r() * 7) * u; ctx.fillStyle = r() < .5 ? '#ff9cc8' : '#ffc4dd'; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(bx, by, s, 0, 7); ctx.fill(); ctx.fillStyle = '#fff0f6'; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(bx, by, s * .35, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      branch(x2, y2, a + (r() - .3) * .7, len * .72, wid * .68, d + 1); if (r() < .7) branch(x2, y2, a - .5 - r() * .5, len * .6, wid * .6, d + 1); };
    branch(-20 * u, h * .05, .25, w * .16, 16 * u, 0);
    branch(w + 20 * u, h * .02, Math.PI - .3, w * .12, 12 * u, 1);
  },
  anim: {
    tap: (S, x, y) => { for (const p of S.p.slice(0, 14)) { const a = Math.random() * 6.28, d = Math.random() * 40; p.x = x + Math.cos(a) * d; p.y = y + Math.sin(a) * d; } },
    init: (w, h) => { const r = rng(5), L = cityLayout(7, w, h, h * .93, .06, .2, .32); return { p: Array.from({ length: 70 }, () => ({ x: r() * w, y: r() * h, s: .7 + r() * 1.1, rot: r() * 6, vr: (r() - .5) * 3, ph: r() * 6.28 })), m: Array.from({ length: 30 }, () => ({ x: r() * w, y: h * (.5 + r() * .5), ph: r() * 6.28 })), wins: L.wins.filter(() => r() < .12) }; },
    frame: (g, w, h, t, dt, S) => {
      const u = U(w, h);
      for (const wn of S.wins) { const a = Math.sin(t * 1.5 + wn.ph); if (a > .6) { g.fillStyle = wn.c < .5 ? `rgba(255,210,235,${a})` : `rgba(170,245,255,${a})`; g.fillRect(wn.x, wn.y, wn.w, wn.h); } }
      g.globalCompositeOperation = 'lighter';
      for (const m of S.m) { m.y -= 10 * dt * u; if (m.y < h * .3) m.y = h; const a = .15 + .15 * Math.sin(t * 2 + m.ph); const gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, 8 * u); gr.addColorStop(0, `rgba(255,190,230,${a})`); gr.addColorStop(1, 'rgba(255,190,230,0)'); g.fillStyle = gr; g.fillRect(m.x - 8 * u, m.y - 8 * u, 16 * u, 16 * u); }
      g.globalCompositeOperation = 'source-over';
      for (const p of S.p) {
        p.y += (28 + p.s * 30) * dt * u; p.x += (22 + Math.sin(t * .8 + p.ph) * 34) * dt * u; p.rot += p.vr * dt;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w * 1.2 - w * .2; } if (p.x > w + 20) p.x = -20;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, .55 + .45 * Math.sin(t * 3 + p.ph));
        g.fillStyle = '#ffb6d6'; g.globalAlpha = .9; g.beginPath(); g.ellipse(0, 0, 6 * p.s * u, 3.6 * p.s * u, 0, 0, 7); g.fill();
        g.fillStyle = '#ffe3ef'; g.globalAlpha = .6; g.beginPath(); g.ellipse(-1.5 * u, 0, 2.6 * p.s * u, 1.4 * p.s * u, 0, 0, 7); g.fill(); g.restore();
      }
      g.globalAlpha = 1;
    }
  }
};

/* ---------- Web Slinger: a comic-book city at night, a giant web, searchlights ---------- */
function webGeom(w, h) {
  const r = rng(77), cx = w * .84, cy = h * .16, R = Math.max(w, h) * .42, N = 14, spokes = [];
  for (let i = 0; i < N; i++) { const a = Math.PI * .45 + i / (N - 1) * Math.PI * 1.25 + (r() - .5) * .08; spokes.push({ a, len: R * (.75 + r() * .35) }); }
  return { cx, cy, R, spokes, rings: 12 };
}
WALLS.webcity = {
  name: 'Web Slinger', draw(ctx, w, h) {
    const r = rng(12), u = U(w, h);
    ctx.fillStyle = vgrad(ctx, h, [[0, '#04071a'], [.55, '#111947'], [.85, '#3b0d24'], [1, '#5a0f1c']]); ctx.fillRect(0, 0, w, h);
    stars(ctx, r, w, h, Math.round(w * h / 7000), h * .5, u * .8);
    const step = 9 * u; for (let y = h * .35; y < h; y += step) for (let x = (y / step % 2) * step / 2; x < w; x += step) { const s = (y - h * .35) / (h * .65); ctx.fillStyle = `rgba(255,60,90,${.03 + s * .06})`; ctx.beginPath(); ctx.arc(x, y, step * .32 * s, 0, 7); ctx.fill(); }
    const mx = w * .2, my = h * .2, mr = h * .07; const gl = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 5); gl.addColorStop(0, 'rgba(210,220,255,.3)'); gl.addColorStop(1, 'rgba(210,220,255,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#eef1ff'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    const far = cityLayout(21, w, h, h, .25, .5, .18); drawCity(ctx, far, '#151b44'); for (const wn of far.wins) { ctx.fillStyle = 'rgba(255,214,120,.35)'; ctx.fillRect(wn.x, wn.y, wn.w, wn.h); }
    const near = cityLayout(33, w, h, h, .12, .34, .26); drawCity(ctx, near, '#070a1d'); for (const wn of near.wins) { ctx.fillStyle = wn.c < .7 ? 'rgba(255,214,110,.65)' : 'rgba(255,255,255,.55)'; ctx.fillRect(wn.x, wn.y, wn.w, wn.h); }
    const W = webGeom(w, h); ctx.strokeStyle = 'rgba(225,232,255,.42)'; ctx.lineWidth = 1.3 * u;
    for (const s of W.spokes) { ctx.beginPath(); ctx.moveTo(W.cx, W.cy); ctx.lineTo(W.cx + Math.cos(s.a) * s.len, W.cy + Math.sin(s.a) * s.len); ctx.stroke(); }
    ctx.lineWidth = 1 * u;
    for (let k = 1; k <= W.rings; k++) { ctx.beginPath(); W.spokes.forEach((s, i) => { const d = s.len * k / (W.rings + 1), x = W.cx + Math.cos(s.a) * d, y = W.cy + Math.sin(s.a) * d; if (!i) ctx.moveTo(x, y); else { const p = W.spokes[i - 1], pd = p.len * k / (W.rings + 1), px = W.cx + Math.cos(p.a) * pd, py = W.cy + Math.sin(p.a) * pd, mx2 = (px + x) / 2, my2 = (py + y) / 2; ctx.quadraticCurveTo(mx2 + (W.cx - mx2) * .06, my2 + (W.cy - my2) * .06, x, y); } }); ctx.stroke(); }
  },
  anim: {
    tap: S => { S.streak = null; S.next = 0; },
    init: (w, h) => { const r = rng(3), near = cityLayout(33, w, h, h, .12, .34, .26); return { W: webGeom(w, h), beams: [{ x: w * .32, ph: 0 }, { x: w * .66, ph: 2.2 }], wins: near.wins.filter(() => r() < .08), streak: null, next: 2 }; },
    frame: (g, w, h, t, dt, S) => {
      const u = U(w, h);
      g.globalCompositeOperation = 'lighter';
      for (const b of S.beams) { const a = -Math.PI / 2 + Math.sin(t * .35 + b.ph) * .55, L = h * 1.1, sp = .07; g.beginPath(); g.moveTo(b.x, h); g.lineTo(b.x + Math.cos(a - sp) * L, h + Math.sin(a - sp) * L); g.lineTo(b.x + Math.cos(a + sp) * L, h + Math.sin(a + sp) * L); g.closePath(); const gr = g.createLinearGradient(b.x, h, b.x + Math.cos(a) * L, h + Math.sin(a) * L); gr.addColorStop(0, 'rgba(190,210,255,.16)'); gr.addColorStop(1, 'rgba(190,210,255,0)'); g.fillStyle = gr; g.fill(); }
      const W = S.W;
      W.spokes.forEach((s, i) => { const p = ((t * .12 + i * .37) % 1), d = s.len * p, x = W.cx + Math.cos(s.a) * d, y = W.cy + Math.sin(s.a) * d, R = 9 * u; const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); });
      g.globalCompositeOperation = 'source-over';
      for (const wn of S.wins) { if (Math.sin(t * .9 + wn.ph * 3) > .7) { g.fillStyle = 'rgba(255,235,170,.9)'; g.fillRect(wn.x, wn.y, wn.w, wn.h); } }
      S.next -= dt;
      if (!S.streak && S.next <= 0) { S.streak = { y0: h * (.15 + Math.random() * .3), y1: h * (.45 + Math.random() * .2), t: 0 }; S.next = 4 + Math.random() * 5; }
      if (S.streak) { const s = S.streak; s.t += dt * 1.6; const p = Math.min(1, s.t), x = -50 + (w + 100) * p, y = s.y0 + (s.y1 - s.y0) * Math.sin(p * Math.PI) * .6; g.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - s.t * .7)})`; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 140 * u, y - 30 * u); g.stroke(); if (s.t > 1.5) S.streak = null; }
    }
  }
};

/* ---------- Slasher Night: a quiet suburb on Halloween, fog, lightning ---------- */
function suburb(w, h) {
  const r = rng(66), u = U(w, h), base = h * .86, houses = [], lanterns = [];
  for (let x = -30 * u; x < w;) { const hw = w * (.1 + r() * .08), hh = h * (.1 + r() * .06), roof = hh * (.5 + r() * .3); houses.push({ x, w: hw, h: hh, roof, lit: r() }); if (r() < .7) lanterns.push({ x: x + hw * (.2 + r() * .6), y: base - 6 * u, s: (9 + r() * 5) * u, ph: r() * 6.28 }); x += hw + w * (.02 + r() * .05); }
  return { base, houses, lanterns, lamp: { x: w * .44, top: base - h * .26 } };
}
WALLS.slasher = {
  name: 'Slasher Night', draw(ctx, w, h) {
    const r = rng(13), u = U(w, h), S = suburb(w, h);
    ctx.fillStyle = vgrad(ctx, h, [[0, '#050101'], [.55, '#1c0505'], [.82, '#3a0b07'], [1, '#120303']]); ctx.fillRect(0, 0, w, h);
    stars(ctx, r, w, h, Math.round(w * h / 16000), h * .4, u * .7);
    const mx = w * .7, my = h * .3, R = h * .17;
    const gl = ctx.createRadialGradient(mx, my, R * .8, mx, my, R * 4); gl.addColorStop(0, 'rgba(255,110,40,.35)'); gl.addColorStop(1, 'rgba(255,110,40,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    const mg = ctx.createRadialGradient(mx - R * .3, my - R * .3, R * .1, mx, my, R); mg.addColorStop(0, '#ffd59a'); mg.addColorStop(.6, '#ff8a2a'); mg.addColorStop(1, '#b8400c'); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, R, 0, 7); ctx.fill();
    for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(120,40,10,.25)'; ctx.beginPath(); ctx.arc(mx + (r() - .5) * R * 1.3, my + (r() - .5) * R * 1.3, R * (.05 + r() * .12), 0, 7); ctx.fill(); }
    for (let i = 0; i < 14; i++) { const cx = mx + (r() - .5) * R * 3, cy = my + (r() - .2) * R * 1.1, cr = R * (.35 + r() * .5), cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr); cg.addColorStop(0, 'rgba(18,4,3,.55)'); cg.addColorStop(1, 'rgba(18,4,3,0)'); ctx.fillStyle = cg; ctx.save(); ctx.translate(cx, cy); ctx.scale(2.6, .45); ctx.translate(-cx, -cy); ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2); ctx.restore(); }
    const tree = (x, y, a, len, wid, d) => { if (d > 7) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; ctx.strokeStyle = '#030000'; ctx.lineWidth = wid; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); const n = d < 2 ? 3 : 2; for (let k = 0; k < n; k++) tree(x2, y2, a + (r() - .5) * 1.3, len * (.62 + r() * .15), wid * .62, d + 1); };
    tree(w * .08, S.base, -Math.PI / 2 - .1, h * .18, 18 * u, 0); tree(w * .95, S.base, -Math.PI / 2 + .15, h * .16, 15 * u, 0);
    ctx.fillStyle = '#050101';
    for (const hs of S.houses) { const top = S.base - hs.h; ctx.fillRect(hs.x, top, hs.w, hs.h); ctx.beginPath(); ctx.moveTo(hs.x - 8 * u, top); ctx.lineTo(hs.x + hs.w / 2, top - hs.roof); ctx.lineTo(hs.x + hs.w + 8 * u, top); ctx.fill(); }
    for (const hs of S.houses) if (hs.lit > .45) { ctx.fillStyle = 'rgba(255,170,70,.75)'; const ww = hs.w * .16; ctx.fillRect(hs.x + hs.w * .2, S.base - hs.h * .7, ww, hs.h * .22); if (hs.lit > .75) ctx.fillRect(hs.x + hs.w * .62, S.base - hs.h * .7, ww, hs.h * .22); ctx.fillStyle = '#050101'; }
    ctx.fillStyle = '#020000'; ctx.fillRect(0, S.base, w, h - S.base);
    ctx.fillStyle = '#060101'; for (let x = 0; x < w; x += 14 * u) { ctx.fillRect(x, S.base - 20 * u, 5 * u, 22 * u); } ctx.fillRect(0, S.base - 14 * u, w, 3 * u);
    ctx.fillStyle = '#080202'; ctx.fillRect(S.lamp.x - 3 * u, S.lamp.top, 6 * u, S.base - S.lamp.top); ctx.fillRect(S.lamp.x - 3 * u, S.lamp.top, 26 * u, 4 * u);
    for (const L of S.lanterns) { ctx.fillStyle = '#e8650f'; ctx.beginPath(); ctx.ellipse(L.x, L.y - L.s * .7, L.s, L.s * .75, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd35a'; const s = L.s; ctx.beginPath(); ctx.moveTo(L.x - s * .55, L.y - s * .95); ctx.lineTo(L.x - s * .2, L.y - s * .95); ctx.lineTo(L.x - s * .38, L.y - s * .65); ctx.fill(); ctx.beginPath(); ctx.moveTo(L.x + s * .55, L.y - s * .95); ctx.lineTo(L.x + s * .2, L.y - s * .95); ctx.lineTo(L.x + s * .38, L.y - s * .65); ctx.fill(); ctx.fillRect(L.x - s * .5, L.y - s * .45, s, s * .14); }
  },
  anim: {
    tap: st => { st.next = 0; },
    init: (w, h) => { const r = rng(8); return { S: suburb(w, h), fog: Array.from({ length: 22 }, () => ({ x: r() * w, y: h * (.72 + r() * .26), s: .6 + r() * 1.2, v: 6 + r() * 18 })), leaves: Array.from({ length: 22 }, () => ({ x: r() * w, y: r() * h, ph: r() * 6.28, s: .6 + r() })), flash: 0, next: 6, lampOff: 0 }; },
    frame: (g, w, h, t, dt, st) => {
      const u = U(w, h), S = st.S;
      st.lampOff = Math.random() < .01 ? .4 : Math.max(0, st.lampOff - dt);
      const la = st.lampOff > 0 ? .25 : 1, lx = S.lamp.x + 20 * u, ly = S.lamp.top + 4 * u;
      g.globalCompositeOperation = 'lighter';
      const cone = g.createLinearGradient(0, ly, 0, S.base); cone.addColorStop(0, `rgba(255,214,150,${.22 * la})`); cone.addColorStop(1, `rgba(255,214,150,${.05 * la})`); g.fillStyle = cone; g.beginPath(); g.moveTo(lx - 6 * u, ly); g.lineTo(lx + 6 * u, ly); g.lineTo(lx + 90 * u, S.base); g.lineTo(lx - 90 * u, S.base); g.fill();
      const bulb = g.createRadialGradient(lx, ly, 0, lx, ly, 26 * u); bulb.addColorStop(0, `rgba(255,230,170,${.9 * la})`); bulb.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = bulb; g.fillRect(lx - 26 * u, ly - 26 * u, 52 * u, 52 * u);
      for (const L of S.lanterns) { const f = .55 + .45 * Math.abs(Math.sin(t * 7 + L.ph) * Math.sin(t * 3.1 + L.ph)); const gr = g.createRadialGradient(L.x, L.y - L.s * .7, 0, L.x, L.y - L.s * .7, L.s * 4); gr.addColorStop(0, `rgba(255,140,40,${.45 * f})`); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(L.x - L.s * 4, L.y - L.s * 4.7, L.s * 8, L.s * 8); }
      g.globalCompositeOperation = 'source-over';
      for (const f of st.fog) { f.x += f.v * dt * u; if (f.x > w + 300 * u) f.x = -300 * u; const R = 220 * u * f.s, gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, R); gr.addColorStop(0, 'rgba(70,45,45,.16)'); gr.addColorStop(1, 'rgba(70,45,45,0)'); g.fillStyle = gr; g.fillRect(f.x - R, f.y - R * .4, R * 2, R * .8); }
      g.fillStyle = '#2a0a04';
      for (const l of st.leaves) { l.y += 30 * dt * u * l.s; l.x += Math.sin(t * 1.3 + l.ph) * 40 * dt * u; if (l.y > h) { l.y = -10; l.x = Math.random() * w; } g.save(); g.translate(l.x, l.y); g.rotate(t * 2 + l.ph); g.beginPath(); g.ellipse(0, 0, 5 * u * l.s, 2.5 * u * l.s, 0, 0, 7); g.fill(); g.restore(); }
      st.next -= dt; if (st.next <= 0) { st.flash = 1; st.next = 7 + Math.random() * 9; }
      if (st.flash > 0) {
        g.fillStyle = `rgba(230,225,255,${st.flash * .55})`; g.fillRect(0, 0, w, h);
        if (st.flash > .25) { const fx = lx - 4 * u, fy = S.base; g.fillStyle = '#000'; g.beginPath(); g.ellipse(fx, fy - 74 * u, 7 * u, 8.5 * u, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(fx - 9 * u, fy - 64 * u); g.lineTo(fx + 9 * u, fy - 64 * u); g.lineTo(fx + 12 * u, fy - 22 * u); g.lineTo(fx + 7 * u, fy); g.lineTo(fx - 7 * u, fy); g.lineTo(fx - 12 * u, fy - 22 * u); g.fill(); }
        st.flash -= dt * (st.flash > .6 ? 3 : 1.4);
      }
    }
  }
};

/* ---------- Dark Carnival: an empty fairground after closing ---------- */
function carnival(w, h) {
  const u = U(w, h), base = h * .86, tent = { x: w * .56, w: w * .34, h: h * .4 }, wheel = { x: w * .2, y: h * .48, R: h * .24 }, bulbs = [];
  const wire = (x1, y1, x2, y2, sag, n) => { for (let i = 0; i <= n; i++) { const t = i / n; bulbs.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * sag, i: bulbs.length }); } };
  const top = base - tent.h;
  wire(tent.x, top - 10 * u, w + 20, h * .34, h * .08, 18); wire(tent.x, top - 10 * u, wheel.x + wheel.R * .25, h * .3, h * .07, 14);
  wire(0, h * .62, w, h * .6, h * .05, 34);
  return { u, base, tent, wheel, bulbs, top };
}
WALLS.carnival = {
  name: 'Dark Carnival', draw(ctx, w, h) {
    const r = rng(99), C = carnival(w, h), u = C.u, T = C.tent;
    ctx.fillStyle = vgrad(ctx, h, [[0, '#06020b'], [.55, '#1a0923'], [.85, '#2c0b1a'], [1, '#0d0308']]); ctx.fillRect(0, 0, w, h);
    stars(ctx, r, w, h, Math.round(w * h / 9000), h * .5, u * .7);
    const mx = w * .86, my = h * .14, mr = h * .06; ctx.fillStyle = '#f3e9d6'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill(); ctx.fillStyle = '#06020b'; ctx.beginPath(); ctx.arc(mx + mr * .4, my - mr * .15, mr * .92, 0, 7); ctx.fill();
    const x0 = T.x - T.w / 2, stripes = 10;
    for (let i = 0; i < stripes; i++) {
      const a = x0 + i * T.w / stripes, b = a + T.w / stripes;
      ctx.fillStyle = i % 2 ? '#5c0d1a' : '#3a2f2c';
      ctx.beginPath(); ctx.moveTo(T.x, C.top); ctx.lineTo(a, C.base - T.h * .55); ctx.lineTo(a, C.base); ctx.lineTo(b, C.base); ctx.lineTo(b, C.base - T.h * .55); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#120509'; for (let i = 0; i < stripes; i++) { const a = x0 + i * T.w / stripes, b = a + T.w / stripes; ctx.beginPath(); ctx.moveTo(a, C.base - T.h * .55); ctx.quadraticCurveTo((a + b) / 2, C.base - T.h * .45, b, C.base - T.h * .55); ctx.lineTo(b, C.base - T.h * .53); ctx.quadraticCurveTo((a + b) / 2, C.base - T.h * .42, a, C.base - T.h * .53); ctx.fill(); }
    ctx.fillStyle = '#020001'; ctx.beginPath(); ctx.moveTo(T.x - T.w * .09, C.base); ctx.quadraticCurveTo(T.x, C.base - T.h * .5, T.x + T.w * .09, C.base); ctx.fill();
    ctx.strokeStyle = '#120509'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(T.x, C.top); ctx.lineTo(T.x, C.top - 30 * u); ctx.stroke(); ctx.fillStyle = '#7a1022'; ctx.beginPath(); ctx.moveTo(T.x, C.top - 30 * u); ctx.lineTo(T.x + 22 * u, C.top - 24 * u); ctx.lineTo(T.x, C.top - 18 * u); ctx.fill();
    const W = C.wheel; ctx.strokeStyle = '#140711'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(W.x - W.R * .5, C.base); ctx.lineTo(W.x, W.y); ctx.lineTo(W.x + W.R * .5, C.base); ctx.stroke();
    ctx.fillStyle = '#050206'; ctx.fillRect(0, C.base, w, h - C.base);
    for (let i = 0; i < 5; i++) { const bx = w * (.36 + i * .12), bh = h * (.05 + r() * .04); ctx.fillStyle = '#0d0409'; ctx.fillRect(bx, C.base - bh, w * .05, bh); ctx.beginPath(); ctx.moveTo(bx - 4 * u, C.base - bh); ctx.lineTo(bx + w * .025, C.base - bh - 16 * u); ctx.lineTo(bx + w * .05 + 4 * u, C.base - bh); ctx.fill(); }
    ctx.strokeStyle = 'rgba(30,12,20,.9)'; ctx.lineWidth = 1.5 * u; let prev = null; for (const b of C.bulbs) { if (prev && Math.hypot(b.x - prev.x, b.y - prev.y) < w * .2) { ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } prev = b; }
  },
  anim: {
    tap: S => { S.allOn = .9; S.nextEyes = Math.min(S.nextEyes, .3); },
    init: (w, h) => { const r = rng(4); return { C: carnival(w, h), balloons: Array.from({ length: 11 }, () => ({ x: r() * w, y: h * (.4 + r() * .8), s: .8 + r() * .5, ph: r() * 6.28, v: 14 + r() * 16 })), eyes: 0, nextEyes: 5 }; },
    frame: (g, w, h, t, dt, S) => {
      const C = S.C, u = C.u, W = C.wheel, rot = t * .12, cars = 10;
      g.strokeStyle = '#4a2236'; g.lineWidth = 4 * u; g.beginPath(); g.arc(W.x, W.y, W.R, 0, 7); g.stroke(); g.lineWidth = 2 * u; g.beginPath(); g.arc(W.x, W.y, W.R * .55, 0, 7); g.stroke(); g.fillStyle = '#4a2236'; g.beginPath(); g.arc(W.x, W.y, 7 * u, 0, 7); g.fill(); g.lineWidth = 1.6 * u;
      for (let i = 0; i < cars; i++) { const a = rot + i / cars * Math.PI * 2; g.beginPath(); g.moveTo(W.x, W.y); g.lineTo(W.x + Math.cos(a) * W.R, W.y + Math.sin(a) * W.R); g.stroke(); }
      for (let i = 0; i < cars; i++) { const a = rot + i / cars * Math.PI * 2, x = W.x + Math.cos(a) * W.R, y = W.y + Math.sin(a) * W.R; g.fillStyle = '#2a0e1c'; g.fillRect(x - 9 * u, y + 2 * u, 18 * u, 13 * u); g.strokeStyle = '#4a2236'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 2 * u); g.stroke(); }
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < cars; i++) { const a = rot + i / cars * Math.PI * 2, x = W.x + Math.cos(a) * W.R, y = W.y + Math.sin(a) * W.R, on = (i + Math.floor(t * 2)) % 2 === 0, R = 16 * u; const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, on ? 'rgba(255,80,90,.9)' : 'rgba(255,210,140,.6)'); gr.addColorStop(1, 'rgba(255,120,120,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); }
      const step = Math.floor(t * 7);
      S.allOn = Math.max(0, (S.allOn || 0) - dt); for (const b of C.bulbs) { const on = S.allOn > 0 || (b.i + step) % 3 === 0, R = (on ? 9 : 5) * u; const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, R); gr.addColorStop(0, on ? 'rgba(255,220,150,.95)' : 'rgba(255,170,90,.35)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(b.x - R, b.y - R, R * 2, R * 2); }
      S.nextEyes -= dt; if (S.nextEyes <= 0) { S.eyes = 2.4; S.nextEyes = 8 + Math.random() * 8; }
      if (S.eyes > 0) { S.eyes -= dt; const blink = Math.sin(S.eyes * 9) > -.9 ? 1 : 0, ex = C.tent.x, ey = C.base - C.tent.h * .18; for (const dx of [-9, 9]) { const R = 6 * u, gr = g.createRadialGradient(ex + dx * u, ey, 0, ex + dx * u, ey, R); gr.addColorStop(0, `rgba(255,40,40,${blink * Math.min(1, S.eyes)})`); gr.addColorStop(1, 'rgba(255,40,40,0)'); g.fillStyle = gr; g.fillRect(ex + dx * u - R, ey - R, R * 2, R * 2); } }
      g.globalCompositeOperation = 'source-over';
      for (const b of S.balloons) {
        b.y -= b.v * dt * u; b.x += Math.sin(t * .7 + b.ph) * 10 * dt * u; if (b.y < -60 * u) { b.y = h + 40 * u; b.x = Math.random() * w; }
        const R = 15 * u * b.s; g.strokeStyle = 'rgba(200,200,200,.35)'; g.lineWidth = 1 * u; g.beginPath(); g.moveTo(b.x, b.y + R * 1.2); g.quadraticCurveTo(b.x + Math.sin(t * 2 + b.ph) * 8 * u, b.y + R * 2.6, b.x, b.y + R * 4); g.stroke();
        const gr = g.createRadialGradient(b.x - R * .35, b.y - R * .4, R * .1, b.x, b.y, R * 1.2); gr.addColorStop(0, '#ff6b78'); gr.addColorStop(1, '#8a0718'); g.fillStyle = gr; g.beginPath(); g.ellipse(b.x, b.y, R, R * 1.2, 0, 0, 7); g.fill();
      }
    }
  }
};

/* ---------- Retrowave: a neon sun over a scrolling grid ---------- */
WALLS.synthwave = {
  name: 'Retrowave', draw(ctx, w, h) {
    const r = rng(80), u = U(w, h), y0 = h * .7;
    const sky = vgrad(ctx, h, [[0, '#080120'], [.45, '#360a5c'], [.62, '#9c1679'], [.7, '#ff5b6e']]); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, y0);
    stars(ctx, r, w, h, Math.round(w * h / 6000), h * .45, u * .8);
    const cx = w / 2, cy = y0 - h * .04, R = h * .22; const sg = ctx.createLinearGradient(0, cy - R, 0, cy + R); sg.addColorStop(0, '#ffef6b'); sg.addColorStop(.6, '#ff6a9a'); sg.addColorStop(1, '#ff2fb0');
    const gl = ctx.createRadialGradient(cx, cy, R * .8, cx, cy, R * 2.6); gl.addColorStop(0, 'rgba(255,80,170,.4)'); gl.addColorStop(1, 'rgba(255,80,170,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, w, y0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, y0); ctx.clip(); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill(); sunBands(ctx, sky, cx, cy, R, 7, .1); ctx.restore();
    const ridgeP = ridge(r, w, y0, h * .08, .9); fillRidge(ctx, ridgeP, w, y0 + 1, '#1b0533'); ctx.strokeStyle = 'rgba(80,240,255,.7)'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ridgeP.forEach((y, i) => { const x = i * w / (ridgeP.length - 1); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.fillStyle = vgrad(ctx, h, [[0, '#0b0018'], [1, '#160030']]); ctx.fillRect(0, y0, w, h - y0);
  },
  anim: {
    init: () => ({}),
    frame: (g, w, h, t) => {
      const u = U(w, h), y0 = h * .7, vx = w / 2;
      g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.6 * u;
      for (let i = -24; i <= 24; i++) { const xb = vx + i * w * .07; g.strokeStyle = 'rgba(255,60,200,.5)'; g.beginPath(); g.moveTo(vx + i * w * .004, y0); g.lineTo(xb, h); g.stroke(); }
      const N = 14; for (let k = 0; k < N; k++) { const z = ((k + t * .9) % N) / N, y = y0 + (h - y0) * z * z; g.strokeStyle = `rgba(90,230,255,${.15 + .6 * z})`; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      const hz = g.createLinearGradient(0, y0 - 6 * u, 0, y0 + 30 * u); hz.addColorStop(0, 'rgba(255,90,200,.0)'); hz.addColorStop(.3, 'rgba(255,90,200,.35)'); hz.addColorStop(1, 'rgba(255,90,200,0)'); g.fillStyle = hz; g.fillRect(0, y0 - 6 * u, w, 36 * u);
      g.globalCompositeOperation = 'source-over';
    }
  }
};

/* ---------- Abyss: deep water with glowing jellyfish ---------- */
WALLS.abyss = {
  name: 'Abyss', draw(ctx, w, h) {
    const r = rng(55), u = U(w, h);
    ctx.fillStyle = vgrad(ctx, h, [[0, '#04304a'], [.45, '#03182d'], [1, '#010711']]); ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const x = w * (.1 + r() * .8), sp = w * (.03 + r() * .05), gr = ctx.createLinearGradient(0, 0, 0, h * .8); gr.addColorStop(0, 'rgba(120,220,255,.1)'); gr.addColorStop(1, 'rgba(120,220,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - sp * .3, 0); ctx.lineTo(x + sp * .3, 0); ctx.lineTo(x + sp * 2, h * .8); ctx.lineTo(x - sp * 1.2, h * .8); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    fillRidge(ctx, ridge(r, w, h * .9, h * .05, 1.2), w, h, '#020d18');
    fillRidge(ctx, ridge(r, w, h * .96, h * .03, 1.4), w, h, '#01060c');
  },
  anim: {
    init: (w, h) => { const r = rng(2), u = U(w, h); return { j: Array.from({ length: 7 }, (_, i) => ({ x: w * (.08 + r() * .84), y: h * (.2 + r() * .7), s: (26 + r() * 34) * u, ph: r() * 6.28, hue: [190, 300, 170, 210, 320][i % 5], v: 6 + r() * 10 })), b: Array.from({ length: 30 }, () => ({ x: r() * w, y: r() * h, s: 1 + r() * 3, v: 20 + r() * 40 })), k: Array.from({ length: 14 }, () => ({ x: r() * w, hgt: h * (.12 + r() * .25), ph: r() * 6.28 })) }; },
    frame: (g, w, h, t, dt, S) => {
      const u = U(w, h);
      g.strokeStyle = '#0b3a3c'; g.lineCap = 'round';
      for (const k of S.k) { g.lineWidth = 7 * u; g.beginPath(); g.moveTo(k.x, h); for (let i = 1; i <= 8; i++) { const y = h - k.hgt * i / 8; g.lineTo(k.x + Math.sin(t * .8 + k.ph + i * .5) * 14 * u * i / 8, y); } g.stroke(); }
      g.globalCompositeOperation = 'lighter';
      for (const j of S.j) {
        const pulse = 1 + .12 * Math.sin(t * 2 + j.ph); j.y -= j.v * dt * u * (pulse > 1.05 ? 1.6 : .4); j.x += Math.sin(t * .3 + j.ph) * 6 * dt * u; if (j.y < -j.s * 3) { j.y = h + j.s * 2; j.x = Math.random() * w; }
        const R = j.s * pulse, gr = g.createRadialGradient(j.x, j.y, 0, j.x, j.y, R * 2.2); gr.addColorStop(0, `hsla(${j.hue},90%,70%,.35)`); gr.addColorStop(1, `hsla(${j.hue},90%,60%,0)`); g.fillStyle = gr; g.fillRect(j.x - R * 2.2, j.y - R * 2.2, R * 4.4, R * 4.4);
        g.fillStyle = `hsla(${j.hue},90%,75%,.45)`; g.beginPath(); g.ellipse(j.x, j.y, R, R * .7, 0, Math.PI, 0); g.fill();
        g.strokeStyle = `hsla(${j.hue},90%,75%,.35)`; g.lineWidth = 1.4 * u;
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(j.x + k * R * .3, j.y); for (let i = 1; i <= 6; i++) g.lineTo(j.x + k * R * .3 + Math.sin(t * 2 + i + k) * 4 * u, j.y + i * R * .32); g.stroke(); }
      }
      for (const b of S.b) { b.y -= b.v * dt * u; if (b.y < 0) { b.y = h; b.x = Math.random() * w; } g.strokeStyle = 'rgba(170,230,255,.35)'; g.lineWidth = 1 * u; g.beginPath(); g.arc(b.x + Math.sin(t + b.x) * 3 * u, b.y, b.s * u, 0, 7); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
    }
  }
};
