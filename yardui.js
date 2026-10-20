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
  if (!S || !S.yard) return; const nh = S.units.filter(u => u.k === 'harvester' && !u.yd).length, ns = S.units.filter(u => u.k === 'soldier' && !u.yd && !u.train).length, ny = yAnts().length;
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
function buildYard() {
  const y = S.yard, D = y.deco, R = mulberry(S.seed + 5); yardCv = mk(YW, YH); const k = yardCv.getContext('2d'); yardFor = S;
  const g = k.createLinearGradient(0, 0, YW, YH); g.addColorStop(0, '#78b24e'); g.addColorStop(.5, '#6aa544'); g.addColorStop(1, '#7cb553'); k.fillStyle = g; k.fillRect(0, 0, YW, YH);
  for (let i = 0; i < 260; i++) { k.fillStyle = R() < .5 ? 'rgba(40,90,30,.07)' : 'rgba(170,210,100,.07)'; k.beginPath(); k.arc(R() * YW, R() * YH, 30 + R() * 120, 0, 7); k.fill(); }
  for (const d of D.dirt) { k.fillStyle = 'rgba(122,88,52,.25)'; blob(k, d.x, d.y, d.r * 1.12, d.s, 16, .35); k.fill(); k.fillStyle = '#a07a4e'; blob(k, d.x, d.y, d.r, d.s, 16, .35); k.fill();
    const Rd = mulberry(d.s | 0); for (let j = 0; j < d.r * 1.2; j++) { const a = Rd() * 7, rr = Rd() * d.r * .85; k.fillStyle = Rd() < .5 ? '#8a6640' : '#b8926a'; k.fillRect(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 2 + Rd() * 2, 2 + Rd() * 2); } }
  for (const p of D.pud) { k.fillStyle = '#6e5232'; blob(k, p.x, p.y + 2, p.r * 1.14, p.s, 14, .3); k.fill(); k.fillStyle = '#4c7fa6'; blob(k, p.x, p.y, p.r, p.s, 14, .3); k.fill();
    k.fillStyle = '#6aa0c8'; blob(k, p.x - p.r * .12, p.y - p.r * .14, p.r * .72, p.s + 1, 12, .25); k.fill(); k.fillStyle = 'rgba(255,255,255,.35)'; k.beginPath(); k.ellipse(p.x - p.r * .35, p.y - p.r * .38, p.r * .25, p.r * .08, -.5, 0, 7); k.fill(); }
  // grass blades (batched by colour)
  const GC = ['#4f8a34', '#5f9c3c', '#86c25a', '#3f7a2c']; k.lineCap = 'round';
  for (let c2 = 0; c2 < 4; c2++) { k.strokeStyle = GC[c2]; k.lineWidth = c2 === 2 ? 1.1 : 1.4; k.beginPath();
    for (let i = 0; i < 11000; i++) { const x = R() * YW, yy = R() * YH; if (D.pud.some(p => Math.abs(p.x - x) < p.r && Math.abs(p.y - yy) < p.r && yd2(p, { x, y: yy }) < p.r)) continue; const inD = D.dirt.some(d => yd2(d, { x, y: yy }) < d.r * .8); if (inD && R() < .85) continue;
      const l = 4 + R() * 6, a = -Math.PI / 2 + (R() - .5) * .9; k.moveTo(x, yy); k.lineTo(x + Math.cos(a) * l, yy + Math.sin(a) * l); } k.stroke(); }
  for (const cl of D.clover) { for (let j = 0; j < 3; j++) { const a = j * 2.1 + cl.r; k.fillStyle = '#4e9a3a'; k.beginPath(); k.arc(cl.x + Math.cos(a) * cl.r * .55, cl.y + Math.sin(a) * cl.r * .55, cl.r * .55, 0, 7); k.fill(); }
    if (cl.f) { k.fillStyle = '#fffbea'; for (let j = 0; j < 6; j++) { const a = j * 1.05; k.beginPath(); k.arc(cl.x + Math.cos(a) * 3, cl.y - 6 + Math.sin(a) * 3, 2.2, 0, 7); k.fill(); } k.fillStyle = '#f2c94c'; k.beginPath(); k.arc(cl.x, cl.y - 6, 2, 0, 7); k.fill(); } }
  for (const t of D.twig) { const Rt = mulberry(t.s | 0), ex = t.x + Math.cos(t.a) * t.l, ey = t.y + Math.sin(t.a) * t.l;
    k.strokeStyle = 'rgba(0,0,0,.18)'; k.lineWidth = 6; k.beginPath(); k.moveTo(t.x + 3, t.y + 3); k.lineTo(ex + 3, ey + 3); k.stroke();
    k.strokeStyle = '#7a5530'; k.lineWidth = 5; k.beginPath(); k.moveTo(t.x, t.y); k.lineTo(ex, ey); k.stroke();
    const bx = t.x + (ex - t.x) * .6, by = t.y + (ey - t.y) * .6, ba = t.a + (Rt() < .5 ? .6 : -.6); k.lineWidth = 3; k.beginPath(); k.moveTo(bx, by); k.lineTo(bx + Math.cos(ba) * t.l * .3, by + Math.sin(ba) * t.l * .3); k.stroke();
    k.strokeStyle = '#a57b4c'; k.lineWidth = 1.5; k.beginPath(); k.moveTo(t.x, t.y - 1); k.lineTo(ex, ey - 1); k.stroke(); }
  for (const p of D.peb) { const gcol = ['#9a948a', '#b0a898', '#857e74', '#c2b8a6'][Math.floor(p.c * 4)];
    k.fillStyle = 'rgba(0,0,0,.22)'; k.beginPath(); k.ellipse(p.x + p.r * .25, p.y + p.r * .3, p.r * 1.05, p.r * .85, p.a, 0, 7); k.fill();
    k.fillStyle = gcol; k.beginPath(); k.ellipse(p.x, p.y, p.r, p.r * .8, p.a, 0, 7); k.fill(); k.fillStyle = 'rgba(255,255,255,.32)'; k.beginPath(); k.ellipse(p.x - p.r * .3, p.y - p.r * .3, p.r * .4, p.r * .22, p.a, 0, 7); k.fill(); }
  for (const l of D.leaf) { const col = ['#3f8f3a', '#6aa83c', '#c9a23a', '#d0742c'][Math.floor(l.c * 4)];
    k.save(); k.translate(l.x + 6, l.y + 7); k.rotate(l.a); k.fillStyle = 'rgba(10,40,10,.32)'; leafPath(k, l, l.r * 1.05); k.fill(); k.restore();
    k.save(); k.translate(l.x, l.y); k.rotate(l.a); k.fillStyle = col; leafPath(k, l, l.r); k.fill(); k.strokeStyle = 'rgba(255,255,230,.45)'; k.lineWidth = 1.4; k.beginPath(); k.moveTo(-l.r, 0); k.lineTo(l.r * .92, 0); k.stroke();
    k.lineWidth = .9; for (let j = -2; j <= 2; j++) { if (!j) continue; const x0 = j * l.r * .3; k.beginPath(); k.moveTo(x0, 0); k.lineTo(x0 + l.r * .22, -l.r * .26); k.moveTo(x0, 0); k.lineTo(x0 + l.r * .22, l.r * .26); k.stroke(); }
    k.strokeStyle = '#6a4a20'; k.lineWidth = 2; k.beginPath(); k.moveTo(-l.r, 0); k.lineTo(-l.r - 7, 2); k.stroke(); k.restore(); }
  miniBase = mk(120, 120); miniBase.getContext('2d').drawImage(yardCv, 0, 0, 120, 120);
  yfogCv = mk(YFN, YFN); yfogDirty = true;
}
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
function foodDraw(k, f, t) { const s = .55 + .45 * Math.sqrt(clamp(f.amt / f.max, 0, 1)), r = 12 * s; k.save(); k.translate(f.x, f.y);
  k.fillStyle = 'rgba(0,0,0,.2)'; k.beginPath(); k.ellipse(2, 3, r * 1.2, r * .8, 0, 0, 7); k.fill();
  if (f.k === 'crumb' || f.k === 'seed') { const R = mulberry(f.id * 7); for (let j = 0; j < 6; j++) { const a = R() * 7, d = R() * r * .8; k.fillStyle = f.k === 'seed' ? (j % 2 ? '#d8b878' : '#b8925a') : (j % 2 ? '#f0d29a' : '#d6a868'); k.beginPath(); k.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * .45, r * .32, a, 0, 7); k.fill(); } }
  else if (f.k === 'berry') { for (const [bx, by] of [[-4, -2], [4, -3], [0, 4], [-5, 5], [5, 4]]) { k.fillStyle = '#6a2a7a'; k.beginPath(); k.arc(bx * s, by * s, 5 * s, 0, 7); k.fill(); k.fillStyle = 'rgba(255,255,255,.4)'; k.beginPath(); k.arc(bx * s - 1.5, by * s - 1.5, 1.4 * s, 0, 7); k.fill(); } }
  else if (f.k === 'cookie') { k.fillStyle = '#c8924a'; k.beginPath(); k.arc(0, 0, r * 1.25, 0, 7); k.fill(); k.fillStyle = '#5a3418'; for (const [bx, by] of [[-5, -4], [4, -6], [6, 3], [-3, 6], [0, 0]]) { k.beginPath(); k.arc(bx * s, by * s, 2 * s, 0, 7); k.fill(); } }
  else if (f.k === 'apple') { k.rotate(f.a); k.fillStyle = '#f4e6b8'; k.beginPath(); k.ellipse(0, 0, r * .8, r * 1.3, 0, 0, 7); k.fill(); k.fillStyle = '#c0392b'; k.beginPath(); k.ellipse(0, -r * 1.2, r * .9, r * .35, 0, 0, 7); k.ellipse(0, r * 1.2, r * .9, r * .35, 0, 0, 7); k.fill(); k.fillStyle = '#3a2414'; k.fillRect(-1, -r * 1.7, 2, 4); }
  else if (f.k === 'candy') { k.rotate(f.a); k.fillStyle = '#ff7ab0'; k.beginPath(); k.moveTo(-r * 1.6, -r * .5); k.lineTo(-r * .8, 0); k.lineTo(-r * 1.6, r * .5); k.moveTo(r * 1.6, -r * .5); k.lineTo(r * .8, 0); k.lineTo(r * 1.6, r * .5); k.fill(); k.beginPath(); k.arc(0, 0, r * .85, 0, 7); k.fill(); k.strokeStyle = '#fff'; k.lineWidth = 2; k.beginPath(); k.arc(0, 0, r * .5, 0, 4); k.stroke(); }
  else { k.fillStyle = '#b8645a'; blob(k, 0, 0, r * 1.3, f.id, 10, .4); k.fill(); k.fillStyle = '#e09080'; blob(k, -2, -2, r * .7, f.id + 3, 8, .4); k.fill(); }
  if (f.amt > 0) { const g = .5 + .5 * Math.sin(t * 3 + f.id); k.fillStyle = `rgba(255,250,200,${.35 + .35 * g})`; k.beginPath(); k.arc(r * .9, -r * .9, 1.8, 0, 7); k.fill(); }
  k.restore(); }
function hillDraw(k, h, me, t, col) { const R = mulberry(Math.round(h.x * 7 + h.y)); k.save(); k.translate(h.x, h.y);
  k.fillStyle = 'rgba(0,0,0,.22)'; k.beginPath(); k.ellipse(4, 6, 42, 34, 0, 0, 7); k.fill();
  const g = k.createRadialGradient(-6, -8, 4, 0, 0, 42); g.addColorStop(0, '#c49a66'); g.addColorStop(1, '#7a5432'); k.fillStyle = g; blob(k, 0, 0, 40, h.x, 16, .18); k.fill();
  for (let j = 0; j < 40; j++) { const a = R() * 7, d = 10 + R() * 26; k.fillStyle = R() < .5 ? '#9a7044' : '#d8b080'; k.fillRect(Math.cos(a) * d, Math.sin(a) * d * .9, 2.2, 2.2); }
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
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = '#2a3a26'; c.fillRect(0, 0, W, H);
  const o = yw2s(0, 0), z = ycam.z; c.setTransform(DPR * z, 0, 0, DPR * z, (o.x + shx) * DPR, (o.y + shy) * DPR);
  const tl = ys2w(0, 0), br = ys2w(W, H), vis = (x, yy, m) => x > tl.x - m && x < br.x + m && yy > tl.y - m && yy < br.y + m;
  const sx0 = clamp(Math.floor(tl.x), 0, YW), sy0 = clamp(Math.floor(tl.y), 0, YH), sx1 = clamp(Math.ceil(br.x), 0, YW), sy1 = clamp(Math.ceil(br.y), 0, YH);
  if (sx1 > sx0 && sy1 > sy0) c.drawImage(yardCv, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
  for (const p of y.deco.pud) if (vis(p.x, p.y, p.r)) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); c.arc(p.x + p.r * .2, p.y + p.r * .1, (t * 9 + p.r) % (p.r * .7), .3, 1.6); c.stroke(); }
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
