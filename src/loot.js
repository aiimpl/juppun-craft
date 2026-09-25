// 宝箱の中身を決める
import { mulberry } from './world.js';

// 宝箱の中身：ふつうの物が多めで、強い物ほど少なめ。弓と矢は2つのうち片方に必ず入る
export const LOOT = [
  [16, 'apple', 2, 4], [14, 'planks', 6, 12], [10, 'stick', 2, 5], [10, 'arrow', 5, 12],
  [9, 'sword_w', 1, 1], [8, 'shield', 1, 1], [8, 'coal', 2, 5], [7, 'iron', 2, 4], [6, 'bow', 1, 1],
  [5, 'pick_s', 1, 1], [5, 'sword_s', 1, 1], [4, 'helmet_i', 1, 1], [4, 'boots_i', 1, 1], [3, 'legs_i', 1, 1],
  [2.5, 'chest_i', 1, 1], [2, 'sword_i', 1, 1], [2, 'diamond', 1, 2], [1, 'sword_d', 1, 1], [0.8, 'chest_d', 1, 1], [0.6, 'helmet_d', 1, 1],
];
const LOOT_TOTAL = LOOT.reduce((n, l) => n + l[0], 0);
export function rollLoot(seed, withBow) {
  const r = mulberry(seed >>> 0), out = Array(27).fill(null);
  const put = (id, n) => { for (let k = 0; k < 60; k++) { const i = Math.floor(r() * 27); if (!out[i]) { out[i] = { id, n }; return; } } };
  if (withBow) { put('bow', 1); put('arrow', 8 + Math.floor(r() * 13)); }
  const n = 4 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) { let x = r() * LOOT_TOTAL; for (const [w, id, a, b] of LOOT) { x -= w; if (x <= 0) { put(id, a + Math.floor(r() * (b - a + 1))); break; } } }
  return out;
}
