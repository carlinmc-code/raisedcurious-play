import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=2';
/* Tap empty space: a bubble. Tap a bubble: it pops. Drag: a stream of them.
   A few carry a small friendly passenger. Nothing else. */
let bubbles = [], bits = [];
const INSIDE = ['🦆','🐟','⭐','🌙','🚗','🐛','🐝','🍎','🐶','🐱'];
function make(x, y, big){
  const r = big ? rand(58, 92) : rand(24, 52);
  bubbles.push({ x, y, r, vx: rand(-14,14), vy: rand(-26,-9), wob: rand(0,6.3),
    hue: rand(170, 320), guest: Math.random() < .18 ? pick(INSIDE) : null, born: 0 });
  if (bubbles.length > 70) bubbles.shift();
  Sound.tone(rand(420, 760), .07, 'sine', .04, 140);
}
function pop(b){
  Sound.pop();
  for (let i = 0; i < 9; i++){
    const a = rand(0, 6.3), s = rand(50, 190);
    bits.push({ x:b.x, y:b.y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:rand(.3,.7), age:0, hue:b.hue });
  }
}
const api = boot({
  title: 'Bubble World',
  coach: [{ type:'tap', x:.42, y:.55 }, { type:'drag', from:[.25,.7], to:[.75,.4] }],
  tryReal: { id: 22, name: 'Bubble Snakes' },
  onReset(){ bubbles = []; bits = []; },
  onDown(x, y){
    for (let i = bubbles.length-1; i >= 0; i--){
      const b = bubbles[i];
      if (Math.hypot(b.x-x, b.y-y) < b.r + 10){ pop(b); bubbles.splice(i,1); return; }
    }
    make(x, y, Math.random() < .15);
  },
  onMove(x, y){ if (Math.random() < .5) make(x, y, false); },
  tick(dt, a){
    for (const b of bubbles){
      b.born += dt; b.wob += dt*1.6;
      b.x += b.vx*dt + Math.sin(b.wob)*10*dt; b.y += b.vy*dt;
      b.vy -= 5*dt;
      if (b.x < b.r){ b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x > a.W-b.r){ b.x = a.W-b.r; b.vx = -Math.abs(b.vx); }
    }
    bubbles = bubbles.filter(b => b.y > -140);
    for (const p of bits){ p.age += dt; p.vy += 240*dt; p.x += p.vx*dt; p.y += p.vy*dt; }
    bits = bits.filter(p => p.age < p.life);
    const ctx = a.ctx;
    const g = ctx.createLinearGradient(0,0,0,a.H);
    g.addColorStop(0,'#E4F1F7'); g.addColorStop(1,'#FAF7F0');
    ctx.fillStyle = g; ctx.fillRect(0,0,a.W,a.H);
    for (const b of bubbles){
      const k = Math.min(1, b.born*4);
      ctx.strokeStyle = `hsla(${b.hue} 70% 62% / .65)`; ctx.lineWidth = 3;
      ctx.fillStyle = `hsla(${b.hue} 80% 88% / .30)`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r*k, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(b.x - b.r*.32, b.y - b.r*.34, b.r*.17, 0, 7); ctx.fill();
      if (b.guest){ ctx.font = (b.r*.9)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(b.guest, b.x, b.y); }
    }
    for (const p of bits){
      const k = 1 - p.age/p.life;
      ctx.fillStyle = `hsla(${p.hue} 80% 70% / ${k})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4*k+1, 0, 7); ctx.fill();
    }
  }
});
api.action('\u{1FAE7}', 'More bubbles', '', () => { for (let i=0;i<14;i++) make(rand(40, api.W-40), api.H-140, Math.random()<.2); });
