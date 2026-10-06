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

const isRail = (e) => !!e && (e.type === 'rail' || e.type === 'station' || e.type === 'signal');
const RAILISH = new Set(['rail', 'station', 'signal']);

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
  for (const d of [1, 2, 3]) { const p = trainTrail(t, d); tiles.push([Math.round(p.x), Math.round(p.y)]); }
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
  if (st.mode === 'load') {
    for (const k of Object.keys(st.store)) {
      const n = Math.min(st.store[k], TRAIN_CAP - t.total);
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
  for (const t of S.trains) {
    const tx = Math.round(t.x), ty = Math.round(t.y);
    if (!isRail(at(tx, ty))) { t.state = 'idle'; t._path = null; continue; }   // le sacaron la vía
    if (t.state === 'waiting') {
      const sch = t.schedule && t.schedule.length ? t.schedule[t.si || 0] : null;
      t.wait -= dt;
      // Mientras espera sigue cargando o descargando
      t.serveT = (t.serveT || 0) + dt;
      if (t.serveT >= 1) { t.serveT = 0; const st = stationById(t.last); if (st) serveStation(t, st); }
      const done = !sch || sch.w === 'time' ? t.wait <= 0 : sch.w === 'full' ? t.total >= TRAIN_CAP : t.total <= 0;
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
      if (next && next.type === 'signal' && path[t._i + 2]) {
        const b = blockOf(path[t._i + 2].x, path[t._i + 2].y);
        if (blockBusy(b, t)) { t._f = Math.min(t._f, 0.999); t.blocked = true; t.redSignal = next.id; break; }
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
    if (!last || wdist(last.x, last.y, t.x, t.y) > 0.1) { t._hist.push({ x: t.x, y: t.y }); if (t._hist.length > 60) t._hist.shift(); }
  }
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
