// プレイヤーの動き（1ブロック＝1m、身長1.8）
import { BLOCKS, B } from './blocks.js';

export const DT = 1 / 60;
const GRAV = 32, JUMP_V = 8.9, WALK = 3.7, RUN = 5.2, SNEAK = 1.31, SWIM = 2.2, ACC_G = 50, ACC_A = 14;
export const PW = 0.3, PH = 1.8, EYE = 1.62;

export class Player {
  constructor(world) {
    this.w = world; this.p = [0, 0, 0]; this.v = [0, 0, 0]; this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.inWater = false; this.walkDist = 0; this.fallTop = 0;
    this.input = { f: 0, s: 0, jump: false, run: false, sneak: false }; this.sprinting = false; this.inWeb = false; this.slow = 1;
  }
  place(p, yaw = 0) { this.p = p.slice(); this.v = [0, 0, 0]; this.yaw = yaw; this.fallTop = p[1]; }
  solid(x, y, z) {
    if (!this.w.inside(x, z)) return true;
    const b = this.w.get(x, y, z); return b && BLOCKS[b].solid;
  }
  hits(x0, y0, z0, x1, y1, z1) {
    for (let y = Math.floor(y0); y <= Math.floor(y1 - 1e-6); y++) for (let z = Math.floor(z0); z <= Math.floor(z1 - 1e-6); z++) for (let x = Math.floor(x0); x <= Math.floor(x1 - 1e-6); x++) if (this.solid(x, y, z)) return [x, y, z];
    return null;
  }
  box(p = this.p) { return [p[0] - PW, p[1], p[2] - PW, p[0] + PW, p[1] + PH, p[2] + PW]; }
  move(ax, d) {
    if (!d) return false;
    const q = this.p.slice(); q[ax] += d;
    const h = this.hits(...this.box(q));
    if (!h) { this.p[ax] = q[ax]; return false; }
    // ぶつかった面の手前で止める
    if (ax === 1) this.p[1] = d > 0 ? h[1] - PH - 1e-4 : h[1] + 1 + 1e-4;
    else { const half = PW; this.p[ax] = d > 0 ? h[ax] - half - 1e-4 : h[ax] + 1 + half + 1e-4; if (this.hits(...this.box())) this.p[ax] = q[ax] - d; }
    return true;
  }
  step(dt = DT) {
    const p = this.p, v = this.v, I = this.input;
    this.inWater = this.w.get(Math.floor(p[0]), Math.floor(p[1] + 0.4), Math.floor(p[2])) === B.water;
    const wb = (y) => this.w.get(Math.floor(p[0]), Math.floor(p[1] + y), Math.floor(p[2])) === B.cobweb; // 草花は素通り
    this.inWeb = wb(0.1) || wb(1.2);
    this.sprinting = !!I.run && I.f > 0.3 && !I.sneak && !this.inWater; // 押している間だけ走る
    let fx = -Math.sin(this.yaw) * I.f + Math.cos(this.yaw) * I.s, fz = -Math.cos(this.yaw) * I.f - Math.sin(this.yaw) * I.s;
    const m = Math.hypot(fx, fz); if (m > 1) { fx /= m; fz /= m; }
    const sp = this.para ? 5.2 : (this.inWater ? SWIM : I.sneak ? SNEAK : this.sprinting ? RUN : WALK) * (this.slow || 1) * (this.inWeb ? 0.25 : 1);
    const acc = this.onGround ? ACC_G : this.para ? 10 : ACC_A;
    const tx = fx * sp, tz = fz * sp, dvx = tx - v[0], dvz = tz - v[2], dm = Math.hypot(dvx, dvz), md = acc * dt;
    // ノックバック中は空中で操作が効きにくい
    if (dm > md) { v[0] += dvx / dm * md; v[2] += dvz / dm * md; } else { v[0] = tx; v[2] = tz; }
    if (this.para && this.inWater) { this.para = false; this.onParaLand?.(); }
    if (this.inWater) { v[1] -= GRAV * 0.2 * dt; if (v[1] < -2.5) v[1] = -2.5; if (I.jump) v[1] = Math.min(v[1] + 24 * dt, 3.2); this.fallTop = p[1]; }
    // 水から上がる：岸にぶつかりながらジャンプを押すと、段差1つぶんだけ跳び上がる（上に空きがあるときだけ）
    const feetWet = this.inWater || this.w.get(Math.floor(p[0]), Math.floor(p[1] + 0.05), Math.floor(p[2])) === B.water;
    if (feetWet && I.jump && this.hitWall && m > 0.1) {
      const ox = fx / m * 0.35, oz = fz / m * 0.35;
      if (!this.hits(p[0] + ox - PW, p[1] + 0.6, p[2] + oz - PW, p[0] + ox + PW, p[1] + 0.6 + PH, p[2] + oz + PW)) v[1] = Math.max(v[1], 6);
    }
    else { v[1] -= GRAV * dt; if (v[1] < -50) v[1] = -50; if (I.jump && this.onGround) { v[1] = JUMP_V; this.onGround = false; this.onJump?.(); } }
    if (this.inWeb) { v[1] = Math.max(v[1], -1.2); if (v[1] > 1) v[1] = 1; }
    if (this.para) { v[1] = Math.max(v[1], -3.4); this.fallTop = p[1]; }
    const wasG = this.onGround;
    this.hitWall = false;
    // しゃがんでいると足場の外へ出ない
    for (const ax of [0, 2]) {
      const d = v[ax] * dt;
      if (I.sneak && wasG && d) { const q = p.slice(); q[ax] += d; if (!this.hits(q[0] - PW, q[1] - 0.6, q[2] - PW, q[0] + PW, q[1] - 0.01, q[2] + PW)) { v[ax] = 0; continue; } }
      if (this.move(ax, d)) { v[ax] = 0; this.hitWall = true; }
    }
    this.onGround = false;
    if (this.move(1, v[1] * dt)) {
      if (v[1] < 0) {
        this.onGround = true;
        const fall = this.fallTop - p[1];
        if (!wasG && fall > 3.5 && !this.para) this.onFall?.(Math.floor(fall - 3));
        if (!wasG) this.onLand?.(-v[1]);
        if (this.para) { this.para = false; this.onParaLand?.(); }
      }
      v[1] = 0;
    }
    if (this.onGround || v[1] > 0) this.fallTop = p[1];
    if (this.onGround) this.walkDist += Math.hypot(v[0], v[2]) * dt;
    if (p[1] < -10) { p[1] = this.w.top(Math.floor(p[0]), Math.floor(p[2])) + 1.1; v[1] = 0; this.fallTop = p[1]; }
  }
  push(dx, dz, up = 5) { this.v[0] += dx; this.v[2] += dz; this.v[1] = Math.max(this.v[1], up); this.onGround = false; }
  eye() { return [this.p[0], this.p[1] + EYE, this.p[2]]; }
  dir() { const c = Math.cos(this.pitch); return [-Math.sin(this.yaw) * c, Math.sin(this.pitch), -Math.cos(this.yaw) * c]; }
}

export function raycast(w, o, d, maxD = 5) {
  let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
  const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
  const tdx = Math.abs(1 / d[0]), tdy = Math.abs(1 / d[1]), tdz = Math.abs(1 / d[2]);
  let tx = (sx > 0 ? x + 1 - o[0] : o[0] - x) * tdx, ty = (sy > 0 ? y + 1 - o[1] : o[1] - y) * tdy, tz = (sz > 0 ? z + 1 - o[2] : o[2] - z) * tdz;
  let face = null, t = 0;
  for (let i = 0; i < 80 && t <= maxD; i++) {
    const b = w.get(x, y, z);
    if (b && b !== B.water) return { x, y, z, b, face, t };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; face = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; face = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; face = [0, 0, -sz]; }
  }
  return null;
}
// 光線と箱の交差（プレイヤーへの攻撃判定）
export function rayBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    const inv = 1 / d[a]; let ta = (b[a] - o[a]) * inv, tb = (b[a + 3] - o[a]) * inv;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t1 < t0) return null;
  }
  return t0;
}
