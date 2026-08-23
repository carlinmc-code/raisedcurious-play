import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=4';
/* A silly machine. Press the hopper, a ball is born; it rides belts, drops
   down chutes, gets painted, bounces off a paddle and lands in the bin.
   The whole point is watching one ball make the whole trip. */
let balls = [], parts = [], count = 0, paddle = 0, R = 16, hum = 0;
const COLS = ['#C4522A','#C9922A','#2D5A3D','#2A6B8A','#8C5AA8','#D96A9A'];

function layout(a){
  const w = a.W, top = a.top + 30, h = a.H - a.bottom - top - 40;
  R = clamp(w/26, 11, 20);
  parts = [
    { t:'belt',  x:w*.10, y:top+h*.16, w:w*.56, dir: 1, speed: 130 },
    { t:'chute', x:w*.66, y:top+h*.16, x2:w*.84, y2:top+h*.42 },
    { t:'paint', x:w*.84, y:top+h*.42, r:R*2.1 },
    { t:'belt',  x:w*.22, y:top+h*.56, w:w*.62, dir:-1, speed: 165 },
    { t:'chute', x:w*.22, y:top+h*.56, x2:w*.12, y2:top+h*.74 },
    { t:'bounce',x:w*.12, y:top+h*.74, w:w*.30 },
    { t:'bin',   x:w*.52, y:top+h*.99, w:w*.40, h:h*.20 }
  ];
}
function born(a){
  balls.push({ x: parts[0].x, y: parts[0].y - R*2, vx: 0, vy: 0, r: R,
    col:'#C9BFAC', stage: 0, spin: 0 });
  if (balls.length > 30) balls.shift();
  count++; Sound.tap();
}
const api = boot({
  title: 'Ball Factory',
  coach: [{ type:'tap', x:.5, y:.5 }, { type:'tap', x:.5, y:.5 }],
  tryReal: { id: 50, name: 'Balloon Rocket Car' },
  onReset(){ balls = []; count = 0; },
  onResize(a){ layout(a); },
  onDown(x, y){ born(api); },
  tick(dt, a){
    paddle += dt*3; hum -= dt;
    const P = parts, bin = P[6];
    for (const b of balls){
      b.spin += (b.vx || 60) * dt * .05;
      const s = P[b.stage];
      if (!s){ b.vy += 1500*dt; b.y += b.vy*dt; b.x += b.vx*dt; continue; }
      if (s.t === 'belt'){
        b.y += (s.y - b.r - b.y) * Math.min(1, dt*12);
        b.x += s.speed * s.dir * dt;
        if (hum <= 0){ Sound.noise(.05, .012, 500); hum = .18; }   // one belt hum, not one per ball
        if (s.dir > 0 ? b.x > s.x + s.w : b.x < s.x) b.stage++;
      } else if (s.t === 'chute'){
        b.vy += 1300*dt;
        const dx = s.x2 - s.x, dy = s.y2 - s.y, len = Math.hypot(dx,dy);
        b.x += (dx/len)*Math.abs(b.vy)*dt; b.y += (dy/len)*Math.abs(b.vy)*dt;
        if (b.y >= s.y2){ b.x = s.x2; b.y = s.y2; b.vy = 0; b.stage++;
          if (P[b.stage] && P[b.stage].t !== 'paint') Sound.roll(); }
      } else if (s.t === 'paint'){
        if (b.col === '#C9BFAC'){ b.col = pick(COLS); Sound.ding(); }
        b.stage++;
      } else if (s.t === 'bounce'){
        b.vy += 1400*dt; b.y += b.vy*dt; b.x += 150*dt;
        const py = s.y + Math.sin(paddle)*16;
        if (b.y + b.r > py && b.vy > 0){ b.vy = -430; Sound.thud(); }
        if (b.x > s.x + s.w) b.stage++;
      } else if (s.t === 'bin'){
        b.vy += 1500*dt; b.y += b.vy*dt; b.x += 90*dt;
        const fl = bin.y;
        if (b.y + b.r > fl){
          b.y = fl - b.r; b.vy *= -.32; b.x = clamp(b.x, bin.x+b.r, bin.x+bin.w-b.r);
          if (Math.abs(b.vy) > 40) Sound.pop();
        }
      }
    }
    balls = balls.filter(b => b.y < a.H + 200);

    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0,0,a.W,a.H);
    for (const s of parts){
      if (s.t === 'belt'){
        ctx.fillStyle = '#4A4540'; ctx.beginPath(); ctx.roundRect(s.x, s.y, s.w, 12, 6); ctx.fill();
        ctx.fillStyle = '#8C8278';
        for (let i = 0; i < s.w; i += 22){
          const o = ((paddle*s.speed*s.dir) % 22 + 22) % 22;
          ctx.fillRect(s.x + ((i + o) % s.w), s.y + 3, 8, 6);
        }
      } else if (s.t === 'chute'){
        ctx.strokeStyle = 'rgba(42,107,138,.45)'; ctx.lineWidth = R*2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      } else if (s.t === 'paint'){
        ctx.fillStyle = '#C9922A'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#FAF7F0'; ctx.font = (s.r)+'px system-ui';
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🎨', s.x, s.y);
      } else if (s.t === 'bounce'){
        ctx.fillStyle = '#C4522A'; ctx.beginPath();
        ctx.roundRect(s.x, s.y + Math.sin(paddle)*16, s.w, 14, 7); ctx.fill();
      } else if (s.t === 'bin'){
        ctx.fillStyle = '#E4DCCB'; ctx.fillRect(s.x, s.y - s.h, s.w, s.h);
        ctx.strokeStyle = '#C9BFAC'; ctx.lineWidth = 6;
        ctx.strokeRect(s.x, s.y - s.h, s.w, s.h);
      }
    }
    ctx.fillStyle = '#2D5A3D';
    ctx.beginPath(); ctx.roundRect(parts[0].x - R*2, parts[0].y - R*4.4, R*3.4, R*3, 10); ctx.fill();
    for (const b of balls){
      ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.arc(b.x - b.r*.3, b.y - b.r*.3, b.r*.3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#8C8278'; ctx.font = '600 16px Lato, system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Balls made: ' + count, 16, a.top + 22);
  }
});
layout(api);
api.action('\u{1F535}', 'Make a ball', '', () => born(api));
