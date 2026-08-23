/* Three in a Row - the rules, with no drawing and no browser in them.
   Shared by the game and by the tests, and used to replay a remote game's
   move list so both devices reach the same position from the same numbers. */

export const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export const empty = () => new Array(9).fill(0);
export const other = p => (p === 1 ? 2 : 1);
export const isFull = b => b.every(v => v);

export function winLine(b, p){
  for (const L of LINES) if (b[L[0]] === p && b[L[1]] === p && b[L[2]] === p) return L;
  return null;
}
export function winningMove(b, p){
  for (let i = 0; i < 9; i++) if (!b[i]){
    b[i] = p; const w = winLine(b, p); b[i] = 0;
    if (w) return i;
  }
  return -1;
}
export function freeCells(b){
  const f = [];
  for (let i = 0; i < 9; i++) if (!b[i]) f.push(i);
  return f;
}
/* Sensible, not perfect: win, else block, else centre, else a corner.
   A flawless noughts and crosses player never loses, which is a wall rather
   than a game, so robotCell blunders on purpose at a rate set by level. */
export function bestCell(b, p){
  const me = winningMove(b.slice(), p);        if (me >= 0) return me;
  const them = winningMove(b.slice(), other(p)); if (them >= 0) return them;
  if (!b[4]) return 4;
  const corners = [0,2,6,8].filter(i => !b[i]);
  if (corners.length) return corners[0];
  const f = freeCells(b);
  return f.length ? f[0] : -1;
}
export function robotCell(b, p, level, rnd){
  const R = rnd || Math.random;
  const f = freeCells(b);
  if (!f.length) return -1;
  /* A win it can see is always taken. Missing one looks broken to a child
     rather than kind. Being beatable comes from sometimes failing to block,
     and from playing merely-fine squares, never from ignoring three in a row
     it already has. */
  const win = winningMove(b.slice(), p);
  if (win >= 0) return win;
  const block = winningMove(b.slice(), other(p));
  if (block >= 0 && R() > (level === 'easy' ? .45 : .10)) return block;
  const sloppy = level === 'easy' ? .55 : .18;
  if (R() < sloppy) return f[Math.floor(R() * f.length)];
  const c = bestCell(b, p);
  return c >= 0 ? c : f[0];
}
