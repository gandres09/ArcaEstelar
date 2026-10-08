'use strict';
// =====================================================================
//  Vulcano: un planeta volcánico (como Vulcanus en Factorio Space Age).
//  Ríos y lagos de lava que no se cruzan, mucho carbón, calcita y
//  tungsteno. La bomba de agua puesta al lado de la lava saca lava, y la
//  Fundición la convierte en placas con calcita. Lo cuidan gusanos gigantes.
// =====================================================================

const VULCAN_SIZE = [520, 400];
const VULCAN_FUEL = 100;        // combustible de cohete para ir
const VULCAN_SEED = 0x76756c63;
const onVulcan = () => !!(S && S.surface === 'vulcan');
const offEarth = () => !!(S && S.surface && S.surface !== 'earth');
const isLiquidO = (o) => o === 'water' || o === 'lava';

function generateVulcanMap(seed) {
  oreType = new Uint8Array(W * H);
  oreAmt = new Uint16Array(W * H);
  const rnd = mulberry32((seed ^ VULCAN_SEED) >>> 0);
  const cx = W >> 1, cy = H >> 1;
  const id = (k) => ORE_IDS.indexOf(k);
  const LAVA = id('lava');
  const sk = (seed >>> 0) % 977;
  // Ríos de lava (crestas de un ruido suave) y algunos lagos; la zona de llegada queda libre
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(wdx(x - cx), wdy(y - cy));
    if (d < 34) continue;
    const r = Math.abs(vnoise(x, y, 70, 300 + sk) - 0.5);
    const lake = vnoise(x, y, 40, 301 + sk);
    if (r < 0.022 || lake > 0.8) { oreType[y * W + x] = LAVA; oreAmt[y * W + x] = 65000; }
  }
  const patch = (px, py, rad, ore, rich) => {
    for (let y = Math.floor(py - rad - 2); y <= py + rad + 2; y++) for (let x = Math.floor(px - rad - 2); x <= px + rad + 2; x++) {
      const d = Math.hypot(x - px, y - py);
      if (d >= rad + (rnd() - 0.5) * 2) continue;
      const i = tIdx(x, y);
      if (oreType[i] === LAVA) continue;
      oreType[i] = id(ore);
      const t = Math.max(0, 1 - d / (rad + 0.5)), peak = Math.max(2600, rich * 1.6);
      oreAmt[i] = Math.min(65000, Math.round(3 * (500 + (peak - 500) * Math.pow(t, 1.3)) * (0.9 + rnd() * 0.2)));
    }
  };
  // Cerca de la llegada: carbón, calcita, piedra y un poco de tungsteno
  const starts = [['coal', 5, 1400], ['calcite', 4.5, 1200], ['stone', 3.5, 900], ['tungsten_ore', 3.5, 900], ['iron_ore', 3, 800]];
  const a0 = rnd() * Math.PI * 2;
  starts.forEach(([ore, r, rich], i) => {
    const a = a0 + i * (Math.PI * 2 / starts.length), d = 15 + rnd() * 6;
    patch(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), r, ore, rich);
  });
  for (let i = 0; i < 170; i++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    const d = Math.hypot(wdx(px - cx), wdy(py - cy));
    if (d < 30) continue;
    const r = rnd();
    const ore = r < 0.3 ? 'coal' : r < 0.55 ? 'calcite' : r < 0.8 ? 'tungsten_ore' : r < 0.9 ? 'stone' : 'copper_ore';
    patch(px, py, 3 + rnd() * 5, ore, 900 * (1 + d / 60));
  }
  for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) { oreType[y * W + x] = 0; oreAmt[y * W + x] = 0; }
  oreBase = oreAmt.slice();
  oreTypeBase = oreType.slice();
  chopped = new Set(); planted = new Map(); treeCache.clear();
  computeBiomes(seed); computeCliffs(seed);
  computeForest();
  resetMapGraphics();
}

// Gusanos gigantes ("demoledores"): la primera vez que se llega, lejos de la base
function vulcanWorms() {
  const rnd = mulberry32((S.seed ^ 0x3d3e3f) >>> 0);
  const cx = W >> 1, cy = H >> 1;
  let n = 0;
  for (let t = 0; t < 3000 && n < 40; t++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    if (Math.hypot(wdx(x - cx), wdy(y - cy)) < 70) continue;
    if (oreAt(x, y) || at(x, y)) continue;
    addWorm(x, y, 'big');
    n++;
  }
}

// Suelo de basalto oscuro con ceniza; la lava brilla
const BASALT_DARK = [42, 36, 38], BASALT_LIGHT = [88, 74, 70], ASH = [120, 112, 104];
function vulcanTerrainAt(x, y) {
  const n = vnoise(x, y, 9, 31) * 0.55 + vnoise(x, y, 33, 32) * 0.45;
  let c = mixRgb(BASALT_DARK, BASALT_LIGHT, n);
  const ash = vnoise(x, y, 21, 33);
  if (ash > 0.66) c = mixRgb(c, ASH, Math.min(0.6, (ash - 0.66) * 3));
  return c;
}
const LAVA_DARK = [150, 30, 10], LAVA_HOT = [255, 140, 30];
function lavaColor(x, y) {
  const n = vnoise(x, y, 5, 34);
  return mixRgb(LAVA_DARK, LAVA_HOT, 0.35 + n * 0.65);
}
function drawLava(g, x, y, px, py) {
  for (let by = 0; by < TILE; by += 4) for (let bx = 0; bx < TILE; bx += 4) {
    const c = lavaColor(x + (bx + 2) / TILE, y + (by + 2) / TILE);
    g.fillStyle = rgbStr(c);
    g.fillRect(px + bx, py + by, 4, 4);
  }
  // Costra oscura en el borde
  g.strokeStyle = 'rgba(40,20,16,0.7)'; g.lineWidth = 3;
  DIRS.forEach(([dx, dy], d) => {
    if (oreAt(x + dx, y + dy) === 'lava') return;
    g.beginPath();
    if (d === 0) { g.moveTo(px + TILE - 1, py); g.lineTo(px + TILE - 1, py + TILE); }
    else if (d === 1) { g.moveTo(px, py + TILE - 1); g.lineTo(px + TILE, py + TILE - 1); }
    else if (d === 2) { g.moveTo(px + 1, py); g.lineTo(px + 1, py + TILE); }
    else { g.moveTo(px, py + 1); g.lineTo(px + TILE, py + 1); }
    g.stroke();
  });
}
function drawVulcanGround(g, x, y, px, py) {
  const f = hash(x, y, 210);
  if (f < 0.06) rock(g, px + 8 + hash(x, y, 211) * 14, py + 10 + hash(x, y, 212) * 12, 2.5 + hash(x, y, 213) * 2.5, '#3a3034', 0.25);
  else if (f > 0.96) { g.fillStyle = 'rgba(255,120,40,0.35)'; g.beginPath(); g.arc(px + 16, py + 16, 2, 0, Math.PI * 2); g.fill(); }
}
