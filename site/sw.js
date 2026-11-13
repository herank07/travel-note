// App shell cache. Bump CACHE_VERSION on every release so phones pick up new files.
const CACHE_VERSION = 'v1';
const CACHE = `travel-note-${CACHE_VERSION}`;
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';

const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/config.js', 'js/firebase.js', 'js/db.js', 'js/router.js', 'js/time.js', 'js/schedule.js',
  'js/maps.js', 'js/codes.js',
  'js/ui/dom.js', 'js/ui/welcome.js', 'js/ui/tripShell.js', 'js/ui/trips.js', 'js/ui/tripForm.js',
  'js/ui/today.js', 'js/ui/nextItem.js', 'js/ui/itemForm.js', 'js/ui/journal.js', 'js/ui/checklist.js',
  'js/ui/members.js', 'js/ui/link.js',
  `${SDK}firebase-app.js`, `${SDK}firebase-auth.js`, `${SDK}firebase-firestore.js`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('travel-note-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function cacheable(url) {
  return url.origin === self.location.origin
    || url.href.startsWith(SDK)
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!cacheable(url)) return;
  if (request.mode === 'navigate') {
    // Pages: network first so updates arrive, cached shell when offline.
    event.respondWith(fetch(request).catch(() => caches.match('index.html')));
    return;
  }
  // Stale-while-revalidate: answer from the cache at once, refresh the cache in the background,
  // so the next launch gets the newest files even if CACHE_VERSION was not bumped.
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => {
    const network = fetch(request).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    });
    if (hit) { event.waitUntil(network.catch(() => {})); return hit; }
    return network;
  }));
});
