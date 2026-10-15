# Cómo subir Arca Estelar a Google Play

El juego ya está preparado como **app web instalable** (ícono, nombre, pantalla completa y
funciona sin internet). Para Play Store se lo "envuelve" con **PWABuilder**, que arma el paquete
de Android sin programar nada.

Dirección del juego: `https://gandres09.github.io/ArcaEstelar/`

## 1. Probar que el juego se instala (gratis, 2 minutos)

1. En el celular (Chrome), abrí la dirección del juego.
2. Menú ⋮ → **Instalar app** (o "Agregar a pantalla principal").
3. Abrilo desde el ícono: tiene que verse en pantalla completa, sin la barra del navegador.

## 2. Armar el paquete de Android con PWABuilder

1. Entrá a **https://www.pwabuilder.com**, pegá la dirección del juego y tocá **Start**.
2. Cuando termine el análisis, tocá **Package for stores** → **Android** → **Generate Package**.
3. Opciones recomendadas:
   - **Package ID**: `io.github.gandres09.arcaestelar` (no se puede cambiar después).
   - **App name**: Arca Estelar · **Launcher name**: Arca Estelar.
   - **Display mode**: Fullscreen.
   - **Signing key**: *Create new*. Completá tu nombre y una contraseña.
4. Descargá el ZIP. Adentro vienen:
   - `*.aab`: el archivo que se sube a Play.
   - `signing.keystore` y `signing-key-info.txt`: **la llave de la app. Guardala en dos lugares seguros (por ejemplo, un pendrive y Google Drive). Si se pierde, no vas a poder actualizar el juego nunca más.**
   - `assetlinks.json`: sirve para el paso 3.

## 3. Sacar la barra del navegador dentro de la app (recomendado)

Para que la app no muestre arriba la barrita con la dirección, Android tiene que comprobar que la página
es tuya. Eso se hace publicando `assetlinks.json` en la raíz del dominio:
`https://gandres09.github.io/.well-known/assetlinks.json`

Como el juego está en `gandres09.github.io/ArcaEstelar`, hace falta un repositorio aparte:

1. En GitHub, creá un repositorio público llamado exactamente **`gandres09.github.io`**.
2. Subí ahí el archivo `assetlinks.json` dentro de una carpeta `.well-known`, y un archivo vacío llamado `.nojekyll` en la raíz
   (sin él, GitHub Pages esconde las carpetas que empiezan con punto).
3. En ese repositorio: Settings → Pages → que publique desde la rama `main`.
4. Después de subir la app a Play (paso 5), Play Console muestra en **Configuración → Integridad de la app**
   una segunda huella SHA-256 (la de la firma de Google). **Agregala también** dentro de `assetlinks.json`
   (en `sha256_cert_fingerprints` van las dos huellas, separadas por coma).

Si no hacés este paso, la app funciona igual, pero se ve una barrita arriba.

## 4. Cuenta de desarrollador

1. Entrá a **https://play.google.com/console** y creá una cuenta de desarrollador (pago único de 25 dólares).
2. Te va a pedir verificar tu identidad (documento) y un teléfono.
3. Las cuentas personales nuevas tienen que hacer una **prueba cerrada con al menos 12 personas durante 14 días seguidos**
   antes de poder publicar para todos. Andá juntando ya amigos con cuenta de Google y celular Android.
   (Es la regla de 2024; puede haber cambiado, la consola te lo dice.)

## 5. Crear la app en Play Console

1. **Crear app** → nombre "Arca Estelar", idioma español, tipo **Juego**, **Gratis**.
2. **Configurar la app** (la consola te lleva paso a paso). Todo lo que hay que escribir está en `FICHA.md`:
   - Política de privacidad: `https://gandres09.github.io/ArcaEstelar/privacidad.html`
   - Acceso a la app: todo el contenido está disponible sin iniciar sesión.
   - Anuncios: **no** tiene.
   - Clasificación de contenido, público objetivo y seguridad de los datos: respuestas en `FICHA.md`.
   - Público objetivo: elegí **13 años o más** (si marcás menores, Google pide requisitos extra para familias).
3. **Ficha de la tienda**: copiá los textos de `FICHA.md` y subí las imágenes de esta carpeta.
4. **Prueba cerrada** → crear versión → subir el `.aab` → agregar los correos de los testers → publicar la prueba.
   Mandales el link de la prueba para que se unan y la instalen. Que la abran de vez en cuando durante los 14 días.
5. Pasados los 14 días con 12 testers: **Solicitar acceso a producción**, responder las preguntas sobre la prueba
   y publicar. Google la revisa (suele tardar de unas horas a unos días).

## 6. Compras dentro del juego

El juego ya trae la tienda (🛒 en el menú): Pase Fundador, Sin anuncios, Velocidad x2/x3, Investigación +50 %,
Expansión Vulcano, Pack de mascotas y Pack de estilos. En la app de Play cobra con **Google Play Billing**; en la página web avisa que
las compras están en la app.

1. En Play Console: **Monetización → Productos → Productos integrados → Crear producto**, uno por cada ID de la tabla de `FICHA.md`
   (los IDs tienen que ser exactos). Activalos.
2. Al generar el paquete en PWABuilder, en las opciones de Android activá **"Play Billing"** (en la sección de funciones / features).
3. Para probar sin pagar: en Play Console → Configuración → **Prueba de licencias**, agregá tu correo y el de los testers.
   Así las compras se hacen con una tarjeta de prueba.
4. **Verificar después de la primera compra de prueba** que la compra quede firme: Google exige que se "confirme" dentro de los 3 días
   o la devuelve sola. Si en Play Console aparecen compras reembolsadas solas, avisame y lo ajustamos.

**Códigos de regalo**: en la tienda hay "🎟️ Canjear código", que da el Pase Fundador. Sirve para amigos, testers o sorteos.

## 7. Anuncios con recompensa (el regalo 🎁)

Cada 8 minutos aparece 🎁 arriba: la Nave te manda unos 10 minutos de tu producción (o un empujón del 30 % a la investigación).
Para cobrarlo se mira un anuncio; con "Sin anuncios" o el Pase Fundador llega al instante.

Hoy, sin configurar, muestra un **anuncio de prueba** de 5 segundos. Para que sean anuncios de verdad (y paguen):

1. Creá una cuenta en **Google AdSense** (https://adsense.google.com) con la dirección del juego.
2. Pedí acceso a **AdSense para juegos (H5 Games Ads)**. Google lo revisa; puede tardar.
3. Cuando te aprueben, AdSense te da un código `ca-pub-XXXXXXXXXXXXXXXX`. Ponelo en `index.html`, dentro del `<head>`:
   `<script>window.ARCA_ADS = { client: 'ca-pub-XXXXXXXXXXXXXXXX' };</script>`
   (para probar primero: `{ client: '…', test: true }`).
4. En Play Console marcá que la app **contiene anuncios** y completá la sección de anuncios en "Seguridad de los datos".

## 8. Actualizaciones

- **Cambios del juego**: con subir a GitHub alcanza. La app abre la página, así que les llega sola a todos
  (la próxima vez que abran el juego con internet).
- **Solo hace falta subir otra versión a Play** si cambian el ícono, el nombre o la configuración del paquete.
  En ese caso se genera otro `.aab` en PWABuilder **con la misma llave** (`signing.keystore`) y un número de versión mayor.
