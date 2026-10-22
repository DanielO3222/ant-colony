const VERSION = 'ah-v1.4.0';
const MUSIC_CACHE = 'ah-music-1';   // kept across versions so the song isn't re-downloaded on every update
const FILES = ['./', 'index.html', 'style.css', 'audio.js', 'sim.js', 'yard.js', 'yardui.js', 'draw.js', 'ui.js', 'manifest.webmanifest', 'icons/icon-152.png', 'icons/icon-167.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== MUSIC_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// background music: fetched once at runtime (not at install), then served from cache with Range support for Safari
const musicFetch = {};   // one background download per track
function cacheMusic(url) {
  if (!musicFetch[url]) musicFetch[url] = fetch(url, { cache: 'no-cache' }).then(r => r.status === 200 ? caches.open(MUSIC_CACHE).then(c => c.put(url, r)) : null).catch(() => {}).then(() => { delete musicFetch[url]; });
  return musicFetch[url];
}
async function musicResponse(e, url) {
  const hit = await caches.open(MUSIC_CACHE).then(c => c.match(url));
  if (!hit) { e.waitUntil(cacheMusic(url)); return fetch(e.request); }
  const range = e.request.headers.get('range'); if (!range) return hit;
  const blob = await hit.blob(), size = blob.size, m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let s = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1; if (!m[1] && m[2]) { s = Math.max(0, size - +m[2]); end = size - 1; }
  if (s >= size) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(blob.slice(s, end + 1), { status: 206, headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': `bytes ${s}-${end}/${size}`, 'Content-Length': String(end - s + 1), 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url); if (req.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/assets\/music\d*\.mp3$/.test(u.pathname)) { const url = u.origin + u.pathname; e.respondWith(musicResponse(e, url).catch(() => new Response('', { status: 504 }))); return; }
  // network first so updates show up; fall back to the cache when offline
  e.respondWith(fetch(req).then(res => { if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {}); } return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
