import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=4';
/* Place gadgets, press GO, watch a ball find its way through them. Nothing
   can fail: if the ball misses everything it just rolls off the bottom and
   you try again. Gadgets are one-tap, snapped to a coarse grid. */
let items = [], ball = null, tool = 'ramp', S = 70, flashes = [];
const TOOLS = {
  ramp:  { icon:'📐' }, fan:   { icon:'🌀' }, spring:{ icon:'🌸' },
  bell:  { icon:'🔔' }, block: { icon:'🧱' }, balloon:{ icon:'🎈' }
};
function snap(a, x, y){
  return { gx: Math.round((x - S/2) / S), gy: Math.round((y - a.top - S/2) / S) };
}
function at(g){ return items.find(i => i.gx === g.gx && i.gy === g.gy); }
function put(a, x, y){
  const g = snap(a, x, y), e = at(g);
  if (e){ if (e.t === tool){ items.splice(items.indexOf(e), 1); Sound.pop(); return; } e.t = tool; Sound.tap(); return; }
  items.push({ t: tool, gx: g.gx, gy: g.gy, flip: Math.random() < .5, phase: rand(0,6.3) });
  if (items.length > 60) items.shift();
  Sound.tap();
}
const px = (a, i) => ({ x: i.gx*S + S/2, y: a.top + i.gy*S + S/2 });
function go(a){
  let top = null;                                  // highest gadget wins the drop
  for (const i of items) if (!top || i.gy < top.gy) top = i;
  ball = { x: top ? top.gx*S + S/2 : a.W/2, y: a.top + 10, vx: 0, vy: 0, r: 15 };
  Sound.whoosh();
}
const api = boot({
  title: 'Contraption Lab',
  coach: [{ type:'tap', x:.32, y:.24 }, { type:'tap', x:.58, y:.52 }],
  tryReal: { id: 97, name: 'Rube Goldberg Machine' },
  onReset(){ items = []; ball = null; flashes = []; },
  onResize(a){ S = clamp(Math.round(a.W / 6), 56, 92); },
  onDown(x, y){ if (y > api.top && y < api.H - api.bottom) put(api, x, y); },
  tick(dt, a){
    for (const f of flashes) f.t += dt;
    flashes = flashes.filter(f => f.t < .4);
    if (ball){
      const b = ball;
      b.vy += 1500*dt; b.x += b.vx*dt; b.y += b.vy*dt; b.vx *= .999;
      for (const i of items){
        const p = px(a, i), dx = b.x - p.x, dy = b.y - p.y;
        if (Math.abs(dx) > S*.72 || Math.abs(dy) > S*.72) continue;
        if (i.t === 'ramp'){
          const dir = i.flip ? -1 : 1;
          const surf = p.y + S*.34 - dir * dx * .62;     // sloped line through the cell
          if (b.y + b.r > surf && b.y < surf + 40){
            b.y = surf - b.r; b.vy = Math.min(b.vy, 40); b.vx += dir * 780 * dt;
            if (Math.random() < .12) Sound.roll();
          }
        } else if (i.t === 'block'){
          if (Math.abs(dx) < S*.42 + b.r && Math.abs(dy) < S*.42 + b.r){
            if (Math.abs(dx) > Math.abs(dy)){ b.x = p.x + Math.sign(dx||1)*(S*.42+b.r); b.vx = -b.vx*.5; }
            else { b.y = p.y + Math.sign(dy||1)*(S*.42+b.r); b.vy = -Math.abs(b.vy)*.35; }
            Sound.thud();
          }
        } else if (i.t === 'spring'){
          if (Math.abs(dx) < S*.45 && dy > -b.r && dy < S*.45 && b.vy > 0){
            b.vy = -900; i.phase = 0; flashes.push({ x:p.x, y:p.y, t:0 }); Sound.tone(520,.16,'sine',.07,420);
          }
        } else if (i.t === 'fan'){
          const dir = i.flip ? -1 : 1;
          b.vx += dir * 700 * dt; b.vy -= 260 * dt;
          if (Math.random() < .05) Sound.noise(.06, .012, 900);
        } else if (i.t === 'balloon'){
          if (Math.hypot(dx, dy) < S*.45 + b.r) b.vy -= 2300 * dt;
        } else if (i.t === 'bell'){
          if (Math.hypot(dx, dy) < S*.42 + b.r && !i.rung){
            i.rung = .5; flashes.push({ x:p.x, y:p.y, t:0 }); Sound.ding();
          }
        }
        if (i.rung) i.rung = Math.max(0, i.rung - dt);
      }
      if (b.x < b.r){ b.x = b.r; b.vx = Math.abs(b.vx)*.6; }
      if (b.x > a.W-b.r){ b.x = a.W-b.r; b.vx = -Math.abs(b.vx)*.6; }
      if (b.y > a.H + 60) ball = null;
    }
    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0,0,a.W,a.H);
    ctx.fillStyle = '#EFE9DC';
    for (let x = S/2; x < a.W; x += S) for (let y = a.top + S/2; y < a.H - a.bottom; y += S){
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const i of items){
      const p = px(a, i);
      ctx.save(); ctx.translate(p.x, p.y);
      if (i.flip) ctx.scale(-1, 1);
      if (i.t === 'ramp'){
        ctx.fillStyle = '#9A6B3F'; ctx.beginPath();
        ctx.moveTo(-S*.44, S*.36); ctx.lineTo(S*.44, -S*.18);
        ctx.lineTo(S*.44, S*.36); ctx.closePath(); ctx.fill();
      } else if (i.t === 'block'){
        ctx.fillStyle = '#C4522A'; ctx.beginPath(); ctx.roundRect(-S*.42,-S*.42,S*.84,S*.84,8); ctx.fill();
      } else {
        ctx.font = (S*.62) + 'px system-ui';
        ctx.fillText(TOOLS[i.t].icon, 0, i.t === 'spring' ? S*.12 : 0);
      }
      ctx.restore();
    }
    for (const f of flashes){
      const k = 1 - f.t/.4;
      ctx.strokeStyle = `rgba(201,146,42,${k})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, S*.4 + (1-k)*S*.5, 0, 7); ctx.stroke();
    }
    if (ball){
      ctx.fillStyle = '#2A6B8A'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.arc(ball.x-5, ball.y-5, 5, 0, 7); ctx.fill();
    }
  }
});
api.action('\u25B6\uFE0F', 'Go', '', () => go(api));
api.tray(Object.keys(TOOLS).map(k => ({ id:k, icon:TOOLS[k].icon })), id => tool = id, 'ramp');
