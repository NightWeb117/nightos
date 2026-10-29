'use strict';
// Lists the program windows open on your PC and brings one forward, minimizes or closes it, for
// NightOS's taskbar. One hidden PowerShell process with a small C# helper answers the requests.
const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path'), fs = require('fs');

const HELPER = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class NW {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint c);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool i, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int f, StringBuilder s, ref int n);
  static string Exe(uint pid) { IntPtr p = OpenProcess(0x1000, false, pid); if (p == IntPtr.Zero) return ""; var sb = new StringBuilder(1024); int n = sb.Capacity; string r = QueryFullProcessImageName(p, 0, sb, ref n) ? sb.ToString() : ""; CloseHandle(p); return r; }
  static string Clean(string s) { return s.Replace("\t", " ").Replace("\n", " ").Replace("\r", " "); }
  public static string List() {
    var sb = new StringBuilder(); sb.Append(GetForegroundWindow().ToInt64()).Append('\n');
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true;
      int ex = GetWindowLong(h, -20); if ((ex & 0x80) != 0 && (ex & 0x40000) == 0) return true;
      int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
      var t = new StringBuilder(512); GetWindowText(h, t, 512); if (t.Length == 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      sb.Append(h.ToInt64()).Append('\t').Append(pid).Append('\t').Append(IsIconic(h) ? 1 : 0).Append('\t').Append(Clean(Exe(pid))).Append('\t').Append(Clean(t.ToString())).Append('\n');
      return true;
    }, IntPtr.Zero);
    return sb.ToString();
  }
  public static string Act(long id, string what) {
    IntPtr h = new IntPtr(id); if (!IsWindow(h)) return "gone";
    if (what == "minimize") ShowWindow(h, 6);
    else if (what == "close") PostMessage(h, 0x10, IntPtr.Zero, IntPtr.Zero);
    else { if (IsIconic(h)) ShowWindow(h, 9); keybd_event(0x12, 0, 0, UIntPtr.Zero); SetForegroundWindow(h); keybd_event(0x12, 0, 2, UIntPtr.Zero); }
    return "ok";
  }
}
'@
[Console]::OutputEncoding = [Text.Encoding]::UTF8
while ($true) {
  $line = [Console]::In.ReadLine(); if ($line -eq $null) { break }
  try {
    $p = $line.Split(' ')
    if ($p[0] -eq 'list') { $out = [NW]::List() } else { $out = [NW]::Act([long]$p[1], $p[0]) }
  } catch { $out = 'error ' + $_.Exception.Message }
  [Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($out)) + "` + '`n' + String.raw`")
  [Console]::Out.Flush()
}
`;

module.exports = function wintasks() {
  let ps = null, buf = '', queue = [], icons = new Map(), known = new Set();
  const ownPids = () => new Set(app.getAppMetrics().map(m => m.pid));
  function start() {
    const file = path.join(app.getPath('userData'), 'window-helper.ps1'); fs.writeFileSync(file, HELPER);
    ps = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    ps.stdout.setEncoding('utf8');
    ps.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); const q = queue.shift(); if (q) q.res(Buffer.from(line, 'base64').toString('utf8')); } });
    ps.on('exit', () => { ps = null; buf = ''; queue.splice(0).forEach(q => q.rej(new Error('The window helper stopped'))); });
  }
  const ask = cmd => new Promise((res, rej) => {
    if (!ps) start();
    const q = { res, rej }; queue.push(q); ps.stdin.write(cmd + '\n');
    setTimeout(() => { const i = queue.indexOf(q); if (i >= 0) { rej(new Error('The window helper took too long')); if (ps) ps.kill(); } }, 15000);
  });
  async function icon(exe) {
    if (!exe) return null; if (icons.has(exe)) return icons.get(exe);
    let u = null; try { const img = await app.getFileIcon(exe, { size: 'normal' }); if (!img.isEmpty()) u = img.toDataURL(); } catch (e) { }
    icons.set(exe, u); return u;
  }
  return {
    async list() {
      const text = await ask('list'); if (text.startsWith('error')) throw new Error(text.slice(6));
      const [fg, ...rows] = text.split('\n'), mine = ownPids(), out = [];
      for (const r of rows) {
        const [hwnd, pid, min, exe, ...t] = r.split('\t'); const title = t.join(' ').trim().replace(/^\[WARN:[^\]]*\]\s*/, ''); // WSLg adds a [WARN:COPY MODE] tag to Linux windows
        if (!hwnd || !title || mine.has(+pid) || title === 'Program Manager' || /\\(TextInputHost|SystemSettings|ShellExperienceHost|SearchHost|StartMenuExperienceHost)\.exe$/i.test(exe)) continue;
        out.push({ hwnd: +hwnd, pid: +pid, min: min === '1', title: title.slice(0, 120), exe, icon: await icon(exe) });
      }
      known = new Set(out.map(w => w.hwnd));
      return { foreground: +fg || 0, windows: out };
    },
    async act(hwnd, what) {
      if (!known.has(+hwnd)) throw new Error('Unknown window');
      if (!['focus', 'minimize', 'close'].includes(what)) throw new Error('Unknown action');
      const r = await ask(`${what} ${+hwnd}`); if (r !== 'ok') throw new Error(r === 'gone' ? 'That window is gone' : r);
      return true;
    },
    stop() { if (ps) { ps.stdin.end(); ps.kill(); ps = null; } }
  };
};
