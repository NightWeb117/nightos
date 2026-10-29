'use strict';
/* ================= Extras: theme gallery, music visualizer, clipboard history, screen recorder ================= */

/* ---------- Theme gallery (App Center › Themes) ----------
   Themes live in site/store/themes as the same .json files Settings exports, listed in themes.json. */
const GALLERY = { list: [], loaded: false, error: null };
const THEME_SUBMIT_URL = 'https://github.com/NightWeb117/nightos/issues/new?template=theme-submission.yml';
async function loadGallery() {
  try {
    const r = await fetch('store/themes.json?v=' + Date.now()); if (!r.ok) throw new Error('HTTP ' + r.status);
    GALLERY.list = (await r.json()).themes || []; GALLERY.loaded = true; GALLERY.error = null;
  } catch (e) { GALLERY.error = e.message || String(e); }
}
const galleryInstalled = id => myThemes().find(t => t.galleryId === id);
async function installGalleryTheme(g) {
  const r = await fetch(new URL('store/' + g.file, location.href).href + '?v=' + Date.now()); if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await importTheme(await r.text()); t.galleryId = g.id; t.note = `From the gallery · by ${g.author || 'someone'}`; saveCfg(); return t;
}
function renderThemeGallery(box, win, rerender) {
  win.setTitle('Themes');
  if (!GALLERY.loaded) {
    box.innerHTML = GALLERY.error ? `<div class="ap-empty">${sym('globe')}<b>Couldn't load the theme gallery</b><p>${esc(GALLERY.error)}. Check your connection and try again.</p><button class="hbtn sug" data-gal-retry>Try Again</button></div>` : '<div class="ap-empty"><span class="spinner" style="border-color:var(--press);border-top-color:var(--accent)"></span><p>Loading themes…</p></div>';
    const rt = $('[data-gal-retry]', box); if (rt) rt.onclick = () => { GALLERY.error = null; rerender(); };
    if (!GALLERY.error) loadGallery().then(rerender);
    return;
  }
  const card = g => { const mine = galleryInstalled(g.id), on = mine && CFG.theme === mine.id;
    return `<div class="th-card ${on ? 'on' : ''}"><div class="th-pv" style="background:url(${g.preview ? 'store/' + esc(g.preview) : wallThumb(WALLS[g.wall] ? g.wall : 'ink', 280, 170)}) center/cover"><i class="th-win" style="background:#1f2027;border-radius:5px"><b style="background:${safeColor(g.accent)}"></b></i>${g.animated ? '<em class="th-badge">Animated</em>' : ''}</div>
      <span><b>${esc(g.name)}</b><small>by ${esc(g.author || 'Unknown')} · ${esc(g.summary || '')}</small></span>
      <div style="display:flex;gap:6px;padding:0 4px 4px">${on ? '<button class="hbtn" disabled>In Use</button>' : mine ? `<button class="hbtn sug" data-gal-apply="${esc(g.id)}">Use</button>` : `<button class="hbtn sug" data-gal-get="${esc(g.id)}">Get</button>`}</div></div>`; };
  box.innerHTML = `<div class="ap-page"><h3 class="ap-h">Themes made by the NightOS community</h3>
    <div class="th-grid">${GALLERY.list.map(card).join('')}</div>
    <h3 class="ap-h">Share your theme</h3>
    <div class="grp" style="padding:16px 18px;display:flex;flex-direction:column;gap:10px;line-height:1.5">
      <p style="margin:0">Make a theme in Settings › Create Theme, export it, and send the .json file. It's reviewed, then shows up here for everyone.</p>
      <ul style="margin:0;padding-left:20px;color:var(--fg-dim)"><li>You need a free GitHub account.</li><li>Only share pictures and videos you made or have permission to share.</li></ul>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="hbtn" data-gal-export style="background:var(--press)">Export My Theme</button><a class="hbtn sug" href="${THEME_SUBMIT_URL}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">Open the Submission Form ${sym('open')}</a></div>
    </div></div>`;
  box.querySelectorAll('[data-gal-get]').forEach(b => b.onclick = async () => {
    const g = GALLERY.list.find(x => x.id === b.dataset.galGet); b.disabled = true; b.textContent = 'Getting…';
    try { const t = await installGalleryTheme(g); notify('store', `${t.name} is on`, 'It\'s saved in Settings › Global Theme › Your themes.'); } catch (e) { notify('store', 'Couldn\'t get the theme', e.message); }
    rerender();
  });
  box.querySelectorAll('[data-gal-apply]').forEach(b => b.onclick = () => { applyPreset(galleryInstalled(b.dataset.galApply).id); rerender(); });
  $('[data-gal-export]', box).onclick = () => launch('settings', 'theme');
}

/* ---------- Media Player with a visualizer, a playlist from the folder and a dancing wallpaper ---------- */
const VIZ = ['bars', 'wave', 'ring'];
const MP = { an: null };
PlayerApp = function (path) {
  const win = openWin({ app: 'player', w: 760, h: 500, minW: 340, minH: 260, mem: 120 });
  let cur = path, url = null, raf = 0, src = null, an = null, data = null;
  const kindOf = p => p ? (MEDIA_EXT[extOf(p)] || 'audio') : 'audio';
  const list = () => { if (!cur) return []; const d = splitPath(cur)[0], dn = getNode(d); return dn ? Object.keys(dn.children).filter(k => MEDIA_EXT[extOf(k)] === 'audio' && dn.children[k].blob).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(k => d + '/' + k) : []; };
  const step = dir => { const l = list(), i = l.indexOf(cur); if (l.length > 1) play(l[(i + dir + l.length) % l.length]); };
  const prevB = hbtn('<svg class="sym" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>', 'Previous', () => step(-1));
  const nextB = hbtn('<svg class="sym" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>', 'Next', () => step(1));
  const vizB = hbtn('<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 18v-4M9 18V8M14 18v-7M19 18V5"/></svg>', 'Change the visualizer', () => { CFG.mpViz = VIZ[(VIZ.indexOf(CFG.mpViz || 'bars') + 1) % VIZ.length]; saveCfg(); });
  const danceB = hbtn('<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 13l3-3 2 2 3-4 2 2"/></svg>', 'Wallpaper dances to the music', () => { CFG.wallDance = !CFG.wallDance; saveCfg(); danceB.classList.toggle('on', !!CFG.wallDance); setDance(!m.paused); notify('player', CFG.wallDance ? 'The wallpaper dances to your music' : 'Wallpaper dancing is off'); });
  danceB.classList.toggle('on', !!CFG.wallDance);
  win.hl.append(prevB, nextB);
  win.hr.append(vizB, danceB, hbtn('folderNew', 'Open music or videos from your computer', openFromPC));
  win.body.innerHTML = `<div class="mp mp2"><canvas class="mp-viz"></canvas><div class="mp-art"><b></b><small></small></div><video playsinline hidden></video><audio hidden></audio><div class="mp-ctl"></div><p class="mp-msg"></p></div>`;
  const cv = $('.mp-viz', win.body), g = cv.getContext('2d'), msg = $('.mp-msg', win.body), video = $('video', win.body), audio = $('audio', win.body), ctl = $('.mp-ctl', win.body);
  let m = audio;
  const vol = () => { audio.volume = video.volume = clamp(CFG.volume / 100, 0, 1); };
  vol(); document.addEventListener('cfg', vol);
  function setDance(on) { const want = !!(on && CFG.wallDance && m === audio); if (WFX.music !== want) { WFX.music = want; WFX.level = 0; startWallAnim(); } }
  async function openFromPC() {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = 'audio/*,video/*';
    i.onchange = async () => {
      const fl = [...i.files]; if (!fl.length) return; const dir = HOME + (fl[0].type.startsWith('video') ? '/Videos' : '/Music');
      if (!getNode(dir)) fsMkdir(dir, { parents: true }); const before = new Set(Object.keys(getNode(dir).children));
      await importFiles(fl, dir); const added = Object.keys(getNode(dir).children).filter(k => !before.has(k) && getNode(dir + '/' + k).blob);
      if (added.length) play(dir + '/' + added[0]);
    };
    i.click();
  }
  function draw() {
    raf = requestAnimationFrame(draw);
    const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    if (cv.width !== W * devicePixelRatio) { cv.width = W * devicePixelRatio; cv.height = H * devicePixelRatio; }
    const s = devicePixelRatio, w = cv.width, h = cv.height, acc = accentHex(); g.clearRect(0, 0, w, h);
    if (!an) return; an.getByteFrequencyData(data);
    let low = 0; for (let i = 0; i < 12; i++) low += data[i]; low /= 12 * 255; if (WFX.music) WFX.level = low;
    const style = CFG.mpViz || 'bars';
    g.fillStyle = acc; g.strokeStyle = acc; g.shadowColor = acc; g.shadowBlur = 14 * s;
    if (style === 'bars') {
      const n = 48, bw = w / n; for (let i = 0; i < n; i++) { const v = data[Math.floor(i * data.length * .7 / n)] / 255, bh = Math.max(2 * s, v * h * .85); g.globalAlpha = .45 + v * .55; g.fillRect(i * bw + bw * .15, h - bh, bw * .7, bh); }
    } else if (style === 'wave') {
      const td = new Uint8Array(an.fftSize); an.getByteTimeDomainData(td); g.lineWidth = 3 * s; g.beginPath();
      for (let i = 0; i < td.length; i++) { const x = i / (td.length - 1) * w, y = h / 2 + (td[i] - 128) / 128 * h * .42; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    } else {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * (.2 + low * .08), n = 90; g.lineWidth = 3 * s; g.lineCap = 'round';
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, v = data[Math.floor(i * data.length * .6 / n)] / 255, L = R + v * Math.min(w, h) * .26; g.globalAlpha = .4 + v * .6; g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.stroke(); }
    }
    g.globalAlpha = 1; g.shadowBlur = 0;
  }
  function hookAudio() {
    if (an) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
      src = AC.createMediaElementSource(audio); an = AC.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = .8; data = new Uint8Array(an.frequencyBinCount);
      src.connect(an); an.connect(AC.destination);
    } catch (e) { an = null; }
  }
  function play(p) {
    cur = p; const n = p && getNode(p), kind = kindOf(p);
    m.pause(); if (url) { URL.revokeObjectURL(url); url = null; }
    m = kind === 'video' ? video : audio; video.hidden = kind !== 'video'; cv.hidden = kind === 'video'; $('.mp-art', win.body).hidden = kind === 'video';
    ctl.innerHTML = ''; ctl.append(m); m.hidden = false; m.controls = true;
    win.setTitle(p ? splitPath(p)[1] : 'Media Player', p && kind === 'audio' && list().length > 1 ? `${list().indexOf(p) + 1} of ${list().length} in ${splitPath(splitPath(p)[0])[1]}` : '');
    $('.mp-art b', win.body).textContent = p ? splitPath(p)[1].replace(/\.[^.]+$/, '') : 'No music playing'; $('.mp-art small', win.body).textContent = p ? '' : 'Open a song from Files, or add some from your computer';
    prevB.disabled = nextB.disabled = list().length < 2;
    msg.textContent = '';
    if (!n) return;
    if (!n.blob) { msg.textContent = n.size != null ? 'This file is part of the simulation and has no real contents.' : 'This file has no media data.'; return; }
    nodeURL(n).then(u => { if (!u) { msg.textContent = 'The file’s contents are no longer stored in this browser.'; return; } url = u; m.src = u; if (kind === 'audio') hookAudio(); m.play().catch(() => { }); });
  }
  for (const el2 of [audio, video]) {
    el2.addEventListener('error', () => { if (el2.src) msg.textContent = 'Your browser can’t play this format.'; });
    el2.addEventListener('play', () => { win.busy = true; setDance(true); });
    el2.addEventListener('pause', () => { win.busy = false; setDance(false); });
    el2.addEventListener('ended', () => { if (el2 === audio && list().length > 1) step(1); });
  }
  draw();
  win.onClose = () => { cancelAnimationFrame(raf); audio.pause(); video.pause(); setDance(false); document.removeEventListener('cfg', vol); if (url) URL.revokeObjectURL(url); try { src && src.disconnect(); an && an.disconnect(); } catch (e) { } };
  win.frame.addEventListener('keydown', e => { if (e.key === ' ' && e.target === win.frame) { e.preventDefault(); m.paused ? m.play() : m.pause(); } });
  play(path);
  return win;
};

/* ---------- Clipboard history: Ctrl+Alt+V (or Super+V) ---------- */
CFG.clips = CFG.clips || [];
function addClip(text) {
  text = String(text || ''); if (!text.trim() || text.length > 20000 || CFG.clipOn === false) return;
  const old = CFG.clips.find(c => c.t === text); CFG.clips = CFG.clips.filter(c => c !== old);
  CFG.clips.unshift({ t: text, time: Date.now(), pin: !!(old && old.pin) });
  const pins = CFG.clips.filter(c => c.pin), rest = CFG.clips.filter(c => !c.pin).slice(0, 30);
  CFG.clips = CFG.clips.filter(c => pins.includes(c) || rest.includes(c)); saveCfg();
}
const selectedText = () => { const a = document.activeElement; if (a && a.type === 'password') return ''; if (a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && a.selectionStart != null) return a.value.slice(a.selectionStart, a.selectionEnd); return String(getSelection() || ''); };
['copy', 'cut'].forEach(ev => document.addEventListener(ev, () => { const t = selectedText(); setTimeout(() => addClip(t)); }, true));
if (navigator.clipboard && navigator.clipboard.writeText) { const ow = navigator.clipboard.writeText.bind(navigator.clipboard); try { navigator.clipboard.writeText = t => { addClip(t); return ow(t); }; } catch (e) { } }
AI.clipboard = () => `<svg viewBox="0 0 64 64"><rect x="12" y="10" width="40" height="48" rx="7" fill="#3a3f55"/><rect x="22" y="6" width="20" height="10" rx="4" fill="#9aa9c3"/><rect x="20" y="26" width="24" height="4" rx="2" fill="#cfd8ea"/><rect x="20" y="35" width="18" height="4" rx="2" fill="#cfd8ea"/><rect x="20" y="44" width="21" height="4" rx="2" fill="#cfd8ea"/></svg>`;
APPS.clipboard = { name: 'Clipboard', proc: 'clipboard', kw: 'copy paste history clipboard', launch: () => { openClips(); return null; } };
APP_CAT.clipboard = 'Utilities'; GRID_APPS.push('clipboard');
CMDS.clipboard = () => openClips(); DESC.clipboard = 'show clipboard history';
let clipTarget = null;
function closeClips() { const c = $('#cliphist'); if (c) c.remove(); }
function openClips() {
  if ($('#cliphist')) return closeClips();
  const a = document.activeElement; clipTarget = a && (/^(TEXTAREA|INPUT)$/.test(a.tagName) && a.type !== 'password' || a.isContentEditable) ? a : null;
  const c = el(`<div id="cliphist" role="dialog" aria-label="Clipboard history"><div class="ch-hd"><b>Clipboard</b><span style="flex:1"></span><button class="hbtn" data-ch-clear>Clear All</button><button class="hbtn" data-ch-close aria-label="Close">${sym('close')}</button></div><div class="ch-list" role="listbox"></div><div class="ch-ft"></div></div>`);
  $('#os').append(c); let sel = 0;
  const draw = () => {
    const L = CFG.clips;
    $('.ch-list', c).innerHTML = CFG.clipOn === false ? '<p class="ch-empty">Clipboard history is off.</p>' : L.length ? L.map((x, i) => `<div class="ch-it ${i === sel ? 'sel' : ''}" data-i="${i}" role="option"><span>${esc(x.t.length > 260 ? x.t.slice(0, 260) + '…' : x.t)}</span><button class="hbtn ${x.pin ? 'on' : ''}" data-pin="${i}" title="${x.pin ? 'Unpin' : 'Pin'}" aria-label="${x.pin ? 'Unpin' : 'Pin'}">${sym('star')}</button><button class="hbtn" data-del="${i}" aria-label="Delete">${sym('close')}</button></div>`).join('') : '<p class="ch-empty">Things you copy in NightOS show up here.</p>';
    $('.ch-ft', c).innerHTML = `<span>Ctrl+Alt+V opens this list</span><button class="sw ${CFG.clipOn === false ? '' : 'on'}" data-ch-on role="switch" aria-label="Keep clipboard history"></button>`;
    const s = $('.ch-it.sel', c); if (s) s.scrollIntoView({ block: 'nearest' });
  };
  const pick = i => {
    const x = CFG.clips[i]; if (!x) return; closeClips();
    navigator.clipboard && navigator.clipboard.writeText(x.t).catch(() => { });
    const t = clipTarget; if (!t || !t.isConnected) return notify('clipboard', 'Copied', 'Paste it with Ctrl+V.');
    t.focus();
    if (t.isContentEditable) document.execCommand('insertText', false, x.t);
    else { const s0 = t.selectionStart ?? t.value.length, s1 = t.selectionEnd ?? s0; t.setRangeText(x.t, s0, s1, 'end'); t.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  c.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-ch-close]')) return closeClips();
    if (t.closest('[data-ch-clear]')) { CFG.clips = CFG.clips.filter(x => x.pin); saveCfg(); sel = 0; return draw(); }
    if (t.closest('[data-ch-on]')) { CFG.clipOn = CFG.clipOn === false; saveCfg(); return draw(); }
    const p = t.closest('[data-pin]'); if (p) { const x = CFG.clips[+p.dataset.pin]; x.pin = !x.pin; saveCfg(); return draw(); }
    const d = t.closest('[data-del]'); if (d) { CFG.clips.splice(+d.dataset.del, 1); saveCfg(); return draw(); }
    const it = t.closest('[data-i]'); if (it) pick(+it.dataset.i);
  });
  c.tabIndex = -1; c.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeClips(); if (clipTarget) clipTarget.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(CFG.clips.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
  });
  draw(); c.focus();
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!c.contains(e.target)) { closeClips(); document.removeEventListener('pointerdown', off, true); } }, true));
}
document.addEventListener('keydown', e => {
  if (SYSTEM.state !== 'desktop') return;
  if (e.code === 'KeyV' && ((e.ctrlKey && e.altKey && !e.shiftKey) || e.metaKey)) { e.preventDefault(); openClips(); }
});

/* ---------- Screen Recorder ---------- */
AI.recorder = () => `<svg viewBox="0 0 64 64"><rect x="6" y="12" width="52" height="38" rx="8" fill="#2b2f3d"/><circle cx="32" cy="31" r="11" fill="#ef4b5c"/><circle cx="32" cy="31" r="5" fill="#ffd0d5"/><rect x="22" y="52" width="20" height="4" rx="2" fill="#2b2f3d"/></svg>`;
APPS.recorder = { name: 'Screen Recorder', proc: 'recorder', kw: 'record capture screen video screencast', single: true, launch: () => RecorderApp() };
APP_CAT.recorder = 'Multimedia'; GRID_APPS.push('recorder');
const REC = { mr: null, streams: [], t0: 0, timer: 0, chunks: [] };
const recFmt = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
function recPill(on) {
  let p = $('#recpill');
  if (!on) { if (p) p.remove(); clearInterval(REC.timer); return; }
  if (!p) { p = el(`<button id="recpill" aria-label="Stop recording"><i></i><span>0:00</span><b>Stop</b></button>`); p.onclick = stopRecording; $('#os').append(p); }
  clearInterval(REC.timer); REC.timer = setInterval(() => { $('span', p).textContent = recFmt((Date.now() - REC.t0) / 1000); }, 500);
}
async function startRecording({ sound = true, mic = false, countdown = true, target = 'nightos' } = {}) {
  if (REC.mr) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) return notify('recorder', 'Recording isn\'t available here', 'This browser can\'t record the screen.');
  if (NATIVE && NATIVE.setCaptureTarget) await NATIVE.setCaptureTarget(target);
  let disp, micS = null;
  try { disp = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: sound }); }
  catch (e) { return notify('recorder', 'Recording didn\'t start', e.name === 'NotAllowedError' ? 'Nothing was chosen to record.' : e.message); }
  if (mic) try { micS = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { notify('recorder', 'Recording without the microphone', 'NightOS wasn\'t allowed to use it.'); }
  const tracks = [...disp.getVideoTracks()], auds = [...disp.getAudioTracks(), ...(micS ? micS.getAudioTracks() : [])];
  if (auds.length > 1) { AC = AC || new AudioContext(); const dest = AC.createMediaStreamDestination(); [disp, micS].forEach(s => s.getAudioTracks().length && AC.createMediaStreamSource(s).connect(dest)); tracks.push(...dest.stream.getAudioTracks()); }
  else tracks.push(...auds);
  REC.streams = [disp, micS].filter(Boolean);
  if (countdown) for (let i = 3; i > 0; i--) { osd(String(i)); await new Promise(r => setTimeout(r, 900)); }
  const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const mr = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type, videoBitsPerSecond: 6e6 } : {});
  REC.mr = mr; REC.chunks = []; REC.t0 = Date.now();
  mr.ondataavailable = e => { if (e.data.size) REC.chunks.push(e.data); };
  mr.onstop = saveRecording;
  disp.getVideoTracks()[0].addEventListener('ended', stopRecording);
  mr.start(1000); recPill(true); updateRecWin();
}
function stopRecording() { if (REC.mr && REC.mr.state !== 'inactive') REC.mr.stop(); REC.streams.forEach(s => s.getTracks().forEach(t => t.stop())); recPill(false); }
async function saveRecording() {
  const blob = new Blob(REC.chunks, { type: 'video/webm' }); REC.mr = null; REC.chunks = []; updateRecWin();
  if (!blob.size) return notify('recorder', 'Nothing was recorded');
  const d = new Date(), dir = HOME + '/Videos', name = `Screen Recording ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.webm`;
  if (!getNode(dir)) fsMkdir(dir, { parents: true });
  const id = newBlobId(), ok = await BLOBS.put(id, blob);
  getNode(dir).children[name] = { type: 'file', content: '', blob: id, size: blob.size, mime: 'video/webm', mtime: Date.now() }; fsChanged();
  REC.last = dir + '/' + name; updateRecWin();
  notify('recorder', 'Recording saved', `${name} · ${humanSI(blob.size)}${ok ? '' : ' (this session only)'}`, { actionLabel: 'Watch', action: () => openPath(REC.last) });
}
let recWin = null;
function updateRecWin() { if (recWin && recWin.render) recWin.render(); }
function RecorderApp() {
  const win = recWin = openWin({ app: 'recorder', w: 440, h: 400, minW: 340, minH: 320, mem: 40 });
  const opt = CFG.rec = CFG.rec || { sound: true, mic: false, countdown: true, target: 'nightos' };
  win.render = () => {
    const on = !!REC.mr;
    win.body.innerHTML = `<div class="st-page" style="padding:16px;display:flex;flex-direction:column;gap:12px;overflow:auto">
      ${NATIVE && NATIVE.setCaptureTarget ? `<div class="grp">${ui.row('Record', '', `<div class="seg" style="flex:none">${[['nightos', 'NightOS'], ['screen', 'Whole screen']].map(([k, l]) => `<button type="button" class="${opt.target === k ? 'on' : ''}" data-rt="${k}" ${on ? 'disabled' : ''}>${l}</button>`).join('')}</div>`)}</div>` : '<p style="margin:0;color:var(--fg-dim);font-size:13px">Your browser asks what to record: a screen, a window or a tab.</p>'}
      <div class="grp">${[['sound', 'Record sound', 'Sound from the screen or tab'], ['mic', 'Record your microphone', ''], ['countdown', 'Count down from 3', '']].map(([k, t, s]) => ui.row(t, s, `<button class="sw ${opt[k] ? 'on' : ''}" data-ro="${k}" role="switch" aria-checked="${!!opt[k]}" aria-label="${t}" ${on ? 'disabled' : ''}></button>`)).join('')}</div>
      <div style="display:flex;gap:8px;align-items:center">${on ? `<button class="hbtn destr" data-stop style="height:40px;padding:0 18px">■ Stop Recording</button><span style="color:var(--fg-dim)" data-rtime>${recFmt((Date.now() - REC.t0) / 1000)}</span>` : `<button class="hbtn sug" data-start style="height:40px;padding:0 18px">● Start Recording</button>`}</div>
      ${REC.last && !on ? `<div class="grp">${ui.row('Last recording', esc(splitPath(REC.last)[1]), `<span style="display:flex;gap:6px"><button class="hbtn" data-watch style="background:var(--press)">Watch</button><button class="hbtn" data-dl style="background:var(--press)">Download</button></span>`)}</div>` : ''}
      <p style="margin:0;color:var(--fg-dim);font-size:12.5px">Recordings are saved in Videos as .webm files. Stop from here or the red button at the top of the screen.</p></div>`;
  };
  win.body.addEventListener('click', e => {
    const t = e.target, rt = t.closest('[data-rt]'), ro = t.closest('[data-ro]');
    if (rt) { opt.target = rt.dataset.rt; saveCfg(); return win.render(); }
    if (ro) { opt[ro.dataset.ro] = !opt[ro.dataset.ro]; saveCfg(); return win.render(); }
    if (t.closest('[data-start]')) { if (opt.target === 'nightos' || !NATIVE) minimizeWin(win); startRecording(opt); }
    if (t.closest('[data-stop]')) stopRecording();
    if (t.closest('[data-watch]')) openPath(REC.last);
    if (t.closest('[data-dl]')) exportFile(REC.last);
  });
  win.onClose = () => { recWin = null; };
  win.render();
  return win;
}
CMDS['screen-recorder'] = () => launch('recorder'); DESC['screen-recorder'] = 'record the screen';

/* ---------- Install NightOS as an app (website only) ---------- */
let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches;
if (!NATIVE && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
async function installNightOS() {
  if (standalone()) return notify('settings', 'NightOS is already installed', 'You\'re using the installed app.');
  if (!installEvt) return notify('settings', 'Install from your browser\'s menu', 'In Chrome or Edge, open the ⋮ menu and choose Install NightOS. On iPhone or iPad, use Share › Add to Home Screen.');
  installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null;
  if (r.outcome === 'accepted') notify('settings', 'NightOS is installed', 'Open it from your Start menu, desktop or app list. It works offline too.');
}
addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvt = e;
  if (CFG.pwaOffered) return;
  const offer = () => { if (SYSTEM.state !== 'desktop') return setTimeout(offer, 5000); CFG.pwaOffered = true; saveCfg(); notify('settings', 'Install NightOS as an app', 'It opens in its own window and works without internet.', { actionLabel: 'Install', action: installNightOS, ms: 12000 }); };
  setTimeout(offer, 20000);
});
CMDS['install-nightos'] = () => installNightOS(); DESC['install-nightos'] = 'install NightOS as an app';
