import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=e18d652ba5d1';
import { ANIMALS, FOODS, ALWAYS } from './data.js?v=1';

/* Feed the Farm.
   Pick something out of the tray and tap the field: the food arcs over and
   lands, and whoever fancies it ambles across and eats it. Tap an animal
   instead and it gets a pat and says its piece.

   Nothing can go wrong. An animal offered something it does not love still
   comes and has a nibble; it just does not do its happy thing afterwards.
   When one is peckish it thinks about what it fancies in a little bubble,
   which is the only way a child who cannot read is going to learn that a
   horse wants the apple and a chicken wants the seeds. */

let animals = [], food = [], gifts = [], bits = [], hearts = [];
let picked = 'hay', basket = 0, clock = 0, groundY = 0;
let W = 0, H = 0, U = 60;

/* ---------- voices ---------- */
function say(a){
  if (a.quiet > 0) return;
  a.quiet = 1.1;                       // one animal, one voice at a time
  a.mouth = .5;
  for (const s of a.def.voice)
    setTimeout(() => Sound.tone(s.f, s.d, s.type, s.vol, s.slide), s.at * 1000);
}

/* ---------- the field ---------- */
function layout(a){
  W = a.W; H = a.H;
  U = clamp(Math.min(W / 7.4, (H - a.top - a.bottom) / 8), 34, 74);
  groundY = a.top + (H - a.top - a.bottom) * .34;
  for (const an of animals) an.y = clamp(an.y, groundY + U * .5, H - a.bottom - U * .5);
}
function build(a){
  layout(a);
  const room = Math.max(4, Math.min(ANIMALS.length, Math.floor(W / 78)));
  const list = ANIMALS.slice(0, room);
  animals = list.map((def, i) => ({
    def, emoji: def.emoji,
    x: W * (i + .5) / list.length + rand(-12, 12),
    y: rand(groundY + U * .6, H - a.bottom - U * .6),
    tx: 0, ty: 0, face: 1, mode: 'wander', wait: rand(.5, 3),
    hunger: rand(.15, .75), chew: 0, hop: 0, quiet: 0, mouth: 0,
    bob: rand(0, 6.3), think: 0, wants: null, target: null, trick: 0
  }));
  food = []; gifts = []; bits = []; hearts = []; basket = 0;
}

const likes = (an, kind) => an.def.likes.includes(kind) || ALWAYS.includes(kind);

/* ---------- throwing food ---------- */
function toss(x, y){
  const from = { x: W * .5, y: groundY - U * 1.6 };
  food.push({
    kind: picked, icon: FOODS[picked].icon,
    x: from.x, y: from.y, x0: from.x, y0: from.y,
    x1: clamp(x, U * .6, W - U * .6),
    y1: clamp(y, groundY + U * .4, H - U * .8),
    t: 0, dur: .42, landed: false, eaten: 0, spin: rand(-4, 4)
  });
  if (food.length > 26) food.shift();
  Sound.tone(620, .07, 'sine', .04, 160);
}

/* ---------- animals ---------- */
function think(an){
  if (an.hunger < .45) return null;
  return pick(an.def.likes);
}
function nearestFood(an){
  let best = null, bd = 1e9;
  for (const f of food){
    if (!f.landed || f.eaten) continue;
    const d = Math.hypot(f.x - an.x, f.y - an.y);
    const want = likes(an, f.kind) ? 1 : 2.2;      // will still nibble, just less keen
    if (d * want < bd){ bd = d * want; best = f; }
  }
  return best;
}
function reward(an, loved){
  an.hunger = Math.max(0, an.hunger - (loved ? .6 : .3));
  say(an);
  for (let i = 0; i < (loved ? 7 : 3); i++)
    hearts.push({ x: an.x + rand(-10, 10), y: an.y - U * .5, age: 0,
      e: loved ? '❤️' : '✨', vy: rand(-42, -22) });
  if (!loved) return;

  const d = an.def;
  if (d.gift) gifts.push({ e: d.gift, x: an.x + rand(-14, 14), y: an.y + U * .32,
                           born: 0, bob: rand(0, 6.3) });
  if (d.trick === 'jump'){ an.hop = 1; an.trick = .9; }
  if (d.trick === 'gallop'){ an.mode = 'gallop'; an.trick = 1.4; an.face = an.x < W / 2 ? 1 : -1; }
  if (d.trick === 'mud'){
    an.trick = .8;
    for (let i = 0; i < 14; i++){
      const ang = rand(3.4, 6.0);
      bits.push({ x: an.x, y: an.y + U * .3, vx: Math.cos(ang) * rand(50, 180),
        vy: Math.sin(ang) * rand(60, 200), age: 0, life: rand(.4, .8), col: '#7A5A3C' });
    }
  }
}
function update(dt, a){
  clock += dt;

  for (const f of food){
    if (!f.landed){
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.x = f.x0 + (f.x1 - f.x0) * k;
      f.y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * U * 1.5;
      if (k >= 1){ f.landed = true; f.y = f.y1; Sound.noise(.07, .012, 900); }
    }
    if (f.eaten) f.eaten += dt;
  }
  food = food.filter(f => f.eaten < .3);

  for (const an of animals){
    an.bob += dt * 2.2;
    an.quiet = Math.max(0, an.quiet - dt);
    an.mouth = Math.max(0, an.mouth - dt);
    an.hop = Math.max(0, an.hop - dt * 1.8);
    an.trick = Math.max(0, an.trick - dt);
    an.hunger = Math.min(1, an.hunger + dt * .018);

    // a bubble showing what it fancies, which is the whole teaching bit
    if (an.hunger > .55){
      an.think += dt;
      if (!an.wants || an.think > 4){ an.wants = think(an); an.think = 0; }
    } else { an.wants = null; an.think = 0; }

    if (an.mode === 'gallop'){
      an.x += an.face * an.def.speed * 2.6 * dt;
      if (an.x < U * .5 || an.x > W - U * .5) an.face *= -1;
      if (an.trick <= 0){ an.mode = 'wander'; an.wait = rand(.4, 1.2); }
      continue;
    }
    if (an.mode === 'eat'){
      an.chew -= dt;
      if (an.chew <= 0){
        const f = an.target;
        if (f && !f.eaten){ f.eaten = .01; reward(an, likes(an, f.kind)); }
        an.target = null; an.mode = 'wander'; an.wait = rand(.6, 2);
      }
      continue;
    }

    const f = nearestFood(an);
    if (f && an.hunger > .12){
      an.target = f; an.mode = 'walk';
      an.tx = f.x; an.ty = f.y;
    } else if (an.mode !== 'walk'){
      an.wait -= dt;
      if (an.wait <= 0){
        an.wait = rand(1.6, 4.5);
        an.tx = clamp(an.x + rand(-W * .3, W * .3), U * .6, W - U * .6);
        an.ty = clamp(an.y + rand(-U, U), groundY + U * .5, H - a.bottom - U * .5);
      }
    }
    const dx = an.tx - an.x, dy = an.ty - an.y, d = Math.hypot(dx, dy);
    if (d > 4){
      const sp = an.def.speed * (an.mode === 'walk' ? 1.35 : .55);
      an.x += dx / d * sp * dt;
      an.y += dy / d * sp * dt;
      if (Math.abs(dx) > 2) an.face = dx > 0 ? 1 : -1;
    } else if (an.mode === 'walk'){
      if (an.target && !an.target.eaten){ an.mode = 'eat'; an.chew = 1.1; an.mouth = 1.1; }
      else { an.mode = 'wander'; an.target = null; }
    }
    an.y = clamp(an.y, groundY + U * .45, H - a.bottom - U * .45);
  }

  for (const g of gifts) g.born += dt;
  for (const h of hearts){ h.age += dt; h.y += h.vy * dt; }
  hearts = hearts.filter(h => h.age < 1.1);
  for (const p of bits){ p.age += dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  bits = bits.filter(p => p.age < p.life);
}

/* ---------- drawing ---------- */
function draw(a){
  const ctx = a.ctx;
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#BFE0EF'); sky.addColorStop(1, '#E8F0DC');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, groundY);
  const grass = ctx.createLinearGradient(0, groundY, 0, H);
  grass.addColorStop(0, '#8FBF63'); grass.addColorStop(1, '#6FA24C');
  ctx.fillStyle = grass; ctx.fillRect(0, groundY, W, H - groundY);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = (U * 1.5) + 'px system-ui';
  ctx.fillText('🚜', W * .12, groundY - U * .78);
  ctx.font = (U * 2.1) + 'px system-ui';
  ctx.fillText('🏚️', W * .74, groundY - U * .95);
  ctx.font = (U * .8) + 'px system-ui';
  ctx.fillText('☁️', (W * .3 + clock * 6) % (W + 80) - 40, a.top + U * .5);
  ctx.fillText('☁️', (W * .8 + clock * 4) % (W + 80) - 40, a.top + U * .9);

  // the fence the food is thrown over
  ctx.strokeStyle = '#B99263'; ctx.lineWidth = Math.max(3, U * .09);
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, groundY - U * .26); ctx.lineTo(W, groundY - U * .26); ctx.stroke();
  for (let x = U * .5; x < W; x += U * 1.5){
    ctx.beginPath(); ctx.moveTo(x, groundY - U * .5); ctx.lineTo(x, groundY + U * .12); ctx.stroke();
  }

  for (const f of food){
    const k = f.eaten ? Math.max(0, 1 - f.eaten / .3) : 1;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.landed ? 0 : f.spin * f.t);
    ctx.globalAlpha = k;
    ctx.font = (U * .52 * (f.landed ? 1 : 1.1)) + 'px system-ui';
    ctx.fillText(f.icon, 0, 0);
    ctx.globalAlpha = 1; ctx.restore();
  }

  const order = animals.slice().sort((p, q) => p.y - q.y);
  for (const an of order){
    const s = U * 1.35 * an.def.size;
    const bob = Math.sin(an.bob) * (an.mode === 'walk' ? 3 : 1.4);
    const chew = an.mouth > 0 ? Math.sin(clock * 26) * .05 : 0;
    const lift = an.hop * U * .6;
    ctx.save();
    ctx.translate(an.x, an.y + bob - lift);
    ctx.scale(an.face * (1 + chew), 1 - chew);
    ctx.fillStyle = 'rgba(28,26,22,.14)';
    ctx.beginPath(); ctx.ellipse(0, s * .42, s * .32, s * .09, 0, 0, 7); ctx.fill();
    ctx.font = s + 'px system-ui';
    ctx.fillText(an.emoji, 0, 0);
    ctx.restore();

    if (an.wants && !an.target){                 // a little bubble of what it fancies
      const bx = an.x + s * .38, by = an.y - s * .55 + Math.sin(an.bob * .7) * 2;
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath(); ctx.arc(bx, by, s * .27, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(bx - s * .24, by + s * .21, s * .07, 0, 7); ctx.fill();
      ctx.font = (s * .32) + 'px system-ui';
      ctx.fillText(FOODS[an.wants].icon, bx, by);
    }
  }

  for (const g of gifts){
    const pop = Math.min(1, g.born * 4);
    const y = g.y + Math.sin(clock * 2.2 + g.bob) * 3;
    ctx.save(); ctx.translate(g.x, y);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(0, 0, U * .38 * pop, 0, 7); ctx.fill();
    ctx.font = (U * .56 * pop) + 'px system-ui';
    ctx.fillText(g.e, 0, 0);
    ctx.restore();
  }
  for (const h of hearts){
    const k = 1 - h.age / 1.1;
    ctx.globalAlpha = k;
    ctx.font = (U * .42) + 'px system-ui';
    ctx.fillText(h.e, h.x, h.y);
    ctx.globalAlpha = 1;
  }
  for (const p of bits){
    const k = 1 - p.age / p.life;
    ctx.fillStyle = p.col; ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4 * k + 1, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // the basket of everything collected
  ctx.font = (U * .8) + 'px system-ui';
  ctx.fillText('🧺', W - U * .8, a.top + U * .55);
  ctx.fillStyle = '#1C1A16';
  ctx.font = '800 ' + Math.round(U * .42) + 'px Lato, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText(basket, W - U * 1.35, a.top + U * .6);
  ctx.textAlign = 'center';
}

/* ---------- shell ---------- */
const api = boot({
  title: 'Feed the Farm',
  coach: [{ type:'tap', x:.45, y:.62 }, { type:'tap', x:.65, y:.5 }],
  tryReal: { id: 51, name: 'Homemade Butter' },
  onReset(){ build(api); },
  onResize(a){ layout(a); },
  onDown(x, y){
    for (let i = gifts.length - 1; i >= 0; i--){       // collecting comes first
      const g = gifts[i];
      if (Math.hypot(g.x - x, g.y - y) < U * .55){
        gifts.splice(i, 1); basket++;
        Sound.ding();
        for (let k = 0; k < 8; k++)
          bits.push({ x: g.x, y: g.y, vx: rand(-90, 90), vy: rand(-160, -40),
            age: 0, life: rand(.3, .6), col: '#C9922A' });
        return;
      }
    }
    /* Tapping the animal itself both pats it and puts the food right there.
       A child aiming the hay at the cow taps the cow, and getting a pat and no
       hay for that is the wrong answer to the obvious gesture. */
    for (const an of animals){
      const s = U * 1.35 * an.def.size;
      if (Math.abs(an.x - x) < s * .42 && Math.abs(an.y - y) < s * .42){
        say(an); an.hop = Math.max(an.hop, .7);
        hearts.push({ x: an.x, y: an.y - s * .4, age: 0, e: '❤️', vy: -40 });
        toss(an.x + rand(-U * .5, U * .5), an.y + U * .35);
        return;
      }
    }
    if (y > groundY - U * .4) toss(x, y);
  },
  onMove(x, y){ if (y > groundY && Math.random() < .10) toss(x, y); },
  tick(dt, a){ update(dt, a); draw(a); }
});

build(api);

/* The tray sets what a tap throws. "Feed everyone" borrows that setting for a
   moment to give each animal something it actually likes, then hands it back. */
let trayPick = 'hay';
api.action('\u{1F33E}', 'Feed everyone', '', () => {
  animals.forEach((an, i) => setTimeout(() => {
    picked = pick(an.def.likes);
    toss(an.x + rand(-24, 24), an.y + rand(-10, 20));
  }, i * 130));
  setTimeout(() => { picked = trayPick; }, animals.length * 130 + 40);
});

api.tray(Object.keys(FOODS).map(k => ({ id: k, icon: FOODS[k].icon, name: FOODS[k].name })),
  id => { picked = trayPick = id; }, 'hay');
