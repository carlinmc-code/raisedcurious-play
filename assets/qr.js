/* QR encoder - byte mode, EC level M, versions 1 to 10.
   Lifted verbatim from faces.raisedcurious.com, where it was checked
   against a reference encoder on 46 of 46 payloads (mask forced and
   recovered before comparing, since different encoders pick different
   masks for the same data). Do not "tidy" it without re-running that
   comparison: the three bugs it originally had - the EC indicator, the
   bit order of the format field, and the width of its second copy -
   all produced codes that looked right and did not scan. */

/* ---------- QR (byte mode, EC level M, versions 1-10) ----------
   Validated module-for-module against a reference encoder across 46 payloads. */
/* Minimal QR encoder: byte mode, EC level M, versions 1-10.
   Enough for a short join URL, and small enough to inline. */
export function qrMatrix(text, forceMask){
  const EC = 0;                                   // format-info bits for level M are 00 (L is 01)
  // per version: [total codewords, ec codewords per block, group1 blocks, group1 data cw, group2 blocks, group2 data cw]
  const V = [
    null,
    [26,10,1,16,0,0],   [44,16,1,28,0,0],   [70,26,1,44,0,0],   [100,18,2,32,0,0],
    [134,24,2,43,0,0],  [172,16,4,27,0,0],  [196,18,4,31,0,0],  [242,22,2,38,2,39],
    [292,22,3,36,2,37], [346,26,4,43,1,44]
  ];
  const ALIGN = [null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];

  const bytes = [];
  for (const ch of unescape(encodeURIComponent(text))) bytes.push(ch.charCodeAt(0));

  let ver = 0;
  for (let v = 1; v <= 10; v++){
    const [, ecw, g1, d1, g2, d2] = V[v];
    const cap = g1 * d1 + g2 * d2;
    const cc = v < 10 ? 8 : 16;
    if (4 + cc + bytes.length * 8 <= cap * 8){ ver = v; break; }
  }
  if (!ver) return null;
  const [, ecw, g1, d1, g2, d2] = V[ver];
  const dataCw = g1 * d1 + g2 * d2;

  // ---- bit stream ----
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  for (let i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8){
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  const PAD = [0xEC, 0x11];
  for (let i = 0; data.length < dataCw; i++) data.push(PAD[i % 2]);

  // ---- GF(256) ----
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++){ EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  function gen(n){
    let p = [1];
    for (let i = 0; i < n; i++){
      const q = [1, EXP[i]], r = new Array(p.length + 1).fill(0);
      for (let a = 0; a < p.length; a++) for (let b = 0; b < 2; b++) r[a + b] ^= mul(p[a], q[b]);
      p = r;
    }
    return p;
  }
  function rs(block, n){
    const g = gen(n), res = block.concat(new Array(n).fill(0));
    for (let i = 0; i < block.length; i++){
      const c = res[i]; if (!c) continue;
      for (let j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], c);
    }
    return res.slice(block.length);
  }

  // ---- blocks + interleave ----
  const blocks = [], ecs = [];
  let pos = 0;
  for (let i = 0; i < g1; i++){ blocks.push(data.slice(pos, pos + d1)); pos += d1; }
  for (let i = 0; i < g2; i++){ blocks.push(data.slice(pos, pos + d2)); pos += d2; }
  for (const b of blocks) ecs.push(rs(b, ecw));
  const out = [];
  const maxD = Math.max(d1, d2 || 0);
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecw; i++) for (const e of ecs) out.push(e[i]);

  // ---- matrix ----
  const n = ver * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const set = (r, c, v) => { if (r >= 0 && r < n && c >= 0 && c < n) m[r][c] = v; };
  function finder(r, c){
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++){
      const inRing = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) || (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6));
      const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      set(r + dr, c + dc, inRing || inCore ? 1 : 0);
    }
  }
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++){ m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; }
  for (const r of ALIGN[ver]) for (const c of ALIGN[ver]){
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
      m[r + dr][c + dc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
  }
  m[n - 8][8] = 1;                                  // dark module
  const reserve = [];
  for (let i = 0; i < 9; i++){ reserve.push([8, i], [i, 8]); }
  for (let i = 0; i < 8; i++){ reserve.push([8, n - 1 - i], [n - 1 - i, 8]); }
  for (const [r, c] of reserve) if (m[r][c] === null) m[r][c] = 0;
  if (ver >= 7){
    const vbits = (() => { let d = ver << 12, g = 0x1f25;
      for (let i = 17; i >= 12; i--) if ((d >> i) & 1) d ^= g << (i - 12);
      return (ver << 12) | d; })();
    for (let i = 0; i < 18; i++){
      const b = (vbits >> i) & 1;
      m[Math.floor(i / 3)][n - 11 + (i % 3)] = b;
      m[n - 11 + (i % 3)][Math.floor(i / 3)] = b;
    }
  }
  // zigzag placement
  const free = (r, c) => m[r][c] === null;
  let bi = 0, up = true;
  for (let col = n - 1; col > 0; col -= 2){
    if (col === 6) col--;
    for (let k = 0; k < n; k++){
      const row = up ? n - 1 - k : k;
      for (const c of [col, col - 1]){
        if (!free(row, c)) continue;
        const bit = bi < out.length * 8 ? (out[bi >> 3] >> (7 - (bi & 7))) & 1 : 0;
        m[row][c] = bit; bi++;
      }
    }
    up = !up;
  }
  // masks
  const MASK = [
    (r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];
  const isFunc = Array.from({ length: n }, () => new Array(n).fill(false));
  { // recompute which cells are function modules
    const t = Array.from({ length: n }, () => new Array(n).fill(null));
    const s2 = (r, c, v) => { if (r >= 0 && r < n && c >= 0 && c < n) t[r][c] = v; };
    const f2 = (r, c) => { for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) s2(r + dr, c + dc, 1); };
    f2(0, 0); f2(0, n - 7); f2(n - 7, 0);
    for (let i = 0; i < n; i++){ t[6][i] = 1; t[i][6] = 1; }
    for (const r of ALIGN[ver]) for (const c of ALIGN[ver]){
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) t[r + dr][c + dc] = 1;
    }
    for (let i = 0; i < 9; i++){ s2(8, i, 1); s2(i, 8, 1); }
    for (let i = 0; i < 8; i++){ s2(8, n - 1 - i, 1); s2(n - 1 - i, 8, 1); }
    if (ver >= 7) for (let i = 0; i < 18; i++){
      t[Math.floor(i / 3)][n - 11 + (i % 3)] = 1; t[n - 11 + (i % 3)][Math.floor(i / 3)] = 1;
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) isFunc[r][c] = t[r][c] === 1;
  }
  function penalty(g){
    let p = 0;
    for (let r = 0; r < n; r++) for (let run = 1, c = 1; c <= n; c++){
      if (c < n && g[r][c] === g[r][c - 1]) run++;
      else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    for (let c = 0; c < n; c++) for (let run = 1, r = 1; r <= n; r++){
      if (r < n && g[r][c] === g[r - 1][c]) run++;
      else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++)
      if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
    const pat = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    for (let r = 0; r < n; r++) for (let c = 0; c + 11 <= n; c++){
      let a = true, b = true;
      for (let i = 0; i < 11; i++){ if (g[r][c + i] !== pat[i]) a = false; if (g[r][c + i] !== pat2[i]) b = false; }
      if (a || b) p += 40;
    }
    for (let c = 0; c < n; c++) for (let r = 0; r + 11 <= n; r++){
      let a = true, b = true;
      for (let i = 0; i < 11; i++){ if (g[r + i][c] !== pat[i]) a = false; if (g[r + i][c] !== pat2[i]) b = false; }
      if (a || b) p += 40;
    }
    let dark = 0; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += g[r][c];
    p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }
  const FMT = mk => { let d = ((EC << 3) | mk) << 10, g = 0x537;
    for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= g << (i - 10);
    return ((((EC << 3) | mk) << 10) | d) ^ 0x5412; };
  let best = null, bestP = Infinity;
  for (let mk = (forceMask == null ? 0 : forceMask); mk < (forceMask == null ? 8 : forceMask + 1); mk++){
    const g = m.map(row => row.slice());
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (!isFunc[r][c] && MASK[mk](r, c)) g[r][c] ^= 1;
    const f = FMT(mk);
    for (let i = 0; i < 15; i++){
      const b = (f >> (14 - i)) & 1;   // bit 0 of the format string is the MSB
      if (i < 6) g[8][i] = b; else if (i < 8) g[8][i + 1] = b;
      else if (i === 8) g[7][8] = b; else g[14 - i][8] = b;
      if (i < 7) g[n - 1 - i][8] = b; else g[8][n - 15 + i] = b;   // 7 bits up the column, 8 along the row
    }
    g[n - 8][8] = 1;
    const p = penalty(g);
    if (p < bestP){ bestP = p; best = g; }
  }
  return best;
}

export function drawQR(text, px){
  const m = qrMatrix(text);
  if (!m) return null;
  const n = m.length, quiet = 4, size = (n + quiet * 2) * px;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  cv.style.width = cv.style.height = Math.min(size, 260) + 'px';
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, size, size);
  c.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++)
    if (m[r][col]) c.fillRect((col + quiet) * px, (r + quiet) * px, px, px);
  return cv;
}
