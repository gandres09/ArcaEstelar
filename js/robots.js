'use strict';
// =====================================================================
//  Robots de construcción: fantasmas, reconstrucción y reparación
// =====================================================================

const ROBOT_SPEED = 7;   // casillas por segundo
const robotsOn = () => hasTech('construction_robots');

function ghostAt(x, y) {
  return S.ghosts.find((g) => wrapX(x - g.x) < sizeOf(g.type) && wrapY(y - g.y) < sizeOf(g.type));
}

// ¿Se podría construir sin contar los materiales?
function placeableIgnoringCost(type, x, y) {
  const saved = S.inv;
  S.inv = new Proxy({}, { get: () => 1e9 });
  const res = canPlace(type, x, y);
  S.inv = saved;
  return res;
}

function addGhost(type, x, y, dir, extra = {}) {
  if (!robotsOn() || type === 'train' || type === 'landfill' || isVehicle(type)) return null;
  x = wrapX(x); y = wrapY(y);
  if (ghostAt(x, y)) return null;
  if (!placeableIgnoringCost(type, x, y).ok) return null;
  const g = { id: S.nextId++, type, x, y, dir, recipe: extra.recipe || null, filter: extra.filter || null };
  if (S.factions && curF && curF !== 'f0') g.f = curF;
  S.ghosts.push(g);
  netPush({ k: 'g', t: type, x, y, d: dir, r: g.recipe, f: g.filter });
  return g;
}

// Construye, y si faltan materiales (con robots investigados) deja un fantasma
function placeOrGhost(type, x, y, dir, extra = {}) {
  // Con robots y lejos del personaje, queda como plano para los robots
  if (playerOn() && robotsOn() && !inReach(x, y) && S.entities.some((p) => p.type === 'roboport')) return addGhost(type, x, y, dir, extra);
  const e = userPlace(type, x, y, dir, extra);
  if (e) return e;
  if (robotsOn() && canPlace(type, x, y).why === 'Faltan materiales') return addGhost(type, x, y, dir, extra);
  return null;
}

function removeGhostsIn(r) {
  netPush({ k: 'gx', r: { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 } });
  const before = S.ghosts.length;
  S.ghosts = S.ghosts.filter((g) => wrapX(g.x - r.x0) > r.x1 - r.x0 || wrapY(g.y - r.y0) > r.y1 - r.y0);
  return before - S.ghosts.length;
}

function portsCovering(x, y) {
  return S.entities.filter((p) => p.type === 'roboport' && p.powered && Math.max(Math.abs(wdx(p.x - x)), Math.abs(wdy(p.y - y))) <= BUILDINGS.roboport.range);
}

function updateRobots(dt) {
  updateLogistics(dt);
  if (!S.ghosts.length && !S.flights.length && !S.entities.some((e) => e.type === 'roboport')) return;
  // Vuelos en curso
  for (const f of S.flights) {
    const tx = f.back ? f.px : f.tx, ty = f.back ? f.py : f.ty;
    const dx = wdx(tx - f.x), dy = wdy(ty - f.y), d = Math.hypot(dx, dy);
    const step = ROBOT_SPEED * dt;
    if (d <= step) {
      f.x = tx; f.y = ty;
      if (!f.back) { finishJob(f); f.back = true; }
      else f.done = true;
    } else { f.x = wrapX(f.x + dx / d * step); f.y = wrapY(f.y + dy / d * step); }
  }
  for (const f of S.flights) if (f.done) { const p = S.entities.find((e) => e.id === f.port); if (p) p.busy = Math.max(0, (p.busy || 0) - 1); }
  S.flights = S.flights.filter((f) => !f.done);

  // Asignar trabajos una vez por segundo
  S.robotTimer = (S.robotTimer || 0) + dt;
  if (S.robotTimer < 1) return;
  S.robotTimer = 0;
  const ports = S.entities.filter((p) => p.type === 'roboport');
  for (const p of ports) {
    p.powered = drawPower(p, BUILDINGS.roboport.power) > 0.3;
    p.busy = p.busy || 0;
  }
  const taken = new Set(S.flights.map((f) => f.job));
  const jobs = [];
  for (const g of S.ghosts) if (!taken.has('g' + g.id)) jobs.push({ key: 'g' + g.id, x: g.x, y: g.y, ghost: g });
  for (const e of S.entities) {
    if (e.hp !== undefined && !isEnemyB(e) && e.type !== 'hub' && S.playTime - (e.hitAt || 0) > 3 && !taken.has('r' + e.id)) {
      jobs.push({ key: 'r' + e.id, x: e.x, y: e.y, repair: e });
    }
  }
  for (const job of jobs) {
    const jf = job.ghost ? fOf(job.ghost) : fOf(job.repair);   // cada uno con sus robots
    const port = portsCovering(job.x, job.y).filter((p) => p.busy < BUILDINGS.roboport.bots && fOf(p) === jf)
      .sort((a, b) => wdist(a.x, a.y, job.x, job.y) - wdist(b.x, b.y, job.x, job.y))[0];
    if (!port) continue;
    useFaction(jf);
    // Los materiales salen del inventario al despegar
    if (job.ghost) {
      // Los robots sacan los materiales de la Nave
      if (!withNucleo(() => canAfford(BUILDINGS[job.ghost.type].cost))) continue;
      withNucleo(() => pay(BUILDINGS[job.ghost.type].cost));
    } else if ((S.inv.iron_plate || 0) >= 1) S.inv.iron_plate -= 1;
    else continue;
    port.busy++;
    S.flights.push({ job: job.key, f: jf, gtype: job.ghost ? job.ghost.type : null, port: port.id, x: port.x + 0.5, y: port.y + 0.5, px: port.x + 0.5, py: port.y + 0.5, tx: job.x + 0.5, ty: job.y + 0.5, back: false });
  }
  if (S.factions) useMine();
}

function finishJob(f) {
  if (S.factions) return asFaction(f.f || 'f0', () => finishJobInner(f));
  return finishJobInner(f);
}
function finishJobInner(f) {
  if (f.job[0] === 'g') {
    const id = +f.job.slice(1);
    const g = S.ghosts.find((x) => x.id === id);
    if (!g) { withNucleo(() => refund(BUILDINGS[f.gtype].cost)); return; }   // el fantasma se canceló en el camino
    S.ghosts.splice(S.ghosts.indexOf(g), 1);
    // Ya están pagados: se construye con materiales prestados
    const e = withNucleo(() => { refund(BUILDINGS[g.type].cost); return place(g.type, g.x, g.y, g.dir, { silent: true }); });
    if (!e) { return; }
    if (g.recipe && e.recipe !== undefined) e.recipe = g.recipe;
    if (g.filter && e.filter !== undefined) e.filter = g.filter;
  } else {
    const id = +f.job.slice(1);
    const e = S.entities.find((x) => x.id === id);
    if (e) delete e.hp;
  }
}

// =====================================================================
//  Robots logísticos: llevan objetos de los cofres de provisión (y del
//  Nave) a los cofres de pedido, dentro de la zona de los puertos.
// =====================================================================

const LOGI_BOTS = 5;      // por puerto
const LOGI_CARGO = 4;     // objetos por viaje
const logisticsOn = () => hasTech('logistic_robots');
const portNear = (e) => portsCovering(e.x, e.y).length > 0;

function updateLogistics(dt) {
  if (!S.lflights) S.lflights = [];
  // Vuelos: puerto → origen (levanta) → destino (deja) → puerto
  for (const f of S.lflights) {
    const leg = f.legs[f.i];
    // Pedidos personales: el robot persigue al personaje
    if (leg[2] === 'drop' && f.dst === 'player' && S.player) { leg[0] = S.player.x; leg[1] = S.player.y; }
    const dx = wdx(leg[0] - f.x), dy = wdy(leg[1] - f.y), d = Math.hypot(dx, dy);
    const step = ROBOT_SPEED * dt;
    if (d > step) { f.x = wrapX(f.x + dx / d * step); f.y = wrapY(f.y + dy / d * step); continue; }
    f.x = leg[0]; f.y = leg[1];
    if (leg[2] === 'pick') {
      const src = f.src === 'hub' ? null : S.entities.find((e) => e.id === f.src);
      const finv = S.factions && f.port ? factionInv(S.entities.find((e) => e.id === f.port)) : S.inv;
      const have = src ? (src.store[f.item] || 0) : Math.floor(finv[f.item] || 0);
      const n = Math.min(f.n, have);
      if (n <= 0) { f.i = f.legs.length - 1; continue; }   // ya no estaba: vuelve
      if (src) { src.store[f.item] -= n; src.total -= n; if (!src.store[f.item]) delete src.store[f.item]; } else finv[f.item] -= n;
      f.carry = n;
    } else if (leg[2] === 'drop') {
      const dst = f.dst === 'player' ? null : S.entities.find((e) => e.id === f.dst);
      if (dst) { add(dst.store, f.item, f.carry); dst.total += f.carry; }
      else if (f.dst === 'player' && S.player) add(S.pinv, f.item, f.carry);
      else add(S.factions && f.port ? factionInv(S.entities.find((e) => e.id === f.port)) : S.inv, f.item, f.carry);
      f.carry = 0;
    } else { f.done = true; continue; }
    f.i++;
  }
  if (S.lflights.some((f) => f.done)) {
    for (const f of S.lflights) if (f.done && f.carry) add(S.inv, f.item, f.carry);   // nada se pierde
    S.lflights = S.lflights.filter((f) => !f.done);
  }

  S.logiTimer = (S.logiTimer || 0) + dt;
  if (S.logiTimer < 1) return;
  S.logiTimer = 0;
  // Con bases separadas, cada jugador con sus cofres, sus puertos y su Nave
  const fs = S.factions ? Object.keys(S.factions) : ['f0'];
  for (const f of fs) { if (S.factions) useFaction(f); if (logisticsOn()) logisticsFor(f); }
  if (S.factions) useMine();
}
function logisticsFor(LF) {
  const mine = (e) => fOf(e) === LF;
  const ports = S.entities.filter((p) => p.type === 'roboport' && p.powered && mine(p));
  if (!ports.length) return;
  const busy = {};
  for (const f of S.lflights) busy[f.port] = (busy[f.port] || 0) + 1;
  const freePort = (x, y) => ports.filter((p) => (busy[p.id] || 0) < LOGI_BOTS)
    .sort((a, b) => wdist(a.x, a.y, x, y) - wdist(b.x, b.y, x, y))[0];
  const providers = S.entities.filter((e) => LOGI_SOURCES.has(e.type) && e.total > 0 && mine(e) && portNear(e));
  const hub = S.entities.find((e) => e.type === 'hub' && mine(e));
  const hubIn = hub && portNear(hub);
  // Lo que ya viene en camino a cada cofre
  const coming = {};
  for (const f of S.lflights) if (f.i <= f.legs.findIndex((l) => l[2] === 'drop')) { const k = f.dst + ':' + f.item; coming[k] = (coming[k] || 0) + f.n; }
  // Quién pide: cofres de pedido y de búfer, y el personaje (sus pedidos personales)
  const askers = S.entities.filter((r) => (r.type === 'requesterchest' || r.type === 'bufferchest') && r.req && mine(r) && portNear(r));
  const pl = S.player;
  if (playerOn() && LF === (myF() || 'f0') && pl.lreq && Object.keys(pl.lreq).length && portsCovering(Math.floor(pl.x), Math.floor(pl.y)).length) {
    askers.push({ id: 'player', x: pl.x - 0.5, y: pl.y - 0.5, req: pl.lreq, store: S.pinv, total: 0, player: true });
  }
  for (const r of askers) {
    for (const item in r.req) {
      let missing = r.req[item] - Math.floor(r.store[item] || 0) - (coming[r.id + ':' + item] || 0);
      while (missing > 0 && (r.player || r.total + (coming[r.id + ':' + item] || 0) < capOf(r))) {
        const n = Math.min(LOGI_CARGO, missing);
        // El cofre más cercano con ese objeto (un búfer no le saca a otro búfer); si no, la Nave
        let src = null, bd = Infinity;
        for (const pv of providers) {
          if (pv === r || (r.type === 'bufferchest' && pv.type === 'bufferchest')) continue;
          const reserved = S.lflights.filter((f) => f.src === pv.id && f.item === item && !f.carry).reduce((a, f) => a + f.n, 0);
          if ((pv.store[item] || 0) - reserved <= 0) continue;
          const d = wdist(pv.x, pv.y, r.x, r.y);
          if (d < bd) { bd = d; src = pv; }
        }
        let sx, sy, sid;
        if (src) { sx = src.x + 0.5; sy = src.y + 0.5; sid = src.id; }
        else if (hubIn && (S.inv[item] || 0) >= 1) { sx = hub.x + 1.5; sy = hub.y + 1.5; sid = 'hub'; }
        else break;
        const port = freePort(sx, sy);
        if (!port) return;
        busy[port.id] = (busy[port.id] || 0) + 1;
        const px = port.x + 0.5, py = port.y + 0.5;
        S.lflights.push({ port: port.id, x: px, y: py, item, n, carry: 0, src: sid, dst: r.id, i: 0,
          legs: [[sx, sy, 'pick'], [r.x + 0.5, r.y + 0.5, 'drop'], [px, py, 'home']] });
        coming[r.id + ':' + item] = (coming[r.id + ':' + item] || 0) + n;
        missing -= n;
      }
    }
  }
  // Provisión activa: se vacía en los cofres de almacenamiento (o en la Nave)
  const storages = S.entities.filter((e) => e.type === 'storagechest' && mine(e) && portNear(e));
  for (const a of S.entities) {
    if (a.type !== 'activechest' || !a.total || !mine(a) || !portNear(a)) continue;
    const item = Object.keys(a.store).find((k) => a.store[k] > 0);
    if (!item) continue;
    const reserved = S.lflights.filter((f) => f.src === a.id && !f.carry).reduce((x, f) => x + f.n, 0);
    const n = Math.min(LOGI_CARGO, a.store[item] - reserved);
    if (n <= 0) continue;
    let dst = null, bd = Infinity;
    for (const st of storages) {
      if (st.total + (coming[st.id + ':*'] || 0) + n > capOf(st)) continue;
      const d = wdist(st.x, st.y, a.x, a.y);
      if (d < bd) { bd = d; dst = st; }
    }
    if (!dst && !hubIn) continue;
    const port = freePort(a.x, a.y);
    if (!port) return;
    busy[port.id] = (busy[port.id] || 0) + 1;
    const px = port.x + 0.5, py = port.y + 0.5;
    const tx = dst ? dst.x + 0.5 : hub.x + 1.5, ty = dst ? dst.y + 0.5 : hub.y + 1.5;
    S.lflights.push({ port: port.id, x: px, y: py, item, n, carry: 0, src: a.id, dst: dst ? dst.id : 'hub', i: 0,
      legs: [[a.x + 0.5, a.y + 0.5, 'pick'], [tx, ty, 'drop'], [px, py, 'home']] });
    if (dst) coming[dst.id + ':*'] = (coming[dst.id + ':*'] || 0) + n;
  }
}
const LOGI_SOURCES = new Set(['providerchest', 'storagechest', 'activechest', 'bufferchest']);
