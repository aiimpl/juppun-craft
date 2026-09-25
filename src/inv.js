// 持ち物：ホットバー9＋持ち物27（main[0..8] がホットバー）、防具4、手でつかんでいる物
import { ITEMS, ARMOR_SLOTS } from './blocks.js';

export const HOT = 9, MAIN = 36;
export const stackMax = id => ITEMS[id].stack;
export const same = (a, b) => a && b && a.id === b.id && !ITEMS[a.id].dur;
export const clone = s => s ? { ...s } : null;

export class Inventory {
  constructor() { this.main = Array(MAIN).fill(null); this.armor = Array(4).fill(null); this.sel = 0; this.onChange = null; }
  changed() { this.onChange?.(); }
  clear() { this.main.fill(null); this.armor.fill(null); this.changed(); }
  count(id) { return this.main.reduce((n, x) => n + (x && x.id === id ? x.n : 0), 0); }
  // 入れる（ホットバー→持ち物の順。同じ物にまとめる）。入りきらなかった数を返す
  add(st) {
    let n = st.n; const max = stackMax(st.id);
    if (!ITEMS[st.id].dur) for (let i = 0; i < MAIN && n > 0; i++) { const x = this.main[i]; if (x && x.id === st.id && x.n < max) { const k = Math.min(n, max - x.n); x.n += k; n -= k; } }
    for (let i = 0; i < MAIN && n > 0; i++) if (!this.main[i]) { const k = Math.min(n, max); this.main[i] = { ...st, n: k }; n -= k; }
    this.changed(); return n;
  }
  remove(id, n = 1) {
    for (let i = MAIN - 1; i >= 0 && n > 0; i--) { const x = this.main[i]; if (x && x.id === id) { const k = Math.min(n, x.n); x.n -= k; n -= k; if (!x.n) this.main[i] = null; } }
    this.changed(); return n === 0;
  }
  held() { return this.main[this.sel]; }
  takeHeld(n = 1) { const x = this.main[this.sel]; if (!x) return null; const k = Math.min(n, x.n); x.n -= k; const out = { ...x, n: k }; if (!x.n) this.main[this.sel] = null; this.changed(); return out; }
  // 道具を使う：耐久が尽きたら壊れる（true を返す）
  wear(slotArr, i, amount = 1) {
    const x = slotArr[i]; if (!x || !ITEMS[x.id].dur) return false;
    x.d = (x.d || 0) + amount;
    if (x.d >= ITEMS[x.id].dur) { slotArr[i] = null; this.changed(); return true; }
    this.changed(); return false;
  }
  armorPoints() { return this.armor.reduce((s, x) => s + (x ? ITEMS[x.id].armor : 0), 0); }
  all() { return [...this.main, ...this.armor].filter(Boolean).map(clone); }
  slotFor(id) { const s = ITEMS[id].slot; return s ? ARMOR_SLOTS.indexOf(s) : -1; }
}
