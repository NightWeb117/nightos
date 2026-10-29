'use strict';
// `npm run selftest`: starts NightOS, drives it through the desktop features, saves screenshots
// and a report to desktop/selftest/, then quits. Used to check a build without clicking around.
const fs = require('fs'), path = require('path');
module.exports = (win, app) => {
  // Packaged builds can't write inside their own app.asar, so the report goes next to the .exe.
  const outDir = app.isPackaged ? path.join(path.dirname(process.execPath), 'selftest') : path.join(__dirname, 'selftest');
  fs.mkdirSync(outDir, { recursive: true });
  const report = { errors: [], steps: {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const js = s => win.webContents.executeJavaScript(s, true);
  const shot = async name => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(outDir, name + '.png'), img.toPNG()); };
  win.webContents.on('console-message', (e, level, message) => {
    const lv = typeof e.level === 'string' ? e.level : level, msg = e.message || message;
    if (lv === 'error' || lv === 3) report.errors.push(String(msg).slice(0, 300));
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      await wait(2500);
      report.steps.native = await js('typeof window.nightosNative');
      report.steps.info = await js('nightosNative.info()');
      report.steps.steam = await js('nightosNative.steamGames().then(r => ({ steam: r.steam, count: r.games.length, games: r.games.slice(0, 8).map(g => g.name + (g.cover ? " [cover]" : g.header ? " [header]" : "")) }))');
      report.steps.login = await js(`(async () => {
        document.querySelector('#boot').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 1300));
        document.querySelector('#lock').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 400));
        document.querySelector('.lk-auth').requestSubmit(); await new Promise(r => setTimeout(r, 2600));
        WM.wins.forEach(w => closeWin(w, true)); document.querySelector('#toasts').innerHTML = ''; return SYSTEM.state; })()`);
      await wait(600); await shot('1-desktop');
      report.steps.games = await js(`(async () => { launch('games'); await new Promise(r => setTimeout(r, 2500)); document.querySelector('#toasts').innerHTML = ''; return document.querySelectorAll('.gl-card').length; })()`);
      await shot('2-game-library');
      report.steps.browser = await js(`(async () => { WM.wins.forEach(w => closeWin(w, true)); const w = launch('browser', 'https://example.com'); await new Promise(r => setTimeout(r, 6000)); const v = w.body.querySelector('.bw-webs webview'); return v ? v.getURL() : 'no webview'; })()`);
      await shot('3-nightfox-real-site');
      report.steps.discord = await js(`(async () => { WM.wins.forEach(w => closeWin(w, true)); const w = WebAppWindow({ id: 'discord', name: 'Discord', url: 'https://discord.com/app' }); await new Promise(r => setTimeout(r, 9000)); return w.body.querySelector('webview').getTitle(); })()`);
      await shot('4-discord-web');
      report.steps.winDesktop = await js(`(async () => { WM.wins.forEach(w => closeWin(w, true)); const list = await nightosNative.desktopPrograms(); await new Promise(r => setTimeout(r, 300)); return { count: list.length, names: list.slice(0, 10).map(p => p.name + ' (' + p.kind + (p.icon ? ', icon' : '') + ')'), onNightOSDesktop: document.querySelectorAll('#desk [data-path^="winexe:"]').length }; })()`);
      await shot('6-desktop-with-windows-shortcuts');
      report.steps.winApp = await js(`(async () => { launch('winapps'); await new Promise(r => setTimeout(r, 1200)); return document.querySelectorAll('.wp-card').length; })()`);
      await shot('7-windows-programs');
      report.steps.winGuard = await js(`(async () => { const out = []; for (const p of ['C:\\\\Windows\\\\win.ini', 'relative.exe', 'C:\\\\nope\\\\missing.exe']) { try { await nightosNative.runProgram(p); out.push(p + ': RAN'); } catch (e) { out.push(p + ': refused'); } } return out; })()`);
      report.steps.settings = await js(`(async () => { WM.wins.forEach(w => closeWin(w, true)); launch('settings', 'desktopapp'); await new Promise(r => setTimeout(r, 1200)); return document.querySelector('.st-page').innerText.slice(0, 200); })()`);
      await shot('5-settings-desktop-app');
      // Windows folders (the test profile allows Documents ahead of time), the guard, and Files.
      report.steps.folders = await js(`(async () => {
        const roots = await nightosNative.winRoots(), doc = roots.find(r => r.name === 'Documents'), out = { roots: roots.map(r => r.name + (r.granted ? ' (allowed)' : '')) };
        const probe = doc.path + '\\\\NightOS selftest.txt';
        out.write = await nightosNative.winWriteText(probe, 'written by the NightOS selftest').then(() => 'ok', e => 'refused');
        out.read = await nightosNative.winReadText(probe).catch(e => 'refused');
        out.list = (await nightosNative.winList(doc.path)).length;
        const bad = [['C:\\\\Windows\\\\win.ini', 'read'], [doc.path + '\\\\evil.exe', 'write'], [(roots.find(r => r.name === 'Music') || {}).path + '\\\\x.txt', 'write']];
        out.guard = []; for (const [p, k] of bad) { try { k === 'read' ? await nightosNative.winReadText(p) : await nightosNative.winWriteText(p, 'x'); out.guard.push(p + ': ALLOWED'); } catch (e) { out.guard.push(p.split('\\\\').pop() + ': refused'); } }
        WM.wins.forEach(w => closeWin(w, true)); const fw = launch('files', HOME + '/Windows'); await new Promise(r => setTimeout(r, 500)); fw.go(HOME + '/Windows/Documents'); await new Promise(r => setTimeout(r, 2500));
        out.filesShows = fw.body.querySelectorAll('.fi').length; out.probeFile = (getNode(HOME + '/Windows/Documents/NightOS selftest.txt') || {}).content || null;
        return out; })()`);
      await shot('9-windows-folders');
      try { fs.unlinkSync(path.join(app.getPath('documents'), 'NightOS selftest.txt')); } catch (e) { }
      report.steps.taskbar = await js(`(async () => { WM.wins.forEach(w => closeWin(w, true)); const r = await nightosNative.winWindows(); await new Promise(r => setTimeout(r, 2500)); return { count: r.windows.length, sample: r.windows.slice(0, 6).map(w => w.title.slice(0, 40) + (w.icon ? ' [icon]' : '')), inPanel: document.querySelectorAll('#panel [data-hwnd]').length }; })()`);
      await shot('10-taskbar-windows');
      report.steps.recorder = await js(`(async () => { await nightosNative.setCaptureTarget('nightos'); const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); const mr = new MediaRecorder(s), parts = []; mr.ondataavailable = e => parts.push(e.data); mr.start(); await new Promise(r => setTimeout(r, 1500)); mr.stop(); await new Promise(r => mr.onstop = r); s.getTracks().forEach(t => t.stop()); return { bytes: parts.reduce((a, b) => a + b.size, 0), label: s.getVideoTracks()[0] ? 'video track ok' : 'no video' }; })()`);
      // Flatpak: WSL status, live Flathub search and details, installed apps, and the App Center tab.
      report.steps.flatpak = await js(`(async () => { WM.wins.forEach(w => closeWin(w, true)); const out = { status: await nightosNative.flatpakStatus() };
        out.search = (await nightosNative.flatpakCatalog('search', 'gimp')).slice(0, 3).map(a => a.id);
        const d = await nightosNative.flatpakDetails('org.gimp.GIMP'); out.details = { name: d.name, version: d.version, download: d.download, shots: d.screenshots.length };
        out.installed = (await nightosNative.flatpakList()).map(a => a.id);
        out.guard = []; for (const id of ['../../etc', 'rm -rf', 'org.gimp.GIMP;ls']) { try { await nightosNative.flatpakRun(id); out.guard.push(id + ': RAN'); } catch (e) { out.guard.push(id + ': refused'); } }
        const w = launch('store', 'flatpak'); await new Promise(r => setTimeout(r, 2500)); out.tab = { cards: w.body.querySelectorAll('.ap-card').length, banner: (w.body.querySelector('.fp-banner') || {}).innerText || '' };
        const tip = async id => { w._fp.detail = id; w.go('flatpak'); for (let i = 0; i < 20 && !w.body.querySelector('.ap-detail'); i++) await new Promise(r => setTimeout(r, 500)); return (w.body.querySelector('.ap-page > .fp-banner') || {}).innerText || ''; };
        out.soberTip = await tip('org.vinegarhq.Sober'); out.gameTip = await tip('org.supertuxproject.SuperTux'); out.toolTip = await tip('org.gnome.Calculator'); out.roblox = !!APPS.robloxapp;
        await tip('org.vinegarhq.Sober');
        return out; })()`);
      await shot('11-flatpak');
      // NIGHTOS_TEST_FLATPAK=<installed app id> also opens that app and looks for its window in the taskbar.
      if (process.env.NIGHTOS_TEST_FLATPAK) {
        report.steps.flatpakRun = await js(`(async () => { const id = ${JSON.stringify(process.env.NIGHTOS_TEST_FLATPAK)}; await fpRefresh(); const inActivities = !!APPS['fp:' + id];
          WM.wins.forEach(w => closeWin(w, true)); launch('fp:' + id); await new Promise(r => setTimeout(r, 12000)); await WINTASKS.refresh(); await new Promise(r => setTimeout(r, 2500));
          return { inActivities, windows: (await nightosNative.winWindows()).windows.map(w => w.title).filter(t => /ubuntu|wsl/i.test(t)), inPanel: [...document.querySelectorAll('[data-hwnd]')].map(b => b.title || b.innerText).filter(t => /ubuntu/i.test(t)) }; })()`);
        await shot('12-flatpak-running');
      }
      // With NIGHTOS_UPDATE_FEED set, check that feed and wait for the download to finish (never installs).
      report.steps.update = await js(`(async () => { const seen = []; nightosNative.onUpdate(s => { if (seen[seen.length - 1] !== s.status) seen.push(s.status); }); await nightosNative.checkForUpdates(); let s; for (let i = 0; i < 90; i++) { await new Promise(r => setTimeout(r, 1000)); s = await nightosNative.updateState(); if (['ready', 'none', 'error', 'available'].includes(s.status)) break; } return { seen, final: s }; })()`);
      await shot('8-update-status');
    } catch (e) { report.fatal = String(e && e.stack || e); }
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    app.quit();
  });
};
