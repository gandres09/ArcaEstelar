'use strict';
// =====================================================================
//  Sonido: efectos y música generados con Web Audio (sin archivos)
// =====================================================================

const AUDIO_KEY = 'mini-fabrica-audio';
const audio = {
  ctx: null, master: null, sfxGain: null, musicGain: null, humGain: null, hum: null,
  settings: { sfx: 0.6, music: 0.35, muted: false },
  last: {}, nextBar: 0, bar: 0,
};

try { Object.assign(audio.settings, JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}')); } catch (_) { /* sin almacenamiento */ }

function saveAudioSettings() {
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify(audio.settings)); } catch (_) { /* sin almacenamiento */ }
}

// El navegador solo deja arrancar el audio después de que la persona toca algo
function initAudio() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const c = audio.ctx = new AC();
  audio.master = c.createGain();
  audio.master.connect(c.destination);
  audio.sfxGain = c.createGain();
  audio.musicGain = c.createGain();
  audio.sfxGain.connect(audio.master);
  audio.musicGain.connect(audio.master);
  // Zumbido de fábrica: ruido filtrado muy grave
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
  audio.humGain = c.createGain(); audio.humGain.gain.value = 0;
  src.connect(lp); lp.connect(audio.humGain); audio.humGain.connect(audio.sfxGain);
  src.start();
  audio.noise = buf;
  applyAudioSettings();
  audio.nextBar = c.currentTime + 0.5;
}
window.addEventListener('pointerdown', initAudio);
window.addEventListener('keydown', initAudio);

function applyAudioSettings() {
  if (!audio.ctx) return;
  const s = audio.settings;
  audio.master.gain.value = s.muted ? 0 : 1;
  audio.sfxGain.gain.value = s.sfx;
  audio.musicGain.gain.value = s.music * 0.5;
}

// Nota corta con envolvente
function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, dest = null } = {}) {
  const c = audio.ctx;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || audio.sfxGain);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', at = 0 } = {}) {
  const c = audio.ctx;
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = audio.noise;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(audio.sfxGain);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

// Efectos. `gap` evita que un mismo sonido se repita demasiado seguido
const SFX = {
  place:    { gap: 0.04, play: () => { tone(220, 0.08, { type: 'square', vol: 0.06, slide: 0.6 }); noise(0.05, { vol: 0.08, freq: 800 }); } },
  remove:   { gap: 0.04, play: () => tone(330, 0.12, { type: 'triangle', vol: 0.08, slide: 0.4 }) },
  click:    { gap: 0.03, play: () => tone(880, 0.04, { type: 'sine', vol: 0.05 }) },
  error:    { gap: 0.2,  play: () => { tone(140, 0.15, { type: 'square', vol: 0.06 }); tone(110, 0.15, { type: 'square', vol: 0.06, at: 0.1 }); } },
  research: { gap: 0.5,  play: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.09, at: i * 0.1 })) },
  alarm:    { gap: 4,    play: () => { for (let i = 0; i < 3; i++) { tone(660, 0.18, { type: 'square', vol: 0.06, at: i * 0.4 }); tone(440, 0.18, { type: 'square', vol: 0.06, at: i * 0.4 + 0.2 }); } } },
  shot:     { gap: 0.07, play: () => noise(0.06, { vol: 0.07, freq: 2500, q: 0.7 }) },
  laser:    { gap: 0.08, play: () => tone(1400, 0.12, { type: 'sawtooth', vol: 0.04, slide: 0.3 }) },
  boom:     { gap: 0.1,  play: () => { noise(0.6, { vol: 0.3, freq: 120, type: 'lowpass' }); tone(70, 0.4, { vol: 0.15, slide: 0.5 }); } },
  splat:    { gap: 0.05, play: () => noise(0.12, { vol: 0.06, freq: 400, q: 2 }) },
  launch:   { gap: 5,    play: () => { noise(7, { vol: 0.35, freq: 90, type: 'lowpass' }); tone(55, 7, { type: 'sawtooth', vol: 0.06, slide: 3 }); } },
  win:      { gap: 2,    play: () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.9, { type: 'triangle', vol: 0.08, at: i * 0.15 })) },
};

function sfx(name, x, y) {
  if (!audio.ctx || audio.settings.muted || audio.ctx.state !== 'running') return;
  const s = SFX[name];
  if (!s) return;
  // Sonidos del mundo: solo si pasan cerca de la cámara
  if (x !== undefined) {
    const d = Math.hypot(x * TILE - view.x, y * TILE - view.y) * view.zoom;
    if (d > Math.max(cw, ch)) return;
  }
  const now = audio.ctx.currentTime;
  if (now - (audio.last[name] || 0) < s.gap) return;
  audio.last[name] = now;
  s.play();
}

// --------------------------- Música y ambiente ---------------------------

// Progresión lenta en La menor; de noche baja una octava y se apaga un poco
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const SCALE = [57, 59, 60, 62, 64, 67, 69, 72, 74, 76];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function updateAudio(activeMachines) {
  if (!audio.ctx || audio.ctx.state !== 'running') return;
  const c = audio.ctx;
  // Zumbido según cuántas máquinas trabajan en pantalla
  const target = Math.min(0.12, activeMachines * 0.004);
  audio.humGain.gain.setTargetAtTime(target, c.currentTime, 0.5);
  if (audio.settings.music <= 0) return;
  // Programar el próximo compás de música (cada 4 s)
  if (c.currentTime + 0.2 < audio.nextBar) return;
  const t0 = Math.max(audio.nextBar, c.currentTime + 0.05);
  const night = typeof darkness === 'function' && S ? darkness() > 0.3 : false;
  const shift = night ? -12 : 0;
  const chord = CHORDS[audio.bar % CHORDS.length];
  for (const n of chord) {
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.value = midi(n + shift);
    f.type = 'lowpass'; f.frequency.value = night ? 700 : 1200;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.2);
    o.connect(f); f.connect(g); g.connect(audio.musicGain);
    o.start(t0); o.stop(t0 + 4.4);
  }
  // Algunas notas sueltas encima
  for (let i = 0; i < 4; i++) {
    if (Math.random() < 0.45) continue;
    const n = SCALE[Math.floor(Math.random() * SCALE.length)] + 12 + shift;
    const at = t0 + i * 1 + Math.random() * 0.2;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = midi(n);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.035, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    o.connect(g); g.connect(audio.musicGain);
    o.start(at); o.stop(at + 1.5);
  }
  audio.bar++;
  audio.nextBar = t0 + 4;
}
