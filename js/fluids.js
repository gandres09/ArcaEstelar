'use strict';
// =====================================================================
//  Líquidos: cañerías y tanques que forman redes de un solo líquido
// =====================================================================

const FLUIDS = new Set(['water', 'oil', 'steam', 'lubricant', 'petroleum_gas', 'heavy_oil', 'light_oil', 'sulfuric_acid']);
const FLUID_USERS = new Set(['boiler', 'steam_engine', 'chem', 'assembler', 'assembler2', 'assembler3', 'refinery', 'flameturret']);
const isPipe = (e) => !!e && (e.type === 'pipe' || e.type === 'fluidtank');
let fnets = [];
let fluidDirty = true;

// Guarda en cada caño su parte del líquido (para el guardado y al rearmar las redes)
function flushFluids() {
  for (const n of fnets) {
    for (const m of n.members) {
      m.ffluid = n.amount >= 1 ? n.fluid : null;
      m.famt = n.cap ? n.amount * BUILDINGS[m.type].capacity / n.cap : 0;
    }
  }
}

function rebuildFluids() {
  flushFluids();
  fluidDirty = false;
  fnets = [];
  const pipes = S.entities.filter(isPipe);
  for (const p of pipes) p._fnet = -1;
  for (const p of pipes) {
    if (p._fnet >= 0) continue;
    const id = fnets.length;
    const net = { fluid: null, amount: 0, cap: 0, members: [], users: [] };
    fnets.push(net);
    const stack = [p];
    p._fnet = id;
    const byFluid = {};
    const users = new Set();
    while (stack.length) {
      const q = stack.pop();
      net.members.push(q);
      net.cap += BUILDINGS[q.type].capacity;
      if (q.ffluid && q.famt > 0) byFluid[q.ffluid] = (byFluid[q.ffluid] || 0) + q.famt;
      const s = sizeOf(q.type);
      // Vecinos de todo el borde (los tanques son de 2×2)
      for (let i = 0; i < s; i++) {
        for (const [x, y] of [[q.x + i, q.y - 1], [q.x + i, q.y + s], [q.x - 1, q.y + i], [q.x + s, q.y + i]]) {
          const n = at(x, y);
          if (!n || n === q) continue;
          if (isPipe(n)) { if (n._fnet < 0) { n._fnet = id; stack.push(n); } }
          else if (FLUID_USERS.has(n.type)) users.add(n);
        }
      }
    }
    // Si se juntaron dos líquidos, se queda el que más había
    let best = null;
    for (const f in byFluid) if (!best || byFluid[f] > byFluid[best]) best = f;
    net.fluid = best;
    net.amount = best ? Math.min(net.cap, byFluid[best]) : 0;
    net.users = [...users];
  }
}

// Líquidos de las redes vecinas a una casilla (para no mezclar al construir)
function neighborFluids(x, y, s = 1) {
  if (fluidDirty) rebuildFluids();
  const found = new Set();
  for (let i = 0; i < s; i++) {
    for (const [nx, ny] of [[x + i, y - 1], [x + i, y + s], [x - 1, y + i], [x + s, y + i]]) {
      const n = at(nx, ny);
      if (isPipe(n) && fnets[n._fnet] && fnets[n._fnet].amount >= 1) found.add(fnets[n._fnet].fluid);
    }
  }
  return found;
}

function fluidAccept(t, item, dry) {
  if (!FLUIDS.has(item)) return false;
  if (fluidDirty) rebuildFluids();
  const net = fnets[t._fnet];
  if (!net || (net.fluid && net.amount >= 1 && net.fluid !== item) || net.amount + 1 > net.cap) return false;
  if (!dry) { net.fluid = item; net.amount += 1; }
  return true;
}

function updateFluids() {
  if (fluidDirty) rebuildFluids();
  for (const net of fnets) {
    if (net.amount < 1) { net.fluid = net.amount > 0 ? net.fluid : null; continue; }
    for (const u of net.users) {
      if (u._dead) continue;
      let n = 0;
      while (net.amount >= 1 && n < 4 && accept(u, net.fluid, null, true)) {
        accept(u, net.fluid, null);
        net.amount -= 1;
        n++;
      }
    }
  }
}

function emptyFluidNet(e) {
  const net = fnets[e._fnet];
  if (net) { net.amount = 0; net.fluid = null; }
}
