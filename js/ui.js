'use strict';
// =====================================================================
//  Interfaz: barras, inventario, inspector, investigación y menú
// =====================================================================

const $ = (id) => document.getElementById(id);

// Teclas numéricas: repetir la tecla cambia de variante
const KEY_GROUPS = [
  ['belt', 'fastbelt', 'expressbelt'],
  ['underground'],
  ['splitter', 'sorter', 'chest'],
  ['miner', 'eminer', 'pumpjack'],
  ['furnace', 'efurnace'],
  ['assembler', 'assembler2', 'chem'],
  ['lab'],
  ['pole', 'bigpole'],
  ['generator', 'solar', 'accumulator', 'lamp'],
  ['wall', 'turret', 'laser'],
];
const keyOf = (type) => { const i = KEY_GROUPS.findIndex((g) => g.includes(type)); return i < 0 ? '' : i === 9 ? 0 : i + 1; };
const MODALS = ['help', 'research', 'stats', 'win', 'menu', 'newgame'];

// --------------------------- Íconos ---------------------------

const iconCache = {};
function itemIcon(item) {
  if (!iconCache[item]) {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    drawItem(c.getContext('2d'), item, 20, 20, 13);
    iconCache[item] = c.toDataURL();
  }
  return iconCache[item];
}
const itemImg = (item, cls = 'ico') => `<img class="${cls}" src="${itemIcon(item)}" alt="${ITEMS[item].name}" title="${ITEMS[item].name}">`;

function buildingIcon(type) {
  const key = 'b:' + type;
  if (!iconCache[key]) {
    const s = sizeOf(type);
    const c = document.createElement('canvas');
    c.width = c.height = 80;
    const g = c.getContext('2d');
    g.scale(80 / (TILE * s), 80 / (TILE * s));
    drawBuilding(g, makeEntity(type, 0, 0, 0), 0, 0, 0);
    iconCache[key] = c.toDataURL();
  }
  return iconCache[key];
}

function costHtml(cost) {
  return Object.entries(cost).map(([k, n]) => {
    const have = Math.floor(S.inv[k] || 0);
    return `<span class="cost-item ${have < n ? 'bad' : ''}">${itemImg(k, 'ico-s')}${n}</span>`;
  }).join('');
}

function costText(cost) {
  return Object.entries(cost).map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`).join(', ');
}

function fmt(n) {
  n = Math.floor(n);
  if (n >= 100000) return Math.round(n / 1000) + 'k';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// --------------------------- Barra de herramientas ---------------------------

const toolButtons = {};
let toolbarKey = '';

function buildToolbar() {
  // Solo se muestran los edificios desbloqueados
  const unlocked = TOOL_ORDER.filter(isUnlocked);
  const key = unlocked.join(',') + '|' + !!clipboard;
  if (key === toolbarKey) return;
  toolbarKey = key;
  const bar = $('toolbar');
  bar.innerHTML = '';
  for (const k in toolButtons) delete toolButtons[k];
  const mk = (id, label, keyHint, icon, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.innerHTML = `<span class="key">${keyHint}</span>${icon}<span class="label">${label}</span>`;
    b.addEventListener('click', onClick || (() => selectTool(id)));
    bar.appendChild(b);
    if (id) toolButtons[id] = b;
    return b;
  };
  const group = document.createElement('div');
  mk('hand', 'Mano', 'Esc', '<span class="emoji">✋</span>');
  mk('delete', 'Desarmar', 'X', '<span class="emoji">🗑️</span>');
  mk(null, 'Girar', 'R', '<span class="emoji">🔄</span>', () => rotateAction(1));
  mk(null, 'Deshacer', 'Ctrl Z', '<span class="emoji">↶</span>', undoAction);
  mk('copy', 'Copiar', 'C', '<span class="emoji">📋</span>');
  if (clipboard) mk('paste', 'Pegar', 'V', '<span class="emoji">📌</span>');
  let lastCat = null;
  for (const id of unlocked) {
    const d = BUILDINGS[id];
    if (d.cat !== lastCat) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      sep.textContent = d.cat;
      bar.appendChild(sep);
      lastCat = d.cat;
    }
    mk(id, d.name, keyOf(id), `<img src="${buildingIcon(id)}" alt="">`);
  }
  const locked = TOOL_ORDER.length - unlocked.length;
  if (locked) {
    const b = mk(null, `${locked} por investigar`, '', '<span class="emoji">🔒</span>', () => openModal('research'));
    b.classList.add('more');
  }
  void group;
}

function updateToolbar() {
  buildToolbar();
  for (const id in toolButtons) {
    const b = toolButtons[id];
    b.classList.toggle('selected', tool === id);
    const d = BUILDINGS[id];
    if (!d) continue;
    b.classList.toggle('poor', !canAfford(d.cost));
    b.title = `${d.name}${keyOf(id) !== '' ? ` [${keyOf(id)}]` : ''}\n${d.desc}\nCosto: ${costText(d.cost)}`;
  }
}

function selectTool(id) {
  if (BUILDINGS[id] && !isUnlocked(id)) {
    toast(`🔒 ${BUILDINGS[id].name}: investigá <b>${TECHS[BUILDINGS[id].tech].name}</b>`);
    return;
  }
  if (id === 'paste' && !clipboard) return;
  if (tool === id && id !== 'hand') { selectTool('hand'); return; }
  tool = id;
  clearPlans();
  if (id !== 'hand') closeInspector();
  if (BUILDINGS[id] && isTouch()) {
    toast(isLineTool(id) ? 'Tocá dónde empieza la cinta y después dónde termina.' : `Tocá dónde va ${BUILDINGS[id].name.toLowerCase()}, y otra vez para construir.`);
  }
  updateToolbar();
  updateConfirm();
}

function onTechFinished() {
  updateToolbar();
  researchHtml = '';
}

// --------------------------- Barra de confirmación ---------------------------

let confirmHtml = '';
function updateConfirm() {
  const el = $('confirm');
  let text = '', btns = [];
  if (beltPlan) {
    if (!beltPlan.b) { text = isTouch() ? 'Tocá dónde termina la cinta (o el mismo lugar para una sola).' : 'Clic donde termina la cinta.'; btns = ['cancel']; }
    else {
      const n = beltPath(beltPlan.a, beltPlan.b, beltPlan.flip).length;
      const cost = {};
      for (const k in BUILDINGS[tool].cost) cost[k] = BUILDINGS[tool].cost[k] * n;
      text = `${n} × ${BUILDINGS[tool].name}<span class="confirm-cost">${costHtml(cost)}</span>`;
      btns = ['flip', 'ok', 'cancel'];
    }
  } else if (pending && BUILDINGS[tool]) {
    text = `Tocá de nuevo para construir · <span class="confirm-cost">${costHtml(BUILDINGS[tool].cost)}</span>`;
    btns = NO_DIR.has(tool) ? ['ok', 'cancel'] : ['rotate', 'ok', 'cancel'];
  } else if (area) {
    if (area.mode === 'delete') {
      if (!area.b) { text = 'Tocá de nuevo para desarmar, o la otra esquina para elegir una zona.'; btns = ['cancel']; }
      else { text = `Desarmar ${entitiesIn(rectOf(area.a, area.b)).length} edificios`; btns = ['ok', 'cancel']; }
    } else if (!area.b && isTouch()) { text = 'Tocá la otra esquina de la zona a copiar.'; btns = ['cancel']; }
  } else if (tool === 'paste' && clipboard) {
    if (isTouch()) {
      text = pastePos ? `Tocá de nuevo para pegar ${clipboard.items.length} edificios.` : 'Tocá dónde pegar.';
      btns = pastePos ? ['rotate', 'ok', 'cancel'] : ['rotate', 'cancel'];
    } else { text = `Clic para pegar ${clipboard.items.length} edificios · R gira`; btns = ['cancel']; }
  }
  const labels = { ok: '✔ Construir', cancel: '✕', flip: '↺ Esquina', rotate: '🔄 Girar' };
  if (area && area.mode === 'delete') labels.ok = '✔ Desarmar';
  if (tool === 'paste') labels.ok = '✔ Pegar';
  const html = text ? `<span class="confirm-text">${text}</span>` + btns.map((b) => `<button type="button" data-c="${b}" class="${b === 'ok' ? 'primary' : ''}">${labels[b]}</button>`).join('') : '';
  if (html !== confirmHtml) { confirmHtml = html; el.innerHTML = html; }
  el.hidden = !html;
}

$('confirm').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-c]');
  if (!b) return;
  switch (b.dataset.c) {
    case 'cancel':
      if (tool === 'paste' && !pastePos) selectTool('hand');
      clearPlans();
      break;
    case 'flip': if (beltPlan) beltPlan.flip = !beltPlan.flip; break;
    case 'rotate': rotateAction(1); break;
    case 'ok':
      if (beltPlan && beltPlan.b) buildBeltPlan();
      else if (pending) { const s = sizeOf(tool); tryPlaceSingle({ x: pending.x + Math.floor(s / 2), y: pending.y + Math.floor(s / 2) }); pending = null; }
      else if (area && area.b) { deleteArea(rectOf(area.a, area.b)); area = null; }
      else if (pastePos) pasteAt(pastePos);
      break;
  }
  updateConfirm();
  updateUI();
});

// --------------------------- Panel lateral ---------------------------

function buildInventory() {
  $('inventory').innerHTML = ITEM_ORDER.map((k) =>
    `<div class="inv-item" data-item="${k}" title="${ITEMS[k].name}">${itemImg(k)}<span class="n">0</span></div>`).join('');
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
  return TECH_ORDER.find((id) => techAvailable(id));
}

function currentHint() {
  const d = S.delivered;
  const hasMinerOn = (ore) => S.entities.some((e) => (e.type === 'miner' || e.type === 'eminer') && oreAt(e.x, e.y) === ore);
  if (S.launched) return '🎉 ¡Escapaste del planeta! Seguí expandiendo la fábrica o armá otra nave.';
  if (!hasMinerOn('iron_ore')) return 'Elegí el <b>Taladro</b> y ponelo sobre el mineral de hierro (gris azulado). Girá la flecha para que apunte a donde va el mineral.';
  if (!countType('furnace') && !countType('efurnace')) return 'Poné un <b>Horno</b> justo delante de la flecha del taladro.';
  if ((d.iron_plate || 0) < 5) return 'Llevá las placas del horno al <b>Núcleo</b> con <b>Cintas</b>. Acordate de cargarle carbón al horno (tocalo con la mano).';
  if (!hasMinerOn('coal')) return 'Automatizá el combustible: un taladro sobre <b>carbón</b> y una cinta que lo lleve a los hornos.';
  if ((d.copper_plate || 0) < 5) return 'Armá otra línea para el <b>cobre</b> (mineral naranja): taladro → horno → Núcleo.';
  if (!countType('assembler')) return 'Poné una <b>Ensambladora</b>, elegí la receta <b>Engranaje</b> y alimentala con placas de hierro.';
  if (!countType('lab')) return 'Fabricá <b>Ciencia roja</b> (cobre + engranaje) y llevala a un <b>Laboratorio</b>.';
  if (!S.research.current && nextTech()) return `Abrí <b>Investigación</b> y elegí qué investigar. Sugerencia: <b>${TECHS[nextTech()].name}</b>.`;
  if (S.techs.electricity && !countType('generator') && !countType('solar')) return 'Construí un <b>Generador</b>, alimentalo con carbón y conectalo con <b>Postes</b> a tus máquinas eléctricas.';
  if (!S.peaceful && S.biters.some((b) => b.state === 'attack')) return '⚠️ Hay bichos atacando. Poné <b>Torretas</b> con <b>Munición</b> y <b>Muros</b> alrededor de la fábrica.';
  if (S.techs.oil && !countType('pumpjack')) return 'Buscá un pozo de <b>petróleo</b> (manchas negras) y poné una <b>Bomba de petróleo</b>.';
  if (S.techs.rocketry) {
    const sp = shipProgress();
    if (!sp.yard) return 'Construí el <b>Astillero</b> para empezar a armar la nave.';
    if (shipReady(sp.yard)) return '¡La nave está completa! Tocá el Astillero y apretá <b>Despegar</b>.';
    return 'Llevá las piezas al <b>Astillero</b> por cinta, o transferilas desde su panel.';
  }
  if (S.research.current) return `Investigando <b>${TECHS[S.research.current].name}</b>. Mantené los laboratorios con ciencia (${TECHS[S.research.current].packs.map((p) => itemImg(p, 'ico-s')).join('')}).`;
  return 'Seguí expandiendo la fábrica.';
}

function updateSide() {
  updateInventory();
  $('hint').innerHTML = currentHint();
}

function toggleSide(force) {
  const visible = getComputedStyle($('side')).display !== 'none';
  const open = force !== undefined ? force : !visible;
  document.body.classList.toggle('side-open', open);
  document.body.classList.toggle('side-closed', !open);
  try { localStorage.setItem('mini-fabrica-side', open ? '1' : '0'); } catch (_) { /* sin almacenamiento */ }
}

function togglePollution() {
  showPollution = !showPollution;
  $('btn-pollution').classList.toggle('on', showPollution);
}

// --------------------------- Barra superior ---------------------------

function updateTopbar() {
  $('era').textContent = ERAS[eraIndex()].name;
  const ph = dayPhase();
  const hours = Math.floor(((S.dayTime + 0.25) % 1) * 24);
  $('clock').textContent = `${ph.icon} Día ${S.day} · ${String(hours).padStart(2, '0')} h`;
  $('clock').title = `${ph.name}: paneles solares al ${Math.round(sunLevel() * 100)} %`;
  $('evo').hidden = S.peaceful;
  $('evo').textContent = `🐛 ${(S.evo * 100).toFixed(1)} %`;
  const r = S.research.current;
  $('research-chip').textContent = r ? `🔬 ${TECHS[r].name} ${Math.floor(100 * S.research.progress / TECHS[r].units)} %` : '🔬 Elegí investigación';
  $('research-chip').classList.toggle('warn', !r && !!nextTech());
  $('alert').hidden = !(lastAttack && S.playTime - lastAttack.t < 30);
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
const bar = (f, cls = '') => `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(100, f * 100)).toFixed(0)}%"></div></div>`;

function powerRow(e) {
  const def = BUILDINGS[e.type];
  const net = nets[e._net];
  if (!net) return row('Energía', '<span class="bad">Sin conexión a un poste</span>');
  if (def.power) {
    const pct = Math.round(net.sat * 100);
    return row('Energía', `${def.power} kW · <span class="${pct < 100 ? 'bad' : 'ok'}">${pct} %</span>`);
  }
  return netRows(net);
}

function netRows(net) {
  const p = net.prev;
  return row('Consumo', `${Math.round(p.demand)} kW`) +
    row('Generación', `${Math.round(p.solar + p.fuel)} kW`) +
    (net.accCount ? row('Acumuladores', `${net.accFlow >= 0 ? 'cargando' : 'descargando'} ${Math.round(Math.abs(net.accFlow))} kW`) : '') +
    row('Satisfacción', `<span class="${net.sat < 1 ? 'bad' : 'ok'}">${Math.round(net.sat * 100)} %</span>`);
}

function hpRow(e) {
  return e.hp !== undefined ? row('Vida', `${Math.ceil(e.hp)} / ${maxHp(e)}`) : '';
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
    case 'miner': case 'eminer': case 'pumpjack': {
      const o = oreAt(e.x, e.y);
      h += row('Extrae', o ? itemLabel(o) : '<span class="bad">Agotado</span>');
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
      if (r) h += bar(e.prog / r.time);
      h += '<div class="recipes-note muted">Funde: ' + Object.entries(SMELT).filter(([, r]) => hasTech(r.tech))
        .map(([k, r]) => `${r.n}×${itemImg(k, 'ico-s')}→${itemImg(r.out, 'ico-s')}`).join(' ') + '</div>';
      h += '<div class="actions">';
      if (e.type === 'furnace') h += '<button type="button" data-act="fuel">Cargar carbón</button>';
      h += '<button type="button" data-act="feed">Cargar mineral</button><button type="button" data-act="collect">Recoger</button></div>';
      break;
    }
    case 'assembler': case 'assembler2': case 'chem': {
      const rc = e.recipe && RECIPES[e.recipe];
      if (rc) {
        h += row('Fabrica', itemLabel(rc.out) + (rc.n > 1 ? ` ×${rc.n}` : '')) +
          Object.entries(rc.in).map(([k, n]) => row(itemLabel(k), `${e.buf[k] || 0} / ${n}`)).join('') +
          row('Listos', e.out) + bar(e.prog / rc.time);
      } else h += '<p class="bad">Elegí una receta:</p>';
      if (def.power) h += powerRow(e);
      h += '<div class="pick-title">Receta</div><div class="picker">';
      for (const id of RECIPE_ORDER) {
        const r = RECIPES[id];
        if (r.machine !== def.machine || !hasTech(r.tech)) continue;
        const ok = r.tier <= def.tier;
        const ins = Object.entries(r.in).map(([k, n]) => `${n} ${ITEMS[k].name}`).join(' + ');
        h += `<button type="button" class="pick ${e.recipe === id ? 'on' : ''}" data-act="recipe" data-v="${id}" ${ok ? '' : 'disabled'}
          title="${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}: ${ins} (${r.time} s)${ok ? '' : ' (requiere Ensambladora avanzada)'}">${itemImg(r.out)}</button>`;
      }
      h += '</div>';
      if (rc) h += '<div class="actions"><button type="button" data-act="feed">Cargar del inventario</button><button type="button" data-act="collect">Recoger</button></div>';
      break;
    }
    case 'lab': {
      const r = S.research.current && TECHS[S.research.current];
      h += row('Investigando', r ? r.name : '<span class="bad">nada (elegí en Investigación)</span>');
      if (r) h += row('Progreso', `${S.research.progress} / ${r.units}`) + bar(S.research.progress / r.units);
      h += '<div class="pick-title">Packs guardados</div>' + PACKS.map((p) => row(itemLabel(p), e.packs[p] || 0)).join('');
      if (e.working) h += bar(e.prog);
      h += '<div class="actions"><button type="button" data-act="labfeed">Cargar ciencia del inventario</button><button type="button" data-act="research">🔬 Investigación</button></div>';
      break;
    }
    case 'splitter':
      h += '<p>Reparte por turnos entre adelante, izquierda y derecha.</p>';
      break;
    case 'sorter': {
      h += row('Filtro', e.filter ? itemLabel(e.filter) : 'ninguno (todo sigue derecho)');
      h += '<div class="pick-title">El objeto elegido sigue derecho; el resto sale por los costados</div><div class="picker">';
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
        row('Carga', Math.round((e.load || 0) * 100) + ' %') + powerRow(e) +
        '<div class="actions"><button type="button" data-act="gfuel">Cargar carbón</button></div>';
      break;
    case 'solar':
      h += row('Genera ahora', `${Math.round(e.out || 0)} kW (${dayPhase().name.toLowerCase()})`) + powerRow(e);
      break;
    case 'accumulator': {
      const d = BUILDINGS.accumulator;
      h += row('Carga', `${Math.round((e.stored || 0) / 1000 * 10) / 10} / ${d.capacity / 1000} MJ`) + bar((e.stored || 0) / d.capacity) + powerRow(e);
      break;
    }
    case 'pole': case 'bigpole':
      h += nets[e._net] ? row('Postes en la red', nets[e._net].poles) + netRows(nets[e._net]) : '';
      break;
    case 'lamp':
      h += row('Estado', e.lit ? 'encendida' : 'apagada (de día o sin energía)') + powerRow(e);
      break;
    case 'turret':
      h += row('Munición', `${e.ammo} cargadores` + (e.shots ? ` + ${e.shots} balas` : '')) + row('Alcance', `${def.range} casillas`) +
        row('Daño', `${Math.round(def.dmg * weaponMult())} por disparo`) +
        '<div class="actions"><button type="button" data-act="ammo">Cargar munición</button></div>';
      break;
    case 'laser':
      h += row('Alcance', `${def.range} casillas`) + row('Daño', `${Math.round(def.dmg * weaponMult())} por disparo`) + powerRow(e);
      break;
    case 'wall':
      h += '<p>Frena a los bichos mientras las torretas disparan.</p>';
      break;
    case 'shipyard': {
      h += '<p>Piezas de la nave:</p>';
      for (const k in SHIP) {
        const have = e.parts[k] || 0;
        h += `<div class="row">${itemLabel(k)}<span>${have} / ${SHIP[k]}</span></div>` + bar(have / SHIP[k]);
      }
      h += '<div class="actions"><button type="button" data-act="transfer">Transferir del inventario</button>';
      if (shipReady(e)) h += '<button type="button" class="primary" data-act="launch">🚀 ¡Despegar!</button>';
      h += '</div>';
      break;
    }
  }
  h += hpRow(e);
  if (e.type !== 'hub') {
    h += '<div class="actions small">';
    if (!NO_DIR.has(e.type)) h += '<button type="button" data-act="rotate">🔄 Girar</button>';
    h += '<button type="button" data-act="remove">🗑️ Desarmar</button></div>';
  }
  return h;
}

function updateInspector() {
  if (!inspected) return;
  if (inspected._dead) { closeInspector(); return; }
  const h = inspectorContent(inspected);
  if (h !== inspectorHtml) {
    inspectorHtml = h;
    $('inspector').innerHTML = h;
  }
}

function moveToInv(item, n) { if (item && n > 0) add(S.inv, item, n); }

// Pasa objetos del inventario a un edificio usando su propia lógica de entrada
function feedFrom(e, items, max) {
  let n = 0;
  for (const k of items) {
    while (n < max && (S.inv[k] || 0) >= 1 && accept(e, k, null)) { S.inv[k]--; n++; }
  }
  return n;
}

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
    case 'remove': removeEntity(e); closeInspector(); updateUI(); return;
    case 'recipe':
      if (e.recipe !== v) {
        refund(e.buf);
        if (e.recipe) moveToInv(RECIPES[e.recipe].out, e.out);
        e.buf = {}; e.out = 0; e.prog = 0; e.recipe = v;
      }
      break;
    case 'filter': e.filter = v || null; break;
    case 'fuel': {
      const n = feedFrom(e, ['coal', 'solid_fuel'], 10);
      if (!n) toast(e.fuel >= 10 ? 'El horno ya está lleno.' : 'No tenés carbón en el inventario.');
      break;
    }
    case 'gfuel': {
      const n = feedFrom(e, ['coal', 'solid_fuel'], 20);
      if (!n) toast('No tenés combustible en el inventario.');
      break;
    }
    case 'feed': {
      const items = e.recipe ? Object.keys(RECIPES[e.recipe].in) : Object.keys(SMELT);
      const n = feedFrom(e, items, 40);
      if (!n) toast('No hay materiales para esta máquina en el inventario.');
      break;
    }
    case 'labfeed': {
      const n = feedFrom(e, PACKS, 40);
      toast(n ? `Cargaste ${n} packs de ciencia.` : 'No tenés packs de ciencia en el inventario.');
      break;
    }
    case 'research': openModal('research'); return;
    case 'ammo': {
      const n = feedFrom(e, ['ammo'], 20);
      if (!n) toast('No tenés munición en el inventario. Fabricala en una ensambladora.');
      break;
    }
    case 'collect':
      if (e.outType) { moveToInv(e.outType, e.outCount); e.outCount = 0; e.outType = null; }
      if (e.recipe && e.out) { moveToInv(RECIPES[e.recipe].out, e.out); e.out = 0; }
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
  updateInventory();
});

// --------------------------- Investigación ---------------------------

let researchHtml = '';

function techUnlocksHtml(id) {
  return [
    ...TOOL_ORDER.filter((b) => BUILDINGS[b].tech === id).map((b) => `<img class="ico" src="${buildingIcon(b)}" alt="${BUILDINGS[b].name}" title="${BUILDINGS[b].name}">`),
    ...RECIPE_ORDER.filter((r) => RECIPES[r].tech === id).map((r) => itemImg(RECIPES[r].out)),
    ...Object.keys(SMELT).filter((r) => SMELT[r].tech === id).map((r) => itemImg(SMELT[r].out)),
  ].join('');
}

function renderResearch() {
  const cur = S.research.current;
  const labs = countType('lab');
  let top = '';
  if (cur) {
    const t = TECHS[cur];
    const left = (t.units - S.research.progress) * t.time / Math.max(1, labs);
    top = `<div class="research-now"><b>Investigando: ${t.name}</b> · ${S.research.progress}/${t.units} ${bar(S.research.progress / t.units)}` +
      `<span class="muted small">${labs ? `${labs} laboratorio${labs > 1 ? 's' : ''} · faltan unos ${Math.ceil(left / 60)} min si no les falta ciencia` : 'No tenés laboratorios.'}</span></div>`;
  }
  let h = '';
  for (const id of TECH_ORDER) {
    const t = TECHS[id];
    const done = !!S.techs[id];
    const avail = techAvailable(id);
    const state = done ? 'done' : id === cur ? 'current' : avail ? 'avail' : 'locked';
    h += `<div class="tech ${state}">
      <div class="tech-head"><b>${t.name}</b>${done ? '<span class="ok">✔</span>' : ''}</div>
      <div class="tech-desc">${t.desc}</div>
      <div class="tech-unlocks">${techUnlocksHtml(id)}</div>
      ${t.req.length && !done ? `<div class="muted small">Requiere: ${t.req.map((r) => `<span class="${S.techs[r] ? 'ok' : ''}">${TECHS[r].name}</span>`).join(', ')}</div>` : ''}
      ${done ? '' : `<div class="tech-cost">${t.packs.map((p) => itemImg(p, 'ico-s')).join('')} × ${t.units} <span class="muted">(${t.time} s c/u)</span></div>
        ${state === 'current' ? '<span class="ok small">En curso</span>' : `<button type="button" class="${avail ? 'primary' : ''}" data-tech="${id}" ${avail ? '' : 'disabled'}>Investigar</button>`}`}
    </div>`;
  }
  $('research-current').innerHTML = top;
  if (h !== researchHtml) { researchHtml = h; $('tech-list').innerHTML = h; }
}

$('tech-list').addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  const b = ev.target.closest('[data-tech]');
  if (!b || b.disabled) return;
  setResearch(b.dataset.tech);
  toast(`🔬 Ahora investigás <b>${TECHS[b.dataset.tech].name}</b>`);
  researchHtml = '';
  renderResearch();
  updateTopbar();
});

// --------------------------- Modales ---------------------------

function openModal(id) {
  closeModals();
  $(id).hidden = false;
  if (id === 'research') { researchHtml = ''; renderResearch(); }
  if (id === 'stats') renderStats();
  if (id === 'menu') { $('import-box').hidden = true; $('export-text').hidden = true; }
}

function closeModals() {
  for (const id of MODALS) $(id).hidden = true;
}

const anyModalOpen = () => MODALS.some((id) => !$(id).hidden);

// --------------------------- Estadísticas ---------------------------

function renderStats() {
  const rows = ITEM_ORDER.filter((k) => S.produced[k] || S.inv[k]).map((k) =>
    `<tr><td>${itemLabel(k)}</td><td>${fmt(ratePerMinute(k))}</td><td>${fmt(S.produced[k] || 0)}</td><td>${fmt(S.inv[k] || 0)}</td></tr>`).join('');
  let d = 0, c = 0;
  for (const n of nets) { d += n.prev.demand; c += n.prev.solar + n.prev.fuel; }
  const nests = countType('nest');
  $('stats-body').innerHTML =
    `<p>⏱️ <b>${Math.floor(S.playTime / 60)} min</b> · 🏭 <b>${S.entities.length - 1 - nests}</b> edificios · ⚡ <b>${Math.round(d)} / ${Math.round(c)} kW</b>` +
    (S.peaceful ? '' : ` · 🐛 evolución <b>${(S.evo * 100).toFixed(1)} %</b> · nidos <b>${nests}</b> · ☁️ polución <b>${fmt(totalPollution())}</b>`) + '</p>' +
    (rows ? `<div class="table-wrap"><table><thead><tr><th>Objeto</th><th>Por minuto</th><th>Producido</th><th>Inventario</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="muted">Todavía no produjiste nada.</p>');
}

// --------------------------- Avisos y tooltip ---------------------------

function toast(html) {
  const box = $('toast');
  while (box.children.length >= 3) box.firstChild.remove();
  const d = document.createElement('div');
  d.className = 'toast-msg';
  d.innerHTML = html;
  box.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

function updateTooltip() {
  const el = $('tooltip');
  let html = '';
  if (hover && !panning && !launchAnim && !isTouch()) {
    if (tool === 'hand') {
      const e = at(hover.x, hover.y);
      const o = oreAt(hover.x, hover.y);
      if (e && e.type === 'nest') html = '<b>Nido enemigo</b><br><span class="muted">Destruilo con torretas cerca</span>';
      else if (e) html = `<b>${e.type === 'hub' ? 'Núcleo' : BUILDINGS[e.type].name}</b><br><span class="muted">Clic para ver detalles</span>`;
      else if (o) html = `<b>${ITEMS[o].name}</b> (${fmt(oreAmountAt(hover.x, hover.y))})` + (o === 'oil' ? '<br><span class="muted">Necesita una bomba de petróleo</span>' : '<br><span class="muted">Mantené clic para extraer</span>');
    } else if (BUILDINGS[tool] && !beltPlan) {
      const a = anchorFor(tool, hover);
      const res = canPlace(tool, a.x, a.y);
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
    `<p>⏱️ Tiempo: <b>${Math.floor(S.playTime / 60)} min</b><br>🏭 Edificios: <b>${S.entities.length - 1 - countType('nest')}</b><br>` +
    `📦 Objetos producidos: <b>${fmt(total)}</b><br>🔬 Investigaciones: <b>${Object.keys(S.techs).length}/${TECH_ORDER.length}</b></p>`;
  openModal('win');
}

function updateUI() {
  updateToolbar();
  updateTopbar();
  if (getComputedStyle($('side')).display !== 'none') updateSide();
  updateInspector();
  updateTooltip();
  updateConfirm();
  if (!$('stats').hidden) renderStats();
  if (!$('research').hidden) renderResearch();
}
