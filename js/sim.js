'use strict';
// =====================================================================
//  Simulación: edificios, flujo de objetos y red eléctrica
// =====================================================================

let S;     // estado guardable (los campos que empiezan con _ no se guardan)
let grid;  // Array W*H: entidad que ocupa cada casilla
let nets = [];          // redes eléctricas
let wires = [];         // cables entre postes [x1, y1, x2, y2]
let powerDirty = true;  // recalcular redes
let undergroundDirty = true;

function newState(seed) {
  return {
    v: 2,
    seed,
    inv: { iron_plate: 60, stone: 30, coal: 20 },
    delivered: {},
    produced: {},
    techs: {},
    entities: [],
    playTime: 0,
    launched: false,
    nextId: 1,
  };
}

const add = (obj, k, n) => { obj[k] = (obj[k] || 0) + n; };
const at = (x, y) => (inBounds(x, y) ? grid[y * W + x] : null);
const sizeOf = (type) => (type === 'hub' ? 3 : BUILDINGS[type]?.size || 1);
const isBelt = (type) => BELTS.has(type);
const hasTech = (id) => !id || !!S.techs[id];
const isUnlocked = (type) => hasTech(BUILDINGS[type].tech);

function canAfford(cost) {
  for (const k in cost) if ((S.inv[k] || 0) < cost[k]) return false;
  return true;
}
function pay(cost) { for (const k in cost) S.inv[k] -= cost[k]; }
function refund(cost) { for (const k in cost) add(S.inv, k, cost[k]); }

// Estadísticas de producción (no se guardan)
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

// --------------------------- Entidades ---------------------------

function makeEntity(type, x, y, dir = 0) {
  const e = { id: 0, type, x, y, dir: NO_DIR.has(type) ? 0 : dir };
  switch (type) {
    case 'belt': case 'fastbelt': case 'expressbelt': e.item = null; e.prog = 0; break;
    case 'underground': e.item = null; e.prog = 0; e.mode = 'in'; break;
    case 'splitter': e.item = null; e.rr = 0; break;
    case 'sorter': e.item = null; e.rr = 0; e.filter = null; break;
    case 'chest': e.store = {}; e.total = 0; break;
    case 'miner': case 'eminer': e.t = 0; e.buf = null; break;
    case 'furnace': case 'efurnace':
      e.inType = null; e.inCount = 0; e.fuelType = null; e.fuel = 0; e.burn = 0;
      e.prog = 0; e.outType = null; e.outCount = 0; break;
    case 'assembler': case 'assembler2': e.recipe = null; e.buf = {}; e.prog = 0; e.out = 0; break;
    case 'generator': e.fuelType = null; e.fuel = 0; e.energy = 0; break;
    case 'shipyard': e.parts = {}; break;
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
  if (e.buf && typeof e.buf === 'string') add(c, e.buf, 1);
  if (e.inType) add(c, e.inType, e.inCount);
  if (e.outType) add(c, e.outType, e.outCount);
  if (e.fuelType) add(c, e.fuelType, e.fuel);
  if (e.store) for (const k in e.store) add(c, k, e.store[k]);
  if (e.parts) for (const k in e.parts) add(c, k, e.parts[k]);
  if (e.type === 'assembler' || e.type === 'assembler2') {
    for (const k in e.buf) add(c, k, e.buf[k]);
    if (e.out && e.recipe) add(c, RECIPES[e.recipe].out, e.out * RECIPES[e.recipe].n);
  }
  return c;
}

function canPlace(type, x, y) {
  const s = sizeOf(type);
  if (!inBounds(x, y) || !inBounds(x + s - 1, y + s - 1)) return { ok: false, why: 'Fuera del mapa' };
  if (s === 1) {
    const existing = at(x, y);
    if (existing) {
      // Pasar una cinta por encima de otra igual la gira
      if (existing.type === type && isBelt(type)) return { ok: true, rotate: existing };
      return { ok: false, why: 'Casilla ocupada' };
    }
  } else {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      if (at(x + dx, y + dy)) return { ok: false, why: 'Hay algo en el medio' };
    }
  }
  if ((type === 'miner' || type === 'eminer') && !oreAt(x, y)) return { ok: false, why: 'El taladro va sobre mineral' };
  if (!isUnlocked(type)) return { ok: false, why: 'Falta investigar: ' + TECHS[BUILDINGS[type].tech].name };
  if (!canAfford(BUILDINGS[type].cost)) return { ok: false, why: 'Faltan materiales' };
  return { ok: true };
}

function place(type, x, y, dir) {
  const res = canPlace(type, x, y);
  if (!res.ok) return null;
  if (res.rotate) { res.rotate.dir = dir; return res.rotate; }
  pay(BUILDINGS[type].cost);
  const e = makeEntity(type, x, y, dir);
  e.id = S.nextId++;
  if (type === 'underground') e.mode = undergroundModeFor(x, y, dir);
  S.entities.push(e);
  occupy(e, e);
  powerDirty = true;
  undergroundDirty = true;
  return e;
}

function removeEntity(e) {
  if (!e || e.type === 'hub') return false;
  refund(BUILDINGS[e.type].cost);
  refund(contents(e));
  occupy(e, null);
  S.entities.splice(S.entities.indexOf(e), 1);
  powerDirty = true;
  undergroundDirty = true;
  return true;
}

function rotateEntity(e, step) {
  if (!e || NO_DIR.has(e.type)) return;
  e.dir = (e.dir + step + 4) % 4;
  undergroundDirty = true;
}

// --------------------------- Cintas subterráneas ---------------------------

// Si hay una entrada sin salida detrás en la misma dirección, esta pieza es la salida
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

function rebuildPower() {
  powerDirty = false;
  nets = [];
  const poles = S.entities.filter((e) => e.type === 'pole');
  for (const p of poles) p._net = -1;
  for (const p of poles) {
    if (p._net >= 0) continue;
    const id = nets.length;
    nets.push({ demand: 0, cap: 0, sat: 0, used: 0, prevCap: 0, prevDemand: 0, poles: 0 });
    const stack = [p];
    p._net = id;
    while (stack.length) {
      const q = stack.pop();
      nets[id].poles++;
      for (const r of poles) {
        if (r._net < 0 && Math.hypot(r.x - q.x, r.y - q.y) <= POLE_REACH) { r._net = id; stack.push(r); }
      }
    }
  }
  wires = [];
  for (let i = 0; i < poles.length; i++) {
    for (let j = i + 1; j < poles.length; j++) {
      const a = poles[i], b = poles[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) <= POLE_REACH) wires.push([a.x, a.y, b.x, b.y]);
    }
  }
  for (const e of S.entities) {
    const d = BUILDINGS[e.type];
    if (!d || !(d.power || d.output)) continue;
    e._net = -1;
    for (let dy = -POLE_SUPPLY; dy <= POLE_SUPPLY && e._net < 0; dy++) {
      for (let dx = -POLE_SUPPLY; dx <= POLE_SUPPLY; dx++) {
        const p = at(e.x + dx, e.y + dy);
        if (p && p.type === 'pole') { e._net = p._net; break; }
      }
    }
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
      if ((t.inType && t.inType !== item) || t.inCount >= Math.max(10, r.n * 4)) return false;
      t.inType = item; t.inCount++;
      return true;
    }
    case 'assembler': case 'assembler2': {
      if (!t.recipe) return false;
      const need = RECIPES[t.recipe].in[item];
      if (!need || (t.buf[item] || 0) >= need * 2) return false;
      add(t.buf, item, 1);
      return true;
    }
    case 'generator':
      if (!FUELS[item] || t.fuel >= 20 || (t.fuelType && t.fuelType !== item)) return false;
      t.fuelType = item; t.fuel++;
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
  return !!t && t !== e && accept(t, item, e);
}

// --------------------------- Actualización ---------------------------

function update(dt) {
  if (powerDirty) rebuildPower();
  if (undergroundDirty) pairUndergrounds();
  S.playTime += dt;
  tickStats(dt);

  for (const n of nets) {
    n.sat = n.demand > 0 ? Math.min(1, n.cap / n.demand) : 1;
    n.used = Math.min(n.demand, n.cap);
    n.prevCap = n.cap; n.prevDemand = n.demand;
    n.demand = 0; n.cap = 0;
  }

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

      case 'miner': case 'eminer': {
        e.active = false;
        if (!e.buf) {
          if (!oreAt(e.x, e.y)) { e.depleted = true; break; }
          const sp = e.type === 'eminer' ? drawPower(e, def.power) : 1;
          e.active = sp > 0;
          e.t += dt * sp;
          if (e.t >= def.time) {
            e.t = 0;
            e.buf = mineOre(e.x, e.y);
            if (e.buf) countProduced(e.buf);
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
          if (e.type === 'efurnace') sp *= drawPower(e, def.power);
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
            if (e.prog >= r.time) {
              e.prog = 0;
              if (e.type === 'furnace') e.burn--;
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

      case 'assembler': case 'assembler2': {
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

      case 'generator': {
        e.active = false;
        const net = nets[e._net];
        if (!net) break;
        if (e.energy <= 0 && e.fuel > 0) {
          e.energy += FUELS[e.fuelType];
          if (--e.fuel === 0) e.fuelType = null;
        }
        if (e.energy > 0) {
          net.cap += def.output;
          const share = net.prevCap > 0 ? def.output / net.prevCap : 0;
          const burn = net.used * share * dt;
          e.active = burn > 0;
          e.load = net.prevCap > 0 ? net.used / net.prevCap : 0;
          e.energy -= burn;
        }
        break;
      }

      case 'solar': {
        const net = nets[e._net];
        if (net) net.cap += def.output;
        break;
      }
    }
  }
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
