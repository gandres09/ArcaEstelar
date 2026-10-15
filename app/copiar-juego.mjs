// Copia el juego (la misma web) a www/, que es lo que va dentro de la app.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = dirname(fileURLToPath(import.meta.url));
const juego = join(app, '..');
const www = join(app, 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www);
for (const f of ['index.html', 'style.css', 'privacidad.html', 'manifest.webmanifest', 'js', 'icons']) {
  cpSync(join(juego, f), join(www, f), { recursive: true });
}
// Configuración de la app: el anuncio con recompensa de AdMob. Sin ADMOB_REWARDED_ID
// se usan los anuncios de prueba de Google (sirven para probar, no pagan).
const cfg = { rewarded: process.env.ADMOB_REWARDED_ID || '', test: !process.env.ADMOB_REWARDED_ID };
const index = join(www, 'index.html');
writeFileSync(index, readFileSync(index, 'utf8').replace('<head>', `<head>\n  <script>window.ARCA_APP = ${JSON.stringify(cfg)};</script>`));
console.log('Juego copiado a', www, cfg.test ? '(anuncios de prueba)' : '(anuncios reales)');
