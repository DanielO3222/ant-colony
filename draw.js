'use strict';
// ================= Ant Haven — rendering =================
const cv = document.getElementById('cv'), c = cv.getContext('2d');
let DPR = 1, W = 390, H = 844;
const cam = { x: ENTX + 40, y: -40, z: 1.1 };
const VIEW = { top: 0, bot: 0 };   // HUD insets
const RS = 1.5;                    // offscreen resolution scale
let soilCv = null, nestCv = null, surfCv = null, builtFor = null;
function mk(w, h) { const k = document.createElement('canvas'); k.width = Math.ceil(w); k.height = Math.ceil(h); return k; }
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`; }
function rr(k, x, y, w, h, r) { k.beginPath(); k.roundRect ? k.roundRect(x, y, w, h, r) : k.rect(x, y, w, h); }
function w2s(x, y) { return { x: (x - cam.x) * cam.z + W / 2, y: (y - cam.y) * cam.z + (VIEW.top + (H - VIEW.bot)) / 2 }; }
function s2w(x, y) { return { x: (x - W / 2) / cam.z + cam.x, y: (y - (VIEW.top + (H - VIEW.bot)) / 2) / cam.z + cam.y }; }
function clampCam() { const vh = H - VIEW.top - VIEW.bot; cam.z = clamp(cam.z, Math.max(.3, W / WW), 3.2);
  const hw = W / 2 / cam.z, hh = vh / 2 / cam.z; cam.x = clamp(cam.x, Math.min(hw, WW / 2), Math.max(WW - hw, WW / 2)); cam.y = clamp(cam.y, -SURF_H + hh * .6, WH - hh * .7); }
const IS_TOUCH = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;   // iPadOS Safari reports as a Mac, so feature-detect
document.documentElement.classList.toggle('touch', IS_TOUCH);
const uiScale = () => clamp(Math.min(W, H) / 430, 1, 1.45);   // bigger default zoom on tablets
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); const vv = window.visualViewport; W = Math.round(innerWidth || (vv && vv.width) || 390); H = Math.round(innerHeight || (vv && vv.height) || 844);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  document.documentElement.classList.toggle('tablet', Math.min(W, H) >= 700); measureHud(); clampCam(); if (typeof yClamp === 'function') yClamp(); }
function measureHud() { const t = document.getElementById('top'), b = document.getElementById('bottom');
  const shown = t && !document.getElementById('hud').classList.contains('hidden'); VIEW.top = shown ? t.getBoundingClientRect().bottom : 0; VIEW.bot = shown ? H - b.getBoundingClientRect().top : 0;
  const land = W > H && H < 500, co = document.getElementById('coach'), fb = document.getElementById('fabs'), ts = document.getElementById('toasts'), sheet = document.getElementById('sheet');
  if (!co) return; const sheetOpen = sheet && !sheet.classList.contains('hidden');
  if (land) { co.style.top = ''; co.style.bottom = ''; fb.style.bottom = ''; ts.style.top = ''; const vt0 = document.getElementById('vtog'), mi0 = document.getElementById('mini'); if (vt0) vt0.style.bottom = ''; if (mi0) mi0.style.bottom = ''; return; }
  if (sheetOpen) { co.style.bottom = 'auto'; co.style.top = (VIEW.top + 6) + 'px'; } else { const v1 = document.getElementById('vtog'), m1 = document.getElementById('mini'); const lift = Math.max(v1 ? v1.offsetHeight : 0, m1 && getComputedStyle(m1).display !== 'none' ? m1.offsetHeight : 0); co.style.top = 'auto'; co.style.bottom = (VIEW.bot + 18 + lift) + 'px'; }
  fb.style.bottom = (VIEW.bot + 10) + 'px'; const vt = document.getElementById('vtog'); if (vt) { vt.style.bottom = (VIEW.bot + 10) + 'px'; vt.style.opacity = sheetOpen ? '0' : ''; vt.style.pointerEvents = sheetOpen ? 'none' : ''; } const mi = document.getElementById('mini'); if (mi) mi.style.bottom = (VIEW.bot + 10) + 'px'; fb.style.opacity = sheetOpen ? '0' : ''; fb.style.pointerEvents = sheetOpen ? 'none' : '';
  ts.style.top = (VIEW.top + 8 + (sheetOpen && !co.classList.contains('hidden') ? co.offsetHeight + 6 : 0)) + 'px'; }

// ---------- static layers ----------
function buildStatic() {
  const bio = B(), R = mulberry(S.seed + 7);
  // ---- soil ----
  soilCv = mk(WW * RS, WH * RS); const k = soilCv.getContext('2d'); k.scale(RS, RS);
  const bands = [0, 6, 14, 24, ROWS];
  for (let L = 0; L < 4; L++) {
    const top = bands[L] * CS, bot = bands[L + 1] * CS + 12, col = bio.soil[L];
    const g = k.createLinearGradient(0, top, 0, bot); g.addColorStop(0, shade(col, .06)); g.addColorStop(1, shade(col, -.1)); k.fillStyle = g;
    k.beginPath(); k.moveTo(0, bot + 30);
    for (let x = 0; x <= WW; x += 16) k.lineTo(x, top + (L ? Math.sin(x * .013 + L * 2) * 7 + Math.sin(x * .041 + L) * 3 : 0)); k.lineTo(WW, bot + 30); k.fill();
  }
  // speckles + grit
  for (let i = 0; i < 2600; i++) { const x = R() * WW, y = R() * WH, L = layer(Math.floor(y / CS)); k.fillStyle = R() < .5 ? shade(bio.soil[L], -.25) : shade(bio.soil[L], .18); k.globalAlpha = .35 + R() * .4; k.fillRect(x, y, 1 + R() * 1.6, 1 + R() * 1.2); }
  k.globalAlpha = 1;
  // decorative pebbles
  for (let i = 0; i < 170; i++) { const x = R() * WW, y = 10 + R() * (WH - 20), r = 1.5 + R() * 3.5 * (y / WH + .5); pebble(k, x, y, r, r * (.6 + R() * .3), bio.rock, R() * 3); }
  // roots under plants and grass
  k.lineCap = 'round';
  for (const it of S.items.filter(i => i.k === 'plant').map(i => i.x).concat(Array.from({ length: 16 }, () => R() * WW))) {
    for (let j = 0; j < 3; j++) { let x = it + (R() - .5) * 14, y = 0, a = Math.PI / 2 + (R() - .5) * .8, w = 2.6;
      k.strokeStyle = bio.root || '#c9a36e'; k.globalAlpha = .55;
      for (let s = 0; s < 14 + R() * 18; s++) { const nx = x + Math.cos(a) * 6, ny = y + Math.sin(a) * 6; k.lineWidth = w; k.beginPath(); k.moveTo(x, y); k.lineTo(nx, ny); k.stroke(); x = nx; y = ny; a += (R() - .5) * .6; w = Math.max(.6, w * .93); if (y > 13 * CS) break; } } }
  k.globalAlpha = 1;
  // buried trinkets
  // ice veins + sparkles (Ice World), glowing lava veins (Ember Ridge)
  if (bio.frost) { k.strokeStyle = 'rgba(235,248,255,.55)'; k.lineWidth = 2; for (let i = 0; i < 40; i++) { let x = R() * WW, y = 20 + R() * (WH - 60); k.beginPath(); k.moveTo(x, y); for (let q = 0; q < 5; q++) { x += 10 + R() * 20; y += (R() - .5) * 14; k.lineTo(x, y); } k.stroke(); }
    k.fillStyle = '#ffffff'; for (let i = 0; i < 500; i++) { const x = R() * WW, y = R() * WH, r = .6 + R() * 1.2; k.globalAlpha = .4 + R() * .6; k.fillRect(x - r, y - .3, r * 2, .6); k.fillRect(x - .3, y - r, .6, r * 2); } k.globalAlpha = 1;
    for (let i = 0; i < 18; i++) trinket(k, 30 + R() * (WW - 60), 40 + R() * (WH - 80), 'crystal', R); }
  if (bio.veins) { k.strokeStyle = bio.veins; k.lineWidth = 2.2; k.shadowColor = bio.veins; k.shadowBlur = 6; for (let i = 0; i < 26; i++) { let x = R() * WW, y = 8 * CS + R() * (WH - 9 * CS); k.globalAlpha = .35 + R() * .4; k.beginPath(); k.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (R() - .5) * 40; y += 6 + R() * 16; k.lineTo(x, y); } k.stroke(); } k.shadowBlur = 0; k.globalAlpha = 1; }
  const tr = bio.trink || ['cap', 'shell', 'marble'];
  for (let i = 0; i < 9; i++) trinket(k, 40 + R() * (WW - 80), 140 + R() * (WH - 200), tr[i % tr.length], R);
  // rocks (undiggable)
  for (let i = 0; i < NC; i++) if (S.grid[i] === ROCK && cy(i) < ROWS - 1 && cx(i) > 0 && cx(i) < COLS - 1) { const x = (cx(i) + .5) * CS, y = (cy(i) + .5) * CS; pebble(k, x + (R() - .5) * 4, y + (R() - .5) * 4, CS * .66, CS * .56, bio.rock, R() * 3); }
  // bedrock
  const bg = k.createLinearGradient(0, (ROWS - 1) * CS - 6, 0, WH); bg.addColorStop(0, shade(bio.rock[1], -.3)); bg.addColorStop(1, shade(bio.rock[1], -.55)); k.fillStyle = bg;
  k.beginPath(); k.moveTo(0, WH); for (let x = 0; x <= WW; x += 12) k.lineTo(x, (ROWS - 1) * CS + Math.sin(x * .05) * 4 + R() * 3); k.lineTo(WW, WH); k.fill();
  // grass lip
  const lip = k.createLinearGradient(0, 0, 0, 10); lip.addColorStop(0, shade(bio.grassD, -.25)); lip.addColorStop(1, 'rgba(0,0,0,0)'); k.fillStyle = lip; k.fillRect(0, 0, WW, 10);
  // ---- surface (hills + ground strip) ----
  surfCv = mk(WW * RS, SURF_H * RS); const s = surfCv.getContext('2d'); s.scale(RS, RS); s.translate(0, SURF_H);
  for (let L = 0; L < 2; L++) { s.fillStyle = bio.hills[L]; s.beginPath(); s.moveTo(0, 0); const base = L ? -42 : -70;
    for (let x = 0; x <= WW; x += 12) s.lineTo(x, base - (Math.sin(x * .004 + L * 3) * 26 + Math.sin(x * .011 + L) * 12 + 28)); s.lineTo(WW, 0); s.fill(); }
  // far scenery
  if (S.biome === 'backyard') { // fence
    s.fillStyle = '#e9dcc0'; s.strokeStyle = '#bfa77f'; s.lineWidth = 1.5;
    for (let x = 8; x < WW; x += 30) { s.beginPath(); s.moveTo(x, -26); s.lineTo(x, -96); s.lineTo(x + 10, -106); s.lineTo(x + 20, -96); s.lineTo(x + 20, -26); s.closePath(); s.fill(); s.stroke(); }
    s.fillStyle = '#d6c6a4'; s.fillRect(0, -84, WW, 6); s.fillRect(0, -50, WW, 6);
    for (let i = 0; i < 9; i++) { const x = R() * WW; bush(s, x, -30, 30 + R() * 30, '#5d9e3e'); } }
  else if (S.biome === 'dunes') { for (let i = 0; i < 6; i++) cactus(s, 60 + R() * (WW - 120), -40, 28 + R() * 26); s.fillStyle = '#fff3c4'; s.globalAlpha = .9; s.beginPath(); s.arc(WW * .3, -230, 34, 0, 7); s.fill(); s.globalAlpha = 1; }
  else if (bio.scen === 'ice') { for (let i = 0; i < 18; i++) pine(s, R() * WW, -40 - R() * 30, 30 + R() * 40, '#3f6a5a', 1); for (let i = 0; i < 3; i++) snowman(s, 150 + i * (WW - 300) / 2 + R() * 80, -34, 1 + R() * .3); }
  else if (bio.scen === 'palm') { s.fillStyle = '#2fb3c4'; s.fillRect(0, -86, WW, 50); s.strokeStyle = 'rgba(255,255,255,.7)'; s.lineWidth = 2; for (let x = 0; x < WW; x += 40) { s.beginPath(); s.moveTo(x, -60 + (x % 80 ? 4 : 0)); s.quadraticCurveTo(x + 10, -66, x + 20, -60); s.stroke(); }
    for (let i = 0; i < 9; i++) palmTree(s, 40 + R() * (WW - 80), -34, 60 + R() * 50, R() < .5 ? -1 : 1); }
  else if (bio.scen === 'peak') { for (let i = 0; i < 7; i++) { const x = R() * WW, h = 120 + R() * 110, w = 120 + R() * 90; s.fillStyle = i % 2 ? '#7e8ea2' : '#93a2b4'; s.beginPath(); s.moveTo(x - w, -30); s.lineTo(x, -30 - h); s.lineTo(x + w, -30); s.fill(); s.fillStyle = '#fff'; s.beginPath(); s.moveTo(x - w * .28, -30 - h * .72); s.lineTo(x, -30 - h); s.lineTo(x + w * .28, -30 - h * .72); s.lineTo(x + w * .1, -30 - h * .78); s.lineTo(x - w * .05, -30 - h * .7); s.fill(); }
    for (let i = 0; i < 10; i++) pine(s, R() * WW, -34 - R() * 10, 24 + R() * 24, '#3f6a4a'); }
  else if (bio.scen === 'mars') { for (let i = 0; i < 5; i++) { const x = R() * WW, w = 90 + R() * 120; s.fillStyle = '#a84a2a'; s.beginPath(); s.moveTo(x - w, -30); s.lineTo(x - w * .5, -70 - R() * 30); s.lineTo(x + w * .5, -70 - R() * 30); s.lineTo(x + w, -30); s.fill(); } rocket(s, WW * .2, -36); rocket(s, WW * .78, -36); }
  else if (bio.scen === 'woods') { for (let i = 0; i < 14; i++) { const x = R() * WW, w = 10 + R() * 12; s.fillStyle = '#4a321e'; s.fillRect(x - w / 2, -300, w, 280); s.fillStyle = '#5e4028'; s.fillRect(x - w / 2, -300, w * .3, 280); }
    for (let i = 0; i < 22; i++) pine(s, R() * WW, -30 - R() * 20, 50 + R() * 70, i % 2 ? '#24502e' : '#2f6038'); }
  else if (bio.scen === 'fen') { for (let i = 0; i < 6; i++) deadTree(s, R() * WW, -34, 60 + R() * 40); for (let i = 0; i < 50; i++) cattail(s, R() * WW, -30, 26 + R() * 24);
    const m = s.createLinearGradient(0, -120, 0, -20); m.addColorStop(0, 'rgba(230,238,232,0)'); m.addColorStop(1, 'rgba(230,238,232,.6)'); s.fillStyle = m; s.fillRect(0, -120, WW, 100); }
  else if (bio.scen === 'ember') { volcano(s, WW * .42, -30, 150); volcano(s, WW * .62, -30, 110); volcano(s, WW * .15, -30, 130); volcano(s, WW * .88, -30, 120); for (let i = 0; i < 8; i++) { const x = R() * WW; s.fillStyle = '#2a1e1a'; s.beginPath(); s.moveTo(x - 30, -30); s.lineTo(x, -60 - R() * 20); s.lineTo(x + 30, -30); s.fill(); } }
  else if (bio.scen === 'bloom') { for (let i = 0; i < 12; i++) bush(s, R() * WW, -30, 26 + R() * 26, '#6cbf4a'); for (let i = 0; i < 14; i++) bigFlower(s, R() * WW, -30, 40 + R() * 40, ['#ff7ab0', '#ffd84a', '#b98aff', '#ff9a5a', '#ffffff'][i % 5]); }
  else { for (let i = 0; i < 16; i++) pine(s, R() * WW, -40 - R() * 30, 30 + R() * 40); }
  // ground strip
  const gg = s.createLinearGradient(0, -30, 0, 0); gg.addColorStop(0, bio.grass); gg.addColorStop(1, bio.ground); s.fillStyle = gg; s.fillRect(0, -30, WW, 30);
  const blades = bio.frost ? 4 : bio.scen === 'mars' || bio.scen === 'ember' ? 6 : bio.scen === 'palm' || bio.scen === 'dunes' ? 3 : 2.2;
  for (let x = 0; x < WW; x += blades) { const h = 6 + R() * 14; s.strokeStyle = R() < .5 ? bio.grass : bio.grassD; s.lineWidth = 1.4; s.beginPath(); s.moveTo(x, -26 + R() * 6); s.quadraticCurveTo(x + (R() - .5) * 4, -30 - h / 2, x + (R() - .5) * 8, -28 - h); s.stroke(); }
  if (S.biome === 'backyard') for (let i = 0; i < 40; i++) flower(s, R() * WW, -30 - R() * 10, R);
  if (S.biome === 'dunes') { s.strokeStyle = '#c9984e'; s.globalAlpha = .5; for (let i = 0; i < 60; i++) { const x = R() * WW, y = -4 - R() * 22; s.beginPath(); s.moveTo(x, y); s.quadraticCurveTo(x + 10, y - 3, x + 22, y); s.stroke(); } s.globalAlpha = 1; }
  if (bio.frost) { // thick snow blanket with drifts, frozen puddles and sparkles
    s.fillStyle = '#ffffff'; s.beginPath(); s.moveTo(0, -18); for (let x = 0; x <= WW; x += 10) s.lineTo(x, -30 - Math.abs(Math.sin(x * .021)) * 7 - Math.sin(x * .07) * 2); s.lineTo(WW, -18); s.fill();
    s.fillStyle = 'rgba(170,200,230,.45)'; s.fillRect(0, -20, WW, 3);
    for (let i = 0; i < 40; i++) { const x = R() * WW; s.fillStyle = '#ffffff'; s.beginPath(); s.ellipse(x, -32, 14 + R() * 22, 6 + R() * 5, 0, 0, 7); s.fill(); s.fillStyle = 'rgba(150,185,225,.35)'; s.beginPath(); s.ellipse(x + 6, -29, 10 + R() * 10, 2.5, 0, 0, 7); s.fill(); }
    for (let i = 0; i < 6; i++) { const x = 60 + R() * (WW - 120); s.fillStyle = '#bfe3f7'; s.beginPath(); s.ellipse(x, -12, 26 + R() * 14, 4, 0, 0, 7); s.fill(); s.fillStyle = 'rgba(255,255,255,.9)'; s.fillRect(x - 12, -13.5, 10, 1.2); }
    s.fillStyle = '#fff'; for (let i = 0; i < 160; i++) { const x = R() * WW, y = -4 - R() * 40; s.globalAlpha = .5 + R() * .5; s.fillRect(x - 1.5, y - .4, 3, .8); s.fillRect(x - .4, y - 1.5, .8, 3); } s.globalAlpha = 1; }
  if (bio.scen === 'palm') for (let i = 0; i < 24; i++) trinket(s, R() * WW, -10 - R() * 16, R() < .5 ? 'shell' : 'star', R);
  if (bio.scen === 'mars') { for (let i = 0; i < 50; i++) pebble(s, R() * WW, -6 - R() * 22, 2 + R() * 5, 1.5 + R() * 3, bio.rock, R() * 3); }
  if (bio.scen === 'ember') { s.strokeStyle = 'rgba(255,120,40,.8)'; s.lineWidth = 1.6; for (let i = 0; i < 20; i++) { let x = R() * WW, y = -4 - R() * 20; s.beginPath(); s.moveTo(x, y); for (let q = 0; q < 3; q++) { x += 8 + R() * 10; y += (R() - .5) * 6; s.lineTo(x, y); } s.stroke(); } }
  if (bio.scen === 'bloom' || bio.scen === 'woods') for (let i = 0; i < (bio.scen === 'bloom' ? 90 : 20); i++) flower(s, R() * WW, -30 - R() * 10, R);
  builtFor = S; nestDirty = true;
}
function pebble(k, x, y, rx, ry, cols, a) { const g = k.createRadialGradient(x - rx * .3, y - ry * .4, 1, x, y, Math.max(rx, ry)); g.addColorStop(0, shade(cols[0], .25)); g.addColorStop(.7, cols[0]); g.addColorStop(1, cols[1]);
  k.fillStyle = 'rgba(0,0,0,.22)'; k.beginPath(); k.ellipse(x + 1.5, y + 2, rx, ry, a, 0, 7); k.fill(); k.fillStyle = g; k.beginPath(); k.ellipse(x, y, rx, ry, a, 0, 7); k.fill(); }
function trinket(k, x, y, t, R) {
  k.save(); k.translate(x, y); k.rotate((R() - .5) * 1.2);
  if (t === 'cap') { k.fillStyle = '#c0392b'; k.beginPath(); k.arc(0, 0, 9, 0, 7); k.fill(); k.strokeStyle = '#e8b0a8'; k.lineWidth = 1; for (let a = 0; a < 6.28; a += .45) { k.beginPath(); k.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); k.lineTo(Math.cos(a) * 9.5, Math.sin(a) * 9.5); k.stroke(); } }
  else if (t === 'shell') { k.fillStyle = '#f1d9c0'; k.beginPath(); k.ellipse(0, 0, 9, 7, 0, 0, 7); k.fill(); k.strokeStyle = '#b8957a'; k.beginPath(); for (let a = 0; a < 12; a += .3) k.lineTo(Math.cos(a) * a * .7, Math.sin(a) * a * .55); k.stroke(); }
  else if (t === 'marble') { const g = k.createRadialGradient(-2, -2, 1, 0, 0, 6); g.addColorStop(0, '#d8f1ff'); g.addColorStop(1, '#2f7dc0'); k.fillStyle = g; k.beginPath(); k.arc(0, 0, 6, 0, 7); k.fill(); }
  else if (t === 'bone') { k.fillStyle = '#efe6d2'; k.fillRect(-9, -2, 18, 4); for (const s of [-1, 1]) { k.beginPath(); k.arc(s * 9, -2, 2.6, 0, 7); k.arc(s * 9, 2, 2.6, 0, 7); k.fill(); } }
  else if (t === 'bubble') { k.strokeStyle = 'rgba(255,255,255,.6)'; k.lineWidth = 1; for (let i = 0; i < 4; i++) { k.beginPath(); k.arc((R() - .5) * 14, (R() - .5) * 10, 1.5 + R() * 3, 0, 7); k.stroke(); } }
  else if (t === 'star') { k.fillStyle = '#ff9a6a'; k.beginPath(); for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5, r = j % 2 ? 3.5 : 9; k.lineTo(Math.cos(a) * r, Math.sin(a) * r); } k.fill(); }
  else if (t === 'gear') { k.fillStyle = '#a8b0bc'; k.beginPath(); for (let j = 0; j < 16; j++) { const a = j * Math.PI / 8, r = j % 2 ? 6 : 8.5; k.lineTo(Math.cos(a) * r, Math.sin(a) * r); } k.fill(); k.fillStyle = '#5a2a1a'; k.beginPath(); k.arc(0, 0, 2.5, 0, 7); k.fill(); }
  else if (t === 'acorn') { k.fillStyle = '#b8783a'; k.beginPath(); k.ellipse(0, 2, 5, 6, 0, 0, 7); k.fill(); k.fillStyle = '#6a4a28'; k.beginPath(); k.ellipse(0, -3, 5.6, 3.2, 0, 0, 7); k.fill(); }
  else if (t === 'ember') { k.fillStyle = 'rgba(255,140,40,.9)'; k.shadowColor = '#ff7a2a'; k.shadowBlur = 8; k.beginPath(); k.moveTo(0, -8); k.lineTo(6, 0); k.lineTo(0, 7); k.lineTo(-6, 0); k.fill(); k.shadowBlur = 0; }
  else if (t === 'crystal') { k.fillStyle = 'rgba(210,240,255,.85)'; k.beginPath(); k.moveTo(0, -10); k.lineTo(5, 0); k.lineTo(0, 9); k.lineTo(-5, 0); k.fill(); }
  k.restore(); }
function bush(s, x, y, r, col) { for (let i = 0; i < 5; i++) { s.fillStyle = shade(col, (i % 2 ? -.1 : .05)); s.beginPath(); s.arc(x + (i - 2) * r * .35, y - r * .4 - Math.sin(i) * r * .2, r * .45, 0, 7); s.fill(); } }
function cactus(s, x, y, h) { s.fillStyle = '#6f9a4f'; rr(s, x - 5, y - h, 10, h, 5); s.fill(); rr(s, x - 14, y - h * .7, 6, h * .35, 3); s.fill(); rr(s, x - 14, y - h * .42, 12, 5, 2.5); s.fill(); rr(s, x + 8, y - h * .8, 6, h * .3, 3); s.fill(); rr(s, x + 3, y - h * .55, 11, 5, 2.5); s.fill(); }
function pine(s, x, y, h, col, snow) { s.fillStyle = col || '#5f7f8f'; for (let i = 0; i < 3; i++) { s.beginPath(); s.moveTo(x, y - h + i * h * .25); s.lineTo(x - h * (.25 + i * .08), y - h * .45 + i * h * .25); s.lineTo(x + h * (.25 + i * .08), y - h * .45 + i * h * .25); s.fill(); }
  s.fillStyle = '#fff'; s.beginPath(); s.moveTo(x, y - h); s.lineTo(x - h * .1, y - h * .82); s.lineTo(x + h * .1, y - h * .82); s.fill();
  if (snow) for (let i = 0; i < 3; i++) { const yy = y - h * .45 + i * h * .25, w = h * (.25 + i * .08); s.beginPath(); s.moveTo(x - w, yy); s.quadraticCurveTo(x, yy - h * .12, x + w, yy); s.quadraticCurveTo(x, yy - h * .05, x - w, yy); s.fill(); } }
function snowman(s, x, y, k) { s.save(); s.translate(x, y); s.scale(k, k); s.fillStyle = 'rgba(120,160,210,.3)'; s.beginPath(); s.ellipse(3, 2, 20, 4, 0, 0, 7); s.fill(); s.fillStyle = '#fff';
  for (const [yy, r] of [[-12, 14], [-34, 10], [-50, 7]]) { s.beginPath(); s.arc(0, yy, r, 0, 7); s.fill(); }
  s.fillStyle = '#222'; for (const [dx, dy] of [[-2.5, -52], [2.5, -52], [0, -36], [0, -30]]) { s.beginPath(); s.arc(dx, dy, 1.3, 0, 7); s.fill(); } s.fillStyle = '#f08a2a'; s.beginPath(); s.moveTo(0, -49); s.lineTo(9, -48); s.lineTo(0, -46.5); s.fill();
  s.fillStyle = '#d8344a'; s.fillRect(-8, -44, 16, 3.5); s.fillRect(3, -44, 3.5, 10); s.fillStyle = '#2a2a3a'; s.fillRect(-7, -60, 14, 3); s.fillRect(-5, -70, 10, 10);
  s.strokeStyle = '#6a4a2a'; s.lineWidth = 1.6; s.beginPath(); s.moveTo(-9, -36); s.lineTo(-20, -44); s.moveTo(9, -36); s.lineTo(20, -44); s.stroke(); s.restore(); }
function palmTree(s, x, y, h, d) { s.strokeStyle = '#9a6a3a'; s.lineWidth = 6; s.lineCap = 'round'; s.beginPath(); s.moveTo(x, y); s.quadraticCurveTo(x + d * h * .25, y - h * .5, x + d * h * .2, y - h); s.stroke();
  const tx = x + d * h * .2, ty = y - h; for (let j = 0; j < 6; j++) { const a = -Math.PI / 2 + (j - 2.5) * .6; leafShape(s, tx + Math.cos(a) * h * .22, ty + Math.sin(a) * h * .12 + 6, h * .24, h * .05, a + (j < 3 ? -.3 : .3), j % 2 ? '#2f9a3a' : '#4ab048'); }
  s.fillStyle = '#6a4a20'; s.beginPath(); s.arc(tx - 3, ty + 4, 3.5, 0, 7); s.arc(tx + 4, ty + 5, 3.5, 0, 7); s.fill(); }
function rocket(s, x, y) { s.fillStyle = '#e8eef4'; s.beginPath(); s.moveTo(x, y - 80); s.quadraticCurveTo(x + 14, y - 60, x + 12, y - 10); s.lineTo(x - 12, y - 10); s.quadraticCurveTo(x - 14, y - 60, x, y - 80); s.fill();
  s.fillStyle = '#d8342a'; s.beginPath(); s.moveTo(x - 12, y - 24); s.lineTo(x - 22, y); s.lineTo(x - 10, y - 10); s.fill(); s.beginPath(); s.moveTo(x + 12, y - 24); s.lineTo(x + 22, y); s.lineTo(x + 10, y - 10); s.fill(); s.beginPath(); s.moveTo(x, y - 80); s.quadraticCurveTo(x + 8, y - 70, x + 9, y - 64); s.lineTo(x - 9, y - 64); s.quadraticCurveTo(x - 8, y - 70, x, y - 80); s.fill();
  s.fillStyle = '#4fb3e8'; s.beginPath(); s.arc(x, y - 48, 5, 0, 7); s.fill(); s.strokeStyle = '#8a96a4'; s.lineWidth = 2; s.stroke(); }
function deadTree(s, x, y, h) { s.strokeStyle = '#4a4a3a'; s.lineWidth = 5; s.lineCap = 'round'; s.beginPath(); s.moveTo(x, y); s.lineTo(x + 4, y - h); s.moveTo(x + 2, y - h * .55); s.lineTo(x - 18, y - h * .8); s.moveTo(x + 3, y - h * .7); s.lineTo(x + 20, y - h * .95); s.stroke(); }
function cattail(s, x, y, h) { s.strokeStyle = '#5a7a3a'; s.lineWidth = 1.4; s.beginPath(); s.moveTo(x, y); s.quadraticCurveTo(x + 2, y - h * .5, x + 1, y - h); s.stroke(); s.fillStyle = '#6a4a2a'; rr(s, x - 1.8, y - h - 2, 3.6, 9, 2); s.fill(); }
function volcano(s, x, y, h) { s.fillStyle = '#5a3a34'; s.beginPath(); s.moveTo(x - h * 1.1, y); s.lineTo(x - h * .18, y - h); s.lineTo(x + h * .18, y - h); s.lineTo(x + h * 1.1, y); s.fill();
  s.strokeStyle = '#ff7a2a'; s.lineWidth = 4; s.shadowColor = '#ff7a2a'; s.shadowBlur = 12; s.beginPath(); s.moveTo(x - 4, y - h); s.quadraticCurveTo(x - 20, y - h * .6, x - 10, y - h * .25); s.moveTo(x + 6, y - h); s.quadraticCurveTo(x + 22, y - h * .5, x + 30, y - h * .2); s.stroke(); s.shadowBlur = 0;
  s.fillStyle = 'rgba(255,150,60,.85)'; s.beginPath(); s.ellipse(x, y - h, h * .18, 6, 0, 0, 7); s.fill(); s.fillStyle = 'rgba(110,100,100,.55)'; for (let j = 0; j < 5; j++) { s.beginPath(); s.arc(x + j * 12 - 10, y - h - 20 - j * 22, 16 + j * 6, 0, 7); s.fill(); } }
function bigFlower(s, x, y, h, col) { s.strokeStyle = '#3f8a2a'; s.lineWidth = 2.5; s.beginPath(); s.moveTo(x, y); s.lineTo(x, y - h); s.stroke(); leafShape(s, x + 7, y - h * .4, 8, 3, -.5, '#4aa83a'); s.fillStyle = col;
  for (let a = 0; a < 6.28; a += 1.05) { s.beginPath(); s.arc(x + Math.cos(a) * 7, y - h + Math.sin(a) * 7, 6, 0, 7); s.fill(); } s.fillStyle = '#f2b01e'; s.beginPath(); s.arc(x, y - h, 5, 0, 7); s.fill(); }
function flower(s, x, y, R) { s.strokeStyle = '#3f8a2a'; s.lineWidth = 1; s.beginPath(); s.moveTo(x, -24); s.lineTo(x, y); s.stroke(); const col = ['#fff4f4', '#ffd84a', '#f7a1c4', '#b9a6ff'][Math.floor(R() * 4)]; s.fillStyle = col;
  for (let a = 0; a < 6.28; a += 1.256) { s.beginPath(); s.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, 7); s.fill(); } s.fillStyle = '#f2b01e'; s.beginPath(); s.arc(x, y, 1.6, 0, 7); s.fill(); }

// ---------- nest (soil + carved tunnels + lit rooms) ----------
function redrawNest() {
  if (!nestCv) nestCv = mk(WW * RS, WH * RS);
  const k = nestCv.getContext('2d'), bio = B(); k.setTransform(1, 0, 0, 1, 0, 0); k.clearRect(0, 0, nestCv.width, nestCv.height); k.drawImage(soilCv, 0, 0); k.setTransform(RS, 0, 0, RS, 0, 0);
  const g = S.grid, open = i => g[i] === DUG;
  const carve = (pad, rad, fill) => { k.fillStyle = fill; k.beginPath();
    for (let i = 0; i < NC; i++) { if (!open(i)) continue; const x = cx(i) * CS, y = cy(i) * CS; const r = S.room[i] ? roomById(S.room[i]) : null;
      if (k.roundRect) k.roundRect(x - pad, y - pad, CS + pad * 2, CS + pad * 2, rad); else k.rect(x - pad, y - pad, CS + pad * 2, CS + pad * 2);
      if (cx(i) < COLS - 1 && open(i + 1)) k.rect(x + CS / 2, y - pad + (r && S.room[i + 1] === S.room[i] ? 0 : 2), CS, CS + pad * 2 - (r && S.room[i + 1] === S.room[i] ? 0 : 4));
      if (cy(i) < ROWS - 1 && open(i + COLS)) k.rect(x - pad + 2, y + CS / 2, CS + pad * 2 - 4, CS); }
    k.fill(); };
  carve(7, 13, 'rgba(0,0,0,.16)'); carve(5, 12, 'rgba(0,0,0,.18)'); carve(3.5, 10, bio.rim);
  const tg = k.createLinearGradient(0, 0, 0, WH); tg.addColorStop(0, bio.tun[0]); tg.addColorStop(1, bio.tun[1]); carve(1, 8, tg);
  // floors (lighter packed dirt) + ceilings (shadow)
  for (let i = 0; i < NC; i++) { if (!open(i)) continue; const x = cx(i) * CS, y = cy(i) * CS;
    if (cy(i) < ROWS - 1 && !open(i + COLS)) { k.fillStyle = bio.frost ? '#eaf4fc' : shade(bio.soil[layer(cy(i))], -.35); rr(k, x - 1, y + CS - 6, CS + 2, 6, 3); k.fill(); k.fillStyle = 'rgba(255,255,255,.06)'; k.fillRect(x, y + CS - 6, CS, 1.5); }
    if (cy(i) > 0 && !open(i - COLS)) { const sg = k.createLinearGradient(0, y, 0, y + 8); sg.addColorStop(0, 'rgba(0,0,0,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); k.fillStyle = sg; k.fillRect(x - 1, y - 1, CS + 2, 9); } }
  if (bio.frost) { const R2 = mulberry(S.seed + 11); k.fillStyle = 'rgba(235,247,255,.92)';   // icicles hang from the tunnel ceilings
    for (let i = 0; i < NC; i++) { if (!open(i) || cy(i) === 0 || open(i - COLS)) continue; const x = cx(i) * CS, y = cy(i) * CS; for (let j = 0; j < 3; j++) { const ix = x + 4 + j * 8 + (R2() - .5) * 3, L = 3 + R2() * 6; k.beginPath(); k.moveTo(ix - 2, y); k.lineTo(ix + 2, y); k.lineTo(ix, y + L); k.fill(); } }
    k.strokeStyle = 'rgba(200,232,255,.35)'; k.lineWidth = 1; for (let i = 0; i < NC; i++) { if (!open(i) || R2() < .6) continue; const x = cx(i) * CS + R2() * CS, y = cy(i) * CS + 4 + R2() * 12; k.beginPath(); k.moveTo(x - 3, y); k.lineTo(x + 3, y); k.moveTo(x, y - 3); k.lineTo(x, y + 3); k.stroke(); } }
  // rooms: warm light + furniture
  for (const r of S.rooms) { const x = r.x * CS, y = r.y * CS, w = r.w * CS, h = r.h * CS, cxr = x + w / 2, cyr = y + h / 2;
    k.save(); rr(k, x - 1, y - 1, w + 2, h + 2, 12); k.clip();
    const col = r.k === 'sump' ? '#7fc4ff' : r.k === 'garden' ? '#c8f08a' : r.k === 'barracks' ? '#ffb27a' : bio.glow;
    const rg = k.createRadialGradient(cxr, cyr - h * .2, 2, cxr, cyr, Math.max(w, h) * .75); rg.addColorStop(0, hexA(col, r.done ? .55 : .18)); rg.addColorStop(1, hexA(col, 0)); k.fillStyle = rg; k.fillRect(x, y, w, h);
    if (r.done) furniture(k, r, x, y, w, h); k.restore(); }
  nestDirty = false;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }
function furniture(k, r, x, y, w, h) {
  const fy = y + h - 5; k.lineCap = 'round';
  // straw floor
  k.strokeStyle = 'rgba(230,200,120,.35)'; k.lineWidth = 1; for (let i = 0; i < w / 3; i++) { const sx = x + 3 + i * 3; k.beginPath(); k.moveTo(sx, fy + 2); k.lineTo(sx + 4, fy - 1); k.stroke(); }
  if (r.k === 'home' || r.k === 'queen') { k.fillStyle = '#b44a5a'; rr(k, x + w / 2 - 22, fy - 7, 44, 9, 5); k.fill(); k.fillStyle = '#e07a8a'; rr(k, x + w / 2 - 20, fy - 8, 40, 4, 3); k.fill();
    if (r.k === 'queen') { k.fillStyle = '#f2c14e'; k.beginPath(); const cxr = x + w / 2, ty = y + 10; k.moveTo(cxr - 9, ty + 8); k.lineTo(cxr - 9, ty); k.lineTo(cxr - 4.5, ty + 4); k.lineTo(cxr, ty - 2); k.lineTo(cxr + 4.5, ty + 4); k.lineTo(cxr + 9, ty); k.lineTo(cxr + 9, ty + 8); k.fill(); } }
  if (r.k === 'barracks') { for (let i = 0; i < 3; i++) { const sx = x + 14 + i * 26; k.fillStyle = '#9a8f84'; k.beginPath(); k.ellipse(sx, fy - 7, 6, 8, 0, 0, 7); k.fill(); k.strokeStyle = '#d8cfc4'; k.lineWidth = 1.2; k.beginPath(); k.moveTo(sx, fy - 13); k.lineTo(sx, fy - 1); k.stroke(); }
    k.strokeStyle = '#c9a36e'; k.lineWidth = 2; k.beginPath(); k.moveTo(x + w - 16, fy); k.lineTo(x + w - 8, y + 8); k.stroke(); }
  if (r.k === 'lookout') { k.strokeStyle = '#d9b26a'; k.lineWidth = 3; k.beginPath(); k.moveTo(x + w / 2, fy); k.lineTo(x + w / 2, y + 4); k.lineTo(x + w / 2 + 8, y + 4); k.stroke(); }
  if (r.k === 'den') { for (let i = 0; i < 3; i++) leafShape(k, x + 12 + i * 24, fy - 3, 11, 4, 0, '#7fae4e'); }
  if (r.k === 'nursery') { for (let i = 0; i < 3; i++) { k.fillStyle = '#e8c9a0'; k.beginPath(); k.ellipse(x + 12 + i * 24, fy - 4, 9, 5, 0, 0, Math.PI); k.fill(); } }
  if (r.k === 'sump') { k.strokeStyle = '#8a8f99'; k.lineWidth = 2; for (let i = 0; i < 5; i++) { k.beginPath(); k.moveTo(x + 8 + i * 8, fy - 2); k.lineTo(x + 8 + i * 8, fy + 3); k.stroke(); } }
  if (r.k === 'garden') { k.fillStyle = '#6a4a2a'; rr(k, x + 6, fy - 10, w - 12, 12, 6); k.fill(); }
  if (r.k === 'storage' || r.k === 'pantry') { k.fillStyle = '#7a5530'; for (let i = 0; i < (r.k === 'pantry' ? 4 : 2); i++) { rr(k, x + 8 + i * 22, fy - 3, 18, 4, 2); k.fill(); } }
}
function leafShape(k, x, y, l, w, a, col) { k.save(); k.translate(x, y); k.rotate(a); k.fillStyle = col; k.beginPath(); k.moveTo(-l, 0); k.quadraticCurveTo(0, -w * 2, l, 0); k.quadraticCurveTo(0, w * 2, -l, 0); k.fill(); k.strokeStyle = 'rgba(0,0,0,.25)'; k.lineWidth = .6; k.beginPath(); k.moveTo(-l, 0); k.lineTo(l, 0); k.stroke(); k.restore(); }

// ---------- ants ----------
const FOODC = { berry: ['#ff8a9a', '#b8162e'], mango: ['#ffd27a', '#e8771c'], frostberry: ['#e0f2ff', '#3f7fd0'], nectar: ['#fff2a8', '#e8a614'], chili: ['#ff9a7a', '#c8261a'], starfruit: ['#fff6a0', '#e2b21a'] };
const ANT_COL = { worker: ['#9a4524', '#5e2512'], harvester: ['#c27428', '#7a4314'], cutter: ['#8a6a24', '#4f3a10'], soldier: ['#5a2a16', '#2e1308'], queen: ['#a8452a', '#5a1f10'], raider: ['#3a3550', '#18162a'], guard: ['#4e2d57', '#21122a'] };
function drawAnt(k, u, t) {
  const col = ANT_COL[u.k] || ANT_COL.worker, s = 1.3 * (u.k === 'soldier' ? 1.22 : u.k === 'queen' ? 1.8 : u.k === 'guard' ? 1.15 : u.k === 'raider' ? 1.08 : 1);
  // smooth heading
  let d = u.ang - u.ra; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; u.ra += d * .25;
  const under = isUnder(u.y);
  k.save(); k.translate(u.x, u.y);
  if (!under || Math.abs(Math.sin(u.ra)) < .5) { k.fillStyle = 'rgba(0,0,0,.22)'; k.beginPath(); k.ellipse(0, 4.4 * s, 7 * s, 1.6 * s, 0, 0, 7); k.fill(); }
  k.rotate(u.ra); if (Math.cos(u.ra) < 0) k.scale(1, -1); k.scale(s, s);
  const ph = u.ph, mv = u.mv || u.dig || u.atk > 0;
  const lunge = u.atk > 0 ? Math.sin(t * 30) * 1.2 : 0; k.translate(lunge, 0);
  const leg = (bx, side, j) => { const sw = mv ? Math.sin(ph + j * 2.1 + side * Math.PI) * 2.2 : 0; const kx = bx + (j - 1) * 1.2 + sw * .4, ky = -1.6 - (mv ? Math.max(0, Math.cos(ph + j * 2.1 + side * Math.PI)) * .8 : 0);
    k.beginPath(); k.moveTo(bx, .6); k.lineTo(kx + (j - 1) * 1.5, ky + 2.2); k.lineTo(bx + (j - 1) * 3.4 + sw, 4.3); k.stroke(); };
  k.lineCap = 'round'; k.lineJoin = 'round';
  // far legs
  k.strokeStyle = shade(col[1], -.25); k.lineWidth = .9; for (let j = 0; j < 3; j++) leg(.4 + j * 1.3, 1, j);
  // body
  const gx = u.k === 'queen' ? -6.3 : -5;
  k.fillStyle = col[1]; k.beginPath(); k.ellipse(gx, -.4, u.k === 'queen' ? 5.6 : 4.2, u.k === 'queen' ? 3.6 : 3.1, -.12, 0, 7); k.fill();
  const gg = k.createRadialGradient(gx - 1, -2, .5, gx, -.4, 4.4); gg.addColorStop(0, shade(col[0], .35)); gg.addColorStop(1, col[0]); k.fillStyle = gg; k.beginPath(); k.ellipse(gx, -.6, u.k === 'queen' ? 5.3 : 3.9, u.k === 'queen' ? 3.3 : 2.8, -.12, 0, 7); k.fill();
  k.strokeStyle = 'rgba(0,0,0,.25)'; k.lineWidth = .5; for (let j = 0; j < 2; j++) { k.beginPath(); k.arc(gx + 1.2 - j * 1.8, -.6, 2.6, -1.1, 1.1); k.stroke(); }
  k.fillStyle = col[1]; k.beginPath(); k.arc(-1.3, .1, 1.05, 0, 7); k.fill();
  k.fillStyle = col[0]; k.beginPath(); k.ellipse(1.1, -.3, 2.4, 1.6, -.15, 0, 7); k.fill();
  if (u.k === 'queen') { k.fillStyle = 'rgba(230,240,255,.55)'; k.beginPath(); k.ellipse(-3, -3.5, 4.5, 1.6, -.35, 0, 7); k.fill(); }
  const hr = u.k === 'soldier' || u.k === 'guard' ? 2.7 : 2.05;
  k.fillStyle = col[0]; k.beginPath(); k.arc(4 + hr * .55, -.9, hr, 0, 7); k.fill();
  k.fillStyle = 'rgba(255,255,255,.35)'; k.beginPath(); k.ellipse(gx - 1, -2.2, 1.6, .8, -.3, 0, 7); k.fill();
  k.fillStyle = '#111'; k.beginPath(); k.arc(5 + hr * .5, -1.6, .65, 0, 7); k.fill(); k.fillStyle = '#fff'; k.fillRect(5.1 + hr * .5, -1.9, .35, .35);
  // mandibles
  k.strokeStyle = col[1]; k.lineWidth = u.k === 'soldier' || u.k === 'guard' ? 1.1 : .7; const mo = u.atk > 0 || u.dig ? Math.sin(t * 22) * .6 : 0;
  k.beginPath(); k.moveTo(4 + hr * 1.3, -.4); k.quadraticCurveTo(6.5 + hr, .2 + mo, 5.6 + hr, 1.3 + mo); k.stroke();
  // antennae
  const aw = Math.sin(t * 3 + u.id) * .6; k.strokeStyle = col[1]; k.lineWidth = .55;
  k.beginPath(); k.moveTo(4.2 + hr * .5, -2.4); k.lineTo(5.6 + hr * .4, -5 + aw); k.lineTo(8.4 + hr * .4, -4.4 - aw); k.stroke();
  // near legs
  k.strokeStyle = col[1]; k.lineWidth = 1; for (let j = 0; j < 3; j++) leg(-.2 + j * 1.3, 0, j);
  // carried stuff
  if (u.carry > 0) {
    if (u.k === 'cutter') leafShape(k, 1, -6.5, 6, 3.2, -.5, '#6dbf4b');
    else { k.fillStyle = FOODC[u.cs] ? FOODC[u.cs][1] : u.cs === 'seed' ? '#d8b46a' : u.cs === 'date' || u.cs === 'acorn' ? '#8a4a22' : '#f2d28c'; k.beginPath(); k.arc(8.3 + hr * .4, -.4, 2.1, 0, 7); k.fill(); k.fillStyle = 'rgba(255,255,255,.5)'; k.fillRect(7.8 + hr * .4, -1.4, .8, .8); } }
  if (u.k === 'raider' && u.carry > 0) { k.fillStyle = '#f2d28c'; k.beginPath(); k.arc(8.3 + hr * .4, -.4, 2, 0, 7); k.fill(); }
  k.restore();
  if (u.hp < u.max - .5) hpBar(k, u.x, u.y - 9 * s, 12, u.hp / u.max);
  if (u.train > 0) { k.fillStyle = '#fff'; k.font = '7px sans-serif'; k.textAlign = 'center'; k.fillText('training', u.x, u.y - 10); }
}
function hpBar(k, x, y, w, f) { k.fillStyle = 'rgba(0,0,0,.55)'; k.fillRect(x - w / 2 - .5, y - .5, w + 1, 3); k.fillStyle = f > .5 ? '#6fd04a' : f > .25 ? '#f0c030' : '#f04a3a'; k.fillRect(x - w / 2, y, w * Math.max(0, f), 2); }
function drawEgg(k, x, y, f, t) { const wob = Math.sin(t * 2 + x) * .08 * f; k.save(); k.translate(x, y); k.rotate(wob); const g = k.createRadialGradient(-1, -2, .5, 0, 0, 4.5); g.addColorStop(0, '#fffdf4'); g.addColorStop(1, '#e9dcbc'); k.fillStyle = g; k.beginPath(); k.ellipse(0, 0, 2.8, 3.8, 0, 0, 7); k.fill();
  if (f > .6) { k.strokeStyle = 'rgba(120,90,60,.5)'; k.lineWidth = .4; k.beginPath(); k.moveTo(-2, -1); k.lineTo(-.5, 0); k.lineTo(.8, -1.2); k.stroke(); } k.restore(); }

// ---------- surface things ----------
function drawItem(k, it, t) {
  const x = it.x, y = -6, f = it.amt / it.max;
  if (it.k === 'plant') {
    const sp = it.sub, n = Math.max(1, Math.round(5 * f + 1));
    if (sp === 'clover') { k.strokeStyle = '#3f8a2a'; k.lineWidth = 1.6; for (let j = 0; j < n; j++) { const a = -Math.PI / 2 + (j - n / 2) * .35, L = 22 + j % 2 * 8; const ex = x + Math.cos(a) * L * .6, ey = y + Math.sin(a) * L;
        k.beginPath(); k.moveTo(x, y + 4); k.quadraticCurveTo(x + (ex - x) * .3, y - L * .5, ex, ey); k.stroke(); for (let q = 0; q < 3; q++) { const qa = q * 2.09 + t * .3 + j; k.fillStyle = q % 2 ? '#5fb543' : '#4ea338'; k.beginPath(); k.ellipse(ex + Math.cos(qa) * 3.6, ey + Math.sin(qa) * 3.6, 4.4, 3.3, qa, 0, 7); k.fill(); } } }
    else if (sp === 'succulent') { for (let j = 0; j < n + 2; j++) { const a = -Math.PI / 2 + (j - (n + 1) / 2) * .38; leafShape(k, x + Math.cos(a) * 9, y + Math.sin(a) * 9 + 2, 9, 3.6, a, j % 2 ? '#87b56a' : '#9cc97a'); } }
    else if (sp === 'fern') { k.strokeStyle = '#3f7a35'; k.lineWidth = 1.3; for (let j = 0; j < n + 1; j++) { const a = -Math.PI / 2 + (j - n / 2) * .4, L = 20 + j % 2 * 6, ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L; k.beginPath(); k.moveTo(x, y + 3); k.lineTo(ex, ey); k.stroke(); for (let q = 1; q < 5; q++) leafShape(k, x + (ex - x) * q / 5, y + (ey - y) * q / 5, 3.4, 1.4, a + (q % 2 ? 1 : -1), '#4f9a3f'); } }
    else if (sp === 'reed') { for (let j = 0; j < n + 2; j++) { const bx = x + (j - (n + 1) / 2) * 3.2, h = 16 + (j * 7 % 10); k.strokeStyle = j % 2 ? '#6a8f3a' : '#8aa84a'; k.lineWidth = 1.6; k.beginPath(); k.moveTo(bx, y + 3); k.quadraticCurveTo(bx + 2, y - h * .5, bx + Math.sin(t + j) * 1.5, y - h); k.stroke(); if (j % 3 === 0) { k.fillStyle = '#7a5530'; rr(k, bx - 1.6, y - h - 2, 3.2, 7, 1.6); k.fill(); } } }
    else if (sp === 'crystal') { for (let j = 0; j < n + 1; j++) { const bx = x + (j - n / 2) * 4.4, h = 8 + (j * 5 % 9); k.fillStyle = B().scen === 'ember' ? (j % 2 ? '#ff9a4a' : '#ffcf6a') : (j % 2 ? '#7fe8ff' : '#c9a0ff'); k.globalAlpha = .9; k.beginPath(); k.moveTo(bx, y - h); k.lineTo(bx + 3, y - h * .4); k.lineTo(bx, y + 3); k.lineTo(bx - 3, y - h * .4); k.fill(); } k.globalAlpha = 1; }
    else if (sp === 'flower') { for (let j = 0; j < n + 1; j++) { const bx = x + (j - n / 2) * 5, h = 10 + (j * 7 % 10); k.strokeStyle = '#3f8a2a'; k.lineWidth = 1; k.beginPath(); k.moveTo(bx, y + 3); k.lineTo(bx, y - h); k.stroke(); k.fillStyle = ['#ff7ab0', '#ffd84a', '#b98aff', '#ff9a5a'][j % 4]; for (let a = 0; a < 6.28; a += 1.256) { k.beginPath(); k.arc(bx + Math.cos(a) * 2.6, y - h + Math.sin(a) * 2.6, 2, 0, 7); k.fill(); } k.fillStyle = '#f2b01e'; k.beginPath(); k.arc(bx, y - h, 1.5, 0, 7); k.fill(); } }
    else { for (let j = 0; j < n + 2; j++) { k.fillStyle = j % 2 ? '#5e9a7a' : '#77b392'; k.beginPath(); k.arc(x + (j - (n + 1) / 2) * 4.2, y - 2 - Math.abs(Math.sin(j * 1.7)) * 6, 4.5, 0, 7); k.fill(); } k.fillStyle = '#fff'; k.globalAlpha = .7; k.fillRect(x - 8, y - 8, 16, 1.4); k.globalAlpha = 1; }
    return; }
  const sz = 4 + Math.sqrt(it.amt) * 1.2;
  k.fillStyle = 'rgba(0,0,0,.2)'; k.beginPath(); k.ellipse(x, y + 4, sz * 1.1, 2.2, 0, 0, 7); k.fill();
  if (FOODC[it.sub]) { const fc = FOODC[it.sub]; for (let j = 0; j < Math.max(1, Math.round(sz / 2.6)); j++) { const bx = x + Math.cos(j * 2.4) * sz * .45, by = y - Math.abs(Math.sin(j * 1.3)) * sz * .5; const g = k.createRadialGradient(bx - 1.5, by - 1.5, .5, bx, by, 4.5); g.addColorStop(0, fc[0]); g.addColorStop(1, fc[1]); k.fillStyle = g; k.beginPath(); k.arc(bx, by, 4.2, 0, 7); k.fill(); }
    k.fillStyle = '#3f8a2a'; k.fillRect(x - 1, y - sz * .9, 2, 4); }
  else if (it.sub === 'seed' || it.sub === 'date' || it.sub === 'acorn') { for (let j = 0; j < Math.max(1, Math.round(sz / 2.2)); j++) { k.fillStyle = it.sub === 'acorn' ? (j % 2 ? '#b8783a' : '#6a4a28') : it.sub === 'date' ? (j % 2 ? '#8a4a22' : '#a35a2a') : (j % 2 ? '#d8b46a' : '#c49a50'); k.beginPath(); k.ellipse(x + (j - sz / 4.4) * 3.4, y - (j % 3) * 2.4, 3.6, 2.2, j, 0, 7); k.fill(); } }
  else { k.fillStyle = '#e8c27e'; k.beginPath(); for (let a = 0; a < 6.28; a += .9) { const rr2 = sz * (.75 + Math.sin(a * 3 + it.id) * .2); k.lineTo(x + Math.cos(a) * rr2, y - sz * .35 + Math.sin(a) * rr2 * .7); } k.fill(); k.fillStyle = '#c8955a'; for (let j = 0; j < 5; j++) k.fillRect(x + Math.cos(j * 2.2) * sz * .45, y - sz * .4 + Math.sin(j * 1.7) * sz * .3, 1.4, 1.4); k.fillStyle = 'rgba(255,255,255,.35)'; k.beginPath(); k.ellipse(x - sz * .25, y - sz * .7, sz * .3, sz * .15, -.3, 0, 7); k.fill(); }
  if (B().frost) { k.fillStyle = 'rgba(255,255,255,.92)'; k.beginPath(); k.ellipse(x, y - sz * .75, sz * .8, sz * .28, 0, 0, 7); k.fill(); }   // snow caps
  if (S.forage === it.id) { k.strokeStyle = 'rgba(255,240,150,' + (.5 + .4 * Math.sin(t * 5)) + ')'; k.lineWidth = 2; k.beginPath(); k.ellipse(x, y, sz + 7, sz * .6 + 6, 0, 0, 7); k.stroke(); }
}
function drawHill(k, t) {
  const h = S.hill, x = h.x, f = h.dead ? .35 : 1;
  k.fillStyle = 'rgba(0,0,0,.25)'; k.beginPath(); k.ellipse(x, -1, 56, 6, 0, 0, 7); k.fill();
  const g = k.createLinearGradient(0, -60 * f, 0, 0); g.addColorStop(0, '#8a5240'); g.addColorStop(1, '#54281e'); k.fillStyle = g;
  k.beginPath(); k.moveTo(x - 56, 0); k.quadraticCurveTo(x - 30, -58 * f, x, -60 * f); k.quadraticCurveTo(x + 30, -58 * f, x + 56, 0); k.fill();
  k.fillStyle = 'rgba(255,255,255,.08)'; for (let j = 0; j < 30; j++) k.fillRect(x - 40 + (j * 37 % 80), -5 - (j * 13 % 40) * f, 2, 2);
  if (!h.dead) { k.fillStyle = '#1a0c08'; k.beginPath(); k.ellipse(x, -58, 7, 3, 0, 0, 7); k.fill();
    k.strokeStyle = '#6b4a2a'; k.lineWidth = 2; k.beginPath(); k.moveTo(x + 8, -56); k.lineTo(x + 12, -96); k.stroke();
    k.fillStyle = '#c0392b'; k.beginPath(); k.moveTo(x + 12, -96); k.quadraticCurveTo(x + 24, -92 + Math.sin(t * 4) * 2, x + 34, -94); k.lineTo(x + 12, -82); k.fill();
    if (h.hp < h.max) hpBar(k, x, -112, 60, h.hp / h.max); }
  else { k.fillStyle = '#fff'; k.font = '700 12px sans-serif'; k.textAlign = 'center'; k.fillText('🏳️ conquered', x, -36); }
}
let clouds = null;
function drawSky(k, t) {
  const bio = B(), dark = S.rain.on ? .45 : S.haz.on ? .3 : 0;
  const g = k.createLinearGradient(0, -SURF_H, 0, -20); g.addColorStop(0, shade(bio.sky[0], -dark)); g.addColorStop(1, shade(bio.sky[1], -dark * .8)); k.fillStyle = g; k.fillRect(-400, -SURF_H - 600, WW + 800, SURF_H + 600);
  if (bio.scen === 'mars') { k.fillStyle = '#fff'; for (let j = 0; j < 90; j++) { k.globalAlpha = .4 + .4 * Math.sin(t * 2 + j); k.fillRect((j * 97.3) % WW, -SURF_H - 200 + (j * 53.7) % 360, 1.6, 1.6); } k.globalAlpha = 1;
    k.fillStyle = '#e8d8c8'; k.beginPath(); k.arc(WW * .65, -250, 18, 0, 7); k.fill(); k.fillStyle = '#b8a898'; k.beginPath(); k.arc(WW * .4, -220, 9, 0, 7); k.fill(); }
  if (bio.scen === 'bloom' && !S.rain.on) { const cs = ['#ff5a5a', '#ffa54a', '#ffe84a', '#6ad86a', '#4ab0ff', '#9a7aff']; k.lineWidth = 9; k.globalAlpha = .45; for (let j = 0; j < 6; j++) { k.strokeStyle = cs[j]; k.beginPath(); k.arc(WW * .5, 60, 520 - j * 9, Math.PI, 0); k.stroke(); } k.globalAlpha = 1; }
  if (!S.rain.on && bio.scen !== 'mars') { k.fillStyle = 'rgba(255,240,180,.35)'; k.beginPath(); k.arc(WW * .72, -240, 46, 0, 7); k.fill(); k.fillStyle = '#fff4c2'; k.beginPath(); k.arc(WW * .72, -240, 26, 0, 7); k.fill(); }
  if (!clouds) clouds = Array.from({ length: 9 }, (_, i) => ({ x: i * WW / 8, y: -260 + (i * 37 % 80), s: .7 + (i * 13 % 7) / 10 }));
  for (const cl of clouds) { const x = (cl.x + t * 6 * cl.s) % (WW + 200) - 100; k.fillStyle = S.rain.on ? 'rgba(120,130,150,.9)' : 'rgba(255,255,255,.85)';
    for (let j = 0; j < 4; j++) { k.beginPath(); k.arc(x + j * 16 * cl.s, cl.y - Math.sin(j * 1.3) * 8 * cl.s, 16 * cl.s, 0, 7); k.fill(); } }
}

// ---------- main render ----------
let lastT = 0, lastNest = -1;
function render(t) {
  if (!S) return; if (builtFor !== S) buildStatic(); if (nestDirty && (t - lastNest > .22 || t < lastNest)) { lastNest = t; redrawNest(); }
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = B().tun[1]; c.fillRect(0, 0, W, H);
  const o = w2s(0, 0); c.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, o.x * DPR, o.y * DPR);
  const tl = s2w(0, 0), br = s2w(W, H), vis = (x, y, m) => x > tl.x - m && x < br.x + m && y > tl.y - m && y < br.y + m;
  if (tl.y < 0) { drawSky(c, t); c.drawImage(surfCv, 0, -SURF_H, WW, SURF_H);
    if (!S.hill.dead || true) drawHill(c, t);
    for (const it of S.items) if (vis(it.x, -10, 60)) drawItem(c, it, t); }
  if (br.y > 0) c.drawImage(nestCv, 0, 0, WW, WH);
  // entrance mound
  c.fillStyle = shade(B().soil[0], -.15); c.beginPath(); c.moveTo(ENTX - 26, 1); c.quadraticCurveTo(ENTX - 12, -12, ENTX - 6, -8); c.lineTo(ENTX + 6, -8); c.quadraticCurveTo(ENTX + 12, -12, ENTX + 26, 1); c.fill();
  c.fillStyle = B().tun[1]; c.beginPath(); c.ellipse(ENTX, -3, 7, 4, 0, 0, 7); c.fill();
  // planned digs
  for (let i = 0; i < NC; i++) { if (S.grid[i] !== PLAN) continue; const x = cx(i) * CS, y = cy(i) * CS; if (!vis(x, y, CS)) continue;
    c.fillStyle = S.room[i] ? 'rgba(255,214,120,.18)' : 'rgba(255,240,190,.13)'; c.fillRect(x + 1, y + 1, CS - 2, CS - 2);
    c.setLineDash([3, 3]); c.lineDashOffset = -t * 8; c.strokeStyle = S.room[i] ? 'rgba(255,214,120,.8)' : 'rgba(255,250,220,.65)'; c.lineWidth = 1.2; c.strokeRect(x + 2, y + 2, CS - 4, CS - 4); c.setLineDash([]);
    const p = S.digp[i]; if (p > 0) { c.fillStyle = 'rgba(30,15,5,' + (.25 + p * .5) + ')'; c.beginPath(); c.arc(x + CS / 2, y + CS / 2, p * CS * .48, 0, 7); c.fill(); } }
  // water
  const wc = B().water;
  for (let i = 0; i < NC; i++) { const v = wl[i]; if (v < .02) continue; const x = cx(i) * CS, y = cy(i) * CS; if (!vis(x, y, CS)) continue;
    const top = y + CS * (1 - v); c.fillStyle = `rgba(${wc},.62)`; c.fillRect(x - 1, top, CS + 2, y + CS - top + 1);
    if (v < .98 || (cy(i) > 0 && wl[i - COLS] < .02)) { c.fillStyle = `rgba(255,255,255,.45)`; c.fillRect(x - 1, top + Math.sin(t * 3 + x * .2) * .8, CS + 2, 1.3); } }
  // room contents: eggs, food piles, garden fungus, labels
  for (const r of S.rooms) { const x = r.x * CS, y = r.y * CS, w = r.w * CS, h = r.h * CS; if (!vis(x + w / 2, y + h / 2, w)) continue;
    if (r.done && ROOMS[r.k].cap) { const n = Math.round(clamp(S.res.food / Math.max(1, foodCap()), 0, 1) * (r.w * 3)); for (let j = 0; j < n; j++) { c.fillStyle = j % 3 ? '#f0c776' : '#e09a4a'; c.beginPath(); c.arc(x + 8 + (j % (r.w * 3)) * 7.2 * (r.w * CS - 16) / (r.w * 3 * 7.2), y + h - 8 - (j % 2) * 3, 3.2, 0, 7); c.fill(); } }
    if (r.k === 'garden' && r.done) { const n = 3 + Math.round((S.res.leaves > 0 ? 1 : 0) * 3 + (r.grow || 0) * 4); for (let j = 0; j < n; j++) { const fx = x + 12 + j * (w - 24) / Math.max(1, n - 1), fy = y + h - 14 - Math.abs(Math.sin(j * 2.1)) * 6; c.fillStyle = j % 2 ? '#f3efe2' : '#e6dcc4'; c.beginPath(); c.arc(fx, fy, 4 + (j % 3), Math.PI, 0); c.fill(); c.fillStyle = '#d9cfb8'; c.fillRect(fx - 1, fy, 2, 6); }
      if (S.res.leaves > 0) for (let j = 0; j < Math.min(6, S.res.leaves); j++) leafShape(c, x + 14 + j * 9, y + h - 6, 4, 2, .3 * j, '#6dbf4b'); }
    if (!r.done) { const cells = roomCells(r), dn = cells.filter(i => S.grid[i] === DUG).length; c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, x + w / 2 - 26, y - 13, 52, 11, 5); c.fill(); c.fillStyle = '#ffd36b'; c.fillRect(x + w / 2 - 23, y - 9, 46 * dn / cells.length, 4); }
    if (r.fl) { c.fillStyle = '#fff'; c.font = '700 9px sans-serif'; c.textAlign = 'center'; c.fillText('💧 FLOODED', x + w / 2, y + 10); }
    if (cam.z > .55) { c.font = '600 8px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,248,225,.75)'; c.fillText(ROOMS[r.k].icon + ' ' + ROOMS[r.k].name, x + w / 2, y + h + 9); } }
  for (const g of S.eggs) { const r = roomById(g.rid) || homeRoom(); const x = (r.x + .4 + g.ox * (r.w - .8)) * CS, y = (r.y + r.h) * CS - 6 - g.oy * 3; if (vis(x, y, 10)) drawEgg(c, x, y, g.t / 40, t); }
  // units
  for (const u of S.units) { if (!vis(u.x, u.y, 30)) continue; if (u.tm === 1 && !isUnder(u.y) && !S.fog[clamp(Math.floor(u.x / CS), 0, COLS - 1)]) continue;
    if (UI.sel.includes(u.id)) { c.strokeStyle = '#ffe066'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(u.x, u.y + 3, 10, 4, 0, 0, 7); c.stroke(); }
    drawAnt(c, u, t); }
  // particles
  for (const p of parts) { c.globalAlpha = clamp(p.t * 2, 0, 1); c.fillStyle = p.c; c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); } c.globalAlpha = 1;
  // fog over the surface
  if (tl.y < 0) { for (let x = 0; x < COLS; x++) { if (S.fog[x]) continue; const a = (x > 0 && S.fog[x - 1]) || (x < COLS - 1 && S.fog[x + 1]);
      if (a) { const left = x > 0 && S.fog[x - 1]; const g = c.createLinearGradient(x * CS + (left ? 0 : CS), 0, x * CS + (left ? CS : 0), 0); g.addColorStop(0, 'rgba(40,34,56,.25)'); g.addColorStop(1, 'rgba(40,34,56,.88)'); c.fillStyle = g; }
      else c.fillStyle = 'rgba(40,34,56,.88)'; c.fillRect(x * CS, -SURF_H - 600, CS + .5, SURF_H + 600 + 2); }
    c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '700 14px sans-serif'; c.textAlign = 'center';
    for (let x = 2; x < COLS; x += 6) if (!S.fog[x]) c.fillText('?', (x + .5) * CS, -60 + Math.sin(t + x) * 3); }
  // rain / snow / sand
  if ((S.rain.on || S.haz.on) && tl.y < 0) { const hz = S.haz.on && B().hazard, sand = hz && hz.fx === 'streak', snow = (hz && hz.fx === 'flake') || (!hz && S.biome === 'ice');
    c.strokeStyle = hz ? `rgba(${hz.col},${sand ? .6 : .85})` : snow ? 'rgba(255,255,255,.85)' : 'rgba(200,225,255,.6)'; c.fillStyle = c.strokeStyle; c.lineWidth = 1;
    for (let j = 0; j < 140; j++) { const x = tl.x + ((j * 97.3 + t * (sand ? 260 : 40)) % (br.x - tl.x + 40)) - 20, y = tl.y + ((j * 53.7 + t * (sand ? 40 : snow ? 50 : 320)) % (Math.min(0, br.y) - tl.y + 1));
      if (snow && !sand) { c.fillRect(x, y, 2, 2); } else { c.beginPath(); c.moveTo(x, y); c.lineTo(x + (sand ? 12 : -2), y + (sand ? 2 : 9)); c.stroke(); } } }
  // world-space UI overlays
  drawWorldUI(c, t);
  // ambient weather over the sky (snow, ash, petals, fireflies, dust, mist) + cold-snap frost
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (typeof ambientFx === 'function') { const gy = w2s(0, 0).y, L = YLOOK[S.biome], hz = S.haz.on && B().hazard; if (L && L.fx && gy > VIEW.top) ambientFx(c, t, L.fx, 0, VIEW.top, W, gy - VIEW.top, L.fx === 'fog' ? 5 : 60, hz ? 2 : 1);
    if (hz && hz.kind === 'cold') frostOverlay(c, clamp(S.haz.t, 0, 1) * .9); }
  // tutorial pointer at the crumbs
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
}
