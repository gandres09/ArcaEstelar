'use strict';
// =====================================================================
//  La Luna: un segundo mapa (más chico) al que se viaja con el personaje.
//  Hay regolito (para la aleación lunar), hielo y Helio-3, que se
//  necesitan en la Tierra para armar el Arca. El módulo lunar manda por
//  radio todo lo que recibe al inventario de la Nave.
//  Mientras estás en un lugar, el otro queda en pausa.
// =====================================================================

const MOON_SIZE = [480, 360];
const MOON_FUEL = 50;          // combustible de cohete para ir a la Luna
const MOON_BACK_FUEL = 20;     // y para volver
const MOON_SEED = 0x6d6f6f6e;
const onMoon = () => !!(S && S.surface === 'moon');
// Lo que es propio de cada lugar (lo demás, como la investigación y la Nave, es compartido)
const SURF_KEYS = ['entities', 'ghosts', 'trains', 'biters', 'creatures', 'drops', 'ruins', 'lairs', 'vehicles', 'markers', 'flights', 'lflights', 'podsGen', 'expandTimer'];

// --------------------------- Mapa lunar ---------------------------

function generateMoonMap(seed) {
  oreType = new Uint8Array(W * H);
  oreAmt = new Uint16Array(W * H);
  const rnd = mulberry32((seed ^ MOON_SEED) >>> 0);
  const cx = W >> 1, cy = H >> 1;
  const id = (k) => ORE_IDS.indexOf(k);
  const patch = (px, py, rad, ore, rich) => {
    for (let y = Math.floor(py - rad - 2); y <= py + rad + 2; y++) for (let x = Math.floor(px - rad - 2); x <= px + rad + 2; x++) {
      const d = Math.hypot(x - px, y - py);
      if (d < rad + (rnd() - 0.5) * 2) {
        const i = tIdx(x, y);
        oreType[i] = id(ore);
        const t = Math.max(0, 1 - d / (rad + 0.5)), peak = Math.max(2600, rich * 1.6);
        oreAmt[i] = Math.min(65000, Math.round(3 * (500 + (peak - 500) * Math.pow(t, 1.3)) * (0.9 + rnd() * 0.2)));
      }
    }
  };
  // Cerca del módulo: lo justo para arrancar (hierro, cobre, piedra y regolito)
  const starts = [['iron_ore', 4, 1200], ['copper_ore', 3.5, 1000], ['stone', 3, 900], ['regolito', 5, 1500], ['hielo', 3, 900]];
  const a0 = rnd() * Math.PI * 2;
  starts.forEach(([ore, r, rich], i) => {
    const a = a0 + i * (Math.PI * 2 / starts.length), d = 14 + rnd() * 6;
    patch(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), r, ore, rich);
  });
  // Por todo el mapa: mucho regolito, hielo en los cráteres, titanio, y Helio-3 lejos
  for (let i = 0; i < 160; i++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    const d = Math.hypot(wdx(px - cx), wdy(py - cy));
    if (d < 26) continue;
    const r = rnd();
    const ore = r < 0.45 ? 'regolito' : r < 0.65 ? 'hielo' : r < 0.8 ? 'titanium_ore' : r < 0.9 ? 'iron_ore' : 'stone';
    patch(px, py, 3 + rnd() * 5, ore, 900 * (1 + d / 60));
  }
  let he = 0;
  for (let tries = 0; he < 14 && tries < 2000; tries++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    const d = Math.hypot(wdx(px - cx), wdy(py - cy));
    if (d < 60) continue;
    patch(px, py, 2.5 + rnd() * 3, 'helio3', 700 * (1 + d / 50));
    he++;
  }
  for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) { oreType[y * W + x] = 0; oreAmt[y * W + x] = 0; }
  oreBase = oreAmt.slice();
  oreTypeBase = oreType.slice();
  chopped = new Set(); planted = new Map(); treeCache.clear();
  computeBiomes(seed); computeCliffs(seed);
  computeForest();
  resetMapGraphics();
}

// Suelo lunar: gris, con cráteres
const MOON_DARK = [74, 76, 82], MOON_LIGHT = [148, 148, 150], MOON_CRATER = [56, 57, 62];
function moonTerrainAt(x, y) {
  const n = vnoise(x, y, 9, 21) * 0.55 + vnoise(x, y, 31, 22) * 0.45;
  let c = mixRgb(MOON_DARK, MOON_LIGHT, n);
  const cr = vnoise(x, y, 6, 23);
  if (cr > 0.72) c = mixRgb(c, MOON_CRATER, Math.min(0.8, (cr - 0.72) * 4));
  else if (cr > 0.64) c = mixRgb(c, [175, 175, 178], (cr - 0.64) * 5);   // borde iluminado del cráter
  return c;
}
function drawMoonGround(g, x, y, px, py) {
  // Piedritas y cráteres chiquitos
  const f = hash(x, y, 190);
  if (f < 0.08) {
    const cx = px + 6 + hash(x, y, 191) * 20, cy = py + 6 + hash(x, y, 192) * 20, r = 2 + hash(x, y, 193) * 4;
    g.fillStyle = 'rgba(30,30,36,0.35)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(210,210,215,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
  } else if (f > 0.93) rock(g, px + 10 + hash(x, y, 194) * 12, py + 12 + hash(x, y, 195) * 10, 2 + hash(x, y, 196) * 2, '#9a9aa0', 0.3);
}

// --------------------------- Viajar ---------------------------

function packSurface() {
  flushFluids();
  const o = {};
  for (const k of SURF_KEYS) o[k] = S[k];
  o.mapW = W; o.mapH = H;
  o.ore = encodeOre(); o.trees = encodeTrees(); o.fog = encodeFog(); o.pollution = savePollution();
  return JSON.parse(JSON.stringify(o, saveReplacer));
}

function unpackSurface(name, o) {
  S.surface = name;
  const [w, h] = o ? [o.mapW, o.mapH] : name === 'moon' ? MOON_SIZE : name === 'vulcan' ? VULCAN_SIZE : [S.mapW, S.mapH];
  for (const k of SURF_KEYS) S[k] = o ? o[k] : undefined;
  for (const k of ['entities', 'ghosts', 'trains', 'biters', 'creatures', 'drops', 'vehicles', 'markers', 'flights', 'lflights']) if (!Array.isArray(S[k])) S[k] = [];
  if (name !== 'earth' && !o) { S.ruins = []; S.lairs = []; S.podsGen = 1; }
  setMapSize(w, h);
  S.mapW = W; S.mapH = H;
  generateMap(S.seed);
  if (o && o.ore) decodeOre(o.ore);
  decodeTrees(o && o.trees);
  loadPollution(o && o.pollution);
  decodeFog(o && o.fog);
  rebuildGrid();
  powerDirty = true; fluidDirty = true; undergroundDirty = true;
  if (typeof railDirty !== 'undefined') railDirty = true;
  if (typeof linkCache !== 'undefined') linkCache.quick = '';
  // La primera vez en la Luna (o en Vulcano): el módulo de aterrizaje en el medio
  if (name !== 'earth' && !S.entities.some((e) => e.type === 'lander')) {
    const e = makeEntity('lander', (W >> 1) - 1, (H >> 1) - 1, 0);
    e.id = S.nextId++;
    S.entities.push(e); occupy(e, e);
    reveal(W >> 1, H >> 1, 40);
    if (name === 'vulcan' && !S.peaceful) vulcanWorms();
  }
}

function travelOverlay(text) {
  let el = $('travel');
  if (!el) { el = document.createElement('div'); el.id = 'travel'; document.body.appendChild(el); }
  el.innerHTML = `<div>${text}</div>`;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}

// Ir a la Luna (desde la plataforma) o volver a la Tierra (desde el módulo lunar)
function travel(to) {
  if (!playerOn()) return false;
  if (myVehicle()) exitVehicle(true);
  const from0 = S.surface || 'earth';
  const fuel = to === 'moon' ? MOON_FUEL : to === 'vulcan' ? VULCAN_FUEL : from0 === 'vulcan' ? 40 : MOON_BACK_FUEL;
  if (avail('rocket_fuel') < fuel) { toast(`Hace falta ${fuel} de combustible de cohete (en tu mochila o en la Nave).`); return false; }
  takeItem('rocket_fuel', fuel);
  const from = S.surface || 'earth';
  closeInspector();
  travelOverlay(to === 'moon' ? '🚀 Rumbo a la Luna…' : to === 'vulcan' ? '🌋 Rumbo a Vulcano…' : '🌍 Volviendo a la Tierra…');
  sfx('launch');
  projs.length = 0; clouds.length = 0; combatBots.length = 0;
  // El planeta que dejás sigue andando (lo simula esta compu o el anfitrión): viaja solo tu personaje
  switchSurface(to);
  // Dónde aparecés: al lado del módulo lunar, o de la plataforma de la Tierra (o de la Nave)
  const p = S.player;
  const base = S.entities.find((e) => e.type === (to !== 'earth' ? 'lander' : from === 'vulcan' ? 'vulcanpad' : 'moonpad')) || hubOf(myF() || 'f0') || S.entities.find((e) => e.type === 'hub');
  const bx = base ? base.x + sizeOf(base.type) / 2 : W / 2, by = base ? base.y + sizeOf(base.type) + 1.5 : H / 2;
  p.x = bx; p.y = by; p.path = null; p.mine = null; p.queue.length = 0; p.surf = to;
  if (p.pet && !p.pet.gone) { p.pet.x = bx - 1; p.pet.y = by; }
  unstick(p);
  view.x = p.x * TILE; view.y = p.y * TILE;
  undoStack.length = 0;
  toolbarKey = '';
  updateUI();
  toast(to === 'moon'
    ? '🌙 ¡Llegaste a la Luna! Sin aire ni carbón: traé paneles solares. Lo que entra al <b>Módulo lunar</b> llega a la Nave por radio. Buscá <b>regolito</b> (para la aleación lunar), <b>hielo</b> y <b>Helio-3</b>.'
    : to === 'vulcan'
      ? '🌋 ¡Llegaste a Vulcano! La lava no se cruza. Hay mucho <b>carbón</b>, <b>calcita</b> y <b>tungsteno</b>; una bomba de agua al lado de la lava saca lava para la <b>Fundición</b>. Cuidado con los gusanos gigantes. Lo que entra al módulo llega a la Nave.'
      : `🌍 Volviste a la Tierra. Lo que mandaste desde ${from === 'vulcan' ? 'Vulcano' : 'la Luna'} ya está en la Nave.`);
  if (NET.on) { NET.presAt = 0; if (NET.role === 'host') { NET.lastSnap = 0; netSnapshot(); } }
  save();
  return true;
}

// Cuando llega una foto de otro lugar (en línea), cada uno aparece al lado de la base
function relocateToSurface() {
  const p = S.player;
  if (!p || (p.surf || 'earth') === (S.surface || 'earth')) return;
  const base = S.entities.find((e) => e.type === (onMoon() ? 'lander' : 'moonpad')) || S.entities.find((e) => e.type === 'hub');
  p.x = base ? base.x + sizeOf(base.type) / 2 + (Math.random() - 0.5) * 3 : W / 2;
  p.y = base ? base.y + sizeOf(base.type) + 2 : H / 2;
  p.surf = S.surface || 'earth';
  p.vehicle = null;
  if (p.pet) { p.pet.x = p.x - 1; p.pet.y = p.y; }
}

// --------------------------- Dibujo ---------------------------

function drawLander(g, x0, y0, t) {
  const s = TILE * 2, cx = x0 + s / 2, cy = y0 + s / 2;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx + 4, cy + 10, 28, 12, 0, 0, 7); g.fill();
  // Patas
  g.strokeStyle = '#9aa3ad'; g.lineWidth = 3;
  for (const [dx, dy] of [[-22, 18], [22, 18], [-18, -6], [18, -6]]) { g.beginPath(); g.moveTo(cx, cy + 2); g.lineTo(cx + dx, cy + dy); g.stroke(); g.fillStyle = '#c9d1db'; g.fillRect(cx + dx - 4, cy + dy - 1, 8, 3); }
  // Cuerpo dorado
  g.fillStyle = '#d9a03a'; rrect(g, cx - 16, cy - 8, 32, 20, 4); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(cx - 14, cy - 6, 28, 4);
  g.fillStyle = '#cfd6dd'; rrect(g, cx - 12, cy - 22, 24, 16, 5); g.fill();
  g.fillStyle = '#5aa0ff'; g.beginPath(); g.arc(cx, cy - 15, 4.5, 0, 7); g.fill();
  // Antena con lucecita
  g.strokeStyle = '#cfd6dd'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + 8, cy - 22); g.lineTo(cx + 14, cy - 32); g.stroke();
  g.fillStyle = `rgba(127,209,255,${0.5 + 0.5 * Math.sin(t * 4)})`; g.beginPath(); g.arc(cx + 14, cy - 32, 2.5, 0, 7); g.fill();
}

function drawMoonpad(g, x0, y0, t) {
  const s = TILE * 3, cx = x0 + s / 2, cy = y0 + s / 2;
  box(g, x0, y0, '#3a3f46', '#9aa3ad', 3, s);
  g.strokeStyle = '#e0b84a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.stroke();
  g.fillStyle = '#e0b84a'; g.font = '700 22px "Chakra Petch", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('L', cx, cy + 1);
  // Cohete chiquito parado al costado
  g.fillStyle = '#e8eef4'; rrect(g, x0 + s - 22, y0 + 10, 12, 34, 5); g.fill();
  g.fillStyle = '#e5533d'; g.beginPath(); g.moveTo(x0 + s - 22, y0 + 18); g.lineTo(x0 + s - 16, y0 + 4); g.lineTo(x0 + s - 10, y0 + 18); g.fill();
  g.fillStyle = '#5aa0ff'; g.beginPath(); g.arc(x0 + s - 16, y0 + 24, 3, 0, 7); g.fill();
  if (Math.sin(t * 2) > 0.6) { g.fillStyle = 'rgba(255,180,80,0.6)'; g.beginPath(); g.arc(x0 + s - 16, y0 + 48, 4, 0, 7); g.fill(); }
}
