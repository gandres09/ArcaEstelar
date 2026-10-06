'use strict';
// =====================================================================
//  Dibujo: objetos, edificios, enemigos, noche y vistas previas
// =====================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { x: 0, y: 0, zoom: 1 };
let dpr = 1, cw = 0, ch = 0;
let time = 0;

const LOD_ZOOM = 0.45; // por debajo de este zoom se dibuja simplificado

const TYPE_COLOR = {
  hub: '#f0a742', belt: '#c9a23a', fastbelt: '#c8503f', expressbelt: '#4a96d4', underground: '#a8862e',
  splitter: '#8a63c4', sorter: '#2fa59a', chest: '#8b5a2b', miner: '#c9a227', eminer: '#3e7cb1', pumpjack: '#8e7fa8',
  furnace: '#a0583f', efurnace: '#9aa3ad', assembler: '#4a72aa', assembler2: '#8a52b5', chem: '#3f8a52', lab: '#5fb4de',
  generator: '#5d6570', pole: '#a8743a', bigpole: '#a0aab5', solar: '#2c4a7a', accumulator: '#7d858f', lamp: '#f0e08a',
  woodchest: '#9a6a3a', nursery: '#6fbf5a', purifier: '#7fd1b5', uplink: '#ff8a5c', fusion_plant: '#ffd166', starport: '#8a7dff',
  wall: '#8f8676', turret: '#b8c08a', laser: '#9fa8ff', shipyard: '#6b737d', nest: '#9a3b6e',
  inserter: '#e0b84a', fastinserter: '#5aa0ff', receiver: '#f0a742', pipe: '#7d868f', tank: '#9aa3ad', steelchest: '#7d858f', roboport: '#b8d27a', rail: '#8a7a66', station: '#f0a742', offshore: '#5aa0e0', boiler: '#c9a27a', steam_engine: '#b8c6d2', radar: '#c9d6dd',
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
    case 'barrel': g.rect(x - s * 0.75, y - s, s * 1.5, s * 2); break;
    case 'log': g.ellipse(x, y, s * 1.1, s * 0.6, -0.5, 0, Math.PI * 2); break;
    case 'battery': g.rect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 1.9); break;
    case 'ammo': g.rect(x - s, y - s * 0.6, s * 2, s * 1.2); break;
    case 'module': g.rect(x - s, y - s * 0.8, s * 2, s * 1.6); break;
    case 'flask':
      g.moveTo(x - s * 0.3, y - s); g.lineTo(x + s * 0.3, y - s); g.lineTo(x + s * 0.3, y - s * 0.3);
      g.lineTo(x + s, y + s * 0.8); g.lineTo(x - s, y + s * 0.8); g.lineTo(x - s * 0.3, y - s * 0.3);
      g.closePath();
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
  } else if (it.shape === 'barrel') {
    g.strokeStyle = '#8a6a4a'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - s * 0.75, y - s * 0.4); g.lineTo(x + s * 0.75, y - s * 0.4);
    g.moveTo(x - s * 0.75, y + s * 0.4); g.lineTo(x + s * 0.75, y + s * 0.4); g.stroke();
  } else if (it.shape === 'battery') {
    g.fillStyle = '#444'; g.fillRect(x - s * 0.25, y - s * 1.15, s * 0.5, s * 0.3);
  } else if (it.shape === 'ammo') {
    g.fillStyle = '#7a5a10';
    for (let i = -1; i <= 1; i++) g.fillRect(x + i * s * 0.55 - s * 0.15, y - s * 0.45, s * 0.3, s * 0.9);
  } else if (it.shape === 'module') {
    g.fillStyle = '#1d2026'; g.fillRect(x - s * 0.6, y - s * 0.4, s * 1.2, s * 0.8);
    g.fillStyle = it.color; g.fillRect(x - s * 0.3, y - s * 0.2, s * 0.6, s * 0.4);
  } else if (it.shape === 'flask') {
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x - s * 0.15, y - s * 0.1, s * 0.3, s * 0.6);
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

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

// Cuerpo de un edificio: sombra, chapa con relieve, borde y remaches
function box(g, x0, y0, fill, stroke, inset = 2, s = TILE) {
  const x = x0 + inset, y = y0 + inset, w = s - inset * 2;
  const r = Math.min(5, w / 6);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  rrect(g, x + 2, y + 3, w, w, r); g.fill();
  g.fillStyle = fill;
  rrect(g, x, y, w, w, r); g.fill();
  // Luz de arriba y sombra abajo
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.fillRect(x + r, y + 1, w - r * 2, 2);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(x + 1, y + 3, w - 2, w / 2 - 3);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x + r, y + w - 3, w - r * 2, 2.5);
  if (stroke) {
    g.strokeStyle = stroke; g.lineWidth = 1.5;
    rrect(g, x + 3, y + 3, w - 6, w - 6, Math.max(1, r - 2)); g.stroke();
  }
  if (w >= 22) {
    g.fillStyle = 'rgba(0,0,0,0.4)';
    const q = 2.2, a = x + 2.2, b = x + w - 2.2 - q;
    g.fillRect(a, y + 2.2, q, q); g.fillRect(b, y + 2.2, q, q);
    g.fillRect(a, y + w - 2.2 - q, q, q); g.fillRect(b, y + w - 2.2 - q, q, q);
  }
}

// Cintas: goma oscura con nervios que avanzan y rieles del color de su nivel
function drawBeltBase(g, e, cx, cy, t, speed, rail, stripe) {
  g.save();
  g.translate(cx, cy);
  g.rotate(e.dir * Math.PI / 2);
  g.fillStyle = '#1b1e22';
  g.fillRect(-16, -12, 32, 24);
  const off = (t * speed * TILE) % 8;
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let p = -16 + off; p < 16; p += 8) g.fillRect(p, -11, 2, 22);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let p = -14 + off; p < 16; p += 8) g.fillRect(p, -11, 1.5, 22);
  // Flechita del sentido
  g.strokeStyle = stripe; g.globalAlpha *= 0.55;
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(-3, -5); g.lineTo(2, 0); g.lineTo(-3, 5); g.stroke();
  g.globalAlpha /= 0.55;
  // Rieles laterales
  for (const sy of [-16, 12]) {
    g.fillStyle = rail; g.fillRect(-16, sy, 32, 4);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-16, sy, 32, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-16, sy + 3, 32, 1);
  }
  g.fillStyle = 'rgba(0,0,0,0.45)';
  for (const sx of [-12, 4]) { g.fillRect(sx, -15, 2, 2); g.fillRect(sx, 13, 2, 2); }
  g.restore();
}

function drawProgress(g, x0, y0, frac, color = '#5cc47a') {
  if (frac <= 0) return;
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(x0 + 5, y0 + TILE - 7, TILE - 10, 3);
  g.fillStyle = color;
  g.fillRect(x0 + 5, y0 + TILE - 7, (TILE - 10) * Math.min(1, frac), 3);
}

function drawBuilding(g, e, x0, y0, t) {
  const cx = x0 + TILE / 2, cy = y0 + TILE / 2;
  const def = BUILDINGS[e.type];
  switch (e.type) {
    case 'belt': drawBeltBase(g, e, cx, cy, t, 2, '#c9a23a', '#e8c867'); break;
    case 'fastbelt': drawBeltBase(g, e, cx, cy, t, 4, '#b8463a', '#f08a7a'); break;
    case 'expressbelt': drawBeltBase(g, e, cx, cy, t, 8, '#3a86c4', '#8fcaf5'); break;

    case 'underground': {
      drawBeltBase(g, e, cx, cy, t, 2, '#c9a23a', '#e8c867');
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
      for (const d of [0, 3, 1]) {
        const prio = e.prio && ((e.prio === 'front' && d === 0) || (e.prio === 'left' && d === 3) || (e.prio === 'right' && d === 1));
        drawArrow(g, cx, cy, (e.dir + d) % 4, prio ? '#f0a742' : d === 0 ? '#ead9ff' : '#b79be0');
      }
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

    case 'pipe': case 'tank': {
      const net = e.id ? fnets[e._fnet] : null;
      const fc = net && net.amount >= 1 ? ITEMS[net.fluid].color : null;
      if (e.type === 'tank') {
        const s = TILE * 2;
        g.fillStyle = '#4a525c';
        g.beginPath(); g.arc(x0 + s / 2, y0 + s / 2, s / 2 - 3, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#9aa3ad'; g.lineWidth = 2; g.stroke();
        if (fc) {
          const f = Math.min(1, net.amount / net.cap);
          g.save();
          g.beginPath(); g.arc(x0 + s / 2, y0 + s / 2, s / 2 - 6, 0, Math.PI * 2); g.clip();
          g.fillStyle = fc;
          g.fillRect(x0, y0 + s - 6 - (s - 12) * f, s, s);
          g.restore();
        }
        break;
      }
      // Tramos hacia los vecinos conectados
      const links = DIRS.map(([dx, dy]) => {
        const n = e.id ? at(e.x + dx, e.y + dy) : null;
        return n && (isPipe(n) || FLUID_USERS.has(n.type) || n.type === 'offshore' || n.type === 'pumpjack');
      });
      if (!links.some(Boolean)) { links[0] = links[2] = true; }
      g.save();
      g.translate(cx, cy);
      for (let d = 0; d < 4; d++) {
        if (!links[d]) continue;
        g.save(); g.rotate(d * Math.PI / 2);
        g.fillStyle = '#6c757f'; g.fillRect(0, -6, 16, 12);
        g.fillStyle = '#9aa3ad'; g.fillRect(0, -6, 16, 3);
        g.restore();
      }
      g.fillStyle = '#7d868f';
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
      if (fc) { g.fillStyle = fc; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill(); }
      g.restore();
      break;
    }

    case 'steelchest':
      box(g, x0, y0, '#5d6670', '#2b3036', 3);
      g.fillStyle = '#c9cfd6';
      g.fillRect(cx - 3, cy - 3, 6, 5);
      g.fillStyle = '#2b3036';
      g.fillRect(x0 + 4, cy - 4, TILE - 8, 1.5);
      g.fillRect(x0 + 4, y0 + 6, 1.5, TILE - 12); g.fillRect(x0 + TILE - 5.5, y0 + 6, 1.5, TILE - 12);
      if (e.total) drawProgress(g, x0, y0, e.total / 800, '#c9cfd6');
      drawArrow(g, cx, cy, e.dir, '#e6e9ee');
      break;

    case 'woodchest':
      box(g, x0, y0, '#9a6a3a', '#5a3a1c', 5);
      g.fillStyle = 'rgba(60,35,15,0.6)';
      for (let k = 0; k < 3; k++) g.fillRect(x0 + 6, y0 + 9 + k * 6, TILE - 12, 1.2);
      if (e.total) drawProgress(g, x0, y0, e.total / 100, '#d9a860');
      drawArrow(g, cx, cy, e.dir, '#f3dcb5');
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

    case 'assembler': case 'assembler2': case 'chem': {
      const adv = e.type === 'assembler2', chem = e.type === 'chem';
      box(g, x0, y0, chem ? '#2f5e3a' : adv ? '#55307a' : '#35537e', chem ? '#9be0a8' : adv ? '#e0b84a' : '#7ea4d6');
      if (chem) {
        g.fillStyle = '#9be0a8';
        g.beginPath(); g.arc(x0 + 8, y0 + 8, 3, 0, Math.PI * 2); g.arc(x0 + TILE - 8, y0 + 8, 3, 0, Math.PI * 2); g.fill();
      }
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


    case 'pumpjack': {
      box(g, x0, y0, '#3a3540', '#8e7fa8');
      const a = e.active ? Math.sin(t * 4) * 0.35 : 0;
      g.save();
      g.translate(cx, cy + 4);
      g.fillStyle = '#5b5266';
      g.fillRect(-2, -4, 4, 10);
      g.rotate(a);
      g.fillStyle = '#c9a227';
      g.fillRect(-12, -7, 24, 4);
      g.fillStyle = '#2a2a2a';
      g.beginPath(); g.arc(-12, -5, 4, 0, Math.PI * 2); g.fill();
      g.restore();
      drawArrow(g, cx, cy, e.dir, '#e3d6ff');
      break;
    }

    case 'lab': {
      box(g, x0, y0, '#2c4a5e', '#7fc4e8');
      const k = e.active ? 0.5 + 0.5 * Math.sin(t * 6 + e.x) : 0.2;
      g.fillStyle = `rgba(120,210,255,${0.35 + k * 0.5})`;
      g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d8f2ff'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(cx, cy, 11, 4, t * (e.active ? 2 : 0), 0, Math.PI * 2); g.stroke();
      break;
    }

    case 'bigpole':
      g.strokeStyle = '#8a95a1'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 9, y0 + TILE - 3); g.lineTo(cx, y0 + 3); g.lineTo(cx + 9, y0 + TILE - 3);
      g.moveTo(cx - 6, cy + 4); g.lineTo(cx + 6, cy + 4);
      g.moveTo(cx - 11, y0 + 8); g.lineTo(cx + 11, y0 + 8);
      g.stroke();
      break;

    case 'accumulator': {
      box(g, x0, y0, '#3b4048', '#9aa3ad');
      const def = BUILDINGS.accumulator;
      const f = (e.stored || 0) / def.capacity;
      g.fillStyle = '#1d2026';
      g.fillRect(cx - 5, y0 + 6, 10, TILE - 12);
      g.fillStyle = f > 0.2 ? '#5cc47a' : '#e0a040';
      g.fillRect(cx - 4, y0 + 7 + (TILE - 14) * (1 - f), 8, (TILE - 14) * f);
      break;
    }

    case 'lamp':
      g.fillStyle = '#4a4f57';
      g.fillRect(cx - 5, cy - 2, 10, 12);
      g.fillStyle = e.lit ? '#fff3b0' : '#8a8a7a';
      g.beginPath(); g.arc(cx, cy - 3, 7, 0, Math.PI * 2); g.fill();
      break;

    case 'wall':
      g.fillStyle = '#8f8676';
      g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
      g.fillStyle = '#6f6758';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.fillRect(x0 + 2 + c * 15 + (r % 2) * 7, y0 + 2 + r * 7.5, 13, 6);
      break;

    case 'turret': case 'laser': {
      const laser = e.type === 'laser';
      g.fillStyle = laser ? '#3a3f52' : '#4a5040';
      g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.fill();
      g.strokeStyle = laser ? '#9fa8ff' : '#b8c08a'; g.lineWidth = 1.5; g.stroke();
      g.save();
      g.translate(cx, cy);
      g.rotate(e.aim || -Math.PI / 2);
      g.fillStyle = laser ? '#cfd4ff' : '#d8d2b0';
      g.fillRect(0, -2.5, 15, 5);
      g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
      g.restore();
      if (!laser && e.id && !e.ammo && !e.shots) {
        g.fillStyle = '#e5534b'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('sin balas', cx, y0 + TILE - 3);
      }
      break;
    }

    case 'nest': {
      const s = TILE * 2, pulse = 1 + Math.sin(t * 2 + e.x) * 0.05;
      const ncx = x0 + s / 2, ncy = y0 + s / 2;
      g.fillStyle = '#4a2a3e';
      g.beginPath(); g.ellipse(ncx, ncy, 27 * pulse, 23 * pulse, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a3b5e';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + e.x;
        g.beginPath(); g.arc(ncx + Math.cos(a) * 14, ncy + Math.sin(a) * 11, 7, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#1a0d14';
      g.beginPath(); g.ellipse(ncx, ncy, 8, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e0a3c8';
      g.beginPath(); g.arc(ncx - 3, ncy - 1, 1.5, 0, Math.PI * 2); g.arc(ncx + 3, ncy - 1, 1.5, 0, Math.PI * 2); g.fill();
      break;
    }

    case 'inserter': case 'fastinserter': {
      const fast = e.type === 'fastinserter';
      g.fillStyle = '#2b2f36';
      g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
      const ph = e.hold ? e.t : (e.ret || 0);
      const [dx, dy] = DIRS[e.dir];
      const ex = cx + dx * (-12 + 24 * ph), ey = cy + dy * (-12 + 24 * ph);
      // Codo del brazo, un poco hacia el costado
      const mx = (cx + ex) / 2 - dy * 6, my = (cy + ey) / 2 + dx * 6;
      g.strokeStyle = fast ? '#5aa0ff' : '#e0b84a';
      g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(mx, my); g.lineTo(ex, ey); g.stroke();
      g.lineCap = 'butt';
      g.fillStyle = '#d8dee6';
      g.beginPath(); g.arc(cx, cy, 2.5, 0, Math.PI * 2); g.fill();
      if (e.hold) drawItem(g, e.hold, ex, ey, 4.5);
      if (e.filter) drawItem(g, e.filter, x0 + 6, y0 + 6, 3.5);
      // marca de hacia dónde deja
      drawArrow(g, cx, cy, e.dir, 'rgba(255,255,255,0.35)', 16);
      break;
    }

    case 'roboport': {
      box(g, x0, y0, '#3b4a3a', '#b8d27a');
      g.fillStyle = '#b8d27a';
      g.fillRect(cx - 9, cy - 2, 18, 4);
      g.fillRect(cx - 2, cy - 9, 4, 18);
      g.fillStyle = '#e8c547';
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
      break;
    }

    case 'rail': case 'station': {
      const links = e.id ? railLinks(e.x, e.y) : [true, false, true, false];
      if (!links.some(Boolean)) { links[0] = links[2] = true; }
      if (e.type === 'station') {
        g.fillStyle = '#4a4f57';
        g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
        g.fillStyle = '#f0a742';
        g.fillRect(x0 + 2, y0 + 2, TILE - 4, 3);
        g.fillRect(x0 + 2, y0 + TILE - 5, TILE - 4, 3);
      }
      g.save();
      g.translate(cx, cy);
      for (let d = 0; d < 4; d++) {
        if (!links[d]) continue;
        g.save();
        g.rotate(d * Math.PI / 2);
        g.fillStyle = '#5a4632';
        for (let k = 0; k < 3; k++) g.fillRect(2 + k * 5, -10, 3, 20);
        g.strokeStyle = '#a8b0ba'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-5, -6); g.lineTo(16, -6); g.moveTo(-5, 6); g.lineTo(16, 6); g.stroke();
        g.restore();
      }
      g.restore();
      if (e.type === 'station') {
        g.fillStyle = e.mode === 'unload' ? '#5aa0ff' : '#5cc47a';
        g.font = 'bold 8px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(e.mode === 'unload' ? 'DESC' : 'CARGA', cx, y0 + 7);
        if (e.mode === 'unload') drawArrow(g, cx, cy, e.dir, '#d8eeff');
        if (e.total) drawProgress(g, x0, y0, e.total / STATION_CAP, '#f0a742');
      }
      break;
    }

    case 'train':
      drawCar(g, cx, cy, 0, true, 0);
      break;

    case 'receiver': {
      box(g, x0, y0, '#3d4552', '#f0a742');
      g.fillStyle = '#f0a742';
      g.beginPath(); g.moveTo(cx, cy + 7); g.lineTo(cx - 7, cy - 1); g.lineTo(cx - 3, cy - 1); g.lineTo(cx - 3, cy - 7);
      g.lineTo(cx + 3, cy - 7); g.lineTo(cx + 3, cy - 1); g.lineTo(cx + 7, cy - 1); g.closePath(); g.fill();
      break;
    }

    case 'offshore': {
      box(g, x0, y0, '#2b5f8f', '#9fd0ff');
      g.fillStyle = '#9fd0ff';
      g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b5f8f'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - 4, cy); g.quadraticCurveTo(cx, cy - 4, cx + 4, cy); g.stroke();
      drawArrow(g, cx, cy, e.dir, '#d8eeff');
      break;
    }

    case 'boiler': {
      box(g, x0, y0, '#5b4a3e', '#c9a27a');
      g.fillStyle = e.active ? '#ff9a3c' : '#2a1a14';
      g.fillRect(cx - 7, cy + 2, 14, 6);
      g.fillStyle = '#9aa3ad';
      g.beginPath(); g.ellipse(cx, cy - 4, 9, 5, 0, 0, Math.PI * 2); g.fill();
      if (e.active) {
        g.fillStyle = `rgba(235,240,245,${0.4 + 0.2 * Math.sin(t * 4 + e.x)})`;
        g.beginPath(); g.arc(cx + 4, y0 + 2 - ((t * 10) % 6), 4, 0, Math.PI * 2); g.fill();
      }
      drawArrow(g, cx, cy, e.dir, '#ffe2c4');
      break;
    }

    case 'steam_engine': {
      box(g, x0, y0, '#3e4a55', '#b8c6d2');
      g.save();
      g.translate(cx - 3, cy);
      g.rotate(e.active ? t * 7 : 0);
      g.strokeStyle = '#d8e2ea'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2);
      for (let i = 0; i < 3; i++) { const a = i * 2.09; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); }
      g.stroke();
      g.restore();
      g.fillStyle = '#f0d44d';
      g.font = 'bold 9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('⚡', x0 + TILE - 9, y0 + 9);
      drawArrow(g, cx, cy, e.dir, '#e8eef4');
      break;
    }

    case 'radar': {
      box(g, x0, y0, '#33424a', null);
      g.save();
      g.translate(cx, cy);
      g.rotate(e.active ? t * 2 : 0.6);
      g.fillStyle = '#c9d6dd';
      g.beginPath(); g.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#33424a';
      g.beginPath(); g.ellipse(0, 1.5, 9, 3, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = '#c9d6dd';
      g.beginPath(); g.arc(cx, cy, 2.5, 0, Math.PI * 2); g.fill();
      break;
    }

    case 'landfill':
      g.fillStyle = '#5a4a32';
      g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
      g.fillStyle = '#7a6544';
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x0 + 6 + k * 5, y0 + 8 + (k % 2) * 12, 3, 0, Math.PI * 2); g.fill(); }
      break;

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
      box(g, x0, y0, '#3a424e', null, 2, s);
      // Plataforma con franjas de peligro
      g.save();
      rrect(g, x0 + 8, y0 + 8, s - 16, s - 16, 4); g.clip();
      g.fillStyle = '#2a3039'; g.fillRect(x0, y0, s, s);
      g.strokeStyle = 'rgba(240,167,66,0.55)'; g.lineWidth = 4;
      g.beginPath();
      for (let k = -s; k < s; k += 12) { g.moveTo(x0 + k, y0 + s); g.lineTo(x0 + k + s, y0); }
      g.stroke();
      g.fillStyle = '#2a3039'; rrect(g, x0 + 14, y0 + 14, s - 28, s - 28, 6); g.fill();
      g.restore();
      // Antena con luz que titila
      g.fillStyle = '#9aa3ad'; g.fillRect(x0 + s - 20, y0 + 10, 3, 10);
      g.fillStyle = Math.floor(t * 1.5) % 2 ? '#5cc47a' : '#2c5a3a';
      g.beginPath(); g.arc(x0 + s - 18.5, y0 + 10, 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f0a742';
      g.font = '700 13px "Chakra Petch", system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('NÚCLEO', x0 + s / 2, y0 + s / 2 - 5);
      g.font = '500 10px Barlow, system-ui, sans-serif';
      g.fillStyle = '#c9d1db';
      g.fillText('almacén', x0 + s / 2, y0 + s / 2 + 9);
      break;
    }

    case 'shipyard': case 'starport': drawShipyard(g, e, x0, y0, t); break;

    case 'nursery': {
      const s = TILE * 2;
      box(g, x0, y0, '#5b4630', '#6fbf5a', 2, s);
      // Canteros con brotes
      for (let k = 0; k < 4; k++) {
        const px = x0 + 14 + (k % 2) * 36, py = y0 + 14 + Math.floor(k / 2) * 36;
        g.fillStyle = '#3b2a1a'; g.fillRect(px - 9, py - 9, 18, 18);
        const grow = e.active ? Math.min(1, ((e.t || 0) / BUILDINGS.nursery.every + k * 0.25) % 1 + 0.2) : 0.5;
        g.fillStyle = '#7ee07a';
        g.beginPath(); g.ellipse(px - 3, py, 4 * grow + 1, 2 * grow + 1, -0.6, 0, Math.PI * 2); g.ellipse(px + 3, py - 1, 4 * grow + 1, 2 * grow + 1, 0.6, 0, Math.PI * 2); g.fill();
      }
      break;
    }

    case 'purifier': {
      const s = TILE * 2, mx = x0 + s / 2, my = y0 + s / 2;
      box(g, x0, y0, '#2f5d55', '#7fd1b5', 2, s);
      // Rejilla y ventilador que gira cuando limpia
      g.fillStyle = '#1b2f2b';
      g.beginPath(); g.arc(mx, my, 20, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(mx, my); g.rotate(e.active ? t * 9 : 0.3);
      g.fillStyle = '#bfe9dc';
      for (let k = 0; k < 5; k++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.ellipse(9, 0, 9, 3.5, 0.4, 0, Math.PI * 2); g.fill(); }
      g.restore();
      g.fillStyle = '#e8fff6'; g.beginPath(); g.arc(mx, my, 4, 0, Math.PI * 2); g.fill();
      // Hojita: limpia el aire
      g.fillStyle = e.active ? '#7ee07a' : '#4c7a4a';
      g.beginPath(); g.ellipse(x0 + s - 11, y0 + 11, 6, 3.5, -0.7, 0, Math.PI * 2); g.fill();
      if (e.filters !== undefined) drawProgress(g, x0, y0 + TILE, Math.min(1, e.filters / 20), '#7fd1b5');
      break;
    }

    case 'uplink': {
      const s = TILE * 3, mx = x0 + s / 2, my = y0 + s / 2;
      box(g, x0, y0, '#3a3f4a', '#ff8a5c', 2, s);
      g.strokeStyle = 'rgba(255,138,92,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(mx, my, 36, 0, Math.PI * 2); g.stroke();
      // Antena parabólica que apunta al blanco
      g.save(); g.translate(mx, my); g.rotate((e.aim ?? -Math.PI / 2) + Math.PI / 2);
      g.fillStyle = '#d8dee6';
      g.beginPath(); g.ellipse(0, -4, 22, 12, 0, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = '#9aa3ad'; g.fillRect(-2, -16, 4, 14);
      g.fillStyle = e.cd > 0 ? '#ff8a5c' : '#5cc47a';
      g.beginPath(); g.arc(0, -18, 3.5, 0, Math.PI * 2); g.fill();
      g.restore();
      // Luces de las cargas
      for (let k = 0; k < 10; k++) {
        g.fillStyle = k < (e.charges || 0) ? '#ff6a3d' : 'rgba(0,0,0,0.4)';
        g.fillRect(x0 + 10 + k * 7.6, y0 + s - 11, 5, 4);
      }
      break;
    }

    case 'fusion_plant': {
      const s = TILE * 3, mx = x0 + s / 2, my = y0 + s / 2;
      box(g, x0, y0, '#3b3a46', '#ffd166', 2, s);
      const pulse = 0.7 + 0.3 * Math.sin(t * 4 + e.x);
      const grd = g.createRadialGradient(mx, my, 2, mx, my, 30);
      grd.addColorStop(0, `rgba(255,250,220,${pulse})`); grd.addColorStop(0.45, `rgba(255,190,80,${0.7 * pulse})`); grd.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(mx, my, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c9cfd6'; g.lineWidth = 5;
      g.beginPath(); g.ellipse(mx, my, 30, 13, t * 0.6, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#8a929c'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(mx, my, 30, 13, t * 0.6 + Math.PI / 2, 0, Math.PI * 2); g.stroke();
      break;
    }
  }

  // Aviso de falta de energía
  if (def && def.power && e.id && e.type !== 'laser' && e.type !== 'lamp') {
    const net = nets[e._net];
    const noPower = !net || net.sat < 0.05;
    const low = !noPower && net.sat < 0.95;
    if ((noPower || low) && Math.floor(t * 2) % 2 === 0) {
      g.fillStyle = noPower ? '#e5534b' : '#f0c040';
      g.font = 'bold 14px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('⚡', cx, cy);
    }
  }
  if ((e.type === 'miner' || e.type === 'eminer' || e.type === 'pumpjack') && e.depleted && e.id) {
    g.fillStyle = '#e5534b';
    g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('∅', cx, cy);
  }
  // Módulos instalados: puntitos de color en la esquina
  if (e.modules && e.modules.length) {
    e.modules.forEach((m, i) => { g.fillStyle = ITEMS[m].color; g.fillRect(x0 + TILE - 7, y0 + 3 + i * 5, 4, 4); });
  }
  // Barra de vida si está dañado
  if (e.hp !== undefined && e.id) {
    const s = sizeOf(e.type) * TILE, f = Math.max(0, e.hp / maxHp(e));
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(x0 + 3, y0 - 6, s - 6, 4);
    g.fillStyle = f > 0.5 ? '#5cc47a' : f > 0.25 ? '#f0c040' : '#e5534b';
    g.fillRect(x0 + 3, y0 - 6, (s - 6) * f, 4);
  }
}

// La nave: se dibuja una silueta y se va "llenando" a medida que llegan las piezas
function drawShip(g, cx, baseY, scale, frac, flame, t, ark = false) {
  g.save();
  g.translate(cx, baseY);
  g.scale(scale, scale);
  // El arca: un casco ancho con anillo de hábitat y tres motores
  const arkPath = () => {
    g.beginPath();
    g.moveTo(0, -190);
    g.quadraticCurveTo(30, -170, 34, -120);
    g.lineTo(70, -110); g.quadraticCurveTo(84, -95, 70, -80); g.lineTo(34, -70);
    g.lineTo(34, -10);
    g.lineTo(62, 4); g.lineTo(62, 18); g.lineTo(34, 10);
    g.lineTo(-34, 10);
    g.lineTo(-62, 18); g.lineTo(-62, 4); g.lineTo(-34, -10);
    g.lineTo(-34, -70); g.lineTo(-70, -80); g.quadraticCurveTo(-84, -95, -70, -110); g.lineTo(-34, -120);
    g.quadraticCurveTo(-30, -170, 0, -190);
    g.closePath();
  };
  const path = ark ? arkPath : () => {
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
    for (const ex of ark ? [-46, -20, 0, 20, 46] : [-12, 0, 12]) {
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
    const h = ark ? 208 : 138;
    const top = 18 - frac * h;
    g.fillStyle = ark ? '#e4e8ee' : '#d7dde3';
    g.fillRect(-90, top, 180, h + 2);
    g.fillStyle = ark ? '#8a7dff' : '#e5533d';
    g.fillRect(-90, Math.max(top, -10), 180, 30);
    if (ark) {
      g.fillStyle = '#9ad17f';
      if (top < -80) g.fillRect(-90, Math.max(top, -112), 180, 34);
      g.fillStyle = '#59c3ff';
      for (const wy of [-40, -140]) if (top < wy) { g.beginPath(); g.arc(0, wy, 9, 0, Math.PI * 2); g.fill(); }
    } else {
      g.fillStyle = '#3d8fd6';
      if (top < -70) { g.beginPath(); g.arc(0, -70, 8, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    path();
    g.strokeStyle = '#8b96a1';
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.restore();
}

function drawShipyard(g, e, x0, y0, t) {
  const ark = e.type === 'starport';
  const s = TILE * sizeOf(e.type);
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
    drawShip(g, x0 + s / 2, y0 + s - 26, ark ? 0.95 : 0.95, frac, false, t, ark);
  }
}

function shipProgressOf(e) {
  let have = 0, need = 0;
  const needs = shipNeeds(e);
  for (const k in needs) { need += needs[k]; have += Math.min(needs[k], e.parts?.[k] || 0); }
  return have / need;
}

// Un vagón o la locomotora, centrado en (x, y) y girado
function drawCar(g, x, y, ang, loco, fill) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(-14, -8, 30, 18);
  g.fillStyle = loco ? '#c0472f' : '#6c7682';
  g.fillRect(-15, -9, 30, 18);
  if (loco) {
    g.fillStyle = '#2b2f36'; g.fillRect(4, -6, 8, 12);
    g.fillStyle = '#f0d44d'; g.fillRect(13, -3, 2, 6);
  } else {
    g.fillStyle = '#3d444d'; g.fillRect(-12, -6, 24, 12);
    if (fill > 0) { g.fillStyle = '#c9a227'; g.fillRect(-12, -6, 24 * Math.min(1, fill), 12); }
  }
  g.restore();
}

function drawTrains(g, lod) {
  for (const t of S.trains) {
    const fill = t.total / TRAIN_CAP;
    for (let k = 2; k >= 0; k--) {
      const p = k === 0 ? { x: t.x, y: t.y, ang: t.ang } : trainTrail(t, k * 1.05);
      if (lod) { g.fillStyle = k === 0 ? '#ff7a5c' : '#ddd'; g.fillRect(p.x * TILE + 4, p.y * TILE + 4, TILE - 8, TILE - 8); continue; }
      drawCar(g, p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, p.ang, k === 0, fill);
    }
  }
}

// El personaje, visto desde arriba: sombra, mochila, traje, casco y herramienta
function drawPlayer(g, lod) {
  const p = S.player;
  const x = p.x * TILE, y = p.y * TILE;
  if (lod) { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); return; }
  // Destino del camino
  if (p.path && p.path.length) {
    const d = p.path[p.path.length - 1];
    g.strokeStyle = 'rgba(255,211,77,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.arc(d.x * TILE, d.y * TILE, 6 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2); g.stroke();
  }
  // Barra de extracción
  if (p.mining && p.mine) {
    const mx = p.mine.x * TILE, my = p.mine.y * TILE;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(mx + 3, my - 8, TILE - 6, 5);
    g.fillStyle = '#ffd34d'; g.fillRect(mx + 3, my - 8, (TILE - 6) * Math.min(1, p.mineT / (p.mine.tree ? CHOP_TIME : HAND_MINE_TIME)), 5);
  }
  drawAvatar(g, p, x, y, '#ffb347', '#d9782a');
}

// Un personaje visto de arriba (el propio en naranja; los demás con su color)
function drawAvatar(g, p, x, y, light, dark) {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(3, 5, 11, 8, 0, 0, Math.PI * 2); g.fill();
  g.rotate(p.ang || 0);
  const swing = p.moving ? Math.sin(p.step) * 4 : 0;
  // Piernas
  g.fillStyle = '#3b4250';
  g.beginPath(); g.ellipse(-2 + swing, -5, 4, 3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(-2 - swing, 5, 4, 3, 0, 0, Math.PI * 2); g.fill();
  // Mochila
  g.fillStyle = '#6b5236';
  g.beginPath(); g.roundRect(-11, -6, 6, 12, 2); g.fill();
  // Cuerpo (traje naranja)
  const body = g.createLinearGradient(-8, -9, 8, 9);
  body.addColorStop(0, light); body.addColorStop(1, dark);
  g.fillStyle = body;
  g.beginPath(); g.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
  // Brazos y herramienta
  const arm = p.mining ? Math.sin(time * 14) * 0.9 : swing * 0.1;
  g.save();
  g.rotate(arm);
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(4, 8, 4, 3, 0, 0, Math.PI * 2); g.fill();
  if (p.mining) {
    g.strokeStyle = '#8a6a44'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(5, 8); g.lineTo(15, 10); g.stroke();
    g.strokeStyle = '#c9d1db'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(14, 5); g.quadraticCurveTo(17, 10, 14, 15); g.stroke();
  }
  g.restore();
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(4, -8, 4, 3, 0, 0, Math.PI * 2); g.fill();
  // Casco con visor
  g.fillStyle = '#f2f2ee';
  g.beginPath(); g.arc(1, 0, 5.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f6fb0';
  g.beginPath(); g.ellipse(4, 0, 2.2, 3.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath(); g.arc(4.5, -1.2, 1, 0, Math.PI * 2); g.fill();
  g.restore();
}

// Los otros jugadores conectados, con su nombre arriba
function drawRemotePlayers(g, lod) {
  for (const a of NET.avatars.values()) {
    const col = netColor(a.by);
    const x = a.x * TILE, y = a.y * TILE;
    if (lod) { g.fillStyle = col; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); continue; }
    drawAvatar(g, a, x, y, col, shadeHex(col, -0.25));
    const pr = a.by && NET.profiles[a.by];
    const name = (pr && pr.name) || 'Jugador';
    g.font = '600 11px Barlow, system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'bottom';
    const w = g.measureText(name).width + 10;
    g.fillStyle = 'rgba(10,14,20,0.75)';
    rrect(g, x - w / 2, y - 32, w, 15, 4); g.fill();
    g.fillStyle = '#fff';
    g.fillText(name, x, y - 19);
  }
}

function shadeHex(hex, k) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + k))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawGhostsAndRobots(g, vx0, vy0, vx1, vy1) {
  // Tareas pendientes del personaje
  if (playerOn()) {
    for (const q of S.player.queue) {
      if (q.kind === 'place') {
        const e = makeEntity(q.type, q.x, q.y, q.dir);
        g.globalAlpha = 0.4;
        drawBuilding(g, e, q.x * TILE, q.y * TILE, time);
        g.globalAlpha = 1;
        g.strokeStyle = '#ffd34d'; g.setLineDash([3, 3]); g.lineWidth = 1.5;
        g.strokeRect(q.x * TILE + 1.5, q.y * TILE + 1.5, sizeOf(q.type) * TILE - 3, sizeOf(q.type) * TILE - 3);
        g.setLineDash([]);
      } else {
        g.strokeStyle = '#e5534b'; g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(q.x * TILE + 8, q.y * TILE + 8); g.lineTo(q.x * TILE + TILE - 8, q.y * TILE + TILE - 8);
        g.moveTo(q.x * TILE + TILE - 8, q.y * TILE + 8); g.lineTo(q.x * TILE + 8, q.y * TILE + TILE - 8);
        g.stroke();
      }
    }
  }
  for (const gh of S.ghosts) {
    const px = gh.x * TILE, py = gh.y * TILE, s = sizeOf(gh.type) * TILE;
    if (px + s < vx0 || px > vx1 || py + s < vy0 || py > vy1) continue;
    g.globalAlpha = 0.35;
    const e = makeEntity(gh.type, gh.x, gh.y, gh.dir);
    if (gh.recipe) e.recipe = gh.recipe;
    drawBuilding(g, e, px, py, time);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(90,160,255,0.22)';
    g.fillRect(px + 1, py + 1, s - 2, s - 2);
    g.strokeStyle = 'rgba(120,180,255,0.7)';
    g.setLineDash([4, 3]);
    g.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
    g.setLineDash([]);
  }
  for (const f of S.flights) {
    const x = f.x * TILE, y = f.y * TILE - 10;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + 14, 6, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8c547';
    g.fillRect(x - 5, y - 3, 10, 6);
    g.strokeStyle = '#d8dee6'; g.lineWidth = 1.5;
    const sp = Math.sin(time * 40) * 3;
    g.beginPath(); g.moveTo(x - 8, y - 4 + sp * 0.2); g.lineTo(x - 2, y - 4); g.moveTo(x + 2, y - 4); g.lineTo(x + 8, y - 4 - sp * 0.2); g.stroke();
    if (!f.back) { g.fillStyle = '#5aa0ff'; g.beginPath(); g.arc(x, y + 5, 2.5, 0, Math.PI * 2); g.fill(); }
  }
}

function drawItemsOn(g, e) {
  if (!e.item) return;
  const cx = e.x * TILE + TILE / 2, cy = e.y * TILE + TILE / 2;
  if (isBelt(e.type) || (e.type === 'underground' && (e.mode === 'out' || e.prog < 0.5))) {
    const [dx, dy] = DIRS[e.dir];
    const k = (Math.min(e.prog, 1) - 0.5) * TILE;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(cx + dx * k + 1.5, cy + dy * k + 2.5, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
    drawItem(g, e.item, cx + dx * k, cy + dy * k, 5);
  } else if (e.type === 'splitter' || e.type === 'sorter') {
    drawItem(g, e.item, cx + 7, cy - 7, 3.5);
  }
}

// --------------------------- Bichos y efectos ---------------------------

function drawBiter(g, b, t) {
  const k = BITERS[b.kind];
  const px = b.x * TILE, py = b.y * TILE, s = k.size;
  g.save();
  g.translate(px, py);
  g.rotate(b.ang || 0);
  const walk = Math.sin(t * 18 + px) * 0.5;
  g.strokeStyle = '#2a1a10'; g.lineWidth = 1.5;
  g.beginPath();
  for (let i = -1; i <= 1; i++) {
    const w = i % 2 ? walk : -walk;
    g.moveTo(i * s * 0.4, 0); g.lineTo(i * s * 0.4 + w * 3, -s * 0.9);
    g.moveTo(i * s * 0.4, 0); g.lineTo(i * s * 0.4 - w * 3, s * 0.9);
  }
  g.stroke();
  g.fillStyle = k.color;
  g.beginPath(); g.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1a0f08';
  g.beginPath(); g.ellipse(s * 0.75, 0, s * 0.4, s * 0.35, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff5a3c';
  g.beginPath(); g.arc(s * 0.95, -s * 0.15, 1.2, 0, Math.PI * 2); g.arc(s * 0.95, s * 0.15, 1.2, 0, Math.PI * 2); g.fill();
  g.restore();
}

const effects = []; // { x, y, t, life, kind, scale, color }

function spawnExplosion(x, y, scale = 1) {
  effects.push({ x, y, t: 0, life: 0.6, kind: 'boom', scale });
}
function spawnStrike(x, y) {
  effects.push({ x, y, t: 0, life: 1.4, kind: 'strike', scale: 3 });
}
function spawnSplat(x, y, color) {
  effects.push({ x, y, t: 0, life: 4, kind: 'splat', scale: 1, color });
}

function drawEffects(g, dt) {
  for (const f of effects) {
    f.t += dt;
    const k = f.t / f.life;
    if (f.kind === 'strike') {
      // Rayo desde el cielo y una explosión grande
      const px = f.x * TILE, py = f.y * TILE, a = Math.max(0, 1 - k);
      g.fillStyle = `rgba(255,240,200,${a * 0.85})`;
      g.fillRect(px - 10 * a - 2, py - 900, 20 * a + 4, 900);
      g.fillStyle = `rgba(255,${200 - k * 140},80,${a})`;
      g.beginPath(); g.arc(px, py, (20 + k * 220), 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 4;
      g.beginPath(); g.arc(px, py, 30 + k * 260, 0, Math.PI * 2); g.stroke();
    } else if (f.kind === 'boom') {
      g.fillStyle = `rgba(255,${180 - k * 120},60,${1 - k})`;
      g.beginPath(); g.arc(f.x * TILE, f.y * TILE, (10 + k * 30) * f.scale, 0, Math.PI * 2); g.fill();
    } else {
      g.globalAlpha = Math.max(0, 0.6 * (1 - k));
      g.fillStyle = f.color;
      g.beginPath(); g.ellipse(f.x * TILE, f.y * TILE, 7, 5, f.x, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
  }
  for (let i = effects.length - 1; i >= 0; i--) if (effects[i].t >= effects[i].life) effects.splice(i, 1);
}

function drawShots(g) {
  for (const s of shots) {
    g.strokeStyle = s.laser ? 'rgba(255,60,90,0.9)' : 'rgba(255,230,140,0.9)';
    g.lineWidth = s.laser ? 2.5 : 1.2;
    g.beginPath();
    g.moveTo(s.x1 * TILE, s.y1 * TILE);
    g.lineTo(s.x2 * TILE, s.y2 * TILE);
    g.stroke();
  }
}

// --------------------------- Noche ---------------------------

const lightCanvas = document.createElement('canvas');

function lightRadius(e) {
  switch (e.type) {
    case 'lamp': return e.lit ? 7 : 0;
    case 'hub': return 6;
    case 'shipyard': return 5;
    case 'starport': return 7;
    case 'fusion_plant': return 4;
    case 'uplink': return 2;
    case 'furnace': case 'efurnace': case 'generator': case 'boiler': return e.active ? 1.6 : 0;
    case 'radar': return 1.5;
    case 'laser': case 'turret': return 1.2;
    default: return 0;
  }
}

function drawNight(ctx2, visible) {
  const dark = darkness();
  if (dark < 0.02) return;
  const scale = 0.5;
  const lw = Math.ceil(canvas.width * scale), lh = Math.ceil(canvas.height * scale);
  if (lightCanvas.width !== lw || lightCanvas.height !== lh) { lightCanvas.width = lw; lightCanvas.height = lh; }
  const g = lightCanvas.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, lw, lh);
  g.fillStyle = `rgba(6,10,32,${dark})`;
  g.fillRect(0, 0, lw, lh);
  g.globalCompositeOperation = 'destination-out';
  const k = view.zoom * dpr * scale;
  for (const [e, ox, oy] of visible) {
    const r = lightRadius(e);
    if (!r) continue;
    const s = sizeOf(e.type) / 2;
    const sx = ((e.x + s) * TILE + ox - view.x) * k + lw / 2, sy = ((e.y + s) * TILE + oy - view.y) * k + lh / 2;
    const rad = r * TILE * k;
    const grd = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.7)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.imageSmoothingEnabled = true;
  ctx2.drawImage(lightCanvas, 0, 0, canvas.width, canvas.height);
}

// --------------------------- Cuadro principal ---------------------------

let launchAnim = null; // { yard, t }
const particles = [];
let showPollution = false;
let activeOnScreen = 0;
let lastRender = 0;

// --------------------------- Árboles y humo ---------------------------

// Sprites de árboles hechos una sola vez: 3 frondosos y 3 pinos
const TREE_SPRITES = [];
(function makeTreeSprites() {
  const tones = [[52, 96, 46], [70, 112, 50], [44, 84, 52]];
  for (let v = 0; v < 6; v++) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const tone = tones[v % 3];
    const col = (k, a = 1) => `rgba(${tone[0] * k | 0},${tone[1] * k | 0},${tone[2] * k | 0},${a})`;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(37, 38, 15, 11, 0.3, 0, Math.PI * 2); g.fill();
    if (v < 3) {
      const rnd = mulberry32(v * 97 + 5);
      const blobs = [];
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * 7;
        blobs.push([32 + Math.cos(a) * d, 30 + Math.sin(a) * d, 6 + rnd() * 4]);
      }
      for (const [k, dx, dy, sr] of [[0.6, 1, 1.5, 1], [1, 0, 0, 0.9], [1.35, -1.5, -2, 0.55]]) {
        g.fillStyle = col(k);
        g.beginPath();
        for (const [x, y, r] of blobs) { g.moveTo(x + dx + r * sr, y + dy); g.arc(x + dx, y + dy, r * sr, 0, Math.PI * 2); }
        g.fill();
      }
    } else {
      // Pino visto de arriba: capas con borde dentado suave
      const rnd = mulberry32(v * 31 + 7);
      for (const [k, r, off] of [[0.55, 14, 1.5], [0.8, 11, 0.6], [1.05, 7.5, -0.2], [1.35, 4, -0.8]]) {
        g.fillStyle = col(k);
        g.beginPath();
        const n = 11, ph = rnd() * 6;
        for (let i = 0; i < n * 2; i++) {
          const a = (i / (n * 2)) * Math.PI * 2 + ph, rr = i % 2 ? r * 0.8 : r;
          g.lineTo(32 + off + Math.cos(a) * rr, 30 + off + Math.sin(a) * rr);
        }
        g.closePath(); g.fill();
      }
    }
    TREE_SPRITES.push(c);
  }
})();

function drawTrees(g, vx0, vy0, vx1, vy1) {
  const c0 = Math.max(0, Math.floor((vx0 - TILE) / (CHUNK * TILE))), c1 = Math.min(Math.ceil(W / CHUNK) - 1, Math.floor((vx1 + TILE) / (CHUNK * TILE)));
  const r0 = Math.max(0, Math.floor((vy0 - TILE) / (CHUNK * TILE))), r1 = Math.min(Math.ceil(H / CHUNK) - 1, Math.floor((vy1 + TILE) / (CHUNK * TILE)));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    for (const [x, y, v, sc, dx, dy] of chunkTrees(cx, cy)) {
      if (at(x, y) || !tileExplored(x, y)) continue;
      const s = 64 * sc;
      g.drawImage(TREE_SPRITES[v], x * TILE + 16 + dx - s / 2, y * TILE + 16 + dy - s / 2, s, s);
    }
  }
}

// Grilla suave solo mientras se construye
function drawGrid(g, vx0, vy0, vx1, vy1) {
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 1 / view.zoom;
  g.beginPath();
  const x0 = Math.max(0, Math.floor(vx0 / TILE)), x1 = Math.min(W, Math.ceil(vx1 / TILE));
  const y0 = Math.max(0, Math.floor(vy0 / TILE)), y1 = Math.min(H, Math.ceil(vy1 / TILE));
  for (let x = x0; x <= x1; x++) { g.moveTo(x * TILE, y0 * TILE); g.lineTo(x * TILE, y1 * TILE); }
  for (let y = y0; y <= y1; y++) { g.moveTo(x0 * TILE, y * TILE); g.lineTo(x1 * TILE, y * TILE); }
  g.stroke();
}

// Humo de las máquinas que queman combustible
const smoke = [];
const SMOKERS = { furnace: [0.55, 0.3, 6], boiler: [0.5, 0.25, 7], generator: [0.7, 0.2, 6], pumpjack: [0.3, 0.2, 5] };
function updateSmoke(visible, dt) {
  for (const e of visible) {
    const sm = SMOKERS[e.type];
    if (!sm || !e.active || Math.random() > sm[0] * dt * 6) continue;
    const s = sizeOf(e.type);
    smoke.push({ x: (e.x + s * 0.7) * TILE, y: (e.y + 0.2) * TILE, r: sm[2], life: 0, max: 2.2 + Math.random() * 1.5, a: sm[1], vx: 6 + Math.random() * 6, vy: -14 - Math.random() * 8 });
  }
  for (const p of smoke) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 7; }
  for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].life >= smoke[i].max) smoke.splice(i, 1);
  if (smoke.length > 400) smoke.splice(0, smoke.length - 400);
}
function drawSmoke(g) {
  for (const p of smoke) {
    const k = p.life / p.max;
    g.fillStyle = `rgba(70,70,74,${p.a * (1 - k) * Math.min(1, p.life * 4)})`;
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
  }
}

function render(ctx) {
  const now = performance.now();
  const rdt = Math.min(0.1, (now - (lastRender || now)) / 1000);
  lastRender = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d1014';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let shakeX = 0, shakeY = 0;
  if (launchAnim && launchAnim.t < 5) {
    const k = Math.min(1, launchAnim.t / 2) * 3;
    shakeX = (Math.random() - 0.5) * k; shakeY = (Math.random() - 0.5) * k;
  }
  const z = view.zoom * dpr;
  const worldTransform = () => ctx.setTransform(z, 0, 0, z, dpr * (cw / 2 - view.x * view.zoom + shakeX), dpr * (ch / 2 - view.y * view.zoom + shakeY));

  const gx0 = view.x - cw / 2 / view.zoom, gx1 = view.x + cw / 2 / view.zoom;
  const gy0 = view.y - ch / 2 / view.zoom, gy1 = view.y + ch / 2 / view.zoom;
  const lod = view.zoom < LOD_ZOOM;
  const mw = W * TILE, mh = H * TILE;

  // El mapa da la vuelta: se dibuja cada copia del mapa que entra en pantalla (como mucho 4)
  const passes = [];
  for (let ky = Math.floor(gy0 / mh); ky <= Math.floor(gy1 / mh); ky++) {
    for (let kx = Math.floor(gx0 / mw); kx <= Math.floor(gx1 / mw); kx++) passes.push([kx * mw, ky * mh]);
  }
  const lights = [];
  const seen = new Set();
  activeOnScreen = 0;
  passes.forEach(([ox, oy], pi) => {
    worldTransform();
    ctx.translate(ox, oy);
    const vis = drawWorld(ctx, gx0 - ox, gy0 - oy, gx1 - ox, gy1 - oy, lod, pi === 0 ? rdt : 0);
    for (const e of vis) {
      lights.push([e, ox, oy]);
      if (!seen.has(e)) { seen.add(e); if (e.active) activeOnScreen++; }
    }
  });
  updateSmoke(lod ? [] : [...seen], rdt);

  drawNight(ctx, lights);
  for (const [ox, oy] of passes) {
    worldTransform();
    ctx.translate(ox, oy);
    if (!lod) drawSmoke(ctx);
    drawOverlays(ctx);
    drawLaunch(ctx);
  }
}

// Una copia del mapa: suelo, edificios, bichos, trenes, personaje, cables, polución y niebla
function drawWorld(ctx, vx0, vy0, vx1, vy1, lod, rdt) {
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

  const building = BUILDINGS[tool] || tool === 'delete' || tool === 'copy' || tool === 'paste';
  if (!lod && building) drawGrid(ctx, vx0, vy0, vx1, vy1);

  // Zonas de energía al elegir algo eléctrico
  const tdef = BUILDINGS[tool];
  if (tdef && (tdef.power || tdef.output || tdef.capacity || tdef.supply)) {
    ctx.fillStyle = 'rgba(80,160,255,0.12)';
    for (const e of S.entities) {
      if (!isPole(e)) continue;
      const sup = BUILDINGS[e.type].supply;
      ctx.fillRect((e.x - sup) * TILE, (e.y - sup) * TILE, TILE * (sup * 2 + 1), TILE * (sup * 2 + 1));
    }
  }

  const visible = [];
  for (const e of S.entities) {
    const s = sizeOf(e.type) * TILE, px = e.x * TILE, py = e.y * TILE;
    if (px + s >= vx0 && px <= vx1 && py + s >= vy0 && py <= vy1 && (e.type !== 'nest' || tileExplored(e.x, e.y))) visible.push(e);
  }
  const biterVisible = (b) => tileExplored(Math.floor(b.x), Math.floor(b.y));

  if (lod) {
    for (const e of visible) {
      const s = sizeOf(e.type);
      ctx.fillStyle = TYPE_COLOR[e.type] || '#999';
      ctx.fillRect(e.x * TILE + 2, e.y * TILE + 2, s * TILE - 4, s * TILE - 4);
    }
    ctx.fillStyle = '#ff5a3c';
    for (const b of S.biters) if (biterVisible(b)) ctx.fillRect(b.x * TILE - 6, b.y * TILE - 6, 12, 12);
  } else {
    drawTrees(ctx, vx0, vy0, vx1, vy1);
    for (const e of visible) drawBuilding(ctx, e, e.x * TILE, e.y * TILE, time);
    for (const e of visible) drawItemsOn(ctx, e);
    for (const b of S.biters) {
      if (b.x * TILE < vx0 - 20 || b.x * TILE > vx1 + 20 || b.y * TILE < vy0 - 20 || b.y * TILE > vy1 + 20 || !biterVisible(b)) continue;
      drawBiter(ctx, b, time);
    }
  }
  drawTrains(ctx, lod);
  if (playerOn()) drawPlayer(ctx, lod);
  if (NET.on) drawRemotePlayers(ctx, lod);
  if (!lod) drawGhostsAndRobots(ctx, vx0, vy0, vx1, vy1);
  drawEffects(ctx, rdt);
  drawShots(ctx);

  // Cables de los postes
  ctx.lineWidth = lod ? 2 : 1.2;
  for (const big of [false, true]) {
    ctx.strokeStyle = big ? 'rgba(160,170,190,0.6)' : 'rgba(30,20,10,0.55)';
    ctx.beginPath();
    for (const [x1, y1, x2, y2, isBig] of wires) {
      if (!!isBig !== big) continue;
      const ax = x1 * TILE + TILE / 2, ay = y1 * TILE + 6, bx = x2 * TILE + TILE / 2, by = y2 * TILE + 6;
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 10, bx, by);
    }
    ctx.stroke();
  }

  if (showPollution) drawPollution(ctx, vx0, vy0, vx1, vy1);
  drawFog(ctx, vx0, vy0, vx1, vy1);
  return visible;
}

// Niebla: las celdas sin explorar se tapan, con un borde difuso
function drawFog(ctx, vx0, vy0, vx1, vy1) {
  const cs = POLL_CELL * TILE;
  const e = cs * 0.35;
  for (let cy = Math.max(0, Math.floor(vy0 / cs)); cy <= Math.min(PH - 1, Math.floor(vy1 / cs)); cy++) {
    for (let cx = Math.max(0, Math.floor(vx0 / cs)); cx <= Math.min(PW - 1, Math.floor(vx1 / cs)); cx++) {
      if (cellExplored(cx, cy)) continue;
      ctx.fillStyle = '#07090c';
      ctx.fillRect(cx * cs - 1, cy * cs - 1, cs + 2, cs + 2);
      // Borde suave hacia las celdas exploradas vecinas
      ctx.fillStyle = 'rgba(7,9,12,0.55)';
      if (cellExplored(cx - 1, cy)) ctx.fillRect(cx * cs - e, cy * cs, e, cs);
      if (cellExplored(cx + 1, cy)) ctx.fillRect((cx + 1) * cs, cy * cs, e, cs);
      if (cellExplored(cx, cy - 1)) ctx.fillRect(cx * cs, cy * cs - e, cs, e);
      if (cellExplored(cx, cy + 1)) ctx.fillRect(cx * cs, (cy + 1) * cs, cs, e);
    }
  }
}

function drawPollution(ctx, vx0, vy0, vx1, vy1) {
  const cs = POLL_CELL * TILE;
  for (let cy = Math.max(0, Math.floor(vy0 / cs)); cy <= Math.min(PH - 1, Math.floor(vy1 / cs)); cy++) {
    for (let cx = Math.max(0, Math.floor(vx0 / cs)); cx <= Math.min(PW - 1, Math.floor(vx1 / cs)); cx++) {
      const p = pollution[cy * PW + cx];
      if (p < 1) continue;
      ctx.fillStyle = `rgba(150,70,30,${Math.min(0.5, 0.06 + p / 300)})`;
      ctx.fillRect(cx * cs, cy * cs, cs, cs);
    }
  }
}

// Vistas previas: fantasmas de lo que se va a construir, áreas y marcas
function drawOverlays(ctx) {
  if (launchAnim) return;
  const pv = getPreview();
  if (pv.rect) {
    const r = pv.rect;
    ctx.fillStyle = r.fill;
    ctx.fillRect(r.x0 * TILE, r.y0 * TILE, (r.x1 - r.x0 + 1) * TILE, (r.y1 - r.y0 + 1) * TILE);
    ctx.strokeStyle = r.stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(r.x0 * TILE + 1, r.y0 * TILE + 1, (r.x1 - r.x0 + 1) * TILE - 2, (r.y1 - r.y0 + 1) * TILE - 2);
    ctx.setLineDash([]);
  }
  for (const gh of pv.ghosts) {
    const s = sizeOf(gh.type);
    const ghost = makeEntity(gh.type, gh.x, gh.y, gh.dir);
    if (gh.type === 'underground') ghost.mode = undergroundModeFor(gh.x, gh.y, gh.dir);
    if (gh.recipe) ghost.recipe = gh.recipe;
    ctx.globalAlpha = 0.55;
    drawBuilding(ctx, ghost, gh.x * TILE, gh.y * TILE, time);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = gh.ok ? '#5cc47a' : '#e5534b';
    ctx.lineWidth = 2;
    ctx.strokeRect(gh.x * TILE + 1, gh.y * TILE + 1, TILE * s - 2, TILE * s - 2);
    if (gh.type === 'pole' || gh.type === 'bigpole') {
      const d = BUILDINGS[gh.type];
      ctx.strokeStyle = 'rgba(120,180,255,0.6)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(gh.x * TILE + TILE / 2, gh.y * TILE + TILE / 2, d.reach * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(80,160,255,0.18)';
      ctx.fillRect((gh.x - d.supply) * TILE, (gh.y - d.supply) * TILE, TILE * (d.supply * 2 + 1), TILE * (d.supply * 2 + 1));
    }
    if ((gh.type === 'miner' || gh.type === 'eminer') && pv.ghosts.length < 4) {
      const r = BUILDINGS[gh.type].area;
      ctx.strokeStyle = 'rgba(240,200,80,0.6)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect((gh.x - r) * TILE + 1, (gh.y - r) * TILE + 1, (r * 2 + 1) * TILE - 2, (r * 2 + 1) * TILE - 2);
      ctx.setLineDash([]);
    }
    if (gh.type === 'turret' || gh.type === 'laser') {
      ctx.strokeStyle = 'rgba(255,120,90,0.5)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(gh.x * TILE + TILE / 2, gh.y * TILE + TILE / 2, BUILDINGS[gh.type].range * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (gh.type === 'underground' && pv.ghosts.length === 1) {
      const [dx, dy] = DIRS[gh.dir];
      ctx.fillStyle = 'rgba(201,138,46,0.18)';
      for (let k = 1; k <= UNDERGROUND_REACH + 1; k++) ctx.fillRect((gh.x + dx * k) * TILE, (gh.y + dy * k) * TILE, TILE, TILE);
    }
  }
  for (const m of pv.marks) {
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 3;
    const s = (m.size || 1) * TILE;
    ctx.strokeRect(m.x * TILE + 1.5, m.y * TILE + 1.5, s - 3, s - 3);
  }
  // Alcance del personaje al elegir algo para construir
  if (playerOn() && (BUILDINGS[tool] || tool === 'delete' || tool === 'paste')) {
    const p = S.player;
    g_reach(ctx, p);
  }
  if (handMining) {
    const { x, y, prog } = handMining;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x * TILE + 3, y * TILE - 8, TILE - 6, 5);
    ctx.fillStyle = '#f0a742';
    ctx.fillRect(x * TILE + 3, y * TILE - 8, (TILE - 6) * Math.min(1, prog / (handMining.tree ? CHOP_TIME : HAND_MINE_TIME)), 5);
  }
}

function g_reach(g, p) {
  g.strokeStyle = 'rgba(255,211,77,0.35)';
  g.lineWidth = 2;
  g.setLineDash([10, 8]);
  g.beginPath(); g.arc(p.x * TILE, p.y * TILE, REACH * TILE, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
}

// --------------------------- Despegue ---------------------------

function startLaunch(yard) {
  netPush({ k: 'L', x: yard.x, y: yard.y });
  launchAnim = { yard, t: 0 };
  sfx('launch');
  const h = sizeOf(yard.type) / 2;
  view.x = (yard.x + h) * TILE;
  view.y = (yard.y + h) * TILE;
  view.zoom = Math.max(view.zoom, 0.8);
}

function updateLaunch(dt) {
  if (!launchAnim) return;
  launchAnim.t += dt;
  const a = launchAnim, y = a.yard;
  const lift = a.t > 2 ? Math.pow(a.t - 2, 2.2) * 40 : 0;
  const hs = sizeOf(y.type);
  const bx = (y.x + hs / 2) * TILE, by = (y.y + hs) * TILE - 26 - lift;
  if (a.t > 0.5) {
    for (let i = 0; i < 4; i++) {
      particles.push({ x: bx + (Math.random() - 0.5) * 30, y: by + 20, vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 80, life: 1.5 + Math.random() });
    }
  }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.life -= dt; }
  while (particles.length && particles[0].life <= 0) particles.shift();
  if (a.t > 2) view.y = Math.max(by - 60, (y.y + hs / 2) * TILE - 400);
  if (a.t > 8) {
    launchAnim = null;
    particles.length = 0;
    for (const k in y.parts) y.parts[k] = 0;
    if (y.type === 'starport') {
      S.arkLaunched = (S.arkLaunched || 0) + 1;
      if (stageOf() < 4) { S.stage = 4; S.stageTimes = S.stageTimes || {}; S.stageTimes[3] = S.playTime; }
      save();
      showWin(true);
    } else {
      S.launched = (S.launched || 0) + 1;
      if (!S.launchTime) S.launchTime = S.playTime;
      if (stageOf() === 1) advanceStage(2); else showWin(false);
      save();
    }
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
  const hs = sizeOf(y.type);
  drawShip(ctx, (y.x + hs / 2) * TILE, (y.y + hs) * TILE - 26 - lift, 0.95, 1, a.t > 0.5, time, y.type === 'starport');
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
  if (showPollution) {
    for (let i = 0; i < pollution.length; i++) {
      const p = pollution[i];
      if (p < 1) continue;
      g.fillStyle = `rgba(150,70,30,${Math.min(0.6, 0.1 + p / 250)})`;
      g.fillRect((i % PW) * POLL_CELL * sx, Math.floor(i / PW) * POLL_CELL * sy, POLL_CELL * sx, POLL_CELL * sy);
    }
  }
  g.fillStyle = '#07090c';
  for (let i = 0; i < explored.length; i++) {
    if (!explored[i]) g.fillRect(Math.floor((i % PW) * POLL_CELL * sx), Math.floor(Math.floor(i / PW) * POLL_CELL * sy), Math.ceil(POLL_CELL * sx), Math.ceil(POLL_CELL * sy));
  }
  for (const e of S.entities) {
    const s = sizeOf(e.type);
    if (e.type === 'nest' && !tileExplored(e.x, e.y)) continue;
    g.fillStyle = e.type === 'nest' ? '#ff3b3b' : TYPE_COLOR[e.type] || '#fff';
    g.fillRect(e.x * sx, e.y * sy, Math.max(1.5, s * sx), Math.max(1.5, s * sy));
  }
  if (playerOn()) { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(S.player.x * sx, S.player.y * sy, 3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffffff';
  for (const t of S.trains) g.fillRect(t.x * sx - 1.5, t.y * sy - 1.5, 3, 3);
  g.fillStyle = '#ff7a5c';
  for (const b of S.biters) if (b.state === 'attack' && tileExplored(Math.floor(b.x), Math.floor(b.y))) g.fillRect(b.x * sx - 1, b.y * sy - 1, 2, 2);
  const vw = cw / view.zoom / TILE, vh = ch / view.zoom / TILE;
  g.strokeStyle = '#fff';
  g.lineWidth = 1;
  // El recuadro de la vista puede cruzar el borde: se dibuja también del otro lado
  const rx = (wrapX(view.x / TILE) - vw / 2) * sx, ry = (wrapY(view.y / TILE) - vh / 2) * sy;
  for (const ox of [-mc.width, 0, mc.width]) for (const oy of [-mc.height, 0, mc.height]) {
    g.strokeRect(rx + ox + 0.5, ry + oy + 0.5, vw * sx, vh * sy);
  }
}
