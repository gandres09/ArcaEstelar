'use strict';
// =====================================================================
//  Datos del juego: objetos, recetas, edificios, investigación y nave
// =====================================================================

const TILE = 32;
const W = 160, H = 120;                       // tamaño del mapa en casillas
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // derecha, abajo, izquierda, arriba
const DIR_ARROWS = ['→', '↓', '←', '↑'];
const SAVE_KEY = 'mini-fabrica-v2';

// shape: cómo se dibuja el objeto (ore, plate, gear, chip, cable, part, fuel)
const ITEMS = {
  iron_ore:       { name: 'Mineral de hierro',  color: '#7d8fa6', shape: 'ore' },
  copper_ore:     { name: 'Mineral de cobre',   color: '#c8763f', shape: 'ore' },
  coal:           { name: 'Carbón',             color: '#2b2b2b', shape: 'ore' },
  stone:          { name: 'Piedra',             color: '#b5a68a', shape: 'ore' },
  quartz:         { name: 'Cuarzo',             color: '#e9e3f7', shape: 'ore' },
  titanium_ore:   { name: 'Mineral de titanio', color: '#4fb3a4', shape: 'ore' },

  iron_plate:     { name: 'Placa de hierro',    color: '#d6dee8', shape: 'plate' },
  copper_plate:   { name: 'Placa de cobre',     color: '#f29a5c', shape: 'plate' },
  brick:          { name: 'Ladrillo',           color: '#b5543a', shape: 'plate' },
  steel:          { name: 'Acero',              color: '#7c8794', shape: 'plate' },
  silicon:        { name: 'Silicio',            color: '#5b5f9e', shape: 'plate' },
  titanium_plate: { name: 'Placa de titanio',   color: '#86e0d2', shape: 'plate' },

  gear:           { name: 'Engranaje',          color: '#9aa7b5', shape: 'gear' },
  cable:          { name: 'Cable de cobre',     color: '#e8873a', shape: 'cable' },
  circuit:        { name: 'Circuito',           color: '#3fae5a', shape: 'chip' },
  processor:      { name: 'Procesador',         color: '#c0392b', shape: 'chip' },
  engine:         { name: 'Motor',              color: '#6c7a89', shape: 'part' },
  solid_fuel:     { name: 'Combustible sólido', color: '#7a5a2e', shape: 'fuel' },
  rocket_fuel:    { name: 'Combustible de cohete', color: '#ff8a1f', shape: 'fuel' },

  hull:           { name: 'Placa de casco',     color: '#cfd6dd', shape: 'part' },
  thruster:       { name: 'Propulsor',          color: '#e5533d', shape: 'part' },
  nav_computer:   { name: 'Computadora de navegación', color: '#3d8fd6', shape: 'chip' },
  life_support:   { name: 'Soporte vital',      color: '#3cc47c', shape: 'part' },
};
const ITEM_ORDER = Object.keys(ITEMS);

// Minerales del mapa (el índice es el id guardado en el mapa)
const ORE_IDS = [null, 'iron_ore', 'copper_ore', 'coal', 'stone', 'quartz', 'titanium_ore'];
const ORE_GROUND = {
  iron_ore: '#3c4655', copper_ore: '#553826', coal: '#1b1d1c',
  stone: '#5b5444', quartz: '#6a6680', titanium_ore: '#1f4a45',
};

// Energía de los combustibles
const FUELS = { coal: 4000, solid_fuel: 12000 };          // kJ (generador)
const FURNACE_FUEL = { coal: 8, solid_fuel: 24 };         // fundiciones por unidad (horno de piedra)

// Recetas del horno: entra `n` de un mineral, sale 1 producto
const SMELT = {
  iron_ore:     { out: 'iron_plate',     n: 1, time: 2 },
  copper_ore:   { out: 'copper_plate',   n: 1, time: 2 },
  stone:        { out: 'brick',          n: 2, time: 2.5 },
  iron_plate:   { out: 'steel',          n: 4, time: 6,  tech: 'steel' },
  quartz:       { out: 'silicon',        n: 1, time: 3,  tech: 'silicon' },
  titanium_ore: { out: 'titanium_plate', n: 2, time: 4,  tech: 'titanium' },
};

// Recetas de ensambladora. tier 2 = solo en la Ensambladora avanzada
const RECIPES = {
  gear:         { in: { iron_plate: 2 },                                   out: 'gear',         n: 1, time: 1,   tier: 1, tech: 'automation' },
  cable:        { in: { copper_plate: 1 },                                 out: 'cable',        n: 2, time: 0.5, tier: 1, tech: 'automation' },
  circuit:      { in: { iron_plate: 1, cable: 3 },                         out: 'circuit',      n: 1, time: 1.5, tier: 1, tech: 'automation' },
  solid_fuel:   { in: { coal: 4 },                                         out: 'solid_fuel',   n: 1, time: 2,   tier: 1, tech: 'electricity' },
  engine:       { in: { steel: 1, gear: 2 },                               out: 'engine',       n: 1, time: 5,   tier: 2, tech: 'advanced_assembly' },
  processor:    { in: { circuit: 2, silicon: 2, cable: 4 },                out: 'processor',    n: 1, time: 6,   tier: 2, tech: 'silicon' },
  hull:         { in: { titanium_plate: 4, steel: 2 },                     out: 'hull',         n: 1, time: 8,   tier: 2, tech: 'titanium' },
  rocket_fuel:  { in: { solid_fuel: 5 },                                   out: 'rocket_fuel',  n: 1, time: 6,   tier: 2, tech: 'rocketry' },
  thruster:     { in: { engine: 2, titanium_plate: 2, processor: 1 },      out: 'thruster',     n: 1, time: 10,  tier: 2, tech: 'rocketry' },
  nav_computer: { in: { processor: 4, circuit: 4 },                        out: 'nav_computer', n: 1, time: 12,  tier: 2, tech: 'rocketry' },
  life_support: { in: { processor: 2, steel: 2, silicon: 2 },              out: 'life_support', n: 1, time: 12,  tier: 2, tech: 'rocketry' },
};
const RECIPE_ORDER = Object.keys(RECIPES);

// Edificios. size: lado en casillas. power: consumo en kW. tech: investigación que lo desbloquea
const BUILDINGS = {
  belt:        { name: 'Cinta',               cat: 'logística', speed: 2,  cost: { iron_plate: 1 },
                 desc: 'Mueve objetos hacia donde apunta. Arrastrá para trazar.' },
  fastbelt:    { name: 'Cinta rápida',        cat: 'logística', speed: 4,  cost: { iron_plate: 1, gear: 2 }, tech: 'logistics2',
                 desc: 'Cinta al doble de velocidad.' },
  expressbelt: { name: 'Cinta exprés',        cat: 'logística', speed: 8,  cost: { steel: 1, gear: 2 }, tech: 'logistics3',
                 desc: 'Cinta al cuádruple de velocidad.' },
  underground: { name: 'Cinta subterránea',   cat: 'logística', speed: 4,  cost: { iron_plate: 6, gear: 4 }, tech: 'logistics',
                 desc: 'Pasa por debajo de hasta 5 casillas. Poné una entrada y después la salida en la misma dirección.' },
  splitter:    { name: 'Divisor',             cat: 'logística', cost: { iron_plate: 5, gear: 4, circuit: 2 }, tech: 'logistics',
                 desc: 'Reparte objetos entre adelante, izquierda y derecha.' },
  sorter:      { name: 'Filtro',              cat: 'logística', cost: { iron_plate: 5, circuit: 4 }, tech: 'sorting',
                 desc: 'El objeto elegido sigue derecho; el resto sale por los costados. Clic con la mano para elegir.' },
  chest:       { name: 'Cofre',               cat: 'logística', cost: { iron_plate: 8 }, tech: 'logistics',
                 desc: 'Guarda hasta 200 objetos y los va soltando por la flecha.' },

  miner:       { name: 'Taladro',             cat: 'producción', time: 2,   cost: { iron_plate: 10 },
                 desc: 'Va sobre mineral. Extrae 1 cada 2 s y lo saca por la flecha.' },
  eminer:      { name: 'Taladro eléctrico',   cat: 'producción', time: 0.8, power: 90, cost: { iron_plate: 10, gear: 5, circuit: 3 }, tech: 'electricity',
                 desc: 'Extrae 1 cada 0,8 s. Necesita electricidad (90 kW).' },
  furnace:     { name: 'Horno de piedra',     cat: 'producción', speed: 1, cost: { stone: 5 },
                 desc: 'Funde minerales. Necesita carbón o combustible sólido.' },
  efurnace:    { name: 'Horno eléctrico',     cat: 'producción', speed: 2, power: 180, cost: { steel: 10, circuit: 5, brick: 10 }, tech: 'electric_smelting',
                 desc: 'Funde al doble de velocidad, sin combustible. Necesita electricidad (180 kW).' },
  assembler:   { name: 'Ensambladora',        cat: 'producción', speed: 1, tier: 1, cost: { iron_plate: 15, copper_plate: 10 }, tech: 'automation',
                 desc: 'Fabrica piezas simples. Clic con la mano para elegir la receta.' },
  assembler2:  { name: 'Ensambladora avanzada', cat: 'producción', speed: 2, tier: 2, power: 200, cost: { steel: 10, circuit: 10, gear: 10 }, tech: 'advanced_assembly',
                 desc: 'Fabrica cualquier receta al doble de velocidad. Necesita electricidad (200 kW).' },

  generator:   { name: 'Generador a carbón',  cat: 'energía', output: 900, cost: { iron_plate: 20, brick: 10, gear: 5 }, tech: 'electricity',
                 desc: 'Quema carbón o combustible sólido y genera hasta 900 kW. Tiene que estar al alcance de un poste.' },
  pole:        { name: 'Poste eléctrico',     cat: 'energía', cost: { iron_plate: 2, copper_plate: 2 }, tech: 'electricity',
                 desc: 'Conecta con postes a 7 casillas y alimenta todo lo que esté a 2 casillas.' },
  solar:       { name: 'Panel solar',         cat: 'energía', output: 60, cost: { silicon: 10, steel: 5, copper_plate: 10 }, tech: 'solar',
                 desc: 'Genera 60 kW sin combustible.' },

  shipyard:    { name: 'Astillero',           cat: 'nave', size: 5, cost: { steel: 150, brick: 200, processor: 20 }, tech: 'rocketry',
                 desc: 'Acá se arma la nave. Recibe las piezas por cinta o desde el inventario.' },
};
const TOOL_ORDER = Object.keys(BUILDINGS);
const NO_DIR = new Set(['pole', 'solar', 'shipyard', 'hub']);
const BELTS = new Set(['belt', 'fastbelt', 'expressbelt']);
const POLE_REACH = 7, POLE_SUPPLY = 2, UNDERGROUND_REACH = 5;

// Árbol de investigación: se paga con objetos del inventario
const TECHS = {
  automation:        { name: 'Automatización',        cost: { iron_plate: 30, copper_plate: 20 }, req: [],
                       desc: 'Ensambladora y recetas de engranajes, cables y circuitos.' },
  logistics:         { name: 'Logística',             cost: { gear: 20, iron_plate: 40 }, req: ['automation'],
                       desc: 'Divisor, cofre y cinta subterránea.' },
  sorting:           { name: 'Clasificación',         cost: { circuit: 20, gear: 20 }, req: ['logistics'],
                       desc: 'Filtro para separar objetos de una cinta mezclada.' },
  steel:             { name: 'Acero',                 cost: { iron_plate: 100, circuit: 10 }, req: ['automation'],
                       desc: 'El horno convierte 4 placas de hierro en 1 de acero.' },
  logistics2:        { name: 'Logística 2',           cost: { gear: 60, circuit: 30 }, req: ['logistics'],
                       desc: 'Cinta rápida.' },
  electricity:       { name: 'Electricidad',          cost: { copper_plate: 60, steel: 20, circuit: 30 }, req: ['steel'],
                       desc: 'Generador, postes, taladro eléctrico y combustible sólido.' },
  electric_smelting: { name: 'Fundición eléctrica',   cost: { steel: 40, circuit: 40, brick: 50 }, req: ['electricity'],
                       desc: 'Horno eléctrico: el doble de rápido y sin combustible.' },
  advanced_assembly: { name: 'Ensamblaje avanzado',   cost: { steel: 50, circuit: 60, gear: 50 }, req: ['electricity'],
                       desc: 'Ensambladora avanzada y motores.' },
  silicon:           { name: 'Electrónica avanzada',  cost: { circuit: 100, steel: 50, engine: 10 }, req: ['advanced_assembly'],
                       desc: 'Silicio a partir de cuarzo, y procesadores.' },
  solar:             { name: 'Energía solar',         cost: { silicon: 50, steel: 30, circuit: 30 }, req: ['silicon'],
                       desc: 'Paneles solares.' },
  titanium:          { name: 'Metalurgia de titanio', cost: { processor: 20, steel: 100 }, req: ['silicon'],
                       desc: 'Placas de titanio y placas de casco para la nave.' },
  logistics3:        { name: 'Logística 3',           cost: { processor: 20, gear: 100, steel: 50 }, req: ['logistics2', 'silicon'],
                       desc: 'Cinta exprés.' },
  rocketry:          { name: 'Cohetería',             cost: { processor: 50, engine: 30, titanium_plate: 50 }, req: ['titanium'],
                       desc: 'Astillero, propulsores, computadora de navegación, soporte vital y combustible de cohete.' },
};
const TECH_ORDER = Object.keys(TECHS);

// Lo que necesita la nave para despegar
const SHIP = { hull: 40, thruster: 12, nav_computer: 6, life_support: 8, rocket_fuel: 100 };
