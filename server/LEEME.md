# Servidor de Arca Estelar

Un programa que corre en la compu que queda siempre prendida. Guarda el mundo en el
disco (`server/datos/mundo.json`, con copias cada hora en `server/datos/copias`),
sirve el juego y reparte lo que hace cada jugador. Un Chrome invisible lleva la
simulación del mundo; la compu servidor no tiene personaje.

## Qué hace falta

- **Node.js** 18 o más nuevo (https://nodejs.org, la versión "LTS").
- **Chrome** o **Edge** instalado (Windows ya trae Edge).
- Para jugar desde afuera de la casa: **Tailscale** (gratis), ver abajo.

No hay que instalar nada con npm.

## Arrancar

- Windows: doble clic en `server\iniciar-servidor.bat`.
- Mac/Linux: `sh server/iniciar-servidor.sh`.
- A mano: `node server/arca-server.mjs`.

La primera vez arma un mundo nuevo **enorme**, con bases separadas (cada uno elige
jugar en la base principal, o tener su base aliada o enemiga).

Opciones (se agregan al final del comando o del .bat):

- `--nuevo`: mundo nuevo desde cero (el anterior queda en `datos/copias`).
- `--tamano grande` (o `normal`, `enorme`).
- `--pacifico`: sin bichos.
- `--puerto 8080`: otro puerto.

Para ver si anda: abrir `http://localhost:8080/estado` en esa compu.

## Entrar a jugar

- En la misma casa (mismo wifi): `http://IP-DE-LA-LAPTOP:8080`. La IP la muestra la ventana del servidor al arrancar.
- Desde cualquier lado: la dirección de Tailscale Funnel (abajo), por ejemplo
  `https://laptop.tu-red.ts.net`.

Al abrir la página, el juego pide tu nombre y entra solo. Usá siempre el mismo nombre
(en la compu y en el celular) para seguir con tu personaje y tu base.

## Dirección fija para jugar desde afuera (Tailscale Funnel)

1. Instalar Tailscale (https://tailscale.com/download) e iniciar sesión.
2. En una terminal: `tailscale funnel --bg 8080`.
   La primera vez muestra un link para habilitar Funnel: abrirlo y aceptar.
3. `tailscale funnel status` muestra la dirección `https://….ts.net`. Esa es la que
   usan para jugar, y no cambia nunca.

Los jugadores **no** necesitan instalar Tailscale: solo abren esa dirección.

Alternativa sin cuenta (la dirección cambia cada vez que se reinicia):
`cloudflared tunnel --url http://localhost:8080`.

## Que arranque solo al prender la compu (Windows)

1. Apretar `Win + R`, escribir `shell:startup` y Enter.
2. Crear ahí un acceso directo a `server\iniciar-servidor.bat`.
3. En Configuración → Sistema → Energía: que la compu no se suspenda nunca (enchufada).

Tailscale ya arranca solo con Windows, y `--bg` deja el Funnel prendido.
