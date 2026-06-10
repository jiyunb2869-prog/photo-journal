// Photo Journal service worker — offline app shell.
// Strategy: same-origin = network-first (always fresh online, cache offline);
// cross-origin (fonts) = cache-first. Bump CACHE when the shell changes.
const CACHE = 'pj-cache-v2';
const V = '2'; // module version query — keep in sync with index.html / imports
const CORE = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/apple-touch-icon.png',
  `./js/app.js?v=${V}`, `./js/util.js?v=${V}`, `./js/store.js?v=${V}`, `./js/imaging.js?v=${V}`,
  `./js/assets.js?v=${V}`, `./js/reminders.js?v=${V}`, `./js/pwa.js?v=${V}`,
  `./js/config.js?v=${V}`, `./js/supabase.js?v=${V}`, `./js/cloud.js?v=${V}`,
  `./js/views/calendar.js?v=${V}`, `./js/views/editor.js?v=${V}`, `./js/views/daycard.js?v=${V}`,
  `./js/views/recap.js?v=${V}`, `./js/views/year.js?v=${V}`, `./js/views/search.js?v=${V}`,
  `./js/views/settings.js?v=${V}`, `./js/views/videoplayer.js?v=${V}`, `./js/views/auth.js?v=${V}`,
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // add individually so one failure doesn't abort the whole precache
    await Promise.allSettled(CORE.map((u) => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    // fonts & other cross-origin: cache-first
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch { return cached || Response.error(); }
    })());
    return;
  }

  // same-origin: network-first, fall back to cache (or app shell for navigations)
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
      return res;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
      return Response.error();
    }
  })());
});
