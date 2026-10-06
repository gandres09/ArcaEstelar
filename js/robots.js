'use strict';
// =====================================================================
//  Robots de construcción: fantasmas, reconstrucción y reparación
// =====================================================================

const ROBOT_SPEED = 7;   // casillas por segundo
const robotsOn = () => hasTech('construction_robots');

function ghostAt(x, y) {
  return S.ghosts.find((g) => g.x <= x && x < g.x + sizeOf(g.type) && g.y <= y && y < g.y + sizeOf(g.type));
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
  if (!robotsOn() || type === 'train' || type === 'landfill') return null;
  if (ghostAt(x, y)) return null;
  if (!placeableIgnoringCost(type, x, y).ok) return null;
  const g = { id: S.nextId++, type, x, y, dir, recipe: extra.recipe || null, filter: extra.filter || null };
  S.ghosts.push(g);
  return g;
}

// Construye, y si faltan materiales (con robots investigados) deja un fantasma
function placeOrGhost(type, x, y, dir, extra = {}) {
  const e = place(type, x, y, dir);
  if (e) return e;
  if (robotsOn() && canPlace(type, x, y).why === 'Faltan materiales') return addGhost(type, x, y, dir, extra);
  return null;
}

function removeGhostsIn(r) {
  const before = S.ghosts.length;
  S.ghosts = S.ghosts.filter((g) => g.x < r.x0 || g.x > r.x1 || g.y < r.y0 || g.y > r.y1);
  return before - S.ghosts.length;
}

function portsCovering(x, y) {
  return S.entities.filter((p) => p.type === 'roboport' && p.powered && Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= BUILDINGS.roboport.range);
}

function updateRobots(dt) {
  if (!S.ghosts.length && !S.flights.length && !S.entities.some((e) => e.type === 'roboport')) return;
  // Vuelos en curso
  for (const f of S.flights) {
    const tx = f.back ? f.px : f.tx, ty = f.back ? f.py : f.ty;
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    const step = ROBOT_SPEED * dt;
    if (d <= step) {
      f.x = tx; f.y = ty;
      if (!f.back) { finishJob(f); f.back = true; }
      else f.done = true;
    } else { f.x += dx / d * step; f.y += dy / d * step; }
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
    if (e.hp !== undefined && e.type !== 'nest' && e.type !== 'hub' && S.playTime - (e.hitAt || 0) > 3 && !taken.has('r' + e.id)) {
      jobs.push({ key: 'r' + e.id, x: e.x, y: e.y, repair: e });
    }
  }
  for (const job of jobs) {
    const port = portsCovering(job.x, job.y).filter((p) => p.busy < BUILDINGS.roboport.bots)
      .sort((a, b) => Math.hypot(a.x - job.x, a.y - job.y) - Math.hypot(b.x - job.x, b.y - job.y))[0];
    if (!port) continue;
    // Los materiales salen del inventario al despegar
    if (job.ghost) {
      if (!canAfford(BUILDINGS[job.ghost.type].cost)) continue;
      pay(BUILDINGS[job.ghost.type].cost);
    } else if ((S.inv.iron_plate || 0) >= 1) S.inv.iron_plate -= 1;
    else continue;
    port.busy++;
    S.flights.push({ job: job.key, gtype: job.ghost ? job.ghost.type : null, port: port.id, x: port.x + 0.5, y: port.y + 0.5, px: port.x + 0.5, py: port.y + 0.5, tx: job.x + 0.5, ty: job.y + 0.5, back: false });
  }
}

function finishJob(f) {
  if (f.job[0] === 'g') {
    const id = +f.job.slice(1);
    const g = S.ghosts.find((x) => x.id === id);
    if (!g) { refund(BUILDINGS[f.gtype].cost); return; }   // el fantasma se canceló en el camino
    S.ghosts.splice(S.ghosts.indexOf(g), 1);
    // Ya están pagados: se construye con materiales prestados
    refund(BUILDINGS[g.type].cost);
    const e = place(g.type, g.x, g.y, g.dir, { silent: true });
    if (!e) { return; }
    if (g.recipe && e.recipe !== undefined) e.recipe = g.recipe;
    if (g.filter && e.filter !== undefined) e.filter = g.filter;
  } else {
    const id = +f.job.slice(1);
    const e = S.entities.find((x) => x.id === id);
    if (e) delete e.hp;
  }
}
