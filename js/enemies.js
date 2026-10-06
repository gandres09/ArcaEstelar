'use strict';
// =====================================================================
//  Polución, nidos, bichos y torretas
// =====================================================================

let pollution = new Float32Array(PW * PH);
let pollTimer = 0;
let lastAttack = null;     // { x, y, t } último ataque a la fábrica
const shots = [];          // disparos para dibujar { x1, y1, x2, y2, t, laser }

const cellOf = (x, y) => Math.min(PH - 1, Math.max(0, Math.floor(y / POLL_CELL))) * PW + Math.min(PW - 1, Math.max(0, Math.floor(x / POLL_CELL)));
const center = (e) => { const s = sizeOf(e.type) / 2; return { x: e.x + s, y: e.y + s }; };

function loadPollution(arr) {
  pollution = new Float32Array(PW * PH);
  if (Array.isArray(arr) && arr.length === PW * PH) pollution.set(arr);
}

function savePollution() {
  return Array.from(pollution, (v) => Math.round(v * 10) / 10);
}

// Las máquinas contaminan mientras trabajan
function emit(e, amount) {
  if (!amount) return;
  pollution[cellOf(e.x, e.y)] += amount;
  if (!S.peaceful) S.evo = Math.min(1, S.evo + amount * 0.000009);
}

function diffusePollution() {
  const next = new Float32Array(pollution);
  for (let cy = 0; cy < PH; cy++) {
    for (let cx = 0; cx < PW; cx++) {
      const i = cy * PW + cx, p = pollution[i];
      if (p < 0.05) continue;
      const spread = p * 0.02;
      if (cx > 0) { next[i - 1] += spread; next[i] -= spread; }
      if (cx < PW - 1) { next[i + 1] += spread; next[i] -= spread; }
      if (cy > 0) { next[i - PW] += spread; next[i] -= spread; }
      if (cy < PH - 1) { next[i + PW] += spread; next[i] -= spread; }
    }
  }
  // El terreno absorbe de a poco
  for (let i = 0; i < next.length; i++) next[i] = Math.max(0, next[i] - 0.06 - next[i] * 0.004);
  pollution = next;
}

function totalPollution() {
  let t = 0;
  for (const v of pollution) t += v;
  return t;
}

// --------------------------- Nidos ---------------------------

function areaFree(x, y, s) {
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
    if (!inBounds(x + dx, y + dy) || at(x + dx, y + dy) || oreAt(x + dx, y + dy) === 'water') return false;
  }
  return true;
}

function addNest(x, y) {
  const n = makeEntity('nest', x, y, 0);
  n.id = S.nextId++;
  S.entities.push(n);
  occupy(n, n);
  return n;
}

function generateNests(seed) {
  if (S.peaceful) return;
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  const cx = W >> 1, cy = H >> 1;
  let clusters = 0, tries = 0;
  while (clusters < 70 && tries++ < 3000) {
    const x = 3 + Math.floor(rnd() * (W - 6)), y = 3 + Math.floor(rnd() * (H - 6));
    const d = Math.hypot(x - cx, (y - cy) / 0.75);
    if (d < SAFE_RADIUS) continue;
    const n = 1 + Math.floor(rnd() * 2 + d / 70);
    for (let k = 0; k < n; k++) {
      const nx = Math.round(x + (rnd() - 0.5) * 8), ny = Math.round(y + (rnd() - 0.5) * 8);
      if (areaFree(nx, ny, 2)) addNest(nx, ny);
    }
    clusters++;
  }
}

function chooseBiterKind() {
  const e = S.evo;
  const w = {
    small: Math.max(0.15, 1 - e * 1.4),
    medium: e > 0.2 ? (e - 0.2) * 2.2 : 0,
    big: e > 0.5 ? (e - 0.5) * 3 : 0,
  };
  let r = Math.random() * (w.small + w.medium + w.big);
  for (const k in w) { if ((r -= w[k]) <= 0) return k; }
  return 'small';
}

function spawnBiter(nest, kind) {
  const a = Math.random() * Math.PI * 2;
  S.biters.push({
    x: nest.x + 1 + Math.cos(a) * 1.8, y: nest.y + 1 + Math.sin(a) * 1.8,
    kind, hp: BITERS[kind].hp * (1 + S.evo * 0.5), nest: nest.id, state: 'idle', cd: 0, ang: a,
  });
}

function nearestPlayerEntity(x, y, maxD, pollutersOnly) {
  let best = null, bd = maxD;
  for (const e of S.entities) {
    if (e.type === 'nest') continue;
    if (pollutersOnly && !BUILDINGS[e.type]?.poll) continue;
    const c = center(e);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function sendAttack(nest, target) {
  for (const b of S.biters) {
    if (b.nest === nest.id && b.state === 'idle') { b.state = 'attack'; b._t = target; }
  }
  nest.group = 0;
  nest.groupTimer = 0;
}

function nestStep(dt) {
  const nests = S.entities.filter((e) => e.type === 'nest');
  const groupSize = Math.round(5 + S.evo * 20);
  for (const n of nests) {
    const i = cellOf(n.x + 1, n.y + 1);
    const take = Math.min(pollution[i], 2 * dt);
    pollution[i] -= take;
    n.anger += take;
    let kind = chooseBiterKind();
    while (n.anger >= BITERS[kind].cost && n.group < 40 && S.biters.length < 500) {
      n.anger -= BITERS[kind].cost;
      spawnBiter(n, kind);
      n.group++;
      kind = chooseBiterKind();
    }
    if (n.group > 0) n.groupTimer += dt;
    if (n.group >= groupSize || (n.groupTimer > 90 && n.group >= 3)) {
      const t = nearestPlayerEntity(n.x + 1, n.y + 1, 160, true) || nearestPlayerEntity(n.x + 1, n.y + 1, 160, false);
      if (t) sendAttack(n, t);
      else n.groupTimer = 0;
    }
    if (n.hp !== undefined && n.hp < maxHp(n)) n.hp = Math.min(maxHp(n), n.hp + 2 * dt);
  }
}

function expandNests(dt) {
  S.expandTimer -= dt;
  if (S.expandTimer > 0) return;
  S.expandTimer = (600 - 380 * S.evo) * (0.7 + Math.random() * 0.6);
  const nests = S.entities.filter((e) => e.type === 'nest');
  if (!nests.length) return;
  const cx = W >> 1, cy = H >> 1;
  for (let tries = 0; tries < 30; tries++) {
    const src = nests[Math.floor(Math.random() * nests.length)];
    const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 10;
    const x = Math.round(src.x + Math.cos(a) * d), y = Math.round(src.y + Math.sin(a) * d);
    if (!areaFree(x, y, 2) || Math.hypot(x - cx, y - cy) < 30) continue;
    if (nearestPlayerEntity(x + 1, y + 1, 16, false)) continue;
    addNest(x, y);
    return;
  }
}

// --------------------------- Bichos ---------------------------

function biterStep(b, dt) {
  const k = BITERS[b.kind];
  if (b.state === 'idle') {
    b.ang += (Math.random() - 0.5) * 2 * dt;
    const wx = b.x + Math.cos(b.ang) * 0.3 * dt, wy = b.y + Math.sin(b.ang) * 0.3 * dt;
    if (oreAt(Math.floor(wx), Math.floor(wy)) === 'water') b.ang += Math.PI;
    else { b.x = wx; b.y = wy; }
    return;
  }
  let t = b._t;
  if (!t || t._dead) {
    b.path = null;
    t = b._t = nearestPlayerEntity(b.x, b.y, 30, false);
    if (!t) { b.state = 'idle'; return; }
  }
  const c = center(t);
  const dx = c.x - b.x, dy = c.y - b.y, dist = Math.hypot(dx, dy);
  b.ang = Math.atan2(dy, dx);
  b.cd -= dt;
  if (dist <= sizeOf(t.type) / 2 + 1) {
    if (b.cd <= 0) { damageEntity(t, k.dmg); b.cd = 1; noteAttack(t); }
    return;
  }
  const step = k.speed * dt;
  let nx = b.x + (dx / dist) * step, ny = b.y + (dy / dist) * step;
  // Los bichos no nadan: si hay agua en el medio, buscan un camino que la rodee
  if (b.path && b.path.length) {
    const wp = b.path[0];
    const wx = wp.x + 0.5 - b.x, wy = wp.y + 0.5 - b.y, wd = Math.hypot(wx, wy);
    if (wd < 0.4) { b.path.shift(); return; }
    nx = b.x + (wx / wd) * step; ny = b.y + (wy / wd) * step;
    b.ang = Math.atan2(wy, wx);
  } else if (oreAt(Math.floor(nx), Math.floor(ny)) === 'water') {
    const path = findPath(Math.floor(b.x), Math.floor(b.y), Math.floor(c.x), Math.floor(c.y));
    if (!path) { b.state = 'idle'; return; }   // inalcanzable: se queda
    b.path = path;
    // Los compañeros cercanos con el mismo objetivo usan el mismo camino
    for (const o of S.biters) {
      if (o !== b && o._t === t && !o.path && Math.hypot(o.x - b.x, o.y - b.y) < 6) o.path = path.slice();
    }
    return;
  }
  const occ = at(Math.floor(nx), Math.floor(ny));
  if (occ && isPlayer(occ) && occ !== t) {
    // Algo le bloquea el paso: lo muerde
    if (b.cd <= 0) { damageEntity(occ, k.dmg); b.cd = 1; noteAttack(occ); }
    return;
  }
  b.x = nx; b.y = ny;
}

function noteAttack(e) {
  const now = S.playTime;
  if (!lastAttack || now - lastAttack.t > 20) sfx('alarm');
  if (!lastAttack || now - lastAttack.t > 20) toast('⚠️ <b>¡Están atacando tu fábrica!</b> Tocá la alerta de arriba para ir.');
  lastAttack = { x: e.x, y: e.y, t: now };
}

// Camino más corto evitando el agua (A* sobre casillas, en 8 direcciones)
function findPath(sx, sy, tx, ty, maxNodes = 15000) {
  const idx = (x, y) => y * W + x;
  const goal = idx(tx, ty);
  const g = new Map(), from = new Map();
  const heap = [];
  const push = (n, f) => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top[1];
  };
  const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  const start = idx(sx, sy);
  g.set(start, 0);
  push(start, h(sx, sy));
  let n = 0;
  while (heap.length && n++ < maxNodes) {
    const cur = pop();
    const cx = cur % W, cy = (cur / W) | 0;
    // Basta con llegar al lado del objetivo
    if (cur === goal || Math.max(Math.abs(cx - tx), Math.abs(cy - ty)) <= 1) {
      const path = [];
      let k = cur;
      while (k !== start) { path.push({ x: k % W, y: (k / W) | 0 }); k = from.get(k); }
      path.reverse();
      return path;
    }
    const gc = g.get(cur);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = cx + dx, y = cy + dy;
      if (!inBounds(x, y) || oreAt(x, y) === 'water') continue;
      // No cortar esquinas pegadas al agua
      if (dx && dy && (oreAt(cx + dx, cy) === 'water' || oreAt(cx, cy + dy) === 'water')) continue;
      const ni = idx(x, y), ng = gc + (dx && dy ? 1.41 : 1);
      if (ng < (g.get(ni) ?? Infinity)) { g.set(ni, ng); from.set(ni, cur); push(ni, ng + h(x, y)); }
    }
  }
  return null;
}

// --------------------------- Torretas ---------------------------

function hitBiter(b, dmg) {
  b.hp -= dmg;
  if (b.hp <= 0) b.dead = true;
}

function turretStep(e, dt) {
  const def = BUILDINGS[e.type];
  e.cd -= dt;
  if (e.cd > 0) return;
  const tx = e.x + 0.5, ty = e.y + 0.5;
  let target = null, bd = def.range;
  for (const b of S.biters) {
    if (b.dead) continue;
    const d = Math.hypot(b.x - tx, b.y - ty);
    if (d < bd) { bd = d; target = b; }
  }
  let nest = null;
  if (!target) {
    for (const n of S.entities) {
      if (n.type !== 'nest') continue;
      const d = Math.hypot(n.x + 1 - tx, n.y + 1 - ty);
      if (d < bd) { bd = d; nest = n; }
    }
  }
  e.aim = target ? Math.atan2(target.y - ty, target.x - tx) : nest ? Math.atan2(nest.y + 1 - ty, nest.x + 1 - tx) : e.aim;
  if (!target && !nest) return;

  let fire = false;
  if (e.type === 'turret') {
    if (e.shots <= 0 && e.ammo > 0) { e.ammo--; e.shots = 10; }
    if (e.shots > 0) { e.shots--; fire = true; e.cd = 1 / def.rate; }
  } else {
    const sp = drawPower(e, def.power);
    if (sp > 0.25) { fire = true; e.cd = 1 / (def.rate * sp); }
  }
  if (!fire) return;
  sfx(e.type === 'laser' ? 'laser' : 'shot', e.x, e.y);
  const dmg = def.dmg * weaponMult();
  if (target) {
    hitBiter(target, dmg);
    shots.push({ x1: tx, y1: ty, x2: target.x, y2: target.y, t: 0, laser: e.type === 'laser' });
  } else {
    damageEntity(nest, dmg);
    shots.push({ x1: tx, y1: ty, x2: nest.x + 1, y2: nest.y + 1, t: 0, laser: e.type === 'laser' });
    // El nido se defiende: sus bichos van contra la torreta
    if (!nest._dead) for (const b of S.biters) if (b.nest === nest.id && b.state === 'idle') { b.state = 'attack'; b._t = e; }
  }
}

// --------------------------- Paso principal ---------------------------

function updateEnemies(dt) {
  pollTimer += dt;
  const tick = pollTimer >= 1;
  if (tick) { pollTimer -= 1; diffusePollution(); }
  for (const s of shots) s.t += dt;
  while (shots.length && shots[0].t > 0.12) shots.shift();
  if (S.peaceful) return;

  S.evo = Math.min(1, S.evo + dt * 0.000015);
  if (tick) { nestStep(1); expandNests(1); }

  for (const b of S.biters) if (!b.dead) biterStep(b, dt);
  for (const e of S.entities) if (e.type === 'turret' || e.type === 'laser') turretStep(e, dt);
  if (S.biters.some((b) => b.dead)) {
    for (const b of S.biters) if (b.dead) S.kills = (S.kills || 0) + 1;
    for (const b of S.biters) if (b.dead) { spawnSplat(b.x, b.y, BITERS[b.kind].color); sfx('splat', b.x, b.y); }
    S.biters = S.biters.filter((b) => !b.dead);
  }
}
