'use strict';
// =====================================================================
//  Marcadores en el mapa: pines con nombre que ven todos los jugadores,
//  y un "¡vengan acá!" para llamar a los amigos.
// =====================================================================

const MARKER_ICONS = ['📍', '⛏️', '💎', '⚔️', '🏠', '⚠️', '🌲', '⭐'];
const PING_TIME = 60;   // segundos que dura un llamado
let markMode = false;

function ensureMarkers() { if (!S.markers) S.markers = []; }

// Nombre automático según lo que hay en ese lugar
function markerAutoName(x, y) {
  const o = oreAt(x, y);
  if (o === 'water') return 'Lago';
  if (o === 'lava') return 'Lava';
  if (o === 'oil') return 'Petróleo';
  if (o) return ITEMS[o].name.replace('Mineral de ', '');
  const e = at(x, y);
  if (e && e.type === 'nest') return 'Nido';
  if (e && e.type === 'worm') return 'Gusano';
  if (S.lairs) for (const l of S.lairs) if (wdist(l.x, l.y, x, y) < 6) return 'Guarida';
  if (S.ruins) for (const r of S.ruins) if (wdist(r.x, r.y, x, y) < 5) return 'Ruinas';
  return 'Lugar ' + ((S.markers || []).filter((m) => !m.ping).length + 1);
}
function markerAutoIcon(x, y) {
  const o = oreAt(x, y);
  if (o === 'quartz' || o === 'titanium_ore' || o === 'oil') return '💎';
  if (o && !isLiquidO(o)) return '⛏️';
  const e = at(x, y);
  if (isEnemyB(e) || (S.lairs || []).some((l) => wdist(l.x, l.y, x, y) < 6)) return '⚔️';
  return '📍';
}

function addMarker(x, y, extra = {}) {
  ensureMarkers();
  const m = { id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), x: wrapX(x), y: wrapY(y),
    name: markerAutoName(Math.floor(x), Math.floor(y)), icon: markerAutoIcon(Math.floor(x), Math.floor(y)), by: NET.nick || null, ...extra };
  S.markers.push(m);
  netPush({ k: 'mk', m });
  renderMarkerList();
  return m;
}
function updateMarker(m) { netPush({ k: 'mk', m }); renderMarkerList(); }
function removeMarker(id) {
  ensureMarkers();
  S.markers = S.markers.filter((m) => m.id !== id);
  netPush({ k: 'mkx', id });
  renderMarkerList();
}
// Lo que llega de otro jugador
function netMarker(m) {
  ensureMarkers();
  if (!m || typeof m.id !== 'string' || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
  m.name = String(m.name || '').slice(0, 24);
  if (!MARKER_ICONS.includes(m.icon) && m.icon !== '📣') m.icon = '📍';
  const i = S.markers.findIndex((k) => k.id === m.id);
  if (i >= 0) S.markers[i] = m;
  else {
    S.markers.push(m);
    if (m.ping) { toast(`📣 <b>${escapeHtml(m.by || 'Un amigo')}</b> te llama: ¡andá para allá! (mirá la flecha)`); sfx('alarm'); }
  }
  renderMarkerList();
}

function startMarkMode() {
  markMode = !markMode;
  $('btn-mark').classList.toggle('on', markMode);
  if (markMode) toast('📍 Tocá un lugar del mapa o del minimapa para marcarlo.');
}
function placeMarkerAtTile(t) {
  markMode = false;
  $('btn-mark').classList.remove('on');
  const m = addMarker(t.x + 0.5, t.y + 0.5);
  toast(`${m.icon} Marcaste <b>${escapeHtml(m.name)}</b>. Cambiale el nombre en la lista del mapa.`);
  sfx('place');
  document.body.classList.add('side-open');
  setTimeout(() => { const el = document.querySelector(`#marker-list [data-mname="${m.id}"]`); if (el && !isTouch()) el.focus(); }, 50);
}
function pingFriends() {
  if (!playerOn()) return;
  ensureMarkers();
  // Un solo llamado tuyo a la vez
  for (const m of S.markers.filter((k) => k.ping && k.by === (NET.nick || null))) removeMarker(m.id);
  addMarker(S.player.x, S.player.y, { ping: true, icon: '📣', name: `¡Vengan! (${NET.nick || 'yo'})`, until: S.playTime + PING_TIME });
  if (NET.on) chatSend('📣 ¡Vengan acá!');
  toast(NET.on ? '📣 Les avisaste a tus amigos dónde estás.' : '📣 Marcaste dónde estás (cuando juegues con amigos, les llega el aviso).');
}
function goToMarker(m) {
  if (playerOn()) {
    const v = myVehicle();
    if (v) v.target = { x: m.x, y: m.y };
    else { stopPlayerTasks(); walkTo(Math.floor(m.x), Math.floor(m.y), 1); }
    followCam = true;
  } else { view.x = m.x * TILE; view.y = m.y * TILE; clampView(); }
}

// Los llamados vencen solos
function updateMarkers() {
  if (!S.markers) return;
  const before = S.markers.length;
  S.markers = S.markers.filter((m) => !m.ping || (m.until || 0) > S.playTime);
  if (S.markers.length !== before) renderMarkerList();
}

// --------------------------- Lista en el panel del mapa ---------------------------

let markerListKey = '';
function renderMarkerList(force) {
  const box = $('marker-list');
  if (!box) return;
  ensureMarkers();
  const p = playerOn() ? S.player : { x: view.x / TILE, y: view.y / TILE };
  const list = [...S.markers].sort((a, b) => wdist(p.x, p.y, a.x, a.y) - wdist(p.x, p.y, b.x, b.y));
  const key = list.map((m) => m.id + m.name + m.icon + Math.round(wdist(p.x, p.y, m.x, m.y) / 5)).join('|');
  if (!force && key === markerListKey) return;
  if (box.contains(document.activeElement)) return;   // no pisar lo que estás escribiendo
  markerListKey = key;
  box.innerHTML = list.length ? list.map((m) => `<div class="mk-row${m.ping ? ' ping' : ''}">` +
    `<button type="button" class="mk-icon" data-micon="${m.id}" title="Cambiar el ícono">${m.icon}</button>` +
    (m.ping ? `<span class="mk-name">${escapeHtml(m.name)}</span>` : `<input class="mk-name" data-mname="${m.id}" value="${escapeHtml(m.name)}" maxlength="24" aria-label="Nombre">`) +
    `<span class="muted small">${Math.round(wdist(p.x, p.y, m.x, m.y))}</span>` +
    `<button type="button" class="small-btn" data-mgo="${m.id}" title="Ir hasta ahí">${playerOn() ? '🚶' : '🎯'}</button>` +
    `<button type="button" class="small-btn" data-mdel="${m.id}" title="Borrar">✕</button></div>`).join('')
    : '<p class="muted small">Sin marcadores. Tocá 📍 Marcar y después un lugar del mapa.</p>';
}

function initMarkers() {
  $('btn-mark').addEventListener('click', startMarkMode);
  $('btn-ping').addEventListener('click', pingFriends);
  const box = $('marker-list');
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const m = (S.markers || []).find((k) => k.id === (b.dataset.mgo || b.dataset.mdel || b.dataset.micon));
    if (!m) return;
    if (b.dataset.mgo) goToMarker(m);
    if (b.dataset.mdel) removeMarker(m.id);
    if (b.dataset.micon && !m.ping) { m.icon = MARKER_ICONS[(MARKER_ICONS.indexOf(m.icon) + 1) % MARKER_ICONS.length]; updateMarker(m); renderMarkerList(true); }
  });
  box.addEventListener('change', (ev) => {
    const id = ev.target.dataset.mname;
    const m = id && (S.markers || []).find((k) => k.id === id);
    if (!m) return;
    m.name = ev.target.value.replace(/\s+/g, ' ').trim().slice(0, 24) || m.name;
    updateMarker(m);
  });
  box.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.target.blur(); ev.stopPropagation(); });
  setInterval(() => { updateMarkers(); renderMarkerList(); }, 1000);
}

// --------------------------- Dibujo ---------------------------

// En el mapa: un pin con su nombre (siempre del mismo tamaño en pantalla)
function drawMarkers(g) {
  if (!S.markers || !S.markers.length) return;
  const k = 1 / view.zoom;
  for (const m of S.markers) {
    const x = (view.x / TILE + wdx(m.x - view.x / TILE)) * TILE, y = (view.y / TILE + wdy(m.y - view.y / TILE)) * TILE;
    g.save(); g.translate(x, y); g.scale(k, k);
    const bob = m.ping ? Math.sin(time * 6) * 3 : 0;
    if (m.ping) { g.strokeStyle = `rgba(255,211,77,${0.6 - ((time * 0.8) % 1) * 0.6})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 10 + ((time * 0.8) % 1) * 30, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 2, 7, 3, 0, 0, 7); g.fill();
    // Globito con el ícono, y un palito que marca el lugar exacto
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -10 + bob); g.stroke();
    g.fillStyle = m.ping ? 'rgba(255,211,77,0.95)' : 'rgba(240,244,248,0.95)'; g.beginPath(); g.arc(0, -22 + bob, 13, 0, 7); g.fill();
    g.font = '17px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(m.icon, 0, -21 + bob);
    g.font = '700 12px Barlow, system-ui, sans-serif'; g.textBaseline = 'middle';
    const tw = g.measureText(m.name).width;
    g.fillStyle = 'rgba(15,18,22,0.8)'; rrect(g, -tw / 2 - 5, -52 + bob, tw + 10, 16, 6); g.fill();
    g.fillStyle = m.ping ? '#ffd34d' : '#fff'; g.fillText(m.name, 0, -44 + bob);
    g.restore();
  }
}

// En el minimapa
function drawMarkersMini(g, v, inside) {
  if (!S.markers) return;
  g.font = '15px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const m of S.markers) {
    let x = v.px(m.x), y = v.py(m.y);
    if (!inside(x, y, -8)) { if (!m.ping) continue; x = Math.max(8, Math.min(g.canvas.width - 8, x)); y = Math.max(8, Math.min(g.canvas.height - 8, y)); }
    g.fillText(m.icon, x, y - 6);
  }
}
