// Pruebas del servidor con una base de datos Postgres en memoria y un verificador de sesión falso.
import http from 'node:http';
import { newDb } from 'pg-mem';
import { createApp, inspect } from '../src/app.js';
import { migrate } from '../src/db.js';

const pool = new (newDb({ noAstCoverageCheck: true }).adapters.createPg().Pool)();
await migrate(pool);
await migrate(pool);                                     // arrancar dos veces no rompe nada
const verify = async token => { if (!token.startsWith('ok-')) throw new Error('no'); return 'did:privy:' + token.slice(3); };
const server = http.createServer(createApp({ pool, verify, origins: ['https://www.beastbound.fun'] })).listen(0);
const base = `http://localhost:${server.address().port}`;
const out = [];
const check = (name, ok, extra = '') => out.push(`${ok ? 'OK   ' : 'FALLA'} ${name}${extra ? ' — ' + extra : ''}`);
const call = async (method, path, { as, body, origin } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(as ? { Authorization: 'Bearer ok-' + as } : {}), ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null), cors: res.headers.get('access-control-allow-origin') };
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const save = (over = {}) => ({ v: 3, coins: 120, wins: 4, losses: 1, testMode: false, eggs: [], pets: [{ species: 'solaris', name: 'Sol', level: 7, stage: 0 }], profile: { name: '', country: '' }, ...over });

let r = await call('GET', '/salud');
check('el servidor responde', r.status === 200 && r.json.ok);
r = await call('GET', '/partida');
check('sin sesión no se entra', r.status === 401);
r = await call('GET', '/partida', { as: 'ana' });
check('jugadora nueva: aún no tiene partida', r.status === 404);
r = await call('PUT', '/partida', { as: 'ana', body: { save: save(), rev: 0 } });
check('guarda la primera partida', r.status === 200 && r.json.rev === 1, JSON.stringify(r.json));
r = await call('GET', '/partida', { as: 'ana' });
check('la recupera igual', r.status === 200 && r.json.rev === 1 && r.json.save.pets[0].name === 'Sol' && r.json.save.coins === 120);
r = await call('PUT', '/partida', { as: 'ana', body: { save: save({ coins: 150 }), rev: 1 } });
check('guardar demasiado seguido se frena', r.status === 429);
await wait(2100);
r = await call('PUT', '/partida', { as: 'ana', body: { save: save({ coins: 150 }), rev: 1 } });
check('guarda la siguiente versión', r.status === 200 && r.json.rev === 2);
await wait(2100);
r = await call('PUT', '/partida', { as: 'ana', body: { save: save({ coins: 999 }), rev: 1 } });
check('otro dispositivo con versión vieja: conflicto y devuelve la buena', r.status === 409 && r.json.rev === 2 && r.json.save.coins === 150, `${r.status}`);
r = await call('GET', '/partida', { as: 'luis' });
check('cada cuenta ve solo lo suyo', r.status === 404);

// partidas que no cuelan
check('rechaza monedas imposibles', inspect(save({ coins: 9e9 })) === null);
check('rechaza nivel imposible', inspect(save({ pets: [{ species: 'solaris', name: 'Sol', level: 5000, stage: 0 }] })) === null);
check('rechaza demasiadas bestias', inspect(save({ pets: Array(7).fill({ species: 'solaris', name: 'Sol', level: 2, stage: 0 }) })) === null);
check('rechaza lo que no es una partida', inspect('hola') === null && inspect({ v: 2 }) === null && inspect(null) === null);
r = await call('PUT', '/partida', { as: 'luis', body: { save: { v: 3, coins: -5, pets: [], eggs: [] }, rev: 0 } });
check('el servidor responde 400 a una partida mala', r.status === 400);
r = await call('PUT', '/partida', { as: 'gordo', body: { save: save({ relleno: 'x'.repeat(400 * 1024) }), rev: 0 } }).catch(e => ({ status: 413, err: String(e) }));
check('rechaza partidas enormes', r.status === 413, `${r.status}`);

// perfil y ranking
r = await call('PUT', '/perfil', { as: 'ana', body: { name: 'AnaPixel', country: 'ES' } });
check('guarda usuario y país', r.status === 200);
r = await call('PUT', '/perfil', { as: 'luis', body: { name: 'anapixel', country: 'MX' } });
check('el usuario es único aunque cambien mayúsculas', r.status === 409 && r.json.error === 'usuario-ocupado');
r = await call('PUT', '/perfil', { as: 'ana', body: { name: 'AnaPixel', country: 'AR' } });
check('puede cambiar su propio país sin chocar consigo misma', r.status === 200);
r = await call('PUT', '/perfil', { as: 'luis', body: { name: 'a b', country: 'MX' } });
check('rechaza usuarios no válidos', r.status === 400);
r = await call('PUT', '/perfil', { as: 'luis', body: { name: 'LuisRex', country: 'MX' } });
check('perfil antes de tener partida', r.status === 200);
r = await call('GET', '/ranking');
check('sin partida no sales en el ranking', r.status === 200 && r.json.rows.length === 1 && r.json.rows[0].name === 'AnaPixel' && r.json.rows[0].country === 'AR', JSON.stringify(r.json.rows));
r = await call('GET', '/partida', { as: 'luis' });
check('con perfil pero sin partida: devuelve el perfil y ninguna partida', r.status === 200 && r.json.save === null && r.json.rev === 0 && r.json.profile.name === 'LuisRex');
await wait(2100);
r = await call('PUT', '/partida', { as: 'luis', body: { save: save({ coins: 900, wins: 30, pets: [{ species: 'voltix', name: 'Rayo', level: 3, stage: 0 }] }), rev: 0 } });
check('guarda la partida de quien ya tenía perfil', r.status === 200 && r.json.rev === 1, JSON.stringify(r.json));
r = await call('GET', '/partida', { as: 'luis' });
check('y devuelve su perfil con la partida', r.json.profile.name === 'LuisRex' && r.json.profile.country === 'MX');
r = await call('GET', '/ranking?sort=level', { as: 'luis' });
check('ranking por nivel, marcando tu fila', r.json.rows.map(x => x.name).join() === 'AnaPixel,LuisRex' && r.json.rows[1].me === true && !r.json.rows[0].me);
r = await call('GET', '/ranking?sort=coins');
check('ranking por oro', r.json.rows.map(x => x.name).join() === 'LuisRex,AnaPixel');
r = await call('GET', '/ranking?sort=wins;drop table players');
check('un orden raro no rompe nada', r.status === 200 && r.json.rows.length === 2);
r = await call('PUT', '/partida', { as: 'trampa', body: { save: save({ testMode: true, coins: 4000 }), rev: 0 } });
await call('PUT', '/perfil', { as: 'trampa', body: { name: 'Tester', country: 'US' } });
r = await call('GET', '/ranking?sort=coins');
check('con modo prueba no se entra en el ranking', !r.json.rows.some(x => x.name === 'Tester'));
check('el ranking no enseña identificadores', !JSON.stringify(r.json).includes('did:privy'));

// empezar de cero
r = await call('DELETE', '/partida', { as: 'ana' });
check('empezar de cero borra la partida', r.status === 200 && r.json.rev === 3, JSON.stringify(r.json));
r = await call('GET', '/partida', { as: 'ana' });
check('y conserva el perfil', r.json.save === null && r.json.profile.name === 'AnaPixel' && r.json.rev === 3);
r = await call('GET', '/ranking');
check('sin partida sale del ranking', !r.json.rows.some(x => x.name === 'AnaPixel'));
await wait(2100);
r = await call('PUT', '/partida', { as: 'ana', body: { save: save({ coins: 30 }), rev: 3 } });
check('la partida nueva se guarda encima', r.status === 200 && r.json.rev === 4);

// CORS
r = await call('GET', '/salud', { origin: 'https://www.beastbound.fun' });
check('la web del juego puede llamar', r.cors === 'https://www.beastbound.fun');
r = await call('GET', '/salud', { origin: 'https://otra-web.com' });
check('otras webs no', r.cors === null);
const pre = await fetch(base + '/partida', { method: 'OPTIONS', headers: { Origin: 'https://www.beastbound.fun', 'Access-Control-Request-Method': 'PUT' } });
check('responde a la consulta previa del navegador', pre.status === 204 && /PUT/.test(pre.headers.get('access-control-allow-methods') || ''));
r = await call('GET', '/nada', { as: 'ana' });
check('ruta desconocida', r.status === 404);

server.close();
console.log(out.join('\n'));
const bad = out.filter(l => l.startsWith('FALLA')).length;
console.log(`\n${out.length - bad} de ${out.length} correctas`);
process.exit(bad ? 1 : 0);
