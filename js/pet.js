'use strict';
// =====================================================================
//  El perrito: una mascota que te sigue (o se queda sentada), que podés
//  alimentar y acariciar. Es solo compañía: no toca la fábrica.
//  Vive dentro del personaje, así cada jugador tiene el suyo y se ve en línea.
// =====================================================================

const PET_COLORS = [
  { name: 'Marrón', body: '#8b5a2b', dark: '#5e3a1a', ear: '#5e3a1a' },
  { name: 'Negro', body: '#2e2c2b', dark: '#151413', ear: '#151413' },
  { name: 'Blanco', body: '#ece6da', dark: '#bdb4a3', ear: '#c9a27a' },
  { name: 'Dorado', body: '#d9a441', dark: '#a8772a', ear: '#a8772a' },
];
const PET_HUNGER_TIME = 1200;   // segundos hasta tener hambre del todo
const PET_ANIMS = ['idle', 'walk', 'sit', 'happy', 'eat', 'rest'];
const petHearts = [];           // corazoncitos que suben (solo se ven, no se guardan)

function ensurePet(p) {
  if (!p || p.pet) return;
  p.pet = { x: p.x - 1.2, y: p.y + 0.6, ang: 0, mode: 'follow', color: 0, name: 'Firulais', food: 1, anim: 'idle', step: 0, happyT: 0, eatT: 0, idleT: 0 };
}

function updatePet(p, dt) {
  ensurePet(p);
  const d = p.pet;
  d.food = Math.max(0, d.food - dt / PET_HUNGER_TIME);
  d.happyT = Math.max(0, d.happyT - dt);
  d.eatT = Math.max(0, d.eatT - dt);
  if (d.eatT > 0) { d.anim = 'eat'; return; }
  if (d.mode === 'sit') { d.anim = d.happyT > 0 ? 'happy' : 'sit'; return; }
  // Sigue a su dueño: al costado y un poco atrás, para que no se pisen los carteles
  const side = p.ang + Math.PI * 0.62;
  const tx = p.x + Math.cos(side) * 1.4, ty = p.y + Math.sin(side) * 1.4;
  const dx = wdx(tx - d.x), dy = wdy(ty - d.y), dist = Math.hypot(dx, dy);
  if (dist > 30) { d.x = wrapX(tx); d.y = wrapY(ty); return; }   // se quedó muy atrás: aparece al lado
  if (dist > 0.7) {
    const sp = Math.min(dist * 3, PLAYER_SPEED * 1.25);
    d.x = wrapX(d.x + dx / dist * sp * dt); d.y = wrapY(d.y + dy / dist * sp * dt);
    d.ang = Math.atan2(dy, dx);
    d.step += sp * dt * 2.2;
    d.anim = 'walk';
    d.idleT = 0;
  } else {
    d.idleT += dt;
    d.anim = d.happyT > 0 ? 'happy' : d.idleT > 6 ? 'rest' : 'idle';
  }
}

function spawnHearts(x, y, n = 3) {
  for (let i = 0; i < n; i++) petHearts.push({ x: x + (Math.random() - 0.5) * 0.6, y: y - 0.2, t: -i * 0.18 });
}

// --------------------------- Acciones ---------------------------

function petFeed() {
  const d = S.player && S.player.pet;
  if (!d) return;
  if (d.food > 0.9) { toast(`${escapeHtml(d.name)} no tiene hambre ahora.`); return; }
  d.food = 1; d.eatT = 2.2; d.happyT = 3;
  spawnHearts(d.x, d.y, 4);
  sfx('click');
  toast(`🦴 ${escapeHtml(d.name)} comió con ganas.`);
}

function petPet() {
  const d = S.player && S.player.pet;
  if (!d) return;
  d.happyT = 3; d.idleT = 0;
  spawnHearts(d.x, d.y, 3);
  sfx('research');
}

function petToggleSit() {
  const d = S.player && S.player.pet;
  if (!d) return;
  d.mode = d.mode === 'sit' ? 'follow' : 'sit';
  toast(d.mode === 'sit' ? `🐕 ${escapeHtml(d.name)} se queda acá esperándote.` : `🐕 ${escapeHtml(d.name)} te sigue.`);
}

// ¿Tocaron a mi perro?
function petAt(t) {
  const d = S.player && S.player.pet;
  return !!d && Math.abs(wdx(t.x + 0.5 - d.x)) < 0.8 && Math.abs(wdy(t.y + 0.5 - d.y)) < 0.8;
}

// --------------------------- Panel ---------------------------

function openPetPanel() {
  closeInspector();
  $('pet-panel').hidden = false;
  renderPetPanel();
}

function renderPetPanel() {
  const box = $('pet-panel');
  const d = S.player && S.player.pet;
  if (!d || box.hidden) return;
  const food = Math.round(d.food * 100);
  const mood = d.food < 0.25 ? 'tiene hambre 🥺' : d.happyT > 0 ? 'está feliz 💛' : d.mode === 'sit' ? 'está sentado esperando' : 'te acompaña';
  box.innerHTML = `<div class="insp-head"><b>🐕 Tu perro</b><button type="button" class="close" data-pet="close">✕</button></div>
    <div class="net-nick"><input id="pet-name" type="text" maxlength="16" value="${escapeHtml(d.name)}" autocomplete="off" aria-label="Nombre"><button type="button" class="small-btn" data-pet="name">Llamarlo así</button></div>
    <p>${escapeHtml(d.name)} ${mood}.</p>
    <div class="row"><span>Panza</span><span>${food} %</span></div>${bar(d.food)}
    <div class="actions">
      <button type="button" class="primary" data-pet="feed">🦴 Alimentar</button>
      <button type="button" data-pet="pet">✋ Acariciar</button>
      <button type="button" data-pet="sit">${d.mode === 'sit' ? '🐾 Seguime' : '🪑 Sentate'}</button>
    </div>
    <div class="pick-title">Color</div>
    <div class="picker">${PET_COLORS.map((c, i) => `<button type="button" class="pick pet-col${d.color === i ? ' on' : ''}" data-pet="color" data-v="${i}" title="${c.name}"><span class="sig-dot" style="background:${c.body}"></span>${c.name}</button>`).join('')}</div>`;
}

function initPet() {
  const box = $('pet-panel');
  box.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('[data-pet]');
    if (!b || ev.button !== 0) return;
    const d = S.player && S.player.pet;
    switch (b.dataset.pet) {
      case 'close': box.hidden = true; return;
      case 'feed': petFeed(); break;
      case 'pet': petPet(); break;
      case 'sit': petToggleSit(); break;
      case 'color': if (d) d.color = Math.max(0, Math.min(3, +b.dataset.v | 0)); break;
      case 'name': {
        const v = cleanNick($('pet-name').value);
        if (d && v.length >= 2) { d.name = v; toast(`Ahora se llama <b>${escapeHtml(v)}</b>.`); }
        break;
      }
    }
    renderPetPanel();
  });
  box.addEventListener('keydown', (ev) => {
    if (ev.target.id === 'pet-name' && ev.key === 'Enter') { const b = box.querySelector('[data-pet="name"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); }
    ev.stopPropagation();
  });
  setInterval(() => { if (!box.hidden && document.activeElement?.id !== 'pet-name') renderPetPanel(); }, 1000);
}

// --------------------------- Dibujo ---------------------------

// Un perrito visto de arriba. st: { x, y, ang, color, anim, step, name }
function drawPet(g, st, showName) {
  const c = PET_COLORS[st.color] || PET_COLORS[0];
  const x = st.x * TILE, y = st.y * TILE;
  const anim = st.anim || 'idle';
  const sitting = anim === 'sit' || anim === 'rest';
  const wag = anim === 'happy' ? Math.sin(time * 26) * 0.9 : anim === 'walk' ? Math.sin(time * 12) * 0.4 : Math.sin(time * 4) * 0.2;
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2); g.fill();
  g.rotate(st.ang || 0);
  // Cola
  g.save();
  g.translate(-8, 0); g.rotate(Math.PI + wag);
  g.strokeStyle = c.dark; g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(4, -2, 7, 1); g.stroke();
  g.restore();
  // Patas
  if (!sitting) {
    const s = anim === 'walk' ? Math.sin(st.step || 0) * 2.5 : 0;
    g.fillStyle = c.dark;
    for (const [lx, ly, k] of [[5, -4, 1], [5, 4, -1], [-5, -4, -1], [-5, 4, 1]]) { g.beginPath(); g.ellipse(lx + s * k, ly * 1.15, 2, 1.6, 0, 0, Math.PI * 2); g.fill(); }
  }
  // Cuerpo
  g.fillStyle = c.body;
  g.beginPath(); g.ellipse(sitting ? -2 : 0, 0, sitting ? 6.5 : 8.5, 5.2, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.stroke();
  // Cabeza (si come, baja la cabeza)
  const hx = anim === 'eat' ? 10 + Math.sin(time * 18) * 0.8 : 8;
  g.fillStyle = c.body;
  g.beginPath(); g.arc(hx, 0, 4.6, 0, Math.PI * 2); g.fill(); g.stroke();
  // Orejas
  g.fillStyle = c.ear;
  g.beginPath(); g.ellipse(hx - 1.5, -4.2, 2.6, 1.6, -0.5, 0, Math.PI * 2); g.ellipse(hx - 1.5, 4.2, 2.6, 1.6, 0.5, 0, Math.PI * 2); g.fill();
  // Hocico y nariz
  g.fillStyle = c.dark;
  g.beginPath(); g.ellipse(hx + 3.6, 0, 2.2, 1.9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#111';
  g.beginPath(); g.arc(hx + 5.2, 0, 1.1, 0, Math.PI * 2); g.fill();
  // Ojos
  g.beginPath(); g.arc(hx + 1.6, -1.8, 0.8, 0, Math.PI * 2); g.arc(hx + 1.6, 1.8, 0.8, 0, Math.PI * 2); g.fill();
  if (anim === 'eat') {
    g.fillStyle = '#c0392b';
    g.beginPath(); g.ellipse(hx + 7, 0, 3.5, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8d6b0'; g.fillRect(hx + 5.5, -1, 3, 2);
  }
  g.restore();
  // Burbuja de hambre
  if ((st.food ?? 1) < 0.25 && anim !== 'eat') {
    g.font = '12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x + 9, y - 13, 7.5, 0, Math.PI * 2); g.fill();
    g.fillText('🦴', x + 9, y - 12.5);
  }
  if (showName && st.name) {
    g.font = '600 9.5px Barlow, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(st.name).width + 8;
    g.fillStyle = 'rgba(10,14,20,0.6)'; rrect(g, x - w / 2, y + 9, w, 12, 4); g.fill();
    g.fillStyle = '#f3e7d3'; g.fillText(st.name, x, y + 15.5);
  }
}

function drawPetHearts(g, dt) {
  for (const h of petHearts) {
    h.t += dt;
    if (h.t < 0) continue;
    const a = Math.max(0, 1 - h.t / 1.4);
    g.globalAlpha = a;
    g.font = `${10 + h.t * 4}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('❤️', h.x * TILE + Math.sin(h.t * 6) * 3, (h.y - h.t * 0.9) * TILE);
  }
  g.globalAlpha = 1;
  for (let i = petHearts.length - 1; i >= 0; i--) if (petHearts[i].t > 1.4) petHearts.splice(i, 1);
}
