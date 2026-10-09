'use strict';
// =====================================================================
//  Juego en línea con CÓDIGO DE SALA (fuera de Claude, por ejemplo en
//  GitHub Pages). Conexión directa entre navegadores (WebRTC, con PeerJS
//  para el primer contacto). El anfitrión es el centro: reenvía la
//  presencia de cada uno y guarda los datos compartidos en memoria.
//  Imita las capacidades room/db/user de Claude, así el resto del juego
//  en línea (online.js) funciona sin cambios.
// =====================================================================

const P2P = {
  standalone: !window.claude,   // dentro de Claude se usa la sala de Claude
  peer: null, host: false, code: null, me: null, uid: null,
  conns: new Map(),             // anfitrión: peer → conexión
  hostConn: null,               // invitado: conexión al anfitrión
  status: '', error: '',
};
const P2P_PREFIX = 'minifabrica-';
const P2P_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0/O ni 1/I
const P2P_PART = 15000;                                  // tamaño de cada pedazo de mensaje

function p2pUid() {
  let id = null;
  try { id = localStorage.getItem('mini-fabrica-p2p-id'); } catch (_) { /* nada */ }
  if (!id) {
    id = 'j' + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem('mini-fabrica-p2p-id', id); } catch (_) { /* nada */ }
  }
  return id;
}

const p2pNameUid = (n) => 'n_' + String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 24);

function p2pNewCode() {
  let c = '';
  for (let i = 0; i < 8; i++) c += P2P_ALPHA[Math.floor(Math.random() * P2P_ALPHA.length)];
  return c;
}
const p2pPretty = (c) => c.slice(0, 4) + '-' + c.slice(4);
const p2pClean = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

function p2pLoadLib() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res;
    s.onerror = () => rej(new Error('No se pudo cargar la librería de conexión'));
    document.head.appendChild(s);
  });
}

// --------------------------- Mensajes en pedazos ---------------------------

let p2pMsgId = 0;
function p2pSend(conn, msg) {
  if (!conn || !conn.open) return;
  const s = JSON.stringify(msg);
  if (s.length <= P2P_PART) { conn.send(s); return; }
  const id = ++p2pMsgId, n = Math.ceil(s.length / P2P_PART);
  for (let i = 0; i < n; i++) conn.send(JSON.stringify({ t: '~', id, i, n, s: s.slice(i * P2P_PART, (i + 1) * P2P_PART) }));
}
function p2pReceiver(onMsg) {
  const parts = new Map();
  return (raw) => {
    let m;
    try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { return; }
    if (m && m.t === '~') {
      let p = parts.get(m.id);
      if (!p) { p = []; parts.set(m.id, p); }
      p[m.i] = m.s;
      if (p.filter((x) => x !== undefined).length === m.n) { parts.delete(m.id); try { onMsg(JSON.parse(p.join(''))); } catch (_) { /* nada */ } }
      return;
    }
    onMsg(m);
  };
}

// --------------------------- Salas (presencia) ---------------------------
// Cada sala guarda quién está y la presencia de cada uno. El anfitrión tiene
// la verdad; los invitados tienen una copia que el anfitrión mantiene al día.

const p2pRooms = new Map();   // nombre → { members: Map(peer → {by, presence, at}), listeners: Set, objs }
function p2pRoomState(name) {
  let r = p2pRooms.get(name);
  if (!r) { r = { members: new Map(), listeners: new Set() }; p2pRooms.set(name, r); }
  return r;
}
function p2pPeersOf(name) {
  const r = p2pRoomState(name);
  return [...r.members.entries()].map(([peer, o]) => ({
    peer, by: o.by, isMe: peer === P2P.me, sameTab: peer === P2P.me, kind: 'viewer', guest: false, presence: o.presence || {}, updatedAt: o.at,
  }));
}
function p2pFire(name, joined = [], left = []) {
  const r = p2pRoomState(name);
  const peers = p2pPeersOf(name);
  for (const fn of r.listeners) { try { fn({ peers, joined, left, updated: [] }); } catch (_) { /* nada */ } }
}
function p2pApplyPres(name, peer, by, presence) {
  const r = p2pRoomState(name);
  const isNew = !r.members.has(peer);
  r.members.set(peer, { by, presence, at: Date.now() });
  p2pFire(name, isNew ? p2pPeersOf(name).filter((p) => p.peer === peer) : []);
}
function p2pApplyLeave(name, peer) {
  const r = p2pRoomState(name);
  const was = p2pPeersOf(name).filter((p) => p.peer === peer);
  if (r.members.delete(peer)) p2pFire(name, [], was);
}

// Anfitrión: avisar a los demás miembros de una sala
function p2pHostRelay(name, msg, except) {
  const r = p2pRoomState(name);
  for (const peer of r.members.keys()) {
    if (peer === P2P.me || peer === except) continue;
    p2pSend(P2P.conns.get(peer), msg);
  }
}

function p2pMakeRoom(name) {
  let left = false;
  const room = {
    name,
    peers: () => p2pPeersOf(name),
    presence: (patch) => {
      if (left) return Promise.resolve();
      const r = p2pRoomState(name);
      const cur = (r.members.get(P2P.me) || {}).presence || {};
      const n = { ...cur };
      for (const k in patch) { if (patch[k] === null) delete n[k]; else n[k] = patch[k]; }
      p2pApplyPres(name, P2P.me, P2P.uid, n);
      const msg = { t: 'p', room: name, peer: P2P.me, by: P2P.uid, presence: n };
      if (P2P.host) p2pHostRelay(name, msg);
      else p2pSend(P2P.hostConn, msg);
      return Promise.resolve();
    },
    onPeers: (fn) => {
      const r = p2pRoomState(name);
      r.listeners.add(fn);
      setTimeout(() => { if (r.listeners.has(fn)) fn({ peers: p2pPeersOf(name), joined: p2pPeersOf(name), left: [], updated: [] }); }, 0);
      return () => r.listeners.delete(fn);
    },
    emit: () => Promise.resolve(), on: () => () => {}, connected: () => !left, onConnection: () => () => {},
    leave: async () => {
      if (left) return;
      left = true;
      p2pApplyLeave(name, P2P.me);
      p2pRoomState(name).listeners.clear();
      const msg = { t: 'l', room: name, peer: P2P.me };
      if (P2P.host) p2pHostRelay(name, msg); else p2pSend(P2P.hostConn, msg);
    },
    join: async (n) => p2pJoinRoom(n),
  };
  return room;
}

function p2pJoinRoom(name) {
  // Se arranca vacío y el anfitrión manda quién está
  p2pApplyPres(name, P2P.me, P2P.uid, {});
  if (P2P.host) p2pHostRelay(name, { t: 'p', room: name, peer: P2P.me, by: P2P.uid, presence: {} });
  else p2pSend(P2P.hostConn, { t: 'j', room: name });
  return p2pMakeRoom(name);
}

// --------------------------- Datos compartidos (db) ---------------------------
// Lo de cada jugador (data/users/...) queda en su navegador; el resto lo
// guarda el anfitrión en memoria y cada invitado tiene una copia al día.

const p2pStore = new Map();          // path → body
const p2pLeases = new Map();         // path → {holder, exp}
const p2pDbListeners = new Set();    // {path} o {coll}
const p2pPending = new Map();        // id → resolver
let p2pReqId = 0;
const p2pIsMine = (path) => path.startsWith('data/users/');

function p2pLocalGet(path) {
  if (p2pIsMine(path)) { try { const v = localStorage.getItem('mfab-p2p:' + path); return v ? JSON.parse(v) : undefined; } catch (_) { return undefined; } }
  return p2pStore.get(path);
}
function p2pLocalSet(path, body) {
  if (p2pIsMine(path)) { try { localStorage.setItem('mfab-p2p:' + path, JSON.stringify(body)); } catch (_) { /* nada */ } }
  else p2pStore.set(path, body);
  const coll = path.split('/').slice(0, -1).join('/');
  for (const l of p2pDbListeners) if (l.path === path || l.coll === coll) l.fire();
}
function p2pSnap(path) {
  const v = p2pLocalGet(path);
  return { id: path.split('/').pop(), exists: v !== undefined, data: () => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))), metadata: { fromCache: false, hasPendingWrites: false } };
}
function p2pRequest(msg) {
  return new Promise((res) => {
    const id = ++p2pReqId;
    p2pPending.set(id, res);
    p2pSend(P2P.hostConn, { ...msg, rid: id });
    setTimeout(() => { if (p2pPending.has(id)) { p2pPending.delete(id); res(null); } }, 15000);
  });
}
function p2pHostSet(path, body, from) {
  p2pLocalSet(path, body);
  const msg = { t: 'db', path, body };
  for (const [peer, c] of P2P.conns) if (peer !== from) p2pSend(c, msg);
}
function p2pHostAcquire(path, holder, ttl) {
  const now = Date.now();
  const l = p2pLeases.get(path);
  if (l && l.exp > now && l.holder !== holder) return { acquired: false };
  p2pLeases.set(path, { holder, exp: now + (ttl || 30000) });
  return { acquired: true, holder };
}

const p2pDb = {
  collection: (coll) => ({
    onSnapshot: (next) => {
      const depth = coll.split('/').length + 1;
      const fire = () => {
        const docs = [];
        const keys = p2pIsMine(coll + '/') ? [] : [...p2pStore.keys()];
        for (const p of keys) if (p.startsWith(coll + '/') && p.split('/').length === depth) docs.push(p2pSnap(p));
        next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} });
      };
      const l = { coll, fire };
      p2pDbListeners.add(l);
      setTimeout(fire, 0);
      return () => p2pDbListeners.delete(l);
    },
  }),
  doc: (path) => ({
    path,
    get: async () => p2pSnap(path),
    set: async (data) => {
      const body = JSON.parse(JSON.stringify(data));
      if (p2pIsMine(path) || P2P.host) { if (P2P.host && !p2pIsMine(path)) p2pHostSet(path, body); else p2pLocalSet(path, body); return; }
      p2pLocalSet(path, body);    // se ve enseguida; el anfitrión lo confirma
      await p2pRequest({ t: 'set', path, body });
    },
    acquire: async ({ holder, ttlMs = 30000 }) => {
      if (P2P.host) return p2pHostAcquire(path, holder, ttlMs);
      const r = await p2pRequest({ t: 'acq', path, holder, ttl: ttlMs });
      return r || { acquired: false };
    },
    onSnapshot: (next) => {
      const l = { path, fire: () => next(p2pSnap(path)) };
      p2pDbListeners.add(l);
      setTimeout(l.fire, 0);
      return () => p2pDbListeners.delete(l);
    },
  }),
};

// --------------------------- Cuenta (user) ---------------------------

function p2pNickOf(uid) {
  for (const p of p2pPeersOf('lobby')) if (p.by === uid && p.presence && p.presence.n) return p.presence.n;
  return '';
}
const p2pUser = {
  id: async () => P2P.uid,
  me: async () => ({ id: P2P.uid, name: '', color: '#3987e5' }),
  can: async () => P2P.host || !!P2P.admin,       // el mundo lo lleva solo la compu que abrió la sala (o el servidor)
  canEdit: async () => P2P.host || !!P2P.admin,
  isOwner: async () => P2P.host,
  search: async () => [],
  profiles: async (ids) => Object.fromEntries([].concat(ids).map((i) => [i, { id: i, name: p2pNickOf(i), color: '#3987e5', isMe: i === P2P.uid }])),
};

// --------------------------- Conexión ---------------------------

// Servidores de ayuda para que la conexión pase aunque haya routers complicados
const P2P_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
function p2pPeerOptions() {
  return { debug: 0, config: { iceServers: P2P_ICE }, ...(window.P2P_SERVER || {}) };
}
// El servidor público: siempre el mismo código, así se entra con un botón
const P2P_PUBLIC = window.P2P_PUBLIC_CODE || 'ARCASERV';

function p2pOnHostMessage(conn, m) {
  const peer = conn.peer;
  switch (m.t) {
    case 'p': {   // presencia de un invitado en una sala
      p2pApplyPres(m.room, peer, m.by, m.presence);
      p2pHostRelay(m.room, { t: 'p', room: m.room, peer, by: m.by, presence: m.presence }, peer);
      break;
    }
    case 'j': {   // entra a una sala: se le manda quién está y se avisa a los demás
      const r = p2pRoomState(m.room);
      const by = (r.members.get(peer) || {}).by || conn.metadata && conn.metadata.uid;
      p2pApplyPres(m.room, peer, by, {});
      p2pSend(conn, { t: 'room', room: m.room, members: [...r.members.entries()].map(([pe, o]) => [pe, o.by, o.presence]) });
      p2pHostRelay(m.room, { t: 'p', room: m.room, peer, by, presence: {} }, peer);
      break;
    }
    case 'l':
      p2pApplyLeave(m.room, peer);
      p2pHostRelay(m.room, { t: 'l', room: m.room, peer }, peer);
      break;
    case 'set':
      p2pHostSet(m.path, m.body, peer);
      p2pSend(conn, { t: 'res', rid: m.rid, val: true });
      break;
    case 'acq':
      p2pSend(conn, { t: 'res', rid: m.rid, val: p2pHostAcquire(m.path, m.holder, m.ttl) });
      break;
  }
}

function p2pOnGuestMessage(m) {
  switch (m.t) {
    case 'p': p2pApplyPres(m.room, m.peer, m.by, m.presence); break;
    case 'l': p2pApplyLeave(m.room, m.peer); break;
    case 'room': {
      const r = p2pRoomState(m.room);
      for (const [pe, by, pres] of m.members) if (pe !== P2P.me) r.members.set(pe, { by, presence: pres || {}, at: Date.now() });
      p2pFire(m.room, p2pPeersOf(m.room).filter((p) => p.peer !== P2P.me));
      break;
    }
    case 'dump':
      for (const [path, body] of m.store) p2pStore.set(path, body);
      for (const l of p2pDbListeners) l.fire();
      break;
    case 'db': p2pLocalSet(m.path, m.body); break;
    case 'res': { const fn = p2pPending.get(m.rid); if (fn) { p2pPending.delete(m.rid); fn(m.val); } break; }
  }
}

function p2pHostDropPeer(peer) {
  P2P.conns.delete(peer);
  for (const [name, r] of p2pRooms) {
    if (!r.members.has(peer)) continue;
    p2pApplyLeave(name, peer);
    p2pHostRelay(name, { t: 'l', room: name, peer });
  }
}

function p2pSetStatus(s, err) { P2P.status = s; P2P.error = err || ''; if (!$('online').hidden) netRenderModal(); }

// Crear sala: este navegador es el anfitrión y el código es su dirección
// fixed: un código que no cambia (la compu servidor), así el link de siempre sigue sirviendo
async function p2pCreate(fixed) {
  if (P2P.peer) return true;
  p2pSetStatus('Creando sala…');
  try { await p2pLoadLib(); } catch (e) { p2pSetStatus('', e.message); return false; }
  P2P.uid = p2pUid();
  for (let tries = 0; tries < (fixed ? 25 : 4); tries++) {
    const code = fixed || p2pNewCode();
    // Recién recargada, la dirección vieja puede seguir ocupada unos segundos
    if (fixed && tries) { p2pSetStatus('Recuperando la sala ' + p2pPretty(fixed) + '…'); await new Promise((r) => setTimeout(r, 4000)); }
    const ok = await new Promise((res) => {
      const peer = new window.Peer(P2P_PREFIX + code, p2pPeerOptions());
      peer.on('open', (id) => { P2P.peer = peer; P2P.me = id; P2P.code = code; P2P.host = true; res(true); });
      peer.on('error', (err) => { if (!P2P.peer) { peer.destroy(); res(err && err.type === 'unavailable-id' ? 'again' : false); } else p2pSetStatus(P2P.status, 'Problema de conexión: ' + (err && err.type || err)); });
    });
    if (ok === true) break;
    if (ok === false) { p2pSetStatus('', 'No se pudo crear la sala. Revisá tu conexión a internet.'); return false; }
  }
  if (!P2P.peer) { p2pSetStatus('', 'No se pudo crear la sala.'); return false; }
  P2P.peer.on('connection', (conn) => {
    conn.on('open', () => {
      P2P.conns.set(conn.peer, conn);
      // El recién llegado recibe todos los datos compartidos y quién está en la sala general
      p2pSend(conn, { t: 'dump', store: [...p2pStore.entries()] });
      const by = conn.metadata && conn.metadata.uid;
      p2pApplyPres('lobby', conn.peer, by, {});
      p2pSend(conn, { t: 'room', room: 'lobby', members: [...p2pRoomState('lobby').members.entries()].map(([pe, o]) => [pe, o.by, o.presence]) });
      p2pHostRelay('lobby', { t: 'p', room: 'lobby', peer: conn.peer, by, presence: {} }, conn.peer);
      toast('🟢 Alguien se conectó con el código.');
      if (!$('online').hidden) netRenderModal();
    });
    conn.on('data', p2pReceiver((m) => p2pOnHostMessage(conn, m)));
    conn.on('close', () => { p2pHostDropPeer(conn.peer); if (!$('online').hidden) netRenderModal(); });
    conn.on('error', () => p2pHostDropPeer(conn.peer));
  });
  P2P.peer.on('disconnected', () => { try { P2P.peer.reconnect(); } catch (_) { /* nada */ } });
  p2pApplyPres('lobby', P2P.me, P2P.uid, {});
  await p2pStartGame();
  p2pSetStatus('Sala abierta');
  // Mi partida pasa a ser el mundo de la sala
  await netShareCurrent();
  netRenderModal();
  return true;
}

// Unirse con un código
async function p2pJoin(rawCode) {
  const code = p2pClean(rawCode);
  if (code.length !== 8) { p2pSetStatus('', 'El código tiene 8 letras y números.'); return false; }
  if (P2P.peer) p2pClose(true);
  p2pSetStatus('Conectando…');
  try { await p2pLoadLib(); } catch (e) { p2pSetStatus('', e.message); return false; }
  // Sin cuentas: cada jugador es su nombre. Así, desde la compu o desde el celular, sos el mismo
  // (tu base, tu personaje y donde lo dejaste).
  if (!NET.nick) { try { NET.nick = cleanNick(localStorage.getItem(NICK_KEY)); } catch (_) { /* nada */ } }
  if (!NET.nick) {
    const n = cleanNick(prompt('¿Cómo te llamás en el juego? Usá siempre el mismo nombre (en la compu y en el celular) para seguir con tu personaje y tu base.') || '');
    if (n.length < 2) { p2pSetStatus('', 'Para entrar escribí tu nombre de jugador.'); return false; }
    NET.nick = n;
    try { localStorage.setItem(NICK_KEY, n); } catch (_) { /* nada */ }
  }
  P2P.uid = P2P.asUid || p2pNameUid(NET.nick);
  const ok = await new Promise((res) => {
    const peer = new window.Peer(undefined, p2pPeerOptions());
    let done = false;
    const fail = (msg) => { if (done) return; done = true; peer.destroy(); p2pSetStatus('', msg); res(false); };
    const timer = setTimeout(() => fail('No responde nadie con ese código. Fijate que esté bien y que el anfitrión tenga la sala abierta.'), 15000);
    peer.on('error', (err) => { clearTimeout(timer); fail(err && err.type === 'peer-unavailable' ? 'No hay ninguna sala con ese código (o el anfitrión la cerró).' : 'No se pudo conectar: ' + (err && err.type || err)); });
    peer.on('open', (id) => {
      P2P.peer = peer; P2P.me = id; P2P.host = false; P2P.code = code;
      const conn = peer.connect(P2P_PREFIX + code, { reliable: true, metadata: { uid: P2P.uid } });
      conn.on('open', () => { clearTimeout(timer); if (done) return; done = true; P2P.hostConn = conn; res(true); });
      conn.on('data', p2pReceiver(p2pOnGuestMessage));
      conn.on('close', () => { if (P2P.hostConn === conn) p2pLostHost(); });
      conn.on('error', () => { if (P2P.hostConn === conn) p2pLostHost(); });
    });
  });
  if (!ok) { P2P.peer = null; return false; }
  p2pApplyPres('lobby', P2P.me, P2P.uid, {});
  await p2pStartGame();
  p2pSetStatus('Conectado');
  // Entrar al mundo del anfitrión en cuanto llegue
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    const wid = Object.keys(NET.worlds || {})[0];
    if (wid) { await netJoin(wid); return true; }
    await new Promise((r) => setTimeout(r, 300));
  }
  p2pSetStatus('Conectado', 'El anfitrión todavía no abrió su partida. Esperá un momento y tocá Unirme en su mundo.');
  return true;
}

// Instala las capacidades falsas y arranca el juego en línea de siempre
async function p2pStartGame() {
  const caps = { room: p2pMakeRoom('lobby'), db: p2pDb, user: p2pUser };
  window.claude = { use: async (n) => caps[n] || null, p2p: true };
  NET.p2p = true;
  await netInit();
}

function p2pLostHost() {
  if (!P2P.peer) return;
  if (P2P.ws) {
    const admin = P2P.admin;
    toast(admin ? 'Se cortó la conexión con el servidor. Reintento…' : '🔌 Se cortó la conexión con el servidor. Reintento solo…');
    p2pClose(true);
    wsRetry(admin, 0);
    return;
  }
  const code = P2P.code;
  toast('🔌 Se cortó la conexión con el anfitrión. Reintento solo…');
  p2pClose();
  p2pRetry(code, 0);
}
// Si el servidor se reinició (o se cortó internet), se vuelve a entrar solo durante unos minutos
function p2pRetry(code, n) {
  if (!code || n > 24 || P2P.peer) return;
  setTimeout(async () => {
    if (P2P.peer) return;
    if (!(await p2pJoin(code))) p2pRetry(code, n + 1);
  }, n ? 8000 : 3000);
}

// --------------------------- Servidor dedicado (la laptop) ---------------------------
// Cuando el juego se abre desde el servidor de la laptop, se conecta por WebSocket a ese
// servidor, que guarda el mundo en el disco y reparte lo de cada uno (igual que la sala con
// código, pero siempre prendido y sin depender de la conexión directa entre compus).
const ARCA_SERVER = !!window.ARCA_SERVER;
const wsUrl = () => (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';

async function wsConnect(admin) {
  if (P2P.peer) return true;
  if (!admin) {
    if (!NET.nick) { try { NET.nick = cleanNick(localStorage.getItem(NICK_KEY)); } catch (_) { /* nada */ } }
    if (!NET.nick) {
      const n = cleanNick(prompt('¿Cómo te llamás en el juego? Usá siempre el mismo nombre (en la compu y en el celular) para seguir con tu personaje y tu base.') || '');
      if (n.length < 2) { toast('Para entrar escribí tu nombre de jugador (☰ → 🌍 Entrar al servidor).'); return false; }
      NET.nick = n;
      try { localStorage.setItem(NICK_KEY, n); } catch (_) { /* nada */ }
    }
  }
  P2P.uid = admin ? 'servidor' : p2pNameUid(NET.nick);
  p2pSetStatus('Conectando al servidor…');
  const q = new URLSearchParams(location.search);
  const url = wsUrl() + '?uid=' + encodeURIComponent(P2P.uid) + (admin ? '&k=' + encodeURIComponent(q.get('k') || '') : '');
  const ok = await new Promise((res) => {
    let ws;
    try { ws = new WebSocket(url); } catch (_) { res(false); return; }
    const timer = setTimeout(() => { try { ws.close(); } catch (_) { /* nada */ } res(false); }, 12000);
    const conn = { peer: 'srv', open: false, send: (s) => { if (ws.readyState === 1) ws.send(s); }, close: () => ws.close() };
    const recv = p2pReceiver((m) => {
      if (m && m.t === 'hello') {
        clearTimeout(timer);
        P2P.me = m.peer; P2P.admin = !!m.admin; P2P.ws = true; P2P.host = false; P2P.code = 'SERVIDOR';
        P2P.peer = { destroy: () => { try { ws.close(); } catch (_) { /* nada */ } } };
        P2P.hostConn = conn; conn.open = true;
        res(true);
        return;
      }
      p2pOnGuestMessage(m);
    });
    ws.onmessage = (ev) => recv(ev.data);
    ws.onclose = () => { conn.open = false; clearTimeout(timer); if (P2P.hostConn === conn) p2pLostHost(); else res(false); };
    ws.onerror = () => {};
  });
  if (!ok) { p2pSetStatus('', 'No se pudo conectar con el servidor. Fijate que la laptop esté prendida.'); return false; }
  p2pApplyPres('lobby', P2P.me, P2P.uid, {});
  await p2pStartGame();
  p2pSetStatus('Conectado');
  if (P2P.admin) return wsBootServer();
  // Entrar al mundo del servidor en cuanto llegue
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const wid = Object.keys(NET.worlds || {})[0];
    if (wid && netWorldHostAlive(wid)) { await netJoin(wid); return NET.on; }
    await new Promise((r) => setTimeout(r, 400));
  }
  toast('El servidor todavía está arrancando el mundo. Probá de nuevo en un ratito (☰ → 🌍 Entrar al servidor).');
  return false;
}

// La pestaña del servidor: carga el mundo guardado (o arma uno nuevo) y lo lleva
async function wsBootServer() {
  await new Promise((r) => setTimeout(r, 1500));   // que lleguen los mundos guardados
  const wid = Object.keys(NET.worlds || {})[0];
  if (wid) await netJoin(wid);
  if (!NET.on) {
    const cfg = window.ARCA_NEW || {};
    startNewGame((Math.random() * 2 ** 31) | 0, !!cfg.peaceful, true, { ...defaultMapOpts(), size: cfg.size || 'enorme', multiBase: cfg.multiBase !== false });
    await netShareCurrent();
  }
  return startServerMode(true);
}

function wsRetry(admin, n) {
  if (n > 200 || P2P.peer) return;
  setTimeout(async () => { if (P2P.peer) return; if (!(await wsConnect(admin))) wsRetry(admin, n + 1); }, n ? 5000 : 2000);
}

// Links para entrar directo a la sala (el del dueño entra con su misma base)
function p2pLinks() {
  const base = location.origin + location.pathname;
  return { friend: `${base}?sala=${P2P.code}`, owner: `${base}?sala=${P2P.code}&yo=${encodeURIComponent(P2P.uid)}` };
}
// Al abrir el juego con ?sala=… se entra solo
function p2pFromUrl() {
  if (!P2P.standalone) return false;
  const q = new URLSearchParams(location.search);
  const code = p2pClean(q.get('sala'));
  if (code.length !== 8) return false;
  const yo = q.get('yo');
  if (yo && /^[A-Za-z0-9_-]{2,40}$/.test(yo)) P2P.asUid = yo;
  setTimeout(() => p2pJoin(code), 800);
  return true;
}

// Cerrar la sala o salir
function p2pClose(quiet) {
  if (NET.on) netLeave(quiet === true);
  for (const c of P2P.conns.values()) { try { c.close(); } catch (_) { /* nada */ } }
  P2P.conns.clear();
  if (P2P.hostConn) { try { P2P.hostConn.close(); } catch (_) { /* nada */ } }
  if (P2P.peer) { try { P2P.peer.destroy(); } catch (_) { /* nada */ } }
  Object.assign(P2P, { peer: null, hostConn: null, host: false, code: null, me: null, ws: false, admin: false });
  p2pRooms.clear(); p2pStore.clear(); p2pLeases.clear();
  delete window.claude;
  Object.assign(NET, { available: false, p2p: false, room: null, db: null, user: null, worlds: {}, lobby: [] });
  netUpdateChip();
  p2pSetStatus('');
}

// Panel de la ventana En línea cuando el juego está fuera de Claude
function p2pPanelHtml() {
  let h = '<h3>🔑 Jugar con código de sala</h3>';
  if (P2P.peer && P2P.host) {
    h += `<p>Pasale este código a tu amigo:</p><div class="p2p-code" id="p2p-code">${p2pPretty(P2P.code)}</div>` +
      '<div class="actions"><button type="button" data-p2p="copy">📋 Copiar código</button><button type="button" data-p2p="close">Cerrar sala</button></div>' +
      `<p class="muted small">Conectados: ${P2P.conns.size}. Dejá el juego abierto: tu compu lleva la partida.</p>`;
  } else if (P2P.peer) {
    h += `<p>🟢 Conectado a la sala <b>${p2pPretty(P2P.code)}</b>.</p><div class="actions"><button type="button" data-p2p="close">Salir de la sala</button></div>`;
  } else {
    h += (ARCA_SERVER ? '<div class="actions"><button type="button" class="primary" data-p2p="ws">🌍 Entrar al servidor</button></div>' : '') +
      '<div class="actions"><button type="button" class="primary" data-p2p="public">🌍 Entrar al servidor público</button></div>' +
      '<p class="muted small">Es el mundo que mantiene la compu servidor. Si no entra, fijate que esté prendida con el modo servidor.</p>' +
      '<p>O sin servidor: uno crea la sala y el otro escribe el código.</p>' +
      '<div class="actions"><button type="button" class="primary" data-p2p="create">Crear sala con mi partida</button></div>' +
      '<div class="net-nick"><label for="p2p-in">¿Te pasaron un código?</label><input id="p2p-in" type="text" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX"><button type="button" class="small-btn primary" data-p2p="join">Unirme</button></div>';
  }
  if (P2P.status && !P2P.peer) h += `<p class="muted small">${P2P.status}</p>`;
  if (P2P.error) h += `<p class="bad small">${P2P.error}</p>`;
  return h;
}

document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-p2p]');
  if (!b) return;
  const a = b.dataset.p2p;
  if (a === 'create') p2pCreate();
  else if (a === 'join') p2pJoin($('p2p-in').value);
  else if (a === 'public') p2pJoin(P2P_PUBLIC);
  else if (a === 'ws') wsConnect(false);
  else if (a === 'close') p2pClose();
  else if (a === 'copy') {
    try { await navigator.clipboard.writeText(p2pPretty(P2P.code)); toast('Código copiado.'); } catch (_) { toast('Código: ' + p2pPretty(P2P.code)); }
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'p2p-in') { ev.preventDefault(); p2pJoin(ev.target.value); }
});
