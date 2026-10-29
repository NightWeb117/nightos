'use strict';
// Renders the NightOS app icon to build/icon.png. Run with: npx electron build/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f3b35"/><stop offset="1" stop-color="#04110f"/></linearGradient>
  <radialGradient id="glow" cx=".62" cy=".38" r=".55"><stop offset="0" stop-color="#1fc3a7" stop-opacity=".55"/><stop offset="1" stop-color="#1fc3a7" stop-opacity="0"/></radialGradient></defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)"/><rect x="16" y="16" width="480" height="480" rx="112" fill="url(#glow)"/>
  <rect x="17.5" y="17.5" width="477" height="477" rx="110" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="3"/>
  <g transform="translate(88 88) scale(5.2)"><path d="M40 8A24 24 0 1 0 56 49.7A26 26 0 0 1 40 8z" fill="#eafff9"/><path d="M50 13l1.5 3.4 3.7.4-2.8 2.5.8 3.6-3.2-1.9-3.2 1.9.8-3.6-2.8-2.5 3.7-.4z" fill="#1fc3a7"/></g>
</svg>`;
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,' + encodeURIComponent(`<html><body style="margin:0;background:transparent">${SVG}</body></html>`));
  await new Promise(r => setTimeout(r, 400));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.writeFileSync(path.join(__dirname, 'icon.png'), img.resize({ width: 512, height: 512 }).toPNG());
  app.quit();
});
