'use strict';
// =====================================================================
//  Clima: despejado, lluvia, niebla y tormenta eléctrica.
//  Sale de la semilla del mundo y del tiempo de juego, así todos los
//  jugadores de un mismo mundo ven el mismo clima sin mandarse nada.
// =====================================================================

const WEATHERS = {
  clear: { name: 'Despejado', icon: '☀️', solar: 1, dark: 0, wash: 0, range: 1,
           desc: 'Buen tiempo.' },
  rain:  { name: 'Lluvia', icon: '🌧️', solar: 0.6, dark: 0.12, wash: 0.006, range: 0.9,
           desc: 'Los paneles solares rinden menos y la lluvia va limpiando la polución.' },
  fog:   { name: 'Niebla', icon: '🌫️', solar: 0.75, dark: 0.04, wash: 0, range: 0.6,
           desc: 'Se ve poco y las torretas alcanzan menos.' },
  storm: { name: 'Tormenta eléctrica', icon: '⛈️', solar: 0.3, dark: 0.3, wash: 0.009, range: 0.8,
           desc: '¡Caen rayos! Dañan lo que tocan; un pararrayos protege todo lo que está a 10 casillas.' },
};
const WEATHER_LEN = 150;        // segundos que dura cada tramo de clima
const ROD_RADIUS = 10;          // casillas que protege un pararrayos

function weatherAt(i) {
  if (i < 2) return 'clear';    // los primeros minutos, siempre lindo
  const r = mulberry32(((S.seed | 0) ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0)();
  return r < 0.5 ? 'clear' : r < 0.75 ? 'rain' : r < 0.87 ? 'fog' : 'storm';
}

// El clima de ahora, con su intensidad k (sube y baja suave al cambiar)
function weatherNow() {
  const t = (S.playTime || 0) / WEATHER_LEN, i = Math.floor(t), f = t - i;
  const kind = weatherAt(i);
  const k = kind === 'clear' ? 0 : Math.max(0, Math.min(1, f / 0.12, (1 - f) / 0.12));
  return { kind, w: WEATHERS[kind], k, next: weatherAt(i + 1), left: (1 - f) * WEATHER_LEN };
}
const weatherSolar = () => { const n = weatherNow(); return 1 - (1 - n.w.solar) * n.k; };
const weatherRange = () => { const n = weatherNow(); return 1 - (1 - n.w.range) * n.k; };
const weatherWash = () => { const n = weatherNow(); return n.w.wash * n.k; };

// --------------------------- Rayos ---------------------------

const bolts = [];          // rayos que se están dibujando: { x, y, t, seed }
let boltTimer = 6, flashT = 0;

function strikeAt(x, y, real) {
  bolts.push({ x, y, t: 0, seed: Math.random() * 1000 });
  flashT = 0.35;
  sfx('boom', x, y);
  if (!real) return;
  // ¿Hay un pararrayos cerca? Se lleva el rayo y no pasa nada
  const rod = S.entities.find((e) => e.type === 'lightningrod' && wdist(e.x + 0.5, e.y + 0.5, x, y) <= ROD_RADIUS);
  if (rod) { bolts[bolts.length - 1].x = rod.x + 0.5; bolts[bolts.length - 1].y = rod.y + 0.2; rod.hitAt = S.playTime; S.rodHits = (S.rodHits || 0) + 1; return; }
  spawnExplosion(x, y, 0.7);
  if (playerOn() && wdist(S.player.x, S.player.y, x, y) < 1.4) hurtPlayer(30, 'un rayo');
  for (const b of S.biters) if (!b.dead && wdist(b.x, b.y, x, y) < 1.6) hitBiter(b, 120);
  for (const c of S.creatures || []) if (!c.dead && wdist(c.x, c.y, x, y) < 1.6) { c.hp -= 120; if (c.hp <= 0) killCreature(c, false); }
  const e = at(Math.floor(x), Math.floor(y));
  if (e && e.type !== 'hub' && !S.peaceful) damageEntity(e, 40);
}

// Paso del clima (lo llama la simulación)
function updateWeather(dt) {
  const n = weatherNow();
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
  for (const b of bolts) b.t += dt;
  while (bolts.length && bolts[0].t > 0.6) bolts.shift();
  if (n.kind !== 'storm' || n.k < 0.3) return;
  boltTimer -= dt * n.k;
  if (boltTimer > 0) return;
  boltTimer = 4 + Math.random() * 7;
  // Cae cerca de donde estás (o de lo que estás mirando)
  const c = playerOn() ? S.player : { x: view.x / TILE, y: view.y / TILE };
  const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 20;
  // En línea, el daño lo decide el anfitrión; los demás solo ven el rayo
  strikeAt(wrapX(c.x + Math.cos(a) * d), wrapY(c.y + Math.sin(a) * d), !NET.on || NET.role === 'host');
}

// Aviso cuando cambia
let weatherWas = null;
function weatherNotice() {
  const n = weatherNow();
  if (weatherWas && n.kind !== weatherWas && S.playTime > 30) toast(`${n.w.icon} <b>${n.w.name}</b>. ${n.w.desc}`);
  weatherWas = n.kind;
}

// --------------------------- Dibujo ---------------------------

const rainSeeds = Array.from({ length: 260 }, (_, i) => [((i * 7919) % 1000) / 1000, ((i * 104729) % 997) / 997, 0.7 + ((i * 31) % 10) / 30]);

function drawWeather(ctx) {
  const n = weatherNow();
  const k = n.k;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (k > 0 && n.w.dark) { ctx.fillStyle = `rgba(20,28,44,${n.w.dark * k})`; ctx.fillRect(0, 0, cw, ch); }
  // Niebla: espesa lejos, más clara alrededor tuyo
  if (n.kind === 'fog' && k > 0) {
    const p = playerOn() ? S.player : null;
    const sx = p ? cw / 2 + wdx(p.x - view.x / TILE) * TILE * view.zoom : cw / 2;
    const sy = p ? ch / 2 + wdy(p.y - view.y / TILE) * TILE * view.zoom : ch / 2;
    const r0 = 4 * TILE * view.zoom, r1 = 13 * TILE * view.zoom;
    const g = ctx.createRadialGradient(sx, sy, r0, sx, sy, Math.max(r1, r0 + 1));
    g.addColorStop(0, 'rgba(196,204,214,0)');
    g.addColorStop(1, `rgba(196,204,214,${0.82 * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    // Bancos de niebla que se mueven despacio
    const tt = time * 0.02;
    for (let i = 0; i < 6; i++) {
      const bx = ((i * 0.37 + tt * (0.5 + i * 0.1)) % 1.4 - 0.2) * cw, by = ((i * 0.53) % 1) * ch;
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, cw * 0.35);
      rg.addColorStop(0, `rgba(210,216,224,${0.18 * k})`); rg.addColorStop(1, 'rgba(210,216,224,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, cw, ch);
    }
  }
  // Lluvia: rayitas inclinadas que caen
  if ((n.kind === 'rain' || n.kind === 'storm') && k > 0) {
    const count = Math.round((n.kind === 'storm' ? 260 : 170) * k * Math.min(1.5, (cw * ch) / (1200 * 800)));
    ctx.strokeStyle = `rgba(175,200,240,${0.38 * k})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const [a, b, sp] = rainSeeds[i % rainSeeds.length];
      const y = ((b * ch + time * 900 * sp) % (ch + 40)) - 20;
      const x = ((a * (cw + 200) - y * 0.25 + i * 13) % (cw + 200)) - 100;
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 15);
    }
    ctx.stroke();
  }
  // Rayos: una línea quebrada desde arriba hasta donde cae, y un fogonazo
  for (const b of bolts) {
    const sx = cw / 2 + wdx(b.x - view.x / TILE) * TILE * view.zoom, sy = ch / 2 + wdy(b.y - view.y / TILE) * TILE * view.zoom;
    const a = Math.max(0, 1 - b.t / 0.6);
    const rnd = mulberry32((b.seed * 1000) | 0);
    ctx.strokeStyle = `rgba(230,240,255,${a})`; ctx.lineWidth = 3; ctx.shadowColor = 'rgba(160,190,255,0.9)'; ctx.shadowBlur = 14;
    ctx.beginPath();
    let x = sx + (rnd() - 0.5) * 80, y = -10;
    ctx.moveTo(x, y);
    const steps = 9;
    for (let i = 1; i <= steps; i++) { y = -10 + (sy + 10) * i / steps; x = i === steps ? sx : x + (sx - x) / (steps - i + 1) + (rnd() - 0.5) * 40; ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.shadowBlur = 0;
    const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40);
    gl.addColorStop(0, `rgba(220,235,255,${0.7 * a})`); gl.addColorStop(1, 'rgba(220,235,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx - 40, sy - 40, 80, 80);
  }
  if (flashT > 0) { ctx.fillStyle = `rgba(235,240,255,${flashT * 0.7})`; ctx.fillRect(0, 0, cw, ch); }
  ctx.restore();
}
