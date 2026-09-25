// 効果音と環境音（すべてその場で合成）
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.amb = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.8 : 0; }
  t() { return this.ctx.currentTime; }
  burst({ f = 1000, q = 1, type = 'bandpass', dur = 0.08, vol = 0.3, at = 0, fEnd, attack = 0.002 }) {
    if (!this.ctx) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(), t0 = this.t() + at;
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(fl).connect(g).connect(this.master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  tone({ f = 440, dur = 0.3, vol = 0.2, type = 'sine', at = 0, fEnd, attack = 0.005, dest }) {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t0 = this.t() + at;
    o.type = type; o.frequency.setValueAtTime(f, t0); if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  step(kind) {
    const k = {
      road: { f: 1800, q: 1.2, dur: 0.05, vol: 0.14 }, grass: { f: 700, q: 0.7, dur: 0.09, vol: 0.16 }, dirt: { f: 500, q: 0.8, dur: 0.08, vol: 0.18 },
      gravel: { f: 2600, q: 0.6, dur: 0.11, vol: 0.16 }, wood: { f: 320, q: 2, dur: 0.07, vol: 0.28 }, roof: { f: 900, q: 3, dur: 0.06, vol: 0.2 },
      stone: { f: 1300, q: 1.5, dur: 0.05, vol: 0.14 }, leaves_road: { f: 3200, q: 0.5, dur: 0.12, vol: 0.12 },
    }[kind] || { f: 1500, q: 1, dur: 0.05, vol: 0.12 };
    this.burst({ ...k, f: k.f * (0.9 + Math.random() * 0.2) });
    if (kind === 'wood' || kind === 'roof') this.tone({ f: kind === 'wood' ? 150 : 240, dur: 0.06, vol: 0.08, type: 'triangle' });
  }
  jump() { this.burst({ f: 900, q: 0.8, dur: 0.07, vol: 0.1 }); }
  land(v) { this.burst({ f: 420, q: 0.9, dur: 0.12, vol: Math.min(0.4, v * 0.02) }); }
  dig(kind) { this.burst({ f: kind === 'grass' || kind === 'dirt' ? 600 : 1500, q: 1, dur: 0.07, vol: 0.18 }); }
  brk(kind) { this.burst({ f: kind === 'grass' ? 700 : 1100, q: 0.7, dur: 0.22, vol: 0.34, fEnd: 300 }); this.tone({ f: 200, fEnd: 90, dur: 0.12, vol: 0.12, type: 'triangle' }); }
  put() { this.burst({ f: 380, q: 1.5, dur: 0.1, vol: 0.34 }); this.tone({ f: 140, fEnd: 90, dur: 0.08, vol: 0.14, type: 'triangle' }); }
  item() { // 風鈴
    for (const [m, v, d] of [[1, 0.14, 1.6], [2.76, 0.06, 1.1], [5.4, 0.03, 0.7]]) this.tone({ f: 1760 * m, dur: d, vol: v, attack: 0.002 });
    this.tone({ f: 2640, dur: 1.2, vol: 0.07, at: 0.09, attack: 0.002 });
  }
  checkpoint() { // 拍子木
    for (const at of [0, 0.16]) { this.burst({ f: 2200, q: 6, dur: 0.07, vol: 0.5, at }); this.tone({ f: 1250, dur: 0.06, vol: 0.2, at, type: 'triangle' }); }
  }
  taiko(at = 0, vol = 0.7) {
    this.tone({ f: 120, fEnd: 52, dur: 0.6, vol, at, attack: 0.004 });
    this.burst({ f: 180, q: 0.8, dur: 0.18, vol: vol * 0.5, at, type: 'lowpass' });
  }
  beep(high) { this.tone({ f: high ? 1320 : 880, dur: high ? 0.5 : 0.18, vol: 0.18, type: 'triangle' }); }
  finish() { this.taiko(0, 0.8); this.taiko(0.32, 0.8); this.taiko(0.64, 1); this.item(); }
  click() { this.burst({ f: 3000, q: 3, dur: 0.03, vol: 0.12 }); }
  chew() { this.burst({ f: 900 + Math.random() * 400, q: 1.2, dur: 0.07, vol: 0.18 }); }
  hit() { this.burst({ f: 900, q: 1.2, dur: 0.08, vol: 0.4 }); this.tone({ f: 180, fEnd: 90, dur: 0.1, vol: 0.2, type: 'square' }); }
  hurt() { this.tone({ f: 420, fEnd: 200, dur: 0.18, vol: 0.18, type: 'sawtooth' }); this.burst({ f: 600, q: 1, dur: 0.1, vol: 0.3 }); }
  bowShot() { this.burst({ f: 2400, q: 2, dur: 0.12, vol: 0.25, fEnd: 800 }); }
  arrowHit() { this.burst({ f: 1800, q: 4, dur: 0.05, vol: 0.3 }); }
  pickup() { this.tone({ f: 880, fEnd: 1320, dur: 0.08, vol: 0.12, type: 'triangle' }); }
  craft() { this.burst({ f: 700, q: 2, dur: 0.06, vol: 0.2 }); this.tone({ f: 660, dur: 0.12, vol: 0.12, type: 'triangle', at: 0.05 }); this.tone({ f: 990, dur: 0.16, vol: 0.12, type: 'triangle', at: 0.12 }); }
  eat() { for (let i = 0; i < 3; i++) this.burst({ f: 1200, q: 1, dur: 0.06, vol: 0.2, at: i * 0.12 }); }
  death() { this.tone({ f: 300, fEnd: 60, dur: 0.8, vol: 0.25, type: 'sawtooth' }); }
  kill() { this.tone({ f: 660, dur: 0.12, vol: 0.18, type: 'square' }); this.tone({ f: 990, dur: 0.25, vol: 0.18, type: 'square', at: 0.1 }); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, dur: 0.5, vol: 0.2, type: 'square', at: i * 0.14 })); this.tone({ f: 1047, dur: 1.4, vol: 0.18, type: 'triangle', at: 0.6 }); }
  gong() { this.tone({ f: 110, dur: 2.2, vol: 0.35, attack: 0.01 }); this.tone({ f: 166, dur: 1.6, vol: 0.16, attack: 0.01 }); this.tone({ f: 263, dur: 1.1, vol: 0.08, attack: 0.01 }); }
  // 環境音：街のざわめき＋（夕方・夜は）虫の声
  ambient(time) {
    if (!this.ctx) return;
    if (this.amb) { for (const n of this.amb) try { n.stop ? n.stop() : n.disconnect(); } catch (e) { } this.amb = null; }
    const c = this.ctx, nodes = [];
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = c.createGain(); g.gain.value = time === 'night' ? 0.03 : 0.06;
    s.connect(lp).connect(g).connect(this.master); s.start(); nodes.push(s);
    if (time === 'evening' || time === 'night') {
      // 鈴虫：高い音を短く震わせる
      const o = c.createOscillator(); o.frequency.value = 4300;
      const am = c.createGain(); am.gain.value = 0;
      const lfo = c.createOscillator(); lfo.frequency.value = 38; const lg = c.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg).connect(am.gain);
      const gate = c.createGain(); gate.gain.value = 0;
      const vol = c.createGain(); vol.gain.value = time === 'night' ? 0.035 : 0.022;
      o.connect(am).connect(gate).connect(vol).connect(this.master); o.start(); lfo.start();
      const t0 = c.currentTime;
      for (let i = 0; i < 400; i++) { const t = t0 + i * 0.9 + Math.random() * 0.2; gate.gain.setValueAtTime(0, t); gate.gain.linearRampToValueAtTime(1, t + 0.05); gate.gain.setValueAtTime(1, t + 0.45); gate.gain.linearRampToValueAtTime(0, t + 0.5); }
      nodes.push(o, lfo);
    }
    if (time === 'morning' || time === 'day') {
      // 雀
      this.birdTimer = setInterval(() => { if (!this.on || Math.random() < 0.5) return; const f = 3200 + Math.random() * 1400; for (let i = 0; i < 2 + Math.random() * 3; i++) this.tone({ f, fEnd: f * 1.25, dur: 0.06, vol: 0.03, at: i * 0.11 }); }, 1800);
      nodes.push({ stop: () => clearInterval(this.birdTimer) });
    }
    this.amb = nodes;
  }
}
