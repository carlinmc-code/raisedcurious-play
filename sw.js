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

importScripts('/offline-manifest.js?v=37e5595f5180');

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

/* Carry the download across a deploy.
   The cache is named after a hash of the whole site, so a deploy makes a new
   one - and simply deleting the old one threw away the plane-mode download
   every single time anything shipped. Somebody who saved all forty-one games
   on Tuesday and boarded on Thursday would have had the shell and nothing
   else, silently. Almost nothing changes between deploys, so the old entries
   the new build still wants are copied over first, and whatever is genuinely
   new is topped up in the background while there is still a network. */
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const fresh = await caches.open(CACHE);
    const want = new Set(URLS.map(u => new URL(u, self.location.origin).href));
    const stale = (await caches.keys()).filter(k => k !== CACHE && k.indexOf('rc-play-') === 0);

    let carried = 0;
    for (const name of stale){
      const old = await caches.open(name);
      for (const req of await old.keys()){
        if (!want.has(req.url)) continue;
        if (await fresh.match(req)) continue;
        const res = await old.match(req);
        if (res){ await fresh.put(req, res); carried++; }
      }
    }
    for (const name of stale) await caches.delete(name);
    await self.clients.claim();

    /* If they had clearly downloaded the site before, finish the job rather
       than leaving them a bundle with holes in it and no way to know. */
    if (carried > URLS.length * 0.6){
      const have = new Set((await fresh.keys()).map(r => r.url));
      const missing = URLS.filter(u => !have.has(new URL(u, self.location.origin).href));
      for (const u of missing){
        try {
          const res = await fetch(new Request(u, { cache: 'reload' }));
          if (res && res.ok) await fresh.put(u, res.clone());
        } catch (err){ /* offline right now: the button will finish it later */ }
      }
    }
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
