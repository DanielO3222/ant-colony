'use strict';
// ================= Ant Haven — Surface (top-down yard) simulation =================
const YW = 2000, YH = 2000, YFC = 50, YFN = YW / YFC;      // world size, fog cell, fog grid
const YSPD = 1.3;                                          // yard walking speed multiplier
const OUT_POP = 6, OUT_FOOD = 2, OUT_FOOD_T = 10;          // outpost: +6 ant space, +2 food / 10s
const YHAZ = {   // hazard tuning (selected by the Surface hazards setting)
  easy: { foot: [80, 115], footGrow: 2.2, footR: 48, react: .8, notice: .7, glass: [140, 190], glassLife: 15, glassSpd: 28, glassDps: 5, glassR: 24,
    bug: [75, 105], bugMax: 2, bugHp: 1, first: 60 },
  hard: { foot: [42, 62], footGrow: 1.7, footR: 62, react: 1.0, notice: .35, glass: [80, 110], glassLife: 24, glassSpd: 42, glassDps: 9, glassR: 30,
    bug: [45, 65], bugMax: 4, bugHp: 1.45, first: 35 },
};
const YDIF = {   // rival colonies (selected by game difficulty)
  easy: { rivals: 2, cap: 8, hillHp: 160, spawn: 15, start: [3, 3], raidFirst: 510, raidEvery: [220, 280], raidN: [2, 4], rsolHp: 20, rsolDps: 3 },
  hard: { rivals: 3, cap: 12, hillHp: 260, spawn: 10, start: [4, 5], raidFirst: 400, raidEvery: [150, 190], raidN: [3, 6], rsolHp: 24, rsolDps: 3.8 },
};
const RIVALS = [
  { name: 'Red Fire Ants', icon: '🔴', col: '#c23a22', dark: '#6e170c' },
  { name: 'Black Carpenters', icon: '⚫', col: '#3b3742', dark: '#141218' },
  { name: 'Golden Harvesters', icon: '🟡', col: '#d4a52a', dark: '#6e5210' },
];
const BUGS = {
  spider: { name: 'Wolf spider', icon: '🕷️', hp: 110, dps: 7, spd: 46, r: 16, drop: 70, aggro: 120 },
  beetle: { name: 'Stag beetle', icon: '🪲', hp: 190, dps: 5, spd: 22, r: 18, drop: 100, aggro: 90 },
  centipede: { name: 'Centipede', icon: '🐛', hp: 150, dps: 9, spd: 40, r: 14, drop: 90, aggro: 110 },
  ladybug: { name: 'Ladybug', icon: '🐞', hp: 80, dps: 3, spd: 28, r: 13, drop: 50, aggro: 0 },
};
const YFOODS = ['crumb', 'berry', 'cookie', 'apple', 'candy', 'seed'];
const HOME = { x: 1000, y: 1250 };
let yvis = new Uint8Array(YFN * YFN), yvisT = 0, yfogDirty = true;
const yparts = [];
const Y = () => S.yard;
const yd2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function newYard(seed, dk) {
  const R = mulberry(seed + 99), d = YDIF[dk] || YDIF.easy;
  const y = { v: 1, fog: new Array(YFN * YFN).fill(0), food: [], foes: [], hz: [], cols: [], rally: null, out: 0, nid: 1,
    hzLevel: dk === 'hard' ? 'hard' : 'easy', nx: {}, outT: 0, foodT: 0, deco: { dirt: [], peb: [], twig: [], leaf: [], pud: [], clover: [] } };
  const spots = [{ x: 430, y: 470 }, { x: 1580, y: 430 }, { x: 1620, y: 1640 }];
  for (let i = 0; i < d.rivals; i++) { const p = spots[i]; y.cols.push({ i, x: p.x + (R() - .5) * 80, y: p.y + (R() - .5) * 80, hp: d.hillHp, max: d.hillHp, food: 20, own: 'rival', spT: 0, cap: 0 }); }
  const far = (x, yy, m) => yd2({ x, y: yy }, HOME) > m && y.cols.every(c => yd2({ x, y: yy }, c) > m);
  const D = y.deco;
  for (let k = 0; k < 26; k++) D.dirt.push({ x: R() * YW, y: R() * YH, r: 40 + R() * 110, s: R() * 1e4 });
  for (let k = 0; k < 9; k++) { const x = 120 + R() * (YW - 240), yy = 120 + R() * (YH - 240); if (far(x, yy, 170)) D.pud.push({ x, y: yy, r: 34 + R() * 40, s: R() * 1e4 }); }
  for (let k = 0; k < 70; k++) { const x = 30 + R() * (YW - 60), yy = 30 + R() * (YH - 60); if (far(x, yy, 90) && !D.pud.some(p => yd2(p, { x, y: yy }) < p.r + 30)) D.peb.push({ x, y: yy, r: 5 + R() * R() * 22, a: R() * 7, c: R() }); }
  for (let k = 0; k < 40; k++) D.twig.push({ x: R() * YW, y: R() * YH, l: 40 + R() * 80, a: R() * 7, s: R() * 1e4 });
  for (let k = 0; k < 34; k++) { const x = 40 + R() * (YW - 80), yy = 40 + R() * (YH - 80); if (far(x, yy, 90)) D.leaf.push({ x, y: yy, r: 30 + R() * 26, a: R() * 7, c: R() }); }
  for (let k = 0; k < 60; k++) D.clover.push({ x: R() * YW, y: R() * YH, r: 5 + R() * 4, f: R() < .3 });
  for (let k = 0; k < 14; k++) yardAddFood(y, R);
  // start: reveal around home
  yReveal(y, HOME.x, HOME.y, 330);
  y.nx = { foot: 1e12, glass: 1e12, bug: 1e12, raid: d.raidFirst };
  return y;
}
function yardInitRivals() { const y = Y(), d = YDIF[S.diff] || YDIF.easy;
  for (const c of y.cols) { for (let j = 0; j < d.start[0]; j++) addFoe('rant', c.x + (rnd() - .5) * 40, c.y + (rnd() - .5) * 40, c.i); for (let j = 0; j < d.start[1]; j++) addFoe('rsol', c.x + (rnd() - .5) * 50, c.y + (rnd() - .5) * 50, c.i); }
  yardSchedule(true); }
function yardSchedule(first) { const y = Y(), h = YHAZ[y.hzLevel]; if (!h) { y.nx.foot = y.nx.glass = y.nx.bug = 1e12; return; }
  const r = a => a[0] + rnd() * (a[1] - a[0]), f = first ? h.first : 0;
  y.nx.foot = S.t + f + r(h.foot); y.nx.glass = S.t + f * 2 + r(h.glass); y.nx.bug = S.t + f + r(h.bug) * .6; }
function setHazLevel(l) { const y = Y(); y.hzLevel = l; if (l === 'off') { y.hz.length = 0; y.foes = y.foes.filter(f => f.c >= 0 || f.k.startsWith('r')); } yardSchedule(false); }
function yardAddFood(y, R, x, yy, amt, k) {
  R = R || rnd; if (x == null) { for (let t = 0; t < 30; t++) { x = 60 + R() * (YW - 120); yy = 60 + R() * (YH - 120);
      if (yd2({ x, y: yy }, HOME) > 90 && y.cols.every(c => yd2({ x, y: yy }, c) > 80) && !y.deco.pud.some(p => yd2(p, { x, y: yy }) < p.r + 20) && !y.food.some(f => yd2(f, { x, y: yy }) < 60)) break; } }
  k = k || YFOODS[Math.floor(R() * YFOODS.length)]; amt = amt || Math.round(25 + R() * 55 + (k === 'cookie' || k === 'apple' ? 40 : 0));
  const f = { id: y.nid++, k, x, y: yy, amt, max: amt, a: R() * 7 }; y.food.push(f); return f;
}
function addFoe(k, x, y, c) { const Yd = Y(), d = YDIF[S.diff] || YDIF.easy, hz = YHAZ[Yd.hzLevel] || YHAZ.easy; let hp, dps, spd, r;
  if (k === 'rant') { hp = 10; dps = 1; spd = 40; r = 5; } else if (k === 'rsol') { hp = d.rsolHp; dps = d.rsolDps; spd = 40; r = 6; }
  else { const b = BUGS[k]; hp = Math.round(b.hp * hz.bugHp); dps = b.dps * (hz.bugHp > 1 ? 1.25 : 1); spd = b.spd; r = b.r; }
  const f = { id: Yd.nid++, k, c: c == null ? -1 : c, x, y, hp, max: hp, dps, spd, r, ang: rnd() * 7, ph: rnd() * 6, o: null, carry: 0, wait: rnd(), mv: 0, atk: 0 };
  if (k === 'centipede') f.seg = Array.from({ length: 9 }, () => ({ x, y }));
  Yd.foes.push(f); return f; }
// ---------- fog ----------
function yReveal(y, x, yy, r) { const c0 = Math.max(0, Math.floor((x - r) / YFC)), c1 = Math.min(YFN - 1, Math.floor((x + r) / YFC)), r0 = Math.max(0, Math.floor((yy - r) / YFC)), r1 = Math.min(YFN - 1, Math.floor((yy + r) / YFC));
  for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) { const dx = (i + .5) * YFC - x, dy = (j + .5) * YFC - yy; if (dx * dx + dy * dy <= r * r) { const k = j * YFN + i; if (!y.fog[k]) { y.fog[k] = 1; yfogDirty = true; } yvis[k] = 1; } } }
const yCell = (x, y) => clamp(Math.floor(y / YFC), 0, YFN - 1) * YFN + clamp(Math.floor(x / YFC), 0, YFN - 1);
const yExplored = (x, y) => !!Y().fog[yCell(x, y)];
const yVisible = (x, y) => !!yvis[yCell(x, y)];
// ---------- helpers ----------
const yAnts = k => S.units.filter(u => u.yd && (!k || u.k === k));
const myHills = () => [HOME, ...Y().cols.filter(c => c.own === 'me')];
function nearestHill(p) { let b = HOME, bd = 1e9; for (const h of myHills()) { const d = yd2(p, h); if (d < bd) { bd = d; b = h; } } return b; }
function inShade(p) { for (const l of Y().deco.leaf) if (yd2(p, l) < l.r * .85) return true; return false; }
function yObstacles() { const D = Y().deco; return Y()._obs || (Y()._obs = [...D.peb.filter(p => p.r >= 11).map(p => ({ x: p.x, y: p.y, r: p.r + 2 })), ...D.pud.map(p => ({ x: p.x, y: p.y, r: p.r * .9 }))]); }
function yMove(u, tx, ty, dt, mul) {  // straight-line steering with obstacle sliding; returns true on arrival
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy), sp = (u.yd ? UT[u.k].spd * YSPD : u.spd * 1.2) * (mul || 1) * (u.carry ? .88 : 1) * dt;
  if (d <= sp || d < 1) { u.x = tx; u.y = ty; return true; }
  let vx = dx / d, vy = dy / d;
  for (const o of yObstacles()) { const ox = u.x - o.x, oy = u.y - o.y, od = Math.hypot(ox, oy); if (od < o.r + 14 && od > 0.01) { const nx = ox / od, ny = oy / od, dot = vx * nx + vy * ny;
      if (dot < 0) { const sgn = (vx * -ny + vy * nx) >= 0 ? 1 : -1; vx = vx - dot * nx + -ny * sgn * .6 * -dot; vy = vy - dot * ny + nx * sgn * .6 * -dot; const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m; } } }
  u.x = clamp(u.x + vx * sp, 6, YW - 6); u.y = clamp(u.y + vy * sp, 6, YH - 6);
  for (const o of yObstacles()) { const ox = u.x - o.x, oy = u.y - o.y, od = Math.hypot(ox, oy); if (od < o.r && od > .01) { u.x = o.x + ox / od * o.r; u.y = o.y + oy / od * o.r; } }
  u.ang = Math.atan2(vy, vx); u.mv = 1; u.ph += dt * 14; return false;
}
function yHit(a, b, dt) { b.hp -= (a.yd ? UT[a.k].dps : a.dps) * dt; a.atk = .25; a.ang = Math.atan2(b.y - a.y, b.x - a.x); b.lastHit = a.yd ? 'me' : a.id;
  if (rnd() < dt * 4) yparts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (rnd() - .5) * 40, vy: (rnd() - .5) * 40, t: .4, c: '#fff6c8', r: 2 }); }
function nearestFoe(p, r, filt) { let b = null, bd = r; for (const f of Y().foes) { if (f.hp <= 0 || (filt && !filt(f))) continue; const d = yd2(p, f); if (d < bd) { bd = d; b = f; } } return b; }
function nearestMine(p, r) { let b = null, bd = r; for (const u of S.units) { if (!u.yd || u.hid > 0 || u.hp <= 0) continue; const d = yd2(p, u); if (d < bd) { bd = d; b = u; } } return b; }
// ---------- orders ----------
function sendOut(k, n) {   // move ants from the nest out onto the Surface map
  const c = S.units.filter(u => u.k === k && !u.yd && u.tm === 0 && !u.train).sort((a, b) => (a.y < 2 ? 0 : 1) - (b.y < 2 ? 0 : 1)); const got = [];
  for (const u of c.slice(0, n)) { u.yd = 1; u.path = []; u.job = -1; u.st = 'idle'; u.x = HOME.x + (rnd() - .5) * 30; u.y = HOME.y + (rnd() - .5) * 30; u.o = null; u.hid = 0; u.fear = 0;
    const r = Y().rally; if (r) u.o = { k: 'move', x: r.x + (rnd() - .5) * 40, y: r.y + (rnd() - .5) * 40 }; got.push(u); }
  if (got.length) S.flags.yard = true; return got;
}
function yOrder(ids, w) {   // w: {k:'move'|'gather'|'attack'|'hill'|'home', x, y, id}
  let n = 0; const us = ids.map(uById).filter(u => u && u.yd);
  us.forEach((u, i) => { if (w.k === 'gather' && u.k !== 'harvester') { u.o = { k: 'move', x: w.x + (i % 4 - 1.5) * 14, y: w.y + 26 + (i >> 2) * 12 }; n++; return; }
    if ((w.k === 'attack' || w.k === 'hill') && u.k !== 'soldier') { return; }
    if (w.k === 'move') { const a = i * 2.4, rr = 8 + Math.sqrt(i) * 10; u.o = { k: 'move', x: w.x + Math.cos(a) * rr, y: w.y + Math.sin(a) * rr }; }
    else u.o = { ...w }; n++; });
  if (w.k === 'gather') S.flags.sent = true; return n;
}
function recall(ids) { for (const id of ids) { const u = uById(id); if (u && u.yd) u.o = { k: 'home' }; } }
function yEnterNest(u) { u.yd = 0; u.o = null; u.x = ENTX + (rnd() - .5) * 30; u.y = -4; u.path = []; u.st = 'idle'; u.mode = 'guard'; u.hid = 0;
  if (u.carry) { const before = S.res.food; S.res.food = Math.min(foodCap(), S.res.food + u.carry); S.st.gathered += S.res.food - before; incomeAdd(S.res.food - before); u.carry = 0; } }
// ---------- player ants on the surface ----------
function yThreat(u) {   // returns a point to run from, or a shelter to run to
  for (const h of Y().hz) {
    if (h.k === 'foot' && h.t < h.grow && yd2(u, h) < h.r + 10 && h.t > h.react && (((u.id * 2654435761) ^ (h.id * 40503)) >>> 0) % 100 < h.notice * 100) return { from: h };
    if (h.k === 'glass' && h.t > 0 && h.t < h.life && yd2(u, h) < h.r + 18 && !inShade(u)) { u.fear = (u.fear || 0) + 1 / 30; if (u.fear > h.react) return { from: h, glass: 1 }; }
  }
  if (u.fear > 0) u.fear = Math.max(0, u.fear - 1 / 60); return null;
}
function yardAnt(u, dt) {
  if (u.hid > 0) { u.hid -= dt; if (u.hid <= 0) { u.hid = 0; } else return; }
  if (u.atk > 0) u.atk -= dt; u.mv = 0;
  const th = yThreat(u);
  if (th) { if (th.glass) { // shade or hill
      let best = null, bd = 170; for (const l of Y().deco.leaf) { const d = yd2(u, l); if (d < bd) { bd = d; best = l; } }
      const h = nearestHill(u); if (yd2(u, h) < 140 && yd2(u, h) < bd) { if (yMove(u, h.x, h.y, dt, 1.25) || yd2(u, h) < 14) u.hid = 6; return; }
      if (best) { yMove(u, best.x, best.y, dt, 1.25); return; } }
    const f = th.from, dx = u.x - f.x, dy = u.y - f.y, d = Math.hypot(dx, dy) || 1; yMove(u, u.x + dx / d * 60, u.y + dy / d * 60, dt, 1.3); return; }
  const adj = nearestFoe(u, 14 + 0); if (adj && (u.k === 'soldier' || !u.carry)) { yHit(u, adj, dt); return; }
  const o = u.o;
  if (o && o.k === 'home') { const h = HOME; if (yMove(u, h.x, h.y, dt) || yd2(u, h) < 12) yEnterNest(u); return; }
  if (u.k === 'harvester') {
    const dz = nearestFoe(u, 55, f => f.k !== 'rant' && (f.k !== 'ladybug' || f.lastHit));
    if (dz) { const h = nearestHill(u); if (yd2(u, h) < 60) { if (yMove(u, h.x, h.y, dt, 1.2) || yd2(u, h) < 14) u.hid = 4; return; }
      const dx = u.x - dz.x, dy = u.y - dz.y, d = Math.hypot(dx, dy) || 1, hx = h.x - u.x, hy = h.y - u.y, hd = Math.hypot(hx, hy) || 1; yMove(u, u.x + (dx / d + hx / hd) * 40, u.y + (dy / d + hy / hd) * 40, dt, 1.15); return; }
    if (u.carry) { const h = nearestHill(u); if (yMove(u, h.x, h.y, dt) || yd2(u, h) < 16) { const before = S.res.food; S.res.food = Math.min(foodCap(), S.res.food + u.carry);
        const got = S.res.food - before; S.st.gathered += got; incomeAdd(got); if (got < u.carry && (!S.flags.yfull || S.t - S.flags.yfull > 30)) { S.flags.yfull = S.t; say('🍯 Storage is full — build Food Storage to keep more', 'warn'); } u.carry = 0; } return; }
    let fd = o && o.k === 'gather' ? Y().food.find(f => f.id === o.id) : null;
    if (!fd) { // auto-scavenge: nearest explored food
      let bd = o && o.k === 'move' ? 0 : 520; const from = o && o.k === 'gather' ? o : u;
      for (const f of Y().food) { if (!yExplored(f.x, f.y) || Y().cols.some(c => c.own === 'rival' && yd2(c, f) < 230)) continue; const d = yd2(from, f); if (d < bd) { bd = d; fd = f; } }
      if (fd) u.o = { k: 'gather', id: fd.id, x: fd.x, y: fd.y }; }
    if (fd) { if (yMove(u, fd.x, fd.y, dt) || yd2(u, fd) < 8) { u.wait -= dt; if (u.wait <= 0) { u.wait = .6; const a = Math.min(3, fd.amt); fd.amt -= a; u.carry = a; if (fd.amt <= .01) Y().food.splice(Y().food.indexOf(fd), 1); } } return; }
  }
  if (u.k === 'soldier') {
    if (o && o.k === 'attack') { const f = Y().foes.find(f => f.id === o.id && f.hp > 0); if (f) { if (yd2(u, f) < 14 + f.r * .6) yHit(u, f, dt); else yMove(u, f.x, f.y, dt); return; } u.o = { k: 'move', x: u.x, y: u.y }; }
    if (o && o.k === 'hill') { const c = Y().cols[o.id]; if (c && c.own === 'rival') {
        const def = nearestFoe(c, 110, f => f.c === c.i) || nearestFoe(u, 70);
        if (def) { if (yd2(u, def) < 14 + def.r * .6) yHit(u, def, dt); else yMove(u, def.x, def.y, dt); return; }
        if (yd2(u, c) < 30) { c.hp -= UT.soldier.dps * .6 * dt; u.atk = .25; u.ang = Math.atan2(c.y - u.y, c.x - u.x); c.lastHit = S.t; if (rnd() < dt * 3) yparts.push({ x: c.x + (rnd() - .5) * 30, y: c.y + (rnd() - .5) * 20, vx: (rnd() - .5) * 30, vy: -20, t: .6, c: '#a8794a', r: 2.5 }); if (c.hp <= 0) captureHill(c); }
        else yMove(u, c.x + Math.cos(u.id) * 18, c.y + Math.sin(u.id) * 14, dt); return; }
      u.o = null; }
    const gp = o && o.k === 'move' ? o : (u.gp || (u.gp = { x: u.x, y: u.y }));
    const e = nearestFoe(u, 85) || nearestFoe(gp, 140, f => f.k !== 'ladybug' || f.lastHit);
    if (e) { if (yd2(u, e) < 14 + e.r * .6) yHit(u, e, dt); else yMove(u, e.x, e.y, dt); return; }
  }
  if (o && o.k === 'move') { if (yMove(u, o.x, o.y, dt) || yd2(u, o) < 4) { u.gp = { x: o.x, y: o.y }; u.o = null; } return; }
  // idle: mill around the guard point / rally
  const base = u.gp || Y().rally || HOME; u.wait -= dt; if (u.wait <= 0) { u.wait = 2 + rnd() * 3; u.ix = base.x + (rnd() - .5) * 50; u.iy = base.y + (rnd() - .5) * 50; }
  if (u.ix != null) yMove(u, u.ix, u.iy, dt, .5);
}
function captureHill(c) {
  c.own = 'me'; c.hp = c.max; Y().out++; const r = RIVALS[c.i];
  for (const f of Y().foes) if (f.c === c.i) f.hp = 0;
  yReveal(Y(), c.x, c.y, 260); S.st.captured = (S.st.captured || 0) + 1;
  say(`🏴 You captured the ${r.name} hill! New outpost: +${OUT_POP} ant space, +food`, 'good'); events.push({ shake: .4 });
  if (Y().cols.every(k => k.own === 'me') && !S.won) { S.won = true; events.push({ victory: 1 }); }
}
// ---------- rivals & bugs ----------
function yardFoe(f, dt) {
  if (f.atk > 0) f.atk -= dt; f.mv = 0;
  if (f.k === 'centipede') { const s = f.seg; const hd = s[0]; if (yd2(hd, f) > 5) { s.pop(); s.unshift({ x: f.x, y: f.y }); } }
  // flee giant feet like everyone else (rivals only), glass burns everyone
  const yh = Y();
  if (f.c >= 0) { for (const h of yh.hz) if (h.k === 'foot' && h.t < h.grow && h.t > h.react && yd2(f, h) < h.r + 8) { const dx = f.x - h.x, dy = f.y - h.y, d = Math.hypot(dx, dy) || 1; yMove(f, f.x + dx / d * 50, f.y + dy / d * 50, dt, 1.25); return; } }
  const col = f.c >= 0 ? yh.cols[f.c] : null;
  if (f.k === 'rant') {   // rival forager
    const adj = nearestMine(f, 12); if (adj) { yHit(f, adj, dt); return; }
    if (f.carry) { if (yMove(f, col.x, col.y, dt) || yd2(f, col) < 14) { col.food += f.carry; f.carry = 0; } return; }
    let fd = f.o ? yh.food.find(x => x.id === f.o) : null;
    if (!fd) { let bd = 650; for (const x of yh.food) { const d = yd2(col, x); if (d < bd) { bd = d; fd = x; } } f.o = fd ? fd.id : null; }
    if (fd) { if (yMove(f, fd.x, fd.y, dt) || yd2(f, fd) < 8) { f.wait -= dt; if (f.wait <= 0) { f.wait = .7; const a = Math.min(2, fd.amt); fd.amt -= a; f.carry = a; if (fd.amt <= .01) yh.food.splice(yh.food.indexOf(fd), 1); } } return; }
    f.wait -= dt; if (f.wait <= 0) { f.wait = 2 + rnd() * 2; f.ix = col.x + (rnd() - .5) * 120; f.iy = col.y + (rnd() - .5) * 120; } if (f.ix != null) yMove(f, f.ix, f.iy, dt, .6); return;
  }
  if (f.k === 'rsol') {
    if (f.raid) {  // marching on the player's home hill
      const e = nearestMine(f, 60); if (e) { if (yd2(f, e) < 13) yHit(f, e, dt); else yMove(f, e.x, e.y, dt); return; }
      if (yMove(f, HOME.x, HOME.y, dt) || yd2(f, HOME) < 22) { f.gone = 1; raidIntoNest(f); } return; }
    const e = nearestMine(f, 80) || (col && nearestMine(col, 170)) || nearestFoe(f, 60, b => b.c < 0 && b.lastHit);
    if (e) { if (yd2(f, e) < 13 + (e.r || 0) * .6) yHit(f, e, dt); else yMove(f, e.x, e.y, dt); return; }
    f.wait -= dt; if (f.wait <= 0) { f.wait = 2 + rnd() * 3; const a = rnd() * 7; f.ix = col.x + Math.cos(a) * 60; f.iy = col.y + Math.sin(a) * 50; } if (f.ix != null) yMove(f, f.ix, f.iy, dt, .55); return;
  }
  // big bugs
  const b = BUGS[f.k]; const aggro = f.k === 'ladybug' ? (f.lastHit ? 90 : 0) : b.aggro;
  let e = aggro ? nearestMine(f, aggro) : null; if (!e && aggro) { const r = nearestFoe(f, aggro * .7, x => x.c >= 0); if (r) e = r; }
  if (e) { if (yd2(f, e) < f.r + 6) yHit(f, e, dt); else yMove(f, e.x, e.y, dt); return; }
  f.wait -= dt; if (f.wait <= 0 || f.ix == null) { f.wait = 3 + rnd() * 3; f.ix = clamp(f.x + (rnd() - .5) * 300, 40, YW - 40); f.iy = clamp(f.y + (rnd() - .5) * 300, 40, YH - 40); }
  yMove(f, f.ix, f.iy, dt, .6);
}
function raidIntoNest(f) {   // a rival raider reached your hill: it joins a nest raid
  const W = S.raid; const hx = ENTX + (f.id % 2 ? 1 : -1) * (150 + rnd() * 60);
  const u = addU('raider', hx, -6); u.st = 'in'; u.home = hx; u.rt = rnd() * .6;
  if (!W.active) { W.active = true; W.lost = 0; W.kills = 0; W.warned = true; }
  if (!S.flags.rin || S.t - S.flags.rin > 15) { S.flags.rin = S.t; say(`😠 ${RIVALS[f.c].name} broke into your nest! Defend the tunnels!`, 'bad'); }
}
function startRaid() {
  const y = Y(), d = YDIF[S.diff] || YDIF.easy, alive = y.cols.filter(c => c.own === 'rival'); if (!alive.length) return null;
  const c = alive[Math.floor(rnd() * alive.length)], n = Math.round(d.raidN[0] + rnd() * (d.raidN[1] - d.raidN[0]) + (y.raids || 0) * .5);
  for (let i = 0; i < n; i++) { const f = addFoe('rsol', c.x + (rnd() - .5) * 40, c.y + (rnd() - .5) * 40, c.i); f.raid = 1; f.wait = i * .3; }
  y.raids = (y.raids || 0) + 1; y.raidCol = c.i; y.raidT = S.t;
  say(`⚔️ ${RIVALS[c.i].name} are marching ${n} soldiers to your hill! Intercept them on the 🗺️ Surface`, 'bad'); return c;
}
// ---------- hazards ----------
function antClusters(from) { const a = yAnts().filter(u => !(u.hid > 0) && !inShade(u)); if (!a.length) return null;
  let best = null, bn = -1e9; for (const u of a) { let n = 0; for (const v of a) if (yd2(u, v) < 70) n++; const sc = n - (from ? yd2(u, from) / 120 : 0); if (sc > bn) { bn = sc; best = u; } } return best; }
function spawnHazard(k, x, y) {
  const yh = Y(), h = YHAZ[yh.hzLevel] || YHAZ.easy;
  if (k === 'foot') { const z = { k, x, y, r: h.footR, t: 0, grow: h.footGrow, react: h.react, notice: h.notice, a: rnd() * 7, id: yh.nid++ }; yh.hz.push(z); say('👟 A giant foot is coming down! Get out of the shadow!', 'warn'); return z; }
  if (k === 'glass') { const z = { k, x, y, r: h.glassR, t: -2.5, life: h.glassLife, spd: h.glassSpd, dps: h.glassDps, react: h.react, tx: x, ty: y, rt: 0, id: yh.nid++ }; yh.hz.push(z); say('🔍 A kid with a magnifying glass! Ants run for leaf shade or a hill', 'warn'); return z; }
  if (BUGS[k]) { const f = addFoe(k, x, y, -1); say(`${BUGS[k].icon} A ${BUGS[k].name.toLowerCase()} is prowling the Surface! Send soldiers in a group`, 'warn'); return f; }
}
function hazardTick(dt) {
  const yh = Y();
  for (let i = yh.hz.length - 1; i >= 0; i--) { const z = yh.hz[i]; z.t += dt;
    if (z.k === 'foot') { if (!z.done && z.t >= z.grow) { z.done = 1; events.push({ shake: .5, stomp: 1 }); let n = 0;
        for (const u of S.units) if (u.yd && !(u.hid > 0) && yd2(u, z) < z.r) { u.hp = 0; n++; }
        for (const f of yh.foes) if (yd2(f, z) < z.r + f.r * .5) f.hp -= f.c >= 0 ? 999 : 70;
        for (let j = 0; j < 26; j++) { const a = rnd() * 7; yparts.push({ x: z.x + Math.cos(a) * z.r, y: z.y + Math.sin(a) * z.r * .8, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, t: .7, c: '#c8b08a', r: 3 }); }
        if (n) say(`👟 STOMP! ${n} ant${n > 1 ? 's' : ''} squashed`, 'bad'); }
      if (z.t > z.grow + 6) yh.hz.splice(i, 1); continue; }
    if (z.k === 'glass') {
      if (z.t > z.life + 1) { yh.hz.splice(i, 1); continue; }
      z.rt -= dt; if (z.rt <= 0) { z.rt = 1.2; const t = antClusters(z); if (t && yd2(t, z) < 600) { z.tx = t.x; z.ty = t.y; } else { z.tx = z.x + (rnd() - .5) * 200; z.ty = z.y + (rnd() - .5) * 200; } }
      if (z.t > 0 && z.t < z.life) { const dx = z.tx - z.x, dy = z.ty - z.y, d = Math.hypot(dx, dy); if (d > 1) { const s = Math.min(d, z.spd * dt); z.x += dx / d * s; z.y += dy / d * s; }
        for (const u of S.units) if (u.yd && !(u.hid > 0) && yd2(u, z) < z.r && !inShade(u)) { u.hp -= z.dps * dt; if (rnd() < dt * 6) yparts.push({ x: u.x, y: u.y, vx: (rnd() - .5) * 10, vy: -25, t: .9, c: '#9a9a9a', r: 3, smoke: 1 }); }
        for (const f of yh.foes) if (yd2(f, z) < z.r && !inShade(f)) f.hp -= z.dps * dt * (f.c >= 0 ? 1 : .5);
      } else if (z.t <= 0) { const t = antClusters(z); if (t) { const dx = t.x - z.x, dy = t.y - z.y, d = Math.hypot(dx, dy); if (d > 1) { z.x += dx / d * Math.min(d, 18 * dt); z.y += dy / d * Math.min(d, 18 * dt); } } }
    }
  }
}
// ---------- main tick ----------
function yardTick(dt) {
  const yh = Y(); if (!yh) return; const d = YDIF[S.diff] || YDIF.easy, H = YHAZ[yh.hzLevel];
  if (!yh.init) { yh.init = 1; yardInitRivals(); }
  if (S.tut < 5 && S.t < 360) { for (const k in yh.nx) yh.nx[k] += dt; }
  const mine = yAnts();
  // scheduling
  if (H) {
    if (S.t >= yh.nx.foot) { yh.nx.foot = S.t + H.foot[0] + rnd() * (H.foot[1] - H.foot[0]); const t = antClusters(); if (t) spawnHazard('foot', t.x + (rnd() - .5) * 20, t.y + (rnd() - .5) * 20); else yh.nx.foot = S.t + 20; }
    if (S.t >= yh.nx.glass) { yh.nx.glass = S.t + H.glass[0] + rnd() * (H.glass[1] - H.glass[0]); const t = antClusters(); if (t && !yh.hz.some(z => z.k === 'glass')) { const a = rnd() * 7; spawnHazard('glass', t.x + Math.cos(a) * 160, t.y + Math.sin(a) * 160); } else yh.nx.glass = S.t + 30; }
    if (S.t >= yh.nx.bug) { yh.nx.bug = S.t + H.bug[0] + rnd() * (H.bug[1] - H.bug[0]); const nb = yh.foes.filter(f => f.c < 0).length;
      if (nb < H.bugMax) { const ks = Object.keys(BUGS), k = ks[Math.floor(rnd() * ks.length)], ref = mine.length ? mine[Math.floor(rnd() * mine.length)] : HOME; let x, y;
        for (let t = 0; t < 20; t++) { const a = rnd() * 7, r = 320 + rnd() * 200; x = clamp(ref.x + Math.cos(a) * r, 60, YW - 60); y = clamp(ref.y + Math.sin(a) * r, 60, YH - 60); if (yd2({ x, y }, HOME) > 220) break; }
        spawnHazard(k, x, y); } } }
  if (S.t >= yh.nx.raid) { yh.nx.raid = S.t + d.raidEvery[0] + rnd() * (d.raidEvery[1] - d.raidEvery[0]); startRaid(); }
  hazardTick(dt);
  // rival colonies grow
  for (const c of yh.cols) { if (c.own !== 'rival') continue; c.spT += dt; if (c.hp < c.max && S.t - (c.lastHit || -99) > 20) c.hp = Math.min(c.max, c.hp + 2 * dt);
    if (c.spT >= d.spawn) { c.spT = 0; const mine2 = yh.foes.filter(f => f.c === c.i && !f.raid); if (c.food >= 4 && mine2.length < d.cap) { c.food -= 4; const nf = mine2.filter(f => f.k === 'rant').length;
        addFoe(nf < mine2.length * .45 ? 'rant' : 'rsol', c.x + (rnd() - .5) * 20, c.y + (rnd() - .5) * 20, c.i); } else c.food += 1; } }
  // outposts give food
  yh.outT += dt; if (yh.outT >= OUT_FOOD_T) { yh.outT = 0; const n = yh.cols.filter(c => c.own === 'me').length; if (n) { const before = S.res.food; S.res.food = Math.min(foodCap(), S.res.food + OUT_FOOD * n); const g = S.res.food - before; S.st.gathered += g; incomeAdd(g); } }
  // food respawn
  yh.foodT += dt; if (yh.foodT > 22) { yh.foodT = 0; if (yh.food.length < 16) yardAddFood(yh); }
  // units
  for (const u of mine) yardAnt(u, dt);
  for (const f of yh.foes) yardFoe(f, dt);
  // deaths of foes
  for (let i = yh.foes.length - 1; i >= 0; i--) { const f = yh.foes[i]; if (f.hp > 0 && !f.gone) continue; yh.foes.splice(i, 1); if (f.gone) continue;
    for (let j = 0; j < 8; j++) yparts.push({ x: f.x, y: f.y, vx: (rnd() - .5) * 70, vy: (rnd() - .5) * 70, t: .7, c: f.c >= 0 ? RIVALS[f.c].dark : '#3a2a20', r: 2.5 });
    if (f.c < 0) { const b = BUGS[f.k], fd = yardAddFood(yh, null, f.x, f.y, b.drop, 'meat'); fd.bug = f.k; S.st.kills++; S.st.bugs = (S.st.bugs || 0) + 1; if (f.lastHit === 'me') say(`🍖 ${b.name} defeated! It dropped ${b.drop} food — send harvesters`, 'good'); }
    else if (f.lastHit === 'me') S.st.kills++; }
  // vision
  yvisT -= dt; if (yvisT <= 0) { yvisT = .4; yvis.fill(0); yReveal(yh, HOME.x, HOME.y, 300); for (const c of yh.cols) if (c.own === 'me') yReveal(yh, c.x, c.y, 240); for (const u of mine) yReveal(yh, u.x, u.y, 150); }
  for (let k = yparts.length - 1; k >= 0; k--) { const p = yparts[k]; p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; if (p.t <= 0) yparts.splice(k, 1); }
}
