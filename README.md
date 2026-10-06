# Mini Fábrica

Un juego de automatización para el navegador, inspirado en Factorio. Te estrellaste en un planeta
desconocido y la única forma de salir es levantar una fábrica cada vez más grande hasta armar una
**nave espacial**, mientras la polución despierta a los bichos del planeta.

Está hecho con HTML, CSS y JavaScript puro: no necesita instalar nada. Abrí `index.html` en el
navegador (doble clic alcanza). Funciona con mouse y teclado, y en el celular.

## Qué tiene

- **Mapa grande** (320 × 240) con yacimientos que se agotan, cuarzo, titanio y pozos de petróleo lejos del centro.
- **Investigación con laboratorios** y 4 packs de ciencia (roja, verde, azul y espacial), 33 tecnologías, 4 infinitas y 4 eras.
- **Electricidad**: generadores a carbón, energía a vapor, paneles solares, acumuladores, postes y torres de alta tensión.
- **Agua infinita** en lagos: bombas de agua en la orilla para calderas y química. Los bichos no la cruzan
  (la rodean buscando camino) y se puede rellenar con piedra.
- **Niebla**: el mapa se descubre al construir y con radares; no se construye en lo que no exploraste.
- **Día y noche**: los paneles rinden 100 % de día, 50 % al atardecer y al amanecer, y nada de noche. Las lámparas iluminan.
- **Polución y enemigos**: las máquinas contaminan, la nube se expande y cuando llega a los nidos los bichos atacan.
  Evolucionan con el tiempo y aparecen nidos nuevos. Te defendés con muros, torretas con munición y torretas láser.
  Se puede jugar en modo pacífico.
- **Logística**: cintas en 3 velocidades, subterráneas, divisores, filtros, cofres, **brazos insertadores** (normales,
  rápidos y con filtro) y **receptores** que entregan al Núcleo desde cualquier lugar. Con la Red logística, los
  brazos también sacan del inventario a través de los receptores.
- **Trenes**: vías que se conectan solas, estaciones de carga y descarga, y trenes que las recorren quemando carbón.
- **Robots de construcción**: lo que construís o pegás sin materiales queda como plano y los robots lo arman cuando
  llegan; también reconstruyen lo que destruyen los bichos y reparan.
- **Módulos** de velocidad, productividad y eficiencia, e **investigaciones infinitas** para después de la nave.
- **Sonido y música** generados en el momento (con volumen en el menú), **20 logros** y **gráficos de producción**.
- **Química**: bombas de petróleo y planta química para plástico, azufre, baterías y combustible de cohete.
- **Construcción cómoda**: doble toque para construir, cintas de punto a punto, deshacer, copiar y pegar zonas
  y desarmar zonas enteras.
- **Guardado** automático en el navegador y como código para copiar y cargar en otro lado.

## La nave

| Pieza | Cantidad | Se hace con |
| --- | --- | --- |
| Placa de casco | 120 | estructura liviana (acero + cobre + plástico) + titanio |
| Propulsor | 40 | motores eléctricos (motor + circuitos + lubricante) + combustible de cohete + titanio |
| Computadora de navegación | 20 | unidades de control (procesador + batería) + procesadores |
| Soporte vital | 25 | unidad de control + motor eléctrico + agua |
| Combustible de cohete | 300 | combustible sólido + petróleo |

Para llegar hay que combinar casi todas las líneas: hierro, cobre, acero, petróleo con agua (plástico, azufre,
lubricante), baterías, procesadores con silicio y titanio.

## Controles

| Acción | Celular | Teclado y mouse |
| --- | --- | --- |
| Construir | tocar para ver, tocar de nuevo para construir | clic (arrastrar para varias) |
| Cintas | tocar inicio y fin, y confirmar | arrastrar |
| Girar | botón 🔄 | `R` |
| Desarmar | 🗑️ y tocar dos veces, o dos esquinas para una zona | `X` (arrastrar para zona) o clic derecho |
| Deshacer | botón ↶ | `Ctrl`+`Z` |
| Copiar y pegar zona | 📋 y tocar dos esquinas, después 📌 | `C` arrastrar, `V` pegar |
| Ver detalles de una máquina | tocarla con la mano | clic con la mano (`Esc`) |
| Mover y zoom | arrastrar y pellizcar | `WASD` o arrastrar, rueda |
| Investigación / polución | botones de arriba | `T` / `P` |

## Archivos

- `index.html`: página e interfaz.
- `style.css`: estilos.
- `js/data.js`: objetos, recetas, edificios, investigaciones, nave, día y noche, enemigos. **Es el lugar para ajustar el balance.**
- `js/world.js`: generación del mapa y dibujo del terreno.
- `js/sim.js`: simulación de edificios, cintas, electricidad, investigación y deshacer.
- `js/enemies.js`: polución, nidos, bichos y torretas.
- `js/trains.js`: vías, estaciones y trenes.
- `js/robots.js`: planos y robots de construcción.
- `js/audio.js`: efectos de sonido y música.
- `js/progress.js`: logros e historial de producción con su gráfico.
- `js/render.js`: dibujo de todo lo que se ve, la noche y el despegue.
- `js/ui.js`: paneles, inspector, investigación, menú y estadísticas.
- `js/input.js`: mouse, táctil y teclado.
- `js/main.js`: arranque, guardado, exportar/importar y bucle principal.

## Herramientas de balance

En `tools/` hay dos herramientas para ajustar el balance después de tocar `js/data.js`:

- **Calculadora** (`node tools/calculadora.js`): suma todo lo que hace falta para investigar el árbol completo y
  armar la nave. Muestra materias primas, segundos de máquina y segundos de laboratorio, en total y por etapa.
- **Jugador automático** (`node tools/bot.mjs [semilla] [horas] [pacifico|enemigos]`): juega una partida entera
  en un navegador sin ventana, con las reglas reales: arma líneas de taladros y hornos con cintas hasta el Núcleo,
  centrales de vapor, bombas de petróleo y agua, explora la niebla y va investigando. Para la logística intermedia
  (alimentar ensambladoras y laboratorios) simula un jugador eficiente que tiene todo bien conectado. Al final
  muestra cuándo llegó a cada era, qué le faltó y cuándo despegó la nave. Necesita Playwright
  (`npm i playwright` dentro de `tools/`).
