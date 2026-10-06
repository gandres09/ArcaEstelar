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

// Los campos que empiezan con _ son temporales (redes, pares de túneles)
const saveReplacer = (k, v) => (k.startsWith('_') ? undefined : v);

function save() {
  try {
    const data = { ...S, view: { ...view }, ore: encodeOre() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data, saveReplacer));
  } catch (_) { /* sin almacenamiento disponible */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.v !== 2 || !Array.isArray(data.entities)) return false;
    const { view: v, ore, ...state } = data;
    S = state;
    generateMap(S.seed);
    if (ore) decodeOre(ore);
    if (v) Object.assign(view, v);
    rebuildGrid();
    return true;
  } catch (_) {
    return false;
  }
}

function startNewGame(seed) {
  S = newState(seed);
  generateMap(seed);
  const cx = W >> 1, cy = H >> 1;
  const hub = makeEntity('hub', cx - 1, cy - 1);
  hub.id = S.nextId++;
  S.entities.push(hub);
  rebuildGrid();
  view.x = cx * TILE + TILE / 2;
  view.y = cy * TILE + TILE / 2;
  view.zoom = 0.9;
  tool = 'hand';
  toolDir = 0;
  closeInspector();
  save();
}

function init() {
  resize();
  window.addEventListener('resize', resize);
  if (!load()) {
    startNewGame((Math.random() * 2 ** 31) | 0);
    $('help').hidden = false;
  }
  buildToolbar();
  buildInventory();
  updateUI();

  $('btn-help').addEventListener('click', () => openModal('help'));
  $('btn-help-close').addEventListener('click', closeModals);
  $('btn-research').addEventListener('click', () => openModal('research'));
  $('btn-stats').addEventListener('click', () => openModal('stats'));
  $('btn-win-close').addEventListener('click', closeModals);
  for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', closeModals);
  for (const m of document.querySelectorAll('.modal')) {
    m.addEventListener('pointerdown', (ev) => { if (ev.target === m) closeModals(); });
  }
  $('btn-new').addEventListener('click', () => {
    if (confirm('¿Empezar un juego nuevo? Se pierde la fábrica actual.')) {
      startNewGame((Math.random() * 2 ** 31) | 0);
      updateUI();
    }
  });
  $('side-toggle').addEventListener('click', () => document.body.classList.toggle('side-hidden'));
  if (window.innerWidth < 760) document.body.classList.add('side-hidden');

  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  setInterval(save, 10000);
  setInterval(updateUI, 250);
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
    update(dt);
    updateLaunch(dt);
    render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Acceso para pruebas desde la consola
  window.fabrica = {
    get state() { return S; }, place, removeEntity, update, at, oreAt, startLaunch,
    get nets() { return nets; },
  };
}

init();
