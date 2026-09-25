// 画面に出る文字を含むフォントの分割ファイルだけを取ってきて fonts/ に置く
// 使い方: node tools/build-fonts.mjs
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = ['index.html', ...fs.readdirSync(path.join(root, 'src')).map(f => 'src/' + f)];
const chars = new Set();
for (let c = 0x20; c < 0x7f; c++) chars.add(c);
for (const f of files) for (const ch of fs.readFileSync(path.join(root, f), 'utf8')) { const c = ch.codePointAt(0); if (c > 0x7f) chars.add(c); }
// よく入力される文字（数字・かな・記号）も入れておく
for (let c = 0x3040; c <= 0x30ff; c++) chars.add(c);
for (let c = 0xff01; c <= 0xff5e; c++) chars.add(c);
const FAMS = [
  { pkg: 'zen-kaku-gothic-new', family: 'Zen Kaku Gothic New', weights: [400, 700, 900] },
  { pkg: 'dotgothic16', family: 'DotGothic16', weights: [400] },
];
let css = '/* Zen Kaku Gothic New / DotGothic16 — SIL Open Font License 1.1 (see LICENSE in each folder). Files from @fontsource, unmodified. */\n';
let total = 0, count = 0;
for (const F of FAMS) {
  const dir = path.join(root, 'fonts', F.pkg);
  fs.mkdirSync(dir, { recursive: true });
  for (const w of F.weights) {
    const base = `https://cdn.jsdelivr.net/npm/@fontsource/${F.pkg}@5/`;
    const txt = await (await fetch(`${base}${w}.css`)).text();
    for (const block of txt.split('@font-face').slice(1)) {
      const file = block.match(/files\/([^)]+\.woff2)/)?.[1], range = block.match(/unicode-range:\s*([^;}\n]+)/)?.[1];
      if (!file || !range) continue;
      const parts = range.split(',').map(s => s.trim().replace('U+', '')).map(s => s.includes('-') ? s.split('-').map(h => parseInt(h, 16)) : [parseInt(s, 16), parseInt(s, 16)]);
      let hit = false;
      for (const c of chars) { if (parts.some(([a, b]) => c >= a && c <= b)) { hit = true; break; } }
      if (!hit) continue;
      const buf = Buffer.from(await (await fetch(base + 'files/' + file)).arrayBuffer());
      fs.writeFileSync(path.join(dir, file), buf); total += buf.length; count++;
      css += `@font-face{font-family:'${F.family}';font-style:normal;font-display:swap;font-weight:${w};src:url(./${F.pkg}/${file}) format('woff2');unicode-range:${range.trim()};}\n`;
    }
  }
}
const keep = new Set(css.match(/[\w-]+\.woff2/g));
for (const F of FAMS) { const dir = path.join(root, 'fonts', F.pkg); for (const f of fs.readdirSync(dir)) if (f.endsWith('.woff2') && !keep.has(f)) fs.unlinkSync(path.join(dir, f)); }
fs.writeFileSync(path.join(root, 'fonts', 'fonts.css'), css);
console.log(`chars ${chars.size}, files ${count}, ${(total / 1024 / 1024).toFixed(2)} MB`);
