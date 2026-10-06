// Calculadora de balance: cuánto hace falta para investigar todo y armar la nave.
// Uso: node tools/calculadora.js
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = vm.createContext({});
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const D = vm.runInContext(code + '\n;({ ITEMS, RECIPES, SMELT, TECHS, SHIP, BUILDINGS, PACKS })', ctx);

const RAW = new Set(['iron_ore', 'copper_ore', 'coal', 'stone', 'quartz', 'titanium_ore', 'oil', 'water']);

// Receta que produce cada objeto
const producer = {};
for (const [id, r] of Object.entries(D.RECIPES)) producer[r.out] = { kind: r.machine, inputs: r.in, n: r.n, time: r.time, tier: r.tier, id };
for (const [ore, r] of Object.entries(D.SMELT)) producer[r.out] = { kind: 'smelt', inputs: { [ore]: r.n }, n: 1, time: r.time, id: r.out };

function expand(item, qty, acc) {
  if (RAW.has(item)) { acc.raw[item] = (acc.raw[item] || 0) + qty; return; }
  const p = producer[item];
  if (!p) throw new Error('Sin receta: ' + item);
  const crafts = qty / p.n;
  acc.craft[p.kind] = (acc.craft[p.kind] || 0) + crafts * p.time;
  acc.byItem[item] = (acc.byItem[item] || 0) + qty;
  for (const [k, n] of Object.entries(p.inputs)) expand(k, crafts * n, acc);
}

const newAcc = () => ({ raw: {}, craft: {}, byItem: {} });
const fmt = (n) => Math.round(n).toLocaleString('es-AR');

// 1) Investigación completa
const research = newAcc();
let labSeconds = 0;
const packTotals = {};
for (const t of Object.values(D.TECHS).filter((t) => !t.infinite)) {
  for (const p of t.packs) { packTotals[p] = (packTotals[p] || 0) + t.units; expand(p, t.units, research); }
  labSeconds += t.units * t.time;
}

// 2) La nave
const ship = newAcc();
for (const [k, n] of Object.entries(D.SHIP)) expand(k, n, ship);

// 3) Etapas de investigación (por pack más alto que usan)
const stages = {};
for (const [id, t] of Object.entries(D.TECHS).filter(([, t]) => !t.infinite)) {
  const top = t.packs[t.packs.length - 1];
  stages[top] = stages[top] || { techs: [], labSeconds: 0, acc: newAcc() };
  stages[top].techs.push(id);
  stages[top].labSeconds += t.units * t.time;
  for (const p of t.packs) expand(p, t.units, stages[top].acc);
}

function report(title, acc) {
  console.log(`\n== ${title} ==`);
  console.log('Materias primas:', Object.entries(acc.raw).map(([k, n]) => `${k} ${fmt(n)}`).join(' · '));
  console.log('Segundos de máquina (velocidad 1):', Object.entries(acc.craft).map(([k, n]) => `${k} ${fmt(n)}`).join(' · '));
}

console.log('Packs totales para investigar todo:', Object.entries(packTotals).map(([k, n]) => `${k} ${n}`).join(' · '));
console.log('Segundos de laboratorio:', fmt(labSeconds), `(con 10 labs: ${Math.round(labSeconds / 10 / 60)} min)`);
report('Toda la investigación', research);
for (const [p, s] of Object.entries(stages)) {
  report(`Etapa ${p} (${s.techs.length} techs, ${fmt(s.labSeconds)} s de lab)`, s.acc);
}
report('Nave', ship);

const total = newAcc();
for (const a of [research, ship]) {
  for (const k in a.raw) total.raw[k] = (total.raw[k] || 0) + a.raw[k];
  for (const k in a.craft) total.craft[k] = (total.craft[k] || 0) + a.craft[k];
}
report('TOTAL (investigación + nave)', total);

module.exports = { D, expand, newAcc, total, research, ship, stages, labSeconds };
