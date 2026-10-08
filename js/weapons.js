'use strict';
// =====================================================================
//  Armas del personaje (como en Factorio): granadas, cápsulas, robots de
//  combate, lanzacohetes y bomba atómica. Se usan desde la barra de combate:
//  apuntan solas al enemigo más cercano que esté a tiro.
// =====================================================================

const COMBAT_ITEMS = {
  grenade:           { range: 12, r: 3,   dmg: 40,  icon: '💣' },
  cluster_grenade:   { range: 14, r: 3,   dmg: 40,  cluster: 7, icon: '💥' },
  poison_capsule:    { range: 14, cloud: { r: 4.5, dps: 10, t: 8, color: 'rgba(110,200,60,' }, icon: '☠️' },
  slowdown_capsule:  { range: 14, slow: { r: 5.5, t: 10 }, icon: '🐌' },
  defender_capsule:  { bots: 1, life: 60, botDmg: 7, icon: '🤖' },
  destroyer_capsule: { bots: 5, life: 90, botDmg: 12, icon: '🛸' },
  rocket:            { range: 22, r: 1.6, dmg: 220, needs: 'rocket_launcher', rocket: true, icon: '🚀' },
  explosive_rocket:  { range: 22, r: 3.5, dmg: 140, needs: 'rocket_launcher', rocket: true, icon: '🎆' },
  atomic_bomb:       { range: 30, r: 18,  dmg: 6000, needs: 'rocket_launcher', rocket: true, nuke: true, icon: '☢️' },
};
const COMBAT_ORDER = Object.keys(COMBAT_ITEMS);
const BOT_RANGE = 9, MAX_BOTS = 20;

// Efectos que no se guardan (duran segundos)
const projs = [];    // { x, y, sx, sy, tx, ty, t, T, k }
const clouds = [];   // { x, y, r, dps, left, color }
const combatBots = []; // { x, y, life, cd, a, dmg, aim }

const slowMul = (o) => (o.slowUntil && o.slowUntil > S.playTime ? 0.4 : 1);

function nearestEnemy(x, y, r) {
  const t = targetsNear(x, y, r);
  return t.length ? t[0] : null;
}

function canUseCombat(k) {
  const d = COMBAT_ITEMS[k];
  if (!playerOn() || avail(k) < 1) return false;
  if (d.needs && avail(d.needs) < 1) return false;
  return true;
}

// Usar un arma: devuelve true si se usó
function useCombatItem(k) {
  const d = COMBAT_ITEMS[k], p = S.player;
  if (!d || !playerOn()) return false;
  if (avail(k) < 1) { toast(`No tenés ${ITEMS[k].name.toLowerCase()}.`); return false; }
  if (d.needs && avail(d.needs) < 1) { toast(`Para tirar ${ITEMS[k].name.toLowerCase()} necesitás un ${ITEMS[d.needs].name.toLowerCase()}.`); return false; }
  if (p.vehicle) { toast('Bajate del vehículo para usarlo.'); return false; }
  if (d.bots) {
    if (combatBots.length >= MAX_BOTS) { toast('Ya tenés demasiados robots de combate.'); return false; }
    takeItem(k, 1);
    for (let i = 0; i < d.bots; i++) combatBots.push({ x: p.x, y: p.y, life: d.life, cd: 0, a: Math.random() * 6.28, dmg: d.botDmg, k });
    sfx('place');
    toast(`${d.icon} ${d.bots > 1 ? `${d.bots} robots te siguen` : 'Un robot te sigue'} y pelea por ${d.life} s.`);
    return true;
  }
  const t = nearestEnemy(p.x, p.y, d.range);
  if (!t) { toast(`No hay enemigos a tiro (${d.range} casillas).`); return false; }
  if (d.nuke && wdist(p.x, p.y, t.x, t.y) < d.r + 3) { toast('☢️ ¡Estás demasiado cerca! Alejate más de 20 casillas antes de tirarla.'); return false; }
  takeItem(k, 1);
  const T = d.rocket ? Math.max(0.35, wdist(p.x, p.y, t.x, t.y) / 30) : 0.7;
  projs.push({ x: p.x, y: p.y, sx: p.x, sy: p.y, tx: p.x + wdx(t.x - p.x), ty: p.y + wdy(t.y - p.y), t: 0, T, k });
  p.ang = Math.atan2(wdy(t.y - p.y), wdx(t.x - p.x));
  sfx(d.rocket ? 'shot' : 'click', p.x, p.y);
  return true;
}

// Daño en área a todo lo enemigo (y, la bomba atómica, también a lo propio)
function blastAt(x, y, r, dmg, nuke) {
  for (const t of targetsNear(x, y, r)) hitTarget(t, dmg * (1 - 0.5 * Math.min(1, t.d / r)), true);
  if (nuke) {
    for (const e of S.entities.slice()) {
      if (!isPlayer(e) || e.type === 'hub' || e.type === 'lander') continue;
      const s = sizeOf(e.type) / 2, d = wdist(x, y, e.x + s, e.y + s);
      if (d <= r) damageEntity(e, dmg * (1 - Math.min(1, d / r)));
    }
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && treeAt(x + dx, y + dy)) chopTree(Math.floor(x + dx), Math.floor(y + dy));
    const p = S.player;
    if (p && wdist(x, y, p.x, p.y) < r) hurtPlayer(500 * (1 - wdist(x, y, p.x, p.y) / r), 'la bomba atómica');
    for (let i = 0; i < 6; i++) spawnExplosion(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r, 4);
    spawnExplosion(x, y, 10);
    toast('☢️ <b>¡Bomba atómica!</b>');
  } else spawnExplosion(x, y, Math.max(1, r / 2));
  sfx('boom', x, y);
}

function landProjectile(pr) {
  const d = COMBAT_ITEMS[pr.k];
  if (d.cluster) {
    for (let i = 0; i < d.cluster; i++) {
      const a = (i / d.cluster) * Math.PI * 2, rr = 2.5 + Math.random() * 1.5;
      projs.push({ x: pr.tx, y: pr.ty, sx: pr.tx, sy: pr.ty, tx: pr.tx + Math.cos(a) * rr, ty: pr.ty + Math.sin(a) * rr, t: 0, T: 0.35, k: 'grenade' });
    }
    blastAt(pr.tx, pr.ty, d.r, d.dmg);
  } else if (d.cloud) {
    clouds.push({ x: pr.tx, y: pr.ty, r: d.cloud.r, dps: d.cloud.dps, left: d.cloud.t, color: d.cloud.color });
    sfx('splat', pr.tx, pr.ty);
  } else if (d.slow) {
    for (const t of targetsNear(pr.tx, pr.ty, d.slow.r)) if (t.kind !== 'n') t.o.slowUntil = S.playTime + d.slow.t;
    clouds.push({ x: pr.tx, y: pr.ty, r: d.slow.r, dps: 0, left: 1.2, color: 'rgba(120,170,255,' });
    sfx('splat', pr.tx, pr.ty);
  } else blastAt(pr.tx, pr.ty, d.r, d.dmg, d.nuke);
}

function updateWeapons(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const pr = projs[i];
    pr.t += dt;
    const k = Math.min(1, pr.t / pr.T);
    pr.x = pr.sx + (pr.tx - pr.sx) * k; pr.y = pr.sy + (pr.ty - pr.sy) * k;
    if (k >= 1) { projs.splice(i, 1); landProjectile(pr); }
  }
  for (let i = clouds.length - 1; i >= 0; i--) {
    const c = clouds[i];
    c.left -= dt;
    if (c.dps) for (const t of targetsNear(c.x, c.y, c.r)) hitTarget(t, c.dps * dt, true);
    if (c.left <= 0) clouds.splice(i, 1);
  }
  const p = S.player;
  for (let i = combatBots.length - 1; i >= 0; i--) {
    const b = combatBots[i];
    b.life -= dt;
    if (b.life <= 0 || !p) { combatBots.splice(i, 1); continue; }
    // Dan vueltas alrededor del personaje y le tiran al enemigo más cercano
    b.a += dt * 1.6;
    const gx = p.x + Math.cos(b.a + i) * 1.8, gy = p.y + Math.sin(b.a + i) * 1.8;
    b.x += (wdx(gx - b.x)) * Math.min(1, dt * 4); b.y += (wdy(gy - b.y)) * Math.min(1, dt * 4);
    b.cd -= dt;
    if (b.cd <= 0) {
      const t = nearestEnemy(b.x, b.y, BOT_RANGE);
      if (t) {
        b.cd = 0.5;
        hitTarget(t, b.dmg, true);
        b.aim = { x: t.x, y: t.y, t: 0.08 };
        shots.push({ x1: b.x, y1: b.y, x2: b.x + wdx(t.x - b.x), y2: b.y + wdy(t.y - b.y), t: 0, laser: true });
      } else b.cd = 0.3;
    }
  }
}

// Minas: explotan cuando pasa un bicho o una criatura
function landmineStep(e) {
  const cx = e.x + 0.5, cy = e.y + 0.5;
  let near = false;
  for (const b of S.biters) if (!b.dead && Math.abs(wdx(b.x - cx)) < 1.2 && Math.abs(wdy(b.y - cy)) < 1.2) { near = true; break; }
  if (!near && S.creatures) for (const c of S.creatures) if (!c.dead && Math.abs(wdx(c.x - cx)) < 1.2 && Math.abs(wdy(c.y - cy)) < 1.2) { near = true; break; }
  if (!near) return;
  for (const t of targetsNear(cx, cy, 2.5)) hitTarget(t, 300, false);
  spawnExplosion(cx, cy, 1.2);
  sfx('boom', e.x, e.y);
  removeEntity(e, { destroyed: true });
  addGhost('landmine', e.x, e.y, 0, {});
}

// --------------------------- Dibujo ---------------------------

function drawWeapons(g, t) {
  for (const c of clouds) {
    const a = Math.min(0.45, c.left * 0.15);
    const grd = g.createRadialGradient(c.x * TILE, c.y * TILE, 4, c.x * TILE, c.y * TILE, c.r * TILE);
    grd.addColorStop(0, c.color + a + ')'); grd.addColorStop(1, c.color + '0)');
    g.fillStyle = grd; g.beginPath(); g.arc(c.x * TILE, c.y * TILE, c.r * TILE, 0, Math.PI * 2); g.fill();
  }
  for (const pr of projs) {
    const d = COMBAT_ITEMS[pr.k];
    const k = Math.min(1, pr.t / pr.T), lift = d.rocket ? 0 : Math.sin(k * Math.PI) * 18;
    const x = pr.x * TILE, y = pr.y * TILE - lift;
    if (d.rocket) {
      const a = Math.atan2(pr.ty - pr.sy, pr.tx - pr.sx);
      g.strokeStyle = 'rgba(200,200,200,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * 26, y - Math.sin(a) * 26); g.stroke();
      g.fillStyle = d.nuke ? '#e8d84a' : '#d9534f'; g.beginPath(); g.arc(x, y, d.nuke ? 5 : 3.5, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(pr.x * TILE, pr.y * TILE + 3, 4, 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = d.cloud ? '#7ac43a' : d.slow ? '#6aa0f0' : '#3a4a3a';
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
  }
  for (const b of combatBots) {
    const x = b.x * TILE, y = b.y * TILE - 14 + Math.sin(t * 6 + b.a) * 2;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(b.x * TILE, b.y * TILE, 5, 2.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = b.k === 'destroyer_capsule' ? '#b45fe0' : '#5aa0ff';
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8eef4'; g.beginPath(); g.arc(x, y - 1, 2, 0, Math.PI * 2); g.fill();
  }
}

// --------------------------- Barra de combate ---------------------------

let combatKey = '';
function updateCombatBar() {
  const bar = document.getElementById('combat-bar');
  if (!bar) return;
  const list = playerOn() ? COMBAT_ORDER.filter((k) => avail(k) >= 1) : [];
  const key = list.map((k) => k + Math.floor(avail(k)) + (canUseCombat(k) ? 1 : 0)).join(',');
  if (key === combatKey) return;
  combatKey = key;
  bar.hidden = !list.length;
  bar.innerHTML = list.map((k) => `<button type="button" data-combat="${k}" class="${canUseCombat(k) ? '' : 'off'}" title="${ITEMS[k].name}">${itemImg(k)}<span>${Math.floor(avail(k))}</span></button>`).join('');
}
