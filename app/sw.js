// Service worker: keeps the app shell available offline and shows notifications.
// Network-first, so every update you publish reaches clients on their next open.
const CACHE = 'pt-system-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/calc.js', 'js/config.js', 'js/state.js', 'js/data.js', 'js/ui.js', 'js/views.js', 'js/coach.js', 'js/foods.js', 'js/chartmath.js', 'js/theme.js', 'js/theme-boot.js', 'js/store/demo.js', 'js/store/firebase.js', 'icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
// Push notifications sent while the app is closed (by the notifier job, via Firebase Cloud Messaging).
// Every push must show a notification (iPhone stops delivering pushes to apps that don't).
self.addEventListener('push', (e) => {
  let j = {};
  try { j = e.data ? e.data.json() : {}; } catch (err) { j = { data: { body: e.data && e.data.text() } }; }
  const d = j.data || {}, n = j.notification || {};
  const title = String(n.title || d.title || 'Gatebreaker').slice(0, 80);
  const opts = { body: String(n.body || d.body || '').slice(0, 300), tag: String(d.tag || 'gb'), renotify: true, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { url: String(d.url || './') } };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const raw = (e.notification.data && e.notification.data.url) || './';
  const hash = /^#[a-z0-9/_-]*$/i.test(raw) ? raw : ''; // only in-app links
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if ('focus' in w) { if (hash && 'navigate' in w) w.navigate('./' + hash).catch(() => {}); return w.focus(); }
    return self.clients.openWindow('./' + hash);
  }));
});
