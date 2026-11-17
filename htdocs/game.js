'use strict';
/* マネーウォーズ風オートチェス (TFT風の盤面戦闘) */
const COLS = 7, ROWS = 6, PY = 4;                 // 盤面 7x6。y=0,1 敵陣 / 2,3 中央 / 4(前列),5(後列) 自陣
const BOARD = COLS * 2, BENCH = 8, ROUNDS = 12, SHOP = 5, REROLL = 2, EXP_COST = 4, EXP_GAIN = 4, MAXLV = 8, STAR = 1.8;
const TICK = 100, LIMIT = 45000, MOVE_CD = 420;
const LV_EXP = [0, 0, 4, 10, 20, 36, 56, 80, 110];
const ODDS = [null, [100], [80, 20], [60, 35, 5], [45, 40, 15], [30, 40, 25, 5], [20, 35, 35, 10], [10, 25, 35, 25, 5], [5, 15, 30, 35, 15]];
const BOND_TH = [2, 4];
const BONDS = {
  獣: ['攻撃+15%', '攻撃+40%'], 霊: ['EP獲得×1.3', 'EP獲得×1.8'], 機巧: ['HP+20%', 'HP+50%'],
  竜: ['必殺技+30%', '必殺技+80%'], 財宝: ['毎ラウンド+1G', '毎ラウンド+3G'],
};
const BOND_IC = { 獣: 'b_beast', 霊: 'b_spirit', 機巧: 'b_gear', 竜: 'b_dragon', 財宝: 'b_treasure' };
const BOND_ATK = [0, .15, .4], BOND_HP = [0, .2, .5], BOND_EP = [1, 1.3, 1.8], BOND_ULT = [0, .3, .8], BOND_GOLD = [0, 1, 3];
const RANGE = { 前衛: 1, 後衛: 3 };
const ULT_TXT = { burst: '狙った敵に攻撃×3.5', aoe: '狙った敵と周囲に攻撃×1.8', heal: '周囲の味方を回復' };
const BASIC = { atk: { n: '剣', ic: 'it_atk', atk: .15 }, hp: { n: '鎧', ic: 'it_hp', hp: .2 }, spd: { n: '靴', ic: 'it_spd', spd: 10 } };
const ADV = {
  'atk+atk': { n: '魔剣', ic: 'it_maken', atk: .4 }, 'hp+hp': { n: '城壁', ic: 'it_jouheki', hp: .5 }, 'spd+spd': { n: '疾風', ic: 'it_shippu', spd: 30 },
  'atk+hp': { n: '聖剣', ic: 'it_seiken', atk: .2, hp: .25 }, 'atk+spd': { n: '迅雷', ic: 'it_jinrai', atk: .2, ep: 50 }, 'hp+spd': { n: '星核', ic: 'it_seikaku', hp: .2, ep: 999 },
};
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ic = (name) => 'img/ic_' + name + '.png';
let UNITS = [];
const S = {
  gold: 10, life: 20, round: 1, lv: 2, exp: 4, phase: 'prep', speed: 1, history: [],
  board: Array(BOARD).fill(null), bench: Array(BENCH).fill(null), shop: [], items: [], sel: null, enemies: [],
};
const base = (id) => UNITS.find((u) => u.id === id);
const cap = () => Math.min(10, S.lv + 2);
const onBoard = () => S.board.filter(Boolean).length;
const dim = (r = S.round) => Math.ceil(r / 4);
const isBoss = (r = S.round) => r % 4 === 0;
const stageLabel = (r = S.round) => dim(r) + '-' + ((r - 1) % 4 + 1);
const arrOf = (t) => (t === 'b' ? S.board : S.bench);
const posCls = (pos) => (pos === '前衛' ? 'front' : 'back');
const posImg = (pos) => ic(pos === '前衛' ? 'pos_front' : 'pos_back');
const itemDesc = (it) => [it.atk && '攻撃+' + Math.round(it.atk * 100) + '%', it.hp && 'HP+' + Math.round(it.hp * 100) + '%', it.spd && '速度+' + it.spd, it.ep && (it.ep >= 999 ? '初期EP満タン' : '初期EP+' + it.ep)].filter(Boolean).join(' ');
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

let toastTimer = 0;
function log(m) {
  const t = $('toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function banner(text, sub = '', cls = '') {
  const b = $('banner'); b.className = ''; b.innerHTML = text + (sub ? '<small>' + sub + '</small>' : '');
  void b.offsetWidth; b.className = 'show ' + cls;
}

/* ---------- 絆・ステータス ---------- */
function bondLevels() {
  const seen = {}, ids = new Set();
  S.board.forEach((u) => { if (u && !ids.has(u.id)) { ids.add(u.id); const b = base(u.id); [b.bond1, b.bond2].forEach((k) => (seen[k] = (seen[k] || 0) + 1)); } });
  const lv = {};
  for (const k in BONDS) { const n = seen[k] || 0; lv[k] = { n, lv: n >= BOND_TH[1] ? 2 : n >= BOND_TH[0] ? 1 : 0 }; }
  return lv;
}
function statsOf(u, bl = bondLevels()) {
  const b = base(u.id), m = Math.pow(STAR, u.star - 1), eq = { atk: 0, hp: 0, spd: 0, ep: 0 };
  u.items.forEach((it) => { for (const k in eq) eq[k] += it[k] || 0; });
  return {
    hp: Math.round(b.hp * m * (1 + BOND_HP[bl['機巧'].lv] + eq.hp)),
    atk: Math.round(b.atk * m * (1 + BOND_ATK[bl['獣'].lv] + eq.atk)),
    spd: b.spd + eq.spd, ep0: Math.min(b.ep, eq.ep), epMul: BOND_EP[bl['霊'].lv], ultMul: 1 + BOND_ULT[bl['竜'].lv],
  };
}

/* ---------- ショップ・経済 ---------- */
function rollShop() {
  const odds = ODDS[S.lv];
  S.shop = Array.from({ length: SHOP }, () => {
    let r = Math.random() * 100, c = 0;
    for (; c < odds.length - 1; c++) { if (r < odds[c]) break; r -= odds[c]; }
    const pool = UNITS.filter((u) => u.cost === c + 1);
    return { id: pool[Math.random() * pool.length | 0].id, sold: false };
  });
}
const allUnits = () => [...S.board, ...S.bench].filter(Boolean);
const completesMerge = (id) => allUnits().filter((u) => u.id === id && u.star === 1).length >= 2;
const sellValue = (u) => base(u.id).cost * Math.pow(3, u.star - 1);
function buy(i) {
  const s = S.shop[i], b = base(s.id);
  if (S.phase !== 'prep' || s.sold) return;
  if (S.gold < b.cost) return log('ゴールドが足りません');
  const free = S.bench.indexOf(null), unit = { id: s.id, star: 1, items: [] };
  if (free >= 0) S.bench[free] = unit;
  else if (completesMerge(s.id)) S.bench.push(unit);              // ベンチ満杯でも3体目なら合成できる
  else return log('ベンチがいっぱいです');
  S.gold -= b.cost; s.sold = true;
  merge();
  const extra = S.bench.splice(BENCH).filter(Boolean);
  extra.forEach((u) => (S.bench[S.bench.indexOf(null)] = u));
  render();
}
function reroll() { if (S.phase !== 'prep' || S.gold < REROLL) return; S.gold -= REROLL; rollShop(); render(); }
function buyExp() {
  if (S.phase !== 'prep' || S.lv >= MAXLV || S.gold < EXP_COST) return;
  S.gold -= EXP_COST; S.exp += EXP_GAIN;
  levelCheck(); render();
}
function levelCheck() {
  while (S.lv < MAXLV && S.exp >= LV_EXP[S.lv + 1]) { S.lv++; banner('LEVEL UP', 'Lv' + S.lv + '　盤面に' + cap() + '体まで'); }
}
function sell() {
  if (S.phase !== 'prep' || !S.sel || S.sel.t === 'i') return;
  const arr = arrOf(S.sel.t), u = arr[S.sel.i]; if (!u) return;
  const v = sellValue(u);
  S.gold += v; S.items.push(...u.items); arr[S.sel.i] = null; S.sel = null; log(base(u.id).name + ' を売却 +' + v + 'G'); render();
}
function merge() {
  for (let again = true; again;) {
    again = false;
    const g = {};
    [S.board, S.bench].forEach((arr) => arr.forEach((u, i) => u && (g[u.id + ':' + u.star] ||= []).push({ arr, i })));
    for (const k in g) {
      const L = g[k];
      if (L.length >= 3 && L[0].arr[L[0].i].star < 3) {
        const [keep, ...rest] = L.slice(0, 3), ku = keep.arr[keep.i];          // 盤面にいる方を優先して残す
        rest.forEach((r) => { S.items.push(...r.arr[r.i].items); r.arr[r.i] = null; });
        ku.star++; banner('★'.repeat(ku.star), base(ku.id).name + ' がランクアップ！');
        again = true; break;
      }
    }
  }
}

/* ---------- 配置・装備 ---------- */
function clickCell(t, i) {
  if (S.phase !== 'prep') return;
  const arr = arrOf(t);
  if (S.sel && S.sel.t === 'i') {
    const u = arr[i], it = S.items[S.sel.i];
    if (!u) return log('装備するキャラを選んでください');
    if (u.items.length >= 3) return log('装備は3つまでです');
    u.items.push(it); S.items.splice(S.sel.i, 1); S.sel = null; log(base(u.id).name + ' に ' + it.n + ' を装備'); return render();
  }
  if (S.sel && !(S.sel.t === t && S.sel.i === i)) {
    const from = arrOf(S.sel.t), a = from[S.sel.i], b = arr[i];
    if (S.sel.t === 'n' && t === 'b' && !b && onBoard() >= cap()) return log('盤面は' + cap() + '体まで（Lvを上げると増える）');
    from[S.sel.i] = b; arr[i] = a; S.sel = null; return render();
  }
  S.sel = arr[i] && !(S.sel && S.sel.t === t && S.sel.i === i) ? { t, i } : null;
  render();
}
function clickItem(i) {
  if (S.phase !== 'prep') return;
  if (S.sel && S.sel.t === 'i' && S.sel.i !== i) {
    const a = S.items[S.sel.i], b = S.items[i];
    if (!a.basic || !b.basic) return log('合成できるのは基本装備（剣・鎧・靴）2つ');
    const adv = ADV[[a.key, b.key].sort().join('+')];
    S.items = S.items.filter((_, k) => k !== S.sel.i && k !== i);
    S.items.push({ ...adv }); S.sel = null; banner(adv.n, '装備を合成！'); return render();
  }
  S.sel = S.sel && S.sel.t === 'i' && S.sel.i === i ? null : { t: 'i', i };
  render();
}
const giveItem = () => { const key = ['atk', 'hp', 'spd'][Math.random() * 3 | 0]; S.items.push({ basic: true, key, ...BASIC[key] }); };

/* ---------- 敵 ---------- */
function genEnemies() {
  const r = S.round, boss = isBoss();
  const scale = 0.85 + 0.08 * (r - 1) + Math.max(0, r - 8) * 0.05, maxCost = Math.min(5, 1 + Math.floor((r + 1) / 2));
  const pool = UNITS.filter((u) => u.cost <= maxCost);
  const n = boss ? Math.min(5, 1 + Math.floor(r / 3)) : Math.min(8, 1 + Math.floor(r * 0.5));
  const used = new Set(), list = [];
  const spot = (pref) => {
    for (const y of [pref, 1 - pref]) {
      const xs = shuffle([...Array(COLS).keys()]).filter((x) => !used.has(x + ',' + y));
      if (xs.length) { used.add(xs[0] + ',' + y); return [xs[0], y]; }
    }
  };
  if (boss) { const top = [...pool].sort((a, b) => b.hp - a.hp)[0]; used.add('3,1'); list.push({ boss: true, id: top.id, x: 3, y: 1, scale: scale * 2.6, atkScale: scale * 1.2 }); }
  while (list.length < n) {
    const u = pool[Math.random() * pool.length | 0], [x, y] = spot(u.pos === '前衛' ? 1 : 0);
    list.push({ id: u.id, x, y, scale, atkScale: scale });
  }
  S.enemies = list;
}

/* ---------- 戦闘 (TFT風: 移動して近づき、射程に入ったら攻撃) ---------- */
let B = null;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const eu = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const place = (el, x, y) => { el.style.left = (x / COLS * 100) + '%'; el.style.top = (y / ROWS * 100) + '%'; };
const later = (ms, fn) => B.events.push({ t: B.t + ms, fn });

function mkFighter(side, id, star, st, x, y, extra = {}) {
  const b = base(id);
  return {
    side, id, star, name: b.name, pos: b.pos, range: RANGE[b.pos], ult: b.ult, img: sprite(id), items: [],
    hp: st.hp, maxhp: st.hp, atk: st.atk, spd: st.spd, ep: st.ep0 || 0, epMax: b.ep, epMul: st.epMul || 1, ultMul: st.ultMul || 1,
    x, y, atkCD: 250 + Math.random() * 400, moveCD: 0, target: null, ...extra,
  };
}
function mountFighter(f, layer) {
  const d = document.createElement('div');
  d.className = 'unit';
  d.innerHTML = unitHtml({ id: f.id, star: f.star, img: f.img, items: f.items, pos: f.pos, boss: f.boss }, f.side === 'e', true);
  place(d, f.x, f.y); layer.appendChild(d);
  f.el = d; f.uv = d.firstChild; f.spr = d.querySelector('.spr');
  paint(f);
}
function paint(f) {
  f.el.querySelector('.hp i').style.width = Math.max(0, f.hp / f.maxhp * 100) + '%';
  f.el.querySelector('.ep i').style.width = Math.min(100, f.ep / f.epMax * 100) + '%';
}
function pop(f, txt, cls) {
  const d = document.createElement('span');
  d.className = 'pop ' + cls; d.textContent = txt; f.el.appendChild(d);
  setTimeout(() => d.remove(), 800 / S.speed);
}
function fx(x, y, cls) {
  const d = document.createElement('div'); d.className = 'fx ' + cls; place(d, x, y);
  B.layer.appendChild(d); setTimeout(() => d.remove(), 600 / S.speed);
}
function shoot(f, tg, cls) {
  const p = document.createElement('div'); p.className = 'proj ' + cls; place(p, f.x, f.y);
  B.layer.appendChild(p); p.getBoundingClientRect(); place(p, tg.x, tg.y);
  setTimeout(() => p.remove(), 260 / S.speed);
}
function lunge(f, tg) {
  f.uv.style.setProperty('--dx', Math.sign(tg.x - f.x) * 35 + '%');
  f.uv.style.setProperty('--dy', Math.sign(tg.y - f.y) * 35 + '%');
  f.uv.classList.remove('lunge'); void f.uv.offsetWidth; f.uv.classList.add('lunge');
}
function damage(tg, amt, big) {
  if (tg.hp <= 0) return;
  const v = Math.max(1, Math.round(amt * (0.9 + Math.random() * 0.2)));
  tg.hp -= v; tg.ep = Math.min(tg.epMax, tg.ep + Math.round(5 * tg.epMul));
  pop(tg, v, big ? 'crit' : 'dmg');
  tg.spr.classList.remove('hit'); void tg.spr.offsetWidth; tg.spr.classList.add('hit');
  paint(tg);
  if (tg.hp <= 0) tg.el.classList.add('dead');
}
function attack(f, tg) {
  f.ep = Math.min(f.epMax, f.ep + Math.round(10 * f.epMul)); paint(f);
  if (f.range > 1) { shoot(f, tg, f.side); later(250, () => damage(tg, f.atk)); }
  else { lunge(f, tg); later(130, () => damage(tg, f.atk)); }
}
function ultimate(f, tg, foes, friends) {
  f.ep = 0; paint(f); pop(f, '必殺！', 'ult');
  f.uv.classList.remove('cast'); void f.uv.offsetWidth; f.uv.classList.add('cast');
  const k = f.ultMul;
  if (f.ult === 'burst') {
    if (f.range > 1) shoot(f, tg, 'big'); else lunge(f, tg);
    later(260, () => { fx(tg.x, tg.y, 'burst'); damage(tg, f.atk * 3.5 * k, true); });
  } else if (f.ult === 'aoe') {
    later(200, () => { fx(tg.x, tg.y, 'boom'); foes.filter((o) => o.hp > 0 && dist(o, tg) <= 1).forEach((o) => damage(o, f.atk * 1.8 * k, true)); });
  } else {
    fx(f.x, f.y, 'heal');
    friends.filter((o) => o.hp > 0 && dist(o, f) <= 2).forEach((o) => {
      const h = Math.min(o.maxhp - o.hp, Math.round(f.atk * 2.5 * k)); o.hp += h; if (h) pop(o, '+' + h, 'heal'); paint(o);
    });
    later(150, () => damage(tg, f.atk));
  }
}
function stepToward(f, tg, all) {
  const occ = new Set(all.filter((o) => o.hp > 0 && o !== f).map((o) => o.x + ',' + o.y));
  let best = null, bd = dist(f, tg), be = eu(f, tg);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const nx = f.x + dx, ny = f.y + dy;
    if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || occ.has(nx + ',' + ny)) continue;
    const c = { x: nx, y: ny }, d = dist(c, tg), e = eu(c, tg);
    if (d < bd || (d === bd && e < be)) { best = c; bd = d; be = e; }
  }
  if (best) { f.x = best.x; f.y = best.y; place(f.el, f.x, f.y); }
}
function think(f, all) {
  f.atkCD -= TICK; f.moveCD -= TICK;
  const foes = all.filter((o) => o.side !== f.side && o.hp > 0);
  if (!foes.length) return;
  if (!f.target || f.target.hp <= 0 || dist(f, f.target) > f.range) {
    f.target = foes.reduce((a, b) => (dist(f, b) < dist(f, a) || (dist(f, b) === dist(f, a) && eu(f, b) < eu(f, a)) ? b : a));
  }
  const tg = f.target;
  if (dist(f, tg) <= f.range) {
    if (f.atkCD <= 0) {
      f.atkCD = 100000 / f.spd;
      if (f.ep >= f.epMax) ultimate(f, tg, foes, all.filter((o) => o.side === f.side)); else attack(f, tg);
    }
  } else if (f.moveCD <= 0) { stepToward(f, tg, all); f.moveCD = MOVE_CD; }
}
async function startBattle() {
  if (S.phase !== 'prep') return;
  if (!onBoard()) return log('盤面にキャラを配置してください');
  S.phase = 'battle'; S.sel = null; render();
  const bl = bondLevels(), F = [];
  S.board.forEach((u, i) => { if (u) F.push(mkFighter('p', u.id, u.star, statsOf(u, bl), i % COLS, PY + Math.floor(i / COLS), { items: u.items })); });
  S.enemies.forEach((e) => {
    const b = base(e.id);
    F.push(mkFighter('e', e.id, 1, { hp: Math.round(b.hp * e.scale), atk: Math.round(b.atk * e.atkScale), spd: b.spd }, e.x, e.y,
      e.boss ? { boss: true, name: 'ボス', img: bossSprite(dim()), pos: '前衛', range: 1, ult: 'aoe', epMax: 100 } : {}));
  });
  document.querySelectorAll('.cells .cell').forEach((c) => (c.innerHTML = ''));
  const layer = document.querySelector('.layer'); layer.innerHTML = ''; layer.style.setProperty('--k', 1 / S.speed);
  B = { t: 0, events: [], layer };
  F.forEach((f) => mountFighter(f, layer));
  banner('FIGHT!');
  await sleep(900 / S.speed);
  const alive = (s) => F.some((f) => f.side === s && f.hp > 0);
  while (alive('p') && alive('e') && B.t < LIMIT) {
    B.t += TICK;
    const due = B.events.filter((e) => e.t <= B.t); B.events = B.events.filter((e) => e.t > B.t); due.forEach((e) => e.fn());
    shuffle(F.filter((f) => f.hp > 0)).forEach((f) => f.hp > 0 && think(f, F));
    await sleep(TICK / S.speed);
  }
  B.events.forEach((e) => e.fn());
  const win = alive('p') && !alive('e');
  banner(win ? 'VICTORY' : 'DEFEAT', '', win ? 'win' : 'lose');
  await sleep(1300 / S.speed);
  B.layer.innerHTML = ''; B = null;
  endRound(win, F.filter((f) => f.side === 'e' && f.hp > 0).length);
}

/* ---------- ラウンド終了 ---------- */
function endRound(win, left) {
  const treasure = BOND_GOLD[bondLevels()['財宝'].lv], interest = Math.min(5, Math.floor(S.gold / 10));
  const inc = 5 + 1 + interest + treasure;
  S.gold += inc; S.history[S.round - 1] = win;
  if (S.lv < MAXLV) { S.exp += 2; }
  let msg = '+' + inc + 'G（基本5 ' + (win ? '勝利' : '敗北') + '1 利息' + interest + (treasure ? ' 財宝' + treasure : '') + '）';
  if (!win) { const dmg = 2 + left + (isBoss() ? 2 : 0); S.life -= dmg; msg = 'ライフ -' + dmg + ' / ' + msg; }
  if (win) { giveItem(); if (isBoss()) giveItem(); msg += ' / 装備を入手'; }
  if (S.life <= 0) return finish(false);
  if (win && S.round >= ROUNDS) return finish(true);
  S.round++; S.phase = 'prep'; rollShop(); genEnemies();
  render(); log(msg);
  banner('STAGE ' + stageLabel(), isBoss() ? 'ボスが現れた！' : '');
  levelCheck(); render();
}
let finalScore = 0;
function finish(clear) {
  S.phase = 'over'; render();
  finalScore = clear ? ROUNDS + 1 : S.round;
  $('end-title').textContent = clear ? 'ALL CLEAR!' : 'GAME OVER';
  $('end-sub').textContent = clear ? '全ステージを制覇しました！' : 'ステージ ' + stageLabel() + ' で力尽きた…';
  $('end-rank').innerHTML = ''; $('end-save').disabled = false;
  $('m-end').classList.add('open');
}
async function saveScore() {
  $('end-save').disabled = true;
  const name = $('end-name').value.trim() || '名無し';
  try {
    const rows = await (await fetch('api/score.php', { method: 'POST', body: JSON.stringify({ name, round: finalScore }) })).json();
    showRanking(rows); $('end-rank').innerHTML = $('rank-list').innerHTML;
  } catch (e) { $('end-save').disabled = false; log('記録に失敗しました'); }
}

/* ---------- 描画 ---------- */
function unitHtml(u, foe, bars) {
  const b = base(u.id), pos = u.pos || b.pos, star = u.star || 1;
  return '<div class="uv ' + (foe ? 'foe' : posCls(pos)) + (u.boss ? ' boss' : '') + '">' +
    (bars ? '<div class="hp"><i></i></div><div class="ep"><i></i></div>' : '') +
    '<img class="spr s' + star + '" src="' + (u.img || sprite(u.id)) + '" alt="">' +
    (!foe && star > 1 ? '<span class="stars">' + '★'.repeat(star) + '</span>' : '') +
    (!u.boss ? '<img class="posic" src="' + posImg(pos) + '" alt="">' : '') +
    (u.items && u.items.length ? '<span class="eq">' + u.items.map((it) => '<img src="' + ic(it.ic) + '" alt="">').join('') + '</span>' : '') + '</div>';
}
function renderTrack() {
  let h = '';
  for (let r = 1; r <= ROUNDS; r++) {
    if ((r - 1) % 4 === 0) h += '<span class="dimname">次元' + 'ⅠⅡⅢ'[dim(r) - 1] + '</span>';
    const st = r < S.round || (r === S.round && S.phase === 'over') ? (S.history[r - 1] ? ' done' : ' lost') : r === S.round ? ' now' : '';
    h += isBoss(r) ? '<span class="pip boss' + st + '" title="ボス"><img src="' + ic('skull') + '" alt=""></span>' : '<span class="pip' + st + '" title="ステージ' + stageLabel(r) + '"></span>';
  }
  $('track').innerHTML = h;
}
function renderInspect(bl) {
  const sel = S.sel && S.sel.t !== 'i' ? arrOf(S.sel.t)[S.sel.i] : null;
  if (!sel) { $('inspect').innerHTML = '<div class="empty">キャラを選択</div>'; return null; }
  const b = base(sel.id), st = statsOf(sel, bl);
  $('inspect').innerHTML =
    '<div class="pt"><img class="big" src="' + sprite(sel.id) + '" alt=""><div><h3>' + b.name + '</h3><span class="st">' + '★'.repeat(sel.star) + '</span>' +
    '<div class="row"><span class="chip"><img src="' + ic('coin') + '" alt="">' + b.cost + '</span><span class="chip ' + posCls(b.pos) + '"><img src="' + posImg(b.pos) + '" alt="">' + b.pos + ' 射程' + RANGE[b.pos] + '</span></div></div></div>' +
    '<div class="row">' + [b.bond1, b.bond2].map((k) => '<span class="chip"><img src="' + ic(BOND_IC[k]) + '" alt="">' + k + '</span>').join('') + '</div>' +
    '<table><tr><td>HP</td><td>' + st.hp + '</td><td>攻撃</td><td>' + st.atk + '</td></tr><tr><td>速度</td><td>' + st.spd + '</td><td>EP</td><td>' + b.ep + '</td></tr></table>' +
    '<div class="ult">必殺: ' + ULT_TXT[b.ult] + '</div>' +
    (sel.items.length ? '<div class="row">' + sel.items.map((it) => '<span class="chip"><img src="' + ic(it.ic) + '" alt="">' + it.n + '</span>').join('') + '</div>' : '');
  return sel;
}
function render() {
  const bl = bondLevels(), prep = S.phase === 'prep', d = dim();
  renderTrack();
  $('life').textContent = Math.max(0, S.life);
  // 盤面
  const cells = document.querySelector('.cells'); cells.innerHTML = '';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = document.createElement('div');
    c.className = 'cell ' + (y < 2 ? 'enemy' : y < PY ? 'mid r' + y : 'me');
    if (y >= PY) {
      const i = (y - PY) * COLS + x, u = S.board[i];
      if (y === PY) c.classList.add('row-front');
      if (x === 0) { c.classList.add('rowlbl'); c.dataset.lbl = y === PY ? '前列' : '後列'; }
      if (S.sel && S.sel.t === 'b' && S.sel.i === i) c.classList.add('sel');
      if (u && prep) c.innerHTML = unitHtml(u);
      c.onclick = () => clickCell('b', i);
    } else if (prep) {
      const e = S.enemies.find((e) => e.x === x && e.y === y);
      if (e) c.innerHTML = unitHtml(e.boss ? { id: e.id, img: bossSprite(d), boss: true } : { id: e.id }, true);
    }
    cells.appendChild(c);
  }
  // ベンチ
  const bench = $('bench'); bench.innerHTML = '';
  S.bench.forEach((u, i) => {
    const c = document.createElement('div');
    c.className = 'slot' + (S.sel && S.sel.t === 'n' && S.sel.i === i ? ' sel' : '');
    if (u) c.innerHTML = unitHtml(u);
    c.onclick = () => clickCell('n', i);
    bench.appendChild(c);
  });
  // 絆
  $('traits').innerHTML = Object.keys(BONDS).map((k) => {
    const b = bl[k];
    return '<div class="trait t' + b.lv + '"><span class="tic"><img src="' + ic(BOND_IC[k]) + '" alt=""></span><div><div class="tn">' + k + '</div>' +
      '<div class="tc"><b>' + b.n + '</b> ' + BOND_TH.map((t, j) => '<span class="' + (b.lv > j ? 'on' : '') + '">' + t + '</span>').join(' › ') + '</div></div>' +
      '<div class="tip"><b>' + k + '</b><br>' + BOND_TH.map((t, j) => t + '体: ' + BONDS[k][j]).join('<br>') + '</div></div>';
  }).join('') + '<div class="trait t' + (onBoard() >= cap() ? 2 : 1) + '"><span class="tic"><img src="' + ic('pos_front') + '" alt=""></span><div><div class="tn">盤面</div><div class="tc"><b>' + onBoard() + '</b> / ' + cap() + '</div></div></div>';
  // 詳細・装備
  const sel = renderInspect(bl);
  $('items').innerHTML = '';
  S.items.forEach((it, i) => {
    const c = document.createElement('div');
    c.className = 'item' + (it.basic ? '' : ' adv') + (S.sel && S.sel.t === 'i' && S.sel.i === i ? ' sel' : '');
    c.innerHTML = '<img src="' + ic(it.ic) + '" alt=""><span class="tip">' + it.n + '：' + itemDesc(it) + '</span>';
    c.onclick = () => clickItem(i);
    $('items').appendChild(c);
  });
  for (let i = S.items.length; i < 4; i++) $('items').insertAdjacentHTML('beforeend', '<div class="item" style="cursor:default;opacity:.4"></div>');
  // ショップバー
  const next = S.lv < MAXLV ? LV_EXP[S.lv + 1] : null, prev = LV_EXP[S.lv];
  $('gold').textContent = S.gold;
  $('interest').textContent = '+' + Math.min(5, Math.floor(S.gold / 10));
  $('lv').textContent = S.lv;
  $('expbar').style.width = next ? ((S.exp - prev) / (next - prev) * 100) + '%' : '100%';
  $('exptxt').textContent = next ? S.exp + '/' + next : 'MAX';
  const sh = $('shop'); sh.innerHTML = '';
  S.shop.forEach((s, i) => {
    const b = base(s.id), c = document.createElement('div');
    c.className = 'card c' + b.cost + (s.sold ? ' sold' : '') + (b.cost > S.gold ? ' poor' : '');
    c.innerHTML = '<div class="portrait"><img class="spr" src="' + sprite(b.id) + '" alt="">' +
      '<span class="cpos ' + posCls(b.pos) + '"><img src="' + posImg(b.pos) + '" alt=""><span>' + b.pos + '</span></span>' +
      '<span class="ctr">' + [b.bond1, b.bond2].map((k) => '<img src="' + ic(BOND_IC[k]) + '" title="' + k + '" alt="">').join('') + '</span></div>' +
      '<div class="nameplate"><span>' + b.name + '</span><span class="cost"><img src="' + ic('coin') + '" alt="">' + b.cost + '</span></div>';
    c.title = b.name + '（' + b.pos + '）絆: ' + b.bond1 + '・' + b.bond2;
    c.onclick = () => buy(i);
    sh.appendChild(c);
  });
  $('sellv').innerHTML = sel ? '<img src="' + ic('coin') + '" alt="">+' + sellValue(sel) : '';
  $('btn-reroll').disabled = !prep || S.gold < REROLL;
  $('btn-exp').disabled = !prep || S.lv >= MAXLV || S.gold < EXP_COST;
  $('btn-sell').disabled = !prep || !sel;
  $('btn-start').disabled = !prep;
}
function showRanking(rows) {
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('rank-list').innerHTML = rows.length ? rows.map((r) => '<li>' + esc(r.name) + '　' + (r.round_reached > ROUNDS ? 'ALL CLEAR' : 'ステージ ' + stageLabel(r.round_reached)) + '</li>').join('') : '<li>まだ記録がありません</li>';
}

/* ---------- 初期化 ---------- */
(async function init() {
  $('btn-reroll').onclick = reroll; $('btn-exp').onclick = buyExp; $('btn-sell').onclick = sell; $('btn-start').onclick = startBattle;
  $('btn-speed').onclick = () => {
    S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; $('btn-speed').textContent = '×' + S.speed;
    document.querySelector('.layer').style.setProperty('--k', 1 / S.speed);
  };
  $('btn-help').onclick = () => $('m-help').classList.add('open');
  $('btn-rank').onclick = async () => {
    $('m-rank').classList.add('open');
    try { showRanking(await (await fetch('api/score.php')).json()); } catch (e) { /* 表示済みのまま */ }
  };
  document.querySelectorAll('.mclose').forEach((b) => (b.onclick = () => b.closest('.modal').classList.remove('open')));
  $('end-save').onclick = saveScore; $('end-retry').onclick = () => location.reload();
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'd' || e.key === 'D') reroll();
    if (e.key === 'f' || e.key === 'F') buyExp();
    if (e.key === 'e' || e.key === 'E') sell();
  });
  try {
    UNITS = await (await fetch('api/units.php')).json();
    showRanking(await (await fetch('api/score.php')).json());
  } catch (e) { return log('APIに接続できません。DBの初期化を確認してください。'); }
  rollShop(); genEnemies(); render();
  banner('STAGE ' + stageLabel(), 'ショップでキャラを買おう');
})();
