// チャンク（16×16）を1つの形にまとめる：見える面だけ・角の陰つき
import { BLOCKS, AT, faceTiles } from './blocks.js';
import { CS } from './world.js';

let FT = null;
const OPA = new Uint8Array(256), CUT = new Uint8Array(256), WAT = new Uint8Array(256), CROSS = new Uint8Array(256);
const FACES = [
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], f: 0, shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], f: 2, shade: 0.55 },
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], f: 1, shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], f: 1, shade: 0.8 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], f: 1, shade: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], f: 1, shade: 0.9 },
];
for (const F of FACES) {
  F.uv = F.c.map(c => F.n[1] !== 0 ? [c[0], c[2]] : F.n[0] !== 0 ? [F.n[0] > 0 ? 1 - c[2] : c[2], c[1]] : [F.n[2] > 0 ? c[0] : 1 - c[0], c[1]]);
  const [a, b, c] = F.c, e1 = b.map((v, i) => v - a[i]), e2 = c.map((v, i) => v - a[i]);
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (cr[0] * F.n[0] + cr[1] * F.n[1] + cr[2] * F.n[2] < 0) { F.c.reverse(); F.uv.reverse(); }
}
const AO = [0.52, 0.7, 0.85, 1];
function init() {
  FT = faceTiles();
  for (const b of BLOCKS) if (b) { OPA[b.id] = b.solid && !b.cut && !b.water ? 1 : 0; CUT[b.id] = b.cut && !b.web ? 1 : 0; WAT[b.id] = b.water ? 1 : 0; CROSS[b.id] = b.web ? 1 : 0; }
}
function uv(t, u, v) { const x = t % AT, y = Math.floor(t / AT), i = 0.02; return [(x + i + u * (1 - 2 * i)) / AT, 1 - (y + 1 - (i + v * (1 - 2 * i))) / AT]; }
class Buf {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.v = 0; }
  quad(ps, n, uvs, cols, flip) {
    for (let k = 0; k < 4; k++) { this.p.push(...ps[k]); this.n.push(...n); this.u.push(...uvs[k]); this.c.push(cols[k], cols[k], cols[k]); }
    const v = this.v; if (flip) this.i.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else this.i.push(v, v + 1, v + 2, v, v + 2, v + 3); this.v += 4;
  }
  out() { return this.v ? { pos: new Float32Array(this.p), nor: new Float32Array(this.n), uv: new Float32Array(this.u), col: new Float32Array(this.c), idx: new Uint32Array(this.i) } : null; }
}
export function meshChunk(w, cx, cz) {
  if (!FT) init();
  const x0 = cx * CS, z0 = cz * CS, solid = new Buf(), water = new Buf();
  const op = (x, y, z) => y < 0 ? 1 : OPA[w.get(x, y, z)];
  for (let y = 0; y < w.H; y++) for (let z = z0; z < z0 + CS; z++) for (let x = x0; x < x0 + CS; x++) {
    const b = w.get(x, y, z); if (!b) continue;
    if (CROSS[b]) { // クモの巣：斜めに交差した2枚
      const t = FT[b][1];
      for (const [a, c] of [[[0, 0], [1, 1]], [[1, 0], [0, 1]]]) for (const back of [false, true]) {
        const ps = [[x + a[0], y, z + a[1]], [x + c[0], y, z + c[1]], [x + c[0], y + 1, z + c[1]], [x + a[0], y + 1, z + a[1]]];
        const uvs = [uv(t, 0, 0), uv(t, 1, 0), uv(t, 1, 1), uv(t, 0, 1)];
        if (back) { ps.reverse(); uvs.reverse(); }
        solid.quad(ps, [0, 1, 0], uvs, [0.95, 0.95, 0.95, 0.95], false);
      }
      continue;
    }
    const isW = WAT[b], isC = CUT[b];
    for (const F of FACES) {
      const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2], nb = ny < 0 ? 1 : w.get(nx, ny, nz);
      if (OPA[nb] || (isW && WAT[nb]) || (isC && CUT[nb]) || (isW && F.n[1] < 0) || (y === 0 && F.n[1] < 0)) continue;
      // 世界の外側の面は描かない（海の下）
      if (!w.inside(nx, nz) && !isW && F.n[1] === 0 && y < 14) continue;
      const tile = FT[b][F.f], ps = [], uvs = [], cols = [];
      const wt = isW && !WAT[w.get(x, y + 1, z)] ? 0.88 : 1;
      for (let k = 0; k < 4; k++) {
        const c = F.c[k];
        ps.push([x + c[0], y + (c[1] ? wt : 0), z + c[2]]); uvs.push(uv(tile, F.uv[k][0], F.uv[k][1]));
        if (isW) { cols.push(1); continue; }
        const ax = [0, 1, 2].filter(a => F.n[a] === 0), s = ax.map(a => c[a] ? 1 : -1), base = [nx, ny, nz];
        const o1 = base.slice(), o2 = base.slice(), o3 = base.slice();
        o1[ax[0]] += s[0]; o2[ax[1]] += s[1]; o3[ax[0]] += s[0]; o3[ax[1]] += s[1];
        const s1 = op(...o1), s2 = op(...o2), s3 = op(...o3);
        cols.push(AO[s1 && s2 ? 0 : 3 - s1 - s2 - s3] * F.shade);
      }
      (isW ? water : solid).quad(ps, F.n, uvs, cols, cols[0] + cols[2] < cols[1] + cols[3]);
    }
  }
  return { solid: solid.out(), water: water.out() };
}
