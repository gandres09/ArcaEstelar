'use strict';
// =====================================================================
//  Varios planetas a la vez. El planeta donde está tu personaje es el
//  "activo" (el que se dibuja); los demás que ya se visitaron siguen
//  andando de fondo: la fábrica de la Luna sigue mandando cosas a la Nave
//  aunque estés en la Tierra. Así cada jugador va a donde quiere: el
//  anfitrión simula todos los planetas y cada uno ve el suyo.
// =====================================================================

const LIVE = { owner: null, s: {} };   // planetas vivos de fondo: nombre -> contexto

const surfName = () => (S && S.surface) || 'earth';

// Todo lo que depende del planeta: los campos del estado y las variables de los módulos
function ctxCapture() {
  const s = {};
  for (const k of SURF_KEYS) s[k] = S[k];
  return {
    name: surfName(), s, mapW: S.mapW, mapH: S.mapH,
    W, H, PW, PH, grid, nets, wires, powerDirty, undergroundDirty, signals, heatNets, heatCount,
    wiresDirty, wireNets, wireNodeNet, wiredEnts, wireEntCount, fnets, fluidDirty, railDirty, railBlock,
    oreType, oreAmt, oreBase, oreTypeBase, pixelMap, pixelRows, pixelRow0, cliffs, cliffGone, biomeDry, biomeDesert, biomeRed,
    chopped, planted, treeCount, forestCell, explored, fogDirty, chunkCache, treeCache,
    pollution, pollTimer, lastAttack, zoneMap, zoneKey, linkCache, fogCanvas, shots, effects, particles, smoke,
  };
}

function ctxRestore(c) {
  for (const k of SURF_KEYS) S[k] = c.s[k];
  S.surface = c.name; S.mapW = c.mapW; S.mapH = c.mapH;
  ({ W, H, PW, PH, grid, nets, wires, powerDirty, undergroundDirty, signals, heatNets, heatCount,
    wiresDirty, wireNets, wireNodeNet, wiredEnts, wireEntCount, fnets, fluidDirty, railDirty, railBlock,
    oreType, oreAmt, oreBase, oreTypeBase, pixelMap, pixelRows, pixelRow0, cliffs, cliffGone, biomeDry, biomeDesert, biomeRed,
    chopped, planted, treeCount, forestCell, explored, fogDirty, chunkCache, treeCache,
    pollution, pollTimer, lastAttack, zoneMap, zoneKey, linkCache, fogCanvas, shots, effects, particles, smoke } = c);
}

// Antes de armar otro planeta: todo nuevo, así no se pisa lo del que quedó guardado
function ctxFresh() {
  grid = []; nets = []; wires = []; signals = new Array(8).fill(0); heatNets = []; heatCount = -1;
  wiresDirty = true; wireNets = []; wireNodeNet = new Map(); wiredEnts = []; wireEntCount = -1;
  fnets = []; fluidDirty = true; railDirty = true; railBlock = new Map();
  oreBase = null; oreTypeBase = null; pixelMap = null; pixelRows = 0; pixelRow0 = 0;
  chopped = new Set(); planted = new Map(); cliffGone = new Set(); chunkCache = new Map(); treeCache = new Map();
  pollTimer = 0; lastAttack = null; zoneMap = null; zoneKey = ''; linkCache = { key: '', nodes: [] }; fogCanvas = null;
  shots = []; effects = []; particles = []; smoke = [];
}

// Los planetas de fondo son de este estado; si se cargó otra partida, se olvidan
function liveSurfaces() {
  if (LIVE.owner !== S) { LIVE.owner = S; LIVE.s = {}; }
  return LIVE.s;
}
// ¿Esta compu lleva la simulación verdadera? (jugando solo o de anfitrión)
const simAuthority = () => !NET.on || NET.role === 'host';

// Arma un planeta guardado (o nuevo) como contexto de fondo, sin tocar el activo
function ensureSurface(name) {
  const live = liveSurfaces();
  if (!S || name === surfName() || live[name]) return live[name] || null;
  if (name !== 'earth' && name !== 'moon' && name !== 'vulcan') return null;
  const cur = ctxCapture();
  try {
    ctxFresh();
    if (!S.surf) S.surf = {};
    unpackSurface(name, S.surf[name] || null);
    delete S.surf[name];
    live[name] = ctxCapture();
  } finally {
    ctxRestore(cur);
  }
  return live[name];
}

// Hace algo adentro de otro planeta (y vuelve)
function withSurface(name, fn) {
  if (!name || name === surfName()) return fn();
  const c = ensureSurface(name);
  if (!c) return undefined;
  const live = liveSurfaces(), cur = ctxCapture();
  const pl = S.player;
  ctxRestore(c);
  S.player = null;   // tu personaje no está en ese planeta
  try { return fn(); } finally {
    S.player = pl;
    live[name] = ctxCapture();
    ctxRestore(cur);
  }
}

// Un paso de los planetas de fondo
function updateBackground(dt) {
  if (!S || !simAuthority()) return;
  const live = liveSurfaces();
  for (const name in live) {
    if (name === surfName()) { delete live[name]; continue; }
    withSurface(name, () => {
      simBg = true;
      try { update(dt); } catch (err) { console.warn('planeta de fondo', name, err); } finally { simBg = false; }
    });
  }
  if (NET.on) NET.shadow = { ...S.inv };   // lo que hicieron las máquinas de allá no es una acción del jugador
}

// Para guardar: todos los planetas que no son el activo, empaquetados
function packedSurfaces() {
  const out = { ...(S.surf || {}) };
  const live = liveSurfaces();
  for (const name in live) if (name !== surfName()) withSurface(name, () => { out[name] = packSurface(); });
  delete out[surfName()];
  return out;
}

// Cambia el planeta activo (el que se ve). El que se deja sigue vivo de fondo si esta compu simula.
function switchSurface(to) {
  const from = surfName();
  if (to === from) return;
  const live = liveSurfaces();
  if (simAuthority()) live[from] = ctxCapture();
  else { if (!S.surf) S.surf = {}; S.surf[from] = packSurface(); }   // de invitado: una copia, por si vuelvo antes de la próxima foto
  if (live[to]) {
    ctxRestore(live[to]);
    delete live[to];
  } else {
    ctxFresh();
    const saved = (S.surf && S.surf[to]) || null;
    unpackSurface(to, saved);
    if (S.surf) delete S.surf[to];
  }
  if (!pixelMap) resetMapGraphics();
  fogDirty = true;
  powerDirty = true;
}

// Después de cargar una partida: los planetas guardados vuelven a andar, de a uno
function wakeSurfaces() {
  if (!S || !S.surf || !simAuthority()) return;
  const owner = S;
  const names = Object.keys(S.surf).filter((k) => k !== surfName());
  let i = 0;
  const next = () => {
    if (S !== owner || i >= names.length || !simAuthority()) return;
    ensureSurface(names[i++]);
    setTimeout(next, 1200);
  };
  setTimeout(next, 1500);
}
