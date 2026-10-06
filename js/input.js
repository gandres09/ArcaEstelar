'use strict';
// =====================================================================
//  Entrada: mouse, pantalla táctil y teclado
// =====================================================================

const HAND_MINE_TIME = 0.6;
const mouse = { x: 0, y: 0 };
let tool = 'hand';
let toolDir = 0;
let hover = null;
let pointerType = 'mouse';
let panning = null;     // { x, y }
let dragging = null;    // { x, y, placed }
let deleting = false;
let handMining = null;  // { x, y, prog }
let downAt = null;      // dónde empezó el toque (para distinguir tap de arrastre)
const pointers = new Map();
let pinch = null;
const keys = new Set();

function screenToWorld(sx, sy) {
  return { x: (sx - cw / 2) / view.zoom + view.x, y: (sy - ch / 2) / view.zoom + view.y };
}
function screenToTile(sx, sy) {
  const w = screenToWorld(sx, sy);
  return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
}

function clampView() {
  view.x = Math.max(0, Math.min(W * TILE, view.x));
  view.y = Math.max(launchAnim ? -2000 : 0, Math.min(H * TILE, view.y));
}

function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  view.zoom = Math.min(2.5, Math.max(0.12, view.zoom * factor));
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

function placeAtCursor(t) {
  const s = sizeOf(tool);
  return place(tool, t.x - Math.floor(s / 2), t.y - Math.floor(s / 2), toolDir);
}

// Al arrastrar cintas la dirección sigue al puntero y se rellenan las casillas intermedias
function dragTo(target) {
  let guard = 400;
  while ((dragging.x !== target.x || dragging.y !== target.y) && guard-- > 0) {
    const next = { x: dragging.x, y: dragging.y };
    if (next.x !== target.x) next.x += Math.sign(target.x - next.x);
    else next.y += Math.sign(target.y - next.y);
    if (isBelt(tool)) {
      const d = dirBetween(dragging, next);
      toolDir = d;
      if (dragging.placed && at(dragging.x, dragging.y) === dragging.placed) dragging.placed.dir = d;
    }
    dragging.placed = tool === 'underground' ? null : placeAtCursor(next);
    dragging.x = next.x; dragging.y = next.y;
  }
}

function rotateAction(step) {
  const e = (tool === 'hand' || tool === 'delete') && hover ? at(hover.x, hover.y) : null;
  if (e && !NO_DIR.has(e.type)) rotateEntity(e, step);
  else if (inspected && tool === 'hand') rotateEntity(inspected, step);
  else toolDir = (toolDir + step + 4) % 4;
  updateInspector();
}

// --------------------------- Puntero ---------------------------

canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

canvas.addEventListener('pointerdown', (ev) => {
  if (launchAnim) return;
  canvas.setPointerCapture(ev.pointerId);
  pointerType = ev.pointerType;
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  mouse.x = ev.clientX; mouse.y = ev.clientY;

  // Dos dedos: pellizcar para hacer zoom y mover
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    dragging = null; deleting = false; handMining = null; panning = null;
    return;
  }
  if (pointers.size > 2) return;

  const t = screenToTile(ev.clientX, ev.clientY);
  hover = t;
  downAt = { x: ev.clientX, y: ev.clientY, tile: t, moved: false };

  if (ev.button === 1) { panning = { x: ev.clientX, y: ev.clientY }; ev.preventDefault(); return; }
  if (ev.button === 2 || tool === 'delete') {
    deleting = true;
    removeEntity(at(t.x, t.y));
    return;
  }
  if (ev.button !== 0) return;

  if (tool === 'hand') {
    const e = at(t.x, t.y);
    if (!e && oreAt(t.x, t.y)) handMining = { x: t.x, y: t.y, prog: 0 };
    else panning = { x: ev.clientX, y: ev.clientY };
  } else {
    const placed = placeAtCursor(t);
    if (!placed && pointerType === 'mouse') {
      const s = sizeOf(tool);
      const why = canPlace(tool, t.x - Math.floor(s / 2), t.y - Math.floor(s / 2)).why;
      if (why === 'Faltan materiales') toast(`Faltan materiales: ${costText(BUILDINGS[tool].cost)}`);
    }
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

  if (downAt && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 8) downAt.moved = true;

  // Con la mano: si el dedo se mueve, se cancela la extracción y se mueve la cámara
  if (handMining && downAt && downAt.moved) {
    handMining = null;
    panning = { x: ev.clientX, y: ev.clientY };
  }
  if (panning) {
    view.x -= (ev.clientX - panning.x) / view.zoom;
    view.y -= (ev.clientY - panning.y) / view.zoom;
    panning.x = ev.clientX; panning.y = ev.clientY;
    clampView();
  }

  const t = screenToTile(ev.clientX, ev.clientY);
  const changed = !hover || hover.x !== t.x || hover.y !== t.y;
  hover = t;
  if (changed) {
    if (dragging) dragTo(t);
    if (deleting) removeEntity(at(t.x, t.y));
  }
  updateTooltip();
});

function endPointer(ev) {
  pointers.delete(ev.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; downAt = null; return; }
  // Toque corto con la mano sobre un edificio: abrir el inspector
  if (downAt && !downAt.moved && tool === 'hand' && ev.button === 0) {
    const e = at(downAt.tile.x, downAt.tile.y);
    if (e) openInspector(e);
    else if (!handMining) closeInspector();
  }
  panning = null; dragging = null; deleting = false; handMining = null; downAt = null;
  if (ev.pointerType !== 'mouse') hover = null;
  updateUI();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse' && !pointers.size) { hover = null; updateTooltip(); } });

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
  if (ev.target.closest && ev.target.closest('input, textarea')) return;
  const k = ev.key.toLowerCase();
  if (anyModalOpen()) {
    if (k === 'escape' || (k === 't' && !$('research').hidden)) closeModals();
    return;
  }
  if (launchAnim) return;
  keys.add(k);
  if (k === 'escape') {
    if (tool !== 'hand') selectTool('hand'); else closeInspector();
  } else if (k >= '1' && k <= '9') {
    const group = KEY_GROUPS[Number(k) - 1].filter(isUnlocked);
    if (!group.length) { selectTool(KEY_GROUPS[Number(k) - 1][0]); return; }
    const i = group.indexOf(tool);
    selectTool(group[(i + 1) % group.length]);
  } else if (k === 'r') {
    rotateAction(ev.shiftKey ? -1 : 1);
  } else if (k === 'x' || k === 'delete') {
    selectTool('delete');
  } else if (k === 'q') {
    const e = hover && at(hover.x, hover.y);
    if (e && e.type !== 'hub') { selectTool(e.type); toolDir = e.dir; } else selectTool('hand');
  } else if (k === 't') {
    openModal('research');
  }
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) ev.preventDefault();
});
window.addEventListener('keyup', (ev) => keys.delete(ev.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function handleKeysPan(dt) {
  if (launchAnim) return;
  const sp = 800 * dt / view.zoom;
  let moved = false;
  if (keys.has('w') || keys.has('arrowup')) { view.y -= sp; moved = true; }
  if (keys.has('s') || keys.has('arrowdown')) { view.y += sp; moved = true; }
  if (keys.has('a') || keys.has('arrowleft')) { view.x -= sp; moved = true; }
  if (keys.has('d') || keys.has('arrowright')) { view.x += sp; moved = true; }
  if (moved) {
    clampView();
    if (pointerType === 'mouse') hover = screenToTile(mouse.x, mouse.y);
  }
}
