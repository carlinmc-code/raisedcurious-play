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
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  loadMatter(){
    return new Promise((res, rej) => {
      if (window.Matter) return res(window.Matter);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
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
        onPick(it.id, b);
      });
      wrap.appendChild(b);
    }
    document.body.appendChild(wrap);
    return wrap;
  }
};

function drawEmoji(ctx, e, x, y, size, angle = 0, alpha = 1){
  ctx.save(); ctx.translate(x, y); if (angle) ctx.rotate(angle);
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
  ctx: null, on: true,
  unlock(){
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, type = 'sine', vol = 0.12, slide = 0){
    if (!this.on || !this.ctx) return;
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
