// 描画：空・光・海・境界・チャンク
import * as THREE from '../vendor/three/build/three.module.js';
import { buildAtlas } from './blocks.js';
import { meshChunk } from './mesher.js';
import { WS, CS, SEA } from './world.js';

export class Renderer {
  constructor(canvas, { mobile = false } = {}) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.r.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.shadowMap.enabled = !mobile; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 500);
    this.scene.add(this.camera);
    this.amb = new THREE.HemisphereLight(0xdfeaff, 0x8a7a60, 1.25); this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.2); this.scene.add(this.sun, this.sun.target);
    if (!mobile) { this.sun.castShadow = true; const s = this.sun.shadow; s.mapSize.set(2048, 2048); Object.assign(s.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 }); s.bias = -0.0005; s.normalBias = 0.04; }
    this.scene.fog = new THREE.Fog(0xbfd8f0, 40, 150);
    this.skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunC: { value: new THREE.Color() } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 top, hor, sunC, sunDir; varying vec3 vd;
        void main(){ float y = max(vd.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.6)); float s = max(dot(vd, normalize(sunDir)), 0.0);
        c += sunC * (smoothstep(0.9985, 0.9992, s) * 2.0 + pow(s, 16.0) * 0.25); gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -1; this.scene.add(this.sky);
    // 雲（四角い雲の層）
    this.clouds = this.makeClouds(); this.scene.add(this.clouds);
    const atlas = buildAtlas();
    this.atlasCanvas = atlas;
    const tex = new THREE.CanvasTexture(atlas); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    this.tex = tex;
    this.mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 });
    this.waterMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }); // 水の中から見上げても水面が見える
    // 島の外の海
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: 0x3a64b8 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(WS / 2, SEA + 0.8, WS / 2); this.scene.add(sea); this.sea = sea;
    // 狭まる境界
    this.border = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 80, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.border.position.set(WS / 2, 30, WS / 2); this.border.visible = false; this.scene.add(this.border);
    this.meshes = new Map();
    // 手元（持っている物・腕）は別に描いて、常に一番手前に
    this.fpScene = new THREE.Scene(); this.fpCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    this.fpScene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a70, 1.6)); const fl = new THREE.DirectionalLight(0xffffff, 1.4); fl.position.set(0.5, 1, 0.8); this.fpScene.add(fl);
    this.setDay(0);
    this.resize(); addEventListener('resize', () => this.resize());
  }
  makeClouds() {
    const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, emissive: 0xffffff, emissiveIntensity: 0.35 });
    const r = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < 40; i++) { const w = 6 + r() * 14, d = 4 + r() * 10; const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), m); b.position.set(-100 + r() * 300, 60, -100 + r() * 300); g.add(b); }
    return g;
  }
  resize() { const w = innerWidth, h = innerHeight; this.r.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (this.fpCam) { this.fpCam.aspect = w / h; this.fpCam.updateProjectionMatrix(); } }
  // u: 0（朝）〜 1（夕焼け）
  setDay(u) {
    const lerp = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
    const k = Math.max(0, (u - 0.6) / 0.4);
    const el = 0.95 - u * 0.8, az = 0.6 + u * 1.2;
    this.sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    this.skyU.sunDir.value.copy(this.sunDir);
    this.skyU.top.value.copy(lerp(0x5b95e0, 0x4a5c9c, k)); this.skyU.hor.value.copy(lerp(0xcfe4f6, 0xffb27a, k)); this.skyU.sunC.value.copy(lerp(0xfff4d8, 0xff9a50, k));
    this.sun.color.copy(lerp(0xfff2dd, 0xffa868, k)); this.sun.intensity = 2.2 - k * 0.6;
    this.amb.color.copy(lerp(0xdfeaff, 0xe0b8a8, k)); this.amb.intensity = 1.25 - k * 0.2;
    this.scene.fog.color.copy(lerp(0xbfd8f0, 0xe8a888, k));
  }
  buildChunk(w, cx, cz) {
    const key = cx + ',' + cz, old = this.meshes.get(key);
    if (old) for (const m of old) { this.scene.remove(m); m.geometry.dispose(); }
    const res = meshChunk(w, cx, cz), out = [];
    for (const [part, mat] of [['solid', this.mat], ['water', this.waterMat]]) {
      const d = res[part]; if (!d) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(d.col, 3));
      g.setIndex(new THREE.BufferAttribute(d.idx, 1)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); if (part === 'solid') { m.castShadow = m.receiveShadow = true; } else m.renderOrder = 1;
      this.scene.add(m); out.push(m);
    }
    this.meshes.set(key, out);
  }
  buildAll(w) { for (const ms of this.meshes.values()) for (const m of ms) { this.scene.remove(m); m.geometry.dispose(); } this.meshes.clear(); for (let cz = 0; cz < WS / CS; cz++) for (let cx = 0; cx < WS / CS; cx++) this.buildChunk(w, cx, cz); w.dirty.clear(); }
  updateDirty(w) { for (const k of w.dirty) { const [cx, cz] = k.split(',').map(Number); if (cx >= 0 && cz >= 0 && cx < WS / CS && cz < WS / CS) this.buildChunk(w, cx, cz); } w.dirty.clear(); }
  setBorder(r) { this.border.visible = r < WS; this.border.scale.set(r, 1, r); }
  frame(t) {
    const c = this.camera.position;
    this.sun.position.set(c.x + this.sunDir.x * 120, c.y + this.sunDir.y * 120, c.z + this.sunDir.z * 120); this.sun.target.position.set(c.x, c.y, c.z);
    this.sky.position.copy(c); this.clouds.position.x = (t * 0.6) % 200;
    // 霧で見えないチャンクは描かない
    if ((this.cullN = (this.cullN || 0) + 1) % 10 === 0) {
      const far = this.scene.fog.far + 12;
      for (const [key, ms] of this.meshes) { const [cx, cz] = key.split(',').map(Number); const dx = cx * CS + 8 - c.x, dz = cz * CS + 8 - c.z; const v = dx * dx + dz * dz < far * far; for (const m of ms) m.visible = v; }
    }
    this.r.render(this.scene, this.camera);
    this.r.autoClear = false; this.r.clearDepth(); this.r.render(this.fpScene, this.fpCam); this.r.autoClear = true;
  }
}
