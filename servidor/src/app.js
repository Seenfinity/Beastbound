// Las rutas del servidor. No sabe de puertos ni de Postgres: recibe la base de datos y el verificador ya montados.
//   GET  /salud      → comprobación de vida
//   GET  /partida    → la partida guardada del jugador (404 si aún no tiene)
//   POST /acciones   → { rev, actions: [{ k, a, t }] }: lo que ha hecho el jugador. El servidor lo repite con las reglas
//                      del juego y su reloj, guarda el resultado y devuelve la partida buena. 409 si otro dispositivo jugó antes
//   DELETE /partida  → empezar de cero (el perfil se queda)
//
// La partida la lleva el servidor: no se puede subir una partida entera, solo decir qué se ha hecho. Editar los números
// en el navegador o adelantar el reloj del dispositivo no cambia nada de lo que aquí se guarda.
//   PUT  /perfil     → usuario y país; 409 si el usuario ya existe
//   GET  /ranking    → los primeros, por nivel, oro o victorias
import { randomInt } from 'node:crypto';
import * as DB from './db.js';
import * as S from '../reglas/state.js';
import { apply, create, Reject, SERVER } from '../reglas/acciones.js';

const MAX_BODY = 300 * 1024, MIN_GAP = 600, MAX_ACTIONS = 300;
const SKEW = 1500;                                       // cuánto puede adelantarse la hora de una acción a la del servidor
const secure = () => randomInt(0, 2 ** 32) / 2 ** 32;    // el azar de lo que sortea solo el servidor
const NAME = /^[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ]{3,16}$/, COUNTRY = /^[A-Z]{2}$/;
const int = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;

// Las cifras del ranking de una partida. null si no es una partida.
export function inspect(save) {
  if (!save || typeof save !== 'object' || Array.isArray(save) || save.v !== 3) return null;
  if (!Array.isArray(save.pets) || save.pets.length > S.MAX_PETS || !Array.isArray(save.eggs)) return null;
  if (!int(save.coins, 0, 5e7) || !int(save.wins || 0, 0, 1e7) || !int(save.losses || 0, 0, 1e7)) return null;
  for (const p of save.pets) if (!p || typeof p.species !== 'string' || !int(p.level, 1, S.MAX_LEVEL) || !int(p.stage, 0, 2)) return null;
  return { level: Math.max(1, ...save.pets.map(p => Math.floor(p.level))), coins: Math.floor(save.coins), wins: Math.floor(save.wins || 0), losses: Math.floor(save.losses || 0), testMode: !!save.tested };
}

// Deja lista una partida guardada: le pone lo que le falte (las de antes no traían semilla ni zona horaria)
// y le quita lo que solo tiene sentido en el navegador. null si no vale.
function prepare(save) {
  S.clock.random = secure;
  let g;
  try { g = S.adopt(save); } finally { S.clock.random = null; }
  if (!g) return null;
  g.tz ??= 0;
  if (g.testMode) g.tested = true;                       // se jugó con el tiempo acelerado: sigue fuera del ranking
  g.testMode = false;                                    // el modo prueba solo existe en el ordenador de desarrollo
  g.news = [];                                           // los avisos son cosa de la pantalla
  delete g.owner;
  return g;
}

// Repite en la partida lo que dice haber hecho el jugador. Devuelve { g, result, resync }:
// resync es true si alguna acción no valía (se corta ahí y el juego debe quedarse con la partida del servidor).
export function replay(g, actions, now = Date.now()) {
  let result, resync = false;
  for (const a of actions) {
    result = undefined;
    try {
      if (!a || typeof a.k !== 'string' || !Array.isArray(a.a)) throw new Reject('forma');
      // La hora de la acción: la que dice el juego, pero nunca anterior a la última ni posterior a la del servidor.
      const t = Math.min(now + SKEW, Math.max(Number.isFinite(a.t) ? Math.floor(a.t) : now, g?.clock || 0));
      if (a.k === 'new') {                               // partida nueva: solo si aún no hay bestias
        if (g?.pets.length) throw new Reject('ya hay partida');
        g = prepare({ ...JSON.parse(JSON.stringify(create(t, secure))), testMode: false, tz: 0 });
        continue;
      }
      if (!g) throw new Reject('sin partida');
      const before = JSON.stringify(g);                  // si la acción falla a medias, se deshace
      try { const out = apply(g, a.k, a.a, t, secure); if (SERVER.has(a.k)) result = out; }
      catch (err) { g = prepare(JSON.parse(before)); throw err; }
    } catch (err) {
      if (!(err instanceof Reject)) console.error('acción con error', a?.k, err);
      resync = true;
      break;
    }
  }
  if (g) g.news = [];
  return { g, result, resync };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('demasiado grande'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); } catch { reject(Object.assign(new Error('JSON no válido'), { status: 400 })); } });
    req.on('error', reject);
  });
}

export function createApp({ pool, verify, origins = [] }) {
  const lastPut = new Map();
  const allowed = new Set(origins);

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x'), origin = req.headers.origin;
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && allowed.has(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' });
    const send = (status, body) => { res.writeHead(status, headers); res.end(body === undefined ? '' : JSON.stringify(body)); };
    const who = async () => {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
      if (!m) return null;
      try { return await verify(m[1]); } catch { return null; }
    };

    try {
      if (req.method === 'OPTIONS') return send(204);
      const route = `${req.method} ${url.pathname}`;

      if (route === 'GET /salud') { await pool.query('select 1'); return send(200, { ok: true }); }

      if (route === 'GET /ranking') {
        const me = await who(), rows = await DB.ranking(pool, url.searchParams.get('sort'));
        return send(200, { rows: rows.map(r => ({ name: r.username, country: r.country, level: r.level, coins: r.coins, wins: r.wins, losses: r.losses, ...(r.id === me ? { me: true } : {}) })) });
      }

      const id = await who();
      if (!id) return send(401, { error: 'sesion' });

      if (route === 'GET /partida') {
        const p = await DB.getPlayer(pool, id);
        if (!p) return send(404, { error: 'sin-partida', now: Date.now() });
        const profile = { name: p.username || '', country: p.country || '' };
        let save = null;
        if (p.save) {                                    // una partida de antes: se le pone lo que le falte, una vez
          const was = JSON.stringify(p.save);
          save = prepare(p.save);
          if (save) { save.profile = profile; if (JSON.stringify(save) !== was) await DB.fixSave(pool, id, save, p.rev); }
        }
        return send(200, { save, rev: p.rev, profile, now: Date.now() });
      }

      if (route === 'POST /acciones') {
        const now = Date.now();
        if (now - (lastPut.get(id) || 0) < MIN_GAP) return send(429, { error: 'despacio' });
        lastPut.set(id, now);
        if (lastPut.size > 5000) for (const [k, t] of lastPut) if (now - t > 60000) lastPut.delete(k);
        const body = await readJson(req);
        if (!body || !Number.isInteger(body.rev) || !Array.isArray(body.actions) || !body.actions.length || body.actions.length > MAX_ACTIONS) return send(400, { error: 'acciones' });
        const p = await DB.getPlayer(pool, id);
        if (p?.save && p.rev !== body.rev) return send(409, { error: 'conflicto', save: prepare(p.save), rev: p.rev, now });
        const { g, result, resync } = replay(p?.save ? prepare(p.save) : null, body.actions, now);
        if (!g) return send(400, { error: 'sin-partida' });
        g.profile = { name: p?.username || '', country: p?.country || '' };
        const stats = inspect(g);
        if (!stats) return send(400, { error: 'partida' });
        const out = await DB.putSave(pool, id, g, stats, body.rev);
        if (out.conflict) return send(409, { error: 'conflicto', save: out.conflict.save ? prepare(out.conflict.save) : null, rev: out.conflict.rev, now });
        return send(200, { rev: out.rev, save: g, result, resync, now: Date.now() });
      }

      if (route === 'PUT /partida') return send(410, { error: 'version' });   // el juego de antes subía la partida entera: ya no se acepta

      if (route === 'DELETE /partida') return send(200, { rev: await DB.clearSave(pool, id) });

      if (route === 'PUT /perfil') {
        const body = await readJson(req);
        if (!body || !NAME.test(body.name || '') || !COUNTRY.test(body.country || '')) return send(400, { error: 'perfil' });
        if (!(await DB.setProfile(pool, id, body.name, body.country))) return send(409, { error: 'usuario-ocupado' });
        return send(200, { ok: true });
      }

      return send(404, { error: 'ruta' });
    } catch (err) {
      if (err.status) return send(err.status, { error: err.message });
      console.error(err);
      return send(500, { error: 'servidor' });
    }
  };
}
