// 持ち物画面（持ち物・作業台・かまど・宝箱）
import { ITEMS, matchRecipe, iconCanvas, SMELT, FUEL } from './blocks.js';
import { MAIN, HOT, stackMax, same } from './inv.js';
import { t } from './i18n.js';

// GUI の座標は 1マス＝18。画面に合わせて拡大する
const LAYOUT = {
  inv: { w: 176, h: 166, title: 'gui.inv', grid: { x: 98, y: 18, n: 2 }, out: { x: 154, y: 28 }, arrow: { x: 134, y: 28 }, armor: { x: 8, y: 8 }, preview: { x: 26, y: 8, w: 50, h: 70 } },
  table: { w: 176, h: 166, title: 'gui.table', grid: { x: 30, y: 17, n: 3 }, out: { x: 124, y: 35 }, arrow: { x: 90, y: 35 } },
  chest: { w: 176, h: 166, title: 'gui.chest', box: { x: 8, y: 18, rows: 3 } },
  furnace: { w: 176, h: 166, title: 'gui.furnace', fin: { x: 56, y: 17 }, ffuel: { x: 56, y: 53 }, fout: { x: 116, y: 35 }, arrow: { x: 79, y: 35 }, flame: { x: 57, y: 37 } },
};

export class ContainerUI {
  constructor(root, { inv, drop, sound, faceCanvas }) {
    this.root = root; this.inv = inv; this.drop = drop; this.sound = sound; this.faceCanvas = faceCanvas;
    this.cursor = null; this.kind = null; this.grid = []; this.furnace = null; this.open = false;
    this.cur = document.createElement('div'); this.cur.className = 'cursorItem'; document.body.appendChild(this.cur);
    addEventListener('pointermove', e => { this.cur.style.left = e.clientX + 'px'; this.cur.style.top = e.clientY + 'px'; });
    root.addEventListener('pointerdown', e => { if (e.target === root && this.cursor) { this.drop(this.cursor); this.cursor = null; this.render(); } });
    root.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('pointermove', e => {
      if (!this.drag) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.gslot');
      if (!el || !el._ref || this.drag.els.includes(el)) return;
      const r = el._ref; if (r.kind === 'out' || r.kind === 'fout') return;
      const s = r.arr[r.i]; if (s && !(s.id === this.cursor.id && !ITEMS[s.id].dur)) return;
      if (r.kind === 'armor' && this.inv.slotFor(this.cursor.id) !== r.i) return;
      this.drag.refs.push(r); this.drag.els.push(el); el.classList.add('drag');
    });
    addEventListener('pointerup', () => {
      const D = this.drag; if (!D) return; this.drag = null; clearTimeout(D.timer);
      if (D.refs.length === 1) { this.click(D.refs[0], D.btn, false); this.lastClick = { ref: D.refs[0], t: performance.now() }; return; }
      this.distribute(D.refs, D.btn);
    });
  }
  show(kind, data = null) {
    this.kind = kind; this.furnace = kind === 'furnace' ? data : null; this.box = kind === 'chest' ? data : null; this.open = true;
    const n = LAYOUT[kind].grid?.n || 0; this.grid = Array(n * n).fill(null);
    this.root.hidden = false; this.render();
  }
  close() {
    if (!this.open) return;
    for (const s of [...this.grid, this.cursor]) if (s) { const left = this.inv.add(s); if (left) this.drop({ ...s, n: left }); }
    this.grid = []; this.cursor = null; this.open = false; this.box = null; this.root.hidden = true; this.cur.innerHTML = '';
  }
  scale() { return Math.max(1.6, Math.min(3.4, Math.floor(Math.min(innerWidth * 0.96 / 176, innerHeight * 0.92 / 166) * 10) / 10)); }
  // ---- 表示 ----
  render() {
    if (!this.open) return;
    const L = LAYOUT[this.kind], k = this.scale();
    const p = document.createElement('div'); p.className = 'gui'; p.style.width = L.w * k + 'px'; p.style.height = L.h * k + 'px'; p.style.setProperty('--k', k);
    const label = (t, x, y) => { const d = document.createElement('div'); d.className = 'guiLabel'; d.textContent = t; d.style.left = x * k + 'px'; d.style.top = y * k + 'px'; p.appendChild(d); };
    label(t(L.title), L.grid ? L.grid.x : 8, L.grid ? L.grid.y - 11 : 6); if (this.kind !== 'inv') label(t('gui.bag'), 8, 73);
    const slot = (x, y, arr, i, kind, extra = '') => {
      const d = document.createElement('div'); d.className = 'gslot ' + extra; d.style.left = (x - 1) * k + 'px'; d.style.top = (y - 1) * k + 'px';
      this.fillSlot(d, arr[i]);
      const ref = { arr, i, kind }; d._ref = ref;
      d.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        const touch = e.pointerType === 'touch', btn = e.button === 2 ? 2 : 0;
        // ダブルクリック：同じ物をまとめてつかむ
        const t = performance.now();
        if (btn === 0 && !e.shiftKey && this.lastClick && this.lastClick.ref.arr === arr && this.lastClick.ref.i === i && t - this.lastClick.t < 320 && this.cursor) { this.gather(); this.lastClick = null; return; }
        // つかんでいる物があれば、なぞって分ける（左＝均等、右＝1個ずつ）
        if (this.cursor && !e.shiftKey && kind !== 'out' && kind !== 'fout') {
          this.drag = { btn, refs: [ref], els: [d] }; d.classList.add('drag');
          if (touch) this.drag.timer = setTimeout(() => { if (this.drag && this.drag.refs.length === 1) this.drag.btn = 2; }, 380);
          return;
        }
        if (touch && !this.cursor) { let held = false; const tm = setTimeout(() => { held = true; this.click(ref, 2, false); }, 380); d.onpointerup = () => { clearTimeout(tm); if (!held) this.click(ref, 0, false); d.onpointerup = null; }; return; }
        this.click(ref, btn, e.shiftKey);
        this.lastClick = { ref, t };
      });
      if (ITEMS[arr[i]?.id]) d.title = ITEMS[arr[i].id].name;
      p.appendChild(d); return d;
    };
    // 持ち物・ホットバー
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) slot(8 + c * 18, 84 + r * 18, this.inv.main, 9 + r * 9 + c, 'main');
    for (let c = 0; c < 9; c++) slot(8 + c * 18, 142, this.inv.main, c, 'main', c === this.inv.sel ? 'sel' : '');
    if (this.kind === 'inv') {
      for (let i = 0; i < 4; i++) slot(L.armor.x, L.armor.y + i * 18, this.inv.armor, i, 'armor', 'armor' + i);
      const pv = document.createElement('div'); pv.className = 'preview'; Object.assign(pv.style, { left: L.preview.x * k + 'px', top: L.preview.y * k + 'px', width: L.preview.w * k + 'px', height: L.preview.h * k + 'px' });
      const f = this.faceCanvas(); f.style.width = f.style.height = 30 * k + 'px'; pv.appendChild(f);
      const a = document.createElement('div'); a.className = 'guiSmall'; a.textContent = t('gui.armor', this.inv.armorPoints()); pv.appendChild(a); p.appendChild(pv);
    }
    if (L.grid) {
      const n = L.grid.n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) slot(L.grid.x + x * 18, L.grid.y + y * 18, this.grid, y * n + x, 'grid');
      const r = matchRecipe(this.grid.map(s => s?.id || null), n, n);
      this.outArr = [r ? { id: r.out, n: r.n } : null]; this.recipe = r;
      this.arrow(p, L.arrow, k, 1);
      slot(L.out.x, L.out.y, this.outArr, 0, 'out', 'big');
    }
    if (this.kind === 'chest') {
      const L2 = L.box;
      for (let r = 0; r < L2.rows; r++) for (let c = 0; c < 9; c++) slot(L2.x + c * 18, L2.y + r * 18, this.box.slots, r * 9 + c, 'chest');
    }
    if (this.kind === 'furnace') {
      const F = this.furnace;
      slot(L.fin.x, L.fin.y, F.slots, 0, 'fin'); slot(L.ffuel.x, L.ffuel.y, F.slots, 1, 'ffuel'); slot(L.fout.x, L.fout.y, F.slots, 2, 'fout', 'big');
      this.arrow(p, L.arrow, k, F.prog || 0);
      const fl = document.createElement('div'); fl.className = 'flame'; fl.style.left = L.flame.x * k + 'px'; fl.style.top = L.flame.y * k + 'px'; fl.style.width = fl.style.height = 14 * k + 'px';
      const burn = F.burnMax ? F.burn / F.burnMax : 0; fl.style.setProperty('--b', burn); p.appendChild(fl);
      this.furnaceEls = { fl, p };
    }
    this.root.innerHTML = ''; this.root.appendChild(p);
    this.renderCursor();
  }
  arrow(p, a, k, u) { const d = document.createElement('div'); d.className = 'garrow'; d.style.left = a.x * k + 'px'; d.style.top = a.y * k + 'px'; d.style.width = 22 * k + 'px'; d.style.height = 16 * k + 'px'; d.style.setProperty('--u', u); p.appendChild(d); if (this.kind === 'furnace') this.furnArrow = d; }
  fillSlot(d, s) {
    d.innerHTML = ''; if (!s) return;
    const c = iconCanvas(s.id, 32); d.appendChild(c);
    if (s.n > 1) { const b = document.createElement('b'); b.textContent = s.n; d.appendChild(b); }
    const it = ITEMS[s.id]; if (it.dur && s.d) { const bar = document.createElement('i'); const u = 1 - s.d / it.dur; bar.style.setProperty('--u', u); bar.style.setProperty('--c', `hsl(${u * 120},90%,50%)`); d.appendChild(bar); }
  }
  renderCursor() { this.cur.innerHTML = ''; if (this.cursor) { const d = document.createElement('div'); d.className = 'gslot ghost'; this.fillSlot(d, this.cursor); this.cur.appendChild(d); } }
  // かまどの表示だけ更新（毎フレーム）
  tick() {
    if (!this.open || this.kind !== 'furnace' || !this.furnArrow) return;
    const F = this.furnace; this.furnArrow.style.setProperty('--u', F.prog || 0);
    this.furnaceEls.fl.style.setProperty('--b', F.burnMax ? F.burn / F.burnMax : 0);
    if (F.dirty) { F.dirty = false; this.render(); }
  }
  // ---- クリック ----
  click(ref, btn, shift) {
    const { arr, i, kind } = ref, s = arr[i];
    if (kind === 'out') return this.takeOutput(shift);
    if (kind === 'fout') { if (!s) return; if (shift) { const left = this.inv.add(s); arr[i] = left ? { ...s, n: left } : null; } else if (!this.cursor) { this.cursor = s; arr[i] = null; } else if (same(this.cursor, s) && this.cursor.n + s.n <= stackMax(s.id)) { this.cursor.n += s.n; arr[i] = null; } this.after(); return; }
    if (shift && s) { this.quickMove(ref); this.after(); return; }
    const accept = st => kind !== 'armor' || (st && this.inv.slotFor(st.id) === i);
    if (btn === 0) {
      if (!this.cursor) { if (s) { this.cursor = s; arr[i] = null; } }
      else if (!s) { if (accept(this.cursor)) { arr[i] = this.cursor; this.cursor = null; } }
      else if (same(s, this.cursor)) { const k = Math.min(this.cursor.n, stackMax(s.id) - s.n); s.n += k; this.cursor.n -= k; if (!this.cursor.n) this.cursor = null; }
      else if (accept(this.cursor)) { arr[i] = this.cursor; this.cursor = s; }
    } else {
      if (!this.cursor) { if (s) { const k = Math.ceil(s.n / 2); this.cursor = { ...s, n: k }; s.n -= k; if (!s.n) arr[i] = null; } }
      else if (!s) { if (accept(this.cursor)) { arr[i] = { ...this.cursor, n: 1 }; this.cursor.n--; if (!this.cursor.n) this.cursor = null; } }
      else if (same(s, this.cursor) && s.n < stackMax(s.id)) { s.n++; this.cursor.n--; if (!this.cursor.n) this.cursor = null; }
      else if (accept(this.cursor)) { arr[i] = this.cursor; this.cursor = s; }
    }
    this.after();
  }
  after() { this.inv.changed(); if (this.furnace) this.furnace.dirty = false; this.sound?.('click'); this.render(); }
  // なぞったマスに分ける：左は均等（余りは手に残る）、右は1個ずつ
  distribute(refs, btn) {
    const c = this.cursor; if (!c) return;
    const max = stackMax(c.id), each = btn === 2 ? 1 : Math.floor(c.n / refs.length);
    if (each < 1) { this.click(refs[0], btn, false); return; }
    for (const r of refs) {
      if (!this.cursor || this.cursor.n <= 0) break;
      const s = r.arr[r.i], room = s ? max - s.n : max, k = Math.min(each, room, this.cursor.n);
      if (k <= 0) continue;
      if (s) s.n += k; else r.arr[r.i] = { ...this.cursor, n: k };
      this.cursor.n -= k;
    }
    if (this.cursor && this.cursor.n <= 0) this.cursor = null;
    this.after();
  }
  // 同じ物を持ち物中から手に集める
  gather() {
    const c = this.cursor; if (!c || ITEMS[c.id].dur) return;
    const max = stackMax(c.id);
    for (const arr of [this.grid, this.inv.main]) for (let j = 0; j < arr.length && c.n < max; j++) { const s = arr[j]; if (s && s.id === c.id) { const k = Math.min(s.n, max - c.n); c.n += k; s.n -= k; if (!s.n) arr[j] = null; } }
    this.after();
  }
  takeOutput(shift) {
    const r = this.recipe; if (!r) return;
    const craftOnce = () => { for (let j = 0; j < this.grid.length; j++) if (this.grid[j]) { this.grid[j].n--; if (!this.grid[j].n) this.grid[j] = null; } };
    if (shift) {
      let guard = 64;
      while (guard-- > 0) {
        const m = matchRecipe(this.grid.map(s => s?.id || null), LAYOUT[this.kind].grid.n, LAYOUT[this.kind].grid.n);
        if (!m || m !== r) break;
        const left = this.inv.add({ id: r.out, n: r.n }); craftOnce();
        if (left) { this.drop({ id: r.out, n: left }); break; }
      }
    } else {
      if (this.cursor && !(same(this.cursor, { id: r.out }) && this.cursor.n + r.n <= stackMax(r.out))) return;
      if (this.cursor) this.cursor.n += r.n; else this.cursor = { id: r.out, n: r.n };
      craftOnce();
    }
    this.sound?.('craft'); this.inv.changed(); this.render();
  }
  quickMove({ arr, i, kind }) {
    const s = arr[i];
    const moveTo = (targets) => { // targets: [arr, from, to]
      let n = s.n;
      for (const [A, a, b] of targets) for (let j = a; j < b && n > 0; j++) if (same(A[j], s) && A[j].n < stackMax(s.id)) { const k = Math.min(n, stackMax(s.id) - A[j].n); A[j].n += k; n -= k; }
      for (const [A, a, b] of targets) for (let j = a; j < b && n > 0; j++) if (!A[j]) { A[j] = { ...s, n }; n = 0; }
      if (n) arr[i] = { ...s, n }; else arr[i] = null;
    };
    const main = this.inv.main;
    if (kind === 'main') {
      const as = this.inv.slotFor(s.id);
      if (this.kind === 'inv' && as >= 0 && !this.inv.armor[as]) { this.inv.armor[as] = s; arr[i] = null; return; }
      if (this.kind === 'chest') return moveTo([[this.box.slots, 0, this.box.slots.length]]);
      if (this.kind === 'furnace') {
        const F = this.furnace.slots;
        if (SMELT[s.id] && (!F[0] || same(F[0], s))) return moveTo([[F, 0, 1]]);
        if (FUEL[s.id] && (!F[1] || same(F[1], s))) return moveTo([[F, 1, 2]]);
      }
      return i < HOT ? moveTo([[main, HOT, MAIN]]) : moveTo([[main, 0, HOT]]);
    }
    moveTo([[main, HOT, MAIN], [main, 0, HOT]]);
  }
}
