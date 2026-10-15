// Arca Estelar: guarda el juego en el teléfono para que abra rápido y funcione sin internet
// (jugando solo). Lo de la página se busca primero en internet (así llegan las versiones nuevas)
// y, si no hay conexión, se usa lo guardado.
const CACHE = 'arca-estelar-v1';

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!same && !fonts) return;   // lo de afuera (la conexión en línea) pasa directo
  ev.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok && (same || res.type === 'cors' || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
