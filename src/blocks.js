// ブロックとアイテムの定義、16×16のドット絵（すべてコードで描く）
export const TS = 16, AT = 16; // アトラス 256px

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const cl = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
class Tile {
  constructor(seed) { this.px = new Uint8ClampedArray(TS * TS * 4); this.r = rng(seed); }
  set(x, y, [r, g, b], a = 255) { if (x < 0 || y < 0 || x >= TS || y >= TS) return; const i = (y * TS + x) * 4; this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b; this.px[i + 3] = a; }
  j([r, g, b], n) { const d = (this.r() - 0.5) * 2 * n; return [cl(r + d), cl(g + d), cl(b + d)]; }
  fill(c, n = 0) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) this.set(x, y, this.j(c, n)); return this; }
  speck(c, p, n = 0) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (this.r() < p) this.set(x, y, this.j(c, n)); return this; }
  rect(x0, y0, w, h, c, n = 0) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, this.j(c, n)); return this; }
  clear() { this.px.fill(0); return this; }
  // ドット絵を文字列で描く
  art(rows, pal) { rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) this.set(x, y, this.j(pal[ch], 6)); })); return this; }
}
const T = {}; let seedN = 1;
function def(name, draw) { const t = new Tile(seedN++ * 7919); draw(t); T[name] = t; }

// ---- 地形のブロック ----
const GR = [96, 158, 62];
def('grass_top', t => t.fill(GR, 14).speck([80, 138, 50], 0.3, 8).speck([124, 176, 80], 0.1, 8));
def('dirt', t => t.fill([134, 96, 66], 12).speck([108, 76, 52], 0.25, 8).speck([156, 118, 84], 0.1, 8));
def('grass_side', t => { t.fill([134, 96, 66], 12).speck([108, 76, 52], 0.25, 8); for (let x = 0; x < TS; x++) { const d = 3 + (t.r() * 3 | 0); for (let y = 0; y < d; y++) t.set(x, y, t.j(GR, 14)); } });
def('stone', t => t.fill([126, 126, 126], 10).speck([104, 104, 104], 0.25, 6).speck([150, 150, 150], 0.1, 6));
def('cobble', t => { t.fill([118, 118, 118], 14); for (let i = 0; i < 9; i++) { const x = t.r() * 13 | 0, y = t.r() * 13 | 0; t.rect(x, y, 4, 3, [146, 146, 146], 12); } for (let i = 0; i < 40; i++) t.set(t.r() * 16 | 0, t.r() * 16 | 0, [80, 80, 80]); });
def('bedrock', t => t.fill([58, 58, 60], 22).speck([28, 28, 30], 0.35, 6));
def('sand', t => t.fill([220, 206, 150], 10).speck([198, 184, 132], 0.25, 6));
def('snow', t => t.fill([240, 244, 250], 6).speck([220, 228, 238], 0.2, 4));
def('water', t => { t.fill([52, 96, 190], 8); for (let i = 0; i < 10; i++) { const x = t.r() * 12 | 0, y = t.r() * 16 | 0; for (let k = 0; k < 4; k++) t.set(x + k, y, [96, 140, 220]); } });
def('log_side', t => { t.fill([104, 80, 50], 8); for (let x = 0; x < TS; x += 3) for (let y = 0; y < TS; y++) if (t.r() < 0.7) t.set(x, y, [78, 58, 36]); });
def('log_top', t => { t.fill([168, 134, 86], 6); for (const r of [2, 4, 6]) for (let a = 0; a < 48; a++) t.set(8 + Math.round(Math.cos(a / 48 * 6.283) * r), 8 + Math.round(Math.sin(a / 48 * 6.283) * r), [128, 98, 60]); t.rect(0, 0, 16, 1, [104, 80, 50]); t.rect(0, 15, 16, 1, [104, 80, 50]); t.rect(0, 0, 1, 16, [104, 80, 50]); t.rect(15, 0, 1, 16, [104, 80, 50]); });
def('leaves', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { if (t.r() < 0.14) { t.set(x, y, [0, 0, 0], 0); continue; } t.set(x, y, t.j(t.r() < 0.35 ? [50, 104, 38] : [66, 128, 48], 14)); } });
def('planks', t => { t.fill([176, 138, 86], 8); for (let y = 3; y < TS; y += 4) for (let x = 0; x < TS; x++) t.set(x, y, [130, 98, 58]); for (let r = 0; r < 4; r++) { const x = (r * 7 + 3) % 16; for (let y = r * 4; y < r * 4 + 3; y++) t.set(x, y, [142, 108, 66]); } });
function ore(c) { return t => { T.stone.px.forEach((v, i) => t.px[i] = v); for (let i = 0; i < 6; i++) { const x = 1 + t.r() * 12 | 0, y = 1 + t.r() * 12 | 0; t.rect(x, y, 2, 2, c, 16); t.set(x + 2, y + 1, t.j(c, 16)); } }; }
def('coal_ore', ore([36, 36, 38]));
def('iron_ore', ore([214, 170, 130]));
def('gem_ore', ore([80, 220, 230]));
def('table_top', t => { t.fill([176, 138, 86], 8); t.rect(0, 0, 16, 2, [110, 80, 46]); t.rect(0, 14, 16, 2, [110, 80, 46]); t.rect(0, 0, 2, 16, [110, 80, 46]); t.rect(14, 0, 2, 16, [110, 80, 46]); t.rect(7, 2, 2, 12, [130, 98, 58]); t.rect(2, 7, 12, 2, [130, 98, 58]); });
def('table_side', t => { t.fill([150, 112, 66], 8); t.rect(0, 0, 16, 3, [110, 80, 46]); t.rect(3, 5, 3, 7, [90, 90, 96]); t.rect(4, 4, 1, 2, [160, 160, 170]); t.rect(10, 5, 2, 8, [120, 86, 50]); t.rect(9, 4, 4, 2, [170, 170, 176]); });
def('furnace_side', t => { T.cobble.px.forEach((v, i) => t.px[i] = v); });
def('furnace_front', t => { T.cobble.px.forEach((v, i) => t.px[i] = v); t.rect(4, 8, 8, 5, [30, 26, 24]); t.rect(5, 10, 6, 2, [240, 140, 40], 20); t.rect(4, 3, 8, 2, [70, 70, 70]); });

def('chest_top', t => { t.fill([150, 106, 58], 8); t.rect(0, 0, 16, 1, [96, 66, 34]); t.rect(0, 15, 16, 1, [96, 66, 34]); t.rect(0, 0, 1, 16, [96, 66, 34]); t.rect(15, 0, 1, 16, [96, 66, 34]); for (let y = 2; y < 14; y += 4) t.rect(1, y, 14, 1, [122, 84, 44]); t.rect(6, 0, 4, 3, [110, 92, 40]); t.rect(7, 0, 2, 2, [196, 168, 70]); });
def('chest_front', t => { t.fill([150, 106, 58], 8); t.rect(0, 0, 16, 1, [96, 66, 34]); t.rect(0, 15, 16, 1, [96, 66, 34]); t.rect(0, 0, 1, 16, [96, 66, 34]); t.rect(15, 0, 1, 16, [96, 66, 34]); t.rect(1, 5, 14, 1, [96, 66, 34]); t.rect(1, 6, 14, 1, [122, 84, 44]); t.rect(6, 4, 4, 5, [110, 92, 40]); t.rect(7, 6, 2, 3, [60, 46, 22]); t.rect(7, 4, 2, 2, [214, 188, 90]); });
def('shield', t => t.clear().art(['....wwwwwwww....', '...wWWWWWWWWw...', '..wWWWWWWWWWWw..', '..wWWrrrrrrWWw..', '..wWWrRRRRrWWw..', '..wWWrRiiRrWWw..', '..wWWrRiiRrWWw..', '..wWWrRRRRrWWw..', '..wWWrrrrrrWWw..', '..wWWWWWWWWWWw..', '...wWWWWWWWWw...', '....wWWWWWWw....', '.....wWWWWw.....', '......wWWw......', '.......ww.......', '................'], { w: [92, 64, 34], W: [150, 106, 58], r: [120, 84, 44], R: [196, 60, 50], i: [232, 232, 240] }));
def('gravel', t => { t.fill([150, 138, 130], 10); for (let i = 0; i < 46; i++) { const x = t.r() * 15 | 0, y = t.r() * 15 | 0, c = [[104, 94, 90], [186, 176, 168], [130, 112, 100], [96, 104, 110]][t.r() * 4 | 0]; t.rect(x, y, 2, 2, c, 8); } });
def('glass', t => { t.clear(); for (let i = 0; i < TS; i++) { t.set(i, 0, [220, 240, 250], 230); t.set(i, 15, [220, 240, 250], 230); t.set(0, i, [220, 240, 250], 230); t.set(15, i, [220, 240, 250], 230); } for (let i = 3; i < 7; i++) t.set(i, 9 - i, [255, 255, 255], 200); for (let i = 9; i < 12; i++) t.set(i, 20 - i, [255, 255, 255], 200); });
def('cobweb', t => { t.clear(); const c = [236, 236, 240]; for (let i = 0; i < 16; i++) { t.set(i, i, c, 220); t.set(15 - i, i, c, 220); t.set(8, i, c, 200); t.set(i, 8, c, 200); } for (const r of [3, 6]) for (let a = 0; a < 40; a++) t.set(8 + Math.round(Math.cos(a / 40 * 6.283) * r), 8 + Math.round(Math.sin(a / 40 * 6.283) * r), c, 190); });

def('tallgrass', t => { t.clear(); for (let k = 0; k < 7; k++) { let x = 2 + (t.r() * 12 | 0); for (let y = 15; y > 4 + t.r() * 6; y--) { t.set(x, y, t.j([84, 150, 56], 18)); if (t.r() < 0.3) x += t.r() < 0.5 ? -1 : 1; x = Math.max(0, Math.min(15, x)); } } });
def('flower_red', t => { t.clear(); for (let y = 8; y < 16; y++) t.set(7, y, [60, 130, 40]); t.set(6, 12, [60, 130, 40]); t.set(5, 11, [60, 130, 40]); t.rect(5, 4, 5, 4, [210, 30, 30], 14); t.rect(6, 5, 3, 2, [60, 20, 20]); });
def('flower_yellow', t => { t.clear(); for (let y = 9; y < 16; y++) t.set(8, y, [60, 130, 40]); t.set(9, 12, [60, 130, 40]); t.rect(6, 5, 5, 4, [240, 210, 40], 14); t.rect(7, 6, 3, 2, [250, 240, 120]); });

// ---- アイテムの絵 ----
const PAL = { w: [[176, 138, 86], [120, 90, 52]], s: [[150, 150, 150], [96, 96, 96]], i: [[232, 232, 236], [160, 160, 168]], d: [[110, 238, 232], [36, 160, 170]] };
const HANDLE = { h: [140, 100, 56], H: [92, 64, 34] };
function toolArt(rows) { return m => t => t.clear().art(rows, { m: PAL[m][0], M: PAL[m][1], ...HANDLE }); }
const ART = {
  sword: toolArt(['.............MMM', '............MmmM', '...........MmmM.', '..........MmmM..', '.........MmmM...', '........MmmM....', '.......MmmM.....', '..MM..MmmM......', '..MmMMmmM.......', '...MmmmM........', '....MmM.........', '...hHMmM........', '..hHh.MM........', '.hHh............', 'MHh.............', 'MM..............']),
  pick: toolArt(['....MMMMMM......', '...MmmmmmmMM....', '..MmMMMMMmmmM...', '..MM....hHMmmM..', '........hH.MmM..', '.......hH...MmM.', '......hH....MMM.', '.....hH......M..', '....hH..........', '...hH...........', '..hH............', '.hH.............', 'hH..............', 'H...............', '................', '................']),
  axe: toolArt(['.......MMM......', '......MmmmM.....', '.....MmmmmhH....', '.....MmmmhH.....', '......MMhH......', '.......hH.......', '......hH........', '.....hH.........', '....hH..........', '...hH...........', '..hH............', '.hH.............', 'hH..............', 'H...............', '................', '................']),
  shovel: toolArt(['...........MMM..', '..........MmmmM.', '.........MmmmmM.', '.........MmmmM..', '........hHMMM...', '.......hH.......', '......hH........', '.....hH.........', '....hH..........', '...hH...........', '..hH............', '.hH.............', 'hH..............', 'H...............', '................', '................']),
  helmet: toolArt(['', '', '....MMMMMMMM....', '...MmmmmmmmmmM..', '..MmmmmmmmmmmmM.', '..MmMMMMMMMMMmM.', '..MmM.......MmM.', '..MMM.......MMM.', '', '', '', '', '', '', '', ''].map(r => r.padEnd(16, '.'))),
  chest: toolArt(['', '..MMM.....MMM...', '.MmmMMMMMMMmmM..', '.MmmmmmmmmmmmM..', '.MMmmmmmmmmmMM..', '..MmmmmmmmmmM...', '..MmmmmmmmmmM...', '..MmmmmmmmmmM...', '..MmmmmmmmmmM...', '..MMMMMMMMMMM...', '', '', '', '', '', ''].map(r => r.padEnd(16, '.'))),
  legs: toolArt(['', '...MMMMMMMMMM...', '...MmmmmmmmmM...', '...MmmmMMmmmM...', '...MmmM..MmmM...', '...MmmM..MmmM...', '...MmmM..MmmM...', '...MmmM..MmmM...', '...MmmM..MmmM...', '...MMMM..MMMM...', '', '', '', '', '', ''].map(r => r.padEnd(16, '.'))),
  boots: toolArt(['', '', '', '', '', '...MMM....MMM...', '...MmM....MmM...', '...MmM....MmM...', '..MMmM...MMmM...', '.MmmmM..MmmmM...', '.MMMMM..MMMMM...', '', '', '', '', ''].map(r => r.padEnd(16, '.'))),
};
for (const m of ['w', 's', 'i', 'd']) for (const k of ['sword', 'pick', 'axe', 'shovel']) def(`${k}_${m}`, ART[k](m));
for (const m of ['i', 'd']) for (const k of ['helmet', 'chest', 'legs', 'boots']) def(`${k}_${m}`, ART[k](m));
def('stick', t => t.clear().art(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''].map((_, y) => [...'................'].map((c, x) => x + y === 15 && x > 2 && x < 13 ? 'h' : x + y === 16 && x > 3 && x < 14 ? 'H' : '.').join('')), HANDLE));
def('coal', t => t.clear().art(['', '', '.....kkkk.......', '....kKKKkk......', '...kKKkkkkk.....', '...kKkkkkkkk....', '..kkkkkkkkkk....', '..kkkkkkkkkkk...', '..kkkkkkkkkk....', '...kkkkkkkk.....', '....kkkkkk......', '.....kkkk.......', '', '', '', ''].map(r => r.padEnd(16, '.')), { k: [40, 40, 44], K: [96, 96, 104] }));
def('iron', t => t.clear().art(['', '', '', '', '....iiiiiiii....', '...iIIIIIIIIi...', '..iIIIIIIIIIIi..', '..iiiiiiiiiiii..', '..IIIIIIIIIIII..', '...IIIIIIIIII...', '', '', '', '', '', ''].map(r => r.padEnd(16, '.')), { i: [240, 240, 244], I: [176, 176, 184] }));
def('diamond', t => t.clear().art(['', '', '....dddddd......', '...dDdddddDd....', '..dDddddddddd...', '..ddddddddDdd...', '...ddddddDdd....', '....ddddDdd.....', '.....dddd.......', '......dd........', '', '', '', '', '', ''].map(r => r.padEnd(16, '.')), { d: [110, 238, 232], D: [228, 255, 255] }));
def('flint', t => t.clear().art(['', '', '......ff........', '.....fFff.......', '....fFffff......', '....ffffffF.....', '...fffffffff....', '...ffffffffF....', '....fffffff.....', '.....fffff......', '......fff.......', '', '', '', '', ''].map(r => r.padEnd(16, '.')), { f: [60, 60, 64], F: [130, 130, 136] }));
def('string', t => t.clear().art(['', '...........ss...', '..........s..s..', '.........s...s..', '........s...s...', '.......s...s....', '......s...s.....', '.....s...s......', '....s...s.......', '...s...s........', '..s..ss.........', '..sss...........', '', '', '', ''].map(r => r.padEnd(16, '.')), { s: [236, 236, 240] }));
def('apple', t => t.clear().art(['', '.......h........', '......hh.ll.....', '.......hlll.....', '....rrrhrrr.....', '...rrRrrrrrr....', '..rrRRrrrrrrr...', '..rrRrrrrrrrr...', '..rrrrrrrrrrr...', '..rrrrrrrrrrr...', '...rrrrrrrrr....', '....rrrrrrr.....', '.....rr.rr......', '', '', ''].map(r => r.padEnd(16, '.')), { r: [210, 40, 40], R: [250, 150, 150], h: [90, 60, 30], l: [70, 150, 50] }));
def('bow', t => t.clear().art(['..........HHH...', '........HH..s...', '.......H....s...', '......H.....s...', '.....H......s...', '....H.......s...', '...H........s...', '..H.........s...', '..H........s....', '..H.......s.....', '...H.....s......', '....H...s.......', '.....H.s........', '......Hs........', '.......H........', '................'], { ...HANDLE, s: [236, 236, 240] }));
def('arrow', t => t.clear().art(['...........sss..', '............Ss..', '...........S.s..', '..........h.....', '.........h......', '........h.......', '.......h........', '......h.........', '.....h..........', '....h...........', '..fh............', '.ff.............', 'fff.............', '.f..............', '................', '................'], { h: HANDLE.h, s: [200, 200, 200], S: [120, 120, 120], f: [240, 240, 240] }));
// アイテムの絵に陰影をつける（右下の縁を暗く、左上の縁を明るく、外周に濃い輪郭）
function shadeItem(t) {
  const A = (x, y) => x >= 0 && y >= 0 && x < TS && y < TS && t.px[(y * TS + x) * 4 + 3] > 127;
  const src = new Uint8ClampedArray(t.px);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const i = (y * TS + x) * 4; if (src[i + 3] < 128) continue;
    let k = 1;
    if (!A(x + 1, y) || !A(x, y + 1)) k = 0.62; else if (!A(x - 1, y) || !A(x, y - 1)) k = 1.18;
    for (let c = 0; c < 3; c++) t.px[i + c] = Math.min(255, src[i + c] * k);
  }
}
for (const n of Object.keys(T)) if (/^(sword|pick|axe|shovel|helmet|chest|legs|boots)_|^(stick|coal|iron|diamond|flint|apple|bow|arrow|string|shield)$/.test(n)) shadeItem(T[n]);
def('border', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [255, 60, 60], ((x + y) % 8 < 3) ? 150 : 40); });

// ---- ブロック ----
export const BLOCKS = [null]; export const B = {};
function block(name, faces, o = {}) {
  const id = BLOCKS.length; const f = typeof faces === 'string' ? [faces, faces, faces] : faces;
  BLOCKS.push({ id, name, faces: f, solid: true, cut: false, water: false, hard: 1, tool: null, level: 0, drop: name, sound: 'stone', ...o }); B[name] = id; return id;
}
// hard：硬さ、tool：適した道具、level：必要な道具の段階（1木 2石 3鉄）
block('bedrock', 'bedrock', { hard: Infinity });
block('stone', 'stone', { hard: 1.5, tool: 'pick', level: 1, drop: 'cobble' });
block('dirt', 'dirt', { hard: 0.5, tool: 'shovel', sound: 'dirt' });
block('grass', ['grass_top', 'grass_side', 'dirt'], { hard: 0.6, tool: 'shovel', drop: 'dirt', sound: 'grass' });
block('sand', 'sand', { hard: 0.5, tool: 'shovel', sound: 'dirt' });
block('gravel', 'gravel', { hard: 0.6, tool: 'shovel', sound: 'gravel' });
block('snow', ['snow', 'snow', 'dirt'], { hard: 0.5, tool: 'shovel', drop: 'dirt', sound: 'dirt' });
block('water', 'water', { solid: false, water: true, hard: Infinity });
block('log', ['log_top', 'log_side', 'log_top'], { hard: 2, tool: 'axe', sound: 'wood' });
block('leaves', 'leaves', { cut: true, hard: 0.2, drop: null, sound: 'grass' });
block('planks', 'planks', { hard: 2, tool: 'axe', sound: 'wood' });
block('cobble', 'cobble', { hard: 2, tool: 'pick', level: 1 });
block('coal_ore', 'coal_ore', { hard: 3, tool: 'pick', level: 1, drop: 'coal' });
block('iron_ore', 'iron_ore', { hard: 3, tool: 'pick', level: 2 });
block('diamond_ore', 'gem_ore', { hard: 3, tool: 'pick', level: 3, drop: 'diamond' });
block('table', ['table_top', 'table_side', 'planks'], { hard: 2.5, tool: 'axe', sound: 'wood' });
block('furnace', ['furnace_side', 'furnace_front', 'furnace_side'], { hard: 3.5, tool: 'pick', level: 1 });
block('glass', 'glass', { cut: true, hard: 0.3, drop: null, sound: 'glass' });
block('tallgrass', 'tallgrass', { cut: true, solid: false, web: true, plant: true, hard: 0, drop: null, sound: 'grass' });
block('flower_red', 'flower_red', { cut: true, solid: false, web: true, plant: true, hard: 0, drop: null, sound: 'grass' });
block('flower_yellow', 'flower_yellow', { cut: true, solid: false, web: true, plant: true, hard: 0, drop: null, sound: 'grass' });
block('chest', ['chest_top', 'chest_front', 'chest_top'], { hard: Infinity, sound: 'wood' }); // 島に2つだけ置く宝箱。壊せない
block('cobweb', 'cobweb', { cut: true, solid: false, web: true, hard: 4, tool: 'sword', drop: 'string', needTool: true, sound: 'grass' });

// ---- アイテム ----
export const ITEMS = {};
function item(id, name, icon, o = {}) { ITEMS[id] = { id, name, icon, stack: 64, ...o }; }
for (const [id, name, icon] of [['dirt', '土', 'grass_side'], ['cobble', '丸石', 'cobble'], ['stone', '石', 'stone'], ['sand', '砂', 'sand'], ['gravel', '砂利', 'gravel'], ['log', '原木', 'log_side'], ['planks', '木材', 'planks'], ['table', '作業台', 'table_side'], ['furnace', 'かまど', 'furnace_front'], ['iron_ore', '鉄鉱石', 'iron_ore'], ['glass', 'ガラス', 'glass']]) item(id, name, icon, { block: id });
item('stick', '棒', 'stick'); item('coal', '石炭', 'coal'); item('iron', '鉄インゴット', 'iron'); item('diamond', 'ダイヤ', 'diamond');
item('flint', '火打石', 'flint'); item('string', '糸', 'string'); item('apple', 'りんご', 'apple', { food: 20, sat: 5 }); // 1個で満腹になり、そのあとハート2個ぶん回復する
item('shield', '盾', 'shield', { stack: 1, shield: true, dur: 336 });
item('arrow', '矢', 'arrow'); item('bow', '弓', 'bow', { stack: 1, bow: true, dur: 384 });
// 道具：[名前, 段階, 速さ, 耐久, 剣の攻撃力]
export const MATS = { w: ['木', 1, 2, 59, 4], s: ['石', 2, 4, 131, 5], i: ['鉄', 3, 6, 250, 6], d: ['ダイヤ', 4, 8, 1561, 7] };
for (const [m, [jp, lv, spd, dur, sw]] of Object.entries(MATS)) {
  item(`sword_${m}`, `${jp}の剣`, `sword_${m}`, { stack: 1, dmg: sw, dur, tool: 'sword', level: lv, speed: 1.5, cool: 0.625 });
  item(`pick_${m}`, `${jp}のつるはし`, `pick_${m}`, { stack: 1, dmg: sw - 2, dur, tool: 'pick', level: lv, speed: spd, cool: 0.83 });
  item(`axe_${m}`, `${jp}の斧`, `axe_${m}`, { stack: 1, dmg: sw + 2, dur, tool: 'axe', level: lv, speed: spd, cool: 1.1 });
  item(`shovel_${m}`, `${jp}のシャベル`, `shovel_${m}`, { stack: 1, dmg: sw - 1.5, dur, tool: 'shovel', level: lv, speed: spd, cool: 1 });
}
// 防具：防御ポイント（1ポイント＝4%軽減）
const ARM = { i: ['鉄', [2, 6, 5, 2], 15], d: ['ダイヤ', [3, 8, 6, 3], 33] };
export const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots'];
const ARMOR_JP = { helmet: 'ヘルメット', chest: 'チェストプレート', legs: 'レギンス', boots: 'ブーツ' };
for (const [m, [jp, pts, dm]] of Object.entries(ARM)) ARMOR_SLOTS.forEach((k, i) => item(`${k}_${m}`, `${jp}の${ARMOR_JP[k]}`, `${k}_${m}`, { stack: 1, armor: pts[i], slot: k, dur: dm * [11, 16, 15, 13][i] }));

// ---- レシピ（形あり：p＝行、k＝記号の中身／形なし：need） ----
export const RECIPES = [
  { out: 'planks', n: 4, shapeless: ['log'] },
  { out: 'stick', n: 4, p: ['P', 'P'], k: { P: 'planks' } },
  { out: 'table', n: 1, p: ['PP', 'PP'], k: { P: 'planks' } },
  { out: 'furnace', n: 1, p: ['CCC', 'C C', 'CCC'], k: { C: 'cobble' } },
  { out: 'bow', n: 1, p: [' SX', 'S X', ' SX'], k: { S: 'stick', X: 'string' } },
  { out: 'arrow', n: 4, p: ['F', 'S', 'X'], k: { F: 'flint', S: 'stick', X: 'string' } },
  { out: 'arrow', n: 4, p: ['F', 'S'], k: { F: 'flint', S: 'stick' } },
  { out: 'shield', n: 1, p: ['PIP', 'PPP', ' P '], k: { P: 'planks', I: 'iron' } },
];
const MATKEY = { w: 'planks', s: 'cobble', i: 'iron', d: 'diamond' };
for (const [m, key] of Object.entries(MATKEY)) {
  RECIPES.push({ out: `pick_${m}`, n: 1, p: ['MMM', ' S ', ' S '], k: { M: key, S: 'stick' } });
  RECIPES.push({ out: `axe_${m}`, n: 1, p: ['MM', 'MS', ' S'], k: { M: key, S: 'stick' } });
  RECIPES.push({ out: `shovel_${m}`, n: 1, p: ['M', 'S', 'S'], k: { M: key, S: 'stick' } });
  RECIPES.push({ out: `sword_${m}`, n: 1, p: ['M', 'M', 'S'], k: { M: key, S: 'stick' } });
}
for (const [m, key] of [['i', 'iron'], ['d', 'diamond']]) {
  RECIPES.push({ out: `helmet_${m}`, n: 1, p: ['MMM', 'M M'], k: { M: key } });
  RECIPES.push({ out: `chest_${m}`, n: 1, p: ['M M', 'MMM', 'MMM'], k: { M: key } });
  RECIPES.push({ out: `legs_${m}`, n: 1, p: ['MMM', 'M M', 'M M'], k: { M: key } });
  RECIPES.push({ out: `boots_${m}`, n: 1, p: ['M M', 'M M'], k: { M: key } });
}
// かまど：精錬と燃料（燃える秒数）
export const SMELT = { iron_ore: 'iron', sand: 'glass', cobble: 'stone', log: 'coal' };
export const FUEL = { coal: 80, log: 15, planks: 15, stick: 5, table: 15 };
export const SMELT_TIME = 5; // 1個あたり（10分の試合なので短め）

// 並べた材料（w×h の配列、空は null）に合うレシピ
export function matchRecipe(grid, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y * w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cell = (x, y) => grid[(y0 + y) * w + x0 + x] || null;
  const items = []; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (cell(x, y)) items.push(cell(x, y));
  for (const r of RECIPES) {
    if (r.shapeless) { if (items.length === r.shapeless.length && [...r.shapeless].sort().join() === [...items].sort().join()) return r; continue; }
    const ph = r.p.length, pw = Math.max(...r.p.map(s => s.length));
    if (ph !== ch || pw !== cw) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < ch && ok; y++) for (let x = 0; x < cw && ok; x++) {
        const ch2 = (r.p[y][mirror ? pw - 1 - x : x] || ' '), want = ch2 === ' ' ? null : r.k[ch2];
        if (want !== cell(x, y)) ok = false;
      }
      if (ok) return r;
    }
  }
  return null;
}

// ---- アトラス ----
export const TILE_INDEX = {};
export function buildAtlas() {
  const names = Object.keys(T), size = TS * AT;
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  names.forEach((n, i) => { TILE_INDEX[n] = i; g.putImageData(new ImageData(T[n].px, TS, TS), (i % AT) * TS, Math.floor(i / AT) * TS); });
  return c;
}
export function faceTiles() { return BLOCKS.map(b => b && b.faces.map(n => TILE_INDEX[n])); }
const iconCache = new Map();
function tileCanvas(name) { const tmp = document.createElement('canvas'); tmp.width = tmp.height = TS; tmp.getContext('2d').putImageData(new ImageData(T[name].px, TS, TS), 0, 0); return tmp; }
// ブロックは立体的な絵、それ以外は平たい絵
export function iconCanvas(itemId, size = 32) {
  const it = ITEMS[itemId];
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  if (it.block) {
    const bd = BLOCKS[B[it.block]], top = tileCanvas(bd.faces[0]), side = tileCanvas(bd.faces[1]), s = size / 32;
    const face = (img, m, shade) => { g.save(); g.setTransform(...m); g.drawImage(img, 0, 0, 16, 16); g.fillStyle = `rgba(0,0,0,${shade})`; g.fillRect(0, 0, 16, 16); g.restore(); };
    face(top, [0.88 * s, 0.44 * s, -0.88 * s, 0.44 * s, 16 * s, 2 * s], 0);
    face(side, [0.88 * s, 0.44 * s, 0, 1.0 * s, 2 * s, 9 * s], 0.28);
    face(side, [0.88 * s, -0.44 * s, 0, 1.0 * s, 16 * s, 16 * s], 0.12);
  } else g.drawImage(tileCanvas(it.icon), 0, 0, size, size);
  return c;
}
export function tilePixels(name) { return T[name].px; }
export function tileImage(name) { return tileCanvas(name); }
// ひびの10段階
export function crackCanvases() {
  const out = [], r = rng(99); const lines = [];
  for (let i = 0; i < 40; i++) { let x = 8, y = 8, a = r() * 6.283; const seg = []; for (let k = 0; k < 4 + r() * 5; k++) { x += Math.cos(a) * 1.4; y += Math.sin(a) * 1.4; a += (r() - 0.5) * 1.3; seg.push([Math.round(x), Math.round(y)]); } lines.push(seg); }
  for (let s = 0; s < 10; s++) {
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.75)';
    for (let i = 0; i < (s + 1) * 4; i++) for (const [x, y] of lines[i]) if (x >= 0 && y >= 0 && x < 16 && y < 16) g.fillRect(x, y, 1, 1);
    out.push(c);
  }
  return out;
}
