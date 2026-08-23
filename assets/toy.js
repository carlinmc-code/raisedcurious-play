/* Shared runtime for the toddler/preschool toys.
   Gives every game: the shell, a settings sheet that actually works, soft
   sound, a clamped loop that pauses when the tab is hidden, forgiving
   pointer handling, and a wordless finger guide on the first visit.
   No analytics, no network, no accounts. */

const SET_KEY = 'rc.toy.settings';
export const settings = Object.assign(
  { sound: true, motion: true },
  (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch(e){ return {}; } })()
);
if (matchMedia('(prefers-reduced-motion: reduce)').matches && localStorage.getItem(SET_KEY) === null)
  settings.motion = false;                       // honour the OS default on first visit
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch(e){} };

/* Which toy is this? Used only to remember the guide has been seen. */
const SLUG = (location.pathname.replace(/\/(index\.html)?$/, '').split('/').filter(Boolean).pop() || 'toy');
const SEEN_KEY = 'rc.toy.seen.' + SLUG;
const hasSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch(e){ return false; } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch(e){} };

/* ---------- sound: short, soft, tied to an action ----------
   iOS is the hard case here, and Chrome on iPad is WebKit too:
   - WebKit has a non-standard 'interrupted' state (app switch, a call,
     another app taking audio). Resuming only from 'suspended' leaves the
     context silent forever afterwards.
   - iOS will not start the audio hardware until a source node has actually
     run inside a real user gesture, so unlocking needs a silent frame.
   - Scheduling notes while the context is not running piles them all at
     currentTime 0, and they fire at once (or not at all) on resume. */
let ac = null, kicked = false, pending = 0;
export const Sound = {
  get state(){ return ac ? ac.state : 'none'; },
  unlock(){
    if (!settings.sound) return;
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ return; }
    if (ac.state !== 'running'){
      const p = ac.resume();
      if (p && p.catch) p.catch(() => {});
    }
    if (!kicked){
      kicked = true;
      try {
        const b = ac.createBuffer(1, 1, ac.sampleRate), s = ac.createBufferSource();
        s.buffer = b; s.connect(ac.destination); s.start(0);
      } catch(e){}
    }
  },
  ready(){
    if (!settings.sound) return false;
    if (!ac) return false;
    if (ac.state === 'running'){ pending = 0; return true; }
    this.unlock();
    /* Before the context has ever rendered, currentTime is still 0, so a note
       scheduled now plays the moment it starts rather than being thrown away.
       That keeps the very first tap audible, which this repo treats as
       non-negotiable. Bounded, so a stuck context cannot bank a pile of notes
       that all fire at once later. */
    return ac.currentTime === 0 && pending++ < 3;
  },
  tone(f, d = .12, type = 'sine', vol = .07, slide = 0){
    if (!this.ready()) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .04);
  },
  noise(d = .1, vol = .05, cut = 1800, high = false){
    if (!this.ready()) return;
    const n = Math.max(1, Math.floor(ac.sampleRate * d));
    const b = ac.createBuffer(1, n, ac.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(); s.buffer = b;
    const f = ac.createBiquadFilter(); f.type = high ? 'highpass' : 'lowpass'; f.frequency.value = cut;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d);
    s.connect(f).connect(g).connect(ac.destination); s.start();
  },
  // named, deliberately gentle
  tap(){ this.tone(660, .07, 'sine', .05, 120); },
  roll(){ this.noise(.09, .028, 900); },
  thud(){ this.tone(120, .16, 'triangle', .07, -40); },
  pop(){ this.tone(520 + Math.random() * 260, .09, 'sine', .06, 260); },
  ding(){ this.tone([784, 988, 1175][Math.floor(Math.random() * 3)], .3, 'sine', .05); },
  splash(){ this.noise(.2, .04, 1400); },
  whoosh(){ this.noise(.3, .025, 700); }
};

/* ---------- the finger guide ----------
   Our player cannot read, so the tutorial is a hand doing the thing. It is
   painted on the canvas after the game draws, loops three times, vanishes the
   instant the child touches anything, and never nags again once they have
   played. Step coordinates are fractions of the play area, so they survive
   any screen size. A grown-up can replay it from the settings sheet. */
const DUR = { tap: 1.15, drag: 1.9 };
function makeCoach(steps){
  const c = {
    steps: (steps || []).filter(s => s && DUR[s.type]),
    on: false, i: 0, t: 0, loops: 0,
    start(){ if (!c.steps.length) return; c.on = true; c.i = 0; c.t = 0; c.loops = 0; },
    stop(){ if (!c.on) return; c.on = false; markSeen(); }
  };
  return c;
}
function drawCoach(c, ctx, a){
  const step = c.steps[c.i % c.steps.length];
  const dur = DUR[step.type];
  const k = Math.min(1, c.t / dur);
  const X = v => a.pad.x + v * a.pad.w, Y = v => a.pad.y + v * a.pad.h;

  let hx, hy, ring;
  if (step.type === 'drag'){
    const e = k < .18 ? 0 : k > .88 ? 1 : (k - .18) / .70;
    const s = e * e * (3 - 2 * e);                  // ease, so it reads as deliberate
    hx = X(step.from[0] + (step.to[0] - step.from[0]) * s);
    hy = Y(step.from[1] + (step.to[1] - step.from[1]) * s);
    ctx.save();
    ctx.setLineDash([9, 9]);
    ctx.strokeStyle = 'rgba(28,26,22,.26)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(step.from[0]), Y(step.from[1]));
    ctx.lineTo(X(step.to[0]), Y(step.to[1]));
    ctx.stroke();
    ctx.restore();
    ring = .34;
  } else {
    hx = X(step.x); hy = Y(step.y);
    ring = (c.t % .58) / .58;                       // two clear taps per step
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(196,82,42,' + ((1 - ring) * .75).toFixed(3) + ')';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(hx, hy, 26 + ring * 34, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(196,82,42,.16)';
  ctx.beginPath(); ctx.arc(hx, hy, 24, 0, 7); ctx.fill();
  ctx.font = '44px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('\u{1F446}', hx + 15, hy + 34);      // pointing hand, just below the touch
  ctx.restore();
}

/* ---------- shell ---------- */
export function boot(opts){
  document.title = opts.title + ' · RaisedCurious Play';
  for (const r of (opts.settingsRows || []))          // defaults for a game's own switches
    if (!(r.key in settings)) settings[r.key] = r.def !== false;
  const bar = document.createElement('div');
  bar.className = 'toy-bar';
  bar.innerHTML =
    '<a class="toy-btn" href="../" aria-label="Back to Play">&#127968;</a>' +
    '<div class="toy-name">' + opts.title + '</div><div class="toy-spacer"></div>' +
    '<button class="toy-btn" id="toy-reset" aria-label="Hold to start over">&#8635;<i class="hold"></i></button>' +
    '<button class="toy-btn" id="toy-set" aria-label="Hold for grown-up settings">&#9881;&#65039;<i class="hold"></i></button>';
  document.body.appendChild(bar);

  const sheet = document.createElement('div');
  sheet.className = 'toy-sheet';
  sheet.innerHTML =
    '<div class="card"><h2>Grown-up settings</h2>' +
    '<p class="sub">Hold the gear for a second to get here. Nothing is saved anywhere but this device.</p>' +
    '<div class="toy-row"><span>Sound</span><button class="toy-switch" data-k="sound" aria-label="Sound"></button></div>' +
    '<div class="toy-row"><span>Movement and effects</span><button class="toy-switch" data-k="motion" aria-label="Movement"></button></div>' +
    /* a game can add its own switches, e.g. Frog World's nature ambience */
    (opts.settingsRows || []).map(r =>
      '<div class="toy-row"><span>' + r.label + '</span>' +
      '<button class="toy-switch" data-k="' + r.key + '" aria-label="' + r.label + '"></button></div>').join('') +
    '<div class="toy-row"><span>Show the finger guide again</span><button class="toy-mini" id="toy-coach">Show me</button></div>' +
    (opts.tryReal ? '<a class="toy-real" href="https://raisedcurious.com/experiments/?id=' + opts.tryReal.id + '">' +
      '<span>Try it for real</span><b>' + opts.tryReal.name + '</b></a>' : '') +
    '<button class="toy-close">Done</button></div>';
  document.body.appendChild(sheet);

  const paint = () => sheet.querySelectorAll('.toy-switch').forEach(b =>
    b.classList.toggle('on', !!settings[b.dataset.k]));
  paint();
  sheet.querySelectorAll('.toy-switch').forEach(b => b.onclick = () => {
    settings[b.dataset.k] = !settings[b.dataset.k]; saveSettings(); paint();
    if (settings.sound) { Sound.unlock(); Sound.tap(); }
  });
  sheet.querySelector('.toy-close').onclick = () => sheet.classList.remove('open');
  sheet.onclick = e => { if (e.target === sheet) sheet.classList.remove('open'); };

  const canvas = document.createElement('canvas');
  canvas.id = 'stage';
  document.body.insertBefore(canvas, bar);
  const ctx = canvas.getContext('2d');
  const api = { canvas, ctx, W: 0, H: 0, dpr: Math.min(2, devicePixelRatio || 1), top: 84, bottom: 96 };
  api.pad = { x: 0, y: 0, w: 0, h: 0 };            // play area, for guide coordinates
  const resize = () => {
    api.W = innerWidth; api.H = innerHeight;
    canvas.width = api.W * api.dpr; canvas.height = api.H * api.dpr;
    ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
    api.pad = { x: 0, y: api.top, w: api.W, h: Math.max(1, api.H - api.top - api.bottom) };
    opts.onResize && opts.onResize(api);
  };
  addEventListener('resize', resize); resize();

  const coach = makeCoach(opts.coach);
  api.coach = coach;
  if (!hasSeen()) coach.start();
  sheet.querySelector('#toy-coach').onclick = () => { sheet.classList.remove('open'); coach.start(); };

  // pointers: first touch unlocks audio and retires the guide
  api.pointers = new Map();
  const pos = e => ({ x: e.clientX, y: e.clientY });
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); Sound.unlock(); coach.stop();
    const p = pos(e); api.pointers.set(e.pointerId, { ...p, sx: p.x, sy: p.y, moved: 0, down: true });
    opts.onDown && opts.onDown(p.x, p.y, e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    const p = api.pointers.get(e.pointerId); if (!p) return;
    const n = pos(e); p.moved = Math.max(p.moved, Math.hypot(n.x - p.sx, n.y - p.sy));
    p.x = n.x; p.y = n.y;
    opts.onMove && opts.onMove(n.x, n.y, e.pointerId);
  });
  const up = e => {
    const p = api.pointers.get(e.pointerId); if (!p) return;
    api.pointers.delete(e.pointerId);
    opts.onUp && opts.onUp(p.x, p.y, e.pointerId, p.moved);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  /* Both grown-up controls need a deliberate press-and-hold. A four-year-old
     bats at the top bar constantly, and a stray tap must not wipe their build
     or open a sheet with a link off the site. The ring fills as you hold. */
  const holdBtn = (el, fn, ms = 550) => {
    let t0 = 0, gen = 0;
    const fill = el.querySelector('.hold');
    /* Generation-guarded, not cancelAnimationFrame-guarded: rapid taps start
       overlapping ring animations, and a stale one measuring against a reset
       t0 would look like a completed hold and fire instantly. Which is the
       exact thing a four-year-old does to a button. */
    const run = mine => {
      if (mine !== gen || !t0) return;
      const k = Math.min(1, (performance.now() - t0) / ms);
      if (fill) fill.style.transform = 'scaleY(' + k + ')';
      if (k >= 1){ finish(true); return; }
      requestAnimationFrame(() => run(mine));
    };
    const finish = fire => {
      gen++; t0 = 0;
      if (fill) fill.style.transform = 'scaleY(0)';
      if (fire){ Sound.unlock(); Sound.tap(); fn(); }
    };
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); gen++; t0 = performance.now(); run(gen);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel'])
      el.addEventListener(ev, () => { if (t0) finish(false); });
  };
  holdBtn(bar.querySelector('#toy-set'), () => sheet.classList.add('open'));
  holdBtn(bar.querySelector('#toy-reset'), () => { Sound.whoosh(); opts.onReset && opts.onReset(); });

  /* iOS Safari ignores user-scalable=no, so block zoom gestures directly.
     Same guards as shared/kit.js - see repo CLAUDE.md rule 5, never remove. */
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend'])
    document.addEventListener(ev, e => e.preventDefault());
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  let lastTap = 0;                                 // double-tap zoom, canvas only
  document.addEventListener('touchend', e => {
    if (e.target !== canvas) return;
    const now = performance.now();
    if (now - lastTap < 350) e.preventDefault();
    lastTap = now;
  }, { passive: false });

  /* Big action buttons carry a picture our player can read and a word for
     the grown-up reading over their shoulder. */
  api.action = (icon, label, cls, fn) => {
    const b = document.createElement('button');
    b.className = 'toy-go' + (cls ? ' ' + cls : '');
    b.innerHTML = '<span class="ico">' + icon + '</span><span class="lbl">' + label + '</span>';
    b.setAttribute('aria-label', label);
    b.onclick = () => { Sound.unlock(); coach.stop(); fn(b); };
    document.body.appendChild(b);
    return b;
  };
  // the action button must never sit on top of the tools
  api.showTray = on => document.body.classList.toggle('has-tray', !!on);
  api.tray = (items, choose, active) => {
    const t = document.createElement('div'); t.className = 'toy-tray';
    for (const it of items){
      const b = document.createElement('button');
      b.className = 'toy-tray-b' + (it.id === active ? ' sel' : '');
      b.dataset.id = it.id; b.title = it.name || it.id;
      b.setAttribute('aria-label', it.name || String(it.id));
      b.innerHTML = it.svg ? it.svg : '<span>' + it.icon + '</span>';
      b.onclick = () => {
        t.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel'); Sound.tap(); choose(it.id);
      };
      t.appendChild(b);
    }
    document.body.appendChild(t);
    api.showTray(true);
    return t;
  };

  // loop: clamped dt, paused when the tab is hidden
  let last = performance.now(), running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden; last = performance.now();
    if (running) Sound.unlock();          // WebKit leaves it interrupted otherwise
  });
  addEventListener('pageshow', () => Sound.unlock());
  // some WebKit builds only honour the unlock on touchend, so take that too
  document.addEventListener('touchend', () => Sound.unlock(), { passive: true });
  const step = t => {
    let dt = (t - last) / 1000; last = t;
    dt = Math.max(0, Math.min(.05, dt || .016));
    if (running){
      const d = settings.motion ? dt : dt * .6;
      opts.tick(d, api);
      if (coach.on){
        coach.t += d;
        if (coach.t >= DUR[coach.steps[coach.i % coach.steps.length].type]){
          coach.t = 0;
          if (++coach.i >= coach.steps.length){
            coach.i = 0;
            if (++coach.loops >= 3) coach.on = false;   // three passes, then leave them be
          }
        }
        if (coach.on) drawCoach(coach, ctx, api);
      }
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return api;
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
