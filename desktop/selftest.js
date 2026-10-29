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
    } catch (e) { report.fatal = String(e && e.stack || e); }
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    app.quit();
  });
};
