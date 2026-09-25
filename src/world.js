// 小さな島の世界（96×96×48）をシードから作る
import { B, BLOCKS } from './blocks.js';

export const WS = 128, WH = 48, CS = 16, SEA = 17;

export function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 勾配ノイズ（2D/3D）
class Noise {
  constructor(seed) {
    const r = mulberry(seed), p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = r() * (i + 1) | 0; [p[i], p[j]] = [p[j], p[i]]; }
    this.p = new Uint8Array(512); for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
  }
  static f(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  g2(h, x, y) { const a = (h & 7) * Math.PI / 4; return Math.cos(a) * x + Math.sin(a) * y; }
  n2(x, y) {
    const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y, p = this.p, xi = X & 255, yi = Y & 255;
    const u = Noise.f(fx), v = Noise.f(fy);
    const a = this.g2(p[p[xi] + yi], fx, fy), b = this.g2(p[p[xi + 1] + yi], fx - 1, fy), c = this.g2(p[p[xi] + yi + 1], fx, fy - 1), d = this.g2(p[p[xi + 1] + yi + 1], fx - 1, fy - 1);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  }
  g3(h, x, y, z) { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  n3(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); x -= X; y -= Y; z -= Z;
    const p = this.p, xi = X & 255, yi = Y & 255, zi = Z & 255, u = Noise.f(x), v = Noise.f(y), w = Noise.f(z);
    const A = p[xi] + yi, AA = p[A] + zi, AB = p[A + 1] + zi, Bb = p[xi + 1] + yi, BA = p[Bb] + zi, BB = p[Bb + 1] + zi;
    const L = (t, a, b) => a + t * (b - a);
    return L(w, L(v, L(u, this.g3(p[AA], x, y, z), this.g3(p[BA], x - 1, y, z)), L(u, this.g3(p[AB], x, y - 1, z), this.g3(p[BB], x - 1, y - 1, z))),
      L(v, L(u, this.g3(p[AA + 1], x, y, z - 1), this.g3(p[BA + 1], x - 1, y, z - 1)), L(u, this.g3(p[AB + 1], x, y - 1, z - 1), this.g3(p[BB + 1], x - 1, y - 1, z - 1))));
  }
  fbm(x, y, o = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { s += this.n2(x * f, y * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; }
}

export class World {
  constructor(seed) {
    this.seed = seed; this.W = WS; this.H = WH;
    this.data = new Uint8Array(WS * WS * WH);
    this.dirty = new Set(); this.onSet = null;
    this.generate();
  }
  idx(x, y, z) { return (y * WS + z) * WS + x; }
  inside(x, z) { return x >= 0 && z >= 0 && x < WS && z < WS; }
  get(x, y, z) { if (y < 0) return B.bedrock; if (y >= WH || !this.inside(x, z)) return 0; return this.data[this.idx(x, y, z)]; }
  set(x, y, z, v, remote = false) {
    if (y < 0 || y >= WH || !this.inside(x, z)) return;
    this.data[this.idx(x, y, z)] = v;
    const cx = x >> 4, cz = z >> 4; this.dirty.add(cx + ',' + cz);
    if ((x & 15) === 0) this.dirty.add((cx - 1) + ',' + cz); if ((x & 15) === 15) this.dirty.add((cx + 1) + ',' + cz);
    if ((z & 15) === 0) this.dirty.add(cx + ',' + (cz - 1)); if ((z & 15) === 15) this.dirty.add(cx + ',' + (cz + 1));
    if (!remote) this.onSet?.(x, y, z, v);
  }
  top(x, z) { for (let y = WH - 1; y > 0; y--) { const b = this.get(x, y, z); if (b && BLOCKS[b].solid && b !== B.leaves) return y; } return 0; }

  generate() {
    const n = new Noise(this.seed), n2 = new Noise(this.seed + 17), n3 = new Noise(this.seed + 99), r = mulberry(this.seed + 5);
    const hm = this.height = new Int16Array(WS * WS);
    const c = WS / 2;
    for (let z = 0; z < WS; z++) for (let x = 0; x < WS; x++) {
      // 島：中心ほど高く、端は海
      const d = Math.hypot(x - c, z - c) / (WS / 2);
      const fall = Math.max(0, 1 - Math.pow(Math.max(0, d - 0.55) / 0.42, 2));
      const hills = n.fbm(x / 38, z / 38, 4) * 11 + Math.max(0, n2.fbm(x / 22, z / 22, 3)) * 14;
      const h = Math.round((SEA - 5) + (8 + hills) * fall);
      hm[z * WS + x] = Math.max(2, Math.min(WH - 8, h));
    }
    const put = (x, y, z, v) => { this.data[this.idx(x, y, z)] = v; };
    for (let z = 0; z < WS; z++) for (let x = 0; x < WS; x++) {
      const h = hm[z * WS + x];
      put(x, 0, z, B.bedrock);
      for (let y = 1; y <= h; y++) put(x, y, z, y < h - 3 ? B.stone : B.dirt);
      if (h <= SEA + 1) { for (let y = Math.max(1, h - 2); y <= h; y++) put(x, y, z, B.sand); }
      else put(x, h, z, h > 33 ? B.snow : B.grass);
      for (let y = h + 1; y <= SEA; y++) put(x, y, z, B.water);
    }
    // 洞窟
    for (let z = 0; z < WS; z++) for (let x = 0; x < WS; x++) {
      const h = hm[z * WS + x];
      for (let y = 3; y < h - 3; y++) {
        const v = Math.abs(n3.n3(x / 14, y / 9, z / 14)) + Math.abs(n2.n3(x / 11 + 50, y / 11, z / 11)) * 0.7;
        if (v < 0.09) put(x, y, z, 0);
      }
    }
    // 鉱石（小さな塊）
    const vein = (id, count, ymax, size) => {
      for (let i = 0; i < count; i++) {
        let x = r() * WS | 0, y = 2 + (r() * (ymax - 2) | 0), z = r() * WS | 0;
        for (let k = 0; k < size; k++) {
          if (this.get(x, y, z) === B.stone) put(x, y, z, id);
          x += (r() * 3 | 0) - 1; y += (r() * 3 | 0) - 1; z += (r() * 3 | 0) - 1;
          if (!this.inside(x, z) || y < 1 || y >= WH) break;
        }
      }
    };
    vein(B.coal_ore, 270, 34, 7); vein(B.iron_ore, 215, 26, 5); vein(B.diamond_ore, 54, 12, 3);
    // 砂利：水辺と地中
    for (let i = 0; i < 70; i++) {
      const cx = r() * WS | 0, cz = r() * WS | 0, h = hm[cz * WS + cx];
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const x = cx + dx, z = cz + dz; if (!this.inside(x, z) || r() < 0.3) continue; const y = hm[z * WS + x]; if (y <= SEA + 1 && this.get(x, y, z) === B.sand) put(x, y, z, B.gravel); }
      if (h > 8) vein(B.gravel, 1, h - 3, 10);
    }
    // 洞窟のクモの巣（糸が取れる）
    let webs = 0;
    for (let k = 0; k < 10000 && webs < 64; k++) {
      const x = 2 + (r() * (WS - 4) | 0), z = 2 + (r() * (WS - 4) | 0), y = 3 + (r() * 22 | 0);
      if (this.get(x, y, z) || y >= hm[z * WS + x] - 2) continue;
      const solidN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]].filter(([a, b, c]) => { const v = this.get(x + a, y + b, z + c); return v && v !== B.water; }).length;
      if (solidN >= 2) { put(x, y, z, B.cobweb); webs++; }
    }
    // 木
    for (let z = 3; z < WS - 3; z++) for (let x = 3; x < WS - 3; x++) {
      const h = hm[z * WS + x];
      if (this.get(x, h, z) !== B.grass) continue;
      const dens = 0.012 + Math.max(0, n2.n2(x / 18 + 9, z / 18)) * 0.08;
      if (r() > dens) continue;
      if (this.get(x - 1, h + 1, z) || this.get(x + 1, h + 1, z) || this.get(x, h + 1, z - 1) || this.get(x, h + 1, z + 1)) continue;
      const th = 4 + (r() * 2 | 0);
      for (let y = h + 1; y <= h + th; y++) put(x, y, z, B.log);
      for (let dy = th - 2; dy <= th + 1; dy++) {
        const rad = dy >= th ? 1 : 2;
        for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
          if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && r() < 0.6) continue;
          const X = x + dx, Y = h + dy, Z = z + dz;
          if (this.inside(X, Z) && Y < WH && !this.get(X, Y, Z)) put(X, Y, Z, B.leaves);
        }
      }
    }
    // 草むらと花
    for (let z = 1; z < WS - 1; z++) for (let x = 1; x < WS - 1; x++) {
      const h = hm[z * WS + x];
      if (this.get(x, h, z) !== B.grass || this.get(x, h + 1, z)) continue;
      const q = r();
      if (q < 0.1) put(x, h + 1, z, B.tallgrass); else if (q < 0.112) put(x, h + 1, z, B.flower_red); else if (q < 0.124) put(x, h + 1, z, B.flower_yellow);
    }
  }
  // パラシュートで降りる地点：島の四隅の上空
  corner(i) { const a = (i % 4) * Math.PI / 2 + Math.PI / 4, rr = WS * 0.31; return [WS / 2 + Math.cos(a) * rr, 78, WS / 2 + Math.sin(a) * rr]; }
  // 四隅寄りのスポーン地点（i 番目）
  spawn(i, rnd = 0) {
    const a = (i % 4) * Math.PI / 2 + Math.PI / 4 + rnd, rr = 24;
    for (let k = 0; k < 40; k++) {
      const x = Math.round(WS / 2 + Math.cos(a + k * 0.3) * (rr - k * 0.3)), z = Math.round(WS / 2 + Math.sin(a + k * 0.3) * (rr - k * 0.3));
      const y = this.top(x, z);
      if (y > SEA && this.get(x, y + 1, z) === 0 && this.get(x, y + 2, z) === 0) return [x + 0.5, y + 1.01, z + 0.5];
    }
    const x = WS / 2, z = WS / 2; return [x + 0.5, this.top(x, z) + 1.01, z + 0.5];
  }
}
