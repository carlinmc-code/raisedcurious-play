import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js';
/* Drop chunky things, build a pile, then knock it over. Simple box physics:
   gravity, ground rest, a support test against whatever is below, and a
   wrecking ball for the part every toddler actually wants. */
let boxes = [], ball = null, floorY = 0, kind = 'block';
const KINDS = {
  block:  { icon:'🧱', w:1.0, h:.62, col:'#C4522A' },
  cup:    { icon:'🥤', w:.78, h:.9,  col:'#2A6B8A' },
  animal: { icon:'🐘', w:1.0, h:.86, col:'#8C8278', emoji:'🐘' },
  ball:   { icon:'🏀', w:.8,  h:.8,  col:'#C9922A', round:1 },
  box:    { icon:'📦', w:1.1, h:.72, col:'#9A6B3F' }
};
let U = 60;
function drop(a){
  const k = KINDS[kind];
  boxes.push({ x: rand(a.W*.25, a.W*.75), y: a.top + 40, vx: rand(-20,20), vy: 0,
    w: k.w*U, h: k.h*U, col: k.col, round: k.round, emoji: k.emoji, rot: 0, vr: rand(-.4,.4) });
  if (boxes.length > 40) boxes.shift();
  Sound.tap();
}
function crash(a){
  ball = { x: -80, y: floorY - U*2.4, vx: 760, r: U*.85 };
  Sound.whoosh();
}
const api = boot({
  title: 'Stack & Crash',
  tryReal: { id: 28, name: 'Marshmallow Tower Challenge' },
  onReset(){ boxes = []; ball = null; },
  onResize(a){ U = clamp(a.W/7, 42, 74); floorY = a.H - 110; },
  onDown(x, y){                                   // nudge whatever you touch
    for (let i = boxes.length-1; i >= 0; i--){
      const b = boxes[i];
      if (Math.abs(x-b.x) < b.w*.7 && Math.abs(y-b.y) < b.h*.7){ b.vx += rand(-160,160); b.vy -= 180; Sound.thud(); return; }
    }
    drop(api);
  },
  tick(dt, a){
    for (const b of boxes){
      b.vy += 1700*dt; b.x += b.vx*dt; b.y += b.vy*dt; b.rot += b.vr*dt; b.vx *= .995;
      if (b.x < b.w/2){ b.x = b.w/2; b.vx = Math.abs(b.vx)*.4; }
      if (b.x > a.W-b.w/2){ b.x = a.W-b.w/2; b.vx = -Math.abs(b.vx)*.4; }
      let rest = floorY;
      for (const o of boxes){
        if (o === b || o.y >= b.y) continue;
        if (Math.abs(o.x-b.x) < (o.w+b.w)*.42) rest = Math.min(rest, o.y - o.h/2 - b.h/2);
      }
      if (b.y + b.h/2 > rest){
        if (b.vy > 260) Sound.thud();
        b.y = rest - b.h/2; b.vy = 0; b.vx *= .55; b.vr *= .5;
        if (Math.abs(b.rot) > .05) b.rot *= .82;
      }
    }
    if (ball){
      ball.x += ball.vx*dt;
      for (const b of boxes) if (Math.hypot(b.x-ball.x, b.y-ball.y) < ball.r + b.w*.5){
        b.vx += 620; b.vy -= rand(180, 420); b.vr += rand(-4,4);
      }
      if (ball.x > a.W + 200) ball = null;
    }
    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0,0,a.W,a.H);
    ctx.fillStyle = '#E4DCCB'; ctx.fillRect(0, floorY, a.W, a.H-floorY);
    for (const b of boxes){
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      if (b.emoji){ ctx.font = b.h+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(b.emoji, 0, 0); }
      else if (b.round){ ctx.fillStyle=b.col; ctx.beginPath(); ctx.arc(0,0,b.w/2,0,7); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-b.w*.15,-b.h*.15,b.w*.16,0,7); ctx.fill(); }
      else { ctx.fillStyle=b.col; ctx.beginPath(); ctx.roundRect(-b.w/2,-b.h/2,b.w,b.h,8); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.22)'; ctx.fillRect(-b.w/2+5,-b.h/2+5,b.w-10,6); }
      ctx.restore();
    }
    if (ball){
      ctx.strokeStyle='rgba(28,26,22,.35)'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(ball.x, a.top); ctx.lineTo(ball.x, ball.y); ctx.stroke();
      ctx.fillStyle='#4A4540'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fill();
    }
  }
});
api.action('CRASH IT', '', () => crash(api));
const b2 = api.action('DROP', 'alt', () => drop(api));
b2.style.left='auto'; b2.style.right='14px'; b2.style.transform='none'; b2.style.minWidth='0'; b2.style.padding='20px 22px';
api.tray(Object.keys(KINDS).map(k => ({ id:k, icon:KINDS[k].icon })), id => kind = id, 'block');
