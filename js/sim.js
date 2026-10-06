'use strict';
// =====================================================================
//  Simulación: edificios, flujo de objetos, energía, investigación
// =====================================================================

let S;     // estado guardable (los campos que empiezan con _ no se guardan)
let grid;  // Array W*H: entidad que ocupa cada casilla
let nets = [];          // redes eléctricas
let wires = [];         // cables entre postes [x1, y1, x2, y2]
let powerDirty = true;
let undergroundDirty = true;

function newState(seed, peaceful, character = false) {
  return {
    v: SAVE_VERSION,
    seed,
    peaceful: !!peaceful,
    character: !!character,
    // Con personaje se empieza sin nada; en modo clásico, con materiales en la Nave
    inv: character ? {} : { iron_plate: 100, copper_plate: 30, stone: 80, coal: 40 },
    pinv: {},
    player: null,
    delivered: {},
    produced: {},
    techs: {},
    research: { current: null, progress: 0 },
    inf: {},
    entities: [],
    biters: [],
    trains: [],
    ghosts: [],
    flights: [],
    pollution: null,
    evo: 0,
    expandTimer: 600,
    dayTime: 0.1,
    day: 1,
    playTime: 0,
    launched: 0,
    mapW: W, mapH: H,
    nextId: 1,
  };
}

const add = (obj, k, n) => { obj[k] = (obj[k] || 0) + n; };
const at = (x, y) => grid[tIdx(x, y)];
const sizeOf = (type) => (type === 'hub' ? 3 : type === 'nest' ? 2 : BUILDINGS[type]?.size || 1);
const isBelt = (type) => BELTS.has(type);
const hasTech = (id) => !id || !!S.techs[id];
const isUnlocked = (type) => hasTech(BUILDINGS[type].tech) && (!BUILDINGS[type].character || !!(S && S.character));
const maxHp = (e) => (e.type === 'hub' ? 5000 : e.type === 'nest' ? NEST_HP : BUILDINGS[e.type]?.hp || 100);
const isPlayer = (e) => e && e.type !== 'nest';

// Con personaje, los costos salen de la mochila (y de la Nave si está cerca); ver player.js
function canAfford(cost) {
  for (const k in cost) if (avail(k) < cost[k]) return false;
  return true;
}
function pay(cost) { for (const k in cost) takeItem(k, cost[k]); }
function refund(cost) { for (const k in cost) giveItem(k, cost[k]); }

// --------------------------- Estadísticas ---------------------------

const statHistory = [];
let statNow = {};
let statTimer = 0;
function countProduced(item, n = 1) {
  add(statNow, item, n);
  add(S.produced, item, n);
}
function tickStats(dt) {
  statTimer += dt;
  if (statTimer >= 1) {
    statTimer -= 1;
    statHistory.push(statNow);
    statNow = {};
    if (statHistory.length > 60) statHistory.shift();
  }
}
function ratePerMinute(item) {
  let n = 0;
  for (const b of statHistory) n += b[item] || 0;
  return statHistory.length ? (n * 60) / statHistory.length : 0;
}

// --------------------------- Día y noche ---------------------------

function dayPhase(t = S.dayTime) {
  return DAY_PHASES.find((p) => t < p.until) || DAY_PHASES[0];
}
// Luz solar con transiciones suaves entre tramos
function sunLevel(t = S.dayTime) {
  return smoothPhase(t, 'sun');
}
function darkness(t = S.dayTime) {
  return smoothPhase(t, 'dark');
}
function smoothPhase(t, key) {
  const RAMP = 0.02;
  let prevUntil = 0;
  for (let i = 0; i < DAY_PHASES.length; i++) {
    const p = DAY_PHASES[i];
    if (t < p.until) {
      const prev = DAY_PHASES[(i + DAY_PHASES.length - 1) % DAY_PHASES.length];
      const k = Math.min(1, (t - prevUntil) / RAMP);
      return prev[key] + (p[key] - prev[key]) * k;
    }
    prevUntil = p.until;
  }
  return DAY_PHASES[0][key];
}

// --------------------------- Entidades ---------------------------

function makeEntity(type, x, y, dir = 0) {
  const e = { id: 0, type, x, y, dir: NO_DIR.has(type) ? 0 : dir };
  switch (type) {
    case 'belt': case 'fastbelt': case 'expressbelt': e.l = [null, null]; e.p = [0, 0]; break;
    case 'underground': e.l = [null, null]; e.p = [0, 0]; e.mode = 'in'; break;
    case 'splitter': e.l = [null, null]; e.p = [0, 0]; e.rr = 0; e.prio = null; break;
    case 'inserter': case 'fastinserter': e.hold = null; e.t = 0; e.ret = 0; e.filter = null; break;
    case 'sorter': e.l = [null, null]; e.p = [0, 0]; e.rr = 0; e.filter = null; break;
    case 'chest': case 'steelchest': case 'woodchest': case 'providerchest': e.store = {}; e.total = 0; break;
    case 'requesterchest': e.store = {}; e.total = 0; e.req = {}; break;
    case 'nursery': e.t = 0; break;
    case 'sensor': e.ch = 0; e.item = '*'; e.value = 0; break;
    case 'station': e.store = {}; e.total = 0; e.mode = 'load'; break;
    case 'miner': e.t = 0; e.buf = null; e.fuelType = null; e.fuel = 0; e.burn = 0; break;
    case 'eminer': case 'pumpjack': e.t = 0; e.buf = null; break;
    case 'furnace': case 'efurnace':
      e.inType = null; e.inCount = 0; e.fuelType = null; e.fuel = 0; e.burn = 0;
      e.prog = 0; e.outType = null; e.outCount = 0; break;
    case 'assembler': case 'assembler2': case 'chem': e.recipe = null; e.buf = {}; e.prog = 0; e.out = 0; break;
    case 'lab': e.packs = {}; e.prog = 0; e.working = false; break;
    case 'generator': e.fuelType = null; e.fuel = 0; e.energy = 0; break;
    case 'offshore': e.t = 0; e.buf = null; break;
    case 'boiler': e.water = 0; e.fuelType = null; e.fuel = 0; e.energy = 0; e.out = 0; e.t = 0; break;
    case 'steam_engine': e.steam = 0; e.energy = 0; break;
    case 'radar': e.t = 0; e.r = 16; break;
    case 'accumulator': e.stored = 0; break;
    case 'turret': e.ammo = 0; e.shots = 0; e.cd = 0; break;
    case 'laser': e.cd = 0; break;
    case 'shipyard': case 'starport': e.parts = {}; break;
    case 'purifier': e.filters = 0; e.left = 0; e.rate = 0; break;
    case 'uplink': e.charges = 0; e.cd = 0; e.aim = -Math.PI / 2; break;
    case 'nest': e.anger = 0; e.group = 0; e.groupTimer = 0; break;
  }
  return e;
}

function occupy(e, value) {
  const s = sizeOf(e.type);
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) grid[tIdx(e.x + dx, e.y + dy)] = value;
}

// Partidas viejas: las cintas tenían un solo objeto; ahora tienen dos carriles
function migrateEntity(e) {
  // Antes el taladro común no gastaba nada: se le regala una carga de carbón
  if (e.type === 'miner' && e.fuel === undefined) { e.fuelType = 'coal'; e.fuel = 5; e.burn = 0; }
  if (LANED.has(e.type) && !e.l) {
    e.l = [null, e.item || null]; e.p = [0, e.prog || 0];
    delete e.item; delete e.prog;
  }
}

function rebuildGrid() {
  grid = new Array(W * H).fill(null);
  for (const e of S.entities) { migrateEntity(e); occupy(e, e); }
  railDirty = true;
  fnets = [];
  fluidDirty = true;
  powerDirty = true;
  undergroundDirty = true;
}

// Objetos guardados dentro de un edificio (se devuelven al desarmarlo)
function contents(e) {
  const c = {};
  if (e.item) add(c, e.item, 1);
  if (e.l) for (const k of e.l) if (k) add(c, k, 1);
  if (e.hold) add(c, e.hold, 1);
  if (typeof e.buf === 'string') add(c, e.buf, 1);
  if (e.type === 'boiler') { if (e.water) add(c, 'water', e.water); if (e.out) add(c, 'steam', e.out); }
  if (e.type === 'steam_engine' && e.steam) add(c, 'steam', e.steam);
  if (e.inType) add(c, e.inType, e.inCount);
  if (e.outType) add(c, e.outType, e.outCount);
  if (e.fuelType) add(c, e.fuelType, e.fuel);
  if (e.store) for (const k in e.store) add(c, k, e.store[k]);
  if (e.parts) for (const k in e.parts) add(c, k, e.parts[k]);
  if (e.type === 'purifier' && e.filters) add(c, 'air_filter', e.filters);
  if (e.type === 'uplink' && e.charges) add(c, 'orbital_charge', e.charges);
  if (e.packs) for (const k in e.packs) add(c, k, e.packs[k]);
  if (e.type === 'turret' && e.ammo) add(c, 'ammo', e.ammo);
  if (e.modules) for (const m of e.modules) add(c, m, 1);
  if (e.recipe) {
    for (const k in e.buf) add(c, k, e.buf[k]);
    if (e.out) add(c, RECIPES[e.recipe].out, e.out);
  }
  return c;
}

// free: lo aplica la red (otro jugador ya lo pagó y lo vio posible)
function canPlace(type, x, y, free = false) {
  if (type === 'train') return free ? (isRail(at(x, y)) && !trainAt(x, y) ? { ok: true } : { ok: false }) : canPlaceTrain(x, y);
  const s = sizeOf(type);
  if (s === 1) {
    const existing = at(x, y);
    if (existing) {
      if (existing.type === type && isBelt(type)) return { ok: true, rotate: existing };
      return { ok: false, why: 'Casilla ocupada' };
    }
  } else {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      if (at(x + dx, y + dy)) return { ok: false, why: 'Hay algo en el medio' };
    }
  }
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
    if (!free && !tileExplored(x + dx, y + dy)) return { ok: false, why: 'Zona sin explorar' };
    if (type !== 'landfill' && oreAt(x + dx, y + dy) === 'water') return { ok: false, why: 'No se puede construir sobre el agua' };
  }
  const o = oreAt(x, y);
  if (type === 'landfill' && o !== 'water') return { ok: false, why: 'El relleno va sobre agua' };
  if ((type === 'pipe' || type === 'tank') && neighborFluids(x, y, s).size > 1) return { ok: false, why: 'Mezclaría dos líquidos distintos' };
  if (type === 'offshore' && !DIRS.some(([dx, dy]) => oreAt(x + dx, y + dy) === 'water')) return { ok: false, why: 'La bomba va en la orilla, al lado del agua' };
  if ((type === 'miner' || type === 'eminer') && !minerTile(x, y, BUILDINGS[type].area)) return { ok: false, why: 'El taladro va sobre mineral' };
  if (type === 'pumpjack' && o !== 'oil') return { ok: false, why: 'La bomba va sobre un pozo de petróleo' };
  if (free) return { ok: true };
  if (!isUnlocked(type)) return { ok: false, why: 'Falta investigar: ' + TECHS[BUILDINGS[type].tech].name };
  if (!canAfford(BUILDINGS[type].cost)) return { ok: false, why: 'Faltan materiales' };
  return { ok: true };
}

// Casilla con mineral que va a extraer un taladro: primero la del centro, después las de alrededor
function minerTile(x, y, r) {
  const ok = (tx, ty) => { const o = oreAt(tx, ty); return o && o !== 'oil' && o !== 'water'; };
  if (ok(x, y)) return { x, y };
  for (let d = 1; d <= r; d++) {
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === d && ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
  }
  return null;
}

// Mineral que queda en el área de un taladro
function minerArea(e) {
  const r = BUILDINGS[e.type].area || 0, res = {};
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const o = oreAt(e.x + dx, e.y + dy);
    if (o && o !== 'water' && (e.type === 'pumpjack' ? o === 'oil' : o !== 'oil')) res[o] = (res[o] || 0) + oreAmountAt(e.x + dx, e.y + dy);
  }
  return res;
}

// --------------------------- Deshacer ---------------------------

const undoStack = [];   // pilas de acciones: { ops: [...] }
let batch = null;     // acciones del gesto actual

function beginBatch() { if (!batch) batch = []; }
function endBatch() {
  if (batch && batch.length) {
    undoStack.push(batch);
    if (undoStack.length > 60) undoStack.shift();
  }
  batch = null;
}
function record(op) {
  if (batch) batch.push(op);
  else { undoStack.push([op]); if (undoStack.length > 60) undoStack.shift(); }
}

// Datos mínimos para volver a construir un edificio
function snapshot(e) {
  const s = { type: e.type, x: e.x, y: e.y, dir: e.dir };
  if (e.recipe) s.recipe = e.recipe;
  if (e.filter) s.filter = e.filter;
  return s;
}

function undo() {
  const ops = undoStack.pop();
  if (!ops) return 0;
  let n = 0;
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (op.kind === 'place') {
      if (S.entities.includes(op.e) && removeEntity(op.e, { silent: true })) n++;
    } else if (op.kind === 'remove') {
      const s = op.snap;
      const e = place(s.type, s.x, s.y, s.dir, { silent: true });
      if (e) { if (s.recipe) e.recipe = s.recipe; if (s.filter) e.filter = s.filter; n++; }
    } else if (op.kind === 'rotate') {
      if (S.entities.includes(op.e)) { op.e.dir = op.from; undergroundDirty = true; netTouch(op.e); n++; }
    }
  }
  return n;
}

// --------------------------- Construir y desarmar ---------------------------

function place(type, x, y, dir, opts = {}) {
  x = wrapX(x); y = wrapY(y);
  const res = canPlace(type, x, y, !!opts.free);
  if (!res.ok) return null;
  if (res.rotate) {
    if (res.rotate.dir !== dir) {
      if (!opts.silent) record({ kind: 'rotate', e: res.rotate, from: res.rotate.dir });
      res.rotate.dir = dir;
      netTouch(res.rotate);
    }
    return res.rotate;
  }
  if (type === 'train') {
    const t = placeTrain(x, y, !!opts.free);
    if (t) netPush({ k: 'p', t: 'train', x, y });
    return t;
  }
  if (!opts.free) pay(BUILDINGS[type].cost);
  if (type === 'landfill') {
    // El relleno no es un edificio: convierte el agua en tierra
    oreType[tIdx(x, y)] = 0;
    oreAmt[tIdx(x, y)] = 0;
    invalidateTile(x, y);
    netPush({ k: 'p', t: 'landfill', x, y });
    return { type: 'landfill' };
  }
  const e = makeEntity(type, x, y, dir);
  e.id = S.nextId++;
  if (type === 'underground') e.mode = undergroundModeFor(x, y, dir);
  S.entities.push(e);
  occupy(e, e);
  if (RAILISH.has(type)) railDirty = true;
  if (type === 'station') e.name = `Estación ${S.entities.filter((x) => x.type === 'station').length}`;
  // Los árboles que estaban ahí se talan y dan madera
  const sz = sizeOf(type);
  let wood = 0;
  for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (chopTree(x + dx, y + dy)) wood += WOOD_PER_TREE;
  if (wood && !opts.free) { giveItem('wood', wood); countProduced('wood', wood); }
  powerDirty = true;
  undergroundDirty = true;
  fluidDirty = true;
  reveal(x + sizeOf(type) / 2, y + sizeOf(type) / 2, 12);
  if (S.ghosts.length) {
    const s = sizeOf(type);
    S.ghosts = S.ghosts.filter((g) => g.x + sizeOf(g.type) <= x || g.x >= x + s || g.y + sizeOf(g.type) <= y || g.y >= y + s);
  }
  if (!opts.silent) record({ kind: 'place', e });
  netPlaced(e);
  return e;
}

function removeEntity(e, opts = {}) {
  if (!e || e.type === 'hub' || e.type === 'nest' || !S.entities.includes(e)) return false;
  if (!opts.destroyed) {
    if (!opts.silent) sfx('remove');
    if (!opts.noRefund) {
      refund(BUILDINGS[e.type].cost);
      refund(contents(e));
    }
    if (!opts.silent) record({ kind: 'remove', snap: snapshot(e) });
    netPush({ k: 'r', t: e.type, x: e.x, y: e.y });
  }
  occupy(e, null);
  S.entities.splice(S.entities.indexOf(e), 1);
  e._dead = true;
  if (RAILISH.has(e.type)) railDirty = true;
  if (typeof treeAt === 'function' && treeAt(e.x, e.y)) treeChanged(e.x, e.y);
  powerDirty = true;
  undergroundDirty = true;
  fluidDirty = true;
  return true;
}

function rotateEntity(e, step) {
  if (!e || NO_DIR.has(e.type)) return;
  record({ kind: 'rotate', e, from: e.dir });
  e.dir = (e.dir + step + 4) % 4;
  undergroundDirty = true;
  netTouch(e);
}

// Daño a edificios del jugador (lo usan los enemigos)
function damageEntity(e, dmg) {
  if (!e || e._dead) return;
  if (e.hp === undefined) e.hp = maxHp(e);
  e.hp -= dmg;
  e.hitAt = S.playTime;
  if (e.type === 'hub') { e.hp = Math.max(1, e.hp); return; }
  if (e.hp <= 0) {
    if (e.type === 'nest') {
      removeNest(e);
    } else {
      removeEntity(e, { destroyed: true });
      spawnExplosion(e.x + sizeOf(e.type) / 2, e.y + sizeOf(e.type) / 2, 1);
      sfx('boom', e.x, e.y);
      // Con robots, lo destruido queda como fantasma para reconstruirlo
      addGhost(e.type, e.x, e.y, e.dir, { recipe: e.recipe, filter: e.filter });
    }
  }
}

function removeNest(e, quiet) {
  occupy(e, null);
  S.entities.splice(S.entities.indexOf(e), 1);
  e._dead = true;
  if (!quiet) S.evo = Math.min(1, S.evo + 0.002);   // los ataques orbitales no los hacen evolucionar
  S.nestsKilled = (S.nestsKilled || 0) + 1;
  spawnExplosion(e.x + 1, e.y + 1, 1.6);
  sfx('boom', e.x, e.y);
  if (!quiet) toast('💥 Destruiste un nido');
}

// --------------------------- Cintas subterráneas ---------------------------

function undergroundModeFor(x, y, dir) {
  const [dx, dy] = DIRS[dir];
  for (let k = 1; k <= UNDERGROUND_REACH + 1; k++) {
    const e = at(x - dx * k, y - dy * k);
    if (e && e.type === 'underground' && e.dir === dir) {
      if (e.mode === 'in' && !e._pair) return 'out';
      return 'in';
    }
  }
  return 'in';
}

function pairUndergrounds() {
  undergroundDirty = false;
  for (const e of S.entities) if (e.type === 'underground') e._pair = null;
  for (const e of S.entities) {
    if (e.type !== 'underground' || e.mode !== 'in') continue;
    const [dx, dy] = DIRS[e.dir];
    for (let k = 1; k <= UNDERGROUND_REACH + 1; k++) {
      const o = at(e.x + dx * k, e.y + dy * k);
      if (o && o.type === 'underground' && o.dir === e.dir) {
        if (o.mode === 'out' && !o._pair) { e._pair = o; o._pair = e; e._dist = k; }
        break;
      }
    }
  }
}

// --------------------------- Red eléctrica ---------------------------

const isPole = (e) => e.type === 'pole' || e.type === 'bigpole';

function rebuildPower() {
  powerDirty = false;
  nets = [];
  const poles = S.entities.filter(isPole);
  for (const p of poles) p._net = -1;
  const reach = (a, b) => Math.min(BUILDINGS[a.type].reach, BUILDINGS[b.type].reach);
  for (const p of poles) {
    if (p._net >= 0) continue;
    const id = nets.length;
    nets.push({ demand: 0, cap: 0, sat: 1, poles: 0, solar: 0, fuel: 0, accDis: 0, accChg: 0,
      prev: { demand: 0, solar: 0, fuel: 0, accDis: 0, accChg: 0 }, fuelUsed: 0, accFlow: 0, accCount: 0 });
    const stack = [p];
    p._net = id;
    while (stack.length) {
      const q = stack.pop();
      nets[id].poles++;
      for (const r of poles) {
        if (r._net < 0 && wdist(q.x, q.y, r.x, r.y) <= reach(q, r)) { r._net = id; stack.push(r); }
      }
    }
  }
  wires = [];
  for (let i = 0; i < poles.length; i++) {
    for (let j = i + 1; j < poles.length; j++) {
      const a = poles[i], b = poles[j];
      if (wdist(a.x, a.y, b.x, b.y) <= reach(a, b)) wires.push([a.x, a.y, a.x + wdx(b.x - a.x), a.y + wdy(b.y - a.y), a.type === 'bigpole' && b.type === 'bigpole']);
    }
  }
  for (const e of S.entities) {
    const d = BUILDINGS[e.type];
    if (!d || !(d.power || d.output || d.capacity)) continue;
    e._net = -1;
    const s = sizeOf(e.type);
    // Buscar un poste cuya zona de alimentación toque el edificio
    for (const p of poles) {
      const sup = BUILDINGS[p.type].supply;
      const ex = wdx(e.x - p.x), ey = wdy(e.y - p.y);
      if (ex <= sup && ex + s - 1 >= -sup && ey <= sup && ey + s - 1 >= -sup) { e._net = p._net; break; }
    }
  }
  for (const n of nets) n.accCount = 0;
  for (const e of S.entities) if (e.type === 'accumulator' && nets[e._net]) nets[e._net].accCount++;
}

// Al empezar cada paso se reparte la energía según lo que pasó en el paso anterior
function balancePower(dt) {
  for (const n of nets) {
    const D = n.demand, direct = n.solar + n.fuel;
    n.prev = { demand: D, solar: n.solar, fuel: n.fuel, accDis: n.accDis, accChg: n.accChg };
    if (D <= direct) {
      n.sat = 1;
      const charge = Math.min(direct - D, n.accChg);
      n.fuelUsed = Math.max(0, D + charge - n.solar);
      n.accFlow = charge;            // positivo: carga
    } else {
      const fromAcc = Math.min(D - direct, n.accDis);
      n.sat = D > 0 ? (direct + fromAcc) / D : 1;
      n.fuelUsed = n.fuel;
      n.accFlow = -fromAcc;          // negativo: descarga
    }
    n.demand = 0; n.solar = 0; n.fuel = 0; n.accDis = 0; n.accChg = 0;
  }
}

// Efecto combinado de los módulos de una máquina
function moduleFx(e) {
  const fx = { speed: 1, power: 1, prod: 0, poll: 1 };
  if (!e.modules) return fx;
  for (const m of e.modules) {
    const d = MODULES[m];
    fx.speed += d.speed || 0; fx.power += d.power || 0; fx.prod += d.prod || 0; fx.poll += d.poll || 0;
  }
  fx.power = Math.max(0.2, fx.power);
  fx.speed = Math.max(0.2, fx.speed);
  return fx;
}

// Factor de velocidad para un consumidor eléctrico (y registra su demanda)
function drawPower(e, kw) {
  const net = nets[e._net];
  if (!net) return 0;
  net.demand += kw;
  return net.sat;
}

// --------------------------- Flujo de objetos ---------------------------

// ¿El edificio t acepta el objeto? Con dry = true solo pregunta, sin entregarlo
// lane: el carril de donde viene (si viene de una cinta), o -1
function accept(t, item, src, dry = false, lane = -1) {
  const ok = (fn) => { if (!dry) fn(); return true; };
  switch (t.type) {
    case 'pipe': case 'tank':
      return fluidAccept(t, item, dry);
    case 'hub': case 'receiver':
      return ok(() => { add(S.inv, item, 1); add(S.delivered, item, 1); });
    case 'belt': case 'fastbelt': case 'expressbelt': case 'underground': case 'splitter': case 'sorter': {
      if (t.type === 'underground' && t.mode !== 'in') return false;
      const [dx, dy] = DIRS[t.dir];
      if (src && LANED.has(t.type) && t.type !== 'splitter' && t.type !== 'sorter' && at(t.x + dx, t.y + dy) === src) return false; // no aceptar desde adelante
      let k = laneInto(t, src, lane);
      if (k < 0) k = !t.l[1] ? 1 : !t.l[0] ? 0 : -1;
      if (k < 0 || t.l[k]) return false;
      return ok(() => { t.l[k] = item; t.p[k] = 0; });
    }
    case 'station':
      if (t.mode !== 'load' || t.total >= STATION_CAP) return false;
      return ok(() => { add(t.store, item, 1); t.total++; });
    case 'chest': case 'steelchest': case 'woodchest': case 'providerchest': case 'requesterchest':
      if (t.total >= BUILDINGS[t.type].capacity) return false;
      return ok(() => { add(t.store, item, 1); t.total++; });
    case 'furnace': case 'efurnace': {
      if (t.type === 'furnace' && FURNACE_FUEL[item]) {
        if (t.fuel >= 10 || (t.fuelType && t.fuelType !== item)) return false;
        return ok(() => { t.fuelType = item; t.fuel++; });
      }
      const r = SMELT[item];
      if (!r || !hasTech(r.tech)) return false;
      if ((t.inType && t.inType !== item) || t.inCount >= Math.max(10, r.n * 3)) return false;
      return ok(() => { t.inType = item; t.inCount++; });
    }
    case 'assembler': case 'assembler2': case 'chem': {
      if (!t.recipe) return false;
      const need = RECIPES[t.recipe].in[item];
      if (!need || (t.buf[item] || 0) >= need * 2) return false;
      return ok(() => add(t.buf, item, 1));
    }
    case 'lab':
      if (!PACKS.includes(item) || (t.packs[item] || 0) >= 10) return false;
      return ok(() => add(t.packs, item, 1));
    case 'miner':
      if (!MINER_FUEL[item] || t.fuel >= 10 || (t.fuelType && t.fuelType !== item)) return false;
      return ok(() => { t.fuelType = item; t.fuel++; });
    case 'generator':
      if (!FUELS[item] || t.fuel >= 20 || (t.fuelType && t.fuelType !== item)) return false;
      return ok(() => { t.fuelType = item; t.fuel++; });
    case 'boiler':
      if (item === 'water') return t.water >= 20 ? false : ok(() => { t.water++; });
      if (!FUELS[item] || t.fuel >= 10 || (t.fuelType && t.fuelType !== item)) return false;
      return ok(() => { t.fuelType = item; t.fuel++; });
    case 'steam_engine':
      if (item !== 'steam' || t.steam >= 10) return false;
      return ok(() => { t.steam++; });
    case 'turret':
      if (item !== 'ammo' || t.ammo >= 20) return false;
      return ok(() => { t.ammo++; });
    case 'shipyard': case 'starport': {
      const need = shipNeeds(t);
      if (!need[item] || (t.parts[item] || 0) >= need[item]) return false;
      return ok(() => add(t.parts, item, 1));
    }
    case 'purifier':
      if (item !== 'air_filter' || t.filters >= 20) return false;
      return ok(() => { t.filters++; });
    case 'uplink':
      if (item !== 'orbital_charge' || t.charges >= 10) return false;
      return ok(() => { t.charges++; });
  }
  return false;
}

// Lo que podría querer recibir un edificio (para sacarlo de la Nave)
function wantedBy(dst) {
  switch (dst.type) {
    case 'assembler': case 'assembler2': case 'chem': return dst.recipe ? Object.keys(RECIPES[dst.recipe].in) : [];
    case 'furnace': return [...Object.keys(SMELT), 'coal', 'solid_fuel', 'wood'];
    case 'efurnace': return Object.keys(SMELT);
    case 'lab': return PACKS;
    case 'turret': return ['ammo'];
    case 'boiler': return ['water', 'coal', 'solid_fuel', 'wood'];
    case 'generator': case 'miner': return ['coal', 'solid_fuel', 'wood'];
    case 'shipyard': case 'starport': return Object.keys(shipNeeds(dst));
    case 'purifier': return ['air_filter'];
    case 'uplink': return ['orbital_charge'];
    default: return [];
  }
}

// El brazo saca de src un objeto que dst acepte (y que pase su filtro)
function takeFrom(src, dst, ins) {
  const want = (k) => k && (!ins.filter || ins.filter === k) && accept(dst, k, ins, true);
  switch (src.type) {
    case 'belt': case 'fastbelt': case 'expressbelt': case 'underground': case 'splitter': case 'sorter': {
      // Toma el objeto más adelantado de los dos carriles
      const order = (src.p[0] || 0) >= (src.p[1] || 0) ? [0, 1] : [1, 0];
      for (const i of order) if (want(src.l[i])) { const k = src.l[i]; src.l[i] = null; src.p[i] = 0; return k; }
      return null;
    }
    case 'chest': case 'steelchest': case 'woodchest': case 'station': case 'providerchest': case 'requesterchest':
      for (const k in src.store) if (src.store[k] > 0 && want(k)) { if (--src.store[k] === 0) delete src.store[k]; src.total--; return k; }
      return null;
    case 'furnace': case 'efurnace':
      if (src.outCount > 0 && want(src.outType)) { const k = src.outType; if (--src.outCount === 0) src.outType = null; return k; }
      return null;
    case 'assembler': case 'assembler2': case 'chem':
      if (src.recipe && src.out > 0 && want(RECIPES[src.recipe].out)) { src.out--; return RECIPES[src.recipe].out; }
      return null;
    case 'miner': case 'eminer': case 'pumpjack': case 'offshore':
      if (want(src.buf)) { const k = src.buf; src.buf = null; return k; }
      return null;
    case 'boiler':
      if (src.out > 0 && want('steam')) { src.out--; return 'steam'; }
      return null;
    case 'receiver':
      if (!hasTech('logistic_network')) return null;
    // fallthrough: con la red logística, el receptor da acceso al inventario
    case 'hub':
      for (const k of wantedBy(dst)) if ((S.inv[k] || 0) >= 1 && want(k)) { S.inv[k]--; return k; }
      return null;
  }
  return null;
}

function pushTo(e, dir, item, lane = -1) {
  const [dx, dy] = DIRS[dir];
  const t = at(e.x + dx, e.y + dy);
  return !!t && t !== e && t.type !== 'nest' && accept(t, item, e, false, lane);
}

// En qué carril de la cinta t cae algo que viene de src (-1: cualquiera)
//  - de atrás: el mismo carril · cinta que entra por un costado: el carril de ese lado
//  - curva (una sola cinta entra de costado): conserva el carril · brazo o máquina de costado: el carril de su lado
function laneInto(t, src, lane) {
  if (!src || src.type === 'splitter' || src.type === 'sorter' || t.type === 'splitter' || t.type === 'sorter') return lane;
  const s = sizeOf(src.type);
  const ddx = Math.sign(wdx(src.x + (s - 1) / 2 - t.x)), ddy = Math.sign(wdy(src.y + (s - 1) / 2 - t.y));
  const [fx, fy] = DIRS[t.dir];
  if (ddx === -fx && ddy === -fy) return lane;
  const [lx, ly] = DIRS[(t.dir + 3) % 4];
  const fromLeft = ddx === lx && ddy === ly;
  const fromRight = ddx === -lx && ddy === -ly;
  if (!fromLeft && !fromRight) return lane;
  if (LANED.has(src.type) && lane >= 0) {
    const behind = at(t.x - fx, t.y - fy);
    const fedStraight = behind && LANED.has(behind.type) && behind.dir === t.dir && behind.type !== 'underground';
    return fedStraight ? (fromLeft ? 0 : 1) : lane;
  }
  return fromLeft ? 0 : 1;   // queda del lado por donde llegó
}

// --------------------------- Investigación ---------------------------

const infLevel = (id) => (S.inf && S.inf[id]) || 0;
function techUnits(id) {
  const t = TECHS[id];
  return t.infinite ? Math.round(t.units * Math.pow(1.5, infLevel(id))) : t.units;
}
function techName(id) {
  const t = TECHS[id];
  return t.infinite ? `${t.name} ${infLevel(id) + 1}` : t.name;
}
function techAvailable(id) {
  return (TECHS[id].infinite || !S.techs[id]) && TECHS[id].req.every((r) => S.techs[r]) && stageOf() >= (TECHS[id].stage || 1);
}
function labSpeedMult() { return 1 + 0.1 * infLevel('inf_lab'); }

function setResearch(id) {
  if (!techAvailable(id)) return;
  if (S.research.current !== id) S.research = { current: id, progress: 0 };
  netPush({ k: 'R', id });
}

function finishResearch() {
  const id = S.research.current;
  const name = techName(id);
  for (const e of S.entities) if (e.type === 'lab') { e.prog = 0; e.working = false; }
  if (TECHS[id].infinite) {
    // Las infinitas siguen solas con el próximo nivel
    S.inf = S.inf || {};
    S.inf[id] = infLevel(id) + 1;
    S.research = { current: id, progress: 0 };
  } else {
    S.techs[id] = true;
    S.research = { current: null, progress: 0 };
  }
  toast(`🔬 Investigación terminada: <b>${name}</b>`);
  sfx('research');
  onTechFinished(id);
  save();
}

function eraIndex() {
  let i = 0;
  ERAS.forEach((era, k) => { if (!era.tech || S.techs[era.tech]) i = k; });
  return i;
}

function weaponMult() {
  return 1 + (S.techs.weapons1 ? 0.3 : 0) + (S.techs.weapons2 ? 0.5 : 0) + 0.1 * infLevel('inf_weapons');
}

// --------------------------- Actualización ---------------------------

function update(dt) {
  if (powerDirty) rebuildPower();
  if (undergroundDirty) pairUndergrounds();
  NET.sim++;   // lo que pasa adentro de la simulación no se manda por la red
  S.playTime += dt;
  tickStats(dt);
  S.dayTime += dt / DAY_LENGTH;
  if (S.dayTime >= 1) { S.dayTime -= 1; S.day++; }
  balancePower(dt);
  const sun = sunLevel();
  const tech = S.research.current && TECHS[S.research.current];
  let researchDone = false;

  readSignals();
  for (const e of S.entities) {
    const def = BUILDINGS[e.type];
    // Red de señales: si la condición no se cumple, el edificio queda apagado
    if (e.cond) {
      e.off = !condOk(e.cond);
      if (e.off) { e.active = false; if (e.type === 'lamp') e.lit = false; continue; }
    }
    switch (e.type) {
      case 'belt': case 'fastbelt': case 'expressbelt':
        for (let k = 0; k < 2; k++) {
          if (!e.l[k]) continue;
          e.p[k] = Math.min(1, e.p[k] + dt * def.speed);
          if (e.p[k] >= 1 && pushTo(e, e.dir, e.l[k], k)) { e.l[k] = null; e.p[k] = 0; }
        }
        break;

      case 'underground':
        for (let k = 0; k < 2; k++) {
          if (!e.l[k]) continue;
          e.p[k] += dt * def.speed;
          if (e.mode === 'in') {
            const p = e._pair;
            if (!p) { e.p[k] = Math.min(e.p[k], 0.5); continue; }
            if (e.p[k] >= e._dist && !p.l[k]) { p.l[k] = e.l[k]; p.p[k] = 0.5; e.l[k] = null; e.p[k] = 0; }
            else e.p[k] = Math.min(e.p[k], e._dist);
          } else {
            e.p[k] = Math.min(1, e.p[k]);
            if (e.p[k] >= 1 && pushTo(e, e.dir, e.l[k], k)) { e.l[k] = null; e.p[k] = 0; }
          }
        }
        break;

      case 'inserter': case 'fastinserter': {
        const sp = def.power ? drawPower(e, def.power) : 1;
        if (sp <= 0) { e.active = false; break; }
        const step = dt * sp * 2 / def.swing;  // medio ciclo para ir y medio para volver
        const [dx, dy] = DIRS[e.dir];
        if (e.hold) {
          e.t = Math.min(1, e.t + step);
          if (e.t >= 1) {
            const dst = at(e.x + dx, e.y + dy);
            if (dst && dst.type !== 'nest' && dst !== e && accept(dst, e.hold, e)) { e.hold = null; e.ret = 1; }
          }
        } else if (e.ret > 0) {
          e.ret = Math.max(0, e.ret - step);
        } else {
          const src = at(e.x - dx, e.y - dy), dst = at(e.x + dx, e.y + dy);
          if (src && dst && src !== dst && src.type !== 'nest' && dst.type !== 'nest') {
            const k = takeFrom(src, dst, e);
            if (k) { e.hold = k; e.t = 0; }
          }
        }
        e.active = !!e.hold || e.ret > 0;
        break;
      }

      case 'splitter':
        for (let ln = 0; ln < 2; ln++) {
          if (!e.l[ln]) continue;
          // Con prioridad, esa salida se llena primero; si no, reparte por turnos (cada carril sigue en su carril)
          const order = e.prio === 'front' ? [0, 1, 2] : e.prio === 'left' ? [1, 0, 2] : e.prio === 'right' ? [2, 0, 1] : null;
          for (let k = 0; k < 3; k++) {
            const idx = order ? order[k] : (e.rr + k) % 3;
            if (pushTo(e, (e.dir + [0, 3, 1][idx]) % 4, e.l[ln], ln)) { e.l[ln] = null; if (!order) e.rr = (idx + 1) % 3; break; }
          }
        }
        break;

      case 'sorter':
        for (let ln = 0; ln < 2; ln++) {
          const it = e.l[ln];
          if (!it) continue;
          if (!e.filter || it === e.filter) {
            if (pushTo(e, e.dir, it, ln)) e.l[ln] = null;
          } else {
            for (let k = 0; k < 2; k++) {
              const idx = (e.rr + k) % 2;
              if (pushTo(e, (e.dir + [3, 1][idx]) % 4, it, ln)) { e.l[ln] = null; e.rr = (idx + 1) % 2; break; }
            }
          }
        }
        break;

      case 'station':
        if (e.mode === 'load' || e.total <= 0) break;
        // fallthrough: en modo descarga suelta lo que tiene como un cofre
      case 'chest': case 'steelchest': case 'woodchest':
        if (e.total > 0) {
          for (const k in e.store) {
            if (e.store[k] > 0 && pushTo(e, e.dir, k)) {
              if (--e.store[k] === 0) delete e.store[k];
              e.total--;
              break;
            }
          }
        }
        break;

      case 'miner': case 'eminer': case 'pumpjack': {
        e.active = false;
        if (!e.buf && e.extra > 0) { e.buf = e.extraType; e.extra--; }
        if (!e.buf) {
          const mt = e.type === 'pumpjack' ? (oreAt(e.x, e.y) === 'oil' ? { x: e.x, y: e.y } : null) : minerTile(e.x, e.y, def.area);
          if (!mt) { e.depleted = true; break; }
          e.depleted = false;
          const fx = moduleFx(e);
          let sp = (def.power ? drawPower(e, def.power * fx.power) * fx.speed : 1) * (1 + 0.1 * infLevel('inf_drill'));
          if (e.type === 'miner') {
            if (e.burn <= 0 && e.fuel > 0) { e.burn = MINER_FUEL[e.fuelType]; if (--e.fuel === 0) e.fuelType = null; }
            if (e.burn <= 0) sp = 0;
          }
          e.active = sp > 0;
          e.t += dt * sp;
          if (e.t >= def.time) {
            e.t = Math.min(e.t - def.time, def.time);
            e.buf = mineOre(mt.x, mt.y);
            if (e.type === 'miner') e.burn--;
            if (e.buf) {
              countProduced(e.buf);
              emit(e, def.poll * def.time * fx.poll / 60);
              // Productividad: mineral extra sin gastar el yacimiento
              e.mb = (e.mb || 0) + fx.prod + 0.1 * infLevel('inf_mining');
              if (e.mb >= 1) { e.mb -= 1; e.extra = (e.extra || 0) + 1; e.extraType = e.buf; countProduced(e.buf); }
            }
          }
        }
        // Un taladro común sobre carbón se alimenta solo cuando se queda sin nada
        if (e.type === 'miner' && e.buf && MINER_FUEL[e.buf] && !e.fuel && e.burn <= 0) { e.fuelType = e.buf; e.fuel = 1; e.buf = null; }
        if (e.buf && pushTo(e, e.dir, e.buf)) e.buf = null;
        break;
      }

      case 'furnace': case 'efurnace': {
        e.active = false;
        const r = e.inType && SMELT[e.inType];
        if (r && e.inCount >= r.n && e.outCount < 10 && (!e.outType || e.outType === r.out)) {
          const fx = moduleFx(e);
          let sp = def.speed;
          if (def.power) sp *= drawPower(e, def.power * fx.power) * fx.speed;
          else {
            if (e.burn <= 0 && e.fuel > 0) {
              e.burn = FURNACE_FUEL[e.fuelType];
              if (--e.fuel === 0) e.fuelType = null;
            }
            if (e.burn <= 0) sp = 0;
          }
          if (sp > 0) {
            e.active = true;
            e.prog += dt * sp;
            emit(e, def.poll * dt * sp / 60);
            if (e.prog >= r.time) {
              e.prog = Math.min(e.prog - r.time, r.time);
              if (!def.power) e.burn--;
              e.inCount -= r.n;
              if (e.inCount === 0) e.inType = null;
              e.outType = r.out; e.outCount++;
              countProduced(r.out);
              e.bonus = (e.bonus || 0) + fx.prod;
              if (e.bonus >= 1 && e.outCount < 10) { e.bonus -= 1; e.outCount++; countProduced(r.out); }
            }
          }
        }
        if (e.outCount > 0 && pushTo(e, e.dir, e.outType)) {
          if (--e.outCount === 0) e.outType = null;
        }
        break;
      }

      case 'assembler': case 'assembler2': case 'chem': {
        e.active = false;
        if (!e.recipe) break;
        const rc = RECIPES[e.recipe];
        let ready = e.out < 10;
        for (const k in rc.in) if ((e.buf[k] || 0) < rc.in[k]) ready = false;
        if (ready) {
          const fx = moduleFx(e);
          let sp = def.speed;
          if (def.power) sp *= drawPower(e, def.power * fx.power) * fx.speed;
          if (sp > 0) {
            e.active = true;
            e.prog += dt * sp;
            emit(e, def.poll * dt * sp * fx.poll / 60);
            if (e.prog >= rc.time) {
              e.prog = Math.min(e.prog - rc.time, rc.time);
              for (const k in rc.in) e.buf[k] -= rc.in[k];
              e.out += rc.n;
              countProduced(rc.out, rc.n);
              e.bonus = (e.bonus || 0) + fx.prod;
              if (e.bonus >= 1) { e.bonus -= 1; e.out += rc.n; countProduced(rc.out, rc.n); }
            }
          }
        }
        if (e.out > 0 && pushTo(e, e.dir, rc.out)) e.out--;
        break;
      }

      case 'lab': {
        e.active = false;
        if (!tech || researchDone) break;
        if (!e.working) {
          if (tech.packs.every((p) => (e.packs[p] || 0) >= 1)) {
            for (const p of tech.packs) e.packs[p]--;
            e.working = true;
            e.prog = 0;
          } else break;
        }
        e.active = true;
        const lfx = moduleFx(e);
        const lp = drawPower(e, def.power * lfx.power);
        e.active = lp > 0;
        e.prog += dt * def.speed * lp * lfx.speed * labSpeedMult() / tech.time;
        if (e.prog >= 1) {
          e.prog = 0;
          e.working = false;
          S.research.progress++;
          e.bonus = (e.bonus || 0) + lfx.prod;
          if (e.bonus >= 1) { e.bonus -= 1; S.research.progress++; }
          if (S.research.progress >= techUnits(S.research.current)) researchDone = true;
        }
        break;
      }

      case 'generator': {
        e.active = false;
        const net = nets[e._net];
        if (!net) break;
        if (e.energy <= 0 && e.fuel > 0) {
          e.energy += FUELS[e.fuelType];
          if (--e.fuel === 0) e.fuelType = null;
        }
        if (e.energy > 0) {
          net.fuel += def.output;
          const share = net.prev.fuel > 0 ? def.output / net.prev.fuel : 0;
          const burn = net.fuelUsed * share * dt / GENERATOR_EFFICIENCY;
          e.load = net.prev.fuel > 0 ? net.fuelUsed / net.prev.fuel : 0;
          e.active = burn > 0;
          e.energy -= burn;
          emit(e, def.poll * e.load * dt / 60);
        }
        break;
      }

      case 'offshore':
        if (!e.buf) {
          e.t += dt;
          if (e.t >= def.time) { e.t = 0; e.buf = 'water'; }
        }
        if (e.buf && pushTo(e, e.dir, e.buf)) e.buf = null;
        break;

      case 'boiler': {
        e.active = false;
        if (e.energy < STEAM_ENERGY && e.fuel > 0) {
          e.energy += FUELS[e.fuelType];
          if (--e.fuel === 0) e.fuelType = null;
        }
        if (e.water > 0 && e.energy >= STEAM_ENERGY && e.out < 10) {
          e.t += dt * def.rate;
          e.active = true;
          if (e.t >= 1) { e.t -= 1; e.water--; e.energy -= STEAM_ENERGY; e.out++; countProduced('steam'); }
          emit(e, def.poll * dt / 60);
        }
        if (e.out > 0 && pushTo(e, e.dir, 'steam')) e.out--;
        break;
      }

      case 'steam_engine': {
        e.active = false;
        const net = nets[e._net];
        // El vapor que sobra sigue a la próxima máquina
        if (e.steam >= 5 && pushTo(e, e.dir, 'steam')) e.steam--;
        if (!net) break;
        if (e.energy <= 0 && e.steam > 0) { e.energy += STEAM_ENERGY; e.steam--; }
        if (e.energy > 0) {
          net.fuel += def.output;
          const share = net.prev.fuel > 0 ? def.output / net.prev.fuel : 0;
          const burn = net.fuelUsed * share * dt;
          e.load = net.prev.fuel > 0 ? net.fuelUsed / net.prev.fuel : 0;
          e.active = burn > 0;
          e.energy -= burn;
        }
        break;
      }

      case 'radar': {
        const sp = drawPower(e, def.power);
        e.active = sp > 0.3;
        if (e.active && e.r < def.scan * POLL_CELL) {
          e.t += dt * sp;
          if (e.t >= 1) { e.t = 0; reveal(e.x + 0.5, e.y + 0.5, e.r); e.r += 2; }
        }
        break;
      }

      case 'solar': {
        const net = nets[e._net];
        e.out = def.output * sun;
        if (net) net.solar += e.out;
        break;
      }

      case 'accumulator': {
        const net = nets[e._net];
        if (!net) break;
        if (net.accCount > 0) {
          e.stored = Math.max(0, Math.min(def.capacity, e.stored + (net.accFlow / net.accCount) * dt));
        }
        net.accDis += Math.min(def.rate, e.stored / Math.max(dt, 1e-3));
        net.accChg += Math.min(def.rate, (def.capacity - e.stored) / Math.max(dt, 1e-3));
        e.flow = net.accFlow / Math.max(1, net.accCount);
        break;
      }

      case 'lamp':
        // Con condición, la lámpara sirve de indicador (prende aunque sea de día)
        e.lit = (e.cond || darkness() > 0.15) && drawPower(e, def.power) > 0.5;
        break;

      case 'fusion_plant': {
        const net = nets[e._net];
        e.out = def.output;
        if (net) net.solar += e.out;   // energía directa, como la solar pero sin sol
        e.active = true;
        break;
      }

      case 'purifier': {
        e.rate = 0;
        e.active = false;
        if (e.filters <= 0 && e.left <= 0) break;
        const sp = drawPower(e, def.power);
        if (sp < 0.1) break;
        e.rate = purify(e.x + 1, e.y + 1, def.absorb * sp * dt) / dt;
        e.left -= e.rate * dt;
        if (e.left <= 0 && e.filters > 0) { e.filters--; e.left += FILTER_LIFE; }
        e.active = e.rate > 0.05;
        break;
      }

      case 'nursery': {
        const sp = drawPower(e, def.power);
        e.active = sp > 0.3;
        if (!e.active) break;
        e.t += dt * sp;
        if (e.t < def.every) break;
        e.t = 0;
        // Busca un lugar libre al azar (hasta 12 intentos)
        for (let k = 0; k < 12; k++) {
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * (def.radius - 1);
          const tx = Math.floor(e.x + 1 + Math.cos(a) * r), ty = Math.floor(e.y + 1 + Math.sin(a) * r);
          if (at(tx, ty) || oreAt(tx, ty)) continue;
          if (plantTree(tx, ty)) { S.treesPlanted = (S.treesPlanted || 0) + 1; break; }
        }
        break;
      }

      case 'uplink': {
        const sp = drawPower(e, def.power);
        e.active = sp > 0.3;
        if (!e.active) break;
        e.cd = Math.max(0, e.cd - dt * sp);
        if (e.cd > 0 || e.charges <= 0) break;
        const target = nearestNest(e.x + 1.5, e.y + 1.5);
        if (!target) break;
        e.charges--;
        e.cd = def.reload;
        e.aim = Math.atan2(wdy(target.y + 1 - e.y - 1.5), wdx(target.x + 1 - e.x - 1.5));
        orbitalStrike(target.x + 1, target.y + 1, def.blast);
        break;
      }
    }

    // Los edificios dañados se reparan solos si no los atacan por un rato
    if (e.hp !== undefined && e.type !== 'nest' && S.playTime - (e.hitAt || 0) > 15) {
      e.hp += maxHp(e) * 0.02 * dt;
      if (e.hp >= maxHp(e)) delete e.hp;
    }
  }

  if (researchDone) finishResearch();
  S.stageTimer = (S.stageTimer || 0) + dt;
  if (S.stageTimer >= 1) { S.stageTimer -= 1; stageTick(); }
  updateFluids();
  // Lo que hace el personaje sí es una acción del jugador
  NET.sim--;
  const invBefore = NET.on ? { ...S.inv } : null;
  updatePlayer(dt);
  updateRpg(dt);
  if (invBefore) netInvDelta(invBefore);
  NET.sim++;
  updateTrains(dt);
  updateRobots(dt);
  updateEnemies(dt);
  NET.sim--;
  if (NET.on) NET.shadow = { ...S.inv };
}

// ¿Están todas las piezas de la nave?
function shipReady(e) {
  const need = shipNeeds(e);
  for (const k in need) if ((e.parts[k] || 0) < need[k]) return false;
  return true;
}

// Avance de la nave (etapa 1) o del arca (etapa 3)
function shipProgress(type = stageOf() >= 3 ? 'starport' : 'shipyard') {
  const yard = S.entities.find((e) => e.type === type);
  const needs = type === 'starport' ? ARK : SHIP;
  let have = 0, need = 0;
  for (const k in needs) {
    need += needs[k];
    if (yard) have += Math.min(needs[k], yard.parts[k] || 0);
  }
  return { yard, have, need, frac: have / need };
}

// --------------------------- Etapas ---------------------------

const stageOf = () => S.stage || 1;
const FILTER_LIFE = 60;   // polución que limpia cada filtro

// Objetivo de la etapa 2: sin nidos y con el aire limpio un rato
function cleanupProgress() {
  const nests = S.entities.filter((e) => e.type === 'nest').length;
  const start = Math.max(1, S.nestsAtStage2 || nests);
  const nestFrac = S.peaceful ? 1 : 1 - Math.min(1, nests / start);
  const airFrac = Math.min(1, (S.cleanTime || 0) / CLEAN_TIME);
  return { nests, nestFrac, airFrac, poll: totalPollution(), frac: S.peaceful ? airFrac : (nestFrac + airFrac) / 2 };
}

function stageProgress() {
  const st = stageOf();
  if (st === 2) return cleanupProgress().frac;
  if (st >= 4) return 1;
  return shipProgress().frac;
}

function stageTick() {
  if (stageOf() !== 2) return;
  S.cleanTime = totalPollution() < CLEAN_TARGET ? (S.cleanTime || 0) + 1 : 0;
  const c = cleanupProgress();
  if (c.nests === 0 && c.airFrac >= 1) advanceStage(3);
}

// Pasa a la etapa siguiente (lo llama el despegue y la limpieza)
function advanceStage(n) {
  if (stageOf() >= n) return;
  S.stage = n;
  S.stageTimes = S.stageTimes || {};
  S.stageTimes[n - 1] = S.playTime;
  if (n === 2) {
    // Desde la órbita se ve todo el planeta
    explored.fill(1);
    fogDirty = true;
    S.nestsAtStage2 = S.entities.filter((e) => e.type === 'nest').length;
    S.cleanTime = 0;
  }
  if (typeof showStage === 'function') showStage(n);
}

// Absorbe polución alrededor de un punto (3×3 celdas); devuelve cuánto sacó
function purify(x, y, amount) {
  const c = cellOf(x, y), cx = c % PW, cy = (c / PW) | 0;
  const cells = [];
  let total = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = (((cy + dy) % PH + PH) % PH) * PW + (((cx + dx) % PW + PW) % PW);
    if (pollution[i] > 0) { cells.push(i); total += pollution[i]; }
  }
  if (total <= 0) return 0;
  const take = Math.min(amount, total);
  for (const i of cells) pollution[i] = Math.max(0, pollution[i] - take * pollution[i] / total);
  return take;
}

function nearestNest(x, y) {
  let best = null, bd = Infinity;
  for (const e of S.entities) {
    if (e.type !== 'nest') continue;
    const d = wdist(x, y, e.x + 1, e.y + 1);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Rayo desde la órbita: borra los nidos y bichos de la zona
function orbitalStrike(x, y, r) {
  const hit = S.entities.filter((e) => e.type === 'nest' && wdist(x, y, e.x + 1, e.y + 1) <= r);
  for (const n of hit) removeNest(n, true);
  if (typeof toast === 'function') toast(`☄️ Ataque orbital: ${hit.length} nido${hit.length === 1 ? '' : 's'} menos.`);
  for (const b of S.biters) if (wdist(x, y, b.x, b.y) <= r) b.dead = true;
  if (typeof spawnStrike === 'function') spawnStrike(x, y);
  sfx('boom', x, y);
  S.strikes = (S.strikes || 0) + 1;
}

// --------------------------- Red de señales ---------------------------
// 8 canales de colores. Cada sensor suma lo que lee a su canal.

const SIGNAL_COLORS = ['#e5534b', '#5cc47a', '#3f86e0', '#f0c040', '#b45fe0', '#3cc4c4', '#f08a3a', '#e8e8e8'];
const SIGNAL_NAMES = ['rojo', 'verde', 'azul', 'amarillo', 'violeta', 'celeste', 'naranja', 'blanco'];
const CONDITIONABLE = new Set(['belt', 'fastbelt', 'expressbelt', 'inserter', 'fastinserter', 'miner', 'eminer', 'pumpjack', 'offshore',
  'furnace', 'efurnace', 'assembler', 'assembler2', 'chem', 'lab', 'lamp', 'generator', 'boiler', 'steam_engine', 'splitter', 'sorter', 'radar', 'purifier', 'nursery']);
let signals = new Array(8).fill(0);

function sensorValue(e) {
  const [dx, dy] = DIRS[e.dir];
  const t = at(e.x + dx, e.y + dy);
  if (!t) return 0;
  const it = e.item || '*';
  const fromStore = (st) => (it === '*' ? Object.values(st).reduce((a, b) => a + b, 0) : st[it] || 0);
  if (t.type === 'hub') return Math.floor(fromStore(S.inv));
  if (t.store) return fromStore(t.store);
  if (t.type === 'accumulator') return Math.round(100 * (t.stored || 0) / BUILDINGS.accumulator.capacity);
  if (t.type === 'pipe' || t.type === 'tank') { const n = fnets[t._fnet]; return n && (it === '*' || n.fluid === it) ? Math.floor(n.amount) : 0; }
  if (t.l) return t.l.filter((k) => k && (it === '*' || k === it)).length;
  if (t.parts) return fromStore(t.parts);
  if (t.outCount !== undefined) return it === '*' || t.outType === it ? t.outCount : 0;
  if (t.type === 'turret') return t.ammo || 0;
  return 0;
}

function readSignals() {
  signals = new Array(8).fill(0);
  for (const e of S.entities) {
    if (e.type !== 'sensor') continue;
    e.value = sensorValue(e);
    signals[e.ch || 0] += e.value;
  }
}

function condOk(c) {
  const v = signals[c.ch || 0] || 0;
  return c.op === '>' ? v > c.v : c.op === '=' ? v === c.v : v < c.v;
}
