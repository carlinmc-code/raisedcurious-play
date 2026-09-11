#!/usr/bin/env node
/* Generates the app icons and the iOS launch images.

   iOS will not use the manifest's background_color for a launch screen. If
   there is no apple-touch-startup-image matching the exact device, you get a
   white flash before the page paints, which is the single thing that makes an
   installed web app feel like a saved bookmark rather than an app. The images
   are flat colour with the mark centred, so they compress to almost nothing.

   Run: node scripts/icons.js      (writes assets/icons/, prints the <link> tags)
*/
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.resolve(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const CREAM = [0xFA, 0xF7, 0xF0], FOREST = [0x2D, 0x5A, 0x3D];
const RUST = [0xC4, 0x52, 0x2A], GOLD = [0xC9, 0x92, 0x2A];

/* ---- a minimal PNG writer: RGB, no filtering ---- */
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf){
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(file, w, h, px){
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++){
    raw[o++] = 0;                                  // filter: none
    for (let x = 0; x < w; x++){
      const p = px[y][x];
      raw[o++] = p[0]; raw[o++] = p[1]; raw[o++] = p[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

/* ---- the mark: three counters, the way the arcade tiles read ---- */
function canvas(w, h, bg){
  const px = new Array(h);
  for (let y = 0; y < h; y++){
    px[y] = new Array(w);
    for (let x = 0; x < w; x++) px[y][x] = bg.slice();
  }
  return px;
}
function disc(px, cx, cy, r, col){
  const h = px.length, w = px[0].length;
  for (let y = Math.max(0, (cy - r - 1) | 0); y < Math.min(h, (cy + r + 2) | 0); y++){
    for (let x = Math.max(0, (cx - r - 1) | 0); x < Math.min(w, (cx + r + 2) | 0); x++){
      const d = Math.hypot(x + .5 - cx, y + .5 - cy);
      if (d <= r) px[y][x] = col.slice();
      else if (d <= r + 1){                        // one pixel of feather, so it is not jagged
        const a = r + 1 - d, q = px[y][x];
        px[y][x] = [0, 1, 2].map(i => Math.round(q[i] * (1 - a) + col[i] * a));
      }
    }
  }
}
function roundedSquare(px, pad, radius, col){
  const h = px.length, w = px[0].length;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const fx = x + .5, fy = y + .5;
    if (fx < pad || fy < pad || fx > w - pad || fy > h - pad) continue;
    const ix0 = pad + radius, iy0 = pad + radius, ix1 = w - pad - radius, iy1 = h - pad - radius;
    const qx = Math.min(Math.max(fx, ix0), ix1), qy = Math.min(Math.max(fy, iy0), iy1);
    if ((fx - qx) ** 2 + (fy - qy) ** 2 <= radius * radius) px[y][x] = col.slice();
  }
}
function mark(px, cx, cy, unit){
  disc(px, cx - unit * .52, cy - unit * .30, unit * .54, GOLD);
  disc(px, cx + unit * .52, cy - unit * .30, unit * .54, RUST);
  disc(px, cx, cy + unit * .62, unit * .62, CREAM);
}

/* ---- icons ---- */
function icon(size, maskable){
  const px = canvas(size, size, CREAM);
  roundedSquare(px, maskable ? 0 : size * .06, size * .22, FOREST);
  mark(px, size / 2, size * .48, size * .25);
  return px;
}
const wrote = [];
for (const [size, name] of [[192,'icon-192.png'], [512,'icon-512.png'], [180,'apple-touch-icon.png']])
  wrote.push([name, writePNG(path.join(OUT, name), size, size, icon(size, false))]);
wrote.push(['icon-maskable-512.png',
  writePNG(path.join(OUT, 'icon-maskable-512.png'), 512, 512, icon(512, true))]);

/* ---- launch images ----
   iOS matches on exact CSS width, height and pixel ratio, per orientation. A
   device with no match simply falls back to the white flash, which is what
   happens today, so an incomplete list costs nothing. */
const DEVICES = [
  [375, 667, 2, 'iPhone SE, 8'],
  [390, 844, 3, 'iPhone 12, 13, 14'],
  [393, 852, 3, 'iPhone 14 Pro, 15, 16'],
  [402, 874, 3, 'iPhone 16 Pro'],
  [414, 896, 2, 'iPhone XR, 11'],
  [428, 926, 3, 'iPhone 12-14 Pro Max'],
  [430, 932, 3, 'iPhone 15, 16 Plus'],
  [440, 956, 3, 'iPhone 16 Pro Max'],
  [744, 1133, 2, 'iPad mini'],
  [768, 1024, 2, 'iPad 9.7'],
  [810, 1080, 2, 'iPad 10.2'],
  [820, 1180, 2, 'iPad Air'],
  [834, 1194, 2, 'iPad Pro 11'],
  [1024, 1366, 2, 'iPad Pro 12.9']
];
const links = [];
let splashBytes = 0;
for (const [cw, ch, dpr, label] of DEVICES){
  for (const orient of ['portrait', 'landscape']){
    const w = (orient === 'portrait' ? cw : ch) * dpr;
    const h = (orient === 'portrait' ? ch : cw) * dpr;
    const px = canvas(w, h, CREAM);
    mark(px, w / 2, h / 2, Math.min(w, h) * .13);
    const name = 'splash-' + cw + 'x' + ch + '-' + dpr + 'x-' + orient + '.png';
    splashBytes += writePNG(path.join(OUT, name), w, h, px);
    links.push('<link rel="apple-touch-startup-image" href="/assets/icons/' + name +
      '" media="(device-width:' + cw + 'px) and (device-height:' + ch +
      'px) and (-webkit-device-pixel-ratio:' + dpr + ') and (orientation:' + orient + ')">');
  }
}
fs.writeFileSync(path.join(OUT, 'startup-links.html'), links.join('\n') + '\n');

for (const [n, b] of wrote) console.log('  ' + n.padEnd(24) + (b / 1024).toFixed(1) + ' KB');
console.log('  ' + String(DEVICES.length * 2).padEnd(3) + ' launch images'.padEnd(21) +
            (splashBytes / 1024).toFixed(0) + ' KB total');
console.log('  startup-links.html written; paste into the hub <head>');
