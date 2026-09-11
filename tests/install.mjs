/* The install hint must appear for exactly the right people and nobody else.
   Getting this wrong means either a banner nagging Android and desktop users
   forever, or an iPad owner who never discovers the app exists. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const html = readFileSync(ROOT + '/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
let f=0,n=0; const ck=(s,c,x)=>{n++; if(!c){console.log('  FAIL '+s+(x?'   '+x:''));f++;} else console.log('  ok   '+s);};

function run({ ua, platform='', touch=0, standalone=false, displayMode=false, dismissed=false }){
  const store = new Map(); if (dismissed) store.set('rc.install.dismissed','1');
  const nodes = {};
  const mk = id => nodes[id] = { id, hidden:true, textContent:'', onclick:null };
  for (const id of ['install','install-h','install-b','install-x','count','grid','grid-little','grid-new','flight-go','flight-fill','flight-sub'])
    mk(id);
  const ctx = {
    navigator: { userAgent: ua, platform, maxTouchPoints: touch, standalone, serviceWorker: null },
    localStorage: { getItem: k => store.has(k)?store.get(k):null, setItem: (k,v)=>store.set(k,v) },
    document: { querySelector: sel => nodes[sel.replace('#','')] || mk(sel.replace('#','')) },
    console
  };
  ctx.window = ctx;
  ctx.window.matchMedia = () => ({ matches: displayMode });
  ctx.window.navigator = ctx.navigator;
  vm.createContext(ctx);
  try { vm.runInContext(script, ctx); } catch(e){ /* the rest of the hub needs a real DOM */ }
  return { shown: nodes['install'].hidden === false, head: nodes['install-h'].textContent,
           body: nodes['install-b'].textContent, dismiss: nodes['install-x'].onclick, store };
}
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD   = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15';
const CRIOS  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/126.0 Mobile/15E148 Safari/604.1';
const ANDROID= 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36';
const MAC    = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15';

ck('an iPhone in Safari is told how', run({ua:IPHONE}).shown);
ck('and told the actual gesture', /Share/.test(run({ua:IPHONE}).body), run({ua:IPHONE}).body.slice(0,50));
ck('an iPad is recognised even though it claims to be a Mac',
   run({ua:IPAD, platform:'MacIntel', touch:5}).shown);
ck('a real Mac is left alone', !run({ua:MAC, platform:'MacIntel', touch:0}).shown);
ck('Android is left alone', !run({ua:ANDROID}).shown);
{
  const r = run({ua:CRIOS});
  ck('Chrome on iOS is told to use Safari instead', r.shown && /Safari/.test(r.head), r.head);
  ck('and not given a gesture that would not work', !/^Tap the Share/.test(r.body));
}
ck('an already installed app never sees it', !run({ua:IPHONE, standalone:true}).shown);
ck('nor one launched standalone by display-mode', !run({ua:IPHONE, displayMode:true}).shown);
ck('someone who dismissed it is not asked again', !run({ua:IPHONE, dismissed:true}).shown);
{
  const r = run({ua:IPHONE});
  r.dismiss && r.dismiss();
  ck('dismissing it remembers the choice', r.store.get('rc.install.dismissed') === '1');
}
console.log(f ? '\n' + f + ' of ' + n + ' FAILED' : '\nall ' + n + ' install-hint assertions passed');
process.exit(f?1:0);
