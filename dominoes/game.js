import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js';
/* Drag: dominoes drop along your finger at an even spacing. Press GO and the
   first one tips. Falls propagate down the line with a small delay, so the
   ripple is visible. Curves work; gaps stop the chain, which is the lesson. */
let ds = [], last = null, running = false, colour = '#C4522A';
const GAP = 34, HH = 44, HW = 11;
const COLS = ['#C4522A','#2D5A3D','#2A6B8A','#C9922A','#8C5AA8'];

function place(x, y){
  if (last){
    const d = Math.hypot(x-last.x, y-last.y);
    if (d < GAP) return;
    const a = Math.atan2(y-last.y, x-last.x);
    x = last.x + Math.cos(a)*GAP; y = last.y + Math.sin(a)*GAP;
  }
  const prev = last;
  const dom = { x, y, ang: prev ? Math.atan2(y-prev.y, x-prev.x) : 0,
    tilt: 0, falling: false, done: false, col: colour };
  ds.push(dom); last = dom;
  if (ds.length > 220) { ds.shift(); }
  Sound.tone(300 + ds.length*4, .04, 'triangle', .03);
}
function go(){
  if (!ds.length || running) return;
  running = true; ds[0].falling = true; Sound.tap();
}
const api = boot({
  title: 'Domino Builder',
  coach: [{ type:'drag', from:[.18,.62], to:[.82,.44] }],
  tryReal: { id: 97, name: 'Rube Goldberg Machine' },
  onReset(){ ds = []; last = null; running = false; },
  onDown(x, y){
    if (running) return;
    last = null; place(x, y);
  },
  onMove(x, y){ if (!running) place(x, y); },
  onUp(){ last = null; },
  tick(dt, a){
    if (running){
      for (let i = 0; i < ds.length; i++){
        const d = ds[i];
        if (!d.falling || d.done) continue;
        d.tilt = Math.min(1, d.tilt + dt*4.2);
        if (d.tilt > .38 && !d.hit){
          d.hit = true;
          const n = ds[i+1];
          if (n && Math.hypot(n.x-d.x, n.y-d.y) < GAP*1.6) n.falling = true;
          Sound.tone(rand(180, 260), .06, 'triangle', .05, -60);
          Sound.noise(.05, .02, 2600, true);
        }
        if (d.tilt >= 1) d.done = true;
      }
      if (ds.every(d => !d.falling || d.done)) { /* chain finished or stalled */ }
    }
    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0,0,a.W,a.H);
    ctx.strokeStyle = '#EFE9DC'; ctx.lineWidth = 1;
    for (let x = 0; x < a.W; x += 40){ ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.H); ctx.stroke(); }
    for (const d of ds){
      const t = d.tilt, lean = t * 1.35;                 // radians it has fallen
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang);
      ctx.fillStyle = 'rgba(28,26,22,.10)';
      ctx.beginPath(); ctx.ellipse(0, 4, HW*1.4, 5, 0, 0, 7); ctx.fill();
      ctx.rotate(lean);
      ctx.fillStyle = d.col;
      ctx.beginPath(); ctx.roundRect(-HW/2, -HH, HW, HH, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.arc(0, -HH*.72, 2.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -HH*.28, 2.6, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
});
api.action('\u{1F449}', 'Tip it over', '', go);
api.tray(COLS.map((c,i) => ({ id:String(i), svg:`<span style="display:block;width:26px;height:26px;border-radius:6px;background:${c}"></span>` })),
  id => colour = COLS[+id], '0');
