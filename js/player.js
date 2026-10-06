'use strict';
// =====================================================================
//  Personaje: movimiento, mochila, alcance, extracción y fabricación a mano
// =====================================================================

const PLAYER_SPEED = 6.5;   // casillas por segundo
const REACH = 10;           // alcance para construir e interactuar
const MINE_REACH = 2.6;     // alcance para extraer a mano
const STORAGE_REACH = 10;   // distancia al Núcleo para usar lo que tiene guardado
const PLAYER_RADIUS = 0.28;
const REVEAL_RADIUS = 18;

const playerOn = () => !!(S && S.character && S.player);

// --------------------------- Inventarios ---------------------------

// Mientras está activo, los costos salen del Núcleo (robots, bot, modo clásico)
let forceHub = false;
function withNucleo(fn) {
  const prev = forceHub;
  forceHub = true;
  try { return fn(); } finally { forceHub = prev; }
}
const usePocket = () => playerOn() && !forceHub;

// ¿El personaje está cerca del Núcleo (o de un receptor, con la red logística)?
function nearStorage() {
  if (!usePocket()) return true;
  const p = S.player;
  const hub = S.entities.find((e) => e.type === 'hub');
  if (hub && wdist(p.x, p.y, hub.x + 1.5, hub.y + 1.5) <= STORAGE_REACH) return true;
  if (S.techs.logistic_network) {
    for (const e of S.entities) if (e.type === 'receiver' && wdist(p.x, p.y, e.x + 0.5, e.y + 0.5) <= 4) return true;
  }
  return false;
}

function avail(k) {
  if (!usePocket()) return S.inv[k] || 0;
  return (S.pinv[k] || 0) + (nearStorage() ? (S.inv[k] || 0) : 0);
}

function takeItem(k, n = 1) {
  if (!usePocket()) { S.inv[k] = (S.inv[k] || 0) - n; return; }
  const fromPocket = Math.min(n, S.pinv[k] || 0);
  S.pinv[k] = (S.pinv[k] || 0) - fromPocket;
  if (S.pinv[k] <= 0) delete S.pinv[k];
  if (n > fromPocket) S.inv[k] = (S.inv[k] || 0) - (n - fromPocket);
}

function giveItem(k, n = 1) {
  if (!k || n <= 0) return;
  if (usePocket()) add(S.pinv, k, n); else add(S.inv, k, n);
}

// --------------------------- Movimiento ---------------------------

const PASSABLE = new Set(['belt', 'fastbelt', 'expressbelt', 'rail', 'station']);
function walkable(x, y) {
  if (oreAt(x, y) === 'water') return false;
  const e = at(x, y);
  return !e || PASSABLE.has(e.type);
}

function canStand(x, y) {
  const r = PLAYER_RADIUS;
  return walkable(Math.floor(x - r), Math.floor(y - r)) && walkable(Math.floor(x + r), Math.floor(y - r)) &&
    walkable(Math.floor(x - r), Math.floor(y + r)) && walkable(Math.floor(x + r), Math.floor(y + r));
}

function inReach(x, y, r = REACH) {
  if (!playerOn()) return true;
  const p = S.player;
  return wdist(p.x, p.y, x + 0.5, y + 0.5) <= r;
}

function newPlayer(x, y) {
  return { x, y, ang: Math.PI / 2, moving: false, step: 0, path: null, mine: null, mineT: 0, queue: [], craft: [], stuck: 0 };
}

// Si quedó encerrado (por ejemplo, construyó encima suyo), lo saca a la casilla libre más cercana
function unstick(p) {
  if (canStand(p.x, p.y)) return;
  for (let r = 1; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.floor(p.x) + dx + 0.5, y = Math.floor(p.y) + dy + 0.5;
      if (canStand(x, y)) { p.x = x; p.y = y; return; }
    }
  }
}

// Camino a pie (A*), hasta quedar a `near` casillas del destino
function walkPath(sx, sy, tx, ty, near = 0.6, maxNodes = 8000) {
  const idx = (x, y) => tIdx(x, y);
  sx = wrapX(sx); sy = wrapY(sy); tx = wrapX(tx); ty = wrapY(ty);
  const heap = [];
  const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
  const g = new Map(), from = new Map();
  const start = idx(sx, sy);
  g.set(start, 0);
  push(start, 0);
  let n = 0;
  while (heap.length && n++ < maxNodes) {
    const cur = pop();
    const cx = cur % W, cy = (cur / W) | 0;
    if (wdist(cx, cy, tx, ty) <= near) {
      const path = [];
      let k = cur;
      while (k !== start) { path.push({ x: k % W + 0.5, y: ((k / W) | 0) + 0.5 }); k = from.get(k); }
      return path.reverse();
    }
    const gc = g.get(cur);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = wrapX(cx + dx), y = wrapY(cy + dy);
      if (!walkable(x, y)) continue;
      if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      const ni = idx(x, y), ng = gc + (dx && dy ? 1.41 : 1);
      if (ng < (g.get(ni) ?? Infinity)) { g.set(ni, ng); from.set(ni, cur); push(ni, ng + wdist(x, y, tx, ty)); }
    }
  }
  return null;
}

function walkTo(tx, ty, near = 0.6) {
  const p = S.player;
  const path = walkPath(Math.floor(p.x), Math.floor(p.y), tx, ty, near);
  p.path = path && path.length ? path : null;
  if (!path) toast('No hay camino hasta ahí.');
  return !!path;
}

// Movimiento con choque (se desliza por las paredes)
function moveBy(p, dx, dy) {
  if (dx && canStand(p.x + dx, p.y)) p.x += dx;
  if (dy && canStand(p.x, p.y + dy)) p.y += dy;
}

// --------------------------- Acciones del jugador ---------------------------

// Construir: si está cerca se hace ya; si no, va a la cola y el personaje camina hasta ahí
function userPlace(type, x, y, dir, extra) {
  if (!playerOn()) return place(type, x, y, dir);
  const s = sizeOf(type);
  if (!S.player.queue.length && inReach(x + (s - 1) / 2, y + (s - 1) / 2)) return place(type, x, y, dir);
  const res = canPlace(type, x, y);
  if (!res.ok && res.why !== 'Faltan materiales') return null;
  S.player.queue.push({ kind: 'place', type, x: wrapX(x), y: wrapY(y), dir, extra: extra || null });
  return { queued: true };
}

function userRemove(e) {
  if (!e) return false;
  if (!playerOn() || (!S.player.queue.length && inReach(e.x, e.y))) return removeEntity(e);
  S.player.queue.push({ kind: 'remove', id: e.id, x: e.x, y: e.y });
  return true;
}

function processQueue() {
  const p = S.player;
  if (!p.queue.length) return;
  let warned = false;
  for (let i = 0; i < p.queue.length; i++) {
    const q = p.queue[i];
    if (!inReach(q.x, q.y)) continue;
    if (q.kind === 'place') {
      const res = canPlace(q.type, q.x, q.y);
      if (res.ok) {
        const e = place(q.type, q.x, q.y, q.dir);
        if (e && q.extra) { if (q.extra.recipe && e.recipe !== undefined) e.recipe = q.extra.recipe; if (q.extra.filter && e.filter !== undefined) e.filter = q.extra.filter; }
        sfx('place', q.x, q.y);
      } else if (res.why === 'Faltan materiales' && !warned) {
        warned = true;
        toast(`Faltan materiales para seguir: ${costText(BUILDINGS[q.type].cost)}`);
        p.queue.length = 0;
        return;
      }
    } else {
      const e = S.entities.find((x) => x.id === q.id);
      if (e) removeEntity(e);
    }
    p.queue.splice(i, 1); i--;
  }
  // Ir hacia lo más cercano que falta
  if (p.queue.length && !p.path) {
    let best = null, bd = Infinity;
    for (const q of p.queue) { const d = wdist(p.x, p.y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
    if (!walkTo(best.x, best.y, REACH - 1.5)) p.queue.length = 0;
  }
}

// Tocar un mineral: ir y extraerlo hasta que se mande otra cosa
const CHOP_TIME = 1.2;
function startMining(x, y) {
  const p = S.player;
  p.mine = { x: wrapX(x), y: wrapY(y), tree: !oreAt(x, y) && treeAt(x, y) };
  p.mineT = 0;
  if (!inReach(x, y, MINE_REACH)) walkTo(x, y, MINE_REACH - 0.6);
}

function nearestTree(x, y, r) {
  let best = null, bd = Infinity;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const tx = x + dx, ty = y + dy;
    if (treeAt(tx, ty) && !at(tx, ty)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { x: tx, y: ty }; } }
  }
  return best;
}

function stopPlayerTasks() {
  const p = S.player;
  p.path = null; p.mine = null; p.queue.length = 0;
}

// --------------------------- Fabricación a mano ---------------------------

const handRecipes = () => RECIPE_ORDER.filter((id) => RECIPES[id].machine === 'asm' && RECIPES[id].tier === 1 && hasTech(RECIPES[id].tech));

function canCraft(id, n = 1) {
  const r = RECIPES[id];
  return Object.entries(r.in).every(([k, q]) => avail(k) >= q * n);
}

function craft(id, n = 1) {
  let made = 0;
  for (let i = 0; i < n && canCraft(id); i++) {
    for (const [k, q] of Object.entries(RECIPES[id].in)) takeItem(k, q);
    S.player.craft.push({ id, t: RECIPES[id].time });
    made++;
  }
  return made;
}

function cancelCraft(i) {
  const c = S.player.craft[i];
  if (!c) return;
  for (const [k, q] of Object.entries(RECIPES[c.id].in)) giveItem(k, q);
  S.player.craft.splice(i, 1);
}

// --------------------------- Paso del personaje ---------------------------

let revealTimer = 0;
function updatePlayer(dt) {
  if (!playerOn()) return;
  const p = S.player;
  unstick(p);
  updatePet(p, dt);
  let vx = 0, vy = 0;
  const inp = p.input;
  if (inp && (inp.x || inp.y)) {
    // El teclado manda: cancela el camino y la extracción
    p.path = null; p.mine = null;
    const l = Math.hypot(inp.x, inp.y);
    vx = inp.x / l * PLAYER_SPEED; vy = inp.y / l * PLAYER_SPEED;
  } else if (p.path && p.path.length) {
    // Avanza por los puntos del camino sin pasarse
    let budget = PLAYER_SPEED * dt;
    while (budget > 0 && p.path && p.path.length) {
      const wp = p.path[0];
      const dx = wdx(wp.x - p.x), dy = wdy(wp.y - p.y), d = Math.hypot(dx, dy);
      if (d <= budget) {
        if (canStand(wp.x, wp.y)) { p.x = wp.x; p.y = wp.y; }
        budget -= d;
        p.path.shift();
        if (!p.path.length) p.path = null;
        if (d > 0.01) p.ang = Math.atan2(dy, dx);
        p.step += d * 1.5;
        p.moving = true;
      } else {
        vx = dx / d * PLAYER_SPEED; vy = dy / d * PLAYER_SPEED;
        break;
      }
    }
  }
  // Las cintas lo arrastran
  const under = at(Math.floor(p.x), Math.floor(p.y));
  if (under && isBelt(under.type) && !vx && !vy) {
    const sp = BUILDINGS[under.type].speed;
    moveBy(p, DIRS[under.dir][0] * sp * dt, DIRS[under.dir][1] * sp * dt);
  }
  if (vx || vy) {
    const bx = p.x, by = p.y;
    moveBy(p, vx * dt, vy * dt);
    p.ang = Math.atan2(vy, vx);
    p.step += dt * 10;
    // Atascado contra algo: abandona el camino
    if (Math.hypot(p.x - bx, p.y - by) < PLAYER_SPEED * dt * 0.2) { if ((p.stuck += dt) > 0.6) { p.path = null; p.stuck = 0; } }
    else p.stuck = 0;
  }
  p.x = wrapX(p.x); p.y = wrapY(p.y);
  p.moving = !!(vx || vy) || (p.path && p.path.length > 0);
  revealTimer += dt;
  if (revealTimer > 0.4) { revealTimer = 0; reveal(p.x, p.y, REVEAL_RADIUS); }

  // Extracción a mano
  p.mining = false;
  if (p.mine && !p.moving && p.mine.tree) {
    // Talar: da madera y sigue con el árbol más cercano
    if (!treeAt(p.mine.x, p.mine.y)) p.mine = null;
    else if (inReach(p.mine.x, p.mine.y, MINE_REACH)) {
      p.mining = true;
      p.ang = Math.atan2(wdy(p.mine.y + 0.5 - p.y), wdx(p.mine.x + 0.5 - p.x));
      p.mineT += dt;
      if (p.mineT >= CHOP_TIME) {
        p.mineT = 0;
        chopTree(p.mine.x, p.mine.y);
        netPush({ k: 'c', x: p.mine.x, y: p.mine.y });
        giveItem('wood', WOOD_PER_TREE); countProduced('wood', WOOD_PER_TREE); sfx('remove', p.mine.x, p.mine.y);
        const next = nearestTree(p.mine.x, p.mine.y, 4);
        if (next) startMining(next.x, next.y); else p.mine = null;
      }
    } else if (!p.path) walkTo(p.mine.x, p.mine.y, MINE_REACH - 0.6);
  } else if (p.mine && !p.moving) {
    const o = oreAt(p.mine.x, p.mine.y);
    if (!o || o === 'water' || o === 'oil' || at(p.mine.x, p.mine.y)) p.mine = null;
    else if (inReach(p.mine.x, p.mine.y, MINE_REACH)) {
      p.mining = true;
      p.ang = Math.atan2(wdy(p.mine.y + 0.5 - p.y), wdx(p.mine.x + 0.5 - p.x));
      p.mineT += dt;
      if (p.mineT >= HAND_MINE_TIME) {
        p.mineT = 0;
        const got = mineOre(p.mine.x, p.mine.y);
        if (got) netPush({ k: 'm', x: p.mine.x, y: p.mine.y });
        if (got) { giveItem(got, 1); countProduced(got); sfx('click'); }
      }
    } else if (!p.path) walkTo(p.mine.x, p.mine.y, MINE_REACH - 0.6);
  }

  processQueue();

  // Fabricación a mano
  const c = p.craft[0];
  if (c) {
    c.t -= dt;
    if (c.t <= 0) {
      const r = RECIPES[c.id];
      giveItem(r.out, r.n);
      countProduced(r.out, r.n);
      p.craft.shift();
      if (!p.craft.length) sfx('place');
    }
  }
}
