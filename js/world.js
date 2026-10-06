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

const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const oreAt = (x, y) => (inBounds(x, y) ? ORE_IDS[oreType[y * W + x]] : null);
const oreAmountAt = (x, y) => (inBounds(x, y) ? oreAmt[y * W + x] : 0);

function generateMap(seed) {
  oreType = new Uint8Array(W * H);
  oreAmt = new Uint16Array(W * H);
  const rnd = mulberry32(seed);
  const cx = W >> 1, cy = H >> 1;

  const patch = (px, py, rad, id, richness) => {
    for (let y = Math.floor(py - rad - 2); y <= py + rad + 2; y++) {
      for (let x = Math.floor(px - rad - 2); x <= px + rad + 2; x++) {
        if (!inBounds(x, y)) continue;
        const d = Math.hypot(x - px, y - py);
        if (d < rad + (rnd() - 0.5) * 2) {
          const i = y * W + x;
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
        if (!inBounds(x, y)) continue;
        const d = Math.hypot(x - px, (y - py) * 1.2);
        const wobble = Math.sin(x * 0.7 + seed) * 0.8 + Math.cos(y * 0.6 + seed) * 0.8;
        if (d < rad + wobble) { oreType[y * W + x] = 8; oreAmt[y * W + x] = 65000; }
      }
    }
  };
  for (let i = 0; i < 26; i++) {
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
      if (px < 4 || py < 4 || px > W - 5 || py > H - 5) continue;
      patch(px, py, rmin + rnd() * (rmax - rmin), id, rich * (1 + d / 50));
      placed++;
    }
  };
  ring(5, 28, 50, 4, 3, 5, 450);
  ring(6, 60, 130, 7, 3.5, 6.5, 500);

  // Pozos de petróleo: grupos de casillas sueltas
  const oilField = (px, py) => {
    for (let k = 0; k < 4 + Math.floor(rnd() * 4); k++) {
      const x = Math.round(px + (rnd() - 0.5) * 9), y = Math.round(py + (rnd() - 0.5) * 9);
      if (!inBounds(x, y)) continue;
      oreType[y * W + x] = 7;
      oreAmt[y * W + x] = 30000 + Math.floor(rnd() * 30000);
    }
  };
  let fields = 0, tries = 0;
  while (fields < 9 && tries++ < 500) {
    const a = rnd() * Math.PI * 2, d = 32 + rnd() * 100;
    const px = Math.round(cx + Math.cos(a) * d), py = Math.round(cy + Math.sin(a) * d * 0.75);
    if (px < 6 || py < 6 || px > W - 7 || py > H - 7) continue;
    oilField(px, py);
    fields++;
  }

  // Yacimientos comunes por todo el mapa
  for (let i = 0; i < 220; i++) {
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
  resetMapGraphics();
}

// Saca una unidad de mineral de la casilla; devuelve el mineral o null si no queda
function mineOre(x, y) {
  const i = y * W + x;
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

function groundColor(x, y) {
  const s = Math.floor(hash(x, y, 1) * 8);
  return [38 + s, 52 + s, 36 + s];
}

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function tilePixel(x, y) {
  const o = oreAt(x, y);
  if (!o) return groundColor(x, y);
  const a = hexToRgb(ORE_GROUND[o]), b = hexToRgb(ITEMS[o].color);
  return [(a[0] + b[0]) >> 1, (a[1] + b[1]) >> 1, (a[2] + b[2]) >> 1];
}

function resetMapGraphics() {
  chunkCache.clear();
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
  chunkCache.delete(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
  const g = pixelMap.getContext('2d');
  const [r, gg, b] = tilePixel(x, y);
  g.fillStyle = `rgb(${r},${gg},${b})`;
  g.fillRect(x, y, 1, 1);
}

function drawTile(g, x, y, px, py) {
  const [r, gg, b] = groundColor(x, y);
  g.fillStyle = `rgb(${r},${gg},${b})`;
  g.fillRect(px, py, TILE, TILE);
  const o = oreAt(x, y);
  if (!o) return;
  g.fillStyle = ORE_GROUND[o];
  g.fillRect(px, py, TILE, TILE);
  if (o === 'water') {
    g.fillStyle = '#1d4f86';
    g.fillRect(px, py, TILE, TILE);
    g.strokeStyle = 'rgba(160,210,255,0.25)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let k = 0; k < 2; k++) {
      const wy = py + 9 + k * 13 + hash(x, y, 40 + k) * 4, wx = px + 4 + hash(x, y, 50 + k) * 10;
      g.moveTo(wx, wy); g.quadraticCurveTo(wx + 4, wy - 3, wx + 8, wy); g.quadraticCurveTo(wx + 12, wy + 3, wx + 16, wy);
    }
    g.stroke();
    return;
  }
  if (o === 'oil') {
    g.fillStyle = '#050405';
    g.beginPath(); g.ellipse(px + 16, py + 17, 11, 8, 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,90,200,0.35)';
    g.beginPath(); g.ellipse(px + 13, py + 14, 4, 2, 0.3, 0, Math.PI * 2); g.fill();
    return;
  }
  g.fillStyle = ITEMS[o].color;
  const amt = oreAmt[y * W + x];
  const dots = amt > 600 ? 5 : amt > 250 ? 4 : amt > 80 ? 3 : 2;
  for (let k = 0; k < dots; k++) {
    const ox = 5 + hash(x, y, 10 + k) * 22, oy = 5 + hash(x, y, 20 + k) * 22;
    g.beginPath();
    g.arc(px + ox, py + oy, 2.5 + hash(x, y, 30 + k) * 2.5, 0, Math.PI * 2);
    g.fill();
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
  g.strokeStyle = 'rgba(0,0,0,0.13)';
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i <= CHUNK; i++) {
    g.moveTo(i * TILE + 0.5, 0); g.lineTo(i * TILE + 0.5, CHUNK * TILE);
    g.moveTo(0, i * TILE + 0.5); g.lineTo(CHUNK * TILE, i * TILE + 0.5);
  }
  g.stroke();
  chunkCache.set(key, c);
  if (chunkCache.size > MAX_CHUNKS) chunkCache.delete(chunkCache.keys().next().value);
  return c;
}

// Guardado del mapa: solo se guardan las cantidades (el tipo se recalcula con la semilla)
function encodeOre() {
  const bytes = new Uint8Array(oreAmt.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function decodeOre(b64) {
  const s = atob(b64);
  if (s.length !== W * H * 2) return;
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  oreAmt = new Uint16Array(bytes.buffer);
  for (let i = 0; i < W * H; i++) if (!oreAmt[i]) oreType[i] = 0;
  resetMapGraphics();
}

// --------------------------- Niebla ---------------------------
// El mapa se explora por celdas de POLL_CELL × POLL_CELL casillas

let explored = new Uint8Array(PW * PH);
let fogDirty = true;

const cellExplored = (cx, cy) => cx >= 0 && cy >= 0 && cx < PW && cy < PH && explored[cy * PW + cx] === 1;
const tileExplored = (x, y) => cellExplored(Math.floor(x / POLL_CELL), Math.floor(y / POLL_CELL));

// Revela las celdas dentro de un radio (en casillas) alrededor de un punto
function reveal(x, y, radius) {
  const c0x = Math.floor((x - radius) / POLL_CELL), c1x = Math.floor((x + radius) / POLL_CELL);
  const c0y = Math.floor((y - radius) / POLL_CELL), c1y = Math.floor((y + radius) / POLL_CELL);
  let n = 0;
  for (let cy = Math.max(0, c0y); cy <= Math.min(PH - 1, c1y); cy++) {
    for (let cx = Math.max(0, c0x); cx <= Math.min(PW - 1, c1x); cx++) {
      const mx = (cx + 0.5) * POLL_CELL, my = (cy + 0.5) * POLL_CELL;
      if (Math.hypot(mx - x, my - y) <= radius + POLL_CELL * 0.5 && !explored[cy * PW + cx]) { explored[cy * PW + cx] = 1; n++; }
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
