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

const isRail = (e) => !!e && (e.type === 'rail' || e.type === 'station');

// Vías vecinas de una casilla (en el orden de DIRS)
function railLinks(x, y) {
  return DIRS.map(([dx, dy]) => isRail(at(x + dx, y + dy)));
}

function trainAt(x, y) {
  return S.trains.find((t) => Math.round(t.x) === x && Math.round(t.y) === y);
}

// Camino por las vías hasta la estación, en casillas
function railPath(sx, sy, station) {
  const key = (x, y) => y * W + x;
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
      const nx = x + dx, ny = y + dy;
      if (!isRail(at(nx, ny)) || from.has(key(nx, ny))) continue;
      from.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

function stationsReachable(sx, sy) {
  const seen = new Set([sy * W + sx]);
  const queue = [[sx, sy]];
  const found = [];
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = queue[qi];
    const e = at(x, y);
    if (e && e.type === 'station') found.push(e);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = ny * W + nx;
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

function placeTrain(x, y) {
  if (!canPlaceTrain(x, y).ok) return null;
  pay(BUILDINGS.train.cost);
  const t = { id: S.nextId++, type: 'train', x, y, cargo: {}, total: 0, fuelType: null, fuel: 0, energy: 0, state: 'idle', wait: 0, target: null, last: null, ang: 0 };
  S.trains.push(t);
  return t;
}

function removeTrain(t) {
  refund(BUILDINGS.train.cost);
  for (const k in t.cargo) add(S.inv, k, t.cargo[k]);
  if (t.fuelType) add(S.inv, t.fuelType, t.fuel);
  S.trains.splice(S.trains.indexOf(t), 1);
  t._dead = true;
}

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
      t.wait -= dt;
      if (t.wait <= 0) t.state = 'idle';
      continue;
    }
    if (t.state === 'idle' || !t._path) {
      const st = nextStation(t);
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
      t.state = 'waiting'; t.wait = STATION_WAIT;
      continue;
    }
    // Otro tren adelante: esperar
    const ahead = path.slice(t._i + 1, t._i + 4);
    if (S.trains.some((o) => o !== t && ahead.some((p) => Math.round(o.x) === p.x && Math.round(o.y) === p.y))) { t.blocked = true; continue; }
    t.blocked = false;
    if (t.energy <= 0 && t.fuel > 0) { t.energy += FUELS[t.fuelType]; if (--t.fuel === 0) t.fuelType = null; }
    const fast = t.energy > 0;
    if (fast) t.energy -= TRAIN_POWER * dt;
    t._f += dt * (fast ? TRAIN_SPEED : TRAIN_SLOW);
    while (t._f >= 1 && t._i < path.length - 1) {
      t._f -= 1; t._i++;
      const nx = at(path[t._i].x, path[t._i].y);
      if (!isRail(nx)) { t._path = null; t.state = 'idle'; break; }
    }
    if (!t._path) continue;
    const a = path[t._i], b = path[Math.min(t._i + 1, path.length - 1)];
    const f = t._i >= path.length - 1 ? 0 : t._f;
    t.x = a.x + (b.x - a.x) * f; t.y = a.y + (b.y - a.y) * f;
    if (a.x !== b.x || a.y !== b.y) t.ang = Math.atan2(b.y - a.y, b.x - a.x);
    // Historia de posiciones para dibujar los vagones detrás
    t._hist = t._hist || [];
    const last = t._hist[t._hist.length - 1];
    if (!last || Math.hypot(last.x - t.x, last.y - t.y) > 0.1) { t._hist.push({ x: t.x, y: t.y }); if (t._hist.length > 60) t._hist.shift(); }
  }
}

// Posición de un punto a cierta distancia detrás del tren (para los vagones)
function trainTrail(t, dist) {
  const h = t._hist || [];
  let acc = 0, px = t.x, py = t.y;
  for (let i = h.length - 1; i >= 0; i--) {
    const d = Math.hypot(h[i].x - px, h[i].y - py);
    if (acc + d >= dist) {
      const k = (dist - acc) / d;
      const x = px + (h[i].x - px) * k, y = py + (h[i].y - py) * k;
      return { x, y, ang: Math.atan2(py - h[i].y, px - h[i].x) };
    }
    acc += d; px = h[i].x; py = h[i].y;
  }
  return { x: px - Math.cos(t.ang) * (dist - acc), y: py - Math.sin(t.ang) * (dist - acc), ang: t.ang };
}
