// 地面に落ちたアイテム：はじけ飛んで落ち、回りながら浮かぶ。近づくと吸い寄せられる
import * as THREE from '../vendor/three/build/three.module.js';
import { ITEMS, B, BLOCKS, iconCanvas } from './blocks.js';

const texCache = new Map();
function tex(id) {
  if (texCache.has(id)) return texCache.get(id);
  const t = new THREE.CanvasTexture(iconCanvas(id, 16)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(id, t); return t;
}
const blockMatCache = new Map();
function blockMats(id, atlasFaces) {
  if (blockMatCache.has(id)) return blockMatCache.get(id);
  const m = atlasFaces(ITEMS[id].block); blockMatCache.set(id, m); return m;
}
export function itemModel(id, atlasFaces, size = 0.26) {
  const it = ITEMS[id];
  if (it.block) { const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), blockMats(id, atlasFaces)); m.castShadow = true; return m; }
  // 平たい絵を少し厚みのある板に（マイクラの落ちたアイテムのように）
  const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ map: tex(id), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.7, size * 1.7), mat); p.position.z = (k - 1) * 0.012; g.add(p); }
  return g;
}

export class ItemEntities {
  constructor(scene, world, atlasFaces) { this.scene = scene; this.w = world; this.atlasFaces = atlasFaces; this.list = new Map(); }
  spawn(id, st, p, v, age = 0) {
    if (this.list.has(id)) return;
    const mesh = new THREE.Group(); const n = st.n > 16 ? 3 : st.n > 1 ? 2 : 1;
    for (let k = 0; k < n; k++) { const m = itemModel(st.id, this.atlasFaces); m.position.set(k * 0.06, k * 0.05, k * 0.05); mesh.add(m); }
    mesh.position.set(...p); this.scene.add(mesh);
    this.list.set(id, { id, st, p: p.slice(), v: v.slice(), age, mesh, asked: 0, spin: Math.random() * 6 });
  }
  remove(id) { const e = this.list.get(id); if (e) this.scene.remove(e.mesh); this.list.delete(id); }
  clear() { for (const id of [...this.list.keys()]) this.remove(id); }
  solid(x, y, z) { const b = this.w.get(Math.floor(x), Math.floor(y), Math.floor(z)); return b && BLOCKS[b].solid; }
  update(dt, player, onTouch) {
    for (const e of this.list.values()) {
      e.age += dt; e.spin += dt * 1.8;
      const p = e.p, v = e.v;
      // 近くの人へ吸い寄せ（0.5秒たってから）
      let attract = false;
      if (player && e.age > 0.5) {
        const dx = player[0] - p[0], dy = player[1] + 0.6 - p[1], dz = player[2] - p[2], d = Math.hypot(dx, dy, dz);
        if (d < 1.8) { attract = true; v[0] = dx / d * 6; v[1] = dy / d * 6; v[2] = dz / d * 6; if (d < 0.55 && performance.now() - e.asked > 800) { e.asked = performance.now(); onTouch(e); } }
      }
      if (!attract) {
        v[1] -= 18 * dt; v[0] *= Math.pow(0.1, dt); v[2] *= Math.pow(0.1, dt);
        if (this.w.get(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])) === B.water) { v[1] = Math.min(v[1] + 30 * dt, 1); }
      }
      for (const a of [0, 2]) { const q = p.slice(); q[a] += v[a] * dt; if (!attract && this.solid(q[0], q[1] + 0.05, q[2])) v[a] = 0; else p[a] = q[a]; }
      const ny = p[1] + v[1] * dt;
      if (!attract && v[1] < 0 && this.solid(p[0], ny - 0.13, p[2])) { p[1] = Math.floor(ny - 0.13) + 1 + 0.13; v[1] = 0; } else p[1] = ny;
      if (p[1] < -5) p[1] = this.w.top(Math.floor(p[0]), Math.floor(p[2])) + 1.2;
      e.mesh.position.set(p[0], p[1] + 0.08 + Math.sin(e.age * 2.6) * 0.05, p[2]); e.mesh.rotation.y = e.spin;
      if (e.age > 300) this.remove(e.id); // 5分で消える
    }
  }
}
