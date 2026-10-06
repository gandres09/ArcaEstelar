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
  presAt: 0, avatars: new Map(), profiles: {},
};

const NET_ME_KEY = 'mini-fabrica-online-yo';
const SNAP_EVERY = 8;          // segundos entre fotos del mundo
const LEASE_MS = 20000;        // el turno de anfitrión se renueva cada pocos segundos
const PRES_BYTES = 3800;       // la presencia tiene un máximo de 4 KiB

// ¿Lo que está pasando es una acción de este jugador que hay que mandar?
const netCapture = () => NET.on && !NET.applying && NET.sim === 0;

function netPush(a) { if (netCapture()) NET.out.push(a); }
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
  const peers = NET.room.peers();
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
    netTryHost(false);
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
  return [r(p.x), r(p.y), r(p.ang), p.moving ? 1 : 0, p.mining ? 1 : 0, r(p.step || 0)];
}

function netSendPresence() {
  const pres = { cid: NET.cid, uid: NET.uid, p: netPlayerState(), q: null };
  if (NET.role === 'host') {
    pres.host = 1;
    pres.ver = NET.meta ? NET.meta.ver : 0;
    const here = new Set(NET.room.peers().map((p) => p.presence && p.presence.cid).filter(Boolean));
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
  NET.room.presence(pres).catch(() => {});
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
    for (let i = 0; i < n; i++) await NET.db.doc('snap/c' + i).set({ ver, d: code.slice(i * CH, (i + 1) * CH) });
    const meta = { ver, chunks: n, host: NET.cid, hostUid: NET.uid, at: new Date().toISOString(), seed: S.seed, gs: NET.gs, stage: stageOf(), mapW: W, mapH: H };
    await NET.db.doc('world/meta').set(meta);
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
    const d = await NET.db.doc('snap/c' + i).get();
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
    const r = await NET.db.doc('world/lease').acquire({ holder: NET.cid, ttlMs: LEASE_MS });
    if (!r.acquired && NET.role === 'host') {
      // Otro tomó el turno: paso a ser invitado
      NET.role = 'client';
      NET.lastGs = NET.gs;
      toast('Otro jugador quedó de anfitrión.');
    }
  } catch (_) { /* se reintenta en la próxima */ }
}

// Intenta ser el anfitrión. fromLocal: el mundo es la partida que tengo cargada.
async function netTryHost(fromLocal) {
  if (!NET.canWrite) return false;
  let r;
  try { r = await NET.db.doc('world/lease').acquire({ holder: NET.cid, ttlMs: LEASE_MS }); } catch (_) { return false; }
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

// --------------------------- Entrar y salir ---------------------------

async function netShareCurrent() {
  if (!(await netTryHost(true))) { toast('No se pudo: otro jugador está de anfitrión o no tenés permiso para guardar.'); return; }
  netStart();
  await netSnapshot();
  toast('🌐 Tu partida ahora es un mundo en línea. Invitá a tus amigos desde Compartir.');
  netRenderModal();
}

async function netJoin() {
  if (!NET.meta) return;
  save();   // la partida propia queda guardada aparte
  const ok = (NET.canWrite && !netHostAlive()) ? await netTryHost(false) : await netLoadSnapshot(NET.meta, true);
  if (!ok && !NET.on && NET.role !== 'host') { toast('No se pudo cargar el mundo en línea. Probá de nuevo en unos segundos.'); return; }
  if (!NET.role) NET.role = 'client';
  netStart();
  toast(NET.role === 'host' ? '🌐 Entraste al mundo en línea. Sos el anfitrión.' : '🌐 Entraste al mundo en línea.');
  closeModals();
  updateUI();
}

function netHostAlive() {
  return NET.room.peers().some((p) => !p.sameTab && p.presence && p.presence.host === 1);
}

function netStart() {
  NET.on = true;
  NET.shadow = { ...S.inv };
  NET.hostSeenAt = performance.now();
  document.body.classList.add('online');
  netSendPresence();
  updateUI();
}

function netLeave() {
  if (NET.role === 'host') netSnapshot();
  save();
  NET.on = false; NET.role = null;
  NET.pending = []; NET.own = []; NET.out = []; NET.touched.clear(); NET.log = []; NET.buf = [];
  NET.room.presence({ p: null, q: null, host: null, ack: null, log: null, rej: null }).catch(() => {});
  document.body.classList.remove('online');
  if (!load()) startNewGame((Math.random() * 2 ** 31) | 0, false);
  toolbarKey = '';
  closeModals();
  updateUI();
  toast('Volviste a tu partida.');
}

// Guarda lo propio (personaje y mochila) mientras se juega en línea
function netSaveMine() {
  try { localStorage.setItem(NET_ME_KEY, JSON.stringify({ seed: S.seed, player: S.player, pinv: S.pinv }, saveReplacer)); } catch (_) { /* sin almacenamiento */ }
  return true;
}

// --------------------------- Los otros jugadores ---------------------------

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
    Object.assign(a, { ang, moving: !!moving, mining: !!mining, step, by: p.by || p.presence.uid || null, host: p.presence.host === 1 });
  }
  for (const k of NET.avatars.keys()) if (!seen.has(k)) NET.avatars.delete(k);
}

async function netResolveNames() {
  if (!NET.user || !NET.user.profiles) return;
  const ids = [...new Set([...NET.avatars.values()].map((a) => a.by).filter(Boolean))];
  if (!ids.length) return;
  try { Object.assign(NET.profiles, await NET.user.profiles(ids)); } catch (_) { /* sin nombres */ }
}

function netPlayerCount() {
  if (!NET.room) return 0;
  return NET.room.peers().filter((p) => p.kind === 'viewer' && p.presence && p.presence.cid).length;
}

// --------------------------- Ventana "En línea" ---------------------------

function netRenderModal() {
  const box = $('online-body');
  if (!box) return;
  let h = '';
  if (!NET.available) {
    h = '<p>El juego en línea funciona cuando abrís Mini Fábrica desde <b>su link de Claude</b> (no desde el archivo suelto).</p>' +
      '<p class="muted small">Para jugar con amigos: el dueño abre el juego, entra acá y comparte su partida. Después los invita por email desde <b>Compartir</b>.</p>';
  } else if (NET.on) {
    h += `<p>${NET.role === 'host' ? '🟢 <b>Sos el anfitrión:</b> tu compu lleva la simulación y guarda el mundo cada pocos segundos. Si te vas, otro jugador con permiso de edición toma la posta.' : '🟢 <b>Conectado</b> al mundo en línea.'}</p>`;
    h += '<h3>Jugando ahora</h3><ul class="net-list">';
    h += `<li><span class="dot" style="background:${netColor(NET.uid, NET.cid)}"></span>Vos${NET.role === 'host' ? ' · anfitrión' : ''}</li>`;
    for (const a of NET.avatars.values()) {
      const pr = a.by && NET.profiles[a.by];
      h += `<li><span class="dot" style="background:${netColor(a.by)}"></span>${escapeHtml((pr && pr.name) || 'Jugador')}${a.host ? ' · anfitrión' : ''}</li>`;
    }
    h += '</ul><p class="muted small">El Núcleo, la investigación y la fábrica son de todos. La mochila es de cada uno.</p>';
    h += '<div class="actions"><button type="button" id="net-leave">Salir y volver a mi partida</button></div>';
  } else {
    const m = NET.meta;
    if (m) {
      const n = netPlayerCount();
      h += `<p>Hay un <b>mundo en línea</b> (etapa ${Math.min(3, m.stage || 1)} de 3). ${n ? `<b>${n}</b> jugando ahora.` : 'Ahora no hay nadie jugando.'}</p>`;
      h += '<p class="muted small">Tu partida propia queda guardada aparte y volvés a ella cuando salís.</p>';
      h += '<div class="actions"><button type="button" class="primary" id="net-join">Unirme</button></div>';
      if (NET.canWrite) h += '<hr><p class="muted small">¿Querés que el mundo en línea sea tu partida actual? Se reemplaza el mundo compartido.</p><div class="actions"><button type="button" id="net-share">Usar mi partida actual</button></div>';
    } else if (NET.canWrite) {
      h += '<p>Todavía no hay un mundo en línea. Podés compartir <b>tu partida actual</b>: tus amigos entran a tu fábrica y juegan con vos.</p>';
      h += '<div class="actions"><button type="button" class="primary" id="net-share">Compartir mi partida</button></div>';
    } else {
      h += '<p>Todavía no hay un mundo en línea. Quien te invitó tiene que abrir el juego y compartir su partida desde acá.</p>';
    }
    h += '<p class="muted small">Para invitar amigos: botón <b>Compartir</b> del artifact → invitalos por email. Necesitan cuenta de Claude.</p>';
  }
  box.innerHTML = h;
  $('net-join')?.addEventListener('click', netJoin);
  $('net-leave')?.addEventListener('click', netLeave);
  $('net-share')?.addEventListener('click', () => {
    const b = $('net-share');
    if (NET.meta && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro? Tocá de nuevo para reemplazarlo'; b.classList.add('danger'); return; }
    netShareCurrent();
  });
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
  chip.hidden = !NET.available || (!NET.on && !NET.meta);
  chip.textContent = NET.on ? `🌐 ${netPlayerCount() || 1}` : '🌐 Unirme';
  chip.classList.toggle('warn', !NET.on && !!NET.meta);
}

// --------------------------- Arranque ---------------------------

async function netInit() {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  let room, db, user;
  try { [room, db, user] = await Promise.all([claude.use('room'), claude.use('db'), claude.use('user')]); } catch (_) { return; }
  if (!room || !db) return;
  NET.room = room; NET.db = db; NET.user = user; NET.available = true;
  try { NET.uid = user ? await user.id() : null; } catch (_) { NET.uid = null; }
  try { NET.canWrite = user && user.can ? (await user.can('data.write')) !== false : true; } catch (_) { NET.canWrite = true; }
  room.onPeers(() => {
    netResolveNames();
    if (!$('online').hidden) netRenderModal();
  }, () => {});
  let firstMeta = true;
  db.doc('world/meta').onSnapshot((snap) => {
    NET.meta = snap.exists ? snap.data() : null;
    if (NET.on && NET.role === 'client' && NET.meta && NET.meta.ver !== NET.snapVer) netLoadSnapshot(NET.meta, false);
    if (firstMeta && NET.meta && !NET.on) toast('🌐 Hay un mundo en línea. Tocá <b>🌐 Unirme</b> arriba para entrar.');
    firstMeta = false;
    netUpdateChip();
    if (!$('online').hidden) netRenderModal();
  }, () => {});
  netUpdateChip();
}
