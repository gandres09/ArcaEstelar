'use strict';
// =====================================================================
//  Polución, nidos, bichos y torretas
// =====================================================================

let pollution = new Float32Array(PW * PH);
let pollTimer = 0;
let lastAttack = null;     // { x, y, t } último ataque a la fábrica
const shots = [];          // disparos para dibujar { x1, y1, x2, y2, t, laser }

const cellOf = (x, y) => Math.floor(wrapY(y) / POLL_CELL) * PW + Math.floor(wrapX(x) / POLL_CELL);
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
  if (!S.peaceful) S.evo = Math.min(1, S.evo + amount * 0.0000125);
}

function diffusePollution() {
  const next = new Float32Array(pollution);
  for (let cy = 0; cy < PH; cy++) {
    for (let cx = 0; cx < PW; cx++) {
      const i = cy * PW + cx, p = pollution[i];
      if (p < 0.05) continue;
      const spread = p * 0.02;
      // Los bordes se tocan: la polución también da la vuelta
      next[cx > 0 ? i - 1 : i + PW - 1] += spread;
      next[cx < PW - 1 ? i + 1 : i - PW + 1] += spread;
      next[cy > 0 ? i - PW : i + PW * (PH - 1)] += spread;
      next[cy < PH - 1 ? i + PW : i - PW * (PH - 1)] += spread;
      next[i] -= spread * 4;
    }
  }
  // El terreno absorbe de a poco, los bosques bastante más, y la lluvia lava el aire
  const wash = 0.004 + weatherWash();
  for (let i = 0; i < next.length; i++) next[i] = Math.max(0, next[i] - 0.06 - (forestCell[i] || 0) * 0.15 - next[i] * wash);
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
    if (at(x + dx, y + dy) || oreAt(x + dx, y + dy) === 'water' || cliffAt(x + dx, y + dy)) return false;
  }
  return true;
}

// Gusano: cuanto más lejos de la Nave (o más evolución), más grande
function wormKindFor(x, y) {
  const d = wdist(x, y, W >> 1, H >> 1) / Math.max(1, Math.sqrt((W * H) / (1600 * 1200)));
  const r = d / 700 + S.evo * 0.8;
  return r > 1.1 ? 'big' : r > 0.55 ? 'medium' : 'small';
}
function addWorm(x, y, kind) {
  const w = makeEntity('worm', wrapX(x), wrapY(y), 0);
  w.kind = kind || wormKindFor(x, y);
  w.id = S.nextId++;
  S.entities.push(w);
  occupy(w, w);
  return w;
}
// Un par de gusanos alrededor de un nido
function wormsAround(nx, ny, n, rnd = Math.random) {
  for (let k = 0, t = 0; k < n && t < 12; t++) {
    const a = rnd() * Math.PI * 2, r = 2.5 + rnd() * 2.5;
    const x = Math.round(nx + 1 + Math.cos(a) * r), y = Math.round(ny + 1 + Math.sin(a) * r);
    if (areaFree(x, y, 1)) { addWorm(x, y); k++; }
  }
}

function addNest(x, y) {
  const n = makeEntity('nest', wrapX(x), wrapY(y), 0);
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
  const K = (W * H) / (320 * 240);
  const target = (K > 1 ? 70 * K * 0.5 : 70) * mapOpts().enemies;
  while (clusters < target && tries++ < 3000 * K) {
    const x = 3 + Math.floor(rnd() * (W - 6)), y = 3 + Math.floor(rnd() * (H - 6));
    const d = Math.hypot(x - cx, (y - cy) / 0.75);
    if (d < SAFE_RADIUS) continue;
    const n = 1 + Math.floor(rnd() * 2 + d / (K > 1 ? 120 : 70));
    for (let k = 0; k < n; k++) {
      const nx = Math.round(x + (rnd() - 0.5) * 8), ny = Math.round(y + (rnd() - 0.5) * 8);
      if (areaFree(nx, ny, 2)) addNest(nx, ny);
    }
    // Partidas nuevas: gusanos que defienden los nidos
    if (S.mapGen >= 7) wormsAround(x, y, Math.floor(rnd() * 2 + d / 350), rnd);
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
  // Los escupidores aparecen con un poco de evolución (y crecen igual que los bichos)
  if (e > 0.08) { w.small_spitter = w.small * 0.5; w.medium_spitter = w.medium * 0.55; w.big_spitter = w.big * 0.6; }
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) { if ((r -= w[k]) <= 0) return k; }
  return 'small';
}

function spawnBiter(nest, kind) {
  const a = Math.random() * Math.PI * 2;
  S.biters.push({
    id: S.nextId++,
    x: nest.x + 1 + Math.cos(a) * 1.8, y: nest.y + 1 + Math.sin(a) * 1.8,
    kind, hp: BITERS[kind].hp * (1 + S.evo * 0.5), nest: nest.id, state: 'idle', cd: 0, ang: a,
  });
}

function nearestPlayerEntity(x, y, maxD, pollutersOnly) {
  let best = null, bd = maxD;
  for (const e of S.entities) {
    if (isEnemyB(e) || e.type === 'landmine') continue;   // las minas no las ven
    if (pollutersOnly && !BUILDINGS[e.type]?.poll) continue;
    const c = center(e);
    const d = wdist(x, y, c.x, c.y);
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
  const groupSize = Math.round(6 + S.evo * 26);
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
  S.expandTimer = (520 - 340 * S.evo) * (0.7 + Math.random() * 0.6);
  const nests = S.entities.filter((e) => e.type === 'nest');
  if (!nests.length) return;
  const cx = W >> 1, cy = H >> 1;
  for (let tries = 0; tries < 30; tries++) {
    const src = nests[Math.floor(Math.random() * nests.length)];
    const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 10;
    const x = Math.round(src.x + Math.cos(a) * d), y = Math.round(src.y + Math.sin(a) * d);
    if (!areaFree(x, y, 2) || wdist(x, y, cx, cy) < 30) continue;
    if (nearestPlayerEntity(x + 1, y + 1, 16, false)) continue;
    addNest(x, y);
    if (Math.random() < 0.3 + S.evo * 0.4) wormsAround(x, y, 1);
    return;
  }
}

// --------------------------- Bichos ---------------------------

function biterStep(b, dt) {
  if (S.character && rpgBiterHook(b, dt)) return;
  const k = BITERS[b.kind];
  if (b.state === 'idle') {
    b.ang += (Math.random() - 0.5) * 2 * dt;
    const wx = b.x + Math.cos(b.ang) * 0.3 * dt, wy = b.y + Math.sin(b.ang) * 0.3 * dt;
    if (oreAt(Math.floor(wx), Math.floor(wy)) === 'water') b.ang += Math.PI;
    else { b.x = wrapX(wx); b.y = wrapY(wy); }
    return;
  }
  let t = b._t;
  if (!t || t._dead) {
    b.path = null;
    t = b._t = nearestPlayerEntity(b.x, b.y, 30, false);
    if (!t) { b.state = 'idle'; return; }
  }
  const c = center(t);
  const dx = wdx(c.x - b.x), dy = wdy(c.y - b.y), dist = Math.hypot(dx, dy);
  b.ang = Math.atan2(dy, dx);
  b.cd -= dt;
  if (dist <= sizeOf(t.type) / 2 + (k.range || 1)) {
    if (b.cd <= 0) {
      damageEntity(t, k.dmg); b.cd = k.range ? 1.4 : 1; noteAttack(t);
      if (k.range) shots.push({ x1: b.x, y1: b.y, x2: b.x + dx, y2: b.y + dy, t: 0, spit: true });
    }
    return;
  }
  const step = k.speed * slowMul(b) * dt;
  let nx = b.x + (dx / dist) * step, ny = b.y + (dy / dist) * step;
  // Los bichos no nadan: si hay agua en el medio, buscan un camino que la rodee
  if (b.path && b.path.length) {
    const wp = b.path[0];
    const wx = wdx(wp.x + 0.5 - b.x), wy = wdy(wp.y + 0.5 - b.y), wd = Math.hypot(wx, wy);
    if (wd < 0.4) { b.path.shift(); return; }
    nx = b.x + (wx / wd) * step; ny = b.y + (wy / wd) * step;
    b.ang = Math.atan2(wy, wx);
  } else if (oreAt(Math.floor(nx), Math.floor(ny)) === 'water') {
    const path = findPath(Math.floor(b.x), Math.floor(b.y), Math.floor(c.x), Math.floor(c.y));
    if (!path) { b.state = 'idle'; return; }   // inalcanzable: se queda
    b.path = path;
    // Los compañeros cercanos con el mismo objetivo usan el mismo camino
    for (const o of S.biters) {
      if (o !== b && o._t === t && !o.path && wdist(o.x, o.y, b.x, b.y) < 6) o.path = path.slice();
    }
    return;
  }
  const occ = at(Math.floor(nx), Math.floor(ny));
  if (occ && isPlayer(occ) && occ !== t) {
    // Algo le bloquea el paso: lo muerde
    if (b.cd <= 0) { damageEntity(occ, k.dmg); b.cd = 1; noteAttack(occ); }
    return;
  }
  b.x = wrapX(nx); b.y = wrapY(ny);
}

function noteAttack(e) {
  const now = S.playTime;
  if (!lastAttack || now - lastAttack.t > 20) sfx('alarm');
  if (!lastAttack || now - lastAttack.t > 20) toast('⚠️ <b>¡Están atacando tu fábrica!</b> Tocá la alerta de arriba para ir.');
  lastAttack = { x: e.x, y: e.y, t: now };
}

// Camino más corto evitando el agua (A* sobre casillas, en 8 direcciones)
function findPath(sx, sy, tx, ty, maxNodes = 15000) {
  const idx = (x, y) => tIdx(x, y);
  tx = wrapX(tx); ty = wrapY(ty);
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
  const h = (x, y) => { const dx = Math.abs(wdx(x - tx)), dy = Math.abs(wdy(y - ty)); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  const start = idx(sx, sy);
  g.set(start, 0);
  push(start, h(sx, sy));
  let n = 0;
  while (heap.length && n++ < maxNodes) {
    const cur = pop();
    const cx = cur % W, cy = (cur / W) | 0;
    // Basta con llegar al lado del objetivo
    if (cur === goal || Math.max(Math.abs(wdx(cx - tx)), Math.abs(wdy(cy - ty))) <= 1) {
      const path = [];
      let k = cur;
      while (k !== start) { path.push({ x: k % W, y: (k / W) | 0 }); k = from.get(k); }
      path.reverse();
      return path;
    }
    const gc = g.get(cur);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = wrapX(cx + dx), y = wrapY(cy + dy);
      if (oreAt(x, y) === 'water') continue;
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
  let target = null, bd = def.range * weatherRange();
  for (const b of S.biters) {
    if (b.dead) continue;
    const d = wdist(tx, ty, b.x, b.y);
    if (d < bd) { bd = d; target = b; }
  }
  let nest = null;
  if (!target) {
    for (const n of S.entities) {
      if (!isEnemyB(n)) continue;
      const h = sizeOf(n.type) / 2, d = wdist(tx, ty, n.x + h, n.y + h);
      if (d < bd) { bd = d; nest = n; }
    }
  }
  const nh = nest ? sizeOf(nest.type) / 2 : 0;
  e.aim = target ? Math.atan2(wdy(target.y - ty), wdx(target.x - tx)) : nest ? Math.atan2(wdy(nest.y + nh - ty), wdx(nest.x + nh - tx)) : e.aim;
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
  const dmg = def.dmg * weaponMult() * mkMult(e);
  if (target) {
    hitBiter(target, dmg);
    shots.push({ x1: tx, y1: ty, x2: tx + wdx(target.x - tx), y2: ty + wdy(target.y - ty), t: 0, laser: e.type === 'laser' });
  } else {
    damageEntity(nest, dmg);
    shots.push({ x1: tx, y1: ty, x2: tx + wdx(nest.x + nh - tx), y2: ty + wdy(nest.y + nh - ty), t: 0, laser: e.type === 'laser' });
    // El nido se defiende: sus bichos van contra la torreta
    if (!nest._dead) for (const b of S.biters) if (b.nest === nest.id && b.state === 'idle') { b.state = 'attack'; b._t = e; }
  }
}

// Torreta lanzallamas: quema al bicho más cercano y a los que están alrededor
function flameStep(e, dt) {
  const def = BUILDINGS.flameturret;
  e.cd -= dt;
  if (e.cd > 0 || (e.fuel <= 0 && !(e.flames > 0))) return;
  const tx = e.x + 0.5, ty = e.y + 0.5;
  let target = null, bd = def.range * weatherRange();
  for (const b of S.biters) { if (b.dead) continue; const d = wdist(tx, ty, b.x, b.y); if (d < bd) { bd = d; target = b; } }
  if (!target) return;
  e.aim = Math.atan2(wdy(target.y - ty), wdx(target.x - tx));
  if (!(e.flames > 0)) { e.fuel--; e.flames = 12; }   // 1 barril de petróleo = 12 llamaradas
  e.flames--;
  e.cd = 0.25;
  const dmg = def.dmg * weaponMult() * mkMult(e);
  for (const b of S.biters) if (!b.dead && wdist(target.x, target.y, b.x, b.y) < 1.6) hitBiter(b, b === target ? dmg : dmg * 0.6);
  shots.push({ x1: tx, y1: ty, x2: tx + wdx(target.x - tx), y2: ty + wdy(target.y - ty), t: 0, flame: true });
  sfx('shot', e.x, e.y);
}

// Artillería: bombardea solita el nido más cercano dentro de su alcance
function artilleryStep(e, dt) {
  const def = BUILDINGS.artillery;
  e.cd -= dt;
  if (e.cd > 0 || e.ammo <= 0) return;
  const tx = e.x + 1, ty = e.y + 1;
  let nest = null, bd = def.range;
  for (const n of S.entities) {
    if (!isEnemyB(n)) continue;
    const d = wdist(tx, ty, n.x + sizeOf(n.type) / 2, n.y + sizeOf(n.type) / 2);
    if (d < bd) { bd = d; nest = n; }
  }
  if (!nest) return;
  e.aim = Math.atan2(wdy(nest.y + 1 - ty), wdx(nest.x + 1 - tx));
  e.ammo--;
  e.cd = def.rate;
  const nx = nest.x + sizeOf(nest.type) / 2, ny = nest.y + sizeOf(nest.type) / 2;
  for (const n of S.entities.slice()) if (isEnemyB(n) && wdist(nx, ny, n.x + sizeOf(n.type) / 2, n.y + sizeOf(n.type) / 2) <= def.blast) damageEntity(n, def.dmg * weaponMult());
  for (const b of S.biters) if (!b.dead && wdist(nx, ny, b.x, b.y) <= def.blast) hitBiter(b, def.dmg);
  spawnExplosion(nx, ny, 2);
  shots.push({ x1: tx, y1: ty, x2: tx + wdx(nx - tx), y2: ty + wdy(ny - ty), t: 0, laser: false });
  sfx('boom', e.x, e.y);
}

// Zonas de 32×32 con edificios del jugador (para que los gusanos lejos de todo ni miren)
const ZONE = 32;
let zoneMap = null, zoneKey = '';
function playerZoneNear(x, y) {
  const zw = Math.ceil(W / ZONE), zh = Math.ceil(H / ZONE);
  const key = S.entities.length + ':' + Math.floor(S.playTime / 3) + ':' + W;
  if (key !== zoneKey) {
    zoneKey = key;
    zoneMap = new Uint8Array(zw * zh);
    for (const e of S.entities) if (isPlayer(e)) zoneMap[Math.floor(e.y / ZONE) * zw + Math.floor(e.x / ZONE)] = 1;
  }
  const zx = Math.floor(wrapX(x) / ZONE), zy = Math.floor(wrapY(y) / ZONE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (zoneMap[((zy + dy + zh) % zh) * zw + ((zx + dx + zw) % zw)]) return true;
  }
  return false;
}

// El edificio del jugador más cercano mirando solo las casillas alrededor (rápido aunque haya miles)
function playerEntityNear(x, y, r) {
  if (!playerZoneNear(x, y)) return null;
  let best = null, bd = r + 0.5;
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const t = at(x + dx, y + dy);
    if (!t || !isPlayer(t) || t.type === 'landmine') continue;
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

// Gusano: escupe ácido al personaje, a los vehículos y a los edificios que tenga a tiro
function wormStep(e, dt) {
  const k = WORMS[e.kind] || WORMS.small;
  e.cd = (e.cd || 0) - dt;
  if (e.hp !== undefined && e.hp < maxHp(e)) e.hp = Math.min(maxHp(e), e.hp + 3 * dt);
  if (e.cd > 0) return;
  const cx = e.x + 0.5, cy = e.y + 0.5;
  let tx = null, ty = null, hit = null;
  const p = S.character && S.player;
  if (p && p.hp > 0 && wdist(cx, cy, p.x, p.y) <= k.range) { tx = p.x; ty = p.y; hit = () => hurtPlayer(k.dmg * 0.6, k.name.toLowerCase()); }
  if (!hit) {
    const t = playerEntityNear(e.x, e.y, k.range);
    if (t) { const c = center(t); tx = c.x; ty = c.y; hit = () => { damageEntity(t, k.dmg); noteAttack(t); }; }
  }
  if (!hit) { e.fire = 0; e.cd = 0.8 + Math.random() * 0.6; return; }   // nada a tiro: vuelve a mirar en un rato
  e.aim = Math.atan2(wdy(ty - cy), wdx(tx - cx));
  e.cd = k.rate;
  e.fire = 0.4;
  hit();
  shots.push({ x1: cx, y1: cy, x2: cx + wdx(tx - cx), y2: cy + wdy(ty - cy), t: 0, spit: true });
  sfx('splat', e.x, e.y);
}

// --------------------------- Paso principal ---------------------------

function updateEnemies(dt) {
  pollTimer += dt;
  const tick = pollTimer >= 1;
  if (tick) { pollTimer -= 1; diffusePollution(); }
  for (const s of shots) s.t += dt;
  while (shots.length && shots[0].t > 0.12) shots.shift();
  if (S.peaceful || S.surface === 'moon') return;

  S.evo = Math.min(1, S.evo + dt * 0.00002);
  if (tick) { nestStep(1); expandNests(1); }

  for (const b of S.biters) if (!b.dead) biterStep(b, dt);
  for (const e of S.entities) {
    if (e.type === 'turret' || e.type === 'laser') turretStep(e, dt);
    else if (e.type === 'flameturret') flameStep(e, dt);
    else if (e.type === 'artillery') artilleryStep(e, dt);
    else if (e.type === 'worm') wormStep(e, dt);
    else if (e.type === 'landmine') landmineStep(e);
  }
  if (S.biters.some((b) => b.dead)) {
    for (const b of S.biters) if (b.dead) S.kills = (S.kills || 0) + 1;
    for (const b of S.biters) if (b.dead) { spawnSplat(b.x, b.y, BITERS[b.kind].color); sfx('splat', b.x, b.y); }
    S.biters = S.biters.filter((b) => !b.dead);
  }
}
