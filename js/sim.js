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

function newState(seed, peaceful) {
  return {
    v: SAVE_VERSION,
    seed,
    peaceful: !!peaceful,
    inv: { iron_plate: 80, copper_plate: 20, stone: 50, coal: 30 },
    delivered: {},
    produced: {},
    techs: {},
    research: { current: null, progress: 0 },
    entities: [],
    biters: [],
    pollution: null,
    evo: 0,
    expandTimer: 600,
    dayTime: 0.1,
    day: 1,
    playTime: 0,
    launched: 0,
    nextId: 1,
  };
}

const add = (obj, k, n) => { obj[k] = (obj[k] || 0) + n; };
const at = (x, y) => (inBounds(x, y) ? grid[y * W + x] : null);
const sizeOf = (type) => (type === 'hub' ? 3 : type === 'nest' ? 2 : BUILDINGS[type]?.size || 1);
const isBelt = (type) => BELTS.has(type);
const hasTech = (id) => !id || !!S.techs[id];
const isUnlocked = (type) => hasTech(BUILDINGS[type].tech);
const maxHp = (e) => (e.type === 'hub' ? 5000 : e.type === 'nest' ? NEST_HP : BUILDINGS[e.type]?.hp || 100);
const isPlayer = (e) => e && e.type !== 'nest';

function canAfford(cost) {
  for (const k in cost) if ((S.inv[k] || 0) < cost[k]) return false;
  return true;
}
function pay(cost) { for (const k in cost) S.inv[k] -= cost[k]; }
function refund(cost) { for (const k in cost) add(S.inv, k, cost[k]); }

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
    case 'belt': case 'fastbelt': case 'expressbelt': e.item = null; e.prog = 0; break;
    case 'underground': e.item = null; e.prog = 0; e.mode = 'in'; break;
    case 'splitter': e.item = null; e.rr = 0; break;
    case 'sorter': e.item = null; e.rr = 0; e.filter = null; break;
    case 'chest': e.store = {}; e.total = 0; break;
    case 'miner': case 'eminer': case 'pumpjack': e.t = 0; e.buf = null; break;
    case 'furnace': case 'efurnace':
      e.inType = null; e.inCount = 0; e.fuelType = null; e.fuel = 0; e.burn = 0;
      e.prog = 0; e.outType = null; e.outCount = 0; break;
    case 'assembler': case 'assembler2': case 'chem': e.recipe = null; e.buf = {}; e.prog = 0; e.out = 0; break;
    case 'lab': e.packs = {}; e.prog = 0; e.working = false; break;
    case 'generator': e.fuelType = null; e.fuel = 0; e.energy = 0; break;
    case 'accumulator': e.stored = 0; break;
    case 'turret': e.ammo = 0; e.shots = 0; e.cd = 0; break;
    case 'laser': e.cd = 0; break;
    case 'shipyard': e.parts = {}; break;
    case 'nest': e.anger = 0; e.group = 0; e.groupTimer = 0; break;
  }
  return e;
}

function occupy(e, value) {
  const s = sizeOf(e.type);
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) grid[(e.y + dy) * W + e.x + dx] = value;
}

function rebuildGrid() {
  grid = new Array(W * H).fill(null);
  for (const e of S.entities) occupy(e, e);
  powerDirty = true;
  undergroundDirty = true;
}

// Objetos guardados dentro de un edificio (se devuelven al desarmarlo)
function contents(e) {
  const c = {};
  if (e.item) add(c, e.item, 1);
  if (typeof e.buf === 'string') add(c, e.buf, 1);
  if (e.inType) add(c, e.inType, e.inCount);
  if (e.outType) add(c, e.outType, e.outCount);
  if (e.fuelType) add(c, e.fuelType, e.fuel);
  if (e.store) for (const k in e.store) add(c, k, e.store[k]);
  if (e.parts) for (const k in e.parts) add(c, k, e.parts[k]);
  if (e.packs) for (const k in e.packs) add(c, k, e.packs[k]);
  if (e.type === 'turret' && e.ammo) add(c, 'ammo', e.ammo);
  if (e.recipe) {
    for (const k in e.buf) add(c, k, e.buf[k]);
    if (e.out) add(c, RECIPES[e.recipe].out, e.out);
  }
  return c;
}

function canPlace(type, x, y) {
  const s = sizeOf(type);
  if (!inBounds(x, y) || !inBounds(x + s - 1, y + s - 1)) return { ok: false, why: 'Fuera del mapa' };
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
  const o = oreAt(x, y);
  if ((type === 'miner' || type === 'eminer') && (!o || o === 'oil')) return { ok: false, why: 'El taladro va sobre mineral' };
  if (type === 'pumpjack' && o !== 'oil') return { ok: false, why: 'La bomba va sobre un pozo de petróleo' };
  if (!isUnlocked(type)) return { ok: false, why: 'Falta investigar: ' + TECHS[BUILDINGS[type].tech].name };
  if (!canAfford(BUILDINGS[type].cost)) return { ok: false, why: 'Faltan materiales' };
  return { ok: true };
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
      if (S.entities.includes(op.e)) { op.e.dir = op.from; undergroundDirty = true; n++; }
    }
  }
  return n;
}

// --------------------------- Construir y desarmar ---------------------------

function place(type, x, y, dir, opts = {}) {
  const res = canPlace(type, x, y);
  if (!res.ok) return null;
  if (res.rotate) {
    if (res.rotate.dir !== dir) {
      if (!opts.silent) record({ kind: 'rotate', e: res.rotate, from: res.rotate.dir });
      res.rotate.dir = dir;
    }
    return res.rotate;
  }
  pay(BUILDINGS[type].cost);
  const e = makeEntity(type, x, y, dir);
  e.id = S.nextId++;
  if (type === 'underground') e.mode = undergroundModeFor(x, y, dir);
  S.entities.push(e);
  occupy(e, e);
  powerDirty = true;
  undergroundDirty = true;
  if (!opts.silent) record({ kind: 'place', e });
  return e;
}

function removeEntity(e, opts = {}) {
  if (!e || e.type === 'hub' || e.type === 'nest' || !S.entities.includes(e)) return false;
  if (!opts.destroyed) {
    refund(BUILDINGS[e.type].cost);
    refund(contents(e));
    if (!opts.silent) record({ kind: 'remove', snap: snapshot(e) });
  }
  occupy(e, null);
  S.entities.splice(S.entities.indexOf(e), 1);
  e._dead = true;
  powerDirty = true;
  undergroundDirty = true;
  return true;
}

function rotateEntity(e, step) {
  if (!e || NO_DIR.has(e.type)) return;
  record({ kind: 'rotate', e, from: e.dir });
  e.dir = (e.dir + step + 4) % 4;
  undergroundDirty = true;
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
    }
  }
}

function removeNest(e) {
  occupy(e, null);
  S.entities.splice(S.entities.indexOf(e), 1);
  e._dead = true;
  S.evo = Math.min(1, S.evo + 0.002);
  spawnExplosion(e.x + 1, e.y + 1, 1.6);
  toast('💥 Destruiste un nido');
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
        if (r._net < 0 && Math.hypot(r.x - q.x, r.y - q.y) <= reach(q, r)) { r._net = id; stack.push(r); }
      }
    }
  }
  wires = [];
  for (let i = 0; i < poles.length; i++) {
    for (let j = i + 1; j < poles.length; j++) {
      const a = poles[i], b = poles[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) <= reach(a, b)) wires.push([a.x, a.y, b.x, b.y, a.type === 'bigpole' && b.type === 'bigpole']);
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
      if (p.x + sup >= e.x && p.x - sup <= e.x + s - 1 && p.y + sup >= e.y && p.y - sup <= e.y + s - 1) { e._net = p._net; break; }
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

// Factor de velocidad para un consumidor eléctrico (y registra su demanda)
function drawPower(e, kw) {
  const net = nets[e._net];
  if (!net) return 0;
  net.demand += kw;
  return net.sat;
}

// --------------------------- Flujo de objetos ---------------------------

function accept(t, item, src) {
  switch (t.type) {
    case 'hub':
      add(S.inv, item, 1);
      add(S.delivered, item, 1);
      return true;
    case 'belt': case 'fastbelt': case 'expressbelt': {
      if (t.item) return false;
      const [dx, dy] = DIRS[t.dir];
      if (at(t.x + dx, t.y + dy) === src) return false; // no aceptar desde adelante
      t.item = item; t.prog = 0;
      return true;
    }
    case 'underground': {
      if (t.mode !== 'in' || t.item) return false;
      const [dx, dy] = DIRS[t.dir];
      if (at(t.x + dx, t.y + dy) === src) return false;
      t.item = item; t.prog = 0;
      return true;
    }
    case 'splitter': case 'sorter':
      if (t.item) return false;
      t.item = item;
      return true;
    case 'chest':
      if (t.total >= 200) return false;
      add(t.store, item, 1); t.total++;
      return true;
    case 'furnace': case 'efurnace': {
      if (t.type === 'furnace' && FURNACE_FUEL[item]) {
        if (t.fuel >= 10 || (t.fuelType && t.fuelType !== item)) return false;
        t.fuelType = item; t.fuel++;
        return true;
      }
      const r = SMELT[item];
      if (!r || !hasTech(r.tech)) return false;
      if ((t.inType && t.inType !== item) || t.inCount >= Math.max(10, r.n * 3)) return false;
      t.inType = item; t.inCount++;
      return true;
    }
    case 'assembler': case 'assembler2': case 'chem': {
      if (!t.recipe) return false;
      const need = RECIPES[t.recipe].in[item];
      if (!need || (t.buf[item] || 0) >= need * 2) return false;
      add(t.buf, item, 1);
      return true;
    }
    case 'lab':
      if (!PACKS.includes(item) || (t.packs[item] || 0) >= 10) return false;
      add(t.packs, item, 1);
      return true;
    case 'generator':
      if (!FUELS[item] || t.fuel >= 20 || (t.fuelType && t.fuelType !== item)) return false;
      t.fuelType = item; t.fuel++;
      return true;
    case 'turret':
      if (item !== 'ammo' || t.ammo >= 20) return false;
      t.ammo++;
      return true;
    case 'shipyard':
      if (!SHIP[item] || (t.parts[item] || 0) >= SHIP[item]) return false;
      add(t.parts, item, 1);
      return true;
  }
  return false;
}

function pushTo(e, dir, item) {
  const [dx, dy] = DIRS[dir];
  const t = at(e.x + dx, e.y + dy);
  return !!t && t !== e && t.type !== 'nest' && accept(t, item, e);
}

// --------------------------- Investigación ---------------------------

function techAvailable(id) {
  return !S.techs[id] && TECHS[id].req.every((r) => S.techs[r]);
}

function setResearch(id) {
  if (!techAvailable(id)) return;
  if (S.research.current !== id) S.research = { current: id, progress: 0 };
}

function finishResearch() {
  const id = S.research.current;
  S.techs[id] = true;
  S.research = { current: null, progress: 0 };
  for (const e of S.entities) if (e.type === 'lab') { e.prog = 0; e.working = false; }
  toast(`🔬 Investigación terminada: <b>${TECHS[id].name}</b>`);
  onTechFinished(id);
  save();
}

function eraIndex() {
  let i = 0;
  ERAS.forEach((era, k) => { if (!era.tech || S.techs[era.tech]) i = k; });
  return i;
}

function weaponMult() {
  return 1 + (S.techs.weapons1 ? 0.3 : 0) + (S.techs.weapons2 ? 0.5 : 0);
}

// --------------------------- Actualización ---------------------------

function update(dt) {
  if (powerDirty) rebuildPower();
  if (undergroundDirty) pairUndergrounds();
  S.playTime += dt;
  tickStats(dt);
  S.dayTime += dt / DAY_LENGTH;
  if (S.dayTime >= 1) { S.dayTime -= 1; S.day++; }
  balancePower(dt);
  const sun = sunLevel();
  const tech = S.research.current && TECHS[S.research.current];
  let researchDone = false;

  for (const e of S.entities) {
    const def = BUILDINGS[e.type];
    switch (e.type) {
      case 'belt': case 'fastbelt': case 'expressbelt':
        if (e.item) {
          e.prog = Math.min(1, e.prog + dt * def.speed);
          if (e.prog >= 1 && pushTo(e, e.dir, e.item)) e.item = null;
        }
        break;

      case 'underground':
        if (!e.item) break;
        e.prog += dt * def.speed;
        if (e.mode === 'in') {
          const p = e._pair;
          if (!p) { e.prog = Math.min(e.prog, 0.5); break; }
          if (e.prog >= e._dist && !p.item) { p.item = e.item; p.prog = 0.5; e.item = null; }
          else e.prog = Math.min(e.prog, e._dist);
        } else {
          e.prog = Math.min(1, e.prog);
          if (e.prog >= 1 && pushTo(e, e.dir, e.item)) e.item = null;
        }
        break;

      case 'splitter':
        if (e.item) {
          for (let k = 0; k < 3; k++) {
            const idx = (e.rr + k) % 3;
            if (pushTo(e, (e.dir + [0, 3, 1][idx]) % 4, e.item)) { e.item = null; e.rr = (idx + 1) % 3; break; }
          }
        }
        break;

      case 'sorter':
        if (e.item) {
          if (!e.filter || e.item === e.filter) {
            if (pushTo(e, e.dir, e.item)) e.item = null;
          } else {
            for (let k = 0; k < 2; k++) {
              const idx = (e.rr + k) % 2;
              if (pushTo(e, (e.dir + [3, 1][idx]) % 4, e.item)) { e.item = null; e.rr = (idx + 1) % 2; break; }
            }
          }
        }
        break;

      case 'chest':
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
        if (!e.buf) {
          if (!oreAt(e.x, e.y)) { e.depleted = true; break; }
          const sp = def.power ? drawPower(e, def.power) : 1;
          e.active = sp > 0;
          e.t += dt * sp;
          if (e.t >= def.time) {
            e.t = 0;
            e.buf = mineOre(e.x, e.y);
            if (e.buf) { countProduced(e.buf); emit(e, def.poll * def.time / 60); }
          }
        }
        if (e.buf && pushTo(e, e.dir, e.buf)) e.buf = null;
        break;
      }

      case 'furnace': case 'efurnace': {
        e.active = false;
        const r = e.inType && SMELT[e.inType];
        if (r && e.inCount >= r.n && e.outCount < 10 && (!e.outType || e.outType === r.out)) {
          let sp = def.speed;
          if (def.power) sp *= drawPower(e, def.power);
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
              e.prog = 0;
              if (!def.power) e.burn--;
              e.inCount -= r.n;
              if (e.inCount === 0) e.inType = null;
              e.outType = r.out; e.outCount++;
              countProduced(r.out);
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
          let sp = def.speed;
          if (def.power) sp *= drawPower(e, def.power);
          if (sp > 0) {
            e.active = true;
            e.prog += dt * sp;
            emit(e, def.poll * dt * sp / 60);
            if (e.prog >= rc.time) {
              e.prog = 0;
              for (const k in rc.in) e.buf[k] -= rc.in[k];
              e.out += rc.n;
              countProduced(rc.out, rc.n);
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
        e.prog += dt * def.speed / tech.time;
        if (e.prog >= 1) {
          e.prog = 0;
          e.working = false;
          S.research.progress++;
          if (S.research.progress >= tech.units) researchDone = true;
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
          const burn = net.fuelUsed * share * dt;
          e.load = net.prev.fuel > 0 ? net.fuelUsed / net.prev.fuel : 0;
          e.active = burn > 0;
          e.energy -= burn;
          emit(e, def.poll * e.load * dt / 60);
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
        e.lit = darkness() > 0.15 && drawPower(e, def.power) > 0.5;
        break;
    }

    // Los edificios dañados se reparan solos si no los atacan por un rato
    if (e.hp !== undefined && e.type !== 'nest' && S.playTime - (e.hitAt || 0) > 15) {
      e.hp += maxHp(e) * 0.02 * dt;
      if (e.hp >= maxHp(e)) delete e.hp;
    }
  }

  if (researchDone) finishResearch();
  updateEnemies(dt);
}

// ¿Están todas las piezas de la nave?
function shipReady(e) {
  for (const k in SHIP) if ((e.parts[k] || 0) < SHIP[k]) return false;
  return true;
}

function shipProgress() {
  const yard = S.entities.find((e) => e.type === 'shipyard');
  let have = 0, need = 0;
  for (const k in SHIP) {
    need += SHIP[k];
    if (yard) have += Math.min(SHIP[k], yard.parts[k] || 0);
  }
  return { yard, have, need, frac: have / need };
}
