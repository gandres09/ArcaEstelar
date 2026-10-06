'use strict';
// =====================================================================
//  Interfaz: barra de herramientas, inventario, inspector, investigación
// =====================================================================

const $ = (id) => document.getElementById(id);

// Grupos de teclas numéricas: repetir la tecla cambia de variante
const KEY_GROUPS = [
  ['belt', 'fastbelt', 'expressbelt'],
  ['underground'],
  ['splitter', 'sorter', 'chest'],
  ['miner', 'eminer'],
  ['furnace', 'efurnace'],
  ['assembler', 'assembler2'],
  ['pole'],
  ['generator', 'solar'],
  ['shipyard'],
];
const keyOf = (type) => KEY_GROUPS.findIndex((g) => g.includes(type)) + 1;

// --------------------------- Íconos ---------------------------

const iconCache = {};
function itemIcon(item) {
  if (!iconCache[item]) {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const g = c.getContext('2d');
    drawItem(g, item, 20, 20, 13);
    iconCache[item] = c.toDataURL();
  }
  return iconCache[item];
}
const itemImg = (item, cls = 'ico') => `<img class="${cls}" src="${itemIcon(item)}" alt="" title="${ITEMS[item].name}">`;

function buildingIcon(type) {
  const key = 'b:' + type;
  if (!iconCache[key]) {
    const s = sizeOf(type);
    const c = document.createElement('canvas');
    c.width = c.height = 80;
    const g = c.getContext('2d');
    g.scale(80 / (TILE * s), 80 / (TILE * s));
    const e = makeEntity(type, 0, 0, 0);
    if (type === 'pole') { g.translate(0, 2); }
    drawBuilding(g, e, 0, 0, 0);
    iconCache[key] = c.toDataURL();
  }
  return iconCache[key];
}

function costHtml(cost, { showHave = true } = {}) {
  return Object.entries(cost).map(([k, n]) => {
    const have = Math.floor(S.inv[k] || 0);
    const cls = showHave && have < n ? 'bad' : '';
    return `<span class="cost-item ${cls}">${itemImg(k, 'ico-s')}${showHave ? `${Math.min(have, n)}/` : ''}${n}</span>`;
  }).join('');
}

function costText(cost) {
  return Object.entries(cost).map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`).join(', ');
}

// --------------------------- Barra de herramientas ---------------------------

const toolButtons = {};

function buildToolbar() {
  const bar = $('toolbar');
  bar.innerHTML = '';
  const mk = (id, label, key, icon, extraClass = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool ' + extraClass;
    b.innerHTML = `<span class="key">${key}</span>${icon}<span class="label">${label}</span>`;
    b.addEventListener('click', () => selectTool(id));
    bar.appendChild(b);
    toolButtons[id] = b;
    return b;
  };
  mk('hand', 'Mano', 'Esc', '<span class="emoji">✋</span>');
  mk('delete', 'Desarmar', 'X', '<span class="emoji">🗑️</span>');
  const rot = document.createElement('button');
  rot.type = 'button';
  rot.className = 'tool';
  rot.innerHTML = '<span class="key">R</span><span class="emoji">🔄</span><span class="label">Girar</span>';
  rot.addEventListener('click', () => rotateAction(1));
  bar.appendChild(rot);
  let lastCat = null;
  for (const id of TOOL_ORDER) {
    const d = BUILDINGS[id];
    if (d.cat !== lastCat) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      sep.textContent = d.cat;
      bar.appendChild(sep);
      lastCat = d.cat;
    }
    mk(id, d.name, keyOf(id) || '', `<img src="${buildingIcon(id)}" alt="">`);
  }
}

function updateToolbar() {
  for (const id in toolButtons) {
    const b = toolButtons[id];
    b.classList.toggle('selected', tool === id);
    const d = BUILDINGS[id];
    if (!d) continue;
    const locked = !isUnlocked(id);
    b.classList.toggle('locked', locked);
    b.classList.toggle('poor', !locked && !canAfford(d.cost));
    b.title = `${d.name}${keyOf(id) ? ` [${keyOf(id)}]` : ''}\n${d.desc}\nCosto: ${costText(d.cost)}` +
      (locked ? `\n🔒 Investigá: ${TECHS[d.tech].name}` : '');
  }
}

function selectTool(id) {
  if (BUILDINGS[id] && !isUnlocked(id)) {
    toast(`🔒 ${BUILDINGS[id].name}: investigá <b>${TECHS[BUILDINGS[id].tech].name}</b>`);
    return;
  }
  tool = id;
  if (id !== 'hand') closeInspector();
  updateToolbar();
}

// --------------------------- Inventario y pistas ---------------------------

function buildInventory() {
  $('inventory').innerHTML = ITEM_ORDER.map((k) =>
    `<div class="inv-item" data-item="${k}" title="${ITEMS[k].name}">${itemImg(k)}<span class="n">0</span></div>`).join('');
}

function fmt(n) {
  n = Math.floor(n);
  if (n >= 100000) return Math.round(n / 1000) + 'k';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function updateInventory() {
  for (const el of $('inventory').children) {
    const n = S.inv[el.dataset.item] || 0;
    el.querySelector('.n').textContent = fmt(n);
    el.classList.toggle('zero', n < 1);
  }
}

function countType(type) {
  let n = 0;
  for (const e of S.entities) if (e.type === type) n++;
  return n;
}

function nextTech() {
  return TECH_ORDER.find((id) => !S.techs[id] && TECHS[id].req.every((r) => S.techs[r]));
}

function currentHint() {
  const d = S.delivered;
  if (S.launched) return '🎉 ¡Escapaste del planeta! Podés seguir expandiendo la fábrica o armar otra nave.';
  if (!S.entities.some((e) => (e.type === 'miner' || e.type === 'eminer') && oreAt(e.x, e.y) === 'iron_ore'))
    return 'Poné un <b>Taladro</b> [4] sobre el mineral de hierro (gris azulado). Girá la flecha con <kbd>R</kbd>.';
  if (!countType('furnace') && !countType('efurnace'))
    return 'Poné un <b>Horno</b> [5] delante del taladro, o conectalo con <b>Cintas</b> [1].';
  if ((d.iron_plate || 0) < 5)
    return 'Llevá las placas del horno al <b>Núcleo</b> con cintas. Acordate de cargarle <b>carbón</b> al horno (clic con la mano).';
  if (!S.entities.some((e) => (e.type === 'miner' || e.type === 'eminer') && oreAt(e.x, e.y) === 'coal'))
    return 'Automatizá el combustible: un taladro sobre <b>carbón</b> y una cinta que lo lleve a los hornos.';
  if ((d.copper_plate || 0) < 5)
    return 'Armá otra línea para el <b>cobre</b> (mineral naranja): taladro → horno → Núcleo.';
  const nt = nextTech();
  if (!S.techs.automation) return 'Abrí <b>Investigación</b> <kbd>T</kbd> y desbloqueá <b>Automatización</b>.';
  if (!countType('assembler') && !countType('assembler2'))
    return 'Poné una <b>Ensambladora</b> [6], elegí la receta con un clic y alimentala con cintas.';
  if (S.techs.electricity && !countType('generator'))
    return 'Construí un <b>Generador</b> [8], alimentalo con carbón y conectalo con <b>Postes</b> [7] a tus máquinas.';
  if (S.techs.rocketry) {
    const sp = shipProgress();
    if (!sp.yard) return 'Construí el <b>Astillero</b> [9] para empezar a armar la nave.';
    if (shipReady(sp.yard)) return '¡La nave está completa! Abrí el Astillero y apretá <b>Despegar</b>.';
    return 'Llevá las piezas al <b>Astillero</b> por cinta, o transferilas desde su panel.';
  }
  if (nt) return `Próxima investigación sugerida: <b>${TECHS[nt].name}</b>. ${TECHS[nt].desc}`;
  return 'Seguí expandiendo la fábrica.';
}

function updateSide() {
  updateInventory();
  $('hint').innerHTML = currentHint();
  const sp = shipProgress();
  $('ship-mini-bar').style.width = (sp.frac * 100).toFixed(1) + '%';
  $('ship-mini-pct').textContent = Math.floor(sp.frac * 100) + '%';
}

// --------------------------- Inspector ---------------------------

let inspected = null;
let inspectorHtml = '';

function openInspector(e) {
  inspected = e;
  inspectorHtml = '';
  $('inspector').hidden = false;
  updateInspector();
}

function closeInspector() {
  inspected = null;
  $('inspector').hidden = true;
}

function row(label, value) { return `<div class="row"><span>${label}</span><span>${value}</span></div>`; }
const itemLabel = (k, n) => (k ? `${itemImg(k, 'ico-s')} ${n !== undefined ? n + ' ' : ''}${ITEMS[k].name}` : '—');

function powerRow(e) {
  const def = BUILDINGS[e.type];
  const net = nets[e._net];
  if (!net) return row('Energía', '<span class="bad">Sin conexión a un poste</span>');
  if (def.power) {
    const pct = Math.round(net.sat * 100);
    return row('Energía', `${def.power} kW · <span class="${pct < 100 ? 'bad' : 'ok'}">${pct}%</span>`);
  }
  return row('Red', `${Math.round(net.prevDemand)} / ${Math.round(net.prevCap)} kW`);
}

function inspectorContent(e) {
  const def = BUILDINGS[e.type];
  let h = `<div class="insp-head"><b>${e.type === 'hub' ? 'Núcleo' : def.name}</b>` +
    `${NO_DIR.has(e.type) ? '' : ` <span class="muted">${DIR_ARROWS[e.dir]}</span>`}` +
    `<button type="button" class="close" data-act="close">✕</button></div>`;
  switch (e.type) {
    case 'hub':
      h += '<p>Todo lo que entra al Núcleo va a tu inventario.</p>';
      break;
    case 'belt': case 'fastbelt': case 'expressbelt':
      h += row('Velocidad', def.speed + ' objetos/s') + row('Lleva', itemLabel(e.item));
      break;
    case 'underground':
      h += row('Tipo', e.mode === 'in' ? 'Entrada' : 'Salida') +
        row('Conectada', e._pair ? `sí, a ${e._dist} casillas` : '<span class="bad">no: poné la otra punta en la misma dirección</span>');
      break;
    case 'miner': case 'eminer': {
      const o = oreAt(e.x, e.y);
      h += row('Extrae', o ? itemLabel(o) : '<span class="bad">Yacimiento agotado</span>');
      if (o) h += row('Queda', fmt(oreAmountAt(e.x, e.y)) + ' en esta casilla');
      if (e.buf) h += row('Estado', '<span class="bad">Salida bloqueada</span>');
      if (def.power) h += powerRow(e);
      break;
    }
    case 'furnace': case 'efurnace': {
      h += row('Entrada', itemLabel(e.inType, e.inCount)) + row('Salida', itemLabel(e.outType, e.outCount));
      if (e.type === 'furnace') {
        h += row('Combustible', e.fuel ? itemLabel(e.fuelType, e.fuel) : (e.burn > 0 ? 'quemando' : '<span class="bad">sin combustible</span>'));
      } else h += powerRow(e);
      const r = e.inType && SMELT[e.inType];
      if (r) h += `<div class="bar"><div style="width:${(100 * e.prog / r.time).toFixed(0)}%"></div></div>`;
      h += '<div class="recipes-note muted">Funde: ' + Object.entries(SMELT).filter(([, r]) => hasTech(r.tech))
        .map(([k, r]) => `${r.n}×${itemImg(k, 'ico-s')}→${itemImg(r.out, 'ico-s')}`).join(' ') + '</div>';
      h += '<div class="actions">';
      if (e.type === 'furnace') h += '<button type="button" data-act="fuel">Cargar carbón</button>';
      h += '<button type="button" data-act="collect">Recoger salida</button></div>';
      break;
    }
    case 'assembler': case 'assembler2': {
      const rc = e.recipe && RECIPES[e.recipe];
      if (rc) {
        h += row('Fabrica', itemLabel(rc.out)) +
          Object.entries(rc.in).map(([k, n]) => row(itemLabel(k), `${e.buf[k] || 0} / ${n}`)).join('') +
          row('Listos', e.out) + `<div class="bar"><div style="width:${(100 * e.prog / rc.time).toFixed(0)}%"></div></div>`;
      } else h += '<p class="bad">Elegí una receta:</p>';
      if (def.power) h += powerRow(e);
      h += '<div class="pick-title">Receta</div><div class="picker">';
      for (const id of RECIPE_ORDER) {
        const r = RECIPES[id];
        if (!hasTech(r.tech)) continue;
        const ok = r.tier <= def.tier;
        const ins = Object.entries(r.in).map(([k, n]) => `${n} ${ITEMS[k].name}`).join(' + ');
        h += `<button type="button" class="pick ${e.recipe === id ? 'on' : ''}" data-act="recipe" data-v="${id}" ${ok ? '' : 'disabled'}
          title="${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}: ${ins} (${r.time} s)${ok ? '' : ' — requiere Ensambladora avanzada'}">${itemImg(r.out)}</button>`;
      }
      h += '</div>';
      break;
    }
    case 'splitter':
      h += '<p>Reparte por turnos entre adelante, izquierda y derecha.</p>';
      break;
    case 'sorter': {
      h += row('Filtro', e.filter ? itemLabel(e.filter) : 'ninguno (todo sigue derecho)');
      h += '<div class="pick-title">El objeto elegido sigue derecho, el resto sale por los costados</div><div class="picker">';
      h += `<button type="button" class="pick ${!e.filter ? 'on' : ''}" data-act="filter" data-v="">✕</button>`;
      for (const k of ITEM_ORDER) h += `<button type="button" class="pick ${e.filter === k ? 'on' : ''}" data-act="filter" data-v="${k}">${itemImg(k)}</button>`;
      h += '</div>';
      break;
    }
    case 'chest':
      h += row('Guardado', `${e.total} / 200`) +
        Object.entries(e.store).map(([k, n]) => row(itemLabel(k), n)).join('') +
        '<div class="actions"><button type="button" data-act="empty">Vaciar al inventario</button></div>';
      break;
    case 'generator':
      h += row('Combustible', e.fuel ? itemLabel(e.fuelType, e.fuel) : '<span class="bad">vacío</span>') +
        powerRow(e) + row('Carga', Math.round((e.load || 0) * 100) + '%') +
        '<div class="actions"><button type="button" data-act="gfuel">Cargar carbón</button></div>';
      break;
    case 'pole':
      h += nets[e._net] ? row('Red', `${nets[e._net].poles} postes`) + row('Consumo', `${Math.round(nets[e._net].prevDemand)} kW`) +
        row('Generación', `${Math.round(nets[e._net].prevCap)} kW`) : '';
      break;
    case 'solar':
      h += powerRow(e);
      break;
    case 'shipyard': {
      h += '<p>Piezas de la nave:</p>';
      for (const k in SHIP) {
        const have = e.parts[k] || 0;
        h += `<div class="row">${itemLabel(k)}<span>${have} / ${SHIP[k]}</span></div>` +
          `<div class="bar"><div style="width:${(100 * have / SHIP[k]).toFixed(1)}%"></div></div>`;
      }
      h += '<div class="actions"><button type="button" data-act="transfer">Transferir del inventario</button>';
      if (shipReady(e)) h += '<button type="button" class="primary" data-act="launch">🚀 ¡Despegar!</button>';
      h += '</div>';
      break;
    }
  }
  if (e.type !== 'hub') {
    h += '<div class="actions small">';
    if (!NO_DIR.has(e.type)) h += '<button type="button" data-act="rotate">🔄 Girar</button>';
    h += '<button type="button" data-act="remove">🗑️ Desarmar</button></div>';
  }
  return h;
}

function updateInspector() {
  if (!inspected) return;
  if (!S.entities.includes(inspected)) { closeInspector(); return; }
  const h = inspectorContent(inspected);
  if (h !== inspectorHtml) {
    inspectorHtml = h;
    $('inspector').innerHTML = h;
  }
}

function moveToInv(item, n) { if (item && n > 0) add(S.inv, item, n); }

// pointerdown: el panel se redibuja seguido y un 'click' se podría perder
$('inspector').addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  const b = ev.target.closest('[data-act]');
  if (!b || !inspected) return;
  const e = inspected;
  const v = b.dataset.v;
  switch (b.dataset.act) {
    case 'close': closeInspector(); return;
    case 'rotate': rotateEntity(e, 1); break;
    case 'remove': removeEntity(e); closeInspector(); return;
    case 'recipe':
      if (e.recipe !== v) {
        refund(e.buf);
        if (e.recipe) moveToInv(RECIPES[e.recipe].out, e.out);
        e.buf = {}; e.out = 0; e.prog = 0; e.recipe = v;
      }
      break;
    case 'filter': e.filter = v || null; break;
    case 'fuel': {
      const k = e.fuelType || (S.inv.solid_fuel >= 1 && !S.inv.coal ? 'solid_fuel' : 'coal');
      const n = Math.min(Math.floor(S.inv[k] || 0), 10 - e.fuel);
      if (n > 0) { S.inv[k] -= n; e.fuel += n; e.fuelType = k; } else toast(e.fuel >= 10 ? 'El horno ya está lleno.' : 'No tenés carbón en el inventario.');
      break;
    }
    case 'gfuel': {
      const k = e.fuelType || (S.inv.solid_fuel >= 1 && !S.inv.coal ? 'solid_fuel' : 'coal');
      const n = Math.min(Math.floor(S.inv[k] || 0), 20 - e.fuel);
      if (n > 0) { S.inv[k] -= n; e.fuel += n; e.fuelType = k; } else toast('No tenés combustible en el inventario.');
      break;
    }
    case 'collect':
      moveToInv(e.outType, e.outCount); e.outCount = 0; e.outType = null;
      break;
    case 'empty':
      for (const k in e.store) moveToInv(k, e.store[k]);
      e.store = {}; e.total = 0;
      break;
    case 'transfer': {
      let moved = 0;
      for (const k in SHIP) {
        const n = Math.min(Math.floor(S.inv[k] || 0), SHIP[k] - (e.parts[k] || 0));
        if (n > 0) { S.inv[k] -= n; add(e.parts, k, n); moved += n; }
      }
      toast(moved ? `Transferiste ${moved} piezas al astillero.` : 'No tenés piezas de la nave en el inventario.');
      break;
    }
    case 'launch':
      if (shipReady(e)) { closeInspector(); startLaunch(e); }
      return;
  }
  updateInspector();
});

// --------------------------- Investigación ---------------------------

function renderResearch() {
  let h = '';
  for (const id of TECH_ORDER) {
    const t = TECHS[id];
    const done = !!S.techs[id];
    const avail = !done && t.req.every((r) => S.techs[r]);
    const afford = avail && canAfford(t.cost);
    const unlocks = [
      ...Object.keys(BUILDINGS).filter((b) => BUILDINGS[b].tech === id).map((b) => `<img class="ico" src="${buildingIcon(b)}" title="${BUILDINGS[b].name}">`),
      ...Object.keys(RECIPES).filter((r) => RECIPES[r].tech === id).map((r) => itemImg(RECIPES[r].out)),
      ...Object.keys(SMELT).filter((r) => SMELT[r].tech === id).map((r) => itemImg(SMELT[r].out)),
    ].join('');
    h += `<div class="tech ${done ? 'done' : avail ? 'avail' : 'locked'}">
      <div class="tech-head"><b>${t.name}</b>${done ? '<span class="ok">✔ Investigado</span>' : ''}</div>
      <div class="tech-desc">${t.desc}</div>
      <div class="tech-unlocks">${unlocks}</div>
      ${t.req.length ? `<div class="muted small">Requiere: ${t.req.map((r) => TECHS[r].name).join(', ')}</div>` : ''}
      ${done ? '' : `<div class="tech-cost">${costHtml(t.cost)}</div>
        <button type="button" class="${afford ? 'primary' : ''}" data-tech="${id}" ${afford ? '' : 'disabled'}>Investigar</button>`}
    </div>`;
  }
  if (h !== researchHtml) { researchHtml = h; $('tech-list').innerHTML = h; }
}
let researchHtml = '';

$('tech-list').addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  const b = ev.target.closest('[data-tech]');
  if (!b) return;
  const id = b.dataset.tech, t = TECHS[id];
  if (S.techs[id] || !t.req.every((r) => S.techs[r]) || !canAfford(t.cost)) return;
  pay(t.cost);
  S.techs[id] = true;
  toast(`🔬 Investigaste <b>${t.name}</b>`);
  renderResearch();
  updateToolbar();
  save();
});

function openModal(id) {
  $(id).hidden = false;
  if (id === 'research') renderResearch();
  if (id === 'stats') renderStats();
}

function closeModals() {
  for (const id of ['help', 'research', 'stats', 'win']) $(id).hidden = true;
}

const anyModalOpen = () => ['help', 'research', 'stats', 'win'].some((id) => !$(id).hidden);

// --------------------------- Estadísticas ---------------------------

function renderStats() {
  const rows = ITEM_ORDER.filter((k) => S.produced[k] || S.inv[k]).map((k) =>
    `<tr><td>${itemLabel(k)}</td><td>${fmt(ratePerMinute(k))}</td><td>${fmt(S.produced[k] || 0)}</td><td>${fmt(S.inv[k] || 0)}</td></tr>`).join('');
  const power = nets.reduce((a, n) => ({ d: a.d + n.prevDemand, c: a.c + n.prevCap }), { d: 0, c: 0 });
  $('stats-body').innerHTML =
    `<p>Tiempo de juego: <b>${Math.floor(S.playTime / 60)} min</b> · Edificios: <b>${S.entities.length - 1}</b> · ` +
    `Energía: <b>${Math.round(power.d)} / ${Math.round(power.c)} kW</b></p>` +
    (rows ? `<table><thead><tr><th>Objeto</th><th>Por minuto</th><th>Producido</th><th>Inventario</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="muted">Todavía no produjiste nada.</p>');
}

// --------------------------- Avisos y tooltip ---------------------------

function toast(html) {
  const d = document.createElement('div');
  d.className = 'toast-msg';
  d.innerHTML = html;
  $('toast').appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

function updateTooltip() {
  const el = $('tooltip');
  let html = '';
  if (hover && !panning && !launchAnim && pointerType === 'mouse') {
    if (tool === 'hand') {
      const e = at(hover.x, hover.y);
      const o = oreAt(hover.x, hover.y);
      if (e) html = `<b>${e.type === 'hub' ? 'Núcleo' : BUILDINGS[e.type].name}</b><br><span class="muted">Clic para ver detalles</span>`;
      else if (o) html = `<b>${ITEMS[o].name}</b> (${fmt(oreAmountAt(hover.x, hover.y))})<br><span class="muted">Mantené clic para extraer</span>`;
    } else if (tool !== 'delete') {
      const s = sizeOf(tool);
      const res = canPlace(tool, hover.x - Math.floor(s / 2), hover.y - Math.floor(s / 2));
      html = `<b>${BUILDINGS[tool].name}</b> ${NO_DIR.has(tool) ? '' : DIR_ARROWS[toolDir]}<br><div class="tip-cost">${costHtml(BUILDINGS[tool].cost)}</div>` +
        (res.ok ? '' : res.why ? `<span class="bad">${res.why}</span>` : '');
    }
  }
  if (!html) { el.hidden = true; return; }
  el.innerHTML = html;
  el.hidden = false;
  const tw = el.offsetWidth, th = el.offsetHeight;
  el.style.left = Math.min(mouse.x + 16, cw - tw - 8) + 'px';
  el.style.top = Math.min(mouse.y + 16, ch - th - 8) + 'px';
}

function showWin() {
  const total = Object.values(S.produced).reduce((a, b) => a + b, 0);
  $('win-stats').innerHTML =
    `<p>⏱️ Tiempo: <b>${Math.floor(S.playTime / 60)} min</b><br>🏭 Edificios: <b>${S.entities.length - 1}</b><br>` +
    `📦 Objetos producidos: <b>${fmt(total)}</b><br>🔬 Investigaciones: <b>${Object.keys(S.techs).length}/${TECH_ORDER.length}</b></p>`;
  $('win').hidden = false;
}

function updateUI() {
  updateToolbar();
  updateSide();
  updateInspector();
  updateTooltip();
  if (!$('stats').hidden) renderStats();
  if (!$('research').hidden) renderResearch();
}
