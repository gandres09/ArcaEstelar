# Arca Estelar · App de Android

La app es el mismo juego (la carpeta de arriba) metido en una app de Android de verdad con **Capacitor**.
Lo que agrega la app:

- **AdMob**: el regalo 🎁 usa anuncios con recompensa de AdMob (pagan más que los de la web).
- **Google Play Billing**: las compras de la tienda 🛒 van por el sistema nativo de Play y se confirman solas.
- El juego viaja **adentro** de la app: anda sin internet desde la primera vez.

Reemplaza al paquete de PWABuilder: **no hace falta** PWABuilder ni el `assetlinks.json`.

## Cómo se arma (automático)

Cada vez que se sube un cambio del juego a GitHub, se arma la app sola:

1. En GitHub, entrá al repositorio → pestaña **Actions** → **App de Android**.
2. Abrí la última corrida (la de arriba, con ✅).
3. Abajo, en **Artifacts**, bajá:
   - **arca-estelar-apk**: para instalar en tu celular y probar (`app-debug.apk`).
   - **arca-estelar-aab**: el archivo `app-release.aab` que se sube a Google Play.

También se puede arrancar a mano: **Actions → App de Android → Run workflow**.

### Instalar el APK de prueba en tu Android

1. Bajá `arca-estelar-apk` (es un .zip) en el celular y descomprimilo.
2. Tocá `app-debug.apk`. Android te va a pedir permiso para "instalar apps de origen desconocido": dáselo a tu navegador o al administrador de archivos.
3. Abrí **Arca Estelar** desde el ícono.

El APK de prueba usa **anuncios de prueba de Google** (dicen "Test Ad") y la tienda no cobra: las compras solo funcionan con la app bajada desde Play.

## Configuración (una sola vez)

En GitHub: repositorio → **Settings** → **Secrets and variables** → **Actions**.

### 1. La llave de firma (pestaña *Secrets*)

Play exige que el `.aab` venga firmado con tu **llave de subida**. Claude te la generó y te la pasó aparte. Creá dos *secrets* (**New repository secret**):

| Nombre | Valor |
|---|---|
| `ARCA_KEYSTORE_B64` | todo el texto de `ARCA_KEYSTORE_B64.txt` |
| `ARCA_KEYSTORE_PASSWORD` | el texto de `ARCA_KEYSTORE_PASSWORD.txt` |

Guardá también el archivo `arca-subida.jks` y la contraseña en un lugar seguro (Drive, pendrive).
Si se pierde, no es grave: con la firma de apps de Play (viene activada) se pide una llave nueva desde Play Console.

### 2. AdMob (pestaña *Variables*)

1. Entrá a **https://admob.google.com** con tu cuenta de Google (la misma de AdSense) y aceptá los términos.
2. **Apps → Agregar app** → Android → "¿Está publicada en una tienda?": **No** (después la vinculás) → nombre *Arca Estelar*.
3. Copiá el **ID de la app** (`ca-app-pub-4866807668376242~XXXXXXXXXX`, con `~`).
4. En la app: **Bloques de anuncios → Agregar → Recompensado**. Nombre: *Regalo de la Nave*. Recompensa: 1, *regalo*.
5. Copiá el **ID del bloque** (`ca-app-pub-4866807668376242/XXXXXXXXXX`, con `/`).
6. Pasale los dos ID a Claude, o escribilos vos en `app/admob.json` (`appId` y `rewardedId`) y subí el cambio.
   No son secretos: pueden quedar en el repositorio. La app se vuelve a armar sola con los anuncios reales.

> ⚠️ Con los anuncios reales, **no toques tus propios anuncios** (ni pidas a amigos que lo hagan para ganar plata):
> AdMob cierra la cuenta. Para probar, usá el APK sin las variables (anuncios de prueba).

### 3. Mensaje de consentimiento (Europa)

AdMob → **Privacidad y mensajes** → **GDPR** → crear un mensaje para la app y publicarlo. La app ya lo muestra sola
a los jugadores de Europa la primera vez que la abren.

### 4. app-ads.txt

AdMob pide un archivo `app-ads.txt` en el sitio del desarrollador. Ya está publicado en
`https://gandres09.github.io/app-ads.txt`: en la ficha de Play poné como sitio web `https://gandres09.github.io`.

## Subir a Google Play

Igual que en `tienda/COMO-PUBLICAR.md`, pero en vez del paquete de PWABuilder subís el `app-release.aab` de **arca-estelar-aab**.

- Cada versión nueva para Play tiene que tener un número mayor: el número sale solo (es el número de corrida de Actions).
- Cuando cambie el juego, bajás el `.aab` nuevo y lo subís en Play Console → **Crear versión**.
- En **Contenido de la app → Anuncios**: marcá que **contiene anuncios**.
- En **Seguridad de los datos**: AdMob recopila el **ID de publicidad** del dispositivo (ver `tienda/FICHA.md`).

## Para programadores

```bash
cd app
npm install
npm run sync                     # copia el juego a www/ y actualiza el proyecto de Android
cd android && ./gradlew assembleDebug   # necesita el SDK de Android (ANDROID_HOME)
```

- `copiar-juego.mjs`: copia el juego a `www/` y escribe `window.ARCA_APP = { rewarded, test }`.
- Los adaptadores nativos están en `js/tienda.js` (`IS_APP`, `nativeStoreInit`, `admobInit`).
- La llave se lee de las variables de entorno `ARCA_KEYSTORE` y `ARCA_KEYSTORE_PASSWORD` (ver `android/app/build.gradle`).
