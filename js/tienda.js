'use strict';
// =====================================================================
//  Tienda, guardarropa y regalos.
//  - Guardarropa: trajes, colores de la Nave y del perrito. Muchos se ganan
//    jugando (logros, etapas); otros vienen con el Pack de estilos.
//  - Tienda: mejoras que se compran una vez (en la app de Play Store).
//  - Regalo 🎁: cada tanto, mirando un anuncio (o al instante con "Sin
//    anuncios") la Nave te manda un envío que vale la pena.
//  Las compras y los anuncios pasan por dos "adaptadores" (pagos y anuncios):
//  en la app de Play usan Google Play Billing y los anuncios de Google; en
//  la página web las compras no están disponibles.
// =====================================================================

const SHOP_KEY = 'arca-compras';
const STYLE_KEY = 'arca-estilo';
const GIFT_KEY = 'arca-regalo';
const GIFT_EVERY = 8 * 60 * 1000;     // un regalo cada 8 minutos

const SHOP = {
  fundador:      { icon: '👑', name: 'Pase Fundador', price: 'US$ 4,99', desc: 'Todo, para siempre: sin anuncios, velocidad x2 y x3, investigación +50 %, Vulcano, todas las mascotas y todos los estilos. Y la insignia de Fundador.' },
  sin_anuncios:  { icon: '🚫', name: 'Sin anuncios', price: 'US$ 1,99', desc: 'Los regalos 🎁 se cobran al instante, sin mirar nada.' },
  velocidad:     { icon: '⏩', name: 'Velocidad x2 y x3', price: 'US$ 1,99', desc: 'Acelerá todo el juego cuando jugás solo. Se cambia tocando ⏩ arriba.' },
  investigacion: { icon: '🔬', name: 'Investigación +50 %', price: 'US$ 1,49', desc: 'Tus laboratorios investigan un 50 % más rápido cuando jugás solo.' },
  vulcano:       { icon: '🌋', name: 'Expansión Vulcano', price: 'US$ 1,99', desc: 'El planeta de lava: fundición, tungsteno, taladro grande y cinta turbo. No hace falta para terminar el juego.' },
  mascotas:      { icon: '🐾', name: 'Pack de mascotas', price: 'US$ 1,49', desc: 'Tres mascotas especiales: Robo-perro, Dragoncito (¡vuela y echa fueguito!) y Pingüino espacial con casco.' },
  estilos:       { icon: '🎨', name: 'Pack de estilos', price: 'US$ 0,99', desc: 'Todos los trajes, Naves y perritos especiales del guardarropa.' },
};
const SHOP_ORDER = ['fundador', 'sin_anuncios', 'velocidad', 'investigacion', 'vulcano', 'mascotas', 'estilos'];

// --------------------------- Lo comprado ---------------------------

let shopOwned = new Set();
try { shopOwned = new Set(JSON.parse(localStorage.getItem(SHOP_KEY) || '[]')); } catch (_) { /* nada */ }
const owns = (id) => shopOwned.has(id) || shopOwned.has('fundador');
function grantPurchase(id) {
  if (!SHOP[id] || shopOwned.has(id)) return;
  shopOwned.add(id);
  try { localStorage.setItem(SHOP_KEY, JSON.stringify([...shopOwned])); } catch (_) { /* nada */ }
  updateShopChips();
}

// Las mejoras que cambian el ritmo valen solo jugando solo (en línea sería injusto)
const soloBoosts = () => !(typeof NET !== 'undefined' && NET.on);
const researchShopMult = () => (owns('investigacion') && soloBoosts() ? 1.5 : 1);
let gameSpeed = 1;
const speedNow = () => (owns('velocidad') && soloBoosts() ? gameSpeed : 1);

// --------------------------- Pagos (Google Play) ---------------------------
// En la app de Play (hecha con PWABuilder) existe la API de bienes digitales.
// En la web no hay forma de cobrar: se avisa. Con ?pruebas=1 se simula (para probar).

const PLAY_BILLING = 'https://play.google.com/billing';
let billing = null, billingTried = false;
async function getBilling() {
  if (billingTried) return billing;
  billingTried = true;
  try { if ('getDigitalGoodsService' in window) billing = await window.getDigitalGoodsService(PLAY_BILLING); } catch (_) { billing = null; }
  return billing;
}
const testPurchases = () => !IS_APP && (/[?&]pruebas=1/.test(location.search) || location.hostname === 'localhost');

// --------------------------- App de Android (Capacitor) ---------------------------
// En la app nativa (carpeta app/) las compras van por Google Play Billing
// (cordova-plugin-purchase) y los anuncios por AdMob. La configuración la pone
// app/copiar-juego.mjs en window.ARCA_APP = { rewarded, test }.

const IS_APP = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const ADMOB_TEST_REWARDED = 'ca-app-pub-3940256099942544/5224354917';   // anuncio de prueba de Google
let nativeStore = null;

function nativeStoreInit() {
  const P = window.CdvPurchase;
  if (!P || nativeStore) return;
  const { store, ProductType, Platform } = P;
  nativeStore = store;
  store.register(SHOP_ORDER.map((id) => ({ id, type: ProductType.NON_CONSUMABLE, platform: Platform.GOOGLE_PLAY })));
  const refresh = () => {
    for (const id of SHOP_ORDER) {
      const pr = store.get(id, Platform.GOOGLE_PLAY);
      if (!pr) continue;
      if (pr.pricing && pr.pricing.price) SHOP[id].price = pr.pricing.price;
      if (pr.owned) grantPurchase(id);
    }
    if (!$('tienda').hidden) renderShop();
  };
  store.when()
    .productUpdated(refresh)
    .approved((t) => t.verify())
    .verified((r) => r.finish())   // "finish" confirma la compra en Play (si no, Google la devuelve a los 3 días)
    .finished((t) => {
      for (const pr of t.products) {
        if (!SHOP[pr.id] || shopOwned.has(pr.id)) continue;
        grantPurchase(pr.id);
        toast(`${SHOP[pr.id].icon} ¡Gracias! Ya tenés <b>${SHOP[pr.id].name}</b>.`);
        sfx('research');
      }
      refresh();
    });
  store.initialize([Platform.GOOGLE_PLAY]).then(refresh).catch(() => {});
}

async function nativeBuy(id) {
  if (!nativeStore) { toast('La tienda de Google Play todavía está cargando. Probá en unos segundos.'); return; }
  const pr = nativeStore.get(id, window.CdvPurchase.Platform.GOOGLE_PLAY);
  const offer = pr && pr.getOffer();
  if (!offer) { toast('Ese producto todavía no está disponible en Google Play.'); return; }
  const err = await offer.order();
  if (err && err.code !== window.CdvPurchase.ErrorCode.PAYMENT_CANCELLED) toast('La compra no se completó.');
}

let admob = null, admobReady = false, admobLoading = null, admobPending = null;
async function admobInit() {
  admob = window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
  if (!admob) return;
  const cfg = window.ARCA_APP || {};
  let earned = false;
  admob.addListener('onRewardedVideoAdReward', () => { earned = true; });
  admob.addListener('onRewardedVideoAdShowed', () => { earned = false; if (audio.master) audio.master.gain.value = 0; });
  admob.addListener('onRewardedVideoAdDismissed', () => {
    if (audio.master) audio.master.gain.value = audio.settings.muted ? 0 : 1;
    const cb = admobPending; admobPending = null;
    if (cb && earned) cb();
    else if (cb) toast('Para recibir el regalo hay que mirar el anuncio hasta el final.');
    admobPrepare();
  });
  admob.addListener('onRewardedVideoAdFailedToShow', () => { admobPending = null; toast('No se pudo mostrar el anuncio. Probá en un ratito.'); admobPrepare(); });
  try {
    const ci = await admob.requestConsentInfo();
    if (ci && ci.isConsentFormAvailable && ci.status === 'REQUIRED') await admob.showConsentForm();
  } catch (_) { /* sin formulario de consentimiento */ }
  try { await admob.initialize({ initializeForTesting: !!cfg.test }); } catch (_) { admob = null; return; }
  admobPrepare();
}
function admobPrepare() {
  if (!admob || admobReady) return Promise.resolve();
  if (admobLoading) return admobLoading;
  const cfg = window.ARCA_APP || {};
  admobLoading = admob.prepareRewardVideoAd({ adId: cfg.rewarded || ADMOB_TEST_REWARDED, isTesting: !!cfg.test || !cfg.rewarded })
    .then(() => { admobReady = true; })
    .catch(() => { admobReady = false; })
    .finally(() => { admobLoading = null; });
  return admobLoading;
}
async function admobShow(onReward) {
  if (!admobReady) { toast('Cargando el anuncio…'); await admobPrepare(); }
  if (!admobReady) { toast('Ahora no hay anuncios disponibles. Probá en un ratito.'); admobPrepare(); return; }
  admobReady = false;
  admobPending = onReward;
  admob.showRewardVideoAd().catch(() => { /* se maneja con los eventos */ });
}

// Precios reales desde Play (si está), si no los de referencia
async function loadPrices() {
  const svc = await getBilling();
  if (!svc) return;
  try {
    for (const d of await svc.getDetails(SHOP_ORDER)) {
      if (SHOP[d.itemId] && d.price) SHOP[d.itemId].price = new Intl.NumberFormat('es', { style: 'currency', currency: d.price.currency }).format(+d.price.value);
    }
  } catch (_) { /* quedan los de referencia */ }
}

async function buy(id) {
  if (!SHOP[id] || owns(id)) return;
  if (IS_APP) { await nativeBuy(id); renderShop(); return; }
  const svc = await getBilling();
  if (svc) {
    try {
      const req = new PaymentRequest([{ supportedMethods: PLAY_BILLING, data: { sku: id } }], { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } });
      const res = await req.show();
      await res.complete('success');
      grantPurchase(id);
      toast(`${SHOP[id].icon} ¡Gracias! Ya tenés <b>${SHOP[id].name}</b>.`);
      sfx('research');
    } catch (_) { toast('La compra no se completó.'); }
  } else if (testPurchases()) {
    if (confirm(`Modo prueba: ¿simular la compra de "${SHOP[id].name}"?`)) { grantPurchase(id); toast(`${SHOP[id].icon} Compra de prueba: <b>${SHOP[id].name}</b>.`); }
  } else {
    toast('Las compras están disponibles en la app de Arca Estelar en Google Play.');
  }
  renderShop();
}

// Códigos de regalo (para amigos, testers, sorteos): desbloquean el Pase Fundador
const GIFT_CODES = new Set(['4n3dg2']);
function codeHash(c) { let h = 2166136261; for (let i = 0; i < c.length; i++) { h ^= c.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function redeemCode() {
  const c = String(prompt('Escribí tu código de regalo:') || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return;
  if (GIFT_CODES.has(codeHash(c))) { grantPurchase('fundador'); toast('👑 ¡Código válido! Ya tenés el <b>Pase Fundador</b>.'); sfx('research'); }
  else toast('Ese código no es válido.');
  renderShop();
}

async function restorePurchases(quiet) {
  if (IS_APP) {
    if (!nativeStore) { if (!quiet) toast('La tienda de Google Play todavía está cargando.'); return; }
    if (quiet) return;   // al abrir, las compras se recuperan solas
    const before = shopOwned.size;
    try { await nativeStore.restorePurchases(); } catch (_) { /* nada */ }
    for (const id of SHOP_ORDER) if (nativeStore.owned(id)) grantPurchase(id);
    toast(shopOwned.size > before ? '✔️ Compras recuperadas.' : 'Revisé tu cuenta de Google Play: no encontré compras nuevas.');
    renderShop();
    return;
  }
  const svc = await getBilling();
  if (!svc) { if (!quiet) toast('Para recuperar compras, abrí el juego desde la app de Google Play.'); return; }
  try {
    const list = await svc.listPurchases();
    for (const p of list) grantPurchase(p.itemId);
    if (!quiet) toast(list.length ? '✔️ Compras recuperadas.' : 'No encontré compras en esta cuenta de Google.');
  } catch (_) { if (!quiet) toast('No se pudieron revisar las compras.'); }
  renderShop();
}

// --------------------------- Anuncios con recompensa ---------------------------
// Anuncios de Google para juegos web (H5 Games Ads). Se activan poniendo el
// código de AdSense en window.ARCA_ADS = { client: 'ca-pub-…' } (ver tienda/COMO-PUBLICAR.md).
// Sin eso, se muestra un "anuncio de prueba" de unos segundos.

let adsReady = false;
function adsInit() {
  const cfg = window.ARCA_ADS;
  if (!cfg || !cfg.client || adsReady) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cfg.client);
  s.crossOrigin = 'anonymous';
  s.setAttribute('data-ad-frequency-hint', '120s');
  if (cfg.test) s.setAttribute('data-adbreak-test', 'on');
  document.head.appendChild(s);
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
  window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
  adsReady = true;
}

function showRewardedAd(onReward) {
  if (owns('sin_anuncios')) { onReward(); return; }
  if (IS_APP && admob) { admobShow(onReward); return; }
  if (adsReady && window.adBreak) {
    let given = false, offered = false;
    window.adBreak({
      type: 'reward', name: 'regalo',
      beforeAd: () => { if (audio.master) audio.master.gain.value = 0; },
      afterAd: () => { if (audio.master) audio.master.gain.value = audio.settings.muted ? 0 : 1; },
      beforeReward: (showAdFn) => { offered = true; showAdFn(); },
      adDismissed: () => toast('Para recibir el regalo hay que mirar el anuncio hasta el final.'),
      adViewed: () => { given = true; onReward(); },
      adBreakDone: () => { if (!offered && !given) toast('Ahora no hay anuncios disponibles. Probá en un ratito.'); },
    });
    return;
  }
  fakeAd(onReward);
}

// Mientras no haya anuncios de verdad: una pantalla de prueba de 5 segundos
function fakeAd(onReward) {
  const box = document.createElement('div');
  box.className = 'modal ad-fake';
  box.innerHTML = '<div class="modal-box panel"><h1>📺 Anuncio</h1><p class="muted">Acá va a aparecer un anuncio cuando el juego esté en Google Play.</p><p class="ad-count">5</p></div>';
  document.body.appendChild(box);
  let n = 5;
  const t = setInterval(() => {
    n--;
    box.querySelector('.ad-count').textContent = n;
    if (n <= 0) { clearInterval(t); box.remove(); onReward(); }
  }, 1000);
}

// --------------------------- Regalo de la Nave ---------------------------

let giftAt = 0;
try { giftAt = +localStorage.getItem(GIFT_KEY) || 0; } catch (_) { /* nada */ }
const giftReady = () => !!S && Date.now() - giftAt >= GIFT_EVERY && (S.playTime || 0) > 90;

// Lo que manda la Nave: lo que más usás, procesado, como 10 minutos de tu producción (o un buen arranque)
const GIFT_PROCESSED = { iron_ore: 'iron_plate', copper_ore: 'copper_plate' };
function giftItems() {
  const out = {};
  const rates = [];
  for (const k in (S.produced || {})) {
    if (!ITEMS[k] || FLUIDS.has(k)) continue;
    const r = ratePerMinute(k);
    if (r > 0) rates.push([k, r]);
  }
  rates.sort((a, b) => b[1] - a[1]);
  for (const [k0, r] of rates.slice(0, 4)) {
    let k = GIFT_PROCESSED[k0] || (typeof SMELT !== 'undefined' && SMELT[k0] && SMELT[k0].out) || k0;
    if (!ITEMS[k]) k = k0;
    out[k] = (out[k] || 0) + Math.max(20, Math.round(r * 10));
  }
  // Para empezar (o si todavía no hay nada andando): un buen arranque
  if (Object.keys(out).length < 3) {
    const base = { iron_plate: 80, copper_plate: 50, gear: 30, coal: 60, stone: 50 };
    for (const k in base) if (ITEMS[k] && Object.keys(out).length < 5 && !out[k]) out[k] = base[k];
  }
  return out;
}
// Otro regalo posible: un empujón a la investigación de ahora
const researchGiftOk = () => soloBoosts() && !!(S.research && S.research.current && TECHS[S.research.current] && !S.research._done);

function claimGift(kind) {
  if (!giftReady()) return;
  showRewardedAd(() => {
    giftAt = Date.now();
    try { localStorage.setItem(GIFT_KEY, String(giftAt)); } catch (_) { /* nada */ }
    if (kind === 'research' && researchGiftOk()) {
      const t = TECHS[S.research.current], units = techUnits(S.research.current);
      S.research.progress = Math.min(units - 1, S.research.progress + Math.max(1, Math.ceil(units * 0.3)));
      toast(`🔬 ¡Empujón! <b>${t.name}</b> avanzó un 30 %.`);
    } else {
      const items = giftItems();
      const before = { ...S.inv };
      for (const k in items) add(S.inv, k, items[k]);
      if (typeof netInvDelta === 'function') netInvDelta(before);
      toast('🎁 La Nave recibió: ' + Object.entries(items).map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`).join(', ') + '.');
    }
    sfx('research');
    closeModals();
    updateShopChips();
    updateUI();
  });
}

function renderGift() {
  const el = $('regalo-body');
  if (!el) return;
  if (!giftReady()) {
    const m = Math.ceil((GIFT_EVERY - (Date.now() - giftAt)) / 60000);
    el.innerHTML = `<p>El próximo envío de la Nave está listo en <b>${Math.max(1, m)} min</b>.</p>`;
    return;
  }
  const items = giftItems();
  const how = owns('sin_anuncios') ? 'Recibir' : 'Mirar un anuncio y recibir';
  let h = '<p>La Nave juntó un envío para vos. Elegí uno:</p><div class="shop-list">';
  h += `<div class="shop-card"><div class="shop-icon">📦</div><div class="grow"><b>Materiales</b><div class="muted small">Unos 10 minutos de tu producción, ya procesados:</div>
    <div class="gift-items">${Object.entries(items).map(([k, n]) => `<span>${itemImg(k, 'ico-s')} ${n}</span>`).join('')}</div></div>
    <button type="button" class="primary" data-gift="items">${owns('sin_anuncios') ? '' : '▶️ '}${how}</button></div>`;
  if (researchGiftOk()) {
    h += `<div class="shop-card"><div class="shop-icon">🔬</div><div class="grow"><b>Empujón de investigación</b><div class="muted small">${escapeHtml(TECHS[S.research.current].name)} avanza un 30 % al toque.</div></div>
      <button type="button" class="primary" data-gift="research">${owns('sin_anuncios') ? '' : '▶️ '}${how}</button></div>`;
  }
  h += '</div>';
  if (!owns('sin_anuncios')) h += '<p class="muted small">Con <b>Sin anuncios</b> o el <b>Pase Fundador</b>, los envíos llegan al instante.</p>';
  el.innerHTML = h;
}

// --------------------------- Guardarropa ---------------------------
// unlock: 'free' · 'ach:<logro>' · 'stage:<n>' · 'estilos' (Pack de estilos)
const SUIT_STYLES = [
  { id: 'naranja', name: 'Naranja clásico', light: '#ffb347', dark: '#d9782a', visor: '#2f6fb0', unlock: 'free' },
  { id: 'azul', name: 'Explorador', light: '#7cc0ff', dark: '#2f6fb0', visor: '#1d3b66', unlock: 'free' },
  { id: 'verde', name: 'Botánico', light: '#97d66f', dark: '#4a8f35', visor: '#2f6fb0', unlock: 'ach:first_tech' },
  { id: 'rojo', name: 'Bombero', light: '#ff7a66', dark: '#b8382c', visor: '#ffcf5a', unlock: 'ach:defender' },
  { id: 'blanco', name: 'Astronauta', light: '#f4f6f9', dark: '#aeb6c3', visor: '#e8963a', unlock: 'stage:2' },
  { id: 'violeta', name: 'Cósmico', light: '#c69bff', dark: '#7a4fd1', visor: '#3fe0c5', unlock: 'stage:3' },
  { id: 'dorado', name: 'Dorado', light: '#ffe07a', dark: '#c9962a', visor: '#ff6a3d', unlock: 'estilos' },
  { id: 'sombra', name: 'Sombra', light: '#4a505e', dark: '#1f232b', visor: '#ff3d6b', unlock: 'estilos' },
  { id: 'neon', name: 'Neón', light: '#7dffd4', dark: '#1fae83', visor: '#b06bff', unlock: 'estilos' },
  { id: 'pirata', name: 'Pirata espacial', light: '#a5744b', dark: '#5c3a1f', visor: '#ffd34d', unlock: 'estilos' },
];
const SHIP_STYLES = [
  { id: 'clasica', name: 'Clásica', stripe: '#e8963a', hull: ['#dfe4ea', '#a9b2bd', '#6e7883'], unlock: 'free' },
  { id: 'azul', name: 'Patrulla', stripe: '#3d8bff', hull: ['#e3eaf3', '#9fb0c6', '#5d6e86'], unlock: 'ach:electric' },
  { id: 'roja', name: 'Bomberos', stripe: '#e5534b', hull: ['#f1e6e3', '#c4a8a3', '#7f6560'], unlock: 'ach:launch' },
  { id: 'verde', name: 'Reciclada', stripe: '#5cc47a', hull: ['#dfe8dc', '#a3b59c', '#62755c'], unlock: 'ach:clean' },
  { id: 'dorada', name: 'De lujo', stripe: '#8a2be2', hull: ['#fff0b8', '#e2b84d', '#9c7420'], unlock: 'estilos' },
  { id: 'negra', name: 'Furtiva', stripe: '#ff3d6b', hull: ['#5a606c', '#353a44', '#1b1e24'], unlock: 'estilos' },
];

let styleSel = { traje: 'naranja', nave: 'clasica' };
try { Object.assign(styleSel, JSON.parse(localStorage.getItem(STYLE_KEY) || '{}')); } catch (_) { /* nada */ }

function styleUnlocked(u) {
  if (!u || u === 'free') return true;
  if (u === 'estilos') return owns('estilos');
  if (u === 'mascotas') return owns('mascotas');
  if (u.startsWith('ach:')) { const a = typeof achStore === 'function' && S ? achStore() : {}; return a[u.slice(4)] !== undefined || owns('estilos'); }
  if (u.startsWith('stage:')) return (S && (S.stage || 1) >= +u.slice(6)) || owns('estilos');
  return false;
}
function unlockText(u) {
  if (u === 'estilos') return '🎨 Pack de estilos';
  if (u === 'mascotas') return '🐾 Pack de mascotas';
  if (u.startsWith('ach:')) { const a = ACHIEVEMENTS.find((x) => x.id === u.slice(4)); return '🏆 Logro: ' + (a ? a.name : u.slice(4)); }
  if (u.startsWith('stage:')) return ['', '', '🚀 Llegá al espacio', '🌱 Limpiá el planeta'][+u.slice(6)] || 'Avanzá en el juego';
  return '';
}
function myStyle(list, key) {
  const s = list.find((x) => x.id === styleSel[key]);
  return s && styleUnlocked(s.unlock) ? s : list[0];
}
const mySuit = () => myStyle(SUIT_STYLES, 'traje');
const myShip = () => myStyle(SHIP_STYLES, 'nave');
const suitById = (id) => SUIT_STYLES.find((x) => x.id === id) || null;

function chooseStyle(key, id) {
  if (key === 'mascota') { if (setPetKind(id)) renderWardrobe(); return; }
  const list = key === 'traje' ? SUIT_STYLES : SHIP_STYLES;
  const s = list.find((x) => x.id === id);
  if (!s) return;
  if (!styleUnlocked(s.unlock)) { toast(`🔒 Se desbloquea con: ${unlockText(s.unlock)}.`); return; }
  styleSel[key] = id;
  try { localStorage.setItem(STYLE_KEY, JSON.stringify(styleSel)); } catch (_) { /* nada */ }
  if (typeof NET !== 'undefined' && NET.on) NET.presAt = 0;
  if (typeof chunkCache !== 'undefined') chunkCache.clear();
  renderWardrobe();
}

// Muestrita del traje: el personaje dibujado de arriba
function suitPreview(s) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.scale(2, 2);
  drawAvatar(g, { ang: -Math.PI / 2, moving: false, step: 0 }, 16, 17, s.light, s.dark, s.visor);
  return c.toDataURL();
}

// Muestrita de la mascota
function petPreview(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.scale(2.6, 2.6);
  const t0 = time; time = 0;
  drawPet(g, { x: 11 / TILE, y: 12.5 / TILE, ang: -Math.PI / 2, anim: 'idle', kind, color: 0, food: 1, level: 1 }, false);
  time = t0;
  return c.toDataURL();
}

function renderWardrobe() {
  const el = $('ropero-body');
  if (!el) return;
  const card = (key, s, img) => {
    const on = (key === 'traje' ? mySuit() : myShip()).id === s.id;
    const ok = styleUnlocked(s.unlock);
    return `<button type="button" class="style-card${on ? ' on' : ''}${ok ? '' : ' locked'}" data-style="${key}" data-v="${s.id}">
      ${img}<b>${s.name}</b><span class="small ${ok ? 'muted' : ''}">${on ? '✔ Usando' : ok ? 'Elegir' : '🔒 ' + unlockText(s.unlock)}</span></button>`;
  };
  let h = '<h3>🧑‍🚀 Traje</h3><div class="style-grid">';
  for (const s of SUIT_STYLES) h += card('traje', s, `<img src="${suitPreview(s)}" alt="" width="48" height="48">`);
  h += '</div><h3>🚀 Nave</h3><div class="style-grid">';
  for (const s of SHIP_STYLES) h += card('nave', s, `<span class="ship-swatch" style="background:linear-gradient(135deg, ${s.hull[0]}, ${s.hull[1]} 55%, ${s.hull[2]})"><i style="background:${s.stripe}"></i></span>`);
  h += '</div><h3>🐾 Mascota</h3><div class="style-grid">';
  const curPet = (S && S.player && S.player.pet && !S.player.pet.gone && S.player.pet.kind) || styleSel.mascota || 'perro';
  for (const k of PET_KINDS) {
    const ok = petKindOk(k), on = curPet === k.id;
    h += `<button type="button" class="style-card${on ? ' on' : ''}${ok ? '' : ' locked'}" data-style="mascota" data-v="${k.id}">
      <img src="${petPreview(k.id)}" alt="" width="48" height="48"><b>${k.name}</b><span class="small ${ok ? 'muted' : ''}">${on ? '✔ Usando' : ok ? 'Elegir' : '🔒 ' + unlockText(k.unlock)}</span></button>`;
  }
  h += '</div><p class="muted small">El nombre y el color se cambian en ☰ → 🐕 Perrito. Los colores especiales vienen con el Pack de estilos.</p>';
  const packs = [!owns('mascotas') && '<button type="button" class="primary" data-shop-open="1">🐾 Ver el Pack de mascotas</button>', !owns('estilos') && '<button type="button" data-shop-open="1">🎨 Ver el Pack de estilos</button>'].filter(Boolean);
  if (packs.length) h += `<div class="actions">${packs.join('')}</div>`;
  el.innerHTML = h;
}

// --------------------------- Tienda ---------------------------

function renderShop() {
  const el = $('tienda-body');
  if (!el) return;
  let h = '';
  if (owns('fundador')) h += '<p class="ok">👑 Sos <b>Fundador</b>: tenés todo. ¡Gracias por apoyar el juego!</p>';
  h += '<div class="shop-list">';
  for (const id of SHOP_ORDER) {
    const it = SHOP[id];
    const have = owns(id);
    h += `<div class="shop-card${id === 'fundador' ? ' best' : ''}"><div class="shop-icon">${it.icon}</div>
      <div class="grow"><b>${it.name}</b>${id === 'fundador' ? ' <span class="tag">Lo mejor</span>' : ''}<div class="muted small">${it.desc}</div></div>
      ${have ? '<span class="ok small">✔ Lo tenés</span>' : `<button type="button" class="primary" data-buy="${id}">${it.price}</button>`}</div>`;
  }
  h += '</div>';
  h += '<p class="muted small">Las mejoras de ritmo (velocidad e investigación) funcionan jugando solo: en línea todos juegan igual. Los estilos se ven también en línea.</p>';
  h += '<div class="actions"><button type="button" data-restore="1">🔄 Recuperar compras</button><button type="button" data-redeem="1">🎟️ Canjear código</button><button type="button" data-ropero-open="1">👕 Guardarropa</button></div>';
  el.innerHTML = h;
}

// --------------------------- Botones de arriba ---------------------------

function updateShopChips() {
  const sp = $('speed-chip'), gi = $('gift-chip');
  if (sp) {
    sp.hidden = !(owns('velocidad') && soloBoosts());
    sp.textContent = '⏩ x' + speedNow();
    sp.classList.toggle('on', speedNow() > 1);
  }
  if (gi) gi.hidden = !giftReady();
}
setInterval(updateShopChips, 5000);

function initShop() {
  if (IS_APP) {
    admobInit();
    if (window.CdvPurchase) nativeStoreInit();
    else document.addEventListener('deviceready', nativeStoreInit, { once: true });
  } else {
    adsInit();
    loadPrices();
    restorePurchases(true);
  }
  $('btn-tienda').addEventListener('click', () => openModal('tienda'));
  $('btn-ropero').addEventListener('click', () => openModal('ropero'));
  $('gift-chip').addEventListener('click', () => openModal('regalo'));
  $('speed-chip').addEventListener('click', () => { gameSpeed = gameSpeed >= 3 ? 1 : gameSpeed + 1; updateShopChips(); toast(gameSpeed > 1 ? `⏩ Velocidad x${gameSpeed}` : 'Velocidad normal'); });
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-buy],[data-restore],[data-redeem],[data-gift],[data-style],[data-shop-open],[data-ropero-open]');
    if (!t) return;
    if (t.dataset.buy) buy(t.dataset.buy);
    else if (t.dataset.restore) restorePurchases(false);
    else if (t.dataset.redeem) redeemCode();
    else if (t.dataset.gift) claimGift(t.dataset.gift);
    else if (t.dataset.style) chooseStyle(t.dataset.style, t.dataset.v);
    else if (t.dataset.shopOpen) openModal('tienda');
    else if (t.dataset.roperoOpen) openModal('ropero');
  });
  updateShopChips();
}
