import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=7';
/* Peekaboo House, as a matching game.
   Every animal is hiding behind two doors. Open one, open another, and if
   they match both stay open for good. If they do not, the doors swing shut
   again after a beat that is long enough for a four-year-old to actually look
   at them, and nothing is lost. No timer, no score, no way to be wrong -
   getting it wrong just means the doors close and you try again. */

let doors = [], cols = 3, rows = 4, first = -1, lock = 0, party = 0, bits = [];
const WHO = ['🐶','🐱','🐰','🦊','🐻','🐼','🐸','🦉','🐧','🐮','🐷','🐵','🦋','🐢','🐝','🦆','🐙','🦁'];
const HUES = ['#C4522A','#2D5A3D','#2A6B8A','#C9922A','#8C5AA8','#D96A9A'];
const SHUT = .95;                       // how long a wrong pair stays visible

function build(a){
  const wide = a.W > a.H;
  cols = wide ? 4 : 3; rows = wide ? 3 : 4;          // 12 doors, six pairs, either way
  const pad = 14, top = a.top + 54, bot = a.H - a.bottom - 16;
  const w = (a.W - pad * (cols + 1)) / cols;
  const h = (bot - top - pad * (rows - 1)) / rows;

  const pairs = WHO.slice().sort(() => Math.random() - .5).slice(0, (cols * rows) / 2);
  const deck = pairs.concat(pairs).sort(() => Math.random() - .5);

  doors = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++){
    const i = r * cols + c;
    doors.push({
      x: pad + c * (w + pad), y: top + r * (h + pad), w, h,
      who: deck[i], col: HUES[i % HUES.length],
      open: 0, want: 0, matched: false, glow: 0
    });
  }
  first = -1; lock = 0; party = 0; bits = [];
}

function confetti(a){
  for (let i = 0; i < 70; i++)
    bits.push({ x: rand(0, a.W), y: rand(-a.H * .4, 0), vy: rand(90, 260), vx: rand(-40, 40),
      col: pick(HUES), s: rand(5, 11), rot: rand(0, 6.3), vr: rand(-5, 5) });
}
function sparkle(d){
  for (let i = 0; i < 14; i++){
    const ang = rand(0, 6.3), sp = rand(60, 200);
    bits.push({ x: d.x + d.w / 2, y: d.y + d.h / 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      col: d.col, s: rand(4, 8), rot: rand(0, 6.3), vr: rand(-6, 6), life: .7, age: 0 });
  }
}

const api = boot({
  title: 'Peekaboo House',
  coach: [{ type:'tap', x:.20, y:.22 }, { type:'tap', x:.72, y:.58 }],
  tryReal: { id: 64, name: 'Homemade Periscope' },
  onReset(){ build(api); },
  onResize(a){ build(a); },
  onDown(x, y){
    if (lock > 0) return;                       // a wrong pair is still on show
    for (let i = 0; i < doors.length; i++){
      const d = doors[i];
      if (x < d.x || x > d.x + d.w || y < d.y || y > d.y + d.h) continue;
      if (d.matched || i === first) return;     // already done, or already open
      d.want = 1;
      Sound.tone(520 + Math.random() * 120, .1, 'sine', .05, 180);

      if (first < 0){ first = i; return; }

      const a2 = doors[first];
      if (a2.who === d.who){                    // a pair
        a2.matched = d.matched = true;
        a2.glow = d.glow = 1;
        first = -1;
        sparkle(d); sparkle(a2);
        Sound.ding();
        setTimeout(() => Sound.ding(), 130);
        if (doors.every(k => k.matched) && !party){
          party = 1; confetti(api);
          setTimeout(() => Sound.ding(), 320);
          setTimeout(() => Sound.ding(), 470);
        }
      } else {                                  // not a pair: look, then close
        lock = SHUT;
        Sound.tone(300, .16, 'sine', .045, -70);
      }
      return;
    }
  },
  tick(dt, a){
    if (lock > 0){
      lock -= dt;
      if (lock <= 0){                           // the beat is over, shut them again
        lock = 0;
        for (const d of doors) if (!d.matched) d.want = 0;
        first = -1;
        Sound.tone(260, .12, 'sine', .04, -60);
      }
    }
    for (const d of doors){
      d.open += (d.want - d.open) * Math.min(1, dt * 9);
      if (d.glow) d.glow = Math.max(0, d.glow - dt * .8);
    }
    for (const p of bits){
      p.y += p.vy * dt; p.x += p.vx * dt; p.rot += p.vr * dt;
      if (p.life) { p.age += dt; p.vy += 260 * dt; }
    }
    bits = bits.filter(p => (p.life ? p.age < p.life : p.y < a.H + 40));

    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0, 0, a.W, a.H);
    ctx.fillStyle = '#EDE5D5';
    ctx.beginPath(); ctx.moveTo(6, a.top + 52); ctx.lineTo(a.W / 2, a.top + 6);
    ctx.lineTo(a.W - 6, a.top + 52); ctx.closePath(); ctx.fill();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of doors){
      ctx.fillStyle = d.matched ? '#F7F0DF' : '#F3EDE1';
      ctx.beginPath(); ctx.roundRect(d.x, d.y, d.w, d.h, 10); ctx.fill();
      if (d.glow > 0){
        ctx.strokeStyle = 'rgba(201,146,42,' + d.glow.toFixed(2) + ')';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.roundRect(d.x - 2, d.y - 2, d.w + 4, d.h + 4, 12); ctx.stroke();
      }
      ctx.font = Math.min(d.w, d.h) * .55 + 'px system-ui';
      ctx.fillStyle = '#1C1A16';
      ctx.fillText(d.who, d.x + d.w / 2, d.y + d.h / 2);

      const k = 1 - d.open;                     // the shutter still covering it
      if (k > .01){
        ctx.save();
        ctx.translate(d.x, d.y + d.h / 2);
        ctx.transform(k, 0, 0, 1, 0, 0);        // squash toward the hinge
        ctx.fillStyle = d.col;
        ctx.beginPath(); ctx.roundRect(0, -d.h / 2, d.w, d.h, 10); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.20)';
        ctx.fillRect(8, -d.h / 2 + 8, d.w - 16, 8);
        ctx.restore();
        ctx.fillStyle = 'rgba(250,247,240,.9)';
        ctx.beginPath(); ctx.arc(d.x + d.w * k - 12, d.y + d.h / 2, 5, 0, 7); ctx.fill();
      }
    }
    for (const p of bits){
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = p.life ? Math.max(0, 1 - p.age / p.life) : 1;
      ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.globalAlpha = 1; ctx.restore();
    }
  }
});
build(api);
api.action('\u{1F500}', 'New animals', '', () => { build(api); Sound.whoosh(); });
