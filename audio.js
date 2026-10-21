// Ant Haven audio: looping background music + tiny sound effects synthesized with Web Audio (no sound files).
// Nothing plays until the first tap (iOS/Safari autoplay rules). Settings live in localStorage.
const AUDIO_KEY = 'ah-audio', MUSIC_URL = 'assets/music.mp3';
const AU = { music: true, sfx: true, vol: .7 };
try { Object.assign(AU, JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}')); } catch (e) {}
let ac = null, master = null, sfxBus = null, musicBus = null, musicEl = null, musicSrc = null, noiseBuf = null, auUnlocked = false, duckT = 0;
const MUSIC_LVL = .32, SFX_LVL = .85;
function auSave() { try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ music: AU.music, sfx: AU.sfx, vol: AU.vol })); } catch (e) {} }
function auLevels() {
  if (musicEl && !musicSrc) musicEl.volume = Math.max(0, Math.min(1, AU.vol * MUSIC_LVL));   // fallback when the element is not routed through Web Audio
  if (!ac) return; const t = ac.currentTime;
  musicBus.gain.setTargetAtTime(AU.music ? AU.vol * MUSIC_LVL * (duckT > performance.now() ? .35 : 1) : 0, t, .08);
  sfxBus.gain.setTargetAtTime(AU.sfx ? AU.vol * SFX_LVL : 0, t, .03);
}
function auInit() {
  if (ac) return true; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  try { ac = new AC(); } catch (e) { ac = null; return false; }
  master = ac.createGain(); master.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.connect(master); musicBus = ac.createGain(); musicBus.connect(master); musicBus.gain.value = 0;
  const n = ac.sampleRate; noiseBuf = ac.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  auLevels(); return true;
}
function auMusicEl() {
  if (musicEl) return musicEl;
  musicEl = new Audio(); musicEl.loop = true; musicEl.preload = 'auto'; musicEl.setAttribute('playsinline', ''); musicEl.src = MUSIC_URL;
  try { musicSrc = ac.createMediaElementSource(musicEl); musicSrc.connect(musicBus); } catch (e) { musicSrc = null; }   // Web Audio gain works on iOS, where element.volume is ignored
  auLevels(); return musicEl;
}
function auMusicSync() {
  if (!auUnlocked || document.hidden) return;
  if (AU.music) { const el = auMusicEl(); if (el.paused) { const p = el.play(); if (p && p.catch) p.catch(() => {}); } }
  else if (musicEl && !musicEl.paused) musicEl.pause();
  auLevels();
}
function auUnlock() {   // runs on every tap; cheap after the first
  if (!auInit()) return;
  if (ac.state !== 'running') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
  if (!auUnlocked) { auUnlocked = true; const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); }   // iOS unlock
  auMusicSync();
}
['pointerdown', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, auUnlock, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (musicEl) musicEl.pause(); if (ac && ac.state === 'running') ac.suspend().catch(() => {}); }
  else if (auUnlocked) { if (ac) ac.resume().catch(() => {}); auMusicSync(); }
});
function setAudio(k, v) { AU[k] = v; auSave(); if (k === 'music') auMusicSync(); auLevels(); }

// ---------- synth helpers ----------
function tone(f, dur, o = {}) {   // o: type, vol, to (slide target), at (delay), atk
  const t = ac.currentTime + (o.at || 0), g = ac.createGain(), s = ac.createOscillator(), v = o.vol == null ? .3 : o.vol, a = o.atk || .005;
  s.type = o.type || 'sine'; s.frequency.setValueAtTime(f, t); if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(g); g.connect(o.dest || sfxBus); s.start(t); s.stop(t + dur + .05);
}
function noise(dur, o = {}) {   // o: ft (filter type), f, to, q, vol, at, atk
  const t = ac.currentTime + (o.at || 0), s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), v = o.vol == null ? .3 : o.vol, a = o.atk || .004;
  s.buffer = noiseBuf; s.loop = true; fl.type = o.ft || 'bandpass'; fl.frequency.setValueAtTime(o.f || 1000, t); if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur); fl.Q.value = o.q || 1;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
const notes = (seq, o = {}) => { let at = o.at || 0; for (const [f, d] of seq) { if (f) tone(f, d * 1.6, { type: o.type || 'triangle', vol: o.vol || .22, at }); at += d; } };
const wob = () => .92 + Math.random() * .16;   // small pitch wobble so repeats don't sound robotic
const SFX = {
  click: () => tone(1100 * wob(), .05, { type: 'triangle', vol: .16, to: 700 }),
  scrape: () => noise(.09, { f: 1700 * wob(), q: 2.5, vol: .1, to: 900 }),
  dig: () => { noise(.06, { ft: 'lowpass', f: 1100, vol: .26 }); noise(.07, { ft: 'lowpass', f: 700 * wob(), vol: .22, at: .06 }); tone(140, .08, { vol: .1, to: 80 }); },
  pop: () => tone(480 * wob(), .09, { vol: .2, to: 1150 }),
  egg: () => { tone(760, .14, { type: 'triangle', vol: .2, to: 520 }); tone(1040, .1, { vol: .08, at: .05 }); },
  hatch: () => { tone(1300 * wob(), .07, { vol: .14, to: 2100 }); tone(1500 * wob(), .08, { vol: .14, to: 2500, at: .1 }); },
  build: () => { tone(170, .22, { vol: .5, to: 55 }); noise(.1, { ft: 'lowpass', f: 600, vol: .28 }); tone(523, .25, { type: 'triangle', vol: .1, at: .15 }); tone(784, .3, { type: 'triangle', vol: .1, at: .24 }); },
  goal: () => { tone(988, .2, { type: 'triangle', vol: .18 }); tone(1319, .35, { type: 'triangle', vol: .18, at: .12 }); },
  rain: () => { noise(3.2, { ft: 'lowpass', f: 380, to: 220, vol: .32, atk: 1.2 }); noise(2.8, { f: 2600, q: .7, vol: .05, atk: 1 }); tone(70, 1.6, { vol: .18, to: 40, at: .3, atk: .4 });
    for (let i = 0; i < 7; i++) tone(1400 + Math.random() * 900, .05, { vol: .06, to: 600, at: .4 + Math.random() * 2.2 }); },
  wind: () => { noise(3, { f: 500, to: 1400, q: 3, vol: .18, atk: 1 }); noise(2.4, { f: 1200, to: 500, q: 4, vol: .1, at: .6, atk: .8 }); },
  alarm: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, .16, { type: 'square', vol: .07, at: i * .18 }); tone(220, .7, { type: 'sawtooth', vol: .05, atk: .05 }); },
  bite: () => { noise(.03, { ft: 'highpass', f: 2600 * wob(), vol: .12 }); tone(320 * wob(), .04, { type: 'square', vol: .05, to: 180, at: .01 }); },
  warn: () => tone(1500, .9, { vol: .16, to: 380, atk: .05 }),   // falling whistle: something is coming down
  stomp: () => { tone(95, .6, { vol: .9, to: 32 }); noise(.45, { ft: 'lowpass', f: 260, vol: .7 }); noise(.25, { ft: 'lowpass', f: 1200, vol: .2, at: .02 }); },
  glass: () => { for (let i = 0; i < 6; i++) tone(1800 + i * 160, .25, { vol: .05, at: i * .07 }); },
  sizzle: () => { noise(.35, { ft: 'highpass', f: 4200, vol: .09 }); for (let i = 0; i < 4; i++) noise(.015, { ft: 'highpass', f: 3000, vol: .12, at: Math.random() * .3 }); },
  bug: () => { tone(110, .5, { type: 'sawtooth', vol: .06, to: 80, atk: .1 }); tone(165, .4, { type: 'sawtooth', vol: .04, to: 120, at: .1 }); },
  bigwin: () => notes([[523, .08], [659, .08], [784, .08], [1047, .2]], { vol: .2 }),
  fanfare: () => { duck(3); notes([[392, .12], [523, .12], [659, .12], [784, .3], [659, .12], [784, .5]], { vol: .22 }); notes([[0, .48], [262, .3], [330, .12], [392, .5]], { vol: .1, type: 'sine' }); },
  win: () => { duck(5); notes([[523, .14], [659, .14], [784, .14], [1047, .28], [784, .14], [1047, .14], [1319, .6]], { vol: .24 }); notes([[262, .42], [349, .42], [392, .28], [523, .6]], { vol: .1, type: 'sine' }); },
  lose: () => { duck(5); notes([[392, .3], [370, .3], [349, .3], [262, .9]], { vol: .2, type: 'sine' }); tone(131, 1.6, { type: 'triangle', vol: .1, at: .9 }); },
};
function duck(sec) { duckT = performance.now() + sec * 1000; auLevels(); setTimeout(auLevels, sec * 1000 + 30); }
// minimum seconds between repeats, so a swarm of ants doesn't spam a sound
const SFX_GAP = { click: .04, scrape: .22, dig: .14, pop: .12, egg: .3, hatch: .25, build: .4, goal: .5, rain: 4, wind: 4, alarm: 2, bite: .11, warn: .8, stomp: .3, glass: 1, sizzle: .3, bug: 1.5, bigwin: .5, fanfare: 1, win: 2, lose: 2 };
const UI_SFX = { click: 1, win: 1, lose: 1 };   // these still play while the game is paused / on menus
const sfxLast = {}; let sfxCount = 0;
function sfx(k) {
  if (!AU.sfx || !ac || !auUnlocked || ac.state !== 'running' || !SFX[k] || document.hidden) return;
  if (!UI_SFX[k] && (typeof UI === 'undefined' || !UI.running || UI.paused)) return;   // title-screen demo and pause stay quiet
  const now = performance.now() / 1000; if (now - (sfxLast[k] || -9) < (SFX_GAP[k] || .1)) return; sfxLast[k] = now;
  try { SFX[k](); sfxCount++; } catch (e) {}
}
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button')) { auUnlock(); sfx('click'); } }, true);
window.AHAudio = { AU, setAudio, sfx, unlock: auUnlock, get ctx() { return ac; }, get music() { return musicEl; }, get count() { return sfxCount; }, KEY: AUDIO_KEY };
