'use strict';
// =====================================================================
//  Aventura: vida, nivel y experiencia del personaje, armas y armaduras,
//  criaturas salvajes, jefes en guaridas, ruinas para saquear y botín.
//  Solo funciona con personaje (en el modo clásico no hay nadie que pelee).
// =====================================================================

// --------------------------- Equipo ---------------------------

const GEAR = {
  sword:  { name: 'Espada',          slot: 'weapon', melee: true, dmg: 12, cd: 0.5,  range: 1.7, desc: 'Rápida, de cerca.' },
  hammer: { name: 'Martillo',        slot: 'weapon', melee: true, dmg: 25, cd: 1.05, range: 1.9, splash: 1.4, desc: 'Lento; golpea a todos los de alrededor.' },
  pistol: { name: 'Pistola',         slot: 'weapon', dmg: 9,  cd: 0.4,  range: 7,   ammo: 'ammo', per: 10, desc: 'De lejos. 1 munición = 10 tiros.' },
  rifle:  { name: 'Rifle',           slot: 'weapon', dmg: 22, cd: 0.95, range: 11,  ammo: 'ammo', per: 5,  desc: 'Muy de lejos y fuerte. 1 munición = 5 tiros.' },
  flamer: { name: 'Lanzallamas',     slot: 'weapon', dmg: 5,  cd: 0.15, range: 4.5, splash: 1.3, ammo: 'solid_fuel', per: 40, tech: 'oil', desc: 'Quema todo lo que tiene adelante. 1 combustible sólido = 40 llamaradas.' },
  light:  { name: 'Traje liviano',   slot: 'armor', armor: 8,  hp: 15, move: 0.08, desc: 'Protege poco pero te deja correr más.' },
  heavy:  { name: 'Armadura pesada', slot: 'armor', armor: 16, hp: 30, move: -0.08, desc: 'Protege mucho pero pesa.' },
  helmet: { name: 'Casco',           slot: 'head',  armor: 4,  hp: 8,  desc: 'Protege la cabeza.' },
  gloves: { name: 'Guantes',         slot: 'hands', armor: 2,  hp: 4,  spd: 0.06, desc: 'Pegás un poco más rápido.' },
  boots:  { name: 'Botas',           slot: 'feet',  armor: 3,  hp: 4,  move: 0.06, desc: 'Corrés más rápido.' },
  ring:   { name: 'Anillo',          slot: 'ring',  dmgp: 0.04, desc: 'Más daño con cualquier arma. Podés usar dos.' },
  amulet: { name: 'Amuleto',         slot: 'neck',  hp: 12, leech: 0.01, desc: 'Más vida y un poco de robo de vida.' },
};
// Lugares del cuerpo donde va el equipo (los anillos van en cualquiera de las dos manos)
const SLOTS = {
  weapon: { name: 'Arma',   ico: '🗡️' },
  head:   { name: 'Cabeza', ico: '⛑️' },
  neck:   { name: 'Cuello', ico: '📿' },
  hands:  { name: 'Manos',  ico: '🧤' },
  armor:  { name: 'Pecho',  ico: '🦺' },
  ring1:  { name: 'Anillo', ico: '💍' },
  feet:   { name: 'Pies',   ico: '🥾' },
  ring2:  { name: 'Anillo', ico: '💍' },
};
const slotsFor = (b) => (GEAR[b].slot === 'ring' ? ['ring1', 'ring2'] : [GEAR[b].slot]);
const wornSlot = (p, id) => Object.keys(SLOTS).find((k) => p.equip && p.equip[k] === id) || null;
const GEAR_ORDER = Object.keys(GEAR);

// Niveles del equipo: el material marca cuánto pega o protege
const TIERS = [null,
  { roman: 'I',   mat: 'de hierro',   lvl: 1,  mult: 1,   cost: { iron_plate: 12, gear: 4 } },
  { roman: 'II',  mat: 'de acero',    lvl: 6,  mult: 1.7, cost: { steel: 10, circuit: 5, quitina: 6 }, tech: 'steel' },
  { roman: 'III', mat: 'de titanio',  lvl: 11, mult: 2.6, cost: { titanium_plate: 10, processor: 3, colmillo: 8 }, tech: 'titanium' },
  { roman: 'IV',  mat: 'compuesta',   lvl: 16, mult: 3.8, cost: { low_density: 4, battery: 6, colmillo: 12, cristal: 3 }, tech: 'rocketry' },
  { roman: 'V',   mat: 'estelar',     lvl: 21, mult: 5.4, cost: { superconductor: 6, quantum_processor: 2, corazon: 2, cristal: 6 }, tech: 'superconductors' },
];
const MAX_TIER = 5;

const RARITY = [
  { name: 'Común',      color: '#c9d1db', bonus: 0 },
  { name: 'Raro',       color: '#5aa0ff', bonus: 1 },
  { name: 'Épico',      color: '#b67cff', bonus: 2 },
  { name: 'Legendario', color: '#f0a742', bonus: 3 },
];
// Bonus al azar del equipo raro: [nombre, mínimo, máximo, formato]
const BONUS = {
  dmg:   ['daño',              0.10, 0.30, 'pct'],
  spd:   ['velocidad de ataque', 0.08, 0.25, 'pct'],
  hp:    ['vida',              15,   45,   'flat'],
  arm:   ['armadura',          3,    9,    'flat'],
  leech: ['robo de vida',      0.02, 0.06, 'pct'],
  move:  ['velocidad al correr', 0.04, 0.10, 'pct'],
};

const MAX_LEVEL = 30;
const xpFor = (lvl) => Math.round(40 * Math.pow(lvl, 1.6));   // experiencia para pasar de lvl a lvl+1
const GEAR_BAG = 40;

// --------------------------- Criaturas ---------------------------

const CREATURES = {
  beetle:  { name: 'Escarabajo',     hp: 30,  dmg: 5,  speed: 2.0, range: 1.1, cd: 1.1, xp: 6,  size: 0.45, color: '#7a5c2e', drops: [['quitina', 0.6, 1, 2]] },
  stalker: { name: 'Acechador',      hp: 45,  dmg: 8,  speed: 3.4, range: 1.2, cd: 0.9, xp: 10, size: 0.5,  color: '#5d7a4a', minL: 2, drops: [['colmillo', 0.5, 1, 2], ['quitina', 0.3, 1, 1]] },
  spitter: { name: 'Escupidor',      hp: 35,  dmg: 7,  speed: 1.5, range: 5,   cd: 1.6, xp: 10, size: 0.5,  color: '#7f9a2e', minL: 2, ranged: true, drops: [['quitina', 0.5, 1, 2], ['colmillo', 0.25, 1, 1]] },
  golem:   { name: 'Gólem de roca',  hp: 180, dmg: 18, speed: 1.0, range: 1.4, cd: 1.6, xp: 30, size: 0.85, color: '#7d7468', minL: 4, drops: [['cristal', 0.35, 1, 1], ['stone', 1, 4, 8]] },
  // Jefes: viven en guaridas
  queen:   { name: 'Reina de la colmena', boss: true, hp: 1500, dmg: 22, speed: 1.6, range: 1.8, cd: 1.2, xp: 400, size: 1.5, color: '#8b3f7a', summon: 'beetle' },
  colossus:{ name: 'Coloso de piedra',    boss: true, hp: 2600, dmg: 40, speed: 1.1, range: 2.2, cd: 2.2, xp: 600, size: 1.9, color: '#6f665b', slam: 3 },
};
const SHIP_SAFE = 28;   // cerca de la nave no aparecen criaturas

// --------------------------- Utilidades ---------------------------

const rpgOn = () => playerOn();
function shipCenter() {
  const hub = S.entities.find((e) => e.type === 'hub' || e.type === 'lander');
  return hub ? { x: hub.x + sizeOf(hub.type) / 2, y: hub.y + sizeOf(hub.type) / 2 } : { x: W / 2, y: H / 2 };
}
// Nivel de peligro de una zona: crece con la distancia a la nave
function zoneLevel(x, y) {
  const c = shipCenter();
  const d = wdist(x, y, c.x, c.y);
  return Math.max(1, Math.min(15, 1 + Math.floor((d - SHIP_SAFE) / 45)));
}
const rnd01 = Math.random;
function seededRnd(n) { return mulberry32(((S.seed | 0) ^ Math.imul(n | 0, 0x9e3779b1)) >>> 0); }

function ensureRpg(p) {
  if (!p) return;
  if (p.lvl === undefined) p.lvl = 1;
  if (p.xp === undefined) p.xp = 0;
  if (!Array.isArray(p.gear)) p.gear = [];
  if (!p.equip) p.equip = {};
  for (const k in SLOTS) if (!(k in p.equip)) p.equip[k] = null;
  if (p.hp === undefined) p.hp = playerStats(p).maxHp;
  if (p.atkCd === undefined) p.atkCd = 0;
}
function ensureWorldRpg() {
  if (!S.creatures) S.creatures = [];
  if (!S.drops) S.drops = [];
  if (S.surface === 'moon') { if (!S.ruins) S.ruins = []; if (!S.lairs) S.lairs = []; }
  if (!S.lairs || !S.ruins) generateAdventure();
  if (!S.podsGen) generatePods();
  for (const b of S.biters) if (!b.id) b.id = S.nextId++;
}

const gearById = (p, id) => (id && p.gear ? p.gear.find((g) => g.id === id) : null);
function gearName(g) { return `${GEAR[g.b].name} ${TIERS[g.t].mat}`; }
function gearLabel(g) {
  const r = RARITY[g.r || 0];
  return `<span style="color:${r.color}">${escapeHtml(gearName(g))}</span> <span class="muted">${TIERS[g.t].roman}</span>`;
}
function bonusText(x) {
  return Object.entries(x || {}).map(([k, v]) => { const b = BONUS[k]; return b[3] === 'pct' ? `+${Math.round(v * 100)} % ${b[0]}` : `+${Math.round(v)} ${b[0]}`; }).join(' · ');
}
function newGear(b, t, r = 0, seed = Math.random) {
  const x = {};
  const sl = GEAR[b].slot;
  const keys = Object.keys(BONUS).filter((k) => sl === 'weapon' ? k !== 'arm' : sl === 'ring' || sl === 'neck' ? true : k !== 'spd' && k !== 'leech');
  for (let i = 0; i < RARITY[r].bonus && keys.length; i++) {
    const k = keys.splice(Math.floor(seed() * keys.length), 1)[0];
    const [, lo, hi, fmt] = BONUS[k];
    let v = lo + seed() * (hi - lo);
    if (fmt === 'flat') v = Math.round(v * (1 + (t - 1) * 0.5));
    x[k] = fmt === 'pct' ? Math.round(v * 100) / 100 : v;
  }
  return { id: 'g' + Date.now().toString(36) + Math.floor(seed() * 1e6).toString(36), b, t, r, x };
}

// Lo que da todo junto: nivel + arma + todo lo que tiene puesto + bonus
function playerStats(p) {
  const lvl = p.lvl || 1;
  const eq = p.equip || {};
  const w = gearById(p, eq.weapon);
  const x = {};
  let armor = 0, hp = 0, move = 0, spd = 0, dmgp = 0, leech = 0;
  for (const k in SLOTS) {
    const g = gearById(p, eq[k]);
    if (!g) continue;
    for (const b in g.x) x[b] = (x[b] || 0) + g.x[b];
    if (k === 'weapon') continue;
    const d = GEAR[g.b];
    armor += (d.armor || 0) * TIERS[g.t].mult;
    hp += (d.hp || 0) * g.t;
    move += d.move || 0;
    spd += d.spd || 0;
    dmgp += (d.dmgp || 0) * g.t;
    leech += d.leech || 0;
  }
  const lvlMult = 1 + 0.04 * (lvl - 1);
  const dm = 1 + (x.dmg || 0) + dmgp, sp = 1 + (x.spd || 0) + spd;
  let wpn;
  if (w) {
    const d = GEAR[w.b];
    wpn = { ...d, dmg: d.dmg * TIERS[w.t].mult * lvlMult * dm, cd: d.cd / sp, gear: w };
  } else wpn = { name: 'Puños', melee: true, dmg: 4 * lvlMult * dm, cd: 0.6 / sp, range: 1.4 };
  armor += (x.arm || 0) + suitArmor(p);
  return {
    lvl, wpn, armor,
    reduce: armor / (armor + 50),
    maxHp: Math.round(100 + 12 * (lvl - 1) + hp + (x.hp || 0)),
    leech: leech + (x.leech || 0),
    move: move + (x.move || 0),
  };
}

function gainXp(n) {
  const p = S.player;
  if (!p || p.lvl >= MAX_LEVEL) return;
  p.xp += Math.round(n);
  while (p.lvl < MAX_LEVEL && p.xp >= xpFor(p.lvl)) {
    p.xp -= xpFor(p.lvl);
    p.lvl++;
    p.hp = playerStats(p).maxHp;
    sfx('research');
    toast(`⭐ ¡Subiste a <b>nivel ${p.lvl}</b>! Más vida y más daño.`);
    const unlocked = TIERS.findIndex((t) => t && t.lvl === p.lvl);
    if (unlocked > 0) toast(`🛡️ Ya podés usar equipo de nivel <b>${TIERS[unlocked].roman}</b> (${TIERS[unlocked].mat}).`);
  }
}

// --------------------------- Generación de guaridas y ruinas ---------------------------

function generateAdventure() {
  S.lairs = []; S.ruins = [];
  const rnd = mulberry32((S.seed ^ 0x2c1b3c6d) >>> 0);
  const c = shipCenter();
  const K = (W * H) / (320 * 240);
  const R = Math.min(W, H) / 2;
  const free = (x, y, s) => { for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const o = oreAt(x + dx, y + dy); if (at(x + dx, y + dy) || isLiquidO(o) || o === 'oil') return false; } return true; };
  const nLairs = Math.max(4, Math.round(3 + K * 0.3));
  for (let tries = 0; S.lairs.length < nLairs && tries < 4000; tries++) {
    const a = rnd() * Math.PI * 2, d = R * (0.35 + rnd() * 0.6);
    const x = Math.round(wrapX(c.x + Math.cos(a) * d)), y = Math.round(wrapY(c.y + Math.sin(a) * d));
    if (!free(x - 1, y - 1, 3) || S.lairs.some((l) => wdist(l.x, l.y, x, y) < R * 0.35)) continue;
    S.lairs.push({ id: S.nextId++, x, y, b: S.lairs.length % 2 ? 'colossus' : 'queen', L: Math.min(15, zoneLevel(x, y) + 2), alive: true, at: 0 });
  }
  const nRuins = Math.max(12, Math.round(K * 5));
  for (let tries = 0; S.ruins.length < nRuins && tries < 8000; tries++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    if (wdist(x, y, c.x, c.y) < SHIP_SAFE + 12 || !free(x - 1, y - 1, 3)) continue;
    if (S.ruins.some((r) => wdist(r.x, r.y, x, y) < 25)) continue;
    S.ruins.push({ id: S.nextId++, x, y, L: zoneLevel(x, y), looted: false, guarded: false });
  }
}

// Cápsulas de escape de tu nave, desparramadas por el planeta: traen cosas de fábrica
// (circuitos, motores, módulos, ciencia). Cuanto más lejos, mejores.
function generatePods() {
  S.podsGen = 1;
  const rnd = mulberry32((S.seed ^ 0x51ed27a3) >>> 0);
  const c = shipCenter();
  const K = (W * H) / (320 * 240);
  const n = Math.max(8, Math.round(K * 3));
  let made = 0;
  for (let tries = 0; made < n && tries < 6000; tries++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    const o = oreAt(x, y);
    if (wdist(x, y, c.x, c.y) < SHIP_SAFE + 20 || at(x, y) || isLiquidO(o) || o === 'oil') continue;
    if (S.ruins.some((r) => wdist(r.x, r.y, x, y) < 18)) continue;
    S.ruins.push({ id: S.nextId++, x, y, L: zoneLevel(x, y), looted: false, guarded: false, pod: true });
    made++;
  }
}

// --------------------------- Criaturas ---------------------------

function spawnCreature(k, x, y, L, extra) {
  const d = CREATURES[k];
  const hp = Math.round(d.hp * 1.15 * (1 + 0.5 * (L - 1)));
  const c = { id: S.nextId++, k, x: wrapX(x), y: wrapY(y), hx: x, hy: y, L, hp, mh: hp, ang: rnd01() * 6.28, cd: 0, ...extra };
  S.creatures.push(c);
  return c;
}

function pickCreature(L) {
  const opts = Object.keys(CREATURES).filter((k) => !CREATURES[k].boss && (CREATURES[k].minL || 1) <= L);
  const w = opts.map((k) => (k === 'beetle' ? Math.max(1, 6 - L) : k === 'golem' ? 1 + L * 0.3 : 2 + L * 0.2));
  let r = rnd01() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < opts.length; i++) if ((r -= w[i]) <= 0) return opts[i];
  return opts[0];
}

function walkableFor(x, y) {
  const o = oreAt(Math.floor(x), Math.floor(y));
  return !isLiquidO(o) && !cliffAt(Math.floor(x), Math.floor(y));
}

// Todos los personajes que hay (el propio y los de los amigos)
function heroes() {
  const list = [];
  if (playerOn()) list.push({ x: S.player.x, y: S.player.y, me: true });
  if (NET.on) for (const a of NET.avatars.values()) list.push({ x: a.x, y: a.y, me: false });
  return list;
}

let spawnTimer = 0;
function spawnAround(dt) {
  if (offEarth()) return;
  // Solo el anfitrión (o el que juega solo) hace aparecer cosas; a los demás les llega en la foto
  if (NET.on && NET.role !== 'host') return;
  spawnTimer += dt;
  if (spawnTimer < 2) return;
  spawnTimer = 0;
  const hs = heroes();
  const c = shipCenter();
  for (const h of hs) {
    // Guaridas: el jefe aparece cuando alguien se acerca
    for (const l of S.lairs) {
      if (!l.alive) { if (S.playTime >= l.at) l.alive = true; else continue; }
      if (wdist(h.x, h.y, l.x, l.y) > 16 || S.creatures.some((k) => k.lair === l.id)) continue;
      spawnCreature(l.b, l.x + 0.5, l.y + 0.5, l.L, { lair: l.id });
      for (let i = 0; i < 4; i++) spawnCreature(pickCreature(l.L), l.x + (rnd01() - 0.5) * 6, l.y + (rnd01() - 0.5) * 6, l.L, { lair: l.id, guard: true });
      toast(`💀 <b>${CREATURES[l.b].name}</b> (nivel ${l.L}) despertó en su guarida.`);
      sfx('alarm');
    }
    // Ruinas: tienen guardianes la primera vez que alguien se acerca
    for (const r of S.ruins) {
      if (r.guarded || r.looted || wdist(h.x, h.y, r.x, r.y) > 12) continue;
      r.guarded = true;
      const n = 2 + Math.floor(rnd01() * 3);
      for (let i = 0; i < n; i++) spawnCreature(pickCreature(r.L), r.x + (rnd01() - 0.5) * 7, r.y + (rnd01() - 0.5) * 7, r.L);
    }
    if (wdist(h.x, h.y, c.x, c.y) < SHIP_SAFE + 6) continue;
    const L = zoneLevel(h.x, h.y);
    const near = S.creatures.filter((k) => !k.lair && wdist(k.x, k.y, h.x, h.y) < 45).length;
    const want = Math.min(14, 5 + Math.floor(L / 2));
    if (near >= want || S.creatures.length > 160) continue;
    const kind = pickCreature(L);
    const a = rnd01() * Math.PI * 2, d = 24 + rnd01() * 10;
    const x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
    if (!walkableFor(x, y) || wdist(x, y, c.x, c.y) < SHIP_SAFE) continue;
    const n = kind === 'golem' ? 1 : 1 + Math.floor(rnd01() * 3);
    for (let i = 0; i < n; i++) spawnCreature(kind, x + (rnd01() - 0.5) * 3, y + (rnd01() - 0.5) * 3, Math.max(1, L + Math.floor(rnd01() * 2) - 1));
  }
  // Las que quedaron lejos de todos se van
  S.creatures = S.creatures.filter((k) => k.lair || hs.some((h) => wdist(k.x, k.y, h.x, h.y) < 70));
  // Botín olvidado
  S.drops = S.drops.filter((d) => S.playTime - d.t < 600);
}

function creatureStep(c, dt, hs) {
  const d = CREATURES[c.k];
  c.cd -= dt;
  if (c.hitT) c.hitT = Math.max(0, c.hitT - dt);
  // A quién persigue: el personaje más cercano dentro de su olfato
  const smell = d.boss ? 14 : 9 + (c.angry ? 6 : 0);
  let tgt = null, bd = smell;
  for (const h of hs) { const dd = wdist(c.x, c.y, h.x, h.y); if (dd < bd) { bd = dd; tgt = h; } }
  if (!tgt) {
    // Pasea cerca de donde apareció; el jefe vuelve a su guarida y se cura
    if (d.boss || c.guard) {
      const hx = wdx(c.hx - c.x), hy = wdy(c.hy - c.y), hd = Math.hypot(hx, hy);
      if (hd > 1) { c.x = wrapX(c.x + hx / hd * d.speed * 0.6 * slowMul(c) * dt); c.y = wrapY(c.y + hy / hd * d.speed * 0.6 * slowMul(c) * dt); c.ang = Math.atan2(hy, hx); c.mv = true; }
      else c.mv = false;
      if (d.boss) c.hp = Math.min(c.mh, c.hp + c.mh * 0.05 * dt);
      return;
    }
    c.ang += (rnd01() - 0.5) * 2 * dt;
    const nx = c.x + Math.cos(c.ang) * 0.5 * dt, ny = c.y + Math.sin(c.ang) * 0.5 * dt;
    if (walkableFor(nx, ny)) { c.x = wrapX(nx); c.y = wrapY(ny); } else c.ang += Math.PI;
    c.mv = true;
    return;
  }
  const dx = wdx(tgt.x - c.x), dy = wdy(tgt.y - c.y), dist = Math.hypot(dx, dy) || 0.01;
  c.ang = Math.atan2(dy, dx);
  const reach = d.range + (d.size || 0.5) * 0.5;
  if (dist <= reach) {
    c.mv = false;
    if (c.cd <= 0) {
      c.cd = d.cd;
      c.atk = 0.25;
      const dmg = d.dmg * (1 + 0.3 * (c.L - 1));
      if (d.ranged) shots.push({ x1: c.x, y1: c.y, x2: c.x + dx, y2: c.y + dy, t: 0, spit: true });
      if (d.slam) { spawnExplosion(c.x + Math.cos(c.ang) * 1.2, c.y + Math.sin(c.ang) * 1.2, 1.2); }
      // El daño lo calcula cada uno para su propio personaje
      for (const h of hs) if (h.me && wdist(c.x, c.y, h.x, h.y) <= reach + (d.slam ? 1.5 : 0.3)) hurtPlayer(dmg, d.name);
      if (d.summon && rnd01() < 0.35 && S.creatures.length < 170 && !(NET.on && NET.role !== 'host')) spawnCreature(d.summon, c.x + (rnd01() - 0.5) * 2, c.y + (rnd01() - 0.5) * 2, c.L, { lair: c.lair, guard: true });
    }
    return;
  }
  const sp = d.speed * dt * (c.hitT ? 0.6 : 1) * slowMul(c);
  const nx = c.x + dx / dist * sp, ny = c.y + dy / dist * sp;
  if (walkableFor(nx, ny)) { c.x = wrapX(nx); c.y = wrapY(ny); }
  else if (walkableFor(nx, c.y)) c.x = wrapX(nx);
  else if (walkableFor(c.x, ny)) c.y = wrapY(ny);
  c.mv = true;
  c.step = (c.step || 0) + sp * 3;
}

// --------------------------- Golpes ---------------------------

// Algo que se puede atacar: criatura, bicho o nido
function targetsNear(x, y, r) {
  const out = [];
  for (const c of S.creatures) { const d = wdist(x, y, c.x, c.y); if (d <= r + CREATURES[c.k].size * 0.5) out.push({ kind: 'c', o: c, d, x: c.x, y: c.y }); }
  for (const b of S.biters) { if (b.dead) continue; const d = wdist(x, y, b.x, b.y); if (d <= r + 0.3) out.push({ kind: 'b', o: b, d, x: b.x, y: b.y }); }
  for (const n of S.entities) { if (!isEnemyB(n)) continue; const h = sizeOf(n.type) / 2, d = wdist(x, y, n.x + h, n.y + h); if (d <= r + h) out.push({ kind: 'n', o: n, d, x: n.x + h, y: n.y + h }); }
  return out.sort((a, b) => a.d - b.d);
}

function hitTarget(t, dmg, byMe) {
  if (t.kind === 'c') {
    const c = t.o;
    c.hp -= dmg; c.hitT = 0.3; c.angry = true;
    if (NET.on && NET.role !== 'host' && byMe) netPush({ k: 'hc', id: c.id, d: Math.round(dmg) });
    if (c.hp <= 0 && !c.dead) killCreature(c, byMe);
  } else if (t.kind === 'b') {
    const b = t.o;
    b.hp -= dmg;
    if (b.state === 'idle') { b.state = 'attack'; b._t = null; b.pchase = true; }
    if (NET.on && NET.role !== 'host' && byMe) netPush({ k: 'hb', id: b.id, d: Math.round(dmg) });
    if (b.hp <= 0 && !b.dead) {
      b.dead = true;
      if (byMe) gainXp(BITERS[b.kind].hp * 0.25 + 3);
      if (!(NET.on && NET.role !== 'host')) dropLoot(b.x, b.y, [['quitina', 0.35, 1, 1]], 1);
    }
  } else {
    const n = t.o;
    if (NET.on && NET.role !== 'host' && byMe) netPush({ k: 'hn', x: n.x, y: n.y, d: Math.round(dmg) });
    const was = n.hp === undefined ? maxHp(n) : n.hp;
    damageEntity(n, dmg);
    if (n._dead && was > 0 && byMe) gainXp(60);
  }
}

function killCreature(c, byMe) {
  c.dead = true;
  const d = CREATURES[c.k];
  S.creatures = S.creatures.filter((k) => k !== c);
  spawnSplat(c.x, c.y, d.color);
  sfx('splat', c.x, c.y);
  if (byMe) gainXp(d.xp * (1 + 0.5 * (c.L - 1)));
  S.kills = (S.kills || 0) + 1;
  // El botín lo decide el anfitrión (o el que juega solo)
  if (NET.on && NET.role !== 'host') return;
  if (d.boss) {
    const l = S.lairs.find((x) => x.id === c.lair);
    if (l) { l.alive = false; l.at = S.playTime + 1800; }
    dropLoot(c.x, c.y, [['corazon', 1, 2, 3], ['cristal', 1, 3, 5], ['colmillo', 1, 4, 8]], c.L);
    dropGear(c.x, c.y, c.L, 2 + (rnd01() < 0.35 ? 1 : 0));
    toast(`🏆 ¡Derrotaron a <b>${d.name}</b>! Dejó botín especial.`);
    return;
  }
  dropLoot(c.x, c.y, d.drops, c.L);
  // A veces, equipo raro
  const roll = rnd01();
  if (roll < 0.04 + c.L * 0.004) dropGear(c.x, c.y, c.L, roll < 0.006 ? 3 : roll < 0.02 ? 2 : 1);
}

function dropLoot(x, y, table, L) {
  for (const [item, chance, lo, hi] of table) {
    if (rnd01() > chance) continue;
    const n = lo + Math.floor(rnd01() * (hi - lo + 1)) + (L > 6 && item !== 'stone' ? 1 : 0);
    S.drops.push({ id: S.nextId++, x: x + (rnd01() - 0.5) * 0.8, y: y + (rnd01() - 0.5) * 0.8, i: item, n, t: S.playTime });
  }
}

function gearTierFor(L) { return Math.max(1, Math.min(MAX_TIER, 1 + Math.floor((L - 1) / 3))); }
function dropGear(x, y, L, r) {
  const b = GEAR_ORDER[Math.floor(rnd01() * GEAR_ORDER.length)];
  S.drops.push({ id: S.nextId++, x: x + (rnd01() - 0.5) * 0.8, y: y + (rnd01() - 0.5) * 0.8, g: newGear(b, gearTierFor(L), r), t: S.playTime });
}

// --------------------------- Personaje ---------------------------

function hurtPlayer(dmg, from) {
  const p = S.player;
  if (!p || p.safeT > 0) return;
  // Manejando, los golpes se los lleva el vehículo
  const veh = p.vehicle && vehicleById(p.vehicle);
  if (veh) { hurtVehicle(veh, dmg); return; }
  dmg = suitAbsorb(p, dmg);   // primero el escudo de la armadura
  if (dmg <= 0) return;
  const st = playerStats(p);
  const real = dmg * (1 - st.reduce);
  p.hp -= real;
  p.hurtT = 0.25;
  p.calmT = 0;
  spawnDamageNum(p.x, p.y - 0.6, Math.round(real), '#ff6b6b');
  if (p.hp <= 0) playerDie(from);
}

function playerDie(from) {
  const p = S.player;
  const items = { ...S.pinv };
  const has = Object.values(items).some((n) => n > 0);
  if (has) { p.bag = { x: p.x, y: p.y, items }; S.pinv = {}; }
  const c = shipCenter();
  p.x = c.x; p.y = c.y + 2.5;
  p.path = null; p.mine = null; p.queue.length = 0;
  p.hp = playerStats(p).maxHp;
  p.safeT = 4;
  followCam = true;
  for (const k of S.creatures) k.angry = false;
  sfx('alarm');
  toast(`💀 Te derrotó ${escapeHtml(from || 'un bicho')}. Volviste a la nave.${has ? ' Tu mochila quedó donde caíste (la marca 🎒 en el mapa).' : ''}`);
}

// Ataque automático al enemigo más cercano que esté al alcance
function playerCombat(dt) {
  const p = S.player;
  ensureRpg(p);
  const st = playerStats(p);
  if (p.hp > st.maxHp) p.hp = st.maxHp;
  p.safeT = Math.max(0, (p.safeT || 0) - dt);
  p.hurtT = Math.max(0, (p.hurtT || 0) - dt);
  p.swing = Math.max(0, (p.swing || 0) - dt);
  p.calmT = (p.calmT || 0) + dt;
  if (p.calmT > 6 && p.hp < st.maxHp) p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.03 * dt);
  p.atkCd -= dt;
  if (p.atkCd > 0) return;
  let w = st.wpn;
  let tgts = targetsNear(p.x, p.y, w.range).filter((t) => tileExplored(Math.floor(t.x), Math.floor(t.y)));
  if (!tgts.length) return;
  // Munición: si no hay, a las piñas (si está cerca)
  if (w.ammo) {
    if (!(p.mag > 0)) {
      if (avail(w.ammo) >= 1) { takeItem(w.ammo, 1); p.mag = w.per; }
      else {
        if (!p.ammoWarn || S.playTime - p.ammoWarn > 20) { p.ammoWarn = S.playTime; toast(`Tu ${w.name.toLowerCase()} no tiene ${ITEMS[w.ammo].name.toLowerCase()}. Peleás con las manos.`); }
        w = { name: 'Puños', melee: true, dmg: 4 * (1 + 0.04 * (p.lvl - 1)), cd: 0.6, range: 1.4 };
        tgts = tgts.filter((t) => t.d <= w.range);
        if (!tgts.length) return;
      }
    }
    if (w.ammo) p.mag--;
  }
  const t = tgts[0];
  p.ang = Math.atan2(wdy(t.y - p.y), wdx(t.x - p.x));
  p.atkCd = w.cd;
  p.swing = 0.22;
  p.swingMelee = !!w.melee;
  const dmg = w.dmg * (0.9 + rnd01() * 0.2);
  const victims = w.splash ? targetsNear(t.x, t.y, w.splash) : [t];
  for (const v of victims) hitTarget(v, dmg, true);
  if (st.leech) p.hp = Math.min(st.maxHp, p.hp + dmg * st.leech);
  spawnDamageNum(t.x, t.y - 0.5, Math.round(dmg), '#ffe08a');
  if (!w.melee) {
    shots.push({ x1: p.x, y1: p.y, x2: p.x + wdx(t.x - p.x), y2: p.y + wdy(t.y - p.y), t: 0, flame: w === GEAR.flamer || (w.gear && w.gear.b === 'flamer') });
    sfx('shot', p.x, p.y);
  } else sfx('click', p.x, p.y);
}

// El perrito muerde lo que se acerca a su dueño
function petCombat(dt) {
  const p = S.player, d = p.pet;
  if (!d || d.gone || d.mode === 'sit') return;
  d.biteCd = Math.max(0, (d.biteCd || 0) - dt);
  const t = targetsNear(p.x, p.y, 6).find((x) => x.kind !== 'n');
  if (!t) { d.fight = null; return; }
  d.fight = { x: t.x, y: t.y };
  if (wdist(d.x, d.y, t.x, t.y) < 1 && d.biteCd <= 0) {
    d.biteCd = 1;
    const dmg = 5 + 3 * (d.level || 1);
    hitTarget(t, dmg, true);
    spawnDamageNum(t.x, t.y - 0.4, dmg, '#ffd0a0');
    d.happyT = Math.max(d.happyT, 0.6);
  }
}

// Bichos de nido: si el personaje anda cerca, lo atacan
function rpgBiterHook(b, dt) {
  if (!playerOn()) return false;
  const p = S.player;
  const d = wdist(b.x, b.y, p.x, p.y);
  if (!b.pchase && !(d < 5 && (b.state === 'attack' || d < 3))) return false;
  if (d > 14) { b.pchase = false; return false; }
  b.pchase = true;
  const k = BITERS[b.kind];
  b.cd -= dt;
  const dx = wdx(p.x - b.x), dy = wdy(p.y - b.y);
  b.ang = Math.atan2(dy, dx);
  if (d < (k.range ? k.range * 0.8 : 0.9)) {
    if (b.cd <= 0) {
      b.cd = k.range ? 1.4 : 1; hurtPlayer(k.dmg * 0.6, k.name.toLowerCase());
      if (k.range) shots.push({ x1: b.x, y1: b.y, x2: b.x + dx, y2: b.y + dy, t: 0, spit: true });
    }
    return true;
  }
  const nx = b.x + dx / d * k.speed * slowMul(b) * dt, ny = b.y + dy / d * k.speed * slowMul(b) * dt;
  if (walkableFor(nx, ny)) { b.x = wrapX(nx); b.y = wrapY(ny); }
  return true;
}

// Recoger botín, la mochila perdida y saquear ruinas al pasar
function pickUps() {
  const p = S.player;
  for (let i = S.drops.length - 1; i >= 0; i--) {
    const d = S.drops[i];
    if (wdist(p.x, p.y, d.x, d.y) > 1.3) continue;
    if (d.g) {
      if (p.gear.length >= GEAR_BAG) { if (!p.bagWarn || S.playTime - p.bagWarn > 15) { p.bagWarn = S.playTime; toast('Tu bolso de equipo está lleno: desarmá algo en ⚔️ Equipo.'); } continue; }
      p.gear.push(d.g);
      toast(`✨ Encontraste ${gearLabel(d.g)}${d.g.r ? ` · <span class="muted">${bonusText(d.g.x)}</span>` : ''}`);
    } else {
      giveItem(d.i, d.n);
      toast(`+${d.n} ${itemImg(d.i, 'ico-s')} ${ITEMS[d.i].name}`);
    }
    S.drops.splice(i, 1);
    if (NET.on && NET.role !== 'host') netPush({ k: 'pk', id: d.id });
    sfx('click');
  }
  if (p.bag && wdist(p.x, p.y, p.bag.x, p.bag.y) < 1.5) {
    for (const k in p.bag.items) add(S.pinv, k, p.bag.items[k]);
    p.bag = null;
    toast('🎒 Recuperaste tu mochila.');
    sfx('place');
  }
  for (const r of S.ruins) {
    if (r.looted || wdist(p.x, p.y, r.x + 0.5, r.y + 0.5) > 1.8) continue;
    lootRuin(r);
  }
}

// El botín de cada ruina sale de su número: es el mismo para todos los jugadores
function lootRuin(r) {
  r.looted = true;
  if (NET.on && NET.role !== 'host') netPush({ k: 'rl', id: r.id });
  const rnd = seededRnd(r.id);
  const L = r.L;
  const got = [];
  const give = (k, n) => { if (n > 0) { giveItem(k, n); got.push(`${n} ${itemImg(k, 'ico-s')}`); } };
  if (r.pod) {
    // Cápsula: cosas de la fábrica y ciencia, mejores cuanto más lejos
    give('circuit', 5 + Math.floor(rnd() * 10) + L * 2);
    give(L >= 3 ? 'engine' : 'gear', 3 + Math.floor(rnd() * 6));
    give('solid_fuel', 4 + Math.floor(rnd() * 8));
    give('sci_red', 10 + Math.floor(rnd() * 10));
    if (L >= 2) give('sci_green', 5 + Math.floor(rnd() * 10));
    if (L >= 4) give('sci_blue', 3 + Math.floor(rnd() * 6));
    if (L >= 4) give('processor', 2 + Math.floor(rnd() * 4));
    if (L >= 6) give('battery', 3 + Math.floor(rnd() * 5));
    if (L >= 6 && rnd() < 0.5) give(['speed_module', 'eff_module', 'prod_module'][Math.floor(rnd() * 3)], 1);
    if (L >= 9) give('sci_purple', 2 + Math.floor(rnd() * 4));
    if (L >= 7 && rnd() < 0.4) give('cristal', 1 + Math.floor(rnd() * 2));
    gainXp(20 + L * 10);
    sfx('research');
    toast(`🛰️ Abriste una cápsula de escape: ${got.join(' ')}`);
    return;
  }
  give('iron_plate', 8 + Math.floor(rnd() * 15));
  give(L >= 3 ? 'steel' : 'copper_plate', 4 + Math.floor(rnd() * 10));
  give('circuit', Math.floor(rnd() * 6));
  give('quitina', Math.floor(rnd() * 4));
  if (L >= 2) give('colmillo', Math.floor(rnd() * 3));
  if (L >= 3 || rnd() < 0.4) give('cristal', 1 + Math.floor(rnd() * Math.min(4, L)));
  if (L >= 8 && rnd() < 0.3) give('corazon', 1);
  if (rnd() < 0.45) {
    const p = S.player;
    const g = newGear(GEAR_ORDER[Math.floor(rnd() * GEAR_ORDER.length)], gearTierFor(L), rnd() < 0.15 ? 2 : 1, rnd);
    if (p.gear.length < GEAR_BAG) { p.gear.push(g); got.push(gearLabel(g)); }
  }
  gainXp(15 + L * 8);
  sfx('research');
  toast(`📦 Saqueaste unas ruinas: ${got.join(' ')}`);
}

// --------------------------- Paso principal ---------------------------

function updateRpg(dt) {
  if (!S.character) return;
  ensureWorldRpg();
  spawnAround(dt);
  const hs = heroes();
  for (const c of S.creatures.slice()) if (!c.dead) creatureStep(c, dt, hs);
  for (const c of S.creatures) if (c.atk) c.atk = Math.max(0, c.atk - dt);
  updateWeapons(dt);
  if (!playerOn()) return;
  suitStep(dt);
  if (!S.player.vehicle) playerCombat(dt);
  petCombat(dt);
  pickUps();
}

// --------------------------- Armería ---------------------------

function tierAvailable(t) { return !TIERS[t].tech || hasTech(TIERS[t].tech); }
function craftCost(b, t) {
  const c = { ...TIERS[t].cost };
  if (!GEAR[b].melee && GEAR[b].slot === 'weapon') c.circuit = (c.circuit || 0) + 2 * t;   // las de fuego llevan circuitos
  const sl = GEAR[b].slot;
  // Las piezas chicas cuestan menos, pero piden partes de bichos de más lejos
  const part = { head: 0.6, hands: 0.6, feet: 0.6, ring: 0.4, neck: 0.4 }[sl];
  if (part) for (const k in c) c[k] = Math.max(1, Math.ceil(c[k] * part));
  if (sl === 'armor') c.quitina = (c.quitina || 0) + 2 * t;
  if (sl === 'head' || sl === 'hands' || sl === 'feet') c.quitina = (c.quitina || 0) + t;
  if (sl === 'ring') c.colmillo = (c.colmillo || 0) + 2 * t;
  if (sl === 'neck') c.cristal = (c.cristal || 0) + t;
  return c;
}
function upgradeCost(g) {
  const c = craftCost(g.b, g.t + 1);
  for (const k in c) c[k] = Math.ceil(c[k] * 0.7);
  return c;
}
function craftGear(b, t) {
  const p = S.player;
  const cost = craftCost(b, t);
  if (!tierAvailable(t)) { toast('Todavía no investigaste el material.'); return false; }
  if (p.lvl < TIERS[t].lvl) { toast(`Necesitás nivel ${TIERS[t].lvl}.`); return false; }
  if (GEAR[b].tech && !hasTech(GEAR[b].tech)) { toast(`Necesitás investigar ${TECHS[GEAR[b].tech].name}.`); return false; }
  if (!canAfford(cost)) { toast(`Te falta: ${missingText(cost)}`); return false; }
  if (p.gear.length >= GEAR_BAG) { toast('Tu bolso de equipo está lleno.'); return false; }
  pay(cost);
  const g = newGear(b, t, 0);
  p.gear.push(g);
  // Si no tenía nada en ese lugar, se lo pone
  const free = slotsFor(b).find((k) => !gearById(p, p.equip[k]));
  if (free) p.equip[free] = g.id;
  sfx('place');
  toast(`🛠️ Fabricaste ${gearLabel(g)}`);
  return true;
}
function upgradeGear(id) {
  const p = S.player, g = gearById(p, id);
  if (!g || g.t >= MAX_TIER) return false;
  const nt = g.t + 1, cost = upgradeCost(g);
  if (!tierAvailable(nt)) { toast('Todavía no investigaste el material.'); return false; }
  if (p.lvl < TIERS[nt].lvl) { toast(`Necesitás nivel ${TIERS[nt].lvl}.`); return false; }
  if (!canAfford(cost)) { toast(`Te falta: ${missingText(cost)}`); return false; }
  pay(cost);
  g.t = nt;
  for (const k in g.x) if (BONUS[k][3] === 'flat') g.x[k] = Math.round(g.x[k] * 1.25);
  sfx('research');
  toast(`⬆️ Mejoraste a ${gearLabel(g)}`);
  return true;
}
// Desarmar: devuelve la mitad de lo que costó
function salvageGear(id) {
  const p = S.player, g = gearById(p, id);
  if (!g) return false;
  const c = craftCost(g.b, g.t);
  for (const k in c) giveItem(k, Math.floor(c[k] * 0.5) + (g.r || 0));
  p.gear = p.gear.filter((x) => x !== g);
  for (const s in p.equip) if (p.equip[s] === id) p.equip[s] = null;
  toast(`♻️ Desarmaste ${gearLabel(g)}.`);
  return true;
}
// Ponerse algo (en un lugar elegido, o en el primero libre); si ya lo tiene puesto, se lo saca
function equipGear(id, to) {
  const p = S.player, g = gearById(p, id);
  if (!g) return false;
  ensureRpg(p);
  const from = wornSlot(p, id);
  if (!to && from) { p.equip[from] = null; p.mag = 0; sfx('click'); return true; }
  const ok = slotsFor(g.b);
  if (to && !ok.includes(to)) { toast(`${GEAR[g.b].name} va en ${ok.map((k) => SLOTS[k].name.toLowerCase()).join(' o ')}.`); return false; }
  if (p.lvl < TIERS[g.t].lvl) { toast(`Necesitás nivel ${TIERS[g.t].lvl} para usarlo.`); return false; }
  const slot = to || ok.find((k) => !gearById(p, p.equip[k])) || ok[0];
  if (from === slot) return false;
  if (from) p.equip[from] = gearById(p, p.equip[slot]) ? p.equip[slot] : null;   // cambiar los anillos de mano
  p.equip[slot] = id;
  if (slot === 'weapon') p.mag = 0;
  sfx('click');
  return true;
}
function unequipSlot(slot) {
  const p = S.player;
  if (!p.equip[slot]) return false;
  p.equip[slot] = null;
  if (slot === 'weapon') p.mag = 0;
  sfx('click');
  return true;
}

// --------------------------- Interfaz ---------------------------

const gearIconCache = {};
function gearIcon(b, r = 0) {
  const key = b + r;
  if (!gearIconCache[key]) {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const g = c.getContext('2d');
    g.fillStyle = RARITY[r].color + '33'; g.beginPath(); g.arc(20, 20, 18, 0, 7); g.fill();
    drawGearIcon(g, b, 20, 21, 12, RARITY[r].color);
    gearIconCache[key] = c.toDataURL();
  }
  return gearIconCache[key];
}
const gearImg = (b, r, cls = 'ico') => `<img class="${cls}" src="${gearIcon(b, r)}" alt="">`;

function gearStatText(g) {
  const d = GEAR[g.b], m = TIERS[g.t].mult, x = g.x || {};
  if (d.slot === 'weapon') return `${Math.round(d.dmg * m * (1 + (x.dmg || 0)))} de daño · ${(1 / d.cd * (1 + (x.spd || 0))).toFixed(1)} golpes/s · alcance ${d.range}`;
  const t = [];
  const arm = (d.armor || 0) * m + (x.arm || 0);
  if (arm) t.push(`${Math.round(arm)} de armadura`);
  if (d.hp) t.push(`+${d.hp * g.t} de vida`);
  if (d.dmgp) t.push(`+${Math.round(d.dmgp * g.t * 100)} % de daño`);
  if (d.spd) t.push(`+${Math.round(d.spd * 100)} % velocidad de ataque`);
  if (d.leech) t.push(`${Math.round(d.leech * 100)} % robo de vida`);
  if (d.move) t.push(`${d.move > 0 ? '+' : ''}${Math.round(d.move * 100)} % al correr`);
  return t.join(' · ');
}

// Fila de la barra de arriba: vida y nivel
function heroChipText() {
  const p = S.player;
  ensureRpg(p);
  const st = playerStats(p);
  return `❤️ ${Math.ceil(p.hp)}/${st.maxHp} · ⭐ ${p.lvl}`;
}

// --- Ventana de equipo: casillas del cuerpo + bolso, con arrastrar y soltar ---
let gearSel = null;   // { id } o { slot }

function gearStatsHtml() {
  const p = S.player, st = playerStats(p), need = xpFor(p.lvl);
  return `<div class="gs-lvl"><b>⭐ Nivel ${p.lvl}</b>${p.lvl < MAX_LEVEL ? ` <span class="muted small">${p.xp} / ${need}</span>${bar(p.xp / need)}` : ' <span class="ok small">máximo</span>'}</div>` +
    `<div class="gs-row"><span title="Vida">❤️ ${Math.ceil(p.hp)}/${st.maxHp}</span><span title="Daño por golpe">⚔️ ${Math.round(st.wpn.dmg)}</span>` +
    `<span title="Golpes por segundo">⚡ ${(1 / st.wpn.cd).toFixed(1)}/s</span><span title="Armadura (menos daño recibido)">🛡️ ${Math.round(st.armor)} <small>−${Math.round(st.reduce * 100)} %</small></span>` +
    (st.move ? `<span title="Velocidad al correr">👟 ${st.move > 0 ? '+' : ''}${Math.round(st.move * 100)} %</span>` : '') +
    (st.leech ? `<span title="Robo de vida">🩸 ${Math.round(st.leech * 100)} %</span>` : '') + '</div>';
}

function gearCell(g, attrs, cls = '') {
  if (!g) return '';
  const r = RARITY[g.r || 0];
  return `<div class="gcell ${cls}" ${attrs} style="--rc:${r.color}">${gearImg(g.b, g.r || 0, 'gimg')}<span class="gt">${TIERS[g.t].roman}</span></div>`;
}

// Cuánto cambia si te lo ponés en vez de lo que tenés
function gearCompare(g) {
  const p = S.player, from = wornSlot(p, g.id);
  if (from || p.lvl < TIERS[g.t].lvl) return '';
  const slot = slotsFor(g.b).find((k) => !gearById(p, p.equip[k])) || slotsFor(g.b)[0];
  const before = playerStats(p);
  const old = p.equip[slot];
  p.equip[slot] = g.id;
  const after = playerStats(p);
  p.equip[slot] = old;
  const d = [];
  const add = (v, name, f) => {
    const txt = f === 'pct' ? Math.round(v * 100) + ' %' : f === 'dec' ? v.toFixed(1) : Math.round(v);
    if (Math.abs(v) >= (f === 'pct' ? 0.005 : f === 'dec' ? 0.05 : 0.5)) d.push(`<span class="${v > 0 ? 'ok' : 'bad'}">${v > 0 ? '+' : ''}${txt} ${name}</span>`);
  };
  add(after.wpn.dmg - before.wpn.dmg, 'daño');
  add(1 / after.wpn.cd - 1 / before.wpn.cd, 'golpes/s', 'dec');
  add(after.armor - before.armor, 'armadura');
  add(after.maxHp - before.maxHp, 'vida');
  add(after.move - before.move, 'al correr', 'pct');
  add(after.leech - before.leech, 'robo de vida', 'pct');
  return d.length ? `<div class="small">Si te lo ponés: ${d.join(' · ')}</div>` : '';
}

function gearDetailHtml() {
  const p = S.player;
  let g = null, slot = null;
  if (gearSel && gearSel.slot) { slot = gearSel.slot; g = gearById(p, p.equip[slot]); }
  else if (gearSel && gearSel.id) g = gearById(p, gearSel.id);
  if (!g) {
    if (slot) return `<div class="gdetail muted small">${SLOTS[slot].ico} <b>${SLOTS[slot].name}</b>: vacío. Arrastrá acá algo de tu bolso, o tocá un objeto y después “Ponérmelo”.</div>`;
    return '<div class="gdetail muted small">Tocá un objeto para ver qué hace. Arrastralo a una casilla del cuerpo para ponértelo (en el celu, mantené apretado y arrastrá).</div>';
  }
  const on = wornSlot(p, g.id), lowLvl = p.lvl < TIERS[g.t].lvl, d = GEAR[g.b];
  return `<div class="gdetail">${gearCell(g, '', 'big')}<div class="gear-info"><div>${gearLabel(g)}${on ? ' <span class="ok small">· puesto</span>' : ''}</div>` +
    `<div class="muted small">${SLOTS[slotsFor(g.b)[0]].name} · ${gearStatText(g)}</div>` +
    (g.r ? `<div class="small" style="color:${RARITY[g.r].color}">${RARITY[g.r].name}: ${bonusText(g.x)}</div>` : `<div class="muted small">${d.desc}</div>`) +
    (lowLvl ? `<div class="bad small">Necesitás nivel ${TIERS[g.t].lvl}</div>` : gearCompare(g)) +
    `<div class="gear-btns"><button type="button" class="small-btn${on ? '' : ' primary'}" data-geq="${g.id}" ${lowLvl && !on ? 'disabled' : ''}>${on ? 'Sacármelo' : 'Ponérmelo'}</button>` +
    `<button type="button" class="small-btn" data-gsal="${g.id}" title="Desarmar: devuelve la mitad de los materiales">♻️ Desarmar</button></div></div></div>`;
}

function renderGearModal() {
  const box = $('gear-body');
  if (!box || !playerOn()) { if (box) box.innerHTML = '<p>El equipo es para jugar con personaje.</p>'; return; }
  const p = S.player;
  ensureRpg(p);
  if (gearSel && gearSel.id && !gearById(p, gearSel.id)) gearSel = null;
  let h = `<div class="hero-stats" id="gear-stats">${gearStatsHtml()}</div>`;
  // El muñeco: cada casilla es una parte del cuerpo
  h += '<div class="gdoll"><svg class="gsil" viewBox="0 0 100 160" aria-hidden="true"><circle cx="50" cy="22" r="15"/><path d="M28 44h44l10 52-12 2-6-30v86H56l-6-48-6 48H36V68l-6 30-12-2z"/></svg>';
  for (const k in SLOTS) {
    const g = gearById(p, p.equip[k]);
    const sel = gearSel && gearSel.slot === k ? ' sel' : '';
    h += `<div class="gslot s-${k}${g ? ' full' : ''}${sel}" data-slot="${k}" title="${SLOTS[k].name}">` +
      (g ? gearCell(g, `data-gid="${g.id}"`) : `<span class="gico">${SLOTS[k].ico}</span><span class="gname">${SLOTS[k].name}</span>`) + '</div>';
  }
  h += '</div>';
  h += `<div id="gear-detail">${gearDetailHtml()}</div>`;
  // El bolso: lo que no tenés puesto
  const order = Object.keys(GEAR);
  const bag = p.gear.filter((g) => !wornSlot(p, g.id)).sort((a, b) => (order.indexOf(a.b) - order.indexOf(b.b)) || (b.t - a.t) || ((b.r || 0) - (a.r || 0)));
  h += `<div class="pick-title">🎒 Bolso de equipo <span class="muted small">(${p.gear.length}/${GEAR_BAG})</span></div><div class="gbag" data-bag="1">`;
  for (const g of bag) {
    const cls = (gearSel && gearSel.id === g.id ? 'sel ' : '') + (p.lvl < TIERS[g.t].lvl ? 'low' : '');
    h += gearCell(g, `data-gid="${g.id}"`, cls);
  }
  for (let i = bag.length; i < Math.max(16, Math.ceil((bag.length + 1) / 8) * 8); i++) h += '<div class="gcell empty"></div>';
  h += '</div>';
  h += `<div id="suit-panel">${suitPanelHtml()}</div>`;
  if (!p.gear.length) h += '<p class="muted small">Todavía no tenés equipo. Construí una <b>Armería</b> para fabricarlo, o conseguilo peleando y saqueando ruinas.</p>';
  h += '<p class="muted small">Tu personaje ataca solo al enemigo más cercano que esté al alcance del arma. Las armas de fuego gastan munición y el lanzallamas, combustible sólido.</p>';
  box.innerHTML = h;
}

// Arrastrar equipo: con mouse enseguida; con el dedo, manteniendo apretado un momento
const gdrag = { on: false, pend: null, timer: 0, ghost: null, id: null, from: null };
function gearDragStart(id, from, x, y) {
  gdrag.on = true; gdrag.id = id; gdrag.from = from;
  const g = gearById(S.player, id);
  const el = document.createElement('div');
  el.id = 'drag-ghost';
  el.innerHTML = `<img src="${gearIcon(g.b, g.r || 0)}" width="44" height="44" alt="">`;
  document.body.appendChild(el);
  gdrag.ghost = el;
  gearDragMove(x, y);
  for (const k of slotsFor(g.b)) { const s = document.querySelector(`#gear-body .gslot[data-slot="${k}"]`); if (s) s.classList.add('can'); }
  if (navigator.vibrate) try { navigator.vibrate(15); } catch (_) { /* nada */ }
}
function gearDropAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? { slot: el.closest('#gear-body .gslot'), bag: el.closest('#gear-body .gbag') } : {};
}
function gearDragMove(x, y) {
  gdrag.ghost.style.left = x + 'px'; gdrag.ghost.style.top = y + 'px';
  const t = gearDropAt(x, y);
  for (const s of document.querySelectorAll('#gear-body .drop-ok')) s.classList.remove('drop-ok');
  const tgt = t.slot || t.bag;
  if (tgt) tgt.classList.add('drop-ok');
}
function gearDragEnd(x, y, cancel) {
  clearTimeout(gdrag.timer);
  gdrag.pend = null;
  if (!gdrag.on) return;
  gdrag.on = false;
  if (gdrag.ghost) gdrag.ghost.remove();
  gdrag.ghost = null;
  gearDragEndedAt = performance.now();
  if (!cancel) {
    const t = gearDropAt(x, y);
    if (t.slot) { if (equipGear(gdrag.id, t.slot.dataset.slot)) gearSel = { slot: t.slot.dataset.slot }; }
    else if (t.bag && gdrag.from) { unequipSlot(gdrag.from); gearSel = { id: gdrag.id }; }
  }
  renderGearModal();
}
let gearDragEndedAt = 0;

function initRpgUi() {
  const body = $('gear-body');
  body.addEventListener('click', (ev) => {
    if (performance.now() - gearDragEndedAt < 300) return;
    const b = ev.target.closest('button');
    if (b && b.dataset.suit) {
      const a = b.dataset.suit, v = b.dataset.v;
      if (a === 'wear') wearSuit(v); else if (a === 'off') takeOffSuit(); else if (a === 'add') addSuitEq(v); else if (a === 'rm') removeSuitEq(+v);
      renderGearModal();
      return;
    }
    if (b) {
      if (b.dataset.geq) { equipGear(b.dataset.geq); renderGearModal(); }
      if (b.dataset.gsal) {
        if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; return; }
        salvageGear(b.dataset.gsal); gearSel = null; renderGearModal();
      }
      return;
    }
    const slot = ev.target.closest('.gslot');
    if (slot) { gearSel = { slot: slot.dataset.slot }; renderGearModal(); return; }
    const c = ev.target.closest('.gbag [data-gid]');
    if (c) { gearSel = { id: c.dataset.gid }; renderGearModal(); }
  });
  // Doble clic: ponérselo o sacárselo de una
  body.addEventListener('dblclick', (ev) => {
    const c = ev.target.closest('[data-gid]');
    if (c) { equipGear(c.dataset.gid); renderGearModal(); }
  });
  body.addEventListener('pointerdown', (ev) => {
    const c = ev.target.closest('[data-gid]');
    if (!c || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const slot = c.closest('.gslot');
    gdrag.pend = { id: c.dataset.gid, from: slot ? slot.dataset.slot : null, x: ev.clientX, y: ev.clientY, touch: ev.pointerType !== 'mouse' };
    if (gdrag.pend.touch) {
      const pd = gdrag.pend;
      gdrag.timer = setTimeout(() => { if (gdrag.pend === pd) gearDragStart(pd.id, pd.from, pd.x, pd.y); }, 260);
    }
  });
  document.addEventListener('pointermove', (ev) => {
    const pd = gdrag.pend;
    if (gdrag.on) { gearDragMove(ev.clientX, ev.clientY); return; }
    if (!pd) return;
    const far = Math.hypot(ev.clientX - pd.x, ev.clientY - pd.y) > 7;
    if (!far) return;
    if (pd.touch) { clearTimeout(gdrag.timer); gdrag.pend = null; return; }   // con el dedo, moverse rápido es desplazar
    gearDragStart(pd.id, pd.from, ev.clientX, ev.clientY);
  });
  document.addEventListener('pointerup', (ev) => gearDragEnd(ev.clientX, ev.clientY, false));
  document.addEventListener('pointercancel', () => { if (!gdrag.on) { clearTimeout(gdrag.timer); gdrag.pend = null; } });
  // Mientras se arrastra con el dedo, la ventana no se desplaza
  document.addEventListener('touchmove', (ev) => {
    if (!gdrag.on) return;
    ev.preventDefault();
    const t = ev.touches[0];
    if (t) gearDragMove(t.clientX, t.clientY);
  }, { passive: false });
  document.addEventListener('touchend', (ev) => {
    if (!gdrag.on) return;
    const t = ev.changedTouches[0];
    gearDragEnd(t.clientX, t.clientY, false);
  });
  body.addEventListener('contextmenu', (ev) => { if (ev.target.closest('[data-gid]')) ev.preventDefault(); });
  $('hero-chip').addEventListener('click', () => openModal('gear'));
}

// Mientras la ventana está abierta, la vida se actualiza sin redibujar todo (para no perder clics)
let gearSoftAt = 0;
function renderGearModalSoft() {
  if (performance.now() - gearSoftAt < 1000) return;
  gearSoftAt = performance.now();
  const el = $('gear-stats');
  if (el) el.innerHTML = gearStatsHtml();
}

// Panel de la Armería
const armorySel = { b: 'sword', t: 1 };
function armoryHtml() {
  if (!playerOn()) return '<p>La Armería es para jugar con personaje.</p>';
  const p = S.player;
  ensureRpg(p);
  let h = '<div class="pick-title">Elegí qué fabricar</div><div class="picker">' +
    GEAR_ORDER.map((b) => `<button type="button" class="pick${armorySel.b === b ? ' on' : ''}" data-act="gsel" data-v="${b}" title="${GEAR[b].name}">${gearImg(b, 0)}</button>`).join('') + '</div>';
  const d = GEAR[armorySel.b];
  h += `<p><b>${d.name}</b> <span class="muted small">${d.desc}</span></p>`;
  h += '<div class="pick-title">Material</div><div class="picker">' + [1, 2, 3, 4, 5].map((t) => {
    const ok = tierAvailable(t);
    return `<button type="button" class="pick tier${armorySel.t === t ? ' on' : ''}" data-act="gtier" data-v="${t}" ${ok ? '' : 'disabled'} title="${ok ? TIERS[t].mat : 'Falta investigar'}">${TIERS[t].roman}</button>`;
  }).join('') + '</div>';
  const t = armorySel.t;
  const preview = { b: armorySel.b, t, r: 0, x: {} };
  const cost = craftCost(armorySel.b, t);
  const why = !tierAvailable(t) ? `Investigá <b>${TECHS[TIERS[t].tech].name}</b>.` : d.tech && !hasTech(d.tech) ? `Investigá <b>${TECHS[d.tech].name}</b>.` : p.lvl < TIERS[t].lvl ? `Necesitás <b>nivel ${TIERS[t].lvl}</b> (tenés ${p.lvl}).` : '';
  h += `<p>${gearLabel(preview)}<br><span class="muted small">${gearStatText(preview)}</span></p>` +
    `<div class="tc-cost">Pide: ${costHtml(cost, true)}</div>` + (why ? `<p class="bad small">${why}</p>` : '') +
    `<div class="actions"><button type="button" class="primary" data-act="gcraft" ${why ? 'disabled' : ''}>🛠️ Fabricar</button></div>`;
  // Mejorar lo que tenés puesto
  const worn = Object.keys(SLOTS).map((s) => gearById(p, p.equip[s])).filter(Boolean);
  if (worn.length) {
    h += '<div class="pick-title">Mejorar lo que tenés puesto (conserva los bonus)</div>';
    for (const g of worn) {
      if (g.t >= MAX_TIER) { h += `<p class="small">${gearLabel(g)} <span class="ok">· al máximo</span></p>`; continue; }
      const c = upgradeCost(g);
      h += `<div class="gear-row">${gearImg(g.b, g.r || 0)}<div class="gear-info"><div>${gearLabel(g)} → <b>${TIERS[g.t + 1].roman}</b></div><div class="small">${costHtml(c, true)}</div></div>` +
        `<div class="gear-btns"><button type="button" class="small-btn primary" data-act="gup" data-v="${g.id}" ${tierAvailable(g.t + 1) && p.lvl >= TIERS[g.t + 1].lvl ? '' : 'disabled'}>⬆️</button></div></div>`;
    }
  }
  h += '<div class="actions"><button type="button" data-act="gearopen">⚔️ Ver mi equipo</button></div>';
  return h;
}
