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

## 6. Actualizaciones

- **Cambios del juego**: con subir a GitHub alcanza. La app abre la página, así que les llega sola a todos
  (la próxima vez que abran el juego con internet).
- **Solo hace falta subir otra versión a Play** si cambian el ícono, el nombre o la configuración del paquete.
  En ese caso se genera otro `.aab` en PWABuilder **con la misma llave** (`signing.keystore`) y un número de versión mayor.
