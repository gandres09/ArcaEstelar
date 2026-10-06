'use strict';
// =====================================================================
//  En línea: varios jugadores en la misma fábrica, en tiempo real.
//
//  Funciona cuando el juego se abre desde su link de Claude, con dos
//  capacidades de la página:
//  - room: quiénes están jugando ahora. Cada uno comparte su "presencia":
//    dónde está su personaje y las acciones que el anfitrión todavía no
//    confirmó (así no se pierde ninguna).
//  - db: el mundo guardado. El anfitrión (alguien con permiso de escritura
//    que ganó el turno) lleva la simulación verdadera y guarda una foto
//    del mundo cada pocos segundos.
//  Todos simulan en su compu para que se vea fluido; cada foto del
//  anfitrión corrige las diferencias y se vuelven a aplicar encima las
//  acciones que todavía no estaban en la foto.
// =====================================================================

const NET = {
  available: false, on: false, role: null,   // role: 'host' | 'client'
  sim: 0, applying: false,                   // contexto: adentro de la simulación / aplicando lo de otro
  cid: Math.random().toString(36).slice(2, 10),
  room: null, db: null, user: null, uid: null, canWrite: false, meta: null,
  out: [], touched: new Set(), shadow: null,
  seq: 0, pending: [], own: [],              // acciones propias: sin confirmar / historial
  // Anfitrión
  acks: {}, log: [], gs: 0, rej: [], lastSnap: 0, snapping: false, leaseAt: 0,
  // Invitado
  lastGs: 0, buf: [], rejDone: new Set(), snapVer: 0, loading: false, wanted: null, hostSeenAt: 0, lastHostAck: {},
  presAt: 0, avatars: new Map(), profiles: {}, worlds: {}, wid: null, wroom: null,
};

const NET_ME_KEY = 'mini-fabrica-online-yo';
const SNAP_EVERY = 8;          // segundos entre fotos del mundo
const LEASE_MS = 20000;        // el turno de anfitrión se renueva cada pocos segundos
const PRES_BYTES = 3800;       // la presencia tiene un máximo de 4 KiB

// ¿Lo que está pasando es una acción de este jugador que hay que mandar?
const netCapture = () => NET.on && !NET.applying && NET.sim === 0;

function netPush(a) { if (netCapture()) NET.out.push(a); }
function netTrainSchedule(t) { netPush({ k: 'ts', x: Math.round(t.x), y: Math.round(t.y), s: t.schedule || [] }); }
function netPlaced(e) { if (netCapture()) NET.out.push({ lazy: e }); }
function netTouch(e) { if (netCapture() && e) NET.touched.add(e); }

// Cambios en el inventario del Núcleo hechos por este jugador
function netInvDelta(before) {
  if (!netCapture() || !before) return;
  const d = {};
  let any = false;
  for (const k in S.inv) { const v = (S.inv[k] || 0) - (before[k] || 0); if (Math.abs(v) > 1e-9) { d[k] = Math.round(v * 1000) / 1000; any = true; } }
  for (const k in before) if (!(k in S.inv) && before[k]) { d[k] = -before[k]; any = true; }
  if (any) NET.out.push({ k: 'i', d });
}

// El estado de un edificio, para que los demás lo copien
function entFields(e) {
  const o = JSON.parse(JSON.stringify(e, saveReplacer));
  delete o.id; delete o.x; delete o.y; delete o.type;
  return o;
}

// Junta lo que hizo el jugador y le pone número a cada acción
function netFlush() {
  if (NET.shadow) netInvDelta(NET.shadow);
  for (const e of NET.touched) if (S.entities.includes(e)) NET.out.push({ k: 'e', t: e.type, x: e.x, y: e.y, f: entFields(e) });
  NET.touched.clear();
  if (!NET.out.length) return;
  for (let a of NET.out) {
    if (a.lazy) { const e = a.lazy; a = { k: 'p', t: e.type, x: e.x, y: e.y, d: e.dir, f: entFields(e) }; }
    const s = ++NET.seq;
    NET.own.push({ s, a });
    if (NET.role === 'host') NET.log.push({ g: ++NET.gs, c: NET.cid, a });
    else NET.pending.push({ s, a });
  }
  if (NET.own.length > 400) NET.own.splice(0, NET.own.length - 400);
  NET.out = [];
  NET.presAt = 0;   // mandar ya
}

// --------------------------- Aplicar acciones de otros ---------------------------

function netApply(a) {
  NET.applying = true;
  try {
    switch (a.k) {
      case 'p': {
        const e = place(a.t, a.x, a.y, a.d || 0, { silent: true, free: true });
        if (e && a.f && e.id) Object.assign(e, a.f);
        return !!e;
      }
      case 'r': { const e = at(a.x, a.y); if (e && e.type === a.t) removeEntity(e, { silent: true, noRefund: true }); return true; }
      case 'e': {
        const e = at(a.x, a.y);
        if (e && e.type === a.t && e.x === a.x && e.y === a.y) {
          Object.assign(e, a.f);
          powerDirty = true; fluidDirty = true; undergroundDirty = true;
        }
        return true;
      }
      case 'i': for (const k in a.d) S.inv[k] = Math.max(0, (S.inv[k] || 0) + a.d[k]); return true;
      case 'm': mineOre(a.x, a.y); return true;
      case 'c': chopTree(a.x, a.y); return true;
      case 'g': addGhost(a.t, a.x, a.y, a.d, { recipe: a.r, filter: a.f }); return true;
      case 'gx': removeGhostsIn(a.r); return true;
      case 'R': if (TECHS[a.id] && techAvailable(a.id) && S.research.current !== a.id) S.research = { current: a.id, progress: 0 }; return true;
      case 'L': {
        const y = at(a.x, a.y);
        if (y && (y.type === 'shipyard' || y.type === 'starport') && !launchAnim) { closeInspector(); startLaunch(y); }
        return true;
      }
      case 'tr': { const t = trainAt(a.x, a.y); if (t) removeTrain(t, true); return true; }
      case 'ts': { const t = trainAt(a.x, a.y); if (t && Array.isArray(a.s)) { t.schedule = a.s; t.si = 0; t._path = null; t.state = 'idle'; } return true; }
    }
    return true;
  } catch (err) {
    console.warn('acción en línea', a, err);
    return false;
  } finally {
    NET.applying = false;
  }
}

// --------------------------- Paso de red (cada cuadro) ---------------------------

function netTick(dt) {
  if (!NET.on) return;
  netFlush();
  const peers = NET.wroom.peers();
  if (NET.role === 'host') netHostProcess(peers);
  else netClientProcess(peers);
  NET.shadow = { ...S.inv };
  netUpdateAvatars(peers, dt);

  const now = performance.now();
  if (now - NET.presAt > 120) { NET.presAt = now; netSendPresence(); }
  if (NET.role === 'host') {
    if (now - NET.leaseAt > 7000) { NET.leaseAt = now; netRenewLease(); }
    if (now - NET.lastSnap > SNAP_EVERY * 1000 && !NET.snapping) { NET.lastSnap = now; netSnapshot(); }
  } else if (NET.canWrite && now - NET.hostSeenAt > LEASE_MS + 4000 && now - NET.leaseAt > 5000) {
    // Nadie está de anfitrión: si puedo, tomo el turno
    NET.leaseAt = now;
    netTryHost(false).then((ok) => { if (ok) { netLobbyPresence(); toast('🌐 Quedaste de anfitrión del mundo.'); } });
  }
}

function netHostProcess(peers) {
  for (const p of peers) {
    if (p.sameTab || p.kind !== 'viewer') continue;
    const pr = p.presence || {};
    if (typeof pr.cid !== 'string' || !Array.isArray(pr.q)) continue;
    const [s0, ...acts] = pr.q;
    let last = NET.acks[pr.cid] || 0;
    for (let i = 0; i < acts.length; i++) {
      const s = s0 + i;
      if (s <= last) continue;
      const a = acts[i];
      if (!a || typeof a.k !== 'string') continue;
      const ok = netApply(a);
      if (ok) NET.log.push({ g: ++NET.gs, c: pr.cid, a });
      else if (a.k === 'p') { NET.rej.push([pr.cid, s, a.t]); if (NET.rej.length > 12) NET.rej.shift(); }
      last = s;
      NET.presAt = 0;
    }
    NET.acks[pr.cid] = last;
  }
  if (NET.log.length > 200) NET.log.splice(0, NET.log.length - 200);
}

function netClientProcess(peers) {
  const host = netHostPeer(peers);
  if (!host) return;
  NET.hostSeenAt = performance.now();
  const pr = host.presence;
  // Lo mío que ya confirmó
  const ack = pr.ack && pr.ack[NET.cid] || 0;
  if (pr.ack) NET.lastHostAck = pr.ack;
  if (ack) NET.pending = NET.pending.filter((x) => x.s > ack);
  // Lo que no pudo construir: devuelvo los materiales
  if (Array.isArray(pr.rej)) for (const [c, s, t] of pr.rej) {
    if (c !== NET.cid || NET.rejDone.has(s) || !BUILDINGS[t]) continue;
    NET.rejDone.add(s);
    const before = { ...S.inv };
    refund(BUILDINGS[t].cost);
    netInvDelta(before);
    toast(`Alguien construyó ahí primero: te devolví los materiales de ${BUILDINGS[t].name}.`);
  }
  // Lo que hicieron los demás
  if (Array.isArray(pr.log) && pr.log.length) {
    const [g0, ...entries] = pr.log;
    for (let i = 0; i < entries.length; i++) {
      const g = g0 + i, en = entries[i];
      if (g <= NET.lastGs || !Array.isArray(en)) continue;
      const [c, a] = en;
      if (c !== NET.cid && a) { netApply(a); NET.buf.push({ g, a }); }
      NET.lastGs = g;
    }
    if (NET.buf.length > 400) NET.buf.splice(0, NET.buf.length - 400);
  }
}

function netHostPeer(peers) {
  let best = null;
  for (const p of peers) {
    if (p.sameTab || !p.presence || p.presence.host !== 1) continue;
    if (!best || (NET.meta && p.presence.cid === NET.meta.host)) best = p;
  }
  return best;
}

// --------------------------- Presencia ---------------------------

function netPlayerState() {
  const p = S.player;
  if (!p) return null;
  const r = (v) => Math.round(v * 100) / 100;
  const d = p.pet;
  const pet = d && !d.gone ? [r(d.x), r(d.y), r(d.ang), Math.max(0, PET_ANIMS.indexOf(d.anim)), d.color | 0, Math.round(d.food * 100), d.level || 1] : [];
  return [r(p.x), r(p.y), r(p.ang), p.moving ? 1 : 0, p.mining ? 1 : 0, r(p.step || 0), ...pet];
}

function netSendPresence() {
  chatPrune();
  const pres = { cid: NET.cid, uid: NET.uid, n: NET.nick || null, pn: (S.player && S.player.pet && S.player.pet.name) || null, p: netPlayerState(), q: null, c: CHAT.out.length ? CHAT.out : null };
  if (NET.role === 'host') {
    pres.host = 1;
    pres.ver = NET.meta ? NET.meta.ver : 0;
    const here = new Set(NET.wroom.peers().map((p) => p.presence && p.presence.cid).filter(Boolean));
    pres.ack = {};
    for (const c in NET.acks) if (here.has(c)) pres.ack[c] = NET.acks[c];
    pres.rej = NET.rej;
    // El registro de lo último que pasó, recortado para que entre
    let n = Math.min(NET.log.length, 60);
    for (;;) {
      const tail = NET.log.slice(NET.log.length - n);
      pres.log = tail.length ? [tail[0].g, ...tail.map((x) => [x.c, x.a])] : null;
      if (JSON.stringify(pres).length <= PRES_BYTES || n === 0) break;
      n = Math.floor(n * 0.7);
    }
  } else {
    pres.host = null; pres.ack = null; pres.log = null; pres.rej = null;
    let n = Math.min(NET.pending.length, 60);
    for (;;) {
      const head = NET.pending.slice(0, n);
      pres.q = head.length ? [head[0].s, ...head.map((x) => x.a)] : null;
      if (JSON.stringify(pres).length <= PRES_BYTES || n === 0) break;
      n = Math.floor(n * 0.7);
    }
    // Una sola acción gigante (por ejemplo, un cofre muy lleno): se manda sin su contenido
    if (!pres.q && NET.pending.length) {
      const first = NET.pending[0];
      if (first.a.f) { first.a = { ...first.a, f: { dir: first.a.f.dir, recipe: first.a.f.recipe, filter: first.a.f.filter } }; }
    }
  }
  NET.wroom.presence(pres).catch(() => {});
}

// --------------------------- Fotos del mundo ---------------------------

async function netSnapshot() {
  if (NET.snapping || NET.role !== 'host') return;
  NET.snapping = true;
  try {
    flushFluids();
    const { player, pinv, ...rest } = S;
    const body = JSON.stringify({ s: rest, pollution: savePollution(), fog: encodeFog(), ore: encodeOre(), trees: encodeTrees(), acks: NET.acks, gs: NET.gs }, saveReplacer);
    const code = await gzipBase64(body);
    const CH = 200000, n = Math.max(1, Math.ceil(code.length / CH)), ver = Date.now();
    for (let i = 0; i < n; i++) await snapDoc(NET.wid, i).set({ ver, d: code.slice(i * CH, (i + 1) * CH) });
    const meta = { ver, chunks: n, host: NET.cid, hostUid: NET.uid, owner: NET.meta && NET.meta.owner || NET.uid, at: new Date().toISOString(),
      seed: S.seed, gs: NET.gs, stage: stageOf(), mapW: W, mapH: H, char: !!S.character };
    await worldDoc(NET.wid).set(meta);
    NET.meta = meta;
  } catch (err) {
    console.warn('No se pudo guardar el mundo en línea', err);
    if (err && err.code === 'quota_exceeded') toast('El mundo en línea llegó al límite de espacio.');
  } finally {
    NET.snapping = false;
  }
}

async function netReadSnapshot(meta) {
  const parts = [];
  for (let i = 0; i < meta.chunks; i++) {
    const d = await snapDoc(NET.wid, i).get();
    const v = d.exists ? d.data() : null;
    if (!v || v.ver !== meta.ver) return null;   // se está escribiendo otra: se espera la próxima
    parts.push(v.d);
  }
  return JSON.parse(await unpackCode(parts.join('')));
}

async function netLoadSnapshot(meta, first) {
  if (NET.loading) { NET.wanted = meta; return false; }
  NET.loading = true;
  let ok = false;
  try {
    const obj = await netReadSnapshot(meta);
    if (obj && (first || NET.role === 'client')) { applyShared(obj, first); NET.snapVer = meta.ver; ok = true; }
  } catch (err) {
    console.warn('No se pudo leer el mundo en línea', err);
  } finally {
    NET.loading = false;
  }
  if (NET.wanted) { const m = NET.wanted; NET.wanted = null; if (m.ver !== NET.snapVer) netLoadSnapshot(m, false); }
  return ok;
}

// Pone el mundo compartido, y deja intactos el personaje y la mochila propios
function applyShared(obj, first) {
  const st = obj.s;
  const mine = { player: S.player, pinv: S.pinv };
  const same = !first && S.seed === st.seed && W === (st.mapW || 320) && H === (st.mapH || 240) && oreBase;
  if (!same) {
    setMapSize(st.mapW || 320, st.mapH || 240);
    S = { ...newState(st.seed, st.peaceful, !!st.character), ...st };
    generateMap(S.seed);
    if (obj.ore) decodeOre(obj.ore);
    decodeTrees(obj.trees);
    loadPollution(obj.pollution);
    decodeFog(obj.fog);
    let me = null;
    try { me = JSON.parse(localStorage.getItem(NET_ME_KEY) || 'null'); } catch (_) { /* nada */ }
    S.pinv = me && me.seed === st.seed && me.pinv ? me.pinv : {};
    S.player = S.character ? (me && me.seed === st.seed && me.player ? me.player : newPlayer(W / 2 + 0.5 + (Math.random() - 0.5) * 4, H / 2 + 3.5)) : null;
    if (S.player) { S.player.path = null; S.player.queue = S.player.queue || []; S.player.craft = S.player.craft || []; }
    NET.lastGs = obj.gs || 0;
    NET.buf = [];
    undoStack.length = 0;
    const c = S.player || { x: W / 2, y: H / 2 };
    view.x = c.x * TILE; view.y = c.y * TILE;
    toolbarKey = '';
  } else {
    S = { ...newState(st.seed, st.peaceful, !!st.character), ...st, ...mine };
    applyOreCode(obj.ore);
    applyTrees(obj.trees);
    loadPollution(obj.pollution);
    mergeFog(obj.fog);
  }
  rebuildGrid();
  // Lo que pasó después de la foto se vuelve a aplicar encima
  const after = obj.gs || 0;
  for (const x of NET.buf) if (x.g > after) netApply(x.a);
  const myAck = (obj.acks && obj.acks[NET.cid]) || 0;
  for (const x of NET.own) if (x.s > myAck) netApply(x.a);
  NET.lastGs = Math.max(NET.lastGs, after);
  NET.shadow = { ...S.inv };
  netRemapRefs();
}

// Después de cambiar todo el estado, las referencias viejas apuntan a los edificios nuevos
function netRemapRefs() {
  const re = (e) => { if (!e || e.type === 'train') return null; const n = at(e.x, e.y); return n && n.type === e.type ? n : null; };
  if (inspected) { const n = inspected.type === 'train' ? S.trains.find((t) => t.id === inspected.id) : re(inspected); if (n) inspected = n; else closeInspector(); }
  for (const ops of undoStack) for (const op of ops) if (op.e) op.e = re(op.e) || op.e;
  if (dragging && dragging.placed) dragging.placed = re(dragging.placed);
  if (launchAnim) { const y = re(launchAnim.yard); if (y) launchAnim.yard = y; }
}

// --------------------------- Anfitrión ---------------------------

async function netRenewLease() {
  try {
    const r = await leaseDoc(NET.wid).acquire({ holder: NET.cid, ttlMs: LEASE_MS });
    if (!r.acquired && NET.role === 'host') {
      // Otro tomó el turno: paso a ser invitado
      NET.role = 'client';
      NET.lastGs = NET.gs;
      netLobbyPresence();
      toast('Otro jugador quedó de anfitrión.');
    }
  } catch (_) { /* se reintenta en la próxima */ }
}

// Intenta ser el anfitrión. fromLocal: el mundo es la partida que tengo cargada.
async function netTryHost(fromLocal) {
  if (!NET.canWrite) return false;
  let r;
  try { r = await leaseDoc(NET.wid).acquire({ holder: NET.cid, ttlMs: LEASE_MS }); } catch (_) { return false; }
  if (!r.acquired) return false;
  if (!fromLocal && !NET.on && NET.meta) {
    if (!(await netLoadSnapshot(NET.meta, true))) return false;
  }
  NET.role = 'host';
  NET.gs = Math.max(NET.gs, NET.lastGs);
  NET.acks = { ...NET.acks, ...NET.lastHostAck };
  NET.log = [];
  // Lo que tenía sin confirmar ya está en mi estado
  for (const x of NET.pending) NET.log.push({ g: ++NET.gs, c: NET.cid, a: x.a });
  NET.pending = [];
  NET.leaseAt = performance.now();
  NET.lastSnap = 0;
  return true;
}

// --------------------------- Mundos ---------------------------
// Cada jugador con permiso de edición puede tener su mundo: worlds/<id> (datos),
// leases/<id> (turno de anfitrión), snaps/<id>-c<n> (la foto en partes).

const worldDoc = (wid) => NET.db.doc('worlds/' + wid);
const leaseDoc = (wid) => NET.db.doc('leases/' + wid);
const snapDoc = (wid, i) => NET.db.doc('snaps/' + wid + '-c' + i);
const myWorldId = () => 'w-' + String(NET.uid || NET.cid).replace(/[^A-Za-z0-9_-]/g, '');

// Nombre de la sala de un mundo (solo minúsculas y números)
function roomNameOf(wid) {
  let h = 2166136261;
  for (let i = 0; i < wid.length; i++) { h ^= wid.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'w' + (h >>> 0).toString(36) + wid.length.toString(36);
}

async function netEnterRoom(wid) {
  if (NET.wroom && NET.wid === wid) return true;
  if (NET.wroom) { try { await NET.wroom.leave(); } catch (_) { /* ya no estaba */ } }
  NET.wid = wid;
  NET.meta = NET.worlds[wid] || null;
  try { NET.wroom = await NET.room.join(roomNameOf(wid)); } catch (_) { NET.wroom = null; return false; }
  NET.wroom.onPeers(() => { netResolveNames(); if (!$('online').hidden) netRenderModal(); }, () => {});
  return true;
}

function netResetSession() {
  NET.role = null; NET.pending = []; NET.own = []; NET.out = []; NET.touched.clear();
  NET.log = []; NET.buf = []; NET.acks = {}; NET.gs = 0; NET.lastGs = 0; NET.lastHostAck = {}; NET.snapVer = 0;
  NET.rej = []; NET.rejDone = new Set(); NET.avatars.clear();
}

// --------------------------- Entrar y salir ---------------------------

// Comparte la partida actual como "mi mundo" y quedo de anfitrión
async function netShareCurrent() {
  if (!NET.canWrite) { toast('Para tener tu propio mundo necesitás permiso de edición en el juego.'); return false; }
  if (NET.on) return true;   // ya estoy en un mundo: las invitaciones van a ese
  netResetSession();
  if (!(await netEnterRoom(myWorldId()))) { toast('No se pudo abrir la sala en línea.'); return false; }
  NET.meta = null;
  if (!(await netTryHost(true))) { toast('No se pudo: tu mundo ya tiene otro anfitrión abierto (¿otra pestaña?).'); return false; }
  netStart();
  await netSnapshot();
  netLobbyPresence();
  toast('🌐 Tu partida ahora es tu mundo en línea. Invitá a tus amigos desde 🌐 → Amigos.');
  if (!$('online').hidden) netRenderModal();
  return true;
}

async function netJoin(wid) {
  const meta = NET.worlds[wid];
  if (!meta) { toast('Ese mundo ya no está.'); return; }
  if (NET.on && NET.wid === wid) { closeModals(); return; }
  if (NET.on) netLeave(true); else save();   // la partida propia queda guardada aparte
  NET.busy = true;           // mientras se cambia de mundo no se guarda nada encima de la partida propia
  try { await netJoinInner(wid, meta); } finally { NET.busy = false; }
}

async function netJoinInner(wid, meta) {
  netResetSession();
  if (!(await netEnterRoom(wid))) return netJoinFail('No se pudo entrar a la sala del mundo.');
  const hostAlive = netWorldHostAlive(wid);
  let ok;
  if (NET.canWrite && !hostAlive) ok = await netTryHost(false);
  if (!ok) ok = await netLoadSnapshot(meta, true);
  if (!ok) return netJoinFail('No se pudo cargar el mundo. Probá de nuevo en unos segundos.');
  if (!NET.role) NET.role = 'client';
  netStart();
  netLobbyPresence();
  toast(NET.role === 'host' ? '🌐 Entraste al mundo. Sos el anfitrión.' : `🌐 Entraste al mundo de ${netNameOf(meta.owner)}.`);
  closeModals();
  updateUI();
}

// Si no se pudo entrar, se vuelve a la partida propia
function netJoinFail(msg) {
  if (NET.wroom) { NET.wroom.leave().catch(() => {}); NET.wroom = null; }
  NET.wid = null; NET.meta = null; NET.role = null;
  loadAsync().then((ok) => { if (!ok) startNewGame((Math.random() * 2 ** 31) | 0, false); toolbarKey = ''; updateUI(); });
  toast(msg);
}

// ¿Hay alguien de anfitrión en ese mundo? (se ve en la sala general)
function netWorldHostAlive(wid) {
  return NET.room.peers().some((p) => !p.sameTab && p.presence && p.presence.w === wid && p.presence.h === 1);
}

function netStart() {
  NET.on = true;
  NET.shadow = { ...S.inv };
  NET.hostSeenAt = performance.now();
  document.body.classList.add('online');
  netSendPresence();
  updateUI();
}

// quiet: se sale para entrar a otro mundo (no recarga la partida propia)
function netLeave(quiet) {
  const mine = netInMyWorld();
  if (NET.role === 'host') netSnapshot();
  if (mine) { NET.on = false; save(); cloudSave(true); }   // mi mundo = mi partida: queda tal cual
  else if (NET.on) netSaveMine();
  NET.on = false;
  if (NET.wroom) { NET.wroom.leave().catch(() => {}); NET.wroom = null; }
  NET.wid = null; NET.meta = null;
  netResetSession();
  document.body.classList.remove('online');
  if (quiet === true) return;
  closeModals();
  if (mine) {
    netLobbyPresence();
    toolbarKey = '';
    updateUI();
    toast('Cerraste tu mundo en línea. Seguís en tu misma partida, con todo lo que hicieron juntos.');
    return;
  }
  loadAsync().then((ok) => {
    if (!ok) startNewGame((Math.random() * 2 ** 31) | 0, false);
    netLobbyPresence();
    toolbarKey = '';
    updateUI();
  });
  toast('Volviste a tu partida.');
}

// ¿Estoy llevando MI mundo? Entonces el mundo en línea es mi partida de siempre:
// se guarda entera en el navegador y en la nube, igual que jugando solo.
function netInMyWorld() {
  return NET.on && NET.role === 'host' && NET.wid === myWorldId();
}

// Guarda lo propio (personaje y mochila) mientras se juega en línea
function netSaveMine() {
  try { localStorage.setItem(NET_ME_KEY, JSON.stringify({ seed: S.seed, player: S.player, pinv: S.pinv }, saveReplacer)); } catch (_) { /* sin almacenamiento */ }
  return true;
}

// --------------------------- Los otros jugadores ---------------------------

// --------------------------- Chat ---------------------------
// Cada uno manda sus últimos mensajes dentro de su presencia (así funciona
// igual dentro de Claude y con código de sala); los demás muestran los nuevos.

const CHAT = { out: [], seen: new Map(), log: [], unread: 0, open: false, mySay: null };
const CHAT_KEEP = 45000;   // un mensaje viaja en la presencia durante 45 s
const CHAT_MAX = 60;       // mensajes cortos: que no tapen la pantalla

function chatPrune() {
  const now = Date.now();
  while (CHAT.out.length && now - CHAT.out[0][0] > CHAT_KEEP) CHAT.out.shift();
}

function chatSend(text) {
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (!text || !NET.on) return false;
  let id = Date.now();
  if (CHAT.out.length && id <= CHAT.out[CHAT.out.length - 1][0]) id = CHAT.out[CHAT.out.length - 1][0] + 1;
  CHAT.out.push([id, text]);
  if (CHAT.out.length > 4) CHAT.out.shift();
  CHAT.mySay = { text, until: performance.now() + 6000 };
  chatAdd(NET.nick || 'Vos', text, true, netColor(NET.uid, NET.cid));
  NET.presAt = 0;   // que salga ya
  return true;
}

function chatReceive(peer, a, list) {
  if (!Array.isArray(list)) return;
  let last = CHAT.seen.get(peer);
  // Recién llegado: solo lo de los últimos segundos, no todo lo viejo
  if (last === undefined) last = Date.now() - 20000;
  for (const m of list) {
    if (!Array.isArray(m) || !(m[0] > last) || typeof m[1] !== 'string') continue;
    last = m[0];
    const text = m[1].replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
    if (!text) continue;
    const who = a.nick || netNameOf(a.by) || 'Jugador';
    a.say = text; a.sayUntil = performance.now() + 6000;
    chatAdd(who, text, false, netColor(a.by));
    if (!CHAT.open) { CHAT.unread++; toast(`💬 <b>${escapeHtml(who)}:</b> ${escapeHtml(text)}`); sfx('click'); }
  }
  CHAT.seen.set(peer, last);
}

function chatAdd(who, text, me, col) {
  CHAT.log.push({ who, text, me, col, t: Date.now() });
  if (CHAT.log.length > 60) CHAT.log.shift();
  chatRender();
}

function chatRender() {
  const chip = $('chat-chip');
  if (chip) {
    chip.hidden = !NET.on;
    $('chat-badge').hidden = !CHAT.unread;
    $('chat-badge').textContent = CHAT.unread > 9 ? '9+' : CHAT.unread;
  }
  if (!NET.on && CHAT.open) chatToggle(false);
  const box = $('chat-log');
  if (!box || !CHAT.open) return;
  box.innerHTML = CHAT.log.length
    ? CHAT.log.map((m) => `<div class="chat-msg${m.me ? ' me' : ''}"><b style="color:${m.col}">${escapeHtml(m.who)}</b> ${escapeHtml(m.text)}</div>`).join('')
    : '<p class="muted small">Todavía no hay mensajes. ¡Saludá!</p>';
  box.scrollTop = box.scrollHeight;
}

function chatToggle(force) {
  CHAT.open = force === undefined ? !CHAT.open : force;
  $('chat').hidden = !CHAT.open;
  if (CHAT.open) { CHAT.unread = 0; chatRender(); setTimeout(() => $('chat-in').focus(), 30); }
  chatRender();
}

function initChat() {
  $('chat-chip').addEventListener('click', () => chatToggle());
  $('chat-close').addEventListener('click', () => chatToggle(false));
  $('chat-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (chatSend($('chat-in').value)) $('chat-in').value = '';
  });
  // Escribir no mueve el personaje ni dispara atajos
  for (const t of ['keydown', 'keyup']) $('chat').addEventListener(t, (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') chatToggle(false); });
  setInterval(chatRender, 1000);
}

function netUpdateAvatars(peers, dt) {
  const seen = new Set();
  for (const p of peers) {
    if (p.sameTab || p.kind !== 'viewer' || !p.presence || !Array.isArray(p.presence.p)) continue;
    const [x, y, ang, moving, mining, step] = p.presence.p;
    if (![x, y].every(Number.isFinite)) continue;
    seen.add(p.peer);
    let a = NET.avatars.get(p.peer);
    if (!a) { a = { x, y }; NET.avatars.set(p.peer, a); }
    // Se acerca suave a la última posición conocida (por el lado corto del mapa)
    const k = Math.min(1, dt * 12);
    a.x = wrapX(a.x + wdx(x - a.x) * k); a.y = wrapY(a.y + wdy(y - a.y) * k);
    Object.assign(a, { ang, moving: !!moving, mining: !!mining, step, by: p.by || p.presence.uid || null, host: p.presence.host === 1, nick: cleanNick(p.presence.n) });
    // Su perro: se acerca suave y, si lo acarician o come, salen corazones
    const pp = p.presence.p;
    if (pp.length >= 12 && Number.isFinite(pp[6]) && Number.isFinite(pp[7])) {
      if (!a.pet) a.pet = { x: pp[6], y: pp[7], step: 0 };
      const pet = a.pet;
      const anim = PET_ANIMS[pp[9]] || 'idle';
      if ((anim === 'happy' || anim === 'eat' || anim === 'spin') && pet.anim !== anim && pet.anim !== 'spin' && pet.anim !== 'happy') spawnHearts(pet.x, pet.y, 3);
      const px = pet.x;
      pet.x = wrapX(pet.x + wdx(pp[6] - pet.x) * k); pet.y = wrapY(pet.y + wdy(pp[7] - pet.y) * k);
      pet.step += Math.abs(wdx(pet.x - px)) * 3 + dt * (anim === 'walk' ? 8 : 0);
      Object.assign(pet, { ang: pp[8], anim, color: Math.max(0, Math.min(3, pp[10] | 0)), food: (pp[11] | 0) / 100, level: Math.max(1, Math.min(10, pp[12] | 0)), name: cleanNick(p.presence.pn) || 'Perrito' });
    } else a.pet = null;
    chatReceive(p.peer, a, p.presence.c);
  }
  for (const k of NET.avatars.keys()) if (!seen.has(k)) NET.avatars.delete(k);
}

async function netResolveNames() {
  if (!NET.user || !NET.user.profiles) return;
  const ids = [...new Set([...[...NET.avatars.values()].map((a) => a.by), ...NET.friends,
    ...NET.lobby.map((p) => p.by || (p.presence && p.presence.uid)), ...Object.values(NET.worlds).map((m) => m.owner)].filter(Boolean))];
  if (!ids.length) return;
  try { Object.assign(NET.profiles, await NET.user.profiles(ids)); } catch (_) { /* sin nombres */ }
}

function netPlayerCount() {
  if (!NET.wroom) return 0;
  return NET.wroom.peers().filter((p) => p.kind === 'viewer' && p.presence && p.presence.cid).length;
}

// --------------------------- Amigos e invitaciones ---------------------------
// Los amigos se guardan en este dispositivo (y en tu espacio privado del juego si se puede).
// Invitar no usa mensajes: se anota en tu presencia de la sala general y la otra persona lo ve.

const FRIENDS_KEY = 'mini-fabrica-amigos';
NET.friends = [];
NET.invites = [];          // invitaciones que mandé: [uid, wid, hora]
NET.seenInv = new Set();   // las que ya me mostraron
NET.lobby = [];            // quiénes tienen el juego abierto

function netLoadFriends() {
  try { NET.friends = JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]').filter((x) => typeof x === 'string'); } catch (_) { NET.friends = []; }
  if (NET.uid) {
    NET.db.doc('data/users/' + NET.uid + '/amigos').get().then((d) => {
      const ids = d.exists && Array.isArray(d.data().ids) ? d.data().ids : [];
      const all = [...new Set([...NET.friends, ...ids.filter((x) => typeof x === 'string')])];
      if (all.length !== NET.friends.length) { NET.friends = all; netSaveFriends(); }
    }).catch(() => {});
  }
}

function netSaveFriends() {
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(NET.friends)); } catch (_) { /* sin almacenamiento */ }
  if (NET.uid) NET.db.doc('data/users/' + NET.uid + '/amigos').set({ ids: NET.friends }).catch(() => {});
}

function netAddFriend(uid) {
  if (!uid || uid === NET.uid || NET.friends.includes(uid)) return;
  NET.friends.push(uid);
  netSaveFriends();
  netResolveNames();
  toast(`👋 ${netNameOf(uid)} ahora es tu amigo.`);
}

function netRemoveFriend(uid) {
  NET.friends = NET.friends.filter((x) => x !== uid);
  netSaveFriends();
}

// Lo que todos ven de mí en la sala general: en qué mundo estoy y a quién invité
function netLobbyPresence() {
  if (!NET.room) return;
  const now = Date.now();
  NET.invites = NET.invites.filter((x) => now - x[2] < 120000);
  NET.room.presence({
    cid: NET.cid, uid: NET.uid, n: NET.nick || null,
    w: NET.on ? NET.wid : null, h: NET.on && NET.role === 'host' ? 1 : null,
    inv: NET.invites.length ? NET.invites : null,
  }).catch(() => {});
}

async function netInvite(uid) {
  if (!uid) return;
  // Hace falta estar en un mundo: si no, comparto el mío
  if (!NET.on && !(await netShareCurrent())) return;
  NET.invites = NET.invites.filter((x) => x[0] !== uid);
  NET.invites.push([uid, NET.wid, Date.now()]);
  if (NET.invites.length > 8) NET.invites.shift();
  netLobbyPresence();
  toast(`📨 Invitaste a ${netNameOf(uid)}. Le aparece un aviso para unirse.`);
}

// ¿Alguien me invitó?
function netCheckInvites() {
  if (!NET.uid) return;
  for (const p of NET.lobby) {
    if (p.sameTab || !p.presence || !Array.isArray(p.presence.inv)) continue;
    for (const inv of p.presence.inv) {
      if (!Array.isArray(inv) || inv[0] !== NET.uid) continue;
      const key = p.peer + ':' + inv[2];
      if (NET.seenInv.has(key)) continue;
      NET.seenInv.add(key);
      if (NET.on && NET.wid === inv[1]) continue;
      netShowInvite(p.by || p.presence.uid, inv[1]);
    }
  }
}

function netShowInvite(from, wid) {
  const box = $('invite');
  if (!box) return;
  box.dataset.wid = wid;
  box.dataset.from = from || '';
  box.innerHTML = `<span>🌐 <b></b> te invita a su mundo</span>` +
    '<button type="button" class="primary" data-inv="join">Unirme</button><button type="button" data-inv="no">Ahora no</button>';
  box.querySelector('b').textContent = netNameOf(from);
  box.hidden = false;
  sfx('research');
}

function netNameOf(uid) {
  if (!uid) return 'Alguien';
  if (uid === NET.uid) return NET.nick || 'vos';
  if (NET.nicks[uid]) return NET.nicks[uid];
  const p = NET.profiles[uid];
  return (p && p.name) || 'Un jugador';
}

// --------------------------- Nombre de usuario ---------------------------
// Cada jugador elige su nombre; viaja en su presencia y se ve arriba de su personaje.

const NICK_KEY = 'mini-fabrica-nombre', NICKS_KEY = 'mini-fabrica-apodos';
NET.nick = '';
NET.nicks = {};   // último nombre conocido de cada persona (para los amigos desconectados)

function cleanNick(s) {
  return String(s || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

async function netLoadNick() {
  try { NET.nick = cleanNick(localStorage.getItem(NICK_KEY)); } catch (_) { NET.nick = ''; }
  try { NET.nicks = JSON.parse(localStorage.getItem(NICKS_KEY) || '{}') || {}; } catch (_) { NET.nicks = {}; }
  if (!NET.nick && NET.uid) {
    try { const d = await NET.db.doc('data/users/' + NET.uid + '/perfil').get(); if (d.exists) NET.nick = cleanNick(d.data().nombre); } catch (_) { /* nada */ }
  }
  // Primera vez: arranca con el nombre de la cuenta, y se puede cambiar
  if (!NET.nick && NET.user && NET.user.me) {
    try { NET.nick = cleanNick((await NET.user.me()).name.split(' ')[0]); } catch (_) { /* nada */ }
  }
}

function netSetNick(s) {
  const n = cleanNick(s);
  if (n.length < 2) { toast('El nombre tiene que tener al menos 2 letras o números.'); return false; }
  NET.nick = n;
  try { localStorage.setItem(NICK_KEY, n); } catch (_) { /* sin almacenamiento */ }
  if (NET.uid && NET.db) NET.db.doc('data/users/' + NET.uid + '/perfil').set({ nombre: n }).catch(() => {});
  netLobbyPresence();
  if (NET.on) netSendPresence();
  toast(`Tu nombre ahora es <b>${escapeHtml(n)}</b>.`);
  return true;
}

// Anota los nombres que van apareciendo en las presencias
function netLearnNicks(peers) {
  let changed = false;
  for (const p of peers) {
    const uid = p.by || (p.presence && p.presence.uid);
    const n = p.presence && cleanNick(p.presence.n);
    if (uid && n && uid !== NET.uid && NET.nicks[uid] !== n) { NET.nicks[uid] = n; changed = true; }
  }
  if (changed) { try { localStorage.setItem(NICKS_KEY, JSON.stringify(NET.nicks)); } catch (_) { /* sin almacenamiento */ } }
}

// Qué está haciendo alguien según su presencia en la sala general
function netStatusOf(uid) {
  const p = NET.lobby.find((x) => !x.sameTab && (x.by === uid || (x.presence && x.presence.uid === uid)));
  if (!p) return { online: false, text: 'desconectado' };
  const w = p.presence && p.presence.w;
  if (!w) return { online: true, text: 'jugando su partida' };
  const meta = NET.worlds[w];
  const owner = meta && meta.owner;
  if (NET.on && w === NET.wid) return { online: true, text: 'en este mundo', w };
  return { online: true, text: owner === uid ? 'en su mundo' : `en el mundo de ${netNameOf(owner)}`, w };
}

// --------------------------- Ventana "En línea" ---------------------------

function netNickHtml() {
  return `<div class="net-nick"><label for="net-nick">Tu nombre de jugador</label><input id="net-nick" type="text" maxlength="16" autocomplete="off" placeholder="Elegí un nombre" value="${escapeHtml(NET.nick || '')}"><button type="button" class="small-btn" data-nick="1">Guardar</button></div>` +
    (NET.nick ? '' : '<p class="bad small">Elegí un nombre: es el que ven los demás arriba de tu personaje.</p>');
}

function netRenderModal() {
  const box = $('online-body');
  if (!box) return;
  if (!NET.available && typeof P2P !== 'undefined' && P2P.standalone) {
    if (!NET.nick) { try { NET.nick = cleanNick(localStorage.getItem(NICK_KEY)); } catch (_) { /* nada */ } }
    const typing = document.activeElement && document.activeElement.id === 'net-nick' ? $('net-nick').value : null;
    box.innerHTML = netNickHtml() + p2pPanelHtml();
    if (typing !== null) { const i = $('net-nick'); i.value = typing; i.focus(); }
    return;
  }
  if (!NET.available) {
    const dg = NET.diag || {};
    const ok = (v) => (v ? '✅' : v === false ? '❌' : '–');
    const diag = `<p class="muted small">Diagnóstico: dentro de Claude ${ok(dg.framed)} · sala en vivo ${ok(dg.room)} · datos ${ok(dg.db)} · cuenta ${ok(dg.user)} · identificado ${ok(dg.id)}</p>`;
    if (NET.why === 'top') {
      box.innerHTML = '<p><b>Abriste el juego como página suelta.</b> Así no hay juego en línea: abrilo <b>dentro de claude.ai</b> (desde la invitación o tu lista de artifacts), no con "abrir en pestaña nueva".</p>' + diag;
      return;
    }
    box.innerHTML = (NET.why === 'link'
      ? '<p><b>No te podés conectar en tiempo real desde este acceso.</b> Claude no deja jugar en línea a quien entra con el <b>link público</b> o sin iniciar sesión.</p>' +
        '<p>Para jugar juntos, el dueño del juego tiene que <b>invitarte por email</b> desde el botón <b>Compartir</b> del artifact. Entrá con tu cuenta de Claude y abrí el juego desde esa invitación.</p>' +
        '<p><b>¿Ya te invitaron por email y igual ves esto?</b> Pedile al dueño que en <b>Compartir</b> cambie el acceso general de "Cualquiera con el link" a <b>solo personas invitadas</b>: mientras el link público está activo, Claude puede tratar a todos como visitantes del link. Después recargá el juego.</p>' +
        '<p class="muted small">Igual podés jugar tu propia partida: se guarda en este navegador.</p>'
      : NET.why === 'error'
        ? '<p>No se pudo conectar con el servicio en línea. Probá recargar la página en un rato.</p>'
        : '<p>El juego en línea funciona cuando abrís Arca Estelar desde <b>su link de Claude</b>, con tu cuenta (no desde el archivo suelto).</p>') + diag;
    return;
  }
  const dot = (uid, cid) => `<span class="dot" style="background:${netColor(uid, cid)}"></span>`;
  const nm = (uid) => escapeHtml(netNameOf(uid));
  let h = NET.p2p ? p2pPanelHtml() : '';

  // Mi nombre
  h += netNickHtml();

  // Dónde estoy
  if (NET.on) {
    const mine = NET.wid === myWorldId();
    h += `<p>🟢 ${mine ? '<b>Estás en tu mundo</b>' : `<b>Estás en el mundo de ${nm(NET.meta && NET.meta.owner)}</b>`}${NET.role === 'host' ? ' · sos el anfitrión (tu compu lleva la simulación y lo guarda)' : ''}.</p>`;
    h += '<ul class="net-list">';
    h += `<li>${dot(NET.uid, NET.cid)}Vos${NET.role === 'host' ? ' · anfitrión' : ''}</li>`;
    for (const a of NET.avatars.values()) h += `<li>${dot(a.by)}${nm(a.by)}${a.host ? ' · anfitrión' : ''}${a.by && !NET.friends.includes(a.by) && a.by !== NET.uid ? ` <button type="button" class="small-btn" data-add="${escapeHtml(a.by)}">+ Amigo</button>` : ''}</li>`;
    h += '</ul>';
    if (!NET.p2p) h += `<div class="actions"><button type="button" data-leave="1">${netInMyWorld() ? 'Cerrar mi mundo en línea' : 'Salir y volver a mi partida'}</button></div>`;
  } else if (NET.canWrite) {
    h += '<p>Estás jugando tu partida. Podés convertirla en <b>tu mundo en línea</b> para que tus amigos entren.</p>';
    h += '<div class="actions"><button type="button" class="primary" data-share="1">Abrir mi partida en línea</button></div>';
    h += '<p class="muted small">Es siempre tu misma partida: lo que hagan juntos queda guardado en ella (en este navegador y en la nube), y cuando jugás solo seguís desde ahí.</p>';
  }

  // Con código de sala no hay cuentas: alcanza con lo de arriba
  if (!NET.p2p) {
  // Amigos
  h += '<h3>👥 Amigos</h3>';
  if (!NET.friends.length) h += '<p class="muted small">Todavía no agregaste amigos. Agregalos desde <b>Conectados ahora</b> o buscándolos acá abajo.</p>';
  else {
    h += '<ul class="net-list">';
    const sorted = [...NET.friends].sort((a, b) => netStatusOf(b).online - netStatusOf(a).online);
    for (const uid of sorted) {
      const st = netStatusOf(uid);
      let btns = '';
      if (st.online && !(NET.on && st.w === NET.wid)) btns += `<button type="button" class="small-btn primary" data-invite="${escapeHtml(uid)}">Invitar</button>`;
      if (st.w && !(NET.on && st.w === NET.wid) && NET.worlds[st.w]) btns += `<button type="button" class="small-btn" data-join="${escapeHtml(st.w)}">Unirme</button>`;
      h += `<li>${dot(uid)}<span class="grow">${nm(uid)} <span class="muted small">· ${st.online ? '🟢 ' : ''}${st.text}</span></span>${btns}<button type="button" class="small-btn close" data-unfriend="${escapeHtml(uid)}" title="Quitar">✕</button></li>`;
    }
    h += '</ul>';
  }
  h += '<div class="net-search"><input id="net-q" type="search" placeholder="Buscar persona por nombre…" autocomplete="off"><div id="net-results"></div></div>';
  h += '<details class="req-pick"><summary>¿Cómo invito a alguien que todavía no aparece?</summary>' +
    '<ol class="small"><li>Tocá <b>Compartir</b> arriba del juego (en Claude) e <b>invitalo por email</b>. Con el link público no se puede conectar en tiempo real.</li>' +
    '<li>Tu amigo entra con su cuenta de Claude y abre el juego desde la invitación.</li>' +
    '<li>Vos abrí <b>tu mundo</b> acá ("Compartir mi partida") y dejá el juego abierto: tu compu es la que lleva la partida.</li>' +
    '<li>Cuando tu amigo aparezca en <b>Conectados ahora</b>, agregalo y tocá <b>Invitar</b>.</li></ol></details>';

  // Conectados ahora que no son amigos
  const others = NET.lobby.filter((p) => !p.sameTab && p.kind === 'viewer' && (p.by || (p.presence && p.presence.uid)) && !NET.friends.includes(p.by || p.presence.uid));
  const seenU = new Set();
  const rows = [];
  for (const p of others) {
    const uid = p.by || p.presence.uid;
    if (uid === NET.uid || seenU.has(uid)) continue;
    seenU.add(uid);
    const st = netStatusOf(uid);
    const here = NET.on && st.w === NET.wid;
    rows.push(`<li>${dot(uid)}<span class="grow">${nm(uid)} <span class="muted small">· ${st.text}</span></span><button type="button" class="small-btn" data-add="${escapeHtml(uid)}">+ Amigo</button>${here ? '' : `<button type="button" class="small-btn primary" data-invite="${escapeHtml(uid)}">Invitar</button>`}</li>`);
  }
  if (rows.length) h += '<h3>🟢 Conectados ahora</h3><ul class="net-list">' + rows.join('') + '</ul>';

  // Mundos abiertos
  const worlds = Object.entries(NET.worlds).filter(([w]) => !(NET.on && w === NET.wid));
  if (worlds.length) {
    h += '<h3>🌍 Mundos</h3><ul class="net-list">';
    for (const [w, m] of worlds) {
      const n = NET.lobby.filter((p) => p.presence && p.presence.w === w).length;
      h += `<li>${dot(m.owner)}<span class="grow">${w === myWorldId() ? 'Tu mundo' : `Mundo de ${nm(m.owner)}`} <span class="muted small">· etapa ${Math.min(3, m.stage || 1)}/3 · ${n ? `${n} jugando` : 'nadie ahora'}</span></span><button type="button" class="small-btn" data-join="${escapeHtml(w)}">Entrar</button></li>`;
    }
    h += '</ul>';
  }

  h += '<p class="muted small">¿Alguien que todavía no tiene el juego? Invitalo por email desde el botón <b>Compartir</b> del artifact (necesita cuenta de Claude). Después ya aparece acá.</p>';
  }
  const q = $('net-q') && $('net-q').value;
  const typing = document.activeElement && document.activeElement.id === 'net-nick' ? $('net-nick').value : null;
  box.innerHTML = h;
  if (q) { $('net-q').value = q; }
  if (typing !== null) { const i = $('net-nick'); i.value = typing; i.focus(); i.setSelectionRange(typing.length, typing.length); }
}

let netSearchTimer = 0;
async function netSearch(q) {
  const out = $('net-results');
  if (!out) return;
  if (!NET.user || !NET.user.search) { out.innerHTML = '<p class="muted small">La búsqueda no está disponible acá.</p>'; return; }
  let res = [];
  try { res = await NET.user.search(q); } catch (_) { res = []; }
  res = res.filter((p) => p.id && !p.isMe).slice(0, 6);
  for (const p of res) NET.profiles[p.id] = p;
  out.innerHTML = res.length ? '<ul class="net-list">' + res.map((p) => `<li><span class="dot" style="background:${p.color || '#888'}"></span><span class="grow">${escapeHtml(p.name || 'Alguien')}</span>${NET.friends.includes(p.id) ? '<span class="muted small">ya es amigo</span>' : `<button type="button" class="small-btn" data-add="${escapeHtml(p.id)}">+ Amigo</button>`}</li>`).join('') + '</ul>'
    : (q ? '<p class="muted small">No encontré a nadie con ese nombre que tenga acceso al juego.</p>' : '');
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const NET_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#8a63c4'];
function netColor(by, fallback) {
  const pr = by && NET.profiles[by];
  if (pr && pr.color) return pr.color;
  const s = String(by || fallback || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return NET_COLORS[Math.abs(h) % NET_COLORS.length];
}

function netUpdateChip() {
  const chip = $('net-chip');
  if (!chip) return;
  chip.hidden = !NET.available;
  const friendsOn = NET.friends.filter((u) => netStatusOf(u).online).length;
  chip.textContent = NET.on ? `🌐 ${netPlayerCount() || 1}` : friendsOn ? `👥 ${friendsOn}` : '🌐';
  chip.title = NET.on ? 'En línea' : friendsOn ? `${friendsOn} amigo${friendsOn > 1 ? 's' : ''} conectado${friendsOn > 1 ? 's' : ''}` : 'Jugar en línea';
}

// --------------------------- Arranque ---------------------------


// Botones de la ventana En línea: se conectan una sola vez, aunque no haya conexión
let netUiBound = false;
function netBindUi() {
  if (netUiBound) return;
  netUiBound = true;
  // Botones de la ventana (se redibuja seguido: un solo manejador)
  $('online-body').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.share) {
      if (NET.worlds[myWorldId()] && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro? Tocá de nuevo'; b.classList.add('danger'); return; }
      netShareCurrent();
    }
    if (b.dataset.leave) netLeave();
    if (b.dataset.nick && netSetNick($('net-nick').value)) netRenderModal();
    if (b.dataset.join) netJoin(b.dataset.join);
    if (b.dataset.invite) netInvite(b.dataset.invite);
    if (b.dataset.add) { netAddFriend(b.dataset.add); netRenderModal(); }
    if (b.dataset.unfriend) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Quitar?'; return; }
      netRemoveFriend(b.dataset.unfriend); netRenderModal();
    }
  });
  $('online-body').addEventListener('keydown', (ev) => {
    if (ev.target.id === 'net-nick' && ev.key === 'Enter' && netSetNick(ev.target.value)) netRenderModal();
    ev.stopPropagation();   // que escribir no mueva el personaje
  });
  $('online-body').addEventListener('input', (ev) => {
    if (ev.target.id !== 'net-q') return;
    clearTimeout(netSearchTimer);
    const q = ev.target.value.trim();
    netSearchTimer = setTimeout(() => netSearch(q), 300);
  });
  $('invite').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-inv]');
    if (!b) return;
    const box = $('invite');
    box.hidden = true;
    if (b.dataset.inv === 'join') {
      if (box.dataset.from) netAddFriend(box.dataset.from);
      netJoin(box.dataset.wid);
    }
  });
}

async function netInit() {
  netBindUi();
  let framed = true;
  try { framed = window.top !== window; } catch (_) { framed = true; }
  NET.diag = { claude: !!(window.claude && typeof window.claude.use === 'function'), framed, room: null, db: null, user: null, id: null };
  if (!NET.diag.claude) return;
  // Cada capacidad por separado: si una falla, igual sabemos cuáles sí llegaron
  const tryUse = (n) => claude.use(n).catch(() => null);
  const [room, db, user] = await Promise.all([tryUse('room'), tryUse('db'), tryUse('user')]);
  Object.assign(NET.diag, { room: !!room, db: !!db, user: !!user });
  if (user) { try { NET.diag.id = !!(await user.id()); NET.diag.edit = await user.canEdit(); } catch (_) { /* nada */ } }
  // Sin sala: la plataforma no lo deja conectarse en tiempo real
  if (!room || !db) { NET.why = !framed ? 'top' : 'link'; return; }
  NET.room = room; NET.db = db; NET.user = user; NET.available = true;
  try { NET.uid = user ? await user.id() : null; } catch (_) { NET.uid = null; }
  try { NET.canWrite = user && user.can ? (await user.can('data.write')) !== false : true; } catch (_) { NET.canWrite = true; }
  netLoadFriends();
  await netLoadNick();
  room.onPeers((ch) => {
    NET.lobby = ch.peers;
    netLearnNicks(ch.peers);
    netResolveNames();
    netCheckInvites();
    // Avisar cuando se conecta un amigo
    for (const p of ch.joined || []) {
      const uid = p.by || (p.presence && p.presence.uid);
      if (!p.sameTab && uid && NET.friends.includes(uid) && NET.lobbyReady) toast(`🟢 ${netNameOf(uid)} se conectó.`);
    }
    netUpdateChip();
    if (!$('online').hidden) netRenderModal();
  }, () => {});
  setTimeout(() => { NET.lobbyReady = true; }, 3000);
  db.collection('worlds').onSnapshot((qs) => {
    const w = {};
    for (const d of qs.docs) if (d.exists) w[d.id] = d.data();
    NET.worlds = w;
    if (NET.wid) {
      NET.meta = w[NET.wid] || NET.meta;
      if (NET.on && NET.role === 'client' && NET.meta && NET.meta.ver !== NET.snapVer) netLoadSnapshot(NET.meta, false);
    }
    netUpdateChip();
    if (!$('online').hidden) netRenderModal();
  }, () => {});
  netLobbyPresence();
  watchSharedBlueprints();

  netUpdateChip();
}
