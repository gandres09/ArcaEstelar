# Mini Fábrica

Un juego de automatización para el navegador, inspirado en Factorio. Te estrellaste en un planeta
desconocido y la única forma de salir es levantar una fábrica cada vez más grande hasta armar una
**nave espacial**, mientras la polución despierta a los bichos del planeta.

Está hecho con HTML, CSS y JavaScript puro: no necesita instalar nada. Abrí `index.html` en el
navegador (doble clic alcanza). Funciona con mouse y teclado, y en el celular.

## Qué tiene

- **Mapa grande** (320 × 240) con yacimientos que se agotan, cuarzo, titanio y pozos de petróleo lejos del centro.
- **Investigación con laboratorios** y 4 packs de ciencia (roja, verde, azul y espacial), 27 tecnologías y 4 eras.
- **Electricidad**: generadores a carbón, energía a vapor, paneles solares, acumuladores, postes y torres de alta tensión.
- **Agua infinita** en lagos: bombas de agua en la orilla para calderas y química. Los bichos no la cruzan
  (la rodean buscando camino) y se puede rellenar con piedra.
- **Niebla**: el mapa se descubre al construir y con radares; no se construye en lo que no exploraste.
- **Día y noche**: los paneles rinden 100 % de día, 50 % al atardecer y al amanecer, y nada de noche. Las lámparas iluminan.
- **Polución y enemigos**: las máquinas contaminan, la nube se expande y cuando llega a los nidos los bichos atacan.
  Evolucionan con el tiempo y aparecen nidos nuevos. Te defendés con muros, torretas con munición y torretas láser.
  Se puede jugar en modo pacífico.
- **Logística**: cintas en 3 velocidades, subterráneas, divisores, filtros y cofres.
- **Química**: bombas de petróleo y planta química para plástico, azufre, baterías y combustible de cohete.
- **Construcción cómoda**: doble toque para construir, cintas de punto a punto, deshacer, copiar y pegar zonas
  y desarmar zonas enteras.
- **Guardado** automático en el navegador y como código para copiar y cargar en otro lado.

## La nave

| Pieza | Cantidad | Se hace con |
| --- | --- | --- |
| Placa de casco | 50 | estructura liviana (acero + cobre + plástico) + titanio |
| Propulsor | 16 | motores eléctricos (motor + circuitos + lubricante) + combustible de cohete + titanio |
| Computadora de navegación | 8 | unidades de control (procesador + batería) + procesadores |
| Soporte vital | 10 | unidad de control + motor eléctrico + agua |
| Combustible de cohete | 120 | combustible sólido + petróleo |

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
- `js/render.js`: dibujo de todo lo que se ve, la noche y el despegue.
- `js/ui.js`: paneles, inspector, investigación, menú y estadísticas.
- `js/input.js`: mouse, táctil y teclado.
- `js/main.js`: arranque, guardado, exportar/importar y bucle principal.
