import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=3';

/* Marble Run.
   Grid of one-cell pieces. Each piece owns a path from an entry port to an
   exit port; a marble rides the path, gaining speed on the way down, then
   hands off to whatever piece sits in the next cell. If nothing is there it
   simply falls — which is the point, not an error state. Grid placement means
   snapping is automatic and no precision is ever required. */

const CELL_MIN = 62, CELL_MAX = 96;
let cell = 80, cols = 8, rows = 9, ox = 0, oy = 0;
let grid = new Map();                     // "c,r" -> {t, rot}
let marbles = [], sparks = [], mode = 'play', tool = 'straight', colour = 0;
const COLOURS = ['#C4522A','#2A6B8A','#2D5A3D','#C9922A','#9B4F96','#D98E3C'];
const key = (c, r) => c + ',' + r;

/* ---------- pieces ----------
   ports: N E S W. path(): points in cell space (0..1) from entry to exit. */
const P = {
  straight: { name:'Tube',   in:'N', out:'S', path:[[.5,0],[.5,1]] },
  short:    { name:'Short',  in:'N', out:'S', path:[[.5,0],[.5,.5],[.5,1]], short:1 },
  elbowE:   { name:'Bend',   in:'N', out:'E', path:[[.5,0],[.5,.45],[.62,.6],[1,.62]] },
  elbowW:   { name:'Bend',   in:'N', out:'W', path:[[.5,0],[.5,.45],[.38,.6],[0,.62]] },
  rampE:    { name:'Ramp',   in:'N', out:'E', path:[[.5,0],[.5,.3],[1,.78]] },
  rampW:    { name:'Ramp',   in:'N', out:'W', path:[[.5,0],[.5,.3],[0,.78]] },
  funnel:   { name:'Funnel', in:'N', out:'S', path:[[.5,0],[.5,.18],[.5,.55],[.5,1]], funnel:1 },
  spiral:   { name:'Spiral', in:'N', out:'S', spiral:1 },
  scurve:   { name:'S-curve',in:'N', out:'S', path:[[.5,0],[.22,.3],[.78,.7],[.5,1]] },
  splitter: { name:'Split',  in:'N', out:'S', alt:'E', path:[[.5,0],[.5,1]], split:1 },
  drum:     { name:'Drum',   in:'N', out:'S', path:[[.5,0],[.5,.42],[.5,1]], drum:1 },
  bell:     { name:'Bell',   in:'N', out:'S', path:[[.5,0],[.5,.5],[.5,1]], bell:1 },
  cup:      { name:'Cup',    in:'N', out:null, path:[[.5,0],[.5,.55]], cup:1 }
};
const TOOLS = ['straight','short','elbowE','elbowW','rampE','rampW','funnel','spiral','scurve','splitter','drum','bell','cup'];

function spiralPath(){
  const pts = [[.5,0]];
  for (let i = 0; i <= 22; i++){
    const a = i / 22 * Math.PI * 3.2, r = .34 * (1 - i / 30);
    pts.push([.5 + Math.cos(a) * r, .12 + i / 22 * .8]);
  }
  pts.push([.5,1]);
  return pts;
}
const SPIRAL = spiralPath();
const pathOf = p => p.spiral ? SPIRAL : p.path;

/* ---------- presets ---------- */
const PRESETS = {
  'Little Run':  [[3,1,'straight'],[3,2,'rampE'],[4,3,'elbowW'],[3,4,'funnel'],[3,5,'straight'],[3,6,'cup']],
  'Big Spiral':  [[4,1,'straight'],[4,2,'spiral'],[4,3,'spiral'],[4,4,'funnel'],[4,5,'scurve'],[4,6,'cup']],
  'Rainbow Tower':[[2,1,'straight'],[2,2,'rampE'],[3,3,'rampE'],[4,4,'elbowW'],[3,5,'scurve'],[3,6,'drum'],[3,7,'cup']],
  'Super Funnel':[[4,1,'funnel'],[4,2,'straight'],[4,3,'funnel'],[4,4,'spiral'],[4,5,'bell'],[4,6,'cup']],
  'Marble Madness':[[1,1,'rampE'],[2,2,'rampE'],[3,3,'splitter'],[3,4,'scurve'],[4,4,'rampE'],[5,5,'elbowW'],[3,5,'drum'],[3,6,'bell'],[3,7,'cup'],[5,6,'cup']]
};
function load(name){
  grid.clear(); marbles = [];
  for (const [c, r, t] of (PRESETS[name] || PRESETS['Little Run'])) grid.set(key(c, r), { t });
}

/* ---------- geometry ---------- */
const cx = c => ox + c * cell, cy = r => oy + r * cell;
function ptAt(c, r, p, i){
  const path = pathOf(p);
  const q = path[clamp(i, 0, path.length - 1)];
  return { x: cx(c) + q[0] * cell, y: cy(r) + q[1] * cell };
}
function pathLen(p){
  const path = pathOf(p); let L = 0;
  for (let i = 1; i < path.length; i++)
    L += Math.hypot((path[i][0]-path[i-1][0])*cell, (path[i][1]-path[i-1][1])*cell);
  return L || 1;
}
function alongPath(c, r, p, t){                    // t in 0..1 -> point + slope
  const path = pathOf(p);
  const segs = [];
  let total = 0;
  for (let i = 1; i < path.length; i++){
    const d = Math.hypot((path[i][0]-path[i-1][0])*cell, (path[i][1]-path[i-1][1])*cell);
    segs.push(d); total += d;
  }
  let want = clamp(t, 0, 1) * total, i = 0;
  while (i < segs.length && want > segs[i]){ want -= segs[i]; i++; }
  i = clamp(i, 0, segs.length - 1);
  const f = segs[i] ? want / segs[i] : 0;
  const a = path[i], b = path[i + 1] || path[i];
  return {
    x: cx(c) + (a[0] + (b[0]-a[0]) * f) * cell,
    y: cy(r) + (a[1] + (b[1]-a[1]) * f) * cell,
    dy: (b[1]-a[1]) || .001, dx: (b[0]-a[0])
  };
}

/* ---------- marbles ---------- */
function drop(n){
  for (let i = 0; i < n; i++) setTimeout(() => {
    const start = topCell();
    marbles.push(start
      ? { mode:'path', c:start.c, r:start.r, t:0, v:26, col:COLOURS[colour % COLOURS.length], rr:cell*.17 }
      : { mode:'free', x:ox + cols*cell/2, y:oy, vx:0, vy:0, col:COLOURS[colour % COLOURS.length], rr:cell*.17 });
    Sound.tap();
  }, i * 170);
}
function dropAt(x){
  marbles.push({ mode:'free', x, y: oy - cell*.4, vx: 0, vy: 0,
    col: COLOURS[colour % COLOURS.length], rr: cell*.17 });
  Sound.tap();
}
function topCell(){
  let best = null;
  for (const [k, v] of grid){
    const [c, r] = k.split(',').map(Number);
    if (!best || r < best.r) best = { c, r };
  }
  return best;
}
function step(m, dt){
  if (m.mode === 'free'){
    m.vy += 1500 * dt; m.x += m.vx * dt; m.y += m.vy * dt;
    // fall into a piece whose entry we cross
    const c = Math.floor((m.x - ox) / cell), r = Math.floor((m.y - oy) / cell);
    const g = grid.get(key(c, r));
    if (g){
      const p = P[g.t], entry = ptAt(c, r, p, 0);
      if (Math.abs(m.x - entry.x) < cell * .42 && m.y >= entry.y){
        m.mode = 'path'; m.c = c; m.r = r; m.t = 0; m.v = Math.max(30, m.vy * .5);
        Sound.roll();
      }
    }
    if (m.y > oy + rows * cell + 200) m.dead = 1;
    return;
  }
  const g = grid.get(key(m.c, m.r));
  if (!g){ m.mode = 'free'; m.vx = 0; m.vy = m.v; return; }
  const p = P[g.t], L = pathLen(p);
  const here = alongPath(m.c, m.r, p, m.t);
  const slope = here.dy / (Math.abs(here.dx) + Math.abs(here.dy) || 1);
  m.v += (900 * slope + 120) * dt;                 // gravity along the path, plus a nudge
  if (p.funnel) m.v *= (1 - .5 * dt);              // funnels slow and swirl
  if (p.spiral) m.v *= (1 - .35 * dt);
  m.v = clamp(m.v, 20, 900);
  m.t += (m.v * dt) / L;
  if (p.drum && m.t > .42 && !m.bounced){ m.bounced = 1; m.v *= .55; Sound.thud(); }
  if (p.bell && m.t > .5 && !m.rang){ m.rang = 1; Sound.ding(); }
  if (m.t >= 1){
    m.bounced = 0; m.rang = 0;
    if (p.cup){ m.t = 1; m.resting = 1; if (!m.plopped){ m.plopped = 1; Sound.pop(); } return; }
    let out = p.out;
    if (p.split && Math.random() < .5) out = p.alt;
    const nc = m.c + (out === 'E' ? 1 : out === 'W' ? -1 : 0);
    const nr = m.r + (out === 'S' ? 1 : 0);
    const nxt = grid.get(key(nc, nr));
    if (nxt && P[nxt.t].in === 'N' && out === 'S'){ m.c = nc; m.r = nr; m.t = 0; Sound.roll(); }
    else if (nxt && out !== 'S'){ m.c = nc; m.r = nr; m.t = 0; Sound.roll(); }
    else {                                          // nothing connected: just fall
      const e = alongPath(m.c, m.r, p, 1);
      m.mode = 'free'; m.x = e.x; m.y = e.y;
      m.vx = out === 'E' ? m.v * .6 : out === 'W' ? -m.v * .6 : 0;
      m.vy = Math.max(60, m.v * .5);
    }
  }
}

/* ---------- drawing: translucent plastic ---------- */
function tube(ctx, pts, col, w){
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(28,26,22,.16)'; ctx.lineWidth = w + 7;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = w * .3;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x - w*.16, p.y) : ctx.moveTo(p.x - w*.16, p.y)); ctx.stroke();
}
const TINT = { straight:'rgba(90,170,220,.5)', short:'rgba(90,170,220,.5)',
  elbowE:'rgba(120,200,150,.5)', elbowW:'rgba(120,200,150,.5)',
  rampE:'rgba(230,170,70,.5)', rampW:'rgba(230,170,70,.5)',
  funnel:'rgba(220,120,90,.5)', spiral:'rgba(170,130,210,.5)', scurve:'rgba(120,200,150,.5)',
  splitter:'rgba(230,170,70,.5)', drum:'rgba(150,150,160,.55)', bell:'rgba(215,180,80,.6)',
  cup:'rgba(120,160,190,.55)' };

function drawPiece(ctx, c, r, t){
  const p = P[t], w = cell * .30;
  const path = pathOf(p).map(q => ({ x: cx(c) + q[0]*cell, y: cy(r) + q[1]*cell }));
  if (p.funnel){
    const g = cx(c), y = cy(r);
    ctx.fillStyle = TINT.funnel;
    ctx.beginPath();
    ctx.moveTo(g + cell*.06, y + cell*.16); ctx.lineTo(g + cell*.94, y + cell*.16);
    ctx.lineTo(g + cell*.62, y + cell*.66); ctx.lineTo(g + cell*.38, y + cell*.66);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (p.cup){
    const g = cx(c), y = cy(r);
    ctx.fillStyle = TINT.cup;
    ctx.beginPath(); ctx.roundRect(g + cell*.14, y + cell*.34, cell*.72, cell*.56, cell*.16); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  if (!p.funnel && !p.cup) tube(ctx, path, TINT[t] || 'rgba(120,180,220,.5)', w);
  if (p.drum){
    ctx.fillStyle = 'rgba(150,150,160,.75)';
    ctx.beginPath(); ctx.ellipse(cx(c)+cell*.5, cy(r)+cell*.52, cell*.3, cell*.12, 0, 0, 7); ctx.fill();
  }
  if (p.bell){
    ctx.fillStyle = '#C9922A';
    ctx.beginPath(); ctx.arc(cx(c)+cell*.5, cy(r)+cell*.55, cell*.15, Math.PI, 0); ctx.fill();
  }
  if (p.split){
    ctx.strokeStyle = TINT.splitter; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(cx(c)+cell*.5, cy(r)+cell*.5); ctx.lineTo(cx(c)+cell, cy(r)+cell*.66); ctx.stroke();
  }
  // supports
  ctx.strokeStyle = 'rgba(28,26,22,.13)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx(c)+cell*.5, cy(r)+cell); ctx.lineTo(cx(c)+cell*.5, cy(r)+cell+6); ctx.stroke();
}

/* ---------- shell ---------- */
let dragCell = null;
const api = boot({
  title: 'Marble Run Builder',
  coach: [{ type:'tap', x:.42, y:.12 }, { type:'tap', x:.62, y:.10 }],
  tryReal: { id: 123, name: 'Paper Roller Coaster' },
  onReset(){ load(presetName); },
  onResize(a){ layout(a); },
  onDown(x, y){
    if (mode !== 'build'){                       // in play, tapping the board drops one there
      dropAt(clamp(x, ox + cell*.5, ox + cols*cell - cell*.5));
      return;
    }
    const c = Math.floor((x - ox) / cell), r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    dragCell = key(c, r);
    if (grid.get(dragCell) && grid.get(dragCell).t === tool) grid.delete(dragCell);   // tap again to remove
    else grid.set(dragCell, { t: tool });
    Sound.tap();
  },
  onMove(x, y){
    if (mode !== 'build' || !dragCell) return;
    const c = Math.floor((x - ox) / cell), r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const k = key(c, r);
    if (k !== dragCell && !grid.has(k)){ grid.set(k, { t: tool }); dragCell = k; Sound.tap(); }
  },
  onUp(){ dragCell = null; },
  tick(dt, a){
    for (const m of marbles) step(m, dt);
    marbles = marbles.filter(m => !m.dead);
    if (marbles.length > 60) marbles.splice(0, marbles.length - 60);
    draw(a);
  }
});

function layout(a){
  cell = clamp(Math.min(a.W / 8.4, (a.H - a.top - a.bottom - 40) / 9.2), CELL_MIN, CELL_MAX);
  cols = Math.max(5, Math.floor(a.W / cell) - 1);
  rows = Math.max(6, Math.floor((a.H - a.top - a.bottom - 30) / cell));
  ox = (a.W - cols * cell) / 2;
  oy = a.top + 12;
}

function draw(a){
  const ctx = a.ctx;
  ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0, 0, a.W, a.H);
  if (mode === 'build'){                    // faint grid so placement reads as a grid
    ctx.strokeStyle = 'rgba(28,26,22,.07)'; ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++){ ctx.beginPath(); ctx.moveTo(cx(c), oy); ctx.lineTo(cx(c), oy+rows*cell); ctx.stroke(); }
    for (let r = 0; r <= rows; r++){ ctx.beginPath(); ctx.moveTo(ox, cy(r)); ctx.lineTo(ox+cols*cell, cy(r)); ctx.stroke(); }
  }
  for (const [k, v] of grid){
    const [c, r] = k.split(',').map(Number);
    drawPiece(ctx, c, r, v.t);
  }
  for (const m of marbles){
    const pos = m.mode === 'free' ? { x: m.x, y: m.y } : alongPath(m.c, m.r, P[grid.get(key(m.c,m.r))?.t] || P.straight, m.t);
    ctx.fillStyle = 'rgba(28,26,22,.18)';
    ctx.beginPath(); ctx.ellipse(pos.x, pos.y + m.rr*.9, m.rr*.9, m.rr*.35, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(pos.x - m.rr*.35, pos.y - m.rr*.4, m.rr*.15, pos.x, pos.y, m.rr);
    g.addColorStop(0, '#fff'); g.addColorStop(.35, m.col); g.addColorStop(1, m.col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pos.x, pos.y, m.rr, 0, 7); ctx.fill();
  }
}

/* ---------- controls ---------- */
let presetName = 'Little Run';
load(presetName);
layout(api);

const dropBtn = api.action('\u{1F535}', 'Drop', '', () => drop(1));
const buildBtn = api.action('\u{1F6E0}\uFE0F', 'Build', 'alt', () => setMode(mode === 'build' ? 'play' : 'build'));
buildBtn.style.left = 'auto'; buildBtn.style.right = '14px'; buildBtn.style.transform = 'none';
buildBtn.style.minWidth = '0'; buildBtn.style.padding = '20px 22px';

let tray = null;
function setMode(m){
  mode = m;
  buildBtn.querySelector('.ico').textContent = m === 'build' ? '\u2705' : '\u{1F6E0}\uFE0F';
  buildBtn.querySelector('.lbl').textContent = m === 'build' ? 'Done' : 'Build';
  dropBtn.style.display = m === 'build' ? 'none' : '';
  if (m === 'build' && !tray){
    tray = api.tray(TOOLS.map(t => ({ id: t, svg: toolSVG(t), name: P[t].name })), id => tool = id, tool);
  } else if (tray){ tray.style.display = m === 'build' ? '' : 'none'; }
  api.showTray(m === 'build');
}
/* A four-year-old cannot tell one box-drawing glyph from another, so each
   tool shows a small drawing of the actual piece and the marble in it. */
function toolSVG(t){
  const pts = pathOf(P[t]).map(q => (6 + q[0] * 40).toFixed(1) + ',' + (5 + q[1] * 42).toFixed(1)).join(' ');
  const end = pathOf(P[t])[pathOf(P[t]).length - 1];
  return '<svg viewBox="0 0 52 52" aria-hidden="true">' +
    '<polyline points="' + pts + '" fill="none" stroke="#CFE3EC" stroke-width="13" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polyline points="' + pts + '" fill="none" stroke="#2A6B8A" stroke-width="2.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>' +
    '<circle cx="' + (6 + end[0] * 40).toFixed(1) + '" cy="' + (5 + end[1] * 42).toFixed(1) +
      '" r="5.5" fill="#C4522A"/></svg>';
}

// preset + colour cyclers live in the top bar
const bar = document.querySelector('.toy-bar');
const mk = (label, fn) => { const b = document.createElement('button'); b.className='toy-btn';
  b.textContent = label; b.onclick = () => { Sound.unlock(); fn(); }; bar.insertBefore(b, bar.querySelector('#toy-reset')); return b; };
const names = Object.keys(PRESETS);
mk('🎲', () => { presetName = pick(names.filter(n => n !== presetName)); load(presetName); Sound.whoosh(); });
const colBtn = mk('🔴', () => { colour++; colBtn.textContent = ['🔴','🔵','🟢','🟡','🟣','🟠'][colour % 6]; });
mk('⏬', () => drop(10));
api.showTray(false);                 // play mode opens with no tray
