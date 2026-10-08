'use strict';
// =====================================================================
//  Armadura con grilla de equipo (como en Factorio). Es aparte del equipo RPG:
//  la armadura da casillas, y en cada casilla va un equipo que genera, guarda
//  o gasta energía.
// =====================================================================

const SUITS = {
  modular_armor:   { slots: 4,  armor: 8 },
  power_armor:     { slots: 8,  armor: 16 },
  power_armor_mk2: { slots: 12, armor: 28 },
};
const SUIT_EQ = {
  eq_solar:       { gen: 30, desc: 'Genera 30 kW de día.' },
  eq_fusion:      { gen: 750, desc: 'Genera 750 kW siempre.' },
  eq_battery:     { store: 20000, desc: 'Guarda 20 MJ.' },
  eq_battery2:    { store: 100000, desc: 'Guarda 100 MJ.' },
  eq_shield:      { shield: 50, use: 120, desc: '+50 de escudo: frena los golpes antes que la vida.' },
  eq_shield2:     { shield: 150, use: 240, desc: '+150 de escudo.' },
  eq_exo:         { move: 0.3, use: 200, desc: '+30 % de velocidad al caminar.' },
  eq_roboport:    { build: true, use: 150, desc: 'Robots propios: construyen los planos y reparan cerca tuyo (12 casillas).' },
  eq_nightvision: { night: true, use: 10, desc: 'De noche ves casi como de día.' },
  eq_laser:       { laser: true, use: 50, desc: 'Le dispara solo a los enemigos a 12 casillas.' },
};
const SUIT_BASE_STORE = 1000;   // kJ que guarda la armadura sola

const suitOf = (p) => (p && p.suit && SUITS[p.suit.k] ? p.suit : null);
const suitCount = (p, k) => { const s = suitOf(p); return s ? s.eq.filter((x) => x === k).length : 0; };
function suitCap(p) {
  const s = suitOf(p);
  if (!s) return 0;
  return SUIT_BASE_STORE + s.eq.reduce((a, k) => a + (SUIT_EQ[k].store || 0), 0);
}
const suitShieldMax = (p) => { const s = suitOf(p); return s ? s.eq.reduce((a, k) => a + (SUIT_EQ[k].shield || 0), 0) : 0; };
const suitArmor = (p) => { const s = suitOf(p); return s ? SUITS[s.k].armor : 0; };
// Con energía, el exoesqueleto suma velocidad
const suitMove = (p) => (suitOf(p) && (p.suitE || 0) > 1 ? 1 + 0.3 * suitCount(p, 'eq_exo') : 1);
const nightVisionOn = () => playerOn() && suitCount(S.player, 'eq_nightvision') > 0 && (S.player.suitE || 0) > 1;

// Los golpes los frena primero el escudo
function suitAbsorb(p, dmg) {
  if (!(p.shield > 0)) return dmg;
  const a = Math.min(p.shield, dmg);
  p.shield -= a;
  return dmg - a;
}

let suitBuildT = 0, suitLaserT = 0;
function suitStep(dt) {
  const p = S.player, s = suitOf(p);
  if (!s) { p.shield = 0; return; }
  const cap = suitCap(p);
  let e = Math.min(cap, p.suitE || 0);
  // Generación
  const sun = sunLevel() * weatherSolar() * (S.surface === 'moon' ? 1.5 : 1);
  e = Math.min(cap, e + (suitCount(p, 'eq_solar') * SUIT_EQ.eq_solar.gen * sun + suitCount(p, 'eq_fusion') * SUIT_EQ.eq_fusion.gen) * dt);
  const draw = (kw) => { const need = kw * dt; if (e < need) return false; e -= need; return true; };
  // Exoesqueleto (solo caminando), visión nocturna (solo de noche)
  if (p.moving) draw(suitCount(p, 'eq_exo') * SUIT_EQ.eq_exo.use);
  if (darkness() > 0.1) draw(suitCount(p, 'eq_nightvision') * SUIT_EQ.eq_nightvision.use);
  // Escudos: se recargan de a poco
  const smax = suitShieldMax(p);
  p.shield = Math.min(smax, p.shield || 0);
  if (p.shield < smax && draw(s.eq.reduce((a, k) => a + (SUIT_EQ[k].shield ? SUIT_EQ[k].use : 0), 0))) p.shield = Math.min(smax, p.shield + smax * 0.08 * dt);
  // Láser de defensa
  suitLaserT -= dt;
  const lasers = suitCount(p, 'eq_laser');
  if (lasers && suitLaserT <= 0 && !p.vehicle) {
    const t = nearestEnemy(p.x, p.y, 12);
    if (t && e >= SUIT_EQ.eq_laser.use * lasers) {
      e -= SUIT_EQ.eq_laser.use * lasers;
      hitTarget(t, 22 * lasers, true);
      shots.push({ x1: p.x, y1: p.y - 0.4, x2: p.x + wdx(t.x - p.x), y2: p.y + wdy(t.y - p.y), t: 0, laser: true });
      suitLaserT = 0.6;
    } else suitLaserT = 0.3;
  }
  // Puerto de robots personal: construye planos y repara cerca
  suitBuildT -= dt;
  const ports = suitCount(p, 'eq_roboport');
  if (ports && suitBuildT <= 0) {
    suitBuildT = 1 / ports;
    if (e >= SUIT_EQ.eq_roboport.use) {
      let best = null, bd = 12;
      for (const g of S.ghosts) { const d = wdist(p.x, p.y, g.x + 0.5, g.y + 0.5); if (d < bd) { bd = d; best = g; } }
      if (best && canAfford(BUILDINGS[best.type].cost)) {
        const g = best;
        S.ghosts.splice(S.ghosts.indexOf(g), 1);
        const ent = place(g.type, g.x, g.y, g.dir, { silent: true });
        if (ent) {
          if (g.recipe && ent.recipe !== undefined) ent.recipe = g.recipe;
          if (g.filter && ent.filter !== undefined) ent.filter = g.filter;
          e -= SUIT_EQ.eq_roboport.use;
          effects.push({ x: g.x + 0.5, y: g.y + 0.5, t: 0, life: 0.5, kind: 'boom', scale: 0.3 });
        } else S.ghosts.push(g);
      } else {
        for (const ent of S.entities) {
          if (ent.hp === undefined || !isPlayer(ent) || wdist(p.x, p.y, ent.x, ent.y) > 12) continue;
          ent.hp = Math.min(maxHp(ent), ent.hp + maxHp(ent) * 0.25);
          if (ent.hp >= maxHp(ent)) delete ent.hp;
          e -= SUIT_EQ.eq_roboport.use * 0.5;
          break;
        }
      }
    }
  }
  p.suitE = e;
}

// --------------------------- Poner y sacar ---------------------------

function wearSuit(k) {
  const p = S.player;
  if (!SUITS[k] || avail(k) < 1) return false;
  const old = suitOf(p);
  takeItem(k, 1);
  const eq = old ? old.eq.slice(0, SUITS[k].slots) : [];
  if (old) { for (const x of old.eq.slice(SUITS[k].slots)) giveItem(x, 1); giveItem(old.k, 1); }
  p.suit = { k, eq };
  p.suitE = Math.min(p.suitE || 0, suitCap(p));
  sfx('place');
  return true;
}
function takeOffSuit() {
  const p = S.player, s = suitOf(p);
  if (!s) return;
  for (const x of s.eq) giveItem(x, 1);
  giveItem(s.k, 1);
  p.suit = null; p.suitE = 0; p.shield = 0;
}
function addSuitEq(k) {
  const p = S.player, s = suitOf(p);
  if (!s || !SUIT_EQ[k] || avail(k) < 1) return false;
  if (s.eq.length >= SUITS[s.k].slots) { toast('La grilla está llena.'); return false; }
  takeItem(k, 1);
  s.eq.push(k);
  sfx('click');
  return true;
}
function removeSuitEq(i) {
  const p = S.player, s = suitOf(p);
  if (!s || !s.eq[i]) return;
  giveItem(s.eq[i], 1);
  s.eq.splice(i, 1);
  p.suitE = Math.min(p.suitE || 0, suitCap(p));
}

function suitPanelHtml() {
  const p = S.player, s = suitOf(p);
  let h = '<div class="pick-title">🦾 Armadura con grilla</div>';
  const suitsHave = Object.keys(SUITS).filter((k) => avail(k) >= 1);
  if (!s) {
    h += suitsHave.length ? '<div class="actions">' + suitsHave.map((k) => `<button type="button" data-suit="wear" data-v="${k}">${itemImg(k, 'ico-s')} Ponerse ${ITEMS[k].name.toLowerCase()}</button>`).join('') + '</div>'
      : `<p class="muted small">${hasTech('modular_armor') ? 'Fabricá una <b>Armadura modular</b> (a mano o en una ensambladora) para poner equipo en su grilla.' : 'Investigá <b>Armadura modular</b>: una armadura con casillas para escudos, baterías, exoesqueleto y más.'}</p>`;
    return h;
  }
  const cap = suitCap(p), smax = suitShieldMax(p);
  h += `<div class="row">${itemLabel(s.k)}<button type="button" class="small-btn" data-suit="off">Sacarse</button></div>`;
  h += row('⚡ Energía', `${Math.floor((p.suitE || 0) / 1000)} / ${Math.floor(cap / 1000)} MJ`);
  if (smax) h += row('🛡️ Escudo', `${Math.floor(p.shield || 0)} / ${smax}`);
  h += '<div class="suit-grid">';
  for (let i = 0; i < SUITS[s.k].slots; i++) {
    const k = s.eq[i];
    h += k ? `<button type="button" class="pick on" data-suit="rm" data-v="${i}" title="${ITEMS[k].name}: ${SUIT_EQ[k].desc} (tocá para sacarlo)">${itemImg(k)}</button>` : '<div class="pick empty"></div>';
  }
  h += '</div>';
  const eqHave = Object.keys(SUIT_EQ).filter((k) => avail(k) >= 1);
  if (eqHave.length && s.eq.length < SUITS[s.k].slots) h += '<div class="pick-title small">Poner</div><div class="picker">' + eqHave.map((k) => `<button type="button" class="pick" data-suit="add" data-v="${k}" title="${ITEMS[k].name}: ${SUIT_EQ[k].desc}">${itemImg(k)}</button>`).join('') + '</div>';
  const other = suitsHave.filter((k) => k !== s.k);
  if (other.length) h += '<div class="actions">' + other.map((k) => `<button type="button" data-suit="wear" data-v="${k}">Cambiar a ${ITEMS[k].name.toLowerCase()}</button>`).join('') + '</div>';
  if (!s.eq.some((k) => SUIT_EQ[k].gen)) h += '<p class="bad small">Sin generador (panel solar o reactor portátil) la grilla no tiene energía.</p>';
  return h;
}
