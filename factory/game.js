import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=e18d652ba5d1';
/* Ball Factory.
   A grid of machine parts you lay out yourself. Balls are real: they fall,
   land on a belt, get carried, run off the end, drop to whatever is below.
   Nothing checks whether the factory is "finished" - a ball that runs out of
   machine simply falls to the floor and rolls away, which is a result, not a
   failure. Belts are one cell each, so a long conveyor is something the child
   builds by dragging a finger. */

let grid = new Map();                       // "c,r" -> {t, dir}
let balls = [], sparks = [], count = 0;
let cell = 76, cols = 6, rows = 8, ox = 0, oy = 0, R = 15;
let mode = 'play', tool = 'beltR', hum = 0, tick = 0;
let paintChoice = 'random';   // 'random' or one of PAINTS

const BELT = 165, GRAV = 1500, LIFT = 2900;
const PAINTS = ['#C4522A','#C9922A','#2D5A3D','#2A6B8A','#8C5AA8','#D96A9A'];
const RAW = '#C9BFAC';

/* ---------- parts ---------- */
const P = {
  beltR: { name:'Belt going right', kind:'belt',  dir: 1 },
  beltL: { name:'Belt going left',  kind:'belt',  dir:-1 },
  rampR: { name:'Slide down right', kind:'ramp',  dir: 1 },
  rampL: { name:'Slide down left',  kind:'ramp',  dir:-1 },
  lift:  { name:'Lift going up',    kind:'lift'  },
  paint: { name:'Paint sprayer',    kind:'paint' },
  bell:  { name:'Bell',             kind:'bell'  },
  bin:   { name:'Basket',           kind:'bin'   },
  hopper:{ name:'Ball maker',       kind:'hopper'}
};
const TOOLS = ['beltR','beltL','rampR','rampL','lift','paint','bell','bin','hopper'];

const key = (c, r) => c + ',' + r;
const cx = c => ox + c * cell;
const cy = r => oy + r * cell;
const colAt = x => Math.floor((x - ox) / cell);
const rowAt = y => Math.floor((y - oy) / cell);
const at = (c, r) => grid.get(key(c, r));

/* ---------- starting factories ---------- */
const PRESETS = [
  [ [0,0,'hopper'],[0,1,'beltR'],[1,1,'beltR'],[2,1,'beltR'],[3,1,'rampR'],
    [4,2,'paint'],[4,3,'beltL'],[3,3,'beltL'],[2,3,'beltL'],[1,3,'rampL'],
    [0,4,'bell'],[0,5,'bin'] ],
  [ [2,0,'hopper'],[2,1,'rampL'],[1,2,'beltL'],[0,2,'rampL'],[0,3,'bin'],
    [3,1,'paint'],[3,2,'beltR'],[4,2,'beltR'],[5,2,'bell'],[5,3,'bin'] ],
  [ [0,0,'hopper'],[0,1,'rampR'],[1,2,'beltR'],[2,2,'beltR'],[3,2,'lift'],
    [3,1,'lift'],[3,0,'paint'],[4,0,'beltR'],[5,0,'rampR'],[5,1,'bell'],[5,2,'bin'] ]
];
let preset = 0;
function load(i){
  grid.clear(); balls = []; sparks = []; count = 0;
  for (const [c, r, t] of PRESETS[i % PRESETS.length])
    if (c < cols && r < rows) grid.set(key(c, r), { t });
}

/* ---------- making balls ---------- */
function hoppers(){
  const out = [];
  for (const [k, v] of grid) if (v.t === 'hopper'){
    const [c, r] = k.split(',').map(Number); out.push({ c, r });
  }
  return out;
}
function born(){
  const hs = hoppers();
  if (!hs.length){                              // no maker placed: drop from the top
    balls.push(mk(ox + cols * cell / 2, oy + 6));
  } else for (const h of hs) balls.push(mk(cx(h.c) + cell / 2, cy(h.r) + cell * .78));
  if (balls.length > 44) balls.splice(0, balls.length - 44);
  count++; Sound.tap();
}
const mk = (x, y) => ({ x, y, vx: 0, vy: 0, col: RAW, spin: 0, done: 0 });

/* ---------- one ball, one frame ---------- */
function step(b, dt, a){
  b.vy += GRAV * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.spin += b.vx * dt * .06;
  b.vx *= .999;

  const c = colAt(b.x), feet = rowAt(b.y + R), mid = rowAt(b.y);
  const under = at(c, feet), inside = at(c, mid);

  if (inside){
    const p = P[inside.t];
    if (p.kind === 'lift'){
      b.vy -= LIFT * dt;
      b.x += (cx(c) + cell / 2 - b.x) * Math.min(1, dt * 6);
      if (b.vy < -520) b.vy = -520;
    } else if (p.kind === 'paint'){
      if (b.col === RAW){
        b.col = paintChoice === 'random' ? pick(PAINTS) : paintChoice;
        Sound.ding();
        for (let i = 0; i < 8; i++){
          const ang = rand(0, 6.3);
          sparks.push({ x: b.x, y: b.y, vx: Math.cos(ang)*90, vy: Math.sin(ang)*90,
            age: 0, life: .45, col: b.col });
        }
      }
    } else if (p.kind === 'bell'){
      if (!inside.rung){ inside.rung = .45; Sound.ding(); }
    }
  }

  if (under){
    const p = P[under.t];
    if (p.kind === 'belt'){
      const sy = cy(feet) + cell * .58;
      if (b.y + R >= sy && b.vy >= -1){
        b.y = sy - R; b.vy = 0;
        b.vx += (P[under.t].dir * BELT - b.vx) * Math.min(1, dt * 9);
        if (hum <= 0){ Sound.noise(.06, .012, 500); hum = .2; }
      }
    } else if (p.kind === 'ramp'){
      const f = clamp((b.x - cx(c)) / cell, 0, 1);
      const along = p.dir > 0 ? f : 1 - f;
      const sy = cy(feet) + cell * (.24 + .58 * along);
      if (b.y + R >= sy && b.vy >= -1){
        b.y = sy - R;
        b.vy = Math.min(b.vy, 40);
        b.vx += p.dir * 1000 * dt;
        if (hum <= 0){ Sound.noise(.05, .008, 800); hum = .22; }
      }
    } else if (p.kind === 'bin'){
      const fl = cy(feet) + cell * .84;
      if (b.y + R >= fl){
        b.y = fl - R;
        if (b.vy > 210) Sound.pop();
        b.vy *= -.3; b.vx *= .7;
        b.x = clamp(b.x, cx(c) + R, cx(c) + cell - R);
        if (!b.done){ b.done = 1; }
      }
    }
  }

  // The walls are the edges of the machine, not of the screen. The grid is
  // narrower than the canvas, and using the canvas edges left a crack down
  // each side that a ball reaching the end of a belt fell straight through.
  const left = ox + R, right = ox + cols * cell - R;
  if (b.x < left){ b.x = left; b.vx = Math.abs(b.vx) * .5; }
  if (b.x > right){ b.x = right; b.vx = -Math.abs(b.vx) * .5; }
  const floor = oy + rows * cell;
  if (b.y + R > floor){
    b.y = floor - R;
    if (b.vy > 240) Sound.thud();
    b.vy *= -.28;
    b.vx += (b.vx >= 0 ? 40 : -40) * dt;          // roll away rather than stop dead
  }
}

/* ---------- drawing ---------- */
function tube(ctx, x, y, w, h, r, fill){
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function drawPart(ctx, c, r, g){
  const x = cx(c), y = cy(r), p = P[g.t];
  ctx.save();
  if (p.kind === 'belt'){
    const sy = y + cell * .58;
    tube(ctx, x, sy, cell, cell * .17, cell * .08, '#4A4540');
    ctx.fillStyle = '#8C8278';
    const step = cell * .22, off = ((tick * BELT * p.dir) % step + step) % step;
    for (let i = -1; i * step < cell + step; i++){
      const tx = x + ((i * step + off) % cell + cell) % cell;
      ctx.fillRect(tx, sy + cell * .045, cell * .09, cell * .08);
    }
    ctx.fillStyle = 'rgba(28,26,22,.20)';
    ctx.beginPath(); ctx.arc(x + cell * .16, sy + cell * .085, cell * .055, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + cell * .84, sy + cell * .085, cell * .055, 0, 7); ctx.fill();
  } else if (p.kind === 'ramp'){
    ctx.fillStyle = '#9A6B3F';
    ctx.beginPath();
    if (p.dir > 0){
      ctx.moveTo(x, y + cell * .24); ctx.lineTo(x + cell, y + cell * .82);
      ctx.lineTo(x + cell, y + cell * .95); ctx.lineTo(x, y + cell * .37);
    } else {
      ctx.moveTo(x + cell, y + cell * .24); ctx.lineTo(x, y + cell * .82);
      ctx.lineTo(x, y + cell * .95); ctx.lineTo(x + cell, y + cell * .37);
    }
    ctx.closePath(); ctx.fill();
  } else if (p.kind === 'lift'){
    tube(ctx, x + cell * .18, y, cell * .64, cell, cell * .12, 'rgba(42,107,138,.20)');
    ctx.strokeStyle = '#2A6B8A'; ctx.lineWidth = Math.max(3, cell * .05);
    for (let i = 0; i < 3; i++){
      const yy = y + cell - ((tick * 90 + i * cell / 3) % cell);
      ctx.beginPath();
      ctx.moveTo(x + cell * .30, yy + cell * .10);
      ctx.lineTo(x + cell * .50, yy);
      ctx.lineTo(x + cell * .70, yy + cell * .10);
      ctx.stroke();
    }
  } else if (p.kind === 'paint'){
    tube(ctx, x + cell * .12, y + cell * .12, cell * .76, cell * .76, cell * .18, '#C9922A');
    ctx.font = (cell * .42) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F3A8}', x + cell / 2, y + cell / 2);
    // a blob of whatever colour is loaded, so the choice is readable at a glance
    if (paintChoice === 'random'){
      for (let i = 0; i < PAINTS.length; i++){
        ctx.fillStyle = PAINTS[i];
        ctx.beginPath();
        ctx.arc(x + cell * (.22 + i * .112), y + cell * .84, cell * .05, 0, 7);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = paintChoice;
      ctx.beginPath(); ctx.arc(x + cell / 2, y + cell * .84, cell * .10, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(250,247,240,.9)'; ctx.lineWidth = Math.max(2, cell * .022); ctx.stroke();
    }
  } else if (p.kind === 'bell'){
    const k = g.rung ? g.rung / .45 : 0;
    ctx.font = (cell * (.46 + k * .12)) + 'px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F514}', x + cell / 2, y + cell / 2);
    if (k){
      ctx.strokeStyle = 'rgba(201,146,42,' + k.toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x + cell/2, y + cell/2, cell * (.30 + (1-k) * .22), 0, 7); ctx.stroke();
    }
  } else if (p.kind === 'bin'){
    ctx.fillStyle = '#E4DCCB';
    ctx.beginPath();
    ctx.moveTo(x + cell * .10, y + cell * .30); ctx.lineTo(x + cell * .90, y + cell * .30);
    ctx.lineTo(x + cell * .80, y + cell * .90); ctx.lineTo(x + cell * .20, y + cell * .90);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#C9BFAC'; ctx.lineWidth = Math.max(3, cell * .05); ctx.stroke();
  } else if (p.kind === 'hopper'){
    ctx.fillStyle = '#2D5A3D';
    ctx.beginPath();
    ctx.moveTo(x + cell * .08, y + cell * .10); ctx.lineTo(x + cell * .92, y + cell * .10);
    ctx.lineTo(x + cell * .60, y + cell * .62); ctx.lineTo(x + cell * .40, y + cell * .62);
    ctx.closePath(); ctx.fill();
    tube(ctx, x + cell * .40, y + cell * .58, cell * .20, cell * .22, cell * .04, '#204630');
  }
  ctx.restore();
}
function toolSVG(t){
  const p = P[t], s = [];
  const bar = (y) => '<rect x="4" y="' + y + '" width="44" height="9" rx="4" fill="#4A4540"/>';
  if (p.kind === 'belt'){
    s.push(bar(26));
    s.push('<path d="M' + (p.dir > 0 ? '20 16 L32 30 L20 44' : '32 16 L20 30 L32 44') +
           '" fill="none" stroke="#C4522A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>');
  } else if (p.kind === 'ramp'){
    s.push(p.dir > 0
      ? '<path d="M5 14 L47 40 L47 47 L5 21 Z" fill="#9A6B3F"/>'
      : '<path d="M47 14 L5 40 L5 47 L47 21 Z" fill="#9A6B3F"/>');
  } else if (p.kind === 'lift'){
    s.push('<rect x="13" y="4" width="26" height="44" rx="7" fill="rgba(42,107,138,.22)"/>');
    for (let i = 0; i < 3; i++)
      s.push('<path d="M18 ' + (38 - i*13) + ' L26 ' + (30 - i*13) + ' L34 ' + (38 - i*13) +
             '" fill="none" stroke="#2A6B8A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>');
  } else if (p.kind === 'paint'){
    s.push('<rect x="6" y="6" width="40" height="40" rx="11" fill="#C9922A"/>');
    s.push('<text x="26" y="36" font-size="24" text-anchor="middle">\u{1F3A8}</text>');
  } else if (p.kind === 'bell'){
    s.push('<text x="26" y="37" font-size="28" text-anchor="middle">\u{1F514}</text>');
  } else if (p.kind === 'bin'){
    s.push('<path d="M7 16 L45 16 L39 46 L13 46 Z" fill="#E4DCCB" stroke="#C9BFAC" stroke-width="3"/>');
  } else {
    s.push('<path d="M5 8 L47 8 L32 34 L20 34 Z" fill="#2D5A3D"/>');
    s.push('<rect x="20" y="32" width="12" height="14" rx="3" fill="#204630"/>');
  }
  return '<svg viewBox="0 0 52 52" aria-hidden="true">' + s.join('') + '</svg>';
}

/* ---------- shell ---------- */
let dragCell = null;
const api = boot({
  title: 'Ball Factory',
  coach: [{ type:'tap', x:.5, y:.12 }, { type:'tap', x:.5, y:.12 }],
  tryReal: { id: 50, name: 'Balloon Rocket Car' },
  onReset(){ load(preset); },
  onResize(a){ layout(a); },
  onDown(x, y){
    if (mode !== 'build'){
      balls.push(mk(clamp(x, ox + R, ox + cols * cell - R), oy + 6));
      Sound.tap(); count++; return;
    }
    const c = colAt(x), r = rowAt(y);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    dragCell = key(c, r);
    const e = grid.get(dragCell);
    if (e && e.t === tool) grid.delete(dragCell);          // tap the same tool again to clear
    else grid.set(dragCell, { t: tool });
    Sound.tap();
  },
  onMove(x, y){
    if (mode !== 'build' || !dragCell) return;
    const c = colAt(x), r = rowAt(y);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const k = key(c, r);
    if (k !== dragCell && !grid.has(k)){                   // drag lays a run of belt
      grid.set(k, { t: tool }); dragCell = k; Sound.tap();
    }
  },
  onUp(){ dragCell = null; },
  tick(dt, a){
    tick += dt; hum -= dt;
    for (const [, g] of grid) if (g.rung) g.rung = Math.max(0, g.rung - dt);
    for (const b of balls) step(b, dt, a);
    balls = balls.filter(b => b.y < a.H + 240);
    for (const p of sparks){ p.age += dt; p.vy += 260*dt; p.x += p.vx*dt; p.y += p.vy*dt; }
    sparks = sparks.filter(p => p.age < p.life);
    draw(a);
  }
});

function layout(a){
  cell = clamp(Math.min(a.W / 6.6, (a.H - a.top - a.bottom - 26) / 7.4), 52, 104);
  cols = Math.max(4, Math.floor(a.W / cell));
  rows = Math.max(5, Math.floor((a.H - a.top - a.bottom - 16) / cell));
  ox = Math.round((a.W - cols * cell) / 2);
  oy = a.top + 10;
  R = cell * .19;
}

function draw(a){
  const ctx = a.ctx;
  ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0, 0, a.W, a.H);

  if (mode === 'build'){                       // a faint grid, so placement reads as a grid
    ctx.strokeStyle = '#EDE5D5'; ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++){
      ctx.beginPath(); ctx.moveTo(cx(c), oy); ctx.lineTo(cx(c), oy + rows*cell); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++){
      ctx.beginPath(); ctx.moveTo(ox, cy(r)); ctx.lineTo(ox + cols*cell, cy(r)); ctx.stroke();
    }
  }
  ctx.fillStyle = '#E4DCCB';
  ctx.fillRect(0, oy + rows * cell, a.W, Math.max(0, a.H - (oy + rows * cell)));

  for (const [k, g] of grid){
    const [c, r] = k.split(',').map(Number);
    drawPart(ctx, c, r, g);
  }
  for (const p of sparks){
    const k = 1 - p.age / p.life;
    ctx.fillStyle = p.col; ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4 * k + 1, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const b of balls){
    ctx.fillStyle = 'rgba(28,26,22,.10)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + R * .95, R * .85, R * .28, 0, 0, 7); ctx.fill();
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.beginPath(); ctx.arc(b.x - R * .3, b.y - R * .32, R * .3, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#8C8278'; ctx.font = '600 16px Lato, system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Balls made: ' + count, 16, a.top + 4);
}

layout(api);
load(preset);

const makeBtn = api.action('\u{1F535}', 'Make a ball', '', () => born());
const buildBtn = api.action('\u{1F6E0}️', 'Build', 'alt',
  () => setMode(mode === 'build' ? 'play' : 'build'));
buildBtn.style.left = 'auto'; buildBtn.style.right = '14px';
buildBtn.style.transform = 'none'; buildBtn.style.minWidth = '0'; buildBtn.style.padding = '12px 20px 14px';

/* Playing shows the paint colours, building shows the parts. One tray slot,
   two jobs, so the bottom of the screen always means "pick a thing". */
const SWATCHES = [{ id: 'random', icon: '\u{1F308}', name: 'A surprise colour' }].concat(
  PAINTS.map(c => ({ id: c, name: 'Paint everything this colour',
    svg: '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="19" fill="' + c +
         '"/><circle cx="20" cy="19" r="5" fill="rgba(255,255,255,.45)"/></svg>' })));
let colourTray = api.tray(SWATCHES, id => paintChoice = id, 'random');
let toolTray = null;

function setMode(m){
  mode = m;
  buildBtn.querySelector('.ico').textContent = m === 'build' ? '✅' : '\u{1F6E0}️';
  buildBtn.querySelector('.lbl').textContent = m === 'build' ? 'Done' : 'Build';
  makeBtn.style.display = m === 'build' ? 'none' : '';
  if (m === 'build' && !toolTray)
    toolTray = api.tray(TOOLS.map(t => ({ id: t, svg: toolSVG(t), name: P[t].name })), id => tool = id, tool);
  if (toolTray) toolTray.style.display = m === 'build' ? '' : 'none';
  colourTray.style.display = m === 'build' ? 'none' : '';
  api.showTray(true);
}

// a second factory to look at, in the top bar next to reset
const bar = document.querySelector('.toy-bar');
const swap = document.createElement('button');
swap.className = 'toy-btn'; swap.textContent = '\u{1F3B2}';
swap.setAttribute('aria-label', 'Another factory');
swap.onclick = () => { Sound.unlock(); preset = (preset + 1) % PRESETS.length; load(preset); Sound.whoosh(); };
bar.insertBefore(swap, bar.querySelector('#toy-reset'));
