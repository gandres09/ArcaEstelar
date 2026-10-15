# Arca Estelar en itch.io

itch.io es gratis y acepta juegos que se juegan en el navegador. En esta carpeta está todo:

| Archivo | Para qué |
|---|---|
| `arca-estelar-web.zip` | El juego (se sube tal cual, sin descomprimir) |
| `portada-630x500.png` | Imagen de portada (*Cover image*) |
| `../tienda/captura-*.png` | Capturas (*Screenshots*) |

## 1. Crear la cuenta

1. Entrá a **https://itch.io/register** y creá una cuenta. El nombre de usuario queda en la dirección del juego
   (por ejemplo `gandres09.itch.io/arca-estelar`).
2. Confirmá el correo.

## 2. Crear el juego

Arriba a la derecha: flechita al lado de tu nombre → **Upload new project**. Completá así:

- **Title**: `Arca Estelar`
- **Project URL**: `arca-estelar`
- **Short description or tagline**: `Construí fábricas, automatizá todo y escapá del planeta. Solo o con amigos.`
- **Classification**: `Games`
- **Kind of project**: **HTML** ← importante
- **Release status**: `In development` (si después lo das por terminado, lo cambiás a `Released`)
- **Pricing**: **No payments** (o *Donate*, si querés que te puedan dejar una propina)

### Uploads

1. **Upload files** → elegí `arca-estelar-web.zip`.
2. Abajo del archivo tildá **This file will be played in the browser**.

### Embed options (cómo se ve en la página)

- **Viewport dimensions**: `1280` × `720`
- Tildá **Mobile friendly** y, en *Orientation*, **Landscape**.
- Tildá **Fullscreen button**.
- Dejá sin tildar *Automatically start on page load* (así no arranca el sonido de golpe).

### Details

- **Description**: copiá el texto de abajo (la versión en español y la en inglés, una debajo de la otra).
- **Genre**: `Strategy` (o `Simulation`).
- **Tags** (hasta 10): `factory`, `automation`, `base-building`, `crafting`, `survival`, `multiplayer`, `sandbox`, `space`, `pixel-art`, `spanish`
- **App store links**: cuando esté en Google Play, pegás el link acá.
- **Custom noun**: dejalo vacío.
- **Community**: **Comments** (la gente deja comentarios y te sirve para encontrar testers).
- **Visibility & access**: primero dejalo en **Draft** y tocá **Save & view page** para ver cómo queda.
  Cuando te guste, cambialo a **Public** y guardá.

### Imágenes

- **Cover image**: `portada-630x500.png`
- **Screenshots**: las 4 de la carpeta `tienda/` (y mejor si sumás capturas de partidas de ustedes).

## 3. Texto para la descripción

**Español**

> Te estrellaste en un planeta desconocido. No tenés nada: solo tus manos, tu Nave rota y un perrito que te sigue a todos lados. La única forma de volver a casa es levantar una fábrica cada vez más grande… y construir un Arca para escapar del sistema solar.
>
> ⛏️ **Extraé y construí**: hierro, cobre, carbón y piedra a mano; después hornos, taladros y una fábrica que trabaja sola.
> ⚙️ **Automatizá todo**: cintas de dos carriles, brazos, ensambladoras, trenes con señales, robots logísticos, petróleo, energía solar, a vapor y nuclear, y circuitos.
> 🔬 **Investigá**: más de 40 tecnologías y 5 colores de ciencia, más investigaciones infinitas.
> 🛡️ **Defendete**: la contaminación despierta a los bichos. Torretas, láseres, lanzallamas, armas y armaduras.
> 🌍 **Explorá**: biomas, ruinas con botín, jefes, vehículos, tormentas eléctricas, la Luna y Vulcano.
> 🐾 **Mascotas**: perro, gato, conejo, zorro… que suben de nivel y te acompañan.
> 🤝 **Con amigos**: jugá en línea con un código de sala, en la misma base o en bases separadas, como aliados o enemigos.
>
> Funciona en la compu y en el celular. Tu partida se guarda en tu navegador.
> ¿Encontraste un error o tenés una idea? Dejala en los comentarios.

**English**

> You crash-landed on an uncharted planet with nothing but your hands, your broken ship and a little dog that won't leave your side. The only way home is to build an ever-growing factory… and an Ark to escape the solar system.
>
> ⛏️ **Mine and build**: gather iron, copper, coal and stone by hand, then furnaces, drills and a factory that runs itself.
> ⚙️ **Automate everything**: two-lane belts, inserters, assemblers, trains with signals, logistic robots, oil, solar, steam and nuclear power, and circuits.
> 🔬 **Research**: 40+ technologies, 5 science packs and infinite research.
> 🛡️ **Defend**: pollution wakes up the local bugs. Turrets, lasers, flamethrowers, weapons and armor.
> 🌍 **Explore**: biomes, ruins with loot, bosses, vehicles, thunderstorms, the Moon and Vulcan.
> 🐾 **Pets**: dog, cat, bunny, fox… they level up and follow you everywhere.
> 🤝 **Play with friends**: online with a room code, sharing one base or building rival bases.
>
> Runs on desktop and mobile browsers. Your save is stored in your browser.
> *The game is currently in Spanish.*

## 4. Después de publicarlo

- Compartí el link en Reddit (r/incremental_games, r/factorio, r/WebGames, r/IndieGaming) y en grupos de juegos indie.
- En el **Devlog** de itch.io (pestaña *Devlog* de tu juego) contá cada novedad: itch.io muestra los devlogs y te trae visitas.
- Pedí en los comentarios gente con Android que quiera probarlo en Google Play: así juntás los 12 testers.

## 5. Actualizar el juego

Cuando haya cambios, pedile a Claude que regenere `arca-estelar-web.zip`. En itch.io: **Edit game** → en el archivo viejo,
**Replace** (o borrás el viejo y subís el nuevo, tildando de nuevo *played in the browser*) → **Save**.
La partida de los jugadores no se borra al actualizar.
