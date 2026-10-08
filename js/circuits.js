'use strict';
// =====================================================================
//  Cables rojo y verde, y combinadores (como en Factorio)
//  Cada cable une dos edificios. Los edificios unidos por cables del mismo
//  color forman una red: todo lo que se pone en la red se suma.
//  Los combinadores tienen entrada (atrás) y salida (adelante); el resultado
//  sale en el tick siguiente.
// =====================================================================

const WIRE_REACH = 10;               // largo máximo de un cable (entre postes, lo que alcance el poste)
const WIRE_COST = { cable: 1, circuit: 1 };
const COMBINATORS = new Set(['arith', 'decider', 'constant']);
const VSIGNALS = ['sig_A', 'sig_B', 'sig_C', 'sig_D', 'sig_E'];
const VSIGNAL_NAMES = { sig_A: 'Señal A', sig_B: 'Señal B', sig_C: 'Señal C', sig_D: 'Señal D', sig_E: 'Señal E' };
const WIRE_COLORS = { r: '#e5534b', g: '#4cc25a' };
const WIRE_NAMES = { r: 'rojo', g: 'verde' };

const signalName = (s) => VSIGNAL_NAMES[s] || (ITEMS[s] && ITEMS[s].name) || s;
const POLE_TYPES = new Set(['pole', 'mediumpole', 'substation', 'bigpole']);
// ¿Se le puede conectar un cable?
function wireable(e) {
  if (!e || isEnemyB(e)) return false;
  return COMBINATORS.has(e.type) || e.type === 'sensor' || e.type === 'hub' || POLE_TYPES.has(kindOf(e.type)) || POLE_TYPES.has(e.type) ||
    CONDITIONABLE.has(e.type) || !!e.store || e.type === 'fluidtank' || e.type === 'accumulator';
}
// Punto donde se engancha el cable (los combinadores: entrada atrás, salida adelante)
function wirePoint(e, term) {
  const s = sizeOf(e.type) / 2;
  let x = e.x + s, y = e.y + s;
  if (term === 'i' || term === 'o') {
    const [dx, dy] = DIRS[e.dir || 0], k = term === 'o' ? 0.3 : -0.3;
    x += dx * k; y += dy * k;
  }
  return { x, y };
}
const wireTermOf = (e, term) => (COMBINATORS.has(e.type) && e.type !== 'constant' ? term || 'i' : 'm');

// --------------------------- Conectar y desconectar ---------------------------

function wireMaxLen(a, b) {
  const pr = (e) => (POLE_TYPES.has(e.type) || POLE_TYPES.has(kindOf(e.type)) ? poleReach(e) : 0);
  return Math.max(WIRE_REACH, Math.min(pr(a) || WIRE_REACH, pr(b) || WIRE_REACH));
}

function hasWire(a, at_, b, bt, c) {
  return (a.w || []).some((w) => w.c === c && w.m === at_ && w.t === bt && w.x === b.x && w.y === b.y);
}

// Une a (terminal at_) con b (terminal bt) con un cable del color c. Devuelve un mensaje de error o null.
function connectWire(a, at_, b, bt, c, free = false) {
  if (!a || !b || a === b) return 'Elegí otro edificio.';
  if (!wireable(b)) return 'Ese edificio no se conecta a cables.';
  const pa = wirePoint(a, at_), pb = wirePoint(b, bt);
  if (wdist(pa.x, pa.y, pb.x, pb.y) > wireMaxLen(a, b) + 0.6) return `Está muy lejos: un cable llega hasta ${wireMaxLen(a, b)} casillas (poné postes en el medio).`;
  if (hasWire(a, at_, b, bt, c)) return 'Ya están conectados con ese color.';
  if (!free) {
    for (const k in WIRE_COST) if (avail(k) < WIRE_COST[k]) return `Cada cable lleva ${costText(WIRE_COST)}.`;
    for (const k in WIRE_COST) takeItem(k, WIRE_COST[k]);
  }
  (a.w = a.w || []).push({ x: b.x, y: b.y, t: bt, m: at_, c });
  (b.w = b.w || []).push({ x: a.x, y: a.y, t: at_, m: bt, c });
  wiresDirty = true;
  return null;
}

function disconnectWire(a, i) {
  const w = a.w && a.w[i];
  if (!w) return;
  a.w.splice(i, 1);
  const b = at(w.x, w.y);
  if (b && b.w) {
    const j = b.w.findIndex((o) => o.c === w.c && o.m === w.t && o.t === w.m && o.x === a.x && o.y === a.y);
    if (j >= 0) b.w.splice(j, 1);
    if (typeof netTouch === 'function') netTouch(b);
  }
  refund(WIRE_COST);
  wiresDirty = true;
}

// Al desarmar un edificio se devuelven sus cables
function dropWires(e) {
  if (!e.w || !e.w.length) return;
  for (let i = e.w.length - 1; i >= 0; i--) disconnectWire(e, i);
}

// --------------------------- Redes ---------------------------

let wiresDirty = true;
let wireNets = [];          // [{ c, sig: {}, next: {} }]
let wireNodeNet = new Map(); // "x,y,term,color" -> índice de red
let wiredEnts = [];          // edificios con algún cable
let wireEntCount = -1;

const wkey = (e, term, c) => e.x + ',' + e.y + ',' + term + ',' + c;

function rebuildWireNets() {
  wiresDirty = false;
  wireEntCount = S.entities.length;
  wireNets = [];
  wireNodeNet = new Map();
  wiredEnts = S.entities.filter((e) => e.w && e.w.length);
  // Un combinador sin cables no da salida
  for (const e of S.entities) if (e.cout && !(e.w && e.w.length)) { e.cout = null; e.active = false; }
  for (const e of wiredEnts) {
    // Se limpian los cables a edificios que ya no están
    e.w = e.w.filter((w) => { const b = at(w.x, w.y); return b && b.x === w.x && b.y === w.y; });
    for (const w of e.w) {
      const k0 = wkey(e, w.m, w.c);
      if (wireNodeNet.has(k0)) continue;
      // Recorre toda la red de este nodo
      const id = wireNets.length;
      wireNets.push({ c: w.c, sig: {}, next: {} });
      const stack = [[e, w.m]];
      wireNodeNet.set(k0, id);
      while (stack.length) {
        const [q, term] = stack.pop();
        for (const v of q.w || []) {
          if (v.c !== w.c || v.m !== term) continue;
          const b = at(v.x, v.y);
          if (!b) continue;
          const kb = wkey(b, v.t, v.c);
          if (wireNodeNet.has(kb)) continue;
          wireNodeNet.set(kb, id);
          stack.push([b, v.t]);
        }
      }
    }
  }
}

// Lo que llega a un terminal: la suma de su red roja y su red verde
function wireInput(e, term) {
  const out = {};
  for (const c of ['r', 'g']) {
    const id = wireNodeNet.get(wkey(e, term, c));
    if (id === undefined) continue;
    const s = wireNets[id].sig;
    for (const k in s) out[k] = (out[k] || 0) + s[k];
  }
  return out;
}
function wireSignal(e, term, sig) {
  let v = 0;
  for (const c of ['r', 'g']) {
    const id = wireNodeNet.get(wkey(e, term, c));
    if (id !== undefined) v += wireNets[id].sig[sig] || 0;
  }
  return v;
}

// Lo que un edificio pone en sus cables
function wireOutputOf(e) {
  switch (e.type) {
    case 'constant': {
      if (e.on === false) return null;
      const o = {};
      for (const c of e.consts || []) if (c && c.s && c.v) o[c.s] = (o[c.s] || 0) + c.v;
      return o;
    }
    case 'arith': case 'decider': return e.cout || null;
    case 'sensor': return e.value ? { [e.item && e.item !== '*' ? e.item : 'sig_A']: e.value } : null;
    case 'hub': { const o = {}; for (const k in S.inv) if (S.inv[k] >= 1) o[k] = Math.floor(S.inv[k]); return o; }
    case 'accumulator': return { sig_A: Math.round(100 * (e.stored || 0) / BUILDINGS.accumulator.capacity) };
    case 'fluidtank': { const n = fnets[e._fnet]; return n && n.fluid && n.amount >= 1 ? { [n.fluid]: Math.floor(n.amount) } : null; }
    default:
      if (e.store) { const o = {}; for (const k in e.store) if (e.store[k] > 0) o[k] = e.store[k]; return o; }
      return null;
  }
}

const COMPARE = {
  '<': (a, b) => a < b, '>': (a, b) => a > b, '=': (a, b) => a === b,
  '≠': (a, b) => a !== b, '≤': (a, b) => a <= b, '≥': (a, b) => a >= b,
};
const ARITH = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b,
  '/': (a, b) => (b ? Math.trunc(a / b) : 0), '%': (a, b) => (b ? a % b : 0),
};

// Un paso: se arman las señales de cada red y los combinadores calculan su salida (para el próximo paso)
function circuitTick() {
  if (wiresDirty || wireEntCount !== S.entities.length) rebuildWireNets();
  if (!wireNets.length) return;
  for (const n of wireNets) n.sig = {};
  for (const e of wiredEnts) {
    const o = wireOutputOf(e);
    if (!o) continue;
    const term = COMBINATORS.has(e.type) && e.type !== 'constant' ? 'o' : 'm';
    for (const c of ['r', 'g']) {
      const id = wireNodeNet.get(wkey(e, term, c));
      if (id === undefined) continue;
      const s = wireNets[id].sig;
      for (const k in o) s[k] = (s[k] || 0) + o[k];
    }
  }
  for (const e of wiredEnts) {
    if (e.type !== 'arith' && e.type !== 'decider') continue;
    const inp = wireInput(e, 'i');
    const cfg = e.cfg || {};
    const a = inp[cfg.a] || 0;
    const b = cfg.bs ? inp[cfg.bs] || 0 : +cfg.b || 0;
    const out = cfg.out || 'sig_A';
    if (e.type === 'arith') {
      const v = cfg.a ? (ARITH[cfg.op] || ARITH['+'])(a, b) : 0;
      e.cout = v ? { [out]: v } : null;
    } else {
      const ok = cfg.a && (COMPARE[cfg.op] || COMPARE['>'])(a, b);
      e.cout = ok ? { [out]: cfg.mode === 'in' ? inp[out] || 0 : 1 } : null;
    }
    e.active = !!e.cout;
  }
}
