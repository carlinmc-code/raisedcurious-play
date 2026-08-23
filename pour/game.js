import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=3';
/* A falling-material sandbox. Coarse cell grid: each cell is empty, wall or a
   grain. Water spreads sideways, sand piles, beads bounce a little. Tilt a cup
   by dragging it. The visual response is the whole game. */
let G, W = 0, H = 0, cs = 7, cols = 0, rows = 0;
const EMPTY = 0, WALL = 1;
const MATS = {
  water: { id:2, col:'#4AA8D8', flow:5, name:'Water' },
  sand:  { id:3, col:'#D9B36A', flow:1, name:'Sand'  },
  beads: { id:4, col:'#C4522A', flow:2, name:'Beads' },
  rice:  { id:5, col:'#E8DFC8', flow:1, name:'Rice'  }
};
const BY_ID = {}; for (const k in MATS) BY_ID[MATS[k].id] = MATS[k];
let mat = 'water', pourAt = null, pourT = 0;

const idx = (c, r) => r * cols + c;
const get = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows) ? WALL : G[idx(c,r)];
const set = (c, r, v) => { if (c >= 0 && r >= 0 && c < cols && r < rows) G[idx(c,r)] = v; };

function build(a){
  W = a.W; H = a.H;
  cs = clamp(Math.round(W / 90), 5, 9);
  cols = Math.ceil(W / cs); rows = Math.ceil((H - a.top - 70) / cs);
  G = new Uint8Array(cols * rows);
  vessels();
}
function rect(x, y, w, h){ for (let c = x; c < x+w; c++) for (let r = y; r < y+h; r++) set(c, r, WALL); }
function vessels(){
  const b = rows - 3;
  rect(0, b, cols, 3);                                    // floor
  // a funnel in the middle
  const mc = cols >> 1;
  for (let i = 0; i < Math.floor(rows*.18); i++){
    set(mc - Math.floor(rows*.18) + i, Math.floor(rows*.30) + i, WALL);
    set(mc + Math.floor(rows*.18) - i, Math.floor(rows*.30) + i, WALL);
  }
  // two cups on the floor
  const cw = Math.floor(cols*.20), ch = Math.floor(rows*.20);
  for (const cx0 of [Math.floor(cols*.14), Math.floor(cols*.64)]){
    for (let r = b - ch; r < b; r++){ set(cx0, r, WALL); set(cx0 + cw, r, WALL); }
    for (let c = cx0; c <= cx0 + cw; c++) set(c, b - 1, WALL);
  }
}
function pour(x, y){
  const c = Math.floor(x / cs), r = Math.floor((y - api.top) / cs);
  const m = MATS[mat].id;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
    if (get(c+i, r+j) === EMPTY && Math.random() < .7) set(c+i, r+j, m);
}
function sim(){
  for (let r = rows - 2; r >= 0; r--){
    const l2r = Math.random() < .5;
    for (let n = 0; n < cols; n++){
      const c = l2r ? n : cols - 1 - n;
      const v = get(c, r);
      if (v === EMPTY || v === WALL) continue;
      const m = BY_ID[v];
      if (get(c, r+1) === EMPTY){ set(c, r, EMPTY); set(c, r+1, v); continue; }
      const d = Math.random() < .5 ? -1 : 1;
      if (get(c+d, r+1) === EMPTY){ set(c, r, EMPTY); set(c+d, r+1, v); continue; }
      if (get(c-d, r+1) === EMPTY){ set(c, r, EMPTY); set(c-d, r+1, v); continue; }
      if (m.flow > 2){                                    // water finds its level
        for (let s = 1; s <= m.flow; s++){
          if (get(c + d*s, r) === EMPTY){ set(c, r, EMPTY); set(c + d*s, r, v); break; }
          if (get(c + d*s, r) !== EMPTY) break;
        }
      }
    }
  }
}
const api = boot({
  title: 'Pour & Flow',
  coach: [{ type:'drag', from:[.30,.18], to:[.62,.34] }],
  tryReal: { id: 54, name: 'Density Tower' },
  onReset(){ build(api); },
  onResize(a){ build(a); },
  onDown(x, y){ pourAt = { x, y }; for (let i = 0; i < 6; i++) pour(x, y); Sound.splash(); },
  onMove(x, y){ if (pourAt) pourAt = { x, y }; },
  onUp(){ pourAt = null; },
  tick(dt, a){
    pourT += dt;
    if (pourAt) pour(pourAt.x, pourAt.y);
    if (pourT > .016){ pourT = 0; sim(); if (Math.random() < .1) Sound.noise(.05, .012, 700); }
    const ctx = a.ctx;
    ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0, 0, a.W, a.H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++){
      const v = G[idx(c,r)]; if (!v) continue;
      ctx.fillStyle = v === WALL ? '#C9BFAC' : BY_ID[v].col;
      ctx.fillRect(c*cs, a.top + r*cs, cs, cs);
    }
  }
});
build(api);
api.action('\u{1F30A}', 'Big pour', '', () => {
  const x = api.W / 2, y = api.top + 40;
  for (let i = 0; i < 60; i++) pour(x + rand(-40, 40), y + rand(-20, 20));
  Sound.splash();
});
api.tray(Object.keys(MATS).map(k => ({ id:k, icon:{water:'💧',sand:'🏖️',beads:'🔴',rice:'🍚'}[k], name:MATS[k].name })),
  id => mat = id, 'water');
