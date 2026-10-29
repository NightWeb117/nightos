'use strict';
/* ================= real Python (Brython) ================= */
const BRYTHON_VER = '3.14.0';
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src)); document.head.append(s); });
}
const PY_BOOT = `
import sys, builtins, io, traceback
from browser import window
class _Out:
    def __init__(self, err): self.err = err
    def write(self, t):
        window._nosPyOut(str(t), self.err)
        return len(str(t))
    def flush(self): pass
    def isatty(self): return True
sys.stdout = _Out(False)
sys.stderr = _Out(True)
def _input(prompt=''):
    raise RuntimeError("input() can't wait for typing in this terminal; pass values with sys.argv instead")
builtins.input = _input
class _WFile:
    def __init__(self, path, append):
        self._p = path
        self._a = append
        self._buf = []
        self.closed = False
    def write(self, s):
        self._buf.append(str(s))
        return len(str(s))
    def writelines(self, lines):
        for line in lines:
            self.write(line)
    def flush(self):
        pass
    def close(self):
        if not self.closed:
            window._nosFsWrite(self._p, ''.join(self._buf), self._a)
            self.closed = True
    def __enter__(self):
        return self
    def __exit__(self, *a):
        self.close()
def _open(file, mode='r', *a, **k):
    p = window._nosResolve(str(file))
    if 'b' in mode:
        raise OSError("binary files are not supported in NightOS Python")
    if 'w' in mode or 'a' in mode or 'x' in mode:
        if not window._nosCanWrite(p):
            raise PermissionError("[Errno 13] Permission denied: '" + str(file) + "'")
        return _WFile(p, 'a' in mode)
    kind = window._nosFsKind(p)
    if kind == 'none':
        raise FileNotFoundError("[Errno 2] No such file or directory: '" + str(file) + "'")
    if kind == 'dir':
        raise IsADirectoryError("[Errno 21] Is a directory: '" + str(file) + "'")
    return io.StringIO(str(window._nosFsRead(p)))
builtins.open = _open
def _getcwd():
    return window._nosCwd()
def _listdir(p='.'):
    return list(window._nosLs(str(p)))
def _chdir(p):
    if not window._nosChdir(str(p)):
        raise FileNotFoundError("[Errno 2] No such file or directory: '" + str(p) + "'")
import os
os.getcwd = _getcwd
os.listdir = _listdir
os.chdir = _chdir
_ns = {'__name__': '__main__', '__builtins__': builtins}
def _run(src, mode, argv):
    sys.argv = list(argv)
    try:
        if mode == 'single':
            try:
                code = compile(src, '<stdin>', 'eval')
            except SyntaxError:
                exec(compile(src, '<stdin>', 'exec'), _ns)
            else:
                r = eval(code, _ns)
                if r is not None:
                    _ns['_'] = r
                    print(repr(r))
        else:
            exec(compile(src, mode, 'exec'), {'__name__': '__main__', '__builtins__': builtins})
        return 0
    except SystemExit as e:
        c = e.code
        return 0 if c is None else (c if isinstance(c, int) else 1)
    except BaseException:
        traceback.print_exc()
        return 1
def _check(src):
    try:
        compile(src, '<stdin>', 'exec')
        return 'ok'
    except SyntaxError as e:
        m = str(e)
        if 'EOF' in m or 'never closed' in m or 'expected an indented block' in m:
            return 'more'
        return 'ok'
window._nosPy = _run
window._nosPyCheck = _check
`;
const PY = { promise: null, out: null, T: null };
function loadPython() {
  if (PY.promise) return PY.promise;
  PY.promise = (async () => {
    await loadScript(`https://cdn.jsdelivr.net/npm/brython@${BRYTHON_VER}/brython.min.js`);
    await loadScript(`https://cdn.jsdelivr.net/npm/brython@${BRYTHON_VER}/brython_stdlib.js`);
    window._nosPyOut = (t, err) => { if (PY.out) PY.out.push([t, err]); };
    window._nosResolve = p => resolve(p, PY.T ? PY.T.cwd : HOME);
    window._nosFsKind = p => { const n = getNode(p); return !n ? 'none' : n.type === 'dir' ? 'dir' : 'file'; };
    window._nosFsRead = p => { const n = getNode(p); return n && n.type === 'file' ? (n.content || '') : ''; };
    window._nosFsWrite = (p, data, app) => fsWrite(p, data, { append: app, root: PY.T && PY.T.root });
    window._nosCanWrite = p => canWrite(p, PY.T && PY.T.root);
    window._nosCwd = () => PY.T ? PY.T.cwd : HOME;
    window._nosLs = p => { const n = getNode(resolve(p, PY.T ? PY.T.cwd : HOME)); if (!n || n.type !== 'dir') throw new Error('No such directory'); return Object.keys(n.children).sort(); };
    window._nosChdir = p => { const r = resolve(p, PY.T ? PY.T.cwd : HOME), n = getNode(r); if (!n || n.type !== 'dir') return false; if (PY.T) PY.T.cwd = r; return true; };
    __BRYTHON__.runPythonSource(PY_BOOT, 'nosboot');
  })();
  PY.promise.catch(() => { PY.promise = null; });
  return PY.promise;
}
function pyExec(c, src, mode, argv) {
  PY.T = c.T; PY.out = [];
  let st = 1;
  try { st = window._nosPy(src, mode, argv); } catch (e) { PY.out.push([String(e.message || e) + '\n', true]); }
  let text = PY.out.map(x => x[0]).join(''); PY.out = null;
  text = text.replace(/  File "[^"]*nosboot", line \d+, in \w+\n(    .*\n)?(    [\s^~]+\n)?/g, '');
  if (text) { const t = text.replace(/\n$/, ''); if (c.tty) c.T.print(esc(t)); else c.buf.push(t); }
  return typeof st === 'number' ? st : 0;
}
const FALLBACK_PY = CMDS.python3;
CMDS.python3 = async (c, a) => {
  if (a[0] === '--version' || a[0] === '-V') return c.out(`Python ${BRYTHON_VER.split('.').slice(0, 2).join('.')} (Brython ${BRYTHON_VER})`);
  const T = c.T; let note = null;
  if (!window.__BRYTHON__) { note = c.tty ? T.print('<span class="c-d">Loading Python 3.14 (Brython, about 6 MB the first time)…</span>') : null; }
  try { await loadPython(); }
  catch (e) {
    if (note) note.remove();
    c.err('python3: could not download the Python runtime (are you offline?). Falling back to calculator mode.');
    return FALLBACK_PY(c, a);
  }
  if (note) note.remove();
  if (a[0] === '-c') return pyExec(c, a[1] || '', '<string>', ['-c', ...a.slice(2)]);
  if (a[0] && a[0] !== '-i') {
    const p = c.path(a[0]), n = getNode(p);
    if (!n || n.type === 'dir') return c.err(`python3: can't open file '${p}': [Errno 2] No such file or directory`), 2;
    return pyExec(c, n.content || '', a[0], a);
  }
  if (!c.tty) { if (c.stdin) return pyExec(c, c.stdin, '<stdin>', ['-']); return 0; }
  c.out(`Python 3.14 (Brython ${BRYTHON_VER}, running in your browser) on nightos\nType "help", "copyright", "credits" or "license" for more information.`);
  const repl = T.repl = {
    prompt: '&gt;&gt;&gt; ', prompt0: '&gt;&gt;&gt; ', buf: [],
    handle: async line => {
      if (repl.buf.length) {
        if (line.trim() === '') { const src = repl.buf.join('\n'); repl.buf = []; repl.prompt = repl.prompt0; pyExec(c, src, 'single', ['']); }
        else repl.buf.push(line);
        return;
      }
      if (/^\s*(exit|quit)\(\)\s*$/.test(line)) { T.repl = null; return; }
      if (/^\s*(exit|quit)\s*$/.test(line)) { T.print('Use exit() or Ctrl-D (i.e. EOF) to exit'); return; }
      if (!line.trim()) return;
      if (/:\s*(#.*)?$/.test(line) || window._nosPyCheck(line) === 'more') { repl.buf.push(line); repl.prompt = '... '; return; }
      pyExec(c, line, 'single', ['']);
    }
  };
};
CMDS.python = CMDS.python3;
CMDS.pip = CMDS.pip3 = c => c.err('pip: installing packages is not available here. The Brython standard library (math, random, json, datetime, re, collections, itertools…) is already included.');

/* ================= real JavaScript (your browser's engine, in a Web Worker) ================= */
const NODE_WORKER = `
const show = (v, depth = 0, top = false) => {
  const t = typeof v;
  if (v === null) return 'null'; if (t === 'undefined') return 'undefined';
  if (t === 'string') return top || depth ? "'" + v.replace(/'/g, "\\\\'") + "'" : v;
  if (t === 'number' || t === 'boolean') return Object.is(v, -0) ? '-0' : String(v);
  if (t === 'bigint') return v + 'n'; if (t === 'symbol') return v.toString();
  if (t === 'function') return /^class\\s/.test(Function.prototype.toString.call(v)) ? '[class ' + (v.name || '(anonymous)') + ']' : '[Function: ' + (v.name || '(anonymous)') + ']';
  if (v instanceof Error) return v.stack ? v.name + ': ' + v.message : String(v);
  if (v instanceof Date) return isNaN(v) ? 'Invalid Date' : v.toISOString();
  if (v instanceof RegExp) return String(v);
  if (v instanceof Promise) return 'Promise { <pending> }';
  if (depth > 2) return Array.isArray(v) ? '[Array]' : '[Object]';
  if (Array.isArray(v)) { const items = v.slice(0, 100).map(x => show(x, depth + 1)); if (v.length > 100) items.push('... ' + (v.length - 100) + ' more items'); return items.length ? '[ ' + items.join(', ') + ' ]' : '[]'; }
  if (v instanceof Map) return 'Map(' + v.size + ') { ' + [...v].map(([k, x]) => show(k, depth + 1) + ' => ' + show(x, depth + 1)).join(', ') + ' }';
  if (v instanceof Set) return 'Set(' + v.size + ') { ' + [...v].map(x => show(x, depth + 1)).join(', ') + ' }';
  const keys = Object.keys(v), name = v.constructor && v.constructor !== Object ? v.constructor.name + ' ' : '';
  if (!keys.length) return name + '{}';
  return name + '{ ' + keys.slice(0, 50).map(k => (/^[A-Za-z_$][\\w$]*$/.test(k) ? k : "'" + k + "'") + ': ' + show(v[k], depth + 1)).join(', ') + ' }';
};
const fmt = args => { if (typeof args[0] === 'string' && /%[sdifoOj]/.test(args[0])) { let i = 1; const s = args[0].replace(/%([sdifoOj%])/g, (m, c) => c === '%' ? '%' : i >= args.length ? m : c === 's' ? String(args[i++]) : c === 'd' || c === 'i' ? String(parseInt(args[i++])) : c === 'f' ? String(parseFloat(args[i++])) : show(args[i++], 1)); return [s, ...args.slice(i).map(x => show(x))].join(' '); } return args.map(x => show(x)).join(' '); };
let ID = 0;
const send = (type, text) => postMessage({ id: ID, type, text });
self.console = { log: (...a) => send('out', fmt(a)), info: (...a) => send('out', fmt(a)), debug: (...a) => send('out', fmt(a)), warn: (...a) => send('err', fmt(a)), error: (...a) => send('err', fmt(a)), table: v => send('out', show(v)), clear() {} };
self.require = m => { throw new Error("Cannot find module '" + m + "'. Modules are not available in this shell."); };
self.process = { argv: ['node'], env: {}, platform: 'linux', exit: c => { throw { __exit: c || 0 }; }, version: 'v-nightos', versions: {} };
onmessage = async e => {
  const { id, code, repl, argv } = e.data; ID = id; if (argv) self.process.argv = argv;
  try {
    let src = code; if (repl) src = src.replace(/^(\\s*)(const|let)\\s+/gm, '$1var ').replace(/^(\\s*)class\\s+([A-Za-z_$][\\w$]*)/gm, '$1var $2 = class $2');
    let r = (0, eval)(src);
    if (r instanceof Promise && repl) { try { r = await r; } catch (err) { throw err; } }
    postMessage({ id, done: true, result: repl ? show(r, 0, true) : null });
  } catch (err) {
    if (err && err.__exit !== undefined) { postMessage({ id, done: true, exit: err.__exit }); return; }
    postMessage({ id, done: true, error: 'Uncaught ' + (err instanceof Error ? err.name + ': ' + err.message : show(err, 0, true)) });
  }
};
`;
const NODE = { busyMs: 0, startedAt: 0 };
function nodeWorker() {
  const url = URL.createObjectURL(new Blob([NODE_WORKER], { type: 'text/javascript' }));
  const w = new Worker(url); URL.revokeObjectURL(url); return w;
}
function nodeRun(c, worker, code, opts = {}) {
  return new Promise((res, rej) => {
    const id = Math.random(); const t0 = performance.now(); NODE.startedAt = t0;
    const out = t => { if (c.tty) c.T.print(esc(t)); else c.buf.push(t); };
    const onMsg = e => {
      const m = e.data; if (m.id !== id) { if (m.type) out(m.text); return; }
      if (m.type === 'out') return out(m.text);
      if (m.type === 'err') return c.tty ? c.T.print(`<span class="c-r">${esc(m.text)}</span>`) : out(m.text);
      if (m.done) { finish(); if (m.error) { c.T.print(`<span class="c-r">${esc(m.error)}</span>`); res(1); } else { if (opts.repl && m.result !== undefined) c.T.print(`<span class="${m.result === 'undefined' ? 'c-d' : ''}">${esc(m.result)}</span>`); res(m.exit != null ? m.exit : 0); } }
    };
    const iv = setInterval(() => { if (c.T.cancel) { c.T.cancel = false; finish(); worker.terminate(); rej('SIGINT'); } }, 40);
    const finish = () => { clearInterval(iv); NODE.busyMs += performance.now() - t0; NODE.startedAt = 0; worker.removeEventListener('message', onMsg); if (!opts.repl) worker.removeEventListener('message', keep); };
    const keep = e => { if (e.data.type && e.data.id !== id) out(e.data.text); };
    worker.addEventListener('message', onMsg);
    worker.postMessage({ id, code, repl: !!opts.repl, argv: opts.argv });
  });
}
const engineName = () => { const u = navigator.userAgent; const m = u.match(/(Edg|Chrome|Firefox)\/(\d+)/) || u.match(/Version\/(\d+).*Safari/); return m ? (m[1] === 'Edg' ? 'Edge ' + m[2] : m[2] ? m[1] + ' ' + m[2] : 'Safari ' + m[1]) : 'your browser'; };
CMDS.node = async (c, a) => {
  if (a[0] === '--version' || a[0] === '-v') return c.out(`nightos-js 1.0 (JavaScript engine of ${engineName()})`);
  const T = c.T;
  if (a[0] === '-e' || a[0] === '-p' || a[0] === '--eval' || a[0] === '--print') {
    const w = nodeWorker(); const code = a[0] === '-p' || a[0] === '--print' ? `console.log(${a[1] || 'undefined'})` : (a[1] || '');
    try { return await nodeRun(c, w, code, { argv: ['node', ...a.slice(2)] }); } finally { setTimeout(() => w.terminate(), 3000); }
  }
  if (a[0]) {
    const p = c.path(a[0]), n = getNode(p);
    if (!n || n.type === 'dir') return c.err(`node: cannot open file '${p}': No such file or directory`), 1;
    const w = nodeWorker();
    try { return await nodeRun(c, w, (n.content || '').replace(/^#!.*\n/, ''), { argv: ['node', p, ...a.slice(1)] }); } finally { setTimeout(() => w.terminate(), 3000); }
  }
  if (!c.tty) return 0;
  c.out(`Welcome to the NightOS JavaScript shell, running on the ${engineName()} engine.\nType ".help" for more information.`);
  let worker = nodeWorker();
  const repl = T.repl = {
    prompt: '&gt; ', prompt0: '&gt; ', buf: [], interrupt: '(To exit, press Ctrl+D or type .exit)',
    handle: async line => {
      if (!repl.buf.length) {
        if (line.trim() === '.exit') { worker.terminate(); T.repl = null; return; }
        if (line.trim() === '.help') { T.print('.exit     Exit the shell\n.help     Print this help message\n.clear    Reset the shell state\n\nPress Ctrl+C to stop running code. Ctrl+D exits.'); return; }
        if (line.trim() === '.clear') { worker.terminate(); worker = nodeWorker(); T.print('Clearing context...'); return; }
        if (!line.trim()) return;
      }
      repl.buf.push(line); const src = repl.buf.join('\n');
      let open = 0, q = null; for (let i = 0; i < src.length; i++) { const ch = src[i]; if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; } if (ch === '"' || ch === "'" || ch === '`') q = ch; else if ('([{'.includes(ch)) open++; else if (')]}'.includes(ch)) open--; }
      if (open > 0 || q === '`') { repl.prompt = '... '; return; }
      repl.buf = []; repl.prompt = repl.prompt0;
      try { await nodeRun(c, worker, src, { repl: true }); }
      catch (e) { if (e === 'SIGINT') { worker = nodeWorker(); T.print('Uncaught Error: Script execution was interrupted by `SIGINT`'); return; } throw e; }
    }
  };
  Object.defineProperty(T, 'nodeWorker', { get: () => T.repl === repl ? worker : null, configurable: true });
};
CMDS.nodejs = CMDS.node; CMDS.js = CMDS.node;
CMDS.npm = CMDS.npx = c => c.err('npm: package downloads are blocked in the NightOS sandbox. Plain JavaScript runs with `node`.');
DESC.node = 'run JavaScript on the browser engine'; DESC.python = DESC.python3; DESC.read = 'read a line from the terminal into variables';
DESC.test = 'check file types and compare values'; DESC.printf = 'format and print data'; DESC.screenshot = 'take a screenshot of the desktop';
