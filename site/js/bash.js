'use strict';
/* ================= bash: parser and interpreter =================
   Supports ; && || pipes, redirects, $VAR, $(cmd), `cmd`, $((math)), ((math)),
   if/elif/else, for, while/until, functions, break/continue/return, source, aliases. */
const INCOMPLETE = { incomplete: true };
function splitStatements(src) {
  const out = []; let cur = '', q = null, depth = 0, bt = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q === "'") { cur += ch; if (ch === "'") q = null; continue; }
    if (ch === '\\' && i + 1 < src.length) { if (src[i + 1] === '\n') { i++; continue; } cur += ch + src[++i]; continue; }
    if (ch === '`') { bt = !bt; cur += ch; continue; }
    if (bt) { cur += ch; continue; }
    if (ch === '$' && src[i + 1] === '(') { depth++; cur += '$('; i++; continue; }
    if (depth && ch === '(') { depth++; cur += ch; continue; }
    if (depth && ch === ')') { depth--; cur += ch; continue; }
    if (q === '"') { cur += ch; if (ch === '"') q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (depth) { cur += ch; continue; }
    if (ch === '#' && (!cur || /\s$/.test(cur))) { while (i + 1 < src.length && src[i + 1] !== '\n') i++; continue; }
    if (ch === '(' && src[i + 1] === '(' && !cur.trim()) { const j = src.indexOf('))', i); if (j < 0) throw INCOMPLETE; cur += src.slice(i, j + 2); i = j + 1; continue; }
    if (ch === ';' || ch === '\n') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (q || depth || bt) throw INCOMPLETE;
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function normalizeStatements(list) {
  const out = [];
  for (let s of list) {
    for (;;) {
      let m;
      if ((m = s.match(/^(do|then|else|\{)\s+([\s\S]+)$/))) { out.push(m[1]); s = m[2]; continue; }
      if ((m = s.match(/^(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*(\{)?\s*([\s\S]*)$/)) || (m = s.match(/^function\s+([A-Za-z_][\w-]*)\s*(\{)?\s*([\s\S]*)$/))) {
        out.push('\0FUNC ' + m[1]); if (m[2]) out.push('{'); s = m[3]; if (!s) break; continue;
      }
      if ((m = s.match(/^([\s\S]*\S)\s+(\}|done|fi)$/)) && !/^(echo|printf)\b/.test(s)) { out.push(m[1]); out.push(m[2]); break; }
      out.push(s); break;
    }
  }
  return out.filter(Boolean);
}
const firstWord = s => s.split(/\s+/)[0];
function parseSource(src) {
  const L = normalizeStatements(splitStatements(src));
  const r = parseBlock(L, 0, []);
  return r.nodes;
}
function parseBlock(L, i, stops) {
  const nodes = [];
  while (i < L.length) {
    const s = L[i], w = firstWord(s);
    if (stops.includes(w)) return { nodes, i, stop: w };
    if (['then', 'do', 'done', 'fi', 'elif', 'else', '}'].includes(w)) throw new Error(`syntax error near unexpected token \`${w}'`);
    if (w === 'if' || w === 'while' || w === 'until') {
      const branches = []; let els = null;
      const rest = s.slice(w.length).trim(); if (rest) L[i] = rest; else i++;
      if (w === 'if') {
        let c = parseBlock(L, i, ['then']); let b = parseBlock(L, c.i + 1, ['elif', 'else', 'fi']);
        branches.push({ cond: c.nodes, body: b.nodes }); i = b.i;
        while (b.stop === 'elif') { const r2 = L[i].slice(4).trim(); if (r2) L[i] = r2; else i++; c = parseBlock(L, i, ['then']); b = parseBlock(L, c.i + 1, ['elif', 'else', 'fi']); branches.push({ cond: c.nodes, body: b.nodes }); i = b.i; }
        if (b.stop === 'else') { const e = parseBlock(L, i + 1, ['fi']); els = e.nodes; i = e.i; }
        nodes.push({ t: 'if', branches, els }); i++;
      } else {
        const c = parseBlock(L, i, ['do']), b = parseBlock(L, c.i + 1, ['done']);
        nodes.push({ t: 'while', until: w === 'until', cond: c.nodes, body: b.nodes }); i = b.i + 1;
      }
      continue;
    }
    if (w === 'for') {
      const m = s.match(/^for\s+([A-Za-z_]\w*)(?:\s+in\s+([\s\S]*))?$/);
      if (!m) throw new Error("syntax error near `for'");
      const d = parseBlock(L, i + 1, ['do']); if (d.nodes.length) throw new Error("syntax error near unexpected token `do'");
      const b = parseBlock(L, d.i + 1, ['done']);
      nodes.push({ t: 'for', v: m[1], words: m[2] == null ? '"$@"' : m[2], body: b.nodes }); i = b.i + 1; continue;
    }
    if (s.startsWith('\0FUNC ')) {
      const name = s.slice(6); let j = i + 1;
      if (L[j] !== '{') { if (j >= L.length) throw INCOMPLETE; throw new Error(`syntax error near \`${L[j]}'`); }
      const b = parseBlock(L, j + 1, ['}']);
      nodes.push({ t: 'func', name, body: b.nodes }); i = b.i + 1; continue;
    }
    if (w === '{') { const b = parseBlock(L, i + 1, ['}']); nodes.push({ t: 'group', body: b.nodes }); i = b.i + 1; continue; }
    nodes.push({ t: 'cmd', src: s }); i++;
  }
  if (stops.length) throw INCOMPLETE;
  return { nodes, i };
}

/* ---------- execution ---------- */
async function yieldTick(T) { await new Promise(r => setTimeout(r, 0)); if (T.cancel) { T.cancel = false; throw 'SIGINT'; } }
async function runLine(T, src) {
  try { return await execSource(T, src, {}); }
  catch (e) {
    if (e && e.exit != null) return e.exit;
    if (e && e.ret != null) { T.print(esc("bash: return: can only `return' from a function or sourced script")); return 1; }
    if (e && (e.brk || e.cont)) return 0;
    throw e;
  }
}
async function execSource(T, src, io) {
  let nodes; try { nodes = parseSource(src); } catch (e) { if (e === INCOMPLETE) { T.print(esc('bash: syntax error: unexpected end of file')); return 2; } T.print(esc('bash: ' + e.message)); return 2; }
  return execNodes(T, nodes, io);
}
async function execNodes(T, nodes, io) {
  let st = 0;
  for (const n of nodes) { st = await execNode(T, n, io); T.status = st; if (T.closed) break; }
  return st;
}
async function loopBody(T, body, io) {
  try { return { st: await execNodes(T, body, io) }; }
  catch (e) {
    if (e && e.brk) { if (--e.brk > 0) throw e; return { brk: true }; }
    if (e && e.cont) { if (--e.cont > 0) throw e; return { st: 0 }; }
    throw e;
  }
}
async function execNode(T, n, io) {
  switch (n.t) {
    case 'cmd': return runAndOr(T, n.src, io);
    case 'if':
      for (const b of n.branches) if ((await execNodes(T, b.cond, io)) === 0) return execNodes(T, b.body, io);
      return n.els ? execNodes(T, n.els, io) : 0;
    case 'for': {
      const words = await expandWords(T, n.words, io); let st = 0, k = 0;
      for (const w of words) { T.env[n.v] = w; const r = await loopBody(T, n.body, io); if (r.brk) break; st = r.st; if (++k % 20 === 0) await yieldTick(T); }
      return st;
    }
    case 'while': {
      let st = 0, k = 0;
      for (;;) {
        const c = await execNodes(T, n.cond, io); if ((c === 0) === n.until) break;
        const r = await loopBody(T, n.body, io); if (r.brk) break; st = r.st;
        if (++k % 20 === 0) await yieldTick(T); if (T.closed) break;
      }
      return st;
    }
    case 'func': T.funcs[n.name] = n.body; return 0;
    case 'group': return execNodes(T, n.body, io);
  }
  return 0;
}
async function runAndOr(T, src, io) {
  const { parts, ops } = splitTop(src, ['&&', '||']);
  let st = 0;
  for (let i = 0; i < parts.length; i++) {
    const op = ops[i - 1];
    if (op === '&&' && st !== 0) continue;
    if (op === '||' && st === 0) continue;
    const p = parts[i].trim();
    if (!p) { T.print(esc(`bash: syntax error near unexpected token \`${ops[i] || ops[i - 1]}'`)); return 2; }
    let neg = false, cmd = p; if (/^!\s/.test(cmd)) { neg = true; cmd = cmd.slice(2); }
    const m = cmd.match(/^\(\(([\s\S]*)\)\)$/);
    if (m) { try { st = arith(T, m[1]) !== 0 ? 0 : 1; } catch (e) { T.print(esc(`bash: ((: ${m[1]}: ${e.message}`)); st = 1; } }
    else st = await runPipeline(T, cmd, io);
    if (neg) st = st === 0 ? 1 : 0;
    T.status = st; if (T.closed) break;
  }
  return st;
}
const MARK = /(\d+)/g;
async function expandSubst(T, s, io, subs) {
  let out = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q === "'") { out += ch; if (ch === "'") q = null; continue; }
    if (ch === '\\' && i + 1 < s.length) { out += ch + s[++i]; continue; }
    if (ch === '"') { q = q === '"' ? null : '"'; out += ch; continue; }
    if (ch === "'" && !q) { q = "'"; out += ch; continue; }
    if (ch === '$' && s[i + 1] === '(' && s[i + 2] === '(') {
      const j = s.indexOf('))', i + 3); if (j < 0) throw new Error('unexpected EOF while looking for matching `))\'');
      out += String(arith(T, s.slice(i + 3, j))); i = j + 1; continue;
    }
    if ((ch === '$' && s[i + 1] === '(') || ch === '`') {
      let j, inner;
      if (ch === '`') { j = s.indexOf('`', i + 1); if (j < 0) throw new Error('unexpected EOF while looking for matching ``\''); inner = s.slice(i + 1, j); }
      else { let d = 1; j = i + 2; for (; j < s.length && d; j++) { if (s[j] === '(') d++; else if (s[j] === ')') d--; } j--; if (d) throw new Error("unexpected EOF while looking for matching `)'"); inner = s.slice(i + 2, j); }
      const cap = [];
      await execSource(T, inner, { ...io, capture: cap, sub: true });
      subs.push({ v: cap.join('\n').replace(/\n+$/, ''), q: q === '"' });
      out += `${subs.length - 1}`; i = j; continue;
    }
    out += ch;
  }
  return out;
}
function argvFrom(T, toks, subs) {
  const out = [];
  for (const t of toks) {
    const only = t.v.match(/^(\d+)$/);
    if (only && !subs[+only[1]].q) { out.push(...subs[+only[1]].v.split(/\s+/).filter(Boolean)); continue; }
    out.push({ v: t.v.replace(MARK, (_, k) => subs[+k].v), glob: t.glob });
  }
  return expandGlobs(out.map(x => typeof x === 'string' ? { v: x, glob: /[*?]/.test(x) } : x), T.cwd);
}
async function expandWords(T, src, io) {
  if (src.trim() === '"$@"') return (T.env['@'] || '').split(' ').filter(Boolean);
  const subs = []; const s = await expandSubst(T, src, io, subs);
  return argvFrom(T, tokenize(s, T.env), subs);
}
async function runPipeline(T, cmd, io = {}, root = false) {
  const subs = [];
  try { cmd = await expandSubst(T, cmd, io, subs); } catch (e) { if (e === 'SIGINT' || (e && (e.exit != null || e.ret != null))) throw e; T.print(esc('bash: ' + (e.message || e))); return 2; }
  const { parts } = splitTop(cmd, ['|']);
  let redir = null, inFile = null;
  const lastSplit = splitTop(parts[parts.length - 1], ['>>', '>']);
  if (lastSplit.parts.length > 1) {
    parts[parts.length - 1] = lastSplit.parts[0];
    const target = tokenize(lastSplit.parts[1].replace(MARK, (_, k) => subs[+k].v), T.env)[0];
    if (!target) { T.print(esc("bash: syntax error near unexpected token `newline'")); return 2; }
    redir = { path: resolve(target.v, T.cwd), append: lastSplit.ops[0] === '>>', name: target.v };
  }
  const firstSplit = splitTop(parts[0], ['<']);
  if (firstSplit.parts.length > 1) { parts[0] = firstSplit.parts[0]; inFile = tokenize(firstSplit.parts[1], T.env)[0]; }
  let stdin = null, status = 0;
  if (inFile) { const n = getNode(resolve(inFile.v, T.cwd)); if (!n || n.type === 'dir') { T.print(esc(`bash: ${inFile.v}: ${n ? 'Is a directory' : 'No such file or directory'}`)); return 1; } stdin = (n.content || '').replace(/\n$/, ''); }
  for (let i = 0; i < parts.length; i++) {
    let argv;
    try { argv = argvFrom(T, tokenize(parts[i], T.env), subs); } catch (e) { T.print(esc('bash: ' + (e.message || e))); return 2; }
    if (!argv.length) { if (parts.length > 1) { T.print(esc("bash: syntax error near unexpected token `|'")); return 2; } continue; }
    const last = i === parts.length - 1;
    const ctx = makeCtx(T, { stdin, tty: last && !redir && !io.capture, root, io });
    status = await execArgv(ctx, argv);
    stdin = ctx.buf.join('\n');
  }
  if (redir) {
    if (redir.path === '/dev/null') return status;
    try { fsWrite(redir.path, (stdin || '') + (stdin ? '\n' : ''), { append: redir.append, root: T.root || root }); }
    catch (e) { T.print(esc(`bash: ${redir.name}: ${ERR[e] || e}`)); return 1; }
  } else if (io.capture && stdin) io.capture.push(stdin);
  return status;
}
function arith(T, expr) {
  expr = expr.trim(); const num = n => { const v = parseInt(T.env[n], 10); return isNaN(v) ? 0 : v; };
  let m;
  if ((m = expr.match(/^([A-Za-z_]\w*)\s*(\+\+|--)$/))) { const o = num(m[1]); T.env[m[1]] = String(o + (m[2] === '++' ? 1 : -1)); return o; }
  if ((m = expr.match(/^(\+\+|--)\s*([A-Za-z_]\w*)$/))) { const v = num(m[2]) + (m[1] === '++' ? 1 : -1); T.env[m[2]] = String(v); return v; }
  if ((m = expr.match(/^([A-Za-z_]\w*)\s*([-+*/%])?=(?!=)\s*([\s\S]+)$/))) {
    const r = arith(T, m[3]), o = num(m[1]);
    const v = !m[2] ? r : m[2] === '+' ? o + r : m[2] === '-' ? o - r : m[2] === '*' ? o * r : m[2] === '/' ? Math.trunc(o / r) : o % r;
    if ((m[2] === '/' || m[2] === '%') && r === 0) throw new Error('division by 0 (error token is "0")');
    T.env[m[1]] = String(v); return v;
  }
  const js = expr.replace(/\$?\{?([A-Za-z_]\w*)\}?/g, (_, n) => String(num(n))).replace(/\$(\d)/g, (_, n) => String(num(n)));
  if (!/^[\d\s+\-*/%()<>=!&|^~?:]*$/.test(js)) throw new Error('syntax error in expression');
  if (/\/\s*0(?!\d)|%\s*0(?!\d)/.test(js)) throw new Error('division by 0 (error token is "0")');
  const v = Function('"use strict";return (' + (js || '0') + ')')();
  return typeof v === 'boolean' ? (v ? 1 : 0) : Math.trunc(v);
}
async function runScript(c, n, p, args = [], sourced = false) {
  const T = c.T, txt = n.content || '', first = txt.split('\n')[0];
  if (/^#!.*python/.test(first)) return execArgv(c, ['python3', p, ...args]);
  if (/^#!.*node/.test(first)) return execArgv(c, ['node', p, ...args]);
  const saved = { pos: {}, cwd: T.cwd, env: sourced ? null : { ...T.env } };
  ['0', '#', '@', '*', ...Array.from({ length: 9 }, (_, i) => String(i + 1))].forEach(k => saved.pos[k] = T.env[k]);
  setPositional(T, p, args);
  let st = 0;
  try { st = await execSource(T, txt, { ...c.io, script: true, capture: c.tty ? c.io.capture : c.buf }); }
  catch (e) { if (e && e.exit != null) st = e.exit; else if (e && e.ret != null) st = e.ret; else throw e; }
  finally {
    Object.assign(T.env, saved.pos);
    if (!sourced) { T.cwd = saved.cwd; for (const k of Object.keys(T.env)) if (!(k in saved.env)) delete T.env[k]; }
  }
  return st;
}
function setPositional(T, zero, args) {
  for (let i = 1; i <= 9; i++) delete T.env[String(i)];
  T.env['0'] = zero; args.forEach((a, i) => { T.env[String(i + 1)] = a; });
  T.env['#'] = String(args.length); T.env['@'] = T.env['*'] = args.join(' ');
}
async function callFunction(c, name, args) {
  const T = c.T, saved = {};
  ['#', '@', '*', ...Array.from({ length: 9 }, (_, i) => String(i + 1))].forEach(k => saved[k] = T.env[k]);
  setPositional(T, T.env['0'] || 'bash', args);
  try { return await execNodes(T, T.funcs[name], { ...c.io, capture: c.tty ? c.io.capture : c.buf }); }
  catch (e) { if (e && e.ret != null) return e.ret; throw e; }
  finally { for (const k of Object.keys(saved)) { if (saved[k] == null) delete T.env[k]; else T.env[k] = saved[k]; } }
}

/* ---------- builtins that need the interpreter ---------- */
function testExpr(c, a) {
  const orParts = []; let cur = [];
  for (const x of a) { if (x === '-o' || x === '||') { orParts.push(cur); cur = []; } else cur.push(x); } orParts.push(cur);
  const one = t => {
    if (t[0] === '!') return !one(t.slice(1));
    if (t.length === 0) return false;
    if (t.length === 1) return t[0] !== '';
    if (t.length === 2) {
      const [op, v] = t, p = c.path(v), n = getNode(p);
      switch (op) {
        case '-e': case '-a': return !!n; case '-f': return !!n && n.type === 'file'; case '-d': return !!n && n.type === 'dir';
        case '-s': return !!n && nodeSize(n) > 0; case '-r': return !!n && canRead(p, c.root); case '-w': return !!n && canWrite(p, c.root);
        case '-x': return !!n && (n.type === 'dir' || !!n.exec); case '-z': return v === ''; case '-n': return v !== ''; case '-L': case '-h': return false;
      }
      throw new Error(`${op}: unary operator expected`);
    }
    const [x, op, y] = t, ix = parseInt(x, 10), iy = parseInt(y, 10);
    const ints = () => { if (isNaN(ix) || !/^-?\d+$/.test(x.trim())) throw new Error(`${x}: integer expression expected`); if (isNaN(iy) || !/^-?\d+$/.test(y.trim())) throw new Error(`${y}: integer expression expected`); };
    switch (op) {
      case '=': case '==': return x === y; case '!=': return x !== y; case '<': return x < y; case '>': return x > y;
      case '-eq': ints(); return ix === iy; case '-ne': ints(); return ix !== iy; case '-lt': ints(); return ix < iy;
      case '-le': ints(); return ix <= iy; case '-gt': ints(); return ix > iy; case '-ge': ints(); return ix >= iy;
      case '=~': try { return new RegExp(y).test(x); } catch (e) { return false; }
    }
    throw new Error(`${op}: binary operator expected`);
  };
  const and = t => { const ps = []; let cu = []; for (const x of t) { if (x === '-a' || x === '&&') { ps.push(cu); cu = []; } else cu.push(x); } ps.push(cu); return ps.every(one); };
  return orParts.some(and);
}
function testCmd(name, close) {
  return (c, a) => {
    if (close) { if (a[a.length - 1] !== close) return c.err(`bash: ${name}: missing \`${close}'`), 2; a = a.slice(0, -1); }
    try { return testExpr(c, a) ? 0 : 1; } catch (e) { c.err(`bash: ${name}: ${e.message}`); return 2; }
  };
}
CMDS.test = testCmd('test'); CMDS['['] = testCmd('[', ']'); CMDS['[['] = testCmd('[[', ']]');
CMDS.read = async (c, a) => {
  a = a.slice(); let prompt = '', silent = false;
  for (let i = 0; i < a.length;) { if (a[i] === '-p') { prompt = a[i + 1] || ''; a.splice(i, 2); } else if (a[i] === '-s') { silent = true; a.splice(i, 1); } else if (a[i] === '-r') a.splice(i, 1); else i++; }
  const names = a.length ? a : ['REPLY'];
  let line;
  if (c.stdin != null) line = c.stdin.split('\n')[0];
  else line = await c.T.readLine(prompt, silent);
  if (line == null) return 1;
  const words = line.trim().split(/\s+/);
  names.forEach((n, i) => { c.T.env[n] = i === names.length - 1 ? words.slice(i).join(' ') : (words[i] || ''); });
  return 0;
};
CMDS.break = (c, a) => { throw { brk: +a[0] || 1 }; };
CMDS.continue = (c, a) => { throw { cont: +a[0] || 1 }; };
CMDS.return = (c, a) => { throw { ret: a[0] != null ? (+a[0] & 255) : c.T.status }; };
CMDS.let = (c, a) => { let v = 0; try { for (const e of a) v = arith(c.T, e); } catch (e) { return c.err('bash: let: ' + e.message), 1; } return v !== 0 ? 0 : 1; };
CMDS.source = async (c, a) => {
  if (!a[0]) return c.err('bash: source: filename argument required\nsource: usage: source filename [arguments]'), 2;
  const p = c.path(a[0]), n = getNode(p);
  if (!n) return c.err(`bash: ${a[0]}: No such file or directory`), 1;
  if (n.type === 'dir') return c.err(`bash: source: ${a[0]}: is a directory`), 1;
  return runScript(c, n, p, a.slice(1), true);
};
CMDS['.'] = CMDS.source;
CMDS.bash = async (c, a) => {
  if (a[0] === '-c') return execSource(c.T, a[1] || '', { ...c.io, capture: c.tty ? c.io.capture : c.buf });
  if (a[0] === '--version') return c.out('GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)\nCopyright (C) 2022 Free Software Foundation, Inc.');
  if (!a[0]) return c.out('');
  const p = c.path(a[0]), n = getNode(p);
  if (!n) return c.err(`bash: ${a[0]}: No such file or directory`), 127;
  return runScript(c, n, p, a.slice(1));
};
CMDS.sh = CMDS.bash;
CMDS.exit = (c, a) => {
  const code = +(a && a[0]) || 0;
  if (c.io.script || c.io.sub) throw { exit: code };
  if (c.T.root) { c.T.root = false; return; }
  closeWin(c.T.win, true);
};
CMDS.logout = CMDS.exit;
CMDS.alias = (c, a) => {
  const A = c.T.aliases;
  if (!a.length) { Object.keys(A).sort().forEach(k => c.out(`alias ${k}='${A[k]}'`)); return; }
  let st = 0;
  for (const x of a) { const i = x.indexOf('='); if (i > 0) A[x.slice(0, i)] = x.slice(i + 1); else if (A[x]) c.out(`alias ${x}='${A[x]}'`); else { c.err(`bash: alias: ${x}: not found`); st = 1; } }
  store.set('aliases', A); return st;
};
CMDS.unalias = (c, a) => { for (const x of a) { if (x === '-a') { for (const k in c.T.aliases) delete c.T.aliases[k]; } else delete c.T.aliases[x]; } store.set('aliases', c.T.aliases); };
CMDS.declare = (c, a) => { if (a[0] === '-f') { Object.keys(c.T.funcs).forEach(f => c.out(`${f} ()\n{\n    …\n}`)); return; } return CMDS.export(c, a); };
CMDS.local = (c, a) => { for (const x of a) { const i = x.indexOf('='); if (i > 0) c.T.env[x.slice(0, i)] = x.slice(i + 1); } };
CMDS.shift = (c, a) => { const n = +a[0] || 1, args = (c.T.env['@'] || '').split(' ').filter(Boolean).slice(n); setPositional(c.T, c.T.env['0'], args); };
CMDS.printf = (c, a) => {
  if (!a.length) return c.err('printf: usage: printf [-v var] format [arguments]'), 2;
  const fmt = a[0].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\'); let args = a.slice(1), out = '';
  const once = () => {
    let used = 0;
    const s = fmt.replace(/%([-+ 0#]*)(\d*)(?:\.(\d+))?([sdifxXoc%])/g, (m, fl, w, pr, t) => {
      if (t === '%') return '%';
      const v = args[used++] ?? ''; let r;
      if (t === 's') r = pr ? String(v).slice(0, +pr) : String(v);
      else if (t === 'd' || t === 'i') r = String(Math.trunc(+v || 0));
      else if (t === 'f') r = (+v || 0).toFixed(pr ? +pr : 6);
      else if (t === 'x') r = (Math.trunc(+v) || 0).toString(16); else if (t === 'X') r = (Math.trunc(+v) || 0).toString(16).toUpperCase();
      else if (t === 'o') r = (Math.trunc(+v) || 0).toString(8); else r = String(v)[0] || '';
      if (fl.includes('+') && /[dif]/.test(t) && +v >= 0) r = '+' + r;
      if (w) r = fl.includes('-') ? r.padEnd(+w) : r.padStart(+w, fl.includes('0') && /[difxXo]/.test(t) ? '0' : ' ');
      return r;
    });
    out += s; args = args.slice(used); return used;
  };
  do { if (!once()) break; } while (args.length);
  if (c.tty) { if (out) c.html(esc(out.replace(/\n$/, ''))); } else c.buf.push(out.replace(/\n$/, ''));
};
CMDS.echo = (c, a) => {
  let nl = true, e = false;
  while (a[0] && /^-[neE]+$/.test(a[0])) { if (a[0].includes('n')) nl = false; if (a[0].includes('e')) e = true; a = a.slice(1); }
  let s = a.join(' '); if (e) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\e\[[\d;]*m/g, '').replace(/\\\\/g, '\\');
  c.out(s); return 0;
};
CMDS.true = () => 0; CMDS.false = () => 1; CMDS[':'] = () => 0;
CMDS.type = (c, a) => {
  let st = 0;
  for (const n of a) {
    if (c.T.aliases[n]) c.out(`${n} is aliased to \`${c.T.aliases[n]}'`);
    else if (c.T.funcs[n]) c.out(`${n} is a function`);
    else if (['cd', 'exit', 'history', 'help', 'export', 'echo', 'pwd', 'read', 'test', '[', 'source', '.', 'alias', 'break', 'continue', 'return', 'let', 'printf', 'type', 'unset', 'shift', 'local', 'declare'].includes(n)) c.out(`${n} is a shell builtin`);
    else if (['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'function'].includes(n)) c.out(`${n} is a shell keyword`);
    else if (CMDS[n] && (!CMD_PKG[n] || INSTALLED.has(CMD_PKG[n]))) c.out(`${n} is /usr/bin/${n}`);
    else { c.err(`bash: type: ${n}: not found`); st = 1; }
  }
  return st;
};
delete CMDS.ll; delete CMDS.la;
