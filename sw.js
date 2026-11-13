/* Motoshop POS service worker: makes the installed app open instantly and keeps the app files available offline.
   It NEVER caches database traffic (supabase.co): sales and stock always go to the live database. */
const CACHE = 'motoshop-v15';
const SHELL = ['./', 'index.html', 'style.css?v=15', 'app.js?v=15', 'manifest.webmanifest', 'icon-192.png', 'terms.html', 'privacy.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || !/^https?:$/.test(url.protocol) || url.hostname.endsWith('supabase.co')) return;
  // pages: try the network first so updates arrive quickly; fall back to the saved copy when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html') || caches.match('./'))));
    return;
  }
  // everything else (scripts, styles, fonts, icons): show the saved copy at once, refresh it in the background
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});