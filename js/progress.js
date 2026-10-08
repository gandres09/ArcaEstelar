'use strict';
// =====================================================================
//  Logros e historial de producción (con su gráfico)
// =====================================================================

const ACHIEVEMENTS = [
  { id: 'first_plate',  name: 'Primera placa',        desc: 'Llevá una placa de hierro a la Nave.',          test: () => (S.delivered.iron_plate || 0) >= 1 },
  { id: 'plates_1k',    name: 'Mil placas',            desc: 'Producí 1.000 placas de hierro.',               test: () => (S.produced.iron_plate || 0) >= 1000, prog: () => [(S.produced.iron_plate || 0), 1000] },
  { id: 'first_tech',   name: 'Curiosidad',            desc: 'Terminá tu primera investigación.',             test: () => Object.keys(S.techs).length >= 1 },
  { id: 'electric',     name: 'Hágase la luz',         desc: 'Investigá Electricidad.',                       test: () => !!S.techs.electricity },
  { id: 'steam',        name: 'A todo vapor',          desc: 'Construí una máquina de vapor.',                test: () => S.entities.some((e) => e.type === 'steam_engine') },
  { id: 'lamps',        name: 'Noche iluminada',       desc: 'Tené 20 lámparas.',                             test: () => countOf('lamp') >= 20, prog: () => [countOf('lamp'), 20] },
  { id: 'solar',        name: 'Energía limpia',        desc: 'Tené 30 paneles solares.',                      test: () => countOf('solar') >= 30, prog: () => [countOf('solar'), 30] },
  { id: 'belts',        name: 'Cintas por todos lados', desc: 'Tené 500 cintas.',                             test: () => countOf('belt') + countOf('fastbelt') + countOf('expressbelt') >= 500, prog: () => [countOf('belt') + countOf('fastbelt') + countOf('expressbelt'), 500] },
  { id: 'chemistry',    name: 'Química',               desc: 'Investigá Ciencia azul.',                        test: () => !!S.techs.chemical_science },
  { id: 'train',        name: 'Todos a bordo',         desc: 'Poné tu primer tren.',                           test: () => S.trains.length >= 1 },
  { id: 'robots',       name: 'Mano de obra robótica', desc: 'Construí un puerto de robots.',                 test: () => countOf('roboport') >= 1 },
  { id: 'module',       name: 'Mejoras',               desc: 'Poné un módulo en una máquina.',                 test: () => S.entities.some((e) => e.modules && e.modules.length) },
  { id: 'defender',     name: 'Exterminador',          desc: 'Eliminá 200 bichos.',                            test: () => (S.kills || 0) >= 200, prog: () => [S.kills || 0, 200] },
  { id: 'nests',        name: 'Limpieza de zona',      desc: 'Destruí 10 nidos.',                              test: () => (S.nestsKilled || 0) >= 10, prog: () => [S.nestsKilled || 0, 10] },
  { id: 'big_factory',  name: 'Megafábrica',           desc: 'Tené 2.000 edificios.',                          test: () => S.entities.length - countOf('nest') - countOf('worm') >= 2000, prog: () => [S.entities.length - countOf('nest') - countOf('worm'), 2000] },
  { id: 'all_techs',    name: 'Sabelotodo',            desc: 'Investigá todas las tecnologías (sin contar las infinitas).', test: () => TECH_ORDER.every((t) => TECHS[t].infinite || S.techs[t]) },
  { id: 'infinite',     name: 'Más allá',              desc: 'Terminá un nivel de investigación infinita.',    test: () => Object.values(S.inf || {}).some((n) => n > 0) },
  { id: 'launch',       name: '¡Despegue!',            desc: 'Lanzá la nave y llegá al espacio.',              test: () => (S.launched || 0) >= 1 },
  { id: 'strikes',      name: 'Lluvia de fuego',       desc: 'Hacé 10 ataques orbitales.',                     test: () => (S.strikes || 0) >= 10, prog: () => [S.strikes || 0, 10] },
  { id: 'clean',        name: 'Planeta limpio',        desc: 'Completá la etapa 2: sin nidos y con el aire limpio.', test: () => (S.stage || 1) >= 3 },
  { id: 'ark',          name: 'Hacia las estrellas',   desc: 'Lanzá el Arca estelar y salí del sistema solar.', test: () => (S.stage || 1) >= 4 },
  { id: 'fast_launch',  name: 'Contrarreloj',          desc: 'Lanzá la nave en menos de 8 horas de juego.',     test: () => (S.launched || 0) >= 1 && S.launchTime && S.launchTime < 8 * 3600 },
  { id: 'peaceful_no',  name: 'Sin miedo',             desc: 'Lanzá la nave con los enemigos activados.',       test: () => (S.launched || 0) >= 1 && !S.peaceful },
];

const countOf = (type) => { let n = 0; for (const e of S.entities) if (e.type === type) n++; return n; };

function checkAchievements() {
  S.ach = S.ach || {};
  for (const a of ACHIEVEMENTS) {
    if (S.ach[a.id] || !a.test()) continue;
    S.ach[a.id] = Math.round(S.playTime);
    toast(`🏆 Logro: <b>${a.name}</b>`);
    sfx('research');
  }
}

function renderAchievements() {
  S.ach = S.ach || {};
  const got = ACHIEVEMENTS.filter((a) => S.ach[a.id]).length;
  let h = `<p class="muted">${got} de ${ACHIEVEMENTS.length} logros</p><div class="ach-list">`;
  for (const a of ACHIEVEMENTS) {
    const done = S.ach[a.id] !== undefined;
    const p = !done && a.prog ? a.prog() : null;
    h += `<div class="ach ${done ? 'done' : ''}">
      <div class="ach-icon">${done ? '🏆' : '🔒'}</div>
      <div><b>${a.name}</b><div class="muted small">${a.desc}</div>
      ${done ? `<div class="ok small">Logrado a los ${Math.floor(S.ach[a.id] / 60)} min</div>` : ''}
      ${p ? `<div class="bar"><div style="width:${Math.min(100, 100 * p[0] / p[1]).toFixed(0)}%"></div></div><div class="muted small">${fmt(p[0])} / ${fmt(p[1])}</div>` : ''}</div>
    </div>`;
  }
  $('ach-body').innerHTML = h + '</div>';
}

// --------------------------- Historial de producción ---------------------------

const HIST_STEP = 30;          // segundos entre muestras
const HIST_MAX = 240;          // 2 horas
let prodHist = [];             // [{ t, totals }]
let histTimer = 0;

function sampleProduction(dt) {
  histTimer += dt;
  if (histTimer < HIST_STEP && prodHist.length) return;
  histTimer = 0;
  prodHist.push({ t: S.playTime, totals: { ...S.produced } });
  if (prodHist.length > HIST_MAX) prodHist.shift();
}

// Producción por minuto entre muestras consecutivas
function prodSeries(item) {
  const pts = [];
  for (let i = 1; i < prodHist.length; i++) {
    const a = prodHist[i - 1], b = prodHist[i];
    const dt = Math.max(1, b.t - a.t);
    pts.push({ t: b.t, v: ((b.totals[item] || 0) - (a.totals[item] || 0)) * 60 / dt });
  }
  return pts;
}

// Colores fijos por objeto: el primero que se elige se queda con el color 1, y así
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];
let chartItems = null;         // objetos elegidos para el gráfico
const chartColor = {};         // objeto → color (no cambia aunque se saquen otros)

function defaultChartItems() {
  const last = prodHist.length > 1 ? prodHist[prodHist.length - 1].totals : S.produced;
  const first = prodHist.length > 1 ? prodHist[Math.max(0, prodHist.length - 11)].totals : {};
  return ITEM_ORDER.filter((k) => !ITEMS[k].shape.includes('ore') || k === 'coal')
    .map((k) => [k, (last[k] || 0) - (first[k] || 0)]).filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
}

function colorFor(item) {
  if (!chartColor[item]) {
    const used = new Set(Object.values(chartColor));
    chartColor[item] = SERIES_COLORS.find((c) => !used.has(c)) || SERIES_COLORS[0];
  }
  return chartColor[item];
}

function toggleChartItem(k) {
  if (!chartItems) chartItems = defaultChartItems();
  if (chartItems.includes(k)) {
    chartItems = chartItems.filter((x) => x !== k);
    delete chartColor[k];
  } else if (chartItems.length < SERIES_COLORS.length) chartItems.push(k);
  else toast(`Podés comparar hasta ${SERIES_COLORS.length} objetos a la vez.`);
  renderChart();
}

let chartHover = null;

// Nombre corto para la etiqueta al final de la línea ("Placa de hierro" → "hierro")
function shortName(k) {
  const n = ITEMS[k].name;
  const m = n.match(/^(Placa|Mineral|Ciencia|Módulo|Combustible) de (.+)$/) || n.match(/^(Ciencia) (.+)$/);
  return (m ? m[2] : n.split(' ')[0]).toLowerCase();
}

function renderChart() {
  const wrap = $('chart-wrap');
  if (!wrap) return;
  if (!chartItems) chartItems = defaultChartItems();
  for (const k of chartItems) colorFor(k);
  const canvasEl = $('chart');
  const w = wrap.clientWidth, h = 220;
  const dprc = window.devicePixelRatio || 1;
  canvasEl.width = w * dprc; canvasEl.height = h * dprc;
  canvasEl.style.height = h + 'px';
  const g = canvasEl.getContext('2d');
  g.setTransform(dprc, 0, 0, dprc, 0, 0);
  g.clearRect(0, 0, w, h);
  const pad = { l: 44, r: 92, t: 10, b: 24 };
  const series = chartItems.map((k) => ({ k, pts: prodSeries(k) }));
  const n = prodHist.length;
  // Leyenda (siempre, con 2 o más series)
  $('chart-legend').innerHTML = chartItems.length > 1 ? chartItems.map((k) =>
    `<span class="lg"><span class="sw" style="background:${chartColor[k]}"></span>${ITEMS[k].name}</span>`).join('') : '';
  if (n < 3 || !series.length) {
    g.fillStyle = '#9aa4b1'; g.font = '13px system-ui'; g.textAlign = 'center';
    const msg = n < 3 ? ['Juntando datos…', 'El gráfico aparece en un minuto y medio.'] : ['Elegí objetos para ver', 'su producción.'];
    g.fillText(msg[0], w / 2, h / 2 - 9);
    g.fillText(msg[1], w / 2, h / 2 + 9);
    return;
  }
  const tMin = prodHist[1].t, tMax = prodHist[n - 1].t;
  let vMax = 1;
  for (const s of series) for (const p of s.pts) vMax = Math.max(vMax, p.v);
  // Escala "redonda"
  const mag = Math.pow(10, Math.floor(Math.log10(vMax)));
  vMax = Math.ceil(vMax / mag) * mag;
  const X = (t) => pad.l + (tMax === tMin ? 0 : (t - tMin) / (tMax - tMin)) * (w - pad.l - pad.r);
  const Y = (v) => h - pad.b - (v / vMax) * (h - pad.t - pad.b);
  // Grilla y ejes (discretos)
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
  g.fillStyle = '#9aa4b1'; g.font = '11px system-ui'; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = vMax * i / 4, y = Y(v);
    g.beginPath(); g.moveTo(pad.l, y + 0.5); g.lineTo(w - pad.r, y + 0.5); g.stroke();
    g.fillText(fmt(v), pad.l - 6, y);
  }
  g.textAlign = 'center'; g.textBaseline = 'top';
  const span = (tMax - tMin) / 60;
  for (let i = 0; i <= 4; i++) {
    const t = tMin + (tMax - tMin) * i / 4;
    g.fillText(i === 4 ? 'ahora' : `-${Math.round(span * (1 - i / 4))} min`, X(t), h - pad.b + 6);
  }
  // Líneas de 2 px y punto final con etiqueta directa
  const ends = [];
  for (const s of series) {
    if (!s.pts.length) continue;
    g.strokeStyle = chartColor[s.k]; g.lineWidth = 2; g.lineJoin = 'round';
    g.beginPath();
    s.pts.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(p.v)) : g.moveTo(X(p.t), Y(p.v))));
    g.stroke();
    const last = s.pts[s.pts.length - 1];
    ends.push({ k: s.k, x: X(last.t), y: Y(last.v), v: last.v });
  }
  // Etiquetas al final sin pisarse
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].ly = (ends[i - 1].ly || ends[i - 1].y) + 13;
  for (const e of ends) {
    g.fillStyle = '#1c222b';
    g.beginPath(); g.arc(e.x, e.y, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = chartColor[e.k];
    g.beginPath(); g.arc(e.x, e.y, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e6e9ee'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '11px system-ui';
    g.fillText(`${fmt(e.v)} ${shortName(e.k)}`, e.x + 8, e.ly || e.y);
  }
  // Cruz y valores al pasar el puntero
  const tip = $('chart-tip');
  if (chartHover && chartHover.x >= pad.l && chartHover.x <= w - pad.r) {
    const t = tMin + (chartHover.x - pad.l) / (w - pad.l - pad.r) * (tMax - tMin);
    const i = Math.max(0, Math.min(series[0].pts.length - 1, Math.round((t - tMin) / Math.max(1, tMax - tMin) * (series[0].pts.length - 1))));
    const pt = series[0].pts[i];
    if (pt) {
      const x = X(pt.t);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + 0.5, pad.t); g.lineTo(x + 0.5, h - pad.b); g.stroke();
      tip.hidden = false;
      tip.innerHTML = `<div class="muted small">hace ${Math.round((tMax - pt.t) / 60)} min</div>` + series.map((s) =>
        `<div class="tip-row"><span class="sw" style="background:${chartColor[s.k]}"></span>${ITEMS[s.k].name}<b>${fmt(s.pts[i]?.v || 0)}/min</b></div>`).join('');
      tip.style.left = Math.min(x + 12, w - 190) + 'px';
      tip.style.top = '8px';
      return;
    }
  }
  tip.hidden = true;
}

function renderChartPicker() {
  if (!chartItems) chartItems = defaultChartItems();
  const items = ITEM_ORDER.filter((k) => S.produced[k]);
  $('chart-picker').innerHTML = items.map((k) =>
    `<button type="button" class="chip-btn ${chartItems.includes(k) ? 'on' : ''}" data-chart="${k}" title="${ITEMS[k].name}">${itemImg(k, 'ico-s')}</button>`).join('');
}
