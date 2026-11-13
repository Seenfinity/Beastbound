// Las rutas del servidor. No sabe de puertos ni de Postgres: recibe la base de datos y el verificador ya montados.
//   GET  /salud      → comprobación de vida
//   GET  /partida    → la partida guardada del jugador (404 si aún no tiene)
//   PUT  /partida    → guarda { save, rev }; 409 si otro dispositivo guardó antes
//   DELETE /partida  → empezar de cero (el perfil se queda)
//   PUT  /perfil     → usuario y país; 409 si el usuario ya existe
//   GET  /ranking    → los primeros, por nivel, oro o victorias
import * as DB from './db.js';

const MAX_BODY = 300 * 1024, MIN_GAP = 2000;
const NAME = /^[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ]{3,16}$/, COUNTRY = /^[A-Z]{2}$/;
const int = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;

// Comprobaciones básicas de que lo que llega es una partida y no cifras imposibles. Devuelve las cifras del ranking.
export function inspect(save) {
  if (!save || typeof save !== 'object' || Array.isArray(save) || save.v !== 3) return null;
  if (!Array.isArray(save.pets) || save.pets.length < 1 || save.pets.length > 6) return null;
  if (!Array.isArray(save.eggs) || save.eggs.length > 3) return null;
  if (!int(save.coins, 0, 5e6) || !int(save.wins || 0, 0, 1e6) || !int(save.losses || 0, 0, 1e6)) return null;
  for (const p of save.pets) {
    if (!p || typeof p.species !== 'string' || p.species.length > 24 || typeof p.name !== 'string' || p.name.length > 12) return null;
    if (!int(p.level, 1, 200) || !int(p.stage, 0, 2)) return null;
  }
  return { level: Math.max(...save.pets.map(p => Math.floor(p.level))), coins: Math.floor(save.coins), wins: Math.floor(save.wins || 0), losses: Math.floor(save.losses || 0), testMode: !!save.testMode };
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
    if (origin && allowed.has(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' });
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
        if (!p) return send(404, { error: 'sin-partida' });
        return send(200, { save: p.save, rev: p.rev, profile: { name: p.username || '', country: p.country || '' } });
      }

      if (route === 'PUT /partida') {
        const now = Date.now();
        if (now - (lastPut.get(id) || 0) < MIN_GAP) return send(429, { error: 'despacio' });
        lastPut.set(id, now);
        if (lastPut.size > 5000) for (const [k, t] of lastPut) if (now - t > 60000) lastPut.delete(k);
        const body = await readJson(req), stats = inspect(body?.save);
        if (!stats || !Number.isInteger(body.rev)) return send(400, { error: 'partida' });
        const out = await DB.putSave(pool, id, body.save, stats, body.rev);
        if (out.conflict) return send(409, { error: 'conflicto', save: out.conflict.save, rev: out.conflict.rev });
        return send(200, { rev: out.rev });
      }

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
