'use strict';
// ================= Ant Haven — Surface map: rendering, input, HUD =================
const ycam = { x: HOME.x, y: HOME.y, z: 1 };
const HZ_TXT = { off: 'Off', easy: 'Easy', hard: 'Hard' };
let yardCv = null, yardFor = null, yfogCv = null, miniBase = null, yShake = 0, yMarker = null, yfogT = 0;
const mini = $('mini'), mk2 = mini.getContext('2d');
function yw2s(x, y) { return { x: (x - ycam.x) * ycam.z + W / 2, y: (y - ycam.y) * ycam.z + (VIEW.top + H - VIEW.bot) / 2 }; }
function ys2w(x, y) { return { x: (x - W / 2) / ycam.z + ycam.x, y: (y - (VIEW.top + H - VIEW.bot) / 2) / ycam.z + ycam.y }; }
function yClamp() { const vh = Math.max(50, H - VIEW.top - VIEW.bot); ycam.z = clamp(ycam.z, Math.max(W / YW, vh / YH, .32), 2.6);
  const hw = W / 2 / ycam.z, hh = vh / 2 / ycam.z; ycam.x = clamp(ycam.x, hw, YW - hw); ycam.y = clamp(ycam.y, hh, YH - hh); }
let yfly = null;
function yFlyTo(x, y, z) { yfly = { x, y, z: z || ycam.z, t: 0, x0: ycam.x, y0: ycam.y, z0: ycam.z }; }

// ---------- view toggle ----------
function setView(v, quiet) {
  UI.view = v; UI.ysel = []; UI.ymode = null; ypointers.clear(); ygest = null;
  if (quiet && v === 'nest') { ycam.x = HOME.x; ycam.y = HOME.y - 60; ycam.z = 1.1 * uiScale(); yfly = null; }
  if (v === 'yard') { closeSheet(); setMode(null); UI.sel = []; if (!quiet && !S.flags.yhelp) { S.flags.yhelp = 1; toast('🗺️ The Surface! Tap 🌾 Send to put harvesters out, then tap food'); } }
  $('vt-nest').classList.toggle('on', v === 'nest'); $('vt-yard').classList.toggle('on', v === 'yard');
  $('tabs').classList.toggle('hidden', v === 'yard'); $('ytabs').classList.toggle('hidden', v !== 'yard');
  $('fabs').classList.toggle('hidden', v === 'yard'); mini.classList.toggle('hidden', v !== 'yard');
  $('mode').dataset.h = ''; updateMode(); yardHud(); requestAnimationFrame(() => { measureHud(); yClamp(); });
}
$('vt-nest').onclick = () => { if (UI.view !== 'nest') setView('nest'); };
$('vt-yard').onclick = () => { if (UI.view !== 'yard') setView('yard'); };
function yardHud() {
  if (!S || !S.yard) return; const nh = S.units.filter(u => u.k === 'harvester' && !u.yd).length, ns = S.units.filter(u => u.k === 'soldier' && !u.yd && !(u.train > 0)).length, ny = yAnts().length;
  const set = (id, txt, off) => { const b = $(id); const h = b.querySelector('span'); if (h.innerHTML !== txt) h.innerHTML = txt; b.classList.toggle('off', !!off); };
  set('yb-harv', `Send <b>${nh}</b>`, !nh); set('yb-sold', `Send <b>${ns}</b>`, !ns); set('yb-sel', UI.ysel.length ? `Clear <b>${UI.ysel.length}</b>` : `All <b>${ny}</b>`, !ny);
  $('yb-sel').classList.toggle('on', UI.ysel.length > 0); $('yb-rally').classList.toggle('on', UI.ymode === 'rally'); set('yb-home', 'Recall', !ny);
  const y = S.yard, danger = y.hz.some(z => z.k === 'foot' ? z.t < z.grow : z.t < z.life) || y.foes.some(f => f.raid);
  $('vt-yard').classList.toggle('alarm', danger && UI.view !== 'yard'); $('vt-yard').innerHTML = (danger && UI.view !== 'yard' ? '⚠️ ' : '🗺️ ') + 'Surface' + (ny ? ` <small>${ny}🐜</small>` : '');
}
function yardMode() {
  const el = $('mode'); let t = '', btn = '';
  if (UI.ymode === 'rally') { t = '🚩 <b>Tap the map</b> to set the rally point. New ants gather there.'; btn = '✕ Cancel'; }
  else if (UI.ysel.length) { const us = UI.ysel.map(uById).filter(Boolean), s = us.filter(u => u.k === 'soldier').length, h = us.length - s;
    t = `✋ <b>${us.length} ant${us.length > 1 ? 's' : ''}</b> ${s ? s + '⚔️ ' : ''}${h ? h + '🌾' : ''} — tap food, a bug, an enemy hill, or the ground`; btn = '✕'; }
  if (!t) { if (!el.classList.contains('hidden')) { el.classList.add('hidden'); requestAnimationFrame(measureHud); } return; }
  const html = `<span>${t}</span><button id="mode-x" class="sm red">${btn}</button>`;
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; $('mode-x').onclick = () => { UI.ymode = null; UI.ysel = []; updateMode(); yardHud(); }; }
  if (el.classList.contains('hidden')) { el.classList.remove('hidden'); requestAnimationFrame(measureHud); }
}
function ySend(k) { const n = k === 'harvester' ? 3 : 99, got = sendOut(k, n);
  if (!got.length) { toast(k === 'harvester' ? '🌾 No harvesters in the nest — add some in 🐜 Colony' : '⚔️ No soldiers in the nest — train some at a 🛡️ Barracks', 'bad'); return; }
  toast(`${k === 'harvester' ? '🌾' : '⚔️'} ${got.length} ${k}${got.length > 1 ? 's' : ''} head out onto the Surface`); if (k === 'soldier') { UI.ysel = got.map(u => u.id); }
  yFlyTo(HOME.x, HOME.y); updateMode(); yardHud(); }
$('yb-harv').onclick = () => ySend('harvester');
$('yb-sold').onclick = () => ySend('soldier');
$('yb-sel').onclick = () => { if (UI.ysel.length) UI.ysel = []; else { UI.ysel = yAnts().map(u => u.id); if (!UI.ysel.length) toast('No ants on the Surface yet — tap 🌾 or ⚔️ Send', 'bad'); } UI.ymode = null; updateMode(); yardHud(); };
$('yb-rally').onclick = () => { UI.ymode = UI.ymode === 'rally' ? null : 'rally'; updateMode(); yardHud(); };
$('yb-home').onclick = () => { const ids = UI.ysel.length ? UI.ysel : yAnts().map(u => u.id); if (!ids.length) { toast('No ants out on the Surface', 'bad'); return; } recall(ids); toast(`🏠 ${ids.length} ant${ids.length > 1 ? 's' : ''} heading home to the nest`); UI.ysel = []; updateMode(); yardHud(); };

// ---------- input ----------
const ypointers = new Map(); let ygest = null;
function yHitTest(w) {
  const z = ycam.z, r = 20 / Math.min(1.2, z);
  let u = null, ud = r; for (const a of S.units) if (a.yd && !(a.hid > 0)) { const d = yd2(a, w); if (d < ud) { ud = d; u = a; } }
  let f = null, fd = r + 4; for (const e of Y().foes) if (yVisible(e.x, e.y)) { const d = yd2(e, w) - e.r * .6; if (d < fd) { fd = d; f = e; } }
  let h = null; for (const c of Y().cols) if (yExplored(c.x, c.y) && yd2(c, w) < 46) h = c;
  const home = yd2(HOME, w) < 40;
  let fo = null, fod = 28; for (const x of Y().food) if (yExplored(x.x, x.y)) { const d = yd2(x, w); if (d < fod) { fod = d; fo = x; } }
  return { u, f, h, home, fo };
}
function yardTap(sx, sy) {
  const w = ys2w(sx, sy), ht = yHitTest(w), sel = UI.ysel;
  if (UI.ymode === 'rally') { Y().rally = { x: w.x, y: w.y }; UI.ymode = null; if (sel.length) yOrder(sel, { k: 'move', x: w.x, y: w.y }); yMarker = { x: w.x, y: w.y, t: 1 }; toast('🚩 Rally point set — new ants gather here'); updateMode(); yardHud(); return; }
  if (ht.u && !sel.includes(ht.u.id)) { const grp = yAnts().filter(a => yd2(a, ht.u) < 40 && !(a.hid > 0)).map(a => a.id); UI.ysel = sel.length ? [...new Set([...sel, ...grp])] : grp; updateMode(); yardHud(); return; }
  if (sel.length) {
    if (ht.f) { const n = yOrder(sel, { k: 'attack', id: ht.f.id }); yMarker = { x: ht.f.x, y: ht.f.y, t: 1, bad: 1 }; toast(n ? `⚔️ ${n} soldier${n > 1 ? 's' : ''} attack!` : 'Only soldiers can attack — select some ⚔️', n ? '' : 'bad'); if (n) { UI.ysel = []; updateMode(); } return; }
    if (ht.h && ht.h.own === 'rival') { const n = yOrder(sel, { k: 'hill', id: ht.h.i }); yMarker = { x: ht.h.x, y: ht.h.y, t: 1, bad: 1 }; toast(n ? `🏴 ${n} soldier${n > 1 ? 's' : ''} storm the ${RIVALS[ht.h.i].name} hill!` : 'Only soldiers can attack hills', n ? '' : 'bad'); if (n) { UI.ysel = []; updateMode(); } return; }
    if (ht.home) { recall(sel); toast('🏠 Heading home to the nest'); UI.ysel = []; updateMode(); return; }
    if (ht.fo) { yOrder(sel, { k: 'gather', id: ht.fo.id, x: ht.fo.x, y: ht.fo.y }); yMarker = { x: ht.fo.x, y: ht.fo.y, t: 1 }; toast('🌾 Gathering — soldiers stand guard'); UI.ysel = []; updateMode(); return; }
    const n = yOrder(sel, { k: 'move', x: w.x, y: w.y }); yMarker = { x: w.x, y: w.y, t: 1 }; if (!yExplored(w.x, w.y)) toast('🔦 Scouting the unknown'); return;
  }
  if (ht.fo) { let hs = yAnts('harvester').filter(a => !a.carry); if (!hs.length) hs = sendOut('harvester', 3);
    if (!hs.length) { toast('🌾 No harvesters — add some in 🐜 Colony', 'bad'); return; }
    yOrder(hs.map(a => a.id), { k: 'gather', id: ht.fo.id, x: ht.fo.x, y: ht.fo.y }); yMarker = { x: ht.fo.x, y: ht.fo.y, t: 1 }; toast(`🌾 ${hs.length} harvester${hs.length > 1 ? 's' : ''} heading to the ${ht.fo.k === 'meat' ? 'bug meal' : ht.fo.k} (${Math.ceil(ht.fo.amt)} food)`); return; }
  if (ht.f) { const b = BUGS[ht.f.k]; toast(b ? `${b.icon} ${b.name} · ❤️ ${Math.ceil(ht.f.hp)}/${ht.f.max} · drops ${b.drop} food. Select soldiers, then tap it` : `${RIVALS[ht.f.c].icon} ${RIVALS[ht.f.c].name} ${ht.f.k === 'rsol' ? 'soldier' : 'forager'}${ht.f.raid ? ' (raiding!)' : ''}`); return; }
  if (ht.h) { const r = RIVALS[ht.h.i]; if (ht.h.own === 'me') toast(`🏴 Your outpost · +${OUT_POP} ant space, +${OUT_FOOD * 6} food/min`); else { const n = Y().foes.filter(f => f.c === ht.h.i).length; toast(`${r.icon} ${r.name} hill · ❤️ ${Math.ceil(ht.h.hp)}/${ht.h.max} · ${n} ants. Select soldiers, then tap the hill`, 'warn'); } return; }
  if (ht.home) { toast('🏠 Your hill. Tap 🌾 or ⚔️ Send below to put ants out'); return; }
  if (!yExplored(w.x, w.y)) toast('🌫️ Unexplored — send ants there to scout');
}
function yardBox(x0, y0, x1, y1) { const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
  if (r - l < 14 && b - t < 14) { yardTap(x0, y0); return; }
  const got = yAnts().filter(u => { const p = yw2s(u.x, u.y); return !(u.hid > 0) && p.x >= l && p.x <= r && p.y >= t && p.y <= b; }).map(u => u.id);
  UI.ysel = got; if (!got.length) toast('No ants inside the box', 'bad'); updateMode(); yardHud(); }
cv.addEventListener('pointerdown', e => {
  if (!UI.running || UI.view !== 'yard') return; cv.setPointerCapture(e.pointerId); ypointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); yfly = null;
  if (ypointers.size === 1) { ygest = { kind: 'tap', sx: e.clientX, sy: e.clientY }; const g = ygest;
    g.timer = setTimeout(() => { if (ygest === g && g.kind === 'tap') { g.kind = 'box'; g.ex = g.lx || g.sx; g.ey = g.ly || g.sy; try { navigator.vibrate && navigator.vibrate(15); } catch (er) {} } }, HOLD_MS); }
  else if (ypointers.size === 2) { if (ygest && ygest.timer) clearTimeout(ygest.timer); const [a, b] = [...ypointers.values()]; ygest = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: ycam.z, w0: ys2w((a.x + b.x) / 2, (a.y + b.y) / 2) }; }
});
cv.addEventListener('pointermove', e => {
  if (!UI.running || UI.view !== 'yard' || !ypointers.has(e.pointerId)) return; const p = ypointers.get(e.pointerId), px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY; const g = ygest; if (!g) return;
  if (g.kind === 'pinch' && ypointers.size >= 2) { const [a, b] = [...ypointers.values()]; ycam.z = g.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.d0); yClamp();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, cyv = (VIEW.top + H - VIEW.bot) / 2; ycam.x = g.w0.x - (mx - W / 2) / ycam.z; ycam.y = g.w0.y - (my - cyv) / ycam.z; yClamp(); }
  else if (g.kind === 'tap') { g.lx = e.clientX; g.ly = e.clientY; if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 10) { g.kind = 'pan'; clearTimeout(g.timer); } }
  else if (g.kind === 'box') { g.ex = e.clientX; g.ey = e.clientY; }
  if (g.kind === 'pan' || g.kind === 'pan2') { ycam.x -= (e.clientX - px) / ycam.z; ycam.y -= (e.clientY - py) / ycam.z; yClamp(); }
});
function yEnd(e, cancel) {
  if (!UI.running || UI.view !== 'yard' || !ypointers.has(e.pointerId)) return; ypointers.delete(e.pointerId);
  if (ygest && ygest.kind === 'pinch') { ygest = ypointers.size === 1 ? { kind: 'pan2' } : null; return; } if (ypointers.size) return;
  const g = ygest; ygest = null; if (g && g.timer) clearTimeout(g.timer); if (!g || cancel) return;
  if (g.kind === 'box') yardBox(g.sx, g.sy, g.ex, g.ey); else if (g.kind === 'tap') yardTap(e.clientX, e.clientY);
}
cv.addEventListener('pointerup', e => yEnd(e, false)); cv.addEventListener('pointercancel', e => yEnd(e, true));
cv.addEventListener('wheel', e => { if (!UI.running || UI.view !== 'yard') return; e.preventDefault(); const w0 = ys2w(e.clientX, e.clientY); ycam.z *= Math.exp(-e.deltaY * .0015); yClamp(); const cyv = (VIEW.top + H - VIEW.bot) / 2; ycam.x = w0.x - (e.clientX - W / 2) / ycam.z; ycam.y = w0.y - (e.clientY - cyv) / ycam.z; yClamp(); }, { passive: false });
function miniJump(e) { const r = mini.getBoundingClientRect(); ycam.x = (e.clientX - r.left) / r.width * YW; ycam.y = (e.clientY - r.top) / r.height * YH; yfly = null; yClamp(); }
mini.addEventListener('pointerdown', e => { e.stopPropagation(); mini.setPointerCapture(e.pointerId); miniJump(e); });
mini.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') { if (mini.hasPointerCapture(e.pointerId)) miniJump(e); } });

// ---------- static yard art ----------
function blob(k, x, y, r, seed, n, j) { const R = mulberry(seed | 0); n = n || 14; j = j || .28; k.beginPath(); const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 - j / 2 + R() * j); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (i === 0) k.moveTo(mx, my); else k.quadraticCurveTo(p[0], p[1], mx, my); }
  const p = pts[0], q = pts[1]; k.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); k.closePath(); }
function leafPath(k, l, r) { k.beginPath(); k.moveTo(-r, 0); k.quadraticCurveTo(-r * .2, -r * .62, r, 0); k.quadraticCurveTo(-r * .2, r * .62, -r, 0); k.closePath(); }
// per-biome Surface look: ground, patches, ponds, grass, small decor, rocks, leaves, hills and ambient particles
const YLOOK = {
  backyard: { base: ['#78b24e', '#6aa544', '#7cb553'], blot: ['rgba(40,90,30,.07)', 'rgba(170,210,100,.07)'], patch: 'dirt', dirt: ['rgba(122,88,52,.25)', '#a07a4e', '#8a6640', '#b8926a'],
    pud: 'water', pc: ['#6e5232', '#4c7fa6', '#6aa0c8'], grass: ['#4f8a34', '#5f9c3c', '#86c25a', '#3f7a2c'], gd: 1, small: 'clover', twig: ['#7a5530', '#a57b4c'],
    peb: ['#9a948a', '#b0a898', '#857e74', '#c2b8a6'], leaf: ['#3f8f3a', '#6aa83c', '#c9a23a', '#d0742c'], hill: ['#c49a66', '#7a5432', '#9a7044', '#d8b080'], bg: '#2a3a26', fx: null },
  dunes: { base: ['#ecc685', '#e2b872', '#f0cf92'], blot: ['rgba(170,110,50,.08)', 'rgba(255,240,200,.1)'], patch: 'ripple', dirt: ['rgba(180,130,70,.18)', '#d9ac68', '#c4954f', '#ecc48a'],
    pud: 'oasis', pc: ['#c9a060', '#3fa0b8', '#6fc8d8'], grass: ['#b9a05a', '#a08a48', '#d4bb72', '#8f7a3e'], gd: .12, small: 'cactus', twig: ['#a08060', '#d0b890'],
    peb: ['#d8b88a', '#c4a070', '#b08a5c', '#e6cca2'], leaf: ['#8fb56a', '#7aa05a', '#a8c47a', '#6f9450'], hill: ['#e8c48a', '#b08850', '#c89a5a', '#f2d8a8'], bg: '#4a3418', fx: null },
  ice: { base: ['#f4f9ff', '#e4eef8', '#f8fcff'], blot: ['rgba(120,160,210,.08)', 'rgba(255,255,255,.18)'], patch: 'ice', dirt: ['rgba(150,190,230,.3)', '#cfe5f7', '#b5d4ef', '#eaf5ff'],
    pud: 'frozen', pc: ['#b8cfe4', '#9fd0f0', '#d4eefc'], grass: ['#b9c7b0', '#a3b39a', '#d8e2d2', '#8e9e88'], gd: .22, small: 'snowmound', twig: ['#5e4630', '#ffffff'],
    peb: ['#8e9aa8', '#a3afbc', '#7c8794', '#b4c0cc'], pcap: '#ffffff', leaf: ['#9a7a5a', '#b08860', '#8a6a4e', '#c09878'], frost: 1, hill: ['#eef5fc', '#9fb6cc', '#c8d8e8', '#ffffff'], hcap: 1, bg: '#1e2a3a', fx: 'snow' },
  palm: { base: ['#f2dea4', '#ead196', '#f6e6b4'], blot: ['rgba(200,160,90,.08)', 'rgba(255,255,240,.14)'], patch: 'wetsand', dirt: ['rgba(170,130,70,.2)', '#d8bd80', '#c4a46a', '#e6cf98'],
    pud: 'tide', pc: ['#d8c088', '#2fb8c0', '#7fe0dc'], grass: ['#8cb44a', '#a4c45a', '#c8d878', '#6f9a38'], gd: .15, small: 'star', twig: ['#bfb3a3', '#e6ddd0'],
    peb: ['#f4d6c8', '#f0e6d8', '#e8c4b0', '#fbf0e6'], leaf: ['#3f9a3a', '#5ab048', '#2f8a34', '#74c050'], palm: 1, hill: ['#ead098', '#b0905a', '#c8aa70', '#f6e4b8'], bg: '#1a6a74', fx: null },
  peak: { base: ['#9db48a', '#8aa47a', '#a8bc94'], blot: ['rgba(60,80,60,.08)', 'rgba(220,230,210,.1)'], patch: 'scree', dirt: ['rgba(90,90,90,.22)', '#a8a69e', '#8e8c84', '#c4c2ba'],
    pud: 'tarn', pc: ['#7a7e80', '#3f78b8', '#6aa2d8'], grass: ['#6f8f55', '#7f9f62', '#a8c08a', '#5f7f48'], gd: .7, small: 'edelweiss', twig: ['#6a5a48', '#8f8070'],
    peb: ['#9a9a98', '#b4b4b0', '#808080', '#c8c8c4'], pcap: 'rgba(255,255,255,.55)', leaf: ['#5a8a4a', '#7a9a50', '#a8a050', '#6a8a5a'], hill: ['#b8a888', '#6e604a', '#8e8068', '#d0c4a8'], bg: '#2a3030', fx: null, bigPeb: 1.5 },
  mars: { base: ['#c86a3e', '#b85a32', '#d27848'], blot: ['rgba(90,30,10,.1)', 'rgba(255,190,140,.08)'], patch: 'crater', dirt: ['rgba(80,25,10,.3)', '#a84e2a', '#8e3e20', '#d07a50'],
    pud: 'marsice', pc: ['#8e3e22', '#e8f2fa', '#ffffff'], grass: ['#a84a2a', '#8e3e22', '#d07a50', '#7a321a'], gd: .08, small: 'gem', twig: ['#7a3a22', '#a85a3a'],
    peb: ['#9a4a2c', '#b8603a', '#7e3a20', '#c8724a'], leaf: ['#3fb8a8', '#6a5ad0', '#2fa0a0', '#8a6ae0'], alien: 1, hill: ['#d88a5a', '#7a3418', '#a85a32', '#f0a878'], bg: '#1a0e2a', fx: 'dust' },
  woods: { base: ['#4a7a3a', '#3f6e32', '#557f40'], blot: ['rgba(10,40,10,.12)', 'rgba(140,170,90,.06)'], patch: 'litter', dirt: ['rgba(70,45,20,.25)', '#6a4a2a', '#8a5a2a', '#a8742e'],
    pud: 'water', pc: ['#3a2a18', '#2f5a6a', '#4a7a88'], grass: ['#2f5f28', '#3f7030', '#6a9a48', '#244a1e'], gd: .9, small: 'mushroom', twig: ['#5a3a1e', '#7a5530'],
    peb: ['#7a8070', '#8a9480', '#6a7060', '#9aa08a'], pcap: 'rgba(110,160,70,.7)', leaf: ['#2f6f2a', '#4a8a30', '#8a9a2a', '#a86a2a'], hill: ['#8a6a44', '#4a321e', '#6a4a2a', '#a8865a'], bg: '#0e1e10', fx: 'firefly', moreTwig: 1 },
  fen: { base: ['#6f8a5a', '#647f50', '#7a9462'], blot: ['rgba(30,50,30,.1)', 'rgba(200,220,200,.08)'], patch: 'mud', dirt: ['rgba(50,45,30,.3)', '#6a6046', '#58503a', '#7e7458'],
    pud: 'bog', pc: ['#4a4632', '#4a6a58', '#6a8a74'], grass: ['#5a7a3a', '#6a8a44', '#9ab06a', '#4a6a30'], gd: .8, small: 'lily', twig: ['#5a4a30', '#7a6a48'],
    peb: ['#7a8070', '#8a9080', '#6a7062', '#9aa090'], leaf: ['#4a7a3a', '#6a8a3a', '#8a9a4a', '#5a6a2a'], hill: ['#8a8060', '#4a4430', '#6a6248', '#a8a080'], bg: '#1e2a24', fx: 'fog', morePud: 1 },
  ember: { base: ['#64504a', '#5a4640', '#6e5a52'], blot: ['rgba(10,5,5,.15)', 'rgba(255,120,40,.05)'], patch: 'lava', dirt: ['rgba(20,10,8,.4)', '#2e2220', '#24191a', '#3e302c'],
    pud: 'lava', pc: ['#2a1a16', '#ff7a1a', '#ffd04a'], grass: ['#8a7a4a', '#6a5a38', '#a8945a', '#5a4a30'], gd: .1, small: 'ember', twig: ['#2a1e1a', '#4a3a34'],
    peb: ['#3a3230', '#4a4240', '#2a2422', '#5a5250'], leaf: ['#6a6a3a', '#8a7a3a', '#5a5a30', '#7a6a2a'], hill: ['#6a5048', '#2a1a16', '#4a3430', '#ff8a3a'], bg: '#140808', fx: 'ash' },
  bloom: { base: ['#86cc5e', '#78c050', '#8fd468'], blot: ['rgba(40,110,30,.07)', 'rgba(255,220,240,.1)'], patch: 'flowers', dirt: ['rgba(220,120,180,.18)', '#7cc456', '#f28ac0', '#ffd84a'],
    pud: 'water', pc: ['#5a8a3a', '#4ca0d8', '#8ad0f0'], grass: ['#5aa83a', '#6cb848', '#9ad86a', '#4a9030'], gd: 1, small: 'flower', twig: ['#7a5530', '#a57b4c'],
    peb: ['#d8c4d8', '#e6d6e6', '#c4b0c8', '#f0e4f0'], leaf: ['#4aa83a', '#6ac048', '#f28ac0', '#ffb0d8'], hill: ['#c49a66', '#7a5432', '#f28ac0', '#ffd84a'], bg: '#1e3a20', fx: 'petals' },
};
const YL = () => YLOOK[S && S.biome] || YLOOK.backyard;
function smallDeco(k, kind, x, y, r, f, R) {
  if (kind === 'clover') { for (let j = 0; j < 3; j++) { const a = j * 2.1 + r; k.fillStyle = '#4e9a3a'; k.beginPath(); k.arc(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .55, 0, 7); k.fill(); }
    if (f) { k.fillStyle = '#fffbea'; for (let j = 0; j < 6; j++) { const a = j * 1.05; k.beginPath(); k.arc(x + Math.cos(a) * 3, y - 6 + Math.sin(a) * 3, 2.2, 0, 7); k.fill(); } k.fillStyle = '#f2c94c'; k.beginPath(); k.arc(x, y - 6, 2, 0, 7); k.fill(); } }
  else if (kind === 'snowmound') { k.fillStyle = 'rgba(110,150,200,.25)'; k.beginPath(); k.ellipse(x + 2, y + 3, r * 2, r * 1.1, 0, 0, 7); k.fill(); k.fillStyle = '#ffffff'; k.beginPath(); k.ellipse(x, y, r * 1.9, r * 1.05, 0, 0, 7); k.fill();
    if (f) { k.fillStyle = '#c8344a'; k.beginPath(); k.arc(x - 2, y - 3, 2.2, 0, 7); k.arc(x + 2.5, y - 2, 2.2, 0, 7); k.fill(); k.fillStyle = '#2f6a3a'; k.beginPath(); k.ellipse(x + 1, y - 6, 3, 1.4, .4, 0, 7); k.fill(); } }
  else if (kind === 'cactus') { if (!f) { k.fillStyle = '#c4954f'; k.beginPath(); k.arc(x, y, r * .5, 0, 7); k.fill(); return; } k.fillStyle = 'rgba(120,80,30,.25)'; k.beginPath(); k.arc(x + 2, y + 2, r * 1.1, 0, 7); k.fill(); k.fillStyle = '#6f9a4f'; k.beginPath(); k.arc(x, y, r, 0, 7); k.fill(); k.fillStyle = '#8fbf6a'; k.beginPath(); k.arc(x - r * .3, y - r * .3, r * .45, 0, 7); k.fill(); k.fillStyle = '#ff7aa8'; k.beginPath(); k.arc(x, y, 1.8, 0, 7); k.fill(); }
  else if (kind === 'star') { k.save(); k.translate(x, y); k.rotate(r); k.fillStyle = f ? '#ff8a5a' : '#f4c0a0'; k.beginPath(); for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5, rr = j % 2 ? r * .45 : r * 1.25; k.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } k.fill(); k.restore(); }
  else if (kind === 'edelweiss') { k.fillStyle = '#f6f6f0'; for (let j = 0; j < 6; j++) { const a = j * 1.05; k.beginPath(); k.ellipse(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.6, 1.4, a, 0, 7); k.fill(); } k.fillStyle = f ? '#e8c84a' : '#d8d8a0'; k.beginPath(); k.arc(x, y, 1.8, 0, 7); k.fill(); }
  else if (kind === 'gem') { k.fillStyle = f ? 'rgba(120,240,255,.9)' : 'rgba(200,140,255,.85)'; k.beginPath(); k.moveTo(x, y - r); k.lineTo(x + r * .55, y); k.lineTo(x, y + r * .7); k.lineTo(x - r * .55, y); k.fill(); k.fillStyle = 'rgba(255,255,255,.6)'; k.fillRect(x - 1, y - r * .6, 1.4, r * .6); }
  else if (kind === 'mushroom') { if (!f) { k.fillStyle = '#3f8a3a'; k.beginPath(); k.arc(x, y, r * .7, 0, 7); k.fill(); return; } k.fillStyle = 'rgba(0,0,0,.2)'; k.beginPath(); k.arc(x + 2, y + 2, r * 1.1, 0, 7); k.fill(); k.fillStyle = '#d8342a'; k.beginPath(); k.arc(x, y, r, 0, 7); k.fill(); k.fillStyle = '#fff'; for (const [dx, dy] of [[-.4, -.3], [.35, -.2], [0, .4]]) { k.beginPath(); k.arc(x + dx * r, y + dy * r, r * .2, 0, 7); k.fill(); } }
  else if (kind === 'lily') { k.fillStyle = '#4f8a3a'; k.beginPath(); k.arc(x, y, r * 1.2, .4, 6.0); k.lineTo(x, y); k.fill(); if (f) { k.fillStyle = '#ffd6ea'; for (let j = 0; j < 5; j++) { const a = j * 1.26; k.beginPath(); k.ellipse(x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5, 2.4, 1.3, a, 0, 7); k.fill(); } } }
  else if (kind === 'ember') { const g = k.createRadialGradient(x, y, .5, x, y, r * 1.4); g.addColorStop(0, 'rgba(255,220,120,.95)'); g.addColorStop(.5, 'rgba(255,120,30,.6)'); g.addColorStop(1, 'rgba(255,80,20,0)'); k.fillStyle = g; k.beginPath(); k.arc(x, y, r * 1.4, 0, 7); k.fill(); }
  else if (kind === 'flower') { const col = ['#ff7ab0', '#ffd84a', '#b98aff', '#ffffff', '#ff9a5a'][Math.floor(R() * 5)]; k.fillStyle = col; for (let j = 0; j < 5; j++) { const a = j * 1.26 + r; k.beginPath(); k.arc(x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4, 2.8, 0, 7); k.fill(); } k.fillStyle = '#f2b01e'; k.beginPath(); k.arc(x, y, 2, 0, 7); k.fill(); }
}
function buildYard() {
  const y = S.yard, D = y.deco, R = mulberry(S.seed + 5), L = YL(); yardCv = mk(YW, YH); const k = yardCv.getContext('2d'); yardFor = S;
  const g = k.createLinearGradient(0, 0, YW, YH); g.addColorStop(0, L.base[0]); g.addColorStop(.5, L.base[1]); g.addColorStop(1, L.base[2]); k.fillStyle = g; k.fillRect(0, 0, YW, YH);
  for (let i = 0; i < 260; i++) { k.fillStyle = R() < .5 ? L.blot[0] : L.blot[1]; k.beginPath(); k.arc(R() * YW, R() * YH, 30 + R() * 120, 0, 7); k.fill(); }
  if (L.fx === 'snow') { k.strokeStyle = 'rgba(140,175,215,.22)'; k.lineWidth = 3; for (let i = 0; i < 70; i++) { const x = R() * YW, yy = R() * YH, w = 60 + R() * 140; k.beginPath(); k.moveTo(x, yy); k.quadraticCurveTo(x + w / 2, yy - 10 - R() * 12, x + w, yy); k.stroke(); } }   // drift ridges
  for (const d of D.dirt) { k.fillStyle = L.dirt[0]; blob(k, d.x, d.y, d.r * 1.12, d.s, 16, .35); k.fill(); k.fillStyle = L.dirt[1]; blob(k, d.x, d.y, d.r, d.s, 16, .35); k.fill();
    const Rd = mulberry(d.s | 0);
    if (L.patch === 'ice') { k.strokeStyle = 'rgba(255,255,255,.75)'; k.lineWidth = 2; for (let j = 0; j < 4; j++) { const a = Rd() * 7, rr = Rd() * d.r * .5, l = d.r * (.2 + Rd() * .3); k.beginPath(); k.moveTo(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr); k.lineTo(d.x + Math.cos(a) * rr + l, d.y + Math.sin(a) * rr - l * .5); k.stroke(); } }
    else if (L.patch === 'crater') { k.fillStyle = L.dirt[2]; blob(k, d.x + d.r * .08, d.y + d.r * .08, d.r * .72, d.s + 2, 14, .2); k.fill(); k.strokeStyle = L.dirt[3]; k.lineWidth = 3; k.beginPath(); k.arc(d.x, d.y, d.r * .78, 3.6, 5.6); k.stroke(); }
    else if (L.patch === 'lava') { k.strokeStyle = 'rgba(255,120,30,.7)'; k.lineWidth = 2.2; for (let j = 0; j < 5; j++) { let x = d.x + (Rd() - .5) * d.r, yy = d.y + (Rd() - .5) * d.r; k.beginPath(); k.moveTo(x, yy); for (let q = 0; q < 4; q++) { x += (Rd() - .5) * 30; yy += (Rd() - .5) * 30; k.lineTo(x, yy); } k.stroke(); } }
    else if (L.patch === 'flowers') { for (let j = 0; j < d.r * .6; j++) { const a = Rd() * 7, rr = Rd() * d.r * .85; smallDeco(k, 'flower', d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, Rd() * 6, 1, Rd); } }
    else if (L.patch === 'ripple') { k.strokeStyle = L.dirt[2]; k.lineWidth = 2; for (let j = -3; j <= 3; j++) { k.beginPath(); k.moveTo(d.x - d.r * .7, d.y + j * d.r * .2); k.quadraticCurveTo(d.x, d.y + j * d.r * .2 - 8, d.x + d.r * .7, d.y + j * d.r * .2); k.stroke(); } }
    else for (let j = 0; j < d.r * 1.2; j++) { const a = Rd() * 7, rr = Rd() * d.r * .85; k.fillStyle = Rd() < .5 ? L.dirt[2] : L.dirt[3]; k.fillRect(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 2 + Rd() * 2, 2 + Rd() * 2); } }
  for (const p of D.pud) { k.fillStyle = L.pc[0]; blob(k, p.x, p.y + 2, p.r * 1.14, p.s, 14, .3); k.fill(); k.fillStyle = L.pc[1]; blob(k, p.x, p.y, p.r, p.s, 14, .3); k.fill();
    k.fillStyle = L.pc[2]; blob(k, p.x - p.r * .12, p.y - p.r * .14, p.r * .72, p.s + 1, 12, .25); k.fill();
    if (L.pud === 'frozen' || L.pud === 'marsice') { const Rp = mulberry(p.s | 0); k.strokeStyle = 'rgba(255,255,255,.9)'; k.lineWidth = 1.4; for (let j = 0; j < 5; j++) { let x = p.x + (Rp() - .5) * p.r * .4, yy = p.y + (Rp() - .5) * p.r * .4; const a = Rp() * 7; k.beginPath(); k.moveTo(x, yy); for (let q = 0; q < 3; q++) { x += Math.cos(a + (Rp() - .5)) * p.r * .25; yy += Math.sin(a + (Rp() - .5)) * p.r * .25; k.lineTo(x, yy); } k.stroke(); }
      k.fillStyle = 'rgba(255,255,255,.95)'; k.beginPath(); k.ellipse(p.x + p.r * .5, p.y + p.r * .55, p.r * .35, p.r * .14, 0, 0, 7); k.fill(); }
    else if (L.pud === 'lava') { k.fillStyle = 'rgba(255,240,160,.8)'; blob(k, p.x - p.r * .2, p.y - p.r * .2, p.r * .32, p.s + 2, 10, .3); k.fill(); }
    else { k.fillStyle = 'rgba(255,255,255,.35)'; k.beginPath(); k.ellipse(p.x - p.r * .35, p.y - p.r * .38, p.r * .25, p.r * .08, -.5, 0, 7); k.fill(); } }
  // grass blades (batched by colour); sparse tufts on snow/sand/rock
  const GC = L.grass; k.lineCap = 'round'; const nG = Math.round(11000 * L.gd);
  for (let c2 = 0; c2 < 4; c2++) { k.strokeStyle = GC[c2]; k.lineWidth = c2 === 2 ? 1.1 : 1.4; k.beginPath();
    for (let i = 0; i < nG; i++) { let x = R() * YW, yy = R() * YH; if (L.gd < .5) { const cl = (i * 7) % 600; x = (cl * 97.13 + R() * 26) % YW; yy = (cl * 61.7 + R() * 26) % YH; }   // tufts
      if (D.pud.some(p => Math.abs(p.x - x) < p.r && Math.abs(p.y - yy) < p.r && yd2(p, { x, y: yy }) < p.r)) continue; const inD = D.dirt.some(d => yd2(d, { x, y: yy }) < d.r * .8); if (inD && R() < .85) continue;
      const l = 4 + R() * 6, a = -Math.PI / 2 + (R() - .5) * .9; k.moveTo(x, yy); k.lineTo(x + Math.cos(a) * l, yy + Math.sin(a) * l); } k.stroke(); }
  if (L.frost) { k.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 2600; i++) k.fillRect(R() * YW, R() * YH, 1.6, 1.6); }   // glitter
  for (const cl of D.clover) smallDeco(k, L.small, cl.x, cl.y, cl.r, cl.f, R);
  for (const t of D.twig) { const Rt = mulberry(t.s | 0), ex = t.x + Math.cos(t.a) * t.l, ey = t.y + Math.sin(t.a) * t.l;
    k.strokeStyle = 'rgba(0,0,0,.18)'; k.lineWidth = 6; k.beginPath(); k.moveTo(t.x + 3, t.y + 3); k.lineTo(ex + 3, ey + 3); k.stroke();
    k.strokeStyle = L.twig[0]; k.lineWidth = 5; k.beginPath(); k.moveTo(t.x, t.y); k.lineTo(ex, ey); k.stroke();
    const bx = t.x + (ex - t.x) * .6, by = t.y + (ey - t.y) * .6, ba = t.a + (Rt() < .5 ? .6 : -.6); k.lineWidth = 3; k.beginPath(); k.moveTo(bx, by); k.lineTo(bx + Math.cos(ba) * t.l * .3, by + Math.sin(ba) * t.l * .3); k.stroke();
    k.strokeStyle = L.twig[1]; k.lineWidth = L.frost ? 2.6 : 1.5; k.beginPath(); k.moveTo(t.x, t.y - 1); k.lineTo(ex, ey - 1); k.stroke(); }
  for (const p of D.peb) { const gcol = L.peb[Math.floor(p.c * 4)], r = p.r * (L.bigPeb && p.r >= 11 ? 1 : 1);
    k.fillStyle = 'rgba(0,0,0,.22)'; k.beginPath(); k.ellipse(p.x + r * .25, p.y + r * .3, r * 1.05, r * .85, p.a, 0, 7); k.fill();
    k.fillStyle = gcol; k.beginPath(); k.ellipse(p.x, p.y, r, r * .8, p.a, 0, 7); k.fill();
    if (L.pcap) { k.fillStyle = L.pcap; k.beginPath(); k.ellipse(p.x - r * .12, p.y - r * .22, r * .8, r * .5, p.a, 0, 7); k.fill(); }
    k.fillStyle = 'rgba(255,255,255,.32)'; k.beginPath(); k.ellipse(p.x - r * .3, p.y - r * .3, r * .4, r * .22, p.a, 0, 7); k.fill(); }
  for (const l of D.leaf) { const col = L.leaf[Math.floor(l.c * 4)];
    k.save(); k.translate(l.x + 6, l.y + 7); k.rotate(l.a); k.fillStyle = 'rgba(10,40,10,.32)'; leafPath(k, l, l.r * 1.05); k.fill(); k.restore();
    k.save(); k.translate(l.x, l.y); k.rotate(l.a); k.fillStyle = col; leafPath(k, l, l.r); k.fill();
    if (L.palm) { k.strokeStyle = L.base[0]; k.lineWidth = 2.2; for (let j = -4; j <= 4; j++) { if (!j) continue; const x0 = j * l.r * .2; k.beginPath(); k.moveTo(x0 + l.r * .1, 0); k.lineTo(x0 + l.r * .32, (j % 2 ? -1 : 1) * l.r * .5); k.stroke(); } }
    k.strokeStyle = L.alien ? 'rgba(220,255,250,.7)' : 'rgba(255,255,230,.45)'; k.lineWidth = 1.4; k.beginPath(); k.moveTo(-l.r, 0); k.lineTo(l.r * .92, 0); k.stroke();
    k.lineWidth = .9; for (let j = -2; j <= 2; j++) { if (!j) continue; const x0 = j * l.r * .3; k.beginPath(); k.moveTo(x0, 0); k.lineTo(x0 + l.r * .22, -l.r * .26); k.moveTo(x0, 0); k.lineTo(x0 + l.r * .22, l.r * .26); k.stroke(); }
    if (L.frost) { k.strokeStyle = 'rgba(255,255,255,.95)'; k.lineWidth = 3; leafPath(k, l, l.r); k.stroke(); k.fillStyle = 'rgba(255,255,255,.85)'; k.beginPath(); k.ellipse(-l.r * .2, -l.r * .08, l.r * .5, l.r * .16, 0, 0, 7); k.fill(); }
    k.strokeStyle = L.alien ? '#2a6a6a' : '#6a4a20'; k.lineWidth = 2; k.beginPath(); k.moveTo(-l.r, 0); k.lineTo(-l.r - 7, 2); k.stroke(); k.restore(); }
  miniBase = mk(120, 120); miniBase.getContext('2d').drawImage(yardCv, 0, 0, 120, 120);
  yfogCv = mk(YFN, YFN); yfogDirty = true;
}
// ambient weather particles in screen space (cheap: fixed count, no allocation)
function ambientFx(k, t, kind, x0, y0, w, h, n, boost) {
  if (!kind || h <= 0) return; n = Math.round(n * (boost || 1));
  k.save(); k.beginPath(); k.rect(x0, y0, w, h); k.clip();
  if (kind === 'snow') { k.fillStyle = 'rgba(255,255,255,.9)'; for (let j = 0; j < n; j++) { const sp = 22 + (j * 37 % 30) * (boost > 1 ? 1.8 : 1), r = 1.2 + (j * 13 % 10) / 5;
      const yy = y0 + ((j * 83.7 + t * sp) % (h + 20)) - 10, xx = x0 + ((j * 151.3 + Math.sin(t * .8 + j) * 14 + t * (boost > 1 ? 30 : 6)) % (w + 20)) - 10; k.beginPath(); k.arc(xx, yy, r, 0, 7); k.fill(); } }
  else if (kind === 'ash' || kind === 'petals' || kind === 'dust') { for (let j = 0; j < n; j++) { const sp = kind === 'dust' ? 10 : 18 + (j * 37 % 20), yy = y0 + ((j * 83.7 + t * sp) % (h + 20)) - 10, xx = x0 + ((j * 151.3 + t * (kind === 'dust' ? 30 : 10) + Math.sin(t + j) * 10) % (w + 20)) - 10;
      k.fillStyle = kind === 'ash' ? (j % 5 ? 'rgba(90,85,85,.7)' : 'rgba(255,150,60,.9)') : kind === 'dust' ? 'rgba(240,170,120,.45)' : (j % 2 ? 'rgba(255,170,210,.9)' : 'rgba(255,255,255,.9)');
      if (kind === 'petals') { k.beginPath(); k.ellipse(xx, yy, 3, 1.6, t * 2 + j, 0, 7); k.fill(); } else k.fillRect(xx, yy, 2, 2); } }
  else if (kind === 'firefly') { for (let j = 0; j < n; j++) { const a = .5 + .5 * Math.sin(t * 2 + j * 1.7); if (a < .3) continue; const xx = x0 + (j * 151.3 + Math.sin(t * .5 + j) * 30) % w, yy = y0 + (j * 83.7 + Math.cos(t * .4 + j) * 30) % h;
      k.fillStyle = `rgba(255,240,120,${a * .35})`; k.beginPath(); k.arc(xx, yy, 6, 0, 7); k.fill(); k.fillStyle = `rgba(255,250,190,${a})`; k.beginPath(); k.arc(xx, yy, 1.8, 0, 7); k.fill(); } }
  else if (kind === 'fog') { for (let j = 0; j < 6; j++) { const xx = x0 + ((j * 211 + t * 9) % (w + 300)) - 150, yy = y0 + (j * 0.17 % 1) * h + (j * 137 % h), r = 120 + j * 20;
      const g = k.createRadialGradient(xx, yy, 1, xx, yy, r); g.addColorStop(0, 'rgba(235,242,238,.32)'); g.addColorStop(1, 'rgba(235,242,238,0)'); k.fillStyle = g; k.fillRect(xx - r, yy - r, r * 2, r * 2); } }
  k.restore(); }
// cold-snap frost around the screen edges (built once per size)
let frostCv = null, frostKey = '';
function frostOverlay(k, a) { if (a <= 0) return; const key = W + 'x' + H; if (frostKey !== key) { frostKey = key; frostCv = mk(W, H); const f = frostCv.getContext('2d'), R = mulberry(9);
    const g = f.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .55); g.addColorStop(0, 'rgba(220,240,255,0)'); g.addColorStop(1, 'rgba(225,242,255,.85)'); f.fillStyle = g; f.fillRect(0, 0, W, H);
    f.strokeStyle = 'rgba(255,255,255,.8)'; f.lineWidth = 1.2; for (let i = 0; i < 40; i++) { const edge = i % 4, x = edge === 0 ? R() * W : edge === 1 ? W - R() * 40 : edge === 2 ? R() * W : R() * 40, yy = edge === 0 ? R() * 40 : edge === 2 ? H - R() * 40 : R() * H, s = 6 + R() * 12;
      for (let q = 0; q < 6; q++) { const an = q * Math.PI / 3; f.beginPath(); f.moveTo(x, yy); f.lineTo(x + Math.cos(an) * s, yy + Math.sin(an) * s); f.stroke(); } } }
  k.globalAlpha = a; k.drawImage(frostCv, 0, 0, W, H); k.globalAlpha = 1; }
function updateFog() { const k = yfogCv.getContext('2d'), im = k.createImageData(YFN, YFN), f = S.yard.fog;
  for (let i = 0; i < YFN * YFN; i++) { const a = !f[i] ? 236 : yvis[i] ? 0 : 70; im.data[i * 4] = 24; im.data[i * 4 + 1] = 34; im.data[i * 4 + 2] = 30; im.data[i * 4 + 3] = a; }
  k.putImageData(im, 0, 0); yfogDirty = false; }

// ---------- dynamic art ----------
const MY_COL = { harvester: ['#c27428', '#7a4314'], soldier: ['#6a3018', '#2e1308'], worker: ['#9a4524', '#5e2512'], cutter: ['#8a6a24', '#4f3a10'] };
function antTop(k, x, y, ang, s, c1, c2, ph, mv, carry, atk, big) {
  k.save(); k.translate(x, y); k.rotate(ang); k.scale(s, s);
  k.fillStyle = 'rgba(0,0,0,.2)'; k.beginPath(); k.ellipse(-.5, 1.6, 7.5, 3.4, 0, 0, 7); k.fill();
  k.strokeStyle = c2; k.lineWidth = .95; k.lineCap = 'round'; k.beginPath();
  for (let j = 0; j < 3; j++) for (let sd = -1; sd <= 1; sd += 2) { const sw = mv ? Math.sin(ph + j * 2.1 + (sd > 0 ? Math.PI : 0)) * 1.7 : 0, bx = .8 - j * 1.3;
    k.moveTo(bx, 0); k.lineTo(bx + (1 - j) * 1.6 + sw * .5, sd * 3.3); k.lineTo(bx + (1 - j) * 3.3 + sw, sd * 5.7); }
  k.moveTo(4.6, -.8); k.quadraticCurveTo(6.6, -3.2, 8.6, -2.4); k.moveTo(4.6, .8); k.quadraticCurveTo(6.6, 3.2, 8.6, 2.4); k.stroke();
  const lg = atk > 0 ? Math.sin(performance.now() / 30) * .8 : 0;
  k.fillStyle = c1; k.beginPath(); k.ellipse(-4.4, 0, 3.6, 2.8, 0, 0, 7); k.fill(); k.beginPath(); k.ellipse(0, 0, 2.2, 1.5, 0, 0, 7); k.fill();
  k.beginPath(); k.ellipse(3.6 + lg, 0, big ? 2.7 : 2.1, big ? 2.4 : 1.9, 0, 0, 7); k.fill();
  if (big) { k.strokeStyle = c2; k.lineWidth = 1.1; k.beginPath(); k.moveTo(5.6 + lg, -1.2); k.quadraticCurveTo(7.6, -1.4, 7.4 + lg, .2); k.moveTo(5.6 + lg, 1.2); k.quadraticCurveTo(7.6, 1.4, 7.4 + lg, -.2); k.stroke(); }
  k.fillStyle = 'rgba(255,255,255,.28)'; k.beginPath(); k.ellipse(-5, -1, 1.6, .9, 0, 0, 7); k.fill();
  if (carry) { k.fillStyle = '#f3d27a'; k.strokeStyle = '#a5743f'; k.lineWidth = .6; k.beginPath(); k.arc(7.4, 0, 2.2, 0, 7); k.fill(); k.stroke(); }
  k.restore(); }
function bugDraw(k, f, t) {
  const s = f.r / 16, mv = f.mv, ph = f.ph;
  if (f.k === 'centipede') { const sg = f.seg; k.lineCap = 'round';
    for (let i = sg.length - 1; i >= 0; i--) { const p = sg[i], q = sg[Math.max(0, i - 1)], a = Math.atan2(q.y - p.y, q.x - p.x) || f.ang; k.save(); k.translate(p.x, p.y); k.rotate(a);
      const sw = Math.sin(ph + i * .9) * 2.2; k.strokeStyle = '#5a2a12'; k.lineWidth = 1.2; k.beginPath(); k.moveTo(0, -3); k.lineTo(sw, -8.5); k.moveTo(0, 3); k.lineTo(-sw, 8.5); k.stroke();
      k.fillStyle = 'rgba(0,0,0,.2)'; k.beginPath(); k.ellipse(1, 2, 5.5, 4.4, 0, 0, 7); k.fill(); k.fillStyle = i % 2 ? '#a8451e' : '#8a3416'; k.beginPath(); k.ellipse(0, 0, 5, 4.2, 0, 0, 7); k.fill(); k.restore(); }
    k.save(); k.translate(f.x, f.y); k.rotate(f.ang); k.fillStyle = '#5a1e0c'; k.beginPath(); k.ellipse(1, 0, 5, 4.4, 0, 0, 7); k.fill(); k.strokeStyle = '#5a1e0c'; k.lineWidth = 1.2; k.beginPath(); k.moveTo(5, -2); k.quadraticCurveTo(10, -6, 14, -5); k.moveTo(5, 2); k.quadraticCurveTo(10, 6, 14, 5); k.stroke(); k.restore(); return; }
  k.save(); k.translate(f.x, f.y); k.rotate(f.ang); k.scale(s, s); k.lineCap = 'round';
  k.fillStyle = 'rgba(0,0,0,.22)'; k.beginPath(); k.ellipse(1, 3, 17, 12, 0, 0, 7); k.fill();
  if (f.k === 'spider') { k.strokeStyle = '#3a2a1e'; k.lineWidth = 2.2; k.beginPath();
    for (let j = 0; j < 4; j++) for (let sd = -1; sd <= 1; sd += 2) { const sw = mv ? Math.sin(ph * .8 + j * 1.7 + (sd > 0 ? Math.PI : 0)) * 3 : 0, a0 = (j - 1.5) * .45; const kx = 2 + Math.cos(a0) * 9 + sw, ky = sd * (8 + Math.sin(a0 + 1) * 3);
      k.moveTo(2, 0); k.lineTo(kx, ky * 1.2 - sd * 0); k.lineTo(kx + (j - 1.5) * 5 + sw, sd * 19); } k.stroke();
    k.fillStyle = '#6a5038'; k.beginPath(); k.ellipse(-8, 0, 10, 8, 0, 0, 7); k.fill(); k.fillStyle = '#4a3624'; k.beginPath(); k.moveTo(-15, 0); k.lineTo(-4, -2.5); k.lineTo(-4, 2.5); k.fill();
    k.fillStyle = '#5a4230'; k.beginPath(); k.ellipse(4, 0, 6, 5.2, 0, 0, 7); k.fill(); k.fillStyle = '#111'; for (const [ex, ey] of [[8, -1.6], [8, 1.6], [6.5, -3], [6.5, 3]]) { k.beginPath(); k.arc(ex, ey, 1, 0, 7); k.fill(); } }
  else if (f.k === 'beetle') { k.strokeStyle = '#1e1a14'; k.lineWidth = 2; k.beginPath();
    for (let j = 0; j < 3; j++) for (let sd = -1; sd <= 1; sd += 2) { const sw = mv ? Math.sin(ph * .6 + j * 2.1 + (sd > 0 ? Math.PI : 0)) * 2 : 0, bx = 3 - j * 6; k.moveTo(bx, 0); k.lineTo(bx + 1 + sw, sd * 11); k.lineTo(bx - 3 + sw, sd * 16); } k.stroke();
    k.fillStyle = '#3a2418'; k.beginPath(); k.ellipse(-4, 0, 13, 10, 0, 0, 7); k.fill(); k.strokeStyle = '#1a0e08'; k.lineWidth = 1; k.beginPath(); k.moveTo(-16, 0); k.lineTo(8, 0); k.stroke();
    k.fillStyle = 'rgba(255,230,200,.25)'; k.beginPath(); k.ellipse(-6, -4.5, 7, 2.4, -.15, 0, 7); k.fill();
    k.fillStyle = '#2a1a10'; k.beginPath(); k.ellipse(11, 0, 5, 5.5, 0, 0, 7); k.fill(); k.strokeStyle = '#4a2a14'; k.lineWidth = 2.4; const op = f.atk > 0 ? Math.sin(t * 20) * 1.5 : 0;
    k.beginPath(); k.moveTo(14, -3); k.quadraticCurveTo(22, -8 - op, 24, -1); k.moveTo(14, 3); k.quadraticCurveTo(22, 8 + op, 24, 1); k.stroke(); }
  else if (f.k === 'ladybug') { k.strokeStyle = '#111'; k.lineWidth = 1.6; k.beginPath(); for (let j = 0; j < 3; j++) for (let sd = -1; sd <= 1; sd += 2) { const sw = mv ? Math.sin(ph + j * 2.1 + (sd > 0 ? Math.PI : 0)) * 1.5 : 0; k.moveTo(2 - j * 4, 0); k.lineTo(2 - j * 4 + sw, sd * 13); } k.stroke();
    k.fillStyle = '#d42a1e'; k.beginPath(); k.arc(-2, 0, 11.5, 0, 7); k.fill(); k.strokeStyle = '#1a0a0a'; k.lineWidth = 1.2; k.beginPath(); k.moveTo(-13.5, 0); k.lineTo(7, 0); k.stroke();
    k.fillStyle = '#1a0a0a'; for (const [ex, ey, er] of [[-5, -5, 2.4], [-5, 5, 2.4], [-9, -2.5, 1.8], [-9, 2.5, 1.8], [1, -6, 1.8], [1, 6, 1.8]]) { k.beginPath(); k.arc(ex, ey, er, 0, 7); k.fill(); }
    k.fillStyle = 'rgba(255,255,255,.4)'; k.beginPath(); k.ellipse(-4, -6, 4, 1.6, -.3, 0, 7); k.fill(); k.fillStyle = '#1a0a0a'; k.beginPath(); k.ellipse(10, 0, 4, 5.4, 0, 0, 7); k.fill(); k.fillStyle = '#fff'; k.beginPath(); k.arc(11, -2.5, 1.2, 0, 7); k.arc(11, 2.5, 1.2, 0, 7); k.fill(); }
  k.restore();
}
const FRUIT = { mango: ['#ffd27a', '#e8771c'], frostberry: ['#e0f2ff', '#3f7fd0'], nectar: ['#fff2a8', '#e8a614'], chili: ['#ff9a7a', '#c8261a'], starfruit: ['#fff6a0', '#e2b21a'] };
function foodDraw(k, f, t) { const s = .55 + .45 * Math.sqrt(clamp(f.amt / f.max, 0, 1)), r = 12 * s; k.save(); k.translate(f.x, f.y);
  k.fillStyle = 'rgba(0,0,0,.2)'; k.beginPath(); k.ellipse(2, 3, r * 1.2, r * .8, 0, 0, 7); k.fill();
  if (f.k === 'crumb' || f.k === 'seed') { const R = mulberry(f.id * 7); for (let j = 0; j < 6; j++) { const a = R() * 7, d = R() * r * .8; k.fillStyle = f.k === 'seed' ? (j % 2 ? '#d8b878' : '#b8925a') : (j % 2 ? '#f0d29a' : '#d6a868'); k.beginPath(); k.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * .45, r * .32, a, 0, 7); k.fill(); } }
  else if (f.k === 'berry') { for (const [bx, by] of [[-4, -2], [4, -3], [0, 4], [-5, 5], [5, 4]]) { k.fillStyle = '#6a2a7a'; k.beginPath(); k.arc(bx * s, by * s, 5 * s, 0, 7); k.fill(); k.fillStyle = 'rgba(255,255,255,.4)'; k.beginPath(); k.arc(bx * s - 1.5, by * s - 1.5, 1.4 * s, 0, 7); k.fill(); } }
  else if (f.k === 'cookie') { k.fillStyle = '#c8924a'; k.beginPath(); k.arc(0, 0, r * 1.25, 0, 7); k.fill(); k.fillStyle = '#5a3418'; for (const [bx, by] of [[-5, -4], [4, -6], [6, 3], [-3, 6], [0, 0]]) { k.beginPath(); k.arc(bx * s, by * s, 2 * s, 0, 7); k.fill(); } }
  else if (f.k === 'apple') { k.rotate(f.a); k.fillStyle = '#f4e6b8'; k.beginPath(); k.ellipse(0, 0, r * .8, r * 1.3, 0, 0, 7); k.fill(); k.fillStyle = '#c0392b'; k.beginPath(); k.ellipse(0, -r * 1.2, r * .9, r * .35, 0, 0, 7); k.ellipse(0, r * 1.2, r * .9, r * .35, 0, 0, 7); k.fill(); k.fillStyle = '#3a2414'; k.fillRect(-1, -r * 1.7, 2, 4); }
  else if (f.k === 'candy') { k.rotate(f.a); k.fillStyle = '#ff7ab0'; k.beginPath(); k.moveTo(-r * 1.6, -r * .5); k.lineTo(-r * .8, 0); k.lineTo(-r * 1.6, r * .5); k.moveTo(r * 1.6, -r * .5); k.lineTo(r * .8, 0); k.lineTo(r * 1.6, r * .5); k.fill(); k.beginPath(); k.arc(0, 0, r * .85, 0, 7); k.fill(); k.strokeStyle = '#fff'; k.lineWidth = 2; k.beginPath(); k.arc(0, 0, r * .5, 0, 4); k.stroke(); }
  else if (FRUIT[f.k]) { const fc = FRUIT[f.k]; for (const [bx, by] of [[-5, -2], [5, -3], [0, 5]]) { const g = k.createRadialGradient(bx * s - 2, by * s - 2, 1, bx * s, by * s, 7 * s); g.addColorStop(0, fc[0]); g.addColorStop(1, fc[1]); k.fillStyle = g; k.beginPath();
      if (f.k === 'starfruit') { for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5 + f.a, rr = (j % 2 ? 3 : 7) * s; k.lineTo(bx * s + Math.cos(a) * rr, by * s + Math.sin(a) * rr); } } else if (f.k === 'chili') k.ellipse(bx * s, by * s, 7 * s, 3 * s, f.a + bx, 0, 7); else if (f.k === 'nectar') { k.moveTo(bx * s, by * s - 7 * s); k.quadraticCurveTo(bx * s + 6 * s, by * s + 2 * s, bx * s, by * s + 5 * s); k.quadraticCurveTo(bx * s - 6 * s, by * s + 2 * s, bx * s, by * s - 7 * s); } else k.arc(bx * s, by * s, 5.5 * s, 0, 7); k.fill(); }
    if (f.k === 'frostberry') { k.fillStyle = 'rgba(255,255,255,.9)'; k.beginPath(); k.ellipse(-1, -6 * s, 8 * s, 2.5 * s, 0, 0, 7); k.fill(); } }
  else if (f.k === 'acorn') { for (const [bx, by] of [[-5, 0], [5, -2], [0, 6]]) { k.fillStyle = '#b8783a'; k.beginPath(); k.ellipse(bx * s, by * s + 1.5 * s, 4.5 * s, 5.5 * s, 0, 0, 7); k.fill(); k.fillStyle = '#6a4a28'; k.beginPath(); k.ellipse(bx * s, by * s - 2.5 * s, 5 * s, 3 * s, 0, 0, 7); k.fill(); } }
  else if (f.k === 'mushroom') { k.fillStyle = '#f2ead8'; k.fillRect(-2.5 * s, -2 * s, 5 * s, 9 * s); k.fillStyle = '#d8342a'; k.beginPath(); k.arc(0, -2 * s, 9 * s, Math.PI, 0); k.fill(); k.fillStyle = '#fff'; for (const [dx, dy] of [[-4, -6], [3, -7], [0, -4]]) { k.beginPath(); k.arc(dx * s, dy * s, 1.6 * s, 0, 7); k.fill(); } }
  else { k.fillStyle = '#b8645a'; blob(k, 0, 0, r * 1.3, f.id, 10, .4); k.fill(); k.fillStyle = '#e09080'; blob(k, -2, -2, r * .7, f.id + 3, 8, .4); k.fill(); }
  if (f.amt > 0) { const g = .5 + .5 * Math.sin(t * 3 + f.id); k.fillStyle = `rgba(255,250,200,${.35 + .35 * g})`; k.beginPath(); k.arc(r * .9, -r * .9, 1.8, 0, 7); k.fill(); }
  k.restore(); }
function hillDraw(k, h, me, t, col) { const R = mulberry(Math.round(h.x * 7 + h.y)); k.save(); k.translate(h.x, h.y);
  k.fillStyle = 'rgba(0,0,0,.22)'; k.beginPath(); k.ellipse(4, 6, 42, 34, 0, 0, 7); k.fill();
  const HL = YL().hill, g = k.createRadialGradient(-6, -8, 4, 0, 0, 42); g.addColorStop(0, HL[0]); g.addColorStop(1, HL[1]); k.fillStyle = g; blob(k, 0, 0, 40, h.x, 16, .18); k.fill();
  for (let j = 0; j < 40; j++) { const a = R() * 7, d = 10 + R() * 26; k.fillStyle = R() < .5 ? HL[2] : HL[3]; k.fillRect(Math.cos(a) * d, Math.sin(a) * d * .9, 2.2, 2.2); }
  if (YL().hcap) { k.fillStyle = 'rgba(255,255,255,.95)'; blob(k, -4, -6, 26, h.x + 3, 14, .3); k.fill(); }
  k.fillStyle = '#2a170a'; k.beginPath(); k.ellipse(0, 0, 10, 8, 0, 0, 7); k.fill(); k.fillStyle = '#140a04'; k.beginPath(); k.ellipse(0, 1, 6, 4.5, 0, 0, 7); k.fill();
  k.strokeStyle = '#4a3020'; k.lineWidth = 2; k.beginPath(); k.moveTo(18, -12); k.lineTo(18, -46); k.stroke();
  const wv = Math.sin(t * 3 + h.x) * 2; k.fillStyle = col; k.beginPath(); k.moveTo(18, -46); k.quadraticCurveTo(30, -44 + wv, 40, -40); k.quadraticCurveTo(30, -36 - wv, 18, -32); k.fill();
  if (me) { k.font = '10px sans-serif'; k.textAlign = 'center'; k.fillText(h === HOME ? '👑' : '🏴', 28, -36); }
  k.restore(); }
function bar(k, x, y, w, v, col) { k.fillStyle = 'rgba(0,0,0,.6)'; rr(k, x - w / 2 - 1, y - 1, w + 2, 6, 3); k.fill(); k.fillStyle = col; rr(k, x - w / 2, y, w * clamp(v, 0, 1), 4, 2); k.fill(); }
function footShape(k, r) { // sneaker sole outline, centred, pointing up
  k.beginPath(); k.moveTo(0, -r * 1.2); k.bezierCurveTo(r * .75, -r * 1.2, r * .8, -r * .2, r * .6, r * .2); k.bezierCurveTo(r * .5, r * .6, r * .6, r * 1.1, 0, r * 1.15); k.bezierCurveTo(-r * .6, r * 1.1, -r * .5, r * .6, -r * .6, r * .2); k.bezierCurveTo(-r * .8, -r * .2, -r * .75, -r * 1.2, 0, -r * 1.2); k.closePath(); }

// ---------- main render ----------
function renderYard(t, dt) {
  if (!S || !S.yard) return; if (yardFor !== S) buildYard(); const y = S.yard;
  if (yfly) { yfly.t = Math.min(1, yfly.t + dt * 2.2); const e = 1 - Math.pow(1 - yfly.t, 3); ycam.x = yfly.x0 + (yfly.x - yfly.x0) * e; ycam.y = yfly.y0 + (yfly.y - yfly.y0) * e; ycam.z = yfly.z0 + (yfly.z - yfly.z0) * e; if (yfly.t >= 1) yfly = null; }
  yClamp(); yfogT -= dt; if (yfogT <= 0 || yfogDirty) { yfogT = .4; updateFog(); }
  yShake = Math.max(0, yShake - dt); const sh = yShake > 0 ? yShake * 14 : 0, shx = (rnd() - .5) * sh, shy = (rnd() - .5) * sh;
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = YL().bg; c.fillRect(0, 0, W, H);
  const o = yw2s(0, 0), z = ycam.z; c.setTransform(DPR * z, 0, 0, DPR * z, (o.x + shx) * DPR, (o.y + shy) * DPR);
  const tl = ys2w(0, 0), br = ys2w(W, H), vis = (x, yy, m) => x > tl.x - m && x < br.x + m && yy > tl.y - m && yy < br.y + m;
  const sx0 = clamp(Math.floor(tl.x), 0, YW), sy0 = clamp(Math.floor(tl.y), 0, YH), sx1 = clamp(Math.ceil(br.x), 0, YW), sy1 = clamp(Math.ceil(br.y), 0, YH);
  if (sx1 > sx0 && sy1 > sy0) c.drawImage(yardCv, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
  const pk = YL().pud; if (pk === 'lava') for (const p of y.deco.pud) { if (!vis(p.x, p.y, p.r)) continue; c.fillStyle = `rgba(255,200,80,${.25 + .2 * Math.sin(t * 2 + p.r)})`; c.beginPath(); c.arc(p.x, p.y, p.r * .6, 0, 7); c.fill(); }
  if (pk !== 'frozen' && pk !== 'marsice' && pk !== 'lava') for (const p of y.deco.pud) if (vis(p.x, p.y, p.r)) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); c.arc(p.x + p.r * .2, p.y + p.r * .1, (t * 9 + p.r) % (p.r * .7), .3, 1.6); c.stroke(); }
  // footprints after stomps
  for (const h of y.hz) if (h.k === 'foot' && h.done && vis(h.x, h.y, 80)) { c.save(); c.translate(h.x, h.y); c.rotate(h.a); c.globalAlpha = clamp((h.grow + 6 - h.t) / 3, 0, 1) * .5; c.fillStyle = '#5a4630'; footShape(c, h.r * .85); c.fill(); c.restore(); c.globalAlpha = 1; }
  for (const f of y.food) if (vis(f.x, f.y, 30) && yExplored(f.x, f.y)) foodDraw(c, f, t);
  // hills
  hillDraw(c, HOME, true, t, '#f2b544');
  for (const h of y.cols) if (vis(h.x, h.y, 70) && yExplored(h.x, h.y)) hillDraw(c, h, h.own === 'me', t, h.own === 'me' ? '#f2b544' : RIVALS[h.i].col);
  if (y.rally) { const r = y.rally; c.strokeStyle = '#4a3020'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x, r.y - 22); c.stroke(); c.fillStyle = '#ffd36b'; c.beginPath(); c.moveTo(r.x, r.y - 22); c.lineTo(r.x + 13, r.y - 17); c.lineTo(r.x, r.y - 12); c.fill(); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(r.x, r.y, 5, 2, 0, 0, 7); c.fill(); }
  // raid telegraph: dashed march line
  const raiders = y.foes.filter(f => f.raid); if (raiders.length) { let mx = 0, my = 0; for (const f of raiders) { mx += f.x; my += f.y; } mx /= raiders.length; my /= raiders.length;
    c.setLineDash([10, 8]); c.lineDashOffset = -t * 30; c.strokeStyle = 'rgba(220,40,30,.75)'; c.lineWidth = 3; c.beginPath(); c.moveTo(mx, my); c.lineTo(HOME.x, HOME.y); c.stroke(); c.setLineDash([]); }
  // selection rings + order targets
  const selSet = new Set(UI.ysel);
  for (const u of S.units) if (u.yd && selSet.has(u.id)) { c.strokeStyle = '#ffe066'; c.lineWidth = 1.6; c.beginPath(); c.arc(u.x, u.y, u.k === 'soldier' ? 11 : 9, 0, 7); c.stroke();
    if (u.o && u.o.x != null && UI.ysel.length < 30) { c.strokeStyle = 'rgba(255,224,102,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(u.x, u.y); c.lineTo(u.o.x, u.o.y); c.stroke(); } }
  // my ants
  for (const u of S.units) { if (!u.yd || u.hid > 0 || !vis(u.x, u.y, 20)) continue; const cc = MY_COL[u.k] || MY_COL.worker, sh2 = inShade(u);
    if (sh2) c.globalAlpha = .7; antTop(c, u.x, u.y, u.ang, u.k === 'soldier' ? 1.25 : 1.05, cc[0], cc[1], u.ph, u.mv, u.carry, u.atk, u.k === 'soldier'); c.globalAlpha = 1;
    if (u.hp < u.max) bar(c, u.x, u.y - 13, 16, u.hp / u.max, '#8ee06a'); }
  // foes
  for (const f of y.foes) { if (!vis(f.x, f.y, 60) || !yVisible(f.x, f.y)) continue;
    if (f.c >= 0) { const r = RIVALS[f.c]; antTop(c, f.x, f.y, f.ang, f.k === 'rsol' ? 1.25 : 1.02, r.col, r.dark, f.ph, f.mv, f.carry, f.atk, f.k === 'rsol'); if (f.raid) { c.strokeStyle = 'rgba(255,60,40,.8)'; c.lineWidth = 1.2; c.beginPath(); c.arc(f.x, f.y, 10, 0, 7); c.stroke(); } }
    else bugDraw(c, f, t);
    if (f.hp < f.max) bar(c, f.x, f.y - f.r - 12, f.c >= 0 ? 16 : 34, f.hp / f.max, '#ff6a50'); }
  // hill labels + hp
  if (z > .45) for (const h of [HOME, ...y.cols]) { if (h !== HOME && !yExplored(h.x, h.y)) continue; if (!vis(h.x, h.y, 80)) continue;
    const me = h === HOME || h.own === 'me', name = h === HOME ? 'Your hill' : me ? 'Outpost' : RIVALS[h.i].name; c.font = '700 11px -apple-system,system-ui,sans-serif'; c.textAlign = 'center';
    const tw = c.measureText(name).width + 12; c.fillStyle = me ? 'rgba(60,40,10,.85)' : 'rgba(80,16,10,.85)'; rr(c, h.x - tw / 2, h.y + 38, tw, 16, 8); c.fill(); c.fillStyle = me ? '#ffe7a8' : '#ffd6cc'; c.fillText(name, h.x, h.y + 50);
    if (!me && h.hp < h.max) bar(c, h.x, h.y + 58, 50, h.hp / h.max, '#ff6a50'); }
  // hazards (always shown: they are the warning)
  for (const h of y.hz) { if (!vis(h.x, h.y, 120)) continue;
    if (h.k === 'foot' && !h.done) { const p = clamp(h.t / h.grow, 0, 1); c.save(); c.translate(h.x, h.y); c.rotate(h.a);
      c.fillStyle = `rgba(20,14,10,${.12 + .45 * p})`; footShape(c, h.r * (.55 + .45 * p) * 1.08); c.fill();
      c.strokeStyle = `rgba(255,70,40,${.5 + .5 * Math.sin(t * 16)})`; c.lineWidth = 2.5 / z; c.setLineDash([8, 6]); footShape(c, h.r * 1.1); c.stroke(); c.setLineDash([]); c.restore();
      c.strokeStyle = '#ffdd55'; c.lineWidth = 4; c.beginPath(); c.arc(h.x, h.y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p)); c.stroke(); }
    else if (h.k === 'foot' && h.t < h.grow + .5) { c.save(); c.translate(h.x, h.y); c.rotate(h.a); c.globalAlpha = clamp(1 - (h.t - h.grow) * 2, 0, 1); c.fillStyle = '#4a4f5c'; footShape(c, h.r * 1.08); c.fill();
      c.strokeStyle = '#2a2e38'; c.lineWidth = 3; for (let j = -3; j <= 3; j++) { c.beginPath(); c.moveTo(-h.r * .5, j * h.r * .3); c.lineTo(h.r * .5, j * h.r * .3); c.stroke(); } c.restore(); c.globalAlpha = 1; }
    else if (h.k === 'glass' && h.t < h.life + 1) { const on = h.t > 0 && h.t < h.life, fade = h.t > h.life ? 1 - (h.t - h.life) : 1;
      c.globalAlpha = fade; c.strokeStyle = 'rgba(30,40,30,.25)'; c.lineWidth = 10; c.beginPath(); c.arc(h.x - 30, h.y - 40, h.r * 4.2, 0, 7); c.stroke();
      if (!on) { const p = clamp((h.t + 2.5) / 2.5, 0, 1); c.strokeStyle = `rgba(255,250,200,${.4 + .4 * Math.sin(t * 10)})`; c.lineWidth = 2; c.beginPath(); c.arc(h.x, h.y, h.r * (2.4 - 1.4 * p), 0, 7); c.stroke(); c.fillStyle = `rgba(255,255,220,${.15 * p})`; c.beginPath(); c.arc(h.x, h.y, h.r * (2.4 - 1.4 * p), 0, 7); c.fill(); }
      else { c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(h.x, h.y, 1, h.x, h.y, h.r * 1.6); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(.35, 'rgba(255,240,150,.85)'); g.addColorStop(.7, 'rgba(255,170,60,.35)'); g.addColorStop(1, 'rgba(255,140,40,0)');
        c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, h.r * 1.6, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
        c.strokeStyle = 'rgba(255,90,30,.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.stroke();
        if (rnd() < .3) yparts.push({ x: h.x + (rnd() - .5) * h.r, y: h.y + (rnd() - .5) * h.r, vx: (rnd() - .5) * 8, vy: -18, t: .8, c: '#aaa', r: 2.5, smoke: 1 }); }
      c.globalAlpha = 1; } }
  for (const p of yparts) { if (!vis(p.x, p.y, 10)) continue; c.globalAlpha = clamp(p.t * (p.smoke ? .6 : 2), 0, 1); c.fillStyle = p.c; if (p.smoke) { c.beginPath(); c.arc(p.x, p.y, p.r * (2 - p.t), 0, 7); c.fill(); } else c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); } c.globalAlpha = 1;
  if (yMarker) { yMarker.t -= dt; const m = yMarker; if (m.t <= 0) yMarker = null; else { c.strokeStyle = m.bad ? `rgba(255,80,60,${m.t})` : `rgba(255,224,102,${m.t})`; c.lineWidth = 2; c.beginPath(); c.arc(m.x, m.y, 18 - m.t * 10, 0, 7); c.stroke(); } }
  // fog
  c.imageSmoothingEnabled = true; c.drawImage(yfogCv, 0, 0, YFN, YFN, 0, 0, YW, YH);
  // box-select rectangle + edge arrows (screen space)
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  { const bio = B(), hz = S.haz.on && bio.hazard; ambientFx(c, t, YL().fx || (hz && hz.fx === 'streak' ? 'dust' : null), 0, VIEW.top, W, H - VIEW.top - VIEW.bot, YL().fx === 'fog' ? 6 : 70, hz ? 2 : 1);
    if (hz && hz.kind === 'cold') frostOverlay(c, clamp(S.haz.t, 0, 1) * .9); }
  if (ygest && ygest.kind === 'box') { const g = ygest; c.fillStyle = 'rgba(255,224,102,.15)'; c.strokeStyle = '#ffe066'; c.lineWidth = 2; c.setLineDash([6, 4]); c.fillRect(Math.min(g.sx, g.ex), Math.min(g.sy, g.ey), Math.abs(g.ex - g.sx), Math.abs(g.ey - g.sy)); c.strokeRect(Math.min(g.sx, g.ex), Math.min(g.sy, g.ey), Math.abs(g.ex - g.sx), Math.abs(g.ey - g.sy)); c.setLineDash([]); }
  const warn = []; for (const h of y.hz) if (h.k === 'foot' ? !h.done : h.t < h.life) warn.push([h, h.k === 'foot' ? '👟' : '🔍']);
  for (const f of y.foes) if (f.c < 0 && yVisible(f.x, f.y)) warn.push([f, BUGS[f.k].icon]); if (raiders.length) warn.push([raiders[0], '⚔️']);
  const top = VIEW.top + 14, bot = H - VIEW.bot - 14;
  for (const [p, ic] of warn) { const s = yw2s(p.x, p.y); if (s.x > 0 && s.x < W && s.y > VIEW.top && s.y < H - VIEW.bot) continue;
    const cxs = W / 2, cys = (top + bot) / 2, a = Math.atan2(s.y - cys, s.x - cxs), ex = clamp(s.x, 22, W - 22), ey = clamp(s.y, top + 8, bot - 8);
    c.save(); c.translate(ex, ey); c.fillStyle = 'rgba(160,30,20,.9)'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill(); c.rotate(a); c.beginPath(); c.moveTo(21, 0); c.lineTo(13, -6); c.lineTo(13, 6); c.fill(); c.restore();
    c.font = '15px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ic, ex, ey + 1); c.textBaseline = 'alphabetic'; }
  drawMini(t);
}
let miniT = 0;
function drawMini(t) { miniT -= 1 / 60; if (miniT > 0) return; miniT = .2; const y = S.yard, d = Math.min(2, DPR), sz = mini.clientWidth || 116;
  if (mini.width !== sz * d) { mini.width = sz * d; mini.height = sz * d; } const k = mk2, sc = sz / YW; k.setTransform(d, 0, 0, d, 0, 0);
  k.drawImage(miniBase, 0, 0, sz, sz); k.imageSmoothingEnabled = true; k.drawImage(yfogCv, 0, 0, sz, sz);
  const dot = (x, yy, r, col) => { k.fillStyle = col; k.fillRect(x * sc - r / 2, yy * sc - r / 2, r, r); };
  for (const f of y.food) if (yExplored(f.x, f.y)) dot(f.x, f.y, 3, '#ffe9a0');
  dot(HOME.x, HOME.y, 8, '#f2b544'); for (const h of y.cols) if (yExplored(h.x, h.y)) dot(h.x, h.y, 8, h.own === 'me' ? '#f2b544' : RIVALS[h.i].col);
  for (const u of S.units) if (u.yd) dot(u.x, u.y, 2.5, '#fff');
  for (const f of y.foes) if (yVisible(f.x, f.y)) dot(f.x, f.y, f.c < 0 ? 5 : 2.5, f.c < 0 ? '#ff3b30' : RIVALS[f.c].col);
  for (const h of y.hz) { k.strokeStyle = '#ff5a3a'; k.lineWidth = 1.5; k.beginPath(); k.arc(h.x * sc, h.y * sc, 4 + Math.sin(t * 8) * 1.5, 0, 7); k.stroke(); }
  const tl = ys2w(0, VIEW.top), br = ys2w(W, H - VIEW.bot); k.strokeStyle = '#fff'; k.lineWidth = 1.2; k.strokeRect(tl.x * sc, tl.y * sc, (br.x - tl.x) * sc, (br.y - tl.y) * sc); }

Object.assign(window.AH, { renderYard, setView, sendOut, yOrder, recall, spawnHazard, yardTick, captureHill, startRaid, setHazLevel, yAnts, ycam, yw2s, ys2w, HOME, BUGS, RIVALS, YHAZ, inShade, yExplored, OUT_POP, get yvis() { return yvis; } });
