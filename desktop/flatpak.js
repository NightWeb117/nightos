'use strict';
// Flatpak apps from Flathub, run through WSL (Windows Subsystem for Linux).
// Flatpaks are Linux programs, so they install into the user's WSL distro with `flatpak --user`
// and open as their own windows through WSLg. The catalog comes from Flathub's public API.
const { dialog, net } = require('electron');
const { execFile, spawn } = require('child_process');
const path = require('path'), fs = require('fs');

const WSL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe');
const API = 'https://flathub.org/api/v2/';
const REPO = 'https://dl.flathub.org/repo/flathub.flatpakrepo';
const ENV = { ...process.env, WSL_UTF8: '1' };
// Flatpak app ids are reverse-DNS names like org.gimp.GIMP.
const validId = id => typeof id === 'string' && id.length < 200 && /^[A-Za-z][\w-]*(\.[\w-]+){2,}$/.test(id);
// Installs the flatpak package with whichever package manager the distro has (Ubuntu and Debian, Fedora, Arch, openSUSE).
const INSTALL_FLATPAK = 'if command -v apt-get >/dev/null; then apt-get update -q && DEBIAN_FRONTEND=noninteractive apt-get install -y -q flatpak; ' +
  'elif command -v dnf >/dev/null; then dnf install -y flatpak; elif command -v pacman >/dev/null; then pacman -Sy --noconfirm flatpak; ' +
  'elif command -v zypper >/dev/null; then zypper -n install flatpak; else echo "NightOS can not install Flatpak on this Linux. Install the flatpak package yourself, then try again." >&2; exit 3; fi';
const lastLine = s => String(s || '').split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).pop() || '';

module.exports = function flatpak({ getWin, send }) {
  let jobs = Promise.resolve(), running = null;
  const wsl = (args, opts = {}) => new Promise((res, rej) => execFile(WSL, args, { windowsHide: true, env: ENV, timeout: opts.timeout || 60000, maxBuffer: 8 << 20 }, (e, out, err) => e ? rej(Object.assign(new Error(lastLine(err) || e.message), { out, err })) : res(String(out))));
  const confirm = async (message, detail, ok) => (await dialog.showMessageBox(getWin(), { type: 'question', buttons: [ok, 'Cancel'], defaultId: 0, cancelId: 1, noLink: true, title: 'NightOS', message, detail })).response === 0;
  const event = patch => send({ ...running, ...patch });

  async function status() {
    if (!fs.existsSync(WSL)) return { wsl: false, distro: null, flatpak: null, flathub: false };
    let distros = '';
    try { distros = await wsl(['-l', '-q'], { timeout: 20000 }); } catch (e) { return { wsl: false, distro: null, flatpak: null, flathub: false }; }
    if (!distros.replace(/\0/g, '').trim()) return { wsl: true, distro: null, flatpak: null, flathub: false };
    try {
      const out = await wsl(['-e', 'sh', '-c', '. /etc/os-release; echo "$PRETTY_NAME"; flatpak --version 2>/dev/null || echo; flatpak remotes --user --columns=name 2>/dev/null; true'], { timeout: 90000 });
      const [distro, ver, ...remotes] = out.split('\n').map(s => s.trim());
      return { wsl: true, distro: distro || 'Linux', flatpak: ver ? ver.replace(/^Flatpak\s*/i, '') : null, flathub: remotes.includes('flathub') };
    } catch (e) { return { wsl: true, distro: null, flatpak: null, flathub: false, error: e.message }; }
  }

  // Sets up whatever is missing: WSL itself (needs admin and a restart), then Flatpak and Flathub.
  async function setup() {
    const s = await status();
    if (!s.wsl || !s.distro) {
      if (!await confirm('Install Linux (WSL) on this PC?', 'Flatpak apps are Linux programs. Windows can run them with the Windows Subsystem for Linux.\n\nWindows asks for administrator permission, installs Ubuntu, and needs a restart. After the restart, open Ubuntu once from the Start menu to choose a Linux user name and password.', 'Install')) return { status: 'cancelled' };
      spawn('powershell.exe', ['-NoProfile', '-Command', "Start-Process -FilePath wsl.exe -ArgumentList '--install','-d','Ubuntu' -Verb RunAs"], { windowsHide: true, stdio: 'ignore' });
      return { status: 'wsl-installing' };
    }
    if (!s.flatpak && !await confirm(`Set up Flatpak in ${s.distro}?`, 'NightOS installs the flatpak package in your WSL Linux with its package manager (as its administrator, no password needed) and adds Flathub, where the apps come from.\n\nThis downloads about 30 MB.', 'Set Up')) return { status: 'cancelled' };
    return queue({ id: '', op: 'setup' }, async () => {
      if (!s.flatpak) {
        event({ line: 'Installing Flatpak…' });
        await stream(['-u', 'root', '-e', 'sh', '-c', INSTALL_FLATPAK]);
      }
      event({ line: 'Adding Flathub…' });
      await wsl(['-e', 'flatpak', 'remote-add', '--user', '--if-not-exists', 'flathub', REPO], { timeout: 120000 });
      return status();
    });
  }

  // One install, removal or setup at a time; progress goes to the page as native:flatpak events.
  function queue(job, fn) {
    const p = jobs.then(async () => {
      running = { ...job, status: 'running', progress: 0, line: '' }; event({});
      try { const r = await fn(); event({ status: 'done', progress: 100 }); return r; }
      catch (e) { event({ status: 'error', line: e.message }); throw e; }
      finally { running = null; }
    });
    jobs = p.catch(() => { });
    return p;
  }
  function stream(args) {
    return new Promise((res, rej) => {
      const c = spawn(WSL, args, { windowsHide: true, env: ENV });
      let tail = '';
      const onData = d => {
        const text = String(d); tail = (tail + text).slice(-4000);
        const pct = [...text.matchAll(/(\d{1,3})%/g)].pop();
        const line = lastLine(text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''));
        event({ ...(pct ? { progress: Math.min(99, +pct[1]) } : {}), ...(line ? { line: line.slice(0, 160) } : {}) });
      };
      c.stdout.on('data', onData); c.stderr.on('data', onData);
      c.on('error', rej);
      c.on('close', code => code === 0 ? res(tail) : rej(new Error(lastLine(tail.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')) || 'Exited with code ' + code)));
    });
  }

  async function list() {
    const out = await wsl(['-e', 'flatpak', 'list', '--app', '--columns=application,name,version,installation'], { timeout: 60000 }).catch(() => '');
    return out.split('\n').map(l => l.split('\t')).filter(c => validId(c[0])).map(([id, name, version, where]) => ({ id, name: name || id, version: version || '', where: where || '' }));
  }
  async function install(id, name) {
    if (!validId(id)) throw new Error('Not a Flatpak app id');
    if (!await confirm(`Install ${name || id}?`, `${id} comes from Flathub and installs into your WSL Linux. The first Flatpak app can download a few hundred MB of shared parts.`, 'Install')) return false;
    return queue({ id, op: 'install' }, () => stream(['-e', 'flatpak', 'install', '--user', '-y', '--noninteractive', 'flathub', id]).then(() => true));
  }
  async function uninstall(id) {
    if (!validId(id) || !(await list()).some(a => a.id === id && a.where === 'user')) throw new Error('That app isn’t installed for you');
    return queue({ id, op: 'uninstall' }, () => stream(['-e', 'flatpak', 'uninstall', '--user', '-y', '--noninteractive', id]).then(() => true));
  }
  // Only apps that are already installed can run. The window opens on Windows through WSLg.
  // setsid detaches the app inside Linux, so it keeps running after wsl.exe (and NightOS) exit.
  // Its errors go to a log, which is shown if the app isn't running a few seconds later.
  const LOG = '"$HOME/.cache/nightos-flatpak-$1.log"';
  async function run(id) {
    if (!validId(id) || !(await list()).some(a => a.id === id)) throw new Error('That app isn’t installed');
    await wsl(['-e', 'sh', '-c', `mkdir -p "$HOME/.cache"; setsid -f flatpak run "$1" >/dev/null 2>${LOG} </dev/null`, 'sh', id], { timeout: 30000 });
    setTimeout(async () => {
      try {
        const out = await wsl(['-e', 'sh', '-c', `flatpak ps --columns=application; echo ---; tail -n 5 ${LOG}`, 'sh', id]);
        const [ps, log] = out.split('---');
        if (!ps.split('\n').map(s => s.trim()).includes(id)) send({ id, op: 'run', status: 'error', line: lastLine(log) || 'It closed right away' });
      } catch (e) { }
    }, 8000);
    return true;
  }

  // Flathub's catalog. The page can't call it directly (no CORS), so it goes through here.
  const cache = new Map();
  async function api(p, body) {
    const key = p + (body ? JSON.stringify(body) : ''), hit = cache.get(key);
    if (hit && Date.now() - hit.t < 10 * 60e3) return hit.v;
    const r = await net.fetch(API + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (!r.ok) throw new Error('Flathub said ' + r.status);
    const v = await r.json(); cache.set(key, { t: Date.now(), v }); return v;
  }
  const slim = h => ({ id: h.app_id, name: h.name, summary: h.summary || '', icon: h.icon || '', category: h.main_categories || '', developer: h.developer_name || '', installs: h.installs_last_month || 0, verified: h.verification_verified === true || h.verification_verified === 'true' });
  async function catalog(kind, q) {
    if (kind === 'search') {
      q = String(q || '').slice(0, 100);
      return ((await api('search', { query: q })).hits || []).filter(h => validId(h.app_id) && h.type !== 'console-application').map(slim);
    }
    if (!['popular', 'trending', 'recently-updated', 'recently-added'].includes(kind)) throw new Error('Unknown list');
    return ((await api(`collection/${kind}?page=1&per_page=60`)).hits || []).filter(h => validId(h.app_id)).map(slim);
  }
  async function details(id) {
    if (!validId(id)) throw new Error('Not a Flatpak app id');
    const [a, sum] = await Promise.all([api('appstream/' + id), api('summary/' + id).catch(() => ({}))]);
    const shots = (a.screenshots || []).map(x => (Array.isArray(x.sizes) ? x.sizes : []).filter(z => /^https:\/\//.test(z.src || '')).sort((p, q) => Math.abs(p.width - 752) - Math.abs(q.width - 752))[0]).filter(Boolean).map(z => z.src).slice(0, 6);
    return { id, name: a.name, summary: a.summary || '', description: a.description || '', icon: a.icon || '', developer: a.developer_name || '', license: a.project_license || '', version: ((a.releases || [])[0] || {}).version || '', homepage: (a.urls || {}).homepage || '', screenshots: shots, download: sum.download_size || 0, size: sum.installed_size || 0 };
  }

  return { status, setup, list, install, uninstall, run, catalog, details, current: () => running };
};
