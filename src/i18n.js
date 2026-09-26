// 画面に出る文字（日本語・英語）。ブラウザの言語で自動で選び、タイトルで切り替えられる
const S = {
  // ---- タイトル ----
  logo: ['じゅっぷん<br><span>クラフト</span>', 'JUPPUN<br><span>CRAFT</span>'],
  sub: ['パラシュートで降りて、集めて、作って、戦う。<br>最後の1人がドン勝。リンクを送るだけで最大4人のバトロワ。',
    'Drop in by parachute, gather, craft, fight.<br>Last one standing wins. Send one link and up to 4 play.'],
  'f.name': ['名前', 'Name'],
  'ph.name': ['10文字まで', 'up to 10 letters'],
  'f.char': ['キャラクター', 'Character'],
  'btn.join': ['招待された部屋に入る', 'Join the invited room'],
  'btn.quick': ['だれかと対戦する', 'Play with anyone'],
  'btn.solo': ['ひとりで練習', 'Practice alone'],
  'f.friends': ['友達と遊ぶ', 'Play with friends'],
  'ph.word': ['あいことば（例：たぬき123）', 'password (e.g. tanuki123)'],
  'btn.word': ['あいことばで入る', 'Join with password'],
  'btn.host': ['招待リンクを作る', 'Make an invite link'],
  'note.word': ['同じあいことばを入れた人どうしが同じ部屋に入ります', 'Everyone who types the same password lands in the same room'],
  'rules.t': ['ルール', 'Rules'],
  'rules.body': ['　全員がパラシュートで島の四隅に降下。最初の2分は準備時間（攻撃できません）。木を切って道具を作り、石や鉄を掘って武器を強くしよう。3分から赤い安全地帯がどんどん狭まり、外にいると体力が減ります。島には宝箱が2つだけ隠れています。倒されたら脱落（持ち物はその場に落ちます）。<b>最後の1人がドン勝</b>。10分たっても決着しなければ、生き残りのうち倒した数が多い人の勝ち。',
    ' Everyone drops onto the four corners of the island. The first 2 minutes are prep time (no attacking). Chop trees for tools, then mine stone and iron for better weapons. From 3 minutes the red safe zone closes in, and outside it you lose health. Two chests are hidden on the island. When you are beaten you are out, and your items drop where you fell. <b>The last one standing wins.</b> If nobody wins in 10 minutes, the survivor with the most kills takes it.'],
  'rules.cap': ['<b>定員4人</b>。5人目からは観戦しながら待ち、次の試合から入れます。',
    '<b>Four players per match.</b> From the fifth player on, you watch and join the next match.'],
  'note.net': ['通信はブラウザ同士を直接つなぎます（接続の仲介に PeerJS の公開サーバーを使います）。会社や学校のネットワークではつながらないことがあります。',
    'Players connect browser to browser (PeerJS’s public server is used only to introduce them). Some office and school networks block this.'],
  'btn.lang': ['English', '日本語'],
  // ---- 待合室 ----
  'lobby.wait': ['待合室', 'Waiting room'],
  'lobby.pub': ['だれでも参加の部屋', 'Open room'],
  'lobby.share': ['このリンクを送ると、同じ部屋に入れます', 'Send this link to invite friends'],
  'btn.copy': ['コピー', 'Copy'],
  'btn.copied': ['コピーしました', 'Copied'],
  'btn.share': ['共有', 'Share'],
  'f.players': ['参加者', 'Players'],
  'btn.start': ['試合を始める', 'Start the match'],
  'lobby.waitHost': ['部屋を作った人が始めるのを待っています…', 'Waiting for the host to start…'],
  'btn.title': ['タイトルへ', 'Back to title'],
  'lobby.count': ['{0}人・次の試合は先頭の{1}人', '{0} here · the first {1} play the next match'],
  'lobby.you': ['（あなた）', ' (you)'],
  'lobby.host': ['・部屋主', ' · host'],
  'lobby.play': ['次の試合に参加', 'in next match'],
  'lobby.waitN': ['待ち {0}番目', 'waiting #{0}'],
  'lobby.startIn': ['あと {0} 秒で試合が始まります（{1}/{2}人）', 'The match starts in {0}s ({1}/{2})'],
  'lobby.waiting': ['対戦相手を待っています（{0}/{1}人）。2人そろうと自動で始まります', 'Waiting for players ({0}/{1}). It starts on its own once two are in'],
  'lobby.hostNote': ['人がそろったら「試合を始める」を押してください。1人でも始められます。', 'Press “Start the match” when everyone is in. You can start alone, too.'],
  'lobby.word': ['あいことば「<b>{0}</b>」の部屋です。同じあいことばを入れた人が入れます', 'This room’s password is “<b>{0}</b>”. Anyone who types it joins here'],
  'lobby.invited': ['部屋「{0}」に招待されています', 'You are invited to room “{0}”'],
  // ---- つなぐ ----
  'busy.host': ['部屋を作っています…', 'Creating a room…'],
  'busy.join': ['つないでいます…', 'Connecting…'],
  'busy.word': ['さがしています…', 'Searching…'],
  'busy.quick': ['対戦相手をさがしています…', 'Looking for players…'],
  'err.host': ['部屋を作れませんでした。時間をおいて試してください。', 'Could not create a room. Please try again in a little while.'],
  'err.join': ['部屋に入れませんでした。部屋が閉じているか、ネットワークでつながらない可能性があります。', 'Could not join. The room may be closed, or your network may block the connection.'],
  'err.word': ['部屋に入れませんでした。もう一度試すか、別のあいことばにしてください。', 'Could not join. Try again, or pick another password.'],
  'err.none': ['いまは入れる部屋がありません。少し待ってから試してください。', 'No room is open right now. Please try again in a bit.'],
  'err.net': ['つなげませんでした。ネットワークを確かめてください。', 'Could not connect. Please check your network.'],
  'err.lost': ['部屋との接続が切れました', 'Lost the connection to the room'],
  'player.default': ['プレイヤー', 'Player'],
  'share.text': ['10分サバイバル対戦しよう', 'Let’s play a 10-minute survival match'],
  // ---- 試合中のお知らせ ----
  'feed.left': ['{0} が抜けました', '{0} left'],
  'feed.joined': ['{0} が入りました', '{0} joined'],
  'feed.spectate': ['試合中です。観戦しながら次の試合を待ちます', 'A match is under way. Watch, and you join the next one'],
  'feed.chestBusy': ['だれかが開けています', 'Someone else has it open'],
  'feed.shieldBroke': ['盾が壊れた', 'Your shield broke'],
  'feed.broke': ['{0}が壊れた', 'Your {0} broke'],
  'feed.noArrow': ['矢がありません', 'No arrows'],
  'feed.full': ['おなかがいっぱいです', 'You are already full'],
  'feed.hungry': ['おなかが減って走れません。りんごを食べよう', 'Too hungry to run. Eat an apple'],
  'feed.safeAtk': ['準備時間中は攻撃できません', 'No attacking during prep time'],
  'feed.bowTip': ['<b>弓</b>：右クリックを押している間ひきしぼり、離すと矢が飛びます（矢が必要・長く引くほど強い）',
    '<b>Bow</b>: hold right click to draw, release to shoot (arrows required — the longer you draw, the stronger)'],
  'feed.shieldTip': ['<b>盾</b>：右クリックを押している間かまえます。正面から来る攻撃を防げます',
    '<b>Shield</b>: hold right click to raise it. It blocks attacks that come from the front'],
  'feed.chestTip': ['島のどこかに<b>宝箱が2つ</b>あります（見つけにくい所にあります）', '<b>Two chests</b> are hidden somewhere on this island'],
  'feed.fight': ['<b>戦闘開始！</b>', '<b>Fight!</b>'],
  'feed.shrink': ['<b>安全地帯が縮み始めた！</b> 赤い壁の外にいると体力が減ります', '<b>The safe zone is closing!</b> Outside the red wall you lose health'],
  'feed.killed': ['{0} が {1} を倒した（{2}）', '{0} beat {1} ({2})'],
  'die.fall': ['{0} が落ちて力尽きた', '{0} fell to their death'],
  'die.border': ['{0} が安全地帯の外で力尽きた', '{0} died outside the safe zone'],
  'die.hunger': ['{0} が飢えて力尽きた', '{0} starved'],
  'die.other': ['{0} が力尽きた', '{0} is down'],
  'feed.remain': ['<b>残り {0}人</b>', '<b>{0} left</b>'],
  'weapon.hand': ['素手', 'bare hands'],
  'weapon.bow': ['弓', 'Bow'],
  // ---- HUD ----
  'hud.spectQ': ['観戦中：いまの試合が終わったら参加できます（待ち {0}番目）', 'Spectating: you join when this match ends (waiting #{0})'],
  'hud.spectOut': ['脱落しました。観戦中（自由に飛べます）', 'You are out. Spectating — fly around freely'],
  'hud.elim': ['脱落', 'OUT'],
  'hud.rankSoon': ['順位 {0}位　まもなく観戦に切り替わります', 'Rank #{0} · switching to spectator'],
  'hud.alive': ['残り', 'Alive'],
  'hud.aliveN': ['{0}人', '{0}'],
  'phase.soon': ['まもなく開始', 'Starting soon'],
  'phase.prep': ['準備時間：攻撃できません（あと{0}）', 'Prep time: no attacking ({0} left)'],
  'phase.fight': ['戦闘中・安全地帯の縮小まで{0}', 'Fight! The zone closes in {0}'],
  'phase.outside': ['安全地帯の外！ 中心まで{0}m', 'Outside the zone! {0}m to the center'],
  'phase.closing': ['安全地帯が縮小中', 'The zone is closing'],
  'phase.dropSoon': ['まもなく降下', 'Dropping soon'],
  'phase.diving': ['パラシュート降下中（マウスで向き・WASDで移動）', 'Parachuting — mouse to aim, WASD to move'],
  // ---- 結果 ----
  'res.over': ['試合終了', 'Match over'],
  'res.win': ['ドン勝！', 'LAST ONE STANDING!'],
  'res.winner': ['{0} がドン勝！', '{0} is the last one standing!'],
  'res.rank': ['{0}位', '#{0}'],
  'res.kills': ['{0}キル', '{0} kills'],
  'res.solo': ['ひとりで練習した結果です。部屋を作ると友達と対戦できます。', 'That was a solo practice run. Create a room to play with friends.'],
  'res.next': ['次の試合は、待っていた {0}人が先に入ります。', 'The {0} who were waiting join the next match first.'],
  'res.back': ['まもなく待合室に戻ります', 'Back to the waiting room shortly'],
  'res.waitHost': ['部屋を作った人が次の試合を始めるのを待っています', 'Waiting for the host to start the next match'],
  'btn.again': ['もう一度（同じ部屋で）', 'Play again (same room)'],
  // ---- 持ち物画面 ----
  'gui.inv': ['クラフト', 'Crafting'],
  'gui.table': ['作業台', 'Crafting Table'],
  'gui.furnace': ['かまど', 'Furnace'],
  'gui.chest': ['宝箱', 'Chest'],
  'gui.bag': ['持ち物', 'Inventory'],
  'gui.armor': ['防御 {0}', 'Armor {0}'],
  // ---- 操作説明・スマホのボタン ----
  'hint.1': ['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移動　<kbd>Space</kbd> ジャンプ　<kbd>E</kbd> 持ち物（2×2クラフト）　作業台・かまどは右クリックで開く　<kbd>1</kbd>〜<kbd>9</kbd> 持ち替え',
    '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move　<kbd>Space</kbd> jump　<kbd>E</kbd> inventory (2×2 crafting)　right click a table or furnace to open it　<kbd>1</kbd>–<kbd>9</kbd> switch item'],
  'hint.2': ['左クリック 掘る・攻撃　右クリック 置く・使う・食べる　<kbd>Q</kbd> 捨てる　<kbd>Shift</kbd> しゃがむ　<kbd>Ctrl</kbd>を押している間 走る',
    'Left click mine / attack　Right click place, use, eat　<kbd>Q</kbd> drop　<kbd>Shift</kbd> sneak　hold <kbd>Ctrl</kbd> to run'],
  'hint.3': ['弓：矢を持った状態で右クリックを押してひきしぼり、離すと飛ぶ　盾：右クリックでかまえる　宝箱：島に2つ（右クリックで開く）',
    'Bow: with arrows in your bag, hold right click to draw and release to shoot　Shield: hold right click to raise　Chests: two on the island, right click to open'],
  'tb.atk': ['攻撃', 'Hit'],
  'tb.jump': ['跳ぶ', 'Jump'],
  'tb.sneak': ['しゃがむ', 'Sneak'],
  'tb.inv': ['持物', 'Bag'],
  'tb.drop': ['捨てる', 'Drop'],
  'tb.close': ['閉じる', 'Close'],
  'use.use': ['使う', 'Use'],
  'use.place': ['置く', 'Place'],
  'use.eat': ['食べる', 'Eat'],
  'use.draw': ['引く', 'Draw'],
  'use.raise': ['かまえる', 'Raise'],
};

// ---- アイテムとキャラクターの英語名 ----
const MAT_EN = { w: 'Wooden', s: 'Stone', i: 'Iron', d: 'Diamond' };
const TOOL_EN = { sword: 'Sword', pick: 'Pickaxe', axe: 'Axe', shovel: 'Shovel' };
const ARMOR_EN = { helmet: 'Helmet', chest: 'Chestplate', legs: 'Leggings', boots: 'Boots' };
const ITEM_EN = {
  dirt: 'Dirt', cobble: 'Cobblestone', stone: 'Stone', sand: 'Sand', gravel: 'Gravel', log: 'Log', planks: 'Planks',
  table: 'Crafting Table', furnace: 'Furnace', iron_ore: 'Iron Ore', glass: 'Glass', stick: 'Stick', coal: 'Coal',
  iron: 'Iron Ingot', diamond: 'Diamond', flint: 'Flint', string: 'String', apple: 'Apple', arrow: 'Arrow', bow: 'Bow', shield: 'Shield',
};
const CHAR_EN = { tanuki: 'Tanuki', kitsune: 'Fox', ninja: 'Ninja', robo: 'Robo', kappa: 'Kappa', penguin: 'Penguin' };

function pick() {
  try { const s = localStorage.getItem('jc:lang'); if (s === 'ja' || s === 'en') return s; } catch (e) { }
  return String(navigator.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
export let lang = pick();
export function setLang(l) { lang = l; try { localStorage.setItem('jc:lang', l); } catch (e) { } }
// t('lobby.count', 3, 4) → '3人・次の試合は先頭の4人'
export function t(key, ...a) {
  const s = S[key]; if (!s) return key;
  return s[lang === 'ja' ? 0 : 1].replace(/\{(\d)\}/g, (_, i) => a[i] ?? '');
}
// アイテム名とキャラクター名を英語にする（日本語のときは何もしない）
export function applyNames(ITEMS, CHARS) {
  if (lang === 'ja') return;
  for (const it of Object.values(ITEMS)) {
    const m = /^(sword|pick|axe|shovel)_(w|s|i|d)$/.exec(it.id) || /^(helmet|chest|legs|boots)_(i|d)$/.exec(it.id);
    if (m) it.name = `${MAT_EN[m[2]]} ${(TOOL_EN[m[1]] || ARMOR_EN[m[1]])}`;
    else if (ITEM_EN[it.id]) it.name = ITEM_EN[it.id];
  }
  for (const c of CHARS) if (CHAR_EN[c.id]) c.name = CHAR_EN[c.id];
}
// HTML の data-t（中身）と data-tp（入力欄のヒント）を差し替える
export function applyStatic(doc) {
  doc.documentElement.lang = lang;
  for (const el of doc.querySelectorAll('[data-t]')) el.innerHTML = t(el.dataset.t);
  for (const el of doc.querySelectorAll('[data-tp]')) el.placeholder = t(el.dataset.tp);
}
