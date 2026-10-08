'use strict';
// =====================================================================
//  Modo servidor: una compu que queda siempre prendida hace de anfitrión
//  del mundo en línea. No dibuja el mapa (gasta poco) y sigue simulando
//  aunque la pestaña esté minimizada: un reloj en un Worker (que el
//  navegador no congela) empuja la simulación cuando la pestaña no se ve.
// =====================================================================

const SERVER_KEY = 'mini-fabrica-servidor';
const SERVER = { on: false, worker: null, timer: 0, last: 0, t0: 0, wake: null, ticks: 0, audio: null };

async function startServerMode(auto) {
  if (!NET.available) { toast('El modo servidor funciona abriendo el juego desde su link de Claude.'); return false; }
  if (NET.on && NET.role !== 'host') { toast('Para ser servidor tenés que estar en tu propio mundo (salí del mundo de tu amigo).'); return false; }
  if (!NET.on && !(await netShareCurrent())) return false;
  SERVER.on = true;
  SERVER.t0 = Date.now();
  SERVER.last = performance.now();
  try { localStorage.setItem(SERVER_KEY, '1'); } catch (_) { /* sin almacenamiento */ }
  // El reloj: un Worker (no lo congelan las pestañas ocultas); si no se puede, un intervalo común
  try {
    const url = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},50)'], { type: 'text/javascript' }));
    SERVER.worker = new Worker(url);
    SERVER.worker.onmessage = serverTick;
  } catch (_) { SERVER.timer = setInterval(serverTick, 50); }
  keepAwake();
  // Un sonido mudo: los navegadores no frenan las pestañas que están "sonando"
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { const ac = new AC(), o = ac.createOscillator(), g = ac.createGain(); g.gain.value = 0.00001; o.connect(g); g.connect(ac.destination); o.start(); SERVER.audio = ac; }
  } catch (_) { /* sin audio */ }
  document.body.classList.add('server-mode');
  closeModals();
  renderServerPanel();
  if (!auto) toast('🖥️ Esta compu es el servidor del mundo. Dejá la pestaña abierta (la podés minimizar).');
  return true;
}

function stopServerMode() {
  SERVER.on = false;
  try { localStorage.removeItem(SERVER_KEY); } catch (_) { /* nada */ }
  if (SERVER.worker) { SERVER.worker.terminate(); SERVER.worker = null; }
  if (SERVER.timer) { clearInterval(SERVER.timer); SERVER.timer = 0; }
  if (SERVER.wake) { SERVER.wake.release().catch(() => {}); SERVER.wake = null; }
  if (SERVER.audio) { SERVER.audio.close().catch(() => {}); SERVER.audio = null; }
  document.body.classList.remove('server-mode');
  const el = document.getElementById('server-panel');
  if (el) el.remove();
  toast('Esta compu dejó de ser el servidor.');
}

// Con la pestaña oculta, el bucle normal no corre: lo empuja este reloj (en pasos de 0,05 s)
function serverTick() {
  if (!SERVER.on) return;
  const now = performance.now();
  if (!document.hidden) { SERVER.last = now; return; }   // a la vista, avanza el bucle normal
  let el = Math.min(2, (now - SERVER.last) / 1000);
  SERVER.last = now;
  while (el > 0.001) {
    const dt = Math.min(0.05, el);
    el -= dt;
    try { netTick(dt); if (!launchAnim || launchAnim.t < 8) { update(dt); updateBackground(dt); } } catch (err) { console.warn('servidor', err); }
    SERVER.ticks++;
  }
  serverGuard();
}

// El personaje de la compu servidor no juega: queda a salvo en la Nave
function serverGuard() {
  if (S && S.player) { S.player.safeT = 5; S.player.hp = Math.max(S.player.hp || 1, 1); }
  if (NET.on && NET.role !== 'host' && NET.canWrite && performance.now() - NET.leaseAt > 5000) {
    NET.leaseAt = performance.now();
    netTryHost(false).then((ok) => { if (ok) netLobbyPresence(); });
  }
}

async function keepAwake() {
  try { if (navigator.wakeLock && !document.hidden) SERVER.wake = await navigator.wakeLock.request('screen'); } catch (_) { /* no se puede */ }
}
document.addEventListener('visibilitychange', () => { if (SERVER.on && !document.hidden && !SERVER.wake) keepAwake(); });

function renderServerPanel() {
  let el = document.getElementById('server-panel');
  if (!SERVER.on) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'server-panel';
    el.className = 'panel';
    document.body.appendChild(el);
    el.addEventListener('click', (ev) => { if (ev.target.closest('[data-srv="stop"]')) stopServerMode(); });
  }
  const up = Math.floor((Date.now() - SERVER.t0) / 1000);
  const hh = Math.floor(up / 3600), mm = Math.floor((up % 3600) / 60);
  const players = NET.wroom ? netLivePeers(NET.wroom.peers()).length : 0;
  el.innerHTML = `<h1>🖥️ Servidor del mundo</h1>
    <p class="${NET.on && NET.role === 'host' ? 'ok' : 'bad'}">${NET.on && NET.role === 'host' ? '● Funcionando: el mundo sigue andando' : '● Reconectando…'}</p>
    <div class="row"><span>Prendido hace</span><b>${hh} h ${mm} min</b></div>
    <div class="row"><span>Jugadores conectados</span><b>${players}</b></div>
    <div class="row"><span>Tiempo de juego del mundo</span><b>${Math.floor(S.playTime / 3600)} h ${Math.floor((S.playTime % 3600) / 60)} min</b></div>
    <p class="muted small">Dejá esta pestaña abierta (la podés minimizar). Configurá la compu para que no se suspenda. Ustedes entran desde el celular o desde otra compu con <b>En línea → Unirme</b>.</p>
    <div class="actions"><button type="button" data-srv="stop">Dejar de ser servidor</button></div>`;
}
setInterval(() => { if (SERVER.on) renderServerPanel(); }, 5000);

// Si la pestaña se recargó estando en modo servidor, vuelve sola
function serverAutoStart() {
  let on = false;
  try { on = localStorage.getItem(SERVER_KEY) === '1'; } catch (_) { /* nada */ }
  if (on) setTimeout(() => startServerMode(true), 2500);
}
