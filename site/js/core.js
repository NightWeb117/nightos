'use strict';
/* ================= utilities ================= */
const BAR = 32;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function el(h) { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; }
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = n => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('nightos:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nightos:' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('nightos:' + k); } catch (e) { } }
};
const isNarrow = () => innerWidth < 720;
const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
function humanSI(b) {
  if (b < 1000) return b + (b === 1 ? ' byte' : ' bytes');
  const u = ['kB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1000; i++; } while (b >= 1000 && i < u.length - 1);
  return b.toFixed(1) + ' ' + u[i];
}
function humanIEC(b) {
  if (b < 1024) return String(b);
  const u = ['K', 'M', 'G', 'T']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return (b < 10 ? b.toFixed(1) : Math.round(b)) + u[i];
}
function fmtFileDate(t) {
  const d = new Date(t), n = new Date();
  if (d.toDateString() === n.toDateString()) return hhmm(d);
  const y = new Date(n - 864e5);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  if (d.getFullYear() === n.getFullYear()) return MON[d.getMonth()] + ' ' + d.getDate();
  return MON[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear();
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ================= settings ================= */
const CFG = Object.assign({
  wall: 'umbra', accent: 'blue', style: 'dark', volume: 62, bright: 100, wifi: true, bt: true, night: false, nightTemp: 50,
  dnd: false, plane: false, power: 'balanced', net: 'Night-5G', upgraded: false, toured: false, files_view: 'grid', battery: 87
}, store.get('cfg', {}));
const saveCfg = () => store.set('cfg', CFG);
const ACCENTS = {
  blue: ['#78aeed', '#0d1a2b'], teal: ['#5ec7c1', '#06201e'], green: ['#6fd08c', '#082012'], yellow: ['#f2cc5b', '#2a2005'],
  orange: ['#f4a259', '#2b1503'], red: ['#f0756c', '#2c0806'], pink: ['#ef8fc4', '#2b0a1c'], purple: ['#b493f2', '#1a0f30'], slate: ['#9aa9c3', '#111622']
};
function applyLook() {
  const [a, f] = ACCENTS[CFG.accent] || ACCENTS.blue;
  document.documentElement.style.setProperty('--accent', a);
  document.documentElement.style.setProperty('--accent-fg', f);
  $('#os').classList.toggle('light', CFG.style === 'light');
  $('#dim').style.opacity = ((100 - CFG.bright) / 100 * 0.75).toFixed(3);
  $('#warm').style.opacity = CFG.night ? (0.12 + CFG.nightTemp / 100 * 0.3).toFixed(3) : 0;
}

/* ================= icons ================= */
const P = {
  min: '<path d="M7 12h10"/>', max: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  restore: '<rect x="5.5" y="8.5" width="10" height="10" rx="1.5"/><path d="M8.5 5.5h8.5a1.5 1.5 0 0 1 1.5 1.5v8.5"/>',
  close: '<path d="M7 7l10 10M17 7L7 17"/>', back: '<path d="M15 5l-7 7 7 7"/>', fwd: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  reload: '<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4.5v4h-4"/>', menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  dots: '<circle cx="12" cy="6" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="18" r="1.2" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>', desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  pic: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  drive: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13l2-8h10l2 8M7 16.5h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>',
  wifioff: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" opacity=".35"/><path d="M4 4l16 16"/>',
  bt: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
  vol: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  vollow: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 10l4 4M21 10l-4 4"/>',
  power: '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.9 4.9L7 7M17 17l2.1 2.1M2.5 12h3M18.5 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  plane: '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  belloff: '<path d="M6 16v-5a6 6 0 0 1 9.5-4.9M18 11v5l2 2H8"/><path d="M10 20.5a2 2 0 0 0 4 0M4 4l16 16"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>', logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M9 12h10"/>',
  suspend: '<path d="M9 5v14M15 5v14"/>', cl: '<path d="M15 6l-6 6 6 6"/>', cr: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', folderNew: '<path d="M3 6h6l2 2h10v11H3z"/><path d="M12 11v5M9.5 13.5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', display: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7.5" r="1" fill="currentColor"/>',
  battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M21.5 10.5v3"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>', ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'
};
function sym(n, cls = '') { return `<svg class="sym ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`; }
function batterySym(lvl, charging = !!(REAL.battery && REAL.battery.charging)) {
  return `<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${P.battery}<rect x="5" y="9.5" width="${(12 * lvl / 100).toFixed(1)}" height="5" rx="1" fill="currentColor" stroke="none"/>${charging ? '<path d="M12 5.5l-3 7h3l-1 6 4-8h-3l1-5z" fill="currentColor" stroke="#000" stroke-width="1"/>' : ''}</svg>`;
}
const LOGO_PATH = 'M40 8A24 24 0 1 0 56 49.7A26 26 0 0 1 40 8z';
const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${LOGO_PATH}" fill="currentColor"/><path d="M50 13l1.5 3.4 3.7.4-2.8 2.5.8 3.6-3.2-1.9-3.2 1.9.8-3.6-2.8-2.5 3.7-.4z" fill="currentColor"/></svg>`;
function folderSVG(glyph) {
  const back = 'M6 15a4 4 0 0 1 4-4h14.5a4 4 0 0 1 3 1.3L31 16h23a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z';
  const front = 'M6 24a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z';
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${back}" style="fill:var(--accent)"/><path d="${back}" fill="rgba(0,0,0,.3)"/><path d="${front}" style="fill:var(--accent)"/><path d="M6 24a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v1H6z" fill="rgba(255,255,255,.25)"/>${glyph ? `<g transform="translate(22 26.5) scale(.84)" fill="none" stroke="rgba(0,0,0,.38)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${P[glyph]}</g>` : ''}</svg>`;
}
const AI = {
  files: () => folderSVG(null),
  terminal: () => `<svg viewBox="0 0 64 64"><rect x="6" y="8" width="52" height="48" rx="10" fill="#4a4c57"/><rect x="8.5" y="10.5" width="47" height="43" rx="8" fill="#1b1c22"/><path d="M17 25l8 7-8 7" fill="none" stroke="#e9eaf0" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 41h13" stroke="#e9eaf0" stroke-width="3.6" stroke-linecap="round"/></svg>`,
  browser: () => `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#18245a"/><circle cx="32" cy="32" r="23.5" fill="none" stroke="#f59e4b" stroke-width="5" stroke-linecap="round" stroke-dasharray="104 44" transform="rotate(-65 32 32)"/><g transform="translate(13.5 13) scale(.58)"><path d="${LOGO_PATH}" fill="#ffd98a"/></g><circle cx="40" cy="24" r="1.6" fill="#fff"/><circle cx="44" cy="33" r="1" fill="#fff"/></svg>`,
  editor: () => `<svg viewBox="0 0 64 64"><rect x="10" y="6" width="40" height="52" rx="6" fill="#eef0f5"/><path d="M10 12a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v3H10z" fill="#c4c8d6"/><g stroke="#9aa0b4" stroke-width="3" stroke-linecap="round"><path d="M18 24h24M18 32h24M18 40h14"/></g><path d="M51 25l6 6-19 19-8.5 2.5L32 44z" fill="#f4a259"/><path d="M51 25l6 6-3.2 3.2-6-6z" fill="#e05d5d"/><path d="M32 44l6 6-8.5 2.5z" fill="#3a3c46"/></svg>`,
  monitor: () => `<svg viewBox="0 0 64 64"><rect x="6" y="9" width="52" height="40" rx="8" fill="#22302a"/><path d="M6 37h52" stroke="#2f4038" stroke-width="1.5"/><path d="M12 38l8-6 6 4 8-15 6 9 6-6 6 4" fill="none" stroke="#6fd08c" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="22" y="51" width="20" height="5" rx="2.5" fill="#556059"/></svg>`,
  calc: () => `<svg viewBox="0 0 64 64"><rect x="12" y="6" width="40" height="52" rx="8" fill="#454852"/><rect x="17" y="11" width="30" height="11" rx="3" fill="#a9e5c8"/>${[0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${17 + c * 11}" y="${27 + r * 10}" width="8" height="7" rx="2" fill="${r === 2 && c === 2 ? '#f4a259' : '#6f7380'}"/>`).join('')).join('')}</svg>`,
  settings: () => `<svg viewBox="0 0 64 64"><g fill="#9ca3b5"><circle cx="32" cy="32" r="19"/>${[0, 45, 90, 135].map(a => `<rect x="27.5" y="6" width="9" height="52" rx="3" transform="rotate(${a} 32 32)"/>`).join('')}</g><circle cx="32" cy="32" r="13.5" fill="#7b8294"/><circle cx="32" cy="32" r="7" fill="#2b2e36"/></svg>`,
  viewer: () => `<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="44" rx="8" fill="#eef0f5"/><rect x="10" y="14" width="44" height="36" rx="4" fill="#7cc4f0"/><circle cx="42" cy="24" r="5" fill="#f6d36b"/><path d="M10 44l13-14 10 10 7-6 14 12a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#4caf7d"/></svg>`,
  tour: () => `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" style="fill:var(--accent)"/><circle cx="32" cy="32" r="26" fill="rgba(0,0,0,.2)"/><circle cx="32" cy="32" r="21" style="fill:var(--accent)"/><path d="M32 13l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" fill="#fff"/></svg>`,
  trash: () => `<svg viewBox="0 0 64 64"><path d="M15 19h34l-3.2 36a3 3 0 0 1-3 2.8H21.2a3 3 0 0 1-3-2.8z" fill="#9aa0b0"/><rect x="11" y="12" width="42" height="8" rx="3" fill="#c7ccd8"/><rect x="25" y="6.5" width="14" height="7" rx="2.5" fill="#c7ccd8"/><g stroke="#727889" stroke-width="3" stroke-linecap="round"><path d="M25 27v23M32 27v23M39 27v23"/></g></svg>`,
  home: () => folderSVG('home'),
  apps: () => `<svg viewBox="0 0 64 64">${[0, 1, 2].map(r => [0, 1, 2].map(c => `<circle cx="${20 + c * 12}" cy="${20 + r * 12}" r="4" fill="#fff"/>`).join('')).join('')}</svg>`
};
function fileSVG(kind) {
  const page = (f = '#f3f4f8') => `<path d="M15 5h24l14 14v36a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="${f}"/><path d="M39 5l14 14H43a4 4 0 0 1-4-4z" fill="#c6cad6"/>`;
  let inner = '';
  switch (kind) {
    case 'text': inner = page() + '<g stroke="#a3a8b8" stroke-width="2.6" stroke-linecap="round"><path d="M19 28h26M19 35h26M19 42h26M19 49h16"/></g>'; break;
    case 'md': inner = page() + '<g stroke="#a3a8b8" stroke-width="2.6" stroke-linecap="round"><path d="M19 36h26M19 43h26M19 50h14"/></g><path d="M19 22h14" stroke="#5b6170" stroke-width="4" stroke-linecap="round"/>'; break;
    case 'script': inner = page() + '<rect x="17" y="27" width="30" height="24" rx="3" fill="#25262d"/><path d="M22 34l5 4-5 4M30 45h9" fill="none" stroke="#8ae234" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'; break;
    case 'image': inner = page() + '<rect x="17" y="26" width="30" height="24" rx="3" fill="#7cc4f0"/><circle cx="40" cy="32" r="3" fill="#f6d36b"/><path d="M17 46l9-9 7 7 4-3 10 8v1a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3z" fill="#4caf7d"/>'; break;
    case 'sheet': inner = page() + '<rect x="17" y="26" width="30" height="24" rx="2" fill="#4caf7d"/><path d="M17 34h30M17 42h30M27 26v24M37 26v24" stroke="#e9f7ee" stroke-width="1.6"/>'; break;
    case 'pdf': inner = page() + '<rect x="11" y="34" width="34" height="14" rx="2" fill="#e05d5d"/><text x="28" y="45" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#fff">PDF</text>'; break;
    case 'audio': inner = page() + '<path d="M27 46V30l14-3v16" fill="none" stroke="#e08a4f" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="46" r="4" fill="#e08a4f"/><circle cx="38" cy="43" r="4" fill="#e08a4f"/>'; break;
    case 'iso': inner = '<circle cx="32" cy="32" r="25" fill="#c9ced9"/><path d="M32 7a25 25 0 0 1 25 25H44a12 12 0 0 0-12-12z" fill="rgba(255,255,255,.55)"/><path d="M32 57A25 25 0 0 1 7 32h13a12 12 0 0 0 12 12z" fill="rgba(120,130,160,.25)"/><circle cx="32" cy="32" r="7" fill="#3a3c46"/><circle cx="32" cy="32" r="3" fill="#c9ced9"/>'; break;
    case 'archive': inner = '<rect x="9" y="12" width="46" height="42" rx="5" fill="#c7925b"/><rect x="9" y="12" width="46" height="10" rx="5" fill="#a87545"/><path d="M32 12v42" stroke="#8b5d33" stroke-width="5" stroke-dasharray="3 3"/>'; break;
    case 'deb': inner = '<path d="M8 20l24-12 24 12v26L32 58 8 46z" fill="#c7925b"/><path d="M8 20l24 12 24-12M32 32v26" fill="none" stroke="#8b5d33" stroke-width="2.4"/>'; break;
    case 'bin': inner = page('#dfe2ea') + '<path d="M22 32l6 6-6 6M32 44h10" fill="none" stroke="#5b6170" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'; break;
    default: inner = page();
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
}
const EXT = { txt: 'text', log: 'text', conf: 'text', cfg: 'text', ini: 'text', md: 'md', sh: 'script', py: 'script', js: 'script', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', csv: 'sheet', pdf: 'pdf', ogg: 'audio', mp3: 'audio', flac: 'audio', iso: 'iso', zip: 'archive', gz: 'archive', xz: 'archive', bz2: 'archive', tar: 'archive', deb: 'deb' };
const extOf = n => { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; };
function fileKind(name, node) {
  if (node && node.type === 'dir') return 'dir';
  const k = EXT[extOf(name)];
  if (k) return k;
  if (node && node.bin) return 'bin';
  if (node && node.exec) return 'script';
  return 'text';
}
const SPECIAL = { Desktop: 'desktop', Documents: 'doc', Downloads: 'download', Music: 'music', Pictures: 'pic', Videos: 'video', Templates: 'doc', Public: 'globe' };
function nodeIcon(path, node) {
  if (node.type === 'dir') {
    if (path === HOME) return folderSVG('home');
    const [d, n] = splitPath(path);
    return folderSVG(d === HOME && SPECIAL[n] ? SPECIAL[n] : null);
  }
  return fileSVG(fileKind(splitPath(path)[1], node));
}

/* ================= wallpapers ================= */
function ridge(r, w, base, amp, rough) {
  const n = Math.ceil(w / 4) + 2, pts = [];
  const f = [[r() * 6.28, 0.6 + r() * 1.2, 1], [r() * 6.28, 2.5 + r() * 3, .45], [r() * 6.28, 8 + r() * 6, .2 * rough], [r() * 6.28, 22 + r() * 10, .08 * rough], [r() * 6.28, 55 + r() * 20, .03 * rough]];
  for (let i = 0; i < n; i++) { const x = i / (n - 1); let y = 0; for (const [p, fr, a] of f) y += Math.sin(x * fr * Math.PI * 2 + p) * a; pts.push(base - y * amp); }
  return pts;
}
function fillRidge(ctx, pts, w, h, color) {
  ctx.beginPath(); ctx.moveTo(0, h);
  pts.forEach((y, i) => ctx.lineTo(i * w / (pts.length - 1), y));
  ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function stars(ctx, r, w, h, count, maxY, u) {
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = Math.pow(r(), 1.35) * maxY, s = r();
    const rad = (s > .97 ? 1.7 : s > .85 ? 1.1 : .6) * u;
    ctx.globalAlpha = .25 + s * .75; ctx.fillStyle = s > .92 ? '#fff4dc' : '#dde5ff';
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    if (s > .988) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 9);
      g.addColorStop(0, 'rgba(220,230,255,.35)'); g.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - rad * 9, y - rad * 9, rad * 18, rad * 18);
    }
  }
  ctx.globalAlpha = 1;
}
function vgrad(ctx, h, stops) { const g = ctx.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
const WALLS = {
  umbra: {
    name: 'Umbra', draw(ctx, w, h) {
      const r = rng(7), u = Math.max(.6, Math.min(w, h) / 1080);
      ctx.fillStyle = vgrad(ctx, h, [[0, '#04071a'], [.5, '#0f1a40'], [.78, '#28336a'], [1, '#3a3f75']]); ctx.fillRect(0, 0, w, h);
      stars(ctx, r, w, h, Math.round(w * h / 3800), h * .78, u);
      const mx = w * .74, my = h * .22, mr = Math.min(w, h) * .055;
      const gl = ctx.createRadialGradient(mx, my, mr * .8, mx, my, mr * 7);
      gl.addColorStop(0, 'rgba(190,205,255,.24)'); gl.addColorStop(1, 'rgba(190,205,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
      const m = document.createElement('canvas'); m.width = m.height = Math.ceil(mr * 2 + 4);
      const mc = m.getContext('2d'); mc.fillStyle = '#f5f0dd'; mc.beginPath(); mc.arc(mr + 2, mr + 2, mr, 0, 7); mc.fill();
      mc.globalCompositeOperation = 'destination-out'; mc.beginPath(); mc.arc(mr + 2 + mr * .45, mr + 2 - mr * .28, mr * .9, 0, 7); mc.fill();
      ctx.drawImage(m, mx - mr - 2, my - mr - 2);
      [[.6, .1, '#262e5c', .5], [.69, .09, '#1a2147', .8], [.79, .07, '#111634', 1], [.9, .05, '#090c20', 1.3]].forEach(([b, a, c, ro]) => {
        fillRidge(ctx, ridge(r, w, h * b, h * a, ro), w, h, c);
        const mg = ctx.createLinearGradient(0, h * (b - .03), 0, h * (b + .14));
        mg.addColorStop(0, 'rgba(120,140,230,0)'); mg.addColorStop(1, 'rgba(120,140,230,.07)');
        ctx.fillStyle = mg; ctx.fillRect(0, h * (b - .03), w, h * .17);
      });
    }
  },
  aurora: {
    name: 'Aurora', draw(ctx, w, h) {
      const r = rng(21), u = Math.max(.6, Math.min(w, h) / 1080);
      ctx.fillStyle = vgrad(ctx, h, [[0, '#02050c'], [.6, '#061a24'], [1, '#0b2a31']]); ctx.fillRect(0, 0, w, h);
      stars(ctx, r, w, h, Math.round(w * h / 6000), h * .7, u);
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; band++) {
        const baseY = h * (.3 + band * .07), amp = h * (.05 + r() * .05), ph = r() * 6, fr = .8 + r() * 1.1, hue = [148, 162, 190][band];
        for (let x = 0; x < w; x += 2) {
          const t = x / w, y = baseY + Math.sin(t * Math.PI * 2 * fr + ph) * amp + Math.sin(t * 13 + ph) * amp * .18;
          const len = h * (.1 + .2 * (.5 + .5 * Math.sin(t * 7 + ph * 2))), a = .035 + .05 * (.5 + .5 * Math.sin(t * 29 + band * 2));
          const g = ctx.createLinearGradient(0, y - len, 0, y + h * .02);
          g.addColorStop(0, `hsla(${hue + 70},80%,60%,0)`); g.addColorStop(.7, `hsla(${hue},85%,58%,${a * .6})`); g.addColorStop(.95, `hsla(${hue},90%,66%,${a})`); g.addColorStop(1, `hsla(${hue},90%,66%,0)`);
          ctx.fillStyle = g; ctx.fillRect(x, y - len, 2, len + h * .02);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      fillRidge(ctx, ridge(r, w, h * .76, h * .06, .7), w, h, '#06161c');
      const front = ridge(r, w, h * .86, h * .04, .6);
      fillRidge(ctx, front, w, h, '#020a0d');
      ctx.fillStyle = '#020a0d';
      for (let x = 0; x < w; x += 6 + r() * 16 * u) {
        const i = Math.round(x / w * (front.length - 1)), y = front[i], th = (18 + r() * 40) * u, tw = th * .32;
        ctx.beginPath(); ctx.moveTo(x, y - th); ctx.lineTo(x - tw, y + 2); ctx.lineTo(x + tw, y + 2); ctx.closePath(); ctx.fill();
      }
    }
  },
  nebula: {
    name: 'Nebula', draw(ctx, w, h) {
      const r = rng(99), u = Math.max(.6, Math.min(w, h) / 1080);
      ctx.fillStyle = '#04030c'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const cols = [[255, 70, 170], [90, 110, 255], [60, 200, 230], [160, 80, 255]];
      for (let i = 0; i < 70; i++) {
        const t = r(), x = w * t, y = h * (.8 - .6 * t) + (r() - .5) * h * .4, rad = h * (.05 + r() * .28), c = cols[Math.floor(r() * cols.length)], a = .03 + r() * .08;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      stars(ctx, r, w, h, Math.round(w * h / 2500), h, u);
    }
  },
  dusk: {
    name: 'Dusk', draw(ctx, w, h) {
      const r = rng(5), u = Math.max(.6, Math.min(w, h) / 1080);
      ctx.fillStyle = vgrad(ctx, h, [[0, '#120c2c'], [.35, '#3b1d55'], [.6, '#9c3f6a'], [.76, '#ee8a4e'], [.84, '#ffc47e']]); ctx.fillRect(0, 0, w, h);
      stars(ctx, r, w, h, Math.round(w * h / 14000), h * .3, u);
      const sx = w * .32, sy = h * .79, sr = h * .1;
      const g = ctx.createRadialGradient(sx, sy, sr * .5, sx, sy, sr * 5);
      g.addColorStop(0, 'rgba(255,214,150,.5)'); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe2b0'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
      [[.76, .07, '#6a2a5a', .5], [.84, .05, '#401a45', .8], [.93, .04, '#1d0c26', 1.1]].forEach(([b, a, c, ro]) => fillRidge(ctx, ridge(r, w, h * b, h * a, ro), w, h, c));
    }
  },
  ink: {
    name: 'Ink', draw(ctx, w, h) {
      ctx.fillStyle = '#0e1016'; ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * .5, h * .45, 0, w * .5, h * .45, Math.max(w, h) * .7);
      g.addColorStop(0, '#1d2130'); g.addColorStop(1, 'rgba(14,16,22,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = .06; ctx.fillStyle = '#fff';
      const s = Math.min(w, h) * .32; ctx.save(); ctx.translate(w / 2 - s / 2, h / 2 - s / 2); ctx.scale(s / 64, s / 64); ctx.fill(new Path2D(LOGO_PATH)); ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
};
const thumbCache = {};
function wallThumb(id, w = 320, h = 200) {
  if (!WALLS[id]) id = 'ink';
  const k = id + w + 'x' + h; if (thumbCache[k]) return thumbCache[k];
  const c = document.createElement('canvas'); c.width = w; c.height = h; WALLS[id].draw(c.getContext('2d'), w, h);
  return (thumbCache[k] = c.toDataURL('image/jpeg', .85));
}
let wallCanvas = null;
function renderWall(fade) {
  const c = document.createElement('canvas'); c.className = 'wallc';
  const s = Math.min(devicePixelRatio || 1, 2, 2560 / innerWidth);
  c.width = Math.round(innerWidth * s); c.height = Math.round(innerHeight * s);
  if (CFG.wall.startsWith('img:')) { WALLS.ink.draw(c.getContext('2d'), c.width, c.height); drawImageWall(c, CFG.wall.slice(4)); }
  else (WALLS[CFG.wall] || WALLS.umbra).draw(c.getContext('2d'), c.width, c.height);
  const host = $('#wallhost'), old = wallCanvas;
  if (fade && old) { c.style.opacity = 0; host.append(c); requestAnimationFrame(() => requestAnimationFrame(() => { c.style.opacity = 1; })); setTimeout(() => old.remove(), 800); }
  else { host.innerHTML = ''; host.append(c); }
  wallCanvas = c;
}

/* ================= virtual filesystem ================= */
const USER = 'night', HOST = 'nightos', HOME = '/home/night';
const TRASH = HOME + '/.local/share/Trash/files';
const DAY = 864e5, NOW0 = Date.now();
function F(content, o = {}) { const { d = 3, h = 2, ...rest } = o; return { type: 'file', content, mtime: NOW0 - d * DAY - h * 36e5, ...rest }; }
function D(children = {}, o = {}) { const { d = 20, h = 0, ...rest } = o; return { type: 'dir', children, mtime: NOW0 - d * DAY - h * 36e5, ...rest }; }
const BIN = '\x7fELF\x02\x01\x01\0\0\0\0\0\0\0\0\0\x03\0>\0\x01\0\0\0\x80\x6d\0\0\0\0\0\0@\0\0\0\0\0\0\0\xb8\xe1\x02\0';
function defaultFS() {
  const bins = {}; ['bash', 'cat', 'cp', 'date', 'echo', 'grep', 'ls', 'mkdir', 'mv', 'ping', 'pwd', 'rm', 'sh', 'touch', 'uname'].forEach(n => bins[n] = F(BIN, { exec: true, bin: true, size: 35000 + n.length * 4471, d: 60 }));
  const ubins = {}; ['apt', 'df', 'free', 'head', 'tail', 'neofetch', 'python3', 'sudo', 'top', 'wc', 'whoami', 'xdg-open', 'nightfox', 'files', 'text-editor', 'curl', 'wget', 'man', 'uptime'].forEach(n => ubins[n] = F(BIN, { exec: true, bin: true, size: 18000 + n.length * 9123, d: 40 }));
  return D({
    bin: D(bins, { d: 60 }), boot: D({ 'vmlinuz-6.8.0-45-night': F(BIN, { bin: true, size: 14987654, d: 15 }), 'initrd.img-6.8.0-45-night': F(BIN, { bin: true, size: 71234567, d: 15 }), grub: D({ 'grub.cfg': F('# GRUB configuration (generated by update-grub)\nset default="0"\nset timeout=3\nmenuentry \'NightOS\' {\n\tlinux /boot/vmlinuz-6.8.0-45-night root=UUID=4f2c9a1e-7b3d-4e8a-9c21-6d5e0f8b1a37 ro quiet splash\n\tinitrd /boot/initrd.img-6.8.0-45-night\n}\n', { d: 15 }) }) }, { d: 15 }),
    dev: D({ null: F('', { size: 0 }) }), etc: D({
      hostname: F('nightos\n', { d: 90 }),
      hosts: F('127.0.0.1\tlocalhost\n127.0.1.1\tnightos\n\n::1     ip6-localhost ip6-loopback\nff02::1 ip6-allnodes\nff02::2 ip6-allrouters\n', { d: 90 }),
      'os-release': F('PRETTY_NAME="NightOS 24.10"\nNAME="NightOS"\nVERSION_ID="24.10"\nVERSION="24.10 (Umbra)"\nVERSION_CODENAME=umbra\nID=nightos\nID_LIKE=debian\nHOME_URL="https://nightos.org/"\nSUPPORT_URL="https://forum.nightos.org/"\nBUG_REPORT_URL="https://bugs.nightos.org/"\nLOGO=nightos-logo\n', { d: 30 }),
      passwd: F('root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nsys:x:3:3:sys:/dev:/usr/sbin/nologin\nmessagebus:x:100:102::/nonexistent:/usr/sbin/nologin\nsystemd-resolve:x:991:991:systemd Resolver:/:/usr/sbin/nologin\npolkitd:x:990:990:User for polkitd:/:/usr/sbin/nologin\nnightdm:x:120:128:Night Display Manager:/var/lib/nightdm:/bin/false\nnight:x:1000:1000:Night,,,:/home/night:/bin/bash\n', { d: 30 }),
      fstab: F('# /etc/fstab: static file system information.\n# <file system>                           <mount point>  <type>  <options>          <dump> <pass>\nUUID=4f2c9a1e-7b3d-4e8a-9c21-6d5e0f8b1a37  /              ext4    errors=remount-ro  0      1\nUUID=7C1A-3F02                             /boot/efi      vfat    umask=0077         0      1\n/swapfile                                  none           swap    sw                 0      0\n', { d: 90 }),
      shells: F('# /etc/shells: valid login shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n', { d: 90 }),
      apt: D({ 'sources.list': F('deb http://archive.nightos.org/nightos umbra main restricted universe\ndeb http://archive.nightos.org/nightos umbra-updates main restricted universe\ndeb http://security.nightos.org/nightos umbra-security main restricted universe\n', { d: 30 }) })
    }, { d: 30 }),
    home: D({
      night: D({
        '.bashrc': F('# ~/.bashrc: executed by bash(1) for non-login shells.\n\ncase $- in\n    *i*) ;;\n      *) return;;\nesac\n\nHISTCONTROL=ignoreboth\nHISTSIZE=1000\nshopt -s checkwinsize\n\nPS1=\'\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ \'\n\nalias ll=\'ls -alF\'\nalias la=\'ls -A\'\nalias l=\'ls -CF\'\n', { d: 30 }),
        '.profile': F('# ~/.profile: executed by the command interpreter for login shells.\nif [ -n "$BASH_VERSION" ]; then\n    if [ -f "$HOME/.bashrc" ]; then\n\t. "$HOME/.bashrc"\n    fi\nfi\nPATH="$HOME/.local/bin:$PATH"\n', { d: 30 }),
        '.config': D({ dusk: D({ 'monitors.xml': F('<monitors version="2">\n  <configuration>\n    <logicalmonitor><x>0</x><y>0</y><scale>1</scale><primary>yes</primary></logicalmonitor>\n  </configuration>\n</monitors>\n', { d: 9 }) }) }, { d: 9 }),
        '.local': D({ share: D({ Trash: D({ files: D({}, { d: 2 }) }) }) }),
        Desktop: D({
          'welcome.txt': F('Welcome to NightOS 24.10 "Umbra"\n================================\n\nA few things to try:\n\n  * Open Activities (top-left) or move the pointer into the top-left corner.\n  * Drag a window by its title bar to the top edge to maximize it,\n    or to the left/right edge to tile it.\n  * Double-click a title bar to maximize or restore.\n  * Press Ctrl+Alt+T to open a terminal.\n  * In the terminal, try:  neofetch,  htop,  sudo apt install cowsay\n  * Right-click the desktop to change the background.\n\nEverything you create is saved in this browser.\nHave a calm night.\n', { d: 0, h: 1 })
        }, { d: 0, h: 1 }),
        Documents: D({
          'notes.txt': F('Meeting notes - Oct 26\n\n- Ship NightOS 24.10 "Umbra" release candidate\n- Fix the dock bounce on slow machines\n- Ask Mira about the new wallpaper set\n- Draft release notes (see todo.md)\n- Night Light: default temperature too warm?\n', { d: 2, h: 5 }),
          'todo.md': F('# TODO\n\n- [x] Install NightOS\n- [x] Pick a wallpaper\n- [ ] Try `neofetch` in the Terminal\n- [ ] sudo apt install cowsay\n- [ ] Tile two windows side by side\n- [ ] Back up ~/Documents\n', { d: 1, h: 3 }),
          'budget-2026.csv': F('month,rent,groceries,transport,fun\nJan,1150,320,85,120\nFeb,1150,295,85,90\nMar,1150,340,92,140\nApr,1150,310,80,110\nMay,1150,355,88,160\n', { d: 12 }),
          projects: D({
            'hello.sh': F('#!/usr/bin/env bash\n# A tiny script. Run it with ./hello.sh\necho "Hello from NightOS!"\necho "Today is $(date)"\nuname -sr\n', { d: 4, exec: true }),
            'README.md': F('# projects\n\nScratch space for small scripts.\n\n    cd ~/Documents/projects\n    ./hello.sh\n', { d: 4 })
          }, { d: 4 })
        }, { d: 1 }),
        Downloads: D({
          'nightos-24.10-desktop-amd64.iso': F('', { size: 6113427456, d: 6 }),
          'wallpaper-pack.zip': F('', { size: 48211933, d: 9 }),
          'lease-agreement.pdf': F('', { size: 284118, d: 14 })
        }, { d: 6 }),
        Music: D({}, { d: 40 }),
        Pictures: D({
          'umbra.png': F('wall:umbra', { size: 2484117, d: 7 }), 'aurora.png': F('wall:aurora', { size: 3120554, d: 7 }),
          'nebula.png': F('wall:nebula', { size: 2958210, d: 7 }), 'dusk.png': F('wall:dusk', { size: 2210983, d: 7 }),
          Screenshots: D({}, { d: 7 })
        }, { d: 7 }),
        Public: D({}, { d: 40 }), Templates: D({}, { d: 40 }), Videos: D({}, { d: 40 })
      }, { d: 1 })
    }, { d: 60 }),
    lib: D({}, { d: 60 }), media: D({}), mnt: D({}), opt: D({}),
    proc: D({
      version: F('Linux version 6.8.0-45-night (buildd@nightos-builder) (x86_64-linux-gnu-gcc-13 (NightOS 13.2.0-23night1) 13.2.0, GNU ld 2.42) #47-NightOS SMP PREEMPT_DYNAMIC Tue Oct 13 09:12:44 UTC 2026\n', { d: 0 }),
      meminfo: F('MemTotal:       16256512 kB\nMemFree:         8102344 kB\nMemAvailable:   11874120 kB\nBuffers:          182044 kB\nCached:          3511200 kB\nSwapTotal:       2097148 kB\nSwapFree:        2097148 kB\n', { d: 0 })
    }, { d: 0 }),
    root: D({ '.bashrc': F('# root bashrc\n') }), sbin: D({}, { d: 60 }), srv: D({}), tmp: D({}, { d: 0 }),
    usr: D({ bin: D(ubins, { d: 40 }), lib: D({}), share: D({ backgrounds: D({}) }) }, { d: 40 }),
    var: D({ log: D({ syslog: F('Oct 28 09:00:01 nightos systemd[1]: Started cron.service - Regular background program processing daemon.\nOct 28 09:00:02 nightos NetworkManager[861]: <info>  [1792400402.1123] device (wlp2s0): state change: activated\nOct 28 09:00:03 nightos dusk-shell[1440]: Shell started in 412 ms\nOct 28 09:12:44 nightos kernel: [  733.112004] wlp2s0: associated\n', { d: 0 }) }) })
  }, { d: 60 });
}
let FS = store.get('fs1', null) || defaultFS();
function splitPath(p) { const i = p.lastIndexOf('/'); return [p.slice(0, i) || '/', p.slice(i + 1)]; }
function resolve(p, cwd = HOME) {
  if (!p) return cwd;
  if (p === '~' || p.startsWith('~/')) p = HOME + p.slice(1);
  if (!p.startsWith('/')) p = cwd + '/' + p;
  const out = [];
  for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
  return '/' + out.join('/');
}
function getNode(abs) {
  let n = FS; if (abs === '/') return n;
  for (const s of abs.slice(1).split('/')) { if (!n || n.type !== 'dir') return null; n = n.children[s]; }
  return n || null;
}
const tilde = p => p === HOME ? '~' : p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p;
const inHome = p => p === HOME || p.startsWith(HOME + '/');
const canWrite = (p, root) => root || inHome(p) || p === '/tmp' || p.startsWith('/tmp/');
const canRead = (p, root) => root || !(p === '/root' || p.startsWith('/root/'));
const nodeSize = n => n.type === 'dir' ? 4096 : (n.size != null ? n.size : new Blob([n.content || '']).size);
const ERR = { ENOENT: 'No such file or directory', EEXIST: 'File exists', ENOTDIR: 'Not a directory', EISDIR: 'Is a directory', EACCES: 'Permission denied', ENOTEMPTY: 'Directory not empty', EINVAL: 'Invalid argument' };
let fsSaveT;
function fsChanged() { clearTimeout(fsSaveT); fsSaveT = setTimeout(() => store.set('fs1', FS), 300); document.dispatchEvent(new Event('fs')); }
function fsWrite(p, content, { append = false, root = false } = {}) {
  const [d, name] = splitPath(p), dn = getNode(d);
  if (!dn) throw 'ENOENT'; if (dn.type !== 'dir') throw 'ENOTDIR';
  const ex = dn.children[name];
  if (ex && ex.type === 'dir') throw 'EISDIR';
  if (!canWrite(p, root)) throw 'EACCES';
  if (ex) { ex.content = append ? (ex.content || '') + content : content; delete ex.size; ex.mtime = Date.now(); }
  else dn.children[name] = { type: 'file', content, mtime: Date.now() };
  dn.mtime = Date.now(); fsChanged();
}
function fsMkdir(p, { parents = false, root = false } = {}) {
  const ex = getNode(p);
  if (ex) { if (parents && ex.type === 'dir') return; throw 'EEXIST'; }
  const [d, name] = splitPath(p); let dn = getNode(d);
  if (!dn) { if (!parents) throw 'ENOENT'; fsMkdir(d, { parents, root }); dn = getNode(d); }
  if (dn.type !== 'dir') throw 'ENOTDIR';
  if (!canWrite(p, root)) throw 'EACCES';
  dn.children[name] = { type: 'dir', children: {}, mtime: Date.now() }; dn.mtime = Date.now(); fsChanged();
}
function fsRemove(p, { recursive = false, root = false } = {}) {
  const n = getNode(p); if (!n) throw 'ENOENT';
  if (n.type === 'dir' && !recursive) throw 'EISDIR';
  if (!canWrite(p, root) || p === '/') throw 'EACCES';
  const [d, name] = splitPath(p); delete getNode(d).children[name]; fsChanged();
}
function fsMove(src, dst, { root = false, copy = false } = {}) {
  const n = getNode(src); if (!n) throw 'ENOENT';
  let target = dst; const dn = getNode(dst);
  if (dn && dn.type === 'dir') target = dst + (dst === '/' ? '' : '/') + splitPath(src)[1];
  if (target === src) return;
  if (target.startsWith(src + '/')) throw 'EINVAL';
  const [td, tn] = splitPath(target), tdn = getNode(td);
  if (!tdn) throw 'ENOENT'; if (tdn.type !== 'dir') throw 'ENOTDIR';
  if (!canWrite(target, root) || (!copy && !canWrite(src, root))) throw 'EACCES';
  const ex = tdn.children[tn]; if (ex && ex.type === 'dir' && n.type !== 'dir') throw 'EISDIR';
  const moved = copy ? JSON.parse(JSON.stringify(n)) : n;
  if (copy) moved.mtime = Date.now();
  tdn.children[tn] = moved;
  if (!copy) { const [sd, sn] = splitPath(src); delete getNode(sd).children[sn]; }
  fsChanged(); return target;
}
function uniqueName(dirPath, base, ext = '') {
  const dn = getNode(dirPath); if (!dn.children[base + ext]) return base + ext;
  let i = 2; while (dn.children[`${base} ${i}${ext}`]) i++; return `${base} ${i}${ext}`;
}
function trashItem(p) {
  const n = getNode(p); if (!n) return;
  const [d, name] = splitPath(p), td = getNode(TRASH) || (fsMkdir(TRASH, { parents: true }), getNode(TRASH));
  let t = name, i = 2; const e = extOf(name), b = e ? name.slice(0, -(e.length + 1)) : name;
  while (td.children[t]) t = `${b} (${i++})${e ? '.' + e : ''}`;
  n.orig = p; n.dtime = Date.now(); td.children[t] = n; delete getNode(d).children[name]; fsChanged();
}
function restoreItem(name) {
  const td = getNode(TRASH), n = td.children[name]; if (!n) return;
  let p = n.orig || HOME + '/' + name; const [d] = splitPath(p);
  if (!getNode(d)) fsMkdir(d, { parents: true });
  if (getNode(p)) { const [dd, nn] = splitPath(p); p = dd + '/' + uniqueName(dd, nn); }
  delete n.orig; delete n.dtime; getNode(splitPath(p)[0]).children[splitPath(p)[1]] = n; delete td.children[name]; fsChanged();
}

/* ================= fake system stats ================= */
const SYS = {
  cores: clamp(navigator.hardwareConcurrency || 8, 2, 16), boot: Date.now(), pid: 2400, cpu: [], hist: [], memHist: [], swapHist: [], rx: [], tx: [],
  memTotal: 15.5 * 1024, mem: 3900, activity: 0, net: { rx: 0, tx: 0, totRx: 1.24e9, totTx: 0.21e9 }, dl: 0
};
SYS.hist = Array.from({ length: SYS.cores }, () => Array(60).fill(0));
SYS.memHist = Array(60).fill(25); SYS.swapHist = Array(60).fill(0); SYS.rx = Array(60).fill(0); SYS.tx = Array(60).fill(0);
const nextPid = () => (SYS.pid += 1 + Math.floor(Math.random() * 37));
const BASE_PROCS = [
  [1, 'systemd', 'root', 11.9], [2, 'kthreadd', 'root', 0], [312, 'systemd-journald', 'root', 38.2], [348, 'systemd-udevd', 'root', 9.1],
  [702, 'systemd-resolved', 'systemd-resolve', 13.4], [703, 'systemd-timesyncd', 'systemd-timesync', 7.2], [861, 'NetworkManager', 'root', 21.6],
  [874, 'dbus-daemon', 'messagebus', 5.9], [880, 'polkitd', 'polkitd', 10.3], [902, 'wpa_supplicant', 'root', 6.4], [1104, 'cupsd', 'root', 12.8],
  [1187, 'nightdm', 'root', 9.7], [1402, 'systemd', 'night', 10.1], [1418, 'pipewire', 'night', 14.6], [1420, 'wireplumber', 'night', 22.3],
  [1421, 'pipewire-pulse', 'night', 12.2], [1440, 'dusk-shell', 'night', 384.5], [1462, 'Xwayland', 'night', 86.4], [1488, 'dusk-calendar-server', 'night', 31.7],
  [1510, 'tracker-miner-fs-3', 'night', 58.1], [1533, 'ibus-daemon', 'night', 11.5], [1602, 'dusk-keyring-d', 'night', 8.3], [1655, 'xdg-desktop-portal', 'night', 15.2]
].map(([pid, name, user, mem]) => ({ pid, name, user, mem, cpu: 0 }));
let PROCS = BASE_PROCS.map(p => ({ ...p }));
function procList() {
  const out = PROCS.slice();
  for (const w of WM.wins) {
    out.push({ pid: w.pid, name: APPS[w.app].proc, user: 'night', mem: w.mem, cpu: w.cpu, win: w });
    if (w.app === 'terminal') out.push({ pid: w.pid + 3, name: 'bash', user: 'night', mem: 5.2, cpu: 0, win: w, child: true });
    if (w.app === 'browser') out.push({ pid: w.pid + 9, name: 'Isolated Web Co', user: 'night', mem: w.mem * .8, cpu: w.cpu * .7, win: w, child: true });
  }
  if (SYS.workerCpu) out.push({ pid: 3001, name: 'node (Web Worker)', user: 'night', mem: 24, cpu: SYS.workerCpu });
  return out;
}
/* REAL is filled in by real.js from browser APIs; everything here degrades to simulation without it */
const REAL = { battery: null, online: navigator.onLine !== false, storage: null, totRx: 0, host: null, arch: null };
const netUp = () => CFG.wifi && !CFG.plane && REAL.online;
function sysTick() {
  const main = REAL.sampleMain ? REAL.sampleMain() : 0, wk = REAL.sampleWorker ? REAL.sampleWorker() : 0;
  for (const p of PROCS) p.cpu = p.name === 'dusk-shell' ? main * .7 : p.name === 'Xwayland' ? main * .1 : 0;
  for (const w of WM.wins) { w.cpu = w === WM.active ? main * .2 : 0; w.mem = clamp(w.mem + (Math.random() - .45) * 2, 30, 900); }
  SYS.workerCpu = wk;
  SYS.cpu = SYS.hist.map((h, i) => { const v = i === 0 ? main : i === 1 ? wk : 0; h.push(v); h.shift(); return v; });
  const m = REAL.mem && REAL.mem();
  if (m) { SYS.memReal = true; SYS.memTotal = m.total / 1048576; SYS.mem = m.used / 1048576; }
  else { SYS.memReal = false; SYS.mem = 2200 + procList().reduce((a, p) => a + p.mem, 0); }
  SYS.memHist.push(SYS.mem / SYS.memTotal * 100); SYS.memHist.shift(); SYS.swapHist.push(0); SYS.swapHist.shift();
  const rx = REAL.sampleNet ? REAL.sampleNet() : 0, tx = 0;
  SYS.net.rx = rx; SYS.net.tx = tx; SYS.net.totRx = REAL.totRx; SYS.net.totTx = 0;
  SYS.rx.push(rx); SYS.rx.shift(); SYS.tx.push(tx); SYS.tx.shift();
  document.dispatchEvent(new Event('systick'));
}
const loadAvg = () => { const a = SYS.cpu.reduce((x, y) => x + y, 0) / 100; return [a, a * .9 + .05, a * .8 + .08].map(v => v.toFixed(2)); };
const CPU_NAME = 'NightCore Virtual CPU';
let GPU_NAME = null;
function gpuName() {
  if (GPU_NAME) return GPU_NAME;
  try {
    const g = document.createElement('canvas').getContext('webgl'); const ext = g && g.getExtension('WEBGL_debug_renderer_info');
    let r = ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    const m = r.match(/^ANGLE \((.*)\)$/); if (m) r = (m[1].split(',')[1] || m[1]).trim();
    r = r.replace(/\(0x[0-9a-f]+\)/i, '').replace(/\s*(Direct3D|OpenGL|Vulkan|Metal).*$/i, '').trim();
    GPU_NAME = r || 'Virtual GPU';
  } catch (e) { GPU_NAME = 'Virtual GPU'; }
  return GPU_NAME;
}
function uptimeStr(short) {
  const s = Math.floor((Date.now() - SYS.boot) / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (short) return h ? `${h}:${pad(m % 60)}` : `${m} min`;
  return h ? `${h} hour${h > 1 ? 's' : ''}, ${m % 60} min${m % 60 === 1 ? '' : 's'}` : `${m} min${m === 1 ? '' : 's'}`;
}

/* ================= window manager ================= */
const WM = { wins: [], z: 20, seq: 0, active: null };
const dockReserve = () => isNarrow() ? 66 : 78;
const workArea = () => ({ x: 0, y: BAR, w: innerWidth, h: innerHeight - BAR - dockReserve() });
const APPS = {};
function setRect(win, x, y, w, h) {
  win.r = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  Object.assign(win.el.style, { left: win.r.x + 'px', top: win.r.y + 'px', width: win.r.w + 'px', height: win.r.h + 'px' });
}
function openWin(o) {
  const node = el(`<div class="win ${o.cls || ''}" data-app="${o.app}" role="dialog" aria-label="${esc(o.title || APPS[o.app].name)}">
    <div class="frame" tabindex="-1">
      <header class="hb"><div class="hb-l"></div><div class="hb-t"><div class="hb-title"></div><div class="hb-sub" hidden></div></div><div class="hb-r"></div>
        <div class="wc"><button data-a="min" aria-label="Minimize">${sym('min')}</button><button data-a="max" aria-label="Maximize">${sym('max')}</button><button data-a="close" aria-label="Close">${sym('close')}</button></div></header>
      <div class="wb"></div>
    </div>${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<i class="rz r-${d}" data-d="${d}"></i>`).join('')}</div>`);
  const win = { id: ++WM.seq, app: o.app, el: node, pid: nextPid(), o, state: 'normal', r: {}, cpu: .5, mem: o.mem || 60 + Math.random() * 90, z: 0 };
  win.frame = $('.frame', node); win.body = $('.wb', node); win.hl = $('.hb-l', node); win.hr = $('.hb-r', node); win.ht = $('.hb-t', node); win.hb = $('.hb', node);
  win.setTitle = (t, sub = '') => {
    win.title = t; const tt = $('.hb-title', node), s = $('.hb-sub', node);
    if (tt) tt.textContent = t; if (s) { s.textContent = sub; s.hidden = !sub; }
    node.setAttribute('aria-label', t); if (WM.active === win) updateTopApp();
  };
  win.setTitle(o.title || APPS[o.app].name);
  const wa = workArea(), w = Math.min(o.w || 720, wa.w - 16), h = Math.min(o.h || 480, wa.h - 16), n = WM.wins.filter(x => !x.min).length % 6;
  setRect(win, clamp(wa.x + (wa.w - w) / 2 + (n - 2) * 30, 0, wa.w - w), clamp(wa.y + (wa.h - h) / 2 + (n - 2) * 26, BAR, BAR + wa.h - h), w, h);
  $('#windows').append(node); WM.wins.push(win);
  node.classList.add('opening'); node.addEventListener('animationend', () => node.classList.remove('opening'), { once: true });
  node.addEventListener('pointerdown', () => focusWin(win), true);
  $('.wc', node).addEventListener('click', e => {
    const a = e.target.closest('button'); if (!a) return;
    if (a.dataset.a === 'close') closeWin(win); else if (a.dataset.a === 'max') toggleMax(win); else minimizeWin(win);
  });
  win.hb.addEventListener('pointerdown', e => { if (e.button === 0 && !e.target.closest('button,input,select,.no-drag')) startDrag(win, e); });
  win.hb.addEventListener('dblclick', e => { if (!e.target.closest('button,input,select,.no-drag')) toggleMax(win); });
  win.hb.addEventListener('contextmenu', e => {
    if (e.target.closest('input')) return; e.preventDefault();
    showMenu(e.clientX, e.clientY, [{ label: 'Minimize', action: () => minimizeWin(win) }, { label: win.state === 'max' ? 'Unmaximize' : 'Maximize', action: () => toggleMax(win) }, '-',
    { label: 'Always on Top', check: !!win.onTop, action: () => { win.onTop = !win.onTop; focusWin(win); } }, '-', { label: 'Close', kb: 'Alt+F4', action: () => closeWin(win) }]);
  });
  $$('.rz', node).forEach(hd => hd.addEventListener('pointerdown', e => startResize(win, hd.dataset.d, e)));
  focusWin(win);
  if (isNarrow() || o.max) applySnap(win, 'max', false);
  updateDock(); bounceDock(o.app);
  return win;
}
function focusWin(win) {
  if (win.min) return restoreWin(win);
  const changed = WM.active !== win;
  win.z = ++WM.z; win.el.style.zIndex = win.onTop ? 5000 + win.z : win.z;
  if (changed) {
    WM.wins.forEach(w => w.el.classList.toggle('active', w === win)); WM.active = win; updateTopApp(); updateDock();
    setTimeout(() => { if (WM.active === win && !win.el.contains(document.activeElement)) { if (win.onFocus) win.onFocus(); else win.frame.focus({ preventScroll: true }); } }, 0);
  }
}
function focusTop() {
  const vis = WM.wins.filter(w => !w.min && !w.closing).sort((a, b) => b.z - a.z);
  if (vis[0]) focusWin(vis[0]); else { WM.active = null; WM.wins.forEach(w => w.el.classList.remove('active')); updateTopApp(); updateDock(); }
}
async function closeWin(win, force) {
  if (win.closing) return;
  if (!force && win.beforeClose && !(await win.beforeClose())) return;
  win.closing = true; if (win.onClose) win.onClose();
  win.el.classList.add('closing'); setTimeout(() => win.el.remove(), 170);
  WM.wins = WM.wins.filter(w => w !== win);
  if (WM.active === win) { WM.active = null; focusTop(); }
  updateDock(); updateTopApp();
}
function minimizeWin(win) {
  const ic = $(`.dk[data-app="${win.app}"]`), r = win.el.getBoundingClientRect();
  let tx = 0, ty = innerHeight - r.top;
  if (ic) { const b = ic.getBoundingClientRect(); tx = b.left + b.width / 2 - (r.left + r.width / 2); ty = b.top + b.height / 2 - (r.top + r.height / 2); }
  win.el.style.transformOrigin = 'center'; win.el.style.transform = `translate(${tx}px,${ty}px) scale(.06)`;
  win.el.classList.add('minimizing'); win.min = true;
  clearTimeout(win.minT); win.minT = setTimeout(() => { win.el.hidden = true; win.el.classList.remove('minimizing'); win.el.style.transform = ''; }, 260);
  if (WM.active === win) { WM.active = null; win.el.classList.remove('active'); focusTop(); }
  updateDock(); updateTopApp();
}
function restoreWin(win) {
  clearTimeout(win.minT); win.min = false; win.el.hidden = false; win.el.classList.remove('minimizing'); win.el.style.transform = '';
  win.el.classList.add('opening'); win.el.addEventListener('animationend', () => win.el.classList.remove('opening'), { once: true });
  focusWin(win);
}
function applySnap(win, mode, animate = true) {
  if (win.state === 'normal') win.prev = { ...win.r };
  const wa = workArea();
  if (animate) { win.el.classList.add('anim'); setTimeout(() => win.el.classList.remove('anim'), 220); }
  if (mode === 'max') setRect(win, wa.x, wa.y, wa.w, wa.h);
  else if (mode === 'left') setRect(win, 0, wa.y, wa.w / 2, wa.h);
  else setRect(win, wa.w / 2, wa.y, wa.w - Math.round(wa.w / 2), wa.h);
  win.state = mode === 'max' ? 'max' : 'tiled'; win.snap = mode;
  win.el.classList.toggle('max', mode === 'max'); win.el.classList.toggle('tiled', mode !== 'max');
  $('[data-a="max"]', win.el).innerHTML = sym(mode === 'max' ? 'restore' : 'max');
  if (win.onResize) setTimeout(win.onResize, 230);
}
function unsnap(win, animate = true) {
  const p = win.prev || { x: 80, y: 80, w: 720, h: 480 };
  if (animate) { win.el.classList.add('anim'); setTimeout(() => win.el.classList.remove('anim'), 220); }
  win.state = 'normal'; win.snap = null; win.el.classList.remove('max', 'tiled');
  setRect(win, p.x, p.y, p.w, p.h); $('[data-a="max"]', win.el).innerHTML = sym('max');
  if (win.onResize) setTimeout(win.onResize, 230);
}
function toggleMax(win) { if (win.state === 'max') unsnap(win); else applySnap(win, 'max'); }
function showSnap(mode) {
  const s = $('#snap'); if (!mode) { s.hidden = true; return; }
  const wa = workArea(), g = 6, r = mode === 'max' ? [g, wa.y + g, wa.w - 2 * g, wa.h - 2 * g] : mode === 'left' ? [g, wa.y + g, wa.w / 2 - 1.5 * g, wa.h - 2 * g] : [wa.w / 2 + g / 2, wa.y + g, wa.w / 2 - 1.5 * g, wa.h - 2 * g];
  Object.assign(s.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px', zIndex: WM.z }); s.hidden = false;
}
function startDrag(win, e) {
  const sx = e.clientX, sy = e.clientY; let r = { ...win.r }, moved = false, snap = null;
  const move = ev => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) {
      moved = true; win.el.classList.add('dragging'); document.body.style.cursor = 'grabbing';
      if (win.state !== 'normal') {
        const p = win.prev || { w: r.w * .6, h: r.h * .7 }, fx = (sx - r.x) / r.w;
        r = { x: sx - p.w * fx, y: sy - 18, w: p.w, h: p.h }; win.state = 'normal'; win.snap = null; win.el.classList.remove('max', 'tiled');
        $('[data-a="max"]', win.el).innerHTML = sym('max'); setRect(win, r.x, r.y, r.w, r.h); win.onResize && win.onResize();
      }
    }
    SYS.activity += .05;
    setRect(win, clamp(r.x + dx, -r.w + 80, innerWidth - 80), clamp(r.y + dy, BAR, innerHeight - 50), r.w, r.h);
    snap = ev.clientY <= BAR + 2 ? 'max' : ev.clientX <= 3 ? 'left' : ev.clientX >= innerWidth - 4 ? 'right' : null;
    showSnap(snap);
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    win.el.classList.remove('dragging'); document.body.style.cursor = ''; showSnap(null);
    if (snap) { win.prev = { ...win.r, y: Math.max(win.r.y, BAR + 10) }; win.state = 'normal'; applySnap(win, snap); win.prev = { ...win.prev }; }
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
function startResize(win, dir, e) {
  e.stopPropagation(); e.preventDefault();
  const sx = e.clientX, sy = e.clientY, r0 = { ...win.r }, mw = win.o.minW || 360, mh = win.o.minH || 240;
  const move = ev => {
    let { x, y, w, h } = r0; const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (dir.includes('e')) w = Math.max(mw, r0.w + dx);
    if (dir.includes('s')) h = Math.max(mh, r0.h + dy);
    if (dir.includes('w')) { w = Math.max(mw, r0.w - dx); x = r0.x + r0.w - w; }
    if (dir.includes('n')) { h = Math.max(mh, r0.h - dy); y = r0.y + r0.h - h; if (y < BAR) { h -= BAR - y; y = BAR; } }
    setRect(win, x, y, w, h); win.onResize && win.onResize();
  };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); document.body.style.cursor = ''; };
  document.body.style.cursor = getComputedStyle(e.target).cursor;
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}
addEventListener('resize', () => {
  for (const w of WM.wins) {
    if (w.state === 'max' || w.state === 'tiled' || isNarrow()) applySnap(w, w.snap || 'max', false);
    else setRect(w, clamp(w.r.x, 0, Math.max(0, innerWidth - 120)), clamp(w.r.y, BAR, Math.max(BAR, innerHeight - 120)), Math.min(w.r.w, innerWidth), Math.min(w.r.h, innerHeight - BAR));
    w.onResize && w.onResize();
  }
});
function launch(app, arg) {
  const a = APPS[app]; if (!a) return;
  if (a.single) { const ex = WM.wins.find(w => w.app === app); if (ex) { focusWin(ex); a.reopen && a.reopen(ex, arg); return ex; } }
  return a.launch(arg);
}
/* small helpers for building window chrome */
function hbtn(icon, title, fn, cls = '') {
  const b = el(`<button class="hbtn ${cls}" title="${esc(title)}" aria-label="${esc(title)}">${icon.startsWith('<') ? icon : sym(icon)}</button>`);
  if (fn) b.addEventListener('click', fn); return b;
}
function tbtn(label, fn, cls = '') { const b = el(`<button class="hbtn ${cls}">${esc(label)}</button>`); if (fn) b.addEventListener('click', fn); return b; }
function winDialog(win, { title, body = '', entry = null, buttons = [{ label: 'OK', cls: 'sug', value: 'ok' }], validate }) {
  return new Promise(res => {
    const d = el(`<div class="wdlg"><form class="wdlg-card"><h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ''}${entry !== null ? `<input class="entry" id="dlg-entry-${win.id}" spellcheck="false" autocomplete="off"><div class="err"></div>` : ''}<div class="wdlg-btns"></div></form></div>`);
    const form = $('form', d), inp = $('input', d), bx = $('.wdlg-btns', d), errEl = $('.err', d);
    if (inp) inp.value = entry;
    const done = v => { d.remove(); res(v); };
    buttons.forEach((b, i) => {
      const bt = el(`<button type="${i === buttons.length - 1 ? 'submit' : 'button'}" class="${b.cls || ''}">${esc(b.label)}</button>`);
      if (i !== buttons.length - 1) bt.onclick = () => done({ btn: b.value, value: inp && inp.value });
      bx.append(bt);
    });
    const check = () => { if (!validate || !inp) return true; const m = validate(inp.value); errEl.textContent = m || ''; bx.lastChild.disabled = !!m; return !m; };
    if (inp) inp.addEventListener('input', check);
    form.addEventListener('submit', e => { e.preventDefault(); if (!check()) return; done({ btn: buttons[buttons.length - 1].value, value: inp && inp.value }); });
    d.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); done({ btn: 'cancel', value: null }); } });
    win.frame.append(d); check();
    setTimeout(() => { if (inp) { inp.focus(); const dot = inp.value.lastIndexOf('.'); inp.setSelectionRange(0, dot > 0 ? dot : inp.value.length); } else bx.lastChild.focus(); }, 30);
  });
}
