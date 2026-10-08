'use strict';
// =====================================================================
//  Dibujo: objetos, edificios, enemigos, noche y vistas previas
// =====================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { x: 0, y: 0, zoom: 1 };
let dpr = 1, cw = 0, ch = 0;
let time = 0;

const LOD_ZOOM = 0.45; // por debajo de este zoom se dibuja simplificado

const TYPE_COLOR = {
  hub: '#f0a742', belt: '#c9a23a', fastbelt: '#c8503f', expressbelt: '#4a96d4', underground: '#a8862e',
  splitter: '#8a63c4', sorter: '#2fa59a', chest: '#8b5a2b', miner: '#c9a227', eminer: '#3e7cb1', pumpjack: '#8e7fa8',
  furnace: '#a0583f', efurnace: '#9aa3ad', assembler: '#4a72aa', assembler2: '#8a52b5', chem: '#3f8a52', lab: '#5fb4de',
  generator: '#5d6570', pole: '#a8743a', bigpole: '#a0aab5', solar: '#2c4a7a', accumulator: '#7d858f', lamp: '#f0e08a',
  woodchest: '#9a6a3a', nursery: '#6fbf5a', purifier: '#7fd1b5', uplink: '#ff8a5c', fusion_plant: '#ffd166', starport: '#8a7dff',
  wall: '#8f8676', turret: '#b8c08a', laser: '#9fa8ff', shipyard: '#6b737d', nest: '#9a3b6e',
  foundry: '#e07a3a', bigminer: '#c9a23a', turbobelt: '#3a9a5a', vulcanpad: '#ff7a3a', storagechest: '#e8d070', activechest: '#c08ae5', bufferchest: '#8fe0a0', road: '#a8664a', concrete_floor: '#9a9a94', refined_floor: '#6a6e72', landmine: '#5a2a20', dispatcher: '#5aa0ff', moonpad: '#e0b84a', lander: '#d9a03a', lightningrod: '#d98a4a', antenna: '#7fd1ff', longinserter: '#d9534f', stackinserter: '#5cc47a', steelfurnace: '#7c8794', assembler3: '#2f8f8a', refinery: '#4f6b3a', beacon: '#6f8fd8',
  mediumpole: '#9aa3ad', substation: '#c0c8d0', pump: '#7da0c0', gate: '#d9b84a', flameturret: '#e07a3a', artillery: '#6b7a4a',
  sensor: '#8fbff0', centrifuge: '#7be05a', reactor: '#9aa3ad', heatex: '#d07a3a', heatpipe: '#c06a2a', steam_turbine: '#b8c6d2', constant: '#c9a23a', arith: '#3f86e0', decider: '#b45fe0', signal: '#e5534b', providerchest: '#d9534f', requesterchest: '#3f86e0', inserter: '#e0b84a', fastinserter: '#5aa0ff', receiver: '#f0a742', pipe: '#7d868f', fluidtank: '#9aa3ad', steelchest: '#7d858f', roboport: '#b8d27a', rail: '#8a7a66', station: '#f0a742', offshore: '#5aa0e0', boiler: '#c9a27a', steam_engine: '#b8c6d2', radar: '#c9d6dd',
};

// Dibujos propios para los objetos que, con la forma genérica, se confundían entre sí
const OUTLINE = 'rgba(0,0,0,0.65)';
function poly(g, pts) { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); }
function fs(g, fill) { g.fillStyle = fill; g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 1.1; g.stroke(); }
const ITEM_ART = {
  // Partes de monstruos
  quitina: (g, x, y, s) => {
    g.beginPath(); g.moveTo(x - s, y + s * 0.5); g.quadraticCurveTo(x - s * 0.6, y - s, x + s * 0.9, y - s * 0.6); g.quadraticCurveTo(x + s * 0.4, y + s * 0.2, x - s, y + s * 0.5); fs(g, '#9c7a3c');
    g.strokeStyle = 'rgba(60,40,15,0.7)'; g.lineWidth = Math.max(1, s * 0.1);
    g.beginPath(); g.moveTo(x - s * 0.5, y + s * 0.25); g.quadraticCurveTo(x - s * 0.2, y - s * 0.5, x + s * 0.5, y - s * 0.55); g.moveTo(x - s * 0.1, y + s * 0.05); g.lineTo(x + s * 0.1, y - s * 0.55); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - s * 0.2, y - s * 0.35, s * 0.3, s * 0.1, -0.5, 0, Math.PI * 2); g.fill();
  },
  colmillo: (g, x, y, s) => {
    g.beginPath(); g.moveTo(x - s * 0.55, y - s * 0.8); g.quadraticCurveTo(x + s * 0.9, y - s * 0.6, x + s * 0.3, y + s); g.quadraticCurveTo(x + s * 0.1, y - s * 0.1, x - s * 0.55, y - s * 0.8); fs(g, '#efe6cf');
    g.fillStyle = '#b89f7a'; g.beginPath(); g.ellipse(x - s * 0.35, y - s * 0.75, s * 0.32, s * 0.16, 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(x + s * 0.2, y - s * 0.2, s * 0.08, s * 0.35, -0.4, 0, Math.PI * 2); g.fill();
  },
  cristal: (g, x, y, s) => {
    const shard = (cx, h, w, col) => { poly(g, [[cx, y - h], [cx + w, y - h * 0.55], [cx + w * 0.7, y + s * 0.8], [cx - w * 0.7, y + s * 0.8], [cx - w, y - h * 0.55]]); fs(g, col); };
    shard(x - s * 0.45, s * 0.5, s * 0.3, '#3fb8a8');
    shard(x + s * 0.45, s * 0.6, s * 0.3, '#3fb8a8');
    shard(x, s, s * 0.38, '#62e0d0');
    g.fillStyle = 'rgba(255,255,255,0.6)'; poly(g, [[x, y - s], [x + s * 0.12, y - s * 0.5], [x, y + s * 0.5], [x - s * 0.1, y - s * 0.5]]); g.fill();
  },
  corazon: (g, x, y, s) => {
    const glow = g.createRadialGradient(x, y, 1, x, y, s * 1.3);
    glow.addColorStop(0, 'rgba(255,90,110,0.55)'); glow.addColorStop(1, 'rgba(255,90,110,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, s * 1.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x, y + s * 0.85);
    g.bezierCurveTo(x - s * 1.2, y, x - s * 0.7, y - s * 1.0, x, y - s * 0.4);
    g.bezierCurveTo(x + s * 0.7, y - s * 1.0, x + s * 1.2, y, x, y + s * 0.85); fs(g, '#d9455f');
    g.strokeStyle = 'rgba(90,10,30,0.6)'; g.lineWidth = Math.max(1, s * 0.08);
    g.beginPath(); g.moveTo(x - s * 0.1, y - s * 0.3); g.quadraticCurveTo(x - s * 0.35, y + s * 0.1, x - s * 0.1, y + s * 0.45); g.moveTo(x + s * 0.2, y - s * 0.25); g.lineTo(x + s * 0.35, y + s * 0.15); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(x - s * 0.4, y - s * 0.35, s * 0.18, s * 0.1, -0.6, 0, Math.PI * 2); g.fill();
  },
  // Motor: bloque con cilindros y un engranaje al costado
  engine: (g, x, y, s) => {
    g.beginPath(); g.rect(x - s * 0.9, y - s * 0.55, s * 1.4, s * 1.2); fs(g, '#6c7a89');
    g.fillStyle = '#3d4650'; for (let i = 0; i < 3; i++) g.fillRect(x - s * 0.75 + i * s * 0.42, y - s * 0.9, s * 0.3, s * 0.4);
    g.beginPath(); g.arc(x + s * 0.6, y + s * 0.15, s * 0.42, 0, Math.PI * 2); fs(g, '#9aa7b5');
  },
  // Motor eléctrico: cilindro azul con bobina de cobre
  electric_engine: (g, x, y, s) => {
    g.beginPath(); g.rect(x - s * 0.95, y - s * 0.6, s * 1.6, s * 1.2); fs(g, '#4d8fc4');
    g.fillStyle = '#e8873a'; for (let i = 0; i < 4; i++) g.fillRect(x - s * 0.75 + i * s * 0.36, y - s * 0.6, s * 0.18, s * 1.2);
    g.beginPath(); g.rect(x + s * 0.65, y - s * 0.15, s * 0.4, s * 0.3); fs(g, '#c9d1db');
  },
  // Placa de casco: chapa curva remachada
  hull: (g, x, y, s) => {
    g.beginPath(); g.moveTo(x - s, y - s * 0.4); g.quadraticCurveTo(x, y - s * 1.1, x + s, y - s * 0.4); g.lineTo(x + s, y + s * 0.7); g.quadraticCurveTo(x, y + s * 0.1, x - s, y + s * 0.7); g.closePath(); fs(g, '#cfd6dd');
    g.fillStyle = '#7d858f'; for (const k of [-0.6, 0, 0.6]) { g.beginPath(); g.arc(x + k * s, y + (Math.abs(k) > 0 ? 0.05 : -0.2) * s, s * 0.1, 0, Math.PI * 2); g.fill(); }
  },
  // Propulsor: tobera con llama
  thruster: (g, x, y, s) => {
    poly(g, [[x - s * 0.5, y - s], [x + s * 0.5, y - s], [x + s * 0.85, y + s * 0.35], [x - s * 0.85, y + s * 0.35]]); fs(g, '#9aa3ad');
    poly(g, [[x - s * 0.55, y + s * 0.35], [x + s * 0.55, y + s * 0.35], [x, y + s * 1.15]]); g.fillStyle = '#ff8a1f'; g.fill();
    poly(g, [[x - s * 0.25, y + s * 0.35], [x + s * 0.25, y + s * 0.35], [x, y + s * 0.8]]); g.fillStyle = '#fff1a8'; g.fill();
  },
  // Computadora de navegación: pantalla con mira
  nav_computer: (g, x, y, s) => {
    g.beginPath(); g.rect(x - s, y - s * 0.8, s * 2, s * 1.5); fs(g, '#2f4a66');
    g.beginPath(); g.rect(x - s * 0.75, y - s * 0.6, s * 1.5, s * 1.05); g.fillStyle = '#123'; g.fill();
    g.strokeStyle = '#7fd1ff'; g.lineWidth = 1; g.beginPath(); g.arc(x, y - s * 0.07, s * 0.35, 0, Math.PI * 2); g.moveTo(x - s * 0.55, y - s * 0.07); g.lineTo(x + s * 0.55, y - s * 0.07); g.moveTo(x, y - s * 0.55); g.lineTo(x, y + s * 0.4); g.stroke();
  },
  // Soporte vital: tanque de oxígeno con cruz
  life_support: (g, x, y, s) => {
    g.beginPath(); g.ellipse(x, y + s * 0.05, s * 0.7, s * 0.95, 0, 0, Math.PI * 2); fs(g, '#3cc47c');
    g.fillStyle = '#c9d1db'; g.fillRect(x - s * 0.2, y - s * 1.15, s * 0.4, s * 0.3);
    g.fillStyle = '#fff'; g.fillRect(x - s * 0.12, y - s * 0.4, s * 0.24, s * 0.8); g.fillRect(x - s * 0.4, y - s * 0.12, s * 0.8, s * 0.24);
  },
  // Módulo de hábitat: cúpula con ventanas
  habitat: (g, x, y, s) => {
    g.beginPath(); g.arc(x, y + s * 0.4, s, Math.PI, 0); g.closePath(); fs(g, '#9ad17f');
    g.beginPath(); g.rect(x - s, y + s * 0.4, s * 2, s * 0.35); fs(g, '#6f8a60');
    g.fillStyle = '#d9f2ff'; for (const k of [-0.45, 0, 0.45]) { g.beginPath(); g.arc(x + k * s, y, s * 0.16, 0, Math.PI * 2); g.fill(); }
  },
  // Motor de curvatura: anillo con remolino
  warp_drive: (g, x, y, s) => {
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); fs(g, '#4a3f8f');
    g.strokeStyle = '#b8b0ff'; g.lineWidth = s * 0.22; g.beginPath(); g.arc(x, y, s * 0.62, 0.3, Math.PI * 1.7); g.stroke();
    g.fillStyle = '#e6e2ff'; g.beginPath(); g.arc(x, y, s * 0.25, 0, Math.PI * 2); g.fill();
  },
  // Núcleo de fusión: esfera brillante en una jaula
  fusion_core: (g, x, y, s) => {
    g.beginPath(); g.arc(x, y, s * 0.95, 0, Math.PI * 2); fs(g, '#5b5f6a');
    g.fillStyle = '#ffd166'; g.beginPath(); g.arc(x, y, s * 0.55, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(x - s * 0.15, y - s * 0.15, s * 0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2b2f36'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - s * 0.95, y); g.lineTo(x + s * 0.95, y); g.moveTo(x, y - s * 0.95); g.lineTo(x, y + s * 0.95); g.stroke();
  },
  // Escudo deflector: escudo
  shield: (g, x, y, s) => {
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.85, y - s * 0.6); g.quadraticCurveTo(x + s * 0.8, y + s * 0.6, x, y + s * 1.05); g.quadraticCurveTo(x - s * 0.8, y + s * 0.6, x - s * 0.85, y - s * 0.6); g.closePath(); fs(g, '#59c3ff');
    g.strokeStyle = '#e6f6ff'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - s * 0.6); g.lineTo(x, y + s * 0.6); g.stroke();
  },
  // Carga orbital: misil
  orbital_charge: (g, x, y, s) => {
    g.beginPath(); g.moveTo(x, y - s * 1.1); g.quadraticCurveTo(x + s * 0.45, y - s * 0.6, x + s * 0.4, y + s * 0.5); g.lineTo(x - s * 0.4, y + s * 0.5); g.quadraticCurveTo(x - s * 0.45, y - s * 0.6, x, y - s * 1.1); g.closePath(); fs(g, '#e7e3dc');
    poly(g, [[x - s * 0.4, y + s * 0.1], [x - s * 0.85, y + s * 0.9], [x - s * 0.4, y + s * 0.6]]); fs(g, '#ff6a3d');
    poly(g, [[x + s * 0.4, y + s * 0.1], [x + s * 0.85, y + s * 0.9], [x + s * 0.4, y + s * 0.6]]); fs(g, '#ff6a3d');
    g.fillStyle = '#ff6a3d'; g.fillRect(x - s * 0.4, y - s * 0.25, s * 0.8, s * 0.18);
  },
  // Explosivos: cartuchos atados
  explosives: (g, x, y, s) => {
    for (const k of [-0.55, 0, 0.55]) { g.beginPath(); g.rect(x + k * s - s * 0.25, y - s * 0.75, s * 0.5, s * 1.5); fs(g, '#d9534f'); }
    g.fillStyle = '#3b2a1a'; g.fillRect(x - s * 0.85, y - s * 0.1, s * 1.7, s * 0.2);
    g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - s * 0.75); g.quadraticCurveTo(x + s * 0.3, y - s * 1.1, x + s * 0.6, y - s * 1.05); g.stroke();
  },
  // Superconductor: bobina con brillo frío
  superconductor: (g, x, y, s) => {
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); fs(g, '#1d3a50');
    g.strokeStyle = '#7fd1ff'; g.lineWidth = s * 0.2; g.beginPath(); g.arc(x, y, s * 0.65, 0, Math.PI * 2); g.stroke();
    g.lineWidth = s * 0.14; g.beginPath(); g.arc(x, y, s * 0.3, 0, Math.PI * 2); g.stroke();
  },
  // Procesador cuántico: chip violeta con un átomo
  quantum_processor: (g, x, y, s) => {
    g.beginPath(); g.rect(x - s, y - s, s * 2, s * 2); fs(g, '#4b2f7a');
    g.strokeStyle = '#d6c2ff'; g.lineWidth = 1;
    for (const r of [0, Math.PI / 3, -Math.PI / 3]) { g.beginPath(); g.ellipse(x, y, s * 0.7, s * 0.28, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, s * 0.16, 0, Math.PI * 2); g.fill();
  },
  // Unidad de control: chip con patitas y luz azul
  control_unit: (g, x, y, s) => {
    g.fillStyle = '#9aa3ad'; for (let i = -2; i <= 2; i++) { g.fillRect(x + i * s * 0.35 - s * 0.06, y - s * 1.1, s * 0.12, s * 2.2); }
    g.beginPath(); g.rect(x - s * 0.9, y - s * 0.8, s * 1.8, s * 1.6); fs(g, '#2f6fb0');
    g.fillStyle = '#7fd1ff'; g.beginPath(); g.arc(x, y, s * 0.35, 0, Math.PI * 2); g.fill();
  },
  // Procesador: chip rojo con patitas a los cuatro lados
  processor: (g, x, y, s) => {
    g.fillStyle = '#9aa3ad';
    for (let i = -1; i <= 1; i++) { g.fillRect(x + i * s * 0.5 - s * 0.08, y - s * 1.1, s * 0.16, s * 2.2); g.fillRect(x - s * 1.1, y + i * s * 0.5 - s * 0.08, s * 2.2, s * 0.16); }
    g.beginPath(); g.rect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6); fs(g, '#c0392b');
    g.fillStyle = '#f5d76e'; g.fillRect(x - s * 0.35, y - s * 0.35, s * 0.7, s * 0.7);
  },
  // Estructura liviana: panal
  low_density: (g, x, y, s) => {
    g.beginPath(); g.rect(x - s, y - s * 0.75, s * 2, s * 1.5); fs(g, '#c99a5c');
    g.strokeStyle = '#8a6532'; g.lineWidth = 0.9;
    for (const [hx, hy] of [[-0.5, -0.25], [0.5, -0.25], [0, 0.3], [-1, 0.3], [1, 0.3]]) {
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const px = x + hx * s + Math.cos(a) * s * 0.3, py = y + hy * s + Math.sin(a) * s * 0.3; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.closePath(); g.stroke();
    }
  },
  // Filtro de aire: rejilla en marco
  air_filter: (g, x, y, s) => {
    g.beginPath(); g.rect(x - s, y - s * 0.8, s * 2, s * 1.6); fs(g, '#9fd9c8');
    g.strokeStyle = '#4c7a6c'; g.lineWidth = 1; g.beginPath();
    for (let i = -2; i <= 2; i++) { g.moveTo(x + i * s * 0.35, y - s * 0.6); g.lineTo(x + i * s * 0.35, y + s * 0.6); }
    g.stroke();
  },
  // Módulos: placa con su símbolo (velocidad ▶▶, productividad +, eficiencia hoja)
  speed_module: (g, x, y, s) => { moduleBase(g, x, y, s, '#4aa3df'); g.fillStyle = '#e6f4ff'; poly(g, [[x - s * 0.55, y - s * 0.35], [x - s * 0.05, y], [x - s * 0.55, y + s * 0.35]]); g.fill(); poly(g, [[x, y - s * 0.35], [x + s * 0.5, y], [x, y + s * 0.35]]); g.fill(); },
  prod_module: (g, x, y, s) => { moduleBase(g, x, y, s, '#e0743a'); g.fillStyle = '#fff1e6'; g.fillRect(x - s * 0.1, y - s * 0.45, s * 0.2, s * 0.9); g.fillRect(x - s * 0.45, y - s * 0.1, s * 0.9, s * 0.2); },
  eff_module: (g, x, y, s) => { moduleBase(g, x, y, s, '#5cc47a'); g.fillStyle = '#eaffef'; g.beginPath(); g.ellipse(x, y, s * 0.5, s * 0.25, -0.6, 0, Math.PI * 2); g.fill(); },
};
function moduleBase(g, x, y, s, col) {
  g.fillStyle = '#c9a227'; for (let i = -1; i <= 1; i++) g.fillRect(x + i * s * 0.45 - s * 0.1, y + s * 0.75, s * 0.2, s * 0.3);
  g.beginPath(); g.rect(x - s, y - s * 0.8, s * 2, s * 1.6); fs(g, '#1d2026');
  g.beginPath(); g.rect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 1.2); g.fillStyle = col; g.fill();
}

function drawItem(g, item, x, y, s) {
  const it = ITEMS[item];
  const art = ITEM_ART[item];
  if (art && s >= 3) { art(g, x, y, s); return; }
  g.fillStyle = it.color;
  g.strokeStyle = 'rgba(0,0,0,0.65)';
  g.lineWidth = 1.2;
  g.beginPath();
  switch (it.shape) {
    case 'plate': g.rect(x - s, y - s * 0.7, s * 2, s * 1.4); break;
    case 'chip': g.rect(x - s, y - s, s * 2, s * 2); break;
    case 'gear':
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? s : s * 0.7;
        if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.moveTo(x + r, y);
      }
      g.closePath();
      break;
    case 'part':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        if (i) g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); else g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
      g.closePath();
      break;
    case 'fuel':
      g.moveTo(x, y - s * 1.1);
      g.quadraticCurveTo(x + s, y, x + s * 0.8, y + s * 0.4);
      g.arc(x, y + s * 0.3, s * 0.8, 0, Math.PI);
      g.quadraticCurveTo(x - s, y, x, y - s * 1.1);
      break;
    case 'cable':
      g.arc(x, y, s, 0, Math.PI * 2);
      break;
    case 'barrel': g.rect(x - s * 0.75, y - s, s * 1.5, s * 2); break;
    case 'log': g.ellipse(x, y, s * 1.1, s * 0.6, -0.5, 0, Math.PI * 2); break;
    case 'battery': g.rect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 1.9); break;
    case 'ammo': g.rect(x - s, y - s * 0.6, s * 2, s * 1.2); break;
    case 'module': g.rect(x - s, y - s * 0.8, s * 2, s * 1.6); break;
    case 'flask':
      g.moveTo(x - s * 0.3, y - s); g.lineTo(x + s * 0.3, y - s); g.lineTo(x + s * 0.3, y - s * 0.3);
      g.lineTo(x + s, y + s * 0.8); g.lineTo(x - s, y + s * 0.8); g.lineTo(x - s * 0.3, y - s * 0.3);
      g.closePath();
      break;
    default: g.arc(x, y, s, 0, Math.PI * 2);
  }
  g.fill(); g.stroke();
  if (it.shape === 'chip') {
    g.fillStyle = item === 'processor' ? '#f5d76e' : item === 'nav_computer' ? '#bfe3ff' : '#e8d44d';
    g.fillRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
  } else if (it.shape === 'gear') {
    g.fillStyle = '#333'; g.beginPath(); g.arc(x, y, s * 0.3, 0, Math.PI * 2); g.fill();
  } else if (it.shape === 'cable') {
    g.strokeStyle = '#7a3f12'; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, s * 0.55, 0, Math.PI * 2); g.stroke();
  } else if (it.shape === 'barrel') {
    g.strokeStyle = '#8a6a4a'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - s * 0.75, y - s * 0.4); g.lineTo(x + s * 0.75, y - s * 0.4);
    g.moveTo(x - s * 0.75, y + s * 0.4); g.lineTo(x + s * 0.75, y + s * 0.4); g.stroke();
  } else if (it.shape === 'battery') {
    g.fillStyle = '#444'; g.fillRect(x - s * 0.25, y - s * 1.15, s * 0.5, s * 0.3);
  } else if (it.shape === 'ammo') {
    g.fillStyle = '#7a5a10';
    for (let i = -1; i <= 1; i++) g.fillRect(x + i * s * 0.55 - s * 0.15, y - s * 0.45, s * 0.3, s * 0.9);
  } else if (it.shape === 'module') {
    g.fillStyle = '#1d2026'; g.fillRect(x - s * 0.6, y - s * 0.4, s * 1.2, s * 0.8);
    g.fillStyle = it.color; g.fillRect(x - s * 0.3, y - s * 0.2, s * 0.6, s * 0.4);
  } else if (it.shape === 'flask') {
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x - s * 0.15, y - s * 0.1, s * 0.3, s * 0.6);
  } else if (it.shape === 'part') {
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x, y, s * 0.35, 0, Math.PI * 2); g.fill();
  }
}

function drawArrow(g, cx, cy, dir, color, len = 15) {
  g.save();
  g.translate(cx, cy);
  g.rotate(dir * Math.PI / 2);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(len, 0); g.lineTo(len - 6, -5); g.lineTo(len - 6, 5);
  g.closePath(); g.fill();
  g.restore();
}

// Rayo dibujado a mano: el emoji ⚡ se ve distinto en cada dispositivo
function drawBolt(g, x, y, s, color) {
  g.beginPath();
  g.moveTo(x + s * 0.15, y - s); g.lineTo(x - s * 0.55, y + s * 0.12); g.lineTo(x - s * 0.02, y + s * 0.12);
  g.lineTo(x - s * 0.2, y + s); g.lineTo(x + s * 0.55, y - s * 0.18); g.lineTo(x + s * 0.03, y - s * 0.18);
  g.closePath();
  g.fillStyle = color; g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = Math.max(1, s * 0.16); g.lineJoin = 'round'; g.stroke();
}

// Insignia redonda con flecha (arriba = cargar, abajo = descargar)
function drawBadgeArrow(g, x, y, r, up, bg) {
  g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
  const k = up ? -1 : 1;
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(x, y + k * r * 0.7); g.lineTo(x - r * 0.6, y); g.lineTo(x - r * 0.22, y); g.lineTo(x - r * 0.22, y - k * r * 0.6);
  g.lineTo(x + r * 0.22, y - k * r * 0.6); g.lineTo(x + r * 0.22, y); g.lineTo(x + r * 0.6, y); g.closePath(); g.fill();
}

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

// Cuerpo de un edificio: sombra, chapa con relieve, borde y remaches
function box(g, x0, y0, fill, stroke, inset = 2, s = TILE) {
  const x = x0 + inset, y = y0 + inset, w = s - inset * 2;
  const r = Math.min(5, w / 6);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  rrect(g, x + 2, y + 3, w, w, r); g.fill();
  g.fillStyle = fill;
  rrect(g, x, y, w, w, r); g.fill();
  // Luz de arriba y sombra abajo
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.fillRect(x + r, y + 1, w - r * 2, 2);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(x + 1, y + 3, w - 2, w / 2 - 3);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x + r, y + w - 3, w - r * 2, 2.5);
  if (stroke) {
    g.strokeStyle = stroke; g.lineWidth = 1.5;
    rrect(g, x + 3, y + 3, w - 6, w - 6, Math.max(1, r - 2)); g.stroke();
  }
  if (w >= 22) {
    g.fillStyle = 'rgba(0,0,0,0.4)';
    const q = 2.2, a = x + 2.2, b = x + w - 2.2 - q;
    g.fillRect(a, y + 2.2, q, q); g.fillRect(b, y + 2.2, q, q);
    g.fillRect(a, y + w - 2.2 - q, q, q); g.fillRect(b, y + w - 2.2 - q, q, q);
  }
}

// Cintas: goma oscura con nervios que avanzan y rieles del color de su nivel
function drawBeltBase(g, e, cx, cy, t, speed, rail, stripe) {
  g.save();
  g.translate(cx, cy);
  g.rotate(e.dir * Math.PI / 2);
  g.fillStyle = '#1b1e22';
  g.fillRect(-16, -12, 32, 24);
  const off = (t * speed * TILE) % 8;
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let p = -16 + off; p < 16; p += 8) g.fillRect(p, -11, 2, 22);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let p = -14 + off; p < 16; p += 8) g.fillRect(p, -11, 1.5, 22);
  // Flechita del sentido
  g.strokeStyle = stripe; g.globalAlpha *= 0.55;
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(-3, -5); g.lineTo(2, 0); g.lineTo(-3, 5); g.stroke();
  g.globalAlpha /= 0.55;
  // Rieles laterales
  for (const sy of [-16, 12]) {
    g.fillStyle = rail; g.fillRect(-16, sy, 32, 4);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-16, sy, 32, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-16, sy + 3, 32, 1);
  }
  g.fillStyle = 'rgba(0,0,0,0.45)';
  for (const sx of [-12, 4]) { g.fillRect(sx, -15, 2, 2); g.fillRect(sx, 13, 2, 2); }
  g.restore();
}

function drawProgress(g, x0, y0, frac, color = '#5cc47a') {
  if (frac <= 0) return;
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(x0 + 5, y0 + TILE - 7, TILE - 10, 3);
  g.fillStyle = color;
  g.fillRect(x0 + 5, y0 + TILE - 7, (TILE - 10) * Math.min(1, frac), 3);
}

// La nave en la que te estrellaste: refugio y almacén (ocupa 3×3)
function drawCrashedShip(g, x0, y0, t) {
  const S3 = TILE * 3, cx = x0 + S3 / 2, cy = y0 + S3 / 2;
  // Tierra quemada y la marca del arrastre al caer
  const burn = g.createRadialGradient(cx, cy + 4, 6, cx, cy + 4, S3 * 0.62);
  burn.addColorStop(0, 'rgba(30,20,12,0.55)'); burn.addColorStop(1, 'rgba(30,20,12,0)');
  g.fillStyle = burn; g.beginPath(); g.ellipse(cx, cy + 4, S3 * 0.62, S3 * 0.5, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(40,28,18,0.45)'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0 - 6, y0 + 8); g.lineTo(cx - 18, cy - 6); g.stroke();
  g.lineCap = 'butt';
  g.save();
  g.translate(cx, cy + 2);
  g.rotate(-0.32);
  // Sombra
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(4, 8, 44, 17, 0, 0, Math.PI * 2); g.fill();
  // Ala de atrás (doblada, medio enterrada)
  g.fillStyle = '#7d8691';
  g.beginPath(); g.moveTo(-14, 6); g.lineTo(-30, 26); g.lineTo(-6, 22); g.lineTo(6, 8); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(-30, 26); g.lineTo(-6, 22); g.lineTo(-10, 25); g.closePath(); g.fill();
  // Casco
  const hull = g.createLinearGradient(0, -18, 0, 18);
  hull.addColorStop(0, '#dfe4ea'); hull.addColorStop(0.55, '#a9b2bd'); hull.addColorStop(1, '#6e7883');
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(-40, -10); g.quadraticCurveTo(-20, -19, 14, -16); g.quadraticCurveTo(40, -12, 46, 0);
  g.quadraticCurveTo(40, 12, 14, 15); g.quadraticCurveTo(-20, 18, -40, 10); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,36,44,0.7)'; g.lineWidth = 1.5; g.stroke();
  // Franja naranja y paneles
  g.fillStyle = '#e8963a'; g.beginPath(); g.moveTo(-36, -3); g.lineTo(30, -3); g.lineTo(28, 1); g.lineTo(-36, 1); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(40,48,58,0.35)'; g.lineWidth = 1;
  for (const px of [-22, -4, 14]) { g.beginPath(); g.moveTo(px, -15); g.lineTo(px + 2, 14); g.stroke(); }
  // Abolladura y raspones
  g.fillStyle = 'rgba(60,66,74,0.45)'; g.beginPath(); g.ellipse(4, 8, 7, 3, 0.3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(40,30,20,0.5)';
  g.beginPath(); g.moveTo(-28, 9); g.lineTo(-16, 12); g.moveTo(20, -12); g.lineTo(30, -9); g.stroke();
  // Cabina
  const glass = g.createLinearGradient(26, -10, 42, 6);
  glass.addColorStop(0, '#9fdcff'); glass.addColorStop(1, '#2f6fb0');
  g.fillStyle = glass; g.beginPath(); g.ellipse(32, -3, 10, 7, 0.1, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a3340'; g.lineWidth = 1.5; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(28, -7); g.lineTo(34, -1); g.moveTo(31, -8); g.lineTo(35, -4); g.stroke();   // vidrio rajado
  // Ala de adelante
  g.fillStyle = '#9aa3ad';
  g.beginPath(); g.moveTo(-12, -12); g.lineTo(-30, -32); g.lineTo(-8, -28); g.lineTo(8, -14); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,36,44,0.6)'; g.lineWidth = 1; g.stroke();
  // Motor de atrás, roto
  g.fillStyle = '#4a525c'; rrect(g, -50, -8, 12, 16, 3); g.fill();
  g.fillStyle = '#1d2228'; g.beginPath(); g.ellipse(-50, 0, 3, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(255,${120 + Math.floor(Math.sin(t * 9) * 40)},40,0.7)`;
  g.beginPath(); g.arc(-51, 0, 2.2, 0, Math.PI * 2); g.fill();
  // Escotilla abierta con luz adentro: el refugio
  g.fillStyle = '#1b1f24'; rrect(g, -12, 4, 13, 10, 2); g.fill();
  const lamp = 0.75 + Math.sin(t * 2) * 0.1;
  g.fillStyle = `rgba(255,214,140,${lamp})`; rrect(g, -10, 6, 9, 7, 1.5); g.fill();
  g.fillStyle = '#8e97a2'; g.beginPath(); g.moveTo(-12, 14); g.lineTo(1, 14); g.lineTo(4, 21); g.lineTo(-15, 21); g.closePath(); g.fill();   // rampa
  // Antena con luz que titila
  g.strokeStyle = '#c9d1db'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(10, -16); g.lineTo(13, -27); g.stroke();
  g.fillStyle = Math.floor(t * 1.5) % 2 ? '#5cc47a' : '#2c5a3a';
  g.beginPath(); g.arc(13, -28, 2.5, 0, Math.PI * 2); g.fill();
  g.restore();
  // Humo que sale del motor (en coordenadas del mundo, sube derecho)
  const ex = cx - 48 * Math.cos(0.32), ey = cy + 2 + 48 * Math.sin(0.32);
  for (let i = 0; i < 4; i++) {
    const k = (((t * 0.35 + i / 4) % 1) + 1) % 1;
    g.fillStyle = `rgba(150,150,150,${0.35 * (1 - k)})`;
    g.beginPath(); g.arc(ex - 4 + k * 10, ey - 6 - k * 34, 4 + k * 9, 0, Math.PI * 2); g.fill();
  }
}

const OWN_DRAW = new Set(['centrifuge', 'steam_turbine', 'reactor', 'heatex', 'heatpipe', 'foundry', 'turbobelt', 'vulcanpad']);
function drawBuilding(g, e, x0, y0, t) {
  const cx = x0 + TILE / 2, cy = y0 + TILE / 2;
  const def = BUILDINGS[e.type];
  switch (OWN_DRAW.has(e.type) ? e.type : kindOf(e.type)) {
    case 'turbobelt': drawBeltBase(g, e, cx, cy, t, 12, '#3a9a5a', '#9af0b0'); break;
    case 'vulcanpad': drawMoonpad(g, x0, y0, t); g.fillStyle = 'rgba(255,100,30,0.35)'; g.beginPath(); g.arc(x0 + TILE * 1.5, y0 + TILE * 1.5, 30, 0, Math.PI * 2); g.fill(); break;
    case 'foundry': {
      const S3 = TILE * 3, mx = x0 + S3 / 2, my = y0 + S3 / 2;
      box(g, x0, y0, '#4a3a36', '#e07a3a', 6, S3);
      g.fillStyle = '#2a1e1c'; g.beginPath(); g.arc(mx, my, 26, 0, Math.PI * 2); g.fill();
      const glow = g.createRadialGradient(mx, my, 2, mx, my, 22);
      glow.addColorStop(0, e.active ? 'rgba(255,200,80,1)' : 'rgba(140,60,30,0.8)'); glow.addColorStop(1, 'rgba(120,30,10,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(mx, my, 22, 0, Math.PI * 2); g.fill();
      if (e.recipe) drawItem(g, RECIPES[e.recipe].out, mx, my, 7);
      drawArrow(g, mx + DIRS[e.dir][0] * 38, my + DIRS[e.dir][1] * 38, e.dir, '#ffd0a0', 10);
      break;
    }
    case 'centrifuge': {
      const S2 = TILE * 2, mx = x0 + S2 / 2, my = y0 + S2 / 2;
      box(g, x0, y0, '#3a4048', '#7be05a', 6, TILE * 2);
      g.fillStyle = '#20262c'; g.beginPath(); g.arc(mx, my, 22, 0, Math.PI * 2); g.fill();
      const spin = e.active ? t * 9 : 0;
      for (let i = 0; i < 3; i++) {
        const a = spin + i * 2.094;
        g.fillStyle = i ? '#5a6470' : '#8fa0b0';
        g.beginPath(); g.arc(mx + Math.cos(a) * 10, my + Math.sin(a) * 10, 7, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = e.active ? '#7dff6a' : '#2f5a2a'; g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fill();
      drawArrow(g, mx + DIRS[e.dir][0] * 24, my + DIRS[e.dir][1] * 24, e.dir, '#d6dee8', 10);
      break;
    }
    case 'steam_turbine': {
      const S2 = TILE * 2, mx = x0 + S2 / 2, my = y0 + S2 / 2;
      box(g, x0, y0, '#4a5560', '#b8c6d2', 6, TILE * 2);
      const horiz = e.dir === 0 || e.dir === 2;
      g.fillStyle = '#2b3036';
      if (horiz) g.fillRect(x0 + 6, my - 14, S2 - 12, 28); else g.fillRect(mx - 14, y0 + 6, 28, S2 - 12);
      g.strokeStyle = '#8fa0b0'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const k = ((i + (e.active ? t * 4 : 0)) % 6) / 6;
        g.beginPath();
        if (horiz) { const x = x0 + 8 + k * (S2 - 16); g.moveTo(x, my - 12); g.lineTo(x, my + 12); } else { const y = y0 + 8 + k * (S2 - 16); g.moveTo(mx - 12, y); g.lineTo(mx + 12, y); }
        g.stroke();
      }
      drawArrow(g, mx + DIRS[e.dir][0] * 26, my + DIRS[e.dir][1] * 26, e.dir, '#d6dee8', 10);
      break;
    }
    case 'reactor': {
      const S3 = TILE * 3, mx = x0 + S3 / 2, my = y0 + S3 / 2;
      box(g, x0, y0, '#5a6066', '#9aa3ad', 8, TILE * 3);
      g.fillStyle = '#3a4046'; g.fillRect(x0 + 10, y0 + 10, S3 - 20, S3 - 20);
      const on = e.burn > 0;
      const glow = g.createRadialGradient(mx, my, 2, mx, my, 30);
      glow.addColorStop(0, on ? 'rgba(140,255,120,0.95)' : 'rgba(60,90,60,0.8)'); glow.addColorStop(1, 'rgba(40,60,40,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(mx, my, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = on ? '#7dff6a' : '#4a6a4a'; g.lineWidth = 3;
      g.beginPath(); g.arc(mx, my, 18, 0, Math.PI * 2); g.stroke();
      // Bornes de calor en los costados
      g.fillStyle = '#d07a3a';
      for (const [dx, dy] of DIRS) g.fillRect(mx + dx * (S3 / 2 - 5) - 4, my + dy * (S3 / 2 - 5) - 4, 8, 8);
      break;
    }
    case 'heatex': {
      const S2 = TILE * 2, mx = x0 + S2 / 2, my = y0 + S2 / 2;
      const tmp = heatTemp(e);
      box(g, x0, y0, '#4a4046', '#d07a3a', 6, TILE * 2);
      const hot = Math.min(1, Math.max(0, (tmp - 15) / 985));
      g.fillStyle = `rgb(${90 + hot * 160},${70 + hot * 50},${60})`;
      g.fillRect(x0 + 10, my - 8, S2 - 20, 16);
      g.fillStyle = '#5aa0e0'; g.beginPath(); g.arc(x0 + 12, y0 + 12, 5, 0, Math.PI * 2); g.fill();
      if (e.active) { g.fillStyle = 'rgba(235,240,245,0.6)'; g.beginPath(); g.arc(mx + Math.sin(t * 5) * 4, my - 14 - (t * 20 % 10), 6, 0, Math.PI * 2); g.fill(); }
      drawArrow(g, mx + DIRS[e.dir][0] * 26, my + DIRS[e.dir][1] * 26, e.dir, '#e8eef4', 10);
      break;
    }
    case 'heatpipe': {
      const tmp = heatTemp(e), hot = Math.min(1, Math.max(0, (tmp - 15) / 985));
      const col = `rgb(${110 + hot * 140},${80 + hot * 60},${60 - hot * 20})`;
      g.strokeStyle = col; g.lineWidth = 9; g.lineCap = 'round';
      const C = (dx, dy) => { const n = at(e.x + dx, e.y + dy); return n && HEAT_CAP[n.type]; };
      g.beginPath();
      let any = false;
      for (const [dx, dy] of DIRS) if (C(dx, dy)) { g.moveTo(cx, cy); g.lineTo(cx + dx * TILE / 2, cy + dy * TILE / 2); any = true; }
      if (!any) { g.moveTo(cx - 10, cy); g.lineTo(cx + 10, cy); }
      g.stroke(); g.lineCap = 'butt';
      g.fillStyle = col; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'belt': drawBeltBase(g, e, cx, cy, t, 2, '#c9a23a', '#e8c867'); break;
    case 'fastbelt': drawBeltBase(g, e, cx, cy, t, 4, '#b8463a', '#f08a7a'); break;
    case 'expressbelt': drawBeltBase(g, e, cx, cy, t, 8, '#3a86c4', '#8fcaf5'); break;

    case 'underground': {
      drawBeltBase(g, e, cx, cy, t, 2, '#c9a23a', '#e8c867');
      g.save();
      g.translate(cx, cy);
      g.rotate(e.dir * Math.PI / 2);
      // La boca del túnel: adelante si es entrada, atrás si es salida
      const side = e.mode === 'out' ? -1 : 1;
      if (side < 0) g.scale(-1, 1);
      // Capota de chapa
      g.fillStyle = 'rgba(0,0,0,0.3)'; rrect(g, 1, -14, 15, 30, 4); g.fill();
      g.fillStyle = '#b27a28'; rrect(g, 0, -15, 15, 30, 4); g.fill();
      g.fillStyle = '#d9a24a'; g.fillRect(1, -14, 13, 3);
      // Franjas de peligro en el borde de la boca
      g.save(); rrect(g, 0, -15, 4, 30, 2); g.clip();
      g.fillStyle = '#222'; g.fillRect(0, -15, 4, 30);
      g.fillStyle = '#e8c867';
      for (let k = -18; k < 16; k += 6) { g.beginPath(); g.moveTo(0, k); g.lineTo(4, k - 3); g.lineTo(4, k); g.lineTo(0, k + 3); g.fill(); }
      g.restore();
      // Boca oscura
      g.fillStyle = '#0d0d0d';
      g.beginPath(); g.ellipse(6, 0, 3.5, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(9, -12, 4, 24);
      g.restore();
      break;
    }

    case 'splitter':
      box(g, x0, y0, '#5b4180', '#8a63c4');
      for (const d of [0, 3, 1]) {
        const prio = e.prio && ((e.prio === 'front' && d === 0) || (e.prio === 'left' && d === 3) || (e.prio === 'right' && d === 1));
        drawArrow(g, cx, cy, (e.dir + d) % 4, prio ? '#f0a742' : d === 0 ? '#ead9ff' : '#b79be0');
      }
      g.fillStyle = '#ead9ff';
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
      break;

    case 'sorter':
      box(g, x0, y0, '#1f5f59', '#2fa59a');
      drawArrow(g, cx, cy, e.dir, '#c8fff6');
      drawArrow(g, cx, cy, (e.dir + 3) % 4, '#6fbfb4');
      drawArrow(g, cx, cy, (e.dir + 1) % 4, '#6fbfb4');
      if (e.filter) drawItem(g, e.filter, cx, cy, 6);
      else {
        g.fillStyle = '#c8fff6'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('?', cx, cy + 1);
      }
      break;

    case 'pipe': case 'fluidtank': {
      const net = e.id ? fnets[e._fnet] : null;
      const fc = net && net.amount >= 1 ? ITEMS[net.fluid].color : null;
      if (e.type === 'fluidtank') {
        const s = TILE * 2, mx = x0 + s / 2, my = y0 + s / 2, R = s / 2 - 3;
        // Patas en las esquinas
        g.fillStyle = '#3a4048';
        for (const [ax, ay] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.fillRect(mx + ax * (R - 3) - 4, my + ay * (R - 3) - 4, 8, 8);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(mx + 2, my + 3, R, 0, Math.PI * 2); g.fill();
        const gr = g.createRadialGradient(mx - R * 0.35, my - R * 0.35, 2, mx, my, R);
        gr.addColorStop(0, '#8d97a2'); gr.addColorStop(1, '#4a525c');
        g.fillStyle = gr; g.beginPath(); g.arc(mx, my, R, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#2e343b'; g.lineWidth = 2; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(mx, my, R - 5, 0, Math.PI * 2); g.stroke();
        // Bulones alrededor del borde
        g.fillStyle = '#c3cbd3';
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.arc(mx + Math.cos(a) * (R - 2.5), my + Math.sin(a) * (R - 2.5), 1.3, 0, Math.PI * 2); g.fill(); }
        // Ventana del nivel de líquido
        const gw = 12, gh = s - 26, gx = mx - gw / 2, gy = my - gh / 2;
        g.fillStyle = '#1b1f24'; rrect(g, gx, gy, gw, gh, 3); g.fill();
        if (fc) {
          const f = Math.min(1, net.amount / net.cap);
          g.fillStyle = fc; g.fillRect(gx + 2, gy + 2 + (gh - 4) * (1 - f), gw - 4, (gh - 4) * f);
        }
        g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(gx + gw - 4, gy + gh * k / 4); g.lineTo(gx + gw - 1, gy + gh * k / 4); g.stroke(); }
        break;
      }
      // Tramos hacia los vecinos conectados
      const links = DIRS.map(([dx, dy]) => {
        const n = e.id ? at(e.x + dx, e.y + dy) : null;
        return n && (isPipe(n) || FLUID_USERS.has(n.type) || n.type === 'offshore' || n.type === 'pumpjack');
      });
      if (!links.some(Boolean)) { links[0] = links[2] = true; }
      g.save();
      g.translate(cx, cy);
      for (let d = 0; d < 4; d++) {
        if (!links[d]) continue;
        g.save(); g.rotate(d * Math.PI / 2);
        g.fillStyle = '#6c757f'; g.fillRect(0, -6, 16, 12);
        g.fillStyle = '#9aa3ad'; g.fillRect(0, -6, 16, 3);
        g.restore();
      }
      g.fillStyle = '#7d868f';
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
      if (fc) { g.fillStyle = fc; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill(); }
      g.restore();
      break;
    }

    case 'steelchest':
      box(g, x0, y0, '#5d6670', '#2b3036', 3);
      g.fillStyle = '#c9cfd6';
      g.fillRect(cx - 3, cy - 3, 6, 5);
      g.fillStyle = '#2b3036';
      g.fillRect(x0 + 4, cy - 4, TILE - 8, 1.5);
      g.fillRect(x0 + 4, y0 + 6, 1.5, TILE - 12); g.fillRect(x0 + TILE - 5.5, y0 + 6, 1.5, TILE - 12);
      if (e.total) drawProgress(g, x0, y0, e.total / 800, '#c9cfd6');
      drawArrow(g, cx, cy, e.dir, '#e6e9ee');
      break;

    case 'providerchest': case 'requesterchest': {
      const prov = kindOf(e.type) === 'providerchest';
      const C = { providerchest: ['#8a3a36', '#e58a85', '#f2b8b4'], requesterchest: ['#2f5a8f', '#8fbff0', '#cfe4ff'], storagechest: ['#8a7a2a', '#e8d070', '#f5e6a8'],
        activechest: ['#6a3a8a', '#c08ae5', '#e2c8f5'], bufferchest: ['#2f7a3a', '#8fe0a0', '#c8f5d2'] }[e.type] || ['#555', '#999', '#ccc'];
      box(g, x0, y0, C[0], C[1], 4);
      g.fillStyle = C[2];
      g.fillRect(cx - 3, cy - 3, 6, 5);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x0 + 5, cy - 4, TILE - 10, 1.5);
      if (!prov && e.req) { const k = Object.keys(e.req)[0]; if (k) drawItem(g, k, x0 + TILE - 9, y0 + 9, 3.5); }
      if (e.total) drawProgress(g, x0, y0, e.total / 400, C[1]);
      break;
    }

    case 'sensor': {
      const col = SIGNAL_COLORS[e.ch || 0];
      box(g, x0, y0, '#2b3036', col, 5);
      drawArrow(g, cx, cy, e.dir, col, 14);
      g.fillStyle = col;
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
      if (e.id) {
        g.font = '700 9px "Chakra Petch", system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const txt = (e.value || 0) > 9999 ? Math.round(e.value / 1000) + 'k' : String(e.value || 0);
        const w = g.measureText(txt).width + 6;
        g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(cx - w / 2, y0 - 7, w, 11);
        g.fillStyle = '#fff'; g.fillText(txt, cx, y0 - 1.5);
      }
      break;
    }

    case 'constant': case 'arith': case 'decider': {
      // Caja con pantallita: símbolo de la operación y luz si está dando salida
      box(g, x0, y0, '#2b3036', e.type === 'constant' ? '#c9a23a' : e.type === 'arith' ? '#3f86e0' : '#b45fe0', 4);
      if (e.type !== 'constant') {
        const [dx, dy] = DIRS[e.dir || 0];
        g.fillStyle = '#7d868f';
        g.fillRect(cx - dx * 13 - 3, cy - dy * 13 - 3, 6, 6);   // borne de entrada
        g.fillStyle = '#d6dee8';
        g.fillRect(cx + dx * 13 - 3, cy + dy * 13 - 3, 6, 6);   // borne de salida
      }
      g.fillStyle = '#0d1a14';
      g.fillRect(cx - 9, cy - 7, 18, 14);
      const on = e.type === 'constant' ? e.on !== false && (e.consts || []).some((c) => c && c.s && c.v) : !!e.cout;
      g.fillStyle = on ? '#7dff9a' : '#3a6a4a';
      g.font = '700 11px "Chakra Petch", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const sym = e.type === 'constant' ? 'K' : (e.cfg && e.cfg.op) || (e.type === 'arith' ? '+' : '>');
      g.fillText(sym === '*' ? '×' : sym === '/' ? '÷' : sym, cx, cy + 0.5);
      break;
    }

    case 'landmine':
      g.fillStyle = 'rgba(30,30,26,0.55)'; g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = Math.floor(t * 2 + e.x) % 3 ? '#5a2a20' : '#e5534b'; g.beginPath(); g.arc(cx, cy, 2, 0, Math.PI * 2); g.fill();
      break;

    case 'woodchest':
      box(g, x0, y0, '#9a6a3a', '#5a3a1c', 5);
      g.fillStyle = 'rgba(60,35,15,0.6)';
      for (let k = 0; k < 3; k++) g.fillRect(x0 + 6, y0 + 9 + k * 6, TILE - 12, 1.2);
      if (e.total) drawProgress(g, x0, y0, e.total / 100, '#d9a860');
      drawArrow(g, cx, cy, e.dir, '#f3dcb5');
      break;

    case 'chest':
      box(g, x0, y0, '#7a4f25', '#3f2810', 4);
      g.fillStyle = '#c9a227';
      g.fillRect(cx - 3, cy - 3, 6, 5);
      g.fillStyle = '#3f2810';
      g.fillRect(x0 + 5, cy - 4, TILE - 10, 1.5);
      if (e.total) drawProgress(g, x0, y0, e.total / 200, '#c9a227');
      drawArrow(g, cx, cy, e.dir, '#f0d9a8');
      break;

    case 'miner': case 'eminer': {
      const elec = e.type === 'eminer';
      box(g, x0, y0, elec ? '#2f5f8a' : '#b8902a', elec ? '#8fc3f0' : '#6e5418');
      g.save();
      g.translate(cx, cy);
      g.rotate(e.active ? t * (elec ? 12 : 6) : 0);
      g.fillStyle = elec ? '#d9e6f2' : '#4b4b4b';
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        g.moveTo(0, 0);
        g.arc(0, 0, 9, a, a + 0.8);
      }
      g.fill();
      g.restore();
      drawArrow(g, cx, cy, e.dir, elec ? '#d9f0ff' : '#fff3c4');
      break;
    }

    case 'furnace': case 'efurnace': {
      const elec = !!def.power, steel = e.type === 'steelfurnace';
      box(g, x0, y0, elec ? '#6f7882' : steel ? '#5d6670' : '#7b4a3a', steel ? '#a9b4c0' : null);
      g.fillStyle = elec ? '#4d555e' : steel ? '#454c55' : '#5a3328';
      for (let r = 0; r < 4; r++) g.fillRect(x0 + 2, y0 + 8 + r * 6, TILE - 4, 1);
      const glow = e.active ? 0.6 + 0.4 * Math.sin(t * 10 + e.x) : 0;
      g.fillStyle = e.active ? `rgba(255,${120 + glow * 80},40,${0.7 + glow * 0.3})` : '#2a1a14';
      g.beginPath(); g.arc(cx, cy + 2, 7, Math.PI, 0); g.lineTo(cx + 7, cy + 8); g.lineTo(cx - 7, cy + 8); g.fill();
      drawArrow(g, cx, cy, e.dir, '#ffd9b0');
      break;
    }

    case 'assembler': case 'assembler2': case 'chem': {
      const adv = kindOf(e.type) === 'assembler2', chem = kindOf(e.type) === 'chem', a3 = e.type === 'assembler3', refi = e.type === 'refinery';
      if (refi) {
        // Refinería: 2×2, con dos torres
        box(g, x0, y0, '#3d5530', '#9be0a8', 2, TILE * 2);
        for (const [tx2, h] of [[x0 + 16, 34], [x0 + 46, 26]]) {
          g.fillStyle = '#6f7a62'; rrect(g, tx2 - 7, y0 + 56 - h, 14, h, 4); g.fill();
          g.fillStyle = '#c9d6b8'; g.fillRect(tx2 - 7, y0 + 60 - h, 14, 3); g.fillRect(tx2 - 7, y0 + 68 - h, 14, 3);
          if (e.active) { g.fillStyle = `rgba(255,170,60,${0.5 + 0.5 * Math.sin(t * 9 + tx2)})`; g.beginPath(); g.arc(tx2, y0 + 54 - h, 3, 0, 7); g.fill(); }
        }
        const cx2 = x0 + TILE, cy2 = y0 + TILE;
        if (e.recipe) { drawItem(g, RECIPES[e.recipe].out, cx2, cy2 + 6, 6); drawProgress(g, x0, y0 + TILE, e.prog / RECIPES[e.recipe].time); }
        drawArrow(g, cx2, cy2, e.dir, '#e2f5d5');
        break;
      }
      box(g, x0, y0, chem ? '#2f5e3a' : a3 ? '#1f5f5c' : adv ? '#55307a' : '#35537e', chem ? '#9be0a8' : a3 ? '#7fe0d6' : adv ? '#e0b84a' : '#7ea4d6');
      if (a3) { g.strokeStyle = '#7fe0d6'; g.lineWidth = 1.5; g.strokeRect(x0 + 6, y0 + 6, TILE - 12, TILE - 12); }
      if (chem) {
        g.fillStyle = '#9be0a8';
        g.beginPath(); g.arc(x0 + 8, y0 + 8, 3, 0, Math.PI * 2); g.arc(x0 + TILE - 8, y0 + 8, 3, 0, Math.PI * 2); g.fill();
      }
      if (e.recipe) drawItem(g, RECIPES[e.recipe].out, cx, cy, 6);
      else {
        g.fillStyle = '#cfe0ff'; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('?', cx, cy + 1);
      }
      if (e.recipe) drawProgress(g, x0, y0, e.prog / RECIPES[e.recipe].time);
      drawArrow(g, cx, cy, e.dir, '#cfe0ff');
      break;
    }

    case 'generator': {
      box(g, x0, y0, '#454b53', '#7d858f');
      g.save();
      g.translate(cx - 2, cy + 1);
      g.rotate(e.active ? t * 8 : 0);
      g.strokeStyle = '#c9cfd6'; g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); }
      g.stroke();
      g.restore();
      g.fillStyle = '#2e3238';
      g.fillRect(x0 + TILE - 10, y0 + 3, 5, 10);
      if (e.active) {
        g.fillStyle = `rgba(200,200,200,${0.3 + 0.2 * Math.sin(t * 3 + e.x)})`;
        g.beginPath(); g.arc(x0 + TILE - 7, y0 + 2 - ((t * 8) % 6), 4, 0, Math.PI * 2); g.fill();
      }
      drawBolt(g, x0 + 8, y0 + 9, 5, '#f0d44d');
      break;
    }


    case 'pumpjack': {
      box(g, x0, y0, '#3a3540', '#8e7fa8');
      const a = e.active ? Math.sin(t * 4) * 0.35 : 0;
      g.save();
      g.translate(cx, cy + 4);
      g.fillStyle = '#5b5266';
      g.fillRect(-2, -4, 4, 10);
      g.rotate(a);
      g.fillStyle = '#c9a227';
      g.fillRect(-12, -7, 24, 4);
      g.fillStyle = '#2a2a2a';
      g.beginPath(); g.arc(-12, -5, 4, 0, Math.PI * 2); g.fill();
      g.restore();
      drawArrow(g, cx, cy, e.dir, '#e3d6ff');
      break;
    }

    case 'lab': {
      box(g, x0, y0, '#2c4a5e', '#7fc4e8');
      const k = e.active ? 0.5 + 0.5 * Math.sin(t * 6 + e.x) : 0.2;
      g.fillStyle = `rgba(120,210,255,${0.35 + k * 0.5})`;
      g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d8f2ff'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(cx, cy, 11, 4, t * (e.active ? 2 : 0), 0, Math.PI * 2); g.stroke();
      break;
    }

    case 'bigpole':
      g.strokeStyle = '#8a95a1'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 9, y0 + TILE - 3); g.lineTo(cx, y0 + 3); g.lineTo(cx + 9, y0 + TILE - 3);
      g.moveTo(cx - 6, cy + 4); g.lineTo(cx + 6, cy + 4);
      g.moveTo(cx - 11, y0 + 8); g.lineTo(cx + 11, y0 + 8);
      g.stroke();
      break;

    case 'accumulator': {
      box(g, x0, y0, '#3b4048', '#9aa3ad');
      const def = BUILDINGS.accumulator;
      const f = (e.stored || 0) / def.capacity;
      g.fillStyle = '#1d2026';
      g.fillRect(cx - 5, y0 + 6, 10, TILE - 12);
      g.fillStyle = f > 0.2 ? '#5cc47a' : '#e0a040';
      g.fillRect(cx - 4, y0 + 7 + (TILE - 14) * (1 - f), 8, (TILE - 14) * f);
      break;
    }

    case 'lamp': {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(cx + 1.5, cy + 2.5, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3d424a'; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7d858f'; g.lineWidth = 1.5; g.stroke();
      if (e.lit) {
        const gl = g.createRadialGradient(cx, cy, 2, cx, cy, 15);
        gl.addColorStop(0, 'rgba(255,240,170,0.55)'); gl.addColorStop(1, 'rgba(255,240,170,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, 15, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = e.lit ? '#fff3b0' : '#b8b39a';
      g.beginPath(); g.arc(cx, cy, 6.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx - 6.5, cy); g.lineTo(cx + 6.5, cy); g.moveTo(cx, cy - 6.5); g.lineTo(cx, cy + 6.5); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(cx - 2, cy - 2.5, 1.8, 0, Math.PI * 2); g.fill();
      break;
    }

    case 'wall':
      if (e.type === 'gate') {
        // Compuerta: se abre (se achica) cuando hay alguien cerca
        const near = playerOn() && wdist(S.player.x, S.player.y, e.x + 0.5, e.y + 0.5) < 2;
        g.fillStyle = '#5a564e'; g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
        const k = near ? 0.25 : 1;
        g.fillStyle = '#8f8676'; g.fillRect(x0 + 2, y0 + 2, (TILE - 4) * k / 2, TILE - 4); g.fillRect(x0 + TILE - 2 - (TILE - 4) * k / 2, y0 + 2, (TILE - 4) * k / 2, TILE - 4);
        g.fillStyle = '#e0b84a';
        for (let i = 0; i < 4; i++) { g.fillRect(x0 + 2, y0 + 4 + i * 7, (TILE - 4) * k / 2, 3); g.fillRect(x0 + TILE - 2 - (TILE - 4) * k / 2, y0 + 4 + i * 7, (TILE - 4) * k / 2, 3); }
        break;
      }
      g.fillStyle = '#8f8676';
      g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
      g.fillStyle = '#6f6758';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.fillRect(x0 + 2 + c * 15 + (r % 2) * 7, y0 + 2 + r * 7.5, 13, 6);
      break;

    case 'lightningrod': {
      const hit = e.hitAt && S.playTime - e.hitAt < 0.6;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx + 2, y0 + TILE - 4, 7, 3, 0, 0, 7); g.fill();
      g.fillStyle = '#5d6670'; g.fillRect(cx - 6, y0 + TILE - 7, 12, 4);
      g.fillStyle = '#9aa3ad'; g.fillRect(cx - 1.5, y0 + 6, 3, TILE - 12);
      g.fillStyle = hit ? '#eaf2ff' : '#d98a4a';
      g.beginPath(); g.moveTo(cx, y0 + 1); g.lineTo(cx + 3, y0 + 8); g.lineTo(cx - 3, y0 + 8); g.closePath(); g.fill();
      g.strokeStyle = '#d98a4a'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx - 5, y0 + 12); g.lineTo(cx + 5, y0 + 12); g.moveTo(cx - 4, y0 + 17); g.lineTo(cx + 4, y0 + 17); g.stroke();
      if (hit) { g.fillStyle = 'rgba(200,220,255,0.5)'; g.beginPath(); g.arc(cx, y0 + 6, 10, 0, 7); g.fill(); }
      break;
    }
    case 'antenna': {
      const on = e._linked;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx + 2, y0 + TILE - 4, 9, 3.5, 0, 0, 7); g.fill();
      g.fillStyle = '#5d6670'; g.fillRect(cx - 7, y0 + TILE - 7, 14, 4);
      g.strokeStyle = '#9aa3ad'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - 5, y0 + TILE - 6); g.lineTo(cx, y0 + 9); g.lineTo(cx + 5, y0 + TILE - 6); g.moveTo(cx - 3, cy + 3); g.lineTo(cx + 3, cy + 3); g.stroke();
      // Platito
      g.fillStyle = '#c9d6dd'; g.beginPath(); g.ellipse(cx + 3, y0 + 9, 7, 4, -0.5, 0, 7); g.fill();
      g.fillStyle = on ? `rgba(127,209,255,${0.6 + 0.4 * Math.sin(t * 5 + e.x)})` : '#e5534b';
      g.beginPath(); g.arc(cx, y0 + 6, 2.5, 0, 7); g.fill();
      if (on) {
        g.strokeStyle = `rgba(127,209,255,${0.5 - ((t * 0.8) % 1) * 0.5})`; g.lineWidth = 1.5;
        g.beginPath(); g.arc(cx, y0 + 6, 4 + ((t * 0.8) % 1) * 12, -2.4, -0.7); g.stroke();
      }
      break;
    }

    case 'beacon': {
      box(g, x0, y0, '#2c3550', '#6f8fd8', 3, TILE * 2);
      const bx = x0 + TILE, by = y0 + TILE;
      const on = e.active;
      g.fillStyle = '#4a5578'; g.beginPath(); g.arc(bx, by, 16, 0, 7); g.fill();
      g.strokeStyle = on ? `rgba(140,190,255,${0.5 + 0.4 * Math.sin(t * 4)})` : '#5b6585'; g.lineWidth = 2;
      g.beginPath(); g.arc(bx, by, 22, 0, 7); g.stroke();
      g.fillStyle = on ? '#bfe0ff' : '#7f8aa8'; g.beginPath(); g.moveTo(bx, by - 12); g.lineTo(bx + 6, by + 8); g.lineTo(bx - 6, by + 8); g.closePath(); g.fill();
      (e.modules || []).forEach((m, i) => drawItem(g, m, x0 + 12 + i * 40, y0 + TILE * 2 - 10, 5));
      break;
    }

    case 'pump': {
      box(g, x0, y0, '#3d4f60', '#7da0c0');
      g.fillStyle = '#7da0c0'; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
      g.strokeStyle = '#d8ecff'; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, 4, t * (e.active ? 6 : 0), t * (e.active ? 6 : 0) + 4.5); g.stroke();
      drawArrow(g, cx, cy, e.dir, '#d8ecff');
      break;
    }

    case 'flameturret': {
      g.fillStyle = 'rgba(0,0,0,0.3)'; rrect(g, x0 + 4, y0 + 5, TILE - 6, TILE - 6, 5); g.fill();
      g.fillStyle = '#4a3a2c'; rrect(g, x0 + 2, y0 + 2, TILE - 4, TILE - 4, 5); g.fill();
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.fill();
      g.save(); g.translate(cx, cy); g.rotate(e.aim || -Math.PI / 2);
      g.fillStyle = '#7d858f'; g.fillRect(2, -3, 14, 6);
      g.fillStyle = '#ffb347'; g.beginPath(); g.arc(16, 0, 2.5, 0, 7); g.fill();
      g.restore();
      if (e.id && !e.fuel && !(e.flames > 0)) {
        g.font = '700 9px Barlow, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const w = g.measureText('sin petróleo').width + 8;
        g.fillStyle = 'rgba(20,22,26,0.85)'; rrect(g, cx - w / 2, y0 + TILE - 9, w, 12, 6); g.fill();
        g.fillStyle = '#ff8a80'; g.fillText('sin petróleo', cx, y0 + TILE - 2.5);
      }
      break;
    }

    case 'artillery': {
      box(g, x0, y0, '#3f4a2c', '#9aab6a', 3, TILE * 2);
      const ax = x0 + TILE, ay = y0 + TILE;
      g.fillStyle = '#5d6b3f'; g.beginPath(); g.arc(ax, ay, 18, 0, 7); g.fill();
      g.save(); g.translate(ax, ay); g.rotate(e.aim || -Math.PI / 2);
      g.fillStyle = '#9aab6a'; g.fillRect(4, -4.5, 30, 9);
      g.fillStyle = '#2b3020'; g.fillRect(30, -5.5, 5, 11);
      g.restore();
      g.fillStyle = '#c9d6a0'; g.beginPath(); g.arc(ax, ay, 8, 0, 7); g.fill();
      if (e.id && !e.ammo) {
        g.font = '700 9px Barlow, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const w = g.measureText('sin proyectiles').width + 8;
        g.fillStyle = 'rgba(20,22,26,0.85)'; rrect(g, ax - w / 2, y0 + TILE * 2 - 10, w, 12, 6); g.fill();
        g.fillStyle = '#ff8a80'; g.fillText('sin proyectiles', ax, y0 + TILE * 2 - 3.5);
      }
      break;
    }

    case 'turret': case 'laser': {
      const laser = e.type === 'laser';
      // Base cuadrada atornillada al piso
      g.fillStyle = 'rgba(0,0,0,0.3)'; rrect(g, x0 + 4, y0 + 5, TILE - 6, TILE - 6, 5); g.fill();
      g.fillStyle = laser ? '#2c3040' : '#3a3f32'; rrect(g, x0 + 2, y0 + 2, TILE - 4, TILE - 4, 5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (const [ax, ay] of [[6, 6], [TILE - 6, 6], [6, TILE - 6], [TILE - 6, TILE - 6]]) { g.beginPath(); g.arc(x0 + ax, y0 + ay, 1.4, 0, Math.PI * 2); g.fill(); }
      // Torreta giratoria
      g.fillStyle = laser ? '#454b66' : '#5a6248';
      g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fill();
      g.strokeStyle = laser ? '#9fa8ff' : '#b8c08a'; g.lineWidth = 1.5; g.stroke();
      g.save();
      g.translate(cx, cy);
      g.rotate(e.aim || -Math.PI / 2);
      const hi = laser ? '#cfd4ff' : '#d8d2b0', lo = laser ? '#8088c0' : '#8f8a6c';
      if (laser) {
        g.fillStyle = lo; g.fillRect(2, -3.5, 13, 7);
        g.fillStyle = hi; g.fillRect(2, -1.5, 14, 3);
        g.fillStyle = '#7ef0ff'; g.beginPath(); g.arc(15.5, 0, 2, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = hi; g.fillRect(0, -4, 14, 3); g.fillRect(0, 1, 14, 3);
        g.fillStyle = lo; g.fillRect(12, -4.5, 3, 9);
      }
      g.fillStyle = hi; g.beginPath(); g.arc(0, 0, 6.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = lo; g.beginPath(); g.arc(0, 0, 3, 0, Math.PI * 2); g.fill();
      g.restore();
      if (!laser && e.id && !e.ammo && !e.shots) {
        // Cartelito "sin balas" sobre una pastilla oscura para que se lea sobre cualquier piso
        g.font = '700 9px Barlow, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const w = g.measureText('sin balas').width + 8;
        g.fillStyle = 'rgba(20,22,26,0.85)'; rrect(g, cx - w / 2, y0 + TILE - 9, w, 12, 6); g.fill();
        g.fillStyle = '#ff8a80'; g.fillText('sin balas', cx, y0 + TILE - 2.5);
      }
      break;
    }

    case 'nest': {
      const s = TILE * 2, pulse = 1 + Math.sin(t * 2 + e.x) * 0.05;
      const ncx = x0 + s / 2, ncy = y0 + s / 2;
      g.fillStyle = '#4a2a3e';
      g.beginPath(); g.ellipse(ncx, ncy, 27 * pulse, 23 * pulse, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a3b5e';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + e.x;
        g.beginPath(); g.arc(ncx + Math.cos(a) * 14, ncy + Math.sin(a) * 11, 7, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#1a0d14';
      g.beginPath(); g.ellipse(ncx, ncy, 8, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e0a3c8';
      g.beginPath(); g.arc(ncx - 3, ncy - 1, 1.5, 0, Math.PI * 2); g.arc(ncx + 3, ncy - 1, 1.5, 0, Math.PI * 2); g.fill();
      break;
    }

    case 'worm': {
      // Montículo con un cuello que se levanta al escupir
      const k = WORMS[e.kind] || WORMS.small, sc = e.kind === 'big' ? 1.25 : e.kind === 'medium' ? 1.08 : 0.92;
      const wcx = x0 + TILE / 2, wcy = y0 + TILE / 2;
      g.fillStyle = 'rgba(40,24,18,0.55)';
      g.beginPath(); g.ellipse(wcx, wcy + 6, 15 * sc, 9 * sc, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a3a2a';
      g.beginPath(); g.ellipse(wcx, wcy + 5, 12 * sc, 7 * sc, 0, 0, Math.PI * 2); g.fill();
      const up = (e.fire || 0) > 0 ? 1 : 0.55 + Math.sin(t * 2 + e.x * 3) * 0.08;
      const ang = e.aim || 0, nx = Math.cos(ang) * 6 * up, ny = -14 * up * sc;
      g.strokeStyle = k.color; g.lineCap = 'round'; g.lineWidth = 8 * sc;
      g.beginPath(); g.moveTo(wcx, wcy + 4); g.quadraticCurveTo(wcx - nx * 0.4, wcy + ny * 0.5, wcx + nx, wcy + ny); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2;
      for (let i = 1; i < 4; i++) { const f = i / 4; g.beginPath(); g.arc(wcx + nx * f, wcy + 4 + (ny - 4) * f, 4 * sc, 0, Math.PI); g.stroke(); }
      g.lineCap = 'butt';
      g.fillStyle = '#2a120c';
      g.beginPath(); g.arc(wcx + nx, wcy + ny, 4.2 * sc, 0, Math.PI * 2); g.fill();
      g.fillStyle = (e.fire || 0) > 0 ? '#c8ff5a' : '#e0a33a';
      g.beginPath(); g.arc(wcx + nx, wcy + ny, 2 * sc, 0, Math.PI * 2); g.fill();
      break;
    }

    case 'inserter': case 'fastinserter': {
      const R = def.reach || 1;
      g.fillStyle = e.type === 'stackinserter' ? '#24402c' : '#2b2f36';
      g.beginPath(); g.arc(cx, cy, e.type === 'stackinserter' ? 7.5 : 6, 0, Math.PI * 2); g.fill();
      const ph = e.hold ? e.t : (e.ret || 0);
      const [dx, dy] = DIRS[e.dir];
      const reachPx = 12 + (R - 1) * 20;
      const ex = cx + dx * (-reachPx + 2 * reachPx * ph), ey = cy + dy * (-reachPx + 2 * reachPx * ph);
      // Codo del brazo, un poco hacia el costado
      const mx = (cx + ex) / 2 - dy * 6, my = (cy + ey) / 2 + dx * 6;
      g.strokeStyle = TYPE_COLOR[e.type] || '#e0b84a';
      g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(mx, my); g.lineTo(ex, ey); g.stroke();
      g.lineCap = 'butt';
      g.fillStyle = '#d8dee6';
      g.beginPath(); g.arc(cx, cy, 2.5, 0, Math.PI * 2); g.fill();
      if (e.hold) drawItem(g, e.hold, ex, ey, 4.5);
      if (e.hold && e.n > 1) { g.fillStyle = '#fff'; g.font = '700 8px Barlow, sans-serif'; g.textAlign = 'center'; g.fillText('×' + e.n, ex + 6, ey - 5); }
      if (e.filter) drawItem(g, e.filter, x0 + 6, y0 + 6, 3.5);
      // marca de hacia dónde deja
      drawArrow(g, cx, cy, e.dir, 'rgba(255,255,255,0.35)', 16);
      break;
    }

    case 'roboport': {
      box(g, x0, y0, '#3b4a3a', '#b8d27a');
      g.fillStyle = '#b8d27a';
      g.fillRect(cx - 9, cy - 2, 18, 4);
      g.fillRect(cx - 2, cy - 9, 4, 18);
      g.fillStyle = '#e8c547';
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
      break;
    }

    case 'rail': case 'station': case 'signal': case 'chainsignal': {
      const links = e.id ? railLinks(e.x, e.y) : [true, false, true, false];
      if (!links.some(Boolean)) { links[0] = links[2] = true; }
      if (e.type === 'station') {
        g.fillStyle = '#4a4f57';
        g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
        g.fillStyle = '#f0a742';
        g.fillRect(x0 + 2, y0 + 2, TILE - 4, 3);
        g.fillRect(x0 + 2, y0 + TILE - 5, TILE - 4, 3);
      }
      g.save();
      g.translate(cx, cy);
      for (let d = 0; d < 4; d++) {
        if (!links[d]) continue;
        g.save();
        g.rotate(d * Math.PI / 2);
        g.fillStyle = '#5a4632';
        for (let k = 0; k < 3; k++) g.fillRect(2 + k * 5, -10, 3, 20);
        g.strokeStyle = '#a8b0ba'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-5, -6); g.lineTo(16, -6); g.moveTo(-5, 6); g.lineTo(16, 6); g.stroke();
        g.restore();
      }
      g.restore();
      if (e.type === 'signal' || e.type === 'chainsignal') {
        const red = e.id && signalRed(e), chain = e.type === 'chainsignal';
        g.fillStyle = chain ? '#26344a' : '#2b3036';
        rrect(g, x0 + TILE - 12, y0 + 2, 10, 18, 3); g.fill();
        g.fillStyle = red ? '#e5534b' : '#3a3f45'; g.beginPath(); g.arc(x0 + TILE - 7, y0 + 7, 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = red ? '#3a3f45' : chain ? '#5aa0ff' : '#5cc47a'; g.beginPath(); g.arc(x0 + TILE - 7, y0 + 15, 3, 0, Math.PI * 2); g.fill();
      }
      if (e.type === 'station') {
        const unload = e.mode === 'unload';
        drawBadgeArrow(g, x0 + 8, y0 + 8, 5.5, !unload, unload ? '#3d7fd6' : '#3f9e5c');
        if (e.total) drawProgress(g, x0, y0, e.total / STATION_CAP, '#f0a742');
        if (e.fl && e.fl.n >= 1) { g.fillStyle = ITEMS[e.fl.k].color; g.beginPath(); g.arc(x0 + TILE - 8, y0 + TILE - 8, 4, 0, Math.PI * 2); g.fill(); }
      }
      break;
    }

    case 'train':
      drawCar(g, cx, cy, 0, true, 0);
      break;

    case 'concrete_floor': case 'refined_floor': {
      const ref = e.type === 'refined_floor';
      g.fillStyle = ref ? '#5e6266' : '#8e8e88'; g.fillRect(x0, y0, TILE, TILE);
      const k = hash(e.x, e.y, 310) * 14 - 7;
      g.fillStyle = ref ? `rgb(${104 + k},${108 + k},${112 + k})` : `rgb(${158 + k},${157 + k},${150 + k})`;
      g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y0 + 0.5, TILE - 1, TILE - 1);
      if (ref) { g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(x0 + 4, y0 + TILE / 2); g.lineTo(x0 + TILE - 4, y0 + TILE / 2); g.stroke(); }
      break;
    }
    case 'road': {
      // Ladrillos, con juntas y algo de desgaste
      g.fillStyle = '#8a5a42'; g.fillRect(x0, y0, TILE, TILE);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const bx = x0 + c * 11 - (r % 2 ? 5 : 0), by = y0 + r * 8;
        const k = hash(e.x * 7 + c, e.y * 5 + r, 300) * 30 - 15;
        g.fillStyle = `rgb(${165 + k},${100 + k * 0.6},${74 + k * 0.4})`;
        g.fillRect(Math.max(x0, bx + 1), by + 1, Math.min(10, x0 + TILE - bx - 1), 6);
      }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, y0 + TILE - 2, TILE, 2);
      break;
    }
    case 'dispatcher': {
      box(g, x0, y0, '#3d4552', '#5aa0ff');
      if (e.filter) drawItem(g, e.filter, cx, cy, 6);
      else { g.fillStyle = '#5aa0ff'; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx, cy + 1); }
      drawArrow(g, cx, cy, e.dir, '#cfe4ff');
      break;
    }
    case 'receiver': {
      box(g, x0, y0, '#3d4552', '#f0a742');
      g.fillStyle = '#f0a742';
      g.beginPath(); g.moveTo(cx, cy + 7); g.lineTo(cx - 7, cy - 1); g.lineTo(cx - 3, cy - 1); g.lineTo(cx - 3, cy - 7);
      g.lineTo(cx + 3, cy - 7); g.lineTo(cx + 3, cy - 1); g.lineTo(cx + 7, cy - 1); g.closePath(); g.fill();
      break;
    }

    case 'offshore': {
      box(g, x0, y0, '#2b5f8f', '#9fd0ff');
      g.fillStyle = '#9fd0ff';
      g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b5f8f'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - 4, cy); g.quadraticCurveTo(cx, cy - 4, cx + 4, cy); g.stroke();
      drawArrow(g, cx, cy, e.dir, '#d8eeff');
      break;
    }

    case 'boiler': {
      box(g, x0, y0, '#5b4a3e', '#c9a27a');
      g.fillStyle = e.active ? '#ff9a3c' : '#2a1a14';
      g.fillRect(cx - 7, cy + 2, 14, 6);
      g.fillStyle = '#9aa3ad';
      g.beginPath(); g.ellipse(cx, cy - 4, 9, 5, 0, 0, Math.PI * 2); g.fill();
      if (e.active) {
        g.fillStyle = `rgba(235,240,245,${0.4 + 0.2 * Math.sin(t * 4 + e.x)})`;
        g.beginPath(); g.arc(cx + 4, y0 + 2 - ((t * 10) % 6), 4, 0, Math.PI * 2); g.fill();
      }
      drawArrow(g, cx, cy, e.dir, '#ffe2c4');
      break;
    }

    case 'steam_engine': {
      box(g, x0, y0, '#3e4a55', '#b8c6d2');
      g.save();
      g.translate(cx - 3, cy);
      g.rotate(e.active ? t * 7 : 0);
      g.strokeStyle = '#d8e2ea'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2);
      for (let i = 0; i < 3; i++) { const a = i * 2.09; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); }
      g.stroke();
      g.restore();
      drawBolt(g, x0 + TILE - 9, y0 + 9, 4.5, '#f0d44d');
      drawArrow(g, cx, cy, e.dir, '#e8eef4');
      break;
    }

    case 'radar': {
      box(g, x0, y0, '#33424a', null);
      g.save();
      g.translate(cx, cy);
      g.rotate(e.active ? t * 2 : 0.6);
      g.fillStyle = '#c9d6dd';
      g.beginPath(); g.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#33424a';
      g.beginPath(); g.ellipse(0, 1.5, 9, 3, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = '#c9d6dd';
      g.beginPath(); g.arc(cx, cy, 2.5, 0, Math.PI * 2); g.fill();
      break;
    }

    case 'landfill':
      g.fillStyle = '#5a4a32';
      g.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
      g.fillStyle = '#7a6544';
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x0 + 6 + k * 5, y0 + 8 + (k % 2) * 12, 3, 0, Math.PI * 2); g.fill(); }
      break;

    case 'pole':
      if (e.type === 'substation') {
        box(g, x0, y0, '#4a525c', '#c0c8d0', 3, TILE * 2);
        g.strokeStyle = '#c0c8d0'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x0 + 18, y0 + 46); g.lineTo(x0 + 18, y0 + 14); g.moveTo(x0 + 46, y0 + 46); g.lineTo(x0 + 46, y0 + 14);
        g.moveTo(x0 + 12, y0 + 18); g.lineTo(x0 + 52, y0 + 18); g.stroke();
        g.fillStyle = '#7fd1ff'; for (const xx of [12, 32, 52]) { g.beginPath(); g.arc(x0 + xx, y0 + 16, 2.5, 0, 7); g.fill(); }
        break;
      }
      if (e.type === 'mediumpole') {
        g.fillStyle = '#7d858f'; g.fillRect(cx - 2.5, cy - 12, 5, 24);
        g.fillStyle = '#9aa3ad'; g.fillRect(cx - 10, cy - 10, 20, 3); g.fillRect(cx - 7, cy - 4, 14, 2);
        g.fillStyle = '#e0b84a'; g.fillRect(cx - 10, cy - 12, 3, 3); g.fillRect(cx + 7, cy - 12, 3, 3);
        break;
      }
      g.fillStyle = '#6b4a24';
      g.fillRect(cx - 2, cy - 11, 4, 22);
      g.fillRect(cx - 9, cy - 9, 18, 3);
      g.fillStyle = '#9fb0c0';
      g.fillRect(cx - 9, cy - 11, 3, 3);
      g.fillRect(cx + 6, cy - 11, 3, 3);
      break;

    case 'solar':
      box(g, x0, y0, '#1b2d4f', '#7b8ea8', 2);
      g.strokeStyle = '#3d5d8f'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < 3; i++) {
        g.moveTo(x0 + 3 + i * (TILE - 6) / 3, y0 + 3); g.lineTo(x0 + 3 + i * (TILE - 6) / 3, y0 + TILE - 3);
        g.moveTo(x0 + 3, y0 + 3 + i * (TILE - 6) / 3); g.lineTo(x0 + TILE - 3, y0 + 3 + i * (TILE - 6) / 3);
      }
      g.stroke();
      break;

    case 'hub': if (e.type === 'lander') drawLander(g, x0, y0, t); else drawCrashedShip(g, x0, y0, t); break;
    case 'moonpad': drawMoonpad(g, x0, y0, t); break;

    case 'armory': {
      const s2 = TILE * 2;
      box(g, x0, y0, '#4a3b2e', '#c98a4a', 2, s2);
      // Fragua con brasas
      g.fillStyle = '#2b2622'; rrect(g, x0 + 6, y0 + 6, 20, 18, 3); g.fill();
      const ember = 0.6 + Math.sin(t * 5) * 0.2;
      g.fillStyle = `rgba(255,${120 + Math.floor(ember * 60)},40,${ember})`; g.beginPath(); g.ellipse(x0 + 16, y0 + 17, 7, 4, 0, 0, Math.PI * 2); g.fill();
      // Yunque
      g.fillStyle = '#5b636d';
      g.beginPath(); g.moveTo(x0 + 30, y0 + 40); g.lineTo(x0 + 54, y0 + 40); g.lineTo(x0 + 58, y0 + 34); g.lineTo(x0 + 26, y0 + 34); g.closePath(); g.fill();
      g.fillRect(x0 + 37, y0 + 40, 10, 8); g.fillRect(x0 + 33, y0 + 48, 18, 5);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x0 + 28, y0 + 34, 28, 2);
      // Espada y escudo colgados
      g.save(); g.translate(x0 + 46, y0 + 16); g.rotate(0.6);
      g.fillStyle = '#dfe6ee'; g.fillRect(-1.5, -12, 3, 18); g.fillStyle = '#c98a4a'; g.fillRect(-5, 5, 10, 2.5); g.fillStyle = '#6b4a2a'; g.fillRect(-1.5, 7, 3, 6);
      g.restore();
      g.fillStyle = '#7d858f'; g.beginPath(); g.moveTo(x0 + 10, y0 + 32); g.lineTo(x0 + 22, y0 + 32); g.lineTo(x0 + 22, y0 + 42); g.quadraticCurveTo(x0 + 16, y0 + 52, x0 + 10, y0 + 42); g.closePath(); g.fill();
      g.fillStyle = '#c98a4a'; g.fillRect(x0 + 15, y0 + 33, 2, 15);
      break;
    }

    case 'shipyard': case 'starport': drawShipyard(g, e, x0, y0, t); break;

    case 'nursery': {
      const s = TILE * 2;
      box(g, x0, y0, '#5b4630', '#6fbf5a', 2, s);
      // Canteros con brotes
      for (let k = 0; k < 4; k++) {
        const px = x0 + 14 + (k % 2) * 36, py = y0 + 14 + Math.floor(k / 2) * 36;
        g.fillStyle = '#3b2a1a'; g.fillRect(px - 9, py - 9, 18, 18);
        const grow = e.active ? Math.min(1, ((e.t || 0) / BUILDINGS.nursery.every + k * 0.25) % 1 + 0.2) : 0.5;
        g.fillStyle = '#7ee07a';
        g.beginPath(); g.ellipse(px - 3, py, 4 * grow + 1, 2 * grow + 1, -0.6, 0, Math.PI * 2); g.ellipse(px + 3, py - 1, 4 * grow + 1, 2 * grow + 1, 0.6, 0, Math.PI * 2); g.fill();
      }
      break;
    }

    case 'purifier': {
      const s = TILE * 2, mx = x0 + s / 2, my = y0 + s / 2;
      box(g, x0, y0, '#2f5d55', '#7fd1b5', 2, s);
      // Rejilla y ventilador que gira cuando limpia
      g.fillStyle = '#1b2f2b';
      g.beginPath(); g.arc(mx, my, 20, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(mx, my); g.rotate(e.active ? t * 9 : 0.3);
      g.fillStyle = '#bfe9dc';
      for (let k = 0; k < 5; k++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.ellipse(9, 0, 9, 3.5, 0.4, 0, Math.PI * 2); g.fill(); }
      g.restore();
      g.fillStyle = '#e8fff6'; g.beginPath(); g.arc(mx, my, 4, 0, Math.PI * 2); g.fill();
      // Hojita: limpia el aire
      g.fillStyle = e.active ? '#7ee07a' : '#4c7a4a';
      g.beginPath(); g.ellipse(x0 + s - 11, y0 + 11, 6, 3.5, -0.7, 0, Math.PI * 2); g.fill();
      if (e.filters !== undefined) drawProgress(g, x0, y0 + TILE, Math.min(1, e.filters / 20), '#7fd1b5');
      break;
    }

    case 'uplink': {
      const s = TILE * 3, mx = x0 + s / 2, my = y0 + s / 2;
      box(g, x0, y0, '#3a3f4a', '#ff8a5c', 2, s);
      g.strokeStyle = 'rgba(255,138,92,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(mx, my, 36, 0, Math.PI * 2); g.stroke();
      // Antena parabólica que apunta al blanco
      g.save(); g.translate(mx, my); g.rotate((e.aim ?? -Math.PI / 2) + Math.PI / 2);
      g.fillStyle = '#d8dee6';
      g.beginPath(); g.ellipse(0, -4, 22, 12, 0, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = '#9aa3ad'; g.fillRect(-2, -16, 4, 14);
      g.fillStyle = e.cd > 0 ? '#ff8a5c' : '#5cc47a';
      g.beginPath(); g.arc(0, -18, 3.5, 0, Math.PI * 2); g.fill();
      g.restore();
      // Luces de las cargas
      for (let k = 0; k < 10; k++) {
        g.fillStyle = k < (e.charges || 0) ? '#ff6a3d' : 'rgba(0,0,0,0.4)';
        g.fillRect(x0 + 10 + k * 7.6, y0 + s - 11, 5, 4);
      }
      break;
    }

    case 'fusion_plant': {
      const s = TILE * 3, mx = x0 + s / 2, my = y0 + s / 2;
      box(g, x0, y0, '#3b3a46', '#ffd166', 2, s);
      const pulse = 0.7 + 0.3 * Math.sin(t * 4 + e.x);
      const grd = g.createRadialGradient(mx, my, 2, mx, my, 30);
      grd.addColorStop(0, `rgba(255,250,220,${pulse})`); grd.addColorStop(0.45, `rgba(255,190,80,${0.7 * pulse})`); grd.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(mx, my, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c9cfd6'; g.lineWidth = 5;
      g.beginPath(); g.ellipse(mx, my, 30, 13, t * 0.6, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#8a929c'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(mx, my, 30, 13, t * 0.6 + Math.PI / 2, 0, Math.PI * 2); g.stroke();
      break;
    }
  }

  // Red de señales: puntito del canal y, si está apagado por la condición, un ícono de pausa
  if (e.cond) {
    const sz = sizeOf(e.type) * TILE;
    if (e.off) {
      g.fillStyle = 'rgba(10,12,16,0.45)';
      g.fillRect(x0 + 2, y0 + 2, sz - 4, sz - 4);
      g.fillStyle = '#e6e9ee';
      g.fillRect(x0 + sz / 2 - 5, y0 + sz / 2 - 6, 3.5, 12);
      g.fillRect(x0 + sz / 2 + 1.5, y0 + sz / 2 - 6, 3.5, 12);
    }
    g.fillStyle = SIGNAL_COLORS[e.cond.ch] || '#fff';
    g.beginPath(); g.arc(x0 + 6, y0 + 6, 3.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke();
  }

  // Aviso de falta de energía
  if (def && def.power && e.id && e.type !== 'laser' && e.type !== 'lamp') {
    const net = nets[e._net];
    const noPower = !net || net.sat < 0.05;
    const low = !noPower && net.sat < 0.95;
    if ((noPower || low) && Math.floor(t * 2) % 2 === 0) {
      drawBolt(g, cx, cy, 7, noPower ? '#e5534b' : '#f0c040');
    }
  }
  if ((e.type === 'miner' || e.type === 'eminer' || e.type === 'pumpjack') && e.depleted && e.id) {
    g.strokeStyle = '#e5534b'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.moveTo(cx - 4.5, cy + 4.5); g.lineTo(cx + 4.5, cy - 4.5); g.stroke();
  }
  // Módulos instalados: puntitos de color en la esquina
  if (e.modules && e.modules.length) {
    e.modules.forEach((m, i) => { g.fillStyle = ITEMS[m].color; g.fillRect(x0 + TILE - 7, y0 + 3 + i * 5, 4, 4); });
  }
  // Barra de vida si está dañado
  if (e.hp !== undefined && e.id) {
    const s = sizeOf(e.type) * TILE, f = Math.max(0, e.hp / maxHp(e));
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(x0 + 3, y0 - 6, s - 6, 4);
    g.fillStyle = f > 0.5 ? '#5cc47a' : f > 0.25 ? '#f0c040' : '#e5534b';
    g.fillRect(x0 + 3, y0 - 6, (s - 6) * f, 4);
  }
}

// La nave: se dibuja una silueta y se va "llenando" a medida que llegan las piezas
function drawShip(g, cx, baseY, scale, frac, flame, t, ark = false) {
  g.save();
  g.translate(cx, baseY);
  g.scale(scale, scale);
  // El arca: un casco ancho con anillo de hábitat y tres motores
  const arkPath = () => {
    g.beginPath();
    g.moveTo(0, -190);
    g.quadraticCurveTo(30, -170, 34, -120);
    g.lineTo(70, -110); g.quadraticCurveTo(84, -95, 70, -80); g.lineTo(34, -70);
    g.lineTo(34, -10);
    g.lineTo(62, 4); g.lineTo(62, 18); g.lineTo(34, 10);
    g.lineTo(-34, 10);
    g.lineTo(-62, 18); g.lineTo(-62, 4); g.lineTo(-34, -10);
    g.lineTo(-34, -70); g.lineTo(-70, -80); g.quadraticCurveTo(-84, -95, -70, -110); g.lineTo(-34, -120);
    g.quadraticCurveTo(-30, -170, 0, -190);
    g.closePath();
  };
  const path = ark ? arkPath : () => {
    g.beginPath();
    g.moveTo(0, -120);
    g.quadraticCurveTo(22, -95, 22, -55);
    g.lineTo(22, -10);
    g.lineTo(38, 8); g.lineTo(38, 18); g.lineTo(22, 10);
    g.lineTo(-22, 10);
    g.lineTo(-38, 18); g.lineTo(-38, 8); g.lineTo(-22, -10);
    g.lineTo(-22, -55);
    g.quadraticCurveTo(-22, -95, 0, -120);
    g.closePath();
  };
  if (flame) {
    const f = 30 + Math.sin(t * 40) * 8;
    const grd = g.createLinearGradient(0, 10, 0, 10 + f * 2);
    grd.addColorStop(0, '#fff6c0'); grd.addColorStop(0.3, '#ffb03a'); grd.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = grd;
    for (const ex of ark ? [-46, -20, 0, 20, 46] : [-12, 0, 12]) {
      g.beginPath();
      g.moveTo(ex - 6, 10); g.lineTo(ex + 6, 10); g.lineTo(ex, 10 + f * 2 + (ex ? -10 : 0));
      g.closePath(); g.fill();
    }
  }
  // Silueta
  path();
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fill();
  g.setLineDash([4, 4]);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1.5;
  g.stroke();
  g.setLineDash([]);
  // Parte construida, de abajo hacia arriba
  if (frac > 0) {
    g.save();
    path();
    g.clip();
    const h = ark ? 208 : 138;
    const top = 18 - frac * h;
    g.fillStyle = ark ? '#e4e8ee' : '#d7dde3';
    g.fillRect(-90, top, 180, h + 2);
    g.fillStyle = ark ? '#8a7dff' : '#e5533d';
    g.fillRect(-90, Math.max(top, -10), 180, 30);
    if (ark) {
      g.fillStyle = '#9ad17f';
      if (top < -80) g.fillRect(-90, Math.max(top, -112), 180, 34);
      g.fillStyle = '#59c3ff';
      for (const wy of [-40, -140]) if (top < wy) { g.beginPath(); g.arc(0, wy, 9, 0, Math.PI * 2); g.fill(); }
    } else {
      g.fillStyle = '#3d8fd6';
      if (top < -70) { g.beginPath(); g.arc(0, -70, 8, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    path();
    g.strokeStyle = '#8b96a1';
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.restore();
}

function drawShipyard(g, e, x0, y0, t) {
  const ark = e.type === 'starport';
  const s = TILE * sizeOf(e.type);
  g.fillStyle = '#4b5159';
  g.fillRect(x0 + 2, y0 + 2, s - 4, s - 4);
  // Franjas de peligro en el borde
  g.save();
  g.beginPath();
  g.rect(x0 + 2, y0 + 2, s - 4, s - 4);
  g.rect(x0 + 10, y0 + 10, s - 20, s - 20);
  g.clip('evenodd');
  for (let i = -s; i < s * 2; i += 16) {
    g.fillStyle = '#e0b84a';
    g.beginPath();
    g.moveTo(x0 + i, y0); g.lineTo(x0 + i + 8, y0); g.lineTo(x0 + i + 8 - s, y0 + s); g.lineTo(x0 + i - s, y0 + s);
    g.closePath(); g.fill();
  }
  g.restore();
  if (!launchAnim || launchAnim.yard !== e) {
    const frac = shipProgressOf(e);
    drawShip(g, x0 + s / 2, y0 + s - 26, ark ? 0.95 : 0.95, frac, false, t, ark);
  }
}

function shipProgressOf(e) {
  if (e.type === 'starport') return arkOrderIdx() / ARK_ORDERS.length;
  let have = 0, need = 0;
  const needs = shipNeeds(e);
  for (const k in needs) { need += needs[k]; have += Math.min(needs[k], e.parts?.[k] || 0); }
  return have / need;
}

// Un vagón o la locomotora, centrado en (x, y) y girado
function drawCar(g, x, y, ang, loco, fill, fluid) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(-14, -8, 30, 18);
  g.fillStyle = loco ? '#c0472f' : '#6c7682';
  g.fillRect(-15, -9, 30, 18);
  if (loco) {
    g.fillStyle = '#2b2f36'; g.fillRect(4, -6, 8, 12);
    g.fillStyle = '#f0d44d'; g.fillRect(13, -3, 2, 6);
  } else if (fluid) {
    // Vagón de fluidos: un tanque redondeado
    g.fillStyle = '#4a525c'; g.beginPath(); g.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2); g.fill();
    if (fill > 0) { g.fillStyle = fluid; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(0, 0, 12 * Math.min(1, fill) + 2, 6, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-10, -4); g.lineTo(10, -4); g.stroke();
  } else {
    g.fillStyle = '#3d444d'; g.fillRect(-12, -6, 24, 12);
    if (fill > 0) { g.fillStyle = '#c9a227'; g.fillRect(-12, -6, 24 * Math.min(1, fill), 12); }
  }
  g.restore();
}

function drawTrains(g, lod) {
  for (const t of S.trains) {
    const w = wagonsOf(t);
    const fill = trainCap(t) ? t.total / trainCap(t) : 0, ffill = fluidCap(t) && t.fl ? t.fl.n / fluidCap(t) : 0;
    for (let k = w.length; k >= 0; k--) {
      const p = k === 0 ? { x: t.x, y: t.y, ang: t.ang } : trainTrail(t, k * 1.05);
      if (lod) { g.fillStyle = k === 0 ? '#ff7a5c' : '#ddd'; g.fillRect(p.x * TILE + 4, p.y * TILE + 4, TILE - 8, TILE - 8); continue; }
      const kind = k === 0 ? null : w[k - 1];
      drawCar(g, p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, p.ang, k === 0, kind === 'f' ? ffill : fill, kind === 'f' ? (t.fl ? ITEMS[t.fl.k].color : '#5a6470') : null);
    }
  }
}

// El personaje, visto desde arriba: sombra, mochila, traje, casco y herramienta
function drawPlayer(g, lod) {
  const p = S.player;
  const x = p.x * TILE, y = p.y * TILE;
  if (lod) { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); return; }
  // Destino del camino
  if (p.path && p.path.length) {
    const d = p.path[p.path.length - 1];
    g.strokeStyle = 'rgba(255,211,77,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.arc(d.x * TILE, d.y * TILE, 6 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2); g.stroke();
  }
  // Barra de extracción
  if (p.mining && p.mine) {
    const mx = p.mine.x * TILE, my = p.mine.y * TILE;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(mx + 3, my - 8, TILE - 6, 5);
    g.fillStyle = '#ffd34d'; g.fillRect(mx + 3, my - 8, (TILE - 6) * Math.min(1, p.mineT / (p.mine.tree ? CHOP_TIME : HAND_MINE_TIME)), 5);
  }
  if (!p.vehicle) { drawAvatar(g, p, x, y, '#ffb347', '#d9782a'); drawPlayerCombat(g, p, x, y); }
  if (NET.on) drawNameTag(g, x, y, NET.nick || 'Vos', '#ffb347', NET.role === 'host');
  if (NET.on && CHAT.mySay && performance.now() < CHAT.mySay.until) drawSpeech(g, x, y, CHAT.mySay.text);
}

// Un personaje visto de arriba (el propio en naranja; los demás con su color)
function drawAvatar(g, p, x, y, light, dark) {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(3, 5, 11, 8, 0, 0, Math.PI * 2); g.fill();
  g.rotate(p.ang || 0);
  const swing = p.moving ? Math.sin(p.step) * 4 : 0;
  // Piernas
  g.fillStyle = '#3b4250';
  g.beginPath(); g.ellipse(-2 + swing, -5, 4, 3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(-2 - swing, 5, 4, 3, 0, 0, Math.PI * 2); g.fill();
  // Mochila
  g.fillStyle = '#6b5236';
  g.beginPath(); g.roundRect(-11, -6, 6, 12, 2); g.fill();
  // Cuerpo (traje naranja)
  const body = g.createLinearGradient(-8, -9, 8, 9);
  body.addColorStop(0, light); body.addColorStop(1, dark);
  g.fillStyle = body;
  g.beginPath(); g.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
  // Brazos y herramienta
  const arm = p.mining ? Math.sin(time * 14) * 0.9 : swing * 0.1;
  g.save();
  g.rotate(arm);
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(4, 8, 4, 3, 0, 0, Math.PI * 2); g.fill();
  if (p.mining) {
    g.strokeStyle = '#8a6a44'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(5, 8); g.lineTo(15, 10); g.stroke();
    g.strokeStyle = '#c9d1db'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(14, 5); g.quadraticCurveTo(17, 10, 14, 15); g.stroke();
  }
  g.restore();
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(4, -8, 4, 3, 0, 0, Math.PI * 2); g.fill();
  // Casco con visor
  g.fillStyle = '#f2f2ee';
  g.beginPath(); g.arc(1, 0, 5.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f6fb0';
  g.beginPath(); g.ellipse(4, 0, 2.2, 3.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath(); g.arc(4.5, -1.2, 1, 0, Math.PI * 2); g.fill();
  g.restore();
}

// Los otros jugadores conectados, con su nombre arriba
function drawRemotePlayers(g, lod) {
  for (const a of NET.avatars.values()) {
    const col = netColor(a.by);
    const x = a.x * TILE, y = a.y * TILE;
    if (lod) { g.fillStyle = col; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); continue; }
    if (!a.dv) drawAvatar(g, a, x, y, col, shadeHex(col, -0.25));
    const pr = a.by && NET.profiles[a.by];
    drawNameTag(g, x, y, a.nick || (pr && pr.name) || 'Jugador', col, a.host);
    if (a.say && performance.now() < a.sayUntil) drawSpeech(g, x, y, a.say);
    if (a.hpr < 100) hpBar(g, x, y + 16, 30, a.hpr / 100, a.hpr > 35 ? '#5cc47a' : '#e5534b');
  }
}

// Globito de chat arriba del nombre (hasta 2 renglones)
function drawSpeech(g, x, y, text) {
  g.font = '500 11px Barlow, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > 150 && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 2);
  if (lines.length > 2) shown[1] += '…';
  const w = Math.min(170, Math.max(...shown.map((l) => g.measureText(l).width)) + 16), h = shown.length * 13 + 8;
  const top = y - 40 - h;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  rrect(g, x - w / 2, top, w, h, 7); g.fill();
  g.beginPath(); g.moveTo(x - 5, top + h); g.lineTo(x + 5, top + h); g.lineTo(x, top + h + 5); g.closePath(); g.fill();
  g.fillStyle = '#1b1f24';
  shown.forEach((l, i) => g.fillText(l, x, top + 10.5 + i * 13));
}

// Cartelito con el nombre arriba de un personaje
function drawNameTag(g, x, y, name, col, host) {
  g.font = '600 11px Barlow, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = host ? '★ ' + name : name;
  const w = g.measureText(label).width + 14;
  g.fillStyle = 'rgba(10,14,20,0.78)';
  rrect(g, x - w / 2, y - 34, w, 16, 5); g.fill();
  g.fillStyle = col;
  g.fillRect(x - w / 2 + 3, y - 30, 2.5, 8);
  g.fillStyle = '#fff';
  g.fillText(label, x + 2, y - 25.5);
}

function shadeHex(hex, k) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + k))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawGhostsAndRobots(g, vx0, vy0, vx1, vy1) {
  // Tareas pendientes del personaje
  if (playerOn()) {
    for (const q of S.player.queue) {
      if (q.kind === 'place') {
        const e = makeEntity(q.type, q.x, q.y, q.dir);
        g.globalAlpha = 0.4;
        drawBuilding(g, e, q.x * TILE, q.y * TILE, time);
        g.globalAlpha = 1;
        g.strokeStyle = '#ffd34d'; g.setLineDash([3, 3]); g.lineWidth = 1.5;
        g.strokeRect(q.x * TILE + 1.5, q.y * TILE + 1.5, sizeOf(q.type) * TILE - 3, sizeOf(q.type) * TILE - 3);
        g.setLineDash([]);
      } else {
        g.strokeStyle = '#e5534b'; g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(q.x * TILE + 8, q.y * TILE + 8); g.lineTo(q.x * TILE + TILE - 8, q.y * TILE + TILE - 8);
        g.moveTo(q.x * TILE + TILE - 8, q.y * TILE + 8); g.lineTo(q.x * TILE + 8, q.y * TILE + TILE - 8);
        g.stroke();
      }
    }
  }
  for (const gh of S.ghosts) {
    const px = gh.x * TILE, py = gh.y * TILE, s = sizeOf(gh.type) * TILE;
    if (px + s < vx0 || px > vx1 || py + s < vy0 || py > vy1) continue;
    g.globalAlpha = 0.35;
    const e = makeEntity(gh.type, gh.x, gh.y, gh.dir);
    if (gh.recipe) e.recipe = gh.recipe;
    drawBuilding(g, e, px, py, time);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(90,160,255,0.22)';
    g.fillRect(px + 1, py + 1, s - 2, s - 2);
    g.strokeStyle = 'rgba(120,180,255,0.7)';
    g.setLineDash([4, 3]);
    g.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
    g.setLineDash([]);
  }
  for (const f of S.lflights || []) {
    const x = f.x * TILE, y = f.y * TILE - 12;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + 16, 6, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e07a3a';
    g.fillRect(x - 5, y - 3, 10, 6);
    g.strokeStyle = '#d8dee6'; g.lineWidth = 1.5;
    const sp = Math.sin(time * 40 + f.port) * 3;
    g.beginPath(); g.moveTo(x - 8, y - 4 + sp * 0.2); g.lineTo(x - 2, y - 4); g.moveTo(x + 2, y - 4); g.lineTo(x + 8, y - 4 - sp * 0.2); g.stroke();
    if (f.carry) drawItem(g, f.item, x, y + 6, 3);
  }
  for (const f of S.flights) {
    const x = f.x * TILE, y = f.y * TILE - 10;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + 14, 6, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8c547';
    g.fillRect(x - 5, y - 3, 10, 6);
    g.strokeStyle = '#d8dee6'; g.lineWidth = 1.5;
    const sp = Math.sin(time * 40) * 3;
    g.beginPath(); g.moveTo(x - 8, y - 4 + sp * 0.2); g.lineTo(x - 2, y - 4); g.moveTo(x + 2, y - 4); g.lineTo(x + 8, y - 4 - sp * 0.2); g.stroke();
    if (!f.back) { g.fillStyle = '#5aa0ff'; g.beginPath(); g.arc(x, y + 5, 2.5, 0, Math.PI * 2); g.fill(); }
  }
}

function drawItemsOn(g, e) {
  if (!e.l || (!e.l[0] && !e.l[1])) return;
  const cx = e.x * TILE + TILE / 2, cy = e.y * TILE + TILE / 2;
  const [dx, dy] = DIRS[e.dir], [lx, ly] = DIRS[(e.dir + 3) % 4];
  for (let ln = 0; ln < 2; ln++) {
    const it = e.l[ln];
    if (!it) continue;
    const side = ln === 0 ? 6.5 : -6.5;   // carril izquierdo / derecho
    if (isBelt(e.type) || (e.type === 'underground' && (e.mode === 'out' || e.p[ln] < 0.5))) {
      const k = (Math.min(e.p[ln], 1) - 0.5) * TILE;
      const x = cx + dx * k + lx * side, y = cy + dy * k + ly * side;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(x + 1.2, y + 2, 4, 3, 0, 0, Math.PI * 2); g.fill();
      drawItem(g, it, x, y, 4);
    } else if (e.type === 'splitter' || e.type === 'sorter') {
      drawItem(g, it, cx + lx * 9 * Math.sign(side) + dx * 8, cy + ly * 9 * Math.sign(side) + dy * 8, 3.2);
    }
  }
}

// Cables rojos y verdes: una curva colgando entre los dos bornes (cada cable se dibuja una vez)
function drawWires(g, visible) {
  if (!hasTech('combinators') && !S.entities.some((e) => e.w && e.w.length)) return;
  g.lineWidth = 1.6;
  for (const e of visible) {
    if (!e.w) continue;
    for (const w of e.w) {
      const b = at(w.x, w.y);
      if (!b) continue;
      // Si los dos se ven, lo dibuja uno solo
      if (visible.includes(b) && (b.x < e.x || (b.x === e.x && b.y < e.y) || (b === e))) continue;
      const pa = wirePoint(e, w.m), pb = wirePoint(b, w.t);
      const ax = pa.x * TILE, ay = pa.y * TILE, bx = (pa.x + wdx(pb.x - pa.x)) * TILE, by = (pa.y + wdy(pb.y - pa.y)) * TILE;
      const off = w.c === 'r' ? -2 : 2, sag = Math.min(18, Math.hypot(bx - ax, by - ay) * 0.12);
      g.strokeStyle = WIRE_COLORS[w.c];
      g.beginPath(); g.moveTo(ax + off, ay); g.quadraticCurveTo((ax + bx) / 2 + off, (ay + by) / 2 + sag, bx + off, by); g.stroke();
    }
  }
}

// --------------------------- Bichos y efectos ---------------------------

function drawBiter(g, b, t) {
  const k = BITERS[b.kind];
  const px = b.x * TILE, py = b.y * TILE, s = k.size;
  g.save();
  g.translate(px, py);
  g.rotate(b.ang || 0);
  const walk = Math.sin(t * 18 + px) * 0.5;
  g.strokeStyle = '#2a1a10'; g.lineWidth = 1.5;
  g.beginPath();
  for (let i = -1; i <= 1; i++) {
    const w = i % 2 ? walk : -walk;
    g.moveTo(i * s * 0.4, 0); g.lineTo(i * s * 0.4 + w * 3, -s * 0.9);
    g.moveTo(i * s * 0.4, 0); g.lineTo(i * s * 0.4 - w * 3, s * 0.9);
  }
  g.stroke();
  g.fillStyle = k.color;
  g.beginPath(); g.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2); g.fill();
  if (k.range) {
    // Escupidor: saco de ácido que brilla en la cola
    g.fillStyle = 'rgba(190,255,80,0.85)';
    g.beginPath(); g.ellipse(-s * 0.75, 0, s * 0.45, s * 0.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.beginPath(); g.arc(-s * 0.85, -s * 0.12, s * 0.12, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#1a0f08';
  g.beginPath(); g.ellipse(s * 0.75, 0, s * 0.4, s * 0.35, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff5a3c';
  g.beginPath(); g.arc(s * 0.95, -s * 0.15, 1.2, 0, Math.PI * 2); g.arc(s * 0.95, s * 0.15, 1.2, 0, Math.PI * 2); g.fill();
  g.restore();
}

const effects = []; // { x, y, t, life, kind, scale, color }

function spawnExplosion(x, y, scale = 1) {
  effects.push({ x, y, t: 0, life: 0.6, kind: 'boom', scale });
}
function spawnStrike(x, y) {
  effects.push({ x, y, t: 0, life: 1.4, kind: 'strike', scale: 3 });
}
function spawnSplat(x, y, color) {
  effects.push({ x, y, t: 0, life: 4, kind: 'splat', scale: 1, color });
}

function drawEffects(g, dt) {
  for (const f of effects) {
    f.t += dt;
    const k = f.t / f.life;
    if (f.kind === 'strike') {
      // Rayo desde el cielo y una explosión grande
      const px = f.x * TILE, py = f.y * TILE, a = Math.max(0, 1 - k);
      g.fillStyle = `rgba(255,240,200,${a * 0.85})`;
      g.fillRect(px - 10 * a - 2, py - 900, 20 * a + 4, 900);
      g.fillStyle = `rgba(255,${200 - k * 140},80,${a})`;
      g.beginPath(); g.arc(px, py, (20 + k * 220), 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 4;
      g.beginPath(); g.arc(px, py, 30 + k * 260, 0, Math.PI * 2); g.stroke();
    } else if (f.kind === 'num') {
      drawDamageNum(g, f);
    } else if (f.kind === 'boom') {
      g.fillStyle = `rgba(255,${180 - k * 120},60,${1 - k})`;
      g.beginPath(); g.arc(f.x * TILE, f.y * TILE, (10 + k * 30) * f.scale, 0, Math.PI * 2); g.fill();
    } else {
      g.globalAlpha = Math.max(0, 0.6 * (1 - k));
      g.fillStyle = f.color;
      g.beginPath(); g.ellipse(f.x * TILE, f.y * TILE, 7, 5, f.x, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
  }
  for (let i = effects.length - 1; i >= 0; i--) if (effects[i].t >= effects[i].life) effects.splice(i, 1);
}

function drawShots(g) {
  for (const s of shots) {
    if (s.flame) {
      // Llamarada: varias bolas de fuego en el camino
      for (let i = 1; i <= 5; i++) {
        const k = i / 5, x = (s.x1 + (s.x2 - s.x1) * k) * TILE, y = (s.y1 + (s.y2 - s.y1) * k) * TILE;
        g.fillStyle = `rgba(255,${200 - i * 25},60,${0.75 - k * 0.3})`;
        g.beginPath(); g.arc(x, y, 3 + k * 7, 0, Math.PI * 2); g.fill();
      }
      continue;
    }
    g.strokeStyle = s.laser ? 'rgba(255,60,90,0.9)' : s.spit ? 'rgba(170,230,60,0.9)' : 'rgba(255,230,140,0.9)';
    g.lineWidth = s.laser ? 2.5 : s.spit ? 3 : 1.2;
    g.beginPath();
    g.moveTo(s.x1 * TILE, s.y1 * TILE);
    g.lineTo(s.x2 * TILE, s.y2 * TILE);
    g.stroke();
  }
}

// --------------------------- Noche ---------------------------

const lightCanvas = document.createElement('canvas');

function lightRadius(e) {
  switch (kindOf(e.type)) {
    case 'lamp': return e.lit ? 7 : 0;
    case 'hub': return 6;
    case 'shipyard': return 5;
    case 'starport': return 7;
    case 'fusion_plant': return 4;
    case 'uplink': return 2;
    case 'furnace': case 'efurnace': case 'generator': case 'boiler': return e.active ? 1.6 : 0;
    case 'radar': return 1.5;
    case 'laser': case 'turret': case 'flameturret': return 1.2;
    case 'beacon': return e.active ? 2 : 0;
    default: return 0;
  }
}

function drawNight(ctx2, visible) {
  const dark = darkness() * (nightVisionOn() ? 0.3 : 1);
  if (dark < 0.02) return;
  const scale = 0.5;
  const lw = Math.ceil(canvas.width * scale), lh = Math.ceil(canvas.height * scale);
  if (lightCanvas.width !== lw || lightCanvas.height !== lh) { lightCanvas.width = lw; lightCanvas.height = lh; }
  const g = lightCanvas.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, lw, lh);
  g.fillStyle = `rgba(6,10,32,${dark})`;
  g.fillRect(0, 0, lw, lh);
  g.globalCompositeOperation = 'destination-out';
  const k = view.zoom * dpr * scale;
  for (const [e, ox, oy] of visible) {
    const r = lightRadius(e);
    if (!r) continue;
    const s = sizeOf(e.type) / 2;
    const sx = ((e.x + s) * TILE + ox - view.x) * k + lw / 2, sy = ((e.y + s) * TILE + oy - view.y) * k + lh / 2;
    const rad = r * TILE * k;
    const grd = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.7)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }
  // Linternas: la tuya y las de tus amigos alumbran hacia donde miran
  const torches = [];
  if (playerOn() && S.player.torch !== false) torches.push(S.player);
  if (NET.on) for (const a of NET.avatars.values()) if (a.torch !== 0) torches.push(a);
  for (const p of torches) {
    const sx = (wdx(p.x - view.x / TILE) * TILE) * k + lw / 2, sy = (wdy(p.y - view.y / TILE) * TILE) * k + lh / 2;
    const len = 10 * TILE * k, half = 0.5, ang = p.ang || 0;
    const cone = g.createRadialGradient(sx, sy, 0, sx, sy, len);
    cone.addColorStop(0, 'rgba(0,0,0,1)'); cone.addColorStop(0.7, 'rgba(0,0,0,0.85)'); cone.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cone;
    g.beginPath(); g.moveTo(sx, sy); g.arc(sx, sy, len, ang - half, ang + half); g.closePath(); g.fill();
    // Un poco de luz alrededor, para verte los pies
    const r = 2.5 * TILE * k, glow = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    glow.addColorStop(0, 'rgba(0,0,0,0.9)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.imageSmoothingEnabled = true;
  ctx2.drawImage(lightCanvas, 0, 0, canvas.width, canvas.height);
  // Un tinte cálido en el haz de tu linterna
  if (playerOn() && S.player.torch !== false && dark > 0.2) {
    const p = S.player, z = view.zoom * dpr;
    const sx = (wdx(p.x - view.x / TILE) * TILE) * z + canvas.width / 2, sy = (wdy(p.y - view.y / TILE) * TILE) * z + canvas.height / 2;
    const len = 10 * TILE * z, grd = ctx2.createRadialGradient(sx, sy, 0, sx, sy, len);
    grd.addColorStop(0, `rgba(255,230,160,${0.12 * dark})`); grd.addColorStop(1, 'rgba(255,230,160,0)');
    ctx2.fillStyle = grd;
    ctx2.beginPath(); ctx2.moveTo(sx, sy); ctx2.arc(sx, sy, len, (p.ang || 0) - 0.5, (p.ang || 0) + 0.5); ctx2.closePath(); ctx2.fill();
  }
}

// --------------------------- Cuadro principal ---------------------------

let launchAnim = null; // { yard, t }
const particles = [];
let showPollution = false;
let activeOnScreen = 0;
let lastRender = 0;

// --------------------------- Árboles y humo ---------------------------

// Sprites de árboles hechos una sola vez: 3 frondosos y 3 pinos
const TREE_SPRITES = [];
(function makeTreeSprites() {
  const tones = [[52, 96, 46], [70, 112, 50], [44, 84, 52]];
  for (let v = 0; v < 6; v++) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const tone = tones[v % 3];
    const col = (k, a = 1) => `rgba(${tone[0] * k | 0},${tone[1] * k | 0},${tone[2] * k | 0},${a})`;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(37, 38, 15, 11, 0.3, 0, Math.PI * 2); g.fill();
    if (v < 3) {
      const rnd = mulberry32(v * 97 + 5);
      const blobs = [];
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * 7;
        blobs.push([32 + Math.cos(a) * d, 30 + Math.sin(a) * d, 6 + rnd() * 4]);
      }
      for (const [k, dx, dy, sr] of [[0.6, 1, 1.5, 1], [1, 0, 0, 0.9], [1.35, -1.5, -2, 0.55]]) {
        g.fillStyle = col(k);
        g.beginPath();
        for (const [x, y, r] of blobs) { g.moveTo(x + dx + r * sr, y + dy); g.arc(x + dx, y + dy, r * sr, 0, Math.PI * 2); }
        g.fill();
      }
    } else {
      // Pino visto de arriba: capas con borde dentado suave
      const rnd = mulberry32(v * 31 + 7);
      for (const [k, r, off] of [[0.55, 14, 1.5], [0.8, 11, 0.6], [1.05, 7.5, -0.2], [1.35, 4, -0.8]]) {
        g.fillStyle = col(k);
        g.beginPath();
        const n = 11, ph = rnd() * 6;
        for (let i = 0; i < n * 2; i++) {
          const a = (i / (n * 2)) * Math.PI * 2 + ph, rr = i % 2 ? r * 0.8 : r;
          g.lineTo(32 + off + Math.cos(a) * rr, 30 + off + Math.sin(a) * rr);
        }
        g.closePath(); g.fill();
      }
    }
    TREE_SPRITES.push(c);
  }
})();

function drawTrees(g, vx0, vy0, vx1, vy1) {
  const c0 = Math.max(0, Math.floor((vx0 - TILE) / (CHUNK * TILE))), c1 = Math.min(Math.ceil(W / CHUNK) - 1, Math.floor((vx1 + TILE) / (CHUNK * TILE)));
  const r0 = Math.max(0, Math.floor((vy0 - TILE) / (CHUNK * TILE))), r1 = Math.min(Math.ceil(H / CHUNK) - 1, Math.floor((vy1 + TILE) / (CHUNK * TILE)));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    for (const [x, y, v, sc, dx, dy] of chunkTrees(cx, cy)) {
      if (at(x, y) || !tileExplored(x, y)) continue;
      const s = 64 * sc;
      g.drawImage(TREE_SPRITES[v], x * TILE + 16 + dx - s / 2, y * TILE + 16 + dy - s / 2, s, s);
    }
  }
}

// Grilla suave solo mientras se construye
function drawGrid(g, vx0, vy0, vx1, vy1) {
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 1 / view.zoom;
  g.beginPath();
  const x0 = Math.max(0, Math.floor(vx0 / TILE)), x1 = Math.min(W, Math.ceil(vx1 / TILE));
  const y0 = Math.max(0, Math.floor(vy0 / TILE)), y1 = Math.min(H, Math.ceil(vy1 / TILE));
  for (let x = x0; x <= x1; x++) { g.moveTo(x * TILE, y0 * TILE); g.lineTo(x * TILE, y1 * TILE); }
  for (let y = y0; y <= y1; y++) { g.moveTo(x0 * TILE, y * TILE); g.lineTo(x1 * TILE, y * TILE); }
  g.stroke();
}

// Humo de las máquinas que queman combustible
const smoke = [];
const SMOKERS = { furnace: [0.55, 0.3, 6], boiler: [0.5, 0.25, 7], generator: [0.7, 0.2, 6], pumpjack: [0.3, 0.2, 5] };
function updateSmoke(visible, dt) {
  for (const e of visible) {
    const sm = SMOKERS[e.type];
    if (!sm || !e.active || Math.random() > sm[0] * dt * 6) continue;
    const s = sizeOf(e.type);
    smoke.push({ x: (e.x + s * 0.7) * TILE, y: (e.y + 0.2) * TILE, r: sm[2], life: 0, max: 2.2 + Math.random() * 1.5, a: sm[1], vx: 6 + Math.random() * 6, vy: -14 - Math.random() * 8 });
  }
  for (const p of smoke) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 7; }
  for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].life >= smoke[i].max) smoke.splice(i, 1);
  if (smoke.length > 400) smoke.splice(0, smoke.length - 400);
}
function drawSmoke(g) {
  for (const p of smoke) {
    const k = p.life / p.max;
    g.fillStyle = `rgba(70,70,74,${p.a * (1 - k) * Math.min(1, p.life * 4)})`;
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
  }
}

function render(ctx) {
  const now = performance.now();
  const rdt = Math.min(0.1, (now - (lastRender || now)) / 1000);
  lastRender = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d1014';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let shakeX = 0, shakeY = 0;
  if (launchAnim && launchAnim.t < 5) {
    const k = Math.min(1, launchAnim.t / 2) * 3;
    shakeX = (Math.random() - 0.5) * k; shakeY = (Math.random() - 0.5) * k;
  }
  const z = view.zoom * dpr;
  const worldTransform = () => ctx.setTransform(z, 0, 0, z, dpr * (cw / 2 - view.x * view.zoom + shakeX), dpr * (ch / 2 - view.y * view.zoom + shakeY));

  const gx0 = view.x - cw / 2 / view.zoom, gx1 = view.x + cw / 2 / view.zoom;
  const gy0 = view.y - ch / 2 / view.zoom, gy1 = view.y + ch / 2 / view.zoom;
  const lod = view.zoom < LOD_ZOOM;
  const mw = W * TILE, mh = H * TILE;

  // El mapa da la vuelta: se dibuja cada copia del mapa que entra en pantalla (como mucho 4)
  const passes = [];
  for (let ky = Math.floor(gy0 / mh); ky <= Math.floor(gy1 / mh); ky++) {
    for (let kx = Math.floor(gx0 / mw); kx <= Math.floor(gx1 / mw); kx++) passes.push([kx * mw, ky * mh]);
  }
  const lights = [];
  const seen = new Set();
  activeOnScreen = 0;
  passes.forEach(([ox, oy], pi) => {
    worldTransform();
    ctx.translate(ox, oy);
    const vis = drawWorld(ctx, gx0 - ox, gy0 - oy, gx1 - ox, gy1 - oy, lod, pi === 0 ? rdt : 0);
    for (const e of vis) {
      lights.push([e, ox, oy]);
      if (!seen.has(e)) { seen.add(e); if (e.active) activeOnScreen++; }
    }
  });
  updateSmoke(lod ? [] : [...seen], rdt);

  drawNight(ctx, lights);
  drawWeather(ctx);
  for (const [ox, oy] of passes) {
    worldTransform();
    ctx.translate(ox, oy);
    if (!lod) drawSmoke(ctx);
    drawOverlays(ctx);
    drawLaunch(ctx);
  }
}

// Una copia del mapa: suelo, edificios, bichos, trenes, personaje, cables, polución y niebla
function drawWorld(ctx, vx0, vy0, vx1, vy1, lod, rdt) {
  // Suelo
  if (lod) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixelMap, 0, 0, W * TILE, H * TILE);
  } else {
    const c0 = Math.max(0, Math.floor(vx0 / (CHUNK * TILE))), c1 = Math.min(Math.ceil(W / CHUNK) - 1, Math.floor(vx1 / (CHUNK * TILE)));
    const r0 = Math.max(0, Math.floor(vy0 / (CHUNK * TILE))), r1 = Math.min(Math.ceil(H / CHUNK) - 1, Math.floor(vy1 / (CHUNK * TILE)));
    ctx.imageSmoothingEnabled = true;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      ctx.drawImage(getChunk(cx, cy), cx * CHUNK * TILE, cy * CHUNK * TILE);
    }
  }

  const building = BUILDINGS[tool] || tool === 'delete' || tool === 'copy' || tool === 'paste';
  if (!lod && building) drawGrid(ctx, vx0, vy0, vx1, vy1);

  // Zonas de energía al elegir algo eléctrico
  const tdef = BUILDINGS[tool];
  if (tdef && (tdef.power || tdef.output || tdef.capacity || tdef.supply)) {
    ctx.fillStyle = 'rgba(80,160,255,0.12)';
    for (const e of S.entities) {
      if (!isPole(e)) continue;
      const sup = poleSupply(e);
      ctx.fillRect((e.x - sup) * TILE, (e.y - sup) * TILE, TILE * (sup * 2 + 1), TILE * (sup * 2 + 1));
    }
  }

  const visible = [];
  for (const e of S.entities) {
    const s = sizeOf(e.type) * TILE, px = e.x * TILE, py = e.y * TILE;
    if (px + s >= vx0 && px <= vx1 && py + s >= vy0 && py <= vy1 && (!isEnemyB(e) || tileExplored(e.x, e.y))) visible.push(e);
  }
  const biterVisible = (b) => tileExplored(Math.floor(b.x), Math.floor(b.y));

  if (lod) {
    for (const e of visible) {
      const s = sizeOf(e.type);
      ctx.fillStyle = TYPE_COLOR[e.type] || '#999';
      ctx.fillRect(e.x * TILE + 2, e.y * TILE + 2, s * TILE - 4, s * TILE - 4);
    }
    ctx.fillStyle = '#ff5a3c';
    for (const b of S.biters) if (biterVisible(b)) ctx.fillRect(b.x * TILE - 6, b.y * TILE - 6, 12, 12);
  } else {
    for (const e of visible) drawBuilding(ctx, e, e.x * TILE, e.y * TILE, time);
    for (const e of visible) drawItemsOn(ctx, e);
    drawWires(ctx, visible);
    if (multiBase()) {
      const me = myF() || 'f0';
      ctx.lineWidth = 2;
      for (const e of visible) {
        if (!isPlayer(e) || fOf(e) === me || e.type === 'road' || e.type === 'concrete_floor' || e.type === 'refined_floor') continue;
        const s = sizeOf(e.type) * TILE;
        ctx.strokeStyle = isFoeF(me, fOf(e)) ? 'rgba(229,83,75,0.85)' : teamColor(fOf(e));
        ctx.strokeRect(e.x * TILE + 1.5, e.y * TILE + 1.5, s - 3, s - 3);
      }
    }
    // Marca de Mk2 / Mk3 en la esquina
    ctx.font = '700 9px "Chakra Petch", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const e of visible) {
      if (!(e.mk > 1)) continue;
      const s = sizeOf(e.type), bx = (e.x + s) * TILE - 7, by = e.y * TILE + 7;
      ctx.fillStyle = e.mk === 3 ? '#b67cff' : '#5aa0ff'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(e.mk === 3 ? 'III' : 'II', bx, by + 0.5);
    }
    for (const b of S.biters) {
      if (b.x * TILE < vx0 - 20 || b.x * TILE > vx1 + 20 || b.y * TILE < vy0 - 20 || b.y * TILE > vy1 + 20 || !biterVisible(b)) continue;
      drawBiter(ctx, b, time);
    }
    drawWeapons(ctx, time);
  }
  drawAdventure(ctx, vx0, vy0, vx1, vy1, lod, time);
  drawTrains(ctx, lod);
  if (!lod && playerOn() && S.player.pet && !S.player.pet.gone) drawPet(ctx, S.player.pet, true);
  if (!lod && NET.on) for (const a of NET.avatars.values()) if (a.pet) drawPet(ctx, a.pet, true);
  if (!lod) drawPetHearts(ctx, rdt);
  drawVehicles(ctx, lod, time);
  if (playerOn()) drawPlayer(ctx, lod);
  if (NET.on) drawRemotePlayers(ctx, lod);
  if (!lod) drawGhostsAndRobots(ctx, vx0, vy0, vx1, vy1);
  drawEffects(ctx, rdt);
  drawShots(ctx);
  drawMarkers(ctx);

  // Cables de los postes
  ctx.lineWidth = lod ? 2 : 1.2;
  for (const big of [false, true]) {
    ctx.strokeStyle = big ? 'rgba(160,170,190,0.6)' : 'rgba(30,20,10,0.55)';
    ctx.beginPath();
    for (const [x1, y1, x2, y2, isBig] of wires) {
      if (!!isBig !== big) continue;
      const ax = x1 * TILE + TILE / 2, ay = y1 * TILE + 6, bx = x2 * TILE + TILE / 2, by = y2 * TILE + 6;
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 10, bx, by);
    }
    ctx.stroke();
  }

  if (showPollution) drawPollution(ctx, vx0, vy0, vx1, vy1);
  drawFog(ctx, vx0, vy0, vx1, vy1);
  return visible;
}

// Niebla: las celdas sin explorar se tapan, con un borde difuso
function drawFog(ctx, vx0, vy0, vx1, vy1) {
  const cs = POLL_CELL * TILE;
  const e = cs * 0.35;
  for (let cy = Math.max(0, Math.floor(vy0 / cs)); cy <= Math.min(PH - 1, Math.floor(vy1 / cs)); cy++) {
    for (let cx = Math.max(0, Math.floor(vx0 / cs)); cx <= Math.min(PW - 1, Math.floor(vx1 / cs)); cx++) {
      if (cellExplored(cx, cy)) continue;
      ctx.fillStyle = '#07090c';
      ctx.fillRect(cx * cs - 1, cy * cs - 1, cs + 2, cs + 2);
      // Borde suave hacia las celdas exploradas vecinas
      ctx.fillStyle = 'rgba(7,9,12,0.55)';
      if (cellExplored(cx - 1, cy)) ctx.fillRect(cx * cs - e, cy * cs, e, cs);
      if (cellExplored(cx + 1, cy)) ctx.fillRect((cx + 1) * cs, cy * cs, e, cs);
      if (cellExplored(cx, cy - 1)) ctx.fillRect(cx * cs, cy * cs - e, cs, e);
      if (cellExplored(cx, cy + 1)) ctx.fillRect(cx * cs, (cy + 1) * cs, cs, e);
    }
  }
}

function drawPollution(ctx, vx0, vy0, vx1, vy1) {
  const cs = POLL_CELL * TILE;
  for (let cy = Math.max(0, Math.floor(vy0 / cs)); cy <= Math.min(PH - 1, Math.floor(vy1 / cs)); cy++) {
    for (let cx = Math.max(0, Math.floor(vx0 / cs)); cx <= Math.min(PW - 1, Math.floor(vx1 / cs)); cx++) {
      const p = pollution[cy * PW + cx];
      if (p < 1) continue;
      ctx.fillStyle = `rgba(150,70,30,${Math.min(0.5, 0.06 + p / 300)})`;
      ctx.fillRect(cx * cs, cy * cs, cs, cs);
    }
  }
}

// Vistas previas: fantasmas de lo que se va a construir, áreas y marcas
function drawOverlays(ctx) {
  if (launchAnim) return;
  const pv = getPreview();
  if (pv.rect) {
    const r = pv.rect;
    ctx.fillStyle = r.fill;
    ctx.fillRect(r.x0 * TILE, r.y0 * TILE, (r.x1 - r.x0 + 1) * TILE, (r.y1 - r.y0 + 1) * TILE);
    ctx.strokeStyle = r.stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(r.x0 * TILE + 1, r.y0 * TILE + 1, (r.x1 - r.x0 + 1) * TILE - 2, (r.y1 - r.y0 + 1) * TILE - 2);
    ctx.setLineDash([]);
  }
  for (const gh of pv.ghosts) {
    const s = sizeOf(gh.type);
    const ghost = makeEntity(gh.type, gh.x, gh.y, gh.dir);
    if (gh.type === 'underground') ghost.mode = undergroundModeFor(gh.x, gh.y, gh.dir);
    if (gh.recipe) ghost.recipe = gh.recipe;
    ctx.globalAlpha = 0.55;
    drawBuilding(ctx, ghost, gh.x * TILE, gh.y * TILE, time);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = gh.ok ? '#5cc47a' : '#e5534b';
    ctx.lineWidth = 2;
    ctx.strokeRect(gh.x * TILE + 1, gh.y * TILE + 1, TILE * s - 2, TILE * s - 2);
    if (gh.type === 'lightningrod') {
      ctx.save();
      ctx.fillStyle = 'rgba(255,220,120,0.06)'; ctx.strokeStyle = 'rgba(255,220,120,0.55)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(gh.x * TILE + TILE / 2, gh.y * TILE + TILE / 2, ROD_RADIUS * TILE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (const e of S.entities) if (e.type === 'lightningrod' || e.type === 'hub') {
        const s2 = sizeOf(e.type) / 2;
        ctx.strokeStyle = 'rgba(255,220,120,0.3)';
        ctx.beginPath(); ctx.arc((e.x + s2) * TILE, (e.y + s2) * TILE, (e.type === 'hub' ? SHIP_ROD : ROD_RADIUS) * TILE, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    if (gh.type === 'antenna') {
      ctx.save();
      for (const n of signalNodes()) {
        ctx.fillStyle = 'rgba(127,209,255,0.07)'; ctx.strokeStyle = 'rgba(127,209,255,0.45)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(n.x * TILE, n.y * TILE, n.r * TILE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      const L = linkLevel();
      ctx.strokeStyle = 'rgba(255,230,120,0.7)';
      ctx.beginPath(); ctx.arc(gh.x * TILE + TILE / 2, gh.y * TILE + TILE / 2, ANTENNA_LINK[L] * TILE, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (kindOf(gh.type) === 'pole' || gh.type === 'bigpole') {
      const d = BUILDINGS[gh.type];
      ctx.strokeStyle = 'rgba(120,180,255,0.6)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(gh.x * TILE + TILE / 2, gh.y * TILE + TILE / 2, d.reach * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(80,160,255,0.18)';
      ctx.fillRect((gh.x - d.supply) * TILE, (gh.y - d.supply) * TILE, TILE * (d.supply * 2 + 1), TILE * (d.supply * 2 + 1));
    }
    if ((gh.type === 'miner' || gh.type === 'eminer') && pv.ghosts.length < 4) {
      const r = BUILDINGS[gh.type].area;
      ctx.strokeStyle = 'rgba(240,200,80,0.6)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect((gh.x - r) * TILE + 1, (gh.y - r) * TILE + 1, (r * 2 + 1) * TILE - 2, (r * 2 + 1) * TILE - 2);
      ctx.setLineDash([]);
    }
    if (gh.type === 'turret' || gh.type === 'laser' || gh.type === 'flameturret' || gh.type === 'artillery' || gh.type === 'beacon') {
      ctx.strokeStyle = gh.type === 'beacon' ? 'rgba(120,170,255,0.6)' : 'rgba(255,120,90,0.5)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(gh.x * TILE + TILE * s / 2, gh.y * TILE + TILE * s / 2, (BUILDINGS[gh.type].range + (gh.type === 'beacon' ? 1 : 0)) * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (gh.type === 'underground' && pv.ghosts.length === 1) {
      const [dx, dy] = DIRS[gh.dir];
      ctx.fillStyle = 'rgba(201,138,46,0.18)';
      for (let k = 1; k <= UNDERGROUND_REACH + 1; k++) ctx.fillRect((gh.x + dx * k) * TILE, (gh.y + dy * k) * TILE, TILE, TILE);
    }
  }
  for (const m of pv.marks) {
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 3;
    const s = (m.size || 1) * TILE;
    ctx.strokeRect(m.x * TILE + 1.5, m.y * TILE + 1.5, s - 3, s - 3);
  }
  // Alcance del personaje al elegir algo para construir
  if (playerOn() && (BUILDINGS[tool] || tool === 'delete' || tool === 'paste')) {
    const p = S.player;
    g_reach(ctx, p);
  }
  if (handMining) {
    const { x, y, prog } = handMining;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x * TILE + 3, y * TILE - 8, TILE - 6, 5);
    ctx.fillStyle = '#f0a742';
    ctx.fillRect(x * TILE + 3, y * TILE - 8, (TILE - 6) * Math.min(1, prog / (handMining.tree ? CHOP_TIME : HAND_MINE_TIME)), 5);
  }
  if (NET.on || (S.markers && S.markers.some((m) => m.ping))) drawFriendArrows(ctx);
}

// Amigos fuera de la pantalla: una flecha de su color en el borde, con su nombre y a cuántas casillas está
function drawFriendArrows(g) {
  g.save();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Zona libre de la pantalla (sin la barra de arriba, la de abajo ni el panel del costado)
  const side = $('side'), sr = side && document.body.classList.contains('side-open') ? side.getBoundingClientRect() : null;
  const L = 30, T = 80, R = (sr && sr.width > 0 && sr.left > cw * 0.5 ? sr.left : cw) - 30, B = ch - 130;
  const ccx = (L + R) / 2, ccy = (T + B) / 2;
  const pings = (S.markers || []).filter((m) => m.ping && m.by !== (NET.nick || null)).map((m) => ({ x: m.x, y: m.y, nick: '📣 ' + (m.by || 'Llamado'), by: null, ping: true }));
  const list = NET.on ? [...NET.avatars.values(), ...pings] : pings;
  for (const a of list) {
    const dx = wdx(a.x - view.x / TILE) * TILE * view.zoom, dy = wdy(a.y - view.y / TILE) * TILE * view.zoom;
    const sx = cw / 2 + dx, sy = ch / 2 + dy;
    if (sx > L && sx < R && sy > T && sy < B) continue;
    const ddx = sx - ccx, ddy = sy - ccy;
    const k = Math.min((R - L) / 2 / Math.max(1e-6, Math.abs(ddx)), (B - T) / 2 / Math.max(1e-6, Math.abs(ddy)));
    const x = ccx + ddx * k, y = ccy + ddy * k, ang = Math.atan2(ddy, ddx);
    const col = a.ping ? '#ffd34d' : netColor(a.by);
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-6, -10); g.lineTo(-2, 0); g.lineTo(-6, 10); g.closePath(); g.fill(); g.stroke();
    g.restore();
    const pr = a.by && NET.profiles[a.by];
    const dist = playerOn() ? Math.round(wdist(S.player.x, S.player.y, a.x, a.y)) : null;
    const label = (a.nick || (pr && pr.name) || 'Jugador').slice(0, 14) + (dist != null ? ` · ${dist}` : '');
    g.font = '700 12px Barlow, system-ui, sans-serif'; g.textBaseline = 'middle';
    const tw = g.measureText(label).width;
    const lx = Math.max(4, Math.min(cw - tw - 4, x - Math.cos(ang) * 22 - tw / 2)), ly = Math.max(10, Math.min(ch - 10, y - Math.sin(ang) * 22));
    g.fillStyle = 'rgba(15,18,22,0.8)'; rrect(g, lx - 4, ly - 9, tw + 8, 18, 6); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(label, lx, ly);
  }
  g.restore();
}

function g_reach(g, p) {
  g.strokeStyle = 'rgba(255,211,77,0.35)';
  g.lineWidth = 2;
  g.setLineDash([10, 8]);
  g.beginPath(); g.arc(p.x * TILE, p.y * TILE, REACH * TILE, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
}

// --------------------------- Despegue ---------------------------

function startLaunch(yard) {
  netPush({ k: 'L', x: yard.x, y: yard.y });
  launchAnim = { yard, t: 0 };
  sfx('launch');
  const h = sizeOf(yard.type) / 2;
  view.x = (yard.x + h) * TILE;
  view.y = (yard.y + h) * TILE;
  view.zoom = Math.max(view.zoom, 0.8);
}

function updateLaunch(dt) {
  if (!launchAnim) return;
  launchAnim.t += dt;
  const a = launchAnim, y = a.yard;
  const lift = a.t > 2 ? Math.pow(a.t - 2, 2.2) * 40 : 0;
  const hs = sizeOf(y.type);
  const bx = (y.x + hs / 2) * TILE, by = (y.y + hs) * TILE - 26 - lift;
  if (a.t > 0.5) {
    for (let i = 0; i < 4; i++) {
      particles.push({ x: bx + (Math.random() - 0.5) * 30, y: by + 20, vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 80, life: 1.5 + Math.random() });
    }
  }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.life -= dt; }
  while (particles.length && particles[0].life <= 0) particles.shift();
  if (a.t > 2) view.y = Math.max(by - 60, (y.y + hs / 2) * TILE - 400);
  if (a.t > 8) {
    launchAnim = null;
    particles.length = 0;
    for (const k in y.parts) y.parts[k] = 0;
    if (y.type === 'starport') {
      S.arkLaunched = (S.arkLaunched || 0) + 1;
      if (stageOf() < 4) { S.stage = 4; S.stageTimes = S.stageTimes || {}; S.stageTimes[3] = S.playTime; }
      save();
      showWin(true);
    } else {
      S.launched = (S.launched || 0) + 1;
      if (!S.launchTime) S.launchTime = S.playTime;
      if (stageOf() === 1) advanceStage(2); else showWin(false);
      save();
    }
  }
}

function drawLaunch(ctx) {
  if (!launchAnim) return;
  const a = launchAnim, y = a.yard;
  for (const p of particles) {
    ctx.fillStyle = `rgba(210,210,210,${Math.max(0, p.life / 2.5) * 0.6})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 6 + (2.5 - p.life) * 10, 0, Math.PI * 2); ctx.fill();
  }
  const lift = a.t > 2 ? Math.pow(a.t - 2, 2.2) * 40 : 0;
  const hs = sizeOf(y.type);
  drawShip(ctx, (y.x + hs / 2) * TILE, (y.y + hs) * TILE - 26 - lift, 0.95, 1, a.t > 0.5, time, y.type === 'starport');
  if (a.t > 6.5) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (a.t - 6.5) / 1.5)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// --------------------------- Minimapa ---------------------------

let fogCanvas = null;
// Zoom del minimapa: 1 = todo el planeta; más alto = más cerca, centrado en tu personaje
const MINI_ZOOMS = [1, 3, 6, 12, 24, 48];
let miniZoom = 12;
try { const z = +localStorage.getItem('mini-fabrica-minizoom2'); if (MINI_ZOOMS.includes(z)) miniZoom = z; } catch (_) { /* nada */ }
let miniLock = null;   // mientras arrastrás el dedo en el minimapa, no se corre
function miniCenter() {
  if (miniLock) return miniLock;
  if (miniZoom === 1) return { x: W / 2, y: H / 2 };
  if (playerOn() && followCam) return { x: S.player.x, y: S.player.y };
  return { x: wrapX(view.x / TILE), y: wrapY(view.y / TILE) };
}
// Casilla del mapa → píxel del minimapa (y al revés, para tocarlo)
function miniView(mc) {
  const c = miniCenter(), k = (mc.width / W) * miniZoom;
  return { c, k, px: (x) => mc.width / 2 + wdx(x - c.x) * k, py: (y) => mc.height / 2 + wdy(y - c.y) * k };
}
function renderMinimap(mc) {
  const g = mc.getContext('2d');
  const v = miniView(mc), k = v.k;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#07090c'; g.fillRect(0, 0, mc.width, mc.height);
  g.imageSmoothingEnabled = false;
  // El mapa da la vuelta: se dibuja también al lado para que no se vea el borde
  const tiled = (img, dw, dh) => {
    for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
      const x0 = mc.width / 2 + (ox * W - v.c.x) * k, y0 = mc.height / 2 + (oy * H - v.c.y) * k;
      if (x0 > mc.width || y0 > mc.height || x0 + dw * k < 0 || y0 + dh * k < 0) continue;
      g.drawImage(img, x0, y0, dw * k, dh * k);
    }
  };
  tiled(pixelMap, W, H);
  if (showPollution) {
    for (let i = 0; i < pollution.length; i++) {
      const p = pollution[i];
      if (p < 1) continue;
      g.fillStyle = `rgba(150,70,30,${Math.min(0.6, 0.1 + p / 250)})`;
      g.fillRect(v.px((i % PW) * POLL_CELL), v.py(Math.floor(i / PW) * POLL_CELL), POLL_CELL * k, POLL_CELL * k);
    }
  }
  // Niebla: una imagen chiquita (una celda = un píxel) que se estira
  if (!fogCanvas || fogCanvas.width !== PW || fogCanvas.height !== PH) { fogCanvas = document.createElement('canvas'); fogCanvas.width = PW; fogCanvas.height = PH; }
  const fg = fogCanvas.getContext('2d'), img = fg.createImageData(PW, PH), px = img.data;
  for (let i = 0; i < explored.length; i++) if (!explored[i]) { px[i * 4] = 7; px[i * 4 + 1] = 9; px[i * 4 + 2] = 12; px[i * 4 + 3] = 255; }
  fg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = miniZoom > 3;
  tiled(fogCanvas, PW * POLL_CELL, PH * POLL_CELL);
  g.imageSmoothingEnabled = false;
  const inside = (x, y, m = 8) => x > -m && y > -m && x < mc.width + m && y < mc.height + m;
  for (const e of S.entities) {
    const s = sizeOf(e.type);
    if (isEnemyB(e) && !tileExplored(e.x, e.y)) continue;
    const x = v.px(e.x), y = v.py(e.y);
    if (!inside(x, y)) continue;
    g.fillStyle = e.type === 'nest' ? '#ff3b3b' : e.type === 'worm' ? '#ff8a3b' : multiBase() && fOf(e) !== (myF() || 'f0') ? (isFoeF(myF(), fOf(e)) ? '#ff5a5a' : teamColor(fOf(e))) : TYPE_COLOR[e.type] || '#fff';
    g.fillRect(x, y, Math.max(1.5, s * k), Math.max(1.5, s * k));
  }
  // Aventura: ruinas sin saquear, guaridas con jefe y tu mochila perdida
  if (S.character && S.ruins) {
    for (const r of S.ruins) if (!r.looted && tileExplored(r.x, r.y)) { g.fillStyle = r.pod ? '#ff9a5c' : '#7ef0ff'; g.fillRect(v.px(r.x) - 2, v.py(r.y) - 2, 4, 4); }
    for (const l of S.lairs) if (tileExplored(l.x, l.y)) { g.fillStyle = l.alive ? '#ff3b6b' : '#7a4a55'; g.beginPath(); g.arc(v.px(l.x), v.py(l.y), 4, 0, Math.PI * 2); g.fill(); }
    if (playerOn() && S.player.bag) { g.fillStyle = '#ffd34d'; g.fillRect(v.px(S.player.bag.x) - 3, v.py(S.player.bag.y) - 3, 6, 6); }
  }
  g.fillStyle = '#ffffff';
  for (const t of S.trains) g.fillRect(v.px(t.x) - 1.5, v.py(t.y) - 1.5, 3, 3);
  for (const vh of S.vehicles || []) { g.fillStyle = VEHICLES[vh.type].color; g.fillRect(v.px(vh.x) - 3, v.py(vh.y) - 3, 6, 6); g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(v.px(vh.x) - 3, v.py(vh.y) - 3, 6, 6); }
  g.fillStyle = '#ff7a5c';
  for (const b of S.biters) if (b.state === 'attack' && tileExplored(Math.floor(b.x), Math.floor(b.y))) g.fillRect(v.px(b.x) - 1, v.py(b.y) - 1, 2, 2);
  // Recuadro de lo que ves en pantalla
  const vw = cw / view.zoom / TILE, vh = ch / view.zoom / TILE;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 1;
  g.strokeRect(v.px(wrapX(view.x / TILE) - vw / 2) + 0.5, v.py(wrapY(view.y / TILE) - vh / 2) + 0.5, vw * k, vh * k);
  // Tus amigos: un punto de su color con su nombre (si están fuera del minimapa, en el borde)
  g.font = '700 15px Barlow, system-ui, sans-serif'; g.textBaseline = 'middle';
  if (NET.on) for (const a of NET.avatars.values()) {
    const col = netColor(a.by);
    let x = v.px(a.x), y = v.py(a.y);
    const out = !inside(x, y, -6);
    x = Math.max(6, Math.min(mc.width - 6, x)); y = Math.max(6, Math.min(mc.height - 6, y));
    g.fillStyle = col; g.strokeStyle = '#0b0d10'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, out ? 4 : 5, 0, Math.PI * 2); g.fill(); g.stroke();
    const pr = a.by && NET.profiles[a.by];
    const name = (a.nick || (pr && pr.name) || 'Jugador').slice(0, 12);
    const tw = g.measureText(name).width;
    const tx = Math.max(2, Math.min(mc.width - tw - 2, x + 8 > mc.width - tw ? x - tw - 8 : x + 8));
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.textAlign = 'left';
    g.strokeText(name, tx, y); g.fillStyle = '#fff'; g.fillText(name, tx, y);
  }
  drawMarkersMini(g, v, inside);
  // Vos, arriba de todo, con flechita hacia donde mirás
  if (playerOn()) {
    const x = v.px(S.player.x), y = v.py(S.player.y);
    g.save(); g.translate(x, y); g.rotate(S.player.ang || 0);
    g.fillStyle = '#ffd34d'; g.strokeStyle = '#0b0d10'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -5); g.lineTo(-2.5, 0); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  const zl = $('mini-zoom-label');
  if (zl) zl.textContent = miniZoom === 1 ? 'Todo' : '×' + miniZoom;
}
function setMiniZoom(d) {
  const i = Math.max(0, Math.min(MINI_ZOOMS.length - 1, MINI_ZOOMS.indexOf(miniZoom) + d));
  miniZoom = MINI_ZOOMS[i];
  try { localStorage.setItem('mini-fabrica-minizoom2', miniZoom); } catch (_) { /* nada */ }
  renderMinimap($('minimap'));
}
