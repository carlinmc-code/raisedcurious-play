/* The service worker, against a fake Cache API and a fake network.
   In the repo rather than a scratch directory, because the last copy of this
   was wiped between sessions and nothing was checking the offline behaviour
   at all until it was rewritten.

   Run: node tests/offline.mjs */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const ORIGIN = 'https://play.raisedcurious.com';
let f = 0, n = 0;
const ck = (s, c, x) => { n++; if (!c){ console.log('  FAIL ' + s + (x ? '   ' + x : '')); f++; }
                          else console.log('  ok   ' + s); };

function makeSW({ offline = false, seed = {} } = {}){
  const caches_ = {};
  for (const k in seed) caches_[k] = new Map(Object.entries(seed[k]));
  const res = (body, ok = true) => ({ ok, type: 'basic', body, clone(){ return res(body, ok); } });
  /* The real Cache API keys on the absolute request URL. */
  const key = r => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href;
  const store = {
    open: async name => {
      caches_[name] = caches_[name] || new Map();
      const m = caches_[name];
      return {
        add: async r => { if (offline) throw new Error('offline'); m.set(key(r), res('body:' + key(r))); },
        put: async (r, v) => { m.set(key(r), v); },
        keys: async () => [...m.keys()].map(u => ({ url: u })),
        match: async r => m.get(key(r))
      };
    },
    keys: async () => Object.keys(caches_),
    delete: async name => { delete caches_[name]; return true; },
    match: async (r, opt) => {
      const u = key(r);
      for (const nm in caches_){
        if (caches_[nm].has(u)) return caches_[nm].get(u);
        if (opt && opt.ignoreSearch){
          const bare = u.split('?')[0];
          for (const k2 of caches_[nm].keys()) if (k2.split('?')[0] === bare) return caches_[nm].get(k2);
        }
      }
    }
  };
  const listeners = {}, posted = [];
  const sandbox = {
    console, Math, JSON, Promise, Set, Map, URL, Error, Object, Array, String, Number,
    caches: store,
    fetch: async r => { if (offline) throw new Error('no network'); return res('fresh:' + key(r)); },
    Request: function(u, o){ return { url: key(u), mode: (o && o.mode) || 'no-cors' }; },
    importScripts: () => vm.runInContext(readFileSync(ROOT + '/offline-manifest.js', 'utf8'), sandbox)
  };
  sandbox.self = sandbox;
  sandbox.location = { origin: ORIGIN };
  sandbox.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
  sandbox.skipWaiting = async () => {};
  sandbox.clients = { claim: async () => {} };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(ROOT + '/sw.js', 'utf8'), sandbox, { filename: 'sw.js' });
  const fire = async (type, ev) => {
    const waits = [];
    const e = Object.assign({ waitUntil: p => waits.push(p), respondWith: p => { e._res = p; } }, ev);
    for (const fn of (listeners[type] || [])) fn(e);
    await Promise.all(waits);
    if (e._res) e._resolved = await e._res;
    return e;
  };
  return { sandbox, caches_, fire, posted, store };
}
const URLS = () => { const s = makeSW(); return s.sandbox.OFFLINE.urls; };
const VER = () => { const s = makeSW(); return s.sandbox.OFFLINE.version; };

/* ---- install and the version-named cache ---- */
{
  const sw = makeSW({ seed: { 'rc-play-OLD': { '/x': 'stale' } } });
  await sw.fire('install', {});
  ck('install creates a cache named for the site version', !!sw.caches_['rc-play-' + VER()]);
  const core = sw.caches_['rc-play-' + VER()];
  ck('the core alone is enough to open a game offline',
     [...core.keys()].some(k => k.includes('toy.js')) &&
     [...core.keys()].some(k => k.includes('kit.js')) &&
     [...core.keys()].some(k => k.includes('matter.min.js')) &&
     core.has(ORIGIN + '/'), core.size + ' files');
  await sw.fire('activate', {});
  ck('activate clears caches from other versions', !sw.caches_['rc-play-OLD']);
}
/* ---- online, a page is never served stale ---- */
{
  const sw = makeSW();
  await sw.fire('install', {}); await sw.fire('activate', {});
  sw.caches_['rc-play-' + VER()].set(ORIGIN + '/farm/',
    { ok: true, body: 'yesterday', clone(){ return this; } });
  const e = await sw.fire('fetch', { request: { url: ORIGIN + '/farm/', method: 'GET', mode: 'navigate' } });
  ck('online, a page is fetched fresh rather than served from cache',
     String(e._resolved.body).startsWith('fresh:'), String(e._resolved.body));
}
/* ---- the whole site offline ---- */
{
  const sw = makeSW();
  await sw.fire('install', {}); await sw.fire('activate', {});
  const client = { postMessage: m => sw.posted.push(m) };
  await sw.fire('message', { data: { type: 'download' }, source: client });
  ck('the download saves every URL', sw.caches_['rc-play-' + VER()].size >= URLS().length);
  ck('it reports progress', sw.posted.some(m => m.type === 'progress'));
  ck('and says when it is done', sw.posted.some(m => m.type === 'ready'));

  sw.sandbox.fetch = async () => { throw new Error('plane'); };
  const g = await sw.fire('fetch', { request: { url: ORIGIN + '/frogworld/', method: 'GET', mode: 'navigate' } });
  ck('offline, a game page still comes back', !!g._resolved);
  const toy = URLS().find(u => u.includes('/assets/toy.js'));
  const a = await sw.fire('fetch', { request: { url: ORIGIN + toy, method: 'GET', mode: 'no-cors' } });
  ck('offline, the shared runtime still comes back', !!a._resolved, toy);
  const mt = URLS().find(u => u.includes('matter.min.js'));
  const m = await sw.fire('fetch', { request: { url: ORIGIN + mt, method: 'GET', mode: 'no-cors' } });
  ck('offline, the physics library still comes back', !!m._resolved, mt);
  const u = await sw.fire('fetch', { request: { url: ORIGIN + '/nowhere/', method: 'GET', mode: 'navigate' } });
  ck('offline, an unknown page falls back to the hub', !!u._resolved);
}
/* ---- THE ONE THIS FILE EXISTS FOR: a deploy must not wipe the download ---- */
{
  /* Pretend a previous version had the whole site saved. */
  const urls = URLS();
  const previous = {};
  for (const u of urls) previous[new URL(u, ORIGIN).href] = { ok: true, body: 'saved:' + u, clone(){ return this; } };
  const sw = makeSW({ seed: { 'rc-play-PREVIOUS': previous } });
  await sw.fire('install', {});
  await sw.fire('activate', {});
  const now = sw.caches_['rc-play-' + VER()];
  ck('a deploy keeps the download instead of discarding it',
     now.size >= urls.length, now.size + ' of ' + urls.length + ' kept');
  ck('and the old cache is still cleaned up', !sw.caches_['rc-play-PREVIOUS']);
  const carried = [...now.values()].filter(v => String(v.body).startsWith('saved:')).length;
  ck('most entries are carried rather than refetched', carried > urls.length * 0.5,
     carried + ' carried over');

  /* And with the network gone, the carried-over bundle still serves. */
  sw.sandbox.fetch = async () => { throw new Error('plane'); };
  const g = await sw.fire('fetch', { request: { url: ORIGIN + '/marblerun/', method: 'GET', mode: 'navigate' } });
  ck('so the games still work on a plane after a deploy', !!g._resolved);
}
/* ---- a device that never downloaded is not force-fed the whole site ---- */
{
  const sw = makeSW({ seed: { 'rc-play-PREVIOUS': { [ORIGIN + '/']: { ok:true, body:'x', clone(){return this;} } } } });
  await sw.fire('install', {}); await sw.fire('activate', {});
  const now = sw.caches_['rc-play-' + VER()];
  ck('a casual visitor is not made to download everything',
     now.size < URLS().length, now.size + ' of ' + URLS().length);
}
/* ---- the live rooms are never touched ---- */
{
  const sw = makeSW();
  await sw.fire('install', {}); await sw.fire('activate', {});
  const e = await sw.fire('fetch', { request: { url: 'https://table.raisedcurious.com/ws?code=1', method: 'GET', mode: 'cors' } });
  ck('the two-device rooms are left alone', e._res === undefined);
  const p = await sw.fire('fetch', { request: { url: ORIGIN + '/x', method: 'POST', mode: 'cors' } });
  ck('non-GET requests are left alone', p._res === undefined);
}
console.log(f ? '\n' + f + ' of ' + n + ' FAILED' : '\nall ' + n + ' offline assertions passed');
process.exit(f ? 1 : 0);
