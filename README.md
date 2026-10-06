# Arca Estelar

Un juego de automatización para el navegador, inspirado en Factorio. Te estrellaste en un planeta
desconocido y la única forma de salir es levantar una fábrica cada vez más grande. El juego tiene
**tres etapas**: llegar al espacio, limpiar el planeta y escapar del sistema solar en un **Arca estelar**.

Está hecho con HTML, CSS y JavaScript puro: no necesita instalar nada. Abrí `index.html` en el
navegador (doble clic alcanza). Funciona con mouse y teclado, y en el celular.

## Qué tiene

- **Personaje**: arrancás con cero ítems. Extraés a mano, fabricás a mano y construís dentro de tu alcance; si
  mandás a construir lejos, camina hasta ahí. Lleva una mochila y cerca del Núcleo usa también lo guardado ahí.
  El modo **Clásico** (sin personaje, con materiales iniciales) sigue disponible en Nuevo juego.
- **Perrito de compañía**: te sigue o se queda sentado donde lo dejes; se lo alimenta, se lo acaricia, se le pone
  nombre y se elige su color (marrón, negro, blanco o dorado). Sube hasta el nivel 10 con comida, mimos y compañía
  (collar, medallita, pañuelo, vuelta de alegría y corona); dura media hora de juego con la panza llena; después pasa media hora con hambre y, si nadie le da de comer, se escapa y se
  puede adoptar otro. En línea, cada uno ve el perro de los demás con su nivel.
- **Gráficos** con terreno orgánico (pasto, tierra, arena, agua con profundidad y espuma), bosques, yacimientos con
  rocas y cristales, edificios con relieve, cintas por nivel (amarilla, roja y azul), humo y luces de noche.
- **Tres etapas**: 🚀 lanzar la nave a la órbita (desde ahí se ve todo el mapa) · 🌱 borrar todos los nidos con
  ataques orbitales y dejar el aire limpio con purificadores (los bosques también absorben polución) · 🌌 armar y
  lanzar el Arca estelar con superconductores, ciencia estelar, fusión y motores de curvatura.
- **Mapa enorme que da la vuelta** (640 × 480): saliendo por un borde se entra por el opuesto, sin costuras.
  Yacimientos que se agotan, cuarzo, titanio y pozos de petróleo lejos del centro.
- **Investigación con laboratorios** y 5 packs de ciencia (roja, verde, azul, espacial y estelar), 43 tecnologías, 4 infinitas y 5 eras.
- **En línea (cooperativo)**: abierto desde su link de Claude, varios jugadores comparten la misma fábrica en
  tiempo real, cada uno con su personaje y su mochila. Quien comparte la partida es el anfitrión: su navegador lleva
  la simulación y guarda el mundo cada pocos segundos; si se va, otro con permiso de edición toma la posta.
  Cada jugador elige su **nombre de usuario**, que se ve arriba de su personaje (★ = anfitrión).
  Lista de **amigos** con quién está conectado y en qué mundo, invitación con un toque (al otro le aparece un aviso
  para unirse) y un mundo propio por jugador con permiso de edición. La primera vez se invita por email desde
  Compartir.
- **Madera**: los árboles se talan con la mano (o construyendo encima) y dan madera, que sirve de combustible,
  para el cofre de madera y para el vivero. Los bosques absorben polución: talarlos tiene su costo, y el vivero
  vuelve a plantar.
- **Electricidad**: generadores a carbón, energía a vapor, paneles solares, acumuladores, postes y torres de alta tensión.
- **Agua infinita** en lagos: bombas de agua en la orilla para calderas y química. Los bichos no la cruzan
  (la rodean buscando camino) y se puede rellenar con piedra.
- **Niebla**: el mapa se descubre al construir y con radares; no se construye en lo que no exploraste.
- **Día y noche**: los paneles rinden 100 % de día, 50 % al atardecer y al amanecer, y nada de noche. Las lámparas iluminan.
- **Polución y enemigos**: las máquinas contaminan, la nube se expande y cuando llega a los nidos los bichos atacan.
  Evolucionan con el tiempo y aparecen nidos nuevos. Te defendés con muros, torretas con munición y torretas láser.
  Se puede jugar en modo pacífico.
- **Cintas de dos carriles** como en Factorio: carga lateral, curvas que conservan el carril, brazos que dejan en el
  carril de enfrente; subterráneas, divisores y filtros conservan el carril.
- **Robots logísticos**: cofres de provisión y cofres de pedido (con objetos y cantidades); los robots traen lo
  pedido desde los cofres de provisión o el Núcleo, dentro de la zona de los puertos.
- **Trenes con señales y horarios**: las señales cortan la vía en tramos para que anden varios trenes; cada tren
  tiene paradas con condición (esperar, hasta llenarse, hasta vaciarse) y las estaciones tienen nombre.
- **Biblioteca de planos** (tecla B): guardar lo copiado con nombre y miniatura, pegarlo, pasarlo como código y
  compartirlo en línea.
- **Red de señales**: sensores que mandan valores a 8 canales de colores y condiciones para prender o apagar
  máquinas, brazos, cintas, bombas, generadores y lámparas.
- **Logística**: cintas en 3 velocidades, subterráneas, divisores, filtros, cofres, **brazos insertadores** (normales,
  rápidos y con filtro) y **receptores** que entregan al Núcleo desde cualquier lugar. Con la Red logística, los
  brazos también sacan del inventario a través de los receptores.
- **Líquidos**: cañerías que se conectan solas y tanques de 2.500 forman redes de un solo líquido (agua, petróleo,
  vapor o lubricante). Las máquinas que producen líquido lo vuelcan apuntando a una cañería y las que lo usan lo
  toman solas si la tocan. También se pueden llevar líquidos por cinta.
- **Almacenamiento**: cofre (200), cofre de acero (800), estaciones de tren (800) y el Núcleo, sin límite.
  El divisor puede repartir por turnos o darle prioridad a una salida.
- **Trenes**: vías que se conectan solas, estaciones de carga y descarga, y trenes que las recorren quemando carbón.
- **Robots de construcción**: lo que construís o pegás sin materiales queda como plano y los robots lo arman cuando
  llegan; también reconstruyen lo que destruyen los bichos y reparan.
- **Módulos** de velocidad, productividad y eficiencia, e **investigaciones infinitas** para después de la nave.
- **Sonido y música** generados en el momento (con volumen en el menú), **23 logros** y **gráficos de producción**.
- **Química**: bombas de petróleo y planta química para plástico, azufre, baterías y combustible de cohete.
- **Construcción cómoda**: doble toque para construir, cintas de punto a punto, deshacer, copiar y pegar zonas
  y desarmar zonas enteras.
- **Guardado** automático en el navegador y en la nube (una copia privada en tu cuenta que vuelve sola si el navegador borra la partida, por ejemplo Safari en iPhone), y como código para copiar y cargar en otro lado.

## La nave

| Pieza | Cantidad | Se hace con |
| --- | --- | --- |
| Placa de casco | 120 | estructura liviana (acero + cobre + plástico) + titanio |
| Propulsor | 40 | motores eléctricos (motor + circuitos + lubricante) + combustible de cohete + titanio |
| Computadora de navegación | 20 | unidades de control (procesador + batería) + procesadores |
| Soporte vital | 25 | unidad de control + motor eléctrico + agua |
| Combustible de cohete | 300 | combustible sólido + petróleo |

Y el **Arca estelar** (etapa 3), en el Dique estelar:

| Pieza | Cantidad | Se hace con |
| --- | --- | --- |
| Placa de casco | 280 | igual que en la nave |
| Motor de curvatura | 16 | núcleo de fusión + propulsores + procesadores cuánticos |
| Núcleo de fusión | 20 | superconductores + procesadores cuánticos + acero + titanio |
| Módulo de hábitat | 28 | casco + soporte vital + plástico |
| Escudo deflector | 28 | superconductores + baterías + procesadores cuánticos |
| Computadora de navegación | 40 | igual que en la nave |
| Combustible de cohete | 550 | igual que en la nave |

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
| Caminar (modo personaje) | tocar el suelo | `WASD` o clic en el suelo |
| Extraer a mano | tocar el mineral con la mano | clic en el mineral |
| Centrar en el personaje | 🎯 | 🎯 |
| Mover y zoom | arrastrar y pellizcar | arrastrar, rueda (`WASD` en modo clásico) |
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
- `js/pet.js`: el perrito (seguir, sentarse, comer, mimos y su dibujo).
- `js/online.js`: el modo en línea (presencia de los jugadores, acciones y fotos del mundo).
- `js/player.js`: el personaje (caminar, alcance, mochila, extraer y fabricar a mano).
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

## Jugar con código de sala (fuera de Claude)

El juego también funciona como página común, por ejemplo en GitHub Pages
(`https://gandres09.github.io/ArcaEstelar/`). Ahí, en ☰ → En línea, uno toca
**Crear sala con mi partida** y le pasa el código de 8 caracteres al otro, que lo
escribe en **Unirme**. La conexión es directa entre los navegadores (WebRTC con
PeerJS para el primer contacto); la compu de quien crea la sala lleva la partida.
