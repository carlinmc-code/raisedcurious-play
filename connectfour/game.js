import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=7';
import { createTable, joinSheet, codeFromUrl, online } from '../assets/table.js?v=2';
import { COLS, ROWS, empty, at, drop, winLine, isFull, other, canDrop, robotColumn } from './rules.js?v=1';

/* Four in a Row.
   Four ways to play, all from the same board: someone beside you, a robot at
   two strengths, or someone on another device. Remote games send only the
   column number; both devices replay the move list through rules.js, so the
   two boards cannot drift apart. */

const SETS = [
  { a:'#C4522A', b:'#C9922A', an:'red', bn:'yellow' },
  { a:'#2D5A3D', b:'#2A6B8A', an:'green', bn:'blue' },
  { a:'#8C5AA8', b:'#D96A9A', an:'purple', bn:'pink' }
];
let setIx = 0;
const colOf = p => (p === 1 ? SETS[setIx].a : SETS[setIx].b);

let board = empty(), turn = 1, win = null, over = 0, mode = 'human';
let falling = null, think = 0, bits = [], hintCol = -1;
let CS = 60, bx = 0, by = 0, bw = 0, bh = 0;
let table = null, sheet = null, mySeat = -1;

function layout(a){
  const availW = a.W - 22;
  const availH = a.H - a.top - a.bottom - 104;
  CS = Math.floor(Math.min(availW / COLS, availH / (ROWS + 1)));
  bw = CS * COLS; bh = CS * ROWS;
  bx = Math.round((a.W - bw) / 2);
  by = Math.round(a.top + 68 + (availH - bh) / 2);
}
function reset(local){
  board = empty(); turn = 1; win = null; over = 0; falling = null; think = 0; bits = [];
  if (local && table && table.connected) table.again();
}

/* replay the authoritative move list from the room */
function replay(moves){
  board = empty(); win = null; over = 0; falling = null;
  let p = 1;
  for (const c of moves){
    if (drop(board, c, p) < 0) continue;
    const w = winLine(board, p);
    if (w){ win = { line: w, p }; over = 1; break; }
    p = other(p);
  }
  turn = p;
  if (!win && isFull(board)){ over = 1; win = { line: null, p: 0 }; }
}

function celebrate(a){
  for (let k = 0; k < 46; k++){
    const ang = rand(0, 6.3), sp = rand(80, 320);
    bits.push({ x: bx + bw / 2, y: by + bh / 2, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp,
      age: 0, life: rand(.6, 1.2), col: pick([SETS[setIx].a, SETS[setIx].b, '#2D5A3D', '#C9922A']) });
  }
  Sound.ding(); setTimeout(() => Sound.ding(), 140); setTimeout(() => Sound.ding(), 280);
}

function play(c, fromRemote){
  if (over || falling) return;
  if (!canDrop(board, c)){ Sound.tone(190, .08, 'sine', .03, -40); return; }
  if (mode === 'remote' && !fromRemote){
    if (!table || !table.myTurn()) return;
    if (!table.send(c)) return;
    return;                                   // the room echoes it back and replay() lands it
  }
  land(c, turn);
}
function land(c, p){
  const r = drop(board, c, p);
  if (r < 0) return;
  falling = { c, r, p, y: by - CS * .6, vy: 0 };
  Sound.tone(p === 1 ? 520 : 400, .07, 'sine', .04, 90);
}
function settle(){
  const f = falling; falling = null;
  const w = winLine(board, f.p);
  if (w){ win = { line: w, p: f.p }; over = 1; celebrate(); return; }
  if (isFull(board)){ win = { line: null, p: 0 }; over = 1; Sound.tone(330, .3, 'sine', .045, -40); return; }
  turn = other(f.p);
  if ((mode === 'easy' || mode === 'clever') && turn === 2) think = .6;
}

const api = boot({
  title: 'Four in a Row',
  coach: [{ type:'tap', x:.5, y:.35 }, { type:'tap', x:.28, y:.35 }],
  tryReal: { id: 227, name: 'Graph Theory: Königsberg Bridge Problem' },
  onReset(){ reset(true); },
  onResize(a){ layout(a); },
  onDown(x, y){
    if (over){ reset(true); Sound.whoosh(); return; }
    if (think > 0 || falling) return;
    if ((mode === 'easy' || mode === 'clever') && turn === 2) return;
    const c = Math.floor((x - bx) / CS);
    if (c < 0 || c >= COLS) return;
    play(c, false);
  },
  onMove(x, y){
    const c = Math.floor((x - bx) / CS);
    hintCol = (c >= 0 && c < COLS) ? c : -1;
  },
  onUp(){ hintCol = -1; },
  tick(dt, a){
    if (think > 0){
      think -= dt;
      if (think <= 0){
        const c = robotColumn(board, 2, mode === 'clever' ? 'clever' : 'easy');
        if (c >= 0) land(c, 2);
      }
    }
    if (falling){
      falling.vy += 2600 * dt;
      falling.y += falling.vy * dt;
      const restY = by + falling.r * CS + CS / 2;
      if (falling.y >= restY){
        falling.y = restY;
        Sound.tone(160, .09, 'sine', .05, -50);
        settle();
      }
    }
    if (over) over = Math.min(3, over + dt);
    for (const p of bits){ p.age += dt; p.vy += 340*dt; p.x += p.vx*dt; p.y += p.vy*dt; }
    bits = bits.filter(p => p.age < p.life);
    draw(a);
  }
});

function draw(a){
  const ctx = a.ctx;
  ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0, 0, a.W, a.H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // whose turn: a big counter, no words
  const ty = a.top + 34;
  const waiting = mode === 'remote' && table && table.connected && table.seated < 2;
  if (!over){
    const beat = 1 + Math.sin(performance.now() / 260) * .07;
    ctx.globalAlpha = (think > 0 || (mode === 'remote' && !myTurnNow())) ? .45 : 1;
    ctx.fillStyle = colOf(turn);
    ctx.beginPath(); ctx.arc(a.W / 2, ty, CS * .32 * beat, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath(); ctx.arc(a.W / 2 - CS * .1, ty - CS * .1, CS * .09, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    if (waiting){
      ctx.fillStyle = '#8C8278'; ctx.font = '26px system-ui';
      ctx.fillText('⏳', a.W / 2 + CS * .8, ty);
    }
  } else if (win){
    if (win.p){
      ctx.fillStyle = colOf(win.p);
      ctx.beginPath(); ctx.arc(a.W / 2, ty, CS * .34, 0, 7); ctx.fill();
    } else {
      ctx.font = '34px system-ui'; ctx.fillText('🤝', a.W / 2, ty);
    }
  }

  // the column you are about to drop into
  if (hintCol >= 0 && !over && canDrop(board, hintCol)){
    ctx.fillStyle = 'rgba(201,146,42,.16)';
    ctx.fillRect(bx + hintCol * CS, by - CS * .5, CS, bh + CS * .5);
  }

  // the board: a slab with holes punched through it
  ctx.fillStyle = '#2A6B8A';
  ctx.beginPath(); ctx.roundRect(bx - 8, by - 8, bw + 16, bh + 16, 18); ctx.fill();

  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    const cxp = bx + c * CS + CS / 2, cyp = by + r * CS + CS / 2, rad = CS * .40;
    const v = at(board, c, r);
    const isFalling = falling && falling.c === c && falling.r === r;
    ctx.fillStyle = (v && !isFalling) ? colOf(v) : '#F2EDE2';
    ctx.beginPath(); ctx.arc(cxp, cyp, rad, 0, 7); ctx.fill();
    if (v && !isFalling){
      ctx.fillStyle = 'rgba(255,255,255,.34)';
      ctx.beginPath(); ctx.arc(cxp - rad * .3, cyp - rad * .32, rad * .28, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cxp, cyp, rad, 0, 7); ctx.stroke();
    } else if (!v){
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cxp, cyp, rad, 0, 7); ctx.stroke();
    }
  }
  if (falling){
    const cxp = bx + falling.c * CS + CS / 2, rad = CS * .40;
    ctx.fillStyle = colOf(falling.p);
    ctx.beginPath(); ctx.arc(cxp, falling.y, rad, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.34)';
    ctx.beginPath(); ctx.arc(cxp - rad * .3, falling.y - rad * .32, rad * .28, 0, 7); ctx.fill();
  }
  if (win && win.line){
    const k = .5 + Math.sin(performance.now() / 170) * .35;
    ctx.strokeStyle = 'rgba(250,247,240,' + k.toFixed(2) + ')';
    ctx.lineWidth = 7;
    for (const [c, r] of win.line){
      ctx.beginPath();
      ctx.arc(bx + c * CS + CS / 2, by + r * CS + CS / 2, CS * .40, 0, 7);
      ctx.stroke();
    }
  }
  for (const p of bits){
    const k = 1 - p.age / p.life;
    ctx.fillStyle = p.col; ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5 * k + 1, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function myTurnNow(){
  if (mode !== 'remote') return true;
  return !!(table && table.myTurn());
}

layout(api);
api.action('\u{1F504}', 'Play again', '', () => { reset(true); Sound.whoosh(); });

/* ---------- how you want to play ---------- */
api.tray([
  { id:'human',  icon:'\u{1F465}', name:'Two players here' },
  { id:'easy',   icon:'\u{1F916}', name:'Play a robot' },
  { id:'clever', icon:'\u{1F9E0}', name:'Play a clever robot' },
  { id:'remote', icon:'\u{1F4F1}', name:'Play on two devices' }
], id => {
  if (id === 'remote'){ mode = 'remote'; startRemote(); return; }
  if (table) table.leave();
  mode = id; reset(false);
  if (mode !== 'human' && turn === 2) think = .6;
}, 'human');

function startRemote(){
  reset(false);
  if (!sheet){
    sheet = joinSheet({
      onHost: () => connect(null),
      onJoin: code => connect(code)
    });
  }
  sheet.open();
  if (!online()){ sheet.offline(); return; }      // on a plane, say so
  const fromLink = codeFromUrl();
  if (fromLink) connect(fromLink);
}
function connect(code){
  if (!table){
    table = createTable({
      game: 'c4',
      onState: v => {
        mySeat = v.seat;
        replay(v.moves);
        if (win && win.p && !bits.length && over < .2) celebrate();
        if (sheet){
          sheet.showCode(v.code, 'connectfour');
          if (v.seated >= 2){ sheet.status('Both here. Go!'); setTimeout(() => sheet.close(), 900); }
          else sheet.status('Waiting for the other player…');
        }
      },
      onClose: () => { if (sheet) sheet.status('Reconnecting…'); }
    });
  }
  table.connect(code);
}

// arriving from a scanned QR goes straight into the room
if (codeFromUrl()){
  mode = 'remote';
  setTimeout(() => { startRemote(); connect(codeFromUrl()); }, 60);
}

// swap the counter colours
const bar = document.querySelector('.toy-bar');
const swap = document.createElement('button');
swap.className = 'toy-btn';
swap.setAttribute('aria-label', 'Different colours');
swap.textContent = '🎨';
swap.onclick = () => { Sound.unlock(); setIx = (setIx + 1) % SETS.length; Sound.tap(); };
bar.insertBefore(swap, bar.querySelector('#toy-reset'));
