'use strict';
// =====================================================================
//  Vehículos: buggy, auto, camioneta blindada, tanque y aerodeslizador.
//  Se ponen como un edificio, se suben con la mano, gastan combustible,
//  llevan carga en el baúl y los mejores tienen armas.
// =====================================================================

const VEHICLES = {
  buggy: { speed: 8,  accel: 6,  turn: 3.2, cargo: 20,  kw: 120, armor: 0,    ram: 4,  color: '#d9a03a', len: 1.3, wid: 0.9 },
  car:   { speed: 12, accel: 8,  turn: 3.2, cargo: 50,  kw: 200, armor: 0.1,  ram: 6,  color: '#c0392b', len: 1.6, wid: 1.0 },
  truck: { speed: 11, accel: 7,  turn: 2.8, cargo: 100, kw: 300, armor: 0.3,  ram: 10, color: '#5d6b3f', len: 1.8, wid: 1.15,
           gun: { dmg: 8, cd: 0.15, range: 10, ammo: 'ammo', per: 10 } },
  tank:  { speed: 9,  accel: 5,  turn: 2.2, cargo: 150, kw: 500, armor: 0.5,  ram: 25, color: '#4a5a3a', len: 2.0, wid: 1.4,
           gun: { dmg: 70, cd: 1.3, range: 13, splash: 2.2, ammo: 'cannon_shell', per: 1 } },
  hover: { speed: 16, accel: 10, turn: 3.6, cargo: 120, kw: 400, armor: 0.35, ram: 8,  color: '#3f86e0', len: 1.8, wid: 1.2, water: true,
           gun: { dmg: 22, cd: 0.35, range: 12, laser: true, kj: 40 } },
};
const VEHICLE_FUEL = { wood: 0.9, coal: 1, solid_fuel: 1.15, rocket_fuel: 1.35 };   // velocidad según el combustible
const FUEL_KJ = { ...FUELS, rocket_fuel: 40000 };
const VEHICLE_REACH = 6;   // a cuántas casillas te podés subir

const isVehicle = (type) => !!(BUILDINGS[type] && BUILDINGS[type].vehicle);
function ensureVehicles() { if (!S.vehicles) S.vehicles = []; }

// ¿Se puede andar por esta casilla con este vehículo?
function vehicleCanBe(v, x, y) {
  const d = VEHICLES[v.type];
  const r = d.wid * 0.42;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const tx = Math.floor(x + ox), ty = Math.floor(y + oy);
    if (oreAt(tx, ty) === 'water' && !d.water) return false;
    const e = at(tx, ty);
    if (e && !PASSABLE.has(e.type)) return false;
  }
  return true;
}

function canPlaceVehicle(type, x, y, free) {
  if (!free) {
    if (!isUnlocked(type)) return { ok: false, why: 'Falta investigar: ' + TECHS[BUILDINGS[type].tech].name };
    if (!canAfford(BUILDINGS[type].cost)) return { ok: false, why: 'Faltan materiales' };
  }
  if (oreAt(x, y) === 'water' || at(x, y)) return { ok: false, why: 'Tiene que ir en un lugar libre' };
  return { ok: true };
}

function placeVehicle(type, x, y, free) {
  ensureVehicles();
  if (!canPlaceVehicle(type, x, y, free).ok) return null;
  if (!free) pay(BUILDINGS[type].cost);
  const v = { id: S.nextId++, type, x: x + 0.5, y: y + 0.5, ang: -Math.PI / 2, v: 0, hp: BUILDINGS[type].hp,
    fuelType: null, fuel: 0, burn: 0, ammo: 0, shots: 0, cargo: {}, total: 0, cd: 0 };
  S.vehicles.push(v);
  netPush({ k: 'vp', t: type, x, y, id: v.id });
  return v;
}

const vehicleById = (id) => (S.vehicles || []).find((v) => v.id === id);
const myVehicle = () => (playerOn() && S.player.vehicle ? vehicleById(S.player.vehicle) : null);
function vehicleNear(x, y, r = 1.1) {
  for (const v of S.vehicles || []) if (wdist(v.x, v.y, x, y) <= r) return v;
  return null;
}
// Vehículo que maneja otro jugador
function vehicleDrivenByOther(v) {
  if (!NET.on) return false;
  for (const a of NET.avatars.values()) if (a.dv === v.id) return true;
  return false;
}

// --------------------------- Subir y bajar ---------------------------

function enterVehicle(v) {
  const p = S.player;
  if (!p || !v) return;
  if (vehicleDrivenByOther(v)) { toast('Lo está manejando otro jugador.'); return; }
  if (wdist(p.x, p.y, v.x, v.y) > VEHICLE_REACH) { walkTo(Math.floor(v.x), Math.floor(v.y), 1.5); toast('Acercate al vehículo para subirte.'); return; }
  p.vehicle = v.id; p.path = null; p.mine = null; p.queue.length = 0;
  p.x = v.x; p.y = v.y;
  v.target = null;
  sfx('place');
  toast(`🚗 Subiste a ${BUILDINGS[v.type].name.toLowerCase()}. ${isTouch() ? 'Tocá el mapa para ir' : 'Manejá con WASD'}; tocá el vehículo para bajar.`);
  if (!v.fuel && v.burn <= 0) toast('⛽ No tiene combustible: cargale carbón, madera o combustible desde su panel.');
}

function exitVehicle(force) {
  const p = S.player, v = myVehicle();
  if (!v) { p.vehicle = null; return; }
  // Bajar al costado, en una casilla libre (en el medio de un lago no se puede)
  let spot = null;
  for (let r = 1; r < 6 && !spot; r++) for (let a = 0; a < 8; a++) {
    const x = v.x + Math.cos(v.ang + Math.PI / 2 + a * Math.PI / 4) * r, y = v.y + Math.sin(v.ang + Math.PI / 2 + a * Math.PI / 4) * r;
    if (canStand(x, y)) { spot = { x, y }; break; }
  }
  if (!spot && !force) { toast('Acá no te podés bajar: acercate a tierra firme.'); return; }
  p.vehicle = null;
  v.v = 0; v.target = null;
  netPush({ k: 'vs', id: v.id, s: vehicleSync(v) });
  if (spot) { p.x = spot.x; p.y = spot.y; }
  sfx('click');
}

// Guardar el vehículo: devuelve los materiales, el combustible y la carga
function pickUpVehicle(v) {
  if (!v || vehicleDrivenByOther(v) || (S.player && S.player.vehicle === v.id)) return false;
  for (const k in v.cargo) giveItem(k, v.cargo[k]);
  if (v.fuelType && v.fuel) giveItem(v.fuelType, v.fuel);
  if (v.ammo) giveItem(VEHICLES[v.type].gun.ammo, v.ammo);
  refund(BUILDINGS[v.type].cost);
  S.vehicles.splice(S.vehicles.indexOf(v), 1);
  v._dead = true;
  netPush({ k: 'vr', id: v.id });
  toast(`Guardaste ${BUILDINGS[v.type].name.toLowerCase()}: volvieron los materiales y lo que llevaba.`);
  return true;
}

// Lo que se manda por la red cuando cambia un vehículo
function vehicleSync(v) {
  const r = (n) => Math.round(n * 100) / 100;
  return { x: r(v.x), y: r(v.y), ang: r(v.ang), hp: Math.round(v.hp), fuelType: v.fuelType, fuel: v.fuel, burn: Math.round(v.burn), ammo: v.ammo, cargo: v.cargo, total: v.total };
}

// --------------------------- Carga ---------------------------

function vehicleCargoCap(v) { return VEHICLES[v.type].cargo; }
function vehiclePut(v, k, n) {
  const room = vehicleCargoCap(v) - v.total;
  const m = Math.min(n, room, Math.floor(avail(k)));
  if (m <= 0) return 0;
  takeItem(k, m); add(v.cargo, k, m); v.total += m;
  return m;
}
function vehicleTake(v, k) {
  const n = v.cargo[k] || 0;
  if (!n) return 0;
  delete v.cargo[k]; v.total -= n; giveItem(k, n);
  return n;
}

// --------------------------- Manejar ---------------------------

function driveStep(dt) {
  const p = S.player, v = myVehicle();
  if (!v) { p.vehicle = null; return; }
  const d = VEHICLES[v.type];
  // Hacia dónde quiere ir: teclado, o el punto que tocaste en el mapa
  let want = null, throttle = 0;
  const inp = p.input;
  if (inp && (inp.x || inp.y)) { want = Math.atan2(inp.y, inp.x); throttle = 1; v.target = null; }
  else if (v.target) {
    const dx = wdx(v.target.x - v.x), dy = wdy(v.target.y - v.y), dist = Math.hypot(dx, dy);
    if (dist < 0.8) v.target = null;
    else { want = Math.atan2(dy, dx); throttle = Math.min(1, dist / 4); }
  }
  // Combustible
  const fuelMult = v.fuelType ? VEHICLE_FUEL[v.fuelType] || 1 : (v.lastFuel ? VEHICLE_FUEL[v.lastFuel] || 1 : 1);
  if (throttle > 0 && v.burn <= 0 && v.fuel > 0) { v.burn += FUEL_KJ[v.fuelType]; v.lastFuel = v.fuelType; if (--v.fuel === 0) v.fuelType = null; }
  const hasFuel = v.burn > 0;
  if (throttle > 0 && !hasFuel && !v.noFuelMsg) { v.noFuelMsg = true; toast('⛽ Se quedó sin combustible. Cargale desde su panel (tocalo).'); }
  if (hasFuel) v.noFuelMsg = false;
  const max = d.speed * fuelMult;
  // Girar hacia donde querés ir; si es para atrás, primero frena
  if (want !== null && hasFuel) {
    let da = want - v.ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const turn = d.turn * dt * Math.min(1, 0.35 + Math.abs(v.v) / 4);
    v.ang += Math.max(-turn, Math.min(turn, da));
    const aligned = Math.cos(da);
    const goal = max * throttle * Math.max(0.15, aligned);
    v.v += Math.sign(goal - v.v) * Math.min(Math.abs(goal - v.v), d.accel * dt);
  } else {
    v.v -= Math.sign(v.v) * Math.min(Math.abs(v.v), d.accel * 1.2 * dt);
  }
  if (hasFuel && Math.abs(v.v) > 0.1) v.burn -= d.kw * dt * (0.3 + 0.7 * Math.abs(v.v) / Math.max(1, max));
  // Moverse, chocando contra edificios (y el agua, salvo el aerodeslizador)
  const nx = wrapX(v.x + Math.cos(v.ang) * v.v * dt), ny = wrapY(v.y + Math.sin(v.ang) * v.v * dt);
  if (vehicleCanBe(v, nx, ny)) { v.x = nx; v.y = ny; }
  else if (vehicleCanBe(v, nx, v.y)) { v.x = nx; v.v *= 0.85; }
  else if (vehicleCanBe(v, v.x, ny)) { v.y = ny; v.v *= 0.85; }
  else {
    if (Math.abs(v.v) > 5) { hurtVehicle(v, Math.abs(v.v) * 3); sfx('click'); }
    v.v = -v.v * 0.25; v.target = null;
  }
  // Atropellar: bichos y criaturas
  if (Math.abs(v.v) > 3) {
    const hitR = d.wid * 0.7;
    for (const t of targetsNear(v.x, v.y, hitR)) {
      if (t.kind === 'n') continue;
      if (t.o._ramT && S.playTime - t.o._ramT < 0.5) continue;
      t.o._ramT = S.playTime;
      hitTarget(t, Math.abs(v.v) * d.ram, true);
      v.v *= 0.8;
      if (v.type !== 'tank') hurtVehicle(v, 4);
    }
  }
  p.x = v.x; p.y = v.y; p.ang = v.ang;
  p.moving = Math.abs(v.v) > 0.2;
  vehicleGun(v, dt);
  // De vez en cuando, que los demás vean dónde quedó (la posición en vivo va en la presencia)
  v.syncT = (v.syncT || 0) + dt;
  if (NET.on && v.syncT > 3) { v.syncT = 0; netPush({ k: 'vs', id: v.id, s: vehicleSync(v) }); }
}

// Disparo automático al enemigo más cercano
function vehicleGun(v, dt) {
  const g = VEHICLES[v.type].gun;
  if (!g) return;
  v.cd = Math.max(0, (v.cd || 0) - dt);
  if (v.cd > 0) return;
  const tg = targetsNear(v.x, v.y, g.range).filter((t) => tileExplored(Math.floor(t.x), Math.floor(t.y)))[0];
  if (!tg) return;
  if (g.laser) {
    if (v.burn < g.kj) { if (v.fuel <= 0) return; v.burn += FUEL_KJ[v.fuelType]; v.lastFuel = v.fuelType; if (--v.fuel === 0) v.fuelType = null; }
    v.burn -= g.kj;
  } else {
    if (v.shots <= 0) { if (v.ammo <= 0) return; v.ammo--; v.shots = g.per; }
    v.shots--;
  }
  v.cd = g.cd;
  v.aim = Math.atan2(wdy(tg.y - v.y), wdx(tg.x - v.x));
  const mult = typeof weaponMult === 'function' ? weaponMult() : 1;
  if (g.splash) {
    for (const t of targetsNear(tg.x, tg.y, g.splash)) hitTarget(t, g.dmg * mult * (t.o === tg.o ? 1 : 0.6), true);
    spawnExplosion(tg.x, tg.y, 0.8);
    sfx('boom', tg.x, tg.y);
  } else {
    hitTarget(tg, g.dmg * mult, true);
    sfx(g.laser ? 'laser' : 'shot', v.x, v.y);
  }
  shots.push({ x1: v.x, y1: v.y, x2: v.x + wdx(tg.x - v.x), y2: v.y + wdy(tg.y - v.y), t: 0, laser: !!g.laser });
}

function hurtVehicle(v, dmg) {
  const real = dmg * (1 - VEHICLES[v.type].armor);
  v.hp -= real;
  v.hurtT = 0.25;
  if (v.hp > 0) return;
  // Se rompe: explota, la carga queda tirada y el conductor sale despedido
  spawnExplosion(v.x, v.y, 1.4);
  sfx('boom', v.x, v.y);
  for (const k in v.cargo) S.drops.push({ id: S.nextId++, x: v.x + (Math.random() - 0.5), y: v.y + (Math.random() - 0.5), i: k, n: v.cargo[k], t: S.playTime });
  const mine = S.player && S.player.vehicle === v.id;
  if (mine) { exitVehicle(true); toast(`💥 Se rompió ${BUILDINGS[v.type].name.toLowerCase()}. La carga quedó tirada ahí.`); }
  S.vehicles.splice(S.vehicles.indexOf(v), 1);
  v._dead = true;
  netPush({ k: 'vr', id: v.id });
}

// Cada cuadro: los vehículos quietos se frenan solos; el propio se maneja
function updateVehicles(dt) {
  ensureVehicles();
  for (const v of S.vehicles) {
    v.hurtT = Math.max(0, (v.hurtT || 0) - dt);
    if (S.player && S.player.vehicle === v.id) continue;
    if (Math.abs(v.v) > 0) v.v -= Math.sign(v.v) * Math.min(Math.abs(v.v), 8 * dt);
  }
}

// --------------------------- Dibujo ---------------------------

function drawVehicle(g, v, x, y, ang, driver, t) {
  const d = VEHICLES[v.type];
  const L = d.len * TILE, Wd = d.wid * TILE;
  g.save();
  g.translate(x, y);
  // Sombra
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(3, 5, L * 0.55, Wd * 0.55, ang, 0, Math.PI * 2); g.fill();
  if (v.type === 'hover') {   // colchón de aire
    g.fillStyle = `rgba(160,210,255,${0.25 + 0.1 * Math.sin(t * 10)})`;
    g.beginPath(); g.ellipse(0, 0, L * 0.6, Wd * 0.62, ang, 0, Math.PI * 2); g.fill();
  }
  g.rotate(ang);
  const body = v.hurtT > 0 ? '#ff6b6b' : d.color;
  if (v.type === 'tank') {
    // Orugas
    g.fillStyle = '#2b2f26';
    rrect(g, -L / 2, -Wd / 2, L, Wd * 0.26, 3); g.fill();
    rrect(g, -L / 2, Wd / 2 - Wd * 0.26, L, Wd * 0.26, 3); g.fill();
    g.fillStyle = '#4a4f42';
    const off = ((v.dist || 0) * 6) % 6;
    for (let k = -L / 2 + off; k < L / 2; k += 6) { g.fillRect(k, -Wd / 2, 2, Wd * 0.26); g.fillRect(k, Wd / 2 - Wd * 0.26, 2, Wd * 0.26); }
    g.fillStyle = body; rrect(g, -L * 0.42, -Wd * 0.3, L * 0.84, Wd * 0.6, 5); g.fill();
  } else {
    // Ruedas
    if (v.type !== 'hover') {
      g.fillStyle = '#1b1d20';
      for (const [wx, wy] of [[-L * 0.32, -Wd * 0.5], [L * 0.3, -Wd * 0.5], [-L * 0.32, Wd * 0.5 - 5], [L * 0.3, Wd * 0.5 - 5]]) { rrect(g, wx - 5, wy, 10, 5, 2); g.fill(); }
    }
    g.fillStyle = body;
    rrect(g, -L / 2, -Wd * 0.42, L, Wd * 0.84, v.type === 'buggy' ? 4 : 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; rrect(g, -L / 2 + 2, -Wd * 0.42 + 2, L - 4, Wd * 0.2, 4); g.fill();
    // Parabrisas
    g.fillStyle = '#9fd3ff'; rrect(g, L * 0.08, -Wd * 0.3, L * 0.16, Wd * 0.6, 3); g.fill();
    if (v.type === 'buggy') { g.strokeStyle = '#7a5a2a'; g.lineWidth = 2; g.strokeRect(-L * 0.3, -Wd * 0.3, L * 0.35, Wd * 0.6); }
    if (v.type === 'truck') { g.fillStyle = '#3f4a2c'; g.fillRect(-L * 0.45, -Wd * 0.34, L * 0.4, Wd * 0.68); }
    if (v.type === 'hover') { g.fillStyle = '#e8eef4'; g.beginPath(); g.moveTo(-L / 2, -Wd * 0.42); g.lineTo(-L / 2 - 6, 0); g.lineTo(-L / 2, Wd * 0.42); g.fill(); }
  }
  // Faros (de noche alumbran poco, pero se ven)
  g.fillStyle = '#fff4c4'; g.fillRect(L / 2 - 3, -Wd * 0.34, 3, 4); g.fillRect(L / 2 - 3, Wd * 0.34 - 4, 3, 4);
  // Conductor
  if (driver) { g.fillStyle = driver; g.beginPath(); g.arc(-L * 0.05, 0, Wd * 0.18, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // Arma: torreta que apunta al enemigo
  const gun = d.gun;
  if (gun) {
    g.save(); g.translate(x, y); g.rotate(v.aim !== undefined ? v.aim : ang);
    g.fillStyle = v.type === 'hover' ? '#cfd4ff' : '#3a3f32';
    if (v.type === 'tank') { g.beginPath(); g.arc(0, 0, Wd * 0.26, 0, Math.PI * 2); g.fill(); g.fillRect(0, -3, L * 0.62, 6); }
    else { g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill(); g.fillRect(0, -2, L * 0.38, 4); }
    g.restore();
  }
  // Vida
  const max = BUILDINGS[v.type].hp;
  if (v.hp < max) hpBar(g, x, y + Wd * 0.75, 34, v.hp / max, v.hp / max > 0.35 ? '#5cc47a' : '#e5534b');
}

function drawVehicles(g, lod, t) {
  for (const v of S.vehicles || []) {
    if (vehicleDrivenByOther(v)) continue;   // a ese lo dibuja la presencia del que maneja
    if (lod) { g.fillStyle = VEHICLES[v.type].color; g.fillRect(v.x * TILE - 10, v.y * TILE - 10, 20, 20); continue; }
    const mine = S.player && S.player.vehicle === v.id;
    drawVehicle(g, v, v.x * TILE, v.y * TILE, v.ang, mine ? '#ffb347' : null, t);
  }
  if (NET.on && !lod) for (const a of NET.avatars.values()) {
    if (!a.dv) continue;
    const v = vehicleById(a.dv) || { type: a.dvt || 'buggy', hp: 1, id: a.dv };
    if (!VEHICLES[v.type]) continue;
    drawVehicle(g, { ...v, aim: undefined }, a.x * TILE, a.y * TILE, a.ang || 0, netColor(a.by), t);
  }
}
