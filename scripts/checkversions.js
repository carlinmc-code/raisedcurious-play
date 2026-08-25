#!/usr/bin/env node
/* Every page that loads a shared file must ask for the SAME version of it.
   They drifted once - one game asked for toy.js?v=6 while thirteen asked for
   v5 - which is harmless until the file actually changes and then only some
   of the games get the new one. Cheap to check, so check it. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SHARED = ['toy.js', 'toy.css', 'kit.js', 'kit.css', 'table.js', 'qr.js', 'common.js', 'play.css'];
const seen = {};
/* Only real load paths count. Matching the bare filename also hits every
   mention in a comment, and this file exists to find drift, not prose. */
const REF = /(?:src|href)\s*=\s*["']([^"']+)["']|from\s*['"]([^'"]+)['"]|importScripts\(\s*['"]([^'"]+)['"]/g;
function scan(file){
  const text = fs.readFileSync(file, 'utf8');
  let m;
  REF.lastIndex = 0;
  while ((m = REF.exec(text))){
    const url = m[1] || m[2] || m[3];
    if (!url || /^https?:/.test(url)) continue;
    const base = url.split('?')[0].split('/').pop();
    if (!SHARED.includes(base)) continue;
    const q = url.indexOf('?');
    const v = q < 0 ? '(none)' : url.slice(q);
    seen[base] = seen[base] || {};
    (seen[base][v] = seen[base][v] || []).push(path.relative(ROOT, file));
  }
}
for (const d of fs.readdirSync(ROOT)){
  if (['.git', 'node_modules', 'scripts'].includes(d)) continue;
  const full = path.join(ROOT, d);
  if (fs.statSync(full).isDirectory()){
    for (const f of fs.readdirSync(full))
      if (/\.(html|js)$/.test(f)) scan(path.join(full, f));
  } else if (/^(index\.html|sw\.js)$/.test(d)) scan(full);
}
let bad = 0;
for (const name of Object.keys(seen).sort()){
  const versions = Object.keys(seen[name]);
  if (versions.length > 1){
    bad++;
    console.log('  MISMATCH ' + name);
    for (const v of versions) console.log('    ' + v + '  <- ' + seen[name][v].slice(0, 4).join(', ') +
      (seen[name][v].length > 4 ? ' (+' + (seen[name][v].length - 4) + ')' : ''));
  } else console.log('  ok  ' + name.padEnd(12) + versions[0] + '  (' + seen[name][versions[0]].length + ' refs)');
}
if (bad) console.log('\n' + bad + ' shared file(s) requested at more than one version');
process.exit(bad ? 1 : 0);
