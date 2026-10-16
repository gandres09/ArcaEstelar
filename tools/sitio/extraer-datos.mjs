import { chromium } from '/home/user/pruebas/tools/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500);
const d = await p.evaluate(() => {
  const nm = (k) => (ITEMS[k] ? ITEMS[k].name : (BUILDINGS[k] ? BUILDINGS[k].name : k));
  const unl = {};
  for (const [k, r] of Object.entries(BUILDINGS)) if (r.tech) (unl[r.tech] = unl[r.tech] || []).push(r.name);
  for (const [k, r] of Object.entries(RECIPES)) if (r.tech && ITEMS[k] && !BUILDINGS[k]) (unl[r.tech] = unl[r.tech] || []).push(ITEMS[k].name);
  const techs = TECH_ORDER.map((id) => { const t = TECHS[id]; return { id, name: t.name, desc: t.desc || '', packs: (t.packs || []).map(nm), units: t.units, time: t.time, req: (t.req || []).map((r) => TECHS[r] ? TECHS[r].name : r), unlocks: [...new Set(unl[id] || [])], infinite: !!t.infinite }; });
  const buildings = Object.entries(BUILDINGS).map(([k, x]) => ({ k, name: x.name, cat: x.cat || 'otros', desc: x.desc || '', cost: Object.entries(x.cost || {}).map(([i, n]) => n + ' ' + nm(i)).join(', '), tech: x.tech ? (TECHS[x.tech] ? TECHS[x.tech].name : x.tech) : null }));
  const creatures = Object.entries(CREATURES).map(([k, c]) => ({ name: c.name, hp: c.hp, dmg: c.dmg, boss: !!c.boss, ranged: !!c.ranged, minL: c.minL || 1, drops: (c.drops || []).map((x) => nm(x[0])) }));
  return { techs, buildings, creatures, biters: Object.values(BITERS), worms: Object.values(WORMS),
    ach: ACHIEVEMENTS.map((a) => ({ name: a.name, desc: a.desc })), pets: PET_KINDS.map((k) => ({ name: k.name, icon: k.icon, unlock: k.unlock ? unlockText(k.unlock) || 'Gratis' : 'Gratis' })),
    ship: Object.entries(SHIP).map(([k, n]) => n + ' ' + nm(k)), ark: Object.entries(ARK).map(([k, n]) => n + ' ' + nm(k)) };
});
writeFileSync(process.argv[2], JSON.stringify(d, null, 1));
console.log(d.techs.length, d.buildings.length, [...new Set(d.buildings.map((x) => x.cat))].join('|'), d.creatures.length, d.pets.map((x) => x.unlock).join('|'), d.ship.join(', '));
await b.close();
