'use strict';
// =====================================================================
//  Datos del juego: objetos, recetas, edificios, investigación y nave.
//  Este archivo es el lugar para ajustar el balance.
// =====================================================================

const TILE = 32;
const W = 320, H = 240;                           // tamaño del mapa en casillas
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];  // derecha, abajo, izquierda, arriba
const DIR_ARROWS = ['→', '↓', '←', '↑'];
const SAVE_KEY = 'mini-fabrica-v3';
const SAVE_VERSION = 3;

// shape: cómo se dibuja el objeto
const ITEMS = {
  iron_ore:       { name: 'Mineral de hierro',  color: '#7d8fa6', shape: 'ore' },
  copper_ore:     { name: 'Mineral de cobre',   color: '#c8763f', shape: 'ore' },
  coal:           { name: 'Carbón',             color: '#2b2b2b', shape: 'ore' },
  stone:          { name: 'Piedra',             color: '#b5a68a', shape: 'ore' },
  quartz:         { name: 'Cuarzo',             color: '#e9e3f7', shape: 'ore' },
  titanium_ore:   { name: 'Mineral de titanio', color: '#4fb3a4', shape: 'ore' },
  oil:            { name: 'Petróleo crudo',     color: '#3b2a20', shape: 'barrel' },

  iron_plate:     { name: 'Placa de hierro',    color: '#d6dee8', shape: 'plate' },
  copper_plate:   { name: 'Placa de cobre',     color: '#f29a5c', shape: 'plate' },
  brick:          { name: 'Ladrillo',           color: '#b5543a', shape: 'plate' },
  steel:          { name: 'Acero',              color: '#7c8794', shape: 'plate' },
  silicon:        { name: 'Silicio',            color: '#5b5f9e', shape: 'plate' },
  titanium_plate: { name: 'Placa de titanio',   color: '#86e0d2', shape: 'plate' },
  plastic:        { name: 'Plástico',           color: '#f3f1ea', shape: 'plate' },
  sulfur:         { name: 'Azufre',             color: '#e6d23a', shape: 'ore' },

  gear:           { name: 'Engranaje',          color: '#9aa7b5', shape: 'gear' },
  cable:          { name: 'Cable de cobre',     color: '#e8873a', shape: 'cable' },
  circuit:        { name: 'Circuito',           color: '#3fae5a', shape: 'chip' },
  processor:      { name: 'Procesador',         color: '#c0392b', shape: 'chip' },
  engine:         { name: 'Motor',              color: '#6c7a89', shape: 'part' },
  battery:        { name: 'Batería',            color: '#d4b13c', shape: 'battery' },
  solid_fuel:     { name: 'Combustible sólido', color: '#7a5a2e', shape: 'fuel' },
  rocket_fuel:    { name: 'Combustible de cohete', color: '#ff8a1f', shape: 'fuel' },
  ammo:           { name: 'Munición',           color: '#c9a227', shape: 'ammo' },

  sci_red:        { name: 'Ciencia roja',       color: '#e0473b', shape: 'flask' },
  sci_green:      { name: 'Ciencia verde',      color: '#4cc25a', shape: 'flask' },
  sci_blue:       { name: 'Ciencia azul',       color: '#3f86e0', shape: 'flask' },
  sci_purple:     { name: 'Ciencia espacial',   color: '#b45fe0', shape: 'flask' },

  hull:           { name: 'Placa de casco',     color: '#cfd6dd', shape: 'part' },
  thruster:       { name: 'Propulsor',          color: '#e5533d', shape: 'part' },
  nav_computer:   { name: 'Computadora de navegación', color: '#3d8fd6', shape: 'chip' },
  life_support:   { name: 'Soporte vital',      color: '#3cc47c', shape: 'part' },
};
const ITEM_ORDER = Object.keys(ITEMS);
const PACKS = ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'];

// Recursos del mapa (el índice es el id guardado en el mapa)
const ORE_IDS = [null, 'iron_ore', 'copper_ore', 'coal', 'stone', 'quartz', 'titanium_ore', 'oil'];
const ORE_GROUND = {
  iron_ore: '#3c4655', copper_ore: '#553826', coal: '#1b1d1c', stone: '#5b5444',
  quartz: '#6a6680', titanium_ore: '#1f4a45', oil: '#151012',
};

// Combustibles
const FUELS = { coal: 4000, solid_fuel: 12000 };   // kJ (generador)
const FURNACE_FUEL = { coal: 8, solid_fuel: 24 };  // fundiciones por unidad (horno de piedra)

// Horno: entra `n` del material y sale 1 producto
const SMELT = {
  iron_ore:     { out: 'iron_plate',     n: 1, time: 2 },
  copper_ore:   { out: 'copper_plate',   n: 1, time: 2 },
  stone:        { out: 'brick',          n: 2, time: 2.5 },
  iron_plate:   { out: 'steel',          n: 5, time: 8, tech: 'steel' },
  quartz:       { out: 'silicon',        n: 1, time: 3, tech: 'silicon' },
  titanium_ore: { out: 'titanium_plate', n: 2, time: 4, tech: 'titanium' },
};

// Recetas de máquinas. machine: asm (ensambladoras) o chem (planta química).
// tier 2 = solo en la Ensambladora avanzada
const RECIPES = {
  gear:         { machine: 'asm',  tier: 1, in: { iron_plate: 2 },                          out: 'gear',         n: 1, time: 1 },
  sci_red:      { machine: 'asm',  tier: 1, in: { copper_plate: 1, gear: 1 },               out: 'sci_red',      n: 1, time: 5 },
  cable:        { machine: 'asm',  tier: 1, in: { copper_plate: 1 },                        out: 'cable',        n: 2, time: 0.5, tech: 'electronics' },
  circuit:      { machine: 'asm',  tier: 1, in: { iron_plate: 1, cable: 3 },                out: 'circuit',      n: 1, time: 1.5, tech: 'electronics' },
  ammo:         { machine: 'asm',  tier: 1, in: { iron_plate: 4 },                          out: 'ammo',         n: 1, time: 1,   tech: 'defense' },
  sci_green:    { machine: 'asm',  tier: 1, in: { circuit: 1, gear: 2 },                    out: 'sci_green',    n: 1, time: 6,   tech: 'logistic_science' },
  solid_fuel:   { machine: 'asm',  tier: 1, in: { coal: 4 },                                out: 'solid_fuel',   n: 1, time: 2,   tech: 'electricity' },
  engine:       { machine: 'asm',  tier: 2, in: { steel: 1, gear: 2 },                      out: 'engine',       n: 1, time: 5,   tech: 'advanced_assembly' },
  processor:    { machine: 'asm',  tier: 2, in: { circuit: 2, silicon: 1, plastic: 2 },     out: 'processor',    n: 1, time: 6,   tech: 'silicon' },
  sci_blue:     { machine: 'asm',  tier: 2, in: { engine: 1, processor: 1, sulfur: 1 },     out: 'sci_blue',     n: 2, time: 12,  tech: 'chemical_science' },
  sci_purple:   { machine: 'asm',  tier: 2, in: { titanium_plate: 2, processor: 1, battery: 1 }, out: 'sci_purple', n: 1, time: 15, tech: 'space_science' },
  hull:         { machine: 'asm',  tier: 2, in: { titanium_plate: 4, steel: 2 },            out: 'hull',         n: 1, time: 8,   tech: 'titanium' },
  thruster:     { machine: 'asm',  tier: 2, in: { engine: 2, titanium_plate: 2, processor: 1 }, out: 'thruster', n: 1, time: 10,  tech: 'rocketry' },
  nav_computer: { machine: 'asm',  tier: 2, in: { processor: 4, circuit: 4 },               out: 'nav_computer', n: 1, time: 12,  tech: 'rocketry' },
  life_support: { machine: 'asm',  tier: 2, in: { processor: 2, steel: 2, battery: 2 },     out: 'life_support', n: 1, time: 12,  tech: 'rocketry' },
  plastic:      { machine: 'chem', tier: 1, in: { oil: 1, coal: 1 },                       out: 'plastic',      n: 2, time: 2,   tech: 'oil' },
  sulfur:       { machine: 'chem', tier: 1, in: { oil: 2 },                                 out: 'sulfur',       n: 1, time: 1.5, tech: 'oil' },
  battery:      { machine: 'chem', tier: 1, in: { sulfur: 1, iron_plate: 1, copper_plate: 1 }, out: 'battery',  n: 1, time: 4,   tech: 'batteries' },
  rocket_fuel:  { machine: 'chem', tier: 1, in: { solid_fuel: 4, oil: 2 },                  out: 'rocket_fuel',  n: 1, time: 8,   tech: 'rocketry' },
};
const RECIPE_ORDER = Object.keys(RECIPES);

// Edificios.
// size: lado en casillas · power: consumo en kW · poll: polución por minuto trabajando
// hp: vida · tech: investigación que lo desbloquea (sin tech = disponible desde el inicio)
const BUILDINGS = {
  belt:        { name: 'Cinta',               cat: 'logística', speed: 2, hp: 60,  cost: { iron_plate: 1 },
                 desc: 'Mueve objetos hacia donde apunta.' },
  fastbelt:    { name: 'Cinta rápida',        cat: 'logística', speed: 4, hp: 80,  cost: { iron_plate: 1, gear: 2 }, tech: 'logistics2',
                 desc: 'Cinta al doble de velocidad.' },
  expressbelt: { name: 'Cinta exprés',        cat: 'logística', speed: 8, hp: 100, cost: { steel: 1, gear: 2 }, tech: 'logistics3',
                 desc: 'Cinta al cuádruple de velocidad.' },
  underground: { name: 'Cinta subterránea',   cat: 'logística', speed: 4, hp: 120, cost: { iron_plate: 6, gear: 4 }, tech: 'logistics',
                 desc: 'Pasa por debajo de hasta 5 casillas. Poné la entrada y después la salida en la misma dirección.' },
  splitter:    { name: 'Divisor',             cat: 'logística', hp: 120, cost: { iron_plate: 5, gear: 4 }, tech: 'logistics',
                 desc: 'Reparte objetos entre adelante, izquierda y derecha.' },
  sorter:      { name: 'Filtro',              cat: 'logística', hp: 120, cost: { iron_plate: 5, circuit: 4 }, tech: 'sorting',
                 desc: 'El objeto elegido sigue derecho; el resto sale por los costados.' },
  chest:       { name: 'Cofre',               cat: 'logística', hp: 150, cost: { iron_plate: 8 },
                 desc: 'Guarda hasta 200 objetos y los va soltando por la flecha.' },

  miner:       { name: 'Taladro',             cat: 'producción', time: 2, hp: 150, poll: 12, cost: { iron_plate: 10, stone: 5 },
                 desc: 'Va sobre mineral. Extrae 1 cada 2 s.' },
  eminer:      { name: 'Taladro eléctrico',   cat: 'producción', time: 0.8, power: 90, hp: 200, poll: 10, cost: { iron_plate: 10, gear: 5, circuit: 3 }, tech: 'electricity',
                 desc: 'Extrae 1 cada 0,8 s. Usa 90 kW.' },
  pumpjack:    { name: 'Bomba de petróleo',   cat: 'producción', time: 1, power: 90, hp: 200, poll: 10, cost: { steel: 5, gear: 10, circuit: 5 }, tech: 'oil',
                 desc: 'Va sobre un pozo de petróleo. Saca 1 barril por segundo. Usa 90 kW.' },
  furnace:     { name: 'Horno de piedra',     cat: 'producción', speed: 1, hp: 200, poll: 3, cost: { stone: 5 },
                 desc: 'Funde minerales. Quema carbón o combustible sólido.' },
  efurnace:    { name: 'Horno eléctrico',     cat: 'producción', speed: 2, power: 180, hp: 300, poll: 1, cost: { steel: 10, circuit: 5, brick: 10 }, tech: 'electric_smelting',
                 desc: 'Funde al doble de velocidad y sin combustible. Usa 180 kW.' },
  assembler:   { name: 'Ensambladora',        cat: 'producción', speed: 1, tier: 1, machine: 'asm', hp: 200, poll: 4, cost: { iron_plate: 15, copper_plate: 10 },
                 desc: 'Fabrica piezas simples.' },
  assembler2:  { name: 'Ensambladora avanzada', cat: 'producción', speed: 2, tier: 2, machine: 'asm', power: 200, hp: 300, poll: 3, cost: { steel: 10, circuit: 10, gear: 10 }, tech: 'advanced_assembly',
                 desc: 'Fabrica cualquier receta al doble de velocidad. Usa 200 kW.' },
  chem:        { name: 'Planta química',      cat: 'producción', speed: 1, tier: 1, machine: 'chem', power: 210, hp: 300, poll: 4, cost: { steel: 5, gear: 5, circuit: 5 }, tech: 'oil',
                 desc: 'Procesa petróleo: plástico, azufre, baterías y combustible de cohete. Usa 210 kW.' },
  lab:         { name: 'Laboratorio',         cat: 'producción', speed: 1, hp: 150, cost: { iron_plate: 10, gear: 10, copper_plate: 10 },
                 desc: 'Investiga usando packs de ciencia. Más laboratorios, más rápido.' },

  pole:        { name: 'Poste eléctrico',     cat: 'energía', reach: 7, supply: 2, hp: 80, cost: { iron_plate: 2, copper_plate: 2 }, tech: 'electricity',
                 desc: 'Conecta con postes a 7 casillas y alimenta lo que esté a 2 casillas.' },
  bigpole:     { name: 'Torre de alta tensión', cat: 'energía', reach: 24, supply: 1, hp: 150, cost: { steel: 5, copper_plate: 5 }, tech: 'big_poles',
                 desc: 'Lleva energía lejos: conecta a 24 casillas.' },
  generator:   { name: 'Generador a carbón',  cat: 'energía', output: 900, hp: 300, poll: 25, cost: { iron_plate: 20, brick: 10, gear: 5 }, tech: 'electricity',
                 desc: 'Quema carbón o combustible sólido y genera hasta 900 kW.' },
  solar:       { name: 'Panel solar',         cat: 'energía', output: 60, hp: 150, cost: { silicon: 10, steel: 5, copper_plate: 10 }, tech: 'solar',
                 desc: 'Genera 60 kW de día, 30 kW al atardecer y al amanecer, y nada de noche.' },
  accumulator: { name: 'Acumulador',          cat: 'energía', capacity: 5000, rate: 300, hp: 150, cost: { battery: 5, iron_plate: 2 }, tech: 'batteries',
                 desc: 'Guarda 5 MJ cuando sobra energía y la devuelve cuando falta (hasta 300 kW).' },
  lamp:        { name: 'Lámpara',             cat: 'energía', power: 5, hp: 60, cost: { iron_plate: 1, circuit: 1, cable: 3 }, tech: 'electricity',
                 desc: 'Ilumina de noche. Usa 5 kW.' },

  wall:        { name: 'Muro',                cat: 'defensa', hp: 350, cost: { brick: 5 }, tech: 'defense',
                 desc: 'Frena a los enemigos.' },
  turret:      { name: 'Torreta',             cat: 'defensa', range: 9, rate: 5, dmg: 5, hp: 400, cost: { iron_plate: 10, gear: 10, copper_plate: 10 }, tech: 'defense',
                 desc: 'Dispara a enemigos a 9 casillas. Usa munición (por cinta o desde su panel).' },
  laser:       { name: 'Torreta láser',       cat: 'defensa', range: 12, rate: 2, dmg: 18, power: 400, hp: 600, cost: { steel: 20, circuit: 20, battery: 12 }, tech: 'laser_turrets',
                 desc: 'Dispara con electricidad a 12 casillas. Usa 400 kW al disparar.' },

  shipyard:    { name: 'Astillero',           cat: 'nave', size: 5, hp: 3000, cost: { steel: 200, brick: 200, processor: 50 }, tech: 'rocketry',
                 desc: 'Acá se arma la nave. Recibe las piezas por cinta o desde el inventario.' },
};
const TOOL_ORDER = Object.keys(BUILDINGS);
const NO_DIR = new Set(['pole', 'bigpole', 'solar', 'accumulator', 'lamp', 'wall', 'turret', 'laser', 'shipyard', 'hub', 'nest', 'lab']);
const BELTS = new Set(['belt', 'fastbelt', 'expressbelt']);
const UNDERGROUND_REACH = 5;

// Investigación: los laboratorios consumen 1 de cada pack por unidad
const TECHS = {
  electronics:       { name: 'Electrónica',          packs: ['sci_red'], units: 15, time: 8, req: [],
                       desc: 'Cables y circuitos.' },
  logistics:         { name: 'Logística',            packs: ['sci_red'], units: 20, time: 8, req: [],
                       desc: 'Divisor y cinta subterránea.' },
  defense:           { name: 'Defensa',              packs: ['sci_red'], units: 20, time: 8, req: [],
                       desc: 'Muros, torretas y munición.' },
  steel:             { name: 'Acero',                packs: ['sci_red'], units: 30, time: 8, req: [],
                       desc: 'El horno convierte 5 placas de hierro en 1 de acero.' },
  logistic_science:  { name: 'Ciencia verde',        packs: ['sci_red'], units: 40, time: 8, req: ['electronics'],
                       desc: 'Receta del pack de ciencia verde.' },
  electricity:       { name: 'Electricidad',         packs: ['sci_red', 'sci_green'], units: 40, time: 12, req: ['steel', 'logistic_science'],
                       desc: 'Generador, postes, taladro eléctrico, lámparas y combustible sólido.' },
  sorting:           { name: 'Clasificación',        packs: ['sci_red', 'sci_green'], units: 30, time: 12, req: ['logistics', 'logistic_science'],
                       desc: 'Filtro para separar objetos de una cinta mezclada.' },
  logistics2:        { name: 'Logística 2',          packs: ['sci_red', 'sci_green'], units: 60, time: 12, req: ['logistics', 'logistic_science'],
                       desc: 'Cinta rápida.' },
  weapons1:          { name: 'Armas 1',              packs: ['sci_red', 'sci_green'], units: 50, time: 12, req: ['defense', 'logistic_science'],
                       desc: '+30 % de daño en torretas.' },
  electric_smelting: { name: 'Fundición eléctrica',  packs: ['sci_red', 'sci_green'], units: 75, time: 12, req: ['electricity'],
                       desc: 'Horno eléctrico: el doble de rápido y sin combustible.' },
  advanced_assembly: { name: 'Ensamblaje avanzado',  packs: ['sci_red', 'sci_green'], units: 75, time: 12, req: ['electricity'],
                       desc: 'Ensambladora avanzada y motores.' },
  big_poles:         { name: 'Alta tensión',         packs: ['sci_red', 'sci_green'], units: 50, time: 12, req: ['electricity'],
                       desc: 'Torres que llevan energía a 24 casillas.' },
  oil:               { name: 'Petróleo',             packs: ['sci_red', 'sci_green'], units: 100, time: 15, req: ['advanced_assembly'],
                       desc: 'Bomba de petróleo, planta química, plástico y azufre.' },
  solar:             { name: 'Energía solar',        packs: ['sci_red', 'sci_green'], units: 100, time: 15, req: ['silicon'],
                       desc: 'Paneles solares.' },
  silicon:           { name: 'Electrónica avanzada', packs: ['sci_red', 'sci_green'], units: 100, time: 15, req: ['oil'],
                       desc: 'Silicio a partir de cuarzo, y procesadores.' },
  chemical_science:  { name: 'Ciencia azul',         packs: ['sci_red', 'sci_green'], units: 75, time: 15, req: ['silicon'],
                       desc: 'Receta del pack de ciencia azul.' },
  batteries:         { name: 'Baterías',             packs: ['sci_red', 'sci_green', 'sci_blue'], units: 75, time: 20, req: ['chemical_science'],
                       desc: 'Baterías y acumuladores.' },
  logistics3:        { name: 'Logística 3',          packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['logistics2', 'chemical_science'],
                       desc: 'Cinta exprés.' },
  weapons2:          { name: 'Armas 2',              packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['weapons1', 'chemical_science'],
                       desc: '+50 % más de daño en torretas.' },
  laser_turrets:     { name: 'Torretas láser',       packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['batteries', 'defense'],
                       desc: 'Torretas que no necesitan munición.' },
  titanium:          { name: 'Metalurgia de titanio', packs: ['sci_red', 'sci_green', 'sci_blue'], units: 150, time: 20, req: ['chemical_science'],
                       desc: 'Placas de titanio y placas de casco.' },
  space_science:     { name: 'Ciencia espacial',     packs: ['sci_red', 'sci_green', 'sci_blue'], units: 200, time: 25, req: ['titanium', 'batteries'],
                       desc: 'Receta del pack de ciencia espacial.' },
  rocketry:          { name: 'Cohetería',            packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'], units: 300, time: 30, req: ['space_science'],
                       desc: 'Astillero, propulsores, navegación, soporte vital y combustible de cohete.' },
};
const TECH_ORDER = Object.keys(TECHS);

// Eras: se avanza al investigar ciertas tecnologías
const ERAS = [
  { name: 'Era mecánica',  tech: null },
  { name: 'Era eléctrica', tech: 'electricity' },
  { name: 'Era química',   tech: 'oil' },
  { name: 'Era espacial',  tech: 'space_science' },
];

// Lo que necesita la nave para despegar
const SHIP = { hull: 50, thruster: 16, nav_computer: 8, life_support: 10, rocket_fuel: 120 };

// Día y noche: duración del ciclo y luz solar por tramo
const DAY_LENGTH = 480; // segundos
const DAY_PHASES = [
  { until: 0.50, name: 'Día',       icon: '☀️', sun: 1,   dark: 0 },
  { until: 0.60, name: 'Atardecer', icon: '🌇', sun: 0.5, dark: 0.35 },
  { until: 0.85, name: 'Noche',     icon: '🌙', sun: 0,   dark: 0.72 },
  { until: 1.00, name: 'Amanecer',  icon: '🌅', sun: 0.5, dark: 0.35 },
];

// Enemigos
const POLL_CELL = 8;                               // casillas por celda de polución
const PW = Math.ceil(W / POLL_CELL), PH = Math.ceil(H / POLL_CELL);
const BITERS = {
  small:  { name: 'Bicho chico',   hp: 15,  dmg: 7,  speed: 1.6, cost: 4,  size: 5,  color: '#b5803a' },
  medium: { name: 'Bicho mediano', hp: 80,  dmg: 15, speed: 1.4, cost: 20, size: 7,  color: '#8b4f9e' },
  big:    { name: 'Bicho grande',  hp: 380, dmg: 35, speed: 1.2, cost: 80, size: 10, color: '#4f6e3a' },
};
const NEST_HP = 400;
const SAFE_RADIUS = 55; // sin nidos cerca del Núcleo al empezar
