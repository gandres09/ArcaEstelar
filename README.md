# Mini Fábrica

Un juego de automatización para el navegador, inspirado en Factorio. Te estrellaste en un planeta
desconocido y la única forma de salir es construir una fábrica cada vez más grande hasta armar una
**nave espacial**.

Está hecho con HTML, CSS y JavaScript puro: no necesita instalar nada. Abrí `index.html` en el
navegador (doble clic alcanza). Funciona con mouse y teclado, y también en pantallas táctiles.

## Cómo se juega

1. Poné **taladros** sobre los yacimientos. Se agotan, así que vas a tener que expandirte.
2. Llevá el mineral con **cintas** hasta los **hornos**, que lo funden en placas.
3. Mandá las placas al **Núcleo**: todo lo que entra va a tu inventario.
4. Con el inventario construís edificios e **investigás** tecnologías nuevas (13 en total).
5. Montá una **red eléctrica** con generadores y postes para las máquinas avanzadas.
6. Fabricá las piezas de la nave, llevalas al **Astillero** y ¡despegá! 🚀

El panel **Siguiente paso** te va guiando.

## La nave

| Pieza | Cantidad | Se hace con |
| --- | --- | --- |
| Placa de casco | 40 | titanio + acero |
| Propulsor | 12 | motores + titanio + procesador |
| Computadora de navegación | 6 | procesadores + circuitos |
| Soporte vital | 8 | procesadores + acero + silicio |
| Combustible de cohete | 100 | combustible sólido (de carbón) |

El cuarzo (para el silicio) aparece a media distancia del Núcleo y el titanio bien lejos.

## Controles

| Acción | Teclado / mouse | Táctil |
| --- | --- | --- |
| Elegir edificio | `1`–`9` (repetí para cambiar de variante) | barra de abajo |
| Mano: ver detalles, extraer a mano | `Esc` | botón ✋ |
| Girar | `R` (`Shift+R` al revés) | botón 🔄 |
| Desarmar (devuelve el costo) | `X` o clic derecho | botón 🗑️ |
| Copiar el edificio bajo el cursor | `Q` | — |
| Investigación | `T` | botón de arriba |
| Mover la cámara | `WASD`, flechas o arrastrar | arrastrar |
| Zoom | rueda | pellizcar |

La partida se guarda sola en el navegador.

## Archivos

- `index.html`: página e interfaz.
- `style.css`: estilos.
- `js/data.js`: objetos, recetas, edificios, investigaciones y la nave. Es el lugar para ajustar el balance.
- `js/world.js`: generación del mapa, yacimientos y dibujo del terreno.
- `js/sim.js`: simulación de edificios, cintas y electricidad.
- `js/render.js`: dibujo de edificios, objetos, minimapa y el despegue.
- `js/ui.js`: paneles, inspector, investigación y estadísticas.
- `js/input.js`: mouse, táctil y teclado.
- `js/main.js`: arranque, guardado y bucle principal.
