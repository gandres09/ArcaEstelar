'use strict';
// =====================================================================
//  Arrastrar objetos con el mouse: del inventario a un edificio (en el
//  mapa o en su panel), del cofre al inventario, y entre mochila y Nave.
// =====================================================================

let drag = null, dragEndedAt = 0, dragMark = null;

function dragSource(el) {
  const inv = el.closest('#inventory [data-item], #pocket [data-item]');
  if (inv) return { item: inv.dataset.item, from: inv.closest('#pocket') ? 'pocket' : 'inv' };
  const d = el.closest('#inspector [data-drag]');
  if (d && inspected && inspected.type !== 'train') return { item: d.dataset.drag, from: 'ent', ent: inspected };
  return null;
}

function dropTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.closest('#inspector') && inspected && inspected.type !== 'train') return { kind: 'ent', ent: inspected, el: $('inspector') };
  if (el.closest('#pocket')) return { kind: 'pocket', el: $('pocket') };
  if (el.closest('#inventory')) return { kind: 'inv', el: $('inventory') };
  if (el.closest('#side')) return { kind: 'me', el: $('side') };
  if (el === canvas) {
    const t = screenToTile(x, y);
    const e = at(t.x, t.y);
    if (e && e.type === 'hub') return { kind: 'inv', el: null };
    if (e && !isEnemyB(e)) return { kind: 'ent', ent: e, el: null, tile: t };
  }
  return null;
}

function entName(e) {
  if (e.type === 'hub') return 'la Nave';
  const n = BUILDINGS[e.type].name;
  return (/(a|ión)( |$)/.test(n.split(' ')[0]) ? 'la ' : 'el ') + n.toLowerCase();
}

function doDrop(d, t) {
  if (!t) return;
  const k = d.item, name = ITEMS[k].name.toLowerCase();
  let n = 0;
  if (d.from === 'ent') {
    if (t.kind === 'ent' && t.ent === d.ent) return;
    n = withdrawFrom(d.ent, k);
    netTouch(d.ent);
    if (n && t.kind === 'ent') {
      const put = depositTo(t.ent, k, n);
      netTouch(t.ent);
      toast(put ? `Pasaste ${put} ${name} a ${entName(t.ent)}.` : `${BUILDINGS[t.ent.type].name} no acepta ${name}: quedó en tu inventario.`);
    } else if (n) toast(`Sacaste ${n} ${name}.`);
  } else if (t.kind === 'ent') {
    n = depositTo(t.ent, k);
    netTouch(t.ent);
    toast(n ? `Pusiste ${n} ${name} en ${entName(t.ent)}.` : `${t.ent.type === 'hub' ? 'La Nave' : BUILDINGS[t.ent.type].name} no acepta ${name} (o está lleno).`);
  } else if (d.from === 'inv' && t.kind === 'pocket') transferItem(k, false);
  else if (d.from === 'pocket' && t.kind === 'inv') transferItem(k, true);
  if (n) sfx('click');
  updateInspector();
  updateInventory();
}

function markDrop(t) {
  const el = t && (t.el || null);
  if (dragMark && dragMark !== el) dragMark.classList.remove('drop-ok');
  dragMark = el;
  if (el) el.classList.add('drop-ok');
  if (t && t.tile) hover = t.tile;   // resalta el edificio del mapa
}

document.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
  const src = dragSource(ev.target);
  if (src) drag = { ...src, x: ev.clientX, y: ev.clientY, on: false };
}, true);

document.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (!drag.on) {
    if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 6) return;
    drag.on = true;
    const g = document.createElement('div');
    g.id = 'drag-ghost';
    g.innerHTML = `<img src="${itemIcon(drag.item)}" width="34" height="34" alt="">`;
    document.body.appendChild(g);
    drag.ghost = g;
    document.body.style.cursor = 'grabbing';
  }
  drag.ghost.style.left = ev.clientX + 'px';
  drag.ghost.style.top = ev.clientY + 'px';
  markDrop(dropTarget(ev.clientX, ev.clientY));
  ev.stopPropagation();
}, true);

document.addEventListener('pointerup', (ev) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.on) return;
  d.ghost.remove();
  document.body.style.cursor = '';
  markDrop(null);
  dragEndedAt = performance.now();
  doDrop(d, dropTarget(ev.clientX, ev.clientY));
  ev.stopPropagation();
}, true);

// El clic que sigue a un arrastre no cuenta como clic
document.addEventListener('click', (ev) => {
  if (performance.now() - dragEndedAt < 300) { ev.stopPropagation(); ev.preventDefault(); }
}, true);

// Que el navegador no arrastre las imágenes por su cuenta (cancela nuestro arrastre)
document.addEventListener('dragstart', (ev) => { if (ev.target.closest && ev.target.closest('#side, #inspector, #toolbar')) ev.preventDefault(); });
document.addEventListener('pointercancel', () => {
  if (!drag) return;
  if (drag.ghost) drag.ghost.remove();
  document.body.style.cursor = '';
  markDrop(null);
  drag = null;
}, true);
