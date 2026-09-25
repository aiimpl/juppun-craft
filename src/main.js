// じゅっぷんクラフト：画面の流れ・対戦の進行・操作
import * as THREE from '../vendor/three/build/three.module.js';
import { World, WS, SEA } from './world.js';
import { Renderer } from './render.js';
import { Player, raycast, rayBox, DT, PW, PH } from './player.js';
import { BLOCKS, B, ITEMS, SMELT, FUEL, SMELT_TIME, tilePixels, tileImage, crackCanvases } from './blocks.js';
import { Inventory, HOT } from './inv.js';
import { ContainerUI } from './ui.js';
import { ItemEntities, itemModel } from './items.js';
import { CHARS, makeCharacter, animateCharacter, drawTag, makeArrow, makeParachute, swayParachute, Trail, Debris } from './entities.js';
import { Sound } from './audio.js';
import { Net, codeFromWord, PUBLIC_SLOTS } from './net.js';

const $ = id => document.getElementById(id);
const mobile = matchMedia('(pointer: coarse)').matches;
const R = new Renderer($('gl'), { mobile });
const S = new Sound();
const MAXP = location.search.includes('max1') ? 1 : 4; // 検証用に ?max1 で定員1人
// 検証用：?debug で時間を短くする（部屋主の設定が全員に配られる）
const CFG = location.search.includes('film') ? { DUR: 150, SAFE: 20, SHRINK: 45 } : location.search.includes('debug') ? { DUR: 120, SAFE: 12, SHRINK: 40 } : { DUR: 600, SAFE: 120, SHRINK: 180 };
let DUR = CFG.DUR, SAFE = CFG.SAFE, SHRINK = CFG.SHRINK;
function applyCfg() { if (room?.cfg) ({ DUR, SAFE, SHRINK } = room.cfg); }
const COLORS = ['#ffd24a', '#7fd3ff', '#ff8fa8', '#a8f08a', '#d8a8ff', '#ffb070'];
window.__game = {};

// ---------- 状態 ----------
let net = null, isHost = false, solo = false, myId = 'h', clockOff = 0;
let room = null, state = 'title', world = null, player = null, spectator = false;
const inv = new Inventory();
let hp = 20, food = 20, sat = 5, exhaust = 0, dead = false, respawnAt = 0, lastHurt = -1e9, protectUntil = 0;
let lastAttacker = null, lastAttackerAt = -1e9, lastWeapon = null, hurtRoll = 0, hurtDir = 1;
const others = new Map(), arrows = [], furnaces = new Map();
let mods = new Map(), hostItems = new Map(), itemSeq = 0;
const debris = new Debris(R.scene);
const me = { name: '', char: 0 };

const now = () => performance.now() + clockOff;
const gameT = () => room && room.t0 ? (now() - room.t0) / 1000 : -1;

// ---------- 画面 ----------
const screens = ['title', 'lobby', 'result'];
function show(id) { for (const s of screens) $(s).hidden = s !== id; }
function notice(msg, reload = false) {
  const d = document.createElement('div'); d.className = 'notice';
  d.innerHTML = `<div>${msg}</div><button class="btn small">${reload ? 'タイトルへ' : 'OK'}</button>`;
  d.querySelector('button').onclick = () => { if (reload) { location.hash = ''; location.reload(); } else d.remove(); };
  document.body.appendChild(d);
}
function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d); setTimeout(() => d.remove(), 6500); while ($('feed').children.length > 6) $('feed').lastChild.remove(); }
function faceCanvas(ci, size = 32) { const c = document.createElement('canvas'); c.width = c.height = 8; CHARS[ci % CHARS.length].face(c.getContext('2d')); const o = document.createElement('canvas'); o.width = o.height = size; const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, size, size); return o; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ブロックの面のテクスチャ（手に持つブロック・落ちたブロック用）
const faceTexCache = new Map();
function faceTex(name) { if (faceTexCache.has(name)) return faceTexCache.get(name); const t = new THREE.CanvasTexture(tileImage(name)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; faceTexCache.set(name, t); return t; }
const faceMatCache = new Map();
function blockFaceMats(blockName) {
  if (faceMatCache.has(blockName)) return faceMatCache.get(blockName);
  const bd = BLOCKS[B[blockName]], m = n => new THREE.MeshLambertMaterial({ map: faceTex(n), transparent: bd.cut, alphaTest: 0.5 });
  const top = m(bd.faces[0]), side = m(bd.faces[1]), bot = m(bd.faces[2]);
  const out = [side, side, top, bot, side, side]; faceMatCache.set(blockName, out); return out;
}
const items = new ItemEntities(R.scene, null, blockFaceMats);
const gui = new ContainerUI($('gui'), { inv, drop: st => throwStack(st), sound: k => k === 'craft' ? S.craft() : S.click(), faceCanvas: () => faceCanvas(me.char, 60) });

// ---------- タイトル ----------
try { me.name = localStorage.getItem('jc:name') || ''; me.char = +(localStorage.getItem('jc:char') ?? Math.floor(Math.random() * CHARS.length)); } catch (e) { me.char = Math.floor(Math.random() * CHARS.length); }
if (!(me.char >= 0 && me.char < CHARS.length)) me.char = 0;
$('name').value = me.name;
CHARS.forEach((c, i) => { const b = document.createElement('button'); b.append(faceCanvas(i)); b.append(c.name); b.onclick = () => { me.char = i; renderChars(); }; $('chars').appendChild(b); });
function renderChars() { [...$('chars').children].forEach((b, i) => b.classList.toggle('on', i === me.char)); }
renderChars();
function saveMe() {
  me.name = ($('name').value.trim() || CHARS[me.char].name + Math.floor(Math.random() * 90 + 10)).slice(0, 10);
  try { localStorage.setItem('jc:name', $('name').value.trim()); localStorage.setItem('jc:char', me.char); } catch (e) { }
}
const joinCode = new URLSearchParams(location.hash.slice(1)).get('r');
if (joinCode) { $('joinBox').hidden = false; $('joinLabel').textContent = `部屋「${joinCode}」に招待されています`; $('bJoin').hidden = false; $('bHost').classList.remove('primary'); }
// 部屋を作る／入る（kind: 'link'＝リンクで招待、'word'＝あいことば、'pub'＝だれでも参加）
async function becomeHost(code, kind, label) {
  net = new Net(); bindNet(); await net.host(code);
  isHost = true; myId = 'h'; clockOff = 0;
  room = { code, kind, label, players: {}, queue: [], roster: {}, phase: 'lobby', seed: 0, t0: 0, startAt: 0 };
  addPlayer('h', me.name, me.char);
  if (kind === 'link') history.replaceState(null, '', location.pathname + location.search + '#r=' + code);
  showLobby();
}
async function joinRoom(code) {
  net = new Net(); bindNet(); myId = await net.join(code); isHost = false;
  net.send('h', { t: 'hello', name: me.name, char: me.char });
  syncClock();
}
function syncClock() { for (let i = 0; i < 5; i++) setTimeout(() => net?.send('h', { t: 'ping', c: performance.now() }), i * 300); }
function busy(btn, text) { const old = btn.textContent; btn.disabled = true; btn.textContent = text; return () => { btn.disabled = false; btn.textContent = old; }; }
$('bHost').onclick = async () => {
  S.init(); saveMe(); const done = busy($('bHost'), '部屋を作っています…');
  try { await becomeHost(Math.random().toString(36).slice(2, 8), 'link'); }
  catch (e) { notice('部屋を作れませんでした。時間をおいて試してください。'); console.error(e); }
  finally { done(); }
};
$('bJoin').onclick = async () => {
  S.init(); saveMe(); const done = busy($('bJoin'), 'つないでいます…');
  try { await joinRoom(joinCode); }
  catch (e) { notice('部屋に入れませんでした。部屋が閉じているか、ネットワークでつながらない可能性があります。'); console.error(e); net?.close(); net = null; }
  finally { done(); }
};
// あいことば：同じ言葉なら同じ部屋。部屋がなければ自分が部屋主になる
$('wordForm').onsubmit = async e => {
  e.preventDefault(); S.init(); saveMe();
  const word = $('word').value.trim(); if (!word) { $('word').focus(); return; }
  const code = codeFromWord(word), done = busy($('bWord'), 'さがしています…');
  try {
    for (let k = 0; k < 3; k++) {
      try { await joinRoom(code); return; } catch (err) { net?.close(); net = null; if (err?.type !== 'peer-unavailable') throw err; }
      try { await becomeHost(code, 'word', word); return; } catch (err) { net?.close(); net = null; if (err?.type !== 'unavailable-id') throw err; }
    }
    throw new Error('retry');
  } catch (err) { notice('部屋に入れませんでした。もう一度試すか、別のあいことばにしてください。'); console.error(err); }
  finally { done(); }
};
// だれでも参加：待合室のある公開部屋→試合中の部屋（観戦して待つ）→なければ自分が部屋を開く
$('bQuick').onclick = async () => {
  S.init(); saveMe(); const done = busy($('bQuick'), '対戦相手をさがしています…');
  const slots = [...Array(PUBLIC_SLOTS).keys()].map(i => 'pub' + i);
  try {
    for (const pass of [1, 2]) {
      net = new Net(); bindNet();
      const r = await net.quick(slots, { t: 'hello', name: me.name, char: me.char }, pass);
      if (r.welcome) { isHost = false; clientHandle(r.welcome); syncClock(); return; }
      net.close(); net = null;
      if (r.empty && pass === 1) {
        try { await becomeHost(r.empty, 'pub'); return; } catch (err) { net?.close(); net = null; if (err?.type !== 'unavailable-id') throw err; }
      }
    }
    notice('いまは入れる部屋がありません。少し待ってから試してください。');
  } catch (err) { notice('つなげませんでした。ネットワークを確かめてください。'); console.error(err); net?.close(); net = null; }
  finally { done(); }
};
$('bSolo').onclick = () => {
  S.init(); saveMe(); solo = true; isHost = true; myId = 'h'; clockOff = 0;
  room = { code: null, players: {}, queue: [], roster: {}, phase: 'lobby', seed: 0, t0: 0 };
  addPlayer('h', me.name, me.char); startMatch();
};

// ---------- 通信 ----------
function bindNet() {
  net.on.msg = (from, m) => isHost && from !== 'h' ? hostHandle(from, m) : clientHandle(m);
  net.on.leave = id => { if (!isHost || !room.players[id]) return; feed(`${esc(room.players[id].name)} が抜けました`); delete room.players[id]; room.queue = room.queue.filter(q => q !== id); if (room.alive?.[id]) { delete room.alive[id]; room.elim.push(id); } removeOther(id); bcast({ t: 'room', room }); if (state === 'lobby') showLobby(); checkEnd(); };
  net.on.lost = () => { if (state !== 'title') notice('部屋との接続が切れました', true); };
  net.on.error = e => console.warn('net', e?.type, e);
}
function toHost(m) { if (isHost) hostHandle('h', m); else net.send('h', m); }
function sendTo(id, m) { if (id === myId && isHost) clientHandle(m); else net?.send(id, m); }
function bcast(m, except) { if (net && !solo) net.broadcast(m, except); if (except !== 'h') clientHandle(m); }
function toAll(m) { if (isHost) bcast({ ...m, id: 'h' }, 'h'); else net.send('h', m); }
function addPlayer(id, name, char) {
  const used = Object.values(room.players).map(p => p.color);
  let nm = String(name).slice(0, 10) || 'プレイヤー';
  const names = Object.values(room.players).map(p => p.name);
  for (let k = 2; names.includes(nm); k++) nm = String(name).slice(0, 8) + k;
  room.players[id] = { name: nm, char: (char | 0) % CHARS.length, kills: 0, deaths: 0, color: COLORS.find(c => !used.includes(c)) || '#fff' };
  room.queue.push(id);
}
function hostHandle(from, m) {
  const P = room.players[from];
  switch (m.t) {
    case 'hello':
      if (m.quick) { // だれでも参加の受け入れ：1回目は待合室で空きがある部屋だけ、2回目は観戦待ちも
        const n = Object.keys(room.players).length;
        const ok = room.kind === 'pub' && (m.quick === 1 ? room.phase === 'lobby' && n < MAXP : n < MAXP * 2);
        if (!ok) { sendTo(from, { t: 'full' }); net.kick(from); return; }
      }
      if (!room.players[from]) addPlayer(from, m.name, m.char);
      sendTo(from, { t: 'welcome', you: from, room, mods: [...mods], items: [...hostItems.values()] });
      bcast({ t: 'room', room }, from);
      if (state === 'lobby') showLobby();
      feed(`${esc(m.name)} が入りました`);
      break;
    case 'ping': sendTo(from, { t: 'pong', c: m.c, h: now() }); break;
    case 'pos': bcast({ ...m, id: from }, from); break;
    case 'block': mods.set(`${m.x},${m.y},${m.z}`, m.v); bcast({ ...m, by: from }, from); break;
    case 'hit':
      if (room.phase !== 'game' || gameT() < SAFE || !(from in room.roster) || !(m.target in room.roster)) return;
      sendTo(m.target, { t: 'hit', by: from, dmg: Math.min(15, +m.dmg || 0), kx: m.kx, kz: m.kz, kb: m.kb, w: m.w, crit: m.crit });
      break;
    case 'died': {
      if (!P) return;
      P.deaths++;
      const K = m.killer && room.players[m.killer]; if (K && m.killer !== from) K.kills++;
      if (room.alive?.[from]) { delete room.alive[from]; room.elim.push(from); }
      bcast({ t: 'died', id: from, killer: K ? m.killer : null, cause: m.cause, w: m.w, left: Object.keys(room.alive || {}).length });
      bcast({ t: 'room', room });
      setTimeout(checkEnd, 1500);
      break;
    }
    case 'ispawn': hostItems.set(m.id, { id: m.id, st: m.st, p: m.p }); bcast(m, from); break;
    case 'ipick': { const e = hostItems.get(m.id); if (!e) return; hostItems.delete(m.id); sendTo(from, { t: 'igrant', id: m.id, st: e.st }); bcast({ t: 'igone', id: m.id }); break; }
    case 'arrow': bcast({ ...m, id: from }, from); break;
  }
}
function startMatch() {
  const ids = room.queue.filter(id => room.players[id]).slice(0, MAXP);
  room.roster = {}; ids.forEach((id, i) => room.roster[id] = i);
  for (const p of Object.values(room.players)) { p.kills = 0; p.deaths = 0; }
  room.seed = Math.floor(Math.random() * 1e9); room.t0 = now() + (solo ? 4000 : 6000); room.phase = 'game'; room.cfg = CFG;
  room.alive = {}; ids.forEach(id => room.alive[id] = true); room.elim = []; room.winner = null;
  room.zone = [WS / 2 + (Math.random() - 0.5) * WS * 0.28, WS / 2 + (Math.random() - 0.5) * WS * 0.28];
  mods = new Map(); hostItems = new Map();
  bcast({ t: 'start', room });
}
// 生き残りが1人（ひとりの練習では0人）になったら終わり
function checkEnd() {
  if (!room || room.phase !== 'game') return;
  const alive = Object.keys(room.alive || {}), n = Object.keys(room.roster).length;
  if ((n >= 2 && alive.length <= 1) || alive.length === 0) endMatch(alive[0] || null);
}
function endMatch(winner) {
  if (room.phase !== 'game') return;
  room.phase = 'result';
  if (winner === undefined) { // 時間切れ：生き残りのうち倒した数が多い人
    const alive = Object.keys(room.alive || {}); alive.sort((a, b) => (room.players[b]?.kills || 0) - (room.players[a]?.kills || 0));
    winner = alive[0] || null;
  }
  room.winner = winner;
  const played = room.queue.filter(id => id in room.roster), rest = room.queue.filter(id => !(id in room.roster));
  room.queue = [...rest, ...played];
  bcast({ t: 'end', room });
}
const pingSamples = [];
function clientHandle(m) {
  switch (m.t) {
    case 'welcome':
      myId = m.you; room = m.room; applyCfg();
      if (room.phase === 'game') { enterGame(m.mods, m.items); feed('試合中です。観戦しながら次の試合を待ちます'); } else showLobby();
      break;
    case 'pong': { const rtt = performance.now() - m.c; pingSamples.push({ rtt, off: m.h - (m.c + rtt / 2) }); pingSamples.sort((a, b) => a.rtt - b.rtt); clockOff = pingSamples[0].off; break; }
    case 'room': room = m.room; if (state === 'lobby' || (state === 'result' && room.phase === 'lobby')) showLobby(); if (state === 'play') { renderBoard(); syncOthers(); } break;
    case 'start': room = m.room; applyCfg(); enterGame([], []); break;
    case 'end': room = m.room; showResult(); break;
    case 'pos': {
      if (m.id === myId) return;
      let o = others.get(m.id); if (!o) o = addOther(m.id); if (!o) return;
      if (m.hp < o.hp && !m.dead) o.hurtT = 0.45;
      o.tp = m.p; o.yaw = m.yaw; o.pitch = m.pitch; o.hp = m.hp; o.dead = m.dead; o.sneak = m.sn; o.chute.visible = !!m.pa && !m.dead;
      if (m.sw) o.swing = 0.001;
      setHeldModel(o, m.held || null); drawTag(o.model.userData.tag, m.hp);
      break;
    }
    case 'block': if (m.by !== myId && world) { const old = world.get(m.x, m.y, m.z); world.set(m.x, m.y, m.z, m.v, true); if (!m.v && old) breakParticles(m.x, m.y, m.z, old); } break;
    case 'hit': takeHit(m); break;
    case 'died': onDied(m); break;
    case 'ispawn': if (world && !items.list.has(m.id)) items.spawn(m.id, m.st, m.p, m.v); break;
    case 'igone': items.remove(m.id); break;
    case 'igrant': { const left = inv.add(m.st); if (left) throwStack({ ...m.st, n: left }); S.pickup(); break; }
    case 'arrow': if (m.id !== myId) spawnArrow(m.p, m.v, m.id, false); break;
  }
}

// ---------- 待合室 ----------
// 公開部屋：2人そろったら20秒後、4人なら5秒後に自動で開始。結果のあとは10秒で待合室へ
setInterval(() => {
  if (!isHost || !room || room.kind !== 'pub' || solo) return;
  const n = room.queue.filter(id => room.players[id]).length;
  if (room.phase === 'lobby') {
    let want = n >= MAXP ? now() + 5000 : n >= 2 ? now() + 20000 : 0;
    if (!want) { if (room.startAt) { room.startAt = 0; bcast({ t: 'room', room }); } }
    else if (!room.startAt || want < room.startAt - 1000) { room.startAt = want; bcast({ t: 'room', room }); }
    if (room.startAt && now() >= room.startAt) { room.startAt = 0; startMatch(); }
  } else if (room.phase === 'result') {
    if (!room.backAt) room.backAt = now() + 10000;
    if (now() >= room.backAt) { room.backAt = 0; room.phase = 'lobby'; bcast({ t: 'room', room }); showLobby(); }
  }
}, 500);
setInterval(() => { if (state === 'lobby' && room?.kind === 'pub') lobbyStatus(); }, 500);
function lobbyStatus() {
  const n = room.queue.filter(id => room.players[id]).length;
  $('lobbyNote').textContent = room.startAt ? `あと ${Math.max(0, Math.ceil((room.startAt - now()) / 1000))} 秒で試合が始まります（${n}/${MAXP}人）` : `対戦相手を待っています（${n}/${MAXP}人）。2人そろうと自動で始まります`;
}
function showLobby() {
  state = 'lobby'; show('lobby'); $('hud').hidden = true; gui.close(); document.exitPointerLock?.();
  const url = `${location.origin}${location.pathname}#r=${room.code}`;
  $('shareBox').hidden = room.kind === 'pub';
  $('wordShow').hidden = room.kind !== 'word'; if (room.kind === 'word') $('wordShow').innerHTML = `あいことば「<b>${esc(room.label || '')}</b>」の部屋です。同じあいことばを入れた人が入れます`;
  $('lobbyTitle').textContent = room.kind === 'pub' ? 'だれでも参加の部屋' : '待合室';
  $('roomLink').textContent = url; $('bShare').hidden = !navigator.share;
  $('bCopy').onclick = async () => { try { await navigator.clipboard.writeText(url); $('bCopy').textContent = 'コピーしました'; setTimeout(() => $('bCopy').textContent = 'コピー', 1500); } catch (e) { } };
  $('bShare').onclick = () => navigator.share({ title: 'じゅっぷんクラフト', text: '10分サバイバル対戦しよう', url }).catch(() => { });
  const ids = room.queue.filter(id => room.players[id]);
  $('pcount').textContent = `${ids.length}人・次の試合は先頭の${Math.min(MAXP, ids.length)}人`;
  $('plist').innerHTML = '';
  ids.forEach((id, i) => {
    const p = room.players[id], d = document.createElement('div');
    d.append(faceCanvas(p.char)); const n = document.createElement('span'); n.innerHTML = `<b style="color:${p.color}">${esc(p.name)}</b>${id === myId ? '（あなた）' : ''}${id === 'h' ? '・部屋主' : ''}`; d.append(n);
    const st = document.createElement('span'); st.className = 'st' + (i < MAXP ? ' play' : ''); st.textContent = i < MAXP ? '次の試合に参加' : `待ち ${i - MAXP + 1}番目`; d.append(st);
    $('plist').appendChild(d);
  });
  const pub = room.kind === 'pub';
  $('bStart').hidden = !isHost || pub; $('waitHost').hidden = isHost || pub;
  if (pub) lobbyStatus(); else $('lobbyNote').textContent = isHost ? '人がそろったら「試合を始める」を押してください。1人でも始められます。' : '';
}
$('bStart').onclick = () => { if (isHost) startMatch(); };
$('bLeave').onclick = $('bResTitle').onclick = () => { net?.close(); location.hash = ''; location.reload(); };
$('bAgain').onclick = () => { if (solo) return startMatch(); if (isHost) { room.phase = 'lobby'; bcast({ t: 'room', room }); showLobby(); } };

// ---------- 試合に入る ----------
function enterGame(modList, itemList) {
  state = 'play'; show(null); $('hud').hidden = false; gui.close();
  for (const id of [...others.keys()]) removeOther(id);
  for (const a of arrows) R.scene.remove(a.mesh); arrows.length = 0;
  items.clear(); furnaces.clear();
  world = new World(room.seed); items.w = world;
  for (const [k, v] of modList) { const [x, y, z] = k.split(',').map(Number); world.set(x, y, z, v, true); }
  world.onSet = (x, y, z, v) => toHost({ t: 'block', x, y, z, v });
  R.buildAll(world);
  for (const e of itemList) items.spawn(e.id, e.st, e.p, [0, 0, 0], 1);
  spectator = !(myId in room.roster);
  player = new Player(world); hookPlayer();
  inv.clear(); inv.sel = 0; inv.onChange = renderHotbar;
  hp = 20; food = 20; sat = 5; exhaust = 0; dead = false; protectUntil = 0; lastAttacker = null;
  const sp = world.corner(room.roster[myId] ?? 0);
  player.place(spectator ? [WS / 2, 60, WS / 2 + 40] : sp, Math.atan2(sp[0] - WS / 2, sp[2] - WS / 2));
  player.para = !spectator; player.pitch = spectator ? -0.6 : -0.5;
  myChute.visible = !spectator; out = false; myTrail.clear();
  { const c = room.players[myId]?.color || '#e84a3a'; R.scene.remove(myChute); myChute = makeParachute(c); myChute.visible = !spectator; R.scene.add(myChute); }
  if (myModel) R.scene.remove(myModel);
  myModel = makeCharacter(me.char, { name: '', color: '#fff' }); myModel.userData.tag.visible = false; R.scene.add(myModel);
  camBlend = spectator ? 0 : 1;
  syncOthers(); renderHotbar(); renderStats(); renderBoard();
  $('spect').hidden = !spectator; $('hotbarWrap').hidden = spectator;
  if (spectator) { const pos = room.queue.indexOf(myId) + 1; $('spect').textContent = `観戦中：いまの試合が終わったら参加できます（待ち ${Math.max(1, pos - MAXP)}番目）`; }
  $('touch').hidden = !mobile; $('hint').hidden = true; hintShown = false;
  announced.start = announced.fight = announced.shrink = false;
  S.ambient('day'); lockPointer();
}
function syncOthers() {
  if (!world) return;
  for (const id of Object.keys(room.roster)) if (id !== myId && !others.has(id)) addOther(id);
  for (const id of [...others.keys()]) if (!(id in room.roster)) removeOther(id);
}
function addOther(id) {
  if (!room || !(id in room.roster) || id === myId || !world) return null;
  const p = room.players[id]; if (!p) return null;
  const model = makeCharacter(p.char, { name: p.name, color: p.color }); R.scene.add(model);
  const sp = world.corner(room.roster[id]);
  const chute = makeParachute(p.color); chute.visible = false; model.add(chute); chute.position.y = 6.0;
  const marker = diveMarker(p.name, p.color); marker.visible = false; model.add(marker); marker.position.y = 9.6;
  const trail = new Trail(R.scene, p.color);
  const o = { chute, marker, trail, model, p: sp.slice(), tp: sp.slice(), yaw: 0, pitch: 0, hp: 20, swing: 0, dead: false, hurtT: 0, heldId: undefined };
  others.set(id, o); return o;
}
function removeOther(id) { const o = others.get(id); if (o) { R.scene.remove(o.model); o.trail?.dispose(); } others.delete(id); }
// 降下中の目印：遠くでも同じ大きさで見える名前と矢印
function diveMarker(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.font = '700 30px "Zen Kaku Gothic New", sans-serif'; const w = Math.min(240, g.measureText(name).width + 28);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(128 - w / 2, 4, w, 44, 10); g.fill();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 27);
  g.beginPath(); g.moveTo(112, 56); g.lineTo(144, 56); g.lineTo(128, 88); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, fog: false, transparent: true }));
  sp.scale.set(0.16, 0.06, 1); sp.renderOrder = 20; return sp;
}
function setHeldModel(o, id) {
  if (o.heldId === id) return; o.heldId = id;
  const h = o.model.userData.held; h.clear(); if (!id) return;
  const m = itemModel(id, blockFaceMats, ITEMS[id].block ? 0.3 : 0.42);
  if (ITEMS[id].block) m.position.set(0, -0.05, -0.12); else { m.rotation.set(0, Math.PI / 2, -Math.PI / 4); m.position.set(0, 0.05, -0.2); }
  h.add(m);
}

// ---------- アイテムを落とす・拾う ----------
function newItemId() { return `${myId.slice(0, 6)}${(itemSeq++).toString(36)}${Math.random().toString(36).slice(2, 4)}`; }
function spawnItem(st, p, v) {
  const id = newItemId(); items.spawn(id, st, p, v);
  const m = { t: 'ispawn', id, st, p: p.map(x => +x.toFixed(2)), v: v.map(x => +x.toFixed(2)) };
  if (solo) hostItems.set(id, { id, st, p }); else toHost(m);
}
function throwStack(st) {
  if (!player) return;
  const e = player.eye(), d = player.dir();
  spawnItem(st, [e[0] + d[0] * 0.3, e[1] - 0.3, e[2] + d[2] * 0.3], [d[0] * 5, d[1] * 5 + 1.5, d[2] * 5]);
}
function dropFromBlock(id, x, y, z) { spawnItem({ id, n: 1 }, [x + 0.5, y + 0.5, z + 0.5], [(Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2]); }
function onTouchItem(e) {
  if (dead || spectator) return;
  const it = ITEMS[e.st.id]; if (!inv.main.some(s => !s || (s.id === e.st.id && !it.dur && s.n < it.stack))) return;
  toHost({ t: 'ipick', id: e.id });
}

// ---------- 体力・満腹度・倒される ----------
function takeHit(m) {
  if (dead || spectator || performance.now() < protectUntil) return;
  const red = Math.min(0.8, inv.armorPoints() * 0.04);
  hurt(m.dmg * (1 - red), m.by, m.w);
  for (let i = 0; i < 4; i++) if (inv.armor[i]) inv.wear(inv.armor, i, 1);
  const kb = m.kb || 1; player.push(m.kx * 6 * kb, m.kz * 6 * kb, 5.5);
}
function hurt(dmg, by, weapon, cause) {
  if (dead || spectator || dmg <= 0) return;
  hp = Math.max(0, hp - dmg); lastHurt = performance.now(); hurtRoll = 1; hurtDir = Math.random() < 0.5 ? -1 : 1;
  if (by) { lastAttacker = by; lastAttackerAt = performance.now(); lastWeapon = weapon; }
  $('hurt').classList.add('on'); setTimeout(() => $('hurt').classList.remove('on'), 120);
  S.hurt(); exhaust += 0.1; renderStats();
  if (hp <= 0) die(cause);
}
function die(cause) {
  dead = true; S.death(); gui.close(); bowCharge = -1; eatT = -1;
  const killer = lastAttacker && performance.now() - lastAttackerAt < 8000 ? lastAttacker : null;
  const p = player.p;
  for (const st of inv.all()) spawnItem(st, [p[0], p[1] + 1, p[2]], [(Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5]);
  inv.clear();
  toHost({ t: 'died', killer, cause: killer ? null : cause, w: killer ? lastWeapon : null });
  respawnAt = performance.now() + 4000;
  $('centerMsg').hidden = false; $('bigMsg').textContent = '脱落';
}
function becomeSpectator() {
  spectator = true; dead = false; $('centerMsg').hidden = true; $('hotbarWrap').hidden = true;
  $('spect').hidden = false; $('spect').textContent = '脱落しました。観戦中（自由に飛べます）';
  player.p[1] += 6; player.para = false; myChute.visible = false;
}
function respawn() {
  dead = false; hp = 20; food = 20; sat = 5; exhaust = 0; lastAttacker = null;
  const r = borderR(); let best = null, bd = -1;
  for (let k = 0; k < 24; k++) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * Math.min(WS * 0.22, r - 4);
    const x = Math.floor(WS / 2 + Math.cos(a) * rr), z = Math.floor(WS / 2 + Math.sin(a) * rr), y = world.top(x, z);
    if (y <= SEA || world.get(x, y + 1, z) || world.get(x, y + 2, z)) continue;
    let dmin = 99; for (const o of others.values()) dmin = Math.min(dmin, Math.hypot(o.p[0] - x, o.p[2] - z));
    if (dmin > bd) { bd = dmin; best = [x + 0.5, y + 1.01, z + 0.5]; }
  }
  player.place(best || world.spawn(0), player.yaw);
  protectUntil = performance.now() + 3000; $('centerMsg').hidden = true; renderStats();
}
const CAUSE = { fall: '落ちて', border: '安全地帯の外で', hunger: '飢えて' };
function onDied(m) {
  const P = room.players[m.id], K = m.killer && room.players[m.killer];
  const nm = p => p ? `<b style="color:${p.color}">${esc(p.name)}</b>` : '？';
  if (K) feed(`${nm(K)} が ${nm(P)} を倒した（${m.w ? ITEMS[m.w]?.name || '弓' : '素手'}）`);
  else feed(`${nm(P)} が${CAUSE[m.cause] || ''}力尽きた`);
  if (m.left != null && Object.keys(room.roster).length > 1) feed(`<b>残り ${m.left}人</b>`);
  if (m.killer === myId) S.kill();
  const o = others.get(m.id); if (o) debris.spawn(o.p[0], o.p[1] + 0.5, o.p[2], P ? P.color : '#fff', 18, 1.2);
}
// 満腹度（走る・跳ぶ・攻撃・被弾で減り、18以上で自然回復）
function tickFood(dt) {
  if (exhaust >= 4) { exhaust -= 4; if (sat > 0) sat = Math.max(0, sat - 1); else food = Math.max(0, food - 1); renderStats(); }
  regenT += dt;
  if (food >= 18 && hp < 20 && regenT > (sat > 0 && food >= 20 ? 1.5 : 4)) { regenT = 0; hp = Math.min(20, hp + 1); exhaust += 6; renderStats(); }
  else if (food === 0 && regenT > 4) { regenT = 0; if (hp > 1) hurt(1, null, null, 'hunger'); }
}

// ---------- 入力 ----------
const keys = new Set();
let mouseL = false, mouseR = false, atkPress = false, usePress = false, lastW = 0, sprintTap = false;
function lockPointer() { if (mobile) return; try { $('gl').requestPointerLock?.()?.catch?.(() => { }); } catch (e) { } }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyW' && !keys.has('KeyW')) { if (performance.now() - lastW < 280) sprintTap = true; lastW = performance.now(); }
  keys.add(e.code);
  if (state !== 'play') return;
  if (e.code === 'KeyE' || (e.code === 'Escape' && gui.open)) { if (gui.open) closeGui(); else if (!dead && !spectator) openGui('inv'); }
  if (/^Digit[1-9]$/.test(e.code)) selectSlot(+e.code.slice(5) - 1);
  if (e.code === 'KeyQ' && !gui.open && !dead && !spectator) { const st = inv.takeHeld(e.ctrlKey || e.metaKey ? 64 : 1); if (st) { throwStack(st); swing(); } }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyW') sprintTap = false; });
addEventListener('wheel', e => { if (state !== 'play' || gui.open) return; selectSlot((inv.sel + (e.deltaY > 0 ? 1 : -1) + HOT) % HOT); }, { passive: true });
$('gl').addEventListener('mousedown', e => {
  if (mobile || state !== 'play') return;
  if (!document.pointerLockElement) { lockPointer(); return; }
  if (e.button === 0) { mouseL = true; atkPress = true; }
  if (e.button === 2) { mouseR = true; usePress = true; }
});
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (!document.pointerLockElement || !player || gui.open) return; player.yaw -= e.movementX * 0.0025; player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - e.movementY * 0.0025)); });
function selectSlot(i) { if (i === inv.sel) return; inv.sel = i; equipT = 0; bowCharge = -1; eatT = -1; renderHotbar(); }
const T = { stick: null, sx: 0, sy: 0, mx: 0, my: 0, look: null, lx: 0, ly: 0, atk: false, use: false, jump: false, sneak: false };
$('touch').addEventListener('pointerdown', e => {
  S.init(); if (e.target.closest('.tb,.tinv')) return;
  const r = $('stick').getBoundingClientRect();
  if (T.stick == null && e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.4) { T.stick = e.pointerId; T.sx = r.left + r.width / 2; T.sy = r.top + r.height / 2; moveStick(e); }
  else if (T.look == null) { T.look = e.pointerId; T.lx = e.clientX; T.ly = e.clientY; }
});
function moveStick(e) { let dx = e.clientX - T.sx, dy = e.clientY - T.sy; const m = Math.hypot(dx, dy); if (m > 50) { dx *= 50 / m; dy *= 50 / m; } T.mx = dx / 50; T.my = dy / 50; $('stick').firstElementChild.style.transform = `translate(${dx}px,${dy}px)`; }
$('touch').addEventListener('pointermove', e => {
  if (e.pointerId === T.stick) moveStick(e);
  else if (e.pointerId === T.look && player && !gui.open) { player.yaw -= (e.clientX - T.lx) * 0.006; player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - (e.clientY - T.ly) * 0.006)); T.lx = e.clientX; T.ly = e.clientY; }
});
const tUp = e => { if (e.pointerId === T.stick) { T.stick = null; T.mx = T.my = 0; $('stick').firstElementChild.style.transform = ''; } if (e.pointerId === T.look) T.look = null; };
$('touch').addEventListener('pointerup', tUp); $('touch').addEventListener('pointercancel', tUp);
function holdBtn(el, on, off) { el.addEventListener('pointerdown', e => { e.stopPropagation(); el.classList.add('on'); on(); }); const f = () => { el.classList.remove('on'); off(); }; el.addEventListener('pointerup', f); el.addEventListener('pointercancel', f); el.addEventListener('pointerleave', f); }
holdBtn($('tAtk'), () => { T.atk = true; atkPress = true; }, () => T.atk = false);
holdBtn($('tUse'), () => { T.use = true; usePress = true; }, () => T.use = false);
holdBtn($('tJump'), () => T.jump = true, () => T.jump = false);
$('tSneak').onclick = () => { T.sneak = !T.sneak; $('tSneak').classList.toggle('on', T.sneak); };
$('tInv').onclick = () => { if (gui.open) closeGui(); else if (!dead && !spectator) openGui('inv'); };
$('tDrop').onclick = () => { const st = inv.takeHeld(1); if (st) throwStack(st); };

// ---------- 持ち物・作業台・かまど ----------
function openGui(kind, F = null) { gui.show(kind, F); document.exitPointerLock?.(); mouseL = mouseR = false; $('tClose').hidden = !mobile; }
function closeGui() { gui.close(); renderHotbar(); lockPointer(); $('tClose').hidden = true; }
$('tClose').onclick = () => closeGui();
function furnaceAt(x, y, z) { const k = `${x},${y},${z}`; if (!furnaces.has(k)) furnaces.set(k, { slots: [null, null, null], burn: 0, burnMax: 0, prog: 0, k }); return furnaces.get(k); }
function tickFurnaces(dt) {
  for (const F of furnaces.values()) {
    const [inp, fuel, out] = F.slots, res = inp && SMELT[inp.id];
    const can = res && (!out || (out.id === res && out.n < ITEMS[res].stack));
    if (F.burn > 0) F.burn = Math.max(0, F.burn - dt);
    if (can) {
      if (F.burn <= 0 && fuel && FUEL[fuel.id]) { F.burnMax = F.burn = FUEL[fuel.id]; fuel.n--; if (!fuel.n) F.slots[1] = null; F.dirty = true; }
      if (F.burn > 0) { F.prog += dt / SMELT_TIME; if (F.prog >= 1) { F.prog = 0; inp.n--; if (!inp.n) F.slots[0] = null; if (out) out.n++; else F.slots[2] = { id: res, n: 1 }; F.dirty = true; } }
      else F.prog = Math.max(0, F.prog - dt * 0.5);
    } else F.prog = 0;
  }
}

// ---------- HUD（マイクラの体力・防具・満腹度） ----------
function iconURL(rows, pal) { const c = document.createElement('canvas'); c.width = c.height = 9; const g = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } })); return c.toDataURL(); }
const HEART = ['.xx...xx.', 'xAAx.xAAx', 'xAAAxAAAx', 'xAAAAAAAx', '.xAAAAAx.', '..xAAAx..', '...xAx...', '....x....'];
const ARMR = ['.xxx.xxx.', 'xAAAxAAAx', 'xAAAAAAAx', 'xAAAAAAAx', '.xAAAAAx.', '.xAAAAAx.', '.xAAAAAx.', '..xxxxx..'];
const MEAT = ['.....xx..', '....xAAx.', '...xAAAAx', '...xAAAx.', '..xBAAx..', '.xBx.xx..', 'xBx......', '.x.......'];
const ICONS = {
  h: [iconURL(HEART, { x: '#1a0a0a', A: '#3a2020' }), iconURL(HEART.map(r => [...r].map((c, i) => c === 'A' && i > 4 ? 'C' : c).join('')), { x: '#1a0a0a', A: '#e3262f', C: '#3a2020' }), iconURL(HEART, { x: '#1a0a0a', A: '#e3262f' })],
  a: [iconURL(ARMR, { x: '#2a2a2a', A: '#505058' }), iconURL(ARMR.map(r => [...r].map((c, i) => c === 'A' && i > 4 ? 'C' : c).join('')), { x: '#1a1a1a', A: '#dcdce4', C: '#505058' }), iconURL(ARMR, { x: '#1a1a1a', A: '#dcdce4' })],
  f: [iconURL(MEAT, { x: '#2a1a0a', A: '#4a3a2a', B: '#6a5a4a' }), iconURL(MEAT.map(r => [...r].map((c, i) => (c === 'A' || c === 'B') && i < 4 ? 'C' : c).join('')), { x: '#1a0e06', A: '#b86a2a', B: '#e8d8c0', C: '#4a3a2a' }), iconURL(MEAT, { x: '#1a0e06', A: '#b86a2a', B: '#e8d8c0' })],
};
function renderStats() {
  const row = (el, v, set, right) => { el.innerHTML = ''; for (let i = 0; i < 10; i++) { const k = right ? 9 - i : i, x = v - k * 2, d = document.createElement('i'); d.style.backgroundImage = `url(${set[x >= 2 ? 2 : x >= 1 ? 1 : 0]})`; el.appendChild(d); } };
  row($('hearts'), Math.ceil(hp), ICONS.h); const ap = inv.armorPoints(); $('armorRow').style.visibility = ap ? 'visible' : 'hidden'; row($('armorRow'), ap, ICONS.a); row($('food'), food, ICONS.f, true);
  $('hearts').classList.toggle('low', hp <= 4);
}
let nameT = 0;
function renderHotbar() {
  const hb = $('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < HOT; i++) { const d = document.createElement('div'); d.className = 'hslot' + (i === inv.sel ? ' on' : ''); gui.fillSlot(d, inv.main[i]); d.onpointerdown = e => { e.stopPropagation(); selectSlot(i); }; hb.appendChild(d); }
  const h = inv.held(), name = h ? ITEMS[h.id].name : '';
  if ($('itemname').textContent !== name) { $('itemname').textContent = name; nameT = 2.5; }
  $('tUse').textContent = !h ? '使う' : ITEMS[h.id].block ? '置く' : ITEMS[h.id].food ? '食べる' : ITEMS[h.id].bow ? '引く' : '使う';
  renderStats(); updateFP();
}
function renderBoard() {
  if (!room) return;
  const ids = Object.keys(room.roster).sort((a, b) => (room.players[b]?.kills || 0) - (room.players[a]?.kills || 0));
  $('board').innerHTML = '';
  for (const id of ids) { const p = room.players[id]; if (!p) continue; const d = document.createElement('div'); d.append(faceCanvas(p.char, 16)); const n = document.createElement('span'); n.innerHTML = `<span style="color:${p.color}">${esc(p.name)}</span>`; d.append(n); if (room.alive && !room.alive[id]) d.style.opacity = 0.4; const b = document.createElement('b'); b.textContent = p.kills; d.append(b); $('board').appendChild(d); }
  if (room.alive) { const L = document.createElement('div'); L.innerHTML = `<span>残り</span><b>${Object.keys(room.alive).length}人</b>`; $('board').prepend(L); }
}
function fmt(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function borderR() { const t = gameT(); if (t < SHRINK) return 999; return Math.max(4, WS * 0.6 - (t - SHRINK) / (DUR - SHRINK) * (WS * 0.6 - 4)); }
function zoneC() { return room?.zone || [WS / 2, WS / 2]; }
function zoneDmg() { return 1 + Math.max(0, gameT() - SHRINK) / 120; }
let out = false;

// ---------- 一人称の手元（マイクラの腕振り） ----------
const fpRoot = new THREE.Group(); R.fpScene.add(fpRoot);
let myChute = makeParachute('#e84a3a'); myChute.visible = false; R.scene.add(myChute);
const myTrail = new Trail(R.scene, '#ffffff');
let myModel = null, camBlend = 0, diveFog = 0, hintShown = false; // 降下中は3人称（camBlend=1）、着地したら1人称へ
const fpHold = new THREE.Group(); fpRoot.add(fpHold);
let swingT = -1, equipT = 1, lastHeldKey = '';
function updateFP() {
  const h = inv.held(), key = h ? h.id : '';
  if (key === lastHeldKey && fpHold.children.length) return; lastHeldKey = key; fpHold.clear();
  if (!h) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.66), new THREE.MeshLambertMaterial({ color: CHARS[me.char].skin })); arm.position.set(0, 0, 0.14); fpHold.add(arm); fpHold.userData.kind = 'arm'; return; }
  const it = ITEMS[h.id], m = itemModel(h.id, blockFaceMats, it.block ? 0.34 : 0.32);
  if (it.block) m.rotation.set(0, Math.PI / 4, 0); else { m.rotation.set(-0.25, -0.95, 0.3); m.position.set(0, 0.08, 0); }
  fpHold.add(m); fpHold.userData.kind = it.block ? 'block' : 'item';
}
function swing() { if (swingT < 0 || swingT > 0.55) swingT = 0; swingSent = true; }
function animFP(dt) {
  if (swingT >= 0) { swingT += dt / 0.3; if (swingT >= 1) swingT = -1; }
  equipT = Math.min(1, equipT + dt * 5);
  const f = swingT < 0 ? 0 : swingT, sq = Math.sqrt(f), PI = Math.PI, kind = fpHold.userData.kind;
  const base = kind === 'arm' ? [0.44, -0.46, -0.52] : kind === 'block' ? [0.4, -0.4, -0.62] : [0.42, -0.34, -0.68];
  const dx = -0.24 * Math.sin(sq * PI), dy = 0.12 * Math.sin(sq * 2 * PI), dz = -0.2 * Math.sin(f * PI);
  const walk = player?.onGround && !gui.open ? player.walkDist : 0;
  const bob = Math.sin(walk * 2.2) * 0.022, bobx = Math.cos(walk * 1.1) * 0.014;
  fpRoot.position.set(base[0] + dx + bobx, base[1] + dy + bob - (1 - equipT) * 0.5, base[2] + dz);
  fpRoot.rotation.set(-Math.sin(sq * PI) * 1.1 + (kind === 'arm' ? -0.1 : 0), -Math.sin(f * f * PI) * 0.35 + (kind === 'arm' ? -0.25 : 0), -Math.sin(sq * PI) * 0.3);
  if (bowCharge >= 0) { fpRoot.position.set(0.16, -0.3, -0.46 + bowCharge * 0.06); fpRoot.rotation.set(0.05, -0.15, -0.55); }
  if (eatT >= 0) { fpRoot.position.set(0.1, -0.3 + Math.abs(Math.sin(eatT * 18)) * 0.04, -0.4); fpRoot.rotation.set(0.35, -0.6, 0.2); }
}

// ---------- 掘る・攻撃・置く・食べる・弓 ----------
let digT = 0, digKey = null, lastAtk = 0, bowCharge = -1, eatT = -1, regenT = 0, posT = 0, swingSent = false;
const sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
const crackTex = crackCanvases().map(c => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; return t; });
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ map: crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
R.scene.add(sel, crack); crack.visible = false;
// マイクラの採掘時間：ダメージ＝速さ÷硬さ÷(取れるなら30、取れないなら100)。1ティック＝1/20秒
function breakTime(b) {
  const d = BLOCKS[b], it = ITEMS[inv.held()?.id];
  if (d.hard === Infinity) return Infinity;
  let speed = 1;
  if (it?.tool && it.tool === d.tool) speed = it.speed;
  if (it?.tool === 'sword') speed = d.web ? 15 : 1.5;
  if (player.inWater) speed /= 5; if (!player.onGround) speed /= 5;
  const dmg = speed / d.hard / (canHarvest(b) ? 30 : 100);
  return dmg >= 1 ? 0 : Math.ceil(1 / dmg) / 20;
}
function canHarvest(b) { const d = BLOCKS[b], it = ITEMS[inv.held()?.id]; if (d.needTool) return it?.tool === d.tool; if (!d.level) return true; return it?.tool === d.tool && it.level >= d.level; }
const colorCache = {};
function blockColor(b) { if (colorCache[b]) return colorCache[b]; const px = tilePixels(BLOCKS[b].faces[1]); let r = 0, g = 0, bl = 0, n = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3]) { r += px[i]; g += px[i + 1]; bl += px[i + 2]; n++; } return colorCache[b] = `rgb(${r / n | 0},${g / n | 0},${bl / n | 0})`; }
function breakParticles(x, y, z, b, n = 14) { debris.spawn(x, y, z, blockColor(b), n); }
function targetPlayer(maxD) {
  const o = player.eye(), d = player.dir(); let best = null, bt = maxD;
  for (const [id, x] of others) { if (x.dead) continue; const t = rayBox(o, d, [x.p[0] - 0.35, x.p[1], x.p[2] - 0.35, x.p[0] + 0.35, x.p[1] + 1.85, x.p[2] + 0.35]); if (t != null && t < bt) { bt = t; best = id; } }
  return best ? { id: best, t: bt } : null;
}
function attackCharge() { const cool = ITEMS[inv.held()?.id]?.cool || 0.25; return Math.min(1, (performance.now() - lastAtk) / 1000 / cool); }
function actions(dt) {
  const h = inv.held(), it = h && ITEMS[h.id];
  const hit = raycast(world, player.eye(), player.dir(), 4.5);
  if (hit) { sel.visible = true; sel.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); } else sel.visible = false;
  // 攻撃（振りのため時間でダメージが変わる。落下中はクリティカル）
  if (atkPress) {
    atkPress = false; swing();
    const tp = targetPlayer(3);
    if (tp && (!hit || tp.t < hit.t)) {
      const o = others.get(tp.id), dir = player.dir(), L = Math.hypot(dir[0], dir[2]) || 1;
      const ch = attackCharge();
      let dmg = (it?.dmg || 1) * (0.2 + ch * ch * 0.8);
      const crit = ch > 0.9 && !player.onGround && player.v[1] < 0 && !player.inWater;
      if (crit) { dmg *= 1.5; debris.spawn(o.p[0], o.p[1] + 1.2, o.p[2], '#ffe070', 12, 0.9); }
      const kb = (player.sprinting && ch > 0.9 ? 1.7 : 1) * (0.4 + ch * 0.6);
      toHost({ t: 'hit', target: tp.id, dmg: +dmg.toFixed(2), kx: dir[0] / L, kz: dir[2] / L, kb, w: h?.id || null, crit });
      S.hit(); exhaust += 0.1; o.hurtT = 0.3;
      if (it?.dur) inv.wear(inv.main, inv.sel, it.tool === 'sword' ? 1 : 2);
      if (player.sprinting && ch > 0.9) player.sprinting = false;
      if (gameT() < SAFE) feed('準備時間中は攻撃できません');
      lastAtk = performance.now(); digT = 0; return;
    }
    lastAtk = performance.now();
  }
  // 掘る（押し続け、腕を振り続ける）
  if ((mouseL || T.atk) && hit && world.inside(hit.x, hit.z)) {
    const key = `${hit.x},${hit.y},${hit.z}`; if (key !== digKey) { digKey = key; digT = 0; }
    const need = breakTime(hit.b);
    if (swingT < 0) swing();
    if (need !== Infinity) {
      digT += dt;
      crack.visible = need > 0.05; crack.position.copy(sel.position); crack.material.map = crackTex[Math.min(9, Math.floor(digT / Math.max(need, 1e-3) * 10))];
      if (Math.floor((digT - dt) / 0.22) !== Math.floor(digT / 0.22)) { S.dig(BLOCKS[hit.b].sound); breakParticles(hit.x, hit.y, hit.z, hit.b, 3); }
      if (digT >= need) {
        const d = BLOCKS[hit.b];
        world.set(hit.x, hit.y, hit.z, 0);
        const up = world.get(hit.x, hit.y + 1, hit.z); if (up && BLOCKS[up].plant) world.set(hit.x, hit.y + 1, hit.z, 0); // 足場を失った草花
        R.updateDirty(world);
        breakParticles(hit.x, hit.y, hit.z, hit.b); S.brk(d.sound); exhaust += 0.005;
        if (canHarvest(hit.b)) {
          let drop = d.drop;
          if (hit.b === B.gravel && Math.random() < 0.1) drop = 'flint';
          if (hit.b === B.leaves && Math.random() < 0.05) drop = 'apple';
          if (drop) dropFromBlock(drop, hit.x, hit.y, hit.z);
        }
        if (it?.dur && d.hard > 0 && inv.wear(inv.main, inv.sel, it.tool && it.tool !== 'sword' ? 1 : 2)) { S.brk('wood'); feed(`${it.name}が壊れた`); }
        digT = 0; digKey = null; crack.visible = false;
      }
    }
  } else { digT = 0; digKey = null; crack.visible = false; }
  // 使う
  if (usePress) {
    usePress = false;
    if (hit && (hit.b === B.table || hit.b === B.furnace) && !(player.input.sneak && it?.block)) {
      swing(); if (hit.b === B.table) openGui('table'); else openGui('furnace', furnaceAt(hit.x, hit.y, hit.z)); return;
    }
    if (it?.bow) { if (inv.count('arrow') > 0) bowCharge = 0; else feed('矢がありません'); }
    else if (it?.food) { if (food < 20) eatT = 0; else feed('おなかがいっぱいです'); }
    else if (it?.block && hit?.face) {
      const onPlant = BLOCKS[hit.b].plant, x = onPlant ? hit.x : hit.x + hit.face[0], y = onPlant ? hit.y : hit.y + hit.face[1], z = onPlant ? hit.z : hit.z + hit.face[2], cur = world.get(x, y, z);
      if (world.inside(x, z) && y < world.H - 1 && (!cur || cur === B.water || BLOCKS[cur].plant) && !overlapsAnyone(x, y, z)) {
        world.set(x, y, z, B[it.block]); inv.takeHeld(1); R.updateDirty(world); S.put(); swing();
      }
    }
  }
  const holdUse = mouseR || T.use;
  if (eatT >= 0) {
    if (!holdUse || !it?.food) eatT = -1;
    else { eatT += dt; player.slow = 0.35; if (Math.floor((eatT - dt) / 0.25) !== Math.floor(eatT / 0.25)) S.chew(); if (eatT >= 1.6) { food = Math.min(20, food + it.food); sat = Math.min(food, sat + 2.4); inv.takeHeld(1); eatT = -1; S.eat(); renderStats(); } }
    if (eatT < 0) player.slow = 1;
  }
  if (bowCharge >= 0) {
    bowCharge = Math.min(1, bowCharge + dt); player.slow = 0.25;
    $('bowbar').hidden = false; $('bowfill').style.width = `${bowCharge * 100}%`;
    if (!holdUse || !it?.bow) {
      const f = bowCharge, pw = Math.min(1, (f * f + f * 2) / 3);
      if (pw > 0.1 && it?.bow && inv.remove('arrow', 1)) {
        const e = player.eye(), d = player.dir(), sp = 55 * pw;
        const p = [e[0] + d[0] * 0.5, e[1] + d[1] * 0.5 - 0.1, e[2] + d[2] * 0.5], v = [d[0] * sp, d[1] * sp, d[2] * sp];
        spawnArrow(p, v, myId, true, Math.ceil(pw * 6 + (pw >= 1 && Math.random() < 0.3 ? 3 : 0)));
        toHost({ t: 'arrow', p, v }); S.bowShot(); inv.wear(inv.main, inv.sel, 1);
      }
      bowCharge = -1; player.slow = 1; $('bowbar').hidden = true;
    }
  }
}
function overlapsAnyone(x, y, z) {
  const hb = p => x + 1 > p[0] - PW && x < p[0] + PW && y + 1 > p[1] && y < p[1] + PH && z + 1 > p[2] - PW && z < p[2] + PW;
  if (hb(player.p)) return true; for (const o of others.values()) if (!o.dead && hb(o.p)) return true; return false;
}
function spawnArrow(p, v, owner, mine, dmg = 0) { const mesh = makeArrow(); mesh.position.set(...p); R.scene.add(mesh); arrows.push({ p: p.slice(), v: v.slice(), owner, mine, dmg, mesh, life: 30, stuck: false }); }
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i]; a.life -= dt;
    if (a.life <= 0) { R.scene.remove(a.mesh); arrows.splice(i, 1); continue; }
    if (a.stuck) continue;
    for (let s = 0; s < 6 && !a.stuck && a.life > 0; s++) {
      const st = dt / 6; a.v[1] -= 20 * st; a.v[0] *= 1 - 0.2 * st; a.v[2] *= 1 - 0.2 * st;
      const np = [a.p[0] + a.v[0] * st, a.p[1] + a.v[1] * st, a.p[2] + a.v[2] * st];
      const b = world.get(Math.floor(np[0]), Math.floor(np[1]), Math.floor(np[2]));
      if (b && BLOCKS[b].solid) { a.stuck = true; a.life = Math.min(a.life, 10); S.arrowHit(); break; }
      if (a.mine) for (const [id, o] of others) {
        if (o.dead) continue;
        if (np[0] > o.p[0] - 0.35 && np[0] < o.p[0] + 0.35 && np[2] > o.p[2] - 0.35 && np[2] < o.p[2] + 0.35 && np[1] > o.p[1] && np[1] < o.p[1] + 1.85) {
          const L = Math.hypot(a.v[0], a.v[2]) || 1;
          toHost({ t: 'hit', target: id, dmg: a.dmg, kx: a.v[0] / L, kz: a.v[2] / L, kb: 0.6, w: 'bow' });
          S.hit(); o.hurtT = 0.3; a.life = 0; break;
        }
      }
      a.p = np;
    }
    a.mesh.position.set(...a.p); if (!a.stuck) a.mesh.lookAt(a.p[0] - a.v[0], a.p[1] - a.v[1], a.p[2] - a.v[2]);
  }
}
function hookPlayer() {
  let lastStep = 0;
  player.onJump = () => { S.jump(); exhaust += player.sprinting ? 0.2 : 0.05; };
  player.onLand = v => { if (v > 6) S.land(v); };
  player.onFall = n => { if (gameT() >= 0) hurt(n, null, null, 'fall'); };
  player.stepHook = () => { if (player.walkDist - lastStep > 1.7 && player.onGround && !player.input.sneak) { lastStep = player.walkDist; const b = world.get(Math.floor(player.p[0]), Math.floor(player.p[1] - 0.1), Math.floor(player.p[2])); if (b) S.step(BLOCKS[b].sound); } };
}

// ---------- 毎フレーム ----------
let last = performance.now(), acc = 0, fpsN = 0, fpsT = 0, borderDmgT = 0, fov = 75;
const announced = {};
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  fpsN++; fpsT += dt; if (fpsT > 1) { window.__game.fps = fpsN / fpsT; fpsN = fpsT = 0; }
  const cam = R.camera;
  if (state === 'play' && world) {
    const tg = gameT(), I = player.input, open = gui.open;
    if (dead || open) { I.f = I.s = 0; I.jump = false; I.sneak = false; I.run = false; }
    else {
      I.f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - T.my;
      I.s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + T.mx;
      I.jump = keys.has('Space') || T.jump;
      I.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight') || T.sneak;
      I.run = (keys.has('ControlLeft') || sprintTap || Math.hypot(T.mx, T.my) > 0.92) && food > 6;
    }
    if (spectator) {
      const d = player.dir(), sp = keys.has('ControlLeft') ? 24 : 12, rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      player.p[0] += (d[0] * I.f + rx * I.s) * sp * dt; player.p[1] += (d[1] * I.f + (I.jump ? 1 : 0) - (I.sneak ? 1 : 0)) * sp * dt; player.p[2] += (d[2] * I.f + rz * I.s) * sp * dt;
      player.p[1] = Math.max(2, Math.min(80, player.p[1]));
    } else if (!dead) {
      if (tg < 0) { player.v = [0, 0, 0]; acc = 0; } else acc += dt;
      while (acc >= DT) { acc -= DT; const x0 = player.p[0], z0 = player.p[2]; player.step(DT); player.stepHook(); if (player.sprinting) exhaust += Math.hypot(player.p[0] - x0, player.p[2] - z0) * 0.1; }
      if (!open && !player.para) actions(dt); else { crack.visible = false; sel.visible = false; }
      tickFood(dt);
      const zc = zoneC(); out = Math.hypot(player.p[0] - zc[0], player.p[2] - zc[1]) > borderR();
      if (out && !player.para) { borderDmgT += dt; if (borderDmgT > 1) { borderDmgT = 0; hurt(zoneDmg(), null, null, 'border'); } }
    } else if (performance.now() > respawnAt) becomeSpectator();
    else $('smallMsg').textContent = `順位 ${Object.keys(room.alive || {}).length + 1}位　まもなく観戦に切り替わります`;
    tickFurnaces(dt); gui.tick();
    items.update(dt, spectator || dead ? null : player.p, onTouchItem);
    posT += dt;
    if (posT > 1 / 15 && !spectator && !solo) {
      posT = 0; const h = inv.held();
      toAll({ t: 'pos', p: player.p.map(v => Math.round(v * 100) / 100), yaw: +player.yaw.toFixed(3), pitch: +player.pitch.toFixed(3), held: h?.id || null, hp: Math.round(hp * 2) / 2, dead, sw: swingSent, sn: player.input.sneak, pa: !!player.para });
      swingSent = false;
    }
    for (const [id, o] of others) {
      const k = Math.min(1, dt * 14), prev = o.p.slice();
      for (let a = 0; a < 3; a++) o.p[a] += (o.tp[a] - o.p[a]) * k;
      o.model.position.set(o.p[0], o.p[1] - (o.sneak ? 0.12 : 0), o.p[2]); o.model.rotation.y = o.yaw; o.model.userData.head.rotation.x = o.pitch;
      if (o.dead && !o.wasDead) o.deathT = 0; o.wasDead = o.dead;
      if (o.dead) { o.deathT = (o.deathT || 0) + dt; o.model.rotation.z = Math.min(1, o.deathT / 0.5) * Math.PI / 2; o.model.visible = o.deathT < 1; o.hurtT = Math.max(o.hurtT, 0.1); }
      else { o.model.rotation.z = 0; o.model.visible = true; }
      if (o.swing > 0) { o.swing += dt / 0.3; if (o.swing >= 1) o.swing = 0; }
      o.hurtT = Math.max(0, (o.hurtT || 0) - dt); tintModel(o.model, o.hurtT > 0);
      o.marker.visible = o.chute.visible;
      if (o.chute.visible) { const dy = o.yaw - (o.lastYaw ?? o.yaw); o.lastYaw = o.yaw; swayParachute(o.chute, dt, Math.max(-1, Math.min(1, dy * 20))); o.trail.add(o.p[0], o.p[1] + 3, o.p[2], dt); o.model.userData.armL.rotation.x = o.model.userData.armR.rotation.x = -2.6; }
      else if (o.trail.pts.length) o.trail.clear();
      animateCharacter(o.model, o.chute.visible ? 0 : Math.hypot(o.p[0] - prev[0], o.p[2] - prev[2]) / Math.max(dt, 1e-3), dt, o.swing > 0 ? Math.sin(Math.sqrt(o.swing) * Math.PI) : 0);
      if (o.chute.visible) { o.model.userData.armL.rotation.x = o.model.userData.armR.rotation.x = -2.6; }
    }
    updateArrows(dt);
    // カメラ（被弾で傾く・走ると視野が広がる）
    const e = player.eye(), drop = player.input.sneak && !spectator ? 0.12 : 0;
    hurtRoll = Math.max(0, hurtRoll - dt * 3);
    cam.position.set(e[0], e[1] - drop, e[2]);
    cam.rotation.set(player.pitch, player.yaw, Math.sin(hurtRoll * Math.PI) * 0.12 * hurtDir, 'YXZ');
    // 降下中は後ろから（3人称）、着地したら目線（1人称）へ
    const want3 = player.para && !spectator && !dead ? 1 : 0;
    camBlend += (want3 - camBlend) * Math.min(1, dt * (want3 ? 6 : 3.5)); if (Math.abs(camBlend - want3) < 0.01) camBlend = want3;
    if (myModel) {
      myModel.visible = camBlend > 0.05 && !spectator && !dead;
      myModel.position.set(player.p[0], player.p[1], player.p[2]); myModel.rotation.y = player.yaw;
      animateCharacter(myModel, player.para ? 0 : Math.hypot(player.v[0], player.v[2]), dt, 0);
      if (player.para) { myModel.userData.armL.rotation.x = -2.6; myModel.userData.armR.rotation.x = -2.6; }
    }
    if (camBlend > 0) {
      const d = player.dir(), back = 11, up = 3.2;
      const tp = [player.p[0] - d[0] * back, player.p[1] + 1.4 - d[1] * back + up, player.p[2] - d[2] * back];
      const u = camBlend * camBlend * (3 - 2 * camBlend);
      cam.position.set(e[0] + (tp[0] - e[0]) * u, e[1] + (tp[1] - e[1]) * u, e[2] + (tp[2] - e[2]) * u);
    }
    const wantFov = 75 * (player.sprinting ? 1.12 : 1) * (bowCharge >= 0 ? 1 - bowCharge * 0.15 : 1);
    fov += (wantFov - fov) * Math.min(1, dt * 8); if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    fpRoot.visible = !spectator && !dead && camBlend < 0.05; animFP(dt);
    // 操作説明は着地してから15秒だけ出す
    if (!hintShown && !player.para && !spectator && !mobile && tg > 0) { hintShown = true; $('hint').hidden = false; setTimeout(() => $('hint').hidden = true, 15000); }
    if (myChute.visible) {
      if (!player.para) { myChute.visible = false; myTrail.clear(); }
      myChute.position.set(player.p[0], player.p[1] + 6.0, player.p[2]); myChute.rotation.y = player.yaw;
      swayParachute(myChute, dt, (player.input.s || 0)); 
    }
    // 空の上にいる間は遠くまで見えるように
    // 降下中だけ霧を薄くして遠くの相手を見やすく（着地したら通常に戻す）
    const anyDive = (player.para && !spectator) || [...others.values()].some(o => o.chute.visible && spectator);
    diveFog += ((anyDive ? 1 : 0) - diveFog) * Math.min(1, dt * 1.5);
    R.scene.fog.near = 40 + diveFog * 60; R.scene.fog.far = 150 + diveFog * 170;
    const ch = attackCharge(); $('atkbar').hidden = ch >= 1 || spectator || dead; $('atkfill').style.width = `${ch * 100}%`;
    nameT -= dt; $('itemname').style.opacity = Math.max(0, Math.min(1, nameT));
    const left = tg < 0 ? -tg : DUR - tg;
    $('clock').textContent = tg < 0 ? `${Math.ceil(-tg)}` : fmt(left);
    const ph = $('phase');
    if (tg < 0) { ph.textContent = 'まもなく開始'; ph.className = 'phase'; }
    else if (tg < SAFE) { ph.textContent = `準備時間：攻撃できません（あと${fmt(SAFE - tg)}）`; ph.className = 'phase safe'; }
    else if (tg < SHRINK) { ph.textContent = `戦闘中・安全地帯の縮小まで${fmt(SHRINK - tg)}`; ph.className = 'phase fight'; }
    else if (out && !spectator) { const zc = zoneC(); ph.textContent = `安全地帯の外！ 中心まで${Math.round(Math.hypot(player.p[0] - zc[0], player.p[2] - zc[1]))}m`; ph.className = 'phase danger'; }
    else { ph.textContent = '安全地帯が縮小中'; ph.className = 'phase border'; }
    if (player.para && !spectator) { ph.textContent = tg < 0 ? 'まもなく降下' : 'パラシュート降下中（マウスで向き・WASDで移動）'; ph.className = 'phase'; }
    if (tg >= 0 && !announced.start) { announced.start = true; S.gong(); }
    if (tg >= SAFE && !announced.fight) { announced.fight = true; S.gong(); feed('<b>戦闘開始！</b>'); }
    if (tg >= SHRINK && !announced.shrink) { announced.shrink = true; S.gong(); feed('<b>安全地帯が縮み始めた！</b> 赤い壁の外にいると体力が減ります'); }
    R.border.position.x = zoneC()[0]; R.border.position.z = zoneC()[1]; R.setBorder(tg >= SHRINK ? borderR() : 999); R.setDay(Math.max(0, Math.min(1, tg / DUR)));
    if (isHost && tg >= DUR && room.phase === 'game') endMatch();
    R.updateDirty(world);
  } else if (world) {
    const a = t / 20000; cam.position.set(WS / 2 + Math.cos(a) * 60, 40, WS / 2 + Math.sin(a) * 60); cam.lookAt(WS / 2, 20, WS / 2); fpRoot.visible = false;
  }
  debris.update(dt);
  if (world) R.frame(t / 1000);
}
function tintModel(model, on) {
  if (model.userData.tinted === on) return; model.userData.tinted = on;
  const held = model.userData.held;
  model.traverse(m => {
    if (!m.isMesh) return;
    for (let p = m; p; p = p.parent) if (p === held) return; // 手に持った物（共有の材質）は染めない
    for (const x of Array.isArray(m.material) ? m.material : [m.material]) x.emissive?.set(on ? 0xb00000 : 0x000000);
  });
}
requestAnimationFrame(frame);
// 部屋主のタブが裏に回っても試合は終わるように
setInterval(() => { if (isHost && room?.phase === 'game' && gameT() >= DUR) endMatch(); }, 1000);

// ---------- 結果 ----------
function showResult() {
  state = 'result'; show('result'); document.exitPointerLock?.(); $('hud').hidden = true; gui.close();
  // 順位：ドン勝 → 時間切れで生き残った人 → 脱落が遅かった順
  const alive = Object.keys(room.alive || {}).filter(id => id !== room.winner).sort((a, b) => (room.players[b]?.kills || 0) - (room.players[a]?.kills || 0));
  const order = [...(room.winner ? [room.winner] : []), ...alive, ...[...(room.elim || [])].reverse()].filter((id, i, arr) => arr.indexOf(id) === i && room.players[id]);
  const W = room.players[room.winner];
  $('winTitle').textContent = !W ? '試合終了' : room.winner === myId ? 'ドン勝！' : `${W.name} がドン勝！`;
  $('winTitle').className = room.winner === myId ? 'win me' : 'win';
  $('rank').innerHTML = '';
  order.forEach((id, i) => {
    const p = room.players[id];
    const d = document.createElement('div'); d.append(`${i + 1}位`); d.append(faceCanvas(p.char, 30));
    const n = document.createElement('span'); n.innerHTML = `<b style="color:${p.color};font-family:inherit">${esc(p.name)}</b>${id === myId ? '（あなた）' : ''}`; d.append(n);
    const k = document.createElement('b'); k.textContent = `${p.kills}キル`; d.append(k); $('rank').appendChild(d);
  });
  if (room.winner === myId) S.win?.();
  const waiting = room.queue.filter(id => room.players[id] && !(id in room.roster)).length;
  $('resNote').textContent = solo ? 'ひとりで練習した結果です。部屋を作ると友達と対戦できます。' : waiting ? `次の試合は、待っていた ${waiting}人が先に入ります。` : '';
  $('bAgain').hidden = !isHost || room.kind === 'pub'; $('resWait').textContent = room.kind === 'pub' ? 'まもなく待合室に戻ります' : isHost ? '' : '部屋を作った人が次の試合を始めるのを待っています';
}

world = new World(12345); R.buildAll(world);
Object.defineProperties(window.__game, Object.getOwnPropertyDescriptors({ get state() { return state; }, get room() { return room; }, get player() { return player; }, get world() { return world; }, get hp() { return hp; }, get food() { return food; }, inv, gui, items, get others() { return others; }, get myId() { return myId; }, get net() { return net; }, keys, T, startMatch, gameT, toHost, R, furnaces, openGui, closeGui, setMouse(l, r) { mouseL = l; mouseR = r; if (l) atkPress = true; if (r) usePress = true; } }));
