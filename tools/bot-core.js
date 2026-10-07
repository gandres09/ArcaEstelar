// Jugador automático: se inyecta en la página del juego (ver tools/bot.mjs).
// Construye líneas de minería y fundición con cintas reales hasta el Núcleo, una central de vapor,
// bombas de petróleo y agua, y un "centro de producción" de máquinas que alimenta con el inventario
// (como si tuviera una logística ideal). Investiga todo y arma la nave, y anota cuánto tarda cada etapa.
/* global S, at, oreAt, inBounds, place, canPlace, BUILDINGS, RECIPES, RECIPE_ORDER, SMELT, TECHS, TECH_ORDER,
   techAvailable, setResearch, nets, feedFrom, shipReady, update, add, DIRS, W, H, PACKS, SHIP, minerTile,
   oreAmountAt, ratePerMinute, sizeOf, eraIndex, ERAS, isUnlocked, canAfford, hasTech, removeEntity */
'use strict';
(function () {
  const BOT = window.BOT = { log: [], milestones: [], starved: {}, stats: [], lines: [] };
  const hubE = () => S.entities.find((e) => e.type === 'hub');
  let HX, HY;
  const fmtT = (s) => { const m = Math.floor(s / 60); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };
  const note = (msg) => BOT.log.push(`[${fmtT(S.playTime)}] ${msg}`);
  const milestone = (msg) => { BOT.milestones.push({ t: S.playTime, msg }); note('★ ' + msg); };
  const free = (x, y) => inBounds(x, y) && !at(x, y) && oreAt(x, y) !== 'water';
  const managed = { furnaces: [], boilers: [], mall: [], labs: [] };

  // ---------------- Cintas: búsqueda de camino hasta el Núcleo o una cinta que llegue a él ----------------

  function trunkSet() {
    const set = new Set();
    for (const e of S.entities) {
      if (e.type !== 'belt' && e.type !== 'fastbelt' && e.type !== 'expressbelt') continue;
      let cur = e, steps = 0;
      const chain = [];
      while (cur && steps++ < 600) {
        chain.push(cur);
        const [dx, dy] = DIRS[cur.dir];
        const nx = at(cur.x + dx, cur.y + dy);
        if (!nx) break;
        if (nx.type === 'hub' || set.has(nx)) { for (const c of chain) set.add(c); break; }
        if (nx.type !== 'belt' && nx.type !== 'fastbelt' && nx.type !== 'expressbelt') break;
        cur = nx;
      }
    }
    return set;
  }

  // Devuelve [{x,y,dir}] desde (sx,sy) hasta una casilla que entregue al Núcleo
  function route(sx, sy, blocked = null, maxNodes = 120000) {
    const trunk = trunkSet();
    const goalDir = (x, y) => {
      for (let d = 0; d < 4; d++) {
        const n = at(x + DIRS[d][0], y + DIRS[d][1]);
        if (!n) continue;
        if (n.type === 'hub') return d;
        if (trunk.has(n)) {
          const [fx, fy] = DIRS[n.dir];
          if (n.x + fx === x && n.y + fy === y) continue;          // no entrar por adelante
          if ((n.dir + 2) % 4 === d) continue;
          return d;
        }
      }
      return -1;
    };
    const idx = (x, y) => y * W + x;
    const g = new Map(), from = new Map();
    const heap = [];
    const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
    if (!free(sx, sy)) return null;
    const start = idx(sx, sy);
    g.set(start, 0);
    push(start, Math.abs(sx - HX) + Math.abs(sy - HY));
    let n = 0;
    while (heap.length && n++ < maxNodes) {
      const cur = pop();
      const cx = cur % W, cy = (cur / W) | 0;
      const gd = goalDir(cx, cy);
      if (gd >= 0) {
        const path = [];
        let k = cur;
        for (;;) { path.push({ x: k % W, y: (k / W) | 0 }); if (k === start) break; k = from.get(k); }
        path.reverse();
        for (let i = 0; i < path.length; i++) {
          if (i < path.length - 1) { const a = path[i], b = path[i + 1]; path[i].dir = b.x > a.x ? 0 : b.y > a.y ? 1 : b.x < a.x ? 2 : 3; }
          else path[i].dir = gd;
        }
        return path;
      }
      const gc = g.get(cur);
      for (let d = 0; d < 4; d++) {
        const x = cx + DIRS[d][0], y = cy + DIRS[d][1];
        if (!free(x, y) || (blocked && blocked.has(x + ',' + y))) continue;
        const o = oreAt(x, y);
        const ni = idx(x, y), ng = gc + 1 + (o && o !== 'oil' ? 3 : 0);
        if (ng < (g.get(ni) ?? Infinity)) { g.set(ni, ng); from.set(ni, cur); push(ni, ng + Math.abs(x - HX) + Math.abs(y - HY)); }
      }
    }
    return null;
  }

  function beltType() {
    return isUnlocked('fastbelt') && (S.inv.gear || 0) > 300 ? 'fastbelt' : 'belt';
  }

  // Coloca la cinta desde el Núcleo hacia afuera (así se va revelando el mapa)
  function placeRoute(path) {
    const bt = beltType();
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i];
      if (!place(bt, p.x, p.y, p.dir, { silent: true })) return false;
    }
    return true;
  }

  const costOf = (type, n = 1) => { const c = {}; for (const k in BUILDINGS[type].cost) c[k] = BUILDINGS[type].cost[k] * n; return c; };
  const sumCost = (...cs) => { const r = {}; for (const c of cs) for (const k in c) r[k] = (r[k] || 0) + c[k]; return r; };
  const want = {}; // materiales que el bot quiere juntar para construir
  const wantLine = {};  // materiales que faltan para ampliar minas (estos se reservan enteros)
  function affordOrWant(cost, forLine = false) {
    if (canAfford(cost)) return true;
    for (const k in cost) if ((S.inv[k] || 0) < cost[k]) {
      if (forLine) wantLine[k] = true; want[k] = Math.max(want[k] || 0, cost[k]); BOT.lack = BOT.lack || {}; BOT.lack[k] = (BOT.lack[k] || 0) + 1; }
    return false;
  }

  // ---------------- Energía ----------------

  function poleType() { return isUnlocked('bigpole') && (S.inv.steel || 0) > 50 ? 'bigpole' : 'pole'; }

  // Une una casilla a la red eléctrica más cercana con una fila de postes
  function connectPower(x, y) {
    if (powerDirty) rebuildPower();
    // Solo sirven los postes de una red que tenga generación
    const gen = new Set(S.entities.filter((e) => (e.type === 'steam_engine' || e.type === 'generator' || e.type === 'solar') && e._net >= 0).map((e) => e._net));
    const allPoles = S.entities.filter((e) => e.type === 'pole' || e.type === 'bigpole');
    const poles = allPoles.filter((p) => gen.has(p._net));
    const near = poles.find((p) => Math.abs(p.x - x) <= 2 && Math.abs(p.y - y) <= 2);
    if (near) return true;
    if (!poles.length && allPoles.some((p) => Math.abs(p.x - x) <= 2 && Math.abs(p.y - y) <= 2)) return true;
    // poste nuevo junto a (x, y)
    let anchor = null;
    for (let r = 1; r <= 2 && !anchor; r++) for (let dy = -r; dy <= r && !anchor; dy++) for (let dx = -r; dx <= r && !anchor; dx++) if (free(x + dx, y + dy)) anchor = { x: x + dx, y: y + dy };
    if (!anchor) return false;
    if (!poles.length) return !!place('pole', anchor.x, anchor.y, 0, { silent: true });
    let best = null, bd = Infinity;
    for (const p of poles) { const d = Math.hypot(p.x - anchor.x, p.y - anchor.y); if (d < bd) { bd = d; best = p; } }
    // Postes intermedios en línea recta
    const type = bd > 30 ? poleType() : 'pole';
    const step = BUILDINGS[type].reach - 1;
    const n = Math.ceil(bd / step);
    for (let i = 1; i < n; i++) {
      const tx = Math.round(best.x + (anchor.x - best.x) * i / n), ty = Math.round(best.y + (anchor.y - best.y) * i / n);
      let ok = false;
      for (let r = 0; r <= 2 && !ok; r++) for (let dy = -r; dy <= r && !ok; dy++) for (let dx = -r; dx <= r && !ok; dx++) {
        if (free(tx + dx, ty + dy) && place(type, tx + dx, ty + dy, 0, { silent: true })) ok = true;
      }
      if (!ok) return false;
    }
    return !!place('pole', anchor.x, anchor.y, 0, { silent: true });
  }

  function connectPowerFor(e) {
    if (powerDirty) rebuildPower();
    const gen = new Set(S.entities.filter((g) => (g.type === 'steam_engine' || g.type === 'generator') && g._net >= 0).map((g) => g._net));
    if (!gen.size) return;
    // Un poste nuevo al lado, encadenado a la red con generación más cercana
    const poles = S.entities.filter((p) => (p.type === 'pole' || p.type === 'bigpole') && gen.has(p._net));
    let best = null, bd = Infinity;
    for (const p of poles) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; best = p; } }
    if (!best) return;
    const type = bd > 30 ? poleType() : 'pole';
    const step = BUILDINGS[type].reach - 1, n = Math.ceil(bd / step);
    for (let i = 1; i <= n; i++) {
      const tx = Math.round(best.x + (e.x - best.x) * i / n), ty = Math.round(best.y + (e.y - best.y) * i / n);
      let ok = false;
      for (let r = 0; r <= 2 && !ok; r++) for (let dy = -r; dy <= r && !ok; dy++) for (let dx = -r; dx <= r && !ok; dx++) {
        if (free(tx + dx, ty + dy) && place(i === n ? 'pole' : type, tx + dx, ty + dy, 0, { silent: true })) ok = true;
      }
      if (!ok) return;
    }
  }

  // ---------------- Líneas de minería ----------------

  // Busca una columna de n casillas con el mineral y espacio al costado para hornos y la cinta
  function findColumn(ore, n, width) {
    const cands = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (oreAt(x, y) === ore && oreAmountAt(x, y) > 60 && tileExplored(x, y)) cands.push({ x, y, d: Math.hypot(x - HX, y - HY) });
    }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands.slice(0, 1500)) {
      for (const s of [1, -1]) {
        let ok = true;
        for (let k = 0; k < n && ok; k++) {
          const y = c.y + k;
          if (!free(c.x, y) || oreAt(c.x, y) !== ore) ok = false;
          for (let w = 1; w <= width && ok; w++) if (!free(c.x + s * w, y)) ok = false;
        }
        if (ok && free(c.x + s * width, c.y + n)) return { x: c.x, y: c.y, s };
      }
    }
    return null;
  }

  // Sin mineral a la vista: tender cinta hacia el yacimiento más cercano para descubrirlo
  function explore(ore) {
    let best = null, bd = Infinity;
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (oreAt(x, y) !== ore || tileExplored(x, y) || oreAmountAt(x, y) < 60) continue;
      const d = Math.hypot(x - HX, y - HY);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (!best) return false;
    // Desde la casilla explorada libre más cercana, avanzar en línea recta hacia el yacimiento
    let from = null, fd = Infinity;
    for (let y = best.y - 70; y <= best.y + 70; y += 2) for (let x = best.x - 70; x <= best.x + 70; x += 2) {
      if (!free(x, y) || !tileExplored(x, y)) continue;
      const d = Math.hypot(x - best.x, y - best.y);
      if (d < fd) { fd = d; from = { x, y }; }
    }
    if (!from || !affordOrWant(costOf('belt', 12), true)) return false;
    const dx = Math.sign(best.x - from.x), dy = Math.sign(best.y - from.y);
    let x = from.x, y = from.y, n = 0;
    while (n < 12 && (x !== best.x || y !== best.y)) {
      const horiz = Math.abs(best.x - x) >= Math.abs(best.y - y);
      const nx = horiz ? x + dx : x, ny = horiz ? y : y + dy;
      if (!free(nx, ny) || !place('belt', nx, ny, horiz ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3), { silent: true })) break;
      x = nx; y = ny; n++;
    }
    if (n) note(`explorando hacia ${ore}`);
    return n > 0;
  }

  // Línea: taladros → (hornos) → cinta vertical → camino al Núcleo
  let forceBasic = false;
  function buildLineBasic(ore, n, smelt) {
    forceBasic = true;
    try { return buildLine(ore, n, smelt); } finally { forceBasic = false; }
  }

  function buildLine(ore, n, smelt) {
    const electric = !forceBasic && isUnlocked('eminer') && (S.inv.circuit || 0) > 30;
    const minerT = electric ? 'eminer' : 'miner';
    const furnT = smelt ? (!forceBasic && isUnlocked('efurnace') && (S.inv.steel || 0) > 60 ? 'efurnace' : 'furnace') : null;
    const width = smelt ? 2 : 1;
    const col = findColumn(ore, n, width);
    if (!col) { explore(ore); return false; }
    const bx = col.x + col.s * width;
    const blocked = new Set();
    for (let k = -1; k <= n; k++) for (let w = -1; w <= width; w++) if (!(w === width && k === n)) blocked.add((col.x + col.s * w) + ',' + (col.y + k));
    let path = route(bx, col.y + n, blocked);
    // Lejos del Núcleo (o sin camino): entrega a un receptor al final de la columna
    // Con receptores, cada línea entrega en su lugar (las troncales compartidas se saturan a 2 objetos/s)
    if (isUnlocked('receiver')) path = [{ x: bx, y: col.y + n, dir: 1, receiver: true }];
    if (!path) { BOT.noPath = (BOT.noPath || 0) + 1; if (BOT.noPath % 50 === 1) note(`no encontré camino al Núcleo para ${ore}`); return false; }
    if (path[0].receiver && !free(bx, col.y + n)) return false;
    let cost = sumCost(costOf(minerT, n), furnT ? costOf(furnT, n) : {}, costOf('belt', n + (path[0].receiver ? 0 : path.length)), path[0].receiver ? costOf('receiver') : {});
    // Si no alcanza para la versión eléctrica, usar taladros y hornos simples
    if (!canAfford(cost) && (minerT === 'eminer' || furnT === 'efurnace')) return buildLineBasic(ore, n, smelt);
    if (!affordOrWant(cost, true)) return false;
    if (path[0].receiver) {
      if (!place('receiver', bx, col.y + n, 0, { silent: true })) return false;
    } else if (!placeRoute(path)) { note(`falló la cinta de ${ore}`); return false; }
    const outDir = col.s > 0 ? 0 : 2;
    for (let k = 0; k < n; k++) {
      const y = col.y + k;
      place(beltType(), bx, y, 1, { silent: true });
      const m = place(minerT, col.x, y, outDir, { silent: true });
      if (furnT) { const f = place(furnT, col.x + col.s, y, outDir, { silent: true }); if (f) managed.furnaces.push(f); }
      if (electric && m) connectPower(col.x - col.s, y);
      if (furnT === 'efurnace') connectPower(col.x + col.s, y - 1);
    }
    const miners = [];
    for (let k = 0; k < n; k++) { const m = at(col.x, col.y + k); if (m && (m.type === 'miner' || m.type === 'eminer')) miners.push(m); }
    BOT.lines.push({ ore, n, smelt, t: S.playTime, miners });
    note(`línea de ${ore}${smelt ? ' con hornos' : ''}: ${n} ${minerT}, cinta de ${path.length}`);
    return true;
  }

  function buildPumpjacks() {
    const spots = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (oreAt(x, y) === 'oil' && free(x, y)) spots.push({ x, y, d: Math.hypot(x - HX, y - HY) });
    spots.sort((a, b) => a.d - b.d);
    for (const s of spots.slice(0, 40)) {
      for (let d = 0; d < 4; d++) {
        const ox = s.x + DIRS[d][0], oy = s.y + DIRS[d][1];
        if (!free(ox, oy)) continue;
        let path = route(ox, oy);
        if ((!path || path.length > 25) && isUnlocked('receiver')) {
          if (!affordOrWant(sumCost(costOf('pumpjack'), costOf('receiver')))) return false;
          if (!place('receiver', ox, oy, 0, { silent: true })) continue;
        } else {
          if (!path) continue;
          if (!affordOrWant(sumCost(costOf('pumpjack'), costOf('belt', path.length)))) return false;
          placeRoute(path);
        }
        if (!place('pumpjack', s.x, s.y, d, { silent: true })) continue;
        connectPower(s.x, s.y);
        note(`bomba de petróleo con cinta de ${path.length}`);
        return true;
      }
    }
    return false;
  }

  function shores() {
    const list = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!free(x, y)) continue;
      for (let d = 0; d < 4; d++) if (oreAt(x - DIRS[d][0], y - DIRS[d][1]) === 'water') { list.push({ x, y, d, dist: Math.hypot(x - HX, y - HY) }); break; }
    }
    return list.sort((a, b) => a.dist - b.dist);
  }

  function buildWaterPump() {
    for (const s of shores().slice(0, 60)) {
      const nx = s.x + DIRS[s.d][0], ny = s.y + DIRS[s.d][1];
      if (!free(nx, ny)) continue;
      if (isUnlocked('receiver')) {
        if (!affordOrWant(sumCost(costOf('offshore'), costOf('receiver')))) return false;
        if (place('receiver', nx, ny, 0, { silent: true }) && place('offshore', s.x, s.y, s.d, { silent: true })) { note('bomba de agua con receptor'); return true; }
        continue;
      }
      const path = route(nx, ny);
      if (!path || path.length > 140) continue;
      if (!affordOrWant(sumCost(costOf('offshore'), costOf('belt', path.length)))) return false;
      placeRoute(path);
      if (place('offshore', s.x, s.y, s.d, { silent: true })) { note(`bomba de agua con cinta de ${path.length}`); return true; }
    }
    return false;
  }

  // Central de vapor: bomba → caldera → 2 máquinas en fila, en la orilla
  function buildSteamPlant() {
    const list = shores();
    if (!list.length) note('no hay orillas exploradas para la central');
    for (const s of list.slice(0, 300)) {
      const [dx, dy] = DIRS[s.d];
      const tiles = [1, 2, 3].map((k) => ({ x: s.x + dx * k, y: s.y + dy * k }));
      if (!tiles.every((t) => free(t.x, t.y))) continue;
      const cost = sumCost(costOf('offshore'), costOf('boiler'), costOf('steam_engine', 2), costOf('pole', 4));
      if (!affordOrWant(cost)) return false;
      place('offshore', s.x, s.y, s.d, { silent: true });
      const b = place('boiler', tiles[0].x, tiles[0].y, s.d, { silent: true });
      place('steam_engine', tiles[1].x, tiles[1].y, s.d, { silent: true });
      place('steam_engine', tiles[2].x, tiles[2].y, s.d, { silent: true });
      if (b) managed.boilers.push(b);
      connectPower(tiles[1].x, tiles[1].y);
      connectToMall(tiles[1].x, tiles[1].y);
      note('central de vapor de 1,8 MW');
      return true;
    }
    BOT.steamFail = (BOT.steamFail || 0) + 1;
    if (BOT.steamFail % 100 === 1) note('no encontré lugar para la central de vapor');
    return false;
  }

  // ---------------- Centro de producción ----------------

  let mallSlots = null;
  function mallSlot() {
    if (!mallSlots) {
      mallSlots = [];
      for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
        const x = HX + i * 3, y = HY + 6 + j * 3;
        if (Math.abs(x - HX) < 4 && Math.abs(y - HY) < 4) continue;
        mallSlots.push({ x, y, d: Math.hypot(i * 3, 6 + j * 3) });
      }
      mallSlots.sort((a, b) => a.d - b.d);
    }
    for (const s of mallSlots) {
      if (!free(s.x, s.y) || !tileExplored(s.x, s.y)) continue;
      const o = oreAt(s.x, s.y);
      if (o && o !== 'water') continue;
      // Sin vecinos: así nadie le entrega a nadie por accidente
      let lonely = true;
      for (let dy = -1; dy <= 1 && lonely; dy++) for (let dx = -1; dx <= 1 && lonely; dx++) if ((dx || dy) && at(s.x + dx, s.y + dy)) lonely = false;
      if (lonely) return s;
    }
    return null;
  }

  function connectToMall(x, y) {
    const m = managed.mall.find((e) => BUILDINGS[e.type].power);
    if (m) connectPower(m.x + 1, m.y + 1);
  }

  function addMachine(type) {
    BOT.tries = BOT.tries || {};
    BOT.tries[type] = (BOT.tries[type] || 0) + 1;
    if (!affordOrWant(costOf(type))) { BOT.tries[type + ':caro'] = (BOT.tries[type + ':caro'] || 0) + 1; return null; }
    const s = mallSlot();
    if (!s) { BOT.tries[type + ':sinlugar'] = (BOT.tries[type + ':sinlugar'] || 0) + 1; if (BOT.tries[type + ':sinlugar'] % 100 === 1) note('no hay más lugar en el centro de producción'); return null; }
    const e = place(type, s.x, s.y, 0, { silent: true });
    if (!e) return null;
    if (BUILDINGS[type].power) {
      if (!connectPower(s.x + 1, s.y + 1)) connectPower(s.x - 1, s.y - 1);
    }
    if (type === 'lab') managed.labs.push(e); else managed.mall.push(e);
    return e;
  }

  // ---------------- Logística ideal del centro ----------------

  // Alimenta sin tocar lo reservado para construir
  const reserved = {};
  const reservedLine = {};
  const wantSince = {};
  function feedSome(e, k, max) {
    // Las placas básicas salen de las minas: se pueden reservar enteras sin trabar nada
    // y solo si hace rato que falta (paciencia de 2 minutos)
    const basic = ['iron_plate', 'copper_plate', 'stone', 'coal', 'brick', 'steel'].includes(k);
    const stuck = wantSince[k] !== undefined && S.playTime - wantSince[k] > 120;
    const keep = Math.min(reserved[k] || 0, (S.inv[k] || 0) * (basic && stuck && reservedLine[k] ? 1 : 0.5));
    const avail = Math.floor((S.inv[k] || 0) - keep);
    if (avail <= 0) return 0;
    const saved = S.inv[k];
    S.inv[k] = avail;
    const n = feedFrom(e, [k], max);
    S.inv[k] = saved - n;
    return n;
  }

  function feedAll() {
    for (const f of managed.furnaces) if (!f._dead && f.type === 'furnace' && f.fuel < 4) { feedFrom(f, ['coal'], 4); if (!f.fuel && f.burn <= 0) BOT.starved.coal = (BOT.starved.coal || 0) + 1; }
    for (const b of managed.boilers) if (!b._dead && b.fuel < 5) { feedFrom(b, ['coal', 'solid_fuel'], 5); if (!b.fuel) BOT.starved.coal = (BOT.starved.coal || 0) + 3; }
    // Taladros comunes: queman carbón. Primero los que sacan carbón
    const burners = S.entities.filter((m) => m.type === 'miner' && m.fuel < 3 && !m.depleted);
    burners.sort((a, b) => (oreAt(b.x, b.y) === 'coal') - (oreAt(a.x, a.y) === 'coal'));
    for (const m of burners) { feedFrom(m, ['coal'], 3); if (!m.fuel && m.burn <= 0) BOT.starved.coal = (BOT.starved.coal || 0) + 1; }
    for (const e of managed.mall) {
      if (e._dead) continue;
      if (e.type === 'furnace' || e.type === 'efurnace') {
        if (e.outType) { add(S.inv, e.outType, e.outCount); add(S.delivered, e.outType, e.outCount); e.outCount = 0; e.outType = null; }
        if (e.type === 'furnace' && e.fuel < 4) feedFrom(e, ['coal'], 4);
        if (e._smelt) {
          const n = feedSome(e, e._smelt, 30);
          if (!n && e.inCount < SMELT[e._smelt].n) BOT.starved[e._smelt] = (BOT.starved[e._smelt] || 0) + 1;
        }
        continue;
      }
      if (!e.recipe) continue;
      const rc = RECIPES[e.recipe];
      if (e.out) { add(S.inv, rc.out, e.out); e.out = 0; }
      for (const k in rc.in) {
        if ((e.buf[k] || 0) < rc.in[k] * 2) {
          const before = e.buf[k] || 0;
          feedSome(e, k, rc.in[k] * 2);
          if ((e.buf[k] || 0) === before && before < rc.in[k]) BOT.starved[k] = (BOT.starved[k] || 0) + 1;
        }
      }
    }
    const tech = S.research.current && TECHS[S.research.current];
    if (tech) {
      for (const l of managed.labs) {
        if (l._dead) continue;
        for (const p of tech.packs) {
          if ((l.packs[p] || 0) < 2) {
            const before = l.packs[p] || 0;
            feedFrom(l, [p], 4);
            if ((l.packs[p] || 0) === before && !before) BOT.starved[p] = (BOT.starved[p] || 0) + 1;
          }
        }
      }
    }
  }

  // Cuánto quiere tener de cada cosa en el inventario
  function targets() {
    const t = {};
    const set = (k, n) => { t[k] = Math.max(t[k] || 0, n); };
    set('gear', 150);
    if (hasTech('electronics')) { set('cable', 200); set('circuit', 150); }
    if (hasTech('defense')) set('ammo', 0);
    if (hasTech('steel')) set('steel', 150);
    if (hasTech('oil')) { set('plastic', 150); set('sulfur', 80); }
    if (hasTech('advanced_assembly')) set('engine', 40);
    if (hasTech('silicon')) { set('processor', 80); set('silicon', 0); }
    if (hasTech('batteries')) set('battery', 80);
    if (hasTech('electric_engines')) { set('lubricant', 60); set('electric_engine', 40); }
    if (hasTech('control_units')) set('control_unit', 40);
    if (hasTech('titanium')) set('low_density', 40);
    // Packs para la investigación actual y las próximas
    const upcoming = TECH_ORDER.filter((id) => !S.techs[id] && TECHS[id].req.every((r) => S.techs[r] || id === S.research.current)).slice(0, 4);
    if (S.research.current) upcoming.unshift(S.research.current);
    // Si falta material para construir, la ciencia espera (como haría un jugador)
    const building = Object.keys(reserved).length > 0;
    void building;
    for (const id of upcoming) for (const p of TECHS[id].packs) set(p, 120);
    // Piezas de la nave
    if (hasTech('rocketry')) {
      const yard = S.entities.find((e) => e.type === 'shipyard');
      for (const k in SHIP) set(k, SHIP[k] - (yard ? yard.parts[k] || 0 : 0));
      set('solid_fuel', 60);
    }
    for (const k in want) set(k, want[k] * 3 + 20);
    return t;
  }

  // Elige qué fabrica cada máquina según lo que falta
  function assignRecipes() {
    const t = targets();
    const deficit = (k) => Math.max(0, (t[k] || 0) - (S.inv[k] || 0));
    // Grupos: químicas, ensambladoras avanzadas (recetas que solo ellas hacen) y comunes
    const pools = [
      { machines: managed.mall.filter((e) => !e._dead && e.type === 'chem'), ok: (r) => r.machine === 'chem' },
      { machines: managed.mall.filter((e) => !e._dead && e.type === 'assembler2'), ok: (r) => r.machine === 'asm' && r.tier === 2, fallback: (r) => r.machine === 'asm' },
      { machines: managed.mall.filter((e) => !e._dead && e.type === 'assembler'), ok: (r) => r.machine === 'asm' && r.tier === 1 },
    ];
    for (const pool of pools) {
      const machines = pool.machines;
      if (!machines.length) continue;
      const mk = (pred) => RECIPE_ORDER.filter((id) => pred(RECIPES[id]) && hasTech(RECIPES[id].tech) && deficit(RECIPES[id].out) > 0)
        .map((id) => ({ id, w: deficit(RECIPES[id].out) * RECIPES[id].time / RECIPES[id].n }));
      let cands = mk(pool.ok);
      if (!cands.length && pool.fallback) cands = mk(pool.fallback);
      if (!cands.length) continue;
      const total = cands.reduce((a, c) => a + c.w, 0);
      // Una máquina para cada receta necesaria (las más urgentes primero) y el resto en proporción
      const quota = {};
      cands.sort((a, b) => b.w - a.w);
      let left = machines.length;
      for (const c of cands) { if (left > 0) { quota[c.id] = 1; left--; } else quota[c.id] = 0; }
      const rest = left;
      for (const c of cands) quota[c.id] += Math.floor(rest * c.w / total);
      const free = [];
      for (const m of machines) {
        if (m.recipe && quota[m.recipe] > 0) quota[m.recipe]--;
        else free.push(m);
      }
      for (const m of free) {
        const id = Object.keys(quota).sort((a, b) => quota[b] - quota[a]).find((r) => quota[r] > 0) || cands[0].id;
        quota[id]--;
        if (m.recipe !== id) {
          for (const k in m.buf) add(S.inv, k, m.buf[k]);
          if (m.recipe && m.out) add(S.inv, RECIPES[m.recipe].out, m.out);
          m.buf = {}; m.out = 0; m.prog = 0; m.recipe = id;
        }
      }
    }
    // Hornos del centro: acero, silicio y titanio
    const smeltWant = [];
    if (hasTech('steel') && (t.steel || 0) > (S.inv.steel || 0)) smeltWant.push('iron_plate');
    for (const f of managed.mall.filter((e) => e.type === 'furnace' || e.type === 'efurnace')) {
      f._smelt = smeltWant.length ? smeltWant[0] : null;
    }
  }

  // ---------------- Plan de crecimiento ----------------

  const lineFor = {
    iron_plate: ['iron_ore', true], copper_plate: ['copper_ore', true], coal: ['coal', false], stone: ['stone', false],
    brick: ['stone', true], silicon: ['quartz', true], titanium_plate: ['titanium_ore', true], iron_ore: ['iron_ore', false],
  };
  let lastGrow = 0, lastAssign = 0, lastFeed = 0;

  function grow() {
    const era = eraIndex();
    // Máquinas eléctricas sin energía: conectarlas a una red con generación
    if (S.playTime - (BOT.lastFix || 0) > 60) {
      BOT.lastFix = S.playTime;
      // Generadores sueltos (sin poste): uno pegado
      for (const g of S.entities) {
        if (g.type !== 'generator' || g._net >= 0) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (free(g.x + dx, g.y + dy) && place('pole', g.x + dx, g.y + dy, 0, { silent: true })) break;
      }
      if (powerDirty) rebuildPower();
      for (const e of S.entities) {
        const d = BUILDINGS[e.type];
        if (d && d.power && (!nets[e._net] || nets[e._net].prev.solar + nets[e._net].prev.fuel === 0)) connectPowerFor(e);
      }
    }
    // 1) Investigación
    if (!S.research.current) {
      const next = TECH_ORDER.find((id) => techAvailable(id));
      if (next) setResearch(next);
    }
    // 1b) El carbón primero: sin carbón se apagan hornos y calderas
    if ((BOT.starved.coal || 0) > 50) {
      const coalLines = BOT.lines.filter((l) => l.ore === 'coal' && l.miners.some((m) => !m._dead && !m.depleted)).length;
      if (coalLines < 20 && buildLine('coal', 6, false)) { BOT.starved.coal = 0; return; }
    }
    // 2) Energía: si falta, otra central
    const elec = managed.mall.some((e) => BUILDINGS[e.type].power) || S.entities.some((e) => e.type === 'eminer' || e.type === 'pumpjack');
    if (hasTech('steam_power') && elec) {
      const capacity = S.entities.filter((e) => e.type === 'steam_engine').length * 900;
      const demand = nets.reduce((a, n) => a + n.prev.demand, 0);
      if (demand > capacity * 0.75 || capacity === 0) { if (buildSteamPlant()) return; }
    } else if (elec && S.entities.filter((e) => e.type === 'generator').length * 900 < nets.reduce((a, n) => a + n.prev.demand, 0) * 1.25 + 1) {
      // Antes del vapor: generadores a carbón junto al centro, según el consumo
      const s = mallSlot();
      if (s && affordOrWant(costOf('generator'))) {
        const g = place('generator', s.x, s.y, 0, { silent: true });
        if (g) {
          managed.boilers.push(g);
          feedFrom(g, ['coal'], 5);
          // Un poste pegado al generador y, desde ahí, a las máquinas
          let pole = false;
          for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (!pole && free(g.x + dx, g.y + dy)) pole = !!place('pole', g.x + dx, g.y + dy, 0, { silent: true });
          if (powerDirty) rebuildPower();
          for (const e of S.entities) { const d = BUILDINGS[e.type]; if (d && d.power && e !== g && (!nets[e._net] || !nets[e._net].prev.fuel)) connectPowerFor(e); }
          note('generador a carbón');
        }
      }
    }
    // 3) Agua y petróleo
    if (hasTech('oil')) {
      const pumps = S.entities.filter((e) => e.type === 'pumpjack').length;
      const offshoreToHub = BOT.waterPumps || 0;
      if (offshoreToHub < 1 && buildWaterPump()) { BOT.waterPumps = offshoreToHub + 1; return; }
      if (pumps < Math.min(8, 2 + Math.floor((BOT.starved.oil || 0) / 30))) { if (buildPumpjacks()) return; }
    }
    // 4) Líneas de mineral según lo que más falta
    const lines = BOT.lines;
    // Líneas que todavía tienen mineral
    const count = (ore, smelt) => lines.filter((l) => l.ore === ore && l.smelt === smelt && (!l.miners || l.miners.some((m) => !m._dead && !m.depleted))).length;
    const base = [['iron_ore', true, 1], ['coal', false, 1], ['stone', false, 1], ['copper_ore', true, 1], ['iron_ore', true, 2], ['stone', true, 1]];
    for (const [ore, smelt, n] of base) if (count(ore, smelt) < n) { buildLine(ore, ore === 'iron_ore' || ore === 'copper_ore' ? 4 : 3, smelt); return; }
    const starved = Object.entries(BOT.starved).sort((a, b) => b[1] - a[1]);
    for (const [item, n] of starved) {
      if (n < 20) break;
      let key = item;
      // Lo que se fabrica en el centro: hay que mirar qué materia prima le falta
      if (['gear', 'cable', 'circuit', 'steel', 'ammo', 'engine'].includes(item)) key = 'iron_plate';
      if (item === 'quartz') key = 'silicon';
      const lf = lineFor[key];
      if (!lf) continue;
      if ((key === 'silicon' && !hasTech('silicon')) || (key === 'titanium_plate' && !hasTech('titanium'))) continue;
      if (count(lf[0], lf[1]) >= 30) continue;
      if (buildLine(lf[0], 5, lf[1])) { BOT.starved[item] = 0; return; }
    }
    if (hasTech('silicon') && count('quartz', true) < 1) { buildLine('quartz', 4, true); return; }
    if (hasTech('titanium') && count('titanium_ore', true) < 2) { buildLine('titanium_ore', 4, true); return; }
    // 5) Máquinas del centro: en la era química, primero las avanzadas
    if (hasTech('oil')) {
      const chems = managed.mall.filter((e) => e.type === 'chem');
      if (chems.length < [0, 0, 6, 10][era] && addMachine('chem')) return;
    }
    if (isUnlocked('assembler2')) {
      const a2 = managed.mall.filter((e) => e.type === 'assembler2');
      if (a2.length < [0, 6, 16, 30][era] && addMachine('assembler2')) return;
    }
    const labsWanted = [4, 10, 18, 28][era];
    if (managed.labs.length < labsWanted && addMachine('lab')) return;
    const asm = managed.mall.filter((e) => BUILDINGS[e.type].machine === 'asm');
    const busy = asm.filter((e) => e.active).length / Math.max(1, asm.length);
    const asmWanted = [8, 24, 40, 60][era];
    if (asm.length < asmWanted || busy > 0.8) {
      const type = isUnlocked('assembler2') && (S.inv.steel || 0) > 20 ? 'assembler2' : 'assembler';
      if (asm.length < 90 && addMachine(type)) return;
    }
    if (hasTech('oil')) {
      const chems = managed.mall.filter((e) => e.type === 'chem');
      if (chems.length < [0, 0, 4, 8][era] && addMachine('chem')) return;
    }
    if (hasTech('steel')) {
      const furn = managed.mall.filter((e) => e.type === 'furnace' || e.type === 'efurnace');
      if (furn.length < [0, 3, 6, 10][era]) {
        const f = addMachine(isUnlocked('efurnace') && (S.inv.steel || 0) > 30 ? 'efurnace' : 'furnace');
        if (f) return;
      }
    }
    // 6) Astillero
    if (hasTech('rocketry') && !S.entities.some((e) => e.type === 'shipyard')) {
      const s = mallSlot();
      if (s && affordOrWant(costOf('shipyard'))) {
        for (let dy = 0; dy < 12; dy++) for (let dx = 0; dx < 12; dx++) {
          if (place('shipyard', s.x + dx, s.y + dy, 0, { silent: true })) { milestone('Astillero construido'); return; }
        }
      }
    }
  }

  function shipStep() {
    const yard = S.entities.find((e) => e.type === 'shipyard');
    if (!yard) return;
    for (const k in SHIP) {
      const n = Math.min(Math.floor(S.inv[k] || 0), SHIP[k] - (yard.parts[k] || 0));
      if (n > 0) { S.inv[k] -= n; add(yard.parts, k, n); }
    }
    if (shipReady(yard) && !BOT.launched) { BOT.launched = S.playTime; milestone('¡NAVE COMPLETA, DESPEGUE!'); }
  }

  // ---------------- Bucle ----------------

  const seen = new Set();
  let lastEra = -1;
  BOT.init = () => {
    const h = hubE();
    HX = h.x + 1; HY = h.y + 1;
    note(`inicio · inventario ${JSON.stringify(S.inv)}`);
  };
  // Extracción a mano (como hace un jugador al principio): piedra y carbón si faltan
  let handTile = null, handTimer = 0;
  function handMine(dt) {
    const need = ['stone', 'coal', 'iron_ore'].find((k) => (k === 'stone' && ((want.stone || 0) > (S.inv.stone || 0) || (S.inv.stone || 0) < 10)) ||
      (k === 'coal' && (S.inv.coal || 0) < 5 && !BOT.lines.some((l) => l.ore === 'coal')));
    if (!need) { handTile = null; return; }
    if (!handTile || oreAt(handTile.x, handTile.y) !== need) {
      handTile = null;
      let bd = Infinity;
      for (let y = HY - 40; y < HY + 40; y++) for (let x = HX - 40; x < HX + 40; x++) {
        if (oreAt(x, y) === need && !at(x, y) && tileExplored(x, y)) { const d = Math.hypot(x - HX, y - HY); if (d < bd) { bd = d; handTile = { x, y }; } }
      }
      if (!handTile) return;
    }
    handTimer += dt;
    while (handTimer >= HAND_MINE_TIME) { handTimer -= HAND_MINE_TIME; const o = mineOre(handTile.x, handTile.y); if (o) { add(S.inv, o, 1); BOT.handMined = (BOT.handMined || 0) + 1; } }
  }

  BOT.run = (seconds, dt = 0.25) => {
    const end = S.playTime + seconds;
    while (S.playTime < end && !BOT.launched) {
      update(dt);
      handMine(dt);
      if (S.playTime - lastFeed >= 1) { lastFeed = S.playTime; feedAll(); shipStep(); }
      if (S.playTime - lastAssign >= 15) {
        lastAssign = S.playTime;
        for (const k in reserved) delete reserved[k];
        for (const k in reservedLine) delete reservedLine[k];
        for (const k in wantLine) { reservedLine[k] = true; delete wantLine[k]; }
        for (const k in wantSince) if (!(k in want)) delete wantSince[k];
        for (const k in want) { reserved[k] = want[k]; if (wantSince[k] === undefined) wantSince[k] = S.playTime; delete want[k]; }
        assignRecipes();
      }
      if (S.playTime - lastGrow >= 5) { lastGrow = S.playTime; grow(); }
      for (const id of TECH_ORDER) if (S.techs[id] && !seen.has(id)) { seen.add(id); milestone(`investigado ${TECHS[id].name}`); }
      const era = eraIndex();
      if (era !== lastEra) { lastEra = era; milestone(ERAS[era].name); }
    }
    const machines = {};
    for (const e of S.entities) machines[e.type] = (machines[e.type] || 0) + 1;
    BOT.stats.push({ t: S.playTime, techs: Object.keys(S.techs).length, machines, inv: { ...S.inv } });
    return { t: fmtT(S.playTime), techs: Object.keys(S.techs).length, research: S.research.current, entities: S.entities.length, launched: BOT.launched };
  };
})();
