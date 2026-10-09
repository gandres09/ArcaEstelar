#!/usr/bin/env node
// =====================================================================
//  Servidor de Arca Estelar para la compu que queda siempre prendida.
//
//  - Sirve el juego (abrís http://esta-compu:8080 y jugás).
//  - Guarda el mundo en el disco (carpeta server/datos), así nunca se pierde.
//  - Reparte lo que hace cada jugador por WebSocket (sin conexión directa
//    entre compus, que es lo que fallaba).
//  - Abre solo un Chrome invisible que lleva la simulación del mundo.
//
//  Uso:  node server/arca-server.mjs            (o doble clic en iniciar-servidor)
//        node server/arca-server.mjs --nuevo    (mundo nuevo; el viejo queda en datos/copias)
//  Opciones: --puerto 8080  --tamano enorme|grande|normal  --sin-chrome  --pacifico
//  No necesita instalar nada más que Node.js (18 o más nuevo) y Chrome o Edge.
// =====================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');                 // la carpeta del juego
const DATA = path.join(HERE, 'datos');
const STORE_FILE = path.join(DATA, 'mundo.json');
const BACKUPS = path.join(DATA, 'copias');

const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);
const PORT = +arg('puerto', process.env.PORT || 8080);
const SIZE = arg('tamano', 'enorme');
// La dirección pública (la de Tailscale Funnel). Se puede poner a mano con --url; si no, se averigua sola.
let PUBLIC_URL = arg('url', process.env.ARCA_URL || '');
function findPublicUrl() {
  if (arg('url', process.env.ARCA_URL || '')) return;
  const exe = process.platform === 'win32' ? 'tailscale.exe' : 'tailscale';
  const cands = process.platform === 'win32' ? [exe, 'C:\\Program Files\\Tailscale\\tailscale.exe'] : [exe, '/Applications/Tailscale.app/Contents/MacOS/Tailscale'];
  const tryOne = (i) => {
    if (i >= cands.length) return;
    let out = '';
    let p;
    try { p = spawn(cands[i], ['status', '--json'], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { tryOne(i + 1); return; }
    p.on('error', () => tryOne(i + 1));
    p.stdout.on('data', (d) => { out += d; });
    p.on('exit', (code) => {
      if (code !== 0) { tryOne(i + 1); return; }
      try {
        const name = String(JSON.parse(out).Self.DNSName || '').replace(/\.$/, '');
        if (name && ('https://' + name) !== PUBLIC_URL) { PUBLIC_URL = 'https://' + name; log('🌍 Dirección para jugar desde cualquier lado: ' + PUBLIC_URL); }
      } catch (_) { /* nada */ }
    });
  };
  tryOne(0);
}
findPublicUrl();
setInterval(findPublicUrl, 10 * 60 * 1000);
const TOKEN = crypto.randomBytes(12).toString('hex');   // solo para el Chrome del servidor

const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);
fs.mkdirSync(BACKUPS, { recursive: true });

// --------------------------- Datos guardados ---------------------------

let store = new Map();
let dirty = false, lastSave = 0;
function backup(tag) {
  if (!fs.existsSync(STORE_FILE)) return;
  const name = new Date().toISOString().replace(/[:.]/g, '-') + (tag ? '-' + tag : '') + '.json';
  fs.copyFileSync(STORE_FILE, path.join(BACKUPS, name));
  // Se quedan las 30 más nuevas
  const all = fs.readdirSync(BACKUPS).filter((f) => f.endsWith('.json')).sort();
  for (const f of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(BACKUPS, f));
}
if (flag('nuevo')) { backup('antes-de-mundo-nuevo'); try { fs.unlinkSync(STORE_FILE); } catch (_) { /* no había */ } log('🌱 Mundo nuevo: el anterior quedó guardado en server/datos/copias.'); }
try {
  if (fs.existsSync(STORE_FILE)) {
    store = new Map(Object.entries(JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))));
    log(`💾 Mundo cargado del disco (${store.size} partes).`);
  } else log('💾 Todavía no hay mundo guardado: se arma uno nuevo al arrancar.');
} catch (err) {
  log('⚠️ No se pudo leer el mundo guardado, se usa la última copia buena.', err.message);
  const all = fs.readdirSync(BACKUPS).filter((f) => f.endsWith('.json')).sort().reverse();
  for (const f of all) { try { store = new Map(Object.entries(JSON.parse(fs.readFileSync(path.join(BACKUPS, f), 'utf8')))); log('💾 Recuperado de', f); break; } catch (_) { /* la siguiente */ } }
}
function saveNow() {
  if (!dirty) return;
  dirty = false;
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(store)));
  fs.renameSync(tmp, STORE_FILE);
  lastSave = Date.now();
}
setInterval(() => { try { saveNow(); } catch (err) { log('⚠️ No se pudo guardar:', err.message); } }, 10000);
setInterval(() => { try { backup(); } catch (_) { /* nada */ } }, 3600 * 1000);   // una copia por hora

// --------------------------- Salas y reparto ---------------------------
// Lo mismo que hacía el anfitrión de la sala con código (js/p2p.js), pero acá.

const clients = new Map();   // peer -> { ws, uid, admin }
const rooms = new Map();     // nombre -> Map(peer -> { by, presence, at })
const leases = new Map();    // path -> { holder, exp }
const room = (name) => { let r = rooms.get(name); if (!r) { r = new Map(); rooms.set(name, r); } return r; };

const PART = 15000;
let msgId = 0;
function send(c, msg) {
  if (!c || !c.ws.open) return;
  const s = JSON.stringify(msg);
  if (s.length <= PART) { c.ws.sendText(s); return; }
  const id = ++msgId, n = Math.ceil(s.length / PART);
  for (let i = 0; i < n; i++) c.ws.sendText(JSON.stringify({ t: '~', id, i, n, s: s.slice(i * PART, (i + 1) * PART) }));
}
function relay(name, msg, except) {
  for (const peer of room(name).keys()) if (peer !== except) send(clients.get(peer), msg);
}
function acquire(p, holder, ttl) {
  const now = Date.now(), l = leases.get(p);
  if (l && l.exp > now && l.holder !== holder) return { acquired: false };
  leases.set(p, { holder, exp: now + (ttl || 30000) });
  return { acquired: true, holder };
}
function dropPeer(peer) {
  const c = clients.get(peer);
  clients.delete(peer);
  for (const [name, r] of rooms) if (r.delete(peer)) relay(name, { t: 'l', room: name, peer });
  if (c) log(c.admin ? '🖥️ El Chrome del servidor se desconectó.' : `👋 Salió ${c.uid}`);
}
function onMessage(peer, m) {
  const c = clients.get(peer);
  if (!c || !m || typeof m.t !== 'string') return;
  switch (m.t) {
    case 'p':
      room(m.room).set(peer, { by: c.uid, presence: m.presence || {}, at: Date.now() });
      relay(m.room, { t: 'p', room: m.room, peer, by: c.uid, presence: m.presence || {} }, peer);
      break;
    case 'j': {
      const r = room(m.room);
      r.set(peer, { by: c.uid, presence: {}, at: Date.now() });
      send(c, { t: 'room', room: m.room, members: [...r.entries()].map(([pe, o]) => [pe, o.by, o.presence]) });
      relay(m.room, { t: 'p', room: m.room, peer, by: c.uid, presence: {} }, peer);
      break;
    }
    case 'l':
      if (room(m.room).delete(peer)) relay(m.room, { t: 'l', room: m.room, peer }, peer);
      break;
    case 'set':
      // El mundo compartido lo escribe solo el Chrome del servidor
      if (c.admin && typeof m.path === 'string') {
        store.set(m.path, m.body); dirty = true;
        for (const [pe, o] of clients) if (pe !== peer) send(o, { t: 'db', path: m.path, body: m.body });
      }
      send(c, { t: 'res', rid: m.rid, val: true });
      break;
    case 'acq':
      send(c, { t: 'res', rid: m.rid, val: c.admin ? acquire(m.path, m.holder, m.ttl) : { acquired: false } });
      break;
  }
}
function onConnect(ws, req) {
  const u = new URL(req.url, 'http://x');
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'];
  const admin = local && u.searchParams.get('k') === TOKEN;
  const uid = String(u.searchParams.get('uid') || 'anon').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'anon';
  const peer = (admin ? 's' : 'c') + crypto.randomBytes(5).toString('hex');
  const c = { ws, uid, admin };
  clients.set(peer, c);
  log(admin ? '🖥️ El Chrome del servidor se conectó.' : `🎮 Entró ${uid}`);
  send(c, { t: 'hello', peer, admin });
  send(c, { t: 'dump', store: [...store.entries()] });
  const lobby = room('lobby');
  lobby.set(peer, { by: uid, presence: {}, at: Date.now() });
  send(c, { t: 'room', room: 'lobby', members: [...lobby.entries()].map(([pe, o]) => [pe, o.by, o.presence]) });
  relay('lobby', { t: 'p', room: 'lobby', peer, by: uid, presence: {} }, peer);
  const parts = new Map();
  ws.onText = (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (_) { return; }
    if (m && m.t === '~') {
      let p = parts.get(m.id);
      if (!p) { p = []; parts.set(m.id, p); }
      p[m.i] = m.s;
      if (p.filter((x) => x !== undefined).length === m.n) { parts.delete(m.id); try { onMessage(peer, JSON.parse(p.join(''))); } catch (_) { /* nada */ } }
      return;
    }
    onMessage(peer, m);
  };
  ws.onClose = () => dropPeer(peer);
}

// --------------------------- WebSocket (sin librerías) ---------------------------

function upgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 20000);
  const ws = { open: true, onText: null, onClose: null };
  const frame = (op, payload) => {
    const n = payload.length;
    const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | op; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
    socket.write(Buffer.concat([head, payload]));
  };
  ws.sendText = (s) => { if (ws.open) frame(1, Buffer.from(s, 'utf8')); };
  const close = () => { if (!ws.open) return; ws.open = false; try { socket.end(); } catch (_) { /* nada */ } if (ws.onClose) ws.onClose(); };
  let buf = Buffer.alloc(0), frag = [];
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 64 * 1024 * 1024) { close(); return; }
      const mOff = off; if (masked) off += 4;
      if (buf.length < off + len) return;
      const data = Buffer.from(buf.subarray(off, off + len));
      if (masked) for (let i = 0; i < len; i++) data[i] ^= buf[mOff + (i & 3)];
      buf = buf.subarray(off + len);
      if (op === 8) { close(); return; }
      if (op === 9) { frame(10, data); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2 || op === 0) {
        frag.push(data);
        if (fin) { const all = Buffer.concat(frag); frag = []; if (ws.onText) ws.onText(all.toString('utf8')); }
      }
    }
  });
  socket.on('close', close);
  socket.on('error', close);
  // Un latido para que los túneles no corten la conexión por estar quieta
  const beat = setInterval(() => { if (!ws.open) { clearInterval(beat); return; } try { frame(9, Buffer.alloc(0)); } catch (_) { /* nada */ } }, 25000);
  onConnect(ws, req);
}

// --------------------------- Archivos del juego ---------------------------

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serve(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/estado') {
    const players = [...clients.values()].filter((c) => !c.admin).map((c) => c.uid);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, jugadores: players, servidorConectado: [...clients.values()].some((c) => c.admin), direccion: PUBLIC_URL || null, partesGuardadas: store.size, guardadoHace: lastSave ? Math.round((Date.now() - lastSave) / 1000) + ' s' : 'todavía no' }, null, 1));
    return;
  }
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT + path.sep) || file.includes(path.sep + 'server' + path.sep) || file.includes(path.sep + '.git')) { res.writeHead(404); res.end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); res.end('No está'); return; }
    let out = body;
    if (rel === '/index.html') {
      const cfg = `<script>window.ARCA_SERVER = true; window.ARCA_NEW = ${JSON.stringify({ size: SIZE, multiBase: true, peaceful: flag('pacifico') })}; window.ARCA_URL = ${JSON.stringify(PUBLIC_URL || '')};${arg('sala-prueba') ? ` window.P2P_PUBLIC_CODE = ${JSON.stringify(arg('sala-prueba'))};` : ''}</script>`;
      out = Buffer.from(body.toString('utf8').replace('<head>', '<head>\n  ' + cfg));
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(out);
  });
}

const server = http.createServer(serve);
server.on('upgrade', (req, socket) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') { socket.destroy(); return; }
  upgrade(req, socket);
});
server.listen(PORT, () => {
  log(`🚀 Servidor de Arca Estelar andando en el puerto ${PORT}.`);
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  log(`   En esta casa (misma red wifi): ${ips.map((ip) => `http://${ip}:${PORT}`).join('  ') || `http://localhost:${PORT}`}`);
  log('   Desde afuera: usá la dirección del túnel (Tailscale Funnel o Cloudflare). Ver server/LEEME.md');
  if (!flag('sin-chrome')) startChrome();
  else log(`   Abrí en Chrome: http://localhost:${PORT}/?servidor=ws&k=${TOKEN}`);
});

// --------------------------- El Chrome que lleva el mundo ---------------------------

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const pf = process.env['PROGRAMFILES'] || 'C:\\Program Files', pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', la = process.env.LOCALAPPDATA || '';
  const list = process.platform === 'win32'
    ? [`${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, `${la}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/opt/pw-browsers/chromium'];
  return list.find((p) => p && fs.existsSync(p)) || null;
}
let chrome = null, chromeStarts = 0;
function startChrome() {
  const exe = findChrome();
  if (!exe) { log(`⚠️ No encontré Chrome ni Edge. Abrí a mano en esta compu: http://localhost:${PORT}/?servidor=ws&k=${TOKEN}`); return; }
  const profile = path.join(DATA, 'perfil-chrome');
  chromeStarts++;
  chrome = spawn(exe, [
    '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-extensions', '--disable-gpu', ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []),
    `http://localhost:${PORT}/?servidor=ws&k=${TOKEN}`,
  ], { stdio: 'ignore' });
  log('🖥️ Abrí el Chrome invisible que lleva el mundo.');
  chrome.on('exit', () => { chrome = null; if (!quitting) { log('⚠️ El Chrome del servidor se cerró: lo vuelvo a abrir.'); setTimeout(startChrome, 5000); } });
}
// Si el Chrome deja de responder un buen rato, se reinicia
let adminGoneAt = 0;
setInterval(() => {
  if (flag('sin-chrome') || !chrome) return;
  const ok = [...clients.values()].some((c) => c.admin);
  if (ok) { adminGoneAt = 0; return; }
  if (!adminGoneAt) adminGoneAt = Date.now();
  if (Date.now() - adminGoneAt > 90000) { log('⚠️ El Chrome del servidor no responde: lo reinicio.'); adminGoneAt = 0; try { chrome.kill(); } catch (_) { /* nada */ } }
}, 10000);

let quitting = false;
function quit() {
  if (quitting) return;
  quitting = true;
  log('💾 Guardando y cerrando…');
  try { dirty = true; saveNow(); } catch (_) { /* nada */ }
  try { if (chrome) chrome.kill(); } catch (_) { /* nada */ }
  process.exit(0);
}
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
