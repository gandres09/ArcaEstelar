'use strict';
// =====================================================================
//  Interfaz: barras, inventario, inspector, investigación y menú
// =====================================================================

const $ = (id) => document.getElementById(id);

// Teclas numéricas: repetir la tecla cambia de variante
const KEY_GROUPS = [
  ['belt', 'fastbelt', 'expressbelt'],
  ['underground', 'inserter', 'fastinserter'],
  ['splitter', 'sorter', 'woodchest', 'chest', 'steelchest', 'receiver'],
  ['miner', 'eminer', 'pumpjack'],
  ['furnace', 'efurnace'],
  ['assembler', 'assembler2', 'chem'],
  ['lab'],
  ['pole', 'bigpole', 'radar'],
  ['offshore', 'boiler', 'steam_engine', 'pipe', 'tank', 'generator', 'solar', 'accumulator', 'lamp'],
  ['wall', 'turret', 'laser'],
];
const keyOf = (type) => { const i = KEY_GROUPS.findIndex((g) => g.includes(type)); return i < 0 ? '' : i === 9 ? 0 : i + 1; };
const MODALS = ['help', 'research', 'stats', 'win', 'menu', 'newgame', 'ach', 'online', 'planos'];

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

function costHtml(cost, detail = false) {
  return Object.entries(cost).map(([k, n]) => {
    const have = Math.floor(avail(k));
    const short = have < n;
    return `<span class="cost-item ${short ? 'bad' : ''}" title="${ITEMS[k].name}">${itemImg(k, 'ico-s')}${n}${detail ? `<small class="have">${short ? ` (tenés ${fmt(have)})` : ''}</small>` : ''}</span>`;
  }).join('');
}

// Qué falta para pagar un costo: "3 engranajes, 2 placas de hierro"
function missingText(cost) {
  return Object.entries(cost).filter(([k, n]) => avail(k) < n)
    .map(([k, n]) => `${ITEMS[k].name.toLowerCase()} ×${n - Math.floor(avail(k))}`).join(', ');
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
    if (id && BUILDINGS[id]) b.dataset.tool = id;
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
    b.setAttribute('aria-label', `${d.name}. ${d.desc} Costo: ${costText(d.cost)}`);
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
    btns.unshift('save');
  } else if (BUILDINGS[tool]) {
    // Ficha del edificio elegido: qué pide y qué falta
    const d = BUILDINGS[tool];
    const miss = missingText(d.cost);
    const how = isTouch() ? (isLineTool(tool) ? 'Tocá dónde empieza y dónde termina.' : 'Tocá dónde va.') : (isLineTool(tool) ? 'Clic y arrastrá.' : 'Clic dónde va · R gira.');
    text = `<span class="tc-head"><img class="ico" src="${buildingIcon(tool)}" alt=""><b>${d.name}</b></span>` +
      `<span class="tc-cost">Pide: ${costHtml(d.cost, true)}</span>` +
      `<span class="tc-desc muted">${d.desc}</span>` +
      `<span class="tc-note ${miss ? 'bad' : 'muted'}">${miss ? 'Te falta: ' + miss : how}</span>`;
    btns = ['close'];
  }
  const labels = { close: '✕', ok: '✔ Construir', cancel: '✕', flip: '↺ Esquina', rotate: '🔄 Girar', save: '💾 Guardar plano' };
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
    case 'close': selectTool('hand'); break;
    case 'cancel':
      if (tool === 'paste' && !pastePos) selectTool('hand');
      clearPlans();
      break;
    case 'flip': if (beltPlan) beltPlan.flip = !beltPlan.flip; break;
    case 'save': saveClipboardAsBlueprint(); break;
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
  const grid = (id) => ITEM_ORDER.map((k) =>
    `<button type="button" class="inv-item" data-item="${k}" title="${ITEMS[k].name}">${itemImg(k)}<span class="n">0</span></button>`).join('');
  $('inventory').innerHTML = grid();
  $('pocket').innerHTML = grid();
}

function updateInventory() {
  const fill = (box, store) => {
    for (const el of box.children) {
      const n = store[el.dataset.item] || 0;
      el.querySelector('.n').textContent = fmt(n);
      el.classList.toggle('zero', n < 1);
    }
  };
  fill($('inventory'), S.inv);
  const char = playerOn();
  document.body.classList.toggle('has-player', char);
  if (char) {
    fill($('pocket'), S.pinv);
    const near = nearStorage();
    $('storage-note').textContent = near ? 'Estás cerca del Núcleo: tocá un objeto para pasarlo de un lado al otro. Construís usando las dos cosas.' : 'Lejos del Núcleo: construís solo con lo que llevás en la mochila.';
    $('storage-note').classList.toggle('ok', near);
    updateCraftUI();
  }
}

// Pasar objetos entre la mochila y el Núcleo (solo cerca del Núcleo)
function transferItem(k, toHub) {
  if (!nearStorage()) { toast('Acercate al Núcleo para pasar objetos.'); return; }
  const from = toHub ? S.pinv : S.inv, to = toHub ? S.inv : S.pinv;
  const n = Math.floor(from[k] || 0);
  if (!n) return;
  const move = toHub ? n : Math.min(n, 50);
  from[k] -= move; if (from[k] <= 0) delete from[k];
  add(to, k, move);
  sfx('click');
  updateInventory();
}

// --------------------------- Fabricación a mano ---------------------------

let craftHtml = '';
function updateCraftUI() {
  const p = S.player;
  let h = '<div class="picker">';
  for (const id of handRecipes()) {
    const r = RECIPES[id];
    const ok = canCraft(id);
    const ins = Object.entries(r.in).map(([k, n]) => `${n} ${ITEMS[k].name}`).join(' + ');
    h += `<button type="button" class="pick craft-btn" data-craft="${id}" ${ok ? '' : 'disabled'} title="${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}: ${ins} (${r.time} s)">${itemImg(r.out)}</button>`;
  }
  h += '</div>';
  if (p.craft.length) {
    const c = p.craft[0];
    h += `<div class="craft-queue">${p.craft.slice(0, 8).map((q, i) => `<button type="button" class="pick" data-cancel="${i}" title="Cancelar">${itemImg(RECIPES[q.id].out, 'ico-s')}</button>`).join('')}${p.craft.length > 8 ? `<span class="muted small">+${p.craft.length - 8}</span>` : ''}</div>` +
      bar(1 - c.t / RECIPES[c.id].time);
  }
  if (h !== craftHtml) { craftHtml = h; $('craft').innerHTML = h; }
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
  const st = stageOf();
  if (st >= 4) return '🌌 ¡El Arca salió del sistema solar! Ganaste. Podés seguir jugando todo lo que quieras.';
  if (st === 3) {
    const sp = shipProgress('starport');
    if (!S.techs.superconductors) return '<b>Etapa 3: escapar del sistema solar.</b> Investigá <b>Superconductores</b> (cobre + titanio + lubricante en la planta química) para empezar la cadena del Arca.';
    if (!S.techs.star_science) return 'Con superconductores y procesadores cuánticos investigá <b>Ciencia estelar</b>: el pack nuevo para las últimas tecnologías.';
    if (!S.techs.starship) return 'Seguí investigando hasta el <b>Arca estelar</b>: Fusión → Motor de curvatura → Arca. La <b>Planta de fusión</b> da 8 MW limpios.';
    if (!sp.yard) return 'Construí el <b>Dique estelar</b> (7×7) para armar el Arca.';
    if (shipReady(sp.yard)) return '¡El Arca está completa! Tocá el Dique estelar y apretá <b>Despegar</b>.';
    return `Llevá las piezas del Arca al <b>Dique estelar</b> (${Math.floor(sp.frac * 100)} %): casco, motores de curvatura, núcleos de fusión, hábitats, escudos, navegación y combustible.`;
  }
  if (st === 2) {
    const c = cleanupProgress();
    const air = `Aire: polución ${Math.round(c.poll)} (meta: menos de ${CLEAN_TARGET} durante 5 min, llevás ${Math.floor((S.cleanTime || 0) / 60)}:${String((S.cleanTime || 0) % 60).padStart(2, '0')}).`;
    if (!S.techs.air_purification) return `<b>Etapa 2: limpiar el planeta.</b> Desde la órbita ves todo el mapa. Investigá <b>Purificación del aire</b>${S.peaceful ? '' : ' y <b>Ataque orbital</b>'}. ${air}`;
    if (!countType('purifier')) return `Poné <b>Purificadores de aire</b> con <b>filtros</b> donde más contaminás. Ayuda pasar a hornos eléctricos y energía solar, y los <b>bosques</b> absorben polución. ${air}`;
    if (!S.peaceful && c.nests > 0) {
      if (!S.techs.orbital_strike) return `Quedan <b>${c.nests} nidos</b>. Investigá <b>Ataque orbital</b> para borrarlos desde el espacio. ${air}`;
      if (!countType('uplink')) return `Construí un <b>Enlace orbital</b> y cargale <b>cargas orbitales</b>: cada una borra el grupo de nidos más cercano. Quedan ${c.nests}. ${air}`;
      return `Quedan <b>${c.nests} nidos</b>: mantené el Enlace orbital con cargas y energía. ${air}`;
    }
    return air + ' Cuando se cumpla, empieza la última etapa.';
  }
  // Arranque con personaje: todo empieza a mano
  if (playerOn() && !S.entities.some((e) => e.type === 'miner' || e.type === 'eminer')) {
    const pv = (k) => S.pinv[k] || 0;
    const furnaces = S.entities.filter((e) => e.type === 'furnace');
    if (!furnaces.length) return pv('stone') < 5
      ? `Con la ✋ <b>Mano</b>, tocá la <b>piedra</b> (marrón clara) para que tu personaje la extraiga. Necesitás 5 (tenés ${pv('stone')}).`
      : 'Ya tenés piedra: elegí el <b>Horno de piedra</b> abajo y ponelo cerca tuyo.';
    if (pv('iron_plate') + (S.inv.iron_plate || 0) < 10) {
      if (pv('iron_ore') < 4 && !furnaces.some((f) => f.inType)) return `Extraé <b>mineral de hierro</b> (gris azulado) y <b>carbón</b> (negro) con la mano. Tenés ${pv('iron_ore')} de hierro y ${pv('coal')} de carbón.`;
      if (!furnaces.some((f) => f.fuel || f.burn > 0) && pv('coal') < 1 && pv('wood') < 1) return 'El horno necesita combustible: extraé <b>carbón</b> o talá un <b>árbol</b> (la madera también sirve).';
      return 'Tocá el horno y usá <b>Cargar mineral</b> y <b>Cargar carbón</b>. Cuando funda, tocá <b>Recoger</b>. Necesitás 10 placas de hierro.';
    }
    return 'Con 10 placas de hierro y 5 piedras armá un <b>Taladro</b> sobre el hierro, con un horno delante de su flecha, y cargale carbón. ¡Ya no vas a tener que extraer a mano!';
  }
  if (!hasMinerOn('iron_ore')) return 'Elegí el <b>Taladro</b> y ponelo sobre el mineral de hierro (gris azulado). Girá la flecha para que apunte a donde va el mineral.';
  if (S.entities.some((e) => e.type === 'miner' && !e.fuel && e.burn <= 0 && !e.depleted)) return 'Hay un <b>Taladro</b> sin combustible: tocalo y usá <b>Cargar carbón</b> (1 carbón = 8 minerales). Un taladro sobre carbón se alimenta solo.';
  if (!countType('furnace') && !countType('efurnace')) return 'Poné un <b>Horno</b> justo delante de la flecha del taladro.';
  if ((d.iron_plate || 0) < 5) return 'Llevá las placas del horno al <b>Núcleo</b> con <b>Cintas</b>. Acordate de cargarle carbón al horno (tocalo con la mano).';
  if (!hasMinerOn('coal')) return 'Automatizá el combustible: un taladro sobre <b>carbón</b> y una cinta que lo lleve a los hornos.';
  if ((d.copper_plate || 0) < 5) return 'Armá otra línea para el <b>cobre</b> (mineral naranja): taladro → horno → Núcleo.';
  if (!countType('generator') && !countType('steam_engine') && !countType('solar') && !countType('fusion_plant')) return 'Las ensambladoras y los laboratorios necesitan <b>electricidad</b>: poné un <b>Generador a carbón</b>, cargale carbón y llevá la energía con <b>Postes</b>.';
  if (!countType('assembler')) return 'Poné una <b>Ensambladora</b> al alcance de un <b>Poste</b>, elegí la receta <b>Engranaje</b> y alimentala con placas de hierro.';
  if (!countType('lab')) return 'Fabricá <b>Ciencia roja</b> (cobre + engranaje) y llevala a un <b>Laboratorio</b>.';
  if (!S.research.current && nextTech()) return `Abrí <b>Investigación</b> y elegí qué investigar. Sugerencia: <b>${TECHS[nextTech()].name}</b>.`;
  if (S.techs.steam_power && !countType('steam_engine')) return 'Energía a vapor: poné una <b>Bomba de agua</b> en la orilla de un lago, apuntando a una <b>Caldera</b> (cargala con carbón), y la caldera apuntando a <b>Máquinas de vapor</b> en fila. Conectalas con postes.';
  if (!S.peaceful && S.biters.some((b) => b.state === 'attack')) return '⚠️ Hay bichos atacando. Poné <b>Torretas</b> con <b>Munición</b> y <b>Muros</b> alrededor de la fábrica.';
  if (S.techs.oil && !countType('pumpjack')) return 'Buscá un pozo de <b>petróleo</b> (manchas negras) y poné una <b>Bomba de petróleo</b>.';
  if (S.techs.receivers && !countType('receiver')) return 'Con los <b>Receptores</b> no hace falta llevar todo hasta el Núcleo: poné uno al final de una línea lejana y lo que le llega va al inventario.';
  if (S.techs.inserters && !countType('inserter') && countType('lab')) return 'Probá los <b>Brazos</b>: un brazo pegado al Núcleo saca justo lo que necesita la máquina de enfrente (por ejemplo, ciencia para un laboratorio).';
  if (S.techs.railway && !S.trains.length) return '<b>Trenes</b>: tendé una vía entre una mina lejana y tu base, poné una <b>Estación</b> en cada punta (una en Carga y otra en Descarga) y un <b>Tren</b> sobre la vía.';
  if (S.techs.construction_robots && !countType('roboport')) return 'Poné un <b>Puerto de robots</b> con energía: construye los planos que esperan materiales y reconstruye lo que rompen los bichos.';
  if (S.techs.modules && !S.entities.some((e) => e.modules && e.modules.length)) return 'Fabricá <b>Módulos</b> y ponelos en máquinas eléctricas o laboratorios desde su panel: más velocidad, más producción o menos consumo.';
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
  $('research-chip').textContent = r ? `🔬 ${techName(r)} ${Math.floor(100 * S.research.progress / techUnits(r))} %` : '🔬 Elegí investigación';
  $('research-chip').classList.toggle('warn', !r && !!nextTech());
  $('alert').hidden = !(lastAttack && S.playTime - lastAttack.t < 30);
  const st = Math.min(3, stageOf()), frac = stageProgress();
  $('stage-icon').textContent = STAGES[st - 1].icon;
  $('ship-mini').title = `Etapa ${st} de 3: ${STAGES[st - 1].name}. ${STAGES[st - 1].desc}`;
  $('ship-mini-bar').style.width = (frac * 100).toFixed(1) + '%';
  $('ship-mini-pct').textContent = `${st}/3 · ${Math.floor(frac * 100)}%`;
}

// --------------------------- Inspector ---------------------------

let inspected = null;
let inspectorHtml = '';

function openInspector(e) {
  if ($('pet-panel')) $('pet-panel').hidden = true;
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
      h += row('Velocidad', def.speed + ' objetos/s') + row('Carril izquierdo', e.l && e.l[0] ? itemLabel(e.l[0]) : 'vacío') + row('Carril derecho', e.l && e.l[1] ? itemLabel(e.l[1]) : 'vacío');
      break;
    case 'underground':
      h += row('Tipo', e.mode === 'in' ? 'Entrada' : 'Salida') +
        row('Conectada', e._pair ? `sí, a ${e._dist} casillas` : '<span class="bad">no: poné la otra punta en la misma dirección</span>');
      break;
    case 'miner': case 'eminer': case 'pumpjack': {
      const area = minerArea(e);
      const kinds = Object.keys(area);
      h += row('Extrae', kinds.length ? kinds.map((k) => itemLabel(k)).join(' ') : '<span class="bad">Agotado</span>');
      if (kinds.length) h += row('Queda', fmt(Object.values(area).reduce((a, b) => a + b, 0)) + (e.type === 'pumpjack' ? ' en el pozo' : ' en su área'));
      if (e.buf) h += row('Estado', '<span class="bad">Salida bloqueada</span>');
      if (def.power) h += powerRow(e);
      if (e.type === 'miner') {
        h += row('Combustible', e.fuel ? itemLabel(e.fuelType, e.fuel) : (e.burn > 0 ? 'quemando' : '<span class="bad">sin combustible</span>')) +
          fuelPicker(e, 10);
      }
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
      h += pickRow(e, 'Cargar mineral', Object.keys(SMELT).filter((k) => hasTech(SMELT[k].tech)), 50,
        e.inCount ? 'Para cambiar de mineral, primero sacá el que tiene adentro.' : '');
      if (e.type === 'furnace') h += fuelPicker(e, 10);
      h += '<div class="actions">' + (e.inCount ? `<button type="button" data-act="ctake" data-v="${e.inType}">Sacar mineral</button>` : '') +
        '<button type="button" data-act="collect">Recoger</button></div>';
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
      if (r) h += row('Progreso', `${S.research.progress} / ${techUnits(S.research.current)}`) + bar(S.research.progress / techUnits(S.research.current));
      h += '<div class="pick-title">Packs guardados</div>' + PACKS.map((p) => row(itemLabel(p), e.packs[p] || 0)).join('');
      if (e.working) h += bar(e.prog);
      h += '<div class="actions"><button type="button" data-act="labfeed">Cargar ciencia del inventario</button><button type="button" data-act="research">🔬 Investigación</button></div>';
      break;
    }
    case 'inserter': case 'fastinserter': {
      const [dx, dy] = DIRS[e.dir];
      const src = at(e.x - dx, e.y - dy), dst = at(e.x + dx, e.y + dy);
      const nm = (x) => (!x ? '<span class="bad">nada</span>' : x.type === 'hub' ? 'Núcleo' : BUILDINGS[x.type]?.name || x.type);
      h += row('Toma de', nm(src)) + row('Deja en', nm(dst)) + row('Lleva', itemLabel(e.hold)) +
        row('Velocidad', `${(1 / def.swing).toFixed(1)} objetos/s`) + (def.power ? powerRow(e) : '');
      if (src && src.type === 'receiver' && !hasTech('logistic_network')) h += '<p class="bad small">Para sacar de un receptor hace falta investigar Red logística.</p>';
      h += row('Filtro', e.filter ? itemLabel(e.filter) : 'ninguno');
      h += '<div class="pick-title">Elegí un objeto para que solo pase ese</div><div class="picker">';
      h += `<button type="button" class="pick ${!e.filter ? 'on' : ''}" data-act="filter" data-v="">✕</button>`;
      for (const k of ITEM_ORDER) h += `<button type="button" class="pick ${e.filter === k ? 'on' : ''}" data-act="filter" data-v="${k}">${itemImg(k)}</button>`;
      h += '</div>';
      break;
    }
    case 'splitter': {
      const opts = [['', 'Repartir'], ['front', 'Adelante'], ['left', 'Izquierda'], ['right', 'Derecha']];
      h += `<p>${e.prio ? 'La salida elegida se llena primero; lo que no entra sigue por las otras.' : 'Reparte por turnos entre adelante, izquierda y derecha.'}</p>` +
        '<div class="pick-title">Prioridad de salida</div><div class="actions">' +
        opts.map(([v, l]) => `<button type="button" class="${(e.prio || '') === v ? 'primary' : ''}" data-act="prio" data-v="${v}">${l}</button>`).join('') + '</div>';
      break;
    }
    case 'sorter': {
      h += row('Filtro', e.filter ? itemLabel(e.filter) : 'ninguno (todo sigue derecho)');
      h += '<div class="pick-title">El objeto elegido sigue derecho; el resto sale por los costados</div><div class="picker">';
      h += `<button type="button" class="pick ${!e.filter ? 'on' : ''}" data-act="filter" data-v="">✕</button>`;
      for (const k of ITEM_ORDER) h += `<button type="button" class="pick ${e.filter === k ? 'on' : ''}" data-act="filter" data-v="${k}">${itemImg(k)}</button>`;
      h += '</div>';
      break;
    }
    case 'requesterchest': {
      const reqs = Object.entries(e.req || {});
      h += row('Guardado', `${e.total} / ${def.capacity}`);
      h += '<p class="small"><b>Pedidos</b> (los robots logísticos los traen):</p>';
      if (!reqs.length) h += '<p class="muted small">Todavía no pediste nada. Elegí un objeto abajo.</p>';
      for (const [k, n] of reqs) {
        h += `<div class="row">${itemLabel(k)}<span>${e.store[k] || 0} / ${n} ` +
          `<button type="button" class="small-btn" data-act="reqinc" data-v="${k}|-10">−</button>` +
          `<button type="button" class="small-btn" data-act="reqinc" data-v="${k}|10">+</button>` +
          `<button type="button" class="small-btn" data-act="reqdel" data-v="${k}">✕</button></span></div>`;
      }
      h += '<details class="req-pick"><summary class="small">➕ Pedir otro objeto</summary><div class="pick-grid">';
      for (const k of ITEM_ORDER) if (!FLUIDS.has(k) && !(e.req || {})[k]) h += `<button type="button" class="pick" data-act="reqadd" data-v="${k}" title="${ITEMS[k].name}">${itemImg(k)}</button>`;
      h += '</div></details>';
      h += Object.entries(e.store).map(([k, n]) => row(itemLabel(k), n)).join('') +
        '<div class="actions"><button type="button" data-act="empty">Vaciar al inventario</button></div>';
      if (!hasTech('logistic_robots')) h += '<p class="bad small">Falta investigar Robots logísticos.</p>';
      else if (!portsCovering(e.x, e.y).length) h += '<p class="bad small">Ningún puerto de robots con energía cubre este cofre.</p>';
      break;
    }
    case 'chest': case 'steelchest': case 'woodchest': case 'providerchest':
      if (e.type === 'providerchest' && !portsCovering(e.x, e.y).length) h += '<p class="bad small">Ningún puerto de robots con energía cubre este cofre.</p>';
      h += row('Guardado', `${e.total} / ${def.capacity}`) + chestPicker(e);
      break;
    case 'generator':
      h += row('Combustible', e.fuel ? itemLabel(e.fuelType, e.fuel) : '<span class="bad">vacío</span>') +
        row('Carga', Math.round((e.load || 0) * 100) + ' %') + powerRow(e) +
        fuelPicker(e, 20);
      break;
    case 'receiver':
      h += '<p>Todo lo que le llega va al inventario del Núcleo.</p>';
      break;
    case 'pipe': case 'tank': {
      const net = fnets[e._fnet];
      h += net ? row('Líquido', net.amount >= 1 ? itemLabel(net.fluid) : 'vacío') + row('Cantidad', `${Math.floor(net.amount)} / ${net.cap}`) + bar(net.amount / net.cap) +
        row('Máquinas conectadas', net.users.length) + '<div class="actions"><button type="button" data-act="drain">Vaciar la red</button></div>' : '';
      h += '<p class="muted small">Las máquinas que producen líquido lo vuelcan apuntando su flecha a una cañería. Las que lo necesitan lo toman solas si la tocan.</p>';
      break;
    }
    case 'roboport': {
      const near = S.ghosts.filter((g) => Math.max(Math.abs(wdx(g.x - e.x)), Math.abs(wdy(g.y - e.y))) <= def.range).length;
      const lb = (S.lflights || []).filter((f) => f.port === e.id).length;
      h += row('Robots de construcción', `${def.bots - (e.busy || 0)} libres de ${def.bots}`) +
        (hasTech('logistic_robots') ? row('Robots logísticos', `${LOGI_BOTS - lb} libres de ${LOGI_BOTS}`) : '') + row('Planos en su zona', near) + powerRow(e) +
        '<p class="muted small">Construyen planos, reconstruyen lo que destruyen los bichos y reparan, a 25 casillas a la redonda. Los materiales salen del inventario.</p>';
      break;
    }
    case 'signal':
      h += row('Estado', signalRed(e) ? '<span class="bad">roja: hay un tren en el tramo</span>' : '<span class="ok">verde: tramo libre</span>') +
        '<p class="muted small">Ponela en la vía para dividirla en tramos. Un tren espera en la señal hasta que el tramo de adelante esté libre. Así pueden andar varios trenes en la misma red.</p>';
      break;
    case 'station': {
      h += `<div class="net-nick"><input id="st-name" type="text" maxlength="24" value="${escapeHtml(stationName(e))}" autocomplete="off"><button type="button" class="small-btn" data-act="rename">Renombrar</button></div>`;
      h += row('Modo', e.mode === 'load' ? '<span class="ok">Carga</span>: recibe objetos y los sube al tren' : '<span class="ok">Descarga</span>: baja lo del tren y lo suelta por la flecha') +
        row('Guardado', `${e.total} / ${STATION_CAP}`) + Object.entries(e.store).map(([k, n]) => row(itemLabel(k), n)).join('') +
        `<div class="actions"><button type="button" data-act="mode">Cambiar a ${e.mode === 'load' ? 'Descarga' : 'Carga'}</button></div>` +
        '<p class="muted small">El tren también carga carbón o combustible sólido de cualquier estación.</p>';
      break;
    }
    case 'train': {
      const st = S.entities.find((s) => s.id === e.target);
      h += row('Estado', e.state === 'moving' ? (e.blocked ? 'esperando vía libre (señal o tren adelante)' : 'en viaje') : e.state === 'waiting' ? 'cargando/descargando' : '<span class="bad">sin estaciones en su vía</span>') +
        row('Destino', st ? `${escapeHtml(stationName(st))} (${st.mode === 'load' ? 'carga' : 'descarga'})` : '—') +
        row('Combustible', e.fuel ? itemLabel(e.fuelType, e.fuel) : (e.energy > 0 ? 'quemando' : '<span class="bad">vacío: va muy despacio</span>')) +
        row('Carga', `${e.total} / ${TRAIN_CAP}`) + Object.entries(e.cargo).map(([k, n]) => row(itemLabel(k), n)).join('') +
        '<div class="actions"><button type="button" data-act="tfuel">Cargar carbón</button><button type="button" data-act="tremove">🗑️ Desarmar tren</button></div>';
      // Horario
      const stations = S.entities.filter((s) => s.type === 'station');
      const sch = e.schedule || [];
      h += '<p class="small"><b>Horario</b> ' + (sch.length ? '' : '<span class="muted">(vacío: recorre todas las estaciones de su red)</span>') + '</p>';
      const W_OPTS = [['time:5', 'esperar 5 s'], ['time:15', 'esperar 15 s'], ['time:30', 'esperar 30 s'], ['time:60', 'esperar 60 s'], ['full', 'hasta llenarse'], ['empty', 'hasta vaciarse']];
      sch.forEach((s, i) => {
        const wv = s.w === 'time' ? 'time:' + (s.s || 10) : s.w;
        h += `<div class="sched-row${(e.si || 0) === i ? ' on' : ''}"><span>${i + 1}.</span>` +
          `<select data-sched="st" data-i="${i}">${stations.map((x) => `<option value="${x.id}"${x.id === s.st ? ' selected' : ''}>${escapeHtml(stationName(x))}</option>`).join('')}</select>` +
          `<select data-sched="w" data-i="${i}">${W_OPTS.map(([v, l]) => `<option value="${v}"${v === wv ? ' selected' : ''}>${l}</option>`).join('')}</select>` +
          `<button type="button" class="small-btn" data-act="tsdel" data-v="${i}">✕</button></div>`;
      });
      h += stations.length ? '<div class="actions"><button type="button" class="small-btn" data-act="tsadd">➕ Agregar parada</button></div>' : '<p class="muted small">Poné estaciones para armar un horario.</p>';
      return h;
    }
    case 'offshore':
      h += row('Saca', `${itemImg('water', 'ico-s')} 2 de agua por segundo, sin fin`) +
        (e.buf ? row('Estado', '<span class="bad">Salida bloqueada</span>') : '');
      break;
    case 'boiler':
      h += row('Agua', `${e.water} / 20`) +
        row('Combustible', e.fuel ? itemLabel(e.fuelType, e.fuel) : '<span class="bad">vacío</span>') +
        row('Vapor listo', e.out) + row('Estado', e.active ? '<span class="ok">hirviendo</span>' : e.water ? 'esperando combustible' : '<span class="bad">sin agua</span>') +
        fuelPicker(e, 20);
      break;
    case 'steam_engine':
      h += row('Vapor', `${e.steam} / 10`) + row('Carga', Math.round((e.load || 0) * 100) + ' %') + powerRow(e) +
        '<p class="muted small">El vapor que sobra pasa a la siguiente máquina por la flecha.</p>';
      break;
    case 'radar':
      h += row('Explorado', `${Math.min(e.r, BUILDINGS.radar.scan * POLL_CELL)} de ${BUILDINGS.radar.scan * POLL_CELL} casillas de radio`) + powerRow(e);
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
    case 'fusion_plant':
      h += row('Genera', `${BUILDINGS.fusion_plant.output / 1000} MW, sin combustible y sin polución`) + powerRow(e);
      break;
    case 'purifier': {
      const cell = cellOf(e.x + 1, e.y + 1);
      h += row('Filtros', `${e.filters} (+${Math.max(0, Math.round(e.left))} de polución en el actual)`) +
        row('Limpiando', `${(e.rate || 0).toFixed(1)} por segundo`) + row('Polución en la zona', Math.round(pollution[cell])) + powerRow(e) +
        '<div class="actions"><button type="button" data-act="pfeed">Cargar filtros</button></div>';
      break;
    }
    case 'uplink': {
      const c = cleanupProgress();
      h += row('Cargas orbitales', `${e.charges} / 10`) + row('Recarga', e.cd > 0 ? `${Math.ceil(e.cd)} s` : 'lista') +
        row('Nidos en el planeta', c.nests) + row('Ataques hechos', S.strikes || 0) + powerRow(e) +
        '<div class="actions"><button type="button" data-act="ufeed">Cargar cargas orbitales</button></div>';
      break;
    }
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
    case 'shipyard': case 'starport': {
      const needs = shipNeeds(e);
      h += `<p>Piezas ${e.type === 'starport' ? 'del Arca estelar' : 'de la nave'}:</p>`;
      for (const k in needs) {
        const have = e.parts[k] || 0;
        h += `<div class="row">${itemLabel(k)}<span>${have} / ${needs[k]}</span></div>` + bar(have / needs[k]);
      }
      h += '<div class="actions"><button type="button" data-act="transfer">Transferir del inventario</button>';
      if (shipReady(e)) h += '<button type="button" class="primary" data-act="launch">🚀 ¡Despegar!</button>';
      h += '</div>';
      break;
    }
  }
  if (e.type === 'sensor') {
    const v = e.value || 0;
    h += row('Lee', `${v}`) + row('Canal', `<span class="sig-dot" style="background:${SIGNAL_COLORS[e.ch || 0]}"></span>${SIGNAL_NAMES[e.ch || 0]} = ${signals[e.ch || 0]}`);
    h += '<div class="pick-title">Canal</div><div class="picker">' + SIGNAL_COLORS.map((c, i) => `<button type="button" class="pick sig${(e.ch || 0) === i ? ' on' : ''}" data-act="sch" data-v="${i}" title="${SIGNAL_NAMES[i]}"><span class="sig-dot" style="background:${c}"></span></button>`).join('') + '</div>';
    const [dx, dy] = DIRS[e.dir];
    const t = at(e.x + dx, e.y + dy);
    const opts = t ? sensorOptions(t) : [];
    h += '<div class="pick-title">Qué lee</div><div class="picker">' +
      `<button type="button" class="pick${(e.item || '*') === '*' ? ' on' : ''}" data-act="sitem" data-v="*" title="Todo">Σ</button>` +
      opts.map((k) => `<button type="button" class="pick${e.item === k ? ' on' : ''}" data-act="sitem" data-v="${k}" title="${ITEMS[k].name}">${itemImg(k)}</button>`).join('') + '</div>';
    h += `<p class="muted small">${t ? `Apunta a: ${t.type === 'hub' ? 'Núcleo' : BUILDINGS[t.type].name}. Girá el sensor (R) para cambiar.` : 'No apunta a nada: girá el sensor (R) hacia un cofre, el Núcleo, un tanque o un acumulador.'}</p>`;
  }
  if (CONDITIONABLE.has(e.type) && hasTech('signal_network')) {
    const c = e.cond;
    h += '<div class="pick-title">Condición (red de señales)</div>';
    h += `<div class="cond-row"><select data-cond="ch"><option value="-1"${c ? '' : ' selected'}>Siempre encendido</option>${SIGNAL_NAMES.map((n, i) => `<option value="${i}"${c && c.ch === i ? ' selected' : ''}>Canal ${n}</option>`).join('')}</select>`;
    if (c) {
      h += `<select data-cond="op">${['<', '>', '='].map((o) => `<option${c.op === o ? ' selected' : ''}>${o}</option>`).join('')}</select>` +
        `<input type="number" data-cond="v" value="${c.v}" min="0" step="1"></div>` +
        `<div class="muted small">Ahora: canal ${SIGNAL_NAMES[c.ch]} = ${signals[c.ch]} → ${e.off ? '<span class="bad">apagado</span>' : '<span class="ok">encendido</span>'}</div>`;
    } else h += '</div>';
  }
  if (MODULE_SLOTS[e.type] && hasTech('modules')) {
    const mods = e.modules || [];
    h += `<div class="pick-title">Módulos (${mods.length}/${MODULE_SLOTS[e.type]})</div><div class="picker">`;
    mods.forEach((m, i) => { h += `<button type="button" class="pick on" data-act="unmod" data-v="${i}" title="Sacar ${ITEMS[m].name}">${itemImg(m)}</button>`; });
    if (mods.length < MODULE_SLOTS[e.type]) {
      for (const m of Object.keys(MODULES)) {
        const n = Math.floor(avail(m));
        h += `<button type="button" class="pick" data-act="mod" data-v="${m}" ${n ? '' : 'disabled'} title="Poner ${ITEMS[m].name} (tenés ${n})">+${itemImg(m)}</button>`;
      }
    }
    h += '</div>';
    const fx = moduleFx(e);
    if (mods.length) h += `<div class="muted small">Velocidad ${Math.round(fx.speed * 100)} % · Consumo ${Math.round(fx.power * 100)} %${fx.prod ? ` · Productividad +${Math.round(fx.prod * 100)} %` : ''}</div>`;
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
  // No redibujar mientras se elige en un desplegable o se escribe
  const ae = document.activeElement;
  if (ae && $('inspector').contains(ae) && (ae.tagName === 'SELECT' || ae.tagName === 'INPUT')) return;
  const h = inspectorContent(inspected);
  if (h !== inspectorHtml) {
    inspectorHtml = h;
    $('inspector').innerHTML = h;
  }
}

function moveToInv(item, n) { giveItem(item, n); }

// Fila para elegir QUÉ cargar: los objetos que tenés, con su cantidad.
// Los que la máquina no acepta ahora salen apagados.
function pickRow(e, title, items, max, hint) {
  const mine = items.filter((k) => avail(k) >= 1);
  let h = `<div class="pick-title">${title} <span class="muted">(tocá el que quieras)</span></div>`;
  if (!mine.length) return h + `<p class="muted small">No tenés ${items.map((k) => ITEMS[k].name.toLowerCase()).slice(0, 4).join(', ')}${items.length > 4 ? '…' : ''}.</p>`;
  let off = false;
  h += '<div class="picker">' + mine.map((k) => {
    const ok = accept(e, k, null, true);
    if (!ok) off = true;
    return `<button type="button" class="pick stack" data-act="put" data-v="${k}" data-max="${max}" ${ok ? '' : 'disabled'} title="${ITEMS[k].name}">${itemImg(k)}<span class="n">${fmt(avail(k))}</span></button>`;
  }).join('') + '</div>';
  if (off && hint) h += `<p class="muted small">${hint}</p>`;
  return h;
}

function fuelPicker(e, max) {
  return pickRow(e, 'Cargar combustible', ['coal', 'wood', 'solid_fuel'], max,
    'No se mezclan combustibles distintos y hay un máximo: si querés otro, sacá el que tiene.') +
    (e.fuel ? '<div class="actions"><button type="button" data-act="unfuel">Sacar combustible</button></div>' : '');
}

// Contenido de un cofre (tocá para sacar) y lo que tenés para poner
function chestPicker(e) {
  const def = BUILDINGS[e.type];
  const inside = Object.entries(e.store).filter(([, n]) => n > 0);
  let h = '<div class="pick-title">Adentro <span class="muted">(tocá para sacar' + (isTouch() ? '' : ' o arrastrá a tu inventario') + ')</span></div>';
  h += inside.length
    ? '<div class="picker">' + inside.map(([k, n]) => `<button type="button" class="pick stack" data-act="ctake" data-v="${k}" data-drag="${k}" title="Sacar ${ITEMS[k].name}">${itemImg(k)}<span class="n">${fmt(n)}</span></button>`).join('') + '</div>'
    : '<p class="muted small">Vacío.</p>';
  const mine = ITEM_ORDER.filter((k) => !FLUIDS.has(k) && avail(k) >= 1);
  h += '<div class="pick-title">Poner <span class="muted">(tocá un objeto tuyo' + (isTouch() ? '' : ' o arrastralo acá') + ')</span></div>';
  h += mine.length && e.total < def.capacity
    ? '<div class="picker">' + mine.map((k) => `<button type="button" class="pick stack" data-act="cput" data-v="${k}" title="Poner ${ITEMS[k].name}">${itemImg(k)}<span class="n">${fmt(avail(k))}</span></button>`).join('') + '</div>'
    : `<p class="${e.total >= def.capacity ? 'muted' : 'bad'} small">${e.total >= def.capacity ? 'El cofre está lleno.'
      : usePocket() && !nearStorage() ? 'Tu mochila está vacía. Lejos del Núcleo solo podés usar lo que llevás encima: acercate al Núcleo y pasá cosas a la mochila (tocándolas en el panel de inventario).'
        : 'No tenés objetos para poner.'}</p>`;
  if (mine.length && usePocket() && !nearStorage()) h += '<p class="muted small">Lejos del Núcleo se usa solo lo que llevás en la mochila.</p>';
  if (inside.length) h += '<div class="actions"><button type="button" data-act="empty">Vaciar todo al inventario</button></div>';
  return h;
}

// Poner objetos de tu inventario en un edificio (cofre o máquina)
function depositTo(e, k, max = Infinity) {
  if (!e || !k || avail(k) < 1) return 0;
  const def = BUILDINGS[e.type];
  if (def && def.capacity && e.store) {
    const n = Math.min(Math.floor(avail(k)), def.capacity - e.total, max);
    if (n <= 0) return 0;
    takeItem(k, n); add(e.store, k, n); e.total += n;
    return n;
  }
  return feedFrom(e, [k], Math.min(max, 50));
}

// Sacar un tipo de objeto de un edificio hacia tu inventario
function withdrawFrom(e, k) {
  if (!e || !k) return 0;
  if (e.store && e.store[k]) { const n = e.store[k]; delete e.store[k]; e.total -= n; giveItem(k, n); return n; }
  if (e.outType === k && e.outCount) { const n = e.outCount; e.outCount = 0; e.outType = null; giveItem(k, n); return n; }
  if (e.recipe && RECIPES[e.recipe].out === k && e.out) { const n = e.out; e.out = 0; giveItem(k, n); return n; }
  if (e.fuelType === k && e.fuel) { const n = e.fuel; e.fuel = 0; e.fuelType = null; giveItem(k, n); return n; }
  if (e.inType === k && e.inCount) { const n = e.inCount; e.inCount = 0; e.inType = null; e.prog = 0; giveItem(k, n); return n; }
  return 0;
}

// Pasa objetos del inventario a un edificio usando su propia lógica de entrada
function feedFrom(e, items, max) {
  let n = 0;
  for (const k of items) {
    while (n < max && avail(k) >= 1 && accept(e, k, null)) { takeItem(k, 1); n++; }
  }
  return n;
}

// Condición de la red de señales
$('inspector').addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-cond]');
  if (!el || !inspected || inspected.type === 'train') return;
  const e = inspected;
  if (el.dataset.cond === 'ch') {
    const ch = +el.value;
    e.cond = ch < 0 ? null : { ch, op: (e.cond && e.cond.op) || '<', v: (e.cond && e.cond.v) || 100 };
    if (!e.cond) { e.off = false; delete e.cond; }
  } else if (e.cond && el.dataset.cond === 'op') e.cond.op = ['<', '>', '='].includes(el.value) ? el.value : '<';
  else if (e.cond && el.dataset.cond === 'v') e.cond.v = Math.max(0, Math.round(+el.value || 0));
  netTouch(e);
  el.blur();
  updateInspector();
});

// Desplegables del horario de un tren
$('inspector').addEventListener('change', (ev) => {
  const sel = ev.target.closest('select[data-sched]');
  if (!sel || !inspected || inspected.type !== 'train') return;
  const t = inspected, s = t.schedule && t.schedule[+sel.dataset.i];
  if (!s) return;
  if (sel.dataset.sched === 'st') s.st = +sel.value;
  else if (sel.value.startsWith('time:')) { s.w = 'time'; s.s = +sel.value.slice(5); } else { s.w = sel.value; delete s.s; }
  t._path = null; t.state = 'idle';
  netTrainSchedule(t);
  updateInspector();
});

// pointerdown: el panel se redibuja seguido y un 'click' se podría perder
$('inspector').addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  const b = ev.target.closest('[data-act]');
  if (!b || !inspected) return;
  const e = inspected;
  const v = b.dataset.v;
  // Mover objetos o desarmar exige estar cerca
  const NEEDS_REACH = ['pfeed', 'ufeed', 'remove', 'fuel', 'gfuel', 'feed', 'labfeed', 'ammo', 'collect', 'empty', 'transfer', 'mod', 'unmod', 'tfuel', 'tremove'];
  if (NEEDS_REACH.includes(b.dataset.act) && !inReach(Math.floor(e.x), Math.floor(e.y))) {
    toast('Está lejos: el personaje va para allá.');
    stopPlayerTasks();
    walkTo(Math.floor(e.x), Math.floor(e.y), REACH - 2);
    return;
  }
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
    case 'rename': { const v2 = ($('st-name') && $('st-name').value || '').replace(/[<>]/g, '').trim().slice(0, 24); if (v2) e.name = v2; break; }
    case 'tsadd': {
      const st = S.entities.find((s) => s.type === 'station');
      if (st) { e.schedule = e.schedule || []; e.schedule.push({ st: st.id, w: 'time', s: 15 }); netTrainSchedule(e); }
      break;
    }
    case 'tsdel': if (e.schedule) { e.schedule.splice(+v, 1); e.si = 0; e._path = null; e.state = 'idle'; netTrainSchedule(e); } break;
    case 'sch': e.ch = Math.max(0, Math.min(7, +v | 0)); break;
    case 'sitem': e.item = v === '*' || ITEMS[v] ? v : '*'; break;
    case 'reqadd': e.req = e.req || {}; if (v && ITEMS[v]) e.req[v] = 50; break;
    case 'reqinc': { const [k, d] = String(v).split('|'); if (e.req && e.req[k] !== undefined) e.req[k] = Math.max(1, Math.min(400, e.req[k] + +d)); break; }
    case 'reqdel': if (e.req) delete e.req[v]; break;
    case 'mode': e.mode = e.mode === 'load' ? 'unload' : 'load'; break;
    case 'prio': e.prio = v || null; break;
    case 'drain': emptyFluidNet(e); break;
    case 'mod':
      if (avail(v) >= 1 && (e.modules || []).length < MODULE_SLOTS[e.type]) { takeItem(v, 1); (e.modules = e.modules || []).push(v); }
      break;
    case 'unmod':
      if (e.modules && e.modules[+v]) { giveItem(e.modules[+v], 1); e.modules.splice(+v, 1); }
      break;
    case 'tfuel': {
      const k = e.fuelType || (avail('solid_fuel') >= 1 && avail('coal') < 1 ? 'solid_fuel' : 'coal');
      const n = Math.min(Math.floor(avail(k)), 10 - e.fuel);
      if (n > 0) { takeItem(k, n); e.fuel += n; e.fuelType = k; } else toast('No tenés carbón.');
      break;
    }
    case 'tremove': removeTrain(e); closeInspector(); updateUI(); return;
    case 'fuel': {
      const n = feedFrom(e, ['coal', 'solid_fuel', 'wood'], 10);
      if (!n) toast(e.fuel >= 10 ? 'Ya está lleno de combustible.' : 'No tenés carbón ni madera en el inventario.');
      break;
    }
    case 'unfuel':
      if (e.fuel) { giveItem(e.fuelType, e.fuel); e.fuel = 0; e.fuelType = null; }
      break;
    case 'ctake': withdrawFrom(e, v); break;
    case 'put': {
      const n = depositTo(e, v, +b.dataset.max || 50);
      if (!n) toast('No acepta más de eso.');
      break;
    }
    case 'cput': if (!depositTo(e, v)) toast('No entra más.'); break;
    case 'gfuel': {
      const n = feedFrom(e, ['coal', 'solid_fuel', 'wood'], 20);
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
    case 'pfeed':
      if (!feedFrom(e, ['air_filter'], 20)) toast('No tenés filtros de aire. Se fabrican en una ensambladora (carbón + plástico + acero).');
      break;
    case 'ufeed':
      if (!feedFrom(e, ['orbital_charge'], 10)) toast('No tenés cargas orbitales. Se fabrican en una ensambladora avanzada.');
      break;
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
      const needs = shipNeeds(e);
      for (const k in needs) {
        const n = Math.min(Math.floor(avail(k)), needs[k] - (e.parts[k] || 0));
        if (n > 0) { takeItem(k, n); add(e.parts, k, n); moved += n; }
      }
      toast(moved ? `Transferiste ${moved} piezas.` : 'No tenés piezas en el inventario.');
      break;
    }
    case 'launch':
      if (shipReady(e)) { closeInspector(); startLaunch(e); }
      return;
  }
  if (e.type !== 'train') netTouch(e);   // en línea: los demás ven el cambio
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
    const units = techUnits(cur);
    const left = (units - S.research.progress) * t.time / Math.max(1, labs) / labSpeedMult();
    top = `<div class="research-now"><b>Investigando: ${techName(cur)}</b> · ${S.research.progress}/${units} ${bar(S.research.progress / units)}` +
      `<span class="muted small">${labs ? `${labs} laboratorio${labs > 1 ? 's' : ''} · faltan unos ${Math.ceil(left / 60)} min si no les falta ciencia` : 'No tenés laboratorios.'}</span></div>`;
  }
  let h = '';
  for (const id of TECH_ORDER) {
    const t = TECHS[id];
    const done = !t.infinite && !!S.techs[id];
    const avail = techAvailable(id);
    const state = done ? 'done' : id === cur ? 'current' : avail ? 'avail' : 'locked';
    h += `<div class="tech ${state}">
      <div class="tech-head"><b>${t.infinite ? `♾️ ${techName(id)}` : t.name}</b>${done ? '<span class="ok">✔</span>' : ''}${t.infinite && infLevel(id) ? `<span class="ok small">nivel ${infLevel(id)} hecho</span>` : ''}</div>
      <div class="tech-desc">${t.desc}</div>
      <div class="tech-unlocks">${techUnlocksHtml(id)}</div>
      ${t.stage && stageOf() < t.stage ? `<div class="muted small">🔒 Se desbloquea en la etapa ${t.stage}: ${STAGES[t.stage - 1].name}</div>` : ''}
      ${t.req.length && !done ? `<div class="muted small">Requiere: ${t.req.map((r) => `<span class="${S.techs[r] ? 'ok' : ''}">${TECHS[r].name}</span>`).join(', ')}</div>` : ''}
      ${done ? '' : `<div class="tech-cost">${t.packs.map((p) => itemImg(p, 'ico-s')).join('')} × ${techUnits(id)} <span class="muted">(${t.time} s c/u)</span></div>
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
  toast(`🔬 Ahora investigás <b>${techName(b.dataset.tech)}</b>`);
  researchHtml = '';
  renderResearch();
  updateTopbar();
});

// --------------------------- Modales ---------------------------

function openModal(id) {
  closeModals();
  $(id).hidden = false;
  if (id === 'research') { researchHtml = ''; renderResearch(); }
  if (id === 'stats') { renderStats(); renderChartPicker(); renderChart(); }
  if (id === 'ach') renderAchievements();
  if (id === 'online') netRenderModal();
  if (id === 'planos') renderBlueprints();
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
  $('stats-summary').innerHTML =
    `<p>⏱️ <b>${Math.floor(S.playTime / 60)} min</b> · 🏭 <b>${S.entities.length - 1 - nests}</b> edificios · ⚡ <b>${Math.round(d)} / ${Math.round(c)} kW</b>` +
    (S.peaceful ? '' : ` · 🐛 evolución <b>${(S.evo * 100).toFixed(1)} %</b> · nidos <b>${nests}</b> · ☁️ polución <b>${fmt(totalPollution())}</b>`) + '</p>';
  $('stats-body').innerHTML =
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

// Qué hay en una casilla del suelo (mineral, agua, árbol), para el cartelito
function groundInfo(x, y, touch) {
  if (!tileExplored(x, y)) return '<b>Sin explorar</b><br><span class="muted">Construí cerca o poné un radar</span>';
  const o = oreAt(x, y);
  if (o === 'water') return '<b>Agua</b><br><span class="muted">Poné una bomba de agua en la orilla</span>';
  if (o === 'oil') return `<b>${ITEMS[o].name}</b><br>Rinde: <b>${fmt(oreAmountAt(x, y))}</b><br><span class="muted">Necesita una bomba de petróleo</span>`;
  if (o) {
    const v = veinInfo(x, y);
    return `<b>${ITEMS[o].name}</b><br>Para minar acá: <b>${fmt(oreAmountAt(x, y))}</b>` +
      (v.tiles > 1 ? `<br>En toda la veta: <b>${fmt(v.total)}</b> <span class="muted">(${v.tiles} casillas)</span>` : '') +
      `<br><span class="muted">${touch ? (playerOn() ? 'Tu personaje va a picar' : 'Mantené apretado para extraer') : 'Mantené clic para extraer'}</span>`;
  }
  if (treeAt(x, y)) return `<b>Árbol</b><br>Da <b>${WOOD_PER_TREE}</b> de madera<br><span class="muted">${playerOn() ? (touch ? 'Tu personaje lo va a talar' : 'Clic para talar') : 'Mantené apretado para talar'}. Absorbe polución.</span>`;
  return '';
}

// Total de una veta (las casillas vecinas con el mismo mineral). Se recuerda
// qué casillas forman cada veta y la suma se hace en el momento.
let veinCache = new Map(), veinCacheOf = null;
function veinInfo(x, y) {
  if (veinCacheOf !== oreType) { veinCache = new Map(); veinCacheOf = oreType; }
  const start = tIdx(x, y);
  let v = veinCache.get(start);
  if (!v) {
    const type = oreType[start], idxs = [], seen = new Set([start]), stack = [[wrapX(x), wrapY(y)]];
    while (stack.length && idxs.length < 30000) {
      const [cx, cy] = stack.pop();
      idxs.push(tIdx(cx, cy));
      for (const [dx, dy] of DIRS) {
        const nx = wrapX(cx + dx), ny = wrapY(cy + dy), ni = tIdx(nx, ny);
        if (!seen.has(ni) && oreType[ni] === type) { seen.add(ni); stack.push([nx, ny]); }
      }
    }
    v = { idxs };
    for (const i of idxs) veinCache.set(i, v);
  }
  let total = 0, tiles = 0;
  for (const i of v.idxs) if (oreAmt[i] > 0) { total += oreAmt[i]; tiles++; }
  return { total, tiles };
}

// En táctil: al tocar el suelo con la mano aparece un globito unos segundos
let tapInfo = null;
function showTapInfo(t) {
  if (at(t.x, t.y)) { tapInfo = null; return; }
  tapInfo = { x: t.x, y: t.y, until: performance.now() + 4000 };
  updateTooltip();
}

// Cartel de un botón de la barra de abajo (con mouse)
let barTip = null;
$('toolbar').addEventListener('pointerover', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  const b = ev.target.closest('[data-tool]');
  barTip = b ? b.dataset.tool : null;
  updateTooltip();
});
$('toolbar').addEventListener('pointerleave', () => { barTip = null; updateTooltip(); });

function updateTooltip() {
  const el = $('tooltip');
  let html = '';
  if (barTip && BUILDINGS[barTip] && !isTouch()) {
    const d = BUILDINGS[barTip];
    const miss = missingText(d.cost);
    el.innerHTML = `<b>${d.name}</b>${keyOf(barTip) !== '' ? ` <kbd>${keyOf(barTip)}</kbd>` : ''}<br><span class="muted">${d.desc}</span>` +
      `<div class="tip-cost">Pide: ${costHtml(d.cost, true)}</div>` + (miss ? `<span class="bad">Te falta: ${miss}</span>` : '');
    el.hidden = false;
    const r = (toolButtons[barTip] || $('toolbar')).getBoundingClientRect();
    const tw = el.offsetWidth, th = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, cw - tw - 8)) + 'px';
    el.style.top = Math.max(8, r.top - th - 10) + 'px';
    return;
  }
  if (tapInfo && isTouch() && performance.now() < tapInfo.until && !launchAnim) {
    html = groundInfo(tapInfo.x, tapInfo.y, true);
    if (html) {
      el.innerHTML = html;
      el.hidden = false;
      // Pegado a la casilla aunque la cámara se mueva
      const sx = (wdx(tapInfo.x + 0.5 - view.x / TILE) * TILE) * view.zoom + cw / 2;
      const sy = (wdy(tapInfo.y + 0.5 - view.y / TILE) * TILE) * view.zoom + ch / 2;
      const tw = el.offsetWidth, th = el.offsetHeight, gap = TILE * view.zoom * 0.6 + 6;
      el.style.left = Math.max(8, Math.min(sx - tw / 2, cw - tw - 8)) + 'px';
      el.style.top = Math.max(8, Math.min(sy - th - gap > 70 ? sy - th - gap : sy + gap, ch - th - 100)) + 'px';
      return;
    }
  }
  if (tapInfo && performance.now() >= tapInfo.until) tapInfo = null;
  if (hover && !panning && !launchAnim && !isTouch()) {
    if (tool === 'hand') {
      const e = at(hover.x, hover.y);
      if (!tileExplored(hover.x, hover.y)) html = groundInfo(hover.x, hover.y, false);
      else if (e && e.type === 'nest') html = '<b>Nido enemigo</b><br><span class="muted">Destruilo con torretas cerca</span>';
      else if (e) html = `<b>${e.type === 'hub' ? 'Núcleo' : BUILDINGS[e.type].name}</b><br><span class="muted">Clic para ver detalles</span>`;
      else html = groundInfo(hover.x, hover.y, false);
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

// Cartel de cada etapa (y del final)
function showStage(n) {
  sfx('win');
  if (n === 2) {
    $('win-title').textContent = '🚀 ¡Llegaste al espacio!';
    $('win-text').innerHTML = '<p>La nave está en órbita y ahora es una <b>estación espacial</b>: desde ahí ves <b>todo el planeta</b>.</p>' +
      `<p><b>Etapa 2 de 3: limpiar el planeta.</b> ${S.peaceful ? 'Dejá el aire limpio' : 'Borrá todos los nidos con ataques orbitales y dejá el aire limpio'} (polución total menor a ${CLEAN_TARGET} durante 5 minutos). Hay investigaciones nuevas.</p>`;
  } else {
    $('win-title').textContent = '🌱 ¡El planeta está limpio!';
    $('win-text').innerHTML = '<p>Sin nidos y con el aire limpio, el planeta respira de nuevo.</p>' +
      '<p><b>Etapa 3 de 3: escapar del sistema solar.</b> Superconductores, ciencia estelar, fusión y motores de curvatura para armar el <b>Arca estelar</b>.</p>';
  }
  $('win-stats').innerHTML = '';
  openModal('win');
}

function showWin(final = true) {
  sfx('win');
  $('win-title').textContent = final ? '🌌 ¡Escapaste del sistema solar!' : '🚀 ¡Otra nave en órbita!';
  $('win-text').innerHTML = final
    ? '<p>El Arca estelar encendió los motores de curvatura y dejó atrás el sistema solar. Empezaste sin nada y terminaste cruzando las estrellas.</p><p class="muted">Podés seguir jugando, expandir la fábrica y armar otra arca.</p>'
    : '<p>La estación en órbita suma otra nave.</p>';
  const total = Object.values(S.produced).reduce((a, b) => a + b, 0);
  const t = S.stageTimes || {};
  const hm = (sec) => `${Math.floor(sec / 3600)} h ${String(Math.floor(sec / 60) % 60).padStart(2, '0')} min`;
  $('win-stats').innerHTML = (final && t[1] ? `<p>🚀 Espacio: <b>${hm(t[1])}</b>${t[2] ? ` · 🌱 Planeta limpio: <b>${hm(t[2])}</b>` : ''}${t[3] ? ` · 🌌 Arca: <b>${hm(t[3])}</b>` : ''}</p>` : '') +
    `<p>⏱️ Tiempo: <b>${Math.floor(S.playTime / 60)} min</b><br>🏭 Edificios: <b>${S.entities.length - 1 - countType('nest')}</b><br>` +
    `📦 Objetos producidos: <b>${fmt(total)}</b><br>🔬 Investigaciones: <b>${Object.keys(S.techs).length}/${TECH_ORDER.length}</b></p>`;
  openModal('win');
}

function updateUI() {
  netUpdateChip();
  updateToolbar();
  updateTopbar();
  if (getComputedStyle($('side')).display !== 'none') updateSide();
  updateInspector();
  updateTooltip();
  updateConfirm();
  if (!$('stats').hidden) { renderStats(); renderChart(); }
  if (!$('research').hidden) renderResearch();
}

// Qué puede leer un sensor según el edificio al que apunta
function sensorOptions(t) {
  if (t.type === 'hub') return ITEM_ORDER.filter((k) => (S.inv[k] || 0) >= 1).slice(0, 40);
  if (t.store) return Object.keys(t.store);
  if (t.parts) return Object.keys(shipNeeds(t));
  if (t.type === 'pipe' || t.type === 'tank') return [...FLUIDS];
  if (t.l) return [...new Set(t.l.filter(Boolean))];
  return [];
}
