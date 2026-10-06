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

function generateMap(seed) {
  oreType = new Uint8Array(W * H);
  oreAmt = new Uint16Array(W * H);
  const rnd = mulberry32(seed);
  const cx = W >> 1, cy = H >> 1;
  const K = (W * H) / (320 * 240); // cantidad de cosas según el tamaño del mapa
  const legacy = K === 1;          // partidas viejas de 320×240: se generan igual que antes
  const outside = (x, y) => legacy && (x < 0 || y < 0 || x >= W || y >= H);

  const patch = (px, py, rad, id, richness) => {
    for (let y = Math.floor(py - rad - 2); y <= py + rad + 2; y++) {
      for (let x = Math.floor(px - rad - 2); x <= px + rad + 2; x++) {
        if (outside(x, y)) continue;
        const d = Math.hypot(x - px, y - py);
        if (d < rad + (rnd() - 0.5) * 2) {
          const i = tIdx(x, y);
          oreType[i] = id;
          // Más rico en el centro del yacimiento
          oreAmt[i] = Math.min(65000, Math.round(richness * (1.4 - 0.8 * d / (rad + 1)) * (0.8 + rnd() * 0.4)));
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
  for (let i = 0; i < 26 * K; i++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    if (Math.hypot(px - cx, py - cy) < 30) continue;
    lake(px, py, 3 + rnd() * 9);
  }

  // Yacimientos iniciales alrededor del Núcleo
  patch(cx - 15, cy - 9, 5.5, 1, 420);
  patch(cx + 15, cy - 9, 5.5, 2, 380);
  patch(cx - 13, cy + 10, 4.5, 3, 380);
  patch(cx + 13, cy + 10, 4.5, 4, 320);
  patch(cx - 2, cy + 22, 3.5, 1, 380);
  patch(cx + 26, cy + 6, 4, 2, 380);

  // Recursos en anillos: más lejos, más raros y más ricos
  const ring = (id, dmin, dmax, count, rmin, rmax, rich) => {
    let placed = 0, tries = 0;
    while (placed < count && tries++ < 800) {
      const a = rnd() * Math.PI * 2, d = dmin + rnd() * (dmax - dmin);
      const px = Math.round(cx + Math.cos(a) * d), py = Math.round(cy + Math.sin(a) * d * 0.75);
      if (legacy && (px < 4 || py < 4 || px > W - 5 || py > H - 5)) continue;
      patch(px, py, rmin + rnd() * (rmax - rmin), id, rich * (1 + d / 50));
      placed++;
    }
  };
  ring(5, 28, 50, 4, 3, 5, 450);
  ring(6, 60, 130, 7, 3.5, 6.5, 500);
  if (K > 1) {
    ring(5, 50, W / 2, Math.round(6 * K), 3, 6, 450);
    ring(6, 130, W / 2, Math.round(6 * K), 4, 7, 500);
  }

  // Pozos de petróleo: grupos de casillas sueltas
  const oilField = (px, py) => {
    for (let k = 0; k < 4 + Math.floor(rnd() * 4); k++) {
      const x = Math.round(px + (rnd() - 0.5) * 9), y = Math.round(py + (rnd() - 0.5) * 9);
      if (outside(x, y)) continue;
      oreType[tIdx(x, y)] = 7;
      oreAmt[tIdx(x, y)] = 30000 + Math.floor(rnd() * 30000);
    }
  };
  let fields = 0, tries = 0;
  while (fields < 9 * K && tries++ < 500 * K) {
    const a = rnd() * Math.PI * 2, d = 32 + rnd() * (fields < 9 ? 100 : W / 2 - 32);
    const px = Math.round(cx + Math.cos(a) * d), py = Math.round(cy + Math.sin(a) * d * 0.75);
    if (legacy && (px < 6 || py < 6 || px > W - 7 || py > H - 7)) continue;
    oilField(px, py);
    fields++;
  }

  // Yacimientos comunes por todo el mapa
  for (let i = 0; i < 220 * K; i++) {
    const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
    const d = Math.hypot(px - cx, (py - cy) / 0.75);
    if (d < 26) continue;
    let id = 1 + Math.floor(rnd() * 4);
    if (d > 35 && rnd() < 0.15) id = 5;
    if (d > 60 && rnd() < 0.15) id = 6;
    patch(px, py, 2.5 + rnd() * 5, id, 380 * (1 + d / 45));
  }

  // Un lago chico cerca del Núcleo para la energía a vapor
  lake(cx + 4, cy - 24, 4.5);

  // Despejar la zona del Núcleo
  for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) { oreType[y * W + x] = 0; oreAmt[y * W + x] = 0; }
  oreBase = oreAmt.slice();
  chopped = new Set(); planted = new Map(); treeCache.clear();
  computeForest();
  resetMapGraphics();
}

// Saca una unidad de mineral de la casilla; devuelve el mineral o null si no queda
function mineOre(x, y) {
  const i = tIdx(x, y);
  const id = oreType[i];
  if (!id) return null;
  if (id === 8) return 'water';
  if (--oreAmt[i] <= 0) {
    oreType[i] = 0;
    oreAmt[i] = 0;
    invalidateTile(x, y);
  }
  return ORE_IDS[id];
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
function terrainAt(x, y) {
  const n = vnoise(x, y, 7, 3) * 0.6 + vnoise(x, y, 23, 4) * 0.4;
  let c = mixRgb(GRASS_DARK, GRASS_LIGHT, n);
  const dry = vnoise(x, y, 41, 5);
  if (dry > 0.6) c = mixRgb(c, GRASS_DRY, Math.min(1, (dry - 0.6) * 2.2));
  const dirt = vnoise(x, y, 11, 6);
  if (dirt > 0.78) c = mixRgb(c, DIRT, Math.min(0.7, (dirt - 0.78) * 4));
  return c;
}

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
  if (!o) return treeDensity(x, y) > 0.45 ? mixRgb(base, [24, 46, 24], 0.55) : base;
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
  const amt = oreAmt[tIdx(x, y)];
  const count = amt > 500 ? 5 : amt > 200 ? 4 : amt > 60 ? 3 : 2;
  for (let k = 0; k < count; k++) {
    const ox = px + 6 + hash(x, y, 10 + k) * 20, oy = py + 7 + hash(x, y, 20 + k) * 19;
    const r = 3 + hash(x, y, 30 + k) * 3.5;
    if (o === 'quartz' || o === 'titanium_ore') crystal(g, ox, oy + r, r * 2.2, ITEMS[o].color);
    else rock(g, ox, oy, r, ITEMS[o].color, o === 'coal' ? 0.25 : 0.35);
  }
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

// ¿Hay un árbol natural en esta casilla? (solo pasto original, lejos del Núcleo)
function naturalTreeAt(x, y) {
  const i = y * W + x;
  if (oreBase[i] !== 0) return null;
  if (Math.abs(x - W / 2) < 9 && Math.abs(y - H / 2) < 9) return null;
  const d = treeDensity(x, y);
  const p = d > 0.5 ? (d - 0.5) * 2.6 : d > 0.36 ? 0.03 : 0;
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
function treeCellChange(x, y, k) {
  const c = Math.floor(y / POLL_CELL) * PW + Math.floor(x / POLL_CELL);
  treeCount[c] = Math.max(0, treeCount[c] + k);
  forestCell[c] = forestOf(treeCount[c]);
}

// Tala el árbol de la casilla; devuelve true si había uno
function chopTree(x, y) {
  x = wrapX(x); y = wrapY(y);
  const i = y * W + x;
  if (planted.has(i)) { planted.delete(i); treeCache.delete(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK)); }
  else if (!chopped.has(i) && naturalTreeAt(x, y)) chopped.add(i);
  else return false;
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
  treeCache.delete(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
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
  return { c: [...chopped], p: [...planted.keys()] };
}
function decodeTrees(t) {
  chopped = new Set(t && Array.isArray(t.c) ? t.c : []);
  planted = new Map();
  if (t && Array.isArray(t.p)) for (const i of t.p) planted.set(i, makeTree(i % W, Math.floor(i / W)));
  treeCache.clear();
  computeForest();
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
  chunkCache.set(key, c);
  if (chunkCache.size > MAX_CHUNKS) chunkCache.delete(chunkCache.keys().next().value);
  return c;
}

// Guardado del mapa: el mapa se rearma con la semilla y solo se guardan las casillas que cambiaron
let oreBase = null;
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
