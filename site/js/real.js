'use strict';
/* ================= real data from the browser behind NightOS ================= */
// Battery (Chromium browsers expose it; elsewhere NightOS keeps a simulated battery)
if (navigator.getBattery) navigator.getBattery().then(b => {
  REAL.battery = b;
  const upd = () => { CFG.battery = Math.round(b.level * 100); renderTray(); document.dispatchEvent(new Event('cfg')); };
  b.addEventListener('levelchange', upd);
  b.addEventListener('chargingchange', () => { upd(); notify('settings', b.charging ? 'Charging' : 'On battery power', `${Math.round(b.level * 100)} %`); });
  upd();
}).catch(() => { });
// Network state follows the real connection
addEventListener('online', () => { REAL.online = true; renderTray(); document.dispatchEvent(new Event('cfg')); notify('settings', 'Network connected', 'Your computer is back online.'); });
addEventListener('offline', () => { REAL.online = false; renderTray(); document.dispatchEvent(new Event('cfg')); notify('settings', 'Network disconnected', 'Your computer went offline.', { urgent: true }); });
// CPU: how busy NightOS's own threads are, from timer lag and long tasks
(() => {
  let last = performance.now(), lag = 0, lt = 0, since = last;
  setInterval(() => { const now = performance.now(); lag += Math.max(0, now - last - 50); last = now; }, 50);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) lt += e.duration; }).observe({ type: 'longtask' }); } catch (e) { }
  REAL.sampleMain = () => { const now = performance.now(), span = Math.max(1, now - since); since = now; const v = document.hidden ? 0 : clamp(Math.max(lag, lt) / span * 100, 0, 100); lag = 0; lt = 0; return v; };
  REAL.sampleWorker = () => NODE.startedAt ? 100 : 0;
  let rx = 0;
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) rx += e.transferSize || e.encodedBodySize || 0; }).observe({ type: 'resource', buffered: true }); } catch (e) { }
  REAL.sampleNet = () => { const b = rx; rx = 0; REAL.totRx += b; return b / 1024; };
})();
REAL.mem = () => performance.memory && performance.memory.jsHeapSizeLimit ? { used: performance.memory.usedJSHeapSize, total: performance.memory.jsHeapSizeLimit } : null;
function refreshStorage() { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { REAL.storage = e; }).catch(() => { }); }
refreshStorage(); setInterval(refreshStorage, 30000);
let stT; document.addEventListener('fs', () => { clearTimeout(stT); stT = setTimeout(refreshStorage, 1500); });
(() => {
  const uad = navigator.userAgentData, ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'an unknown OS';
  REAL.host = `${engineName()} on ${os}`;
  if (uad && uad.getHighEntropyValues) uad.getHighEntropyValues(['architecture', 'bitness', 'platformVersion']).then(v => {
    if (v.architecture === 'arm') REAL.arch = v.bitness === '32' ? 'armv7l' : 'aarch64';
    if (os === 'Windows' && v.platformVersion) REAL.host = `${engineName()} on Windows ${parseInt(v.platformVersion) >= 13 ? '11' : '10'}`;
  }).catch(() => { });
})();

/* ================= blob storage for real files (IndexedDB) ================= */
const BLOBS = {
  db: null, mem: new Map(),
  open() { if (!this.db) this.db = new Promise((res, rej) => { try { const r = indexedDB.open('nightos', 1); r.onupgradeneeded = () => r.result.createObjectStore('blobs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); return this.db; },
  async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('blobs', mode), r = fn(t.objectStore('blobs')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); },
  async put(id, blob) { this.mem.set(id, blob); try { await this.tx('readwrite', s => s.put(blob, id)); return true; } catch (e) { return false; } },
  async get(id) { if (this.mem.has(id)) return this.mem.get(id); try { const b = await this.tx('readonly', s => s.get(id)); if (b) this.mem.set(id, b); return b || null; } catch (e) { return null; } },
  async keys() { try { return await this.tx('readonly', s => s.getAllKeys()); } catch (e) { return []; } },
  async del(id) { this.mem.delete(id); try { await this.tx('readwrite', s => s.delete(id)); } catch (e) { } }
};
const newBlobId = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
async function collectBlobs() {
  const used = new Set(), walk = n => { if (n.type === 'dir') Object.values(n.children).forEach(walk); else if (n.blob) used.add(n.blob); };
  walk(FS); (CFG.installed || []).forEach(a => a.blob && used.add(a.blob)); (CFG.snapshots || []).forEach(s => (s.blobs || []).forEach(b => used.add(b)));
  for (const k of await BLOBS.keys()) if (!used.has(k) && !String(k).startsWith('snap:')) BLOBS.del(k);
}
const TEXT_EXT = /\.(txt|md|sh|bash|py|js|mjs|ts|json|csv|tsv|log|conf|cfg|ini|toml|ya?ml|xml|html?|css|c|h|cpp|hpp|rs|go|java|kt|rb|php|lua|sql|env|gitignore)$/i;
async function importFiles(list, dir) {
  if (!getNode(dir) || !canWrite(dir, false)) dir = HOME + '/Downloads';
  const files = [...list].filter(f => f && f.name); if (!files.length) return;
  for (const f of files) {
    const m = f.name.match(/^(.+?)(\.[^.]+)?$/), name = uniqueName(dir, m[1], m[2] || ''), dn = getNode(dir);
    if ((f.type.startsWith('text/') || TEXT_EXT.test(f.name)) && f.size < 512000) dn.children[name] = { type: 'file', content: await f.text(), mtime: f.lastModified || Date.now(), exec: /\.(sh|py)$/i.test(f.name) };
    else { const id = newBlobId(); const ok = await BLOBS.put(id, f); dn.children[name] = { type: 'file', content: '', blob: id, size: f.size, mime: f.type, mtime: f.lastModified || Date.now() }; if (!ok) notify('files', 'Kept for this session only', `Your browser blocked storage, so “${f.name}” disappears when you reload.`); }
  }
  fsChanged();
  notify('files', files.length === 1 ? `Imported “${files[0].name}”` : `Imported ${files.length} files`, `Saved to ${tilde(dir)}`, { actionLabel: 'Show in Files', action: () => launch('files', dir) });
}
function pickFiles(dir, accept) {
  const i = document.createElement('input'); i.type = 'file'; i.multiple = true; if (accept) i.accept = accept;
  i.onchange = () => importFiles(i.files, dir); i.click();
}
const SAVE_OK = /\.(gif|png|jpe?g|webp|mp4|webm|mov|txt|json|md|docx|pptx|epub|csv|ttf|html|svg|pdf|xlsx|zip|fig)$/i;
async function exportFile(path) {
  const n = getNode(path), name0 = splitPath(path)[1];
  if (!n || n.type === 'dir') return notify('files', 'Folders can’t be downloaded', 'Download the files inside one at a time.');
  if (n.size != null && !n.blob) return notify('files', `“${name0}” is part of the simulation`, 'It has no real contents to save.');
  const inClaude = !!(window.claude && window.claude.use);
  let data, name = name0;
  if (n.blob) data = await BLOBS.get(n.blob);
  else if ((n.content || '').startsWith('wall:') && WALLS[n.content.slice(5)]) { const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; WALLS[n.content.slice(5)].draw(cv.getContext('2d'), 1920, 1080); data = await new Promise(r => cv.toBlob(r, 'image/png')); }
  else { data = n.content || '\n'; if (inClaude && !SAVE_OK.test(name)) name += '.txt'; }
  if (!data) return notify('files', 'Couldn’t read the file', 'Its contents are no longer stored in this browser.');
  if (!inClaude) {
    // On the NightOS website an ordinary browser download works.
    const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'text/plain' })); a.download = name;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return notify('files', 'Downloaded', name);
  }
  const dl = await window.claude.use('downloads');
  if (!dl) return notify('files', 'Saving to your computer isn’t available here', 'Open the NightOS website to download files.');
  try { await dl.save({ filename: name, data }); notify('files', 'Saved to your computer', name); }
  catch (e) {
    const code = e && e.code; if (code === 'declined') return;
    notify('files', 'Couldn’t save the file', { rejected_extension: 'Browsers here can’t save this file type.', rate_limited: 'Another save is waiting. Try again in a moment.', too_large: 'The file is too large to save.' }[code] || 'Saving isn’t available in this view.');
  }
}
// drag files from your computer onto the desktop or a Files window
addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
addEventListener('drop', e => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault();
  if (SYSTEM.state !== 'desktop') return;
  const w = e.target.closest && e.target.closest('.win'), win = w && WM.wins.find(x => x.el === w);
  importFiles(e.dataTransfer.files, win && win.app === 'files' && win.cwd ? win.cwd() : HOME + '/Desktop');
});
function nodeURL(n) { return n.blob ? BLOBS.get(n.blob).then(b => b ? URL.createObjectURL(b) : null) : Promise.resolve(null); }
function drawImageWall(canvas, id) {
  BLOBS.get(id).then(b => {
    if (!b) return; const u = URL.createObjectURL(b), img = new Image();
    img.onload = () => {
      const g = canvas.getContext('2d'), s = Math.max(canvas.width / img.width, canvas.height / img.height);
      g.drawImage(img, (canvas.width - img.width * s) / 2, (canvas.height - img.height * s) / 2, img.width * s, img.height * s); URL.revokeObjectURL(u);
      const lb = $('#lockbg'); if (lb && wallCanvas === canvas) lb.getContext('2d').drawImage(canvas, 0, 0, lb.width, lb.height);
    };
    img.src = u;
  });
}

/* ================= sounds (Web Audio) ================= */
let AC = null;
function playSound(kind) {
  kind = kind || CFG.alert || 'click';
  if (!CFG.volume || CFG.sounds === false) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { return; }
  const t = AC.currentTime, v = CFG.volume / 100 * 0.22;
  const tone = (f, start, dur, type = 'sine') => {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + start);
    g.gain.setValueAtTime(0.0001, t + start); g.gain.linearRampToValueAtTime(v, t + start + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
    o.connect(g); g.connect(AC.destination); o.start(t + start); o.stop(t + start + dur + 0.05);
  };
  ({
    click: () => tone(1700, 0, 0.06, 'triangle'), string: () => { tone(660, 0, 0.55, 'triangle'); tone(990, 0, 0.35); },
    swing: () => { tone(523, 0, 0.2); tone(784, 0.12, 0.35); }, hum: () => tone(150, 0, 0.5, 'sawtooth'),
    pop: () => tone(880, 0, 0.09), shutter: () => { tone(2600, 0, 0.03, 'square'); tone(1300, 0.06, 0.06, 'square'); },
    login: () => { tone(392, 0, 0.45); tone(523, 0.16, 0.45); tone(659, 0.32, 0.7); }
  }[kind] || (() => { }))();
}

/* ================= screenshots (html2canvas) ================= */
async function takeScreenshot() {
  closePops(); closeMenu();
  try { if (!window.html2canvas) await loadScript('https://cdn.jsdelivr.net/npm/html2canvas-pro@2.4.4/dist/html2canvas-pro.min.js'); }
  catch (e) { return notify('settings', 'Screenshot failed', 'Could not load the screenshot tool. Are you offline?'); }
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  let canvas;
  try {
    canvas = await html2canvas($('#os'), {
      backgroundColor: '#000', scale: Math.min(devicePixelRatio || 1, 2), logging: false,
      ignoreElements: n => ['toasts', 'dim', 'warm', 'modal'].includes(n.id),
      onclone: doc => doc.querySelectorAll('[style*="var(--accent)"]').forEach(x => x.setAttribute('style', x.getAttribute('style').replace(/var\(--accent\)/g, accent)))
    });
  } catch (e) { return notify('settings', 'Screenshot failed', String(e.message || e)); }
  const fl = el('<div style="position:absolute;inset:0;background:#fff;z-index:9990;pointer-events:none;transition:opacity .5s"></div>'); $('#os').append(fl);
  requestAnimationFrame(() => { fl.style.opacity = 0; }); setTimeout(() => fl.remove(), 600); playSound('shutter');
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const d = new Date(), name = `Screenshot From ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.png`;
  const dir = HOME + '/Pictures/Screenshots'; if (!getNode(dir)) fsMkdir(dir, { parents: true });
  const id = newBlobId(); await BLOBS.put(id, blob);
  getNode(dir).children[name] = { type: 'file', content: '', blob: id, size: blob.size, mime: 'image/png', mtime: Date.now() }; fsChanged();
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); } catch (e) { }
  notify('viewer', 'Screenshot captured', name, { actionLabel: 'Open', action: () => launch('viewer', dir + '/' + name) });
  return dir + '/' + name;
}
CMDS.screenshot = async c => { const p = await takeScreenshot(); if (p) c.out(`Saved ${tilde(p)}`); };
CMDS['dusk-screenshot'] = CMDS.screenshot;
CMDS.date = (c, a) => {
  const d = a.includes('-u') ? new Date(Date.now() + new Date().getTimezoneOffset() * 60000) : new Date(), f = a.find(x => x.startsWith('+'));
  if (!f) return c.out(dateStr(d));
  const h12 = d.getHours() % 12 || 12, doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  const M = { Y: d.getFullYear(), y: pad(d.getFullYear() % 100), m: pad(d.getMonth() + 1), d: pad(d.getDate()), e: String(d.getDate()).padStart(2), H: pad(d.getHours()), I: pad(h12), M: pad(d.getMinutes()), S: pad(d.getSeconds()), p: d.getHours() < 12 ? 'AM' : 'PM', A: WDAYS[d.getDay()], a: WD[d.getDay()], B: MONTHS[d.getMonth()], b: MON[d.getMonth()], h: MON[d.getMonth()], j: String(doy).padStart(3, '0'), s: Math.floor(d / 1000), u: d.getDay() || 7, w: d.getDay(), n: '\n', t: '\t', '%': '%' };
  M.T = `${M.H}:${M.M}:${M.S}`; M.D = `${M.m}/${M.d}/${M.y}`; M.F = `${M.Y}-${M.m}-${M.d}`; M.R = `${M.H}:${M.M}`; M.Z = dateStr(d).split(' ').slice(-2, -1)[0];
  c.out(f.slice(1).replace(/%([A-Za-z%])/g, (m, k) => M[k] != null ? M[k] : m));
};

/* ================= Media Player ================= */
AI.player = () => `<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="44" rx="9" fill="#2c2433"/><circle cx="32" cy="32" r="14" fill="#e08a4f"/><path d="M28 25l11 7-11 7z" fill="#fff"/></svg>`;
APPS.player = { name: 'Media Player', proc: 'celluloid', kw: 'music video audio play movie song', launch: p => PlayerApp(p) };
const MEDIA_EXT = { mp3: 'audio', ogg: 'audio', oga: 'audio', wav: 'audio', flac: 'audio', m4a: 'audio', aac: 'audio', opus: 'audio', mp4: 'video', webm: 'video', mov: 'video', mkv: 'video', m4v: 'video', ogv: 'video' };
Object.entries(MEDIA_EXT).forEach(([e, k]) => { EXT[e] = k; });
function PlayerApp(path) {
  const win = openWin({ app: 'player', w: 760, h: 480, minW: 340, minH: 220, mem: 120 });
  const n = path && getNode(path), kind = path ? (MEDIA_EXT[extOf(path)] || 'audio') : 'audio';
  win.setTitle(path ? splitPath(path)[1] : 'Media Player');
  win.hr.append(hbtn('folderNew', 'Open a file from your computer', () => pickFiles(HOME + (kind === 'video' ? '/Videos' : '/Music'), 'audio/*,video/*')));
  win.body.innerHTML = `<div class="mp">${kind === 'audio' ? `<div class="mp-art">${fileSVG('audio')}<b></b></div>` : ''}<${kind} controls playsinline></${kind}><p class="mp-msg"></p></div>`;
  const m = $(kind, win.body), msg = $('.mp-msg', win.body);
  if (kind === 'audio') $('.mp-art b', win.body).textContent = path ? splitPath(path)[1].replace(/\.[^.]+$/, '') : 'No file open';
  const vol = () => { m.volume = clamp(CFG.volume / 100, 0, 1); };
  vol(); document.addEventListener('cfg', vol);
  let url = null;
  if (!n) msg.textContent = 'Open an audio or video file from Files, or import one with the button in the header bar.';
  else if (!n.blob) msg.textContent = n.size != null ? 'This file is part of the simulation and has no real contents.' : 'This file has no media data.';
  else nodeURL(n).then(u => { if (!u) { msg.textContent = 'The file’s contents are no longer stored in this browser.'; return; } url = u; m.src = u; m.play().catch(() => { }); });
  m.addEventListener('error', () => { msg.textContent = 'Your browser can’t play this format.'; });
  m.addEventListener('play', () => { win.busy = true; }); m.addEventListener('pause', () => { win.busy = false; });
  win.onClose = () => { m.pause(); document.removeEventListener('cfg', vol); if (url) URL.revokeObjectURL(url); };
  win.frame.addEventListener('keydown', e => { if (e.key === ' ' && e.target === win.frame) { e.preventDefault(); m.paused ? m.play() : m.pause(); } });
  return win;
}

/* ================= starter projects for the real interpreters ================= */
function addExamples() {
  if (CFG.examples2) return;
  const dir = HOME + '/Documents/projects'; if (!getNode(dir)) { try { fsMkdir(dir, { parents: true }); } catch (e) { return; } }
  const add = (name, content, exec = true) => { if (!getNode(dir + '/' + name)) getNode(dir).children[name] = { type: 'file', content, exec, mtime: Date.now() }; };
  add('fizzbuzz.sh', '#!/usr/bin/env bash\n# FizzBuzz in bash: a for loop, arithmetic and if/elif.\nfor i in $(seq 1 15); do\n  if (( i % 15 == 0 )); then echo FizzBuzz\n  elif (( i % 3 == 0 )); then echo Fizz\n  elif (( i % 5 == 0 )); then echo Buzz\n  else echo $i\n  fi\ndone\n');
  add('greet.sh', '#!/usr/bin/env bash\n# Functions, read and default values.\ngreet() {\n  echo "Hello, $1! It is $(date +%H:%M) on $(date +%A)."\n}\nread -p "What is your name? " name\ngreet "${name:-stranger}"\n');
  add('primes.py', '#!/usr/bin/env python3\n"""Print the first N primes and save them to primes.txt.\nUsage: ./primes.py 25"""\nimport math, sys\n\nn = int(sys.argv[1]) if len(sys.argv) > 1 else 20\nprimes = []\nk = 2\nwhile len(primes) < n:\n    if all(k % p for p in primes if p <= int(math.sqrt(k))):\n        primes.append(k)\n    k += 1\nprint(", ".join(map(str, primes)))\nwith open("primes.txt", "w") as f:\n    f.write("\\n".join(map(str, primes)) + "\\n")\nprint("Saved", len(primes), "primes to primes.txt")\n');
  add('hello.js', "#!/usr/bin/env node\n// Runs on your browser's JavaScript engine.\nconst name = process.argv[2] || 'night';\nconsole.log(`Hello, ${name}!`);\nconsole.log([1, 2, 3, 4].map(n => n ** 2));\n");
  add('README.md', '# projects\n\nThese run for real in the Terminal:\n\n    cd ~/Documents/projects\n    ./fizzbuzz.sh\n    ./greet.sh\n    ./primes.py 25\n    ./hello.js you\n\nOr start an interactive shell with `python3` or `node`.\n', false);
  CFG.examples2 = true; saveCfg(); fsChanged();
}
addExamples(); setTimeout(collectBlobs, 4000);
