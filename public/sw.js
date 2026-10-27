// Lets the site open like an app. Pages always come fresh from the network when there is one, so
// a new version shows up straight away; the saved copy is only used offline. The build's files
// have their version in their names, so once saved they never need fetching again.
const CACHE = 'party-games-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const save = (request, response) => {
  if (response.ok) caches.open(CACHE).then(c => c.put(request, response.clone()));
  return response;
};

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return; // Firebase and the rest go straight through

  // Pages: network first, then the saved home page when offline.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).then(r => save('/', r)).catch(() => caches.match('/')));
    return;
  }
  // Versioned build files and fonts: saved copy first.
  if (url.pathname.startsWith('/assets/') || fonts) {
    e.respondWith(caches.match(request).then(hit => hit || fetch(request).then(r => save(request, r))));
    return;
  }
  // Everything else (icons and so on): the network, falling back to a saved copy.
  e.respondWith(fetch(request).then(r => save(request, r)).catch(() => caches.match(request)));
});
