import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=2';
/* A pegboard. Tap anywhere along the top and something falls, pinging off
   pegs into one of the bins. Over time the bins fill up and the middle ones
   fill fastest, which is the quiet point of the whole thing. */
let pegs = [], drops = [], bins = [], binY = 0, thing = '🔴', ping = 0;
const THINGS = ['🔴','🟡','🔵','🟢','⚽','🍎','⭐'];
function layout(a){
  pegs = []; bins = [];
  const top = a.top + 70, bot = a.H - a.bottom - 90;
  binY = bot;
  const rows = clamp(Math.floor((bot-top)/46), 5, 11), gap = a.W/9;
  for (let r = 0; r < rows; r++){
    const off = (r % 2) ? gap/2 : 0;
    for (let c = 0; c <= 9; c++){
      const x = off + c*gap;
      if (x > 6 && x < a.W-6) pegs.push({ x, y: top + r*((bot-top)/rows), r: 6 });
    }
  }
  const n = 7, bw = a.W/n;
  for (let i = 0; i < n; i++) bins.push({ x: i*bw, w: bw, n: 0 });
}
function drop(a, x){
  drops.push({ x: clamp(x, 20, a.W-20), y: a.top + 30, vx: rand(-25,25), vy: 0,
    e: thing, rot: 0, vr: rand(-3,3), landed: false });
  if (drops.length > 60) drops.shift();
  Sound.tap();
}
const api = boot({
  title: 'Drop Zone',
  coach: [{ type:'tap', x:.35, y:.04 }, { type:'tap', x:.62, y:.04 }],
  tryReal: { id: 92, name: 'Parachute Physics' },
  onReset(){ drops = []; bins.forEach(b => b.n = 0); },
  onResize(a){ layout(a); },
  onDown(x, y){ drop(api, x); },
  onMove(x, y){ if (Math.random() < .18) drop(api, x); },
  tick(dt, a){
    ping -= dt;                                    // one peg ping at a time, not forty
    for (const d of drops){
      if (d.landed) continue;
      d.vy += 1250*dt; d.x += d.vx*dt; d.y += d.vy*dt; d.rot += d.vr*dt; d.vx *= .995;
      for (const p of pegs){
        const dx = d.x-p.x, dy = d.y-p.y, dist = Math.hypot(dx,dy), min = p.r + 13;
        if (dist < min && dist > 0){
          const nx = dx/dist, ny = dy/dist;
          d.x = p.x + nx*min; d.y = p.y + ny*min;
          const dot = d.vx*nx + d.vy*ny;
          d.vx = (d.vx - 2*dot*nx)*.52 + rand(-30,30);
          d.vy = (d.vy - 2*dot*ny)*.52;
          d.vr += rand(-3,3);
          if (ping <= 0){ Sound.tone(rand(700, 1200), .04, 'sine', .035); ping = .04; }
        }
      }
      if (d.x < 14){ d.x = 14; d.vx = Math.abs(d.vx)*.6; }
      if (d.x > a.W-14){ d.x = a.W-14; d.vx = -Math.abs(d.vx)*.6; }
      if (d.y > binY - 14){
        d.landed = true; d.y = binY - 14; d.vy = 0; d.vr = 0;
        const b = bins[clamp(Math.floor(d.x / (a.W/bins.length)), 0, bins.length-1)];
        b.n++; d.y = binY - 14 - Math.min(b.n-1, 6)*20; d.x = b.x + b.w/2 + rand(-8,8);
        Sound.pop();
      }
    }
    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0,0,a.W,a.H);
    for (let i = 0; i < bins.length; i++){
      const b = bins[i];
      ctx.fillStyle = i % 2 ? '#F2ECDF' : '#EDE5D5';
      ctx.fillRect(b.x, binY, b.w, a.H - binY);
      ctx.strokeStyle = '#DDD5C8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, binY); ctx.lineTo(b.x, a.H); ctx.stroke();
      if (b.n){ ctx.fillStyle = '#8C8278'; ctx.font = '700 18px Lato, system-ui';
        ctx.textAlign = 'center'; ctx.fillText(b.n, b.x + b.w/2, a.H - 18); }
    }
    ctx.fillStyle = '#C9BFAC';
    for (const p of pegs){ ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of drops){
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      ctx.font = '26px system-ui'; ctx.fillText(d.e, 0, 0); ctx.restore();
    }
  }
});
layout(api);
api.action('\u{1F5D1}\uFE0F', 'Drop five', '', () => { for (let i=0;i<5;i++) drop(api, rand(api.W*.2, api.W*.8)); });
api.tray(THINGS.map(t => ({ id:t, icon:t })), id => thing = id, '🔴');
