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
const PET_HUNGER_TIME = 1800;   // media hora de juego con la panza llena (se va vaciando)
const PET_STARVE_TIME = 1800;   // media hora con hambre; después se escapa
const PET_MAX_LEVEL = 10;
const PET_ANIMS = ['idle', 'walk', 'sit', 'happy', 'eat', 'rest', 'sad', 'spin'];
// Cariño necesario para cada nivel (nivel 2: 40, nivel 5: 400, nivel 10: 1800)
const petXpFor = (lv) => 20 * lv * (lv - 1);
const PET_PERKS = { 2: 'un collar', 4: 'una medallita', 6: 'un pañuelo', 8: 'una vuelta de alegría cuando lo mimás', 10: 'una corona dorada' };
const petHearts = [];           // corazoncitos que suben (solo se ven, no se guardan)

function newPet(x, y, name = 'Firulais', color = 0) {
  return { x, y, ang: 0, mode: 'follow', color, name, food: 1, anim: 'idle', step: 0, happyT: 0, eatT: 0, idleT: 0, xp: 0, level: 1, starve: 0, petCd: 0, warn: 0 };
}

function ensurePet(p) {
  if (!p) return;
  if (!p.pet) p.pet = newPet(p.x - 1.2, p.y + 0.6);
  const d = p.pet;
  if (d.level === undefined) Object.assign(d, { xp: 0, level: 1, starve: 0, petCd: 0, warn: 0 });   // perros de antes
}

function petGainXp(d, n) {
  if (d.gone || d.level >= PET_MAX_LEVEL) return;
  d.xp += n;
  while (d.level < PET_MAX_LEVEL && d.xp >= petXpFor(d.level + 1)) {
    d.level++;
    spawnHearts(d.x, d.y, 8);
    sfx('win');
    const perk = PET_PERKS[d.level];
    toast(`🐕 ¡${escapeHtml(d.name)} subió a nivel ${d.level}!${perk ? ` Ahora tiene ${perk}.` : ''}`);
  }
}

function updatePet(p, dt) {
  ensurePet(p);
  const d = p.pet;
  if (d.gone) return;
  d.food = Math.max(0, d.food - dt / PET_HUNGER_TIME);
  d.happyT = Math.max(0, d.happyT - dt);
  d.eatT = Math.max(0, d.eatT - dt);
  d.petCd = Math.max(0, (d.petCd || 0) - dt);
  // Compañía: un poquito de cariño por cada minuto juntos, si está bien comido
  if (d.food > 0.25) petGainXp(d, dt / 60);
  // Hambre: avisa, se pone triste y si nadie le da de comer, se escapa
  if (d.food <= 0) {
    d.starve += dt;
    if (d.warn < 1) { d.warn = 1; toast(`🥺 <b>${escapeHtml(d.name)}</b> tiene mucha hambre. Tocalo y dale de comer.`); }
    if (d.warn < 2 && d.starve > PET_STARVE_TIME * 0.6) { d.warn = 2; sfx('alarm'); toast(`😢 <b>${escapeHtml(d.name)}</b> está muy triste. Si no come pronto, se va a ir.`); }
    if (d.starve >= PET_STARVE_TIME) { petRunAway(p); return; }
  } else if (d.food > 0.25) { d.starve = 0; d.warn = 0; }
  if (d.eatT > 0) { d.anim = 'eat'; return; }
  if (d.food <= 0 && d.happyT <= 0) { d.anim = 'sad'; return; }
  if (d.mode === 'sit') { d.anim = d.happyT > 0 ? (d.level >= 8 && d.happyT > 2 ? 'spin' : 'happy') : 'sit'; return; }
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
    d.anim = d.happyT > 0 ? (d.level >= 8 && d.happyT > 2 ? 'spin' : 'happy') : d.idleT > 6 ? 'rest' : 'idle';
  }
}

function spawnHearts(x, y, n = 3) {
  for (let i = 0; i < n; i++) petHearts.push({ x: x + (Math.random() - 0.5) * 0.6, y: y - 0.2, t: -i * 0.18 });
}

// --------------------------- Acciones ---------------------------

// Se escapa: se pierde su nivel; se puede adoptar otro
function petRunAway(p) {
  const d = p.pet;
  d.gone = true;
  d.goneLevel = d.level;
  sfx('alarm');
  toast(`💔 <b>${escapeHtml(d.name)}</b> se escapó porque nadie le daba de comer. Podés adoptar otro perrito desde ☰ → Perrito.`);
  if (!$('pet-panel').hidden) renderPetPanel();
}

function petAdopt() {
  const p = S.player;
  if (!p) return;
  const old = p.pet;
  p.pet = newPet(p.x - 1.2, p.y + 0.6, 'Firulais', old ? old.color : 0);
  spawnHearts(p.pet.x, p.pet.y, 5);
  toast('🐕 ¡Adoptaste un perrito! Ponele nombre y no te olvides de darle de comer.');
}

function petFeed() {
  const d = S.player && S.player.pet;
  if (!d || d.gone) return;
  if (d.food > 0.9) { toast(`${escapeHtml(d.name)} no tiene hambre ahora.`); return; }
  if (d.food <= 0.6) petGainXp(d, 20);   // comer con hambre: mucho cariño
  d.food = 1; d.eatT = 2.2; d.happyT = 3;
  spawnHearts(d.x, d.y, 4);
  sfx('click');
  toast(`🦴 ${escapeHtml(d.name)} comió con ganas.`);
}

function petPet() {
  const d = S.player && S.player.pet;
  if (!d || d.gone) return;
  if (!d.petCd) { petGainXp(d, 5); d.petCd = 30; }   // los mimos suman cariño cada 30 s
  d.happyT = 3; d.idleT = 0;
  spawnHearts(d.x, d.y, 3);
  sfx('research');
}

function petToggleSit() {
  const d = S.player && S.player.pet;
  if (!d || d.gone) return;
  d.mode = d.mode === 'sit' ? 'follow' : 'sit';
  toast(d.mode === 'sit' ? `🐕 ${escapeHtml(d.name)} se queda acá esperándote.` : `🐕 ${escapeHtml(d.name)} te sigue.`);
}

// ¿Tocaron a mi perro?
function petAt(t) {
  const d = S.player && S.player.pet;
  return !!d && !d.gone && Math.abs(wdx(t.x + 0.5 - d.x)) < 0.8 && Math.abs(wdy(t.y + 0.5 - d.y)) < 0.8;
}

// --------------------------- Panel ---------------------------

function openPetPanel() {
  closeInspector();
  $('pet-panel').hidden = false;
  renderPetPanel();
}

function renderPetPanel() {
  const box = $('pet-panel');
  if (box.hidden) return;
  if (!S.player) { box.innerHTML = '<div class="insp-head"><b>🐕 Perrito</b><button type="button" class="close" data-pet="close">✕</button></div><p>El perrito acompaña a tu personaje. Empezá un juego nuevo en modo personaje para tener uno.</p>'; return; }
  ensurePet(S.player);
  const d = S.player.pet;
  if (d.gone) {
    box.innerHTML = `<div class="insp-head"><b>🐕 Perrito</b><button type="button" class="close" data-pet="close">✕</button></div>
      <p>💔 <b>${escapeHtml(d.name)}</b> (nivel ${d.goneLevel || 1}) se escapó porque pasó mucho tiempo sin comer.</p>
      <p class="muted small">Podés adoptar otro. Arranca en nivel 1: alimentalo cuando tenga hambre y mimalo para que suba.</p>
      <div class="actions"><button type="button" class="primary" data-pet="adopt">🐾 Adoptar un perrito</button></div>`;
    return;
  }
  const food = Math.round(d.food * 100);
  const mood = d.food <= 0 ? 'está muy triste y con hambre 😢' : d.food < 0.25 ? 'tiene hambre 🥺' : d.happyT > 0 ? 'está feliz 💛' : d.mode === 'sit' ? 'está sentado esperando' : 'te acompaña';
  const lvFrom = petXpFor(d.level), lvTo = petXpFor(d.level + 1);
  const next = Object.keys(PET_PERKS).map(Number).find((l) => l > d.level);
  box.innerHTML = `<div class="insp-head"><b>🐕 Tu perro · nivel ${d.level}</b><button type="button" class="close" data-pet="close">✕</button></div>
    <div class="net-nick"><input id="pet-name" type="text" maxlength="16" value="${escapeHtml(d.name)}" autocomplete="off" aria-label="Nombre"><button type="button" class="small-btn" data-pet="name">Llamarlo así</button></div>
    <p>${escapeHtml(d.name)} ${mood}.</p>
    <div class="row"><span>Panza</span><span>${food} %</span></div>${bar(d.food)}
    ${d.food <= 0 ? `<p class="bad small">Si no come, se va a escapar (le quedan unos ${Math.max(1, Math.ceil((PET_STARVE_TIME - d.starve) / 60))} min de juego).</p>` : ''}
    <div class="row"><span>Cariño</span><span>${d.level >= PET_MAX_LEVEL ? '¡nivel máximo!' : `${Math.floor(d.xp - lvFrom)} / ${lvTo - lvFrom}`}</span></div>${bar(d.level >= PET_MAX_LEVEL ? 1 : (d.xp - lvFrom) / (lvTo - lvFrom))}
    ${next ? `<p class="muted small">En el nivel ${next} gana ${PET_PERKS[next]}. Suma cariño comiendo con hambre, con mimos y acompañándote.</p>` : ''}
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
      case 'adopt': petAdopt(); break;
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
  const sitting = anim === 'sit' || anim === 'rest' || anim === 'sad';
  // Brillo dorado del nivel máximo
  if ((st.level || 1) >= 10) {
    const grd = g.createRadialGradient(x, y, 2, x, y, 18);
    grd.addColorStop(0, 'rgba(255,215,90,0.35)'); grd.addColorStop(1, 'rgba(255,215,90,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill();
  }
  const wag = anim === 'happy' || anim === 'spin' ? Math.sin(time * 26) * 0.9 : anim === 'walk' ? Math.sin(time * 12) * 0.4 : anim === 'sad' ? 0.9 : Math.sin(time * 4) * 0.2;
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2); g.fill();
  g.rotate((st.ang || 0) + (anim === 'spin' ? time * 9 : 0));
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
  // Accesorios según el nivel: collar (2), medallita (4), pañuelo (6)
  const lv = st.level || 1;
  if (lv >= 6) { g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(4, -4.6); g.lineTo(4, 4.6); g.lineTo(0.5, 0); g.closePath(); g.fill(); }
  else if (lv >= 2) { g.fillStyle = '#d64545'; g.fillRect(3.4, -4, 1.6, 8); }
  if (lv >= 4) { g.fillStyle = '#f0c040'; g.beginPath(); g.arc(4.6, 0, 1.4, 0, Math.PI * 2); g.fill(); }
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
  // Ojos (tristes: cerraditos)
  if (anim === 'sad') { g.strokeStyle = '#111'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(hx + 1, -2.4); g.lineTo(hx + 2.2, -1.4); g.moveTo(hx + 1, 2.4); g.lineTo(hx + 2.2, 1.4); g.stroke(); }
  else { g.beginPath(); g.arc(hx + 1.6, -1.8, 0.8, 0, Math.PI * 2); g.arc(hx + 1.6, 1.8, 0.8, 0, Math.PI * 2); g.fill(); }
  // Corona (nivel 10)
  if (lv >= 10) {
    g.fillStyle = '#f5c518';
    g.beginPath(); g.moveTo(hx - 3, -3); g.lineTo(hx - 3, 3); g.lineTo(hx - 6, 3); g.lineTo(hx - 4.5, 1); g.lineTo(hx - 6.5, 0); g.lineTo(hx - 4.5, -1); g.lineTo(hx - 6, -3); g.closePath(); g.fill();
  }
  if (anim === 'eat') {
    g.fillStyle = '#c0392b';
    g.beginPath(); g.ellipse(hx + 7, 0, 3.5, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8d6b0'; g.fillRect(hx + 5.5, -1, 3, 2);
  }
  g.restore();
  // Burbuja de hambre
  if ((st.food ?? 1) < 0.25 && anim !== 'eat') {
    if (anim === 'sad' && Math.floor(time * 2) % 2) { g.fillStyle = 'rgba(120,180,255,0.9)'; g.beginPath(); g.arc(x + 4, y + 2, 1.5, 0, Math.PI * 2); g.fill(); }
    g.font = '12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x + 9, y - 13, 7.5, 0, Math.PI * 2); g.fill();
    g.fillText('🦴', x + 9, y - 12.5);
  }
  if (showName && st.name) {
    const label = `${st.name} · ${lv}★`;
    g.font = '600 9.5px Barlow, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(label).width + 8;
    g.fillStyle = 'rgba(10,14,20,0.6)'; rrect(g, x - w / 2, y + 9, w, 12, 4); g.fill();
    g.fillStyle = lv >= 10 ? '#ffd75a' : '#f3e7d3'; g.fillText(label, x, y + 15.5);
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
