import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=e18d652ba5d1';
import { SPECIES, HABITATS } from './data.js?v=1';

/* Frog World.
   One pond, one tree, one frog, followed from egg to adult. The world is
   taller than the screen so there is somewhere to climb to, and the camera
   follows whatever the child is currently in charge of.

   Nothing here can be failed. Growth happens on its own; the GROW button just
   lets an impatient two-year-old watch metamorphosis again immediately.
   Everything the child taps answers, whether or not they understand what a
   tadpole is. */

const SP = SPECIES['green-tree-frog'];
const HB = HABITATS[SP.habitat];
const STAGES = ['egg', 'tadpole', 'tadpole_legs', 'froglet', 'adult'];
const STAGE_SECONDS = { egg: 999, tadpole: 26, tadpole_legs: 22, froglet: 20, adult: 999 };

let W = 0, H = 0, worldH = 0, waterY = 0, bankX = 0, trunkX = 0, groundY = 0;
let cam = 0, camTo = 0;
let stage = 'egg', grow = 0, eggTaps = 0, clock = 0, ambT = 4;
let eggs = [], tadpoles = [], bugs = [], drops = [], ripples = [], motes = [], leaves = [], pads = [], reeds = [], branches = [];
let rain = 0, night = false, dayk = 0, frog = null, hatched = false;
let onStage = () => {};          // set once the buttons exist

/* ---------- world ---------- */
function build(a){
  W = a.W; H = a.H;
  worldH = H * HB.worldTall;
  waterY = worldH * HB.waterTop;
  groundY = waterY - 6;
  bankX = W * HB.bankX;
  trunkX = W * HB.trunkX;

  branches = HB.branches.map((f, i) => ({
    y: worldH * f, dir: i % 2 ? -1 : 1, len: W * (.26 + .06 * (i % 2)), sway: rand(0, 6.3)
  }));
  leaves = [];
  for (const b of branches){
    const n = 3;
    for (let i = 0; i < n; i++){
      const t = (i + 1) / (n + 1);
      leaves.push({ x: trunkX + b.dir * b.len * t, y: b.y - 6 - rand(0, 16),
        r: W * rand(.075, .10), sway: rand(0, 6.3), bend: 0, dew: 1, br: b });
    }
  }
  pads = HB.lilies.map(f => ({ x: W * f, y: waterY, r: W * rand(.085, .115), sway: rand(0, 6.3) }));
  reeds = HB.reeds.map(f => ({ x: W * f, h: rand(90, 190), sway: rand(0, 6.3) }));
  restart(true);
}

function restart(fresh){
  stage = 'egg'; grow = 0; eggTaps = 0; hatched = false;
  tadpoles = []; frog = null;
  eggs = [];
  const ex = W * .30, ey = waterY + 26;                 // this species lays in the water
  for (let i = 0; i < 14; i++){
    const ang = rand(0, 6.3), rr = rand(0, W * .085);
    eggs.push({ x: ex + Math.cos(ang) * rr, y: ey + Math.sin(ang) * rr * .5,
      r: W * rand(.017, .024), wob: rand(0, 6.3), pop: 0 });
  }
  if (fresh){ bugs = []; drops = []; ripples = []; motes = []; }
  for (let i = 0; i < 4; i++) spawnBug();
  camTo = clamp(ey - H * .55, 0, worldH - H);
  cam = camTo;
  onStage();
}

/* ---------- creatures ---------- */
function mkTadpole(x, y, mine){
  return { x, y, vx: rand(-14, 14), vy: rand(-8, 8), tx: x, ty: y, wig: rand(0, 6.3),
    size: W * .016, mine: !!mine, blink: rand(2, 6) };
}
function hatch(){
  if (hatched) return;
  hatched = true;
  const n = 7;
  for (let i = 0; i < n; i++){
    const e = eggs[i % eggs.length];
    tadpoles.push(mkTadpole(e.x + rand(-8, 8), e.y + rand(-6, 6), i === 0));
  }
  eggs.forEach(e => e.pop = 1);
  stage = 'tadpole'; grow = 0;
  frog = tadpoles[0];
  Sound.tone(300, .18, 'sine', .05, 260);
  plop(frog.x, frog.y);
  onStage();
}
function spawnBug(){
  const nightBug = night;
  const kind = nightBug ? pick(HB.nightInsects) : pick(HB.dayInsects.concat(HB.insects));
  const high = Math.random() < .55;
  bugs.push({
    kind,
    x: rand(W * .1, W * .95),
    y: high ? rand(worldH * .10, worldH * .58) : rand(waterY - 210, waterY - 20),
    ph: rand(0, 6.3), sp: rand(.5, 1.3), amp: rand(14, 40), base: 0, gone: 0
  });
  bugs[bugs.length - 1].base = bugs[bugs.length - 1].y;
  if (bugs.length > 9) bugs.shift();
}

/* ---------- little effects ---------- */
function ripple(x, y){ ripples.push({ x, y, r: 4, a: 1 }); }
function plop(x, y){ ripple(x, y); Sound.tone(rand(420, 620), .07, 'sine', .04, -200); }
function croak(){
  const c = SP.call;
  for (let i = 0; i < c.pulses; i++)
    setTimeout(() => Sound.tone(c.freq + rand(-c.spread, c.spread), c.len, c.buzz, .045, -90), i * c.gap * 1000);
  if (frog && frog.adult) frog.sac = 1;
}

/* ---------- the frog ---------- */
function becomeFrog(){
  const t = frog || { x: W * .3, y: waterY + 20 };
  frog = { x: t.x, y: t.y, vx: 0, vy: 0, mode: 'swim', tail: 1, legs: 1, adult: false,
    face: 1, blink: rand(2, 5), breathe: rand(0, 6.3), sac: 0, tongue: 0, target: null,
    onLeaf: null, hidden: false, hop: null, sit: 0 };
}
function stageUp(){
  const i = STAGES.indexOf(stage);
  if (i < STAGES.length - 1){
    stage = STAGES[i + 1]; grow = 0;
    if (stage === 'froglet'){
      const t = tadpoles.indexOf(frog);
      if (t >= 0) tadpoles.splice(t, 1);   // it stops being one of the shoal
      becomeFrog();
      frog.tail = 1;
    }
    if (stage === 'adult'){
      if (!frog || !frog.mode) becomeFrog();
      frog.adult = true; frog.tail = 0; croak();
    }
    Sound.ding();
  } else {
    restart(false);                                     // adult -> a new clutch of eggs
    Sound.whoosh();
  }
  onStage();
}
const inWater = (x, y) => y > waterY && x < bankX + 30;
const onTrunk = x => Math.abs(x - trunkX) < W * .075;

function frogSize(){ return W * (stage === 'adult' ? .052 : stage === 'froglet' ? .040 : .030) * SP.size; }

function sendFrog(x, y){
  if (!frog || !frog.mode) return;
  frog.hidden = false;
  const R = frogSize();
  const leaf = leaves.find(l => Math.hypot(l.x - x, l.y - y) < l.r);
  const wantsUp = (onTrunk(x) && y < waterY - 20) || leaf;
  if (wantsUp && SP.climbing > .4){
    const goal = leaf ? { x: leaf.x, y: leaf.y - 4 } : { x: trunkX, y: clamp(y, 40, waterY - 30) };
    if (frog.y > waterY - R){
      // it is in the pond: hop out to the foot of the tree first, then climb
      frog.after = { mode: 'climb', target: goal, leaf: leaf || null };
      startHop(trunkX, waterY - R * 1.3);
    } else {
      frog.mode = 'climb'; frog.target = goal; frog.wantLeaf = leaf || null;
    }
    return;
  }
  const pad = pads.find(p => Math.abs(p.x - x) < p.r && Math.abs(p.y - y) < 40);
  if (pad){ startHop(pad.x, pad.y - 4); return; }
  if (inWater(x, y)){
    if (frog.mode === 'climb' || frog.y < waterY - R) startHop(x, Math.max(y, waterY + 10));
    else { frog.mode = 'swim'; frog.target = { x: clamp(x, R, bankX), y: clamp(y, waterY + 8, worldH - 20) }; }
    return;
  }
  startHop(clamp(x, R, W - R), Math.min(y, groundY - R));
}
function startHop(tx, ty){
  frog.mode = 'hop'; frog.wantLeaf = null; frog.onLeaf = null;
  frog.hop = { x0: frog.x, y0: frog.y, x1: tx, y1: ty, t: 0,
    dur: .30 + Math.hypot(tx - frog.x, ty - frog.y) / (W * 2.2), crouch: .12 };
  frog.face = tx >= frog.x ? 1 : -1;
}
function tongueAt(b){
  if (!frog || !frog.mode || frog.tongue) return false;
  const R = frogSize();
  if (Math.hypot(b.x - frog.x, b.y - frog.y) > R * 7) return false;
  frog.face = b.x >= frog.x ? 1 : -1;
  frog.tongue = .01; frog.tongueTo = b; b.gone = .01;
  Sound.tone(880, .06, 'sine', .05, -420);
  return true;
}

/* ---------- update ---------- */
function update(dt, a){
  clock += dt;
  dayk += ((night ? 1 : 0) - dayk) * Math.min(1, dt * .9);   // gentle day/night fade

  // growth: on its own, so nobody has to know the GROW button exists
  if (stage !== 'egg' && stage !== 'adult'){
    grow += dt / STAGE_SECONDS[stage];
    if (grow >= 1) stageUp();
  }
  if (stage === 'egg'){
    grow += dt / 14;
    for (const e of eggs) e.wob += dt * 2;
    if (grow >= 1) hatch();
  }

  // ambience: occasional, never a drone
  ambT -= dt;
  if (ambT <= 0){
    ambT = rand(3.4, 8);
    if (settings.ambience && settings.sound){
      if (night) Sound.tone(rand(1500, 2100), .05, 'sine', .012, 200);   // cricket
      else if (Math.random() < .5) Sound.tone(rand(900, 1400), .12, 'sine', .012, 240); // bird
      else Sound.noise(.16, .008, 700);                                   // water
    }
  }

  for (const t of tadpoles) updTadpole(t, dt);
  if (frog && frog.mode) updFrog(dt);

  // insects
  for (const b of bugs){
    b.ph += dt * b.sp;
    b.x += Math.cos(b.ph * .7) * (18 + rain * 6) * dt;
    b.y = b.base + Math.sin(b.ph) * b.amp;
    if (b.x < W * .04) b.x = W * .04; if (b.x > W * .97) b.x = W * .97;
    if (b.gone){ b.gone += dt; }
  }
  bugs = bugs.filter(b => b.gone < .18);
  if (bugs.length < (rain ? 7 : 5) && Math.random() < dt * 1.4) spawnBug();

  // rain
  if (rain){
    const want = rain * 26;
    for (let i = 0; i < want * dt * 8; i++)
      drops.push({ x: rand(0, W), y: cam - 10, v: rand(700, 1100), len: rand(9, 20) });
  }
  for (const d of drops){
    d.y += d.v * dt;
    const s = d.x < bankX ? waterY : (onTrunk(d.x) || d.x > bankX ? groundY : waterY);
    if (d.y > s){ d.dead = 1; if (Math.random() < .10) ripple(d.x, s + 2); }
  }
  drops = drops.filter(d => !d.dead && d.y < worldH);

  for (const r of ripples){ r.r += 70 * dt; r.a -= dt * 1.1; }
  ripples = ripples.filter(r => r.a > 0);

  for (const l of leaves){
    l.sway += dt * .8;
    l.bend += (0 - l.bend) * Math.min(1, dt * 3);
  }
  for (const p of pads) p.sway += dt * .5;
  for (const r of reeds) r.sway += dt * .7;

  // fireflies / motes
  if (night && motes.length < 22 && Math.random() < dt * 9)
    motes.push({ x: rand(0, W), y: rand(worldH * .1, waterY - 20), ph: rand(0, 6.3), sp: rand(.6, 1.5) });
  if (!night && motes.length && Math.random() < dt * 3) motes.pop();
  for (const m of motes){
    m.ph += dt * m.sp;
    m.x += Math.cos(m.ph * .8) * 14 * dt; m.y += Math.sin(m.ph) * 12 * dt;
  }

  // camera follows whoever the child is in charge of
  const foc = (frog && frog.mode) ? frog : (frog || tadpoles[0] || { y: waterY });
  camTo = clamp(foc.y - H * .55, 0, Math.max(0, worldH - H));
  cam += (camTo - cam) * Math.min(1, dt * 2.4);
}

function updTadpole(t, dt){
  t.wig += dt * (t.mine ? 9 : 7);
  const dx = t.tx - t.x, dy = t.ty - t.y, d = Math.hypot(dx, dy);
  if (d > 4){
    const sp = W * (t.mine ? .42 : .26) * (1 + grow * .5);
    t.vx += (dx / d * sp - t.vx) * Math.min(1, dt * 6);
    t.vy += (dy / d * sp - t.vy) * Math.min(1, dt * 6);
  } else if (Math.random() < dt * .8){
    t.tx = clamp(t.x + rand(-90, 90), 20, bankX - 10);
    t.ty = clamp(t.y + rand(-60, 60), waterY + 14, worldH - 30);
  }
  t.x += t.vx * dt; t.y += t.vy * dt;
  t.x = clamp(t.x, 14, bankX);
  t.y = clamp(t.y, waterY + 10, worldH - 16);
}

function updFrog(dt){
  const f = frog, R = frogSize();
  f.breathe += dt * 1.7;
  f.blink -= dt; if (f.blink < 0) f.blink = rand(2.4, 6);
  if (f.sac) f.sac = Math.max(0, f.sac - dt * 1.1);
  if (stage === 'froglet') f.tail = Math.max(0, 1 - grow);
  if (stage === 'adult') f.tail = 0;

  if (f.tongue){
    f.tongue += dt * 7;
    if (f.tongueTo && f.tongue > 1 && !f.ate){ f.ate = 1; f.tongueTo.gone = .01; Sound.pop(); }
    if (f.tongue > 2){ f.tongue = 0; f.ate = 0; f.tongueTo = null; }
  }

  if (f.mode === 'hop' && f.hop){
    const h = f.hop;
    h.t += dt;
    if (h.t < h.crouch){ f.sit = 1; }
    else {
      f.sit = 0;
      const k = clamp((h.t - h.crouch) / h.dur, 0, 1);
      f.x = h.x0 + (h.x1 - h.x0) * k;
      const arc = Math.sin(k * Math.PI) * (Math.hypot(h.x1 - h.x0, h.y1 - h.y0) * .32 + 26) * SP.jump;
      f.y = h.y0 + (h.y1 - h.y0) * k - arc;
      if (k >= 1){
        f.x = h.x1; f.y = h.y1; f.hop = null;
        if (f.after){                                  // the hop was only to get there
          f.mode = f.after.mode; f.target = f.after.target;
          f.wantLeaf = f.after.leaf; f.after = null;
          Sound.tone(180, .07, 'sine', .04, -50);
          return;
        }
        if (inWater(f.x, f.y)){ f.mode = 'swim'; f.target = null; plop(f.x, waterY); }
        else { f.mode = 'idle'; Sound.tone(180, .07, 'sine', .04, -50); }
        const pad = pads.find(p => Math.abs(p.x - f.x) < p.r && Math.abs(p.y - (waterY - 4)) < 30);
        if (pad){ f.onLeaf = pad; f.mode = 'idle'; ripple(pad.x, waterY); }
      }
    }
    return;
  }
  if (f.mode === 'swim'){
    const tgt = f.target || { x: f.x, y: clamp(f.y, waterY + 12, worldH - 30) };
    const dx = tgt.x - f.x, dy = tgt.y - f.y, d = Math.hypot(dx, dy);
    const sp = W * .42 * (.5 + SP.swimming);
    if (d > 3){
      f.vx += (dx / d * sp - f.vx) * Math.min(1, dt * 3);
      f.vy += (dy / d * sp - f.vy) * Math.min(1, dt * 3);
      f.face = dx >= 0 ? 1 : -1;
      if (Math.random() < dt * 2) ripple(f.x, waterY);
    } else { f.vx *= .9; f.vy *= .9; }
    f.x = clamp(f.x + f.vx * dt, R, bankX);
    f.y = clamp(f.y + f.vy * dt, waterY + 8, worldH - 20);
    return;
  }
  if (f.mode === 'climb'){
    const tgt = f.target || { x: f.x, y: f.y };
    const dx = tgt.x - f.x, dy = tgt.y - f.y, d = Math.hypot(dx, dy);
    if (d > 2){
      const sp = W * .70 * SP.climbing;
      f.x += dx / d * sp * dt; f.y += dy / d * sp * dt;
      f.face = dx >= 0 ? 1 : -1;
      f.step = (f.step || 0) + dt * 7;
    } else if (f.wantLeaf){ f.onLeaf = f.wantLeaf; f.wantLeaf = null; f.mode = 'idle'; }
    return;
  }
  // idle: breathe, and drift a little if sitting on water
  if (f.onLeaf && f.onLeaf.r && f.onLeaf.sway !== undefined && pads.includes(f.onLeaf)){
    f.x = f.onLeaf.x + Math.sin(f.onLeaf.sway) * 3;
    f.y = waterY - 6;
  }
}

/* ---------- drawing ---------- */
const sky = (t, top) => {
  // t: 0 day .. 1 night
  const day = top ? [166, 214, 235] : [198, 226, 214];
  const nite = top ? [24, 34, 62] : [30, 46, 62];
  const c = day.map((v, i) => Math.round(v + (nite[i] - v) * t));
  return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
};
function draw(a){
  const ctx = a.ctx, y0 = -cam;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sky(dayk, true));
  g.addColorStop(1, sky(dayk, false));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // moon or sun
  const orbY = y0 + worldH * .06;
  if (orbY > -80 && orbY < H + 80){
    ctx.globalAlpha = .85;
    ctx.fillStyle = dayk > .5 ? '#F2EFD8' : '#FCEFA8';
    ctx.beginPath(); ctx.arc(W * .78, orbY, W * .055, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // distant trees
  ctx.fillStyle = dayk > .5 ? '#22412F' : '#7FA86B';
  for (let i = 0; i < 6; i++){
    const bx = W * (.05 + i * .17), bh = W * (.18 + (i % 3) * .05);
    const by = y0 + waterY;
    ctx.beginPath(); ctx.moveTo(bx - bh * .5, by); ctx.lineTo(bx, by - bh);
    ctx.lineTo(bx + bh * .5, by); ctx.closePath(); ctx.fill();
  }

  drawTrunk(ctx, y0);

  // bank
  ctx.fillStyle = dayk > .5 ? '#3A3A2C' : '#6E6A46';
  ctx.beginPath();
  ctx.moveTo(bankX - 40, y0 + waterY + 4);
  ctx.quadraticCurveTo(bankX + 30, y0 + waterY - 16, W, y0 + waterY - 10);
  ctx.lineTo(W, y0 + worldH); ctx.lineTo(bankX - 40, y0 + worldH);
  ctx.closePath(); ctx.fill();

  // water
  const wg = ctx.createLinearGradient(0, y0 + waterY, 0, y0 + worldH);
  wg.addColorStop(0, dayk > .5 ? 'rgba(38,74,92,.92)' : 'rgba(86,158,168,.88)');
  wg.addColorStop(1, dayk > .5 ? 'rgba(14,34,48,.98)' : 'rgba(40,96,110,.96)');
  ctx.fillStyle = wg;
  ctx.fillRect(0, y0 + waterY, bankX + 40, worldH - waterY);

  for (const r of reeds){
    const bx = r.x, by = y0 + waterY;
    ctx.strokeStyle = dayk > .5 ? '#2F4A32' : '#4E7A3C';
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + Math.sin(r.sway) * 12, by - r.h * .6, bx + Math.sin(r.sway) * 22, by - r.h);
    ctx.stroke();
  }

  for (const p of pads){
    const py = y0 + p.y - 3 + Math.sin(p.sway) * 2;
    ctx.fillStyle = dayk > .5 ? '#2E5A3B' : '#4C8A46';
    ctx.beginPath(); ctx.ellipse(p.x, py, p.r, p.r * .34, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(250,247,240,.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, py); ctx.lineTo(p.x + p.r * .8, py - p.r * .12); ctx.stroke();
  }

  for (const r of ripples){
    ctx.strokeStyle = 'rgba(250,247,240,' + (r.a * .5).toFixed(3) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(r.x, y0 + r.y, r.r, r.r * .32, 0, 0, 7); ctx.stroke();
  }

  for (const e of eggs) drawEgg(ctx, e, y0);
  for (const t of tadpoles) drawTadpole(ctx, t, y0);
  for (const b of bugs) drawBug(ctx, b, y0);
  if (frog && frog.mode) drawFrog(ctx, y0);

  for (const m of motes){
    const k = (Math.sin(m.ph * 2) + 1) / 2;
    ctx.fillStyle = 'rgba(240,224,120,' + (k * .85 * dayk).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(m.x, y0 + m.y, 3.2, 0, 7); ctx.fill();
  }
  if (rain){
    ctx.strokeStyle = 'rgba(200,225,240,' + (.30 + rain * .18).toFixed(2) + ')';
    ctx.lineWidth = 1.6;
    for (const d of drops){
      const dy = y0 + d.y;
      if (dy < -20 || dy > H + 20) continue;
      ctx.beginPath(); ctx.moveTo(d.x, dy); ctx.lineTo(d.x - 2, dy + d.len); ctx.stroke();
    }
  }
}
function drawTrunk(ctx, y0){
  const w = W * .075;
  ctx.fillStyle = dayk > .5 ? '#3B2F26' : '#7A5A3C';
  ctx.fillRect(trunkX - w, y0, w * 2, waterY - 6 - 0);
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.fillRect(trunkX - w, y0, w * .5, waterY - 6);
  for (const b of branches){
    const by = y0 + b.y;
    ctx.strokeStyle = dayk > .5 ? '#3B2F26' : '#7A5A3C';
    ctx.lineWidth = W * .028; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(trunkX, by); ctx.lineTo(trunkX + b.dir * b.len, by + 6); ctx.stroke();
  }
  for (const l of leaves){
    const ly = y0 + l.y + l.bend * 10;
    ctx.save(); ctx.translate(l.x, ly); ctx.rotate(Math.sin(l.sway) * .06 + l.bend * .18);
    const lg = ctx.createLinearGradient(0, -l.r * .4, 0, l.r * .4);
    lg.addColorStop(0, dayk > .5 ? '#2C5138' : '#6FA84C');
    lg.addColorStop(1, dayk > .5 ? '#1E3B29' : '#4E7F36');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(0, 0, l.r, l.r * .40, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(250,247,240,.22)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-l.r * .85, 0); ctx.lineTo(l.r * .85, 0); ctx.stroke();
    ctx.restore();
  }
}
function drawEgg(ctx, e, y0){
  if (e.pop >= 1) return;
  const wob = Math.sin(e.wob) * 1.6;
  ctx.fillStyle = SP.egg;
  ctx.beginPath(); ctx.arc(e.x + wob, y0 + e.y, e.r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(30,36,26,.85)';
  ctx.beginPath(); ctx.arc(e.x + wob * 1.6, y0 + e.y + Math.cos(e.wob) * 1.2, e.r * .38, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.30)';
  ctx.beginPath(); ctx.arc(e.x + wob - e.r * .3, y0 + e.y - e.r * .3, e.r * .22, 0, 7); ctx.fill();
}
function drawTadpole(ctx, t, y0){
  const s = t.size * (1 + grow * (stage === 'tadpole' ? .5 : .8));
  const dir = t.vx >= 0 ? 1 : -1;
  ctx.save(); ctx.translate(t.x, y0 + t.y); ctx.scale(dir, 1);
  ctx.fillStyle = SP.tadpole;
  ctx.beginPath();
  ctx.moveTo(s * .9, 0);
  ctx.quadraticCurveTo(-s * .4, -s * .85, -s * 1.2 + Math.sin(t.wig) * s * .3, -s * .18);
  ctx.quadraticCurveTo(-s * 2.4, Math.sin(t.wig) * s * .9, -s * 3.1, Math.sin(t.wig + .5) * s * .5);
  ctx.quadraticCurveTo(-s * 2.2, Math.sin(t.wig) * s * .2, -s * 1.2 + Math.sin(t.wig) * s * .3, s * .18);
  ctx.quadraticCurveTo(-s * .4, s * .85, s * .9, 0);
  ctx.fill();
  if (stage === 'tadpole_legs' || stage === 'froglet'){
    ctx.strokeStyle = SP.tadpole; ctx.lineWidth = Math.max(2, s * .22); ctx.lineCap = 'round';
    const kick = Math.sin(t.wig) * .5;
    for (const sgn of [-1, 1]){
      ctx.beginPath();
      ctx.moveTo(-s * .9, sgn * s * .4);
      ctx.lineTo(-s * 1.5, sgn * (s * .9 + kick * s));
      ctx.stroke();
    }
    if (grow > .5){
      for (const sgn of [-1, 1]){
        ctx.beginPath();
        ctx.moveTo(s * .2, sgn * s * .5);
        ctx.lineTo(s * .5, sgn * (s * .9));
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = '#FAF7F0';
  ctx.beginPath(); ctx.arc(s * .45, -s * .22, s * .17, 0, 7); ctx.fill();
  ctx.fillStyle = '#1C1A16';
  ctx.beginPath(); ctx.arc(s * .48, -s * .22, s * .09, 0, 7); ctx.fill();
  ctx.restore();
}
function drawBug(ctx, b, y0){
  const y = y0 + b.y;
  if (y < -30 || y > H + 30) return;
  const k = b.gone ? Math.max(0, 1 - b.gone / .18) : 1;
  ctx.save(); ctx.globalAlpha = k; ctx.translate(b.x, y);
  const wing = Math.sin(b.ph * 14) * .5 + .5;
  if (b.kind === 'firefly'){
    ctx.fillStyle = 'rgba(240,224,120,.95)';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = b.kind === 'butterfly' ? '#D98E3C' : b.kind === 'dragonfly' ? '#2A6B8A' : '#4A4540';
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(250,247,240,.55)';
    ctx.beginPath(); ctx.ellipse(-1, -3 - wing * 2, 6, 2.4, -.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-1, 3 + wing * 2, 6, 2.4, .5, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
}
function drawFrog(ctx, y0){
  const f = frog, R = frogSize(), y = y0 + f.y;
  if (f.hidden){
    ctx.globalAlpha = .35;
  }
  ctx.save(); ctx.translate(f.x, y); ctx.scale(f.face, 1);
  const squat = f.sit ? .78 : 1;
  const br = 1 + Math.sin(f.breathe) * .03;

  // tail, while there still is one
  if (f.tail > .02){
    ctx.fillStyle = SP.dark;
    ctx.beginPath();
    ctx.moveTo(-R * .7, -R * .2);
    ctx.quadraticCurveTo(-R * (1.2 + f.tail), 0, -R * (.8 + f.tail * 1.6), R * .1);
    ctx.quadraticCurveTo(-R * 1.1, R * .1, -R * .7, R * .2);
    ctx.fill();
  }
  // back legs
  ctx.strokeStyle = SP.dark; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = R * .30;
  const kick = f.mode === 'swim' ? Math.sin(clock * 9) * .5 : (f.mode === 'climb' ? Math.sin(f.step || 0) * .35 : 0);
  for (const sgn of [1, -1]){
    ctx.beginPath();
    ctx.moveTo(-R * .35, sgn * R * .30);
    ctx.lineTo(-R * (.85 + kick * .4), sgn * R * (.55 + Math.abs(kick) * .3));
    ctx.lineTo(-R * (.35 - kick * .5), sgn * R * (.95 + Math.abs(kick) * .3));
    ctx.stroke();
  }
  // front legs
  ctx.lineWidth = R * .22;
  for (const sgn of [1, -1]){
    ctx.beginPath();
    ctx.moveTo(R * .40, sgn * R * .22);
    ctx.lineTo(R * .70, sgn * R * .62);
    ctx.stroke();
    if (SP.toePads){
      ctx.fillStyle = SP.belly;
      ctx.beginPath(); ctx.arc(R * .72, sgn * R * .66, R * .13, 0, 7); ctx.fill();
    }
  }
  // body
  const bg = ctx.createLinearGradient(0, -R * .8, 0, R * .7);
  bg.addColorStop(0, SP.skin); bg.addColorStop(1, SP.dark);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, 0, R * .95, R * .62 * squat * br, 0, 0, 7); ctx.fill();
  ctx.fillStyle = SP.stripe;
  ctx.beginPath(); ctx.ellipse(R * .05, R * .34 * squat, R * .78, R * .16, 0, 0, 7); ctx.fill();
  // head + eye
  ctx.fillStyle = SP.skin;
  ctx.beginPath(); ctx.ellipse(R * .62, -R * .18, R * .44, R * .38 * br, 0, 0, 7); ctx.fill();
  const shut = f.blink < .12;
  ctx.fillStyle = shut ? SP.dark : SP.eye;
  ctx.beginPath(); ctx.arc(R * .78, -R * .40, R * .21, 0, 7); ctx.fill();
  if (!shut){
    ctx.fillStyle = '#1C1A16';
    ctx.beginPath(); ctx.ellipse(R * .80, -R * .40, R * .07, R * .16, 0, 0, 7); ctx.fill();
  }
  // vocal sac
  if (f.sac > 0){
    ctx.fillStyle = SP.belly;
    ctx.beginPath(); ctx.arc(R * .58, R * .40, R * (.18 + f.sac * .34), 0, 7); ctx.fill();
  }
  // tongue
  if (f.tongue && f.tongueTo){
    const t = Math.min(1, f.tongue), out = t < 1 ? t : 2 - Math.min(2, f.tongue);
    const tx = (f.tongueTo.x - f.x) * f.face, ty = f.tongueTo.y - f.y;
    ctx.strokeStyle = '#D9607A'; ctx.lineWidth = R * .14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(R * .9, -R * .05);
    ctx.lineTo(R * .9 + tx * out, -R * .05 + ty * out);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---------- shell ---------- */
const api = boot({
  title: 'Frog World',
  coach: [{ type: 'tap', x: .30, y: .62 }, { type: 'tap', x: .30, y: .62 }],
  tryReal: { id: 122, name: 'Microscope Pond Life Survey' },
  settingsRows: [{ key: 'ambience', label: 'Nature sounds', def: true }],
  onReset(){ build(api); },
  onResize(a){ build(a); },
  onDown(x, y){
    const wy = y + cam;
    /* A bug wins the tap only when there is a frog that can actually shoot at
       it. Before that there is nothing to eat with, so an insect drifting over
       the eggs was quietly swallowing taps and doing nothing with them. */
    if (frog && frog.mode && !frog.tongue){
      for (const b of bugs){
        if (!b.gone && Math.hypot(b.x - x, b.y - wy) < 34){
          if (tongueAt(b)) return;
          b.base += rand(-30, 30); return;
        }
      }
    }
    if (stage === 'egg'){
      let hit = false;
      for (const e of eggs) if (Math.hypot(e.x - x, e.y - wy) < e.r * 3.4){ e.wob += 1.6; hit = true; }
      if (hit){
        eggTaps++; grow += .16;
        Sound.tone(rand(300, 420), .07, 'sine', .04, 90);
        ripple(x, wy);
        if (eggTaps >= 5) hatch();
        return;
      }
    }
    const leaf = leaves.find(l => Math.hypot(l.x - x, l.y - wy) < l.r);
    if (leaf){ leaf.bend = 1; if (leaf.dew){ leaf.dew = 0; ripple(leaf.x, waterY); } Sound.noise(.06, .01, 2200, true); }
    if (frog && frog.mode) sendFrog(x, wy);
    else for (const t of tadpoles){
      t.tx = clamp(x + rand(-18, 18), 20, bankX - 10);
      t.ty = clamp(wy + rand(-14, 14), waterY + 14, worldH - 30);
      const dx = t.tx - t.x, dy = t.ty - t.y, d = Math.hypot(dx, dy) || 1;
      const kick = W * (t.mine ? .34 : .20);        // answer the tap on this frame
      t.vx = dx / d * kick; t.vy = dy / d * kick;
    }
    if (wy > waterY && x < bankX) ripple(x, Math.max(wy, waterY + 4));
  },
  onMove(x, y){
    const wy = y + cam;
    if (frog && frog.mode && frog.mode === 'swim'){ frog.target = { x, y: Math.max(wy, waterY + 8) }; return; }
    if (!frog || !frog.mode) for (const t of tadpoles) if (t.mine){ t.tx = x; t.ty = Math.max(wy, waterY + 12); }
  },
  tick(dt, a){ update(dt, a); draw(a); }
});

build(api);

/* the one big button: whatever the world is ready for next */
const go = api.action('\u{1F423}', 'Hatch', '', () => {
  if (stage === 'egg') hatch();
  else stageUp();
});
function labelGo(){
  const ic = go.querySelector('.ico'), lb = go.querySelector('.lbl');
  if (stage === 'egg'){ ic.textContent = '\u{1F423}'; lb.textContent = 'Hatch'; }
  else if (stage === 'adult'){ ic.textContent = '\u{1FAE7}'; lb.textContent = 'New eggs'; }
  else { ic.textContent = '\u{1F331}'; lb.textContent = 'Grow'; }
}

/* world controls. Momentary, not sticky, so the tray never looks like a
   selection - the icon itself carries the state instead. */
const CONTROLS = [
  { id: 'rain',  icon: '☁️' },
  { id: 'sun',   icon: '☀️' },
  { id: 'call',  icon: '\u{1F4E2}' },
  { id: 'hide',  icon: '\u{1F343}' },
  { id: 'find',  icon: '\u{1F50D}' }
];
const tray = api.tray(CONTROLS, id => {
  if (id === 'rain'){
    rain = (rain + 1) % 3;
    if (rain) Sound.noise(.5, .02 + rain * .01, 900);
    if (rain === 2) for (let i = 0; i < 3; i++) setTimeout(croak, i * 700);
  } else if (id === 'sun'){
    night = !night;
    motes.length = 0;
    Sound.tone(night ? 320 : 620, .3, 'sine', .04, night ? -120 : 180);
  } else if (id === 'call'){
    croak();
  } else if (id === 'hide'){
    if (frog && frog.mode){
      frog.hidden = !frog.hidden;
      if (frog.hidden){
        const l = leaves.reduce((best, l) =>
          (!best || Math.hypot(l.x - frog.x, l.y - frog.y) < Math.hypot(best.x - frog.x, best.y - frog.y)) ? l : best, null);
        if (l){ frog.mode = 'climb'; frog.target = { x: l.x, y: l.y + 6 }; l.bend = 1; }
      }
      Sound.noise(.12, .015, 2000, true);
    }
  } else if (id === 'find'){
    const f = (frog && frog.mode) ? frog : (tadpoles[0] || { y: waterY });
    cam = camTo = clamp(f.y - H * .55, 0, Math.max(0, worldH - H));
    Sound.tone(700, .12, 'sine', .04, 200);
  }
  paintControls();
}, null);

function paintControls(){
  for (const b of tray.children || []){
    b.classList && b.classList.remove('sel');           // momentary, never "selected"
    const id = b.dataset && b.dataset.id;
    if (id === 'rain') setIcon(b, rain === 0 ? '☁️' : rain === 1 ? '\u{1F326}️' : '⛈️');
    if (id === 'sun') setIcon(b, night ? '\u{1F319}' : '☀️');
    if (id === 'hide') setIcon(b, frog && frog.hidden ? '\u{1F438}' : '\u{1F343}');
  }
}
function setIcon(b, ch){ b.innerHTML = '<span>' + ch + '</span>'; }
paintControls();

onStage = () => { labelGo(); paintControls(); };
onStage();
