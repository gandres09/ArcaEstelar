# Mini Fábrica

Un juego de automatización y recolección de recursos para el navegador, inspirado en Factorio.
Hecho con HTML, CSS y JavaScript puro: no necesita instalar nada.

## Cómo jugar

Abrí `index.html` en el navegador (doble clic alcanza).

1. Poné **Taladros** sobre los yacimientos de mineral.
2. Llevá el mineral con **Cintas** hasta los **Hornos**, que lo funden en placas usando carbón.
3. Mandá las placas al **Núcleo** para cumplir objetivos y desbloquear edificios nuevos.
4. Con la **Ensambladora** fabricás engranajes y circuitos.
5. Completá los 4 objetivos para lanzar el cohete 🚀.

### Controles

| Acción | Tecla |
| --- | --- |
| Elegir edificio | `1` – `6` |
| Mano (extraer, interactuar) | `Esc` o `Q` |
| Girar | `R` (`Shift+R` al revés) |
| Desarmar (devuelve el costo) | Clic derecho |
| Mover la cámara | `WASD`, flechas o arrastrar con la mano |
| Zoom | Rueda del mouse |

La partida se guarda automáticamente en el navegador.

## Edificios

| Edificio | Qué hace | Se desbloquea |
| --- | --- | --- |
| Cinta | Mueve objetos | Desde el inicio |
| Taladro | Extrae mineral | Desde el inicio |
| Horno | Mineral → placas (consume carbón) | Desde el inicio |
| Ensambladora | Engranajes y circuitos | Objetivo 1 |
| Divisor | Reparte objetos en 3 direcciones | Objetivo 2 |
| Cinta rápida | Cinta al doble de velocidad | Objetivo 3 |

## Archivos

- `index.html`: estructura de la página y la interfaz.
- `style.css`: estilos.
- `game.js`: mapa, simulación, dibujo, controles y guardado.
