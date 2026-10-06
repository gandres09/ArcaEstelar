// Corre el jugador automático en un navegador sin ventana y muestra cuánto tarda cada etapa.
// Requiere Playwright:  npm i playwright   ·   Uso: node tools/bot.mjs [semilla] [horas máximas] [pacifico|enemigos]
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const seed = Number(process.argv[2] || 12345);
const maxHours = Number(process.argv[3] || 10);
const peaceful = (process.argv[4] || 'pacifico') === 'pacifico';

const opts = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const browser = await chromium.launch(opts);
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('file://' + path.join(here, '..', 'index.html'));
await page.evaluate(([s, p]) => { closeModals(); startNewGame(s, p, false); }, [seed, peaceful]);
await page.addScriptTag({ path: path.join(here, 'bot-core.js') });
await page.evaluate(() => BOT.init());

const t0 = Date.now();
let last = null;
for (let i = 0; i < maxHours * 6; i++) {
  last = await page.evaluate(() => BOT.run(600));
  console.log(`${last.t}  techs ${String(last.techs).padStart(2)}  edificios ${String(last.entities).padStart(5)}  investigando: ${last.research || '-'}`);
  if (last.launched || errors.length) break;
}
const out = await page.evaluate(() => ({ log: BOT.log, starved: BOT.starved, inv: S.inv, lines: BOT.lines.length, hand: BOT.handMined || 0 }));
console.log('Extraído a mano:', out.hand);
console.log('Edificios:', JSON.stringify(await page.evaluate(() => { const c = {}; for (const e of S.entities) c[e.type] = (c[e.type] || 0) + 1; return c; })));
console.log('Energía:', JSON.stringify(await page.evaluate(() => nets.map((n) => [Math.round(n.prev.demand), Math.round(n.prev.solar + n.prev.fuel), +n.sat.toFixed(2)]))));
console.log('Inventario:', JSON.stringify(await page.evaluate(() => Object.fromEntries(Object.entries(S.inv).map(([k, v]) => [k, Math.floor(v)])))));
console.log('\n--- Registro ---\n' + out.log.join('\n'));
console.log('\nFaltantes (veces que una máquina esperó un insumo):', JSON.stringify(out.starved));
console.log('Errores:', errors.length ? errors : 'ninguno');
console.log(`Simulación real: ${Math.round((Date.now() - t0) / 1000)} s`);
await browser.close();
