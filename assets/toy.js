/* Shared runtime for the toddler/preschool toys.
   Gives every game: the shell, a settings sheet that actually works, soft
   sound, a clamped loop that pauses when the tab is hidden, and forgiving
   pointer handling. No analytics, no network, no accounts. */

const SET_KEY = 'rc.toy.settings';
export const settings = Object.assign(
  { sound: true, motion: true },
  (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch(e){ return {}; } })()
);
if (matchMedia('(prefers-reduced-motion: reduce)').matches && localStorage.getItem(SET_KEY) === null)
  settings.motion = false;                       // honour the OS default on first visit
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch(e){} };

/* ---------- sound: short, soft, tied to an action ---------- */
let ac = null;
export const Sound = {
  unlock(){
    if (!settings.sound) return;
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  },
  tone(f, d = .12, type = 'sine', vol = .07, slide = 0){
    if (!settings.sound || !ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .04);
  },
  noise(d = .1, vol = .05, cut = 1800, high = false){
    if (!settings.sound || !ac) return;
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

/* ---------- shell ---------- */
export function boot(opts){
  document.title = opts.title + ' · RaisedCurious Play';
  const bar = document.createElement('div');
  bar.className = 'toy-bar';
  bar.innerHTML =
    `<a class="toy-btn" href="../" aria-label="Back to Play">&#127968;</a>` +
    `<div class="toy-name">${opts.title}</div><div class="toy-spacer"></div>` +
    `<button class="toy-btn" id="toy-reset" aria-label="Start over">&#8635;</button>` +
    `<button class="toy-btn" id="toy-set" aria-label="Settings">&#9881;&#65039;</button>`;
  document.body.appendChild(bar);

  const sheet = document.createElement('div');
  sheet.className = 'toy-sheet';
  sheet.innerHTML =
    `<div class="card"><h2>Grown-up settings</h2>` +
    `<p class="sub">Nothing here is saved anywhere but this device.</p>` +
    `<div class="toy-row"><span>Sound</span><button class="toy-switch" data-k="sound" aria-label="Sound"></button></div>` +
    `<div class="toy-row"><span>Movement and effects</span><button class="toy-switch" data-k="motion" aria-label="Movement"></button></div>` +
    (opts.tryReal ? `<a class="toy-real" href="https://raisedcurious.com/experiments/?id=${opts.tryReal.id}">` +
      `<span>Try it for real</span><b>${opts.tryReal.name}</b></a>` : '') +
    `<button class="toy-close">Done</button></div>`;
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
  bar.querySelector('#toy-set').onclick = () => sheet.classList.add('open');
  bar.querySelector('#toy-reset').onclick = () => { Sound.unlock(); Sound.whoosh(); opts.onReset && opts.onReset(); };

  const canvas = document.createElement('canvas');
  canvas.id = 'stage';
  document.body.insertBefore(canvas, bar);
  const ctx = canvas.getContext('2d');
  const api = { canvas, ctx, W: 0, H: 0, dpr: Math.min(2, devicePixelRatio || 1), top: 84, bottom: 96 };
  const resize = () => {
    api.W = innerWidth; api.H = innerHeight;
    canvas.width = api.W * api.dpr; canvas.height = api.H * api.dpr;
    ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
    opts.onResize && opts.onResize(api);
  };
  addEventListener('resize', resize); resize();

  // pointers, with the first touch unlocking audio
  api.pointers = new Map();
  const pos = e => ({ x: e.clientX, y: e.clientY });
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); Sound.unlock();
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

  /* iOS Safari ignores user-scalable=no, so block zoom gestures directly.
     Same guards as shared/kit.js — see repo CLAUDE.md rule 5, never remove. */
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

  // big action buttons
  api.action = (label, cls, fn) => {
    const b = document.createElement('button');
    b.className = 'toy-go' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.onclick = () => { Sound.unlock(); fn(b); };
    document.body.appendChild(b);
    return b;
  };
  api.tray = (items, pick, active) => {
    const t = document.createElement('div'); t.className = 'toy-tray';
    for (const it of items){
      const b = document.createElement('button');
      b.className = 'toy-tray-b' + (it.id === active ? ' sel' : '');
      b.dataset.id = it.id; b.title = it.name || it.id;
      b.innerHTML = it.svg ? it.svg : `<span>${it.icon}</span>`;
      b.onclick = () => {
        t.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel'); Sound.tap(); pick(it.id);
      };
      t.appendChild(b);
    }
    document.body.appendChild(t);
    return t;
  };

  // loop: clamped dt, paused when the tab is hidden
  let last = performance.now(), running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden; last = performance.now();
  });
  const step = t => {
    let dt = (t - last) / 1000; last = t;
    dt = Math.max(0, Math.min(.05, dt || .016));
    if (running) opts.tick(settings.motion ? dt : dt * .6, api);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return api;
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
