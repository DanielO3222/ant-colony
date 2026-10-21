'use strict';
// ================= Ant Haven — UI, input, loop =================
const $ = id => document.getElementById(id);
const UI = { view: 'nest', ymode: null, ysel: [], mode: null, room: null, sel: [], ghost: null, dpath: [], tab: null, sheet: null, selRoom: null, speed: 1, paused: false, running: false, marker: null };
let menuDiff = 'easy', menuBiome = 'backyard';
const HOLD_MS = 350;
const fmt = n => Math.floor(n).toString();
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function toast(msg, kind) { for (const e of $('toasts').children) if (e.textContent === msg) return; const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = msg; const box = $('toasts'); box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), kind === 'bad' || kind === 'warn' ? 4200 : 3000); }

// ---------- tutorial ----------
const TUT = [
  { t: 'Your ants are hungry! Tap the glowing <b>crumbs ✨</b> on the grass to send your harvesters.', hi: null, ok: () => S.flags.sent },
  { t: 'More harvesters = more food. Open <b>🐜 Colony</b> and tap <b>＋</b> next to Harvesters.', hi: 'tab-colony', ok: () => count('harvester') >= 3 },
  { t: 'Time to dig! Tap <b>⛏ Dig</b>, then drag your finger from the tunnel into the dirt. Each cell costs 1 🍯.', hi: 'tab-dig', ok: () => S.st.planned >= 4 },
  { t: 'Rooms go next to tunnels. Tap <b>🏠 Rooms → Food Storage</b>, then tap beside your tunnel.', hi: 'tab-rooms', ok: () => roomsOf('storage').length > 0 },
  { t: 'Add a <b>🛏️ Sleeping Den</b> so your colony can grow past 14 ants. Workers dig rooms out for you.', hi: 'tab-rooms', ok: () => roomsOf('den').length > 0 },
  { t: 'There\'s a big yard outside! Tap <b>🗺️ Surface</b>, then <b>🌾 Send</b> and tap food. Tap <b>🕳️ Nest</b> to come back.', hi: 'vt-yard', ok: () => S.flags.yard },
  { t: 'You\'ve got it! Keep food above zero, follow <b>🎯 Goals</b>, and train soldiers before the first raid. Tap ✓.', hi: null, ok: () => false, done: true },
];
function tutTick() {
  const el = $('coach'); if (!UI.running || S.tut >= TUT.length) { el.classList.add('hidden'); hiOff(); return; }
  while (S.tut < TUT.length && TUT[S.tut].ok()) S.tut++;
  if (S.tut >= TUT.length) { el.classList.add('hidden'); hiOff(); return; }
  const st = TUT[S.tut]; el.classList.remove('hidden');
  if ($('coach-t').dataset.k !== String(S.tut)) { $('coach-t').innerHTML = `<span class="step">${S.tut + 1}/${TUT.length}</span> ` + st.t; $('coach-t').dataset.k = S.tut; $('coach-ok').classList.toggle('hidden', !st.done); }
  hiOff(); if (st.hi && UI.tab !== st.hi.slice(4)) $(st.hi).classList.add('hl');
  if (S.tut === 1 && UI.tab === 'colony') document.querySelector('[data-a="+harvester"]')?.classList.add('hl');
  if (S.tut >= 3 && S.tut <= 4 && UI.tab === 'rooms') document.querySelector(`[data-room="${S.tut === 3 ? 'storage' : 'den'}"]`)?.classList.add('hl');
}
function hiOff() { document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl')); }
function endTut() { S.tut = TUT.length; try { localStorage.setItem(TUT_KEY, '1'); } catch (e) {} tutTick(); }
$('coach-x').onclick = endTut; $('coach-ok').onclick = endTut;

// ---------- HUD ----------
function layReason() {
  const v = canLay(); if (!v.ok) return v.why;
  if (S.res.food < EGG_FOOD + 6) return 'Saving food — lays on her own at 10+ food';
  return `Laying (next egg ${Math.ceil(Math.max(0, S.qT) / (has('queen') ? 2 : 1))}s)`;
}
const FIX_TXT = { den: '🛏️ Build Den', eggs: '🥚 Build Egg Room', harvester: '🌾 ＋ Harvester' };
function doFix(f) { if (f === 'harvester') { const r = assign('harvester', 1); toast(r.ok ? '🌾 +1 Harvester' : r.why, r.ok ? '' : 'bad'); return; }
  closeSheet(); UI.tab = 'rooms'; setMode('room', f); flyTo(ENTX, 160); }
function alertText() {
  const f = S.res.food, net = netPerMin(), R = S.raid, bio = B();
  if (f <= 0) return { k: 'bad', t: '🍯 Starving! Ants lose health until you get food.', btn: true };
  if (f < 15 || (net < 0 && f / -net < 1.5)) return { k: 'bad', t: `⚠️ Food low: ${fmt(f)} left (${net >= 0 ? '+' : ''}${Math.round(net)}/min)`, btn: true };
  if (R.active) return { k: 'bad', t: `⚔️ Raid! ${count('raider')} raiders — ${count('soldier')} soldiers defending` };
  if (R.warned) return { k: 'warn', t: `⚔️ Raid in ${mmss(R.next - S.t)} — get soldiers ready!` };
  if (S.haz.on) return { k: 'warn', t: `${bio.hazard.icon} ${bio.hazard.name}! Ants hide underground (${mmss(S.haz.t)})` };
  if (S.haz.warned) return { k: 'warn', t: `${bio.hazard.icon} ${bio.hazard.name} in ${mmss(S.haz.next - S.t)}` };
  if (S.rain.on) return { k: 'warn', t: `${bio.rain.icon} ${bio.rain.name}! Water pools in the deepest tunnels` };
  if (S.rain.warned) return { k: 'warn', t: `${bio.rain.icon} ${bio.rain.name} in ${mmss(S.rain.next - S.t)} — keep key rooms high` };
  if (S.water > .5) return { k: 'info', t: `💧 Draining flood water… (${S.water.toFixed(1)} cells)` };
  const v = canLay(); if (!v.ok && v.fix && v.fix !== 'harvester' && S.t > 20) return { k: 'info', t: `👑 Queen can't lay: ${v.why.split(' — ')[0]}`, fix: v.fix };
  return null;
}
let hudT = 0;
function hud() {
  const cap = foodCap(), f = S.res.food;
  $('v-food').textContent = fmt(f); $('c-food').textContent = '/' + cap; $('m-food').style.width = clamp(f / cap * 100, 0, 100) + '%';
  $('r-food').classList.toggle('low', f < 15);
  $('v-leaf').textContent = fmt(S.res.leaves);
  $('v-egg').textContent = S.eggs.length; $('c-egg').textContent = '/' + eggCap();
  $('v-ant').textContent = adults(); $('c-ant').textContent = '/' + popCap();
  $('roles').innerHTML = ROLES.map(k => `<span>${UT[k].icon}<b>${count(k)}</b> ${UT[k].name}s</span>`).join('');
  const done = GOALS.filter(g => S.goals[g[0]]).length; $('btn-goals').textContent = `🎯 ${done}/${GOALS.length}`;
  const R = S.raid; $('status').textContent = S.hill.dead && !S.endless ? '🏳️ Hill conquered' : R.active ? '⚔️ Raid!' : S.t > R.next - (has('lookout') ? 45 : 12) || has('lookout') ? `⚔️ Raid ${mmss(R.next - S.t)}` : `☀️ Day ${1 + Math.floor(S.t / 120)} · ${mmss(S.t)}`;
  const a = alertText(), al = $('alert');
  if (a) { al.className = 'show ' + a.k; $('alert-t').textContent = a.t; const fx = a.btn ? 'harvester' : a.fix; $('alert-b').classList.toggle('hidden', !fx); $('alert-b').dataset.fix = fx || ''; $('alert-b').textContent = FIX_TXT[fx] || ''; } else al.className = '';
  const ns = count('soldier'); $('btn-army').classList.toggle('hidden', ns === 0); $('army-n').textContent = ns; $('btn-army').classList.toggle('sel', UI.sel.length > 0);
  $('btn-view').textContent = cam.y > 60 ? '⬆ Surface' : '⬇ Nest';
  if (UI.tab === 'colony' && !UI.selRoom) renderColony(); else if (UI.selRoom) renderRoomInfo(); else if (UI.tab === 'rooms' && UI.mode !== 'room' && !$('sheet').classList.contains('hidden')) renderRooms(true);
  updateMode(); yardHud();
}
$('alert-b').onclick = () => { doFix($('alert-b').dataset.fix || 'harvester'); hud(); };

// ---------- sheets ----------
function openTab(k) {
  if (UI.tab === k && (k === 'rooms' || k === 'colony')) { closeSheet(); return; }
  if (UI.mode && (k === 'dig' || k === 'fill') && UI.mode === k) { setMode(null); return; }
  setMode(null); UI.selRoom = null; UI.tab = k;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === k));
  if (k === 'dig' || k === 'fill') { $('sheet').classList.add('hidden'); setMode(k); if (k === 'dig' && cam.y < 30) flyTo(cam.x, 140); }
  else if (k === 'rooms') renderRooms(); else if (k === 'colony') renderColony();
  requestAnimationFrame(measureHud);
}
function closeSheet() { UI.tab = null; UI.selRoom = null; $('sheet').classList.add('hidden'); document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on')); requestAnimationFrame(measureHud); }
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => openTab(b.dataset.tab));
function costTxt(c) { return Object.entries(c).map(([k, v]) => `${v} ${k === 'food' ? '🍯' : '🍃'}`).join(' + ') || 'free'; }
function renderRooms(soft) {
  const el = $('sheet'); el.classList.remove('hidden');
  const html = `<div class="sh-h"><b>🏠 Rooms</b><span>Pick one, then tap next to a tunnel</span><button class="x" data-a="close">✕</button></div><div class="cards">` + ROOM_ORDER.map(k => { const d = ROOMS[k], built = d.once && roomsOf(k).length, poor = Object.entries(d.cost).some(([r, v]) => (S.res[r] || 0) < v);
    return `<button class="rcard ${built ? 'built' : poor ? 'poor' : ''}" data-room="${k}"><i>${d.icon}</i><b>${d.name}</b><small>${d.desc}</small><em>${built ? '✓ Built' : costTxt(d.cost)}</em></button>`; }).join('') + '</div>';
  if (soft && el.dataset.h === html) return; el.dataset.h = html; el.innerHTML = html;
}
function renderColony() {
  const el = $('sheet'); el.classList.remove('hidden'); const net = netPerMin();
  const desc = { worker: 'Dig tunnels and build rooms · idle ones help gather food', harvester: 'Bring food from the surface', cutter: 'Carry leaves to the Fungus Garden', soldier: 'Guard the nest, attack the enemy hill' };
  const lay = canLay();
  const rows = ROLES.map(k => { const tr = TRAIN[k], v = k === 'worker' ? lay : canTrain(k);
    const plus = k === 'worker' ? `<button class="pm plus ${v.ok ? '' : 'off'}" data-a="lay:worker">＋<small>🥚${EGG_FOOD}🍯</small></button>` : `<button class="pm plus ${v.ok ? '' : 'off'}" data-a="+${k}">＋${tr ? `<small>${tr.food}🍯</small>` : ''}</button>`;
    const minus = k === 'worker' ? '' : `<button class="pm" data-a="-${k}">−</button>`;
    return `<div class="role"><i>${UT[k].icon}</i><div class="rn"><b>${UT[k].name}s <span class="cnt">${count(k)}</span></b><small>${!v.ok && v.why && k !== 'worker' && k !== 'harvester' ? '🔒 ' + v.why : k === 'worker' ? 'Dig tunnels and build rooms · ＋ lays a worker egg' : desc[k]}</small></div>${minus}${plus}</div>`; }).join('');
  const q = queen();
  const html = `<div class="sh-h"><b>🐜 Colony</b><span>${adults()}/${popCap()} ants · ${S.eggs.length} eggs</span><button class="x" data-a="close">✕</button></div>
    <div class="brood ${lay.ok ? '' : 'blocked'}"><div class="bh">👑 <b>Queen</b> ${q ? `❤️ ${Math.ceil(q.hp)}/${q.max}` : '—'} · 🥚 ${S.eggs.length}/${eggCap()} eggs${S.eggs.length ? ` · next hatch ${Math.ceil(Math.max(0, (has('nursery') ? 24 : 40) - Math.max(...S.eggs.map(e => e.t))))}s` : ''}</div>
      <div class="bw">${lay.ok ? '✅ ' + layReason() : '⛔ ' + lay.why}</div>
      <div class="bb"><button class="sm ${lay.ok ? 'green' : 'off'}" data-a="lay">🥚 Lay egg now · ${EGG_FOOD}🍯</button>${!lay.ok && lay.fix ? `<button class="sm green" data-a="fix:${lay.fix}">${FIX_TXT[lay.fix]}</button>` : ''}</div>
      <div class="bh2">New ants hatch as: <button class="seg ${S.hatchAs === 'worker' ? 'on' : ''}" data-a="as:worker">⛏ Worker</button><button class="seg ${S.hatchAs === 'harvester' ? 'on' : ''}" data-a="as:harvester">🌾 Harvester</button></div></div>
    <div class="qrow">🍯 Food: <b class="${net < 0 ? 'neg' : 'pos'}">${net >= 0 ? '+' : ''}${Math.round(net)}/min</b> <small>(gathering ${Math.round(incomePerMin())}, eating ${Math.round(upkeep() * 60)})</small></div>
    ${rows}<p class="tip">Worker ＋ lays an egg. Other ＋ buttons turn a spare worker into that role.</p>`;
  if (el.dataset.h === html) return; el.dataset.h = html; el.innerHTML = html;
}
function renderRoomInfo() {
  const r = roomById(UI.selRoom); if (!r) { closeSheet(); return; } const d = ROOMS[r.k], el = $('sheet'); el.classList.remove('hidden');
  const cells = roomCells(r), dn = cells.filter(i => S.grid[i] === DUG).length; let info = d.desc;
  if (d.cap) info += ` · food ${fmt(S.res.food)}/${foodCap()} total`; if (d.eggs) info += ` · ${S.eggs.filter(e => e.rid === r.id).length}/${d.eggs} eggs`;
  if (r.k === 'garden') info += ` · ${fmt(S.res.leaves)} leaves waiting (1 leaf → 3 🍯)`;
  const html = `<div class="sh-h"><b>${d.icon} ${d.name}</b><span>${r.done ? (r.fl ? '💧 Flooded — not working' : '✓ Working') : `🚧 Digging ${dn}/${cells.length}`}</span><button class="x" data-a="close">✕</button></div>
    <p class="tip">${info}. Depth: ${LAYER_NAMES[layer(r.y)]} (row ${r.y}).</p>${r.k !== 'home' ? `<button class="wide red" data-a="remove:${r.id}">🗑 Remove room (refund half)</button>` : ''}`;
  if (el.dataset.h === html) return; el.dataset.h = html; el.innerHTML = html;
}
$('sheet').addEventListener('click', e => {
  const b = e.target.closest('[data-a],[data-room]'); if (!b) return;
  if (b.dataset.room) { const k = b.dataset.room, d = ROOMS[k]; if (d.once && roomsOf(k).length) { toast(`You already have a ${d.name}`, 'bad'); return; }
    closeSheet(); UI.tab = 'rooms'; setMode('room', k); if (cam.y < 30) flyTo(cam.x, 140); return; }
  const a = b.dataset.a;
  if (a === 'close') closeSheet();
  else if (a === 'lay' || a.startsWith('lay:')) { const r = layEgg(a.slice(4) || null); toast(r.ok ? `🥚 The queen laid an egg (−${EGG_FOOD} 🍯)` : r.why, r.ok ? '' : 'bad'); renderColony(); hud(); }
  else if (a.startsWith('fix:')) doFix(a.slice(4));
  else if (a.startsWith('as:')) { S.hatchAs = a.slice(3); toast(`New ants will hatch as ${S.hatchAs}s`); renderColony(); }
  else if (a[0] === '+' || a[0] === '-') { const k = a.slice(1), r = assign(k, a[0] === '+' ? 1 : -1); if (!r.ok && r.needWorker && a[0] === '+' && k === 'harvester') { const l = layEgg('harvester'); toast(l.ok ? '🥚 No spare worker, so the queen laid a harvester egg' : r.why, l.ok ? '' : 'bad'); } else if (!r.ok) toast(r.why || 'Not possible', 'bad'); else if (a[0] === '+') toast(`${UT[k].icon} ${TRAIN[k] ? 'Training a' : 'New'} ${UT[k].name.toLowerCase()}`); renderColony(); tutTick(); hud(); }
  else if (a.startsWith('remove:')) { const r = roomById(+a.slice(7)); if (r && removeRoom(r)) { toast(`${ROOMS[r.k].name} removed`); closeSheet(); } }
});

// ---------- modes ----------
function setMode(m, k) {
  UI.mode = m; UI.room = k || null; UI.ghost = null; UI.dpath = [];
  if (m) UI.sel = [];
  if (!m && (UI.tab === 'dig' || UI.tab === 'fill' || UI.tab === 'rooms')) { if (UI.tab !== 'rooms' || $('sheet').classList.contains('hidden')) { UI.tab = null; document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on')); } }
  if (m === 'room') document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'rooms'));
  updateMode(); requestAnimationFrame(measureHud);
}
function updateMode() {
  if (UI.view === 'yard') { yardMode(); return; }
  const el = $('mode'); let t = '', btn = '', extra = '';
  if (UI.mode === 'dig') { t = '⛏ <b>Dig mode</b> — drag from a tunnel. 1 🍯 per cell. Two fingers move the map.'; btn = '✓ Done'; }
  else if (UI.mode === 'fill') { t = '🧹 <b>Fill mode</b> — tap or drag over planned digs (refund) or tunnels to fill them.'; btn = '✓ Done'; }
  else if (UI.mode === 'room') { const d = ROOMS[UI.room]; t = `${d.icon} <b>Placing ${d.name}</b> (${costTxt(d.cost)}) — tap beside a tunnel.`; btn = '✕ Cancel'; }
  else if (UI.sel.length) { t = `⚔️ <b>${UI.sel.length} soldier${UI.sel.length > 1 ? 's' : ''}</b> — tap ground to move, tap the enemy hill to attack.`; btn = '✕ Deselect'; extra = '<button id="mode-guard" class="sm">🏠 Guard</button>'; }
  if (!t) { if (!el.classList.contains('hidden')) { el.classList.add('hidden'); requestAnimationFrame(measureHud); } return; }
  const html = `<span>${t}</span>${extra}<button id="mode-x" class="sm ${UI.mode === 'room' || UI.sel.length ? 'red' : 'green'}">${btn}</button>`;
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; $('mode-x').onclick = () => { if (UI.sel.length && !UI.mode) UI.sel = []; setMode(null); };
    if ($('mode-guard')) $('mode-guard').onclick = () => { guardSoldiers(UI.sel); toast('🏠 Soldiers return to guard the entrance'); UI.sel = []; updateMode(); }; }
  if (el.classList.contains('hidden')) { el.classList.remove('hidden'); requestAnimationFrame(measureHud); }
}

// ---------- camera helpers ----------
let fly = null;
function flyTo(x, y, z) { fly = { x, y, z: z || cam.z, t: 0, x0: cam.x, y0: cam.y, z0: cam.z }; }
$('btn-view').onclick = () => { if (cam.y > 60) flyTo(cam.x, -70); else flyTo(cam.x, 200); };
$('btn-army').onclick = () => { const s = units('soldier'); if (UI.sel.length === s.length && s.length) UI.sel = []; else { UI.sel = s.map(u => u.id); setMode(null); } updateMode(); hud(); };

// ---------- pointer input ----------
const pointers = new Map(); let gest = null;
const cellAtScreen = (sx, sy) => { const w = s2w(sx, sy); const x = Math.floor(w.x / CS), y = Math.floor(w.y / CS); return x >= 0 && y >= 0 && x < COLS && y < ROWS ? idx(x, y) : -1; };
function ghostAt(sx, sy) { const d = ROOMS[UI.room], w = s2w(sx, sy - 30); return { x: Math.round(w.x / CS - d.w / 2), y: Math.round(w.y / CS - d.h / 2) }; }
function addDigCell(i) { if (i < 0) return; const p = UI.dpath; if (!p.length) { p.push(i); return; } const l = p[p.length - 1]; if (l === i) return; for (const [x, y] of line4(cx(l), cy(l), cx(i), cy(i)).slice(1)) p.push(idx(x, y)); }
cv.addEventListener('pointerdown', e => {
  if (!UI.running || UI.view === 'yard') return; cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); fly = null;
  if (pointers.size === 1) {
    if (UI.mode === 'dig') { gest = { kind: 'dig' }; UI.dpath = []; addDigCell(cellAtScreen(e.clientX, e.clientY)); }
    else if (UI.mode === 'fill') { gest = { kind: 'fill', hit: new Set(), n: 0 }; fillAt(e.clientX, e.clientY, gest); }
    else if (UI.mode === 'room') { gest = { kind: 'place' }; UI.ghost = ghostAt(e.clientX, e.clientY); }
    else { gest = { kind: 'tap', sx: e.clientX, sy: e.clientY, t0: performance.now() }; const g = gest;
      g.timer = setTimeout(() => { if (gest === g && g.kind === 'tap') { g.kind = 'box'; g.ex = g.lx || g.sx; g.ey = g.ly || g.sy; try { navigator.vibrate && navigator.vibrate(15); } catch (er) {} } }, HOLD_MS); }
  } else if (pointers.size === 2) {
    if (gest && gest.timer) clearTimeout(gest.timer); UI.dpath = [];
    const [a, b] = [...pointers.values()]; gest = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: cam.z, w0: s2w((a.x + b.x) / 2, (a.y + b.y) / 2) };
  }
});
cv.addEventListener('pointermove', e => {
  if (!UI.running || UI.view === 'yard' || !pointers.has(e.pointerId)) return;
  const p = pointers.get(e.pointerId), px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY; if (!gest) return;
  if (gest.kind === 'pinch' && pointers.size >= 2) { const [a, b] = [...pointers.values()]; cam.z = gest.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, gest.d0); clampCam();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, cyv = (VIEW.top + H - VIEW.bot) / 2; cam.x = gest.w0.x - (mx - W / 2) / cam.z; cam.y = gest.w0.y - (my - cyv) / cam.z; clampCam(); }
  else if (gest.kind === 'dig') addDigCell(cellAtScreen(e.clientX, e.clientY));
  else if (gest.kind === 'fill') fillAt(e.clientX, e.clientY, gest);
  else if (gest.kind === 'place') UI.ghost = ghostAt(e.clientX, e.clientY);
  else if (gest.kind === 'tap') { gest.lx = e.clientX; gest.ly = e.clientY; if (Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 10) { gest.kind = 'pan'; clearTimeout(gest.timer); } }
  else if (gest.kind === 'box') { gest.ex = e.clientX; gest.ey = e.clientY; }
  if (gest.kind === 'pan' || gest.kind === 'pan2') { cam.x -= (e.clientX - px) / cam.z; cam.y -= (e.clientY - py) / cam.z; clampCam(); }
});
function endPointer(e, cancel) {
  if (!UI.running || UI.view === 'yard' || !pointers.has(e.pointerId)) return; pointers.delete(e.pointerId);
  if (gest && gest.kind === 'pinch') { gest = pointers.size === 1 ? { kind: 'pan2' } : null; return; }
  if (pointers.size) return;
  const g = gest; gest = null; if (g && g.timer) clearTimeout(g.timer); if (!g || cancel) { UI.dpath = []; return; }
  if (g.kind === 'box') boxSelect(g.sx, g.sy, g.ex, g.ey);
  else if (g.kind === 'dig') { const path = UI.dpath; UI.dpath = []; if (path.length < 2 && !(path.length === 1 && S.grid[path[0]] === SOIL)) return; const r = commitDig(path);
    if (r.ok) { toast(`⛏ ${r.cells.length} cell${r.cells.length > 1 ? 's' : ''} planned (−${r.cost} 🍯)`); if (S.res.food < 12) toast('⚠️ Food is getting low — send harvesters!', 'warn'); } else if (r.why) toast(r.why, 'bad'); tutTick(); }
  else if (g.kind === 'fill') { if (g.n) toast(`🧹 Filled ${g.n} cell${g.n > 1 ? 's' : ''}`); }
  else if (g.kind === 'place' && UI.ghost) { const r = placeRoom(UI.room, UI.ghost.x, UI.ghost.y); if (r.ok) { toast(`${ROOMS[UI.room].icon} ${ROOMS[UI.room].name} placed — workers are digging it`); setMode(null); closeSheet(); tutTick(); } else toast(r.why, 'bad'); }
  else if (g.kind === 'tap') handleTap(e.clientX, e.clientY);
}
cv.addEventListener('pointerup', e => endPointer(e, false));
cv.addEventListener('pointercancel', e => endPointer(e, true));
cv.addEventListener('wheel', e => { if (!UI.running || UI.view === 'yard') return; e.preventDefault(); const w0 = s2w(e.clientX, e.clientY); cam.z *= Math.exp(-e.deltaY * .0015); clampCam(); const cyv = (VIEW.top + H - VIEW.bot) / 2; cam.x = w0.x - (e.clientX - W / 2) / cam.z; cam.y = w0.y - (e.clientY - cyv) / cam.z; clampCam(); }, { passive: false });
function fillAt(sx, sy, g) { const i = cellAtScreen(sx, sy); if (i < 0 || g.hit.has(i)) return; g.hit.add(i); const r = fillCell(i); if (r) g.n++; else if (S.room[i] && !g.warned) { g.warned = 1; toast('Rooms: tap the room (outside Fill mode) to remove it', 'bad'); } else if (r === null && cx(i) === ENT && cy(i) <= 4 && !g.warned) { g.warned = 1; toast('The entrance shaft stays open', 'bad'); } }
function boxSelect(x0, y0, x1, y1) {
  const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
  if (r - l < 14 && b - t < 14) { handleTap(x0, y0); return; }
  const got = units('soldier').filter(u => { const p = w2s(u.x, u.y); return p.x >= l && p.x <= r && p.y >= t && p.y <= b; }).map(u => u.id);
  UI.sel = got; if (!got.length) toast(count('soldier') ? 'No soldiers inside the box' : 'Box-select picks soldiers — train some at a 🛡️ Barracks', 'bad'); updateMode(); hud();
}
function handleTap(sx, sy) {
  const w = s2w(sx, sy), col = clamp(Math.floor(w.x / CS), 0, COLS - 1), fogged = !S.fog[col];
  // tap own soldier
  let hitU = null, hd = 16 / Math.min(1, cam.z) ; for (const u of S.units) if (u.tm === 0) { const d = Math.hypot(u.x - w.x, u.y - w.y); if (d < hd) { hd = d; hitU = u; } }
  const nearHill = !S.hill.dead && S.fog[clamp(Math.floor(S.hill.x / CS), 0, COLS - 1)] && Math.abs(w.x - S.hill.x) < 64 && w.y < 4 && w.y > -100;
  if (UI.sel.length) {
    if (hitU && hitU.k === 'soldier' && !UI.sel.includes(hitU.id)) { UI.sel.push(hitU.id); updateMode(); return; }
    if (nearHill) { const n = orderSoldiers(UI.sel, 0, 0, true); toast(`⚔️ ${n} soldier${n > 1 ? 's' : ''} marching on the enemy hill!`); UI.sel = []; updateMode(); return; }
    let gy = w.y; if (isUnder(gy)) { const i = cellAtScreen(sx, sy); if (i < 0 || !walk(i)) { toast("Soldiers can only walk in tunnels", 'bad'); return; } }
    const n = orderSoldiers(UI.sel, w.x, gy, false); if (n) { UI.marker = { x: w.x, y: isUnder(gy) ? gy : -5, t: 1 }; toast(`⚔️ Moving ${n} soldier${n > 1 ? 's' : ''}`); } else toast("They can't get there", 'bad'); return;
  }
  if (hitU && hitU.k === 'soldier') { UI.sel = [hitU.id]; updateMode(); return; }
  if (w.y < 2) {   // surface
    if (fogged) { const h = units('harvester').filter(u => !u.carry)[0]; if (h) { h.st = 'explore'; route(h, w.x, h.lane); toast('🔦 A harvester is scouting there'); } else toast('Unexplored — harvesters reveal the map', 'bad'); return; }
    let best = null, bd = 30; for (const it of S.items) { const d = Math.abs(it.x - w.x) + Math.max(0, Math.abs(w.y + 12) - 22); if (d < bd) { bd = d; best = it; } }
    if (best && best.k === 'food') { S.forage = best.id; S.flags.sent = true; UI.marker = { x: best.x, y: -8, t: 1 };
      toast(count('harvester') ? `🌾 Harvesters heading to the ${best.sub === 'berry' ? 'berries' : best.sub === 'seed' ? 'seeds' : best.sub === 'date' ? 'dates' : 'crumbs'} (${fmt(best.amt)} food)` : '🌾 No harvesters! Open 🐜 Colony and add some', count('harvester') ? '' : 'bad'); tutTick(); return; }
    if (best && best.k === 'plant') { S.leafT = best.id; UI.marker = { x: best.x, y: -12, t: 1 }; toast(count('cutter') ? '🍃 Leaf-cutters will harvest this plant' : '🍃 Leaves! Train leaf-cutters at a 🛡️ Barracks to carry them to a 🍄 Garden', count('cutter') ? '' : 'warn'); return; }
    if (nearHill) { const s = units('soldier'); if (!s.length) { toast('🏰 Enemy hill! Train soldiers at a 🛡️ Barracks to attack it', 'warn'); return; } const n = orderSoldiers(s.map(u => u.id), 0, 0, true); toast(`⚔️ All ${n} soldiers attack the enemy hill!`); return; }
    if (hitU) { toast(`${UT[hitU.k].icon} ${UT[hitU.k].name} · ❤️ ${Math.ceil(hitU.hp)}/${hitU.max}`); return; }
    return;
  }
  const i = cellAtScreen(sx, sy); if (i < 0) return;
  if (S.room[i]) { UI.selRoom = S.room[i]; UI.tab = null; document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on')); renderRoomInfo(); requestAnimationFrame(measureHud); return; }
  if (hitU) { const what = hitU.k === 'worker' ? (hitU.job >= 0 ? 'digging' : 'idle') : hitU.carry ? 'carrying' : ''; toast(`${UT[hitU.k].icon} ${UT[hitU.k].name}${what ? ' · ' + what : ''} · ❤️ ${Math.ceil(hitU.hp)}/${hitU.max}`); return; }
  if (S.grid[i] === SOIL) toast(`${LAYER_NAMES[layer(cy(i))]} — use ⛏ Dig to tunnel here`);
  else if (S.grid[i] === ROCK) toast('🪨 Solid rock — ants can\'t dig it');
  if (UI.selRoom) closeSheet();
}

// ---------- world-space UI drawing ----------
function drawWorldUI(k, t) {
  if (UI.mode === 'dig' && UI.dpath.length) { const p = digPlan(UI.dpath), ok = p.ok;
    for (const i of p.cells) { k.fillStyle = ok ? 'rgba(120,255,140,.35)' : 'rgba(255,90,70,.4)'; k.fillRect(cx(i) * CS + 1, cy(i) * CS + 1, CS - 2, CS - 2); k.strokeStyle = ok ? '#9dff9a' : '#ff7a6a'; k.lineWidth = 1.5; k.strokeRect(cx(i) * CS + 2, cy(i) * CS + 2, CS - 4, CS - 4); }
    for (const i of p.blocked) { k.strokeStyle = 'rgba(255,90,70,.8)'; k.lineWidth = 1.5; k.beginPath(); k.moveTo(cx(i) * CS + 5, cy(i) * CS + 5); k.lineTo(cx(i) * CS + CS - 5, cy(i) * CS + CS - 5); k.stroke(); }
    const l = UI.dpath[UI.dpath.length - 1]; label(k, (cx(l) + .5) * CS, cy(l) * CS - 8, p.cells.length ? `⛏ ${p.cells.length} cells · ${p.cost} 🍯${ok ? '' : ' ✗'}` : (p.why || '…'), ok || !p.cells.length && !p.why ? (S.res.food - p.cost < 10 ? '#ffd36b' : '#c9ffc4') : '#ffb0a6'); }
  if (UI.mode === 'room' && UI.ghost) { const d = ROOMS[UI.room], g = UI.ghost, v = canRoom(UI.room, g.x, g.y);
    k.fillStyle = v.ok ? 'rgba(120,255,140,.28)' : 'rgba(255,90,70,.3)'; rr(k, g.x * CS, g.y * CS, d.w * CS, d.h * CS, 10); k.fill(); k.strokeStyle = v.ok ? '#9dff9a' : '#ff7a6a'; k.lineWidth = 2; k.setLineDash([5, 4]); k.stroke(); k.setLineDash([]);
    label(k, (g.x + d.w / 2) * CS, g.y * CS - 8, v.ok ? `${d.icon} ${d.name} · ${costTxt(d.cost)}` : v.why, v.ok ? '#c9ffc4' : '#ffb0a6'); }
  if (UI.marker) { const m = UI.marker; m.t -= 1 / 60; if (m.t <= 0) UI.marker = null; else { k.strokeStyle = `rgba(255,230,100,${m.t})`; k.lineWidth = 2; k.beginPath(); k.ellipse(m.x, m.y, 14 * (1.4 - m.t * .4), 5 * (1.4 - m.t * .4), 0, 0, 7); k.stroke(); } }
  // tutorial arrow over the first crumb
  if (UI.running && S.tut === 0) { const it = S.items.find(i => i.k === 'food' && S.fog[Math.floor(i.x / CS)]); if (it) { const b = Math.sin(t * 5) * 4; k.fillStyle = '#ffe066'; k.strokeStyle = '#7a4a10'; k.lineWidth = 1.5;
    k.beginPath(); k.moveTo(it.x, -26 + b); k.lineTo(it.x - 8, -38 + b); k.lineTo(it.x - 3, -38 + b); k.lineTo(it.x - 3, -50 + b); k.lineTo(it.x + 3, -50 + b); k.lineTo(it.x + 3, -38 + b); k.lineTo(it.x + 8, -38 + b); k.closePath(); k.fill(); k.stroke();
    k.strokeStyle = `rgba(255,240,150,${.5 + .4 * Math.sin(t * 5)})`; k.lineWidth = 2; k.beginPath(); k.ellipse(it.x, -7, 20, 9, 0, 0, 7); k.stroke(); } }
  // box select (screen space)
  if (gest && gest.kind === 'box') { k.setTransform(DPR, 0, 0, DPR, 0, 0); k.fillStyle = 'rgba(255,224,102,.15)'; k.strokeStyle = '#ffe066'; k.lineWidth = 1.5; k.setLineDash([6, 4]); const x = Math.min(gest.sx, gest.ex), y = Math.min(gest.sy, gest.ey); k.fillRect(x, y, Math.abs(gest.ex - gest.sx), Math.abs(gest.ey - gest.sy)); k.strokeRect(x, y, Math.abs(gest.ex - gest.sx), Math.abs(gest.ey - gest.sy)); k.setLineDash([]); }
  else if (gest && gest.kind === 'tap' && gest.t0) { const p = (performance.now() - gest.t0) / HOLD_MS; if (p > .3 && p < 1) { k.setTransform(DPR, 0, 0, DPR, 0, 0); k.strokeStyle = `rgba(255,226,102,${p})`; k.lineWidth = 3; k.beginPath(); k.arc(gest.sx, gest.sy, 26, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); k.stroke(); } }
}
function label(k, x, y, txt, col) { k.font = '700 10px -apple-system,system-ui,sans-serif'; const w = k.measureText(txt).width + 12; k.fillStyle = 'rgba(30,18,10,.85)'; rr(k, x - w / 2, y - 14, w, 17, 8); k.fill(); k.fillStyle = col; k.textAlign = 'center'; k.fillText(txt, x, y - 2); }

// ---------- overlays ----------
function overlay(html, cls) { const o = $('overlay'); o.className = cls || ''; $('ov-card').innerHTML = html; o.classList.remove('hidden'); }
function closeOverlay() { $('overlay').classList.add('hidden'); }
function showTitle() {
  UI.running = false; UI.paused = false; closeSheet(); setMode(null); $('hud').classList.add('hidden'); measureHud();
  if (!S || S.over || S.demo !== menuBiome) { S = newState(menuBiome, 'easy', 12345); S.demo = menuBiome; S.flags.sent = true; S.tut = 99; cam.x = ENTX + 30; cam.y = 20; cam.z = 1.25; }
  const sv = loadSaved();
  const cards = Object.entries(BIOMES).map(([k, b]) => `<button class="bio ${b.soon ? 'soon' : ''} ${k === menuBiome ? 'on' : ''}" data-bio="${k}" style="--a:${b.soon ? b.card[0] : b.sky[0]};--b:${b.soon ? b.card[1] : b.soil[0]}"><i>${b.emoji}</i><b>${b.name}</b>${b.soon ? '<small>Coming soon</small>' : ''}</button>`).join('');
  overlay(`<div class="logo"><span>🐜</span><h1>Ant Haven</h1><p>Dig · Grow · Defend</p></div>
    <div class="bios">${cards}</div><p class="bdesc">${BIOMES[menuBiome].desc}</p>
    <div class="diff"><button data-d="easy" class="${menuDiff === 'easy' ? 'on' : ''}">🌱 Easy</button><button data-d="hard" class="${menuDiff === 'hard' ? 'on' : ''}">🔥 Hard</button></div>
    <button class="big green" data-o="new">▶ New Game</button>
    ${sv && BIOMES[sv.biome] ? `<button class="big" data-o="continue">⏯ Continue <small>${BIOMES[sv.biome].name} · ${DIFF[sv.diff].name} · ${mmss(sv.t)}</small></button>` : ''}
    <button class="big ghost" data-o="help">❓ How to play</button><p class="ver">${VERSION}</p>`, 'title');
}
const HELP = `<h2>❓ How to play</h2><ul class="help">
  <li>🌾 <b>Food first.</b> Tap food on the surface to send harvesters. Ants eat all the time, so watch the 🍯 number.</li>
  <li>⛏ <b>Dig</b>: drag from a tunnel into the dirt. Workers dig it (1 🍯 per cell). Rocks can't be dug.</li>
  <li>🏠 <b>Rooms</b>: pick one and tap beside a tunnel. Storage holds food, Egg Rooms hold eggs, Dens raise the ant limit.</li>
  <li>👑 The <b>queen</b> lays eggs (4 🍯 each) when there's room. Eggs hatch into workers; a Nursery speeds it up.</li>
  <li>🐜 <b>Colony</b>: use ＋/− to turn workers into harvesters, leaf-cutters or soldiers (needs a Barracks).</li>
  <li>🍃 Leaf-cutters bring leaves to a 🍄 Fungus Garden, which turns them into food.</li>
  <li>🌧 <b>Rain floods the deepest tunnels first.</b> Keep eggs and food high up; build a 💧 Sump deep down to drain water.</li>
  <li>⚔️ <b>Raids</b>: soldiers guard the entrance. A 🔭 Lookout warns you early. Hold a finger, then drag a box to select soldiers; tap to move them or tap the enemy hill to attack.</li>
  <li>🗺️ <b>Surface map</b>: tap <b>🗺️ Surface</b> for the big yard. <b>🌾/⚔️ Send</b> ants out, tap ants (or hold + drag a box) to select, then tap food, a bug, an enemy hill or the ground. 🚩 sets a rally point.</li>
  <li>🏴 <b>Rival colonies</b> forage and raid you. Beat their soldiers, then attack the hill to capture it: an outpost gives +6 ant space and steady food.</li>
  <li>⚠️ <b>Surface dangers</b>: a growing <b>shadow</b> means a foot is about to stomp — move out! A <b>bright spot</b> is a magnifying glass; ants hide under leaves or in a hill. Big bugs need a group of soldiers and drop lots of food. Change danger level in ☰.</li>
  <li>🏰 <b>Win</b> by destroying the enemy ant hill, then keep going in endless mode.</li>
  <li>✌️ Two fingers pan and zoom. ⬆/⬇ jumps between the surface and the nest.</li></ul>`;
function showStats(win) {
  const s = S.st, done = GOALS.filter(g => S.goals[g[0]]).length;
  return `<div class="stats"><div><b>${mmss(S.t)}</b><small>time</small></div><div><b>${s.peak}</b><small>peak ants</small></div><div><b>${s.hatched}</b><small>hatched</small></div>
    <div><b>${Math.round(s.gathered)}</b><small>food gathered</small></div><div><b>${s.leaves}</b><small>leaves</small></div><div><b>${s.dug}</b><small>tunnels dug</small></div>
    <div><b>${s.rooms}</b><small>rooms built</small></div><div><b>${s.raids}</b><small>raids survived</small></div><div><b>${s.kills}</b><small>enemies beaten</small></div>
    <div><b>${s.lost}</b><small>ants lost</small></div><div><b>${s.stolen}</b><small>food stolen</small></div><div><b>${done}/${GOALS.length}</b><small>goals</small></div></div>
    <p class="bdesc">${BIOMES[S.biome].name} · ${DIFF[S.diff].name}</p>`;
}
$('overlay').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.bio) { if (BIOMES[b.dataset.bio].soon) { toast(`${BIOMES[b.dataset.bio].emoji} ${BIOMES[b.dataset.bio].name} is coming soon!`); return; } menuBiome = b.dataset.bio; showTitle(); return; }
  if (b.dataset.d) { menuDiff = b.dataset.d; showTitle(); return; }
  const o = b.dataset.o;
  if (o === 'new') startGame(newState(menuBiome, menuDiff));
  else if (o === 'continue') { const sv = loadSaved(); if (sv && restore(sv)) startGame(S, true); else toast('Save could not be loaded', 'bad'); }
  else if (o === 'help') overlay(HELP + '<button class="big" data-o="back">◀ Back</button>');
  else if (o === 'back') { if (UI.running) showMenu(); else showTitle(); }
  else if (o === 'resume') { closeOverlay(); UI.paused = false; $('btn-pause').textContent = '⏸'; }
  else if (o === 'quit') { save(); S = null; showTitle(); }
  else if (o === 'restart') overlay(`<h2>Restart?</h2><p class="bdesc">Your current colony will be lost.</p><button class="big red" data-o="dorestart">Yes, start over</button><button class="big" data-o="resume">Cancel</button>`);
  else if (o === 'dorestart') { clearSave(); startGame(newState(S.biome, S.diff)); }
  else if (o === 'endless') { S.endless = true; S.raid.next = S.t + 120; closeOverlay(); UI.paused = false; toast('♾️ Endless mode — raids keep coming!', 'goal'); }
  else if (o === 'title') { if (S && !S.over) save(); else clearSave(); S = null; showTitle(); }
  else if (o === 'hz') { const L = ['off', 'easy', 'hard'], n = L[(L.indexOf(S.yard.hzLevel) + 1) % 3]; setHazLevel(n); showMenu(); toast(`⚙️ Surface hazards: ${HZ_TXT[n]}`); }
  else if (o === 'music' || o === 'sfx') { AHAudio.setAudio(o, !AHAudio.AU[o]); const on = AHAudio.AU[o]; b.classList.toggle('ghost', !on); b.querySelector('b').textContent = on ? 'On' : 'Off'; }
  else if (o === 'nextsong') { const i = AHAudio.next(); $('snd-track').textContent = `Song ${i + 1} of ${AHAudio.TRACKS.length}`; if (!AHAudio.AU.music) toast('🎵 Music is off — turn it on to hear the next song'); }
  else if (o === 'goalsclose') { closeOverlay(); UI.paused = false; }
});
function audioRows() { const A = AHAudio.AU;
  return `<div class="snd"><button class="big ${A.music ? '' : 'ghost'}" data-o="music" id="snd-music">🎵 Music: <b>${A.music ? 'On' : 'Off'}</b></button><button class="big ${A.sfx ? '' : 'ghost'}" data-o="sfx" id="snd-sfx">🔊 Sounds: <b>${A.sfx ? 'On' : 'Off'}</b></button></div>
  <button class="big ghost" data-o="nextsong" id="snd-next">⏭ Next song <small id="snd-track">Song ${AHAudio.track + 1} of ${AHAudio.TRACKS.length}</small></button>
  <label class="vol">🔈<input type="range" id="snd-vol" min="0" max="100" step="5" value="${Math.round(A.vol * 100)}" aria-label="Volume">🔊</label>`; }
$('overlay').addEventListener('input', e => { if (e.target.id === 'snd-vol') AHAudio.setAudio('vol', +e.target.value / 100); });
$('overlay').addEventListener('change', e => { if (e.target.id === 'snd-vol') AHAudio.sfx('click'); });
function showMenu() { UI.paused = true; overlay(`<h2>⏸ Paused</h2><button class="big green" data-o="resume">▶ Resume</button><button class="big" data-o="hz">⚙️ Surface hazards: <b>${HZ_TXT[S.yard.hzLevel]}</b></button>${audioRows()}<button class="big" data-o="help">❓ How to play</button><button class="big" data-o="restart">↺ Restart</button><button class="big ghost" data-o="quit">💾 Save & quit to title</button>`); }
$('btn-menu').onclick = showMenu;
$('btn-pause').onclick = () => { UI.paused = !UI.paused; $('btn-pause').textContent = UI.paused ? '▶' : '⏸'; toast(UI.paused ? '⏸ Paused' : '▶ Resumed'); };
$('btn-speed').onclick = () => { UI.speed = UI.speed === 1 ? 2 : UI.speed === 2 ? 3 : 1; $('btn-speed').textContent = UI.speed + '×'; $('btn-speed').classList.toggle('on', UI.speed > 1); };
$('btn-goals').onclick = () => { UI.paused = true;
  overlay(`<h2>🎯 Goals</h2><ul class="goals">${GOALS.map(([id, n]) => `<li class="${S.goals[id] ? 'done' : ''}">${S.goals[id] ? '✅' : '⬜'} ${n}</li>`).join('')}</ul><p class="bdesc">Each goal gives +${GOAL_REWARD} 🍯. Destroy the enemy hill to win!</p><button class="big green" data-o="goalsclose">▶ Back to the colony</button>`); };
function startGame(s, cont) {
  S = s; delete S.demo; UI.running = true; UI.paused = false; UI.sel = []; UI.speed = 1; $('btn-speed').textContent = '1×'; $('btn-speed').classList.remove('on'); $('btn-pause').textContent = '⏸';
  inc = new Array(12).fill(0); parts.length = 0; events.length = 0; $('toasts').innerHTML = ''; closeOverlay(); $('hud').classList.remove('hidden'); closeSheet(); setMode(null);
  let tutDone = false; try { tutDone = localStorage.getItem(TUT_KEY) === '1'; } catch (e) {} if (!cont && tutDone) S.tut = TUT.length;
  requestAnimationFrame(() => { measureHud(); cam.z = 1.15 * uiScale(); cam.x = ENTX + 50; cam.y = cont ? 60 : -30; clampCam(); });
  $('coach-t').dataset.k = ''; setView('nest', true); hud(); tutTick(); if (!cont) save();
}
function gameOver() {
  UI.paused = true; clearSave(); sfx('lose');
  overlay(`<h2 class="sad">💀 The colony has fallen</h2><p class="bdesc">${S.why}</p>${showStats()}<button class="big green" data-o="dorestart">↺ Try again</button><button class="big ghost" data-o="title">🏠 Title</button>`);
}
function victory() {
  UI.paused = true; save(); sfx('win');
  overlay(`<h2 class="win">🏆 Victory!</h2><p class="bdesc">${S.hill.dead ? 'The enemy hill has fallen.' : 'Every rival colony is now your outpost.'} The yard is yours!</p>${showStats(true)}<button class="big green" data-o="endless">♾️ Keep playing (endless)</button><button class="big ghost" data-o="title">🏠 Title</button>`);
}

// ---------- loop ----------
let acc = 0, prevT = performance.now(), saveT = 0;
function frame(now) {
  const dt = Math.min(.1, (now - prevT) / 1000); prevT = now; const t = now / 1000;
  if (S && (!UI.paused || !UI.running)) { acc += dt * (UI.running ? UI.speed : 1); let n = 0; while (acc >= 1 / 30 && n++ < 8) { step(1 / 30); acc -= 1 / 30; } if (n >= 8) acc = 0; }
  if (fly) { fly.t = Math.min(1, fly.t + dt * 2.2); const e = 1 - Math.pow(1 - fly.t, 3); cam.x = fly.x0 + (fly.x - fly.x0) * e; cam.y = fly.y0 + (fly.y - fly.y0) * e; cam.z = fly.z0 + (fly.z - fly.z0) * e; clampCam(); if (fly.t >= 1) fly = null; }
  if (!UI.running && S && !fly) { cam.x += Math.sin(t * .1) * .15; }
  if (S) {
    while (events.length) { const ev = events.shift(); if (!UI.running) continue;
      if (ev.toast) toast(ev.toast, ev.kind === 'goal' ? 'goal' : ev.kind); if (ev.over) setTimeout(gameOver, 900); if (ev.victory) setTimeout(victory, 900); if (ev.shake) yShake = Math.max(yShake, ev.shake); }
    UI.sel = UI.sel.filter(id => S.units.some(u => u.id === id));
    if (UI.view === 'yard') renderYard(t, dt); else render(t);
    if (UI.running) { hudT -= dt; if (hudT <= 0) { hudT = .25; hud(); tutTick(); } saveT += dt; if (saveT > 15) { saveT = 0; save(); } }
  }
  requestAnimationFrame(frame);
}
let rzT = 0; function onResize() { resize(); clearTimeout(rzT); rzT = setTimeout(() => { resize(); requestAnimationFrame(measureHud); }, 350); }   // iOS reports the new size late after rotating
addEventListener('resize', onResize); addEventListener('orientationchange', onResize); if (window.visualViewport) visualViewport.addEventListener('resize', onResize);
if (window.screen && screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', onResize);
document.addEventListener('visibilitychange', () => { if (document.hidden && UI.running) save(); });
addEventListener('pagehide', () => { if (UI.running) save(); });
resize(); showTitle(); requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const had = !!navigator.serviceWorker.controller; let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had || reloading) return; reloading = true; if (UI.running) save(); location.reload(); });
  navigator.serviceWorker.register('sw.js').then(r => { r.update(); document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update(); }); }).catch(() => {});
}
window.AH = { VIEW_TOP: () => VIEW.top, VIEW_BOT: () => VIEW.bot, uiScale, IS_TOUCH, get S() { return S; }, set S(v) { S = v; }, step, newState, startGame, restore, serialize, save, loadSaved, clearSave, cam, w2s, s2w, UI, CS, COLS, ROWS, ENT, ENTX, idx, cx, cy, digPlan, commitDig, placeRoom, canRoom, assign, orderSoldiers, units, count, adults, has, roomsOf, foodCap, popCap, eggCap, wl, computeWater, GOALS, TUT, HOLD_MS, setMode, openTab, handleTap, route, ROOMS, VERSION, layReason, netPerMin, canLay, layEgg, fillCell, showTitle, addU, get parts() { return parts; } };
