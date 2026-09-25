// キャラクター・名札・手に持つ物・落とし物・矢・破片
import * as THREE from '../vendor/three/build/three.module.js';

const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; }
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

// ---- キャラクターの定義（顔は 8×8 のドット） ----
export const CHARS = [
  { id: 'tanuki', name: 'たぬき', skin: '#9a6a44', body: '#7a5236', legs: '#4a3222', face: (g) => { px(g, 0, 0, 8, 8, '#9a6a44'); px(g, 1, 3, 6, 2, '#3a2618'); px(g, 2, 3, 1, 1, '#fff'); px(g, 5, 3, 1, 1, '#fff'); px(g, 2, 5, 4, 3, '#e8d2b0'); px(g, 3, 5, 2, 1, '#222'); }, ears: '#5a3a24', tail: '#7a5236' },
  { id: 'kitsune', name: 'きつね', skin: '#e8883a', body: '#d0702a', legs: '#f4f0e8', face: (g) => { px(g, 0, 0, 8, 8, '#e8883a'); px(g, 1, 3, 2, 1, '#222'); px(g, 5, 3, 2, 1, '#222'); px(g, 1, 5, 6, 3, '#faf4ea'); px(g, 3, 5, 2, 1, '#222'); }, ears: '#e8883a', earTip: '#222', tail: '#e8883a' },
  { id: 'ninja', name: 'にんじゃ', skin: '#2a2a34', body: '#23232c', legs: '#1a1a22', face: (g) => { px(g, 0, 0, 8, 8, '#2a2a34'); px(g, 0, 2, 8, 1, '#c8282a'); px(g, 1, 3, 6, 2, '#f0c8a0'); px(g, 2, 3, 1, 1, '#222'); px(g, 5, 3, 1, 1, '#222'); }, band: '#c8282a' },
  { id: 'robo', name: 'ロボ', skin: '#a8b0bc', body: '#7c8696', legs: '#5c6674', face: (g) => { px(g, 0, 0, 8, 8, '#a8b0bc'); px(g, 1, 2, 6, 3, '#20242c'); px(g, 2, 3, 1, 1, '#50f0ff'); px(g, 5, 3, 1, 1, '#50f0ff'); px(g, 2, 6, 4, 1, '#5c6674'); }, antenna: '#ff5050' },
  { id: 'kappa', name: 'かっぱ', skin: '#5cae5a', body: '#468a44', legs: '#356a34', face: (g) => { px(g, 0, 0, 8, 8, '#5cae5a'); px(g, 1, 3, 2, 2, '#fff'); px(g, 5, 3, 2, 2, '#fff'); px(g, 2, 4, 1, 1, '#222'); px(g, 5, 4, 1, 1, '#222'); px(g, 2, 6, 4, 2, '#f0c040'); }, dish: '#e8f0f4', hair: '#2c5a2a' },
  { id: 'penguin', name: 'ペンギン', skin: '#2a3038', body: '#2a3038', legs: '#f0a020', face: (g) => { px(g, 0, 0, 8, 8, '#2a3038'); px(g, 1, 2, 6, 5, '#f4f4f4'); px(g, 2, 3, 1, 1, '#222'); px(g, 5, 3, 1, 1, '#222'); px(g, 3, 5, 2, 1, '#f0a020'); }, belly: '#f4f4f4' },
];

export function makeCharacter(ci, { name = '', color = '#fff' } = {}) {
  const C = CHARS[ci % CHARS.length], g = new THREE.Group();
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const box = (w, h, d, mat, x, y, z, pivot) => { const geo = new THREE.BoxGeometry(w, h, d); if (pivot) geo.translate(0, -h / 2, 0); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
  const faceT = canvasTex(8, 8, g2 => C.face(g2));
  const skin = lam(C.skin);
  const headMats = [skin, skin, skin, skin, skin, new THREE.MeshLambertMaterial({ map: faceT })]; // 前（-z）＝ index 5
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMats); head.position.y = 1.55; head.castShadow = true;
  const body = box(0.5, 0.72, 0.26, lam(C.body), 0, 0.95, 0);
  const armL = box(0.22, 0.7, 0.22, lam(C.body), -0.36, 1.3, 0, true), armR = box(0.22, 0.7, 0.22, lam(C.body), 0.36, 1.3, 0, true);
  const legL = box(0.24, 0.6, 0.24, lam(C.legs), -0.13, 0.6, 0, true), legR = box(0.24, 0.6, 0.24, lam(C.legs), 0.13, 0.6, 0, true);
  g.add(head, body, armL, armR, legL, legR);
  // 特徴
  if (C.ears) for (const s of [-1, 1]) { const e = box(0.14, C.id === 'kitsune' ? 0.2 : 0.12, 0.08, lam(C.ears), s * 0.17, 1.87, 0.02); g.add(e); if (C.earTip) g.add(box(0.14, 0.05, 0.085, lam(C.earTip), s * 0.17, 1.95, 0.02)); }
  if (C.tail) { const t = box(0.16, 0.16, 0.42, lam(C.tail), 0, 0.72, 0.3); t.rotation.x = -0.4; g.add(t); }
  if (C.band) { const b = box(0.1, 0.06, 0.3, lam(C.band), 0.1, 1.62, 0.32); b.rotation.y = 0.5; g.add(b); }
  if (C.antenna) { g.add(box(0.04, 0.22, 0.04, lam('#8c96a4'), 0, 1.9, 0)); g.add(box(0.1, 0.1, 0.1, new THREE.MeshLambertMaterial({ color: C.antenna, emissive: C.antenna, emissiveIntensity: 0.6 }), 0, 2.03, 0)); }
  if (C.dish) { g.add(box(0.36, 0.05, 0.36, lam(C.dish), 0, 1.82, 0)); g.add(box(0.52, 0.08, 0.52, lam(C.hair), 0, 1.77, 0)); }
  if (C.belly) g.add(box(0.36, 0.5, 0.02, lam(C.belly), 0, 0.92, -0.135));
  // 手に持つ物
  const held = new THREE.Group(); held.position.set(0, -0.62, -0.12); armR.add(held);
  // 名札と体力
  const tag = makeTag(name, color); tag.position.y = 2.35; g.add(tag);
  g.userData = { head, armL, armR, legL, legR, held, tag, phase: 0, heldId: null, C };
  return g;
}
function makeTag(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true })); s.scale.set(1.4, 0.39, 1);
  s.userData = { c, t, name, color, hp: -1 };
  drawTag(s, 20); return s;
}
export function drawTag(s, hp) {
  const u = s.userData; if (u.hp === hp) return; u.hp = hp;
  const g = u.c.getContext('2d'); g.clearRect(0, 0, 256, 72);
  g.font = `700 30px ${FONT}`; const w = Math.min(240, g.measureText(u.name).width + 24);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.roundRect(128 - w / 2, 0, w, 40, 8); g.fill();
  g.fillStyle = u.color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(u.name, 128, 21);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(48, 50, 160, 14);
  g.fillStyle = hp > 12 ? '#58d858' : hp > 6 ? '#e8c040' : '#e84a3a'; g.fillRect(50, 52, 156 * Math.max(0, hp) / 20, 10);
  u.t.needsUpdate = true;
}
export function animateCharacter(ch, speed, dt, swing = 0) {
  const u = ch.userData; u.phase += speed * dt * 2.2;
  const a = Math.sin(u.phase) * Math.min(1, speed / 4) * 0.8;
  u.legL.rotation.x = a; u.legR.rotation.x = -a; u.armL.rotation.x = -a * 0.8;
  u.armR.rotation.x = a * 0.8 - swing * 1.6;
}

// ---- 矢 ----
export function makeArrow() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.7), new THREE.MeshLambertMaterial({ color: 0x8a6030 }));
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), new THREE.MeshLambertMaterial({ color: 0xaaaaaa })); tip.position.z = -0.38;
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.14), new THREE.MeshLambertMaterial({ color: 0xffffff })); fl.position.z = 0.3;
  g.add(shaft, tip, fl); return g;
}

// ---- 破片 ----
export class Debris {
  constructor(scene) {
    this.n = 120; this.i = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial(), this.n);
    this.mesh.frustumCulled = false; this.p = Array.from({ length: this.n }, () => ({ life: 0 }));
    this.m = new THREE.Matrix4(); this.c = new THREE.Color();
    for (let k = 0; k < this.n; k++) { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(k, this.m); this.mesh.setColorAt(k, this.c.set(0xffffff)); }
    scene.add(this.mesh);
  }
  spawn(x, y, z, color, count = 10, spread = 1) {
    for (let k = 0; k < count; k++) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      Object.assign(this.p[i], { life: 0.5 + Math.random() * 0.4, x: x + (Math.random() - 0.5) * spread + 0.5 * (spread === 1), y: y + Math.random() * spread, z: z + (Math.random() - 0.5) * spread + 0.5 * (spread === 1), vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4 + 1, vz: (Math.random() - 0.5) * 4 });
      this.mesh.setColorAt(i, this.c.set(color));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    for (let k = 0; k < this.n; k++) {
      const q = this.p[k];
      if (q.life <= 0) { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(k, this.m); continue; }
      q.life -= dt; q.vy -= 22 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const s = Math.min(1, q.life * 3); this.m.makeScale(s, s, s).setPosition(q.x, q.y, q.z); this.mesh.setMatrixAt(k, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
