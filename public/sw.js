// Minimal stale-while-revalidate cache for static assets. Not a full
// offline solution — just makes repeat visits feel instant.
// Bumped so `activate` purges the old cache outright — belt and suspenders alongside the
// navigate-network-first fix above, since some clients may have a stale index.html cached
// under the old name from before that fix existed.
const CACHE_NAME = 'arcade-static-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  // The HTML shell decides which hashed JS/CSS bundle loads, so it can never be served
  // cache-first — a returning visitor could get stuck on an arbitrarily old deploy
  // indefinitely (this is exactly what happened the night this comment was added: players
  // silently kept running pre-fix code with no error, because their cached index.html kept
  // pointing at the old bundle). Always prefer the network here; fall back to cache only
  // when actually offline.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(req))),
    );
    return;
  }

  // Hashed /assets/* files are safe to serve cache-first — a new deploy always ships new
  // filenames, so a cache hit here is never stale by definition. Still revalidates in the
  // background so the next cache-miss (a genuinely new asset) is fast too.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
