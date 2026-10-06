'use strict';
// =====================================================================
//  Dibujo: objetos, edificios, mapa, superposiciones y despegue
// =====================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { x: 0, y: 0, zoom: 1 };
let dpr = 1, cw = 0, ch = 0;
let time = 0;

const LOD_ZOOM = 0.5; // por debajo de este zoom se dibuja simplificado

const TYPE_COLOR = {
  hub: '#f0a742', belt: '#59616d', fastbelt: '#c9a640', expressbelt: '#4aa3df', underground: '#c98a2e',
  splitter: '#8a63c4', sorter: '#2fa59a', chest: '#8b5a2b', miner: '#c9a227', eminer: '#3e7cb1',
  furnace: '#a0583f', efurnace: '#9aa3ad', assembler: '#4a72aa', assembler2: '#8a52b5',
  generator: '#5d6570', pole: '#a8743a', solar: '#2c4a7a', shipyard: '#6b737d',
};

function drawItem(g, item, x, y, s) {
  const it = ITEMS[item];
  g.fillStyle = it.color;
  g.strokeStyle = 'rgba(0,0,0,0.65)';
  g.lineWidth = 1.2;
  g.beginPath();
  switch (it.shape) {
    case 'plate': g.rect(x - s, y - s * 0.7, s * 2, s * 1.4); break;
    case 'chip': g.rect(x - s, y - s, s * 2, s * 2); break;
    case 'gear':
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? s : s * 0.7;
        if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.moveTo(x + r, y);
      }
      g.closePath();
      break;
    case 'part':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        if (i) g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); else g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
      g.closePath();
      break;
    case 'fuel':
      g.moveTo(x, y - s * 1.1);
      g.quadraticCurveTo(x + s, y, x + s * 0.8, y + s * 0.4);
      g.arc(x, y + s * 0.3, s * 0.8, 0, Math.PI);
      g.quadraticCurveTo(x - s, y, x, y - s * 1.1);
      break;
    case 'cable':
      g.arc(x, y, s, 0, Math.PI * 2);
      break;
    default: g.arc(x, y, s, 0, Math.PI * 2);
  }
  g.fill(); g.stroke();
  if (it.shape === 'chip') {
    g.fillStyle = item === 'processor' ? '#f5d76e' : item === 'nav_computer' ? '#bfe3ff' : '#e8d44d';
    g.fillRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
  } else if (it.shape === 'gear') {
    g.fillStyle = '#333'; g.beginPath(); g.arc(x, y, s * 0.3, 0, Math.PI * 2); g.fill();
  } else if (it.shape === 'cable') {
    g.strokeStyle = '#7a3f12'; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, s * 0.55, 0, Math.PI * 2); g.stroke();
  } else if (it.shape === 'part') {
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x, y, s * 0.35, 0, Math.PI * 2); g.fill();
  }
}

function drawArrow(g, cx, cy, dir, color, len = 15) {
  g.save();
  g.translate(cx, cy);
  g.rotate(dir * Math.PI / 2);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(len, 0); g.lineTo(len - 6, -5); g.lineTo(len - 6, 5);
  g.closePath(); g.fill();
  g.restore();
}

function box(g, x0, y0, fill, stroke, inset = 2, s = TILE) {
  g.fillStyle = fill;
  g.fillRect(x0 + inset, y0 + inset, s - inset * 2, s - inset * 2);
  if (stroke) {
    g.strokeStyle = stroke; g.lineWidth = 1.5;
    g.strokeRect(x0 + inset + 1.5, y0 + inset + 1.5, s - inset * 2 - 3, s - inset * 2 - 3);
  }
}

function drawBeltBase(g, e, cx, cy, t, speed, base, stripe) {
  g.save();
  g.translate(cx, cy);
  g.rotate(e.dir * Math.PI / 2);
  g.fillStyle = base;
  g.fillRect(-15, -15, 30, 30);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(-15, -12, 30, 24);
  g.strokeStyle = stripe;
  g.lineWidth = 2;
  const off = (t * speed * TILE) % 32;
  g.beginPath();
  for (let i = 0; i < 2; i++) {
    const p = -11 + ((i * 16 + off) % 32) * 22 / 32;
    g.moveTo(p - 3, -6); g.lineTo(p + 2, 0); g.lineTo(p - 3, 6);
  }
  g.stroke();
  g.restore();
}

function drawProgress(g, x0, y0, frac, color = '#5cc47a') {
  if (frac <= 0) return;
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(x0 + 5, y0 + TILE - 7, TILE - 10, 3);
  g.fillStyle = color;
  g.fillRect(x0 + 5, y0 + TILE - 7, (TILE - 10) * Math.min(1, frac), 3);
}

// Dibuja un edificio con su esquina superior izquierda en (x0, y0)
function drawBuilding(g, e, x0, y0, t) {
  const cx = x0 + TILE / 2, cy = y0 + TILE / 2;
  const def = BUILDINGS[e.type];
  switch (e.type) {
    case 'belt': drawBeltBase(g, e, cx, cy, t, 2, '#262a30', '#59616d'); break;
    case 'fastbelt': drawBeltBase(g, e, cx, cy, t, 4, '#3a3524', '#c9a640'); break;
    case 'expressbelt': drawBeltBase(g, e, cx, cy, t, 8, '#1d2c3a', '#4aa3df'); break;

    case 'underground': {
      drawBeltBase(g, e, cx, cy, t, 4, '#2d2a24', '#7a6235');
      g.save();
      g.translate(cx, cy);
      g.rotate(e.dir * Math.PI / 2);
      // La boca del túnel: adelante si es entrada, atrás si es salida
      const side = e.mode === 'out' ? -1 : 1;
      g.fillStyle = '#c98a2e';
      g.fillRect(side > 0 ? 2 : -15, -15, 13, 30);
      g.fillStyle = '#111';
      g.beginPath();
      g.ellipse(side * 9, 0, 5, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = '#fff';
      g.font = 'bold 9px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(e.mode === 'out' ? 'SAL' : 'ENT', cx, cy + (e.dir === 1 ? -10 : 10));
      break;
    }

    case 'splitter':
      box(g, x0, y0, '#5b4180', '#8a63c4');
      for (const d of [0, 3, 1]) drawArrow(g, cx, cy, (e.dir + d) % 4, d === 0 ? '#ead9ff' : '#b79be0');
      g.fillStyle = '#ead9ff';
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
      break;

    case 'sorter':
      box(g, x0, y0, '#1f5f59', '#2fa59a');
      drawArrow(g, cx, cy, e.dir, '#c8fff6');
      drawArrow(g, cx, cy, (e.dir + 3) % 4, '#6fbfb4');
      drawArrow(g, cx, cy, (e.dir + 1) % 4, '#6fbfb4');
      if (e.filter) drawItem(g, e.filter, cx, cy, 6);
      else {
        g.fillStyle = '#c8fff6'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('?', cx, cy + 1);
      }
      break;

    case 'chest':
      box(g, x0, y0, '#7a4f25', '#3f2810', 4);
      g.fillStyle = '#c9a227';
      g.fillRect(cx - 3, cy - 3, 6, 5);
      g.fillStyle = '#3f2810';
      g.fillRect(x0 + 5, cy - 4, TILE - 10, 1.5);
      if (e.total) drawProgress(g, x0, y0, e.total / 200, '#c9a227');
      drawArrow(g, cx, cy, e.dir, '#f0d9a8');
      break;

    case 'miner': case 'eminer': {
      const elec = e.type === 'eminer';
      box(g, x0, y0, elec ? '#2f5f8a' : '#b8902a', elec ? '#8fc3f0' : '#6e5418');
      g.save();
      g.translate(cx, cy);
      g.rotate(e.active ? t * (elec ? 12 : 6) : 0);
      g.fillStyle = elec ? '#d9e6f2' : '#4b4b4b';
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        g.moveTo(0, 0);
        g.arc(0, 0, 9, a, a + 0.8);
      }
      g.fill();
      g.restore();
      drawArrow(g, cx, cy, e.dir, elec ? '#d9f0ff' : '#fff3c4');
      break;
    }

    case 'furnace': case 'efurnace': {
      const elec = e.type === 'efurnace';
      box(g, x0, y0, elec ? '#6f7882' : '#7b4a3a', null);
      g.fillStyle = elec ? '#4d555e' : '#5a3328';
      for (let r = 0; r < 4; r++) g.fillRect(x0 + 2, y0 + 8 + r * 6, TILE - 4, 1);
      const glow = e.active ? 0.6 + 0.4 * Math.sin(t * 10 + e.x) : 0;
      g.fillStyle = e.active ? `rgba(255,${120 + glow * 80},40,${0.7 + glow * 0.3})` : '#2a1a14';
      g.beginPath(); g.arc(cx, cy + 2, 7, Math.PI, 0); g.lineTo(cx + 7, cy + 8); g.lineTo(cx - 7, cy + 8); g.fill();
      drawArrow(g, cx, cy, e.dir, '#ffd9b0');
      break;
    }

    case 'assembler': case 'assembler2': {
      const adv = e.type === 'assembler2';
      box(g, x0, y0, adv ? '#55307a' : '#35537e', adv ? '#e0b84a' : '#7ea4d6');
      if (e.recipe) drawItem(g, RECIPES[e.recipe].out, cx, cy, 6);
      else {
        g.fillStyle = '#cfe0ff'; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('?', cx, cy + 1);
      }
      if (e.recipe) drawProgress(g, x0, y0, e.prog / RECIPES[e.recipe].time);
      drawArrow(g, cx, cy, e.dir, '#cfe0ff');
      break;
    }

    case 'generator': {
      box(g, x0, y0, '#454b53', '#7d858f');
      g.save();
      g.translate(cx - 2, cy + 1);
      g.rotate(e.active ? t * 8 : 0);
      g.strokeStyle = '#c9cfd6'; g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); }
      g.stroke();
      g.restore();
      g.fillStyle = '#2e3238';
      g.fillRect(x0 + TILE - 10, y0 + 3, 5, 10);
      if (e.active) {
        g.fillStyle = `rgba(200,200,200,${0.3 + 0.2 * Math.sin(t * 3 + e.x)})`;
        g.beginPath(); g.arc(x0 + TILE - 7, y0 + 2 - ((t * 8) % 6), 4, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#f0d44d';
      g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('⚡', x0 + 8, y0 + 9);
      break;
    }

    case 'pole':
      g.fillStyle = '#6b4a24';
      g.fillRect(cx - 2, cy - 11, 4, 22);
      g.fillRect(cx - 9, cy - 9, 18, 3);
      g.fillStyle = '#9fb0c0';
      g.fillRect(cx - 9, cy - 11, 3, 3);
      g.fillRect(cx + 6, cy - 11, 3, 3);
      break;

    case 'solar':
      box(g, x0, y0, '#1b2d4f', '#7b8ea8', 2);
      g.strokeStyle = '#3d5d8f'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < 3; i++) {
        g.moveTo(x0 + 3 + i * (TILE - 6) / 3, y0 + 3); g.lineTo(x0 + 3 + i * (TILE - 6) / 3, y0 + TILE - 3);
        g.moveTo(x0 + 3, y0 + 3 + i * (TILE - 6) / 3); g.lineTo(x0 + TILE - 3, y0 + 3 + i * (TILE - 6) / 3);
      }
      g.stroke();
      break;

    case 'hub': {
      const s = TILE * 3;
      g.fillStyle = '#3d4552';
      g.fillRect(x0 + 2, y0 + 2, s - 4, s - 4);
      g.strokeStyle = '#f0a742'; g.lineWidth = 3;
      g.strokeRect(x0 + 5, y0 + 5, s - 10, s - 10);
      g.fillStyle = '#f0a742';
      g.font = 'bold 13px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('NÚCLEO', x0 + s / 2, y0 + s / 2 - 8);
      g.font = '11px system-ui, sans-serif';
      g.fillStyle = '#c9d1db';
      g.fillText('almacén', x0 + s / 2, y0 + s / 2 + 10);
      break;
    }

    case 'shipyard': drawShipyard(g, e, x0, y0, t); break;
  }

  // Aviso de falta de energía
  if (def && def.power && e.id) {
    const net = nets[e._net];
    const noPower = !net || (net.prevDemand > 0 && net.prevCap === 0);
    const low = net && net.sat < 1 && !noPower;
    if ((noPower || low) && Math.floor(t * 2) % 2 === 0) {
      g.fillStyle = noPower ? '#e5534b' : '#f0c040';
      g.font = 'bold 14px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('⚡', cx, cy);
    }
  }
  if ((e.type === 'miner' || e.type === 'eminer') && e.depleted && !oreAt(e.x, e.y) && e.id) {
    g.fillStyle = '#e5534b';
    g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('∅', cx, cy);
  }
}

// La nave: se dibuja una silueta y se va "llenando" a medida que llegan las piezas
function drawShip(g, cx, baseY, scale, frac, flame, t) {
  g.save();
  g.translate(cx, baseY);
  g.scale(scale, scale);
  const path = () => {
    g.beginPath();
    g.moveTo(0, -120);
    g.quadraticCurveTo(22, -95, 22, -55);
    g.lineTo(22, -10);
    g.lineTo(38, 8); g.lineTo(38, 18); g.lineTo(22, 10);
    g.lineTo(-22, 10);
    g.lineTo(-38, 18); g.lineTo(-38, 8); g.lineTo(-22, -10);
    g.lineTo(-22, -55);
    g.quadraticCurveTo(-22, -95, 0, -120);
    g.closePath();
  };
  if (flame) {
    const f = 30 + Math.sin(t * 40) * 8;
    const grd = g.createLinearGradient(0, 10, 0, 10 + f * 2);
    grd.addColorStop(0, '#fff6c0'); grd.addColorStop(0.3, '#ffb03a'); grd.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = grd;
    for (const ex of [-12, 0, 12]) {
      g.beginPath();
      g.moveTo(ex - 6, 10); g.lineTo(ex + 6, 10); g.lineTo(ex, 10 + f * 2 + (ex ? -10 : 0));
      g.closePath(); g.fill();
    }
  }
  // Silueta
  path();
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fill();
  g.setLineDash([4, 4]);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1.5;
  g.stroke();
  g.setLineDash([]);
  // Parte construida, de abajo hacia arriba
  if (frac > 0) {
    g.save();
    path();
    g.clip();
    const top = 18 - frac * 138;
    g.fillStyle = '#d7dde3';
    g.fillRect(-40, top, 80, 140);
    g.fillStyle = '#e5533d';
    g.fillRect(-40, Math.max(top, -10), 80, 30);
    g.fillStyle = '#3d8fd6';
    if (top < -70) { g.beginPath(); g.arc(0, -70, 8, 0, Math.PI * 2); g.fill(); }
    g.restore();
    path();
    g.strokeStyle = '#8b96a1';
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.restore();
}

function drawShipyard(g, e, x0, y0, t) {
  const s = TILE * 5;
  g.fillStyle = '#4b5159';
  g.fillRect(x0 + 2, y0 + 2, s - 4, s - 4);
  // Franjas de peligro en el borde
  g.save();
  g.beginPath();
  g.rect(x0 + 2, y0 + 2, s - 4, s - 4);
  g.rect(x0 + 10, y0 + 10, s - 20, s - 20);
  g.clip('evenodd');
  for (let i = -s; i < s * 2; i += 16) {
    g.fillStyle = '#e0b84a';
    g.beginPath();
    g.moveTo(x0 + i, y0); g.lineTo(x0 + i + 8, y0); g.lineTo(x0 + i + 8 - s, y0 + s); g.lineTo(x0 + i - s, y0 + s);
    g.closePath(); g.fill();
  }
  g.restore();
  if (!launchAnim || launchAnim.yard !== e) {
    const frac = shipProgressOf(e);
    drawShip(g, x0 + s / 2, y0 + s - 26, 0.95, frac, false, t);
  }
}

function shipProgressOf(e) {
  let have = 0, need = 0;
  for (const k in SHIP) { need += SHIP[k]; have += Math.min(SHIP[k], e.parts?.[k] || 0); }
  return have / need;
}

function drawItemsOn(g, e) {
  const cx = e.x * TILE + TILE / 2, cy = e.y * TILE + TILE / 2;
  if (!e.item) return;
  if (isBelt(e.type) || (e.type === 'underground' && (e.mode === 'out' || e.prog < 0.5))) {
    const [dx, dy] = DIRS[e.dir];
    const k = (Math.min(e.prog, 1) - 0.5) * TILE;
    drawItem(g, e.item, cx + dx * k, cy + dy * k, 5);
  } else if (e.type === 'splitter' || e.type === 'sorter') {
    drawItem(g, e.item, cx + 7, cy - 7, 3.5);
  }
}

// --------------------------- Cuadro principal ---------------------------

let launchAnim = null; // { yard, t }
const particles = [];

function render(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d1014';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let shakeX = 0, shakeY = 0;
  if (launchAnim && launchAnim.t < 5) {
    const k = Math.min(1, launchAnim.t / 2) * 3;
    shakeX = (Math.random() - 0.5) * k; shakeY = (Math.random() - 0.5) * k;
  }
  const z = view.zoom * dpr;
  ctx.setTransform(z, 0, 0, z, dpr * (cw / 2 - view.x * view.zoom + shakeX), dpr * (ch / 2 - view.y * view.zoom + shakeY));

  const vx0 = view.x - cw / 2 / view.zoom, vx1 = view.x + cw / 2 / view.zoom;
  const vy0 = view.y - ch / 2 / view.zoom, vy1 = view.y + ch / 2 / view.zoom;
  const lod = view.zoom < LOD_ZOOM;

  // Suelo
  if (lod) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixelMap, 0, 0, W * TILE, H * TILE);
  } else {
    const c0 = Math.max(0, Math.floor(vx0 / (CHUNK * TILE))), c1 = Math.min(Math.ceil(W / CHUNK) - 1, Math.floor(vx1 / (CHUNK * TILE)));
    const r0 = Math.max(0, Math.floor(vy0 / (CHUNK * TILE))), r1 = Math.min(Math.ceil(H / CHUNK) - 1, Math.floor(vy1 / (CHUNK * TILE)));
    ctx.imageSmoothingEnabled = true;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      ctx.drawImage(getChunk(cx, cy), cx * CHUNK * TILE, cy * CHUNK * TILE);
    }
  }

  // Áreas de energía al elegir un edificio eléctrico o un poste
  const showPower = tool !== 'hand' && tool !== 'delete' && (BUILDINGS[tool]?.power || BUILDINGS[tool]?.output || tool === 'pole');
  if (showPower) {
    ctx.fillStyle = 'rgba(80,160,255,0.12)';
    for (const e of S.entities) {
      if (e.type !== 'pole') continue;
      ctx.fillRect((e.x - POLE_SUPPLY) * TILE, (e.y - POLE_SUPPLY) * TILE, TILE * (POLE_SUPPLY * 2 + 1), TILE * (POLE_SUPPLY * 2 + 1));
    }
  }

  const visible = [];
  for (const e of S.entities) {
    const s = sizeOf(e.type) * TILE, px = e.x * TILE, py = e.y * TILE;
    if (px + s >= vx0 && px <= vx1 && py + s >= vy0 && py <= vy1) visible.push(e);
  }

  if (lod) {
    for (const e of visible) {
      const s = sizeOf(e.type);
      ctx.fillStyle = TYPE_COLOR[e.type] || '#999';
      ctx.fillRect(e.x * TILE + 2, e.y * TILE + 2, s * TILE - 4, s * TILE - 4);
    }
  } else {
    for (const e of visible) drawBuilding(ctx, e, e.x * TILE, e.y * TILE, time);
    for (const e of visible) drawItemsOn(ctx, e);
  }

  // Cables de los postes
  ctx.strokeStyle = 'rgba(30,20,10,0.55)';
  ctx.lineWidth = lod ? 2 : 1.2;
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of wires) {
    const ax = x1 * TILE + TILE / 2, ay = y1 * TILE + 6, bx = x2 * TILE + TILE / 2, by = y2 * TILE + 6;
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 10, bx, by);
  }
  ctx.stroke();

  drawOverlays(ctx);
  drawLaunch(ctx);
}

function drawOverlays(ctx) {
  if (!hover || panning || launchAnim) return;
  if (tool === 'hand' || tool === 'delete') {
    const e = at(hover.x, hover.y);
    ctx.lineWidth = 2;
    ctx.strokeStyle = tool === 'delete' ? (e && e.type !== 'hub' ? '#e5534b' : 'rgba(229,83,75,0.4)') : 'rgba(255,255,255,0.4)';
    if (e) {
      const s = sizeOf(e.type);
      ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, TILE * s - 2, TILE * s - 2);
    } else {
      ctx.strokeRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2);
    }
  } else {
    const s = sizeOf(tool);
    const ax = hover.x - Math.floor(s / 2), ay = hover.y - Math.floor(s / 2);
    const res = canPlace(tool, ax, ay);
    const ghost = makeEntity(tool, ax, ay, toolDir);
    if (tool === 'underground') ghost.mode = undergroundModeFor(ax, ay, toolDir);
    ctx.globalAlpha = 0.55;
    drawBuilding(ctx, ghost, ax * TILE, ay * TILE, time);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = res.ok ? '#5cc47a' : '#e5534b';
    ctx.lineWidth = 2;
    ctx.strokeRect(ax * TILE + 1, ay * TILE + 1, TILE * s - 2, TILE * s - 2);
    if (tool === 'pole') {
      ctx.strokeStyle = 'rgba(120,180,255,0.6)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(ax * TILE + TILE / 2, ay * TILE + TILE / 2, POLE_REACH * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(80,160,255,0.18)';
      ctx.fillRect((ax - POLE_SUPPLY) * TILE, (ay - POLE_SUPPLY) * TILE, TILE * 5, TILE * 5);
    }
    if (tool === 'underground') {
      const [dx, dy] = DIRS[toolDir];
      ctx.fillStyle = 'rgba(201,138,46,0.18)';
      for (let k = 1; k <= UNDERGROUND_REACH + 1; k++) ctx.fillRect((ax + dx * k) * TILE, (ay + dy * k) * TILE, TILE, TILE);
    }
  }
  if (handMining) {
    const { x, y, prog } = handMining;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x * TILE + 3, y * TILE - 8, TILE - 6, 5);
    ctx.fillStyle = '#f0a742';
    ctx.fillRect(x * TILE + 3, y * TILE - 8, (TILE - 6) * (prog / HAND_MINE_TIME), 5);
  }
}

// --------------------------- Despegue ---------------------------

function startLaunch(yard) {
  launchAnim = { yard, t: 0 };
  view.x = (yard.x + 2.5) * TILE;
  view.y = (yard.y + 2.5) * TILE;
}

function updateLaunch(dt) {
  if (!launchAnim) return;
  launchAnim.t += dt;
  const a = launchAnim, y = a.yard;
  const lift = a.t > 2 ? Math.pow(a.t - 2, 2.2) * 40 : 0;
  const bx = (y.x + 2.5) * TILE, by = (y.y + 5) * TILE - 26 - lift;
  if (a.t > 0.5) {
    for (let i = 0; i < 4; i++) {
      particles.push({ x: bx + (Math.random() - 0.5) * 30, y: by + 20, vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 80, life: 1.5 + Math.random() });
    }
  }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.life -= dt; }
  while (particles.length && particles[0].life <= 0) particles.shift();
  if (a.t > 2) view.y = Math.max(by - 60, (y.y + 2.5) * TILE - 400);
  if (a.t > 8) {
    launchAnim = null;
    particles.length = 0;
    S.launched = true;
    for (const k in SHIP) y.parts[k] = 0;
    save();
    showWin();
  }
}

function drawLaunch(ctx) {
  if (!launchAnim) return;
  const a = launchAnim, y = a.yard;
  for (const p of particles) {
    ctx.fillStyle = `rgba(210,210,210,${Math.max(0, p.life / 2.5) * 0.6})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 6 + (2.5 - p.life) * 10, 0, Math.PI * 2); ctx.fill();
  }
  const lift = a.t > 2 ? Math.pow(a.t - 2, 2.2) * 40 : 0;
  drawShip(ctx, (y.x + 2.5) * TILE, (y.y + 5) * TILE - 26 - lift, 0.95, 1, a.t > 0.5, time);
  if (a.t > 6.5) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (a.t - 6.5) / 1.5)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// --------------------------- Minimapa ---------------------------

function renderMinimap(mc) {
  const g = mc.getContext('2d');
  const sx = mc.width / W, sy = mc.height / H;
  g.imageSmoothingEnabled = false;
  g.drawImage(pixelMap, 0, 0, mc.width, mc.height);
  for (const e of S.entities) {
    const s = sizeOf(e.type);
    g.fillStyle = TYPE_COLOR[e.type] || '#fff';
    g.fillRect(e.x * sx, e.y * sy, Math.max(1.5, s * sx), Math.max(1.5, s * sy));
  }
  const vw = cw / view.zoom / TILE, vh = ch / view.zoom / TILE;
  g.strokeStyle = '#fff';
  g.lineWidth = 1;
  g.strokeRect((view.x / TILE - vw / 2) * sx + 0.5, (view.y / TILE - vh / 2) * sy + 0.5, vw * sx, vh * sy);
}
