'use strict';
// =====================================================================
//  Arranque, guardado y bucle principal
// =====================================================================

// Calidad adaptable: como mucho 2 píxeles por punto, y si va lento se baja sola
let quality = 2;
const fpsMeter = { frames: 0, t: 0, good: 0 };
function adaptQuality(dt) {
  fpsMeter.frames++; fpsMeter.t += dt;
  if (fpsMeter.t < 2) return;
  const fps = fpsMeter.frames / fpsMeter.t;
  fpsMeter.frames = 0; fpsMeter.t = 0;
  const max = Math.min(2, window.devicePixelRatio || 1);
  if (fps < 40 && quality > 0.75) { quality = Math.max(0.75, Math.min(quality, dpr) - 0.5); fpsMeter.good = 0; resize(); }
  else if (fps > 56 && quality < max) { if (++fpsMeter.good >= 3) { quality = Math.min(max, quality + 0.25); fpsMeter.good = 0; resize(); } }
  else fpsMeter.good = 0;
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, quality);
  cw = window.innerWidth; ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
}

// Los campos que empiezan con _ son temporales (redes, pares de túneles, objetivos)
const saveReplacer = (k, v) => (k.startsWith('_') ? undefined : v);

function serialize() {
  flushFluids();
  return JSON.stringify({ ...S, pollution: savePollution(), fog: encodeFog(), view: { ...view }, ore: encodeOre(), trees: encodeTrees() }, saveReplacer);
}

function save() {
  if (NET.busy) return false;
  if (NET.on && !netInMyWorld()) return netSaveMine();   // en el mundo de otro: ese mundo lo guarda su anfitrión
  try {
    S.savedAt = Date.now();
    const raw = serialize();
    // Las partidas grandes se guardan comprimidas (el navegador deja unos pocos MB)
    if (raw.length < 900000) { localStorage.setItem(SAVE_KEY, raw); return true; }
    if (!saveBusy) {
      saveBusy = true;
      gzipBase64(raw).then((z) => {
        try { localStorage.setItem(SAVE_KEY, z); } catch (_) { toast('⚠️ La partida ya no entra en el navegador. Usá ☰ → Copiar código de partida para no perderla.'); }
      }).finally(() => { saveBusy = false; });
    }
    return true;
  } catch (_) { return false; }
}
let saveBusy = false;

async function loadAsync() {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    if (raw.startsWith('Z:') || raw.startsWith('R:')) raw = await unpackCode(raw);
    loadFrom(raw);
    return true;
  } catch (_) {
    return false;
  }
}

function loadFrom(raw) {
  const data = JSON.parse(raw);
  if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.entities)) throw new Error('version');
  const { view: v, ore, pollution: poll, fog, trees, ...state } = data;
  setMapSize(state.mapW || 320, state.mapH || 240);
  S = { ...newState(state.seed, state.peaceful, !!state.character), ...state };
  if (S.character && !S.player) S.player = newPlayer(W / 2 + 0.5, H / 2 + 3.5);
  generateMap(S.seed);
  if (ore) decodeOre(ore);
  decodeTrees(trees);
  loadPollution(poll);
  prodHist = [];
  decodeFog(fog);
  if (v) Object.assign(view, v);
  // Partidas de antes de las etapas que ya habían lanzado la nave: pasan a la etapa 2
  if (S.launched && !S.stage) {
    S.stage = 2;
    explored.fill(1);
    S.nestsAtStage2 = S.entities.filter((e) => e.type === 'nest').length;
    S.cleanTime = 0;
  }
  undoStack.length = 0;
  rebuildGrid();
  // Partidas de antes de que las máquinas usaran energía
  if (!S.powerRules) {
    S.powerRules = 1;
    if (S.entities.some((e) => e.type === 'assembler' || e.type === 'lab' || e.type === 'miner'))
      setTimeout(() => toast('⚡ Cambio de reglas: el <b>taladro común</b> quema carbón (les regalé 5 a cada uno) y las <b>ensambladoras</b> y <b>laboratorios</b> necesitan electricidad. Poné un <b>Generador a carbón</b> y <b>Postes</b>.'), 1500);
  }
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

function startNewGame(seed, peaceful, character = true) {
  setMapSize(MAP_SIZE[0], MAP_SIZE[1]);
  S = newState(seed, peaceful, character);
  S.powerRules = 1;
  S.mapGen = 3;
  generateMap(seed);
  loadPollution(null);
  decodeFog(null);
  const cx = W >> 1, cy = H >> 1;
  reveal(cx, cy, 52);
  const hub = makeEntity('hub', cx - 1, cy - 1);
  hub.id = S.nextId++;
  S.entities.push(hub);
  rebuildGrid();
  if (character) S.player = newPlayer(cx + 0.5, cy + 3.5);
  generateNests(seed);
  view.x = cx * TILE + TILE / 2;
  view.y = cy * TILE + TILE / 2;
  view.zoom = character ? (window.innerWidth < 760 ? 0.85 : 1.3) : (window.innerWidth < 760 ? 0.55 : 0.9);
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

// Partida en un archivo .txt: se descarga y se vuelve a subir
async function downloadGame() {
  const code = await gzipBase64(serialize());
  const d = new Date(), two = (n) => String(n).padStart(2, '0');
  const filename = `arca-estelar-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.txt`;
  // Dentro de Claude la descarga pasa por la plataforma (pide confirmación)
  let dl = null;
  if (window.claude && !NET.p2p) { try { dl = await claude.use('downloads'); } catch (_) { dl = null; } }
  if (dl) {
    try { await dl.save({ filename, data: code }); toast('⬇️ Partida descargada: ' + filename); }
    catch (e) { if (!e || e.code !== 'declined') toast('No se pudo descargar. Usá “Copiar código de partida”.'); }
    return;
  }
  try {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('⬇️ Partida descargada: ' + filename);
  } catch (_) {
    toast('Este navegador no deja descargar. Usá “Copiar código de partida”.');
  }
}

async function loadGameFile(file) {
  if (!file) return;
  try {
    const text = (await file.text()).trim();
    const raw = text.startsWith('{') ? text : await unpackCode(text);
    loadFrom(raw);
    save();
    closeModals();
    toolbarKey = '';
    updateUI();
    toast('📂 Partida cargada desde ' + file.name + '.');
  } catch (_) {
    toast('Ese archivo no es una partida de Arca Estelar (o está incompleto).');
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

async function init() {
  resize();
  window.addEventListener('resize', resize);
  const fresh = !(await loadAsync());
  if (fresh) {
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
  $('pocket').addEventListener('click', (ev) => { const b = ev.target.closest('[data-item]'); if (b) transferItem(b.dataset.item, true); });
  $('inventory').addEventListener('click', (ev) => { const b = ev.target.closest('[data-item]'); if (b && playerOn()) transferItem(b.dataset.item, false); });
  $('craft').addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('[data-craft]');
    if (b && !b.disabled) { const n = craft(b.dataset.craft, ev.shiftKey ? 5 : 1); if (n) sfx('click'); updateCraftUI(); }
    const c = ev.target.closest('[data-cancel]');
    if (c) { cancelCraft(+c.dataset.cancel); updateCraftUI(); }
  });
  $('btn-center').addEventListener('click', () => { followCam = true; });
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
  $('btn-save').addEventListener('click', async () => {
    const ok = save();
    if (CLOUD.on && (!NET.on || netInMyWorld())) toast((await cloudSave(true)) ? '💾 Partida guardada en este navegador y en la nube.' : (ok ? '💾 Guardada en el navegador. La nube no respondió; se reintenta sola.' : 'No se pudo guardar. Usá “Copiar código de partida”.'));
    else toast(ok ? '💾 Partida guardada.' : 'No se pudo guardar en este navegador. Usá “Copiar código de partida”.');
  });
  $('btn-export').addEventListener('click', exportGame);
  $('btn-file-save').addEventListener('click', downloadGame);
  $('btn-file-load').addEventListener('click', () => {
    if (NET.on && !netInMyWorld()) { toast('Salí del mundo de tu amigo para cargar una partida.'); return; }
    $('file-load').value = '';
    $('file-load').click();
  });
  $('file-load').addEventListener('change', (ev) => loadGameFile(ev.target.files && ev.target.files[0]));
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
    startNewGame((Math.random() * 2 ** 31) | 0, $('opt-peaceful').checked, $('opt-character').checked);
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
  $('btn-online').addEventListener('click', () => openModal('online'));
  // Atajo al nombre de jugador (vive en la ventana En línea)
  $('btn-name').addEventListener('click', () => {
    openModal('online');
    setTimeout(() => { const i = $('net-nick'); if (i) { i.focus(); i.select(); } }, 50);
  });
  $('btn-bp').addEventListener('click', () => openModal('planos'));
  initBlueprints();
  initPet();
  $('btn-pet').addEventListener('click', () => { closeModals(); openPetPanel(); });
  $('net-chip').addEventListener('click', () => openModal('online'));
  initCloud();
  netInit().catch(() => {}).then(() => cloudInit(fresh));

  let last = performance.now();
  function frame(now) {
    const realDt = (now - last) / 1000;
    const dt = Math.min(0.1, realDt);
    last = now;
    if (!document.hidden && realDt < 1) adaptQuality(realDt);
    time += dt;
    handleKeysPan(dt);
    if (handMining) {
      handMining.prog += dt;
      if (handMining.tree) {
        if (handMining.prog >= CHOP_TIME) {
          if (chopTree(handMining.x, handMining.y)) { netPush({ k: 'c', x: handMining.x, y: handMining.y }); add(S.inv, 'wood', WOOD_PER_TREE); countProduced('wood', WOOD_PER_TREE); sfx('remove'); }
          handMining = null;
        }
      } else if (handMining.prog >= HAND_MINE_TIME) {
        handMining.prog = 0;
        const o = mineOre(handMining.x, handMining.y);
        if (o) { netPush({ k: 'm', x: handMining.x, y: handMining.y }); add(S.inv, o, 1); countProduced(o); } else handMining = null;
      }
    }
    netTick(dt);
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
