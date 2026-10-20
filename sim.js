'use strict';
// ================= Ant Haven — simulation =================
const VERSION = 'ah-v1.2.1';
const CS = 24, COLS = 64, ROWS = 34, ENT = 32, SURF_H = 300, NC = COLS * ROWS;
const WW = COLS * CS, WH = ROWS * CS, ENTX = (ENT + .5) * CS, ENTI = ENT;  // entrance cell (ENT,0)
const SOIL = 0, DUG = 1, PLAN = 2, ROCK = 3;
const SAVE_KEY = 'anthaven-save-v1', TUT_KEY = 'anthaven-tut-done';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const idx = (x, y) => y * COLS + x;
const cx = i => i % COLS, cy = i => (i / COLS) | 0;
let rnd = Math.random;
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const BIOMES = {
  backyard: { name: 'Backyard', emoji: '🌻', desc: 'Soft lawn soil and spring rain. The best place to start.',
    sky: ['#79c3ee', '#d2efff'], hills: ['#a6d47c', '#86bd5f'], grass: '#5aa73b', grassD: '#3c8829', ground: '#6a9a3a',
    soil: ['#a06d40', '#865633', '#6c4124', '#523019'], rim: '#3b2112', tun: ['#36200f', '#21120a'], rock: ['#a69c90', '#756c62'],
    glow: '#ffcf73', water: '74,163,223', digMul: 1, rocks: 34,
    rain: { name: 'Rain', icon: '🌧', every: 190, dur: 22, vol: 7 }, hazard: null,
    foodEvery: 34, foods: ['crumb', 'berry', 'crumb', 'seed'], plant: 'clover', plants: [-10, 9, 18, -20, 24, -27] },
  dunes: { name: 'Sand Dunes', emoji: '🏜️', desc: 'Sand digs fast, but food is scarce. Sandstorms and flash floods.',
    sky: ['#f3b96c', '#ffe8c2'], hills: ['#efc785', '#dcae62'], grass: '#e2bd78', grassD: '#c99a52', ground: '#d8ae66',
    soil: ['#e6bd7a', '#d4a564', '#bc884d', '#99683a'], rim: '#6e4721', tun: ['#4d3016', '#33200d'], rock: ['#cfa97f', '#9c7853'],
    glow: '#ffd98a', water: '88,180,216', digMul: .62, rocks: 24,
    rain: { name: 'Flash flood', icon: '🌊', every: 300, dur: 12, vol: 10 }, hazard: { kind: 'sandstorm', name: 'Sandstorm', icon: '🌪', every: 210, dur: 18 },
    foodEvery: 48, foods: ['seed', 'seed', 'date', 'crumb'], plant: 'succulent', plants: [-12, 11, 22, -24] },
  ice: { name: 'Ice World', emoji: '❄️', desc: 'Frozen ground digs slowly. Cold snaps hurt ants outside.',
    sky: ['#9fc2e6', '#eef6ff'], hills: ['#f4f9ff', '#d6e7f6'], grass: '#eef6fc', grassD: '#c9dcec', ground: '#dfeaf4',
    soil: ['#bccbd9', '#93a9bf', '#7289a3', '#566a83'], rim: '#2d3b4f', tun: ['#212d3d', '#151d29'], rock: ['#e6f0f8', '#a9bdd0'],
    glow: '#bfe6ff', water: '126,206,255', digMul: 1.55, rocks: 40,
    rain: { name: 'Meltwater', icon: '💧', every: 230, dur: 20, vol: 6 }, hazard: { kind: 'cold', name: 'Cold snap', icon: '🥶', every: 200, dur: 26 },
    foodEvery: 40, foods: ['berry', 'seed', 'crumb'], plant: 'moss', plants: [-11, 10, 20, -22, 28] },
  palm: { name: 'Palm Isle', emoji: '🌴', soon: true, card: ['#4fd1c5', '#f6e7b0'] },
  peak: { name: 'High Peak', emoji: '🏔️', soon: true, card: ['#7d8ca3', '#e6ecf3'] },
  mars: { name: 'Red Planet', emoji: '🪐', soon: true, card: ['#c2512f', '#f4a261'] },
  woods: { name: 'Deep Woods', emoji: '🌲', soon: true, card: ['#2f5d3a', '#8fbf6a'] },
  fen: { name: 'Fog Fen', emoji: '🌫️', soon: true, card: ['#6b7f78', '#c9d6cf'] },
  ember: { name: 'Ember Ridge', emoji: '🌋', soon: true, card: ['#5a1f1a', '#f08a3c'] },
  bloom: { name: 'Wild Bloom', emoji: '🌸', soon: true, card: ['#d96ba8', '#ffd6ea'] },
};
const DIFF = {
  easy: { name: 'Easy', food: 50, eat: 1 / 85, raidFirst: 420, raidEvery: 240, raidBase: 3, raidGrow: 1, hp: 1, hillHp: 320, guards: 3, starve: .07, rainMul: 1, qRegen: .3, qSafe: true },
  hard: { name: 'Hard', food: 40, eat: 1 / 62, raidFirst: 300, raidEvery: 180, raidBase: 4, raidGrow: 2, hp: 1.25, hillHp: 520, guards: 5, starve: .16, rainMul: 1.4, qRegen: .08, qSafe: false },
};
const ROOMS = {
  home: { name: 'Royal Nook', icon: '🏡', w: 5, h: 2, cost: {}, desc: 'Your starting chamber', cap: 100, eggs: 2, pop: 14 },
  storage: { name: 'Food Storage', icon: '🍯', w: 3, h: 2, cost: { food: 10 }, desc: '+60 food capacity', cap: 60 },
  eggs: { name: 'Egg Room', icon: '🥚', w: 3, h: 2, cost: { food: 12 }, desc: 'Room for 6 more eggs', eggs: 6 },
  den: { name: 'Sleeping Den', icon: '🛏️', w: 3, h: 2, cost: { food: 14 }, desc: '+8 ant capacity', pop: 8 },
  queen: { name: 'Queen Chamber', icon: '👑', w: 4, h: 3, cost: { food: 25 }, desc: 'Queen lays 2× faster, +4 ants', pop: 4, once: true },
  nursery: { name: 'Nursery', icon: '🍼', w: 3, h: 2, cost: { food: 20 }, desc: 'Eggs hatch 40% faster', once: true },
  barracks: { name: 'Barracks', icon: '🛡️', w: 4, h: 2, cost: { food: 30 }, desc: 'Train soldiers and leaf-cutters', once: true, pop: 4 },
  garden: { name: 'Fungus Garden', icon: '🍄', w: 5, h: 3, cost: { food: 25 }, desc: 'Turns leaves into food' },
  pantry: { name: 'Pantry', icon: '🧺', w: 4, h: 3, cost: { food: 30, leaves: 5 }, desc: '+150 food capacity', cap: 150 },
  lookout: { name: 'Lookout', icon: '🔭', w: 2, h: 2, cost: { food: 20 }, desc: 'Early raid warning + wider view. Top 5 rows only', maxRow: 4, once: true },
  sump: { name: 'Sump', icon: '💧', w: 2, h: 2, cost: { food: 15 }, desc: 'Drains flood water. Build it deep!' },
};
const ROOM_ORDER = ['storage', 'eggs', 'den', 'queen', 'nursery', 'barracks', 'garden', 'pantry', 'lookout', 'sump'];
const UT = {
  worker: { hp: 10, dps: 1.3, spd: 34, eat: 1, name: 'Worker', icon: '⛏️' },
  harvester: { hp: 10, dps: 1, spd: 42, eat: 1, name: 'Harvester', icon: '🌾' },
  cutter: { hp: 12, dps: 1.5, spd: 37, eat: 1, name: 'Leaf-cutter', icon: '🍃' },
  soldier: { hp: 32, dps: 6, spd: 40, eat: 1.5, name: 'Soldier', icon: '⚔️' },
  queen: { hp: 60, dps: 3, spd: 9, eat: 2, name: 'Queen', icon: '👑' },
  raider: { hp: 16, dps: 3.5, spd: 34, eat: 0, name: 'Raider' },
  guard: { hp: 22, dps: 4, spd: 30, eat: 0, name: 'Hill guard' },
};
const ROLES = ['worker', 'harvester', 'cutter', 'soldier'];
const TRAIN = { soldier: { food: 8, time: 6 }, cutter: { food: 4, time: 3 } };
const EGG_FOOD = 4, DIG_FOOD = 1, GOAL_REWARD = 8;

let S = null;                     // the game state
let wl = new Float32Array(NC);    // water level per cell (derived)
let nestDirty = true, claimSet = new Set(), events = [];   // events: transient effects for UI
const parts = [];                 // particles
function B() { return BIOMES[S.biome]; }
function D() { return DIFF[S.diff]; }
const say = (msg, kind) => events.push({ toast: msg, kind });

// ---------------- state ----------------
function newState(bk, dk, seed) {
  seed = seed == null ? (Math.random() * 1e9) | 0 : seed; const R = mulberry(seed); const bio = BIOMES[bk], dif = DIFF[dk];
  const s = { v: 1, ver: VERSION, biome: bk, diff: dk, seed, t: 0, nid: 1, grid: new Uint8Array(NC), room: new Int16Array(NC), digp: new Float32Array(NC),
    rooms: [], units: [], eggs: [], items: [], fog: new Uint8Array(COLS), res: { food: dif.food, leaves: 0 }, water: 0,
    rain: { on: false, t: 0, next: 230, n: 0, warned: false }, haz: { on: false, t: 0, next: bio.hazard ? 330 : 1e12, n: 0, warned: false },
    raid: { n: 0, next: dif.raidFirst, active: false, warned: false, lost: 0, kills: 0 },
    hill: { x: (COLS - 4.5) * CS, hp: dif.hillHp, max: dif.hillHp, dead: false, spawnT: 0 },
    forage: null, leafT: null, qT: 8, hatchAs: 'worker', goals: {}, flags: {}, tut: 0, endless: false, won: false, over: false, why: '',
    st: { gathered: 0, eaten: 0, hatched: 0, lost: 0, leaves: 0, kills: 0, raids: 0, dug: 0, planned: 0, rooms: 0, stolen: 0, peak: 0, floods: 0 } };
  const g = s.grid;
  // bedrock border
  for (let x = 0; x < COLS; x++) g[idx(x, ROWS - 1)] = ROCK;
  for (let y = 0; y < ROWS; y++) { g[idx(0, y)] = ROCK; g[idx(COLS - 1, y)] = ROCK; }
  // rock clusters (more and bigger deeper down)
  for (let k = 0; k < bio.rocks; k++) {
    let x = 1 + Math.floor(R() * (COLS - 2)), y = 3 + Math.floor(R() * (ROWS - 4)); const n = 1 + Math.floor(R() * (2 + y / 9));
    for (let j = 0; j < n; j++) { if (!(Math.abs(x - ENT) < 6 && y < 10) && x > 0 && x < COLS - 1 && y > 1 && y < ROWS - 1) g[idx(x, y)] = ROCK; if (R() < .5) x += R() < .5 ? -1 : 1; else y += R() < .5 ? -1 : 1; }
  }
  // starting shaft + royal nook
  for (let y = 0; y <= 4; y++) g[idx(ENT, y)] = DUG;
  s.rooms.push({ id: s.nid++, k: 'home', x: ENT - 2, y: 5, w: 5, h: 2, done: true });
  for (let y = 5; y <= 6; y++) for (let x = ENT - 2; x <= ENT + 2; x++) { g[idx(x, y)] = DUG; s.room[idx(x, y)] = s.rooms[0].id; }
  const er = { id: s.nid++, k: 'eggs', x: ENT + 3, y: 5, w: 3, h: 2, done: true }; s.rooms.push(er);   // starter Egg Room so hatching never stalls early
  for (let y = 5; y <= 6; y++) for (let x = ENT + 3; x <= ENT + 5; x++) { g[idx(x, y)] = DUG; s.room[idx(x, y)] = er.id; }
  for (let x = ENT - 7; x <= ENT + 7; x++) s.fog[x] = 1;
  // surface food + plants
  const it = (k, sub, col, amt) => s.items.push({ id: s.nid++, k, sub, x: (col + .5) * CS, amt, max: amt, rg: 0 });
  it('food', bio.foods[0], ENT + 5, 80); it('food', bio.foods[1], ENT - 6, 40); it('food', bio.foods[2 % bio.foods.length], ENT + 13, 45); it('food', bio.foods[0], ENT - 15, 50);
  for (let j = 0; j < 4; j++) { let c = 3 + Math.floor(R() * (COLS - 6)); if (Math.abs(c - ENT) < 8 || c > COLS - 8) continue; it('food', bio.foods[j % bio.foods.length], c, 25 + Math.floor(R() * 25)); }
  for (const o of bio.plants) it('plant', bio.plant, ENT + o, 15);
  S = s;
  addU('queen', (ENT + .5) * CS, 6.5 * CS);
  for (let i = 0; i < 4; i++) addU('worker', (ENT - 1.5 + i) * CS, 6.4 * CS);
  for (let i = 0; i < 2; i++) addU('harvester', ENTX - 20 + i * 40, -6);
  for (let i = 0; i < dif.guards; i++) addU('guard', s.hill.x - 30 + i * 18, -6);
  s.yard = newYard(seed, dk);
  nestDirty = true; computeWater(); return s;
}
function addU(k, x, y) {
  const t = UT[k], u = { id: S.nid++, k, tm: (k === 'raider' || k === 'guard') ? 1 : 0, x, y, hp: t.hp, max: t.hp, path: [], st: 'idle', wait: rnd() * .5,
    carry: 0, ph: rnd() * 6, ang: 0, ra: 0, lane: -3 - rnd() * 9, rt: 0, mode: 'guard', atk: 0, job: -1, train: 0 };
  if (u.tm === 1) { const m = D().hp * (k === 'raider' ? (1 + .12 * S.raid.n) : 1); u.hp = u.max = Math.round(t.hp * m); }
  S.units.push(u); return u;
}
const uById = id => S.units.find(u => u.id === id);
const units = k => S.units.filter(u => u.k === k);
const count = k => { let n = 0; for (const u of S.units) if (u.k === k) n++; return n; };
const adults = () => { let n = 0; for (const u of S.units) if (u.tm === 0 && u.k !== 'queen') n++; return n; };
const queen = () => S.units.find(u => u.k === 'queen');
const roomsOf = k => S.rooms.filter(r => r.k === k);
const has = k => S.rooms.some(r => r.k === k && r.done);
const doneRooms = () => S.rooms.filter(r => r.done);
function sumRoom(f) { let n = 0; for (const r of S.rooms) if (r.done && ROOMS[r.k][f]) n += ROOMS[r.k][f]; return n; }
const foodCap = () => sumRoom('cap'), eggCap = () => sumRoom('eggs'), popCap = () => sumRoom('pop') + (S.yard ? S.yard.cols.filter(c => c.own === 'me').length * OUT_POP : 0);
const roomCells = r => { const a = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) a.push(idx(x, y)); return a; };
const roomById = id => S.rooms.find(r => r.id === id);
function roomFlooded(r) { let n = 0; const c = roomCells(r); for (const i of c) if (wl[i] > .5) n++; return n * 2 > c.length; }
function rndRoomPt(r) { return { x: (r.x + .5 + rnd() * (r.w - 1)) * CS, y: (r.y + r.h - .5) * CS + 4 - rnd() * 3 }; }
function upkeep() { let e = 0; for (const u of S.units) if (u.tm === 0) e += UT[u.k].eat; return e * D().eat; }   // food per second

// ---------------- grid / paths ----------------
const walk = i => S.grid[i] === DUG;
const layer = y => y < 6 ? 0 : y < 14 ? 1 : y < 24 ? 2 : 3;
const LAYER_NAMES = ['Topsoil', 'Loam', 'Clay', 'Deep earth'];
const digTime = i => [2, 2.8, 3.8, 5][layer(cy(i))] * B().digMul;
const stamp = new Uint32Array(NC), prev = new Int32Array(NC), Q = new Int32Array(NC); let stampN = 1;
function bfs(from, isGoal, maxN) {  // returns goal cell or -1; prev[] filled
  stampN++; let h = 0, t = 0; Q[t++] = from; stamp[from] = stampN; prev[from] = -1;
  while (h < t) { const c = Q[h++]; if (isGoal(c)) return c; if (maxN && h > maxN) break; const x = cx(c), y = cy(c);
    for (const n of [x > 0 ? c - 1 : -1, x < COLS - 1 ? c + 1 : -1, y > 0 ? c - COLS : -1, y < ROWS - 1 ? c + COLS : -1]) {
      if (n < 0 || stamp[n] === stampN || !walk(n)) continue; stamp[n] = stampN; prev[n] = c; Q[t++] = n; } }
  return -1;
}
function backtrack(g) { const p = []; for (let c = g; c >= 0; c = prev[c]) p.push(c); p.reverse(); return p; }
function cellPath(a, b) { if (!walk(b)) return null; const g = bfs(a, c => c === b); return g < 0 ? null : backtrack(g); }
function cellOf(x, y) { return idx(clamp(Math.floor(x / CS), 0, COLS - 1), clamp(Math.floor(y / CS), 0, ROWS - 1)); }
const isUnder = y => y > 1;
function pt(i, j) { return { x: (cx(i) + .5) * CS + (rnd() - .5) * j, y: (cy(i) + .5) * CS + 4 + (rnd() - .5) * j * .3 }; }
function nearestWalk(i) { if (walk(i)) return i; let best = ENTI, bd = 1e9; for (let c = 0; c < NC; c++) if (walk(c)) { const d = Math.abs(cx(c) - cx(i)) + Math.abs(cy(c) - cy(i)); if (d < bd) { bd = d; best = c; } } return best; }
function route(u, gx, gy) {
  const from = isUnder(u.y), to = isUnder(gy), P = [];
  let start = from ? cellOf(u.x, u.y) : ENTI; if (from && !walk(start)) { start = nearestWalk(start); const p = pt(start, 0); u.x = p.x; u.y = p.y; }
  if (!from) { if (to) P.push({ x: ENTX, y: -2 }); }
  if (to) { const g = cellOf(gx, gy); const cp = cellPath(start, g); if (!cp) return false; for (let k = from ? 1 : 0; k < cp.length; k++) P.push(pt(cp[k], 7)); P.push({ x: gx, y: gy }); }
  else { if (from) { const cp = cellPath(start, ENTI); if (!cp) return false; for (let k = 1; k < cp.length; k++) P.push(pt(cp[k], 4)); P.push({ x: ENTX, y: -2 }); } P.push({ x: clamp(gx, 6, WW - 6), y: gy }); }
  u.path = P; return true;
}
function moveAlong(u, dt) {
  if (!u.path.length) return true;
  const c = isUnder(u.y) ? cellOf(u.x, u.y) : -1;
  let sp = UT[u.k].spd * (c >= 0 && wl[c] > .5 ? .35 : 1) * (!isUnder(u.y) && S.rain.on ? .85 : 1) * (u.tm === 0 && S.haz.on && B().hazard.kind === 'sandstorm' && !isUnder(u.y) ? .6 : 1);
  let d = sp * dt;
  while (d > 0 && u.path.length) { const p = u.path[0], dx = p.x - u.x, dy = p.y - u.y, L = Math.hypot(dx, dy);
    if (L > .01) u.ang = Math.atan2(dy, dx);
    if (L <= d) { u.x = p.x; u.y = p.y; d -= L; u.path.shift(); } else { u.x += dx / L * d; u.y += dy / L * d; d = 0; } }
  u.ph += sp * dt * .45; u.mv = 1;
  return !u.path.length;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------- digging ----------------
function line4(x0, y0, x1, y1) { const pts = [[x0, y0]]; let x = x0, y = y0, ix = 0, iy = 0; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
  while (ix < dx || iy < dy) { if ((.5 + ix) / dx < (.5 + iy) / dy) { x += sx; ix++; } else { y += sy; iy++; } pts.push([x, y]); } return pts; }
// plan a dug path from a list of cells (in order). returns {cells:[new plan cells], blocked:[cells], ok, why, cost}
function digPlan(path) {
  const out = { cells: [], blocked: [], cost: 0, ok: false, why: '' }; if (!path.length) return out;
  const isOpen = i => S.grid[i] === DUG || S.grid[i] === PLAN;
  const nb = i => { const x = cx(i), y = cy(i); return [x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1, y > 0 ? i - COLS : -1, y < ROWS - 1 ? i + COLS : -1].filter(n => n >= 0); };
  let connected = false, stop = false; const seen = new Set();
  for (const i of path) {
    if (seen.has(i)) continue; seen.add(i);
    if (stop) { out.blocked.push(i); continue; }
    if (isOpen(i)) { connected = true; continue; }
    if (S.grid[i] === ROCK || (cy(i) === 0 && cx(i) !== ENT)) { out.blocked.push(i); stop = connected; if (!connected) continue; continue; }
    if (!connected) { if (nb(i).some(isOpen)) connected = true; else { out.blocked.push(i); continue; } }
    out.cells.push(i);
  }
  out.cost = out.cells.length * DIG_FOOD;
  if (!connected && !out.cells.length) out.why = 'Start your tunnel from an existing tunnel';
  else if (!out.cells.length) out.why = out.blocked.length ? 'Rock is too hard to dig' : '';
  else if (S.res.food < out.cost) out.why = `Need ${out.cost} food (have ${Math.floor(S.res.food)})`;
  else out.ok = true;
  return out;
}
function commitDig(path) {
  const p = digPlan(path); if (!p.ok) return p;
  S.res.food -= p.cost; for (const i of p.cells) { S.grid[i] = PLAN; S.digp[i] = 0; } S.st.planned += p.cells.length; nestDirty = true; return p;
}
function completeDig(i) {
  S.grid[i] = DUG; S.digp[i] = 0; nestDirty = true; const rid = S.room[i];
  if (!rid) S.st.dug++;
  for (let k = 0; k < 7; k++) parts.push({ x: (cx(i) + .5) * CS, y: (cy(i) + .5) * CS, vx: (rnd() - .5) * 60, vy: -rnd() * 50, t: .7, c: B().soil[layer(cy(i))], r: 1.5 + rnd() * 1.5 });
  if (rid) { const r = roomById(rid); if (r && !r.done && roomCells(r).every(c => S.grid[c] === DUG)) finishRoom(r); }
}
function finishRoom(r) { r.done = true; S.st.rooms++; nestDirty = true; say(`${ROOMS[r.k].icon} ${ROOMS[r.k].name} is ready!`, 'good');
  if (r.k === 'lookout') for (let x = ENT - 13; x <= ENT + 13; x++) S.fog[clamp(x, 0, COLS - 1)] = 1;
  if (r.k === 'queen') { const q = queen(); if (q) { q.st = 'move'; route(q, ...Object.values(rndRoomPt(r))); } } }
// erase / fill one cell. returns string result or null
function fillCell(i) {
  const g = S.grid[i], x = cx(i), y = cy(i);
  if (S.room[i]) return null;
  if (x === ENT && y <= 4) return 'protected';
  if (g === PLAN) { S.grid[i] = SOIL; S.digp[i] = 0; S.res.food = Math.min(foodCap(), S.res.food + DIG_FOOD); nestDirty = true; return 'unplan'; }
  if (g === DUG) { S.grid[i] = SOIL; nestDirty = true; for (const u of S.units) if (isUnder(u.y) && cellOf(u.x, u.y) === i) { const n = nearestWalk(i), p = pt(n, 0); u.x = p.x; u.y = p.y; u.path = []; } return 'fill'; }
  return null;
}
// ---------------- rooms ----------------
function canRoom(k, x, y) {
  const d = ROOMS[k], c = d.cost;
  if (d.once && roomsOf(k).length) return { ok: false, why: `You already have a ${d.name}` };
  if (x < 1 || y < 1 || x + d.w > COLS - 1 || y + d.h > ROWS - 1) return { ok: false, why: 'Too close to the edge' };
  if (d.maxRow != null && y > d.maxRow) return { ok: false, why: 'Lookouts must be near the surface (top 5 rows)' };
  let touch = false;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) { const n = idx(x + i, y + j);
    if (S.grid[n] === ROCK) return { ok: false, why: 'Rock in the way' };
    if (S.room[n]) return { ok: false, why: 'Overlaps another room' };
    if (x + i === ENT && y + j <= 1) return { ok: false, why: 'Keep the entrance clear' };
    if (S.grid[n] === DUG) touch = true; }
  if (!touch) for (let j = -1; j <= d.h; j++) for (let i = -1; i <= d.w; i++) { if ((i === -1 || i === d.w) === (j === -1 || j === d.h)) continue; const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < COLS && yy < ROWS && S.grid[idx(xx, yy)] === DUG) touch = true; }
  if (!touch) return { ok: false, why: 'Must touch a dug tunnel' };
  for (const r in c) if ((S.res[r] || 0) < c[r]) return { ok: false, poor: true, why: `Need ${c[r]} ${r} (have ${Math.floor(S.res[r] || 0)})` };
  return { ok: true };
}
function placeRoom(k, x, y) {
  const v = canRoom(k, x, y); if (!v.ok) return v; const d = ROOMS[k];
  for (const r in d.cost) S.res[r] -= d.cost[r];
  const r = { id: S.nid++, k, x, y, w: d.w, h: d.h, done: false }; S.rooms.push(r);
  for (const i of roomCells(r)) { S.room[i] = r.id; if (S.grid[i] === SOIL) { S.grid[i] = PLAN; S.digp[i] = 0; } }
  if (roomCells(r).every(i => S.grid[i] === DUG)) finishRoom(r); nestDirty = true; return { ok: true, r };
}
function removeRoom(r) {
  if (r.k === 'home') return false; const d = ROOMS[r.k];
  for (const i of roomCells(r)) { S.room[i] = 0; if (S.grid[i] === PLAN) S.grid[i] = SOIL; }
  S.rooms.splice(S.rooms.indexOf(r), 1); for (const k in d.cost) S.res[k] += Math.floor(d.cost[k] / 2); S.res.food = Math.min(S.res.food, foodCap());
  for (const e of S.eggs) if (e.rid === r.id) e.rid = homeRoom().id; nestDirty = true; return true;
}
const homeRoom = () => S.rooms.find(r => r.k === 'home');

// ---------------- water ----------------
let dugCount = 0;
function computeWater() {
  wl.fill(0); dugCount = 0; for (let i = 0; i < NC; i++) if (S.grid[i] === DUG) dugCount++;
  if (S.water <= .001) { S.water = 0; return; }
  bfs(ENTI, () => false); const rows = new Map();
  for (let i = 0; i < NC; i++) if (stamp[i] === stampN) { const y = cy(i); if (!rows.has(y)) rows.set(y, []); rows.get(y).push(i); }
  let v = S.water; const ys = [...rows.keys()].sort((a, b) => b - a), tot = [...rows.values()].reduce((s, a) => s + a.length, 0);
  if (v > tot) S.water = v = tot;
  for (const y of ys) { const a = rows.get(y); if (v >= a.length) { for (const i of a) wl[i] = 1; v -= a.length; } else { for (const i of a) wl[i] = v / a.length; v = 0; break; } }
}
// ---------------- colony management ----------------
function eggRoomWithSpace() { return S.rooms.filter(r => r.done && ROOMS[r.k].eggs && !r.fl).find(r => S.eggs.filter(e => e.rid === r.id).length < ROOMS[r.k].eggs); }
function canLay() {   // why the queen can / can't lay right now, plus a one-tap fix
  if (!queen()) return { ok: false, why: 'No queen' };
  if (adults() + S.eggs.length >= popCap()) return { ok: false, why: `Colony full (${popCap()} ants) — build a 🛏️ Sleeping Den`, fix: 'den' };
  if (!eggRoomWithSpace()) return { ok: false, why: S.rooms.some(r => r.k === 'eggs' && r.done && r.fl) ? 'Egg Room is flooded — wait or build another' : 'Egg rooms are full — build another 🥚 Egg Room', fix: 'eggs' };
  if (S.res.food < EGG_FOOD) return { ok: false, poor: true, why: `Need ${EGG_FOOD} food for an egg`, fix: 'harvester' };
  return { ok: true };
}
function layEgg(as) { const v = canLay(); if (!v.ok) return v; S.res.food -= EGG_FOOD; S.eggs.push({ rid: eggRoomWithSpace().id, t: 0, wet: 0, ox: rnd(), oy: rnd(), as: as || S.hatchAs || 'worker' }); return { ok: true }; }
function pickConvert(k) {  // choose an ant of role k to convert (prefer idle, not carrying)
  const c = S.units.filter(u => u.k === k && !(u.train > 0) && !u.yd); if (!c.length) return null;
  c.sort((a, b) => (a.carry ? 1 : 0) - (b.carry ? 1 : 0) || (a.job >= 0 ? 1 : 0) - (b.job >= 0 ? 1 : 0)); return c[0];
}
function canTrain(k) {
  if (k === 'harvester' || k === 'worker') return { ok: true };
  if (!has('barracks')) return { ok: false, why: 'Build a Barracks first' };
  if (S.res.food < TRAIN[k].food) return { ok: false, poor: true, why: `Need ${TRAIN[k].food} food` };
  return { ok: true };
}
function assign(k, dir) {   // dir +1: convert a worker into k; -1: convert a k back into a worker
  if (k === 'worker') return { ok: false };
  if (dir > 0) {
    const v = canTrain(k); if (!v.ok) return v;
    if (count('worker') <= 1) return { ok: false, needWorker: true, why: 'Need a spare worker (1 must stay to dig) — tap 🥚 Lay egg' };
    const u = pickConvert('worker'); if (!u) return { ok: false, needWorker: true, why: 'No spare workers — tap 🥚 Lay egg' };
    setRole(u, k);
    if (TRAIN[k]) { S.res.food -= TRAIN[k].food; u.train = TRAIN[k].time; const b = roomsOf('barracks').find(r => r.done); if (b) { const p = rndRoomPt(b); route(u, p.x, p.y); } S.flags[k] = true; }
    return { ok: true, u };
  } else { const u = pickConvert(k); if (!u) return { ok: false, why: `No ${UT[k].name.toLowerCase()}s` }; setRole(u, 'worker'); return { ok: true, u }; }
}
function setRole(u, k) { const f = u.hp / u.max; u.k = k; u.help = 0; u.max = UT[k].hp; u.hp = Math.max(1, Math.round(u.max * f)); u.st = 'idle'; u.job = -1; u.carry = 0; u.mode = 'guard'; u.wait = 0; u.train = 0; }
function orderSoldiers(ids, x, y, attack) {
  let n = 0; for (const id of ids) { const u = uById(id); if (!u || u.k !== 'soldier' || u.yd) continue;
    if (attack) { u.mode = 'attack'; u.path = []; u.rt = 0; } else { u.mode = 'move'; const gx = x + (n % 4 - 1.5) * 9, gy = isUnder(y) ? y : -3 - (n % 3) * 3; u.tx = gx; u.ty = gy; if (!route(u, gx, gy)) { u.mode = 'guard'; continue; } }
    n++; } return n;
}
function guardSoldiers(ids) { for (const id of ids) { const u = uById(id); if (u && u.k === 'soldier') { u.mode = 'guard'; u.path = []; } } }

// ---------------- AI ----------------
function enemyNear(u, r, filter) { let best = null, bd = r; for (const e of S.units) { if (e.tm === u.tm || e.hp <= 0 || !e.yd !== !u.yd) continue; if (filter && !filter(e)) continue; const d = dist(u, e); if (d < bd) { bd = d; best = e; } } return best; }
function hit(u, e, dt) { if (e.k === 'raider') e.lastBy = u.id; e.hp -= UT[u.k].dps * (u.k === 'raider' && e.k !== 'soldier' && D().qSafe ? .4 : 1) * dt; u.atk = .25; u.ang = Math.atan2(e.y - u.y, e.x - u.x); e.lastHit = u.id;
  if (rnd() < dt * 4) parts.push({ x: (u.x + e.x) / 2, y: (u.y + e.y) / 2 - 3, vx: (rnd() - .5) * 40, vy: -20 - rnd() * 30, t: .4, c: '#fff6c8', r: 1.2 }); }
function engage(u, e, dt) {
  if (dist(u, e) < 15) { hit(u, e, dt); return; }
  u.rt -= dt; if (u.rt <= 0 || !u.path.length) { u.rt = .5; if (!route(u, e.x, e.y)) { u.path = []; } }
  moveAlong(u, dt);
}
const hazardOn = () => S.haz.on || S.haz.warned;   // head inside as soon as the warning sounds
function shelter(u, dt) {   // go inside during a hazard
  if (isUnder(u.y) && cy(cellOf(u.x, u.y)) >= 2 && !u.path.length) return;
  if (!u.path.length || u.st !== 'shelter') { u.st = 'shelter'; const r = homeRoom(); const p = rndRoomPt(r); route(u, p.x, p.y); }
  moveAlong(u, dt);
}
function pickItem(leaf) {
  const want = leaf ? S.leafT : S.forage; const ok = it => it && it.k === (leaf ? 'plant' : 'food') && it.amt >= 1 && S.fog[clamp(Math.floor(it.x / CS), 0, COLS - 1)];
  const w = S.items.find(i => i.id === want); if (ok(w)) return w;
  let best = null, bd = 1e9; for (const it of S.items) if (ok(it)) { const d = Math.abs(it.x - ENTX); if (d < bd) { bd = d; best = it; } } return best;
}
function depot(leaf) {
  if (leaf) { const g = S.rooms.filter(r => r.k === 'garden' && r.done && !r.fl); if (g.length) return g[Math.floor(rnd() * g.length)]; return homeRoom(); }
  const s = S.rooms.filter(r => (r.k === 'storage' || r.k === 'pantry') && r.done && !r.fl); return s.length ? s[Math.floor(rnd() * s.length)] : homeRoom();
}
let fullWarnT = 0;
function deliver(u, leaf) {
  if (leaf) { S.res.leaves += u.carry; S.st.leaves += u.carry; }
  else { const cap = foodCap(), before = S.res.food; S.res.food = Math.min(cap, S.res.food + u.carry); const got = S.res.food - before; S.st.gathered += got; incomeAdd(got);
    if (got < u.carry && S.t - fullWarnT > 25) { fullWarnT = S.t; say('Food storage is full! Build a Food Storage or Pantry.', 'bad'); } }
  u.carry = 0;
}
function thinkForager(u, dt, leaf) {
  const e = D().qSafe ? null : enemyNear(u, 14); if (e) { hit(u, e, dt); return; }
  if (u.wait > 0) { u.wait -= dt; return; }
  if (u.carry > 0) {
    if (u.st !== 'home') { const r = depot(leaf), p = rndRoomPt(r); u.st = 'home'; if (!route(u, p.x, p.y)) { deliver(u, leaf); u.st = 'idle'; } return; }
    if (moveAlong(u, dt)) { deliver(u, leaf); u.st = 'idle'; u.wait = .3; } return;
  }
  if (hazardOn() && !(S.res.food < 6 && !leaf)) { shelter(u, dt); return; }
  if (u.st === 'shelter') u.st = 'idle';
  if (u.st === 'go') { const it = S.items.find(i => i.id === u.tgt); if (!it || it.amt < 1) { u.st = 'idle'; return; } if (moveAlong(u, dt)) { u.st = 'take'; u.wait = leaf ? 1.6 : 1; } return; }
  if (u.st === 'take') { const it = S.items.find(i => i.id === u.tgt); u.st = 'idle';
    if (it && it.amt >= 1) { const a = Math.min(leaf ? 1 : 3, Math.floor(it.amt)); it.amt -= a; u.carry = a; u.cs = it.sub; if (!leaf && it.amt < 1) { S.items.splice(S.items.indexOf(it), 1); if (S.forage === it.id) S.forage = null; } } return; }
  if (u.st === 'explore' || u.st === 'wander') { if (moveAlong(u, dt)) { u.st = 'idle'; u.wait = .5 + rnd(); } return; }
  const it = pickItem(leaf);
  if (it) { u.tgt = it.id; u.st = 'go'; if (!route(u, it.x + (rnd() - .5) * 14, u.lane)) u.st = 'idle'; return; }
  if (!leaf) { // explore toward the nearest fog
    let L = ENT, R = ENT; while (L > 0 && S.fog[L]) L--; while (R < COLS - 1 && S.fog[R]) R++;
    const goR = (!S.fog[R] && (R - ENT <= ENT - L || S.fog[L])) ? true : S.fog[L] ? true : rnd() < .5;
    const col = goR ? Math.min(COLS - 6, R + 2) : Math.max(1, L - 2);
    if ((goR && S.fog[R]) && S.fog[L]) { u.st = 'wander'; route(u, ENTX + (rnd() - .5) * 300, u.lane); return; }
    u.st = 'explore'; route(u, (col + .5) * CS, u.lane); return; }
  u.st = 'wander'; route(u, ENTX + (rnd() - .5) * 120, u.lane); u.wait = 1.5;
}
function findDig(u) {
  const from = isUnder(u.y) ? cellOf(u.x, u.y) : ENTI; let plan = -1;
  const g = bfs(walk(from) ? from : nearestWalk(from), c => { const x = cx(c), y = cy(c);
    for (const n of [x > 0 ? c - 1 : -1, x < COLS - 1 ? c + 1 : -1, y > 0 ? c - COLS : -1, y < ROWS - 1 ? c + COLS : -1])
      if (n >= 0 && S.grid[n] === PLAN && !claimSet.has(n) && wl[n] < .5) { plan = n; return true; } return false; });
  return g < 0 ? null : { stand: g, plan };
}
function canHelp(u) { const ws = units('worker'); return ws.length >= 2 && ws[0] !== u && S.res.food < foodCap() * .92 && !hazardOn(); }
function thinkWorker(u, dt) {
  const e = D().qSafe ? null : enemyNear(u, 14); if (e) { hit(u, e, dt); return; }
  if (u.help) {   // idle worker lending a hand with food; goes back to digging when there is work
    if (!u.carry) { u.hl = (u.hl || 0) - dt; if (u.hl <= 0) { u.hl = 1; if (findDig(u) || !canHelp(u)) { u.help = 0; u.st = 'idle'; u.path = []; u.idle0 = 0; } } }
    if (u.help) { thinkForager(u, dt, false); return; }
  }
  if (u.wait > 0) { u.wait -= dt; return; }
  if (u.job >= 0) {
    if (S.grid[u.job] !== PLAN) { u.job = -1; u.st = 'idle'; return; }
    if (u.st === 'walk') { if (moveAlong(u, dt)) u.st = 'dig'; return; }
    if (wl[u.job] > .5) { u.job = -1; u.st = 'idle'; u.wait = 1; return; }
    const tx = (cx(u.job) + .5) * CS, ty = (cy(u.job) + .5) * CS; u.ang = Math.atan2(ty - u.y, tx - u.x); u.ph += dt * 7; u.dig = 1;
    S.digp[u.job] += dt / digTime(u.job);
    if (rnd() < dt * 5) parts.push({ x: (u.x + tx) / 2, y: (u.y + ty) / 2, vx: (rnd() - .5) * 50, vy: -rnd() * 40, t: .5, c: B().soil[layer(cy(u.job))], r: 1 + rnd() });
    if (S.digp[u.job] >= 1) { claimSet.delete(u.job); completeDig(u.job); u.job = -1; u.st = 'idle'; }
    return;
  }
  if (hazardOn() && !isUnder(u.y)) { shelter(u, dt); return; }
  if (u.st === 'wander') { if (moveAlong(u, dt)) { u.st = 'idle'; u.wait = 1 + rnd() * 2; } return; }
  u.look = (u.look || 0) - dt; if (u.look > 0) return; u.look = .4 + rnd() * .3;
  const j = findDig(u);
  if (j) { u.idle0 = 0; u.job = j.plan; claimSet.add(j.plan); const p = pt(j.stand, 4), q = pt(j.plan, 0); p.x += (q.x - p.x) * .3; p.y += (q.y - p.y) * .3; u.st = route(u, p.x, p.y) ? 'walk' : 'idle'; if (u.st === 'idle') { claimSet.delete(u.job); u.job = -1; } return; }
  if (!u.idle0) u.idle0 = S.t; if (S.t - u.idle0 > 12 && canHelp(u)) { u.help = 1; u.idle0 = 0; u.st = 'idle'; u.path = []; return; }
  // idle: wander between rooms
  const rs = doneRooms(); const r = rs[Math.floor(rnd() * rs.length)]; const p = rndRoomPt(r); if (route(u, p.x, p.y)) u.st = 'wander'; u.wait = .5 + rnd() * 2;
}
function guardPost(u) { const n = units('soldier').indexOf(u); return { x: ENTX + ((n % 2) ? 1 : -1) * (26 + (n >> 1) % 6 * 12), y: -4 - (n % 3) * 3 }; }
function thinkSoldier(u, dt) {
  if (u.train > 0) { u.train -= dt; if (u.path.length) moveAlong(u, dt); if (u.train <= 0) { u.train = 0; say(`${UT[u.k].icon} A ${UT[u.k].name.toLowerCase()} is trained!`, 'good'); } return; }
  if (u.mode === 'guard') {
    const e = enemyNear(u, 1e9, e => (isUnder(e.y) || Math.abs(e.x - ENTX) < 260) && e.k !== 'guard'); if (e) { engage(u, e, dt); return; }
    if (hazardOn()) { shelter(u, dt); return; }
    const p = guardPost(u); if (Math.abs(u.x - p.x) + Math.abs(u.y - p.y) > 6) { if (!u.path.length) route(u, p.x, p.y); moveAlong(u, dt); } return;
  }
  const e = enemyNear(u, 110); if (e) { engage(u, e, dt); return; }
  if (u.mode === 'attack') {
    if (S.hill.dead) { u.mode = 'guard'; return; }
    const hx = S.hill.x - 18 + (u.id % 5) * 8;
    if (Math.abs(u.x - S.hill.x) < 34 && !isUnder(u.y)) { S.hill.hp -= 2.5 * dt; u.atk = .25; u.ang = 0; if (rnd() < dt * 3) parts.push({ x: S.hill.x + (rnd() - .5) * 30, y: -10 - rnd() * 14, vx: (rnd() - .5) * 50, vy: -30 - rnd() * 30, t: .6, c: '#7a4a2a', r: 2 }); return; }
    if (!u.path.length) route(u, hx, -3 - (u.id % 3) * 3); moveAlong(u, dt); return;
  }
  if (u.path.length) moveAlong(u, dt);
}
function thinkQueen(u, dt) {
  const e = D().qSafe ? null : enemyNear(u, 15); if (e) { hit(u, e, dt); return; }
  if (u.path.length) { moveAlong(u, dt); return; }
  u.wait -= dt; if (u.wait <= 0) { u.wait = 4 + rnd() * 5; const r = S.rooms.find(r => r.k === 'queen' && r.done) || homeRoom(); const p = rndRoomPt(r); route(u, p.x, p.y); }
}
function raidTarget() {
  const st = S.rooms.filter(r => r.done && ROOMS[r.k].cap);
  if (S.res.food >= 1 && st.length) return rndRoomPt(st[Math.floor(rnd() * st.length)]);
  const q = queen(); return q && !D().qSafe ? { x: q.x, y: q.y } : rndRoomPt(st.length ? st[0] : homeRoom());
}
function thinkRaider(u, dt) {
  const e = enemyNear(u, 15, D().qSafe ? (x => x.k === 'soldier' || x.id === u.lastBy) : null); if (e) { hit(u, e, dt); return; }
  if (u.st === 'in') {
    const s = enemyNear(u, 70, e => e.k === 'soldier'); if (s) { engage(u, s, dt); return; }
    u.rt -= dt; if (!u.path.length && u.rt <= 0) { const p = raidTarget(); route(u, p.x, p.y); u.rt = 1.5; u.arr = 0; }
    if (u.path.length && moveAlong(u, dt)) {
      if (S.res.food >= 1) { const a = Math.min(4, Math.floor(S.res.food)); S.res.food -= a; u.carry = a; S.raid.lost += a; S.st.stolen += a; u.st = 'out'; u.path = []; say('😠 Raiders are stealing food!', 'bad'); }
      else if (++u.arr > 3) { u.st = 'out'; u.path = []; } }
    return;
  }
  if (!u.path.length) route(u, u.home, -4);
  if (moveAlong(u, dt) && !isUnder(u.y)) { u.gone = true; }
}
function thinkGuard(u, dt) {
  const e = enemyNear(u, 1e9, e => Math.abs(e.x - S.hill.x) < 120 && !isUnder(e.y)); if (e) { engage(u, e, dt); return; }
  if (u.path.length) { moveAlong(u, dt); return; }
  u.wait -= dt; if (u.wait <= 0) { u.wait = 2 + rnd() * 3; route(u, S.hill.x + (rnd() - .5) * 70, u.lane); }
}

// ---------------- events ----------------
let inc = new Array(12).fill(0), incT = 0;
function incomeAdd(v) { inc[inc.length - 1] += v; }
function incomePerMin() { return inc.reduce((a, b) => a + b, 0); }  // last 60s
function netPerMin() { return incomePerMin() - upkeep() * 60; }
function eventsTick(dt) {
  const bio = B(), dif = D(), R = S.rain, H = S.haz, W = S.raid;
  // rain / flood
  if (!R.on && !R.warned && S.t > R.next - 15) { R.warned = true; say(`${bio.rain.icon} ${bio.rain.name} is coming! Deep tunnels will flood.`, 'warn'); }
  if (!R.on && S.t >= R.next) { R.on = true; R.t = bio.rain.dur; R.n++; R.rate = bio.rain.vol * dif.rainMul * (1 + Math.min(1, R.n * .08)) / bio.rain.dur; S.st.floods++; }
  if (R.on) { S.water += R.rate * dt; R.t -= dt; if (R.t <= 0) { R.on = false; R.warned = false; R.next = S.t + bio.rain.every * (.8 + rnd() * .4); } }
  // hazard
  if (bio.hazard) {
    if (!H.on && !H.warned && S.t > H.next - 14) { H.warned = true; say(`${bio.hazard.icon} ${bio.hazard.name} in 14s! Ants will hide underground.`, 'warn'); }
    if (!H.on && S.t >= H.next) { H.on = true; H.t = bio.hazard.dur; H.n++; }
    if (H.on) { H.t -= dt; for (const u of S.units) if (!u.yd && !isUnder(u.y) && u.k !== 'guard') u.hp -= (bio.hazard.kind === 'cold' ? .45 : .6) * dt;
      if (H.t <= 0) { H.on = false; H.warned = false; H.next = S.t + bio.hazard.every * (.8 + rnd() * .4); if (W.next - S.t < 25) W.next = S.t + 25; } }
  }
  // raids
  const lead = has('lookout') ? 45 : 12;
  if (!W.active && !W.warned && S.t > W.next - lead) { W.warned = true; say(has('lookout') ? '🔭 Lookout: enemy raid in 45s!' : '⚔️ You hear marching… a raid is coming!', 'warn'); }
  if (!W.active && S.t >= W.next && !H.on && S.yard && S.yard.foes.some(f => f.raid)) W.next = S.t + 45;   // don't stack with a Surface raid
  if (!W.active && S.t >= W.next && !H.on) {
    W.active = true; W.lost = 0; W.kills = 0; const n = dif.raidBase + Math.floor(W.n * dif.raidGrow) + (S.endless ? 2 : 0);
    const hx = !S.hill.dead ? S.hill.x : (W.n % 2 ? CS * 1.5 : WW - CS * 1.5);
    for (let i = 0; i < n; i++) { const u = addU('raider', hx + (i - n / 2) * 10, -4 - rnd() * 8); u.st = 'in'; u.home = hx; u.wait = i * .4; u.rt = i * .35; }
    W.n++; say(`⚔️ Raid! ${n} enemy ants attack!`, 'bad');
  }
  if (W.active && !S.units.some(u => u.k === 'raider')) {
    W.active = false; W.warned = false; S.st.raids++; W.next = S.t + (S.endless ? 150 : dif.raidEvery) * (.9 + rnd() * .2);
    say(`🎉 Raid repelled! ${W.kills} raiders defeated${W.lost ? `, ${W.lost} food stolen` : ''}.`, 'good');
  }
}
function itemsTick(dt) {
  S.itT = (S.itT || 0) + dt; const bio = B();
  if (S.itT > bio.foodEvery) { S.itT = 0; const nf = S.items.filter(i => i.k === 'food').length;
    if (nf < 9) { let c = 0; for (let k = 0; k < 20; k++) { c = 2 + Math.floor(rnd() * (COLS - 4)); if (Math.abs(c - ENT) > 3 && Math.abs(c * CS - S.hill.x) > 70 && !S.items.some(i => Math.abs(i.x - (c + .5) * CS) < 30)) break; }
      const a = 18 + Math.floor(rnd() * 28); S.items.push({ id: S.nid++, k: 'food', sub: bio.foods[Math.floor(rnd() * bio.foods.length)], x: (c + .5) * CS, amt: a, max: a, rg: 0 }); } }
  for (const it of S.items) if (it.k === 'plant' && it.amt < it.max) { it.rg += dt; if (it.rg > 10) { it.rg = 0; it.amt++; } }
}
function colonyTick(dt) {
  const dif = D(); const q = queen();
  // eating
  const e = upkeep() * dt; if (S.res.food >= e) { S.res.food -= e; S.st.eaten += e; } else { S.st.eaten += S.res.food; S.res.food = 0; }
  if (S.res.food <= 0) { for (const u of S.units) if (u.tm === 0 && !(u.k === 'harvester' || u.help || u.yd)) u.hp -= dif.starve * (u.k === 'queen' ? .35 : 1) * dt; if (!S.flags.starveSaid || S.t - S.flags.starveSaid > 20) { S.flags.starveSaid = S.t; say('🍯 Out of food! Ants are starving — send harvesters!', 'bad'); } }
  if (q && q.hp > 0 && S.res.food > 0 && q.hp < q.max) q.hp = Math.min(q.max, q.hp + (dif.qRegen || 0) * dt);
  // queen lays eggs
  if (q) { const qr = S.rooms.find(r => r.k === 'queen' && r.done && !r.fl);
    S.qT -= dt * (qr ? 2 : 1) * ((S.haz.on && B().hazard.kind === 'cold') ? .6 : 1);
    if (S.qT <= 0) { S.qT = 16;
      if (S.res.food >= EGG_FOOD + 6 && canLay().ok) layEgg(); else S.qT = 3; } }
  // eggs hatch
  const nurse = S.rooms.some(r => r.k === 'nursery' && r.done && !r.fl), cold = S.haz.on && B().hazard && B().hazard.kind === 'cold';
  const need = nurse ? 24 : 40;
  for (let k = S.eggs.length - 1; k >= 0; k--) { const g = S.eggs[k], r = roomById(g.rid) || homeRoom();
    if (r.fl) { g.wet += dt; if (g.wet > 6) { S.eggs.splice(k, 1); say('🥚 Eggs drowned in a flooded room!', 'bad'); continue; } } else g.wet = Math.max(0, g.wet - dt);
    g.t += dt * (cold && !nurse ? .5 : 1);
    if (g.t >= need) { S.eggs.splice(k, 1); const p = rndRoomPt(r); const u = addU(g.as === 'harvester' ? 'harvester' : 'worker', p.x, p.y); u.wait = 1; S.st.hatched++; events.push({ hatch: u.id }); } }
  // gardens: leaves -> food
  for (const r of S.rooms) if (r.k === 'garden' && r.done && !r.fl) { r.gt = (r.gt || 0) + dt; if (r.gt >= 5) { r.gt = 0; if (S.res.leaves >= 1 && S.res.food < foodCap()) { S.res.leaves -= 1; const before = S.res.food; S.res.food = Math.min(foodCap(), S.res.food + 3); S.st.gathered += S.res.food - before; incomeAdd(S.res.food - before); r.grow = Math.min(1, (r.grow || 0) + .08); } } }
  // flooded storage spoils food
  for (const r of S.rooms) if (r.fl && ROOMS[r.k].cap && r.done) S.res.food = Math.max(0, S.res.food - .3 * dt);
  S.res.food = Math.min(S.res.food, foodCap());
  // enemy hill guards
  const h = S.hill; if (!h.dead) { h.spawnT += dt; if (h.spawnT > 25) { h.spawnT = 0; if (count('guard') < dif.guards + 1) addU('guard', h.x, -6); }
    if (h.hp <= 0) { h.dead = true; h.hp = 0; for (const u of units('guard')) u.hp = 0; S.won = true; events.push({ victory: 1 }); } }
}
let goalT = 0;
const GOALS = [
  ['send', 'Send harvesters to food', () => S.flags.sent],
  ['food20', 'Collect 20 food', () => S.st.gathered >= 20],
  ['dig', 'Dig a tunnel (5 cells)', () => S.st.dug >= 5],
  ['storage', 'Build a Food Storage', () => has('storage') || has('pantry')],
  ['den', 'Build a Sleeping Den', () => has('den')],
  ['hatch5', 'Hatch 5 ants', () => S.st.hatched >= 5],
  ['queen', 'Build the Queen Chamber', () => has('queen')],
  ['barracks', 'Build a Barracks', () => has('barracks')],
  ['soldier', 'Train a soldier', () => S.flags.soldier],
  ['garden', 'Build a Fungus Garden', () => has('garden')],
  ['cutter', 'Train a leaf-cutter', () => S.flags.cutter],
  ['leaves', 'Deliver 5 leaves', () => S.st.leaves >= 5],
  ['nursery', 'Build a Nursery', () => has('nursery')],
  ['raid', 'Survive a raid', () => S.st.raids >= 1],
  ['yard', 'Send ants out on the Surface map', () => S.flags.yard],
  ['bug', 'Defeat a big bug', () => (S.st.bugs || 0) >= 1],
  ['outpost', 'Capture a rival ant hill', () => (S.st.captured || 0) >= 1],
  ['hill', 'Destroy the enemy ant hill', () => S.hill.dead],
];
function goalsTick() { for (const [id, name, f] of GOALS) if (!S.goals[id] && f()) { S.goals[id] = S.t; if (id !== 'hill') S.res.food = Math.min(foodCap(), S.res.food + GOAL_REWARD); say(`🎯 Goal done: ${name}${id !== 'hill' ? ` (+${GOAL_REWARD} 🍯)` : ''}`, 'goal'); } }

function step(dt) {
  if (!S || S.over) return;
  S.t += dt;
  if (S.tut < 6 && S.t < 360) { S.rain.next += dt; S.raid.next += dt; S.haz.next += dt; }   // calm while learning
  eventsTick(dt);
  S.wT = (S.wT || 0) - dt;
  if (S.water > 0) { const sumps = S.rooms.filter(r => r.k === 'sump' && r.done && roomCells(r).some(i => wl[i] > .05)).length; S.water = Math.max(0, S.water - (.05 + .0025 * dugCount + .4 * sumps) * dt); }
  if (S.wT <= 0 || nestDirty) { S.wT = .25; computeWater(); for (const r of S.rooms) { const f = roomFlooded(r); if (f && !r.fl && r.done) say(`💧 ${ROOMS[r.k].name} is flooded!`, 'bad'); r.fl = f; } }
  colonyTick(dt); itemsTick(dt);
  claimSet = new Set(); for (const u of S.units) if (u.job >= 0) claimSet.add(u.job);
  for (const u of S.units) {
    if (u.yd) continue;
    u.mv = 0; u.dig = 0; if (u.atk > 0) u.atk -= dt;
    switch (u.k) { case 'worker': thinkWorker(u, dt); break; case 'harvester': thinkForager(u, dt, false); break; case 'cutter': u.train > 0 ? thinkSoldier(u, dt) : thinkForager(u, dt, true); break;
      case 'soldier': thinkSoldier(u, dt); break; case 'queen': thinkQueen(u, dt); break; case 'raider': thinkRaider(u, dt); break; case 'guard': thinkGuard(u, dt); break; }
    if (isUnder(u.y)) { const c = cellOf(u.x, u.y); if (wl[c] > .6) u.hp -= .35 * dt; }
    if (u.tm === 0 && !isUnder(u.y)) { const c = Math.floor(u.x / CS); for (let x = c - 4; x <= c + 4; x++) if (x >= 0 && x < COLS) S.fog[x] = 1; }
  }
  if (S.yard) yardTick(dt);
  for (let k = S.units.length - 1; k >= 0; k--) { const u = S.units[k];
    if (u.hp <= 0 || u.gone) { S.units.splice(k, 1);
      if (u.hp <= 0) { for (let j = 0; j < 8; j++) (u.yd ? yparts : parts).push({ x: u.x, y: u.y, vx: (rnd() - .5) * 70, vy: -rnd() * 60, t: .8, c: u.tm ? '#3a2a4a' : '#7a3a1a', r: 1.5 });
        if (u.tm === 0) { S.st.lost++; if (u.k === 'queen') { S.over = true; S.why = S.res.food <= 0 ? 'The queen starved.' : 'The queen was defeated.'; events.push({ over: 1 }); } }
        else { S.st.kills++; if (u.k === 'raider') S.raid.kills++; } }
      if (u.job >= 0) claimSet.delete(u.job); } }
  if (S.forage && !S.items.some(i => i.id === S.forage)) S.forage = null;
  incT += dt; if (incT >= 5) { incT = 0; inc.shift(); inc.push(0); }
  goalT -= dt; if (goalT <= 0) { goalT = .5; goalsTick(); }
  S.st.peak = Math.max(S.st.peak, adults());
  for (let k = parts.length - 1; k >= 0; k--) { const p = parts[k]; p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; if (p.t <= 0) parts.splice(k, 1); }
}

// ---------------- save / load ----------------
function serialize() {
  const o = { ...S, grid: Array.from(S.grid), room: Array.from(S.room), digp: Array.from(S.digp, v => Math.round(v * 100) / 100), fog: Array.from(S.fog) };
  o.units = S.units.map(u => ({ ...u, path: [] })); if (S.yard) { o.yard = { ...S.yard }; delete o.yard._obs; } return JSON.stringify(o);
}
function restore(o) {
  if (!o || o.v !== 1 || !BIOMES[o.biome]) return false;
  o.grid = Uint8Array.from(o.grid); o.room = Int16Array.from(o.room); o.digp = Float32Array.from(o.digp); o.fog = Uint8Array.from(o.fog);
  for (const u of o.units) { u.path = []; if (u.k === 'worker') { u.job = -1; u.st = 'idle'; } if (u.st === 'go' || u.st === 'home' || u.st === 'take') u.st = 'idle'; if (u.k === 'soldier' && u.mode === 'move') u.mode = 'guard'; }
  if (!o.yard) o.yard = newYard(o.seed, o.diff); delete o.yard._obs;
  S = o; nestDirty = true; computeWater(); return true;
}
let memSave = null;
function save() { if (!S || S.over) return; const s = serialize(); memSave = s; try { localStorage.setItem(SAVE_KEY, s); } catch (e) {} }
function loadSaved() { let s = memSave; try { s = localStorage.getItem(SAVE_KEY) || s; } catch (e) {} if (!s) return null; try { return JSON.parse(s); } catch (e) { return null; } }
function clearSave() { memSave = null; try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
