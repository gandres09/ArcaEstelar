'use strict';
// =====================================================================
//  Mapa: generación de yacimientos, agotamiento y dibujo en bloques
// =====================================================================

let oreType;   // Uint8Array: id de mineral por casilla (0 = pasto)
let oreAmt;    // Uint16Array: cantidad restante
let pixelMap;  // canvas de W×H píxeles: un píxel por casilla (minimapa y zoom lejano)
const CHUNK = 16;
const chunkCache = new Map();
const MAX_CHUNKS = 60;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x, y, k) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// El mapa da la vuelta: saliendo por un borde se entra por el opuesto
const wrapX = (x) => { x %= W; return x < 0 ? x + W : x; };
const wrapY = (y) => { y %= H; return y < 0 ? y + H : y; };
const wdx = (d) => d - W * Math.round(d / W);   // diferencia más corta en x
const wdy = (d) => d - H * Math.round(d / H);
const wdist = (ax, ay, bx, by) => Math.hypot(wdx(bx - ax), wdy(by - ay));
const tIdx = (x, y) => wrapY(y) * W + wrapX(x);
const inBounds = () => true;
const oreAt = (x, y) => ORE_IDS[oreType[tIdx(x, y)]];
const oreAmountAt = (x, y) => oreAmt[tIdx(x, y)];

// --------------------------- Opciones del mapa, biomas y acantilados ---------------------------
// Como el menú de Factorio: frecuencia, tamaño y riqueza de cada recurso, más agua, árboles, acantilados y nidos
const MAP_OPT_RES = ['iron_ore', 'copper_ore', 'coal', 'stone', 'quartz', 'titanium_ore', 'oil'];
function defaultMapOpts() {
  const o = { res: {}, water: 1, trees: 1, cliffs: 1, enemies: 1, biomes: true };
  for (const k of MAP_OPT_RES) o.res[k] = { freq: 1, size: 1, rich: 1 };
  return o;
}
// Opciones de la partida (las partidas de antes de la generación 7 usan las normales)
let mapOptsCache = { s: null, o: null, gen: 0, v: null };
function mapOpts() {
  const c = mapOptsCache;
  if (c.v && c.s === S && c.o === (S && S.mapOpts) && c.gen === (S && S.mapGen)) return c.v;
  c.s = S; c.o = S && S.mapOpts; c.gen = S && S.mapGen;
  return (c.v = buildMapOpts());
}
function buildMapOpts() {
  const d = defaultMapOpts(), o = S && S.mapGen >= 7 && S.mapOpts;
  if (!o) return d;
  for (const k of MAP_OPT_RES) d.res[k] = { ...d.res[k], ...((o.res || {})[k] || {}) };
  for (const k of ['water', 'trees', 'cliffs', 'enemies']) if (typeof o[k] === 'number') d[k] = o[k];
  if (o.biomes === false) d.biomes = false;
  return d;
}
const resOpt = (id) => mapOpts().res[ORE_IDS[id]] || { freq: 1, size: 1, rich: 1 };

let cliffs = new Uint8Array(0);   // 1 = acantilado natural
let cliffGone = new Set();        // acantilados volados con explosivos
let biomeDry = new Uint8Array(0), biomeDesert = new Uint8Array(0), biomeRed = new Uint8Array(0);   // 0..255 por casilla
const cliffAt = (x, y) => { const i = tIdx(x, y); return cliffs[i] === 1 && !cliffGone.has(i); };
const smooth01 = (v) => Math.max(0, Math.min(1, v));

// Biomas: humedad y temperatura (ruido muy suave). Cerca de la Nave siempre es pasto.
function computeBiomes(seed) {
  const n = W * H;
  biomeDry = new Uint8Array(n); biomeDesert = new Uint8Array(n); biomeRed = new Uint8Array(n);
  if (!(S && S.mapGen >= 7 && S.surface !== 'moon' && mapOpts().biomes)) return;
  const sk = (seed >>> 0) % 997, cx = W >> 1, cy = H >> 1;
  // Cambian muy suave: se calculan de a bloques de 2×2
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    let m = vnoise(x, y, 170, 200 + sk) * 0.75 + vnoise(x, y, 47, 201 + sk) * 0.25;
    const t = vnoise(x, y, 230, 202 + sk);
    const near = smooth01((wdist(x, y, cx, cy) - 60) / 90);
    m = 0.68 + (m - 0.68) * near;
    const de = Math.round(255 * smooth01((0.4 - m) / 0.1)), dr = Math.round(255 * smooth01((0.5 - m) / 0.1)), re = Math.round(255 * smooth01((t - 0.56) / 0.1));
    for (let dy = 0; dy < 2 && y + dy < H; dy++) for (let dx = 0; dx < 2 && x + dx < W; dx++) {
      const i = (y + dy) * W + x + dx;
      biomeDesert[i] = de; biomeDry[i] = dr; biomeRed[i] = re;
    }
  }
}
// Cuántos árboles crecen en el bioma (1 = pasto, casi nada en el desierto)
function biomeTrees(i) {
  if (!biomeDesert.length) return 1;
  return (1 - biomeDesert[i] / 255 * 0.94) * (1 - biomeDry[i] / 255 * 0.55);
}

// Acantilados: siguen las curvas de nivel de una "altura" suave, cortados a tramos
function computeCliffs(seed) {
  cliffs = new Uint8Array(W * H);
  cliffGone = new Set();
  const amt = mapOpts().cliffs;
  if (!(S && S.mapGen >= 7 && S.surface !== 'moon') || amt <= 0) return;
  const sk = (seed >>> 0) % 991, cx = W >> 1, cy = H >> 1;
  const levels = 4 + 3 * amt;                 // más niveles, más líneas
  const gapT = Math.min(0.8, 0.36 + 0.12 * amt); // más alto, menos huecos
  const lvl = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = vnoise(x, y, 95, 210 + sk) * 0.72 + vnoise(x, y, 31, 211 + sk) * 0.28;
    lvl[y * W + x] = Math.floor(e * levels);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const r = lvl[y * W + wrapX(x + 1)], b = lvl[wrapY(y + 1) * W + x];
    if (lvl[i] === r && lvl[i] === b) continue;
    if (oreType[i] !== 0) continue;
    if (vnoise(x, y, 13, 212 + sk) > gapT) continue;   // huecos para pasar
    if (wdist(x, y, cx, cy) < 48) continue;            // la zona de la Nave queda libre
    cliffs[i] = 1;
  }
}

// Vuela los acantilados alrededor de (x, y)
function blowCliffs(x, y, r = 2.2) {
  let n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (Math.hypot(dx, dy) > r) continue;
    const tx = wrapX(x + dx), ty = wrapY(y + dy), i = ty * W + tx;
    if (cliffs[i] === 1 && !cliffGone.has(i)) { cliffGone.add(i); n++; treeChanged(tx, ty); }
  }
  return n;
}

function generateMap(seed) {
  if (S && S.surface === 'moon') { generateMoonMap(seed); return; }
  oreType = new Uint8Array(W * H);
  oreAmt = new Uint16Array(W * H);
  const rnd = mulberry32(seed);
  const cx = W >> 1, cy = H >> 1;
  const K = (W * H) / (320 * 240); // cantidad de cosas según el tamaño del mapa
  const legacy = K === 1;          // partidas viejas de 320×240: se generan igual que antes
  const outside = (x, y) => legacy && (x < 0 || y < 0 || x >= W || y >= H);
  // Generación 2 (partidas nuevas): yacimientos más chicos pero mucho más ricos,
  // así cada uno dura más y no hay que mudar la fábrica tan seguido
  const gen = (S && S.mapGen) || 1;
  const gen2 = gen >= 2;
  const RAD = gen2 ? 0.68 : 1, RICH = gen2 ? 4 : 1, MORE = gen2 ? 1.3 : 1;

  const g7 = gen >= 7;
  const opts = g7 ? mapOpts() : null;
  const patch = (px, py, r0, id, rich0) => {
    const ro = g7 ? resOpt(id) : null;
    const rad = r0 * RAD * (ro ? Math.sqrt(ro.size) : 1), richness = rich0 * RICH;
    const rmul = ro ? ro.rich : 1;
    for (let y = Math.floor(py - rad - 2); y <= py + rad + 2; y++) {
      for (let x = Math.floor(px - rad - 2); x <= px + rad + 2; x++) {
        if (outside(x, y)) continue;
        const d = Math.hypot(x - px, y - py);
        if (d < rad + (rnd() - 0.5) * 2) {
          const i = tIdx(x, y);
          oreType[i] = id;
          if (gen2) {
            // Mucho en el centro y poco en los bordes (x3: unas 1500 en el borde, 7000+ en el centro)
            const t = Math.max(0, 1 - d / (rad + 0.5));
            const peak = Math.max(2600, richness * 1.6);
            oreAmt[i] = Math.min(65000, Math.round(rmul * 3 * (500 + (peak - 500) * Math.pow(t, 1.3)) * (0.9 + rnd() * 0.2)));
          } else {
            // Más rico en el centro del yacimiento
            oreAmt[i] = Math.min(65000, Math.round(richness * (1.4 - 0.8 * d / (rad + 1)) * (0.8 + rnd() * 0.4)));
          }
        }
      }
    }
  };

  // Lagos (el agua no se agota)
  const lake = (px, py, rad) => {
    for (let y = Math.floor(py - rad - 3); y <= py + rad + 3; y++) {
      for (let x = Math.floor(px - rad - 3); x <= px + rad + 3; x++) {
        if (outside(x, y)) continue;
        const d = Math.hypot(x - px, (y - py) * 1.2);
        const wobble = legacy ? Math.sin(x * 0.7 + seed) * 0.8 + Math.cos(y * 0.6 + seed) * 0.8
          : Math.sin((x - px) * 0.7 + seed) * 0.8 + Math.cos((y - py) * 0.6 + seed) * 0.8;
        if (d < rad + wobble) { oreType[tIdx(x, y)] = 8; oreAmt[tIdx(x, y)] = 65000; }
      }
    }
  };
  for (let i = 0; i < 26 * K * (g7 ? opts.water : 1); i++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    if (Math.hypot(px - cx, py - cy) < 30) continue;
    lake(px, py, 3 + rnd() * 9);
  }

  // Yacimientos iniciales alrededor de la Nave
  if (gen >= 3) {
    // Partidas nuevas: los mismos seis yacimientos, pero en otro orden y otro ángulo cada vez
    const starts = [[1, 5.5, 420], [2, 5.5, 380], [3, 4.5, 380], [4, 4.5, 320], [1, 3.5, 380], [2, 4, 380]];
    for (let i = starts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [starts[i], starts[j]] = [starts[j], starts[i]]; }
    const a0 = rnd() * Math.PI * 2;
    starts.forEach(([id, rad, rich], i) => {
      const a = a0 + i * (Math.PI * 2 / starts.length) + (rnd() - 0.5) * 0.5;
      const d = 15 + rnd() * 9;
      patch(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.8), rad, id, rich);
    });
  } else {
    patch(cx - 15, cy - 9, 5.5, 1, 420);
    patch(cx + 15, cy - 9, 5.5, 2, 380);
    patch(cx - 13, cy + 10, 4.5, 3, 380);
    patch(cx + 13, cy + 10, 4.5, 4, 320);
    patch(cx - 2, cy + 22, 3.5, 1, 380);
    patch(cx + 26, cy + 6, 4, 2, 380);
  }

  // Recursos en anillos: más lejos, más raros y más ricos
  const ring = (id, dmin, dmax, count, rmin, rmax, rich) => {
    if (g7) count = Math.round(count * resOpt(id).freq);
    let placed = 0, tries = 0;
    while (placed < count && tries++ < 800) {
      const a = rnd() * Math.PI * 2, d = dmin + rnd() * (dmax - dmin);
      const px = Math.round(cx + Math.cos(a) * d), py = Math.round(cy + Math.sin(a) * d * 0.75);
      if (legacy && (px < 4 || py < 4 || px > W - 5 || py > H - 5)) continue;
      patch(px, py, rmin + rnd() * (rmax - rmin), id, rich * (1 + d / 50));
      placed++;
    }
  };
  // Generación 4: lo valioso queda lejos de la Nave, hay que salir a explorar (y pelear)
  const far = gen >= 4 && K > 4;
  const farther = gen >= 5 && K > 4;   // lo valioso, bien lejos
  const farthest = gen >= 6 && K > 4;  // partidas nuevas: todavía más lejos
  if (farthest) {
    ring(5, 300, 440, 4, 3, 5, 450);
    ring(6, 430, 560, 6, 3.5, 6.5, 500);
    ring(5, 440, W / 2, Math.round(5 * K), 3, 6, 450);
    ring(6, 560, W / 2, Math.round(5 * K), 4, 7, 500);
  } else if (farther) {
    ring(5, 160, 260, 4, 3, 5, 450);
    ring(6, 300, 420, 6, 3.5, 6.5, 500);
    ring(5, 260, W / 2, Math.round(6 * K), 3, 6, 450);
    ring(6, 420, W / 2, Math.round(6 * K), 4, 7, 500);
  } else if (far) {
    ring(5, 70, 150, 4, 3, 5, 450);
    ring(6, 170, 300, 6, 3.5, 6.5, 500);
    ring(5, 150, W / 2, Math.round(6 * K), 3, 6, 450);
    ring(6, 300, W / 2, Math.round(6 * K), 4, 7, 500);
  } else {
    ring(5, 28, 50, 4, 3, 5, 450);
    ring(6, 60, 130, 7, 3.5, 6.5, 500);
    if (K > 1) {
      ring(5, 50, W / 2, Math.round(6 * K), 3, 6, 450);
      ring(6, 130, W / 2, Math.round(6 * K), 4, 7, 500);
    }
  }

  // Pozos de petróleo: grupos de casillas sueltas
  const oilField = (px, py) => {
    if (g7) {
      // Como en Factorio: pozos sueltos, separados entre sí, cada uno con su rendimiento
      const oo = opts.res.oil, wells = [];
      const want = Math.max(2, Math.round((5 + rnd() * 6) * oo.size)), spread = 6 + 3 * Math.sqrt(oo.size);
      for (let t = 0; t < 60 && wells.length < want; t++) {
        const x = Math.round(px + (rnd() - 0.5) * 2 * spread), y = Math.round(py + (rnd() - 0.5) * 2 * spread);
        if (wells.some(([wx, wy]) => Math.max(Math.abs(wx - x), Math.abs(wy - y)) < 3)) continue;
        if (oreType[tIdx(x, y)] === 8) continue;
        wells.push([x, y]);
        oreType[tIdx(x, y)] = 7;
        oreAmt[tIdx(x, y)] = Math.min(65000, Math.round((25000 + rnd() * 35000) * oo.rich));
      }
      return;
    }
    for (let k = 0; k < 4 + Math.floor(rnd() * 4); k++) {
      const x = Math.round(px + (rnd() - 0.5) * 9), y = Math.round(py + (rnd() - 0.5) * 9);
      if (outside(x, y)) continue;
      oreType[tIdx(x, y)] = 7;
      oreAmt[tIdx(x, y)] = 30000 + Math.floor(rnd() * 30000);
    }
  };
  let fields = 0, tries = 0;
  // Un solo pozo de petróleo cerca, para empezar; el resto, muy lejos
  if (farthest) { const a = rnd() * Math.PI * 2, d = 45 + rnd() * 20; oilField(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.75)); }
  const oilN = 9 * K * (g7 ? opts.res.oil.freq : 1);
  while (fields < oilN && tries++ < 500 * K) {
    const d0 = farthest ? 380 : farther ? 230 : far ? 90 : 32;
    const a = rnd() * Math.PI * 2, d = d0 + rnd() * (fields < 9 ? (farthest ? 200 : farther ? 170 : far ? 150 : 100) : W / 2 - d0);
    const px = Math.round(cx + Math.cos(a) * d), py = Math.round(cy + Math.sin(a) * d * 0.75);
    if (legacy && (px < 6 || py < 6 || px > W - 7 || py > H - 7)) continue;
    oilField(px, py);
    fields++;
  }

  // Yacimientos comunes por todo el mapa
  const fq = g7 ? [0, ...[1, 2, 3, 4, 5, 6].map((k) => resOpt(k).freq)] : null;
  const fqSum = g7 ? fq[1] + fq[2] + fq[3] + fq[4] : 4;
  for (let i = 0; i < Math.round(220 * K * MORE * (g7 ? fqSum / 4 : 1)); i++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    const d = Math.hypot(px - cx, (py - cy) / 0.75);
    if (d < 26) continue;
    let id = 1 + Math.floor(rnd() * 4);
    if (g7) { let r = rnd() * fqSum; for (id = 1; id < 4 && (r -= fq[id]) > 0; id++); }
    if (d > (farthest ? 380 : farther ? 240 : far ? 120 : 35) && rnd() < 0.15 * (g7 ? fq[5] : 1)) id = 5;
    if (d > (farthest ? 540 : farther ? 400 : far ? 260 : 60) && rnd() < 0.15 * (g7 ? fq[6] : 1)) id = 6;
    patch(px, py, 2.5 + rnd() * 5, id, 380 * (1 + d / 45));
  }

  // Un lago chico cerca de la Nave para la energía a vapor
  if (gen >= 3) { const a = rnd() * Math.PI * 2; lake(Math.round(cx + Math.cos(a) * 26), Math.round(cy + Math.sin(a) * 22), 4.5); }
  else lake(cx + 4, cy - 24, 4.5);

  // Despejar la zona de la Nave
  for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) { oreType[y * W + x] = 0; oreAmt[y * W + x] = 0; }
  oreBase = oreAmt.slice();
  oreTypeBase = oreType.slice();
  chopped = new Set(); planted = new Map(); treeCache.clear();
  computeBiomes(seed);
  computeCliffs(seed);
  computeForest();
  resetMapGraphics();
}

// Saca una unidad de mineral de la casilla; devuelve el mineral o null si no queda
function mineOre(x, y) {
  const i = tIdx(x, y);
  const id = oreType[i];
  if (!id) return null;
  if (id === 8) return 'water';
  const before = oreStep(i);
  if (--oreAmt[i] <= 0) {
    oreType[i] = 0;
    oreAmt[i] = 0;
    invalidateTile(x, y);
  } else if (id !== 7 && oreStep(i) !== before) invalidateChunkOf(x, y);   // se ve más chico
  return ORE_IDS[id];
}

// Cuánto queda de un yacimiento, en escalones de 10 % (para redibujarlo cuando baja)
function oreLeft(i) { return Math.min(1, oreAmt[i] / Math.max(1, oreBase[i] || oreAmt[i])); }
function oreStep(i) { return Math.ceil(oreLeft(i) * 10); }
function invalidateChunkOf(x, y) {
  x = wrapX(x); y = wrapY(y);
  chunkCache.delete(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
}

// --------------------------- Dibujo del mapa ---------------------------

// Ruido suave (interpolado) para que el pasto varíe sin que se note la grilla
function vnoise(x, y, scale, k) {
  // Periódico: la red de puntos encaja justo con el tamaño del mapa, así no hay costura en los bordes
  const nx = Math.max(1, Math.round(W / scale)), ny = Math.max(1, Math.round(H / scale));
  const fx = x * nx / W, fy = y * ny / H;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const X0 = ((x0 % nx) + nx) % nx, X1 = (X0 + 1) % nx, Y0 = ((y0 % ny) + ny) % ny, Y1 = (Y0 + 1) % ny;
  const a = hash(X0, Y0, k), b = hash(X1, Y0, k), c = hash(X0, Y1, k), d = hash(X1, Y1, k);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const lerp = (a, b, t) => a + (b - a) * t;
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgbStr = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const GRASS_DARK = [36, 58, 33], GRASS_LIGHT = [72, 102, 50], GRASS_DRY = [104, 104, 60], DIRT = [92, 74, 52];
const SAND = [190, 172, 122];
const WATER_SHALLOW = [58, 128, 164], WATER_MID = [38, 98, 150], WATER_DEEP = [24, 66, 120];

// Color del suelo en un punto (en casillas, con decimales)
const DESERT_LIGHT = [204, 180, 122], DESERT_DARK = [176, 150, 98], RED_LIGHT = [176, 104, 66], RED_DARK = [140, 78, 50], STEPPE = [128, 118, 66];
function terrainAt(x, y) {
  if (S && S.surface === 'moon') return moonTerrainAt(x, y);
  const n = vnoise(x, y, 7, 3) * 0.6 + vnoise(x, y, 23, 4) * 0.4;
  let c = mixRgb(GRASS_DARK, GRASS_LIGHT, n);
  const dry = vnoise(x, y, 41, 5);
  if (dry > 0.6) c = mixRgb(c, GRASS_DRY, Math.min(1, (dry - 0.6) * 2.2));
  const dirt = vnoise(x, y, 11, 6);
  if (dirt > 0.78) c = mixRgb(c, DIRT, Math.min(0.7, (dirt - 0.78) * 4));
  // Biomas: pasto seco, desierto de arena y desierto rojo
  if (biomeDry.length) {
    const i = tIdx(Math.floor(x), Math.floor(y));
    const bd = biomeDry[i], bs = biomeDesert[i];
    if (bd) c = mixRgb(c, STEPPE, bd / 255 * 0.7);
    if (bs) {
      const r = biomeRed[i] / 255;
      const sand = mixRgb(mixRgb(DESERT_DARK, DESERT_LIGHT, n), mixRgb(RED_DARK, RED_LIGHT, n), r);
      c = mixRgb(c, sand, bs / 255);
    }
  }
  return c;
}
const CLIFF_RGB = [92, 78, 62];

const isWaterT = (x, y) => oreType[tIdx(x, y)] === 8;

// Distancia (0, 1 o 2+) del agua a la tierra más cercana: define lo profundo
function waterDepth(x, y) {
  for (let r = 1; r <= 2; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && inBounds(x + dx, y + dy) && !isWaterT(x + dx, y + dy)) return r - 1;
    }
  }
  return 2;
}

function tilePixel(x, y) {
  const o = oreAt(x, y);
  if (o === 'water') return [WATER_SHALLOW, WATER_MID, WATER_DEEP][waterDepth(x, y)];
  const base = terrainAt(x + 0.5, y + 0.5);
  if (!o && cliffAt(x, y)) return CLIFF_RGB;
  if (!o) return treeAt(x, y) ? mixRgb(base, [24, 46, 24], 0.55) : base;
  return mixRgb(base, hexToRgb(ITEMS[o].color), o === 'oil' ? 0.7 : 0.55);
}

function resetMapGraphics() {
  chunkCache.clear();
  treeCache.clear();
  pixelMap = document.createElement('canvas');
  pixelMap.width = W; pixelMap.height = H;
  const g = pixelMap.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, gg, b] = tilePixel(x, y), i = (y * W + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

function invalidateTile(x, y) {
  x = wrapX(x); y = wrapY(y);
  // El relleno cambia la orilla: se redibujan también los bloques vecinos
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    chunkCache.delete(Math.floor(wrapX(x + dx) / CHUNK) + ',' + Math.floor(wrapY(y + dy) / CHUNK));
  }
  const g = pixelMap.getContext('2d');
  g.fillStyle = rgbStr(tilePixel(x, y));
  g.fillRect(x, y, 1, 1);
}

// Una roca con luz desde arriba a la izquierda
function rock(g, x, y, r, color, gloss = 0.35) {
  const c = hexToRgb(color);
  const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  grd.addColorStop(0, rgbStr(mixRgb(c, [255, 255, 255], gloss)));
  grd.addColorStop(0.55, rgbStr(c));
  grd.addColorStop(1, rgbStr(mixRgb(c, [0, 0, 0], 0.45)));
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.35, r, r * 0.75, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = grd;
  g.beginPath(); g.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2); g.fill();
}

// Un cristal (cuarzo y titanio)
function crystal(g, x, y, h, color) {
  const c = hexToRgb(color);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(x + 2, y + 2, h * 0.45, h * 0.2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgbStr(mixRgb(c, [0, 0, 0], 0.25));
  g.beginPath(); g.moveTo(x - h * 0.3, y); g.lineTo(x, y - h); g.lineTo(x + h * 0.3, y); g.lineTo(x, y + h * 0.15); g.closePath(); g.fill();
  g.fillStyle = rgbStr(mixRgb(c, [255, 255, 255], 0.35));
  g.beginPath(); g.moveTo(x - h * 0.3, y); g.lineTo(x, y - h); g.lineTo(x, y + h * 0.15); g.closePath(); g.fill();
}

// Tinte suave del suelo alrededor de los yacimientos (interpolado entre casillas)
function oreGroundAt(fx, fy) {
  const x0 = Math.floor(fx - 0.5), y0 = Math.floor(fy - 0.5);
  const tx = fx - 0.5 - x0, ty = fy - 0.5 - y0;
  let w = 0, r = 0, gg = 0, b = 0;
  for (let k = 0; k < 4; k++) {
    const x = x0 + (k & 1), y = y0 + (k >> 1);
    const o = inBounds(x, y) ? oreAt(x, y) : null;
    if (!o || o === 'water' || o === 'oil') continue;
    const kw = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty);
    const c = hexToRgb(ORE_GROUND[o]);
    w += kw; r += c[0] * kw; gg += c[1] * kw; b += c[2] * kw;
  }
  if (w < 0.01) return null;
  const n = 0.75 + vnoise(fx * 3, fy * 3, 2, 12) * 0.5;
  return [[r / w, gg / w, b / w], Math.min(0.62, w * 0.55 * n)];
}

function drawTile(g, x, y, px, py) {
  const o = oreAt(x, y);
  // Suelo: bloques de 4 px con el color suave del terreno
  if (o !== 'water') {
    for (let by = 0; by < TILE; by += 4) {
      for (let bx = 0; bx < TILE; bx += 4) {
        const fx = x + (bx + 2) / TILE, fy = y + (by + 2) / TILE;
        let c = terrainAt(fx, fy);
        const og = oreGroundAt(fx, fy);
        if (og) c = mixRgb(c, og[0], og[1]);
        const j = (hash(x * 8 + bx, y * 8 + by, 2) - 0.5) * 6;
        g.fillStyle = rgbStr([c[0] + j, c[1] + j, c[2] + j]);
        g.fillRect(px + bx, py + by, 4, 4);
      }
    }
    // Arena en la orilla
    DIRS.forEach(([dx, dy], d) => {
      if (!isWaterT(x + dx, y + dy)) return;
      const grd = d === 0 ? g.createLinearGradient(px + TILE, 0, px + TILE - 14, 0) : d === 2 ? g.createLinearGradient(px, 0, px + 14, 0)
        : d === 1 ? g.createLinearGradient(0, py + TILE, 0, py + TILE - 14) : g.createLinearGradient(0, py, 0, py + 14);
      grd.addColorStop(0, rgbStr(SAND, 0.95)); grd.addColorStop(1, rgbStr(SAND, 0));
      g.fillStyle = grd;
      g.fillRect(px, py, TILE, TILE);
    });
  }

  if (o === 'water') {
    // Profundidad interpolada entre casillas para que no se vean escalones
    const dAt = (tx, ty) => isWaterT(tx, ty) ? waterDepth(tx, ty) : (inBounds(tx, ty) ? -0.5 : 2);
    const d00 = dAt(x - 1, y - 1), d10 = dAt(x, y - 1), d20 = dAt(x + 1, y - 1);
    const d01 = dAt(x - 1, y), d11 = dAt(x, y), d21 = dAt(x + 1, y);
    const d02 = dAt(x - 1, y + 1), d12 = dAt(x, y + 1), d22 = dAt(x + 1, y + 1);
    for (let by = 0; by < TILE; by += 4) {
      for (let bx = 0; bx < TILE; bx += 4) {
        const fx = (bx + 2) / TILE - 0.5, fy = (by + 2) / TILE - 0.5;
        const ax = Math.abs(fx), ay = Math.abs(fy);
        const hx = fx < 0 ? d01 : d21, vy = fy < 0 ? d10 : d12, cn = fx < 0 ? (fy < 0 ? d00 : d02) : (fy < 0 ? d20 : d22);
        const top = d11 + (hx - d11) * ax, bot = vy + (cn - vy) * ax;
        const dd = Math.max(0, Math.min(2, top + (bot - top) * ay));
        let c = dd < 1 ? mixRgb(WATER_SHALLOW, WATER_MID, dd) : mixRgb(WATER_MID, WATER_DEEP, dd - 1);
        const n = (vnoise(x + fx, y + fy, 3, 13) - 0.5) * 10;
        g.fillStyle = rgbStr([c[0] + n, c[1] + n, c[2] + n]);
        g.fillRect(px + bx, py + by, 4, 4);
      }
    }
    // Espuma contra la orilla
    g.strokeStyle = 'rgba(230,245,255,0.55)';
    g.lineWidth = 2;
    DIRS.forEach(([dx, dy], d) => {
      if (isWaterT(x + dx, y + dy) || !inBounds(x + dx, y + dy)) return;
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, w = Math.sin((x + y) * 3 + k * 1.7) * 1.5 + 3;
        const ex = d === 0 ? px + TILE - w : d === 2 ? px + w : px + t * TILE;
        const ey = d === 1 ? py + TILE - w : d === 3 ? py + w : py + t * TILE;
        if (k) g.lineTo(ex, ey); else g.moveTo(ex, ey);
      }
      g.stroke();
    });
    // Brillitos
    g.strokeStyle = 'rgba(200,230,255,0.18)';
    g.lineWidth = 1.2;
    for (let k = 0; k < 2; k++) {
      const wy = py + 8 + k * 14 + hash(x, y, 40 + k) * 4, wx = px + 4 + hash(x, y, 50 + k) * 12;
      g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 4, wy - 2, wx + 8, wy); g.stroke();
    }
    return;
  }

  if (!o && S && S.surface === 'moon') { drawMoonGround(g, x, y, px, py); return; }
  if (!o && cliffAt(x, y)) { drawCliff(g, x, y, px, py); return; }
  const desertHere = biomeDesert.length ? biomeDesert[tIdx(x, y)] / 255 : 0;
  if (!o && desertHere > 0.5) {
    // Desierto: ondas de arena y alguna piedrita
    g.strokeStyle = 'rgba(120,90,50,0.22)'; g.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      const wy = py + 8 + k * 13 + hash(x, y, 60 + k) * 5, wx = px + 3 + hash(x, y, 62 + k) * 10;
      g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 7, wy - 3, wx + 14, wy); g.stroke();
    }
    if (hash(x, y, 90) > 0.93) rock(g, px + 10 + hash(x, y, 98) * 12, py + 12 + hash(x, y, 99) * 10, 2 + hash(x, y, 97) * 2, '#a08868', 0.3);
    return;
  }
  if (!o) {
    // Pasto: matas, flores y piedritas
    g.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const bx = px + 3 + hash(x, y, 60 + k) * 26, by = py + 6 + hash(x, y, 70 + k) * 24;
      g.strokeStyle = hash(x, y, 80 + k) > 0.5 ? 'rgba(120,160,70,0.5)' : 'rgba(20,40,18,0.45)';
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 1.5, by - 4); g.moveTo(bx, by); g.lineTo(bx + 1.5, by - 4.5); g.stroke();
    }
    const f = hash(x, y, 90);
    if (f < 0.05) {
      const colors = ['#f2efe6', '#f0d44d', '#c58ae0', '#e86a6a'];
      g.fillStyle = colors[Math.floor(hash(x, y, 91) * colors.length)];
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(px + 6 + hash(x, y, 92 + k) * 20, py + 6 + hash(x, y, 95 + k) * 20, 1.6, 0, Math.PI * 2); g.fill(); }
    } else if (f > 0.95) {
      rock(g, px + 10 + hash(x, y, 98) * 12, py + 12 + hash(x, y, 99) * 10, 2.5 + hash(x, y, 97) * 2, '#8d8a80', 0.3);
    }
    return;
  }

  if (o === 'oil') {
    const grd = g.createRadialGradient(px + 16, py + 17, 2, px + 16, py + 17, 13);
    grd.addColorStop(0, '#000'); grd.addColorStop(0.8, '#120d10'); grd.addColorStop(1, 'rgba(18,13,16,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(px + 16, py + 17, 13, 10, 0.3, 0, Math.PI * 2); g.fill();
    const sheen = g.createLinearGradient(px + 8, py + 10, px + 22, py + 18);
    sheen.addColorStop(0, 'rgba(120,80,220,0.45)'); sheen.addColorStop(0.5, 'rgba(60,200,180,0.35)'); sheen.addColorStop(1, 'rgba(230,180,60,0.3)');
    g.fillStyle = sheen;
    g.beginPath(); g.ellipse(px + 14, py + 14, 6, 2.5, 0.3, 0, Math.PI * 2); g.fill();
    return;
  }

  // Minerales: rocas con volumen (la tierra ya se tiñó en bloques suaves)
  // Menos rocas y más chicas a medida que se pica
  const left = oreLeft(tIdx(x, y));
  const count = Math.max(1, Math.ceil(left * 5));
  const shrink = 0.5 + 0.5 * left;
  for (let k = 0; k < count; k++) {
    const ox = px + 6 + hash(x, y, 10 + k) * 20, oy = py + 7 + hash(x, y, 20 + k) * 19;
    const r = (3 + hash(x, y, 30 + k) * 3.5) * shrink;
    if (o === 'quartz' || o === 'titanium_ore') crystal(g, ox, oy + r, r * 2.2, ITEMS[o].color);
    else rock(g, ox, oy, r, ITEMS[o].color, o === 'coal' ? 0.25 : 0.35);
  }
}

// Acantilado: pared de roca con la cara hacia abajo; se une con los vecinos
function drawCliff(g, x, y, px, py) {
  const C = (dx, dy) => cliffAt(x + dx, y + dy);
  const L = C(-1, 0), R = C(1, 0), U = C(0, -1), D = C(0, 1);
  const x0 = px + (L ? 0 : 5), x1 = px + TILE - (R ? 0 : 5), y0 = py + (U ? 0 : 5), y1 = py + TILE - (D ? 0 : 3);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(x0 + 2, y0 + 4, x1 - x0, y1 - y0);
  for (let by = y0; by < y1; by += 4) for (let bx = x0; bx < x1; bx += 4) {
    const k = (hash(x * 8 + (bx - px), y * 8 + (by - py), 7) - 0.5) * 24;
    const t = (by - py) / TILE;
    const c = mixRgb([150, 132, 108], [70, 58, 46], t);
    g.fillStyle = rgbStr([c[0] + k, c[1] + k, c[2] + k]);
    g.fillRect(bx, by, Math.min(4, x1 - bx), Math.min(4, y1 - by));
  }
  // Grietas
  g.strokeStyle = 'rgba(40,30,22,0.55)'; g.lineWidth = 1.2;
  for (let k = 0; k < 2; k++) {
    const sx = x0 + 4 + hash(x, y, 120 + k) * (x1 - x0 - 8);
    g.beginPath(); g.moveTo(sx, y0 + 3); g.lineTo(sx + (hash(x, y, 125 + k) - 0.5) * 8, y1 - 3); g.stroke();
  }
  if (!U) { g.fillStyle = 'rgba(220,205,180,0.35)'; g.fillRect(x0, y0, x1 - x0, 3); }
}

// Densidad de bosque (los árboles se dibujan aparte, ver render.js)
function treeDensity(x, y) {
  return vnoise(x, y, 17, 9) * 0.75 + vnoise(x, y, 5, 10) * 0.25;
}

// --------------------------- Árboles ---------------------------
// Los árboles naturales salen de la semilla. Se pueden talar (dan madera) y plantar con viveros.
// Cada árbol: [x, y, variante, escala, dx, dy]

const WOOD_PER_TREE = 4;
let chopped = new Set();        // casillas con árbol natural talado
let planted = new Map();        // casilla -> árbol plantado
let treeCount = new Uint16Array(0);
let forestCell = new Float32Array(0);
const treeCache = new Map();

// ¿Hay un árbol natural en esta casilla? (solo pasto original, lejos de la Nave)
function naturalTreeAt(x, y) {
  if (S && S.surface === 'moon') return null;
  const i = y * W + x;
  if (oreBase[i] !== 0) return null;
  if (Math.abs(x - W / 2) < 9 && Math.abs(y - H / 2) < 9) return null;
  if (cliffs[i] === 1) return null;
  const d = treeDensity(x, y);
  let p = d > 0.5 ? (d - 0.5) * 2.6 : d > 0.36 ? 0.03 : 0;
  if (S && S.mapGen >= 7) p *= biomeTrees(i) * mapOpts().trees;
  if (!p || hash(x, y, 40) >= p) return null;
  return makeTree(x, y);
}

function makeTree(x, y) {
  const pine = vnoise(x, y, 29, 11) > 0.55;
  return [x, y, (pine ? 3 : 0) + Math.floor(hash(x, y, 41) * 3), 0.8 + hash(x, y, 42) * 0.45,
    (hash(x, y, 43) - 0.5) * 10, (hash(x, y, 44) - 0.5) * 10];
}

function treeAt(x, y) {
  x = wrapX(x); y = wrapY(y);
  const i = y * W + x;
  if (planted.has(i)) return true;
  return !chopped.has(i) && !!naturalTreeAt(x, y);
}

const forestOf = (n) => Math.min(1, n / 24);

// Se taló o plantó un árbol: se redibuja su chunk de árboles y su píxel del mapa
function treeChanged(x, y) {
  treeCache.delete(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
  // Los árboles van dibujados en el suelo: se redibujan los sectores que toca su copa
  const keys = new Set();
  for (const [ox, oy] of [[-1.3, -1.3], [2.3, -1.3], [-1.3, 2.3], [2.3, 2.3]]) {
    keys.add(Math.floor(wrapX(x + ox) / CHUNK) + ',' + Math.floor(wrapY(y + oy) / CHUNK));
  }
  for (const k of keys) chunkCache.delete(k);
  if (pixelMap) {
    const g = pixelMap.getContext('2d');
    g.fillStyle = rgbStr(tilePixel(x, y));
    g.fillRect(x, y, 1, 1);
  }
}
function treeCellChange(x, y, k) {
  const c = Math.floor(y / POLL_CELL) * PW + Math.floor(x / POLL_CELL);
  treeCount[c] = Math.max(0, treeCount[c] + k);
  forestCell[c] = forestOf(treeCount[c]);
}

// Tala el árbol de la casilla; devuelve true si había uno
function chopTree(x, y) {
  x = wrapX(x); y = wrapY(y);
  const i = y * W + x;
  if (planted.has(i)) planted.delete(i);
  else if (!chopped.has(i) && naturalTreeAt(x, y)) chopped.add(i);
  else return false;
  treeChanged(x, y);
  treeCellChange(x, y, -1);
  return true;
}

// Planta un árbol (si era natural y estaba talado, vuelve a crecer el mismo)
function plantTree(x, y) {
  x = wrapX(x); y = wrapY(y);
  const i = y * W + x;
  if (treeAt(x, y) || oreType[i] !== 0) return false;
  if (chopped.has(i)) chopped.delete(i);
  else planted.set(i, makeTree(x, y));
  treeChanged(x, y);
  treeCellChange(x, y, 1);
  return true;
}

// Cuántos árboles hay en cada celda de polución (los árboles absorben polución)
function computeForest() {
  treeCount = new Uint16Array(PW * PH);
  forestCell = new Float32Array(PW * PH);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if ((naturalTreeAt(x, y) && !chopped.has(i)) || planted.has(i)) treeCount[Math.floor(y / POLL_CELL) * PW + Math.floor(x / POLL_CELL)]++;
  }
  for (let c = 0; c < treeCount.length; c++) forestCell[c] = forestOf(treeCount[c]);
}

function encodeTrees() {
  return { c: [...chopped], p: [...planted.keys()], x: [...cliffGone] };
}
function decodeTrees(t) {
  chopped = new Set(t && Array.isArray(t.c) ? t.c : []);
  planted = new Map();
  if (t && Array.isArray(t.p)) for (const i of t.p) planted.set(i, makeTree(i % W, Math.floor(i / W)));
  cliffGone = new Set(t && Array.isArray(t.x) ? t.x : []);
  for (const i of cliffGone) treeChanged(i % W, Math.floor(i / W));
  treeCache.clear();
  computeForest();
  for (const i of [...chopped, ...planted.keys()]) treeChanged(i % W, Math.floor(i / W));
}

// Árboles de cada chunk (naturales sin talar + plantados)
function chunkTrees(cx, cy) {
  const key = cx + ',' + cy;
  let list = treeCache.get(key);
  if (list) return list;
  list = [];
  for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++) {
    for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
      if (x >= W || y >= H) continue;
      const i = y * W + x;
      const t = planted.get(i) || (!chopped.has(i) && naturalTreeAt(x, y));
      if (t) list.push(t);
    }
  }
  treeCache.set(key, list);
  return list;
}

// Los árboles del sector y los de los vecinos cuya copa se mete en él (así no hay cortes)
function drawChunkTrees(g, cx, cy) {
  if (typeof TREE_SPRITES === 'undefined' || !TREE_SPRITES.length) return;
  const nx = Math.ceil(W / CHUNK), ny = Math.ceil(H / CHUNK);
  const size = CHUNK * TILE;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ux = cx + dx, uy = cy + dy;
    const mx = ((ux % nx) + nx) % nx, my = ((uy % ny) + ny) % ny;
    const shiftX = (ux - mx) * CHUNK, shiftY = (uy - my) * CHUNK;   // vecino del otro lado del mapa
    for (const [x, y, v, sc, ox, oy] of chunkTrees(mx, my)) {
      if (at(x, y)) continue;
      const s = 64 * sc;
      const px = (x + shiftX - cx * CHUNK) * TILE + 16 + ox - s / 2, py = (y + shiftY - cy * CHUNK) * TILE + 16 + oy - s / 2;
      if (px > size || py > size || px + s < 0 || py + s < 0) continue;
      g.drawImage(TREE_SPRITES[v], px, py, s, s);
    }
  }
}

function getChunk(cx, cy) {
  const key = cx + ',' + cy;
  let c = chunkCache.get(key);
  if (c) {
    chunkCache.delete(key); chunkCache.set(key, c); // marcar como usado recientemente
    return c;
  }
  c = document.createElement('canvas');
  c.width = c.height = CHUNK * TILE;
  const g = c.getContext('2d');
  for (let y = 0; y < CHUNK; y++) {
    for (let x = 0; x < CHUNK; x++) {
      const tx = cx * CHUNK + x, ty = cy * CHUNK + y;
      if (inBounds(tx, ty)) drawTile(g, tx, ty, x * TILE, y * TILE);
    }
  }
  drawChunkTrees(g, cx, cy);
  chunkCache.set(key, c);
  if (chunkCache.size > MAX_CHUNKS) chunkCache.delete(chunkCache.keys().next().value);
  return c;
}

// Guardado del mapa: el mapa se rearma con la semilla y solo se guardan las casillas que cambiaron
let oreBase = null, oreTypeBase = null;

// Pone el mapa igual al de otro jugador (en línea), redibujando solo lo que cambió
function applyOreCode(code) {
  const amt = oreBase.slice();
  if (code && code.startsWith('d:')) {
    const s = atob(code.slice(2));
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    const d = new Uint32Array(bytes.buffer, 0, bytes.length >> 2);
    for (let k = 0; k + 1 < d.length; k += 2) if (d[k] < amt.length) amt[d[k]] = d[k + 1];
  }
  const changed = [];
  for (let i = 0; i < amt.length; i++) {
    if (amt[i] === oreAmt[i]) continue;
    const before = oreStep(i);
    oreAmt[i] = amt[i];
    oreType[i] = amt[i] ? oreTypeBase[i] : 0;
    if (oreStep(i) !== before || !amt[i]) changed.push(i);
  }
  if (changed.length > 3000) resetMapGraphics();
  else for (const i of changed) invalidateTile(i % W, Math.floor(i / W));
}

// Igual para los árboles: tala o planta solo las diferencias
function applyTrees(t) {
  const nc = new Set(t && Array.isArray(t.c) ? t.c : []), np = new Set(t && Array.isArray(t.p) ? t.p : []);
  const touched = new Set();
  for (const i of chopped) if (!nc.has(i)) touched.add(i);
  for (const i of nc) if (!chopped.has(i)) touched.add(i);
  for (const i of planted.keys()) if (!np.has(i)) touched.add(i);
  for (const i of np) if (!planted.has(i)) touched.add(i);
  for (const i of touched) {
    const x = i % W, y = Math.floor(i / W);
    const had = treeAt(x, y);
    if (nc.has(i)) chopped.add(i); else chopped.delete(i);
    if (np.has(i)) { if (!planted.has(i)) planted.set(i, makeTree(x, y)); } else planted.delete(i);
    const has = treeAt(x, y);
    if (had !== has) treeCellChange(x, y, has ? 1 : -1);
    treeChanged(x, y);
  }
}

// La niebla se suma: lo que exploró cualquiera queda explorado
function mergeFog(s) {
  if (typeof s !== 'string' || s.length !== PW * PH) return;
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 49 && !explored[i]) { explored[i] = 1; n++; }
  if (n) fogDirty = true;
}
function encodeOre() {
  const diff = [];
  for (let i = 0; i < oreAmt.length; i++) if (oreAmt[i] !== oreBase[i]) diff.push(i, oreAmt[i]);
  const bytes = new Uint8Array(new Uint32Array(diff).buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return 'd:' + btoa(s);
}

function decodeOre(b64) {
  const delta = b64.startsWith('d:');
  const s = atob(delta ? b64.slice(2) : b64);
  if (!delta && s.length !== W * H * 2) return;
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  if (delta) {
    const d = new Uint32Array(bytes.buffer, 0, bytes.length >> 2);
    for (let k = 0; k + 1 < d.length; k += 2) if (d[k] < oreAmt.length) oreAmt[d[k]] = d[k + 1];
  } else oreAmt = new Uint16Array(bytes.buffer);
  for (let i = 0; i < W * H; i++) if (!oreAmt[i]) oreType[i] = 0;
  resetMapGraphics();
}

// --------------------------- Niebla ---------------------------
// El mapa se explora por celdas de POLL_CELL × POLL_CELL casillas

let explored = new Uint8Array(PW * PH);
let fogDirty = true;

const cellExplored = (cx, cy) => explored[(((cy % PH) + PH) % PH) * PW + (((cx % PW) + PW) % PW)] === 1;
const tileExplored = (x, y) => cellExplored(Math.floor(x / POLL_CELL), Math.floor(y / POLL_CELL));

// Revela las celdas dentro de un radio (en casillas) alrededor de un punto
function reveal(x, y, radius) {
  const c0x = Math.floor((x - radius) / POLL_CELL), c1x = Math.floor((x + radius) / POLL_CELL);
  const c0y = Math.floor((y - radius) / POLL_CELL), c1y = Math.floor((y + radius) / POLL_CELL);
  let n = 0;
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const mx = (cx + 0.5) * POLL_CELL, my = (cy + 0.5) * POLL_CELL;
      const i = (((cy % PH) + PH) % PH) * PW + (((cx % PW) + PW) % PW);
      if (Math.hypot(mx - x, my - y) <= radius + POLL_CELL * 0.5 && !explored[i]) { explored[i] = 1; n++; }
    }
  }
  if (n) fogDirty = true;
  return n;
}

function encodeFog() {
  return Array.from(explored).join('');
}
function decodeFog(s) {
  explored = new Uint8Array(PW * PH);
  if (typeof s === 'string' && s.length === PW * PH) for (let i = 0; i < s.length; i++) explored[i] = s.charCodeAt(i) === 49 ? 1 : 0;
  fogDirty = true;
}
