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
  hub: '#f0a742', belt: '#59616d', fastbelt: '#c9a640', expressbelt: '#4aa3df', underground: '#c98a2e',
  splitter: '#8a63c4', sorter: '#2fa59a', chest: '#8b5a2b', miner: '#c9a227', eminer: '#3e7cb1', pumpjack: '#8e7fa8',
  furnace: '#a0583f', efurnace: '#9aa3ad', assembler: '#4a72aa', assembler2: '#8a52b5', chem: '#3f8a52', lab: '#5fb4de',
  generator: '#5d6570', pole: '#a8743a', bigpole: '#a0aab5', solar: '#2c4a7a', accumulator: '#7d858f', lamp: '#f0e08a',
  wall: '#8f8676', turret: '#b8c08a', laser: '#9fa8ff', shipyard: '#6b737d', nest: '#9a3b6e',
  offshore: '#5aa0e0', boiler: '#c9a27a', steam_engine: '#b8c6d2', radar: '#c9d6dd',
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
    case 'battery': g.rect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 1.9); break;
    case 'ammo': g.rect(x - s, y - s * 0.6, s * 2, s * 1.2); break;
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
  if ((e.type === 'miner' || e.type === 'eminer' || e.type === 'pumpjack') && e.depleted && !oreAt(e.x, e.y) && e.id) {
    g.fillStyle = '#e5534b';
    g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('∅', cx, cy);
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
  if (!e.item) return;
  const cx = e.x * TILE + TILE / 2, cy = e.y * TILE + TILE / 2;
  if (isBelt(e.type) || (e.type === 'underground' && (e.mode === 'out' || e.prog < 0.5))) {
    const [dx, dy] = DIRS[e.dir];
    const k = (Math.min(e.prog, 1) - 0.5) * TILE;
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
function spawnSplat(x, y, color) {
  effects.push({ x, y, t: 0, life: 4, kind: 'splat', scale: 1, color });
}

function drawEffects(g, dt) {
  for (const f of effects) {
    f.t += dt;
    const k = f.t / f.life;
    if (f.kind === 'boom') {
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
  for (const e of visible) {
    const r = lightRadius(e);
    if (!r) continue;
    const s = sizeOf(e.type) / 2;
    const sx = ((e.x + s) * TILE - view.x) * k + lw / 2, sy = ((e.y + s) * TILE - view.y) * k + lh / 2;
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
let lastRender = 0;

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
  worldTransform();

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
    for (const e of visible) drawBuilding(ctx, e, e.x * TILE, e.y * TILE, time);
    for (const e of visible) drawItemsOn(ctx, e);
    for (const b of S.biters) {
      if (b.x * TILE < vx0 - 20 || b.x * TILE > vx1 + 20 || b.y * TILE < vy0 - 20 || b.y * TILE > vy1 + 20 || !biterVisible(b)) continue;
      drawBiter(ctx, b, time);
    }
  }
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

  drawNight(ctx, visible);
  worldTransform();
  drawOverlays(ctx);
  drawLaunch(ctx);
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
  view.zoom = Math.max(view.zoom, 0.8);
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
    S.launched = (S.launched || 0) + 1;
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
  g.fillStyle = '#ff7a5c';
  for (const b of S.biters) if (b.state === 'attack' && tileExplored(Math.floor(b.x), Math.floor(b.y))) g.fillRect(b.x * sx - 1, b.y * sy - 1, 2, 2);
  const vw = cw / view.zoom / TILE, vh = ch / view.zoom / TILE;
  g.strokeStyle = '#fff';
  g.lineWidth = 1;
  g.strokeRect((view.x / TILE - vw / 2) * sx + 0.5, (view.y / TILE - vh / 2) * sy + 0.5, vw * sx, vh * sy);
}
