'use strict';
// =====================================================================
//  Entrada: mouse, pantalla táctil y teclado
//
//  Mouse: clic construye, arrastrar traza cintas o elige áreas.
//  Táctil: un toque muestra la vista previa y el segundo construye;
//  las cintas van de un toque de inicio a uno de fin; arrastrar mueve la cámara.
// =====================================================================

const HAND_MINE_TIME = 0.6;
const mouse = { x: 0, y: 0 };
let tool = 'hand';
let toolDir = 0;
let hover = null;
let pointerType = 'mouse';
let panning = null;      // { x, y }
let dragging = null;     // arrastre con mouse: { x, y, placed }
let deleting = false;    // clic derecho sostenido
let handMining = null;   // { x, y, prog }
let downAt = null;       // inicio del toque/clic
const pointers = new Map();
let pinch = null;
const keys = new Set();

// Planes en curso
let pending = null;      // táctil: fantasma de un edificio esperando el segundo toque { x, y }
let beltPlan = null;     // { a: {x,y}, b: {x,y} | null, flip }
let area = null;         // { mode: 'delete' | 'copy', a, b }
let clipboard = null;    // { items: [...], w, h }
let pastePos = null;     // táctil: dónde se va a pegar

const isTouch = () => pointerType !== 'mouse';
const sameTile = (a, b) => a && b && wrapX(a.x) === wrapX(b.x) && wrapY(a.y) === wrapY(b.y);
const anchorFor = (type, t) => { const s = sizeOf(type); return { x: t.x - Math.floor(s / 2), y: t.y - Math.floor(s / 2) }; };
const isLineTool = (t) => isBelt(t) || t === 'rail';

function screenToWorld(sx, sy) {
  return { x: (sx - cw / 2) / view.zoom + view.x, y: (sy - ch / 2) / view.zoom + view.y };
}
function screenToTile(sx, sy) {
  const w = screenToWorld(sx, sy);
  return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
}

// El mapa da la vuelta: la cámara se mantiene dentro de una copia del mapa
function clampView() {
  if (launchAnim) return;
  const mw = W * TILE, mh = H * TILE;
  view.x = ((view.x % mw) + mw) % mw;
  view.y = ((view.y % mh) + mh) % mh;
}
// Zoom mínimo: nunca se ve más que un mapa entero
const minZoom = () => Math.max(0.1, cw / (W * TILE), ch / (H * TILE));

function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  view.zoom = Math.min(2.5, Math.max(minZoom(), view.zoom * factor));
  view.x = before.x - (sx - cw / 2) / view.zoom;
  view.y = before.y - (sy - ch / 2) / view.zoom;
  clampView();
}

function dirBetween(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 1 && !dy) return 0;
  if (!dx && dy === 1) return 1;
  if (dx === -1 && !dy) return 2;
  if (!dx && dy === -1) return 3;
  return -1;
}

function clearPlans() {
  pending = null; beltPlan = null; area = null; pastePos = null;
  updateConfirm();
}

// --------------------------- Cintas de punto a punto ---------------------------

// Camino en L: primero horizontal y después vertical (o al revés con flip)
function beltPath(a, b, flip) {
  b = { x: a.x + wdx(b.x - a.x), y: a.y + wdy(b.y - a.y) };   // por el lado corto del mapa
  const pts = [];
  let x = a.x, y = a.y;
  pts.push({ x, y });
  const stepX = () => { while (x !== b.x) { x += Math.sign(b.x - x); pts.push({ x, y }); } };
  const stepY = () => { while (y !== b.y) { y += Math.sign(b.y - y); pts.push({ x, y }); } };
  if (flip) { stepY(); stepX(); } else { stepX(); stepY(); }
  for (let i = 0; i < pts.length; i++) {
    if (i < pts.length - 1) pts[i].dir = dirBetween(pts[i], pts[i + 1]);
    else pts[i].dir = pts.length > 1 ? pts[i - 1].dir : toolDir;
  }
  return pts;
}

function buildBeltPlan() {
  if (!beltPlan || !beltPlan.b) return;
  const pts = beltPath(beltPlan.a, beltPlan.b, beltPlan.flip);
  beginBatch();
  let ok = 0, fail = 0;
  for (const p of pts) (placeOrGhost(tool, p.x, p.y, p.dir) ? ok++ : fail++);
  endBatch();
  toolDir = pts[pts.length - 1].dir;
  if (ok) sfx('place');
  if (fail) toast(`Se construyeron ${ok} de ${pts.length} cintas. ${canAfford(BUILDINGS[tool].cost) ? 'Algunas casillas estaban ocupadas.' : 'Faltan materiales.'}`);
  beltPlan = null;
  updateConfirm();
  updateUI();
}

// --------------------------- Áreas: desarmar y copiar ---------------------------

function rectOf(a, b) {
  b = { x: a.x + wdx(b.x - a.x), y: a.y + wdy(b.y - a.y) };
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

function entitiesIn(r) {
  const set = new Set();
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const e = at(x, y);
    if (e && e.type !== 'hub' && e.type !== 'nest') set.add(e);
  }
  return [...set];
}

function deleteArea(r) {
  const ghosts = removeGhostsIn(r);
  if (ghosts) toast(`Cancelaste ${ghosts} plano${ghosts > 1 ? 's' : ''}.`);
  const list = entitiesIn(r);
  beginBatch();
  for (const e of list) userRemove(e);
  endBatch();
  if (list.length) sfx('remove');
  if (list.length) toast(`Desarmaste ${list.length} edificio${list.length > 1 ? 's' : ''}. Podés deshacerlo.`);
}

function copyArea(r) {
  const list = entitiesIn(r);
  if (!list.length) { toast('No hay nada para copiar en esa área.'); return; }
  // Posiciones relativas al área (sirve también si el área cruza el borde del mapa)
  const ux = (e) => r.x0 + wdx(e.x - r.x0), uy = (e) => r.y0 + wdy(e.y - r.y0);
  const x0 = Math.min(...list.map(ux)), y0 = Math.min(...list.map(uy));
  const x1 = Math.max(...list.map((e) => ux(e) + sizeOf(e.type) - 1)), y1 = Math.max(...list.map((e) => uy(e) + sizeOf(e.type) - 1));
  clipboard = {
    w: x1 - x0 + 1, h: y1 - y0 + 1,
    items: list.map((e) => {
      const it = { type: e.type, dx: ux(e) - x0, dy: uy(e) - y0, dir: e.dir, recipe: e.recipe || null, filter: e.filter || null };
      if (e.prio) it.prio = e.prio;
      if (e.type === 'station') it.mode = e.mode;
      if (e.req) it.req = { ...e.req };
      return it;
    }),
  };
  toast(`Copiaste ${list.length} edificio${list.length > 1 ? 's' : ''}. ${isTouch() ? 'Tocá dónde pegar.' : 'Clic para pegar, R para girar.'}`);
  selectTool('paste');
}

function rotateClipboard() {
  if (!clipboard) return;
  const { w, h } = clipboard;
  for (const it of clipboard.items) {
    const s = sizeOf(it.type);
    const nx = h - it.dy - s, ny = it.dx;
    it.dx = nx; it.dy = ny;
    if (!NO_DIR.has(it.type)) it.dir = (it.dir + 1) % 4;
  }
  clipboard.w = h; clipboard.h = w;
}

function pasteOrigin(t) {
  return { x: t.x - Math.floor(clipboard.w / 2), y: t.y - Math.floor(clipboard.h / 2) };
}

function pasteAt(t) {
  if (!clipboard) return;
  const o = pasteOrigin(t);
  beginBatch();
  let ok = 0, fail = 0;
  // Primero los postes y edificios grandes, después el resto
  const items = [...clipboard.items].sort((a, b) => sizeOf(b.type) - sizeOf(a.type));
  for (const it of items) {
    const e = isUnlocked(it.type) ? placeOrGhost(it.type, o.x + it.dx, o.y + it.dy, it.dir, it) : null;
    if (e && e.id && !S.ghosts.includes(e)) {
      ok++;
      if (it.recipe && e.recipe !== undefined && RECIPES[it.recipe] && !e.recipe) e.recipe = it.recipe;
      if (it.filter && e.filter !== undefined) e.filter = it.filter;
      if (it.prio) e.prio = it.prio;
      if (it.mode && e.type === 'station') e.mode = it.mode;
      if (it.req && e.type === 'requesterchest') e.req = { ...it.req };
      netTouch(e);
    } else if (!e) fail++;
  }
  endBatch();
  toast(fail ? `Pegaste ${ok} de ${ok + fail} edificios (faltan materiales o lugar).` : `Pegaste ${ok} edificios.`);
  pastePos = null;
  updateConfirm();
  updateUI();
}

// Tren cerca de una casilla (la locomotora o sus vagones)
function trainNear(x, y) {
  for (const t of S.trains) {
    for (let k = 0; k <= 2; k++) {
      const p = k === 0 ? t : trainTrail(t, k * 1.05);
      if (Math.abs(p.x - x) < 0.8 && Math.abs(p.y - y) < 0.8) return t;
    }
  }
  return null;
}

// --------------------------- Acciones ---------------------------

function rotateAction(step) {
  if (tool === 'paste') { rotateClipboard(); return; }
  const e = (tool === 'hand' || tool === 'delete') && hover && !isTouch() ? at(hover.x, hover.y) : null;
  if (e && !NO_DIR.has(e.type)) rotateEntity(e, step);
  else if (inspected && tool === 'hand') rotateEntity(inspected, step);
  else toolDir = (toolDir + step + 4) % 4;
  updateInspector();
}

function undoAction() {
  const n = undo();
  sfx('click');
  toast(n ? `Deshiciste ${n} cambio${n > 1 ? 's' : ''}.` : 'No hay nada para deshacer.');
  updateUI();
}

function tryPlaceSingle(t) {
  const a = anchorFor(tool, t);
  const res = canPlace(tool, a.x, a.y);
  if (!res.ok && res.why === 'Faltan materiales' && robotsOn() && addGhost(tool, a.x, a.y, toolDir)) {
    toast('👻 Quedó como plano: los robots lo construyen cuando haya materiales.');
    return null;
  }
  if (!res.ok) { sfx('error'); toast(res.why === 'Faltan materiales' ? `Faltan materiales: ${costText(BUILDINGS[tool].cost)}` : res.why); return null; }
  const e = userPlace(tool, a.x, a.y, toolDir);
  if (e && !e.queued) sfx('place');
  return e && !e.queued ? e : null;
}

// Un toque en la pantalla táctil
function handleTap(t) {
  if (tool === 'hand') {
    const tr = trainNear(t.x, t.y);
    const e = at(t.x, t.y);
    if (playerOn() && petAt(t)) openPetPanel();
    else if (tr) openInspector(tr);
    else if (e && e.type !== 'nest') openInspector(e);
    else { closeInspector(); if (playerOn()) handGround(t); }
    return;
  }
  if (tool === 'delete') {
    if (!area) { area = { mode: 'delete', a: t, b: null }; }
    else if (!area.b) {
      if (sameTile(area.a, t)) {
        const e = at(t.x, t.y);
        const gh = ghostAt(t.x, t.y);
        if (gh) { S.ghosts.splice(S.ghosts.indexOf(gh), 1); toast('Plano cancelado.'); }
        else if (e && userRemove(e)) toast('Desarmado. Podés deshacerlo.');
        area = null;
      } else area.b = t;
    } else {
      const r = rectOf(area.a, area.b);
      if (t.x >= r.x0 && t.x <= r.x1 && t.y >= r.y0 && t.y <= r.y1) { deleteArea(r); area = null; }
      else area.b = t;
    }
  } else if (tool === 'copy') {
    if (!area) area = { mode: 'copy', a: t, b: null };
    else { const r = rectOf(area.a, t); area = null; copyArea(r); }
  } else if (tool === 'paste') {
    if (sameTile(pastePos, t)) pasteAt(t); else pastePos = t;
  } else if (isLineTool(tool)) {
    if (!beltPlan) beltPlan = { a: t, b: null, flip: false };
    else if (!beltPlan.b) {
      if (sameTile(beltPlan.a, t)) { beginBatch(); tryPlaceSingle(t); endBatch(); beltPlan = null; }
      else beltPlan.b = t;
    } else if (sameTile(beltPlan.b, t)) buildBeltPlan();
    else beltPlan.b = t;
  } else {
    const a = anchorFor(tool, t);
    if (sameTile(pending, a)) { tryPlaceSingle(t); pending = null; }
    else pending = a;
  }
  updateConfirm();
  updateUI();
}

// --------------------------- Vista previa para el dibujo ---------------------------

function getPreview() {
  const pv = { ghosts: [], rect: null, marks: [] };
  const ghost = (type, x, y, dir, extra) => {
    const res = canPlace(type, x, y);
    pv.ghosts.push({ type, x, y, dir, ok: res.ok, ...extra });
  };
  if (panning && !isTouch()) return pv;

  if (area) {
    const b = area.b || (!isTouch() && hover && downAt ? hover : null);
    const del = area.mode === 'delete';
    if (b) {
      pv.rect = { ...rectOf(area.a, b), fill: del ? 'rgba(229,83,75,0.15)' : 'rgba(80,160,255,0.15)', stroke: del ? '#e5534b' : '#5aa0ff' };
    } else {
      const e = at(area.a.x, area.a.y);
      pv.marks.push(e ? { x: e.x, y: e.y, size: sizeOf(e.type), color: del ? '#e5534b' : '#5aa0ff' } : { x: area.a.x, y: area.a.y, color: del ? '#e5534b' : '#5aa0ff' });
    }
    return pv;
  }

  if (tool === 'paste' && clipboard) {
    const p = isTouch() ? pastePos : hover;
    if (p) {
      const o = pasteOrigin(p);
      for (const it of clipboard.items) ghost(it.type, o.x + it.dx, o.y + it.dy, it.dir, { recipe: it.recipe });
    }
    return pv;
  }

  if (beltPlan) {
    const end = beltPlan.b || (!isTouch() ? hover : null);
    if (end) for (const p of beltPath(beltPlan.a, end, beltPlan.flip)) ghost(tool, p.x, p.y, p.dir);
    else pv.marks.push({ x: beltPlan.a.x, y: beltPlan.a.y, color: '#f0a742' });
    return pv;
  }

  if (BUILDINGS[tool]) {
    if (isTouch()) { if (pending) ghost(tool, pending.x, pending.y, toolDir); }
    else if (hover && !dragging) { const a = anchorFor(tool, hover); ghost(tool, a.x, a.y, toolDir); }
    return pv;
  }

  if (hover && !isTouch()) {
    const e = at(hover.x, hover.y);
    const color = tool === 'delete' ? '#e5534b' : tool === 'copy' ? '#5aa0ff' : 'rgba(255,255,255,0.45)';
    if (e) pv.marks.push({ x: e.x, y: e.y, size: sizeOf(e.type), color });
    else pv.marks.push({ x: hover.x, y: hover.y, color });
  }
  return pv;
}

// --------------------------- Puntero ---------------------------

canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

canvas.addEventListener('pointerdown', (ev) => {
  if (launchAnim) return;
  canvas.setPointerCapture(ev.pointerId);
  pointerType = ev.pointerType;
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  mouse.x = ev.clientX; mouse.y = ev.clientY;

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    if (dragging) endBatch();
    dragging = null; deleting = false; handMining = null; panning = null; downAt = null;
    return;
  }
  if (pointers.size > 2) return;

  const t = screenToTile(ev.clientX, ev.clientY);
  hover = t;
  downAt = { x: ev.clientX, y: ev.clientY, tile: t, moved: false, button: ev.button };

  if (ev.button === 1) { panning = { x: ev.clientX, y: ev.clientY }; ev.preventDefault(); return; }
  if (ev.button === 2) {
    deleting = true;
    beginBatch();
    userRemove(at(t.x, t.y));
    return;
  }
  if (ev.button !== 0) return;

  if (tool === 'hand') {
    const e = at(t.x, t.y);
    const o = oreAt(t.x, t.y);
    if (!playerOn() && !e && o && o !== 'oil' && o !== 'water' && tileExplored(t.x, t.y)) handMining = { x: t.x, y: t.y, prog: 0 };
    else if (!playerOn() && !e && !o && treeAt(t.x, t.y) && tileExplored(t.x, t.y)) handMining = { x: t.x, y: t.y, prog: 0, tree: true };
    return;
  }
  if (isTouch()) return; // en táctil se decide al soltar (toque) o se mueve la cámara

  // Mouse
  if (tool === 'delete' || tool === 'copy') {
    area = { mode: tool, a: t, b: null };
  } else if (tool === 'paste') {
    // se pega al soltar
  } else if (BUILDINGS[tool]) {
    beginBatch();
    const placed = tryPlaceSingle(t);
    dragging = { x: t.x, y: t.y, placed };
  }
  updateUI();
});

canvas.addEventListener('pointermove', (ev) => {
  pointerType = ev.pointerType;
  if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  mouse.x = ev.clientX; mouse.y = ev.clientY;

  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    view.x -= (mx - pinch.mx) / view.zoom;
    view.y -= (my - pinch.my) / view.zoom;
    if (pinch.d > 0) zoomAt(mx, my, d / pinch.d);
    pinch = { d, mx, my };
    return;
  }

  if (downAt && !downAt.moved && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 8) {
    downAt.moved = true;
    // Qué hacer cuando el gesto pasa a ser un arrastre
    if (handMining) handMining = null;
    if (isTouch() || (tool === 'hand' && downAt.button === 0) || tool === 'paste') {
      panning = { x: ev.clientX, y: ev.clientY };
    }
  }
  if (panning) {
    followCam = false;
    view.x -= (ev.clientX - panning.x) / view.zoom;
    view.y -= (ev.clientY - panning.y) / view.zoom;
    panning.x = ev.clientX; panning.y = ev.clientY;
    clampView();
  }

  const t = screenToTile(ev.clientX, ev.clientY);
  const changed = !hover || hover.x !== t.x || hover.y !== t.y;
  hover = t;
  if (changed && !panning) {
    if (dragging) dragTo(t);
    if (deleting) userRemove(at(t.x, t.y));
  }
  updateTooltip();
});

// Arrastre con mouse: cintas siguiendo al puntero, otros edificios en línea
function dragTo(target) {
  target = { x: dragging.x + wdx(target.x - dragging.x), y: dragging.y + wdy(target.y - dragging.y) };
  let guard = 500;
  while ((dragging.x !== target.x || dragging.y !== target.y) && guard-- > 0) {
    const next = { x: dragging.x, y: dragging.y };
    if (next.x !== target.x) next.x += Math.sign(target.x - next.x);
    else next.y += Math.sign(target.y - next.y);
    if (isBelt(tool)) {
      const d = dirBetween(dragging, next);
      toolDir = d;
      if (dragging.placed && at(dragging.x, dragging.y) === dragging.placed && dragging.placed.dir !== d) {
        record({ kind: 'rotate', e: dragging.placed, from: dragging.placed.dir });
        dragging.placed.dir = d; netTouch(dragging.placed);
      }
    }
    const a = anchorFor(tool, next);
    dragging.placed = tool === 'underground' ? null : userPlace(tool, a.x, a.y, toolDir);
    if (dragging.placed && dragging.placed.queued) dragging.placed = null;
    dragging.x = next.x; dragging.y = next.y;
  }
}

function endPointer(ev) {
  pointers.delete(ev.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; downAt = null; return; }
  const d = downAt;
  if (d && !d.moved && ev.type === 'pointerup') {
    if (isTouch()) {
      if (!handMining || handMining.prog < 0.25) handleTap(d.tile);
    } else if (d.button === 0) {
      if (tool === 'hand') {
        const tr = trainNear(d.tile.x, d.tile.y);
        const e = at(d.tile.x, d.tile.y);
        if (playerOn() && petAt(d.tile)) openPetPanel();
        else if (tr) openInspector(tr);
        else if (e && e.type !== 'nest') openInspector(e);
        else { if (!handMining) closeInspector(); if (playerOn()) handGround(d.tile); }
      } else if (tool === 'delete') {
        const e = at(d.tile.x, d.tile.y);
        const gh = ghostAt(d.tile.x, d.tile.y);
        if (gh) S.ghosts.splice(S.ghosts.indexOf(gh), 1);
        else if (e) userRemove(e);
        area = null;
      } else if (tool === 'copy') {
        area = null;
      } else if (tool === 'paste') {
        pasteAt(d.tile);
      }
    }
  } else if (d && d.moved && !isTouch() && area && hover) {
    // Fin de un arrastre de área con mouse
    const r = rectOf(area.a, hover);
    const mode = area.mode;
    area = null;
    if (mode === 'delete') deleteArea(r); else copyArea(r);
  }
  if (dragging || deleting) endBatch();
  panning = null; dragging = null; deleting = false; handMining = null; downAt = null;
  if (!isTouch() && area && !area.b) area = null;
  if (ev.pointerType !== 'mouse') hover = null;
  updateConfirm();
  updateUI();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', (ev) => {
  if (ev.pointerType === 'mouse' && !pointers.size) { hover = null; updateTooltip(); }
});

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0015));
}, { passive: false });

// --------------------------- Minimapa ---------------------------

const minimap = $('minimap');
function minimapJump(ev) {
  const r = minimap.getBoundingClientRect();
  view.x = ((ev.clientX - r.left) / r.width) * W * TILE;
  view.y = ((ev.clientY - r.top) / r.height) * H * TILE;
  clampView();
}
minimap.addEventListener('pointerdown', (ev) => { minimap.setPointerCapture(ev.pointerId); minimapJump(ev); });
minimap.addEventListener('pointermove', (ev) => { if (ev.buttons) minimapJump(ev); });

// --------------------------- Teclado ---------------------------

window.addEventListener('keydown', (ev) => {
  if (ev.target.closest && ev.target.closest('input, textarea, select')) return;
  const k = ev.key.toLowerCase();
  if (anyModalOpen()) {
    if (k === 'escape' || (k === 't' && !$('research').hidden)) closeModals();
    return;
  }
  if (launchAnim) return;
  if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); undoAction(); return; }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  keys.add(k);
  if (k === 'escape') {
    if (pending || beltPlan || area || pastePos) clearPlans();
    else if (tool !== 'hand') selectTool('hand');
    else closeInspector();
  } else if ((k >= '0' && k <= '9')) {
    const gi = k === '0' ? 9 : Number(k) - 1;
    const group = KEY_GROUPS[gi].filter(isUnlocked);
    if (!group.length) { selectTool(KEY_GROUPS[gi][0]); return; }
    const i = group.indexOf(tool);
    selectTool(group[(i + 1) % group.length]);
  } else if (k === 'r') {
    rotateAction(ev.shiftKey ? -1 : 1);
  } else if (k === 'x' || k === 'delete') {
    selectTool('delete');
  } else if (k === 'c') {
    selectTool('copy');
  } else if (k === 'v') {
    if (clipboard) selectTool('paste');
  } else if (k === 'q') {
    const e = hover && at(hover.x, hover.y);
    if (e && BUILDINGS[e.type]) { selectTool(e.type); toolDir = e.dir; } else selectTool('hand');
  } else if (k === 't') {
    openModal('research');
  } else if (k === 'b') {
    openModal('planos');
  } else if (k === 'p') {
    togglePollution();
  }
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) ev.preventDefault();
});
window.addEventListener('keyup', (ev) => keys.delete(ev.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// Con la mano en el suelo: caminar hasta ahí, o extraer si es mineral
function handGround(t) {
  const o = oreAt(t.x, t.y);
  stopPlayerTasks();
  if (o && o !== 'water' && o !== 'oil' && tileExplored(t.x, t.y)) startMining(t.x, t.y);
  else if (!o && !at(t.x, t.y) && treeAt(t.x, t.y) && tileExplored(t.x, t.y)) startMining(t.x, t.y);
  else if (walkable(t.x, t.y)) walkTo(t.x, t.y, 0.3);
  followCam = true;
}

let followCam = true;     // la cámara sigue al personaje (se suelta al arrastrar)
function handleKeysPan(dt) {
  if (launchAnim) return;
  if (playerOn()) {
    const ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const iy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    S.player.input = { x: ix, y: iy };
    if (ix || iy) { followCam = true; S.player.queue.length = 0; }
    if (followCam && !panning) {
      const k = Math.min(1, dt * 8);
      view.x += wdx(S.player.x - view.x / TILE) * TILE * k;
      view.y += wdy(S.player.y - view.y / TILE) * TILE * k;
      clampView();
    }
    if (!isTouch()) hover = screenToTile(mouse.x, mouse.y);
    return;
  }
  const sp = 800 * dt / view.zoom;
  let moved = false;
  if (keys.has('w') || keys.has('arrowup')) { view.y -= sp; moved = true; }
  if (keys.has('s') || keys.has('arrowdown')) { view.y += sp; moved = true; }
  if (keys.has('a') || keys.has('arrowleft')) { view.x -= sp; moved = true; }
  if (keys.has('d') || keys.has('arrowright')) { view.x += sp; moved = true; }
  if (moved) {
    clampView();
    if (!isTouch()) hover = screenToTile(mouse.x, mouse.y);
  }
}
