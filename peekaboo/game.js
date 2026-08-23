import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js';
/* A house of shutters. Tap one, it swings open and somebody is behind it.
   Tap again and it closes. Open them all and the house celebrates. Object
   permanence, which is the actual developmental thing here. */
let doors = [], cols = 3, rows = 3, party = 0, bits = [];
const WHO = ['🐶','🐱','🐰','🦊','🐻','🐼','🐸','🦉','🐧','🐮','🐷','🐵','🦋','🐢','🐝','🦆'];
const HUES = ['#C4522A','#2D5A3D','#2A6B8A','#C9922A','#8C5AA8','#D96A9A'];

function build(a){
  const wide = a.W > a.H;
  cols = wide ? 4 : 3; rows = wide ? 3 : 4;
  const pad = 14, top = a.top + 60, bot = a.H - a.bottom - 20;
  const w = (a.W - pad*(cols+1)) / cols, h = (bot - top - pad*(rows-1)) / rows;
  doors = [];
  const pool = WHO.slice().sort(() => Math.random() - .5);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++){
    doors.push({ x: pad + c*(w+pad), y: top + r*(h+pad), w, h,
      open: 0, want: 0, who: pool[(r*cols+c) % pool.length], col: HUES[(r*cols+c) % HUES.length] });
  }
  party = 0; bits = [];
}
function confetti(a){
  for (let i = 0; i < 60; i++)
    bits.push({ x: rand(0, a.W), y: rand(-a.H*.4, 0), vy: rand(90, 260), vx: rand(-40,40),
      col: pick(HUES), s: rand(5, 11), rot: rand(0,6.3), vr: rand(-5,5) });
}
const api = boot({
  title: 'Peekaboo House',
  tryReal: { id: 64, name: 'Homemade Periscope' },
  onReset(){ build(api); },
  onResize(a){ build(a); },
  onDown(x, y){
    for (const d of doors) if (x > d.x && x < d.x+d.w && y > d.y && y < d.y+d.h){
      d.want = d.want ? 0 : 1;
      if (d.want){ Sound.ding(); } else { Sound.tone(300, .1, 'sine', .05, -80); }
      if (doors.every(k => k.want) && !party){ party = 1; confetti(api);
        setTimeout(() => Sound.ding(), 160); setTimeout(() => Sound.ding(), 320); }
      if (!doors.every(k => k.want)) party = 0;
      return;
    }
  },
  tick(dt, a){
    for (const d of doors) d.open += (d.want - d.open) * Math.min(1, dt*9);
    for (const p of bits){ p.y += p.vy*dt; p.x += p.vx*dt; p.rot += p.vr*dt; }
    bits = bits.filter(p => p.y < a.H + 40);
    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0,0,a.W,a.H);
    ctx.fillStyle = '#EDE5D5';
    ctx.beginPath(); ctx.moveTo(6, a.top + 58); ctx.lineTo(a.W/2, a.top + 8);
    ctx.lineTo(a.W-6, a.top + 58); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of doors){
      ctx.fillStyle = '#F3EDE1';
      ctx.beginPath(); ctx.roundRect(d.x, d.y, d.w, d.h, 10); ctx.fill();
      ctx.font = Math.min(d.w, d.h)*.55 + 'px system-ui';
      ctx.fillText(d.who, d.x + d.w/2, d.y + d.h/2);
      const k = 1 - d.open;                              // shutter width remaining
      if (k > .01){
        ctx.save();
        ctx.translate(d.x, d.y + d.h/2);
        ctx.transform(k, 0, 0, 1, 0, 0);                 // squash toward the hinge
        ctx.fillStyle = d.col;
        ctx.beginPath(); ctx.roundRect(0, -d.h/2, d.w, d.h, 10); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.20)';
        ctx.fillRect(8, -d.h/2 + 8, d.w - 16, 8);
        ctx.restore();
        ctx.fillStyle = 'rgba(250,247,240,.9)';
        ctx.beginPath(); ctx.arc(d.x + d.w*k - 12, d.y + d.h/2, 5, 0, 7); ctx.fill();
      }
    }
    for (const p of bits){
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.col; ctx.fillRect(-p.s/2, -p.s/4, p.s, p.s/2); ctx.restore();
    }
  }
});
build(api);
api.action('SHUFFLE', '', () => { build(api); Sound.whoosh(); });
