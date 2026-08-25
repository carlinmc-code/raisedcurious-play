import { boot, Sound, settings, rand, pick, clamp } from '../assets/toy.js?v=e18d652ba5d1';
import { createTable, joinSheet, codeFromUrl, online } from '../assets/table.js?v=e18d652ba5d1';
import { LINES, empty, other, isFull, winLine, robotCell } from './rules.js?v=1';

/* Three in a Row.
   Noughts and crosses, but the pieces are animals so nothing has to be read.
   Two people can share the screen, or one can play a robot. The robot has two
   settings and neither of them is "unbeatable": a perfect noughts-and-crosses
   player never loses, which for a five-year-old is just a wall. The easy robot
   plays well about a third of the time, the clever one most of the time, and
   both can be beaten. No running score is kept between games. */

const PAIRS = [['🐶','🐱'], ['⭐','❤️'], ['🐸','🐝'], ['🚗','🚀'], ['🍎','🍌']];

let cells = empty();                     // 0 empty, 1 first player, 2 second
let turn = 1, winner = 0, winLineIx = null, pairIx = 0;
let opponent = 'human';                  // 'human' | 'easy' | 'clever' | 'remote'
let table = null, sheet = null;
let pop = new Array(9).fill(0), think = 0, over = 0, bits = [];
let S = 100, bx = 0, by = 0;

const tok = p => PAIRS[pairIx][p - 1];

function layout(a){
  const availW = a.W - 32;
  const availH = a.H - a.top - a.bottom - 96;
  S = Math.floor(Math.min(availW, availH) / 3);
  bx = Math.round((a.W - S * 3) / 2);
  by = Math.round(a.top + 74 + (availH - S * 3) / 2);
}
function reset(local){
  if (local && table && table.connected) table.again();
  cells = empty();
  pop = new Array(9).fill(0);
  turn = 1; winner = 0; winLineIx = null; over = 0; think = 0; bits = [];
}

function place(i, p){
  cells[i] = p; pop[i] = .01;
  Sound.tone(p === 1 ? 540 : 400, .1, 'sine', .05, 140);
  const L = winLine(cells, p);
  if (L){
    winner = p; winLineIx = L; over = .01;
    for (let k = 0; k < 40; k++){
      const ang = rand(0, 6.3), sp = rand(70, 300);
      bits.push({ x: bx + S * 1.5, y: by + S * 1.5, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp,
        age: 0, life: rand(.6, 1.2), col: pick(['#C4522A','#C9922A','#2D5A3D','#2A6B8A','#8C5AA8']) });
    }
    Sound.ding(); setTimeout(() => Sound.ding(), 150); setTimeout(() => Sound.ding(), 300);
  } else if (isFull(cells)){
    winner = 3; over = .01;                       // nobody, which is not a loss
    Sound.tone(330, .3, 'sine', .045, -40);
  } else {
    turn = other(p);
    if (opponent === 'easy' || opponent === 'clever'){ if (turn === 2) think = .55; }
  }
}

function robotMove(){
  const i = robotCell(cells, 2, opponent === 'clever' ? 'clever' : 'easy');
  if (i >= 0) place(i, 2);
}

/* replay the room's move list, so both devices agree without trusting either */
function replay(moves){
  cells = empty(); winner = 0; winLineIx = null; over = 0;
  let p = 1;
  for (const i of moves){
    if (i < 0 || i > 8 || cells[i]) continue;
    cells[i] = p; pop[i] = 1;
    const L = winLine(cells, p);
    if (L){ winner = p; winLineIx = L; over = 1; break; }
    p = other(p);
  }
  turn = p;
  if (!winner && isFull(cells)){ winner = 3; over = 1; }
}

/* ---------- shell ---------- */
const api = boot({
  title: 'Three in a Row',
  coach: [{ type:'tap', x:.5, y:.46 }, { type:'tap', x:.24, y:.24 }],
  tryReal: { id: 227, name: 'Graph Theory: Königsberg Bridge Problem' },
  onReset(){ reset(); },
  onResize(a){ layout(a); },
  onDown(x, y){
    if (over){ reset(true); Sound.whoosh(); return; }   // tap anywhere to play again
    if (think > 0) return;
    if ((opponent === 'easy' || opponent === 'clever') && turn === 2) return;
    const c = Math.floor((x - bx) / S), r = Math.floor((y - by) / S);
    if (c < 0 || r < 0 || c > 2 || r > 2) return;
    const i = r * 3 + c;
    if (cells[i]) { Sound.tone(200, .08, 'sine', .03, -40); return; }
    if (opponent === 'remote'){
      if (!table || !table.myTurn()) return;
      table.send(i);                       // the room echoes it back and replay lands it
      return;
    }
    place(i, turn);
  },
  tick(dt, a){
    if (think > 0){ think -= dt; if (think <= 0) robotMove(); }
    if (over) over = Math.min(3, over + dt);
    for (let i = 0; i < 9; i++) if (pop[i] && pop[i] < 1) pop[i] = Math.min(1, pop[i] + dt * 5);
    for (const p of bits){ p.age += dt; p.vy += 340*dt; p.x += p.vx*dt; p.y += p.vy*dt; }
    bits = bits.filter(p => p.age < p.life);
    draw(a);
  }
});

function draw(a){
  const ctx = a.ctx;
  ctx.fillStyle = '#FAF7F0'; ctx.fillRect(0, 0, a.W, a.H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // whose turn, as a big piece rather than a sentence
  const ty = a.top + 38;
  if (!winner){
    const beat = 1 + Math.sin(performance.now() / 260) * .06;
    ctx.globalAlpha = think > 0 ? .55 : 1;
    ctx.font = Math.round(46 * beat) + 'px system-ui';
    ctx.fillText(tok(turn), a.W / 2, ty);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#C9BFAC';
    ctx.beginPath(); ctx.arc(a.W / 2 - 46, ty, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(a.W / 2 + 46, ty, 5, 0, 7); ctx.fill();
  } else {
    ctx.font = '46px system-ui';
    ctx.fillText(winner === 3 ? '🤝' : tok(winner), a.W / 2, ty);
  }

  // board
  ctx.fillStyle = '#F3EDE1';
  ctx.beginPath(); ctx.roundRect(bx - 8, by - 8, S * 3 + 16, S * 3 + 16, 22); ctx.fill();
  ctx.strokeStyle = '#DDD5C8'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let k = 1; k < 3; k++){
    ctx.beginPath(); ctx.moveTo(bx + S*k, by + 12); ctx.lineTo(bx + S*k, by + S*3 - 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 12, by + S*k); ctx.lineTo(bx + S*3 - 12, by + S*k); ctx.stroke();
  }
  for (let i = 0; i < 9; i++){
    if (!cells[i]) continue;
    const c = i % 3, r = (i / 3) | 0;
    const k = pop[i], sc = k < 1 ? .4 + k * .75 : 1 + Math.sin(performance.now()/300 + i) * .012;
    ctx.font = Math.round(S * .58 * sc) + 'px system-ui';
    ctx.fillText(tok(cells[i]), bx + S*c + S/2, by + S*r + S/2);
  }
  if (winLineIx){
    const p0 = winLineIx[0], p2 = winLineIx[2];
    const x0 = bx + (p0 % 3) * S + S/2, y0 = by + ((p0/3)|0) * S + S/2;
    const x2 = bx + (p2 % 3) * S + S/2, y2 = by + ((p2/3)|0) * S + S/2;
    const a2 = .55 + Math.sin(performance.now()/180) * .3;
    ctx.strokeStyle = 'rgba(201,146,42,' + a2.toFixed(2) + ')';
    ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x2, y2); ctx.stroke();
  }
  for (const p of bits){
    const k = 1 - p.age / p.life;
    ctx.fillStyle = p.col; ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5 * k + 1, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

layout(api);
api.action('\u{1F504}', 'Play again', '', () => { reset(true); Sound.whoosh(); });
api.tray([
  { id:'human',  icon:'\u{1F465}', name:'Two players here' },
  { id:'easy',   icon:'\u{1F916}', name:'Play a robot' },
  { id:'clever', icon:'\u{1F9E0}', name:'Play a clever robot' },
  { id:'remote', icon:'\u{1F4F1}', name:'Play on two devices' }
], id => {
  if (id === 'remote'){ opponent = 'remote'; startRemote(); return; }
  if (table) table.leave();
  opponent = id; reset(false);
}, 'human');

function startRemote(){
  reset(false);
  if (!sheet) sheet = joinSheet({ onHost: () => connect(null), onJoin: c => connect(c) });
  sheet.open();
  if (!online()){ sheet.offline(); return; }      // on a plane, say so
  const link = codeFromUrl();
  if (link) connect(link);
}
function connect(code){
  if (!table){
    table = createTable({
      game: 'ttt',
      onState: v => {
        replay(v.moves);
        if (sheet){
          sheet.showCode(v.code, 'tictactoe');
          if (v.seated >= 2){ sheet.status('Both here. Go!'); setTimeout(() => sheet.close(), 900); }
          else sheet.status('Waiting for the other player…');
        }
      },
      onClose: () => { if (sheet) sheet.status('Reconnecting…'); }
    });
  }
  table.connect(code);
}
if (codeFromUrl()){
  opponent = 'remote';
  setTimeout(() => { startRemote(); connect(codeFromUrl()); }, 60);
}

// swap the animals from the top bar
const bar = document.querySelector('.toy-bar');
const swap = document.createElement('button');
swap.className = 'toy-btn';
swap.setAttribute('aria-label', 'Different pieces');
swap.textContent = PAIRS[0][0];
swap.onclick = () => {
  Sound.unlock(); pairIx = (pairIx + 1) % PAIRS.length;
  swap.textContent = PAIRS[pairIx][0]; Sound.tap();
};
bar.insertBefore(swap, bar.querySelector('#toy-reset'));
