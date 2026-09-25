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

// ---- パラシュート（ラムエア型：弧を描く翼に、空気を取り込むセルと吊りひも） ----
export function makeParachute(color = '#e84a3a') {
  const g = new THREE.Group(), canopy = new THREE.Group(); g.add(canopy);
  const main = new THREE.Color(color), white = new THREE.Color(0xf6f2ea), dark = main.clone().multiplyScalar(0.45);
  const N = 9, span = 7.2, R = 5.2, chord = 2.9, thick = 0.5;
  const pos = [], col = [], idx = [];
  const push = (v, c) => { pos.push(...v); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  const quad = (a, b, c, d, cl) => { const i = [a, b, c, d].map(v => push(v, cl)); idx.push(i[0], i[1], i[2], i[0], i[2], i[3]); };
  const arc = (t, h) => { const ang = (t - 0.5) * span / R; return [Math.sin(ang) * (R + h), Math.cos(ang) * (R + h) - R, 0]; };
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, c = i % 2 ? white : main, under = c.clone().multiplyScalar(0.92);
    const T0 = arc(t0, thick / 2), T1 = arc(t1, thick / 2), B0 = arc(t0, -thick / 2), B1 = arc(t1, -thick / 2);
    const z0 = -chord / 2, z1 = chord / 2, at = (p, z) => [p[0], p[1], z];
    quad(at(T0, z1), at(T1, z1), at(T1, z0), at(T0, z0), c);          // 上面
    quad(at(B0, z0), at(B1, z0), at(B1, z1), at(B0, z1), under);      // 下面
    quad(at(B0, z1), at(B1, z1), at(T1, z1), at(T0, z1), c.clone().multiplyScalar(0.9)); // 後ろの縁
    quad(at(T0, z0), at(T1, z0), at(B1, z0), at(B0, z0), dark);       // 前の空気取り入れ口（暗く）
  }
  // 両端のふさぎ
  for (const t of [0, 1]) { const T = arc(t, thick / 2), Bt = arc(t, -thick / 2); quad([Bt[0], Bt[1], -chord / 2], [Bt[0], Bt[1], chord / 2], [T[0], T[1], chord / 2], [T[0], T[1], -chord / 2], main.clone().multiplyScalar(0.8)); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, emissive: 0x3a3a3a }));
  mesh.castShadow = true; canopy.add(mesh);
  // 吊りひも：翼の下面からキャラの肩へ
  const lp = [];
  for (let i = 0; i <= N; i += 1.5) for (const z of [-chord * 0.35, chord * 0.35]) { const B = arc(i / N, -thick / 2); lp.push(B[0], B[1], z, Math.sign(B[0]) * 0.25, -4.6, 0); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  canopy.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.7, fog: false })));
  g.userData = { canopy, t: Math.random() * 10 };
  return g;
}
// 揺れ（ふわふわ・向きを変えると傾く）
export function swayParachute(g, dt, turn = 0) {
  const u = g.userData; u.t += dt;
  u.canopy.rotation.z = Math.sin(u.t * 1.3) * 0.06 - turn * 0.25;
  u.canopy.rotation.x = Math.sin(u.t * 0.9) * 0.04;
  u.canopy.position.y = Math.sin(u.t * 1.7) * 0.08;
}
// 降下の軌跡（遠くからでも位置がわかる色つきの帯）
export class Trail {
  constructor(scene, color) {
    this.n = 60; this.pts = []; this.scene = scene;
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.n * 3), 3));
    this.line = new THREE.Line(this.geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, fog: false }));
    this.line.frustumCulled = false; scene.add(this.line); this.acc = 0;
  }
  add(x, y, z, dt) {
    this.acc += dt; if (this.acc < 0.08) return; this.acc = 0;
    this.pts.push([x, y, z]); if (this.pts.length > this.n) this.pts.shift();
    const a = this.geo.attributes.position; for (let i = 0; i < this.n; i++) { const p = this.pts[Math.min(i, this.pts.length - 1)] || [x, y, z]; a.setXYZ(i, ...p); }
    a.needsUpdate = true; this.geo.setDrawRange(0, this.pts.length);
  }
  clear() { this.pts = []; this.geo.setDrawRange(0, 0); }
  dispose() { this.scene.remove(this.line); }
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
