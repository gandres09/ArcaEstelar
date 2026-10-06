'use strict';
// =====================================================================
//  Arranque, guardado y bucle principal
// =====================================================================

function resize() {
  dpr = window.devicePixelRatio || 1;
  cw = window.innerWidth; ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
}

// Los campos que empiezan con _ son temporales (redes, pares de túneles, objetivos)
const saveReplacer = (k, v) => (k.startsWith('_') ? undefined : v);

function serialize() {
  return JSON.stringify({ ...S, pollution: savePollution(), fog: encodeFog(), view: { ...view }, ore: encodeOre() }, saveReplacer);
}

function save() {
  try { localStorage.setItem(SAVE_KEY, serialize()); return true; } catch (_) { return false; }
}

function loadFrom(raw) {
  const data = JSON.parse(raw);
  if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.entities)) throw new Error('version');
  const { view: v, ore, pollution: poll, fog, ...state } = data;
  S = { ...newState(state.seed, state.peaceful), ...state };
  generateMap(S.seed);
  if (ore) decodeOre(ore);
  loadPollution(poll);
  prodHist = [];
  decodeFog(fog);
  if (v) Object.assign(view, v);
  undoStack.length = 0;
  rebuildGrid();
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    loadFrom(raw);
    return true;
  } catch (_) {
    return false;
  }
}

function startNewGame(seed, peaceful) {
  S = newState(seed, peaceful);
  generateMap(seed);
  loadPollution(null);
  decodeFog(null);
  const cx = W >> 1, cy = H >> 1;
  reveal(cx, cy, 52);
  const hub = makeEntity('hub', cx - 1, cy - 1);
  hub.id = S.nextId++;
  S.entities.push(hub);
  rebuildGrid();
  generateNests(seed);
  view.x = cx * TILE + TILE / 2;
  view.y = cy * TILE + TILE / 2;
  view.zoom = window.innerWidth < 760 ? 0.55 : 0.9;
  tool = 'hand';
  toolDir = 0;
  undoStack.length = 0;
  lastAttack = null;
  clearPlans();
  closeInspector();
  save();
}

// --------------------------- Exportar e importar ---------------------------

async function gzipBase64(text) {
  if (typeof CompressionStream === 'undefined') return 'R:' + btoa(unescape(encodeURIComponent(text)));
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return 'Z:' + btoa(s);
}

async function unpackCode(code) {
  code = code.trim();
  if (code.startsWith('R:')) return decodeURIComponent(escape(atob(code.slice(2))));
  if (!code.startsWith('Z:')) throw new Error('formato');
  const bin = atob(code.slice(2));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

async function exportGame() {
  const code = await gzipBase64(serialize());
  const box = $('export-text');
  box.value = code;
  box.hidden = false;
  try {
    await navigator.clipboard.writeText(code);
    toast('Código copiado. Guardalo en algún lado (notas, mensaje) para recuperar la partida.');
  } catch (_) {
    box.focus();
    box.select();
    toast('Seleccioná el código y copialo.');
  }
}

async function importGame() {
  try {
    const raw = await unpackCode($('import-text').value);
    loadFrom(raw);
    save();
    closeModals();
    toolbarKey = '';
    updateUI();
    toast('Partida cargada.');
  } catch (_) {
    toast('Ese código no es válido. Copialo completo, desde el principio hasta el final.');
  }
}

// --------------------------- Arranque ---------------------------

function init() {
  resize();
  window.addEventListener('resize', resize);
  if (!load()) {
    startNewGame((Math.random() * 2 ** 31) | 0, false);
    openModal('help');
  }
  try {
    const side = localStorage.getItem('mini-fabrica-side');
    if (side === '1') document.body.classList.add('side-open');
    if (side === '0') document.body.classList.add('side-closed');
  } catch (_) { /* sin almacenamiento */ }
  buildInventory();
  updateUI();

  $('btn-research').addEventListener('click', () => openModal('research'));
  $('research-chip').addEventListener('click', () => openModal('research'));
  $('btn-side').addEventListener('click', () => { toggleSide(); updateUI(); });
  $('side-close').addEventListener('click', () => toggleSide(false));
  $('btn-pollution').addEventListener('click', togglePollution);
  $('btn-menu').addEventListener('click', () => openModal('menu'));
  $('btn-help').addEventListener('click', () => openModal('help'));
  $('btn-help-close').addEventListener('click', closeModals);
  $('btn-stats').addEventListener('click', () => openModal('stats'));
  $('btn-ach').addEventListener('click', () => openModal('ach'));
  $('chart-picker').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-chart]');
    if (b) { toggleChartItem(b.dataset.chart); renderChartPicker(); }
  });
  $('chart').addEventListener('pointermove', (ev) => { const r = $('chart').getBoundingClientRect(); chartHover = { x: ev.clientX - r.left }; renderChart(); });
  $('chart').addEventListener('pointerleave', () => { chartHover = null; renderChart(); });
  $('btn-win-close').addEventListener('click', closeModals);
  $('btn-save').addEventListener('click', () => toast(save() ? '💾 Partida guardada.' : 'No se pudo guardar en este navegador. Usá “Copiar código de partida”.'));
  $('btn-export').addEventListener('click', exportGame);
  $('btn-import-open').addEventListener('click', () => { $('import-box').hidden = false; $('import-text').focus(); });
  $('btn-import').addEventListener('click', importGame);
  $('btn-new').addEventListener('click', () => openModal('newgame'));
  // Sonido
  $('vol-sfx').value = audio.settings.sfx;
  $('vol-music').value = audio.settings.music;
  $('mute').checked = audio.settings.muted;
  const onAudio = () => {
    audio.settings.sfx = +$('vol-sfx').value;
    audio.settings.music = +$('vol-music').value;
    audio.settings.muted = $('mute').checked;
    initAudio(); applyAudioSettings(); saveAudioSettings();
  };
  for (const id of ['vol-sfx', 'vol-music', 'mute']) $(id).addEventListener('input', onAudio);
  $('vol-sfx').addEventListener('change', () => sfx('place'));
  $('btn-new-go').addEventListener('click', () => {
    startNewGame((Math.random() * 2 ** 31) | 0, $('opt-peaceful').checked);
    toolbarKey = '';
    updateUI();
    openModal('help');
  });
  $('alert').addEventListener('click', () => {
    if (lastAttack) { view.x = (lastAttack.x + 0.5) * TILE; view.y = (lastAttack.y + 0.5) * TILE; clampView(); }
  });
  for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', closeModals);
  for (const m of document.querySelectorAll('.modal')) {
    m.addEventListener('pointerdown', (ev) => { if (ev.target === m) closeModals(); });
  }

  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  setInterval(save, 10000);
  setInterval(updateUI, 250);
  setInterval(checkAchievements, 2000);
  setInterval(() => renderMinimap(minimap), 500);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    handleKeysPan(dt);
    if (handMining) {
      handMining.prog += dt;
      if (handMining.prog >= HAND_MINE_TIME) {
        handMining.prog = 0;
        const o = mineOre(handMining.x, handMining.y);
        if (o) { add(S.inv, o, 1); countProduced(o); } else handMining = null;
      }
    }
    if (!launchAnim || launchAnim.t < 8) update(dt);
    sampleProduction(dt);
    updateLaunch(dt);
    render(ctx);
    updateAudio(activeOnScreen);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Acceso para pruebas desde la consola
  window.fabrica = {
    get state() { return S; }, place, removeEntity, update, at, oreAt, startLaunch, setResearch,
    get nets() { return nets; }, undo, addNest, spawnBiter, save, serialize,
  };
}

init();
