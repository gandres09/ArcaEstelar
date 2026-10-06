'use strict';
// =====================================================================
//  Dibujos de la aventura: criaturas, jefes, guaridas, ruinas, botín,
//  números de daño y la barra de vida del personaje.
// =====================================================================

function spawnDamageNum(x, y, n, color) {
  if (!n) return;
  effects.push({ x: x + (Math.random() - 0.5) * 0.4, y, t: 0, life: 0.9, kind: 'num', text: String(n), color });
}

function hpBar(g, x, y, w, frac, col) {
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  g.fillStyle = col; g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 4);
}

// --------------------------- Criaturas ---------------------------

function drawCreature(g, c, t) {
  const d = CREATURES[c.k];
  const s = d.size * TILE;
  const px = c.x * TILE, py = c.y * TILE;
  g.save();
  g.translate(px, py);
  // Sombra
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(3, 4, s * 0.55, s * 0.4, 0, 0, Math.PI * 2); g.fill();
  g.rotate(c.ang || 0);
  const walk = c.mv ? Math.sin((c.step || 0) + t * 10) : 0;
  const lunge = c.atk ? Math.sin((0.25 - c.atk) / 0.25 * Math.PI) * s * 0.15 : 0;
  g.translate(lunge, 0);
  const col = d.color, dark = shadeHex(col, -0.35), light = shadeHex(col, 0.25);
  switch (c.k) {
    case 'beetle': case 'queen': {
      // Patas
      g.strokeStyle = '#24170c'; g.lineWidth = Math.max(1.2, s * 0.06);
      g.beginPath();
      for (let i = -1; i <= 1; i++) { const w = (i % 2 ? walk : -walk) * s * 0.12; g.moveTo(i * s * 0.2, 0); g.lineTo(i * s * 0.22 + w, -s * 0.5); g.moveTo(i * s * 0.2, 0); g.lineTo(i * s * 0.22 - w, s * 0.5); }
      g.stroke();
      if (c.k === 'queen') {   // alas
        g.fillStyle = 'rgba(220,200,255,0.35)';
        g.beginPath(); g.ellipse(-s * 0.15, -s * 0.32, s * 0.38, s * 0.16, -0.4, 0, Math.PI * 2); g.ellipse(-s * 0.15, s * 0.32, s * 0.38, s * 0.16, 0.4, 0, Math.PI * 2); g.fill();
      }
      const gr = g.createLinearGradient(0, -s * 0.3, 0, s * 0.3);
      gr.addColorStop(0, light); gr.addColorStop(1, dark);
      g.fillStyle = gr; g.beginPath(); g.ellipse(-s * 0.05, 0, s * 0.4, s * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = dark; g.lineWidth = 1; g.beginPath(); g.moveTo(-s * 0.42, 0); g.lineTo(s * 0.3, 0); g.stroke();
      g.fillStyle = dark; g.beginPath(); g.ellipse(s * 0.38, 0, s * 0.16, s * 0.14, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1a0f08'; g.lineWidth = Math.max(1.2, s * 0.05);
      g.beginPath(); g.moveTo(s * 0.48, -s * 0.06); g.quadraticCurveTo(s * 0.62, -s * 0.12, s * 0.6, s * 0.0); g.moveTo(s * 0.48, s * 0.06); g.quadraticCurveTo(s * 0.62, s * 0.12, s * 0.6, s * 0.0); g.stroke();
      if (c.k === 'queen') {   // corona de púas
        g.fillStyle = '#f0c35a';
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(s * 0.3, i * s * 0.06); g.lineTo(s * 0.18, i * s * 0.06 - s * 0.04); g.lineTo(s * 0.18, i * s * 0.06 + s * 0.04); g.fill(); }
      }
      g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(s * 0.46, -s * 0.06, Math.max(1, s * 0.03), 0, 7); g.arc(s * 0.46, s * 0.06, Math.max(1, s * 0.03), 0, 7); g.fill();
      break;
    }
    case 'stalker': {
      g.strokeStyle = dark; g.lineWidth = Math.max(2, s * 0.08); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-s * 0.3, 0); g.quadraticCurveTo(-s * 0.6, walk * s * 0.15, -s * 0.8, walk * s * 0.25); g.stroke();   // cola
      g.lineWidth = Math.max(1.5, s * 0.06);
      g.beginPath();
      for (const [lx, sg] of [[s * 0.18, 1], [-s * 0.18, -1]]) { const w = walk * sg * s * 0.14; g.moveTo(lx, 0); g.lineTo(lx + w, -s * 0.32); g.moveTo(lx, 0); g.lineTo(lx - w, s * 0.32); }
      g.stroke(); g.lineCap = 'butt';
      g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, s * 0.36, s * 0.17, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = light; g.beginPath(); g.ellipse(-s * 0.05, -s * 0.05, s * 0.22, s * 0.06, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark; g.beginPath(); g.moveTo(s * 0.3, -s * 0.12); g.lineTo(s * 0.58, 0); g.lineTo(s * 0.3, s * 0.12); g.closePath(); g.fill();
      g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(s * 0.38, -s * 0.06, Math.max(1, s * 0.03), 0, 7); g.arc(s * 0.38, s * 0.06, Math.max(1, s * 0.03), 0, 7); g.fill();
      break;
    }
    case 'spitter': {
      const pulse = 1 + Math.sin(t * 4 + c.id) * 0.05;
      g.fillStyle = dark; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.ellipse(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28, s * 0.1, s * 0.06, a, 0, 7); g.fill(); }
      const gr = g.createRadialGradient(-s * 0.08, -s * 0.08, 1, 0, 0, s * 0.34);
      gr.addColorStop(0, '#d8f07a'); gr.addColorStop(1, col);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 0.32 * pulse, 0, 7); g.fill();
      g.fillStyle = '#2b3a10'; g.beginPath(); g.ellipse(s * 0.26, 0, s * 0.1, s * 0.12, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(-s * 0.1, -s * 0.12, s * 0.06, 0, 7); g.fill();
      break;
    }
    case 'golem': case 'colossus': {
      const gr = g.createRadialGradient(-s * 0.1, -s * 0.12, 2, 0, 0, s * 0.5);
      gr.addColorStop(0, light); gr.addColorStop(1, dark);
      g.fillStyle = gr;
      g.beginPath();
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = s * (0.38 + ((i * 37) % 7) / 70); i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,25,20,0.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-s * 0.2, -s * 0.25); g.lineTo(-s * 0.05, -s * 0.05); g.lineTo(-s * 0.18, s * 0.15); g.moveTo(s * 0.1, s * 0.3); g.lineTo(s * 0.05, s * 0.1); g.stroke();
      // Puños
      g.fillStyle = dark; g.beginPath(); g.arc(s * 0.25, -s * 0.36 - walk * s * 0.05, s * 0.13, 0, 7); g.arc(s * 0.25, s * 0.36 + walk * s * 0.05, s * 0.13, 0, 7); g.fill();
      if (c.k === 'colossus') { g.fillStyle = 'rgba(90,150,70,0.7)'; g.beginPath(); g.ellipse(-s * 0.15, -s * 0.15, s * 0.14, s * 0.08, 0.5, 0, 7); g.fill(); }
      const glow = c.k === 'colossus' ? '#ff8a3c' : '#7ef0ff';
      g.fillStyle = glow; g.beginPath(); g.arc(s * 0.22, -s * 0.08, Math.max(1.2, s * 0.04), 0, 7); g.arc(s * 0.22, s * 0.08, Math.max(1.2, s * 0.04), 0, 7); g.fill();
      if (c.k === 'colossus') { g.fillStyle = `rgba(255,140,60,${0.5 + Math.sin(t * 3) * 0.2})`; g.beginPath(); g.arc(-s * 0.02, 0, s * 0.08, 0, 7); g.fill(); }
      break;
    }
  }
  // Destello al recibir un golpe
  if (c.hitT > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,255,255,${c.hitT})`; g.beginPath(); g.arc(0, 0, s * 0.4, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  g.restore();
  // Vida y nivel
  const top = py - s * 0.6 - 8;
  if (d.boss) {
    g.font = '700 12px "Chakra Petch", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillStyle = 'rgba(10,10,14,0.75)'; const w = g.measureText(`💀 ${d.name} · Nv ${c.L}`).width + 12;
    rrect(g, px - w / 2, top - 20, w, 16, 5); g.fill();
    g.fillStyle = '#ff9a8a'; g.fillText(`💀 ${d.name} · Nv ${c.L}`, px, top - 5);
    hpBar(g, px, top, Math.max(60, s), c.hp / c.mh, '#e5534b');
  } else if (c.hp < c.mh) {
    hpBar(g, px, top, 26, c.hp / c.mh, '#e5534b');
    g.font = '600 9px Barlow, system-ui, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.fillText(c.L, px - 15, top + 2);
  }
}

// --------------------------- Lugares ---------------------------

function drawRuin(g, r, t) {
  const px = r.x * TILE, py = r.y * TILE;
  g.save();
  g.translate(px + TILE / 2, py + TILE / 2);
  // Chapas tiradas y quemadas
  g.fillStyle = 'rgba(30,22,16,0.35)'; g.beginPath(); g.ellipse(0, 4, TILE * 1.3, TILE * 0.9, 0.3, 0, 7); g.fill();
  const plates = [[-22, -12, 0.6, 18, 10], [18, -16, -0.4, 14, 9], [-16, 16, 0.2, 20, 8], [20, 14, 1.1, 12, 12]];
  for (const [x, y, a, w, h] of plates) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = '#7d858f'; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(-w / 2, -h / 2, w, 2);
    g.fillStyle = 'rgba(40,30,20,0.5)'; g.fillRect(-w / 2 + 2, -h / 2 + 3, w * 0.4, h * 0.4);
    g.restore();
  }
  // Un pedazo de ala clavado
  g.fillStyle = '#9aa3ad'; g.beginPath(); g.moveTo(-6, -24); g.lineTo(6, -30); g.lineTo(4, -10); g.closePath(); g.fill();
  // El cofre
  g.fillStyle = r.looted ? '#4a3a28' : '#8a6234';
  rrect(g, -10, -7, 20, 15, 3); g.fill();
  g.fillStyle = r.looted ? '#3a2c1e' : '#b8863f'; g.fillRect(-10, -7, 20, 4);
  g.fillStyle = '#d9c27a'; g.fillRect(-2, -3, 4, 5);
  if (!r.looted) {
    const k = 0.4 + Math.sin(t * 3 + r.id) * 0.25;
    g.fillStyle = `rgba(120,230,255,${k})`;
    for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.1; g.beginPath(); g.arc(Math.cos(a) * 14, -6 + Math.sin(a) * 6, 1.6, 0, 7); g.fill(); }
  }
  g.restore();
}

function drawLair(g, l, t) {
  const px = l.x * TILE + TILE / 2, py = l.y * TILE + TILE / 2;
  const gr = g.createRadialGradient(px, py, 4, px, py, TILE * 2.4);
  gr.addColorStop(0, 'rgba(15,10,10,0.85)'); gr.addColorStop(0.6, 'rgba(40,25,20,0.5)'); gr.addColorStop(1, 'rgba(40,25,20,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, TILE * 2.4, TILE * 1.9, 0, 0, 7); g.fill();
  // Huesos
  g.strokeStyle = '#e8dfc8'; g.lineWidth = 3; g.lineCap = 'round';
  for (const [x, y, a] of [[-38, 18, 0.4], [34, -20, -0.8], [26, 30, 1.6], [-30, -26, 2.4]]) {
    g.beginPath(); g.moveTo(px + x - Math.cos(a) * 8, py + y - Math.sin(a) * 8); g.lineTo(px + x + Math.cos(a) * 8, py + y + Math.sin(a) * 8); g.stroke();
  }
  g.lineCap = 'butt';
  // Calavera
  g.fillStyle = '#e8dfc8';
  g.beginPath(); g.arc(px, py - 3, 9, 0, 7); g.fill(); g.fillRect(px - 5, py + 3, 10, 6);
  g.fillStyle = '#1a1010'; g.beginPath(); g.arc(px - 3.5, py - 3, 2.5, 0, 7); g.arc(px + 3.5, py - 3, 2.5, 0, 7); g.fill();
  if (l.alive) {
    g.strokeStyle = `rgba(229,83,75,${0.35 + Math.sin(t * 2) * 0.2})`; g.lineWidth = 3;
    g.beginPath(); g.ellipse(px, py, TILE * 2, TILE * 1.5, 0, 0, 7); g.stroke();
  }
}

function drawDrop(g, d, t) {
  const px = d.x * TILE, py = d.y * TILE - 3 + Math.sin(t * 3 + d.id) * 2;
  const glow = d.g ? RARITY[d.g.r || 0].color : '#ffffff';
  const gr = g.createRadialGradient(px, py, 1, px, py, 14);
  gr.addColorStop(0, glow + '88'); gr.addColorStop(1, glow + '00');
  g.fillStyle = gr; g.beginPath(); g.arc(px, py, 14, 0, 7); g.fill();
  if (d.g) drawGearIcon(g, d.g.b, px, py, 7, glow);
  else drawItem(g, d.i, px, py, 6);
}

function drawGearIcon(g, b, x, y, s, col) {
  g.save(); g.translate(x, y);
  g.strokeStyle = '#1b1f24'; g.lineWidth = 1;
  switch (b) {
    case 'sword':
      g.rotate(-0.8);
      g.fillStyle = '#dfe6ee'; g.beginPath(); g.moveTo(-s * 0.15, -s); g.lineTo(s * 0.15, -s); g.lineTo(s * 0.15, s * 0.4); g.lineTo(0, s * 0.6); g.lineTo(-s * 0.15, s * 0.4); g.closePath();
      g.save(); g.translate(0, -s * 0.2); g.restore();
      g.fill(); g.stroke();
      g.fillStyle = col; g.fillRect(-s * 0.5, -s * 0.15 + s * 0.45 - s, s, s * 0.2);
      g.fillStyle = '#6b4a2a'; g.fillRect(-s * 0.1, -s * 1.4, s * 0.2, s * 0.45);
      break;
    case 'hammer':
      g.rotate(-0.6);
      g.fillStyle = '#6b4a2a'; g.fillRect(-s * 0.1, -s * 0.4, s * 0.2, s * 1.4);
      g.fillStyle = '#9aa3ad'; rrect(g, -s * 0.55, -s * 0.85, s * 1.1, s * 0.55, 2); g.fill(); g.stroke();
      g.fillStyle = col; g.fillRect(-s * 0.55, -s * 0.62, s * 1.1, s * 0.12);
      break;
    case 'pistol':
      g.fillStyle = '#4a525c'; rrect(g, -s * 0.8, -s * 0.35, s * 1.5, s * 0.5, 2); g.fill(); g.stroke();
      g.fillStyle = '#2b3036'; g.beginPath(); g.moveTo(-s * 0.5, s * 0.1); g.lineTo(-s * 0.1, s * 0.1); g.lineTo(-s * 0.25, s * 0.85); g.lineTo(-s * 0.65, s * 0.85); g.closePath(); g.fill();
      g.fillStyle = col; g.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.12);
      break;
    case 'rifle':
      g.rotate(-0.35);
      g.fillStyle = '#6b4a2a'; g.beginPath(); g.moveTo(-s, -s * 0.15); g.lineTo(-s * 0.3, -s * 0.15); g.lineTo(-s * 0.3, s * 0.35); g.lineTo(-s, s * 0.45); g.closePath(); g.fill();
      g.fillStyle = '#4a525c'; g.fillRect(-s * 0.35, -s * 0.2, s * 1.4, s * 0.3); g.strokeRect(-s * 0.35, -s * 0.2, s * 1.4, s * 0.3);
      g.fillStyle = col; g.fillRect(-s * 0.1, -s * 0.38, s * 0.5, s * 0.16);
      break;
    case 'flamer':
      g.fillStyle = '#c0392b'; rrect(g, -s * 0.9, -s * 0.45, s * 0.6, s * 0.9, 3); g.fill(); g.stroke();
      g.fillStyle = '#4a525c'; g.fillRect(-s * 0.3, -s * 0.15, s * 1.2, s * 0.3);
      g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(s * 0.9, 0); g.lineTo(s * 1.2, -s * 0.25); g.lineTo(s * 1.25, s * 0.2); g.closePath(); g.fill();
      g.fillStyle = col; g.fillRect(-s * 0.85, -s * 0.1, s * 0.5, s * 0.15);
      break;
    default: {   // armaduras: un peto
      g.fillStyle = b === 'heavy' ? '#7d858f' : '#a9c0d6';
      g.beginPath(); g.moveTo(-s * 0.7, -s * 0.7); g.lineTo(-s * 0.25, -s * 0.85); g.quadraticCurveTo(0, -s * 0.5, s * 0.25, -s * 0.85); g.lineTo(s * 0.7, -s * 0.7);
      g.lineTo(s * 0.6, s * 0.2); g.quadraticCurveTo(0, s * 0.95, -s * 0.6, s * 0.2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = col; g.fillRect(-s * 0.08, -s * 0.5, s * 0.16, s * 0.9);
      if (b === 'heavy') { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-s * 0.55, -s * 0.2, s * 1.1, s * 0.1); }
    }
  }
  g.restore();
}

function drawBagMark(g, b, t) {
  const px = b.x * TILE, py = b.y * TILE + Math.sin(t * 3) * 2;
  g.fillStyle = 'rgba(255,211,77,0.3)'; g.beginPath(); g.arc(px, py, 14 + Math.sin(t * 4) * 2, 0, 7); g.fill();
  g.fillStyle = '#7a5532'; rrect(g, px - 8, py - 8, 16, 16, 4); g.fill();
  g.fillStyle = '#9b6e44'; rrect(g, px - 6, py - 12, 12, 6, 3); g.fill();
  g.fillStyle = '#d9c27a'; g.fillRect(px - 2, py - 3, 4, 4);
}

// --------------------------- Personaje en pelea ---------------------------

function drawPlayerCombat(g, p, x, y) {
  if (!p.equip) return;
  const st = playerStats(p);
  // Golpe cuerpo a cuerpo: un arco delante
  if (p.swing > 0 && p.swingMelee) {
    const k = p.swing / 0.22;
    g.strokeStyle = `rgba(255,255,255,${0.7 * k})`; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, 22, p.ang - 0.9 * k, p.ang + 0.9 * k); g.stroke();
  }
  if (p.hurtT > 0) { g.fillStyle = `rgba(255,60,60,${p.hurtT * 1.6})`; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }
  if (p.hp < st.maxHp) hpBar(g, x, y + 16, 30, p.hp / st.maxHp, p.hp / st.maxHp > 0.35 ? '#5cc47a' : '#e5534b');
  if (p.safeT > 0) { g.strokeStyle = `rgba(120,200,255,${0.5 * Math.min(1, p.safeT)})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 16, 0, 7); g.stroke(); }
}

// --------------------------- Todo junto ---------------------------

function drawAdventure(g, vx0, vy0, vx1, vy1, lod, t) {
  if (!S.character || !S.creatures) return;
  const inView = (x, y, m = 60) => x * TILE > vx0 - m && x * TILE < vx1 + m && y * TILE > vy0 - m && y * TILE < vy1 + m;
  const seen = (x, y) => tileExplored(Math.floor(x), Math.floor(y));
  if (lod) {
    for (const c of S.creatures) if (inView(c.x, c.y) && seen(c.x, c.y)) { g.fillStyle = CREATURES[c.k].boss ? '#ff3b6b' : '#ffb03b'; g.fillRect(c.x * TILE - 8, c.y * TILE - 8, 16, 16); }
    return;
  }
  for (const l of S.lairs || []) if (inView(l.x, l.y, 120) && seen(l.x, l.y)) drawLair(g, l, t);
  for (const r of S.ruins || []) if (inView(r.x, r.y, 80) && seen(r.x, r.y)) drawRuin(g, r, t);
  for (const d of S.drops) if (inView(d.x, d.y)) drawDrop(g, d, t);
  if (playerOn() && S.player.bag && inView(S.player.bag.x, S.player.bag.y)) drawBagMark(g, S.player.bag, t);
  for (const c of S.creatures) if (inView(c.x, c.y, 120) && seen(c.x, c.y)) drawCreature(g, c, t);
}

// Números de daño (los dibuja drawEffects)
function drawDamageNum(g, f) {
  const k = f.t / f.life;
  g.globalAlpha = Math.max(0, 1 - k);
  g.font = '800 13px Barlow, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)';
  const y = (f.y - k * 0.8) * TILE;
  g.strokeText(f.text, f.x * TILE, y);
  g.fillStyle = f.color; g.fillText(f.text, f.x * TILE, y);
  g.globalAlpha = 1;
}
