'use strict';
// =====================================================================
//  Biblioteca de planos: guardar zonas copiadas con nombre, volver a
//  usarlas, pasarlas como código y compartirlas en línea.
// =====================================================================

const BP_KEY = 'mini-fabrica-planos';
let blueprints = [];        // [{ id, name, w, h, items, at }]
let sharedBlueprints = [];  // los que compartieron otros jugadores (en línea)

function loadBlueprints() {
  try { blueprints = JSON.parse(localStorage.getItem(BP_KEY) || '[]'); } catch (_) { blueprints = []; }
  if (!Array.isArray(blueprints)) blueprints = [];
}
function saveBlueprints() {
  try { localStorage.setItem(BP_KEY, JSON.stringify(blueprints)); } catch (_) { toast('No se pudo guardar el plano en este navegador.'); }
}

// Solo los datos que hacen falta para reconstruir (y nada raro de afuera)
function cleanBlueprint(bp) {
  if (!bp || !Array.isArray(bp.items)) return null;
  const items = bp.items.filter((it) => it && BUILDINGS[it.type] && it.type !== 'train' && Number.isInteger(it.dx) && Number.isInteger(it.dy))
    .slice(0, 2000)
    .map((it) => {
      const o = { type: it.type, dx: it.dx, dy: it.dy, dir: (it.dir | 0) & 3 };
      if (it.recipe && RECIPES[it.recipe]) o.recipe = it.recipe;
      if (it.filter && ITEMS[it.filter]) o.filter = it.filter;
      if (['front', 'left', 'right'].includes(it.prio)) o.prio = it.prio;
      if (it.mode === 'load' || it.mode === 'unload') o.mode = it.mode;
      if (it.req && typeof it.req === 'object') { o.req = {}; for (const k in it.req) if (ITEMS[k]) o.req[k] = Math.max(1, Math.min(400, it.req[k] | 0)); }
      return o;
    });
  if (!items.length) return null;
  const w = Math.max(...items.map((it) => it.dx + sizeOf(it.type))), h = Math.max(...items.map((it) => it.dy + sizeOf(it.type)));
  return { name: String(bp.name || 'Plano').replace(/[<>]/g, '').slice(0, 32), w, h, items };
}

function saveClipboardAsBlueprint() {
  if (!clipboard) return;
  const n = blueprints.length + 1;
  const bp = cleanBlueprint({ ...clipboard, name: `Plano ${n}` });
  if (!bp) return;
  bp.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  bp.at = Date.now();
  blueprints.unshift(bp);
  saveBlueprints();
  toast(`💾 Guardaste <b>${bp.name}</b> (${bp.items.length} edificios). Está en 📐 Planos.`);
  openModal('planos');
  setTimeout(() => { const i = document.querySelector(`[data-bp-name="${bp.id}"]`); if (i) { i.focus(); i.select(); } }, 50);
}

function useBlueprint(bp) {
  clipboard = JSON.parse(JSON.stringify({ w: bp.w, h: bp.h, items: bp.items }));
  closeModals();
  selectTool('paste');
  toast(`📐 ${escapeHtml(bp.name)}: ${isTouch() ? 'tocá dónde pegarlo.' : 'clic para pegar, R para girar.'}`);
}

async function blueprintCode(bp) {
  return 'PLANO:' + (await gzipBase64(JSON.stringify({ name: bp.name, items: bp.items })));
}

async function importBlueprint(code) {
  try {
    code = code.trim();
    if (!code.startsWith('PLANO:')) throw new Error('formato');
    const bp = cleanBlueprint(JSON.parse(await unpackCode(code.slice(6))));
    if (!bp) throw new Error('vacío');
    bp.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    bp.at = Date.now();
    blueprints.unshift(bp);
    saveBlueprints();
    toast(`📥 Agregaste <b>${escapeHtml(bp.name)}</b>.`);
    renderBlueprints();
  } catch (_) {
    toast('Ese código de plano no es válido. Tiene que empezar con PLANO:');
  }
}

// Miniatura: un cuadradito por edificio con su color
const bpPreviewCache = new Map();
function blueprintPreview(bp) {
  const key = bp.id || bp.name + bp.items.length;
  if (bpPreviewCache.has(key)) return bpPreviewCache.get(key);
  const c = document.createElement('canvas');
  c.width = 72; c.height = 72;
  const g = c.getContext('2d');
  g.fillStyle = '#1c222b'; g.fillRect(0, 0, 72, 72);
  const k = Math.min(66 / bp.w, 66 / bp.h), ox = (72 - bp.w * k) / 2, oy = (72 - bp.h * k) / 2;
  for (const it of bp.items) {
    const s = sizeOf(it.type);
    g.fillStyle = TYPE_COLOR[it.type] || '#999';
    g.fillRect(ox + it.dx * k + 0.3, oy + it.dy * k + 0.3, Math.max(1, s * k - 0.6), Math.max(1, s * k - 0.6));
  }
  const url = c.toDataURL();
  bpPreviewCache.set(key, url);
  return url;
}

function bpCost(bp) {
  const cost = {};
  for (const it of bp.items) for (const k in BUILDINGS[it.type].cost) cost[k] = (cost[k] || 0) + BUILDINGS[it.type].cost[k];
  return cost;
}

function bpCard(bp, shared) {
  const by = shared && bp.by ? ` · de ${escapeHtml(netNameOf(bp.by))}` : '';
  return `<div class="bp-card">
    <img src="${blueprintPreview(bp)}" alt="" width="72" height="72">
    <div class="bp-info">
      ${shared ? `<b>${escapeHtml(bp.name)}</b>` : `<input type="text" maxlength="32" value="${escapeHtml(bp.name)}" data-bp-name="${bp.id}" aria-label="Nombre del plano">`}
      <span class="muted small">${bp.items.length} edificios · ${bp.w}×${bp.h}${by}</span>
      <span class="tip-cost small">${costHtml(bpCost(bp))}</span>
      <div class="bp-actions">
        <button type="button" class="small-btn primary" data-bp-use="${bp.id}" data-shared="${shared ? 1 : 0}">Usar</button>
        ${shared ? `<button type="button" class="small-btn" data-bp-keep="${bp.id}">Guardar</button>` : `<button type="button" class="small-btn" data-bp-code="${bp.id}">Copiar código</button>
        ${NET.available && NET.canWrite ? `<button type="button" class="small-btn" data-bp-share="${bp.id}">Compartir</button>` : ''}
        <button type="button" class="small-btn" data-bp-del="${bp.id}">Borrar</button>`}
      </div>
    </div>
  </div>`;
}

function renderBlueprints() {
  const box = $('bp-body');
  if (!box) return;
  let h = '';
  h += clipboard ? '<div class="actions"><button type="button" class="primary" data-bp-save="1">💾 Guardar lo que copiaste</button></div>'
    : '<p class="muted small">Copiá una zona con 📋 <b>Copiar</b> y guardala acá para usarla cuando quieras.</p>';
  h += '<h3>Mis planos</h3>';
  h += blueprints.length ? blueprints.map((bp) => bpCard(bp, false)).join('') : '<p class="muted small">Todavía no guardaste ninguno.</p>';
  if (sharedBlueprints.length) h += '<h3>Compartidos en línea</h3>' + sharedBlueprints.map((bp) => bpCard(bp, true)).join('');
  h += '<details class="bp-import"><summary class="small">📥 Cargar un plano desde un código</summary><textarea id="bp-code" rows="3" spellcheck="false" placeholder="PLANO:..."></textarea><button type="button" class="small-btn" data-bp-import="1">Cargar</button></details>';
  box.innerHTML = h;
}

function findBp(id, shared) { return (shared ? sharedBlueprints : blueprints).find((b) => b.id === id); }

function initBlueprints() {
  loadBlueprints();
  const box = $('bp-body');
  box.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.bpSave) { saveClipboardAsBlueprint(); return; }
    if (b.dataset.bpUse) { const bp = findBp(b.dataset.bpUse, b.dataset.shared === '1'); if (bp) useBlueprint(bp); return; }
    if (b.dataset.bpKeep) {
      const bp = findBp(b.dataset.bpKeep, true);
      if (bp) { const c = cleanBlueprint(bp); c.id = Date.now().toString(36); c.at = Date.now(); blueprints.unshift(c); saveBlueprints(); toast('Guardado en tus planos.'); renderBlueprints(); }
      return;
    }
    if (b.dataset.bpCode) {
      const bp = findBp(b.dataset.bpCode);
      if (!bp) return;
      const code = await blueprintCode(bp);
      try { await navigator.clipboard.writeText(code); toast('📋 Código del plano copiado. Pasáselo a quien quieras.'); }
      catch (_) { const t = $('bp-code'); t.value = code; t.closest('details').open = true; t.select(); toast('Copiá el código que quedó abajo.'); }
      return;
    }
    if (b.dataset.bpShare) {
      const bp = findBp(b.dataset.bpShare);
      if (!bp || !NET.db) return;
      try {
        await NET.db.doc('planos/' + bp.id).set({ name: bp.name, items: bp.items, by: NET.uid || null, at: Date.now() });
        toast('🌐 Plano compartido: lo ven todos los que juegan en línea.');
      } catch (_) { toast('No se pudo compartir (¿permiso de edición?).'); }
      return;
    }
    if (b.dataset.bpDel) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Borrar?'; b.classList.add('danger'); return; }
      blueprints = blueprints.filter((x) => x.id !== b.dataset.bpDel);
      saveBlueprints(); renderBlueprints();
      return;
    }
    if (b.dataset.bpImport) importBlueprint($('bp-code').value);
  });
  box.addEventListener('change', (ev) => {
    const id = ev.target.dataset && ev.target.dataset.bpName;
    if (!id) return;
    const bp = findBp(id);
    const v = ev.target.value.replace(/[<>]/g, '').trim().slice(0, 32);
    if (bp && v) { bp.name = v; saveBlueprints(); }
  });
}

// Planos compartidos en línea (colección "planos" del mundo)
function watchSharedBlueprints() {
  if (!NET.db) return;
  NET.db.collection('planos').onSnapshot((qs) => {
    sharedBlueprints = [];
    for (const d of qs.docs) {
      if (!d.exists) continue;
      const raw = d.data();
      const bp = cleanBlueprint(raw);
      if (bp) { bp.id = d.id; bp.by = typeof raw.by === 'string' ? raw.by : null; sharedBlueprints.push(bp); }
    }
    if (!$('planos').hidden) renderBlueprints();
  }, () => {});
}
