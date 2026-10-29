'use strict';
// NightOS offline support. Pages, scripts and catalogs come from the network when it's there
// (so updates show up straight away) and from this cache when it isn't.
const CACHE = 'nightos-v1';
const CDN = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)$/;
const keyOf = u => { const x = new URL(u); x.search = ''; x.hash = ''; return x.href; };
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE), base = self.registration.scope;
  const html = await (await fetch(base + 'index.html', { cache: 'reload' })).text();
  // Everything index.html loads, found from its own script and link tags.
  const files = new Set(['', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'store/catalog.json', 'store/themes.json']);
  for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) if (!/^https?:/.test(m[1])) files.add(m[1]);
  await Promise.all([...files].map(f => fetch(base + f, { cache: 'reload' }).then(r => r.ok && c.put(keyOf(base + f), r)).catch(() => { })));
  self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (u.pathname.includes('/images/')) return; // the Linux disc image is too big to keep offline
    e.respondWith(fetch(r).then(res => { if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(keyOf(r.url), cp)); } return res; })
      .catch(async () => (await caches.match(keyOf(r.url))) || (r.mode === 'navigate' ? caches.match(keyOf(self.registration.scope + 'index.html')) : Response.error())));
  } else if (CDN.test(u.hostname)) {
    e.respondWith(caches.match(r.url).then(hit => {
      const net = fetch(r).then(res => { if (res.ok || res.type === "opaque") { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r.url, cp)); } return res; }).catch(() => hit || Response.error());
      return hit || net;
    }));
  }
});
