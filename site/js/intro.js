'use strict';
/* ================= Boot film: a spider spins its orb web in front of the moon =================
   One world (branches, silk, moon) is filmed by five shots. Each shot has its own camera and
   its own slice of the web-building timeline, and the shots are cut together like a short film. */
function playIntro(host) {
  return new Promise(done => {
    const R = rng(1729);
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.innerHTML = ''; host.append(cv);
    const g = cv.getContext('2d');
    let W = 0, H = 0, DPR = 1, S = 1, bg = null, vign = null;

    /* ---------- helpers ---------- */
    const lerp = (a, b, t) => a + (b - a) * t;
    const lp = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
    const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const quad = (a, c, b, t) => { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }; };

    /* ---------- world: branches ---------- */
    const HUB = { x: 0.04, y: -0.08 }, MOON = { x: 0.2, y: -0.16 };
    const LIMBS = [], LEAVES = [];
    function curve(a, b, bend, n) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
      const c = { x: mx - dy / L * bend, y: my + dx / L * bend }, out = [];
      for (let i = 0; i <= n; i++) { const p = quad(a, c, b, i / n); out.push({ x: p.x + (R() - .5) * L * .006, y: p.y + (R() - .5) * L * .006 }); }
      return out;
    }
    function grow(pts, w0, w1, depth) {
      const limb = { pts, w0, w1 }; LIMBS.push(limb);
      if (depth <= 0) { const e = pts[pts.length - 1], p = pts[pts.length - 2]; const a = Math.atan2(e.y - p.y, e.x - p.x); for (let k = 0; k < 2; k++) LEAVES.push({ x: e.x, y: e.y, a: a + (k ? .55 : -.45) + (R() - .5) * .3, s: .11 + R() * .07, curl: (R() - .5) * .3 }); return limb; }
      const n = 3 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const i = 2 + Math.floor(R() * (pts.length - 5)), p = pts[i], q = pts[i + 1];
        const dir = Math.atan2(q.y - p.y, q.x - p.x) + (R() < .5 ? -1 : 1) * (.45 + R() * .7);
        const len = (.16 + R() * .32) * (depth * .5 + .5), end = { x: p.x + Math.cos(dir) * len, y: p.y + Math.sin(dir) * len };
        if (dist(end, HUB) < 1.2 || dist(p, HUB) < 1.05) continue;
        const w = lerp(w0, w1, i / pts.length);
        grow(curve(p, end, (R() - .5) * len * .5, 9), w * .5, w * .16, depth - 1);
      }
      return limb;
    }
    const top = grow(curve({ x: -3.4, y: -1.6 }, { x: 3.2, y: -1.12 }, .2, 30), .17, .06, 2);
    const stem = grow(curve({ x: 1.22, y: -1.25 }, { x: 1.66, y: 1.1 }, -.1, 20), .06, .02, 1);
    const left = grow(curve({ x: -3.0, y: 2.5 }, { x: -1.22, y: -.08 }, .22, 20), .12, .028, 1);
    const low = grow(curve({ x: -2.4, y: 2.15 }, { x: 2.8, y: 1.78 }, -.12, 28), .1, .04, 1);
    const KNOTS = [];
    for (const lb of [top, stem, left, low]) for (let k = 0; k < 6; k++) { const i = 1 + Math.floor(R() * (lb.pts.length - 2)); KNOTS.push({ ...lb.pts[i], r: lerp(lb.w0, lb.w1, i / lb.pts.length) * (.55 + R() * .25) }); }
    const nearest = (limb, t) => limb.pts.reduce((b, p) => dist(p, t) < dist(b, t) ? p : b, limb.pts[0]);
    const A = [nearest(top, { x: -.85, y: -1.4 }), nearest(top, { x: 1.0, y: -1.3 }), nearest(stem, { x: 1.45, y: .35 }), nearest(low, { x: HUB.x, y: 1.9 }), nearest(left, { x: -1.3, y: -.02 })];
    const F = A.map(a => lp(a, HUB, .12));

    /* ---------- world: the web ---------- */
    function rayPoly(o, ang, poly) {
      const dx = Math.cos(ang), dy = Math.sin(ang); let best = Infinity, pt = null;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], ex = b.x - a.x, ey = b.y - a.y, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den, u = ((a.x - o.x) * dy - (a.y - o.y) * dx) / den;
        if (t > 0 && u >= 0 && u <= 1 && t < best) { best = t; pt = { x: o.x + dx * t, y: o.y + dy * t }; }
      }
      return pt;
    }
    const N = 26, TURNS = 28, K = N * TURNS;
    const ANG = Array.from({ length: N }, (_, i) => -Math.PI / 2 + i * Math.PI * 2 / N + (R() - .5) * .09);
    const END = ANG.map(a => rayPoly(HUB, a, F));
    const SP = [];
    for (let k = 0; k <= K; k++) { const j = k % N, f = .93 - .75 * Math.pow(k / K, .93) + (R() - .5) * .006; SP.push(lp(HUB, END[j], f)); }
    const HUBMESH = [];
    for (let k = 0; k <= N * 5; k++) { const j = k % N, r = .025 + .085 * (k / (N * 5)); HUBMESH.push({ x: HUB.x + Math.cos(ANG[j]) * r * (1 + (R() - .5) * .2), y: HUB.y + Math.sin(ANG[j]) * r * (1 + (R() - .5) * .2) }); }
    const bridgeMid = { x: (A[0].x + A[1].x) / 2, y: (A[0].y + A[1].y) / 2 + .05 };
    const M = quad(A[0], bridgeMid, A[1], clamp01((HUB.x - A[0].x) / (A[1].x - A[0].x)));

    // build segments in the order an orb weaver lays them
    const SEG = [];
    const add = (a, b, kind, w, draw = true, c = null) => SEG.push({ a, b, kind, w, draw, c });
    add(A[0], A[1], 'bridge', 6, true, bridgeMid);
    add(A[1], M, 'walk', 1.3, false, bridgeMid);
    add(M, A[3], 'drop', 3.4);
    add(A[3], F[3], 'walk', .4, false);
    [[3, 2], [2, 1], [1, 0], [0, 4], [4, 3]].forEach(([i, j]) => { add(A[i], F[i], 'frame', .3); add(F[i], F[j], 'frame', 1.1); });
    add(F[3], HUB, 'walk', 1, false);
    const order = ANG.map((a, i) => i).sort((i, j) => ((i * 7) % N) - ((j * 7) % N));
    order.forEach(i => { add(HUB, END[i], 'radius', 1); add(END[i], HUB, 'walk', .55, false); });
    add(HUB, HUB, 'hub', 2.2);
    const spiral0 = SEG.length;
    for (let k = 0; k < K; k++) { const a = SP[k], b = SP[k + 1], mid = lp(a, b, .5); add(a, b, 'spiral', .085, true, lp(mid, HUB, .035)); }
    const spiral1 = SEG.length;
    add(SP[K], HUB, 'walk', 1, false);
    let acc = 0; for (const s of SEG) { s.t0 = acc; acc += s.w; s.t1 = acc; }
    const TOTAL = acc;

    // dew drops for the finished web, mostly on the sticky spiral
    const DEW = [];
    for (let k = spiral0; k < spiral1; k++) if (R() < .42) { const s = SEG[k], t = .15 + R() * .7; DEW.push({ ...quad(s.a, s.c, s.b, t), r: .0035 + R() * .006, ph: R() * 6.28, spark: R() < .06 }); }
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) if (R() < .5) DEW.push({ ...lp(HUB, END[i], .25 + R() * .7), r: .003 + R() * .004, ph: R() * 6.28, spark: false });
    const STAB = [];
    for (const [dir, r0, r1] of [[-Math.PI / 2, .13, .36], [Math.PI / 2, .13, .3]]) for (let r = r0, s = 1; r < r1; r += .017, s = -s) STAB.push({ x: HUB.x + Math.cos(dir) * r + s * .02, y: HUB.y + Math.sin(dir) * r });

    /* ---------- the spider's place on the build timeline ---------- */
    function segAt(b) { let lo = 0, hi = SEG.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (SEG[m].t1 <= b) lo = m + 1; else hi = m; } return lo; }
    function spiderAt(b, t) {
      const i = segAt(Math.min(b, TOTAL - 1e-6)), s = SEG[i], p = clamp01((b - s.t0) / s.w);
      let pos, head, moving = true;
      if (s.kind === 'bridge') {
        if (p < .55) { pos = { ...s.a }; head = 0.3; moving = false; }
        else { const q = (p - .55) / .45; pos = quad(s.a, s.c, s.b, q); const n = quad(s.a, s.c, s.b, Math.min(1, q + .01)); head = Math.atan2(n.y - pos.y, n.x - pos.x); }
      } else if (s.kind === 'hub') {
        const k = Math.floor(p * (HUBMESH.length - 1)); pos = HUBMESH[k]; const n = HUBMESH[Math.min(HUBMESH.length - 1, k + 1)]; head = Math.atan2(n.y - pos.y, n.x - pos.x) || 0;
      } else {
        pos = s.c ? quad(s.a, s.c, s.b, p) : lp(s.a, s.b, p);
        const n = s.c ? quad(s.a, s.c, s.b, Math.min(1, p + .02)) : s.b;
        head = s.kind === 'drop' ? Math.PI / 2 : Math.atan2(n.y - pos.y, n.x - pos.x) || 0;
        if (s.kind === 'drop') { pos = { x: pos.x + Math.sin(t * 2.1) * .004, y: pos.y }; moving = false; }
      }
      if (b >= TOTAL) { pos = { x: HUB.x, y: HUB.y + .01 }; head = Math.PI / 2; moving = false; }
      return { x: pos.x, y: pos.y, head, moving, i, p };
    }

    /* ---------- sprites ---------- */
    function makeMoon(size) {
      const c = document.createElement('canvas'); c.width = c.height = size; const m = c.getContext('2d'), r = size / 2, mr = rng(77);
      m.save(); m.beginPath(); m.arc(r, r, r * .985, 0, 7); m.clip();
      const gr = m.createRadialGradient(r * .82, r * .78, r * .1, r, r, r); gr.addColorStop(0, '#fcf9ef'); gr.addColorStop(.7, '#ece7d6'); gr.addColorStop(1, '#cdc7b2');
      m.fillStyle = gr; m.fillRect(0, 0, size, size);
      for (const [x, y, s] of [[.36, .35, .22], [.6, .3, .15], [.56, .55, .18], [.32, .63, .12], [.71, .47, .1], [.46, .46, .11], [.24, .45, .08]]) for (let k = 0; k < 26; k++) {
        const px = (x + (mr() - .5) * s * .9) * size, py = (y + (mr() - .5) * s * .9) * size, pr = s * size * (.35 + mr() * .45), gg = m.createRadialGradient(px, py, 0, px, py, pr);
        gg.addColorStop(0, 'rgba(128,124,118,.075)'); gg.addColorStop(.6, 'rgba(128,124,118,.04)'); gg.addColorStop(1, 'rgba(128,124,118,0)'); m.fillStyle = gg; m.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
      const tx = r * .8, ty = r * 1.55;
      for (let k = 0; k < 18; k++) { const a = mr() * 6.28, len = r * (.25 + mr() * .7); m.strokeStyle = 'rgba(255,255,245,.055)'; m.lineWidth = size * .006; m.beginPath(); m.moveTo(tx, ty); m.lineTo(tx + Math.cos(a) * len, ty + Math.sin(a) * len); m.stroke(); }
      for (let k = 0; k < 80; k++) {
        const a = mr() * 6.28, d = Math.sqrt(mr()) * r * .93, cx = r + Math.cos(a) * d, cy = r + Math.sin(a) * d, cr = (mr() < .85 ? .003 + mr() * .01 : .016 + mr() * .026) * size;
        m.fillStyle = 'rgba(115,108,100,.09)'; m.beginPath(); m.arc(cx, cy, cr, 0, 7); m.fill();
        m.strokeStyle = 'rgba(255,255,248,.16)'; m.lineWidth = cr * .3; m.beginPath(); m.arc(cx + cr * .12, cy + cr * .12, cr * .9, 3.5, 5.7); m.stroke();
      }
      m.fillStyle = 'rgba(255,255,250,.55)'; m.beginPath(); m.arc(tx, ty, size * .008, 0, 7); m.fill();
      const ld = m.createRadialGradient(r, r, r * .55, r, r, r); ld.addColorStop(0, 'rgba(10,10,30,0)'); ld.addColorStop(1, 'rgba(20,20,45,.38)'); m.fillStyle = ld; m.fillRect(0, 0, size, size);
      m.restore(); return c;
    }
    const MOONIMG = makeMoon(900);
    const DEWIMG = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const d = c.getContext('2d'); const gr = d.createRadialGradient(26, 24, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(225,235,255,.85)'); gr.addColorStop(.75, 'rgba(150,170,230,.35)'); gr.addColorStop(1, 'rgba(150,170,230,0)'); d.fillStyle = gr; d.beginPath(); d.arc(32, 32, 30, 0, 7); d.fill(); return c; })();
    const PUFF = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const d = c.getContext('2d'); const gr = d.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(190,200,235,.55)'); gr.addColorStop(1, 'rgba(190,200,235,0)'); d.fillStyle = gr; d.fillRect(0, 0, 256, 256); return c; })();
    const GRAIN = (() => { const c = document.createElement('canvas'); c.width = c.height = 160; const d = c.getContext('2d'), im = d.createImageData(160, 160), nr = rng(5); for (let i = 0; i < im.data.length; i += 4) { const v = nr() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } d.putImageData(im, 0, 0); return c; })();
    let grainPat = null;
    const CLOUDS = Array.from({ length: 4 }, (_, i) => ({ y: .2 + i * .17 + R() * .06, x: R(), sp: .006 + R() * .008, puffs: Array.from({ length: 7 }, () => ({ dx: (R() - .5) * .5, dy: (R() - .5) * .05, s: .12 + R() * .14 })), a: .05 + R() * .05 }));

    function resize() {
      DPR = Math.min(devicePixelRatio || 1, 2); W = cv.width = Math.round(innerWidth * DPR); H = cv.height = Math.round(innerHeight * DPR); S = Math.min(W, H) * .5;
      bg = document.createElement('canvas'); bg.width = W; bg.height = H; const b = bg.getContext('2d');
      b.fillStyle = vgrad(b, H, [[0, '#02040c'], [.55, '#08102a'], [1, '#121838']]); b.fillRect(0, 0, W, H);
      stars(b, rng(3), W, H, Math.round(W * H / 2600), H, Math.max(.6, Math.min(W, H) / 1080));
      vign = document.createElement('canvas'); vign.width = W; vign.height = H; const v = vign.getContext('2d'), vg = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,8,.75)'); v.fillStyle = vg; v.fillRect(0, 0, W, H);
      grainPat = g.createPattern(GRAIN, 'repeat');
    }
    resize(); addEventListener('resize', resize);

    /* ---------- the shots ---------- */
    const bridgeEnd = SEG[0].t1, yStart = SEG[1].t0, yEnd = SEG[2].t1, frameStart = SEG[3].t0, radiiEnd = SEG[spiral0 - 1].t1;
    const spW = SEG[spiral1 - 1].t1 - SEG[spiral0].t0, spStart = SEG[spiral0].t0;
    const CUTS = [
      { t0: 0, t1: 4.4, b0: 0, b1: bridgeEnd, cam: (lt) => ({ x: -.02, y: -.42, z: .33 + .05 * ease(lt) }), blur: 0 },
      { t0: 4.4, t1: 7.6, b0: yStart, b1: yEnd, follow: { z0: 1.3, z1: 1.55, ox: .02, oy: -.02 }, blur: .9 },
      { t0: 7.6, t1: 11.6, b0: frameStart, b1: radiiEnd + 2.2, cam: (lt) => ({ x: HUB.x + .02, y: HUB.y + .05, z: .5 + .05 * lt }), blur: .25 },
      { t0: 11.6, t1: 15.2, b0: spStart + spW * .4, b1: spStart + spW * .445, follow: { z0: 3.3, z1: 3.75, ox: .03, oy: .03 }, blur: 2.2 },
      { t0: 15.2, t1: 22, b0: TOTAL, b1: TOTAL, cam: (lt) => ({ x: HUB.x, y: HUB.y - .03, z: lerp(1.1, .56, easeOut(Math.min(1, lt * 1.15))) }), blur: 0, final: true }
    ];
    const END_T = CUTS[CUTS.length - 1].t1;
    let camS = null, lastCut = -1;

    /* ---------- drawing ---------- */
    function moonScreen(cam) {
      const k = .3, z = cam.z;
      return { x: W / 2 + (MOON.x - cam.x) * z * S * k, y: H / 2 + (MOON.y - cam.y) * z * S * k, r: S * (.37 + .05 * Math.min(z, 1)) * (z > 1 ? 1 + (z - 1) * .2 : 1) };
    }
    function drawMoon(m, blur, t) {
      const gl = g.createRadialGradient(m.x, m.y, m.r * .9, m.x, m.y, m.r * 3.2);
      gl.addColorStop(0, 'rgba(200,212,255,.26)'); gl.addColorStop(.35, 'rgba(150,170,240,.08)'); gl.addColorStop(1, 'rgba(150,170,240,0)');
      g.fillStyle = gl; g.fillRect(0, 0, W, H);
      if (blur > 0) g.filter = `blur(${(blur * 6 * DPR).toFixed(1)}px)`;
      g.drawImage(MOONIMG, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      g.filter = 'none';
      for (const c of CLOUDS) {
        const cx = ((c.x - t * c.sp) % 1.4 + 1.4) % 1.4 - .2;
        for (const p of c.puffs) { const s = p.s * Math.max(W, H); g.globalAlpha = c.a; g.drawImage(PUFF, (cx + p.dx) * W - s / 2, (c.y + p.dy) * H - s * .18, s, s * .36); }
      }
      g.globalAlpha = 1;
    }
    function drawBranches(px, rx, ry) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const lb of LIMBS) {
        const n = lb.pts.length;
        g.strokeStyle = '#04050a';
        for (let i = 0; i < n - 1; i++) { const a = lb.pts[i], b = lb.pts[i + 1]; g.lineWidth = lerp(lb.w0, lb.w1, i / (n - 1)); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
        g.strokeStyle = 'rgba(160,178,235,.2)'; g.lineWidth = Math.max(1.2 / px, lb.w1 * .25); g.beginPath();
        lb.pts.forEach((p, i) => { const w = lerp(lb.w0, lb.w1, i / (n - 1)) * .42; i ? g.lineTo(p.x + rx * w, p.y + ry * w) : g.moveTo(p.x + rx * w, p.y + ry * w); }); g.stroke();
      }
      g.fillStyle = '#04050a';
      for (const k of KNOTS) { g.beginPath(); g.ellipse(k.x, k.y, k.r * 1.05, k.r * .8, R() * 0, 0, 7); g.fill(); }
      for (const l of LEAVES) {
        g.save(); g.translate(l.x, l.y); g.rotate(l.a); g.scale(l.s, l.s);
        const leaf = new Path2D(); leaf.moveTo(.18, 0); leaf.bezierCurveTo(.35, -.34 + l.curl, .8, -.28 + l.curl, 1, l.curl * .5); leaf.bezierCurveTo(.78, .22 + l.curl, .38, .3 + l.curl, .18, 0);
        g.lineWidth = .05; g.strokeStyle = '#04050a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(.2, 0); g.stroke();
        g.fillStyle = '#05060c'; g.fill(leaf);
        g.strokeStyle = 'rgba(160,178,235,.16)'; g.lineWidth = 1.1 / (px * l.s); g.stroke(leaf);
        g.strokeStyle = 'rgba(160,178,235,.08)'; g.beginPath(); g.moveTo(.2, 0); g.quadraticCurveTo(.6, l.curl * .4, .97, l.curl * .5); g.stroke();
        for (let v = .35; v < .9; v += .14) { g.beginPath(); g.moveTo(v, l.curl * v * .5); g.lineTo(v + .1, -.14 + l.curl * .6); g.moveTo(v, l.curl * v * .5); g.lineTo(v + .1, .13 + l.curl * .6); g.stroke(); }
        g.restore();
      }
    }
    function drawSilk(b, t, cam, m, px, sp, spinneret) {
      const buckets = [[], [], [], []], toS = p => ({ x: (p.x - cam.x) * cam.z * S + W / 2, y: (p.y - cam.y) * cam.z * S + H / 2 });
      const bright = p => { const s = toS(p), d = Math.hypot(s.x - m.x, s.y - m.y); return clamp01((m.r * 1.35 - d) / (m.r * .8)); };
      const push = (a, c, e, kind) => { const mid = c || lp(a, e, .5); const k = Math.min(3, Math.floor(bright(mid) * 3.999)); buckets[k].push([a, c, e, kind]); };
      const cur = b >= TOTAL ? SEG.length : segAt(b);
      for (let i = 0; i < Math.min(cur + 1, SEG.length); i++) {
        const s = SEG[i]; if (!s.draw) continue;
        const done = i < cur, p = done ? 1 : clamp01((b - s.t0) / s.w);
        if (s.kind === 'bridge') {
          if (!done && p < .55) { const q = ease(p / .55), e = { x: lerp(s.a.x, s.b.x, q), y: lerp(s.a.y, s.b.y, q) + Math.sin(t * 2.3) * .1 * (1 - q) + .06 * (1 - q) }; push(s.a, { x: (s.a.x + e.x) / 2, y: (s.a.y + e.y) / 2 - .07 * Math.sin(t * 1.4) }, e, 'bridge'); }
          else push(s.a, s.c, s.b, 'bridge');
        } else if (s.kind === 'hub') {
          const n = done ? HUBMESH.length : Math.max(2, Math.floor(p * HUBMESH.length));
          for (let k = 0; k < n - 1; k++) push(HUBMESH[k], null, HUBMESH[k + 1], 'hub');
        } else if (done) push(s.a, s.c, s.b, s.kind);
        else if (s.c) { const e = quad(s.a, s.c, s.b, p); push(s.a, lp(s.a, s.c, p), e, s.kind); push(e, null, spinneret, 'tail'); }
        else push(s.a, null, spinneret || lp(s.a, s.b, p), s.kind);
      }
      const base = Math.max(.6, Math.min(2.4, .55 + cam.z * .35)) * DPR / px;
      for (let k = 0; k < 4; k++) {
        const list = buckets[k]; if (!list.length) continue;
        const path = new Path2D(), thick = new Path2D();
        for (const [a, c, e, kind] of list) { const P = kind === 'spiral' || kind === 'hub' || kind === 'tail' ? path : thick; P.moveTo(a.x, a.y); c ? P.quadraticCurveTo(c.x, c.y, e.x, e.y) : P.lineTo(e.x, e.y); }
        const alpha = .3 + k * .19, col = `rgba(${lerp(170, 238, k / 3) | 0},${lerp(185, 244, k / 3) | 0},255,`;
        if (k >= 2) { g.strokeStyle = col + (alpha * .1) + ')'; g.lineWidth = base * 3.2; g.stroke(thick); g.stroke(path); }
        g.strokeStyle = col + alpha + ')'; g.lineWidth = base * 1.05; g.stroke(thick);
        g.lineWidth = base * .72; g.stroke(path);
      }
    }
    function drawDew(t, px) {
      for (const d of DEW) {
        const tw = .65 + .35 * Math.sin(t * 2.6 + d.ph), r = d.r * (1.4 + tw * .3);
        g.globalAlpha = .55 + .45 * tw; g.drawImage(DEWIMG, d.x - r, d.y - r, r * 2, r * 2);
        if (d.spark) { const L = r * (3 + 3 * tw); g.strokeStyle = `rgba(240,245,255,${.5 * tw})`; g.lineWidth = 1 / px; g.beginPath(); g.moveTo(d.x - L, d.y); g.lineTo(d.x + L, d.y); g.moveTo(d.x, d.y - L); g.lineTo(d.x, d.y + L); g.stroke(); }
      }
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(235,240,255,.55)'; g.lineWidth = 2.2 / px; g.beginPath(); STAB.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
    }
    function drawSpider(sp, t, px, mdir) {
      const L = .085, detail = px * L > 40, u = 1 / (px * L);
      g.save(); g.translate(sp.x, sp.y); g.rotate(sp.head); g.scale(L, L);
      const md = mdir - sp.head, rx = Math.cos(md), ry = Math.sin(md);
      const body = '#100c14', legC = '#151018', rim = 'rgba(205,215,255,.6)';
      const ph = t * 10, tipOut = [];
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
        const base = [.62, 1.18, 1.92, 2.5][i], l1 = [.62, .55, .44, .6][i], l2 = [.8, .62, .5, .74][i], bend = [-.42, -.18, .25, .4][i];
        const phase = ph + ((i + (s > 0 ? 1 : 0)) % 2) * Math.PI;
        const sw = sp.moving ? Math.sin(phase) * .26 : Math.sin(t * 1.2 + i * 1.7 + s) * .03;
        const tuck = !sp.moving && SEG[sp.i] && SEG[sp.i].kind === 'drop' ? .22 : 0;
        const b0 = { x: .17 + Math.cos(base) * .12, y: s * Math.sin(base) * .11 };
        const ka = s * (base - sw * .7 - tuck * (i < 2 ? 1 : -1));
        const knee = { x: b0.x + Math.cos(ka) * l1, y: b0.y + Math.sin(ka) * l1 };
        const ta = s * (base - sw + bend - tuck * (i < 2 ? 1.4 : -1.4));
        const mid = { x: knee.x + Math.cos(ta) * l2 * .56, y: knee.y + Math.sin(ta) * l2 * .56 };
        const tip = { x: mid.x + Math.cos(ta + s * .12) * l2 * .44, y: mid.y + Math.sin(ta + s * .12) * l2 * .44 };
        tipOut.push(tip);
        const seg = (a, b, w0, w1) => { g.strokeStyle = legC; g.lineWidth = w0; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(lerp(a.x, b.x, .5), lerp(a.y, b.y, .5)); g.stroke(); g.lineWidth = w1; g.beginPath(); g.moveTo(lerp(a.x, b.x, .5), lerp(a.y, b.y, .5)); g.lineTo(b.x, b.y); g.stroke(); };
        seg(b0, knee, .075, .06); seg(knee, mid, .055, .042); seg(mid, tip, .036, .018);
        g.strokeStyle = rim; g.lineWidth = Math.max(u * .9, .012); g.beginPath(); g.moveTo(b0.x + rx * .03, b0.y + ry * .03); g.lineTo(knee.x + rx * .025, knee.y + ry * .025); g.lineTo(mid.x + rx * .02, mid.y + ry * .02); g.lineTo(tip.x + rx * .01, tip.y + ry * .01); g.stroke();
        if (detail) {
          for (const j of [knee, mid]) { g.fillStyle = '#3d3029'; g.beginPath(); g.arc(j.x, j.y, .03, 0, 7); g.fill(); }
          g.strokeStyle = 'rgba(120,100,88,.9)'; g.lineWidth = .016;
          for (const [a, b] of [[b0, knee], [knee, mid]]) { const m2 = lp(a, b, .5), dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); g.beginPath(); g.moveTo(m2.x - dy / l * .028, m2.y + dx / l * .028); g.lineTo(m2.x + dy / l * .028, m2.y - dx / l * .028); g.stroke(); }
          g.strokeStyle = 'rgba(60,50,46,.95)'; g.lineWidth = .008;
          for (const [a, b] of [[knee, mid], [mid, tip], [b0, knee]]) for (let k = 1; k < 7; k++) { const p = lp(a, b, k / 7), dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy), nx = -dy / l * s, ny = dx / l * s; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + (nx * .9 + dx / l * .5) * .07, p.y + (ny * .9 + dy / l * .5) * .07); g.stroke(); }
        }
      }
      // pedipalps
      g.strokeStyle = legC; g.lineWidth = .045;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(.34, s * .05); g.quadraticCurveTo(.46, s * .09, .53 + Math.sin(t * 3 + s) * .01, s * .06); g.stroke(); }
      // abdomen
      g.fillStyle = body; g.beginPath(); g.ellipse(-.3, 0, .4, .31, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(70,55,48,.8)'; g.beginPath(); g.moveTo(-.02, 0); g.bezierCurveTo(-.2, -.17, -.5, -.14, -.66, 0); g.bezierCurveTo(-.5, .14, -.2, .17, -.02, 0); g.fill();
      g.fillStyle = body; g.beginPath(); g.moveTo(-.07, 0); g.bezierCurveTo(-.22, -.1, -.48, -.08, -.6, 0); g.bezierCurveTo(-.48, .08, -.22, .1, -.07, 0); g.fill();
      g.strokeStyle = 'rgba(150,128,110,.55)'; g.lineWidth = .02;
      for (let k = 0; k < 4; k++) { const x = -.12 - k * .12, w = .1 - k * .016; g.beginPath(); g.moveTo(x - .05, -w); g.lineTo(x, 0); g.lineTo(x - .05, w); g.stroke(); }
      if (detail) { g.fillStyle = 'rgba(160,140,120,.35)'; const hr = rng(9); for (let k = 0; k < 60; k++) { const a = hr() * 6.28, d = Math.sqrt(hr()); g.fillRect(-.3 + Math.cos(a) * .38 * d, Math.sin(a) * .29 * d, .008, .008); } }
      g.strokeStyle = rim; g.lineWidth = Math.max(u * 1.1, .015); g.beginPath(); g.ellipse(-.3, 0, .4, .31, 0, md - 1.1, md + 1.1); g.stroke();
      g.fillStyle = '#1c1519'; g.beginPath(); g.ellipse(-.69, 0, .05, .04, 0, 0, 7); g.fill();
      // cephalothorax
      g.fillStyle = body; g.beginPath(); g.ellipse(.03, 0, .07, .06, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(.2, 0, .21, .165, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(80,66,60,.7)'; g.lineWidth = .014; g.beginPath(); g.moveTo(.06, 0); g.lineTo(.3, 0); g.stroke();
      g.strokeStyle = rim; g.lineWidth = Math.max(u * .9, .012); g.beginPath(); g.ellipse(.2, 0, .21, .165, 0, md - 1, md + 1); g.stroke();
      if (detail) {
        g.fillStyle = '#050406';
        for (const [x, y, r] of [[.37, .042, .03], [.37, -.042, .03], [.33, .085, .018], [.33, -.085, .018], [.31, .02, .016], [.31, -.02, .016], [.355, .1, .012], [.355, -.1, .012]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(230,238,255,.95)';
        for (const [x, y, r] of [[.37, .042, .03], [.37, -.042, .03], [.33, .085, .018], [.33, -.085, .018]]) { g.beginPath(); g.arc(x + rx * r * .35, y + ry * r * .35, r * .32, 0, 7); g.fill(); }
        g.fillStyle = '#1a1215'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(.42, s * .03, .04, .025, 0, 0, 7); g.fill(); }
      }
      g.restore();
    }

    /* ---------- loop ---------- */
    let start = performance.now(), last = start, raf = 0, ended = false, skipAt = null;
    function frame(now) {
      // window.__introSeek (seconds) freezes the film at one moment, for checking shots by hand
      const t = window.__introSeek != null ? window.__introSeek : Math.max(0, (now - start) / 1000), dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
      if (t >= END_T) return finish();
      const ci = Math.max(0, CUTS.findIndex(c => t >= c.t0 && t < c.t1)), cut = CUTS[ci], lt = (t - cut.t0) / (cut.t1 - cut.t0);
      const b = lerp(cut.b0, cut.b1, cut.final ? 1 : ease(lt) * .85 + lt * .15);
      const sp = spiderAt(b, t);
      let cam;
      if (cut.follow) {
        const f = cut.follow, want = { x: sp.x + f.ox, y: sp.y + f.oy, z: lerp(f.z0, f.z1, lt) };
        if (ci !== lastCut || !camS) camS = want; else { const k = 1 - Math.exp(-dt * 3.2); camS = { x: lerp(camS.x, want.x, k), y: lerp(camS.y, want.y, k), z: want.z }; }
        cam = camS;
      } else cam = cut.cam(lt);
      lastCut = ci;
      const px = cam.z * S, m = moonScreen(cam);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      g.drawImage(bg, 0, 0);
      drawMoon(m, cut.blur, t);
      g.setTransform(px, 0, 0, px, W / 2 - cam.x * px, H / 2 - cam.y * px);
      const mdx = m.x - W / 2, mdy = m.y - H / 2, ml = Math.hypot(mdx, mdy) || 1;
      drawBranches(px, mdx / ml, mdy / ml);
      const spS = { x: (sp.x - cam.x) * px + W / 2, y: (sp.y - cam.y) * px + H / 2 }, mdir = Math.atan2(m.y - spS.y, m.x - spS.x);
      const spinneret = { x: sp.x - Math.cos(sp.head) * .059, y: sp.y - Math.sin(sp.head) * .059 };
      drawSilk(b, t, cam, m, px, sp, spinneret);
      if (cut.final) drawDew(t, px);
      drawSpider(sp, t, px, mdir);
      g.setTransform(1, 0, 0, 1, 0, 0);
      // bloom where the moon shines through the silk
      g.globalCompositeOperation = 'lighter';
      const bl = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 1.15); bl.addColorStop(0, 'rgba(255,255,255,.06)'); bl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = bl; g.fillRect(m.x - m.r * 1.2, m.y - m.r * 1.2, m.r * 2.4, m.r * 2.4);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(vign, 0, 0);
      g.globalAlpha = .05; g.save(); g.translate((Math.random() * 160) | 0, (Math.random() * 160) | 0); g.fillStyle = grainPat; g.fillRect(-160, -160, W + 320, H + 320); g.restore(); g.globalAlpha = 1;
      // letterbox
      const lb = (W > H ? Math.max(0, (H - W / 2.2) / 2) : H * .07) * easeOut(clamp01(t / 1.2));
      g.fillStyle = '#000'; g.fillRect(0, 0, W, lb); g.fillRect(0, H - lb, W, lb);
      // title over the last shot
      if (cut.final) {
        const a = clamp01((t - cut.t0 - 2.6) / 1.2) * clamp01((cut.t1 - t - .9) / 1.0);
        if (a > 0) {
          g.globalAlpha = a; g.fillStyle = '#eef0ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
          const fs = Math.round(Math.min(W, H) * .062), y = H - lb - fs * 1.9;
          g.font = `700 ${fs}px Cantarell, "Segoe UI", sans-serif`; if ('letterSpacing' in g) g.letterSpacing = `${(fs * .08) | 0}px`;
          g.shadowColor = 'rgba(0,0,10,.8)'; g.shadowBlur = fs * .5; g.fillText('NightOS', W / 2, y);
          g.font = `400 ${Math.round(fs * .3)}px Cantarell, "Segoe UI", sans-serif`; if ('letterSpacing' in g) g.letterSpacing = `${(fs * .06) | 0}px`;
          g.fillStyle = 'rgba(200,208,240,.85)'; g.fillText('24.10  ·  UMBRA', W / 2, y + fs * .85);
          g.shadowBlur = 0; if ('letterSpacing' in g) g.letterSpacing = '0px'; g.globalAlpha = 1;
        }
      }
      // cut transitions: a quick dip to black between shots, slow fades at the ends
      const fin = ci === 0 ? 1.1 : .22, fout = ci === CUTS.length - 1 ? 1.4 : .16;
      const vis = clamp01(Math.min((t - cut.t0) / fin, (cut.t1 - t) / fout));
      if (vis < 1) { g.fillStyle = `rgba(0,0,0,${1 - vis})`; g.fillRect(0, 0, W, H); }
      if (t < 5) { g.globalAlpha = clamp01((t - 1.2) / .6) * clamp01((5 - t) / .8) * .55; g.fillStyle = '#c8cde0'; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.font = `400 ${Math.round(13 * DPR)}px Cantarell, sans-serif`; g.fillText('Press any key to skip', W - 18 * DPR, H - Math.max(lb, 0) - 14 * DPR); g.globalAlpha = 1; }
      if (skipAt != null) { const k = clamp01((now - skipAt) / 350); g.fillStyle = `rgba(0,0,0,${k})`; g.fillRect(0, 0, W, H); if (k >= 1) return finish(); }
      raf = requestAnimationFrame(frame);
    }
    function skip(e) {
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      if (skipAt == null) { skipAt = performance.now(); setTimeout(finish, 450); } // the timer covers tabs where animation frames are paused
    }
    function finish() {
      if (ended) return; ended = true; cancelAnimationFrame(raf);
      removeEventListener('resize', resize); removeEventListener('keydown', skip, true); host.removeEventListener('pointerdown', skip);
      host.innerHTML = ''; done();
    }
    addEventListener('keydown', skip, true); host.addEventListener('pointerdown', skip);
    raf = requestAnimationFrame(frame);
  });
}
