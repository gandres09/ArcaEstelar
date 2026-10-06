'use strict';
// =====================================================================
//  Guardado en la nube: una copia privada de la partida en tu cuenta.
//  Algunos navegadores (Safari en iPhone, sobre todo) borran lo guardado
//  en la página al salir; con esta copia la partida vuelve sola.
// =====================================================================

const CLOUD_EVERY = 45;          // segundos entre copias automáticas
const CLOUD_CHUNK = 200000;      // caracteres por documento (el límite es 256 KiB)
const CLOUD = { ready: false, on: false, busy: false, at: 0, slot: 'a', err: 0, lastTry: 0 };

const cloudDoc = (k) => NET.db.doc('data/users/' + NET.uid + '/nube/' + k);

async function cloudFetch(meta) {
  const parts = await Promise.all(Array.from({ length: meta.n }, (_, i) => cloudDoc(meta.slot + i).get()));
  const z = parts.map((d) => (d.exists ? d.data().d : '')).join('');
  if (z.length !== meta.size) throw new Error('incompleta');
  return unpackCode(z);
}

// Al arrancar: si la copia de la nube es más nueva que la del navegador
// (o el navegador la perdió), se carga sola.
async function cloudInit(fresh) {
  if (!NET.db || !NET.uid || NET.canWrite === false) { CLOUD.noPerm = !!(NET.db && NET.uid); CLOUD.ready = true; cloudStatus(); return; }
  try {
    const m = await cloudDoc('meta').get();
    if (m.exists) {
      const meta = m.data();
      CLOUD.slot = meta.slot === 'b' ? 'b' : 'a';
      CLOUD.at = meta.at || 0;
      const localAt = fresh ? 0 : (S.savedAt || 0);
      if (!NET.on && meta.v === SAVE_VERSION && CLOUD.at > localAt + 2000) {
        const raw = await cloudFetch(meta);
        loadFrom(raw);
        S.savedAt = CLOUD.at;
        save();
        closeModals();
        toolbarKey = '';
        updateUI();
        toast(fresh ? '☁️ Recuperé tu partida guardada en la nube.' : '☁️ Cargué la versión más nueva de tu partida (de la nube).');
      }
    }
    CLOUD.on = true;
  } catch (_) {
    CLOUD.err++;
    CLOUD.on = true;   // se puede seguir subiendo copias aunque la lectura haya fallado
  }
  CLOUD.ready = true;
  cloudStatus();
}

async function cloudSave(force = false) {
  if (!CLOUD.on || CLOUD.busy || NET.on || NET.busy) return false;
  const now = Date.now();
  if (!force && now - CLOUD.lastTry < CLOUD_EVERY * 1000 * 0.8) return false;
  CLOUD.busy = true;
  CLOUD.lastTry = now;
  try {
    S.savedAt = now;
    const z = await gzipBase64(serialize());
    // Se escribe en el casillero libre y recién al final se apunta la ficha:
    // si algo se corta a mitad de camino, la copia anterior sigue entera.
    const slot = CLOUD.slot === 'a' ? 'b' : 'a';
    const parts = [];
    for (let i = 0; i < z.length; i += CLOUD_CHUNK) parts.push(z.slice(i, i + CLOUD_CHUNK));
    await Promise.all(parts.map((d, i) => cloudDoc(slot + i).set({ d })));
    await cloudDoc('meta').set({ slot, n: parts.length, size: z.length, at: now, v: SAVE_VERSION });
    CLOUD.slot = slot;
    CLOUD.at = now;
    CLOUD.err = 0;
    return true;
  } catch (_) {
    CLOUD.err++;
    return false;
  } finally {
    CLOUD.busy = false;
    cloudStatus();
  }
}

async function cloudRestore() {
  if (!CLOUD.on) return;
  try {
    const m = await cloudDoc('meta').get();
    if (!m.exists) { toast('Todavía no hay ninguna copia en la nube.'); return; }
    const meta = m.data();
    loadFrom(await cloudFetch(meta));
    S.savedAt = meta.at;
    save();
    closeModals();
    toolbarKey = '';
    updateUI();
    toast('☁️ Partida cargada desde la nube.');
  } catch (_) {
    toast('No pude leer la copia de la nube. Probá de nuevo en un rato.');
  }
}

function cloudAgo(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Date(t).toLocaleDateString();
}

function cloudStatus() {
  const el = $('cloud-status');
  if (!el) return;
  const btn = $('btn-cloud-load');
  if (btn) btn.hidden = !CLOUD.on;
  if (!CLOUD.ready) { el.textContent = '☁️ Conectando con la nube…'; return; }
  if (!CLOUD.on && CLOUD.noPerm) {
    el.textContent = 'La partida se guarda en este navegador. Para tener copia en la nube, pedile al dueño del juego permiso de Colaborador; mientras tanto usá “Copiar código de partida”.';
    return;
  }
  if (!CLOUD.on) {
    el.textContent = 'La partida se guarda sola cada 10 segundos en este navegador. La copia en la nube funciona cuando abrís el juego desde claude.ai con tu cuenta.';
    return;
  }
  if (NET.on) { el.textContent = '☁️ En línea el mundo lo guarda el anfitrión. Tu partida propia sigue a salvo en la nube.'; return; }
  el.textContent = CLOUD.at
    ? `☁️ Se guarda sola en tu cuenta. Última copia: ${cloudAgo(CLOUD.at)}${CLOUD.err ? ' (el último intento falló, se reintenta solo)' : ''}.`
    : '☁️ Se guarda sola en tu cuenta cada minuto.';
}

function initCloud() {
  setInterval(() => cloudSave(), 5000);
  // Al salir o cambiar de app: copia inmediata (Safari corta todo apenas se oculta la página)
  const flush = () => { save(); cloudSave(true); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
  $('btn-cloud-load').addEventListener('click', () => {
    if (confirm('¿Cargar la copia de la nube? Se reemplaza la partida actual.')) cloudRestore();
  });
  setInterval(() => { if (!$('menu').hidden) cloudStatus(); }, 5000);
  cloudStatus();
}
