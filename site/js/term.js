'use strict';
/* ================= safe expression evaluator (shared with Calculator) ================= */
function calcEval(src, vars = {}) {
  const toks = [], re = /\s*(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|\*\*|\/\/|[A-Za-z_π]\w*|[-+*/%^()!,])/y;
  let m, i = 0; src = src.trim();
  while (i < src.length) { re.lastIndex = i; m = re.exec(src); if (!m) throw new Error('SyntaxError: invalid syntax'); toks.push(m[1]); i = re.lastIndex; while (src[i] === ' ') i++; }
  let p = 0; const peek = () => toks[p], next = () => toks[p++];
  const FN = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log10, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp, min: Math.min, max: Math.max, int: Math.trunc, float: x => x };
  const fact = n => { if (n < 0 || n % 1) throw new Error('ValueError: factorial() not defined'); let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = next(), r = term(); v = o === '+' ? v + r : v - r; } return v; }
  function term() { let v = power(); while (['*', '/', '//', '%'].includes(peek())) { const o = next(), r = power(); if ((o === '/' || o === '//' || o === '%') && r === 0) throw new Error('ZeroDivisionError: division by zero'); v = o === '*' ? v * r : o === '/' ? v / r : o === '//' ? Math.floor(v / r) : ((v % r) + r) % r; } return v; }
  function power() { const b = unary(); if (peek() === '**' || peek() === '^') { next(); return Math.pow(b, power()); } return b; }
  function unary() { if (peek() === '-') { next(); return -unary(); } if (peek() === '+') { next(); return unary(); } return post(); }
  function post() { let v = atom(); while (peek() === '!') { next(); v = fact(v); } return v; }
  function atom() {
    const t = next();
    if (t === undefined) throw new Error('SyntaxError: unexpected EOF while parsing');
    if (t === '(') { const v = expr(); if (next() !== ')') throw new Error("SyntaxError: '(' was never closed"); return v; }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    if (/^[A-Za-z_π]/.test(t)) {
      if (peek() === '(' && FN[t]) { next(); const args = []; if (peek() !== ')') { args.push(expr()); while (peek() === ',') { next(); args.push(expr()); } } if (next() !== ')') throw new Error('SyntaxError: invalid syntax'); return FN[t](...args); }
      if (t === 'pi' || t === 'π') return Math.PI; if (t === 'e') return Math.E;
      if (t in vars) return vars[t];
      throw new Error(`NameError: name '${t}' is not defined`);
    }
    throw new Error('SyntaxError: invalid syntax');
  }
  const v = expr(); if (p < toks.length) throw new Error('SyntaxError: invalid syntax'); return v;
}

/* ================= shell parsing ================= */
function splitTop(s, seps) {
  const parts = [], ops = []; let cur = '', q = null, depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (ch === '\\') { cur += ch + (s[i + 1] || ''); i++; continue; }
    if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth) { cur += ch; continue; }
    const sep = seps.find(x => s.startsWith(x, i) && !(x === '|' && s[i + 1] === '|') && !(x === '>' && s[i + 1] === '>') && !(x === '&' && s[i + 1] !== '&'));
    if (sep) { parts.push(cur); ops.push(sep); cur = ''; i += sep.length - 1; continue; }
    cur += ch;
  }
  parts.push(cur); return { parts, ops };
}
function tokenize(s, env) {
  const out = []; let cur = '', q = null, has = false, glob = false, tl = false;
  const push = () => { if (cur || has) out.push({ v: tl && (cur === '~' || cur.startsWith('~/')) ? HOME + cur.slice(1) : cur, glob }); cur = ''; has = false; glob = false; tl = false; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q === "'") { if (ch === "'") q = null; else cur += ch; continue; }
    if (ch === '$' && /[A-Za-z_?{0-9#@*$]/.test(s[i + 1] || '')) {
      let name, def = null;
      if (s[i + 1] === '{') { const j = s.indexOf('}', i); name = s.slice(i + 2, j); i = j; const m = name.match(/^([^:]+):-(.*)$/); if (m) { name = m[1]; def = m[2]; } if (name.startsWith('#')) { cur += String((env[name.slice(1)] ?? '').length); has = true; continue; } }
      else if (/[?0-9#@*$]/.test(s[i + 1])) { name = s[i + 1]; i++; }
      else { name = s.slice(i + 1).match(/^\w+/)[0]; i += name.length; }
      const v = env[name]; cur += (v == null || v === '') && def != null ? def : (v ?? ''); has = true; continue;
    }
    if (q === '"') { if (ch === '"') q = null; else if (ch === '\\' && '"\\$'.includes(s[i + 1])) cur += s[++i]; else cur += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; has = true; continue; }
    if (ch === '\\' && i + 1 < s.length) { cur += s[++i]; has = true; continue; }
    if (/\s/.test(ch)) { push(); continue; }
    if ((ch === '*' || ch === '?')) glob = true;
    if (ch === '~' && !cur && !has) tl = true;
    cur += ch;
  }
  if (q) throw new Error(`unexpected EOF while looking for matching \`${q}'`);
  push(); return out;
}
function expandGlobs(toks, cwd) {
  const out = [];
  for (const t of toks) {
    if (!t.glob) { out.push(t.v); continue; }
    const slash = t.v.lastIndexOf('/'), dir = slash >= 0 ? t.v.slice(0, slash + 1) : '', pat = t.v.slice(slash + 1);
    const dn = getNode(resolve(dir || '.', cwd));
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const ms = dn && dn.type === 'dir' ? Object.keys(dn.children).filter(k => re.test(k) && (pat.startsWith('.') || !k.startsWith('.'))).sort() : [];
    if (ms.length) ms.forEach(k => out.push(dir + k)); else out.push(t.v);
  }
  return out;
}
function parseFlags(args) {
  const f = new Set(), long = new Set(), rest = []; let end = false;
  for (const a of args) {
    if (!end && a === '--') { end = true; continue; }
    if (!end && a.startsWith('--')) long.add(a.slice(2));
    else if (!end && a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) for (const c of a.slice(1)) f.add(c);
    else rest.push(a);
  }
  return { has: c => f.has(c), long: c => long.has(c), args: rest };
}
const optVal = (args, flag, def) => { const i = args.indexOf(flag); if (i >= 0 && args[i + 1] != null) { const v = args[i + 1]; args.splice(i, 2); return v; } const j = args.findIndex(a => a.startsWith(flag) && a.length > flag.length && /\d/.test(a[flag.length])); if (j >= 0) { const v = args[j].slice(flag.length); args.splice(j, 1); return v; } return def; };

/* ================= packages ================= */
const PKGS = {
  cowsay: { v: '3.03+dfsg2-8', s: '18.6 kB', i: '93.2 kB', sec: 'universe', cmds: ['cowsay', 'cowthink'], arch: 'all' },
  sl: { v: '5.02-1build1', s: '12.8 kB', i: '60.4 kB', sec: 'universe', cmds: ['sl'] },
  'fortune-mod': { v: '1:1.99.1-7.3build1', s: '25.0 kB', i: '89.1 kB', sec: 'universe', cmds: ['fortune'], deps: ['fortunes-min', 'librecode0'] },
  cmatrix: { v: '2.0-6', s: '17.9 kB', i: '54.3 kB', sec: 'universe', cmds: ['cmatrix'] },
  htop: { v: '3.3.0-4build1', s: '171 kB', i: '434 kB', sec: 'main', cmds: ['htop'], deps: ['libnl-genl-3-200'] },
  tree: { v: '2.1.1-2', s: '47.9 kB', i: '111 kB', sec: 'universe', cmds: ['tree'] },
  'net-tools': { v: '2.10-0.1night1', s: '204 kB', i: '811 kB', sec: 'main', cmds: ['ifconfig', 'netstat', 'route'] },
  git: { v: '1:2.43.0-1night7', s: '3,679 kB', i: '22.1 MB', sec: 'main', cmds: ['git'], deps: ['git-man', 'liberror-perl'] }
};
const CMD_PKG = {}; for (const [k, p] of Object.entries(PKGS)) for (const c of p.cmds) CMD_PKG[c] = k;
let INSTALLED = new Set(store.get('pkgs', []));
const saveInstalled = () => store.set('pkgs', [...INSTALLED]);
const UPGRADES = [['dusk-shell', '46.2-0night1', '46.3-0night1'], ['nightfox', '131.0.2+build1-0night1', '131.0.3+build1-0night1'], ['linux-firmware', '20240318.git3b128b60-0night2', '20240318.git3b128b60-0night3']];
const DESC = {
  ls: 'list directory contents', cd: 'change the shell working directory', pwd: 'print name of current/working directory', cat: 'concatenate files and print on the standard output',
  echo: 'display a line of text', mkdir: 'make directories', touch: 'change file timestamps', rm: 'remove files or directories', rmdir: 'remove empty directories',
  mv: 'move (rename) files', cp: 'copy files and directories', clear: 'clear the terminal screen', whoami: 'print effective user name', uname: 'print system information',
  date: 'print or set the system date and time', cal: 'display a calendar', uptime: 'tell how long the system has been running', neofetch: 'a fast, highly customizable system info script',
  history: 'GNU History Library', man: 'an interface to the system reference manuals', sudo: 'execute a command as another user', apt: 'command-line interface for the package manager',
  ping: 'send ICMP ECHO_REQUEST to network hosts', ps: 'report a snapshot of the current processes', top: 'display Linux processes', kill: 'send a signal to a process',
  free: 'Display amount of free and used memory in the system', df: 'report file system space usage', ip: 'show / manipulate routing, network devices, interfaces and tunnels',
  grep: 'print lines that match patterns', head: 'output the first part of files', tail: 'output the last part of files', wc: 'print newline, word, and byte counts for each file',
  which: 'locate a command', hostname: 'show or set the system\'s host name', exit: 'exit the shell', reboot: 'reboot the machine', shutdown: 'halt, power off or reboot the machine',
  python3: 'an interpreted, interactive, object-oriented programming language', 'xdg-open':'opens a file or URL in the user\'s preferred application', sort: 'sort lines of text files',
  id: 'print real and effective user and group IDs', env: 'run a program in a modified environment', curl: 'transfer a URL', sleep: 'delay for a specified amount of time',
  cowsay: 'configurable speaking cow', sl: 'cure your bad habit of mistyping', fortune: 'print a random, hopefully interesting, adage', htop: 'interactive process viewer',
  tree: 'list contents of directories in a tree-like format', cmatrix: 'simulates the display from "The Matrix"', lsb_release: 'print distribution-specific information',
  systemctl: 'Control the systemd system and service manager', nano: 'Nano\'s ANOther editor', file: 'determine file type', stat: 'display file or file system status'
};
const FORTUNES = [
  'The best way to predict the future is to schedule a cron job for it.',
  'A clean desk is a sign of an empty ~/Downloads folder. Nobody has one.',
  'You will soon have an opportunity to type `sudo !!` with great satisfaction.',
  'There are two hard things in computing: naming things, and remembering which tab the docs were in.',
  'Tonight is a good night to back up your home directory.',
  'Read the man page. Then read it again. The answer was in the EXAMPLES section.',
  'Every great system starts with a small shell script nobody meant to keep.',
  'Your next commit message will be thoughtful and descriptive.',
  'Patience: the kernel compiled itself one object file at a time.',
  'If it works, it is not a hack. It is a solution with character.'
];

/* ================= terminal app ================= */
let firstTerm = true;
APPS.terminal = { name: 'Terminal', proc: 'night-terminal', kw: 'console shell bash command line', launch: a => TerminalApp(a || {}) };
function TerminalApp(arg) {
  const win = openWin({ app: 'terminal', title: 'night@nightos: ~', w: 760, h: 470, minW: 340, minH: 180, cls: 'force-dark', mem: 48 });
  const T = { cwd: arg.cwd || HOME, root: false, env: {}, status: 0, busy: false, cancel: false, hist: store.get('hist', []), hi: null, win, oldpwd: null, repl: null, sudoUntil: 0, onKey: null, lastTab: null, size: 13.5 };
  T.env = { HOME, USER, LOGNAME: USER, SHELL: '/bin/bash', TERM: 'xterm-256color', LANG: 'en_US.UTF-8', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', HOSTNAME: HOST, DESKTOP_SESSION: 'dusk', XDG_SESSION_TYPE: 'wayland', COLORTERM: 'truecolor' };
  Object.defineProperty(T.env, 'PWD', { get: () => T.cwd, enumerable: true, configurable: true });
  Object.defineProperty(T.env, '?', { get: () => String(T.status), enumerable: false });
  Object.defineProperty(T.env, 'RANDOM', { get: () => String(Math.floor(Math.random() * 32768)), enumerable: false });
  Object.defineProperty(T.env, 'SECONDS', { get: () => String(Math.floor((Date.now() - T.started) / 1000)), enumerable: false });
  Object.defineProperty(T.env, '$', { get: () => String(win.pid + 3), enumerable: false });
  T.started = Date.now(); T.funcs = {}; T.pending = null;
  T.aliases = store.get('aliases', { ll: 'ls -alF', la: 'ls -A', l: 'ls -CF' });
  win.hl.append(hbtn('plus', 'New Window', () => TerminalApp({ cwd: T.cwd })));
  win.hr.append(hbtn('search', 'Find', () => notify('terminal', 'Find', 'Use Ctrl+F of your browser to search the output.')));
  const menuB = hbtn('menu', 'Main Menu', () => menuAt(menuB, [
    { label: 'New Window', kb: 'Ctrl+Shift+N', action: () => TerminalApp({ cwd: T.cwd }) }, '-',
    { label: 'Zoom In', action: () => zoom(1) }, { label: 'Zoom Out', action: () => zoom(-1) }, { label: 'Reset Zoom', action: () => zoom(0) }, '-',
    { label: 'Clear Scrollback', action: () => { out.innerHTML = ''; } }, { label: 'Keyboard Shortcuts', action: () => runDisplay('help') }, '-',
    { label: 'About Terminal', action: () => notify('terminal', 'Terminal 46.0', 'A terminal emulator for the Dusk desktop.') }]));
  win.hr.append(menuB);
  const b = win.body; b.classList.add('term');
  b.innerHTML = `<div class="t-scroll" tabindex="-1"><div class="t-out"></div><div class="t-line"><span class="t-ps"></span><span class="t-inw"><input class="t-in" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Terminal input"><span class="t-ghost" aria-hidden="true"></span></span></div></div>`;
  const sc = $('.t-scroll', b), out = $('.t-out', b), line = $('.t-line', b), ps = $('.t-ps', b), inp = $('.t-in', b), ghost = $('.t-ghost', b);
  const tcfg = () => (typeof LOOK === 'function' && LOOK().term) || { scheme: 'night', prompt: 'bash', suggest: false, fastfetch: false, size: 13.5 };
  const zoom = d => { T.size = d === 0 ? tcfg().size : clamp(T.size + d, 9, 24); b.style.fontSize = T.size + 'px'; };
  const applyTermLook = () => {
    const c = tcfg(); b.className = b.className.replace(/\bts-\w+/g, '').trim() + ' ts-' + c.scheme; T.size = c.size; b.style.fontSize = T.size + 'px';
    if (!T.busy && !T.reader && !T.repl && T.pending == null) ps.innerHTML = T.ps1(); updGhost();
  };
  // Fish-style autosuggestion: the newest history entry that starts with what you typed, shown in grey.
  const suggestion = () => { const v = inp.value; if (!tcfg().suggest || !v || T.reader || T.repl || inp.selectionStart !== v.length) return ''; for (let i = T.hist.length - 1; i >= 0; i--) if (T.hist[i].startsWith(v) && T.hist[i] !== v) return T.hist[i].slice(v.length); return ''; };
  const updGhost = () => { const s = suggestion(); ghost.innerHTML = s ? `<span class="t-gv">${esc(inp.value)}</span>${esc(s)}` : ''; };
  inp.addEventListener('input', updGhost); inp.addEventListener('keyup', e => { if (/Arrow|Home|End/.test(e.key)) updGhost(); });
  document.addEventListener('look', applyTermLook);
  T.scroll = () => { sc.scrollTop = sc.scrollHeight; };
  T.print = html => { const d = document.createElement('div'); d.className = 't-l'; d.innerHTML = html; out.append(d); while (out.childElementCount > 1500) out.firstChild.remove(); T.scroll(); return d; };
  T.ps1 = () => {
    if (T.root) return `root@nightos:${T.cwd}# `;
    const p = tcfg().prompt, where = esc(tilde(T.cwd)), bad = T.status ? ` <span class="c-r b">[${T.status}]</span>` : '';
    if (p === 'fish') return `<span class="c-g">night</span>@<span class="c-g">nightos</span> <span class="c-b">${where}</span>${bad}&gt; `;
    if (p === 'arrow') return `<span class="${T.status ? 'c-r' : 'c-g'} b">➜</span>  <span class="c-c b">${where === '~' ? '~' : esc(splitPath(T.cwd)[1] || '/')}</span> `;
    return `<span class="c-g b">night@nightos</span>:<span class="c-b b">${where}</span>$ `;
  };
  win.T = T;
  const setTitle = () => win.setTitle(`${T.root ? 'root' : 'night'}@nightos: ${T.root ? T.cwd : tilde(T.cwd)}`);
  const showPrompt = () => {
    T.busy = false; line.hidden = false; inp.classList.remove('pw');
    ps.innerHTML = T.repl ? T.repl.prompt : T.pending != null ? '&gt; ' : T.ps1(); setTitle(); win.busy = false;
    if (WM.active === win) inp.focus({ preventScroll: true }); T.scroll();
  };
  T.readLine = (prompt, hidden) => new Promise((res, rej) => {
    ps.innerHTML = esc(prompt); line.hidden = false; inp.value = ''; inp.classList.toggle('pw', !!hidden);
    T.reader = { res, rej, prompt, hidden }; inp.focus({ preventScroll: true }); T.scroll();
  });
  win.onFocus = () => { if (!T.busy || T.reader) inp.focus({ preventScroll: true }); else sc.focus({ preventScroll: true }); };
  win.onClose = () => { T.cancel = true; T.closed = true; if (T.nodeWorker) T.nodeWorker.terminate(); document.removeEventListener('look', applyTermLook); };
  sc.addEventListener('mouseup', () => { if (!String(getSelection())) win.onFocus(); });
  async function submit() {
    const v = inp.value; inp.value = ''; T.lastTab = null; ghost.innerHTML = '';
    if (T.reader) {
      const r = T.reader; T.reader = null; T.print(esc(r.prompt) + (r.hidden ? '' : esc(v))); line.hidden = true; inp.classList.remove('pw'); r.res(v); return;
    }
    T.print((T.repl ? T.repl.prompt : T.pending != null ? '&gt; ' : T.ps1()) + esc(v));
    if (T.repl) {
      T.busy = true; line.hidden = true; sc.focus({ preventScroll: true });
      try { await T.repl.handle(v); } catch (e) { if (e === 'SIGINT') T.print('^C'); else T.print(esc(String(e.message || e))); }
      T.cancel = false; if (!T.closed) showPrompt(); return;
    }
    let src = v;
    if (src.includes('!!') && T.hist.length && T.pending == null) { src = src.replace(/!!/g, T.hist[T.hist.length - 1]); T.print(esc(src)); }
    if (T.pending != null) src = T.pending + '\n' + src;
    try { parseSource(src); T.pending = null; }
    catch (e) { if (e === INCOMPLETE) { T.pending = src; showPrompt(); return; } T.pending = null; }
    const histLine = src.replace(/(\b(?:do|then|else)|[{(])\n/g, '$1 ').replace(/\n/g, '; ');
    if (histLine.trim()) { if (T.hist[T.hist.length - 1] !== histLine) T.hist.push(histLine); if (T.hist.length > 500) T.hist.shift(); store.set('hist', T.hist); }
    T.hi = null; T.busy = true; line.hidden = true; win.busy = true; sc.focus({ preventScroll: true });
    try { T.status = await runLine(T, src); }
    catch (e) { if (e === 'SIGINT') { T.print('^C'); T.status = 130; } else { T.print(esc('bash: ' + (e.message || e))); T.status = 1; } }
    T.cancel = false; T.onKey = null; sc.classList.remove('alt');
    if (!T.closed) showPrompt();
  }
  T.runDisplay = runDisplay;
  async function runDisplay(cmd) { if (T.busy) return; inp.value = cmd; submit(); }
  b.addEventListener('keydown', e => {
    const k = e.key;
    if (e.ctrlKey && (k === 'c' || k === 'C') && !e.shiftKey && !String(getSelection())) {
      e.preventDefault();
      if (T.reader) { const r = T.reader; T.reader = null; T.print(esc(r.prompt) + '^C'); line.hidden = true; r.rej('SIGINT'); return; }
      if (T.busy) { T.cancel = true; return; }
      T.print((T.repl ? T.repl.prompt : T.pending != null ? '&gt; ' : T.ps1()) + esc(inp.value) + '^C'); inp.value = ''; T.pending = null;
      if (T.repl) { if (T.repl.buf) T.repl.buf = []; T.repl.prompt = T.repl.prompt0 || T.repl.prompt; T.print(T.repl.interrupt || 'KeyboardInterrupt'); } showPrompt(); return;
    }
    if (T.busy && !T.reader) { if (T.onKey) { e.preventDefault(); T.onKey(e); } return; }
    if (e.ctrlKey && e.shiftKey && (k === 'N' || k === 'n')) { e.preventDefault(); TerminalApp({ cwd: T.cwd }); return; }
    if (e.ctrlKey && (k === 'l' || k === 'L')) { e.preventDefault(); out.innerHTML = ''; return; }
    if (e.ctrlKey && (k === 'd' || k === 'D') && !inp.value) { e.preventDefault(); if (T.repl) { T.print(T.repl.prompt); T.repl = null; showPrompt(); } else if (T.root) { T.print(T.ps1() + 'exit'); T.root = false; showPrompt(); } else closeWin(win, true); return; }
    if (e.ctrlKey && (k === 'u' || k === 'U')) { e.preventDefault(); inp.value = inp.value.slice(inp.selectionStart); inp.setSelectionRange(0, 0); return; }
    if (e.ctrlKey && (k === 'a' || k === 'A')) { e.preventDefault(); inp.setSelectionRange(0, 0); return; }
    if (e.ctrlKey && (k === 'e' || k === 'E')) { e.preventDefault(); inp.setSelectionRange(inp.value.length, inp.value.length); return; }
    if (e.ctrlKey && (k === '=' || k === '+')) { e.preventDefault(); zoom(1); return; }
    if (e.ctrlKey && k === '-') { e.preventDefault(); zoom(-1); return; }
    if (e.target !== inp) { if (k.length === 1 && !e.ctrlKey && !e.metaKey) inp.focus(); else return; }
    if ((k === 'ArrowRight' || k === 'End') && inp.selectionStart === inp.value.length) { const s = suggestion(); if (s) { e.preventDefault(); inp.value += s; updGhost(); return; } }
    if (k === 'Enter') { e.preventDefault(); submit(); }
    else if (k === 'Tab') { e.preventDefault(); if (!T.reader && !T.repl) complete(); }
    else if (k === 'ArrowUp' && !T.reader) { e.preventDefault(); if (!T.hist.length) return; T.hi = T.hi == null ? T.hist.length - 1 : Math.max(0, T.hi - 1); inp.value = T.hist[T.hi]; setTimeout(() => inp.setSelectionRange(inp.value.length, inp.value.length)); }
    else if (k === 'ArrowDown' && !T.reader) { e.preventDefault(); if (T.hi == null) return; T.hi++; if (T.hi >= T.hist.length) { T.hi = null; inp.value = ''; } else inp.value = T.hist[T.hi]; }
  });
  function complete() {
    const pos = inp.selectionStart, before = inp.value.slice(0, pos), after = inp.value.slice(pos);
    const m = before.match(/(?:^|[\s|;&])((?:\\ |[^\s|;&])*)$/), word = m ? m[1] : '', raw = word.replace(/\\ /g, ' ');
    const pre = before.slice(0, before.length - word.length).trim(), first = pre === '' || pre === 'sudo' || /[|;&]$/.test(pre);
    let cands = [];
    if (first && !raw.includes('/')) cands = [...new Set(Object.keys(CMDS).filter(c => !CMD_PKG[c] || INSTALLED.has(CMD_PKG[c])))].filter(c => c.startsWith(raw)).sort().map(c => ({ full: c, show: c, sfx: ' ' }));
    else {
      const sl = raw.lastIndexOf('/'), dirPart = sl >= 0 ? raw.slice(0, sl + 1) : '', base = raw.slice(sl + 1);
      const dn = getNode(resolve((dirPart.startsWith('~') ? HOME + dirPart.slice(1) : dirPart) || '.', T.cwd));
      if (dn && dn.type === 'dir') cands = Object.keys(dn.children).filter(k => k.startsWith(base) && (base.startsWith('.') || !k.startsWith('.'))).sort().map(k => ({ full: dirPart + k, show: k + (dn.children[k].type === 'dir' ? '/' : ''), sfx: dn.children[k].type === 'dir' ? '/' : ' ' }));
    }
    const put = s => { const e2 = s.replace(/ /g, '\\ '); inp.value = before.slice(0, before.length - word.length) + e2 + after; const c = before.length - word.length + e2.length; inp.setSelectionRange(c, c); };
    if (cands.length === 1) put(cands[0].full + cands[0].sfx);
    else if (cands.length > 1) {
      let pfx = cands[0].full; for (const c of cands) while (!c.full.startsWith(pfx)) pfx = pfx.slice(0, -1);
      if (pfx.length > raw.length) put(pfx);
      else if (T.lastTab === before) { T.print(T.ps1() + esc(inp.value)); T.print(lsGridHTML(cands.map(c => esc(c.show)), Math.max(...cands.map(c => c.show.length)))); }
      T.lastTab = before;
    }
  }
  applyTermLook();
  if (tcfg().fastfetch) { try { CMDS.neofetch(makeCtx(T, { stdin: null, tty: true })); T.print(''); } catch (e) { } }
  else if (firstTerm) T.print('To run a command as administrator (user "root"), use "sudo &lt;command&gt;".\nSee "man sudo_root" for details.\n');
  firstTerm = false;
  showPrompt();
  return win;
}
const lsGridHTML = (items, maxLen) => `<div class="ls" style="grid-template-columns:repeat(auto-fill,${maxLen + 2}ch)">${items.map(i => `<span>${i}</span>`).join('')}</div>`;

/* ================= execution (the interpreter itself lives in bash.js) ================= */
function makeCtx(T, { stdin, tty, root, io }) {
  const c = {
    T, stdin, tty, buf: [], root: root || T.root, io: io || {},
    out(t) { if (tty) T.print(esc(t)); else c.buf.push(String(t)); },
    html(h, plain) { if (tty) T.print(h); else c.buf.push(plain != null ? plain : h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")); },
    err(t) { T.print(esc(t)); return 1; },
    path: p => resolve(p, T.cwd),
    sleep: (ms, stop) => new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { if (T.cancel) { clearInterval(iv); T.cancel = false; rej('SIGINT'); } else if (stop && stop()) { clearInterval(iv); res(true); } else if (Date.now() - t0 >= ms) { clearInterval(iv); res(false); } }, 25); }),
    input() { return c.stdin != null ? c.stdin : null; },
    live() { const d = T.print(''); d.classList.add('t-live'); return d; }
  };
  return c;
}
async function execArgv(c, argv) {
  const T = c.T; let [cmd, ...args] = argv;
  while (/^[A-Za-z_]\w*=/.test(cmd)) { const i = cmd.indexOf('='); T.env[cmd.slice(0, i)] = cmd.slice(i + 1); if (!args.length) return 0; [cmd, ...args] = args; }
  if (T.aliases[cmd] && !c.noAlias) { c.noAlias = true; const al = tokenize(T.aliases[cmd], T.env).map(t => t.v); return execArgv(c, [...al, ...args]); }
  if (T.funcs[cmd]) return callFunction(c, cmd, args);
  if (cmd.includes('/')) {
    const p = c.path(cmd), n = getNode(p);
    if (!n) return c.err(`bash: ${cmd}: No such file or directory`), 127;
    if (n.type === 'dir') return c.err(`bash: ${cmd}: Is a directory`), 126;
    if (!n.exec) return c.err(`bash: ${cmd}: Permission denied`), 126;
    if (n.bin) cmd = splitPath(p)[1]; else return runScript(c, n, p, args);
  }
  const fn = CMDS[cmd];
  if (fn && (!CMD_PKG[cmd] || INSTALLED.has(CMD_PKG[cmd]))) {
    try { const r = await fn(c, args); return r == null ? 0 : r; }
    catch (e) { if (e === 'SIGINT') throw e; c.err(`${cmd}: ${e.message || ERR[e] || e}`); return 1; }
  }
  if (CMD_PKG[cmd]) { c.err(`Command '${cmd}' not found, but can be installed with:\n\nsudo apt install ${CMD_PKG[cmd]}\n`); return 127; }
  const sugg = { python: 'python3', vim: 'nano', vi: 'nano', code: null, node: null, docker: null, pip: null };
  if (cmd in sugg) { c.err(sugg[cmd] ? `Command '${cmd}' not found, did you mean:\n  command '${sugg[cmd]}' from deb ${sugg[cmd]}\n` : `Command '${cmd}' not found, but can be installed with:\n\nsudo snap install ${cmd}\n`); return 127; }
  c.err(`${cmd}: command not found`); return 127;
}
function dateStr(d = new Date()) {
  let tz = 'UTC'; try { tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName').value; } catch (e) { }
  return `${WD[d.getDay()]} ${MON[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${hhmm(d)}:${pad(d.getSeconds())} ${tz} ${d.getFullYear()}`;
}
async function sudoAuth(c) {
  const T = c.T; if (T.root || T.sudoUntil > Date.now()) return true;
  for (let i = 0; i < 3; i++) {
    const pw = await T.readLine('[sudo] password for night: ', true);
    if (pw) { T.sudoUntil = Date.now() + 5 * 60000; return true; }
    await c.sleep(1400); T.print(i < 2 ? 'Sorry, try again.' : 'sudo: 3 incorrect password attempts');
  }
  return false;
}
function lsName(k, v) {
  const q = /\s/.test(k) ? `'${k}'` : k, e = esc(q), kind = fileKind(k, v);
  if (v.type === 'dir') return `<span class="c-b b">${e}</span>`;
  if (['archive', 'iso', 'deb'].includes(kind)) return `<span class="c-r b">${e}</span>`;
  if (kind === 'image') return `<span class="c-m b">${e}</span>`;
  if (v.exec) return `<span class="c-g b">${e}</span>`;
  return e;
}
function lsDate(t) { const d = new Date(t), old = Date.now() - t > 182 * DAY; return `${MON[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${old ? ' ' + d.getFullYear() : hhmm(d)}`; }
function permStr(v) { return v.type === 'dir' ? 'drwxr-xr-x' : v.exec ? '-rwxr-xr-x' : '-rw-r--r--'; }

/* ================= commands ================= */
const CMDS = {
  help(c) {
    const names = Object.keys(CMDS).filter(k => !CMD_PKG[k] || INSTALLED.has(CMD_PKG[k])).sort();
    c.out('NightOS bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)\nThese commands are available. Type `man name\' to find out more about `name\'.\n');
    if (c.tty) c.html(lsGridHTML(names.map(esc), 12)); else c.out(names.join('\n'));
    c.out('\nShortcuts: Tab completes, Up/Down browse history, Ctrl+C interrupts, Ctrl+L clears, Ctrl+D exits.');
  },
  ls(c, a) {
    const f = parseFlags(a), all = f.has('a') || f.has('A'), long = f.has('l'), human = f.has('h'), targets = f.args.length ? f.args : ['.']; let st = 0;
    targets.forEach((t, ti) => {
      const p = c.path(t), n = getNode(p);
      if (!n) { c.err(`ls: cannot access '${t}': No such file or directory`); st = 2; return; }
      if (!canRead(p, c.root)) { c.err(`ls: cannot open directory '${t}': Permission denied`); st = 2; return; }
      let ents = n.type === 'dir' ? Object.keys(n.children).filter(k => all || !k.startsWith('.')).sort((x, y) => x.replace(/^\./, '').localeCompare(y.replace(/^\./, ''))).map(k => [k, n.children[k]]) : [[t, n]];
      if (n.type === 'dir' && f.has('a')) ents = [['.', n], ['..', getNode(splitPath(p)[0])], ...ents];
      if (targets.length > 1 && n.type === 'dir') c.out((ti ? '\n' : '') + t + ':');
      if (long) {
        if (n.type === 'dir') c.out('total ' + ents.reduce((s, [, v]) => s + Math.ceil(nodeSize(v) / 4096) * 4, 0));
        const owner = inHome(p) ? 'night' : 'root';
        const sizes = ents.map(([, v]) => human ? humanIEC(nodeSize(v)) : String(nodeSize(v))), w = Math.max(...sizes.map(s => s.length));
        ents.forEach(([k, v], i) => c.html(`${permStr(v)} ${v.type === 'dir' ? Object.values(v.children).filter(x => x.type === 'dir').length + 2 : 1} ${owner} ${owner} ${sizes[i].padStart(w)} ${lsDate(v.mtime)} ${lsName(k, v)}`));
      } else if (c.tty) { if (ents.length) c.html(lsGridHTML(ents.map(([k, v]) => lsName(k, v)), Math.max(...ents.map(([k]) => k.length + (/\s/.test(k) ? 2 : 0))))); }
      else ents.forEach(([k]) => c.out(k));
    });
    return st;
  },
  cd(c, a) {
    const t = a[0] ?? '~', p = t === '-' ? (c.T.oldpwd || c.T.cwd) : c.path(t), n = getNode(p);
    if (a.length > 1) return c.err('bash: cd: too many arguments');
    if (!n) return c.err(`bash: cd: ${t}: No such file or directory`);
    if (n.type !== 'dir') return c.err(`bash: cd: ${t}: Not a directory`);
    if (!canRead(p, c.root)) return c.err(`bash: cd: ${t}: Permission denied`);
    c.T.oldpwd = c.T.cwd; c.T.cwd = p; if (t === '-') c.out(p);
  },
  pwd(c) { c.out(c.T.cwd); },
  cat(c, a) {
    const f = parseFlags(a); if (!f.args.length) { if (c.stdin != null) c.stdin.split('\n').forEach((l, i) => c.out(f.has('n') ? `${String(i + 1).padStart(6)}\t${l}` : l)); return; }
    let st = 0, ln = 1;
    for (const t of f.args) {
      const p = c.path(t), n = getNode(p);
      if (!n) { c.err(`cat: ${t}: No such file or directory`); st = 1; continue; }
      if (n.type === 'dir') { c.err(`cat: ${t}: Is a directory`); st = 1; continue; }
      if (!canRead(p, c.root)) { c.err(`cat: ${t}: Permission denied`); st = 1; continue; }
      let txt = n.content || ''; if (n.bin) txt = n.content + '\uFFFD\uFFFD\u0002\uFFFD@\uFFFD'; if (n.size != null && !n.bin && !txt) txt = '\uFFFD\uFFFD\uFFFDI\uFFFD\u0012\uFFFD\uFFFDPK\u0003\u0004\uFFFD';
      if (txt.content === undefined && n.content && n.content.startsWith('wall:')) txt = '\uFFFDPNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR\uFFFD\uFFFD';
      txt = txt.replace(/\n$/, '');
      if (f.has('n')) txt = txt.split('\n').map(l => `${String(ln++).padStart(6)}\t${l}`).join('\n');
      c.out(txt);
    }
    return st;
  },
  mkdir(c, a) {
    const f = parseFlags(a); if (!f.args.length) return c.err("mkdir: missing operand\nTry 'mkdir --help' for more information.");
    let st = 0; for (const t of f.args) { try { fsMkdir(c.path(t), { parents: f.has('p'), root: c.root }); if (f.has('v')) c.out(`mkdir: created directory '${t}'`); } catch (e) { c.err(`mkdir: cannot create directory ‘${t}’: ${ERR[e]}`); st = 1; } }
    return st;
  },
  touch(c, a) {
    if (!a.length) return c.err("touch: missing file operand\nTry 'touch --help' for more information.");
    let st = 0; for (const t of a) { const p = c.path(t), n = getNode(p); try { if (n) { if (!canWrite(p, c.root)) throw 'EACCES'; n.mtime = Date.now(); fsChanged(); } else fsWrite(p, '', { root: c.root }); } catch (e) { c.err(`touch: cannot touch '${t}': ${ERR[e]}`); st = 1; } }
    return st;
  },
  async rm(c, a) {
    const f = parseFlags(a), rec = f.has('r') || f.has('R'), force = f.has('f');
    if (!f.args.length) return force ? 0 : c.err("rm: missing operand\nTry 'rm --help' for more information.");
    let st = 0;
    for (const t of f.args) {
      const p = c.path(t);
      if (p === '/' && rec) {
        if (!f.long('no-preserve-root')) { c.err("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe"); st = 1; continue; }
        if (!c.root) { for (const k of Object.keys(FS.children)) { c.err(`rm: cannot remove '/${k}': Permission denied`); await c.sleep(30); } st = 1; continue; }
        const victims = ['/usr/bin/sudo', '/usr/lib/x86_64-linux-gnu/libc.so.6', '/usr/share/icons/Nocturne', '/etc/passwd', '/etc/fstab', '/boot/vmlinuz-6.8.0-45-night', '/bin/ls', '/bin/bash'];
        for (let i = 0; i < 70; i++) { c.out(f.has('v') || i % 1 === 0 ? `removed '${victims[i % victims.length]}${i > 7 ? '.' + i : ''}'` : ''); await c.sleep(20); }
        c.err('bash: /usr/bin/dusk-shell: No such file or directory'); await c.sleep(600);
        SYSTEM.panic('rm'); return 1;
      }
      const n = getNode(p);
      if (!n) { if (!force) { c.err(`rm: cannot remove '${t}': No such file or directory`); st = 1; } continue; }
      if (n.type === 'dir' && !rec) { c.err(`rm: cannot remove '${t}': Is a directory`); st = 1; continue; }
      try { fsRemove(p, { recursive: rec, root: c.root }); if (f.has('v')) c.out(`removed '${t}'`); } catch (e) { c.err(`rm: cannot remove '${t}': ${ERR[e]}`); st = 1; }
    }
    return st;
  },
  rmdir(c, a) {
    let st = 0; for (const t of a) { const p = c.path(t), n = getNode(p); if (!n) { c.err(`rmdir: failed to remove '${t}': No such file or directory`); st = 1; } else if (n.type !== 'dir') { c.err(`rmdir: failed to remove '${t}': Not a directory`); st = 1; } else if (Object.keys(n.children).length) { c.err(`rmdir: failed to remove '${t}': Directory not empty`); st = 1; } else try { fsRemove(p, { recursive: true, root: c.root }); } catch (e) { c.err(`rmdir: failed to remove '${t}': ${ERR[e]}`); st = 1; } }
    return st;
  },
  mv(c, a) { const f = parseFlags(a); if (f.args.length < 2) return c.err(`mv: missing destination file operand after '${f.args[0] || ''}'`); const dst = c.path(f.args.pop()); let st = 0; for (const s of f.args) { try { fsMove(c.path(s), dst, { root: c.root }); } catch (e) { c.err(`mv: cannot move '${s}': ${ERR[e]}`); st = 1; } } return st; },
  cp(c, a) {
    const f = parseFlags(a); if (f.args.length < 2) return c.err(`cp: missing destination file operand after '${f.args[0] || ''}'`);
    const dst = c.path(f.args.pop()); let st = 0;
    for (const s of f.args) { const n = getNode(c.path(s)); if (n && n.type === 'dir' && !(f.has('r') || f.has('R') || f.has('a'))) { c.err(`cp: -r not specified; omitting directory '${s}'`); st = 1; continue; } try { fsMove(c.path(s), dst, { root: c.root, copy: true }); } catch (e) { c.err(`cp: cannot stat '${s}': ${ERR[e]}`); st = 1; } }
    return st;
  },
  clear(c) { if (c.tty) c.T.win.body.querySelector('.t-out').innerHTML = ''; },
  reset(c) { return CMDS.clear(c); },
  whoami(c) { c.out(c.root ? 'root' : USER); },
  id(c) { c.out(c.root ? 'uid=0(root) gid=0(root) groups=0(root)' : 'uid=1000(night) gid=1000(night) groups=1000(night),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),100(users),114(lpadmin)'); },
  groups(c) { c.out(c.root ? 'root' : 'night adm cdrom sudo dip plugdev users lpadmin'); },
  hostname(c) { c.out(HOST); },
  uname(c, a) {
    const f = parseFlags(a), K = { s: 'Linux', n: HOST, r: '6.8.0-45-night', v: '#47-NightOS SMP PREEMPT_DYNAMIC Tue Oct 13 09:12:44 UTC 2026', m: REAL.arch || 'x86_64', p: REAL.arch || 'x86_64', i: REAL.arch || 'x86_64', o: 'GNU/Linux' };
    if (f.has('a')) return c.out(Object.values(K).join(' '));
    const sel = 'snrvmpio'.split('').filter(k => f.has(k)); c.out((sel.length ? sel : ['s']).map(k => K[k]).join(' '));
  },
  lsb_release(c, a) { c.out(a.length ? 'No LSB modules are available.\nDistributor ID:\tNightOS\nDescription:\tNightOS 24.10\nRelease:\t24.10\nCodename:\tumbra' : 'No LSB modules are available.'); },
  date(c) { c.out(dateStr()); },
  cal(c) {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const title = `${MONTHS[m]} ${y}`; let s = ' '.repeat(Math.floor((20 - title.length) / 2)) + title + '\nSu Mo Tu We Th Fr Sa\n', row = '   '.repeat(first);
    const cells = []; for (let i = 1; i <= days; i++) { const t = String(i).padStart(2); cells.push(i === d.getDate() && c.tty ? `<span class="inv">${t}</span>` : t); }
    let html = esc(s) + '   '.repeat(first), col = first;
    cells.forEach((t, i) => { html += t; col++; if (col === 7 && i < cells.length - 1) { html += '\n'; col = 0; } else if (i < cells.length - 1) html += ' '; });
    c.html(html);
  },
  uptime(c, a) {
    const n = new Date(); if (a[0] === '-p') return c.out('up ' + uptimeStr().replace('min', 'minute'));
    c.out(` ${hhmm(n)}:${pad(n.getSeconds())} up ${uptimeStr(true).padStart(5)},  1 user,  load average: ${loadAvg().join(', ')}`);
  },
  neofetch(c) {
    const W = Math.round((screen.width || innerWidth) * (devicePixelRatio || 1)), H = Math.round((screen.height || innerHeight) * (devicePixelRatio || 1));
    const art = ['            .::-=-::.     ', '         .-==-:.          ', '       .===:              ', '      -===:               ', '     :====                ', '     ====-                ', '     ====-                ', '     :====.               ', '      -====:          .   ', '       :=====-:...:-=+:   ', '         :-=======+=-.    ', '            .::--::.      ', '                          ', '                          '];
    const info = [`<span class="c-acc b">night</span>@<span class="c-acc b">nightos</span>`, '-------------',
      ['OS', `NightOS 24.10 (Umbra) ${REAL.arch || 'x86_64'}`], ['Host', REAL.host || 'Browser Virtual Machine'], ['Kernel', '6.8.0-45-night'], ['Uptime', uptimeStr()], ['Packages', `${1873 + INSTALLED.size} (dpkg), 12 (flatpak)`],
      ['Shell', 'bash 5.2.21'], ['Resolution', `${W}x${H}`], ['DE', 'Dusk 46.2'], ['WM', 'Dusk-WM'], ['Theme', `${(typeof THEMES !== 'undefined' && THEMES[CFG.theme] ? THEMES[CFG.theme].name : 'Custom')}-${CFG.style}`], ['Icons', 'Nocturne [GTK3]'],
      ['Terminal', 'night-terminal'], ['CPU', `${CPU_NAME} (${SYS.cores}) @ 3.20GHz`], ['GPU', gpuName()], ['Memory', `${Math.round(SYS.mem)}MiB / ${Math.round(SYS.memTotal)}MiB`]];
    const pal = ['#2e3436', '#cc0000', '#4e9a06', '#c4a000', '#3465a4', '#75507b', '#06989a', '#d3d7cf'], pal2 = ['#555753', '#ef2929', '#8ae234', '#fce94f', '#729fcf', '#ad7fa8', '#34e2e2', '#eeeeec'];
    const rows = info.map(x => typeof x === 'string' ? x : `<span class="c-acc b">${x[0]}</span>: ${esc(x[1])}`);
    rows.push('', pal.map(p => `<span style="background:${p}">   </span>`).join(''), pal2.map(p => `<span style="background:${p}">   </span>`).join(''));
    const n = Math.max(art.length, rows.length); let html = '', plain = '';
    for (let i = 0; i < n; i++) { const a = art[i] || ' '.repeat(26); html += `<span class="c-acc b">${esc(a)}</span>  ${rows[i] || ''}\n`; plain += a + '  ' + (rows[i] || '').replace(/<[^>]+>/g, '') + '\n'; }
    c.html(html.replace(/\n$/, ''), plain);
  },
  fastfetch(c) { return CMDS.neofetch(c); },
  history(c, a) { if (a[0] === '-c') { c.T.hist.length = 0; store.set('hist', []); return; } const h = c.T.hist, s = Math.max(0, h.length - (+a[0] || 1000)); for (let i = s; i < h.length; i++) c.out(`${String(i + 1).padStart(5)}  ${h[i]}`); },
  async man(c, a) {
    const n = a.filter(x => !/^\d$/.test(x))[0]; if (!n) { c.err('What manual page do you want?\nFor example, try \'man man\'.'); return 1; }
    if (n === 'sudo_root') { c.out('sudo_root: users in the "sudo" group can run any command as root with sudo <command>.\nYour own password is used for authentication.'); return; }
    if (!DESC[n]) return c.err(`No manual entry for ${n}`), 16;
    const U = n.toUpperCase(), hdr = `${U}(1)`.padEnd(30) + 'User Commands'.padEnd(30) + `${U}(1)`;
    const body = `${hdr}\n\n<b>NAME</b>\n       ${esc(n)} - ${esc(DESC[n])}\n\n<b>SYNOPSIS</b>\n       <b>${esc(n)}</b> [<u>OPTION</u>]... [<u>FILE</u>]...\n\n<b>DESCRIPTION</b>\n       ${esc(DESC[n].charAt(0).toUpperCase() + DESC[n].slice(1))}.\n\n       This is the NightOS sandbox build of ${esc(n)}. Common options behave\n       like their GNU counterparts where it makes sense in a browser.\n\n<b>AUTHOR</b>\n       Packaged for NightOS by the NightOS developers.\n\n<b>SEE ALSO</b>\n       help(1), bash(1)\n\nNightOS 24.10                     October 2026                     ${U}(1)`;
    if (!c.tty) { c.html(body); return; }
    const T = c.T, sc = T.win.body.querySelector('.t-scroll'), lv = c.live(); let quit = false;
    sc.classList.add('alt'); lv.innerHTML = body + `\n\n<span class="inv"> Manual page ${esc(n)}(1) line 1 (press q to quit)</span>`;
    T.onKey = e => { if (e.key === 'q' || e.key === 'Escape') quit = true; };
    try { await c.sleep(1e9, () => quit); } finally { sc.classList.remove('alt'); lv.remove(); T.onKey = null; }
  },
  async sudo(c, a) {
    if (!a.length) return c.err('usage: sudo -h | -K | -k | -V\nusage: sudo -v [-ABkNnS] [-g group] [-h host] [-p prompt] [-u user]\nusage: sudo [-ABbEHkNnPS] [-C num] [-D directory] [-g group] [-h host] [-p prompt] [-R directory] [-T timeout] [-u user] [VAR=value] [-i | -s] [command [arg ...]]');
    if (a[0] === '-k' || a[0] === '-K') { c.T.sudoUntil = 0; return; }
    if (!(await sudoAuth(c))) return 1;
    if (a[0] === '-i' || a[0] === '-s' || (a[0] === 'su' && a.length <= 2)) { c.T.root = true; return; }
    if (a[0] === '!!') { const h = c.T.hist; const prev = h[h.length - 2]; if (!prev) return c.err('bash: !!: event not found'); c.out('sudo ' + prev); a = tokenize(prev, c.T.env).map(t => t.v); }
    c.root = true; return execArgv(c, a);
  },
  async su(c) { if (c.root) { c.T.root = true; return; } await c.T.readLine('Password: ', true); await c.sleep(1800); return c.err('su: Authentication failure'); },
  async apt(c, a) {
    const sub = a[0], pk = a.slice(1).filter(x => !x.startsWith('-')), yes = a.includes('-y') || a.includes('--yes');
    const online = netUp();
    const lock = () => c.err('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?');
    const reading = async () => { c.out('Reading package lists... Done'); await c.sleep(120); c.out('Building dependency tree... Done'); await c.sleep(80); c.out('Reading state information... Done'); };
    if (!sub || sub === 'help' || sub === '--help') { c.out('apt 2.7.14 (amd64)\nUsage: apt [options] command\n\nMost used commands:\n  list - list packages based on package names\n  search - search in package descriptions\n  show - show package details\n  install - install packages\n  remove - remove packages\n  update - update list of available packages\n  upgrade - upgrade the system by installing/upgrading packages'); return; }
    if (sub === 'list') {
      if (a.includes('--upgradable')) { c.out('Listing... Done'); if (!CFG.upgraded) UPGRADES.forEach(([n, o, v]) => c.html(`<span class="c-g">${n}</span>/umbra-updates ${v} amd64 [upgradable from: ${o}]`)); return; }
      c.out('Listing... Done'); [['base-files', '24.10night1'], ['bash', '5.2.21-2night4'], ['coreutils', '9.4-3night6'], ['dusk-shell', CFG.upgraded ? '46.3-0night1' : '46.2-0night1'], ['nightfox', CFG.upgraded ? '131.0.3' : '131.0.2'], ['python3', '3.12.3-0night2']].concat([...INSTALLED].map(n => [n, PKGS[n].v])).forEach(([n, v]) => c.html(`<span class="c-g">${n}</span>/umbra,now ${v} amd64 [installed]`)); return;
    }
    if (sub === 'search') { c.out('Sorting... Done\nFull Text Search... Done'); Object.entries(PKGS).filter(([n]) => !pk[0] || n.includes(pk[0]) || (DESC[PKGS[n].cmds[0]] || '').includes(pk[0])).forEach(([n, p]) => c.html(`<span class="c-g">${n}</span>/umbra ${p.v} amd64${INSTALLED.has(n) ? ' [installed]' : ''}\n  ${esc(DESC[p.cmds[0]] || n)}\n`)); return; }
    if (sub === 'show') { const p = PKGS[pk[0]]; if (!p) return c.err(`N: Unable to locate package ${pk[0]}\nE: No packages found`), 100; c.out(`Package: ${pk[0]}\nVersion: ${p.v}\nPriority: optional\nSection: ${p.sec}\nMaintainer: NightOS Developers <devel@lists.nightos.org>\nDownload-Size: ${p.s}\nInstalled-Size: ${p.i}\nDescription: ${DESC[p.cmds[0]] || pk[0]}`); return; }
    if (!c.root) return lock(), 100;
    const prog = c.tty ? c.live() : null;
    const progress = async (steps) => { for (let i = 1; i <= steps; i++) { if (prog) { const pc = Math.round(i / steps * 100), w = 50, f = Math.round(pc / 100 * w); prog.innerHTML = `<span style="background:#4e9a06;color:#000">Progress: [${String(pc).padStart(3)}%]</span> [${'#'.repeat(f)}${'.'.repeat(w - f)}]`; } await c.sleep(90); } if (prog) prog.remove(); };
    if (sub === 'update') {
      if (!online) { c.out('Ign:1 http://archive.nightos.org/nightos umbra InRelease'); await c.sleep(1500); c.out("Err:1 http://archive.nightos.org/nightos umbra InRelease\n  Temporary failure resolving 'archive.nightos.org'"); if (prog) prog.remove(); c.out('Reading package lists... Done'); c.err("W: Failed to fetch http://archive.nightos.org/nightos/dists/umbra/InRelease  Temporary failure resolving 'archive.nightos.org'\nW: Some index files failed to download. They have been ignored, or old ones used instead."); return 0; }
      const L = ['Hit:1 http://archive.nightos.org/nightos umbra InRelease', 'Get:2 http://archive.nightos.org/nightos umbra-updates InRelease [126 kB]', 'Get:3 http://security.nightos.org/nightos umbra-security InRelease [126 kB]', 'Hit:4 http://archive.nightos.org/nightos umbra-backports InRelease', 'Get:5 http://archive.nightos.org/nightos umbra-updates/main amd64 Packages [512 kB]', 'Get:6 http://archive.nightos.org/nightos umbra-updates/universe amd64 Packages [361 kB]'];
      if (prog) prog.remove(); for (const l of L) { c.out(l); await c.sleep(220 + Math.random() * 300); }
      c.out('Fetched 1,125 kB in 2s (612 kB/s)'); await reading();
      c.out(CFG.upgraded ? 'All packages are up to date.' : "3 packages can be upgraded. Run 'apt list --upgradable' to see them."); return;
    }
    if (sub === 'upgrade' || sub === 'full-upgrade' || sub === 'dist-upgrade') {
      if (prog) prog.remove(); await reading(); c.out('Calculating upgrade... Done');
      if (CFG.upgraded) { c.out('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'); return; }
      c.out(`The following packages will be upgraded:\n  ${UPGRADES.map(u => u[0]).join(' ')}\n3 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\nNeed to get 412 MB of archives.\nAfter this operation, 2,048 kB of additional disk space will be used.`);
      if (!yes) { const ans = await c.T.readLine('Do you want to continue? [Y/n] '); if (ans && !/^y/i.test(ans)) { c.out('Abort.'); return 1; } }
      if (!online) { c.err("E: Failed to fetch http://archive.nightos.org/nightos/pool/main/d/dusk-shell/dusk-shell_46.3-0night1_amd64.deb  Temporary failure resolving 'archive.nightos.org'\nE: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?"); return 100; }
      for (let i = 0; i < 3; i++) { c.out(`Get:${i + 1} http://archive.nightos.org/nightos umbra-updates/main amd64 ${UPGRADES[i][0]} amd64 ${UPGRADES[i][2]} [${['1,904 kB', '68.2 MB', '342 MB'][i]}]`); await c.sleep(500 + i * 500); }
      c.out('Fetched 412 MB in 6s (68.7 MB/s)');
      const bar = c.tty ? c.live() : null;
      for (const [n, o, v] of UPGRADES) { c.out(`Preparing to unpack .../${n}_${v}_amd64.deb ...\nUnpacking ${n} (${v}) over (${o}) ...`); await c.sleep(300); }
      for (const [n, , v] of UPGRADES) { c.out(`Setting up ${n} (${v}) ...`); await c.sleep(350); }
      if (bar) bar.remove();
      c.out('Processing triggers for man-db (2.12.0-4build2) ...\nProcessing triggers for libglib2.0-0t64:amd64 (2.80.0-6night3) ...');
      CFG.upgraded = true; saveCfg(); notify('settings', 'Updates installed', 'Restart to finish applying the new kernel firmware.'); return;
    }
    if (sub === 'install' || sub === 'reinstall') {
      if (prog) prog.remove();
      if (!pk.length) { await reading(); c.out('0 upgraded, 0 newly installed, 0 to remove and 3 not upgraded.'); return; }
      await reading();
      const bad = pk.find(p => !PKGS[p] && !['python3', 'bash', 'coreutils', 'neofetch', 'nano', 'curl', 'wget'].includes(p));
      if (bad) { c.err(`E: Unable to locate package ${bad}`); return 100; }
      const already = pk.filter(p => !PKGS[p] || INSTALLED.has(p)), todo = pk.filter(p => PKGS[p] && !INSTALLED.has(p));
      already.forEach(p => c.out(`${p} is already the newest version (${PKGS[p] ? PKGS[p].v : '24.10night1'}).`));
      if (!todo.length) { c.out(`0 upgraded, 0 newly installed, 0 to remove and ${CFG.upgraded ? 0 : 3} not upgraded.`); return; }
      const deps = todo.flatMap(p => PKGS[p].deps || []);
      if (deps.length) c.out(`The following additional packages will be installed:\n  ${deps.join(' ')}`);
      c.out(`The following NEW packages will be installed:\n  ${[...todo, ...deps].join(' ')}\n0 upgraded, ${todo.length + deps.length} newly installed, 0 to remove and ${CFG.upgraded ? 0 : 3} not upgraded.\nNeed to get ${PKGS[todo[0]].s} of archives.\nAfter this operation, ${PKGS[todo[0]].i} of additional disk space will be used.`);
      if (deps.length && !yes) { const ans = await c.T.readLine('Do you want to continue? [Y/n] '); if (ans && !/^y/i.test(ans)) { c.out('Abort.'); return 1; } }
      if (!online) { c.err(`Err:1 http://archive.nightos.org/nightos umbra/${PKGS[todo[0]].sec} amd64 ${todo[0]} amd64 ${PKGS[todo[0]].v}\n  Temporary failure resolving 'archive.nightos.org'\nE: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?`); return 100; }
      let gi = 1; for (const p of [...todo, ...deps]) { const P2 = PKGS[p] || { v: '1.0-1', s: '42.1 kB', sec: 'main' }; c.out(`Get:${gi++} http://archive.nightos.org/nightos umbra/${P2.sec} amd64 ${p} ${P2.arch || 'amd64'} ${P2.v} [${P2.s}]`); await c.sleep(250 + Math.random() * 300); }
      c.out(`Fetched ${PKGS[todo[0]].s} in 1s (${Math.round(40 + Math.random() * 400)} kB/s)`);
      const bar = c.tty ? c.live() : null; let step = 0; const total = (todo.length + deps.length) * 3;
      const tick = () => { step++; if (bar) { const pc = Math.round(step / total * 100), f = Math.round(pc / 2); bar.innerHTML = `<span style="background:#4e9a06;color:#000">Progress: [${String(pc).padStart(3)}%]</span> [${'#'.repeat(f)}${'.'.repeat(50 - f)}]`; } };
      for (const p of [...deps, ...todo]) { const v = (PKGS[p] || { v: '1.0-1' }).v; c.out(`Selecting previously unselected package ${p}.`); if (gi > 0) { c.out(`(Reading database ... ${214873 + INSTALLED.size * 37} files and directories currently installed.)`); gi = -1; } tick(); await c.sleep(150); c.out(`Preparing to unpack .../${p}_${v.replace(/^\d+:/, '')}_amd64.deb ...\nUnpacking ${p} (${v}) ...`); tick(); await c.sleep(180); }
      for (const p of [...deps, ...todo]) { c.out(`Setting up ${p} (${(PKGS[p] || { v: '1.0-1' }).v}) ...`); tick(); await c.sleep(160); }
      if (bar) bar.remove();
      c.out('Processing triggers for man-db (2.12.0-4build2) ...');
      todo.forEach(p => INSTALLED.add(p)); saveInstalled(); return;
    }
    if (sub === 'remove' || sub === 'purge' || sub === 'autoremove') {
      if (prog) prog.remove(); await reading();
      const todo = pk.filter(p => INSTALLED.has(p)); pk.filter(p => !INSTALLED.has(p)).forEach(p => c.out(`Package '${p}' is not installed, so not removed`));
      if (!todo.length) { c.out('0 upgraded, 0 newly installed, 0 to remove and 3 not upgraded.'); return; }
      c.out(`The following packages will be REMOVED:\n  ${todo.join(' ')}\n0 upgraded, 0 newly installed, ${todo.length} to remove and 3 not upgraded.`);
      if (!yes) { const ans = await c.T.readLine('Do you want to continue? [Y/n] '); if (ans && !/^y/i.test(ans)) { c.out('Abort.'); return 1; } }
      for (const p of todo) { c.out(`Removing ${p} (${PKGS[p].v}) ...`); await c.sleep(300); INSTALLED.delete(p); }
      saveInstalled(); c.out('Processing triggers for man-db (2.12.0-4build2) ...'); return;
    }
    if (prog) prog.remove(); c.err(`E: Invalid operation ${sub}`); return 100;
  },
  'apt-get'(c, a) { return CMDS.apt(c, a); },
  async ping(c, a) {
    a = a.slice(); const count = +optVal(a, '-c', Infinity); const host = a.filter(x => !x.startsWith('-'))[0];
    if (!host) return c.err('ping: usage error: Destination address required'), 1;
    const local = /^(localhost|127\.\d+\.\d+\.\d+|nightos)$/.test(host), isIP = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    if (!local && (!netUp())) return c.err('ping: connect: Network is unreachable'), 2;
    if (!local && !isIP && !host.includes('.')) return c.err(`ping: ${host}: Temporary failure in name resolution`), 2;
    let h = 0; for (const ch of host) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rtt = navigator.connection && navigator.connection.rtt;
    const ip = local ? '127.0.0.1' : isIP ? host : `203.0.113.${h % 250 + 2}`, base = local ? .04 : rtt ? Math.max(1, rtt * .8) : 9 + h % 30;
    c.out(`PING ${host} (${ip}) 56(84) bytes of data.`);
    const t0 = Date.now(), times = []; let sent = 0, intr = false;
    try { while (sent < count) { if (sent) await c.sleep(1000); sent++; const t = base + Math.random() * (local ? .04 : 6); times.push(t); c.out(`64 bytes from ${local || isIP ? ip : `${host} (${ip})`}: icmp_seq=${sent} ttl=${local ? 64 : 56} time=${t.toFixed(local ? 3 : 1)} ms`); } }
    catch (e) { if (e !== 'SIGINT') throw e; intr = true; c.out('^C'); }
    const mn = Math.min(...times), mx = Math.max(...times), av = times.reduce((x, y) => x + y, 0) / times.length, md = Math.sqrt(times.reduce((s, t) => s + (t - av) ** 2, 0) / times.length);
    c.out(`\n--- ${host} ping statistics ---\n${sent} packets transmitted, ${times.length} received, 0% packet loss, time ${Date.now() - t0}ms\nrtt min/avg/max/mdev = ${[mn, av, mx, md].map(x => x.toFixed(3)).join('/')} ms`);
    return 0;
  },
  ps(c, a) {
    const list = procList();
    if (a.some(x => /aux|-e|-ef/.test(x))) {
      c.out('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND');
      list.forEach(p => c.out(`${p.user.slice(0, 8).padEnd(8)} ${String(p.pid).padStart(7)} ${p.cpu.toFixed(1).padStart(4)} ${(p.mem / SYS.memTotal * 100).toFixed(1).padStart(4)} ${String(Math.round(p.mem * 4100)).padStart(6)} ${String(Math.round(p.mem * 1024)).padStart(5)} ${(p.user === 'night' ? 'tty2' : '?').padEnd(8)} ${p.pid < 100 ? 'Ss' : 'Sl'}   09:00   0:${pad(Math.floor(p.cpu))} ${p.pid === 2 ? '[kthreadd]' : p.name}`));
      return;
    }
    const me = list.find(p => p.win === c.T.win && p.name === 'bash');
    c.out(`    PID TTY          TIME CMD\n${String(me ? me.pid : 2411).padStart(7)} pts/0    00:00:00 bash\n${String(SYS.pid + 7).padStart(7)} pts/0    00:00:00 ps`);
  },
  async kill(c, a) {
    const f = a.filter(x => !x.startsWith('-')), sig = a.find(x => x.startsWith('-'));
    if (!f.length) return c.err('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]');
    let st = 0;
    for (const s of f) {
      const pid = +s, p = procList().find(x => x.pid === pid);
      if (!p) { c.err(`bash: kill: (${s}) - No such process`); st = 1; continue; }
      if (p.user !== 'night' && !c.root) { c.err(`bash: kill: (${s}) - Operation not permitted`); st = 1; continue; }
      if (pid === 1) { if (sig === '-9' || sig === '-KILL') { await c.sleep(300); SYSTEM.panic('init'); return 0; } continue; }
      endProcess(p);
    }
    return st;
  },
  pkill(c, a) { const n = a.filter(x => !x.startsWith('-'))[0]; const ps = procList().filter(p => p.name.includes(n || '\0') && (p.user === 'night' || c.root)); ps.forEach(endProcess); return ps.length ? 0 : 1; },
  killall(c, a) { return CMDS.pkill(c, a); },
  pidof(c, a) { const ps = procList().filter(p => p.name === a[0]); if (!ps.length) return 1; c.out(ps.map(p => p.pid).join(' ')); },
  async top(c, a) {
    const render = () => {
      const l = procList().sort((x, y) => y.cpu - x.cpu), n = new Date(), us = SYS.cpu.reduce((x, y) => x + y, 0) / SYS.cores, mt = SYS.memTotal, mu = SYS.mem;
      let s = `top - ${hhmm(n)}:${pad(n.getSeconds())} up ${uptimeStr(true)},  1 user,  load average: ${loadAvg().join(', ')}\nTasks: ${l.length + 211} total,   1 running, ${l.length + 210} sleeping,   0 stopped,   0 zombie\n%Cpu(s): ${(us * .7).toFixed(1).padStart(4)} us, ${(us * .3).toFixed(1).padStart(4)} sy,  0.0 ni, ${(100 - us).toFixed(1).padStart(4)} id,  0.1 wa,  0.0 hi,  0.1 si,  0.0 st\nMiB Mem : ${mt.toFixed(1).padStart(8)} total, ${(mt - mu - 3500).toFixed(1).padStart(8)} free, ${mu.toFixed(1).padStart(8)} used, ${'3511.2'.padStart(8)} buff/cache\nMiB Swap: ${'2048.0'.padStart(8)} total, ${'2048.0'.padStart(8)} free, ${'0.0'.padStart(8)} used. ${(mt - mu).toFixed(1).padStart(8)} avail Mem\n\n`;
      s += `<span class="inv">    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND          </span>\n`;
      l.slice(0, 18).forEach(p => s += `${String(p.pid).padStart(7)} ${p.user.slice(0, 8).padEnd(8)}  20   0 ${(Math.round(p.mem * 4.1) + 'm').padStart(7)} ${(Math.round(p.mem) + 'm').padStart(6)} ${(Math.round(p.mem * .3) + 'm').padStart(6)} ${p.cpu > 3 ? 'R' : 'S'} ${p.cpu.toFixed(1).padStart(5)} ${(p.mem / mt * 100).toFixed(1).padStart(5)} ${('0:' + pad(Math.floor(p.cpu * 3)) + '.' + pad(Math.floor(Math.random() * 99))).padStart(9)} ${esc(p.name)}\n`);
      return s;
    };
    return liveLoop(c, render, 1000);
  },
  async htop(c) {
    const bar = (v, w, col = 'c-g') => { const f = Math.round(v / 100 * w); return `[<span class="${col}">${'|'.repeat(f)}</span>${' '.repeat(w - f)}${(v.toFixed(1) + '%').padStart(6)}]`; };
    const render = () => {
      const l = procList().sort((x, y) => y.cpu - x.cpu), cols = 2, half = Math.ceil(SYS.cores / cols); let s = '';
      for (let i = 0; i < half; i++) { s += ` <span class="c-c">${String(i).padStart(2)}</span>${bar(SYS.cpu[i], 22)}`; if (i + half < SYS.cores) s += `  <span class="c-c">${String(i + half).padStart(2)}</span>${bar(SYS.cpu[i + half], 22)}`; s += '\n'; }
      const mp = SYS.mem / SYS.memTotal * 100;
      s += `  <span class="c-c">Mem</span>[<span class="c-g">${'|'.repeat(Math.round(mp / 100 * 22))}</span><span class="c-b">${'|'.repeat(4)}</span>${' '.repeat(Math.max(0, 18 - Math.round(mp / 100 * 22)))}${((SYS.mem / 1024).toFixed(2) + 'G/' + (SYS.memTotal / 1024).toFixed(1) + 'G').padStart(12)}]   Tasks: <span class="c-c b">${l.length + 98}</span>, <span class="c-g">412</span> thr; <span class="c-g b">1</span> running\n`;
      s += `  <span class="c-c">Swp</span>[${' '.repeat(26)}0K/2.00G]   Load average: <span class="b">${loadAvg().join(' ')}</span>\n${' '.repeat(36)}Uptime: <span class="b">${uptimeStr(true)}</span>\n\n`;
      s += `<span style="background:#4e9a06;color:#000">    PID USER       PRI  NI  VIRT   RES   SHR S  CPU%▽MEM%   TIME+  Command                     </span>\n`;
      l.slice(0, 16).forEach((p, i) => s += `${i === 0 ? '<span style="background:#34e2e2;color:#000">' : ''}${String(p.pid).padStart(7)} ${p.user.slice(0, 9).padEnd(9)}   20   0 ${(Math.round(p.mem * 4.1) + 'M').padStart(5)} ${(Math.round(p.mem) + 'M').padStart(5)} ${(Math.round(p.mem * .3) + 'M').padStart(5)} ${p.cpu > 3 ? 'R' : 'S'} ${p.cpu.toFixed(1).padStart(4)} ${(p.mem / SYS.memTotal * 100).toFixed(1).padStart(4)} ${('0:' + pad(Math.floor(p.cpu * 3)) + '.' + pad(i * 7 % 99)).padStart(8)}  ${esc(p.name).padEnd(28)}${i === 0 ? '</span>' : ''}\n`);
      s += `\n<span class="inv">F1</span><span style="background:#06989a;color:#000">Help  </span><span class="inv">F2</span><span style="background:#06989a;color:#000">Setup </span><span class="inv">F3</span><span style="background:#06989a;color:#000">Search</span><span class="inv">F9</span><span style="background:#06989a;color:#000">Kill  </span><span class="inv">F10</span><span style="background:#06989a;color:#000">Quit  </span>   <span class="c-d">(press q to quit)</span>`;
      return s;
    };
    return liveLoop(c, render, 1000);
  },
  async cmatrix(c) {
    const T = c.T, sc = T.win.body.querySelector('.t-scroll'), cw = 8.2 * T.size / 13.5, ch = T.size * 1.45;
    const cols = Math.max(10, Math.floor((sc.clientWidth - 20) / cw)), rows = Math.max(8, Math.floor((sc.clientHeight - 16) / ch));
    const drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -rows)), grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
    const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ABCDEFZ:.=*+-<>¦'.split('');
    const render = () => {
      for (let x = 0; x < cols; x++) { const y = drops[x]; if (y >= 0 && y < rows) grid[y][x] = glyphs[Math.floor(Math.random() * glyphs.length)]; drops[x]++; if (drops[x] > rows + Math.random() * 20) drops[x] = 0; if (y - 12 >= 0 && y - 12 < rows) grid[y - 12][x] = ' '; }
      return grid.map((r, y) => r.map((g, x) => g === ' ' ? ' ' : drops[x] - 1 === y ? `<span class="c-w b">${esc(g)}</span>` : `<span style="color:#${y % 3 ? '4e9a06' : '8ae234'}">${esc(g)}</span>`).join('')).join('\n');
    };
    return liveLoop(c, render, 60);
  },
  free(c, a) {
    const h = a.includes('-h'), m = a.includes('-m'), u = SYS.mem * 1024, t = SYS.memTotal * 1024, cache = SYS.memReal ? 0 : 3595000, fr = t - u - cache;
    const fm = v => h ? (v >= 1048576 ? (v / 1048576).toFixed(1) + 'Gi' : Math.round(v / 1024) + 'Mi') : m ? String(Math.round(v / 1024)) : String(Math.round(v));
    c.out(`${''.padEnd(15)}${'total'.padStart(12)}${'used'.padStart(12)}${'free'.padStart(12)}${'shared'.padStart(12)}${'buff/cache'.padStart(12)}${'available'.padStart(12)}\nMem:${''.padEnd(11)}${fm(t).padStart(12)}${fm(u).padStart(12)}${fm(fr).padStart(12)}${fm(421888).padStart(12)}${fm(cache).padStart(12)}${fm(t - u).padStart(12)}\nSwap:${''.padEnd(10)}${fm(2097148).padStart(12)}${(h ? '0B' : '0').padStart(12)}${fm(2097148).padStart(12)}`);
  },
  df(c, a) {
    const h = a.includes('-h'), S = REAL.storage, root = S && S.quota ? [Math.round(S.quota / 1024), Math.round((S.usage || 0) / 1024)] : [490617848, 117440512];
    const R = [['tmpfs', 1625648, 2156, '/run'], [S && S.quota ? 'browser-storage' : '/dev/nvme0n1p2', root[0], root[1], '/'], ['tmpfs', 8128256, 0, '/dev/shm'], ['tmpfs', 5120, 12, '/run/lock'], ['/dev/nvme0n1p1', 1098632, 6348, '/boot/efi'], ['tmpfs', 1625648, 124, '/run/user/1000']];
    const fm = v => h ? (v === 0 ? '0' : v >= 1048576 ? (v / 1048576 >= 10 ? Math.round(v / 1048576) : (v / 1048576).toFixed(1)) + 'G' : v >= 1024 ? (v / 1024).toFixed(1) + 'M' : v + 'K') : String(v);
    c.out(`Filesystem     ${h ? ' Size  Used Avail' : '1K-blocks      Used Available'} Use% Mounted on`);
    R.forEach(([fs, t, u, m]) => c.out(`${fs.padEnd(15)}${fm(t).padStart(h ? 5 : 10)} ${fm(u).padStart(h ? 5 : 9)} ${fm(t - u).padStart(h ? 5 : 9)} ${(Math.ceil(u / t * 100) + '%').padStart(4)} ${m}`));
  },
  ip(c, a) {
    if (!a.length || /^(a|addr|address)$/.test(a[0])) {
      const up = netUp();
      c.html(`1: <span class="c-b">lo</span>: &lt;LOOPBACK,UP,LOWER_UP&gt; mtu 65536 qdisc noqueue state <span class="c-g">UNKNOWN</span> group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet <span class="c-m">127.0.0.1</span>/8 scope host lo\n       valid_lft forever preferred_lft forever\n2: <span class="c-b">wlp2s0</span>: &lt;BROADCAST,MULTICAST${up ? ',UP,LOWER_UP' : ''}&gt; mtu 1500 qdisc noqueue state <span class="${up ? 'c-g">UP' : 'c-r">DOWN'}</span> group default qlen 1000\n    link/ether <span class="c-y">a4:c3:f0:5e:21:9b</span> brd ff:ff:ff:ff:ff:ff${up ? '\n    inet <span class="c-m">192.168.1.42</span>/24 brd 192.168.1.255 scope global dynamic noprefixroute wlp2s0\n       valid_lft 85412sec preferred_lft 85412sec' : ''}`);
    } else if (/^(r|route)$/.test(a[0])) c.out(netUp() ? 'default via 192.168.1.1 dev wlp2s0 proto dhcp src 192.168.1.42 metric 600\n192.168.1.0/24 dev wlp2s0 proto kernel scope link src 192.168.1.42 metric 600' : '');
    else return c.err(`Object "${a[0]}" is unknown, try "ip help".`);
  },
  ifconfig(c) { c.out(`lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n\nwlp2s0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 192.168.1.42  netmask 255.255.255.0  broadcast 192.168.1.255\n        ether a4:c3:f0:5e:21:9b  txqueuelen 1000  (Ethernet)\n        RX packets 184213  bytes ${Math.round(SYS.net.totRx)} (${humanSI(Math.round(SYS.net.totRx))})\n        TX packets 61822  bytes ${Math.round(SYS.net.totTx)} (${humanSI(Math.round(SYS.net.totTx))})`); },
  netstat(c) { c.out('Active Internet connections (w/o servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State\ntcp        0      0 192.168.1.42:51844      203.0.113.24:https      ESTABLISHED'); },
  grep(c, a) {
    const f = parseFlags(a), pat = f.args.shift(); if (pat == null) return c.err("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information."), 2;
    let re; try { re = new RegExp(pat, f.has('i') ? 'gi' : 'g'); } catch (e) { return c.err('grep: Invalid regular expression'), 2; }
    const srcs = f.args.length ? f.args.map(t => { const n = getNode(c.path(t)); if (!n) { c.err(`grep: ${t}: No such file or directory`); return null; } if (n.type === 'dir') { c.err(`grep: ${t}: Is a directory`); return null; } return [t, n.content || '']; }).filter(Boolean) : [['', c.stdin || '']];
    let hit = 0;
    for (const [name, txt] of srcs) txt.split('\n').forEach((l, i) => {
      re.lastIndex = 0; const m = re.test(l); if (m === f.has('v')) return; hit++; if (f.has('c')) return;
      const pre = (srcs.length > 1 ? name + ':' : '') + (f.has('n') ? (i + 1) + ':' : '');
      c.html((pre ? `<span class="c-m">${esc(pre)}</span>` : '') + (f.has('v') ? esc(l) : esc(l).replace(new RegExp(esc(pat).replace(/[.*+?^${}()|[\]\\]/g, m2 => m2 === '.' || m2 === '*' ? m2 : '\\' + m2), f.has('i') ? 'gi' : 'g'), m2 => `<span class="c-r b">${m2}</span>`)), pre + l);
    });
    if (f.has('c')) c.out(String(hit));
    return hit ? 0 : 1;
  },
  head(c, a) { a = a.slice(); const n = +optVal(a, '-n', 10); const t = a[0]; const txt = t ? (getNode(c.path(t)) || {}).content : c.stdin; if (txt == null) return c.err(`head: cannot open '${t}' for reading: No such file or directory`); c.out(txt.replace(/\n$/, '').split('\n').slice(0, n).join('\n')); },
  tail(c, a) { a = a.slice(); const n = +optVal(a, '-n', 10); const t = a[0]; const txt = t ? (getNode(c.path(t)) || {}).content : c.stdin; if (txt == null) return c.err(`tail: cannot open '${t}' for reading: No such file or directory`); c.out(txt.replace(/\n$/, '').split('\n').slice(-n).join('\n')); },
  wc(c, a) {
    const f = parseFlags(a), one = (txt, name) => { const L = (txt.match(/\n/g) || []).length, W = (txt.match(/\S+/g) || []).length, B = new Blob([txt]).size; const sel = ['l', 'w', 'c'].filter(k => f.has(k)); const vals = sel.length ? sel.map(k => ({ l: L, w: W, c: B }[k])) : [L, W, B]; c.out(vals.map(v => String(v).padStart(sel.length === 1 && !name ? 0 : 3)).join(' ') + (name ? ' ' + name : '')); };
    if (!f.args.length) return one((c.stdin || '') + (c.stdin ? '\n' : ''), '');
    for (const t of f.args) { const n = getNode(c.path(t)); if (!n) { c.err(`wc: ${t}: No such file or directory`); continue; } one(n.content || '', t); }
  },
  sort(c, a) { const f = parseFlags(a); let txt = f.args[0] ? (getNode(c.path(f.args[0])) || {}).content || '' : c.stdin || ''; let l = txt.replace(/\n$/, '').split('\n'); l.sort((x, y) => f.has('n') ? parseFloat(x) - parseFloat(y) : x.localeCompare(y)); if (f.has('r')) l.reverse(); if (f.has('u')) l = [...new Set(l)]; c.out(l.join('\n')); },
  uniq(c) { const l = (c.stdin || '').split('\n').filter((x, i, arr) => x !== arr[i - 1]); c.out(l.join('\n')); },
  tree(c, a) {
    const f = parseFlags(a), root = f.args[0] || '.', p = c.path(root), n = getNode(p); if (!n) return c.err(`${root}  [error opening dir]\n\n0 directories, 0 files`);
    let dirs = 0, files = 0; const lines = [`<span class="c-b b">${esc(root)}</span>`];
    const walk = (node, prefix) => { const ks = Object.keys(node.children).filter(k => f.has('a') || !k.startsWith('.')).sort(); ks.forEach((k, i) => { const v = node.children[k], last = i === ks.length - 1; lines.push(esc(prefix + (last ? '└── ' : '├── ')) + lsName(k, v)); if (v.type === 'dir') { dirs++; walk(v, prefix + (last ? '    ' : '│   ')); } else files++; }); };
    if (n.type === 'dir') walk(n, '');
    lines.push('', `${dirs} director${dirs === 1 ? 'y' : 'ies'}, ${files} file${files === 1 ? '' : 's'}`); c.html(lines.join('\n'));
  },
  which(c, a) { let st = 0; for (const n of a) { if (CMDS[n] && !['cd', 'exit', 'history', 'help', 'export', 'alias', 'logout'].includes(n) && (!CMD_PKG[n] || INSTALLED.has(CMD_PKG[n]))) c.out(['ls', 'cat', 'cp', 'mv', 'rm', 'mkdir', 'echo', 'pwd', 'date', 'grep', 'ping', 'touch', 'uname', 'bash', 'sh'].includes(n) ? '/usr/bin/' + n : '/usr/bin/' + n); else st = 1; } return st; },
  env(c) { Object.keys(c.T.env).forEach(k => c.out(`${k}=${c.T.env[k]}`)); },
  printenv(c, a) { if (a[0]) { const v = c.T.env[a[0]]; if (v == null) return 1; c.out(v); } else CMDS.env(c); },
  export(c, a) { for (const x of a) { const i = x.indexOf('='); if (i > 0) c.T.env[x.slice(0, i)] = x.slice(i + 1); } if (!a.length) Object.keys(c.T.env).forEach(k => c.out(`declare -x ${k}="${c.T.env[k]}"`)); },
  unset(c, a) { a.forEach(k => delete c.T.env[k]); },
  async sleep(c, a) { const s = parseFloat(a[0]); if (isNaN(s)) return c.err("sleep: missing operand\nTry 'sleep --help' for more information."); await c.sleep(s * 1000); },
  async yes(c, a) { const w = a.join(' ') || 'y'; for (let i = 0; i < 2000; i++) { c.out(w); if (i % 40 === 0) await c.sleep(16); } },
  file(c, a) { for (const t of a) { const n = getNode(c.path(t)); if (!n) { c.out(`${t}: cannot open \`${t}' (No such file or directory)`); continue; } const k = fileKind(t, n); c.out(`${t}: ${n.type === 'dir' ? 'directory' : n.bin ? 'ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, stripped' : k === 'image' ? 'PNG image data, 3840 x 2160, 8-bit/color RGB, non-interlaced' : k === 'iso' ? "ISO 9660 CD-ROM filesystem data (DOS/MBR boot sector) 'NightOS 24.10 amd64' (bootable)" : k === 'archive' ? 'Zip archive data, at least v2.0 to extract, compression method=deflate' : k === 'pdf' ? 'PDF document, version 1.7, 4 page(s)' : n.exec ? 'Bourne-Again shell script, ASCII text executable' : (n.content || '').length ? 'ASCII text' : 'empty'}`); } },
  stat(c, a) { const t = a[0], n = t && getNode(c.path(t)); if (!n) return c.err(`stat: cannot statx '${t || ''}': No such file or directory`); const d = new Date(n.mtime), ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hhmm(d)}:${pad(d.getSeconds())}.000000000`; c.out(`  File: ${t}\n  Size: ${nodeSize(n)}\t\tBlocks: ${Math.ceil(nodeSize(n) / 512)}          IO Block: 4096   ${n.type === 'dir' ? 'directory' : 'regular file'}\nDevice: 259,2\tInode: ${131072 + t.length * 977}     Links: 1\nAccess: (0${n.type === 'dir' || n.exec ? '755' : '644'}/${permStr(n)})  Uid: ( 1000/   night)   Gid: ( 1000/   night)\nModify: ${ds}`); },
  nano(c, a) { if (a[0]) { const p = c.path(a[0]); if (!getNode(p)) try { fsWrite(p, '', { root: c.root }); } catch (e) { return c.err(`nano: ${a[0]}: ${ERR[e]}`); } launch('editor', p); } else launch('editor'); },
  'text-editor'(c, a) { return CMDS.nano(c, a); }, gedit(c, a) { return CMDS.nano(c, a); },
  'xdg-open'(c, a) { const t = a[0]; if (!t) return c.err('xdg-open: no file or URL given'); if (/^(https?:|www\.)/.test(t) || /^[a-z0-9-]+\.(org|com|net|io|dev)\b/.test(t)) return void launch('browser', t); const p = c.path(t); if (!getNode(p)) return c.err(`xdg-open: file '${t}' does not exist`), 2; openPath(p); },
  open(c, a) { return CMDS['xdg-open'](c, a); },
  files(c, a) { launch('files', c.path(a[0] || '.')); }, nautilus(c, a) { return CMDS.files(c, a); },
  nightfox(c, a) { launch('browser', a[0]); }, firefox(c, a) { return CMDS.nightfox(c, a); },
  'system-monitor'() { launch('monitor'); }, 'night-control-center'(c, a) { launch('settings', a[0]); },
  calculator() { launch('calc'); },
  reboot(c) { SYSTEM.restart(); }, poweroff() { SYSTEM.poweroff(); },
  shutdown(c, a) { if (a.includes('-r')) SYSTEM.restart(); else if (a.includes('-c')) c.out('No scheduled shutdown.'); else { if (!a.includes('now') && !a.includes('-h') && !a.includes('-P')) { c.out(`Shutdown scheduled for ${dateStr(new Date(Date.now() + 60000))}, use 'shutdown -c' to cancel.`); } SYSTEM.poweroff(); } },
  systemctl(c, a) {
    const sub = a[0], u = (a[1] || '').replace(/\.service$/, '');
    const units = { NetworkManager: 'Network Manager', bluetooth: 'Bluetooth service', cups: 'CUPS Scheduler', nightdm: 'Night Display Manager', 'systemd-journald': 'Journal Service', ssh: null };
    if (sub === 'status' && u) { if (!(u in units) || !units[u]) return c.err(`Unit ${u}.service could not be found.`), 4; c.html(`<span class="c-g">●</span> ${u}.service - ${units[u]}\n     Loaded: loaded (/usr/lib/systemd/system/${u}.service; enabled; preset: enabled)\n     Active: <span class="c-g b">active (running)</span> since ${dateStr(new Date(SYS.boot))}; ${uptimeStr()} ago\n   Main PID: ${(PROCS.find(p => p.name.startsWith(u.slice(0, 6))) || { pid: 861 }).pid} (${u})\n      Tasks: 4 (limit: 18924)\n     Memory: 12.4M (peak: 14.1M)\n        CPU: 412ms`); return; }
    if (['start', 'stop', 'restart', 'enable', 'disable'].includes(sub)) { if (!c.root) return c.err(`Failed to ${sub} ${u}.service: Access denied\nSee system logs and 'systemctl status ${u}.service' for details.`); return; }
    if (sub === 'poweroff') return SYSTEM.poweroff(); if (sub === 'reboot') return SYSTEM.restart(); if (sub === 'suspend') return SYSTEM.suspend();
    c.out(Object.keys(units).filter(k => units[k]).map(k => `  ${(k + '.service').padEnd(28)} loaded active running ${units[k]}`).join('\n'));
  },
  journalctl(c) { c.out((getNode('/var/log/syslog').content || '').replace(/\n$/, '')); },
  async curl(c, a) {
    const url = a.filter(x => !x.startsWith('-'))[0]; if (!url) return c.err("curl: try 'curl --help' or 'curl --manual' for more information"), 2;
    const host = url.replace(/^https?:\/\//, '').split('/')[0];
    if (!netUp()) return c.err(`curl: (6) Could not resolve host: ${host}`), 6;
    await c.sleep(300 + Math.random() * 400);
    if (/(^|\.)nightos\.org$/.test(host)) { if (a.includes('-I')) c.out('HTTP/2 200\ncontent-type: text/html; charset=utf-8\nserver: nightos-edge\ncache-control: max-age=600'); else c.out('<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>NightOS — a calm Linux desktop</title></head>\n<body>\n  <h1>NightOS 24.10 "Umbra"</h1>\n  <p>A calm, fast desktop for people who work late.</p>\n</body>\n</html>'); return; }
    if (host === 'localhost' || host.startsWith('127.')) return c.err(`curl: (7) Failed to connect to ${host} port 80 after 0 ms: Couldn't connect to server`), 7;
    if (host === 'wttr.in') { c.out('Weather report: NightOS\n\n     \\   /     Clear\n      .-.      12 °C\n   ― (   ) ―   ↙ 9 km/h\n      `-’      10 km\n     /   \\     0.0 mm'); return; }
    return c.err(`curl: (6) Could not resolve host: ${host}`), 6;
  },
  async wget(c, a) {
    const url = a.filter(x => !x.startsWith('-'))[0]; if (!url) return c.err("wget: missing URL\nUsage: wget [OPTION]... [URL]..."), 1;
    const host = url.replace(/^https?:\/\//, '').split('/')[0], name = url.split('/').filter(Boolean).pop() === host ? 'index.html' : url.split('/').pop();
    c.out(`--${new Date().toISOString().replace('T', ' ').slice(0, 19)}--  ${url}\nResolving ${host} (${host})... `);
    if (!netUp() || !/(^|\.)nightos\.org$/.test(host)) { await c.sleep(800); return c.err(`failed: Temporary failure in name resolution.\nwget: unable to resolve host address ‘${host}’`), 4; }
    c.out(`203.0.113.24\nConnecting to ${host} (${host})|203.0.113.24|:443... connected.\nHTTP request sent, awaiting response... 200 OK\nLength: 1824 (1.8K) [text/html]\nSaving to: ‘${name}’\n`);
    const bar = c.tty ? c.live() : null;
    for (let i = 0; i <= 10; i++) { if (bar) bar.textContent = `${name.padEnd(22)}${(i * 10 + '%').padStart(4)}[${'='.repeat(i * 3)}>${' '.repeat(30 - i * 3)}]   ${(1824 * i / 10 / 1000).toFixed(2)}K  --.-KB/s`; await c.sleep(60); }
    try { fsWrite(c.path(name), '<!doctype html>\n<title>NightOS</title>\n<h1>NightOS 24.10 "Umbra"</h1>\n', { root: c.root }); } catch (e) { return c.err(`${name}: ${ERR[e]}`), 3; }
    c.out(`\n${dateStr().slice(4, 19)} (11.9 MB/s) - ‘${name}’ saved [1824/1824]`);
  },
  async python3(c, a) {
    if (a[0] === '--version' || a[0] === '-V') return c.out('Python 3.12.3');
    if (a[0] === '-c') { try { const v = pyEval(a[1] || '', {}); if (v.print != null) c.out(v.print); } catch (e) { c.err(e.message); return 1; } return; }
    if (a[0]) { const n = getNode(c.path(a[0])); if (!n) return c.err(`python3: can't open file '${c.path(a[0])}': [Errno 2] No such file or directory`), 2; const vars = {}; for (const l of (n.content || '').split('\n')) { if (!l.trim() || l.trim().startsWith('#')) continue; try { const v = pyEval(l, vars); if (v.print != null) c.out(v.print); } catch (e) { c.err(`Traceback (most recent call last):\n  File "${a[0]}", line 1, in <module>\n${e.message}`); return 1; } } return; }
    if (!c.tty) return;
    c.out('Python 3.12.3 (main, Sep 11 2026, 14:17:37) [GCC 13.2.0] on linux\nType "help", "copyright", "credits" or "license" for more information.');
    const T = c.T, vars = {};
    T.repl = { prompt: '&gt;&gt;&gt; ', handle: async line => {
      const s = line.trim(); if (!s) return;
      if (/^(exit|quit)\(\)$/.test(s)) { T.repl = null; return; }
      if (s === 'exit' || s === 'quit') return void T.print('Use exit() or Ctrl-D (i.e. EOF) to exit');
      if (s === 'help') return void T.print('Type help() for interactive help, or help(object) for help about object.');
      if (/^import\s+\w+/.test(s)) { if (/^import\s+(this|antigravity)$/.test(s)) T.print(esc('Calm is better than clever.\nReadable is better than fast.\nSmall programs grow; plan for it.')); return; }
      try { const v = pyEval(s, vars); if (v.print != null) T.print(esc(v.print)); else if (v.repr != null) T.print(esc(v.repr)); }
      catch (e) { T.print(esc(`Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\n${e.message}`)); }
    } };
  },
  python(c, a) { return execArgv(c, ['__nf_python', ...a]); },
  cowsay(c, a, think) {
    const msg = a.join(' ') || (c.stdin || '').trim() || 'Moo.';
    const words = msg.split(/\s+/), lines = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > 39) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } lines.push(cur);
    const W = Math.max(...lines.map(l => l.length)), o = think ? ['(', ')'] : lines.length === 1 ? ['<', '>'] : null;
    let s = ' ' + '_'.repeat(W + 2) + '\n';
    lines.forEach((l, i) => { const [L, R] = o || (i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|']); s += `${L} ${l.padEnd(W)} ${R}\n`; });
    const t = think ? 'o' : '\\';
    s += ' ' + '-'.repeat(W + 2) + `\n        ${t}   ^__^\n         ${t}  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;
    c.out(s);
  },
  cowthink(c, a) { return CMDS.cowsay(c, a, true); },
  fortune(c) { c.out(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]); },
  async sl(c) {
    const art = ['      ====        ____________________', '  _D _|  |_______|  NightOS Express  |', ' |(_)---  |   H\\ |__________________|', ' /     |  |   H  |  |  |  |  |  |  |', '|      |  |   H  |__|__|__|__|__|__|', '|  ___ |__|___H__|___________________|', '|_/   \\__/\\___/   \\__/   \\__/   \\__/', '  \\___/    \\___/   \\__/   \\__/   \\__/'];
    const smoke = ['  (  )  (@@) ( )  (@)  ()', ' (@@@)  (  )   (@@@)', '   ( )   (@@) (  )'];
    const T = c.T, sc = T.win.body.querySelector('.t-scroll'), cols = Math.floor((sc.clientWidth - 20) / (8.2 * T.size / 13.5));
    const lv = c.live(); sc.classList.add('alt');
    try { for (let x = cols; x > -42; x -= 1) { const padS = ' '.repeat(Math.max(0, x)), cut = Math.max(0, -x); lv.textContent = '\n\n' + smoke[(cols - x) % 3].slice(cut).replace(/^/, padS) + '\n' + art.map(l => (padS + l.slice(cut)).slice(0, cols)).join('\n'); await c.sleep(35); } }
    catch (e) { } finally { sc.classList.remove('alt'); lv.remove(); }
  },
  async git(c, a) {
    if (a[0] === '--version') return c.out('git version 2.43.0');
    if (!a.length) return c.out('usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]\n           <command> [<args>]\n\nThese are common Git commands:\n   init       Create an empty Git repository\n   status     Show the working tree status\n   log        Show commit logs');
    if (a[0] === 'init') { try { fsMkdir(c.path('.git'), { root: c.root }); } catch (e) { } c.out(`hint: Using 'master' as the name for the initial branch.\nInitialized empty Git repository in ${c.T.cwd}/.git/`); return; }
    let p = c.T.cwd; while (p !== '/' && !getNode(p + '/.git')) p = splitPath(p)[0];
    if (!getNode(p + '/.git')) return c.err('fatal: not a git repository (or any of the parent directories): .git'), 128;
    if (a[0] === 'status') { const ks = Object.keys(getNode(c.T.cwd).children).filter(k => k !== '.git'); c.html(`On branch master\n\nNo commits yet\n\n${ks.length ? `Untracked files:\n  (use "git add &lt;file&gt;..." to include in what will be committed)\n${ks.map(k => `\t<span class="c-r">${esc(k)}</span>`).join('\n')}\n\nnothing added to commit but untracked files present (use "git add" to track)` : 'nothing to commit (create/copy files and use "git add" to track)'}`); return; }
    if (a[0] === 'log') return c.err("fatal: your current branch 'master' does not have any commits yet"), 128;
    return c.err(`git: '${a[0]}' is not a git command. See 'git --help'.`), 1;
  },
  lscpu(c) { c.out(`Architecture:             x86_64\n  CPU op-mode(s):         32-bit, 64-bit\n  Address sizes:          46 bits physical, 48 bits virtual\nCPU(s):                   ${SYS.cores}\nVendor ID:                NightCore\n  Model name:             ${CPU_NAME}\n    Thread(s) per core:   2\n    Core(s) per socket:   ${Math.max(1, SYS.cores / 2)}\n    CPU max MHz:          4600.0000\n    CPU min MHz:          400.0000`); },
  lsblk(c) { c.out('NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\nnvme0n1     259:0    0 476.9G  0 disk \n├─nvme0n1p1 259:1    0     1G  0 part /boot/efi\n└─nvme0n1p2 259:2    0 475.9G  0 part /'); },
  du(c, a) { const f = parseFlags(a), t = f.args[0] || '.', p = c.path(t), n = getNode(p); if (!n) return c.err(`du: cannot access '${t}': No such file or directory`); const sz = x => x.type === 'dir' ? 4096 + Object.values(x.children).reduce((s, y) => s + sz(y), 0) : nodeSize(x); c.out(`${f.has('h') ? humanIEC(sz(n)) : Math.ceil(sz(n) / 1024)}\t${t}`); },
  basename(c, a) { c.out(splitPath(a[0] || '')[1]); }, dirname(c, a) { c.out(splitPath(resolve(a[0] || '.', '/'))[0]); },
  w(c) { CMDS.uptime(c, []); c.out(`USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\nnight    tty2     tty2             ${hhmm(new Date(SYS.boot))}    ${uptimeStr(true)}  0.01s  0.00s dusk-session`); },
  who(c) { c.out(`night    tty2         ${new Date(SYS.boot).toISOString().slice(0, 16).replace('T', ' ')} (tty2)`); },
  last(c) { c.out(`night    tty2         tty2             ${dateStr(new Date(SYS.boot)).slice(0, 16)}   still logged in\nreboot   system boot  6.8.0-45-night   ${dateStr(new Date(SYS.boot)).slice(0, 16)}   still running\n\nwtmp begins ${dateStr(new Date(NOW0 - 60 * DAY)).slice(0, 16)}`); },
  rev(c, a) { c.out((a.join(' ') || c.stdin || '').split('\n').map(l => [...l].reverse().join('')).join('\n')); },
  tr(c, a) { const [x, y] = a; let s = c.stdin || ''; if (x === 'a-z' && y === 'A-Z') s = s.toUpperCase(); else if (x === 'A-Z' && y === 'a-z') s = s.toLowerCase(); else for (let i = 0; i < (x || '').length; i++) s = s.split(x[i]).join((y || '')[Math.min(i, (y || '').length - 1)] || ''); c.out(s); },
  seq(c, a) { const n = a.map(Number); const [s, e] = n.length > 1 ? n : [1, n[0]]; const out = []; for (let i = s; i <= Math.min(e, s + 5000); i++) out.push(i); c.out(out.join('\n')); },
  expr(c, a) { try { c.out(String(Math.trunc(calcEval(a.join(' '))))); } catch (e) { return c.err('expr: syntax error'), 2; } },
  bc(c) { try { c.out(String(calcEval((c.stdin || '').trim()))); } catch (e) { c.err('(standard_in) 1: syntax error'); } },
  base64(c, a) { const s = c.stdin || ''; try { c.out(a.includes('-d') ? decodeURIComponent(escape(atob(s.trim()))) : btoa(unescape(encodeURIComponent(s + '\n')))); } catch (e) { c.err('base64: invalid input'); } },
  md5sum(c, a) { const s = a[0] ? (getNode(c.path(a[0])) || {}).content || '' : c.stdin || ''; let h1 = 0x811c9dc5, h2 = 0x1234567; for (const ch of s) { h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0; h2 = Math.imul(h2 + ch.charCodeAt(0), 2654435761) >>> 0; } c.out([h1, h2, h1 ^ h2, (h1 + h2) >>> 0].map(x => x.toString(16).padStart(8, '0')).join('') + '  ' + (a[0] || '-')); }
};
delete CMDS.python;
function pyEval(s, vars) {
  s = s.trim();
  let m;
  if ((m = s.match(/^print\((.*)\)$/))) { const inner = m[1].trim(); if (!inner) return { print: '' }; const v = pyValue(inner, vars); return { print: v.str }; }
  if ((m = s.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/))) { vars[m[1]] = pyValue(m[2], vars).raw; return {}; }
  return { repr: pyValue(s, vars).repr };
}
function pyValue(src, vars) {
  const sm = src.match(/^(['"])(.*)\1(?:\s*\*\s*(\d+))?$/);
  if (sm) { const s = sm[2].repeat(sm[3] ? +sm[3] : 1); return { raw: s, str: s, repr: `'${s}'` }; }
  if (/^[A-Za-z_]\w*$/.test(src) && typeof vars[src] === 'string') return { raw: vars[src], str: vars[src], repr: `'${vars[src]}'` };
  if (/^(True|False|None)$/.test(src)) return { raw: src, str: src, repr: src };
  const numVars = {}; for (const k in vars) if (typeof vars[k] === 'number') numVars[k] = vars[k];
  const v = calcEval(src.replace(/\bmath\./g, ''), numVars), isFloat = /\d\.\d|(?<![/])\/(?!\/)|sqrt|sin|cos|pi/.test(src);
  let r = Number.isInteger(v) && !isFloat ? String(v) : Number.isInteger(v) ? v.toFixed(1) : String(parseFloat(v.toPrecision(16)));
  if (!isFinite(v)) r = v > 0 ? 'inf' : '-inf';
  return { raw: v, str: r, repr: r };
}
async function liveLoop(c, render, ms) {
  if (!c.tty) { c.html(render()); return; }
  const T = c.T, sc = T.win.body.querySelector('.t-scroll'), lv = c.live(); let quit = false;
  sc.classList.add('alt'); T.onKey = e => { if (e.key === 'q' || e.key === 'Q' || e.key === 'F10' || e.key === 'Escape') quit = true; };
  try { while (!quit && !T.closed) { lv.innerHTML = render(); await c.sleep(ms, () => quit); } }
  catch (e) { if (e !== 'SIGINT') throw e; }
  finally { sc.classList.remove('alt'); lv.remove(); T.onKey = null; }
}
function endProcess(p) {
  if (p.win) { closeWin(p.win, true); return; }
  if (p.name === 'dusk-shell') { SYSTEM.restartShell(); return; }
  const i = PROCS.indexOf(p); if (i >= 0) { PROCS.splice(i, 1); setTimeout(() => PROCS.push({ ...p, pid: nextPid() }), 2500); }
}
