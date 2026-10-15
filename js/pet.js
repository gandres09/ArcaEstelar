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
  // Del Pack de estilos
  { name: 'Plata', body: '#b8c2cc', dark: '#7d8894', ear: '#5f6a76', lock: 'estilos' },
  { name: 'Cósmico', body: '#8a6bd9', dark: '#5a3fa8', ear: '#3fe0c5', lock: 'estilos' },
  { name: 'Colorado', body: '#c8572a', dark: '#8f3a18', ear: '#f2e3c9', lock: 'estilos' },
];
// Especies. unlock: 'free', 'ach:<logro>', 'stage:<n>' o un producto de la tienda.
// pal: colores fijos (si no, usa el color elegido).
const PET_KINDS = [
  { id: 'perro', name: 'Perro', icon: '🐕', unlock: 'free' },
  { id: 'gato', name: 'Gato', icon: '🐈', unlock: 'free' },
  { id: 'conejo', name: 'Conejo', icon: '🐇', unlock: 'ach:steam' },
  { id: 'zorro', name: 'Zorro', icon: '🦊', unlock: 'stage:2', pal: { body: '#d9692a', dark: '#8f3d14', ear: '#2b1a10' } },
  { id: 'robo', name: 'Robo-perro', icon: '🤖', unlock: 'mascotas', pal: { body: '#9aa7b4', dark: '#4d5862', ear: '#3fe0f5' } },
  { id: 'dragon', name: 'Dragoncito', icon: '🐉', unlock: 'mascotas', pal: { body: '#4caf6a', dark: '#2a7042', ear: '#f2c94c' } },
  { id: 'pinguino', name: 'Pingüino espacial', icon: '🐧', unlock: 'mascotas', pal: { body: '#22262e', dark: '#111318', ear: '#f39c32' } },
];
const petKind = (d) => PET_KINDS.find((k) => k.id === (d && d.kind)) || PET_KINDS[0];
const petKindOk = (k) => typeof styleUnlocked !== 'function' || styleUnlocked(k.unlock);
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
  if (!d.kind) d.kind = (typeof styleSel !== 'undefined' && styleSel.mascota) || 'perro';
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
  // Si hay pelea, va a morder; si no, al costado de su dueño
  const tx = d.fight ? d.fight.x : p.x + Math.cos(side) * 1.4, ty = d.fight ? d.fight.y : p.y + Math.sin(side) * 1.4;
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
  p.pet.kind = old && old.kind || 'perro';
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
  const kd = petKind(d);
  box.innerHTML = `<div class="insp-head"><b>${kd.icon} Tu ${kd.name.toLowerCase()} · nivel ${d.level}</b><button type="button" class="close" data-pet="close">✕</button></div>
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
    <div class="pick-title">Especie</div>
    <div class="picker">${PET_KINDS.map((k) => { const lk = !petKindOk(k); return `<button type="button" class="pick pet-col${kd.id === k.id ? ' on' : ''}${lk ? ' locked' : ''}" data-pet="${lk ? 'kindlock' : 'kind'}" data-v="${k.id}" title="${k.name}${lk ? ' (' + unlockText(k.unlock) + ')' : ''}">${lk ? '🔒 ' : k.icon + ' '}${k.name}</button>`; }).join('')}</div>
    ${kd.pal ? '' : `<div class="pick-title">Color</div>
    <div class="picker">${PET_COLORS.map((c, i) => { const lk = c.lock && !owns(c.lock); return `<button type="button" class="pick pet-col${d.color === i ? ' on' : ''}${lk ? ' locked' : ''}" data-pet="${lk ? 'locked' : 'color'}" data-v="${i}" title="${c.name}${lk ? ' (Pack de estilos)' : ''}"><span class="sig-dot" style="background:${c.body}"></span>${lk ? '🔒 ' : ''}${c.name}</button>`; }).join('')}</div>`}`;
}

// Cambia la especie (y la recuerda para las partidas nuevas)
function setPetKind(id) {
  const k = PET_KINDS.find((x) => x.id === id);
  if (!k) return false;
  if (!petKindOk(k)) { toast(`🔒 Se desbloquea con: ${unlockText(k.unlock)}.`); return false; }
  if (typeof styleSel !== 'undefined') { styleSel.mascota = id; try { localStorage.setItem(STYLE_KEY, JSON.stringify(styleSel)); } catch (_) { /* nada */ } }
  const d = S && S.player && S.player.pet;
  if (d && !d.gone) { d.kind = id; d.happyT = 1.5; }
  if (typeof NET !== 'undefined' && NET.on) NET.presAt = 0;
  return true;
}

function initPet() {
  const box = $('pet-panel');
  box.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('[data-pet]');
    if (!b || ev.button !== 0) return;
    const d = S.player && S.player.pet;
    switch (b.dataset.pet) {
      case 'close': ev.preventDefault(); ev.stopPropagation(); box.hidden = true; return;
      case 'adopt': petAdopt(); break;
      case 'feed': petFeed(); break;
      case 'pet': petPet(); break;
      case 'sit': petToggleSit(); break;
      case 'color': if (d) d.color = Math.max(0, Math.min(PET_COLORS.length - 1, +b.dataset.v | 0)); break;
      case 'kind': setPetKind(b.dataset.v); break;
      case 'kindlock': { const k = PET_KINDS.find((x) => x.id === b.dataset.v); if (k) toast(`🔒 ${k.name}: ${unlockText(k.unlock)}.`); break; }
      case 'locked': toast('🔒 Ese color viene con el 🎨 Pack de estilos (🛒 Tienda).'); break;
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
  const kd = petKind(st), K = kd.id;
  const c = kd.pal || PET_COLORS[st.color] || PET_COLORS[0];
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
  // El conejo salta al caminar; el dragoncito flota
  const hop = K === 'conejo' && anim === 'walk' ? Math.abs(Math.sin((st.step || 0) * 0.6)) * 3 : K === 'dragon' && !sitting ? 1.5 + Math.sin(time * 5) * 1 : 0;
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(2 + hop * 0.5, 4 + hop * 0.5, 9 - hop * 0.6, 6 - hop * 0.4, 0, 0, Math.PI * 2); g.fill();
  g.translate(0, -hop);
  g.rotate((st.ang || 0) + (anim === 'spin' ? time * 9 : 0));
  g.lineCap = 'round';
  // Cola
  g.save();
  g.translate(-8, 0); g.rotate(Math.PI + wag);
  if (K === 'gato') { g.strokeStyle = c.dark; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(4, -4, 7, 3, 10, -1); g.stroke(); }
  else if (K === 'zorro') {
    g.fillStyle = c.body; g.beginPath(); g.ellipse(5, 0, 6, 3.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4ede2'; g.beginPath(); g.ellipse(9.5, 0, 2.2, 2.4, 0, 0, Math.PI * 2); g.fill();
  } else if (K === 'conejo') { g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(1, 0, 2.6, 0, Math.PI * 2); g.fill(); }
  else if (K === 'robo') {
    g.strokeStyle = c.dark; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(6, 0); g.stroke();
    g.fillStyle = Math.floor(time * 3) % 2 ? c.ear : '#e74c3c'; g.beginPath(); g.arc(6.5, 0, 1.4, 0, Math.PI * 2); g.fill();
  } else if (K === 'dragon') {
    g.strokeStyle = c.body; g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(5, -3, 9, 1); g.stroke();
    g.fillStyle = c.ear; g.beginPath(); g.moveTo(8, -1); g.lineTo(12, 1.5); g.lineTo(8, 3); g.closePath(); g.fill();
  } else if (K === 'pinguino') { g.fillStyle = c.dark; g.beginPath(); g.moveTo(0, -2); g.lineTo(3.5, 0); g.lineTo(0, 2); g.closePath(); g.fill(); }
  else { g.strokeStyle = c.dark; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(4, -2, 7, 1); g.stroke(); }
  g.restore();
  // Alas del dragoncito (aletean)
  if (K === 'dragon') {
    const f = sitting ? 0.3 : 0.6 + Math.sin(time * 14) * 0.5;
    g.fillStyle = 'rgba(42,112,66,0.85)';
    for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(2, sgn * 3); g.lineTo(-3, sgn * (6 + 6 * f)); g.lineTo(-6, sgn * (4 + 3 * f)); g.lineTo(-4, sgn * 3); g.closePath(); g.fill(); }
  }
  // Patas
  if (!sitting) {
    const s = anim === 'walk' ? Math.sin(st.step || 0) * 2.5 : 0;
    g.fillStyle = K === 'pinguino' ? c.ear : c.dark;
    const legs = K === 'pinguino' ? [[3, -2.5, 1], [3, 2.5, -1]] : [[5, -4, 1], [5, 4, -1], [-5, -4, -1], [-5, 4, 1]];
    for (const [lx, ly, k] of legs) { g.beginPath(); g.ellipse(lx + s * k, ly * 1.15, 2, 1.6, 0, 0, Math.PI * 2); g.fill(); }
  }
  // Cuerpo
  g.fillStyle = c.body;
  g.beginPath();
  if (K === 'robo') rrect(g, sitting ? -8 : -8.5, -5, sitting ? 13 : 17, 10, 3);
  else if (K === 'pinguino') g.ellipse(-1, 0, 7, 5.6, 0, 0, Math.PI * 2);
  else g.ellipse(sitting ? -2 : 0, 0, sitting ? 6.5 : 8.5, K === 'gato' ? 4.6 : 5.2, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.stroke();
  if (K === 'robo') { g.fillStyle = c.dark; for (const bx of [-5, -1.5]) g.fillRect(bx, -3.6, 2, 7.2); }
  if (K === 'pinguino') {   // aletas
    g.fillStyle = c.dark;
    const fl = anim === 'walk' || anim === 'happy' ? Math.sin(time * 14) * 0.4 : 0;
    for (const sgn of [-1, 1]) { g.save(); g.translate(0, sgn * 5); g.rotate(sgn * (0.3 + fl)); g.beginPath(); g.ellipse(-2.5, 0, 4, 1.4, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  }
  if (K === 'dragon') { g.fillStyle = c.ear; for (const sx of [-5, -2, 1]) { g.beginPath(); g.moveTo(sx - 1.3, 0); g.lineTo(sx, -1.6); g.lineTo(sx + 1.3, 0); g.lineTo(sx, 1.6); g.closePath(); g.fill(); } }
  // Accesorios según el nivel: collar (2), medallita (4), pañuelo (6)
  const lv = st.level || 1;
  if (lv >= 6) { g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(4, -4.6); g.lineTo(4, 4.6); g.lineTo(0.5, 0); g.closePath(); g.fill(); }
  else if (lv >= 2) { g.fillStyle = '#d64545'; g.fillRect(3.4, -4, 1.6, 8); }
  if (lv >= 4) { g.fillStyle = '#f0c040'; g.beginPath(); g.arc(4.6, 0, 1.4, 0, Math.PI * 2); g.fill(); }
  // Cabeza (si come, baja la cabeza)
  const hx = anim === 'eat' ? 10 + Math.sin(time * 18) * 0.8 : 8;
  // Orejas que van debajo de la cabeza
  if (K === 'gato' || K === 'zorro') {
    const big = K === 'zorro' ? 1.35 : 1;
    g.fillStyle = c.body;
    for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(hx - 2.5, sgn * 2.4); g.lineTo(hx - 3.2 * big, sgn * 6.4 * big); g.lineTo(hx + 1, sgn * 4); g.closePath(); g.fill(); }
    g.fillStyle = c.ear;
    for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(hx - 2.2, sgn * 3.4); g.lineTo(hx - 2.9 * big, sgn * 5.6 * big); g.lineTo(hx - 0.2, sgn * 4.2); g.closePath(); g.fill(); }
  }
  g.fillStyle = c.body;
  g.beginPath();
  if (K === 'robo') rrect(g, hx - 4.5, -4.3, 9, 8.6, 2.5);
  else g.arc(hx, 0, K === 'gato' || K === 'conejo' ? 4.1 : 4.6, 0, Math.PI * 2);
  g.fill(); g.stroke();
  if (K === 'pinguino') { g.fillStyle = '#f4f6f8'; g.beginPath(); g.ellipse(hx + 1.6, 0, 2.6, 3.4, 0, 0, Math.PI * 2); g.fill(); }
  if (K === 'zorro') { g.fillStyle = '#f4ede2'; g.beginPath(); g.ellipse(hx + 2.2, 0, 2.4, 3, 0, 0, Math.PI * 2); g.fill(); }
  // Orejas, hocico y extras de cada especie
  if (K === 'perro') {
    g.fillStyle = c.ear;
    g.beginPath(); g.ellipse(hx - 1.5, -4.2, 2.6, 1.6, -0.5, 0, Math.PI * 2); g.ellipse(hx - 1.5, 4.2, 2.6, 1.6, 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.dark; g.beginPath(); g.ellipse(hx + 3.6, 0, 2.2, 1.9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(hx + 5.2, 0, 1.1, 0, Math.PI * 2); g.fill();
  } else if (K === 'gato') {
    g.fillStyle = '#e88a9a'; g.beginPath(); g.arc(hx + 3.6, 0, 0.9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.5;
    g.beginPath(); for (const sgn of [-1, 1]) for (const dy of [0.4, 1.4]) { g.moveTo(hx + 3, sgn * 1); g.lineTo(hx + 6.5, sgn * (1.5 + dy * 1.6)); } g.stroke();
  } else if (K === 'zorro') {
    g.fillStyle = c.body; g.beginPath(); g.moveTo(hx + 2.5, -2.2); g.lineTo(hx + 7, 0); g.lineTo(hx + 2.5, 2.2); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(hx + 6.8, 0, 0.9, 0, Math.PI * 2); g.fill();
  } else if (K === 'conejo') {
    const fl = sitting ? 0.25 : 0.12 + Math.sin(time * 3) * 0.05;
    for (const sgn of [-1, 1]) {
      g.save(); g.translate(hx - 1.5, sgn * 1.6); g.rotate(Math.PI + sgn * fl);
      g.fillStyle = c.body; g.beginPath(); g.ellipse(4.5, 0, 5, 1.7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#f2b8c4'; g.beginPath(); g.ellipse(4.5, 0, 3.6, 0.8, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.fillStyle = '#e88a9a'; g.beginPath(); g.arc(hx + 3.8, 0, 0.9, 0, Math.PI * 2); g.fill();
  } else if (K === 'robo') {
    g.strokeStyle = c.dark; g.lineWidth = 1; g.beginPath(); g.moveTo(hx - 2, 0); g.lineTo(hx - 5.5, -3); g.stroke();
    g.fillStyle = c.ear; g.beginPath(); g.arc(hx - 5.5, -3, 1.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.dark; g.fillRect(hx - 2.4, -5.2, 2.6, 1.6); g.fillRect(hx - 2.4, 3.6, 2.6, 1.6);
  } else if (K === 'dragon') {
    g.fillStyle = c.ear;
    for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(hx - 2, sgn * 2); g.lineTo(hx - 6, sgn * 4.5); g.lineTo(hx - 1, sgn * 3.6); g.closePath(); g.fill(); }
    g.fillStyle = c.dark; g.beginPath(); g.ellipse(hx + 3.8, 0, 2.4, 2.4, 0, 0, Math.PI * 2); g.fill();
    if (anim === 'happy' && Math.floor(time * 4) % 2) { g.fillStyle = 'rgba(255,150,40,0.85)'; g.beginPath(); g.moveTo(hx + 5.5, 0); g.lineTo(hx + 11, -2.5); g.lineTo(hx + 10, 0); g.lineTo(hx + 11, 2.5); g.closePath(); g.fill(); }
  } else if (K === 'pinguino') {
    g.fillStyle = c.ear; g.beginPath(); g.moveTo(hx + 3.6, -1.3); g.lineTo(hx + 6.8, 0); g.lineTo(hx + 3.6, 1.3); g.closePath(); g.fill();
    // Casco espacial
    g.strokeStyle = 'rgba(170,220,255,0.75)'; g.lineWidth = 0.9; g.beginPath(); g.arc(hx, 0, 6, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(170,220,255,0.12)'; g.fill();
  }
  // Ojos (tristes: cerraditos)
  const eye = K === 'robo' ? c.ear : K === 'gato' ? '#9be35a' : '#111';
  if (anim === 'sad') { g.strokeStyle = eye; g.lineWidth = 0.8; g.beginPath(); g.moveTo(hx + 1, -2.4); g.lineTo(hx + 2.2, -1.4); g.moveTo(hx + 1, 2.4); g.lineTo(hx + 2.2, 1.4); g.stroke(); }
  else if (K === 'robo') { g.fillStyle = eye; g.fillRect(hx + 1.6, -2.8, 1.6, 5.6); }
  else { g.fillStyle = eye; g.beginPath(); g.arc(hx + 1.6, -1.8, 0.8, 0, Math.PI * 2); g.arc(hx + 1.6, 1.8, 0.8, 0, Math.PI * 2); g.fill(); }
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
