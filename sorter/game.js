import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=2';
/* Drag a ball into the matching bin. A match is celebrated; a mismatch just
   floats gently home. Nothing is ever lost and there is no timer, so a two
   year old can sit in it. Refills itself forever. */
const HUES = [
  { id:'red',    col:'#C4522A', name:'Red' },
  { id:'yellow', col:'#C9922A', name:'Yellow' },
  { id:'green',  col:'#2D5A3D', name:'Green' },
  { id:'blue',   col:'#2A6B8A', name:'Blue' }
];
let balls = [], bins = [], held = null, bits = [], scored = 0, R = 26;
function layout(a){
  R = clamp(a.W/16, 20, 34);
  const bw = a.W / HUES.length, by = a.top + 20, bh = clamp(a.H*.20, 110, 190);
  bins = HUES.map((h, i) => ({ ...h, x: i*bw + 8, y: by, w: bw - 16, h: bh, n: 0, pulse: 0 }));
  refill(a);
}
function refill(a){
  const pool = a.H - 90;
  while (balls.length < 8)
    balls.push({ x: rand(R+8, a.W-R-8), y: rand(pool - 130, pool - 20),
      vx: rand(-30,30), vy: 0, hue: pick(HUES), r: R, home: null });
}
function celebrate(x, y, col){
  for (let i = 0; i < 16; i++){
    const a = rand(0,6.3), s = rand(70, 240);
    bits.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:rand(.4,.8), age:0, col });
  }
}
const api = boot({
  title: 'Color Sorter',
  coach: [{ type:'drag', from:[.5,.78], to:[.14,.10] }],
  tryReal: { id: 32, name: 'Color Mixing Paddles' },
  onReset(){ balls = []; scored = 0; bits = []; layout(api); },
  onResize(a){ layout(a); },
  onDown(x, y){
    for (let i = balls.length-1; i >= 0; i--){
      const b = balls[i];
      if (Math.hypot(b.x-x, b.y-y) < b.r + 14){ held = b; b.grab = true; Sound.tap(); return; }
    }
  },
  onMove(x, y){ if (held){ held.x = x; held.y = y; held.vx = 0; held.vy = 0; } },
  onUp(x, y){
    if (!held) return;
    const b = held; held = null; b.grab = false;
    const bin = bins.find(k => x > k.x && x < k.x + k.w && y < k.y + k.h + 30);
    if (bin && bin.id === b.hue.id){
      bin.n++; bin.pulse = 1; scored++;
      celebrate(b.x, b.y, b.hue.col);
      balls.splice(balls.indexOf(b), 1);
      Sound.ding(); refill(api);
    } else if (bin){
      b.vy = 260; b.vx = rand(-70,70); Sound.tone(240, .12, 'sine', .05, -60);
    }
  },
  tick(dt, a){
    const floor = a.H - 70;
    for (const b of balls){
      if (b.grab) continue;
      b.vy += 1300*dt; b.x += b.vx*dt; b.y += b.vy*dt; b.vx *= .99;
      if (b.x < b.r){ b.x = b.r; b.vx = Math.abs(b.vx)*.6; }
      if (b.x > a.W-b.r){ b.x = a.W-b.r; b.vx = -Math.abs(b.vx)*.6; }
      if (b.y + b.r > floor){ b.y = floor - b.r; if (b.vy > 200) Sound.pop(); b.vy *= -.34; b.vx *= .9; }
    }
    for (const p of bits){ p.age += dt; p.vy += 320*dt; p.x += p.vx*dt; p.y += p.vy*dt; }
    bits = bits.filter(p => p.age < p.life);
    for (const k of bins) k.pulse = Math.max(0, k.pulse - dt*2.2);

    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0,0,a.W,a.H);
    ctx.fillStyle = '#E4DCCB'; ctx.fillRect(0, floor, a.W, a.H - floor);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const k of bins){
      const g = 1 + k.pulse*.06;
      ctx.save(); ctx.translate(k.x + k.w/2, k.y + k.h/2); ctx.scale(g, g);
      ctx.fillStyle = k.col;
      ctx.beginPath(); ctx.roundRect(-k.w/2, -k.h/2, k.w, k.h, 14); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      ctx.beginPath(); ctx.roundRect(-k.w/2 + 10, -k.h/2 + 10, k.w - 20, k.h*.42, 10); ctx.fill();
      ctx.fillStyle = '#FAF7F0'; ctx.font = '700 20px Lato, system-ui';
      ctx.fillText(k.n, 0, k.h/2 - 24);
      ctx.restore();
    }
    for (const b of balls){
      ctx.fillStyle = 'rgba(28,26,22,.10)';
      ctx.beginPath(); ctx.ellipse(b.x, floor - 4, b.r*.9, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = b.hue.col;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (b.grab ? 1.12 : 1), 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.beginPath(); ctx.arc(b.x - b.r*.3, b.y - b.r*.32, b.r*.28, 0, 7); ctx.fill();
    }
    for (const p of bits){
      const k = 1 - p.age/p.life;
      ctx.globalAlpha = k; ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5*k + 1, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#8C8278'; ctx.font = '600 16px Lato, system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Sorted: ' + scored, 14, a.H - 26);
  }
});
layout(api);
api.action('\u2795', 'More balls', '', () => { for (let i=0;i<4;i++) balls.push({
  x: rand(40, api.W-40), y: api.H - 200, vx: rand(-40,40), vy: 0, hue: pick(HUES), r: R }); });
