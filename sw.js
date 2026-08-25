/* RaisedCurious Play - offline.
   The whole site is under half a megabyte, so "save it for the flight" can
   mean literally all of it. There are two halves to this:

   1. Anything visited while online is kept, so a game played once keeps
      working later with no network and nobody has to have planned ahead.
   2. The hub has a button that fetches the entire manifest up front, which is
      the one that matters at the departure gate.

   Freshness is the thing to be careful about here, because a service worker
   that hoards can serve a stale site forever. So: pages are network-first and
   fall back to the cache, meaning an online visitor always gets today's HTML;
   assets are versioned in their URLs already; and the cache is named after a
   hash of the whole site, so a deploy quietly abandons the previous one. */

importScripts('/offline-manifest.js?v=ad26f406370d');

const VERSION = self.OFFLINE.version;
const CACHE = 'rc-play-' + VERSION;
const URLS = self.OFFLINE.urls;

/* enough to open the site and start a game, cached without being asked */
const CORE = ['/'].concat(URLS.filter(u => /^\/(assets|shared)\//.test(u)));

const isFont = u => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u);
const sameOrigin = u => u.startsWith(self.location.origin + '/');

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(req){
  try {
    const net = await fetch(req);
    if (net && net.ok){
      const c = await caches.open(CACHE);
      c.put(req, net.clone());
    }
    return net;
  } catch (err){
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const hub = await caches.match('/');
    if (hub) return hub;
    throw err;
  }
}
async function cacheFirst(req){
  const hit = await caches.match(req);
  if (hit){
    fetch(req).then(net => {                      // quietly freshen for next time
      if (net && (net.ok || net.type === 'opaque')) caches.open(CACHE).then(c => c.put(req, net));
    }).catch(() => {});
    return hit;
  }
  const net = await fetch(req);
  if (net && (net.ok || net.type === 'opaque')){
    const c = await caches.open(CACHE);
    c.put(req, net.clone());
  }
  return net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // the two-device rooms are live by definition; never cache or fake them
  if (url.indexOf('table.raisedcurious.com') !== -1) return;

  if (isFont(url)){ e.respondWith(cacheFirst(req)); return; }
  if (!sameOrigin(url)) return;

  if (req.mode === 'navigate'){ e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});

/* ---------- the download-it-all button ---------- */
async function cachedCount(){
  const c = await caches.open(CACHE);
  const keys = await c.keys();
  const have = new Set(keys.map(r => new URL(r.url).pathname + new URL(r.url).search));
  return URLS.filter(u => have.has(u)).length;
}
async function downloadAll(client){
  const c = await caches.open(CACHE);
  let done = 0;
  const queue = URLS.slice();
  const say = t => { if (client) client.postMessage(t); };

  async function worker(){
    while (queue.length){
      const u = queue.shift();
      try {
        const res = await fetch(new Request(u, { cache: 'reload' }));
        if (res && res.ok) await c.put(u, res.clone());
      } catch (err){ /* one missing file must not abandon the flight */ }
      done++;
      if (done % 4 === 0 || done === URLS.length)
        say({ type: 'progress', done, total: URLS.length });
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  say({ type: 'ready', total: URLS.length, bytes: self.OFFLINE.bytes, version: VERSION });
}

self.addEventListener('message', e => {
  const msg = e.data || {};
  const client = e.source;
  if (msg.type === 'download') e.waitUntil(downloadAll(client));
  else if (msg.type === 'status'){
    e.waitUntil((async () => {
      const have = await cachedCount();
      client && client.postMessage({
        type: 'status', have, total: URLS.length,
        ready: have >= URLS.length - 2, bytes: self.OFFLINE.bytes, version: VERSION
      });
    })());
  }
});
