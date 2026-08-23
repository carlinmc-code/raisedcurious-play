/* Four in a Row - the rules, with no drawing and no browser in them.
   Kept separate so both the game and the tests can reason about the same
   board, and so a remote game can replay a list of moves and be certain both
   devices end up with the same position. */

export const COLS = 7, ROWS = 6, NEED = 4;

export const empty = () => new Array(COLS * ROWS).fill(0);
export const at = (b, c, r) => b[r * COLS + c];
export const heightOf = (b, c) => {              // how many counters are already in a column
  let n = 0;
  for (let r = ROWS - 1; r >= 0; r--) if (at(b, c, r)) n++;
  return n;
};
export const canDrop = (b, c) => c >= 0 && c < COLS && !at(b, c, 0);

/* Returns the row the counter lands in, or -1 if the column is full. */
export function drop(b, c, p){
  if (!canDrop(b, c)) return -1;
  for (let r = ROWS - 1; r >= 0; r--){
    if (!at(b, c, r)){ b[r * COLS + c] = p; return r; }
  }
  return -1;
}
/* The four cells that win, or null. */
export function winLine(b, p){
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    if (at(b, c, r) !== p) continue;
    for (const [dc, dr] of dirs){
      const line = [[c, r]];
      for (let k = 1; k < NEED; k++){
        const nc = c + dc * k, nr = r + dr * k;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || at(b, nc, nr) !== p) break;
        line.push([nc, nr]);
      }
      if (line.length === NEED) return line;
    }
  }
  return null;
}
export const isFull = b => b.every(v => v);
export const other = p => (p === 1 ? 2 : 1);

/* ---------- the robot ----------
   Deliberately beatable. A perfect Four in a Row player wins every game it
   moves first in, which is not a toy. 'easy' mostly plays sensibly and
   sometimes just drops one somewhere; 'clever' looks a few moves ahead but
   still misses things on purpose. */
function immediateWin(b, p){
  for (let c = 0; c < COLS; c++){
    if (!canDrop(b, c)) continue;
    const t = b.slice(); drop(t, c, p);
    if (winLine(t, p)) return c;
  }
  return -1;
}
function score(b, p){
  let s = 0;
  const me = p, them = other(p);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    const v = at(b, c, r);
    if (!v) continue;
    const centre = 3 - Math.abs(c - 3);
    s += (v === me ? 1 : -1) * centre;
  }
  return s;
}
function negamax(b, p, depth){
  const w = immediateWin(b, p);
  if (w >= 0) return { col: w, val: 1000 + depth };
  let best = { col: -1, val: -1e9 };
  const order = [3, 2, 4, 1, 5, 0, 6];
  for (const c of order){
    if (!canDrop(b, c)) continue;
    const t = b.slice(); drop(t, c, p);
    let val;
    if (depth <= 1 || isFull(t)) val = score(t, p);
    else {
      const reply = negamax(t, other(p), depth - 1);
      val = -reply.val;
    }
    if (val > best.val) best = { col: c, val };
  }
  if (best.col < 0){
    for (let c = 0; c < COLS; c++) if (canDrop(b, c)) return { col: c, val: 0 };
  }
  return best;
}
export function robotColumn(b, p, level, rnd){
  const R = rnd || Math.random;
  const free = [];
  for (let c = 0; c < COLS; c++) if (canDrop(b, c)) free.push(c);
  if (!free.length) return -1;

  const win = immediateWin(b, p);            if (win >= 0) return win;
  const block = immediateWin(b, other(p));   if (block >= 0 && R() > (level === 'easy' ? .45 : .08)) return block;

  const sloppy = level === 'easy' ? .55 : .18;
  if (R() < sloppy) return free[Math.floor(R() * free.length)];
  return negamax(b.slice(), p, level === 'easy' ? 2 : 4).col;
}
