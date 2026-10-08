'use strict';
// =====================================================================
//  Bases separadas (como Age of Empires): cada jugador tiene su Nave, su
//  inventario y su investigación. Los equipos dicen quién es aliado y
//  quién enemigo; los enemigos se pueden atacar.
//
//  El juego usa S.inv, S.techs, S.research, S.inf y S.delivered en todos
//  lados: esos campos apuntan siempre a los de la facción "actual". La
//  simulación cambia de facción según de quién es cada edificio, y fuera
//  de la simulación la actual es la del jugador de esta compu.
// =====================================================================

const FACTION_KEYS = ['inv', 'techs', 'research', 'inf', 'delivered'];
const BASE_DIST = 250;                        // distancia entre bases
const TEAM_COLORS = ['#ffb347', '#5aa0ff', '#e5534b', '#5cc47a', '#b45fe0', '#f0d44d'];
let curF = 'f0';

const multiBase = () => !!(S && S.multiBase);
const fOf = (e) => (e && e.f) || 'f0';

function ensureFactions() {
  if (!S.factions) {
    S.factions = { f0: { inv: S.inv || {}, techs: S.techs || {}, research: S.research || { current: null, progress: 0 }, inf: S.inf || {}, delivered: S.delivered || {}, team: 1, name: null } };
  }
  S.factionOf = S.factionOf || {};
  for (const f in S.factions) { const F = S.factions[f]; for (const k of FACTION_KEYS) if (!F[k]) F[k] = k === 'research' ? { current: null, progress: 0 } : {}; }
  curF = null;
  useFaction(myF() || 'f0');
}

// La facción del jugador de esta compu (null: todavía no eligió base en un mundo ajeno)
function myF() {
  if (!S || !S.factions || !multiBase()) return 'f0';
  if (typeof NET !== 'undefined' && NET.on && NET.uid) {
    if (S.factionOf[NET.uid]) return S.factionOf[NET.uid];
    if (netInMyWorld()) { S.factionOf[NET.uid] = 'f0'; return 'f0'; }   // el dueño del mundo es la primera base
    return null;
  }
  return 'f0';
}

function useFaction(f) {
  if (!S || !S.factions) return;
  if (!f || !S.factions[f]) f = 'f0';
  if (curF === f && S.inv === S.factions[f].inv) return;
  const F = S.factions[f];
  for (const k of FACTION_KEYS) S[k] = F[k];
  curF = f;
}
const useMine = () => useFaction(myF() || 'f0');
// Hace algo en nombre de otra facción y vuelve a la que estaba
function asFaction(f, fn) {
  const prev = curF;
  useFaction(f);
  try { return fn(); } finally { useFaction(prev); }
}

const factionInv = (e) => (S.factions && S.factions[fOf(e)] ? S.factions[fOf(e)].inv : S.inv);
const teamOf = (f) => (S.factions && S.factions[f] ? S.factions[f].team : 1);
const isFoeF = (a, b) => multiBase() && a && b && a !== b && teamOf(a) !== teamOf(b);
const isFoeE = (e) => multiBase() && isPlayer(e) && isFoeF(myF(), fOf(e));
const hubOf = (f) => S.entities.find((e) => (e.type === 'hub' || e.type === 'lander') && fOf(e) === f);
const teamColor = (f) => TEAM_COLORS[(teamOf(f) - 1) % TEAM_COLORS.length];
const factionName = (f) => (S.factions[f] && S.factions[f].name) || (f === 'f0' ? 'Anfitrión' : 'Jugador ' + f.slice(1));

// --------------------------- Bases nuevas ---------------------------

// Una mena de inicio con su propio azar (sale igual cada vez que se carga el mapa)
function basePatch(px, py, rad, id, rich, i) {
  const rnd = mulberry32(((S.seed ^ 0x51a7e) + i * 104729) >>> 0);
  for (let y = Math.floor(py - rad - 2); y <= py + rad + 2; y++) for (let x = Math.floor(px - rad - 2); x <= px + rad + 2; x++) {
    const d = Math.hypot(x - px, (y - py) * (id === 8 ? 1.2 : 1));
    if (d >= rad + (rnd() - 0.5) * 2) continue;
    const k = tIdx(x, y);
    oreType[k] = id;
    if (id === 8) { oreAmt[k] = 65000; continue; }
    const t = Math.max(0, 1 - d / (rad + 0.5)), peak = Math.max(2600, rich * 1.6);
    oreAmt[k] = Math.min(65000, Math.round(3 * (500 + (peak - 500) * Math.pow(t, 1.3)) * (0.9 + rnd() * 0.2)));
  }
}
function applyBasePatches() {
  if (!S || !Array.isArray(S.basePatches) || offEarth()) return;
  S.basePatches.forEach(([px, py, r, id, rich], i) => basePatch(px, py, r, id, rich, i));
}

// Dónde va la base nueva: a ~250 casillas de las demás, en un lugar libre
function newBaseSpot(n) {
  const hubs = S.entities.filter((e) => e.type === 'hub');
  const c = hubs[0] ? { x: hubs[0].x + 1, y: hubs[0].y + 1 } : { x: W >> 1, y: H >> 1 };
  const rnd = mulberry32((S.seed ^ 0xba5e + n * 31) >>> 0);
  const a0 = rnd() * Math.PI * 2;
  for (let t = 0; t < 400; t++) {
    const a = a0 + t * 2.39996, d = BASE_DIST + (t % 7) * 12;
    const x = Math.round(wrapX(c.x + Math.cos(a) * d)), y = Math.round(wrapY(c.y + Math.sin(a) * d * 0.8));
    if (hubs.some((h) => wdist(h.x, h.y, x, y) < BASE_DIST * 0.8)) continue;
    let ok = true;
    for (let dy = -12; dy <= 12 && ok; dy++) for (let dx = -12; dx <= 12 && ok; dx++) {
      const o = oreAt(x + dx, y + dy);
      if (isLiquidO(o) || at(x + dx, y + dy) || cliffAt(x + dx, y + dy)) ok = false;
    }
    if (ok) return { x, y };
  }
  return { x: Math.round(wrapX(c.x + BASE_DIST)), y: c.y };
}

// Crea la facción y la base de un jugador que entra al mundo
function createFaction(uid, team, name) {
  ensureFactions();
  if (uid && S.factionOf[uid]) return S.factionOf[uid];
  const n = Object.keys(S.factions).length;
  const fid = 'f' + n;
  S.factions[fid] = { inv: {}, techs: {}, research: { current: null, progress: 0 }, inf: {}, delivered: {}, team: team || n + 1, name: name || null };
  if (uid) S.factionOf[uid] = fid;
  const p = newBaseSpot(n);
  // Menas de inicio alrededor, y un lago chico para el vapor
  S.basePatches = S.basePatches || [];
  const start = [[1, 5.5, 420], [2, 5.5, 380], [3, 4.5, 380], [4, 4.5, 320], [1, 3.5, 380], [8, 4.5, 0]];
  start.forEach(([id, r, rich], i) => {
    const a = i * (Math.PI * 2 / start.length) + n, d = id === 8 ? 26 : 16 + (i % 2) * 6;
    const q = [Math.round(wrapX(p.x + Math.cos(a) * d)), Math.round(wrapY(p.y + Math.sin(a) * d * 0.8)), r, id, rich];
    S.basePatches.push(q);
    basePatch(q[0], q[1], r, id, rich, S.basePatches.length - 1);
    for (let y = q[1] - r - 2; y <= q[1] + r + 2; y++) for (let x = q[0] - r - 2; x <= q[0] + r + 2; x++) { oreBase[tIdx(x, y)] = oreAmt[tIdx(x, y)]; oreTypeBase[tIdx(x, y)] = oreType[tIdx(x, y)]; }
  });
  // La zona de la Nave, despejada; sin nidos ni gusanos cerca
  for (let y = p.y - 5; y <= p.y + 5; y++) for (let x = p.x - 5; x <= p.x + 5; x++) { const k = tIdx(x, y); oreType[k] = 0; oreAmt[k] = 0; oreBase[k] = 0; oreTypeBase[k] = 0; }
  for (const e of S.entities.slice()) if (isEnemyB(e) && wdist(e.x, e.y, p.x, p.y) < 60) removeNest(e, true);
  const hub = makeEntity('hub', p.x - 1, p.y - 1);
  hub.id = S.nextId++; hub.f = fid;
  S.entities.push(hub); occupy(hub, hub);
  const box = makeEntity('woodchest', p.x + 2, p.y + 1, 1);
  box.id = S.nextId++; box.f = fid;
  S.entities.push(box); occupy(box, box);
  reveal(p.x, p.y, 52);
  resetMapGraphics(); treeCache.clear(); computeForest();
  powerDirty = true;
  return fid;
}

// --------------------------- Elegir equipo al entrar ---------------------------

let teamAsked = false;
function checkNeedBase() {
  if (!multiBase() || !S.character || !NET.on || myF() || teamAsked) return;
  teamAsked = true;
  const host = factionName('f0');
  const box = document.createElement('div');
  box.id = 'team-pick';
  box.className = 'modal';
  box.innerHTML = `<div class="modal-box panel"><h1>🏳️ Tu base</h1>
    <p>En este mundo cada jugador tiene su propia Nave, su inventario y su investigación. Tu base aparece a unas ${BASE_DIST} casillas de las demás.</p>
    <div class="actions" style="flex-direction:column;align-items:stretch">
      <button type="button" class="primary" data-team="ally">🤝 Aliado de ${escapeHtml(host)}: no se pueden atacar y se pueden mandar cosas</button>
      <button type="button" data-team="enemy">⚔️ Enemigo: vale todo (torretas, armas y robots contra el otro)</button>
    </div></div>`;
  document.body.appendChild(box);
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-team]');
    if (!b) return;
    const maxTeam = Math.max(...Object.values(S.factions).map((F) => F.team || 1));
    const team = b.dataset.team === 'ally' ? teamOf('f0') : maxTeam + 1;
    box.remove();
    joinWithBase(team);
  });
}
function joinWithBase(team) {
  const nick = NET.nick || null;
  const fid = createFaction(NET.uid, team, nick);
  netPush({ k: 'nf', u: NET.uid, t: team, n: nick });
  goToMyBase();
  toast(`🏳️ ¡Tu base está lista! ${team === teamOf('f0') ? 'Sos aliado.' : 'Sos enemigo: cuidá tu base.'}`);
  return fid;
}
function goToMyBase() {
  useMine();
  const h = hubOf(myF());
  if (!h || !S.player) return;
  S.player.x = h.x + 1.5; S.player.y = h.y + 4.5; S.player.path = null;
  if (S.player.pet && !S.player.pet.gone) { S.player.pet.x = S.player.x - 1; S.player.pet.y = S.player.y; }
  view.x = S.player.x * TILE; view.y = S.player.y * TILE;
  if (typeof unstick === 'function') unstick(S.player);
}

// --------------------------- Mandar cosas a un aliado ---------------------------

function giftTo(to, k, n) {
  n = Math.min(n, Math.floor(S.inv[k] || 0));
  if (n <= 0 || !S.factions[to] || isFoeF(myF(), to)) return 0;
  S.inv[k] -= n;
  add(S.factions[to].inv, k, n);
  netPush({ k: 'gift', to, i: k, n });
  return n;
}

function alliesPanelHtml() {
  if (!multiBase()) return '';
  const me = myF();
  let h = `<div class="pick-title">🏳️ Jugadores</div>`;
  for (const f in S.factions) {
    const F = S.factions[f];
    const rel = f === me ? 'vos' : isFoeF(me, f) ? '<span class="bad">enemigo</span>' : '<span class="ok">aliado</span>';
    h += `<div class="row"><span><span class="sig-dot" style="background:${teamColor(f)}"></span> ${escapeHtml(factionName(f))} (equipo ${F.team})</span><span>${rel}</span></div>`;
  }
  const allies = Object.keys(S.factions).filter((f) => f !== me && !isFoeF(me, f));
  if (allies.length) {
    const items = ITEM_ORDER.filter((k) => (S.inv[k] || 0) >= 1 && !FLUIDS.has(k)).slice(0, 24);
    h += `<div class="pick-title small">Mandar a ${escapeHtml(factionName(allies[0]))} (50 por toque)</div><div class="picker">` +
      items.map((k) => `<button type="button" class="pick" data-act="gift" data-v="${allies[0]}|${k}" title="${ITEMS[k].name}">${itemImg(k)}</button>`).join('') + '</div>';
  }
  return h;
}
