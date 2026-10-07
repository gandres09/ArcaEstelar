'use strict';
// =====================================================================
//  Datos del juego: objetos, recetas, edificios, investigación y nave.
//  Este archivo es el lugar para ajustar el balance.
// =====================================================================

const TILE = 32;
let W = 640, H = 480;                             // tamaño del mapa en casillas (da la vuelta en los bordes)
const MAP_SIZE = [1600, 1200];                    // tamaño de las partidas nuevas (enorme, para explorar)
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];  // derecha, abajo, izquierda, arriba
const DIR_ARROWS = ['→', '↓', '←', '↑'];
const SAVE_KEY = 'mini-fabrica-v4';
const SAVE_VERSION = 4;

// shape: cómo se dibuja el objeto
const ITEMS = {
  iron_ore:       { name: 'Mineral de hierro',  color: '#7d8fa6', shape: 'ore' },
  copper_ore:     { name: 'Mineral de cobre',   color: '#c8763f', shape: 'ore' },
  coal:           { name: 'Carbón',             color: '#2b2b2b', shape: 'ore' },
  stone:          { name: 'Piedra',             color: '#b5a68a', shape: 'ore' },
  wood:           { name: 'Madera',             color: '#a8743a', shape: 'log' },
  quartz:         { name: 'Cuarzo',             color: '#e9e3f7', shape: 'ore' },
  titanium_ore:   { name: 'Mineral de titanio', color: '#4fb3a4', shape: 'ore' },
  oil:            { name: 'Petróleo crudo',     color: '#3b2a20', shape: 'barrel' },
  water:          { name: 'Agua',               color: '#3a8fd8', shape: 'barrel' },
  steam:          { name: 'Vapor',              color: '#e8eef4', shape: 'barrel' },
  lubricant:      { name: 'Lubricante',         color: '#4fae5c', shape: 'barrel' },

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
  electric_engine:{ name: 'Motor eléctrico',    color: '#4d8fc4', shape: 'part' },
  control_unit:   { name: 'Unidad de control',  color: '#2f6fb0', shape: 'chip' },
  low_density:    { name: 'Estructura liviana', color: '#c99a5c', shape: 'plate' },
  battery:        { name: 'Batería',            color: '#d4b13c', shape: 'battery' },
  solid_fuel:     { name: 'Combustible sólido', color: '#7a5a2e', shape: 'fuel' },
  rocket_fuel:    { name: 'Combustible de cohete', color: '#ff8a1f', shape: 'fuel' },
  speed_module:   { name: 'Módulo de velocidad',     color: '#4aa3df', shape: 'module' },
  prod_module:    { name: 'Módulo de productividad', color: '#e0743a', shape: 'module' },
  eff_module:     { name: 'Módulo de eficiencia',    color: '#5cc47a', shape: 'module' },
  ammo:           { name: 'Munición',           color: '#c9a227', shape: 'ammo' },
  artillery_shell:{ name: 'Proyectil de artillería', color: '#8a9a5b', shape: 'ammo' },
  cannon_shell:   { name: 'Bala de cañón',      color: '#6b7a4a', shape: 'ammo' },

  sci_red:        { name: 'Ciencia roja',       color: '#e0473b', shape: 'flask' },
  sci_green:      { name: 'Ciencia verde',      color: '#4cc25a', shape: 'flask' },
  sci_blue:       { name: 'Ciencia azul',       color: '#3f86e0', shape: 'flask' },
  sci_purple:     { name: 'Ciencia espacial',   color: '#b45fe0', shape: 'flask' },

  hull:           { name: 'Placa de casco',     color: '#cfd6dd', shape: 'part' },
  thruster:       { name: 'Propulsor',          color: '#e5533d', shape: 'part' },
  nav_computer:   { name: 'Computadora de navegación', color: '#3d8fd6', shape: 'chip' },
  life_support:   { name: 'Soporte vital',      color: '#3cc47c', shape: 'part' },

  // Etapa 2: limpiar el planeta
  explosives:     { name: 'Explosivos',         color: '#d9534f', shape: 'fuel' },
  orbital_charge: { name: 'Carga orbital',      color: '#ff6a3d', shape: 'part' },
  air_filter:     { name: 'Filtro de aire',     color: '#9fd9c8', shape: 'plate' },
  // Etapa 3: el arca estelar
  superconductor: { name: 'Superconductor',     color: '#7fd1ff', shape: 'cable' },
  quantum_processor: { name: 'Procesador cuántico', color: '#b98cff', shape: 'chip' },
  sci_star:       { name: 'Ciencia estelar',    color: '#f4f1e1', shape: 'flask' },
  fusion_core:    { name: 'Núcleo de fusión',   color: '#ffd166', shape: 'battery' },
  warp_drive:     { name: 'Motor de curvatura', color: '#8a7dff', shape: 'part' },
  habitat:        { name: 'Módulo de hábitat',  color: '#9ad17f', shape: 'part' },
  shield:         { name: 'Escudo deflector',   color: '#59c3ff', shape: 'module' },

  // Partes de monstruos (para armas y armaduras)
  quitina:        { name: 'Quitina',            color: '#9c7a3c', shape: 'part' },
  colmillo:       { name: 'Colmillo',           color: '#efe6cf', shape: 'part' },
  cristal:        { name: 'Cristal antiguo',    color: '#62e0d0', shape: 'part' },
  corazon:        { name: 'Corazón de bestia',  color: '#d9455f', shape: 'part' },
};
const ITEM_ORDER = Object.keys(ITEMS);
const PACKS = ['sci_red', 'sci_green', 'sci_blue', 'sci_purple', 'sci_star'];

// Recursos del mapa (el índice es el id guardado en el mapa)
const ORE_IDS = [null, 'iron_ore', 'copper_ore', 'coal', 'stone', 'quartz', 'titanium_ore', 'oil', 'water'];
const ORE_GROUND = {
  iron_ore: '#3c4655', copper_ore: '#553826', coal: '#1b1d1c', stone: '#5b5444',
  quartz: '#6a6680', titanium_ore: '#1f4a45', oil: '#151012', water: '#1d4f86',
};

// Combustibles
const FUELS = { coal: 4000, solid_fuel: 12000, wood: 2000 };   // kJ por unidad
const GENERATOR_EFFICIENCY = 0.5;                  // el generador a carbón desperdicia la mitad
const STEAM_ENERGY = 1000;                         // kJ por unidad de vapor
const FURNACE_FUEL = { coal: 12, solid_fuel: 36, wood: 6 };  // fundiciones por unidad (horno de piedra)
const MINER_FUEL = { coal: 8, solid_fuel: 24, wood: 4 };      // extracciones por unidad (taladro común)

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
  electric_engine: { machine: 'asm', tier: 2, in: { engine: 1, circuit: 2, lubricant: 2 },  out: 'electric_engine', n: 1, time: 8, tech: 'electric_engines' },
  control_unit: { machine: 'asm',  tier: 2, in: { processor: 2, battery: 1 },               out: 'control_unit', n: 1, time: 8,   tech: 'control_units' },
  low_density:  { machine: 'asm',  tier: 2, in: { steel: 2, copper_plate: 5, plastic: 2 },  out: 'low_density',  n: 1, time: 10,  tech: 'titanium' },
  sci_purple:   { machine: 'asm',  tier: 2, in: { low_density: 1, control_unit: 1, titanium_plate: 1 }, out: 'sci_purple', n: 2, time: 15, tech: 'space_science' },
  speed_module: { machine: 'asm',  tier: 2, in: { circuit: 5, processor: 5 },               out: 'speed_module', n: 1, time: 15,  tech: 'modules' },
  prod_module:  { machine: 'asm',  tier: 2, in: { circuit: 5, processor: 5 },               out: 'prod_module',  n: 1, time: 15,  tech: 'modules' },
  eff_module:   { machine: 'asm',  tier: 2, in: { circuit: 5, processor: 5 },               out: 'eff_module',   n: 1, time: 15,  tech: 'modules' },
  hull:         { machine: 'asm',  tier: 2, in: { low_density: 2, titanium_plate: 2 },      out: 'hull',         n: 1, time: 10,  tech: 'titanium' },
  thruster:     { machine: 'asm',  tier: 2, in: { electric_engine: 2, rocket_fuel: 2, titanium_plate: 2 }, out: 'thruster', n: 1, time: 12, tech: 'rocketry' },
  nav_computer: { machine: 'asm',  tier: 2, in: { control_unit: 3, processor: 2 },          out: 'nav_computer', n: 1, time: 12,  tech: 'rocketry' },
  life_support: { machine: 'asm',  tier: 2, in: { control_unit: 1, electric_engine: 1, water: 5 }, out: 'life_support', n: 1, time: 12, tech: 'rocketry' },
  plastic:      { machine: 'chem', tier: 1, in: { oil: 1, coal: 1 },                       out: 'plastic',      n: 2, time: 2,   tech: 'oil' },
  sulfur:       { machine: 'chem', tier: 1, in: { oil: 1, water: 1 },                       out: 'sulfur',       n: 1, time: 1.5, tech: 'oil' },
  lubricant:    { machine: 'chem', tier: 1, in: { oil: 1, water: 1 },                       out: 'lubricant',    n: 1, time: 1,   tech: 'electric_engines' },
  battery:      { machine: 'chem', tier: 1, in: { sulfur: 1, iron_plate: 1, copper_plate: 1 }, out: 'battery',  n: 1, time: 4,   tech: 'batteries' },
  rocket_fuel:  { machine: 'chem', tier: 1, in: { solid_fuel: 4, oil: 2 },                  out: 'rocket_fuel',  n: 1, time: 8,   tech: 'rocketry' },
  // Etapa 2
  air_filter:   { machine: 'asm',  tier: 1, in: { coal: 2, plastic: 1, steel: 1 },          out: 'air_filter',   n: 2, time: 5,   tech: 'air_purification' },
  explosives:   { machine: 'chem', tier: 1, in: { sulfur: 1, coal: 1, water: 1 },           out: 'explosives',   n: 2, time: 4,   tech: 'orbital_strike' },
  orbital_charge: { machine: 'asm', tier: 2, in: { rocket_fuel: 1, explosives: 5, control_unit: 1 }, out: 'orbital_charge', n: 1, time: 15, tech: 'orbital_strike' },
  // Etapa 3
  superconductor: { machine: 'chem', tier: 1, in: { copper_plate: 2, titanium_plate: 1, lubricant: 2 }, out: 'superconductor', n: 1, time: 5, tech: 'superconductors' },
  quantum_processor: { machine: 'asm', tier: 2, in: { processor: 2, superconductor: 2, control_unit: 1 }, out: 'quantum_processor', n: 1, time: 12, tech: 'superconductors' },
  sci_star:     { machine: 'asm',  tier: 2, in: { quantum_processor: 1, superconductor: 2, low_density: 1 }, out: 'sci_star', n: 2, time: 20, tech: 'star_science' },
  fusion_core:  { machine: 'asm',  tier: 2, in: { superconductor: 10, quantum_processor: 3, steel: 20, titanium_plate: 10 }, out: 'fusion_core', n: 1, time: 30, tech: 'fusion' },
  warp_drive:   { machine: 'asm',  tier: 2, in: { fusion_core: 1, thruster: 2, quantum_processor: 4 }, out: 'warp_drive', n: 1, time: 30, tech: 'warp_drive' },
  habitat:      { machine: 'asm',  tier: 2, in: { hull: 3, life_support: 2, plastic: 20 },  out: 'habitat',      n: 1, time: 20,  tech: 'starship' },
  shield:       { machine: 'asm',  tier: 2, in: { superconductor: 6, battery: 10, quantum_processor: 2 }, out: 'shield', n: 1, time: 20, tech: 'starship' },
  artillery_shell: { machine: 'asm', tier: 2, in: { steel: 2, sulfur: 2, ammo: 2 },         out: 'artillery_shell', n: 1, time: 8, tech: 'artillery' },
  cannon_shell: { machine: 'asm',  tier: 2, in: { steel: 1, sulfur: 1, ammo: 1 },           out: 'cannon_shell', n: 2, time: 4,   tech: 'vehicles4' },
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
  inserter:    { name: 'Brazo',               cat: 'logística', swing: 1.2, hp: 80, cost: { iron_plate: 3, gear: 2 }, tech: 'inserters',
                 desc: 'Toma de atrás y deja adelante, solo lo que el destino puede recibir. De la Nave saca lo que la máquina necesita.' },
  fastinserter:{ name: 'Brazo rápido',        cat: 'logística', swing: 0.45, power: 20, hp: 100, cost: { iron_plate: 2, gear: 2, circuit: 2 }, tech: 'logistics2',
                 desc: 'Como el brazo, casi 3 veces más rápido. Usa 20 kW.' },
  longinserter:{ name: 'Brazo largo',         cat: 'logística', as: 'inserter', swing: 1.0, reach: 2, hp: 80, cost: { iron_plate: 3, gear: 3, circuit: 1 }, tech: 'inserters2',
                 desc: 'Toma a 2 casillas para atrás y deja a 2 casillas para adelante: pasa por arriba de una cinta o de otra máquina.' },
  stackinserter:{ name: 'Brazo de carga',     cat: 'logística', as: 'inserter', swing: 0.5, stack: 4, power: 40, hp: 120, cost: { iron_plate: 5, gear: 5, circuit: 5, processor: 1 }, tech: 'inserters3',
                 desc: 'Rápido y lleva hasta 4 objetos iguales por vuelta. Usa 40 kW.' },
  antenna:     { name: 'Antena',              cat: 'logística', hp: 120, cost: { iron_plate: 5, copper_plate: 5, circuit: 2 }, tech: 'ship_link1',
                 desc: 'Lleva la señal de la Nave más lejos: cerca de una antena podés construir y fabricar con lo guardado en la Nave, sin sacarlo. Tiene que estar dentro de la señal de la Nave o de otra antena.' },
  splitter:    { name: 'Divisor',             cat: 'logística', hp: 120, cost: { iron_plate: 5, gear: 4 }, tech: 'logistics',
                 desc: 'Reparte objetos entre adelante, izquierda y derecha.' },
  sorter:      { name: 'Filtro',              cat: 'logística', hp: 120, cost: { iron_plate: 5, circuit: 4 }, tech: 'sorting',
                 desc: 'El objeto elegido sigue derecho; el resto sale por los costados.' },
  receiver:    { name: 'Receptor',            cat: 'logística', hp: 200, cost: { steel: 10, circuit: 10, iron_plate: 10 }, tech: 'receivers',
                 desc: 'Manda al inventario de la Nave todo lo que le llega, desde cualquier lugar.' },
  woodchest:   { name: 'Cofre de madera',     cat: 'logística', capacity: 100, hp: 80, cost: { wood: 4 },
                 desc: 'Guarda hasta 100 objetos y los va soltando por la flecha. Se hace con madera.' },
  chest:       { name: 'Cofre',               cat: 'logística', capacity: 200, hp: 150, cost: { iron_plate: 8 },
                 desc: 'Guarda hasta 200 objetos y los va soltando por la flecha.' },
  steelchest:  { name: 'Cofre de acero',      cat: 'logística', capacity: 800, hp: 350, cost: { steel: 8 }, tech: 'steel',
                 desc: 'Guarda hasta 800 objetos y los va soltando por la flecha.' },

  miner:       { name: 'Taladro',             cat: 'producción', time: 2, area: 1, hp: 150, poll: 12, cost: { iron_plate: 10, stone: 5 },
                 desc: 'Va sobre mineral y extrae del área de 3×3 a su alrededor: 1 cada 2 s. Quema carbón o madera (1 carbón = 8 minerales).' },
  eminer:      { name: 'Taladro eléctrico',   cat: 'producción', time: 0.8, area: 2, power: 90, hp: 200, poll: 10, cost: { iron_plate: 10, gear: 5, circuit: 3 }, tech: 'electricity',
                 desc: 'Extrae del área de 5×5 a su alrededor: 1 cada 0,8 s. Usa 90 kW.' },
  pumpjack:    { name: 'Bomba de petróleo',   cat: 'producción', time: 1, power: 90, hp: 200, poll: 10, cost: { steel: 5, gear: 10, circuit: 5 }, tech: 'oil',
                 desc: 'Va sobre un pozo de petróleo. Saca 1 barril por segundo. Usa 90 kW.' },
  furnace:     { name: 'Horno de piedra',     cat: 'producción', speed: 1, hp: 200, poll: 3, cost: { stone: 5 },
                 desc: 'Funde minerales. Quema carbón o combustible sólido.' },
  efurnace:    { name: 'Horno eléctrico',     cat: 'producción', speed: 2, power: 180, hp: 300, poll: 1, cost: { steel: 10, circuit: 5, brick: 10 }, tech: 'electric_smelting',
                 desc: 'Funde al doble de velocidad y sin combustible. Usa 180 kW.' },
  steelfurnace:{ name: 'Horno de acero',      cat: 'producción', as: 'furnace', speed: 2, hp: 300, poll: 4, cost: { steel: 6, brick: 10 }, tech: 'advanced_smelting',
                 desc: 'Funde al doble de velocidad que el de piedra. Quema carbón, madera o combustible sólido.' },
  assembler:   { name: 'Ensambladora',        cat: 'producción', speed: 1, tier: 1, machine: 'asm', power: 75, hp: 200, poll: 4, cost: { iron_plate: 15, copper_plate: 10 },
                 desc: 'Fabrica piezas simples. Usa 75 kW: conectala con postes a un generador.' },
  assembler2:  { name: 'Ensambladora avanzada', cat: 'producción', speed: 2, tier: 2, machine: 'asm', power: 200, hp: 300, poll: 3, cost: { steel: 10, circuit: 10, gear: 10 }, tech: 'advanced_assembly',
                 desc: 'Fabrica cualquier receta al doble de velocidad. Usa 200 kW.' },
  assembler3:  { name: 'Ensambladora 3',      cat: 'producción', as: 'assembler2', speed: 3, tier: 3, machine: 'asm', power: 375, hp: 400, poll: 2, cost: { steel: 15, processor: 6, speed_module: 2 }, tech: 'production3',
                 desc: 'Fabrica cualquier receta al triple de velocidad. Lleva 4 módulos. Usa 375 kW.' },
  chem:        { name: 'Planta química',      cat: 'producción', speed: 1, tier: 1, machine: 'chem', power: 210, hp: 300, poll: 4, cost: { steel: 5, gear: 5, circuit: 5 }, tech: 'oil',
                 desc: 'Procesa petróleo: plástico, azufre, baterías y combustible de cohete. Usa 210 kW.' },
  refinery:    { name: 'Refinería',           cat: 'producción', as: 'chem', size: 2, speed: 3, tier: 1, machine: 'chem', power: 420, hp: 500, poll: 6, cost: { steel: 15, gear: 10, circuit: 10, brick: 10 }, tech: 'advanced_oil',
                 desc: 'Hace todas las recetas del petróleo (plástico, azufre, lubricante, baterías…) al triple de velocidad. Ocupa 2×2. Usa 420 kW.' },
  beacon:      { name: 'Faro',                cat: 'producción', size: 2, power: 240, range: 3, hp: 200, cost: { steel: 10, circuit: 20, processor: 10, cable: 10 }, tech: 'effect_transmission',
                 desc: 'Ponele módulos de velocidad o eficiencia: les pasa la mitad de su efecto a todas las máquinas que estén a 3 casillas o menos. Usa 240 kW.' },
  lab:         { name: 'Laboratorio',         cat: 'producción', speed: 1, power: 60, hp: 150, cost: { iron_plate: 10, gear: 10, copper_plate: 10 },
                 desc: 'Investiga usando packs de ciencia. Más laboratorios, más rápido. Usa 60 kW.' },
  armory:      { name: 'Armería',             cat: 'producción', size: 2, hp: 300, character: true, cost: { iron_plate: 20, stone: 10, wood: 10 },
                 desc: 'Fabricá y mejorá armas y armaduras con materiales de la fábrica y partes de monstruos.' },

  sensor:      { name: 'Sensor',              cat: 'energía', hp: 80, cost: { iron_plate: 2, circuit: 5, cable: 5 }, tech: 'signal_network',
                 desc: 'Lee lo que hay en el edificio al que apunta (cofre, Nave, tanque, acumulador, cinta) y lo manda a un canal de la red de señales.' },
  pole:        { name: 'Poste eléctrico',     cat: 'energía', reach: 7, supply: 2, hp: 80, cost: { iron_plate: 2, copper_plate: 2 },
                 desc: 'Conecta con postes a 7 casillas y alimenta lo que esté a 2 casillas.' },
  mediumpole:  { name: 'Poste mediano',       cat: 'energía', as: 'pole', reach: 9, supply: 3, hp: 100, cost: { steel: 2, copper_plate: 2 }, tech: 'electric_distribution',
                 desc: 'Conecta con postes a 9 casillas y alimenta lo que esté a 3.' },
  substation:  { name: 'Subestación',         cat: 'energía', as: 'pole', size: 2, reach: 18, supply: 8, hp: 300, cost: { steel: 10, processor: 5, copper_plate: 5 }, tech: 'electric_distribution2',
                 desc: 'Alimenta todo lo que esté a 8 casillas y conecta a 18. Ideal para zonas llenas de máquinas.' },
  bigpole:     { name: 'Torre de alta tensión', cat: 'energía', reach: 24, supply: 1, hp: 150, cost: { steel: 5, copper_plate: 5 }, tech: 'big_poles',
                 desc: 'Lleva energía lejos: conecta a 24 casillas.' },
  pipe:        { name: 'Cañería',             cat: 'energía', capacity: 100, hp: 100, cost: { iron_plate: 1 }, tech: 'fluid_handling',
                 desc: 'Lleva líquidos (agua, petróleo, vapor, lubricante). Se conecta sola y entrega a las máquinas que la tocan.' },
  pump:        { name: 'Bomba',               cat: 'energía', power: 30, rate: 20, hp: 150, cost: { iron_plate: 5, gear: 3, circuit: 2 }, tech: 'fluid_handling',
                 desc: 'Pasa líquido de la cañería de atrás a lo que tenga adelante (otra cañería o una máquina), hasta 20 por segundo. Separa las redes. Usa 30 kW.' },
  tank:        { name: 'Tanque',              cat: 'energía', size: 2, capacity: 2500, hp: 400, cost: { steel: 20, iron_plate: 10 }, tech: 'fluid_handling',
                 desc: 'Guarda 2.500 de un líquido como parte de la red de cañerías.' },
  generator:   { name: 'Generador a carbón',  cat: 'energía', output: 900, hp: 300, poll: 25, cost: { iron_plate: 20, stone: 10 },
                 desc: 'Quema carbón o combustible sólido y genera hasta 900 kW. Simple, pero desperdicia la mitad del combustible.' },
  offshore:    { name: 'Bomba de agua',       cat: 'energía', time: 0.5, hp: 150, cost: { iron_plate: 5, gear: 2, circuit: 2 }, tech: 'steam_power',
                 desc: 'Va en la orilla, junto al agua. Saca 2 de agua por segundo, sin fin y sin electricidad.' },
  boiler:      { name: 'Caldera',             cat: 'energía', rate: 1.8, hp: 200, poll: 30, cost: { stone: 10, iron_plate: 5 }, tech: 'steam_power',
                 desc: 'Con agua y carbón hace vapor (hasta 1,8 por segundo). Sale por la flecha.' },
  steam_engine:{ name: 'Máquina de vapor',    cat: 'energía', output: 900, hp: 300, cost: { iron_plate: 10, gear: 8 }, tech: 'steam_power',
                 desc: 'Convierte vapor en hasta 900 kW. El vapor que le sobra pasa a la siguiente por la flecha.' },
  radar:       { name: 'Radar',               cat: 'energía', power: 300, scan: 12, hp: 250, cost: { iron_plate: 10, gear: 5, circuit: 5 }, tech: 'electricity',
                 desc: 'Explora el mapa de a poco alrededor suyo. Usa 300 kW.' },
  solar:       { name: 'Panel solar',         cat: 'energía', output: 60, hp: 150, cost: { silicon: 10, steel: 5, copper_plate: 10 }, tech: 'solar',
                 desc: 'Genera 60 kW de día, 30 kW al atardecer y al amanecer, y nada de noche.' },
  accumulator: { name: 'Acumulador',          cat: 'energía', capacity: 5000, rate: 300, hp: 150, cost: { battery: 5, iron_plate: 2 }, tech: 'batteries',
                 desc: 'Guarda 5 MJ cuando sobra energía y la devuelve cuando falta (hasta 300 kW).' },
  lightningrod:{ name: 'Pararrayos',          cat: 'energía', hp: 300, cost: { steel: 3, copper_plate: 6 }, tech: 'electricity',
                 desc: 'En las tormentas eléctricas atrae los rayos: protege todo lo que está a 30 casillas. La Nave ya protege 25 a su alrededor.' },
  lamp:        { name: 'Lámpara',             cat: 'energía', power: 5, hp: 60, cost: { iron_plate: 1, circuit: 1, cable: 3 }, tech: 'electricity',
                 desc: 'Ilumina de noche. Usa 5 kW.' },

  wall:        { name: 'Muro',                cat: 'defensa', hp: 350, cost: { brick: 5 }, tech: 'defense',
                 desc: 'Frena a los enemigos.' },
  turret:      { name: 'Torreta',             cat: 'defensa', range: 9, rate: 5, dmg: 5, hp: 400, cost: { iron_plate: 10, gear: 10, copper_plate: 10 }, tech: 'defense',
                 desc: 'Dispara a enemigos a 9 casillas. Usa munición (por cinta o desde su panel).' },
  gate:        { name: 'Compuerta',           cat: 'defensa', as: 'wall', hp: 350, cost: { brick: 5, steel: 2, circuit: 2 }, tech: 'gates',
                 desc: 'Un muro que se abre para vos y tus amigos (y para los trenes) pero no para los bichos.' },
  flameturret: { name: 'Torreta lanzallamas', cat: 'defensa', range: 8, dmg: 6, hp: 900, cost: { steel: 20, gear: 15, engine: 5 }, tech: 'flamethrower',
                 desc: 'Quema todo lo que entra a 8 casillas y daña a los que están alrededor. Usa petróleo: pegala a una cañería o dale barriles con brazos.' },
  artillery:   { name: 'Torreta de artillería', cat: 'defensa', size: 2, range: 60, dmg: 400, blast: 3, rate: 8, hp: 2000, cost: { steel: 60, gear: 40, engine: 10, processor: 10 }, tech: 'artillery',
                 desc: 'Sola, bombardea los nidos que estén a 60 casillas o menos. Usa proyectiles de artillería.' },
  laser:       { name: 'Torreta láser',       cat: 'defensa', range: 12, rate: 2, dmg: 18, power: 400, hp: 600, cost: { steel: 20, circuit: 20, battery: 12 }, tech: 'laser_turrets',
                 desc: 'Dispara con electricidad a 12 casillas. Usa 400 kW al disparar.' },

  shipyard:    { name: 'Astillero',           cat: 'nave', size: 5, hp: 3000, cost: { steel: 200, brick: 200, processor: 50 }, tech: 'rocketry',
                 desc: 'Acá se arma la nave. Recibe las piezas por cinta o desde el inventario.' },
  purifier:    { name: 'Purificador de aire', cat: 'planeta', size: 2, power: 300, absorb: 4, hp: 300, cost: { steel: 20, circuit: 15, plastic: 20 }, tech: 'air_purification',
                 desc: 'Limpia la polución de su zona (hasta 4 por segundo) gastando filtros de aire. Usa 300 kW.' },
  nursery:     { name: 'Vivero',              cat: 'planeta', size: 2, power: 60, radius: 7, every: 15, hp: 200, cost: { wood: 20, steel: 5, circuit: 5 }, tech: 'air_purification',
                 desc: 'Planta un árbol cada 15 s en el pasto libre de alrededor (7 casillas). Los bosques absorben polución. Usa 60 kW.' },
  uplink:      { name: 'Enlace orbital',      cat: 'planeta', size: 3, power: 1000, reload: 12, blast: 10, hp: 800, cost: { steel: 100, control_unit: 20, processor: 30 }, tech: 'orbital_strike',
                 desc: 'Desde la estación en órbita, borra el grupo de nidos más cercano de todo el planeta. Gasta 1 carga orbital por disparo. Usa 1 MW.' },
  fusion_plant:{ name: 'Planta de fusión',    cat: 'energía', size: 3, output: 8000, hp: 1000, cost: { fusion_core: 2, steel: 100, superconductor: 40 }, tech: 'fusion',
                 desc: 'Genera 8 MW sin combustible y sin contaminar.' },
  starport:    { name: 'Dique estelar',       cat: 'nave', size: 7, hp: 6000, cost: { steel: 1000, low_density: 200, quantum_processor: 50, brick: 500 }, tech: 'starship',
                 desc: 'Acá se arma el Arca estelar para salir del sistema solar. Recibe las piezas por cinta o desde el inventario.' },
  providerchest: { name: 'Cofre de provisión', cat: 'robots', capacity: 400, hp: 200, cost: { steel: 5, circuit: 3 }, tech: 'logistic_robots',
                 desc: 'Los robots logísticos sacan de acá lo que piden los cofres de pedido. Llenalo con brazos o cintas.' },
  requesterchest:{ name: 'Cofre de pedido',    cat: 'robots', capacity: 400, hp: 200, cost: { steel: 5, circuit: 3 }, tech: 'logistic_robots',
                 desc: 'Pedile objetos y cantidades: los robots logísticos se los traen de los cofres de provisión o de la Nave. Sacá con brazos.' },
  roboport:    { name: 'Puerto de robots',    cat: 'robots', power: 200, range: 25, bots: 5, hp: 400, cost: { steel: 30, circuit: 30, electric_engine: 10, battery: 10 }, tech: 'construction_robots',
                 desc: 'Trae 5 robots que construyen los fantasmas, reconstruyen lo destruido y reparan en 25 casillas a la redonda. Usa 200 kW.' },
  rail:        { name: 'Vía',                 cat: 'trenes', hp: 100, cost: { stone: 1, steel: 1 }, tech: 'railway',
                 desc: 'Se conecta sola con las vías vecinas. Tendela de punta a punta como una cinta.' },
  signal:      { name: 'Señal de tren',       cat: 'trenes', hp: 100, cost: { steel: 2, circuit: 2 }, tech: 'railway',
                 desc: 'Va en la vía (hace de vía) y la corta en tramos: un tren solo entra a un tramo si no hay otro tren adentro.' },
  station:     { name: 'Estación',            cat: 'trenes', hp: 300, cost: { steel: 10, circuit: 5, iron_plate: 10 }, tech: 'railway',
                 desc: 'Parada de tren sobre la vía. En modo Carga recibe objetos; en Descarga los suelta por la flecha.' },
  train:       { name: 'Tren',                cat: 'trenes', hp: 500, cost: { engine: 10, steel: 40, circuit: 10 }, tech: 'railway',
                 desc: 'Locomotora con 2 vagones (800 objetos). Ponelo sobre una vía: recorre todas las estaciones de su red.' },
  // Vehículos: se ponen como un edificio pero andan sueltos (ver vehicles.js)
  buggy:       { name: 'Buggy',               cat: 'vehículos', as: 'vehicle', vehicle: true, character: true, hp: 200, cost: { iron_plate: 40, gear: 20, copper_plate: 10 }, tech: 'vehicles1',
                 desc: 'Liviano y barato. Quema carbón o madera. Baúl chico (20).' },
  car:         { name: 'Auto',                cat: 'vehículos', as: 'vehicle', vehicle: true, character: true, hp: 350, cost: { steel: 20, engine: 6, circuit: 8 }, tech: 'vehicles2',
                 desc: 'Rápido y con baúl de 50. Mejor con combustible sólido.' },
  truck:       { name: 'Camioneta blindada',  cat: 'vehículos', as: 'vehicle', vehicle: true, character: true, hp: 900, cost: { steel: 50, engine: 12, circuit: 20 }, tech: 'vehicles3',
                 desc: 'Blindada, baúl de 100 y ametralladora que dispara sola (usa munición).' },
  tank:        { name: 'Tanque',              cat: 'vehículos', as: 'vehicle', vehicle: true, character: true, hp: 2500, cost: { steel: 100, engine: 20, processor: 10 }, tech: 'vehicles4',
                 desc: 'Muy resistente, baúl de 150 y cañón que explota (usa balas de cañón). Atropella todo.' },
  hover:       { name: 'Aerodeslizador',      cat: 'vehículos', as: 'vehicle', vehicle: true, character: true, hp: 1200, cost: { low_density: 20, electric_engine: 12, processor: 10, battery: 10 }, tech: 'vehicles5',
                 desc: 'El más rápido: cruza lagos por arriba del agua y tiene láser (gasta combustible). Baúl de 120.' },
  landfill:    { name: 'Relleno',             cat: 'terreno', hp: 1, cost: { stone: 20 }, tech: 'landfill',
                 desc: 'Convierte una casilla de agua en tierra firme.' },
};
const TOOL_ORDER = Object.keys(BUILDINGS);
// Edificios que funcionan como otro (por ejemplo, el horno de acero es un horno): comparten su lógica
const kindOf = (t) => (BUILDINGS[t] && BUILDINGS[t].as) || t;
const INSERTERS = new Set(Object.keys(BUILDINGS).filter((k) => kindOf(k) === 'inserter' || k === 'fastinserter'));
const NO_DIR = new Set(['buggy', 'car', 'truck', 'tank', 'hover', 'lightningrod', 'antenna', 'mediumpole', 'substation', 'beacon', 'gate', 'flameturret', 'artillery', 'signal', 'providerchest', 'requesterchest', 'nursery', 'purifier', 'uplink', 'fusion_plant', 'starport', 'pipe', 'tank', 'roboport', 'rail', 'train', 'receiver', 'radar', 'landfill', 'pole', 'bigpole', 'solar', 'accumulator', 'lamp', 'wall', 'turret', 'laser', 'shipyard', 'hub', 'nest', 'lab']);
const BELTS = new Set(['belt', 'fastbelt', 'expressbelt']);
const LANED = new Set(['belt', 'fastbelt', 'expressbelt', 'underground', 'splitter', 'sorter']);   // con dos carriles
const UNDERGROUND_REACH = 5;

// Investigación: los laboratorios consumen 1 de cada pack por unidad
const TECHS = {
  electronics:       { name: 'Electrónica',          packs: ['sci_red'], units: 15, time: 8, req: [],
                       desc: 'Cables y circuitos.' },
  inserters:         { name: 'Brazos',               packs: ['sci_red'], units: 10, time: 8, req: [],
                       desc: 'Brazos que pasan objetos entre cintas, cofres, máquinas y la Nave.' },
  inserters2:        { name: 'Brazos largos',        packs: ['sci_red'], units: 20, time: 8, req: ['inserters', 'electronics'],
                       desc: 'Brazo largo: toma y deja a 2 casillas.' },
  ship_link1:        { name: 'Señal de la Nave 1',   packs: ['sci_red'], units: 30, time: 8, req: ['electronics'],
                       desc: 'Usás lo guardado en la Nave hasta 20 casillas de distancia (antes 10), y antenas que llevan la señal 12 casillas más.' },
  vehicles1:         { name: 'Vehículos',            packs: ['sci_red'], units: 30, time: 8, req: ['logistics'],
                       desc: 'Buggy: para recorrer el mapa más rápido.' },
  logistics:         { name: 'Logística',            packs: ['sci_red'], units: 20, time: 8, req: [],
                       desc: 'Divisor y cinta subterránea.' },
  defense:           { name: 'Defensa',              packs: ['sci_red'], units: 20, time: 8, req: [],
                       desc: 'Muros, torretas y munición.' },
  steel:             { name: 'Acero',                packs: ['sci_red'], units: 30, time: 8, req: [],
                       desc: 'El horno convierte 5 placas de hierro en 1 de acero.' },
  logistic_science:  { name: 'Ciencia verde',        packs: ['sci_red'], units: 40, time: 8, req: ['electronics'],
                       desc: 'Receta del pack de ciencia verde.' },
  electricity:       { name: 'Electricidad',         packs: ['sci_red', 'sci_green'], units: 40, time: 12, req: ['steel', 'logistic_science'],
                       desc: 'Taladro eléctrico, lámparas y combustible sólido.' },
  steam_power:       { name: 'Energía a vapor',      packs: ['sci_red', 'sci_green'], units: 40, time: 12, req: ['electricity'],
                       desc: 'Bomba de agua, caldera y máquina de vapor: el doble de energía por cada carbón.' },
  fluid_handling:    { name: 'Manejo de fluidos',    packs: ['sci_red', 'sci_green'], units: 40, time: 12, req: ['steam_power'],
                       desc: 'Cañerías y tanques para llevar líquidos sin cintas.' },
  landfill:          { name: 'Relleno',              packs: ['sci_red', 'sci_green'], units: 30, time: 12, req: ['steam_power'],
                       desc: 'Rellenar agua con piedra para ganar terreno.' },
  receivers:         { name: 'Receptores',           packs: ['sci_red', 'sci_green'], units: 50, time: 12, req: ['electricity'],
                       desc: 'Receptores: entregan a la Nave desde cualquier lugar de la fábrica.' },
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
  advanced_smelting: { name: 'Fundición avanzada',   packs: ['sci_red', 'sci_green'], units: 50, time: 12, req: ['steel', 'logistic_science'],
                       desc: 'Horno de acero: el doble de rápido que el de piedra.' },
  gates:             { name: 'Compuertas',           packs: ['sci_red', 'sci_green'], units: 30, time: 12, req: ['defense', 'logistic_science'],
                       desc: 'Muros que se abren para vos pero no para los bichos.' },
  electric_distribution: { name: 'Distribución eléctrica', packs: ['sci_red', 'sci_green'], units: 40, time: 12, req: ['electricity'],
                       desc: 'Poste mediano: más alcance que el de madera.' },
  flamethrower:      { name: 'Lanzallamas',          packs: ['sci_red', 'sci_green'], units: 60, time: 15, req: ['oil', 'defense'],
                       desc: 'Torreta lanzallamas que quema petróleo.' },
  ship_link2:        { name: 'Señal de la Nave 2',   packs: ['sci_red', 'sci_green'], units: 60, time: 12, req: ['ship_link1', 'logistic_science'],
                       desc: 'La Nave llega a 35 casillas y cada antena a 16.' },
  vehicles2:         { name: 'Automóviles',          packs: ['sci_red', 'sci_green'], units: 60, time: 12, req: ['vehicles1', 'advanced_assembly'],
                       desc: 'Auto: más rápido y con más baúl.' },
  vehicles3:         { name: 'Blindados',            packs: ['sci_red', 'sci_green'], units: 90, time: 15, req: ['vehicles2', 'weapons1'],
                       desc: 'Camioneta blindada con ametralladora.' },
  big_poles:         { name: 'Alta tensión',         packs: ['sci_red', 'sci_green'], units: 50, time: 12, req: ['electricity'],
                       desc: 'Torres que llevan energía a 24 casillas.' },
  railway:           { name: 'Trenes',               packs: ['sci_red', 'sci_green'], units: 75, time: 15, req: ['logistics2', 'advanced_assembly'],
                       desc: 'Vías, estaciones y trenes para traer recursos de lejos.' },
  oil:               { name: 'Petróleo',             packs: ['sci_red', 'sci_green'], units: 100, time: 15, req: ['advanced_assembly', 'steam_power'],
                       desc: 'Bomba de petróleo, planta química, plástico y azufre.' },
  solar:             { name: 'Energía solar',        packs: ['sci_red', 'sci_green'], units: 100, time: 15, req: ['silicon'],
                       desc: 'Paneles solares.' },
  silicon:           { name: 'Electrónica avanzada', packs: ['sci_red', 'sci_green'], units: 100, time: 15, req: ['oil'],
                       desc: 'Silicio a partir de cuarzo, y procesadores.' },
  chemical_science:  { name: 'Ciencia azul',         packs: ['sci_red', 'sci_green'], units: 75, time: 15, req: ['silicon'],
                       desc: 'Receta del pack de ciencia azul.' },
  logistic_network:  { name: 'Red logística',        packs: ['sci_red', 'sci_green', 'sci_blue'], units: 75, time: 20, req: ['chemical_science', 'receivers'],
                       desc: 'Los brazos pueden sacar del inventario de la Nave a través de cualquier Receptor.' },
  modules:           { name: 'Módulos',              packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['chemical_science'],
                       desc: 'Módulos de velocidad, productividad y eficiencia para máquinas eléctricas y laboratorios.' },
  batteries:         { name: 'Baterías',             packs: ['sci_red', 'sci_green', 'sci_blue'], units: 75, time: 20, req: ['chemical_science'],
                       desc: 'Baterías y acumuladores.' },
  inserters3:        { name: 'Brazos de carga',      packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['chemical_science', 'logistics2'],
                       desc: 'Brazo de carga: lleva 4 objetos por vuelta.' },
  production3:       { name: 'Ensamblaje 3',         packs: ['sci_red', 'sci_green', 'sci_blue'], units: 150, time: 20, req: ['modules', 'advanced_assembly'],
                       desc: 'Ensambladora 3: el triple de rápida, con 4 módulos.' },
  advanced_oil:      { name: 'Refinado avanzado',    packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['chemical_science', 'oil'],
                       desc: 'Refinería: todas las recetas del petróleo, al triple.' },
  effect_transmission: { name: 'Transmisión de efectos', packs: ['sci_red', 'sci_green', 'sci_blue'], units: 150, time: 20, req: ['modules'],
                       desc: 'Faro: comparte módulos con las máquinas de alrededor.' },
  electric_distribution2: { name: 'Subestaciones',   packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['electric_distribution', 'chemical_science'],
                       desc: 'Subestación: alimenta un área enorme.' },
  artillery:         { name: 'Artillería',           packs: ['sci_red', 'sci_green', 'sci_blue'], units: 200, time: 25, req: ['weapons2', 'advanced_assembly'],
                       desc: 'Torreta de artillería que bombardea nidos lejanos, y sus proyectiles.' },
  ship_link3:        { name: 'Señal de la Nave 3',   packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['ship_link2', 'chemical_science'],
                       desc: 'La Nave llega a 60 casillas y cada antena a 24.' },
  vehicles4:         { name: 'Tanques',              packs: ['sci_red', 'sci_green', 'sci_blue'], units: 150, time: 20, req: ['vehicles3', 'chemical_science'],
                       desc: 'Tanque con cañón, y sus balas de cañón.' },
  logistics3:        { name: 'Logística 3',          packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['logistics2', 'chemical_science'],
                       desc: 'Cinta exprés.' },
  weapons2:          { name: 'Armas 2',              packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['weapons1', 'chemical_science'],
                       desc: '+50 % más de daño en torretas.' },
  laser_turrets:     { name: 'Torretas láser',       packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['batteries', 'defense'],
                       desc: 'Torretas que no necesitan munición.' },
  signal_network:    { name: 'Red de señales',      packs: ['sci_red', 'sci_green'], units: 60, time: 12, req: ['electricity'],
                       desc: 'Sensores que mandan valores a 8 canales de colores, y condiciones para prender o apagar máquinas, brazos, cintas, bombas y lámparas.' },
  logistic_robots:   { name: 'Robots logísticos',    packs: ['sci_red', 'sci_green', 'sci_blue'], units: 150, time: 20, req: ['construction_robots'],
                       desc: 'Cada puerto suma 5 robots que llevan objetos de cofres de provisión y de la Nave a cofres de pedido.' },
  construction_robots: { name: 'Robots de construcción', packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['electric_engines', 'batteries'],
                       desc: 'Robots que construyen planos sin materiales a la espera, reconstruyen y reparan.' },
  titanium:          { name: 'Metalurgia de titanio', packs: ['sci_red', 'sci_green', 'sci_blue'], units: 150, time: 20, req: ['chemical_science'],
                       desc: 'Placas de titanio, estructura liviana y placas de casco.' },
  electric_engines:  { name: 'Motores eléctricos',   packs: ['sci_red', 'sci_green', 'sci_blue'], units: 100, time: 20, req: ['chemical_science'],
                       desc: 'Lubricante (petróleo + agua) y motores eléctricos.' },
  control_units:     { name: 'Unidades de control',  packs: ['sci_red', 'sci_green', 'sci_blue'], units: 120, time: 20, req: ['batteries'],
                       desc: 'Procesador + batería: el cerebro de la nave.' },
  space_science:     { name: 'Ciencia espacial',     packs: ['sci_red', 'sci_green', 'sci_blue'], units: 200, time: 25, req: ['titanium', 'control_units'],
                       desc: 'Receta del pack de ciencia espacial.' },
  vehicles5:         { name: 'Aerodeslizador',       packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'], units: 200, time: 25, req: ['vehicles4', 'space_science'],
                       desc: 'Aerodeslizador: el más rápido, cruza el agua y tiene láser.' },
  rocketry:          { name: 'Cohetería',            packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'], units: 300, time: 30, req: ['space_science', 'electric_engines'],
                       desc: 'Astillero, propulsores, navegación, soporte vital y combustible de cohete.' },
  // Etapa 2: limpiar el planeta (se desbloquea al llegar al espacio)
  air_purification:  { name: 'Purificación del aire', stage: 2, packs: ['sci_red', 'sci_green', 'sci_blue'], units: 150, time: 20, req: ['chemical_science'],
                       desc: 'Purificadores, filtros de aire y viveros que plantan árboles.' },
  orbital_strike:    { name: 'Ataque orbital',       stage: 2, packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'], units: 250, time: 25, req: ['rocketry'],
                       desc: 'Explosivos, cargas orbitales y el Enlace orbital que borra nidos en cualquier lugar del planeta.' },
  // Etapa 3: escapar del sistema solar (se desbloquea con el planeta limpio)
  superconductors:   { name: 'Superconductores',     stage: 3, packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'], units: 400, time: 30, req: ['rocketry'],
                       desc: 'Superconductores (cobre + titanio + lubricante) y procesadores cuánticos.' },
  star_science:      { name: 'Ciencia estelar',      stage: 3, packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'], units: 500, time: 30, req: ['superconductors'],
                       desc: 'Receta del pack de ciencia estelar.' },
  fusion:            { name: 'Fusión',               stage: 3, packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple', 'sci_star'], units: 300, time: 35, req: ['star_science'],
                       desc: 'Núcleos de fusión y la Planta de fusión: 8 MW limpios.' },
  warp_drive:        { name: 'Motor de curvatura',   stage: 3, packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple', 'sci_star'], units: 400, time: 35, req: ['fusion'],
                       desc: 'El motor que dobla el espacio para salir del sistema solar.' },
  starship:          { name: 'Arca estelar',         stage: 3, packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple', 'sci_star'], units: 500, time: 40, req: ['warp_drive'],
                       desc: 'Dique estelar, módulos de hábitat y escudos deflectores.' },
  // Infinitas: cada nivel cuesta 1,5 veces más que el anterior
  inf_lab:           { name: 'Velocidad de investigación', infinite: true, packs: ['sci_red', 'sci_green', 'sci_blue'], units: 80, time: 20, req: ['chemical_science'],
                       desc: '+10 % de velocidad de los laboratorios por nivel.' },
  inf_drill:         { name: 'Velocidad de taladros', infinite: true, packs: ['sci_red', 'sci_green', 'sci_blue'], units: 80, time: 20, req: ['chemical_science'],
                       desc: '+10 % de velocidad de extracción por nivel.' },
  inf_mining:        { name: 'Productividad minera',  infinite: true, packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'], units: 100, time: 30, req: ['space_science'],
                       desc: '+10 % de mineral extra por nivel, sin gastar el yacimiento.' },
  inf_weapons:       { name: 'Daño de armas',         infinite: true, packs: ['sci_red', 'sci_green', 'sci_blue', 'sci_purple'], units: 100, time: 30, req: ['weapons2', 'space_science'],
                       desc: '+10 % de daño en torretas por nivel.' },
};
const TECH_ORDER = Object.keys(TECHS);

// Módulos: ranuras por máquina y efecto de cada uno
const MODULE_SLOTS = { assembler2: 2, assembler3: 4, chem: 2, refinery: 3, efurnace: 2, eminer: 2, lab: 2, beacon: 2 };
const MODULES = {
  speed_module: { speed: 0.2, power: 0.5 },
  prod_module:  { speed: -0.15, power: 0.4, prod: 0.1, poll: 0.1 },
  eff_module:   { power: -0.3 },
};

// Eras: se avanza al investigar ciertas tecnologías
const ERAS = [
  { name: 'Era mecánica',  tech: null },
  { name: 'Era eléctrica', tech: 'electricity' },
  { name: 'Era química',   tech: 'oil' },
  { name: 'Era espacial',  tech: 'space_science' },
  { name: 'Era estelar',   tech: 'superconductors' },
];

// Lo que necesita la nave para despegar
const SHIP = { hull: 120, thruster: 40, nav_computer: 20, life_support: 25, rocket_fuel: 300 };
// Y el Arca estelar, para la etapa final
const ARK = { hull: 280, warp_drive: 16, fusion_core: 20, habitat: 28, shield: 28, nav_computer: 40, rocket_fuel: 550 };
const shipNeeds = (e) => (e.type === 'starport' ? ARK : SHIP);

// Las tres etapas del juego
const STAGES = [
  { name: 'Llegar al espacio',         icon: '🚀', desc: 'Armá la nave en el Astillero y lanzala a la órbita.' },
  { name: 'Limpiar el planeta',        icon: '🌱', desc: 'Borrá todos los nidos y dejá el aire limpio durante 5 minutos.' },
  { name: 'Escapar del sistema solar', icon: '🌌', desc: 'Armá el Arca estelar en el Dique estelar y despegá.' },
];
const CLEAN_TARGET = 30;   // polución total máxima para considerar el aire limpio
const CLEAN_TIME = 300;    // segundos seguidos de aire limpio

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
let PW = Math.ceil(W / POLL_CELL), PH = Math.ceil(H / POLL_CELL);
function setMapSize(w, h) {
  W = w; H = h;
  PW = Math.ceil(W / POLL_CELL); PH = Math.ceil(H / POLL_CELL);
}
const BITERS = {
  small:  { name: 'Bicho chico',   hp: 15,  dmg: 7,  speed: 1.6, cost: 4,  size: 5,  color: '#b5803a' },
  medium: { name: 'Bicho mediano', hp: 80,  dmg: 15, speed: 1.4, cost: 20, size: 7,  color: '#8b4f9e' },
  big:    { name: 'Bicho grande',  hp: 380, dmg: 35, speed: 1.2, cost: 80, size: 10, color: '#4f6e3a' },
};
const NEST_HP = 400;
const SAFE_RADIUS = 55; // sin nidos cerca de la Nave al empezar
