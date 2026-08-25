'use strict';
/* RaisedCurious Play - shared kit. Every game calls Kit.init() and gets
   a full-screen canvas, sounds, multi-touch tracking, and the home chip. */

const Kit = {
  canvas: null, ctx: null, W: 0, H: 0,
  DPR: Math.min(window.devicePixelRatio || 1, 2),
  pointers: new Map(),   // pointerId -> {x, y, px, py, down}
  taps: [],              // recent tap points {x, y, t}

  init(icon, title){
    document.body.insertAdjacentHTML('beforeend',
      '<a class="kit-home" href="../" aria-label="Back to games">🏠</a>' +
      '<div class="kit-title">' + icon + ' ' + title + '</div>');
    this.canvas = document.getElementById('stage');
    this.ctx = this.canvas.getContext('2d');
    const resize = () => {
      this.W = window.innerWidth; this.H = window.innerHeight;
      this.canvas.width = this.W * this.DPR; this.canvas.height = this.H * this.DPR;
      this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
      if (this.onResize) this.onResize();
    };
    window.addEventListener('resize', resize); resize();

    const cv = this.canvas;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, down: true, t0: performance.now() });
      this.taps.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      Sound.unlock();
      this._coachStop();
    });
    cv.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId);
      if (p){ p.px = p.x; p.py = p.y; p.x = e.clientX; p.y = e.clientY; }
    });
    const up = e => this.pointers.delete(e.pointerId);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    // iOS Safari ignores user-scalable=no, so block zoom gestures directly.
    // Pinch (Safari fires proprietary gesture events for it):
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend'])
      document.addEventListener(ev, e => e.preventDefault());
    // Multi-finger page zoom/pan fallback:
    document.addEventListener('touchmove', e => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) Sound.unlock();     // WebKit stays interrupted otherwise
    });
    window.addEventListener('pageshow', () => Sound.unlock());
    document.addEventListener('touchend', () => Sound.unlock(), { passive: true });

    // Double-tap zoom, canvas only (tray buttons keep fast repeat-taps):
    let lastTap = 0;
    document.addEventListener('touchend', e => {
      if (e.target !== cv) return;
      const now = Date.now();
      if (now - lastTap < 350) e.preventDefault();
      lastTap = now;
    }, { passive: false });
    return this;
  },

  firstPointer(){ for (const p of this.pointers.values()) return p; return null; },

  loop(fn){
    let last = performance.now();
    const step = t => {
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      fn(dt, t / 1000);
      this._coachDraw(dt);          // painted last, so it sits over the game
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  /* ---------- the finger guide ----------
     Same idea as assets/toy.js: our player cannot read, so the tutorial is a
     hand doing the gesture. Steps are fractions of the play area (below the
     title, above the tray), it loops three times, and it disappears on the
     first touch and is remembered per game. Call Kit.guide([...]) after init.
       {type:'tap',  x, y}                  - a spot to press
       {type:'drag', from:[x,y], to:[x,y]}  - a line to draw with one finger */
  _coach: null,
  guide(steps){
    const ok = (steps || []).filter(s => s && (s.type === 'tap' || s.type === 'drag'));
    if (!ok.length) return;
    let seen = false;
    try { seen = localStorage.getItem('rc.kit.seen.' + this._slug()) === '1'; } catch(e){}
    if (seen) return;
    this._coach = { steps: ok, i: 0, t: 0, loops: 0 };
  },
  _slug(){
    return location.pathname.replace(/\/(index\.html)?$/, '').split('/').filter(Boolean).pop() || 'game';
  },
  _coachStop(){
    if (!this._coach) return;
    this._coach = null;
    try { localStorage.setItem('rc.kit.seen.' + this._slug(), '1'); } catch(e){}
  },
  _coachDraw(dt){
    const c = this._coach; if (!c) return;
    const DUR = { tap: 1.15, drag: 1.9 };
    const step = c.steps[c.i];
    c.t += dt;
    if (c.t >= DUR[step.type]){
      c.t = 0;
      if (++c.i >= c.steps.length){ c.i = 0; if (++c.loops >= 3){ this._coach = null; return; } }
    }
    const s = c.steps[c.i], k = Math.min(1, c.t / DUR[s.type]);
    const padY = 84, padH = Math.max(1, this.H - padY - 100);   // clear of title and tray
    const X = v => v * this.W, Y = v => padY + v * padH;
    const ctx = this.ctx;
    let hx, hy, ring;
    if (s.type === 'drag'){
      const e = k < .18 ? 0 : k > .88 ? 1 : (k - .18) / .70;
      const g = e * e * (3 - 2 * e);
      hx = X(s.from[0] + (s.to[0] - s.from[0]) * g);
      hy = Y(s.from[1] + (s.to[1] - s.from[1]) * g);
      ctx.save();
      ctx.setLineDash([9, 9]);
      ctx.strokeStyle = 'rgba(250,247,240,.5)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(X(s.from[0]), Y(s.from[1]));
      ctx.lineTo(X(s.to[0]), Y(s.to[1]));
      ctx.stroke();
      ctx.restore();
      ring = .34;
    } else {
      hx = X(s.x); hy = Y(s.y); ring = (c.t % .58) / .58;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,' + ((1 - ring) * .85).toFixed(3) + ')';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(hx, hy, 26 + ring * 34, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(hx, hy, 24, 0, 7); ctx.fill();
    ctx.font = '44px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F446}', hx + 15, hy + 34);
    ctx.restore();
  },

  /* matter.js is served from this site, not a CDN. Six games will not start
     without it, and a game that needs the internet to open is no use on a
     plane - which is the whole point of the offline mode. */
  loadMatter(){
    return new Promise((res, rej) => {
      if (window.Matter) return res(window.Matter);
      const s = document.createElement('script');
      s.src = '../shared/matter.min.js?v=0.19.0';
      s.onload = () => res(window.Matter);
      s.onerror = () => rej(new Error('matter.js failed to load'));
      document.head.appendChild(s);
    });
  },

  // Big friendly emoji tool tray along the bottom. items: [{icon, id}]
  tray(items, onPick, activeId){
    const wrap = document.createElement('div');
    wrap.className = 'kit-tray';
    for (const it of items){
      const b = document.createElement('button');
      b.className = 'kit-tool' + (it.id === activeId ? ' active' : '');
      b.textContent = it.icon; b.title = it.id;
      b.addEventListener('click', () => {
        wrap.querySelectorAll('.kit-tool').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        Sound.tone(600, 0.08, 'sine', 0.06, 200);
        Kit._coachStop();
        onPick(it.id, b);
      });
      wrap.appendChild(b);
    }
    document.body.appendChild(wrap);
    return wrap;
  }
};

/* drawEmoji(ctx, emoji, x, y, size, angle, alpha, flip)
   `flip` is last and optional. Several call sites were once written for a
   signature with flip in the alpha slot, which set globalAlpha to a boolean:
   false becomes 0, so the thing was drawn perfectly invisibly. If you add a
   call, the seventh argument is opacity and nothing else. */
function drawEmoji(ctx, e, x, y, size, angle = 0, alpha = 1, flip = false){
  ctx.save(); ctx.translate(x, y); if (angle) ctx.rotate(angle);
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = alpha;
  ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, 0, 0); ctx.restore();
}
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- sounds ---------- */
const Sound = {
  ctx: null, on: true, kicked: false, pending: 0,
  /* See assets/toy.js for the full reasoning. Short version: WebKit (which is
     every browser on iPad, Chrome included) has an 'interrupted' state that
     'suspended' checks miss, needs a silent frame inside a real gesture before
     it will start the hardware, and never resumes itself after an app switch. */
  unlock(){
    try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ return; }
    if (this.ctx.state !== 'running'){
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(function(){});
    }
    if (!this.kicked){
      this.kicked = true;
      try {
        const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate), s = this.ctx.createBufferSource();
        s.buffer = b; s.connect(this.ctx.destination); s.start(0);
      } catch(e){}
    }
  },
  ready(){
    if (!this.on || !this.ctx) return false;
    if (this.ctx.state === 'running'){ this.pending = 0; return true; }
    this.unlock();
    // See assets/toy.js: keep the first tap audible, but bounded so a stuck
    // context cannot bank notes that all fire at once on resume.
    return this.ctx.currentTime === 0 && (this.pending = (this.pending || 0) + 1) <= 3;
  },
  tone(freq, dur, type = 'sine', vol = 0.12, slide = 0){
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },
  pop(){ this.tone(rand(500, 700), 0.12, 'sine', 0.14, 300); },
  thud(){ this.tone(rand(90, 130), 0.18, 'triangle', 0.12, -40); },
  boing(){ this.tone(160, 0.3, 'triangle', 0.12, 220); },
  ding(){ this.tone(pick([880, 1047, 1319]), 0.3, 'sine', 0.09); },
  splash(){ this.tone(rand(300, 420), 0.2, 'sine', 0.07, -180); },
  crumble(){ this.tone(rand(160, 220), 0.12, 'sawtooth', 0.04, -80); },
  squeak(){ this.tone(rand(1100, 1500), 0.12, 'sine', 0.07, 300); },
  whoosh(){ this.tone(300, 0.35, 'sawtooth', 0.03, 600); },
  click(){ this.tone(900, 0.05, 'square', 0.04, -200); }
};

/* Offline. Registering from here as well as the hub means a child who
   opens a game directly still gets the site saved on their device. */
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0)
  navigator.serviceWorker.register('/sw.js').catch(function(){});
