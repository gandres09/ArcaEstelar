'use strict';
// =====================================================================
//  Trenes: vías, estaciones y trenes que recorren su red
// =====================================================================

const TRAIN_SPEED = 6;          // casillas por segundo
const TRAIN_SLOW = 1;           // sin combustible
const TRAIN_POWER = 150;        // kW al moverse
const TRAIN_CAP = 800;          // objetos (2 vagones)
const STATION_CAP = 800;
const STATION_WAIT = 3;         // segundos de carga y descarga

const isRail = (e) => !!e && (e.type === 'rail' || e.type === 'station' || e.type === 'signal' || e.type === 'chainsignal');
const RAILISH = new Set(['rail', 'station', 'signal', 'chainsignal']);
const isSignal = (e) => !!e && (e.type === 'signal' || e.type === 'chainsignal');

// Vagones: 'c' de carga (400 objetos) y 'f' de fluidos (2500 de un líquido)
const WAGON_CAP = 400, FLUID_WAGON_CAP = 2500, MAX_WAGONS = 6, STATION_FLUID = 2500;
const WAGON_COST = { c: { gear: 10, iron_plate: 20, steel: 20 }, f: { gear: 10, iron_plate: 16, steel: 16 } };
const wagonsOf = (t) => t.wagons || ['c', 'c'];
const trainCap = (t) => WAGON_CAP * wagonsOf(t).filter((w) => w === 'c').length;
const fluidCap = (t) => FLUID_WAGON_CAP * wagonsOf(t).filter((w) => w === 'f').length;
const trainFull = (t) => t.total >= trainCap(t) && (!fluidCap(t) || (t.fl && t.fl.n >= fluidCap(t)));
const trainEmpty = (t) => t.total <= 0 && !(t.fl && t.fl.n > 0);

// --------------------------- Tramos (señales) ---------------------------
// Las señales cortan la vía en tramos. Se recalculan cuando cambian las vías.
let railDirty = true;
let railBlock = new Map();   // casilla -> número de tramo

function rebuildBlocks() {
  railDirty = false;
  railBlock = new Map();
  let id = 0;
  for (const e of S.entities) {
    if (e.type !== 'rail' && e.type !== 'station') continue;
    const k0 = e.y * W + e.x;
    if (railBlock.has(k0)) continue;
    id++;
    const stack = [[e.x, e.y]];
    railBlock.set(k0, id);
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of DIRS) {
        const nx = wrapX(x + dx), ny = wrapY(y + dy), n = at(nx, ny);
        if (!n || (n.type !== 'rail' && n.type !== 'station')) continue;   // la señal corta
        const k = ny * W + nx;
        if (railBlock.has(k)) continue;
        railBlock.set(k, id);
        stack.push([nx, ny]);
      }
    }
  }
}

function blockOf(x, y) {
  if (railDirty) rebuildBlocks();
  return railBlock.get(wrapY(y) * W + wrapX(x)) || 0;
}

// Casillas que ocupa un tren (locomotora y vagones)
function trainTiles(t) {
  const tiles = [[Math.round(t.x), Math.round(t.y)]];
  for (let d = 1; d <= wagonsOf(t).length + 1; d++) { const p = trainTrail(t, d); tiles.push([Math.round(p.x), Math.round(p.y)]); }
  return tiles;
}

// ¿Hay otro tren en ese tramo (o lo reservó)?
function blockBusy(b, t) {
  if (!b) return false;
  for (const o of S.trains) {
    if (o === t) continue;
    if (o.claim === b) return true;
    for (const [x, y] of trainTiles(o)) if (blockOf(x, y) === b) return true;
  }
  return false;
}

// La luz de una señal: roja si alguno de los tramos que separa tiene un tren
function signalRed(e) {
  for (const [dx, dy] of DIRS) {
    const b = blockOf(e.x + dx, e.y + dy);
    if (b && blockBusy(b, null)) return true;
  }
  return false;
}

// Vías vecinas de una casilla (en el orden de DIRS)
function railLinks(x, y) {
  return DIRS.map(([dx, dy]) => isRail(at(x + dx, y + dy)));
}

function trainAt(x, y) {
  return S.trains.find((t) => wrapX(Math.round(t.x)) === wrapX(x) && wrapY(Math.round(t.y)) === wrapY(y));
}

// Camino por las vías hasta la estación, en casillas
function railPath(sx, sy, station) {
  const key = (x, y) => y * W + x;
  sx = wrapX(sx); sy = wrapY(sy);
  const from = new Map([[key(sx, sy), -1]]);
  const queue = [[sx, sy]];
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = queue[qi];
    if (x === station.x && y === station.y) {
      const path = [];
      let k = key(x, y);
      while (k !== -1) { path.push({ x: k % W, y: (k / W) | 0 }); k = from.get(k); }
      return path.reverse();
    }
    for (const [dx, dy] of DIRS) {
      const nx = wrapX(x + dx), ny = wrapY(y + dy);
      if (!isRail(at(nx, ny)) || from.has(key(nx, ny))) continue;
      from.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

function stationsReachable(sx, sy) {
  sx = wrapX(sx); sy = wrapY(sy);
  const seen = new Set([sy * W + sx]);
  const queue = [[sx, sy]];
  const found = [];
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = queue[qi];
    const e = at(x, y);
    if (e && e.type === 'station') found.push(e);
    for (const [dx, dy] of DIRS) {
      const nx = wrapX(x + dx), ny = wrapY(y + dy), k = ny * W + nx;
      if (seen.has(k) || !isRail(at(nx, ny))) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return found.sort((a, b) => a.id - b.id);
}

function canPlaceTrain(x, y) {
  if (!isRail(at(x, y))) return { ok: false, why: 'El tren va sobre una vía' };
  if (trainAt(x, y)) return { ok: false, why: 'Ya hay un tren ahí' };
  if (!isUnlocked('train')) return { ok: false, why: 'Falta investigar: Trenes' };
  if (!canAfford(BUILDINGS.train.cost)) return { ok: false, why: 'Faltan materiales' };
  return { ok: true };
}

function placeTrain(x, y, free = false) {
  if (!free && !canPlaceTrain(x, y).ok) return null;
  if (!free) pay(BUILDINGS.train.cost);
  const t = { id: S.nextId++, type: 'train', x: wrapX(x), y: wrapY(y), cargo: {}, total: 0, fuelType: null, fuel: 0, energy: 0, state: 'idle', wait: 0, target: null, last: null, ang: 0 };
  S.trains.push(t);
  return t;
}

function removeTrain(t, noRefund = false) {
  netPush({ k: 'tr', x: Math.round(t.x), y: Math.round(t.y) });
  if (noRefund) { S.trains.splice(S.trains.indexOf(t), 1); t._dead = true; return; }
  refund(BUILDINGS.train.cost);
  // El costo del tren trae 2 vagones de carga: se ajusta por los que se agregaron o sacaron
  const w = wagonsOf(t), nc = w.filter((x) => x === 'c').length, nf = w.length - nc;
  for (let i = 2; i < nc; i++) refund(WAGON_COST.c);
  for (let i = 0; i < nf; i++) refund(WAGON_COST.f);
  if (nc < 2) for (const k in WAGON_COST.c) S.inv[k] = (S.inv[k] || 0) - WAGON_COST.c[k] * (2 - nc);
  if (t.fl && t.fl.n >= 1) add(S.inv, t.fl.k, Math.floor(t.fl.n));
  for (const k in t.cargo) add(S.inv, k, t.cargo[k]);
  if (t.fuelType) add(S.inv, t.fuelType, t.fuel);
  S.trains.splice(S.trains.indexOf(t), 1);
  t._dead = true;
}

// Próxima parada: la del horario, o (sin horario) la siguiente estación de la red
function stationById(id) { return S.entities.find((e) => e.id === id && e.type === 'station'); }
function scheduleTarget(t) {
  const sch = t.schedule || [];
  for (let k = 0; k < sch.length; k++) {
    const st = stationById(sch[t.si || 0].st);
    if (st) return st;
    t.si = ((t.si || 0) + 1) % sch.length;
  }
  return null;
}
const stationName = (s) => (s && (s.name || `Estación ${s.id}`)) || '—';

function nextStation(t) {
  const list = stationsReachable(Math.round(t.x), Math.round(t.y));
  if (!list.length) return null;
  const i = list.findIndex((s) => s.id === t.last);
  return list[(i + 1) % list.length];
}

// Al llegar a una estación: combustible, carga o descarga
function serveStation(t, st) {
  for (const f of ['solid_fuel', 'coal']) {
    if ((st.store[f] || 0) > 0 && (!t.fuelType || t.fuelType === f) && t.fuel < 10) {
      const n = Math.min(st.store[f], 10 - t.fuel);
      st.store[f] -= n; st.total -= n; if (!st.store[f]) delete st.store[f];
      t.fuel += n; t.fuelType = f;
    }
  }
  // Líquidos (vagones de fluidos)
  const fc = fluidCap(t);
  if (fc && st.fl && st.mode === 'load' && st.fl.n >= 1 && (!t.fl || !t.fl.n || t.fl.k === st.fl.k)) {
    t.fl = t.fl && t.fl.n ? t.fl : { k: st.fl.k, n: 0 };
    const n = Math.min(st.fl.n, fc - t.fl.n);
    t.fl.n += n; st.fl.n -= n; if (st.fl.n < 1) st.fl = null;
  } else if (fc && t.fl && t.fl.n >= 1 && st.mode !== 'load' && (!st.fl || st.fl.k === t.fl.k)) {
    st.fl = st.fl || { k: t.fl.k, n: 0 };
    const n = Math.min(t.fl.n, STATION_FLUID - st.fl.n);
    st.fl.n += n; t.fl.n -= n; if (t.fl.n < 1) t.fl = null;
  }
  if (st.mode === 'load') {
    for (const k of Object.keys(st.store)) {
      const n = Math.min(st.store[k], trainCap(t) - t.total);
      if (n <= 0) break;
      st.store[k] -= n; st.total -= n; if (!st.store[k]) delete st.store[k];
      add(t.cargo, k, n); t.total += n;
    }
  } else {
    for (const k of Object.keys(t.cargo)) {
      const n = Math.min(t.cargo[k], STATION_CAP - st.total);
      if (n <= 0) break;
      t.cargo[k] -= n; t.total -= n; if (!t.cargo[k]) delete t.cargo[k];
      add(st.store, k, n); st.total += n;
    }
  }
}

function updateTrains(dt) {
  stationFluidStep();
  for (const t of S.trains) {
    const tx = Math.round(t.x), ty = Math.round(t.y);
    if (!isRail(at(tx, ty))) { t.state = 'idle'; t._path = null; continue; }   // le sacaron la vía
    if (t.state === 'waiting') {
      const sch = t.schedule && t.schedule.length ? t.schedule[t.si || 0] : null;
      t.wait -= dt;
      // Mientras espera sigue cargando o descargando
      t.serveT = (t.serveT || 0) + dt;
      if (t.serveT >= 1) { t.serveT = 0; const st = stationById(t.last); if (st) serveStation(t, st); }
      const done = !sch || sch.w === 'time' ? t.wait <= 0 : sch.w === 'full' ? trainFull(t) : trainEmpty(t);
      if (done) {
        t.state = 'idle';
        if (sch) t.si = ((t.si || 0) + 1) % t.schedule.length;
      }
      continue;
    }
    if (t.state === 'idle' || !t._path) {
      const st = t.schedule && t.schedule.length ? scheduleTarget(t) : nextStation(t);
      if (!st) { t.state = 'idle'; continue; }
      t.target = st.id;
      t._path = railPath(tx, ty, st);
      t._i = 0; t._f = 0;
      if (!t._path) { t.state = 'idle'; continue; }
      t.state = 'moving';
    }
    // Moverse por el camino
    const path = t._path;
    if (t._i >= path.length - 1) {
      const st = at(path[path.length - 1].x, path[path.length - 1].y);
      t.last = t.target;
      t._path = null;
      if (st && st.type === 'station') serveStation(t, st);
      const sch = t.schedule && t.schedule.length ? t.schedule[t.si || 0] : null;
      t.state = 'waiting'; t.wait = sch && sch.w === 'time' ? sch.s || 10 : STATION_WAIT;
      t.claim = null;
      continue;
    }
    // Otro tren adelante: esperar
    const ahead = path.slice(t._i + 1, t._i + 4);
    if (S.trains.some((o) => o !== t && ahead.some((p) => wrapX(Math.round(o.x)) === p.x && wrapY(Math.round(o.y)) === p.y))) { t.blocked = true; continue; }
    t.blocked = false;
    if (t.energy <= 0 && t.fuel > 0) { t.energy += FUELS[t.fuelType]; if (--t.fuel === 0) t.fuelType = null; }
    const fast = t.energy > 0;
    if (fast) t.energy -= TRAIN_POWER * dt;
    t._f += dt * (fast ? TRAIN_SPEED : TRAIN_SLOW);
    while (t._f >= 1 && t._i < path.length - 1) {
      // Antes de pasar una señal: el tramo de adelante tiene que estar libre
      const next = at(path[t._i + 1].x, path[t._i + 1].y);
      if (isSignal(next) && path[t._i + 2]) {
        const b = blockOf(path[t._i + 2].x, path[t._i + 2].y);
        // Señal en cadena: además, los tramos que siguen hasta la próxima señal común tienen que estar libres
        const need = next.type === 'chainsignal' ? chainBlocks(path, t._i + 2) : [b];
        if (need.some((x) => blockBusy(x, t))) { t._f = Math.min(t._f, 0.999); t.blocked = true; t.redSignal = next.id; break; }
        t.claim = b;
      }
      t._f -= 1; t._i++;
      const nx = at(path[t._i].x, path[t._i].y);
      if (!isRail(nx)) { t._path = null; t.state = 'idle'; break; }
      if (t.claim && blockOf(path[t._i].x, path[t._i].y) === t.claim) t.claim = null;   // ya entró
    }
    if (!t._path) continue;
    const a = path[t._i], b = path[Math.min(t._i + 1, path.length - 1)];
    const f = t._i >= path.length - 1 ? 0 : t._f;
    const sx = wdx(b.x - a.x), sy = wdy(b.y - a.y);
    t.x = wrapX(a.x + sx * f); t.y = wrapY(a.y + sy * f);
    if (sx || sy) t.ang = Math.atan2(sy, sx);
    // Historia de posiciones para dibujar los vagones detrás
    t._hist = t._hist || [];
    const last = t._hist[t._hist.length - 1];
    if (!last || wdist(last.x, last.y, t.x, t.y) > 0.1) { t._hist.push({ x: t.x, y: t.y }); if (t._hist.length > 120) t._hist.shift(); }
  }
}

// Tramos que cubre una señal en cadena: desde i, cada tramo hasta pasar una señal común
function chainBlocks(path, i) {
  const out = [];
  let passedNormal = false;
  for (let k = i; k < path.length; k++) {
    const e = at(path[k].x, path[k].y);
    if (isSignal(e)) {
      if (passedNormal) break;
      if (e.type === 'signal') passedNormal = true;
      continue;
    }
    const b = blockOf(path[k].x, path[k].y);
    if (b && !out.includes(b)) out.push(b);
  }
  return out;
}

// Estaciones: reciben líquidos por cañería (carga) y los largan a las cañerías vecinas (descarga)
function stationFluidStep() {
  for (const st of S.entities) {
    if (st.type !== 'station' || !st.fl || st.mode === 'load') continue;
    for (const [dx, dy] of DIRS) {
      const n = at(st.x + dx, st.y + dy);
      if (!isPipe(n)) continue;
      for (let k = 0; k < 20 && st.fl && st.fl.n >= 1 && fluidAccept(n, st.fl.k, false); k++) { st.fl.n--; if (st.fl.n < 1) st.fl = null; }
    }
  }
}

// Agregar o sacar vagones (se paga o se devuelve el vagón)
function addWagon(t, kind) {
  const w = wagonsOf(t);
  if (w.length >= MAX_WAGONS) { toast(`Un tren lleva hasta ${MAX_WAGONS} vagones.`); return false; }
  if (kind === 'f' && !hasTech('rail_signals2')) { toast('Investigá Trenes avanzados para los vagones de fluidos.'); return false; }
  if (!canAfford(WAGON_COST[kind])) { toast(`Te falta: ${missingText(WAGON_COST[kind])}`); return false; }
  pay(WAGON_COST[kind]);
  t.wagons = [...w, kind];
  return true;
}
function removeWagon(t) {
  const w = wagonsOf(t);
  if (w.length <= 1) { toast('El tren necesita al menos un vagón.'); return false; }
  const last = w[w.length - 1];
  const next = w.slice(0, -1);
  if (last === 'c' && t.total > WAGON_CAP * next.filter((x) => x === 'c').length) { toast('Ese vagón está cargado: descargalo primero.'); return false; }
  if (last === 'f' && t.fl && t.fl.n > FLUID_WAGON_CAP * next.filter((x) => x === 'f').length) { toast('Ese vagón tiene líquido: vacialo primero.'); return false; }
  refund(WAGON_COST[last]);
  t.wagons = next;
  return true;
}

// Posición de un punto a cierta distancia detrás del tren (para los vagones)
function trainTrail(t, dist) {
  const h = t._hist || [];
  let acc = 0, px = t.x, py = t.y;
  for (let i = h.length - 1; i >= 0; i--) {
    // Los puntos se toman sin saltar el borde del mapa
    const hx = px + wdx(h[i].x - px), hy = py + wdy(h[i].y - py);
    const d = Math.hypot(hx - px, hy - py);
    if (acc + d >= dist) {
      const k = (dist - acc) / d;
      const x = px + (hx - px) * k, y = py + (hy - py) * k;
      return { x, y, ang: Math.atan2(py - hy, px - hx) };
    }
    acc += d; px = hx; py = hy;
  }
  return { x: px - Math.cos(t.ang) * (dist - acc), y: py - Math.sin(t.ang) * (dist - acc), ang: t.ang };
}
