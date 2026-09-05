/* Service worker for the installable build.

   NETWORK FIRST, deliberately. The obvious choice for a game with ~18MB of
   assets is cache-first, and it would load faster — but it also means someone
   who opened the link once gets the old build forever until the cache is
   cleared. This link is out with a studio, so a stale copy is a much worse
   failure than a slower second load.

   So: always try the network, keep a copy as we go, and fall back to that copy
   only when the network is actually unavailable. Result — the live version is
   always what you see, and the game still runs on a plane. */

const CACHE = 'meadowlark-v2';

self.addEventListener('install', e => {
  self.skipWaiting();                       // a new build takes over immediately
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch anything cross-origin

  e.respondWith((async () => {
    try {
      /* The page itself, the worker and the manifest are always revalidated with the
         server: GitHub Pages marks them cacheable for ten minutes, and fetching through
         that cache meant a refresh could show a build that was already replaced. Assets
         keep the default, since they are large and change by name. */
      const path = url.pathname;
      const revalidate = /\.(html|webmanifest)$/.test(path) || path.endsWith('/') || path.endsWith('sw.js');
      const fresh = await fetch(revalidate ? new Request(req, { cache: 'no-cache' }) : req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const copy = fresh.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
