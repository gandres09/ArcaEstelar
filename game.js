(() => {
  'use strict';

  // ================== Datos del juego ==================
  const TILE = 32;
  const W = 80, H = 60; // tamaño del mapa en casillas
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // derecha, abajo, izquierda, arriba
  const SAVE_KEY = 'mini-fabrica-v1';

  const ITEMS = {
    iron_ore:     { name: 'Mineral de hierro', color: '#7d8fa6', shape: 'ore' },
    copper_ore:   { name: 'Mineral de cobre',  color: '#c8763f', shape: 'ore' },
    coal:         { name: 'Carbón',            color: '#2b2b2b', shape: 'ore' },
    stone:        { name: 'Piedra',            color: '#b5a68a', shape: 'ore' },
    iron_plate:   { name: 'Placa de hierro',   color: '#d6dee8', shape: 'plate' },
    copper_plate: { name: 'Placa de cobre',    color: '#f29a5c', shape: 'plate' },
    gear:         { name: 'Engranaje',         color: '#9aa7b5', shape: 'gear' },
    circuit:      { name: 'Circuito',          color: '#3fae5a', shape: 'chip' },
  };
  const ITEM_ORDER = Object.keys(ITEMS);
  const ORE_IDS = [null, 'iron_ore', 'copper_ore', 'coal', 'stone'];
  const ORE_GROUND = { iron_ore: '#3c4655', copper_ore: '#553826', coal: '#1b1d1c', stone: '#5b5444' };

  const SMELT = { iron_ore: 'iron_plate', copper_ore: 'copper_plate' };
  const SMELT_TIME = 2;     // segundos por placa
  const SMELTS_PER_COAL = 5;
  const MINER_TIME = 1.5;   // segundos por mineral
  const HAND_MINE_TIME = 0.5;

  const RECIPES = {
    gear:    { in: { iron_plate: 2 }, out: 'gear', time: 1 },
    circuit: { in: { iron_plate: 1, copper_plate: 2 }, out: 'circuit', time: 1.5 },
  };
  const RECIPE_ORDER = Object.keys(RECIPES);

  const BUILDINGS = {
    belt:      { name: 'Cinta',        speed: 2, cost: { iron_plate: 1 },
                 desc: 'Mueve objetos hacia donde apunta. Arrastrá para trazar.' },
    miner:     { name: 'Taladro',      cost: { iron_plate: 8 },
                 desc: 'Va sobre mineral. Extrae 1 cada 1,5 s y lo saca por la flecha.' },
    furnace:   { name: 'Horno',        cost: { stone: 5 },
                 desc: 'Funde mineral de hierro o cobre en placas. Consume carbón.' },
    assembler: { name: 'Ensambladora', cost: { iron_plate: 10, copper_plate: 10 },
                 desc: 'Fabrica engranajes o circuitos. Clic con la mano para cambiar receta.' },
    splitter:  { name: 'Divisor',      cost: { iron_plate: 5, gear: 2 },
                 desc: 'Reparte objetos entre adelante, izquierda y derecha.' },
    fastbelt:  { name: 'Cinta rápida', speed: 4, cost: { iron_plate: 1, gear: 1 },
                 desc: 'Como la cinta, pero al doble de velocidad.' },
  };
  const TOOL_ORDER = Object.keys(BUILDINGS);
  const isBelt = (type) => type === 'belt' || type === 'fastbelt';

  const GOALS = [
    { desc: 'Llevá placas de hierro al Núcleo.', need: { iron_plate: 30 }, unlock: 'assembler' },
    { desc: 'Fundí cobre y fabricá engranajes.', need: { copper_plate: 30, gear: 20 }, unlock: 'splitter' },
    { desc: 'Fabricá circuitos electrónicos.', need: { circuit: 30 }, unlock: 'fastbelt' },
    { desc: 'Juntá piezas para lanzar el cohete.', need: { gear: 200, circuit: 200 }, final: true },
  ];

  // ================== Estado ==================
  let S;          // estado guardable
  let ore;        // Uint8Array: id de mineral por casilla
  let grid;       // Array: entidad que ocupa cada casilla
  let mapCanvas;  // mapa prerenderizado

  const view = { x: 0, y: 0, zoom: 1 };
  let tool = 'hand';
  let toolDir = 0;
  let time = 0;

  function newState(seed) {
    return {
      v: 1,
      seed,
      inv: { iron_plate: 50, stone: 20, coal: 10 },
      delivered: {},
      goal: 0,
      unlocked: { belt: true, miner: true, furnace: true },
      won: false,
      entities: [],
      playTime: 0,
    };
  }

  // ================== Utilidades ==================
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(x, y, k) {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const at = (x, y) => (inBounds(x, y) ? grid[y * W + x] : null);
  const oreAt = (x, y) => (inBounds(x, y) ? ORE_IDS[ore[y * W + x]] : null);
  const sizeOf = (e) => (e.type === 'hub' ? 3 : 1);
  const add = (obj, k, n) => { obj[k] = (obj[k] || 0) + n; };

  function canAfford(cost) {
    for (const k in cost) if ((S.inv[k] || 0) < cost[k]) return false;
    return true;
  }
  function pay(cost) { for (const k in cost) S.inv[k] -= cost[k]; }
  function refund(cost) { for (const k in cost) add(S.inv, k, cost[k]); }
  function costText(cost) {
    return Object.entries(cost).map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`).join(', ');
  }

  // ================== Mapa ==================
  function generateMap(seed) {
    ore = new Uint8Array(W * H);
    const rnd = mulberry32(seed);
    const cx = W >> 1, cy = H >> 1;
    const patch = (px, py, rad, id) => {
      for (let y = Math.floor(py - rad - 2); y <= py + rad + 2; y++) {
        for (let x = Math.floor(px - rad - 2); x <= px + rad + 2; x++) {
          if (!inBounds(x, y)) continue;
          if (Math.hypot(x - px, y - py) < rad + (rnd() - 0.5) * 1.8) ore[y * W + x] = id;
        }
      }
    };
    // Yacimientos garantizados cerca del Núcleo
    patch(cx - 10, cy - 6, 3.5, 1);
    patch(cx + 10, cy - 6, 3.5, 2);
    patch(cx - 9, cy + 7, 3, 3);
    patch(cx + 9, cy + 7, 3, 4);
    // Yacimientos aleatorios por el resto del mapa
    for (let i = 0; i < 30; i++) {
      const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H);
      if (Math.abs(px - cx) < 16 && Math.abs(py - cy) < 12) continue;
      patch(px, py, 2 + rnd() * 4, 1 + Math.floor(rnd() * 4));
    }
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) ore[y * W + x] = 0;
    renderMapCanvas();
  }

  function renderMapCanvas() {
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = W * TILE;
    mapCanvas.height = H * TILE;
    const g = mapCanvas.getContext('2d');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * TILE, py = y * TILE;
        const shade = Math.floor(hash(x, y, 1) * 8);
        g.fillStyle = `rgb(${38 + shade},${52 + shade},${36 + shade})`;
        g.fillRect(px, py, TILE, TILE);
        const o = oreAt(x, y);
        if (o) {
          g.fillStyle = ORE_GROUND[o];
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle = ITEMS[o].color;
          for (let k = 0; k < 4; k++) {
            const ox = 5 + hash(x, y, 10 + k) * 22, oy = 5 + hash(x, y, 20 + k) * 22;
            g.beginPath();
            g.arc(px + ox, py + oy, 2.5 + hash(x, y, 30 + k) * 2.5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x++) { g.moveTo(x * TILE + 0.5, 0); g.lineTo(x * TILE + 0.5, H * TILE); }
    for (let y = 0; y <= H; y++) { g.moveTo(0, y * TILE + 0.5); g.lineTo(W * TILE, y * TILE + 0.5); }
    g.stroke();
  }

  // ================== Entidades ==================
  function makeEntity(type, x, y, dir = 0) {
    const e = { type, x, y, dir };
    switch (type) {
      case 'belt': case 'fastbelt': e.item = null; e.prog = 0; break;
      case 'miner': e.t = 0; e.buf = null; break;
      case 'furnace':
        e.inType = null; e.inCount = 0; e.fuel = 0; e.burn = 0; e.prog = 0;
        e.outType = null; e.outCount = 0; break;
      case 'assembler': e.recipe = 'gear'; e.buf = {}; e.prog = 0; e.out = 0; break;
      case 'splitter': e.item = null; e.rr = 0; break;
    }
    return e;
  }

  function occupy(e, value) {
    const s = sizeOf(e);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) grid[(e.y + dy) * W + e.x + dx] = value;
  }

  function rebuildGrid() {
    grid = new Array(W * H).fill(null);
    for (const e of S.entities) occupy(e, e);
  }

  // Objetos guardados dentro de un edificio (se devuelven al desarmarlo)
  function contents(e) {
    const c = {};
    if (e.item) add(c, e.item, 1);
    if (e.type === 'miner' && e.buf) add(c, e.buf, 1);
    if (e.type === 'furnace') {
      if (e.inType) add(c, e.inType, e.inCount);
      if (e.outType) add(c, e.outType, e.outCount);
      if (e.fuel) add(c, 'coal', e.fuel);
    }
    if (e.type === 'assembler') {
      for (const k in e.buf) add(c, k, e.buf[k]);
      if (e.out) add(c, RECIPES[e.recipe].out, e.out);
    }
    return c;
  }

  function canPlace(type, x, y) {
    if (!inBounds(x, y)) return { ok: false };
    const existing = at(x, y);
    if (existing) {
      // Se puede girar una cinta pasando otra cinta del mismo tipo por encima
      if (existing.type === type && isBelt(type)) return { ok: true, rotate: existing };
      return { ok: false, why: 'Casilla ocupada' };
    }
    if (type === 'miner' && !oreAt(x, y)) return { ok: false, why: 'El taladro va sobre mineral' };
    if (!S.unlocked[type]) return { ok: false, why: 'Bloqueado' };
    if (!canAfford(BUILDINGS[type].cost)) return { ok: false, why: 'Faltan materiales' };
    return { ok: true };
  }

  function place(type, x, y, dir) {
    const res = canPlace(type, x, y);
    if (!res.ok) return null;
    if (res.rotate) { res.rotate.dir = dir; return res.rotate; }
    pay(BUILDINGS[type].cost);
    const e = makeEntity(type, x, y, dir);
    S.entities.push(e);
    occupy(e, e);
    return e;
  }

  function remove(x, y) {
    const e = at(x, y);
    if (!e || e.type === 'hub') return false;
    refund(BUILDINGS[e.type].cost);
    refund(contents(e));
    occupy(e, null);
    S.entities.splice(S.entities.indexOf(e), 1);
    return true;
  }

  // ¿El edificio t acepta el objeto que le manda src?
  function accept(t, item, src) {
    switch (t.type) {
      case 'hub':
        add(S.inv, item, 1);
        add(S.delivered, item, 1);
        return true;
      case 'belt': case 'fastbelt': {
        if (t.item) return false;
        const [dx, dy] = DIRS[t.dir];
        if (at(t.x + dx, t.y + dy) === src) return false; // no aceptar desde adelante
        t.item = item; t.prog = 0;
        return true;
      }
      case 'splitter':
        if (t.item) return false;
        t.item = item;
        return true;
      case 'furnace':
        if (item === 'coal') {
          if (t.fuel >= 10) return false;
          t.fuel++;
          return true;
        }
        if (!SMELT[item] || t.inCount >= 10 || (t.inType && t.inType !== item)) return false;
        t.inType = item; t.inCount++;
        return true;
      case 'assembler': {
        const need = RECIPES[t.recipe].in[item];
        if (!need || (t.buf[item] || 0) >= need * 3) return false;
        add(t.buf, item, 1);
        return true;
      }
    }
    return false;
  }

  function pushTo(e, dir, item) {
    const [dx, dy] = DIRS[dir];
    const t = at(e.x + dx, e.y + dy);
    return !!t && t !== e && accept(t, item, e);
  }

  // ================== Simulación ==================
  function update(dt) {
    S.playTime += dt;
    for (const e of S.entities) {
      switch (e.type) {
        case 'belt': case 'fastbelt':
          if (e.item) {
            e.prog = Math.min(1, e.prog + dt * BUILDINGS[e.type].speed);
            if (e.prog >= 1 && pushTo(e, e.dir, e.item)) e.item = null;
          }
          break;

        case 'miner':
          e.active = !e.buf;
          if (!e.buf) {
            e.t += dt;
            if (e.t >= MINER_TIME) { e.t = 0; e.buf = oreAt(e.x, e.y); }
          }
          if (e.buf && pushTo(e, e.dir, e.buf)) e.buf = null;
          break;

        case 'furnace': {
          e.active = false;
          const result = e.inType && SMELT[e.inType];
          if (result && e.outCount < 10 && (!e.outType || e.outType === result)) {
            if (e.burn <= 0 && e.fuel > 0) { e.fuel--; e.burn = SMELTS_PER_COAL; }
            if (e.burn > 0) {
              e.active = true;
              e.prog += dt;
              if (e.prog >= SMELT_TIME) {
                e.prog = 0; e.burn--;
                e.outType = result; e.outCount++;
                if (--e.inCount === 0) e.inType = null;
              }
            }
          }
          if (e.outCount > 0 && pushTo(e, e.dir, e.outType)) {
            if (--e.outCount === 0) e.outType = null;
          }
          break;
        }

        case 'assembler': {
          const rc = RECIPES[e.recipe];
          e.active = false;
          let ready = e.out < 10;
          for (const k in rc.in) if ((e.buf[k] || 0) < rc.in[k]) ready = false;
          if (ready) {
            e.active = true;
            e.prog += dt;
            if (e.prog >= rc.time) {
              e.prog = 0;
              for (const k in rc.in) e.buf[k] -= rc.in[k];
              e.out++;
            }
          }
          if (e.out > 0 && pushTo(e, e.dir, rc.out)) e.out--;
          break;
        }

        case 'splitter':
          if (e.item) {
            for (let k = 0; k < 3; k++) {
              const idx = (e.rr + k) % 3;
              const d = (e.dir + [0, 3, 1][idx]) % 4; // adelante, izquierda, derecha
              if (pushTo(e, d, e.item)) { e.item = null; e.rr = (idx + 1) % 3; break; }
            }
          }
          break;
      }
    }
    checkGoals();
  }

  function checkGoals() {
    const g = GOALS[S.goal];
    if (!g) return;
    for (const k in g.need) if ((S.delivered[k] || 0) < g.need[k]) return;
    S.goal++;
    if (g.unlock) {
      S.unlocked[g.unlock] = true;
      toast(`¡Objetivo cumplido! Desbloqueaste: <b>${BUILDINGS[g.unlock].name}</b>`);
    }
    if (g.final) {
      S.won = true;
      showWin();
    }
    save();
  }

  // ================== Dibujo ==================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = 1, cw = 0, ch = 0;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }

  function drawItem(g, item, x, y, s) {
    const it = ITEMS[item];
    g.fillStyle = it.color;
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.lineWidth = 1.2;
    g.beginPath();
    if (it.shape === 'plate') g.rect(x - s, y - s * 0.7, s * 2, s * 1.4);
    else if (it.shape === 'chip') g.rect(x - s, y - s, s * 2, s * 2);
    else if (it.shape === 'gear') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? s : s * 0.7;
        i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + r, y);
      }
      g.closePath();
    } else g.arc(x, y, s, 0, Math.PI * 2);
    g.fill(); g.stroke();
    if (it.shape === 'chip') { g.fillStyle = '#e8d44d'; g.fillRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8); }
    if (it.shape === 'gear') { g.fillStyle = '#333'; g.beginPath(); g.arc(x, y, s * 0.3, 0, Math.PI * 2); g.fill(); }
  }

  function drawArrow(g, cx, cy, dir, color) {
    g.save();
    g.translate(cx, cy);
    g.rotate(dir * Math.PI / 2);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(15, 0); g.lineTo(9, -5); g.lineTo(9, 5);
    g.closePath(); g.fill();
    g.restore();
  }

  // Dibuja un edificio en coordenadas de mundo (x0, y0 = esquina superior izquierda)
  function drawBuilding(g, e, x0, y0, t) {
    const cx = x0 + TILE / 2, cy = y0 + TILE / 2;
    switch (e.type) {
      case 'belt': case 'fastbelt': {
        const fast = e.type === 'fastbelt';
        g.fillStyle = fast ? '#3a3524' : '#262a30';
        g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
        g.save();
        g.translate(cx, cy);
        g.rotate(e.dir * Math.PI / 2);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(-15, -12, 30, 24);
        g.strokeStyle = fast ? '#c9a640' : '#59616d';
        g.lineWidth = 2;
        const off = (t * BUILDINGS[e.type].speed * TILE) % 32;
        g.beginPath();
        for (let i = 0; i < 2; i++) {
          const p = -11 + ((i * 16 + off) % 32) * 22 / 32;
          g.moveTo(p - 3, -6); g.lineTo(p + 2, 0); g.lineTo(p - 3, 6);
        }
        g.stroke();
        g.restore();
        break;
      }
      case 'miner': {
        g.fillStyle = '#b8902a';
        g.fillRect(x0 + 2, y0 + 2, TILE - 4, TILE - 4);
        g.strokeStyle = '#6e5418'; g.lineWidth = 2;
        g.strokeRect(x0 + 3, y0 + 3, TILE - 6, TILE - 6);
        g.save();
        g.translate(cx, cy);
        g.rotate(e.active ? t * 6 : 0);
        g.fillStyle = '#4b4b4b';
        g.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI * 2 / 3;
          g.moveTo(0, 0);
          g.arc(0, 0, 9, a, a + 0.8);
        }
        g.fill();
        g.restore();
        drawArrow(g, cx, cy, e.dir, '#fff3c4');
        break;
      }
      case 'furnace': {
        g.fillStyle = '#7b4a3a';
        g.fillRect(x0 + 2, y0 + 2, TILE - 4, TILE - 4);
        g.fillStyle = '#5a3328';
        for (let r = 0; r < 4; r++) g.fillRect(x0 + 2, y0 + 8 + r * 6, TILE - 4, 1);
        const glow = e.active ? 0.6 + 0.4 * Math.sin(t * 10 + e.x) : 0;
        g.fillStyle = e.active ? `rgba(255,${120 + glow * 80},40,${0.7 + glow * 0.3})` : '#2a1a14';
        g.beginPath(); g.arc(cx, cy + 2, 7, Math.PI, 0); g.lineTo(cx + 7, cy + 8); g.lineTo(cx - 7, cy + 8); g.fill();
        drawArrow(g, cx, cy, e.dir, '#ffd9b0');
        break;
      }
      case 'assembler': {
        g.fillStyle = '#35537e';
        g.fillRect(x0 + 2, y0 + 2, TILE - 4, TILE - 4);
        g.strokeStyle = '#7ea4d6'; g.lineWidth = 1.5;
        g.strokeRect(x0 + 4.5, y0 + 4.5, TILE - 9, TILE - 9);
        drawItem(g, RECIPES[e.recipe].out, cx, cy, 6);
        if (e.prog > 0) {
          g.fillStyle = '#5cc47a';
          g.fillRect(x0 + 5, y0 + TILE - 7, (TILE - 10) * (e.prog / RECIPES[e.recipe].time), 3);
        }
        drawArrow(g, cx, cy, e.dir, '#cfe0ff');
        break;
      }
      case 'splitter': {
        g.fillStyle = '#5b4180';
        g.fillRect(x0 + 2, y0 + 2, TILE - 4, TILE - 4);
        for (const d of [0, 3, 1]) drawArrow(g, cx, cy, (e.dir + d) % 4, d === 0 ? '#ead9ff' : '#b79be0');
        g.fillStyle = '#ead9ff';
        g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'hub': {
        const s = TILE * 3;
        g.fillStyle = '#3d4552';
        g.fillRect(x0 + 2, y0 + 2, s - 4, s - 4);
        g.strokeStyle = '#f0a742'; g.lineWidth = 3;
        g.strokeRect(x0 + 5, y0 + 5, s - 10, s - 10);
        g.fillStyle = '#f0a742';
        g.font = 'bold 13px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('NÚCLEO', x0 + s / 2, y0 + s / 2 - 6);
        g.font = '18px system-ui, sans-serif';
        g.fillText('🚀', x0 + s / 2, y0 + s / 2 + 14);
        break;
      }
    }
  }

  function drawItemsOn(g, e) {
    const cx = e.x * TILE + TILE / 2, cy = e.y * TILE + TILE / 2;
    if (isBelt(e.type) && e.item) {
      const [dx, dy] = DIRS[e.dir];
      const k = (e.prog - 0.5) * TILE;
      drawItem(g, e.item, cx + dx * k, cy + dy * k, 5);
    } else if (e.type === 'splitter' && e.item) {
      drawItem(g, e.item, cx, cy, 4);
    }
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1014';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const z = view.zoom * dpr;
    ctx.setTransform(z, 0, 0, z, dpr * (cw / 2 - view.x * view.zoom), dpr * (ch / 2 - view.y * view.zoom));
    ctx.imageSmoothingEnabled = view.zoom < 1;
    ctx.drawImage(mapCanvas, 0, 0);

    // Solo dibujar lo visible
    const x0 = view.x - cw / 2 / view.zoom - TILE * 3, x1 = view.x + cw / 2 / view.zoom + TILE;
    const y0 = view.y - ch / 2 / view.zoom - TILE * 3, y1 = view.y + ch / 2 / view.zoom + TILE;
    const visible = S.entities.filter((e) => {
      const px = e.x * TILE, py = e.y * TILE;
      return px >= x0 && px <= x1 && py >= y0 && py <= y1;
    });
    for (const e of visible) drawBuilding(ctx, e, e.x * TILE, e.y * TILE, time);
    for (const e of visible) drawItemsOn(ctx, e);

    // Vista previa del edificio a colocar
    if (hover && tool !== 'hand' && !panning) {
      const res = canPlace(tool, hover.x, hover.y);
      ctx.globalAlpha = 0.55;
      drawBuilding(ctx, makeEntity(tool, hover.x, hover.y, toolDir), hover.x * TILE, hover.y * TILE, time);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = res.ok ? '#5cc47a' : '#e5534b';
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2);
    } else if (hover && tool === 'hand') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      const e = at(hover.x, hover.y);
      if (e) {
        const s = sizeOf(e);
        ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, TILE * s - 2, TILE * s - 2);
      } else {
        ctx.strokeRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2);
      }
    }

    // Barra de extracción manual
    if (handMining) {
      const { x, y, prog } = handMining;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x * TILE + 3, y * TILE - 8, TILE - 6, 5);
      ctx.fillStyle = '#f0a742';
      ctx.fillRect(x * TILE + 3, y * TILE - 8, (TILE - 6) * (prog / HAND_MINE_TIME), 5);
    }
  }

  // ================== Interfaz ==================
  const $ = (id) => document.getElementById(id);
  const invEl = $('inventory'), toolbarEl = $('toolbar'), goalEl = $('goal-body');
  const tooltipEl = $('tooltip'), toastEl = $('toast');
  const toolButtons = {};

  function buildInventoryUI() {
    invEl.innerHTML = ITEM_ORDER.map((k) =>
      `<div class="inv-item" data-item="${k}" title="${ITEMS[k].name}">` +
      `<span class="dot ${ITEMS[k].shape}" style="background:${ITEMS[k].color}"></span>` +
      `<span class="n">0</span></div>`).join('');
  }

  function buildToolbar() {
    toolbarEl.innerHTML = '';
    const mk = (id, label, key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool';
      b.innerHTML = `<span class="key">${key}</span><canvas width="80" height="80"></canvas><span class="label">${label}</span><span class="cost"></span>`;
      b.addEventListener('click', () => selectTool(id));
      toolbarEl.appendChild(b);
      toolButtons[id] = b;
      const g = b.querySelector('canvas').getContext('2d');
      g.scale(80 / TILE, 80 / TILE);
      if (id === 'hand') {
        g.font = '22px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('✋', TILE / 2, TILE / 2 + 1);
      } else {
        drawBuilding(g, makeEntity(id, 0, 0, 0), 0, 0, 0);
      }
    };
    mk('hand', 'Mano', 'Esc');
    TOOL_ORDER.forEach((id, i) => mk(id, BUILDINGS[id].name, i + 1));
  }

  function updateUI() {
    for (const el of invEl.children) {
      const n = Math.floor(S.inv[el.dataset.item] || 0);
      el.querySelector('.n').textContent = n;
      el.classList.toggle('zero', n === 0);
    }
    for (const id in toolButtons) {
      const b = toolButtons[id];
      b.classList.toggle('selected', tool === id);
      if (id === 'hand') { b.querySelector('.cost').textContent = 'extraer'; continue; }
      const locked = !S.unlocked[id];
      b.classList.toggle('locked', locked);
      b.classList.toggle('poor', !locked && !canAfford(BUILDINGS[id].cost));
      b.querySelector('.cost').textContent = locked ? '🔒 bloqueado' :
        Object.entries(BUILDINGS[id].cost).map(([k, n]) => `${n} ${ITEMS[k].name.split(' ').pop()}`).join(' + ');
      b.title = `${BUILDINGS[id].name}: ${BUILDINGS[id].desc}\nCosto: ${costText(BUILDINGS[id].cost)}`;
    }
    const g = GOALS[S.goal];
    if (!g) {
      goalEl.innerHTML = '<div class="goal-desc">🚀 ¡Completaste todos los objetivos! Seguí expandiendo tu fábrica.</div>';
    } else {
      let html = `<div class="goal-desc">${S.goal + 1}/${GOALS.length} · ${g.desc}</div>`;
      for (const k in g.need) {
        const have = Math.min(S.delivered[k] || 0, g.need[k]);
        html += `<div class="goal-row"><div class="label"><span>${ITEMS[k].name}</span><span>${have} / ${g.need[k]}</span></div>` +
          `<div class="bar"><div style="width:${(100 * have / g.need[k]).toFixed(1)}%"></div></div></div>`;
      }
      html += `<div class="goal-reward">${g.final ? 'Recompensa: ¡lanzar el cohete!' : `Desbloquea: ${BUILDINGS[g.unlock].name}`}</div>`;
      goalEl.innerHTML = html;
    }
    updateTooltip();
  }

  function selectTool(id) {
    if (id !== 'hand' && !S.unlocked[id]) {
      const goal = GOALS.find((g) => g.unlock === id);
      toast(`${BUILDINGS[id].name} está bloqueado. ${goal ? `Se desbloquea con: “${goal.desc}”` : ''}`);
      return;
    }
    tool = id;
    updateUI();
  }

  function toast(html) {
    const d = document.createElement('div');
    d.className = 'toast-msg';
    d.innerHTML = html;
    toastEl.appendChild(d);
    setTimeout(() => d.remove(), 3500);
  }

  function describe(e) {
    const dirName = ['→', '↓', '←', '↑'][e.dir];
    switch (e.type) {
      case 'hub': return '<b>Núcleo</b><br>Todo lo que entra acá va a tu inventario y cuenta para los objetivos.';
      case 'belt': case 'fastbelt':
        return `<b>${BUILDINGS[e.type].name}</b> ${dirName}<br>${e.item ? ITEMS[e.item].name : 'Vacía'}`;
      case 'miner': {
        const o = oreAt(e.x, e.y);
        return `<b>Taladro</b> ${dirName}<br>Extrae: ${ITEMS[o].name}${e.buf ? '<br><i>Bloqueado: la salida está llena</i>' : ''}`;
      }
      case 'furnace':
        return `<b>Horno</b> ${dirName}<br>Entrada: ${e.inType ? `${e.inCount} ${ITEMS[e.inType].name}` : '—'}` +
          `<br>Carbón: ${e.fuel}${e.fuel === 0 && e.burn <= 0 ? ' ⚠️ sin combustible' : ''}` +
          `<br>Salida: ${e.outType ? `${e.outCount} ${ITEMS[e.outType].name}` : '—'}` +
          '<br><i>Clic con la mano: cargar carbón y recoger placas</i>';
      case 'assembler': {
        const rc = RECIPES[e.recipe];
        const ins = Object.entries(rc.in).map(([k, n]) => `${e.buf[k] || 0}/${n} ${ITEMS[k].name}`).join('<br>');
        return `<b>Ensambladora</b> ${dirName}<br>Receta: ${ITEMS[rc.out].name}<br>${ins}<br>Salida: ${e.out}` +
          '<br><i>Clic con la mano: cambiar receta</i>';
      }
      case 'splitter': return `<b>Divisor</b> ${dirName}<br>Reparte en tres direcciones.`;
    }
    return '';
  }

  function updateTooltip() {
    let html = '';
    if (hover && !panning) {
      if (tool === 'hand') {
        const e = at(hover.x, hover.y);
        const o = oreAt(hover.x, hover.y);
        if (e) html = describe(e);
        else if (o) html = `<b>${ITEMS[o].name}</b><br>Mantené clic para extraer a mano.`;
      } else {
        const res = canPlace(tool, hover.x, hover.y);
        html = `<b>${BUILDINGS[tool].name}</b><br>${BUILDINGS[tool].desc}<br>Costo: ${costText(BUILDINGS[tool].cost)}` +
          (res.ok ? '' : res.why ? `<br><span style="color:#e5534b">${res.why}</span>` : '');
      }
    }
    if (!html) { tooltipEl.hidden = true; return; }
    tooltipEl.innerHTML = html;
    tooltipEl.hidden = false;
    const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
    tooltipEl.style.left = Math.min(mouse.x + 16, cw - tw - 8) + 'px';
    tooltipEl.style.top = Math.min(mouse.y + 16, ch - th - 8) + 'px';
  }

  function showWin() {
    const mins = Math.floor(S.playTime / 60);
    $('win-stats').textContent = `Tiempo de juego: ${mins} min · Edificios: ${S.entities.length - 1}`;
    $('win').hidden = false;
  }

  // ================== Entrada ==================
  const mouse = { x: 0, y: 0 };
  let hover = null;
  let panning = null;     // { x, y, vx, vy }
  let dragging = null;    // { x, y, placed }
  let deleting = false;
  let handMining = null;  // { x, y, prog }
  const keys = new Set();

  function screenToTile(sx, sy) {
    const wx = (sx - cw / 2) / view.zoom + view.x;
    const wy = (sy - ch / 2) / view.zoom + view.y;
    return { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) };
  }

  function dirBetween(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx === 1 && dy === 0) return 0;
    if (dx === 0 && dy === 1) return 1;
    if (dx === -1 && dy === 0) return 2;
    if (dx === 0 && dy === -1) return 3;
    return -1;
  }

  // Al arrastrar cintas, la dirección sigue al mouse y se rellenan las casillas intermedias
  function dragTo(target) {
    if (!isBelt(tool)) {
      if (target.x !== dragging.x || target.y !== dragging.y) {
        place(tool, target.x, target.y, toolDir);
        dragging.x = target.x; dragging.y = target.y;
      }
      return;
    }
    let guard = 200;
    while ((dragging.x !== target.x || dragging.y !== target.y) && guard-- > 0) {
      const next = { x: dragging.x, y: dragging.y };
      if (next.x !== target.x) next.x += Math.sign(target.x - next.x);
      else next.y += Math.sign(target.y - next.y);
      const d = dirBetween(dragging, next);
      toolDir = d;
      const prev = at(dragging.x, dragging.y);
      if (prev && prev === dragging.placed) prev.dir = d;
      dragging.placed = place(tool, next.x, next.y, d);
      dragging.x = next.x; dragging.y = next.y;
    }
  }

  function interact(e) {
    if (e.type === 'furnace') {
      const n = Math.min(Math.floor(S.inv.coal || 0), 10 - e.fuel);
      let msg = [];
      if (n > 0) { S.inv.coal -= n; e.fuel += n; msg.push(`+${n} carbón al horno`); }
      if (e.outCount > 0) {
        add(S.inv, e.outType, e.outCount);
        msg.push(`recogiste ${e.outCount} ${ITEMS[e.outType].name.toLowerCase()}`);
        e.outCount = 0; e.outType = null;
      }
      if (!msg.length) msg.push(e.fuel >= 10 ? 'El horno ya está lleno de carbón' : 'No tenés carbón en el inventario');
      toast(msg.join(' · '));
    } else if (e.type === 'assembler') {
      refund(e.buf);
      if (e.out) add(S.inv, RECIPES[e.recipe].out, e.out);
      e.buf = {}; e.out = 0; e.prog = 0;
      e.recipe = RECIPE_ORDER[(RECIPE_ORDER.indexOf(e.recipe) + 1) % RECIPE_ORDER.length];
      toast(`Ensambladora: ahora fabrica ${ITEMS[RECIPES[e.recipe].out].name.toLowerCase()}`);
    }
  }

  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  canvas.addEventListener('mousedown', (ev) => {
    mouse.x = ev.clientX; mouse.y = ev.clientY;
    const t = screenToTile(ev.clientX, ev.clientY);
    if (ev.button === 1) { panning = { x: ev.clientX, y: ev.clientY }; ev.preventDefault(); return; }
    if (ev.button === 2) {
      deleting = true;
      remove(t.x, t.y);
      return;
    }
    if (ev.button !== 0) return;
    if (tool === 'hand') {
      const e = at(t.x, t.y);
      if (e) interact(e);
      else if (oreAt(t.x, t.y)) handMining = { x: t.x, y: t.y, prog: 0 };
      else panning = { x: ev.clientX, y: ev.clientY };
    } else {
      dragging = { x: t.x, y: t.y, placed: place(tool, t.x, t.y, toolDir) };
    }
    updateUI();
  });

  window.addEventListener('mousemove', (ev) => {
    mouse.x = ev.clientX; mouse.y = ev.clientY;
    if (panning) {
      view.x -= (ev.clientX - panning.x) / view.zoom;
      view.y -= (ev.clientY - panning.y) / view.zoom;
      panning.x = ev.clientX; panning.y = ev.clientY;
      clampView();
    }
    const t = screenToTile(ev.clientX, ev.clientY);
    const changed = !hover || hover.x !== t.x || hover.y !== t.y;
    hover = ev.target === canvas ? t : null;
    if (changed) {
      if (dragging) dragTo(t);
      if (deleting) remove(t.x, t.y);
      if (handMining && (handMining.x !== t.x || handMining.y !== t.y)) {
        handMining = oreAt(t.x, t.y) && !at(t.x, t.y) ? { x: t.x, y: t.y, prog: 0 } : null;
      }
    }
    updateTooltip();
  });

  window.addEventListener('mouseup', () => {
    panning = null; dragging = null; deleting = false; handMining = null;
    updateUI();
  });

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const before = { x: (ev.clientX - cw / 2) / view.zoom + view.x, y: (ev.clientY - ch / 2) / view.zoom + view.y };
    view.zoom = Math.min(2.5, Math.max(0.35, view.zoom * Math.exp(-ev.deltaY * 0.0015)));
    // Mantener fijo el punto bajo el cursor
    view.x = before.x - (ev.clientX - cw / 2) / view.zoom;
    view.y = before.y - (ev.clientY - ch / 2) / view.zoom;
    clampView();
  }, { passive: false });

  window.addEventListener('keydown', (ev) => {
    if (!$('help').hidden || !$('win').hidden) {
      if (ev.key === 'Escape') { $('help').hidden = true; $('win').hidden = true; }
      return;
    }
    const k = ev.key.toLowerCase();
    keys.add(k);
    if (k === 'escape' || k === 'q') selectTool('hand');
    else if (k >= '1' && k <= String(TOOL_ORDER.length)) selectTool(TOOL_ORDER[Number(k) - 1]);
    else if (k === 'r') {
      const step = ev.shiftKey ? 3 : 1;
      const e = tool === 'hand' && hover ? at(hover.x, hover.y) : null;
      if (e && e.type !== 'hub') e.dir = (e.dir + step) % 4;
      else toolDir = (toolDir + step) % 4;
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => keys.delete(ev.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  function clampView() {
    view.x = Math.max(0, Math.min(W * TILE, view.x));
    view.y = Math.max(0, Math.min(H * TILE, view.y));
  }

  function handleKeysPan(dt) {
    const sp = 700 * dt / view.zoom;
    if (keys.has('w') || keys.has('arrowup')) view.y -= sp;
    if (keys.has('s') || keys.has('arrowdown')) view.y += sp;
    if (keys.has('a') || keys.has('arrowleft')) view.x -= sp;
    if (keys.has('d') || keys.has('arrowright')) view.x += sp;
    clampView();
  }

  // ================== Guardado ==================
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...S, view: { ...view } })); } catch (_) { /* sin almacenamiento */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1 || !Array.isArray(data.entities)) return false;
      const { view: v, ...state } = data;
      S = state;
      if (v) Object.assign(view, v);
      return true;
    } catch (_) {
      return false;
    }
  }

  function startNewGame(seed) {
    S = newState(seed);
    generateMap(S.seed);
    const cx = W >> 1, cy = H >> 1;
    S.entities.push(makeEntity('hub', cx - 1, cy - 1));
    rebuildGrid();
    view.x = cx * TILE + TILE / 2;
    view.y = cy * TILE + TILE / 2;
    view.zoom = 1;
    tool = 'hand';
    toolDir = 0;
    save();
  }

  // ================== Arranque ==================
  function init() {
    resize();
    window.addEventListener('resize', resize);
    if (load()) {
      generateMap(S.seed);
      rebuildGrid();
    } else {
      startNewGame((Math.random() * 2 ** 31) | 0);
      $('help').hidden = false;
    }
    buildInventoryUI();
    buildToolbar();
    updateUI();

    $('btn-help').addEventListener('click', () => { $('help').hidden = false; });
    $('btn-help-close').addEventListener('click', () => { $('help').hidden = true; });
    $('btn-win-close').addEventListener('click', () => { $('win').hidden = true; });
    $('btn-new').addEventListener('click', () => {
      if (confirm('¿Empezar un juego nuevo? Se pierde la fábrica actual.')) {
        startNewGame((Math.random() * 2 ** 31) | 0);
        updateUI();
      }
    });
    window.addEventListener('beforeunload', save);
    setInterval(save, 5000);
    setInterval(updateUI, 200);

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;
      handleKeysPan(dt);
      if (handMining) {
        handMining.prog += dt;
        if (handMining.prog >= HAND_MINE_TIME) {
          handMining.prog = 0;
          add(S.inv, oreAt(handMining.x, handMining.y), 1);
        }
      }
      update(dt);
      render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // Acceso para depurar desde la consola
    window.fabrica = { get state() { return S; }, place, remove, update, at };
  }

  init();
})();
