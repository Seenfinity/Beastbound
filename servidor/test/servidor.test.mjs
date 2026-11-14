// Pruebas del servidor con una base de datos Postgres en memoria y un verificador de sesión falso.
import http from 'node:http';
import { newDb } from 'pg-mem';
import { createApp, inspect, replay } from '../src/app.js';
import * as S from '../reglas/state.js';
import { apply, duelOf } from '../reglas/acciones.js';
import { Combat, STEP } from '../reglas/combate.js';
import * as A from '../reglas/aventura.js';
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

const GAP = 650;                                       // lo que hay que esperar entre dos envíos de la misma cuenta
const acts = (as, rev, ...actions) => call('POST', '/acciones', { as, body: { rev, actions: actions.map(([k, ...a]) => ({ k, a, t: Date.now() })) } });

let r = await call('GET', '/salud');
check('el servidor responde', r.status === 200 && r.json.ok);
r = await call('GET', '/partida');
check('sin sesión no se entra', r.status === 401);
r = await call('POST', '/acciones', { body: { rev: 0, actions: [{ k: 'new', a: [], t: 0 }] } });
check('sin sesión no se juega', r.status === 401);
r = await call('GET', '/partida', { as: 'ana' });
check('jugadora nueva: aún no tiene partida, y recibe la hora del servidor', r.status === 404 && Math.abs(r.json.now - Date.now()) < 5000);

// --- empezar: la partida la crea el servidor
r = await acts('ana', 0, ['new']);
check('la partida nueva la crea el servidor, con tres huevos a elegir', r.status === 200 && r.json.rev === 1 && r.json.save.offer.length === 3 && r.json.save.pets.length === 0 && r.json.save.coins === 30, JSON.stringify(r.json).slice(0, 200));
check('sin modo prueba y con su semilla', r.json.save.testMode === false && Number.isInteger(r.json.save.rng.s));
r = await acts('ana', 1, ['start', 0, 'Sol']);
check('jugar demasiado seguido se frena', r.status === 429);
await wait(GAP);
r = await acts('ana', 1, ['start', 0, 'Sol']);
check('abre el huevo elegido', r.status === 200 && r.json.rev === 2 && r.json.save.pets.length === 1 && r.json.save.pets[0].name === 'Sol' && r.json.save.pets[0].level === 1 && !r.json.resync, JSON.stringify(r.json).slice(0, 200));
const species = r.json.save.pets[0].species;
r = await call('GET', '/partida', { as: 'ana' });
check('la recupera igual', r.status === 200 && r.json.rev === 2 && r.json.save.pets[0].name === 'Sol' && r.json.save.pets[0].species === species && r.json.save.coins === 30);
await wait(GAP);
r = await acts('ana', 2, ['feed', 'bayas'], ['stroke'], ['buyFood', 'galleta']);
check('varias acciones de una vez: comer, acariciar y comprar', r.status === 200 && r.json.rev === 3 && r.json.save.foods.bayas === 1 && r.json.save.foods.galleta === 1 && r.json.save.coins === 28 && !r.json.resync, JSON.stringify(r.json.save.foods));
await wait(GAP);
r = await acts('ana', 2, ['feed', 'bayas']);
check('otro dispositivo con versión vieja: conflicto y devuelve la buena', r.status === 409 && r.json.rev === 3 && r.json.save.coins === 28, `${r.status}`);
r = await call('GET', '/partida', { as: 'luis' });
check('cada cuenta ve solo lo suyo', r.status === 404);

// --- lo que ya no se puede hacer
r = await call('PUT', '/partida', { as: 'ana', body: { save: { v: 3, coins: 999999, pets: [{ species: 'solaris', name: 'Sol', level: 50, stage: 2 }], eggs: [] }, rev: 3 } });
check('ya no se puede subir una partida entera', r.status === 410);
r = await call('GET', '/partida', { as: 'ana' });
check('y la partida sigue como la dejó el servidor', r.json.save.coins === 28 && r.json.save.pets[0].level === 1);
await wait(GAP);
r = await acts('ana', 3, ['buyItem', 'pocion']);
check('comprar sin monedas no cuela (y no es una trampa: solo un no)', r.status === 200 && !r.json.resync && r.json.save.coins === 28 && r.json.save.items.pocion === 0);
await wait(GAP);
r = await acts('ana', r.json.rev, ['hacerse-rica']);
check('una acción inventada se rechaza y manda la partida del servidor', r.status === 200 && r.json.resync === true && r.json.save.coins === 28);
await wait(GAP);
r = await acts('ana', r.json.rev, ['feed', { coins: 999 }]);
check('datos imposibles en una acción: rechazada', r.json.resync === true && r.json.save.coins === 28);
await wait(GAP);
r = await acts('ana', r.json.rev, ['fight']);
check('no se puede empezar un combate sin rival', r.json.resync === true && !r.json.save.fight);
await wait(GAP);
r = await acts('ana', r.json.rev, ['foe', ''], ['fight'], ['fightEnd', [], 4000]);
check('decir que has ganado sin haber jugado no cuela: el combate se queda empezado y sin premio', r.json.resync === true && r.json.save.wins === 0 && r.json.save.coins === 28 && !!r.json.save.fight && r.json.save.pets[0].energy < 100, JSON.stringify({ w: r.json.save.wins, c: r.json.save.coins }));
await wait(GAP);
r = await acts('ana', r.json.rev, ['train', 1]);
check('entrenar sin haber empezado el entrenamiento: rechazado', r.json.resync === true && r.json.save.pets[0].trainsToday === 0);
await wait(GAP);
r = await acts('ana', r.json.rev, ['evolve']);
check('evolucionar sin nivel ni días: rechazado', r.json.resync === true && r.json.save.pets[0].stage === 0);
await wait(GAP);
r = await call('POST', '/acciones', { as: 'ana', body: { rev: r.json.rev, actions: [{ k: 'tick', a: [], t: Date.now() + 30 * 864e5 }] } });
check('una acción con fecha del mes que viene se queda en la hora del servidor', r.status === 200 && r.json.save.clock <= Date.now() + 2000, `${r.json.save.clock - Date.now()}`);
await wait(GAP);
r = await call('POST', '/acciones', { as: 'ana', body: { rev: r.json.rev, actions: Array(400).fill({ k: 'stroke', a: [], t: 0 }) } });
check('demasiadas acciones de golpe: no', r.status === 400);
const anaRev = (await call('GET', '/partida', { as: 'ana' })).json.rev;
r = await call('POST', '/acciones', { as: 'gordo', body: { rev: 0, actions: [{ k: 'new', a: ['x'.repeat(400 * 1024)], t: 0 }] } }).catch(e => ({ status: 413, err: String(e) }));
check('rechaza envíos enormes', r.status === 413, `${r.status}`);
r = await acts('nadie', 0, ['feed', 'bayas']);
check('sin partida no se puede hacer nada', r.status === 400);

// --- las mismas reglas, con el reloj en la mano (sin pasar por la red)
const fresh = t => { let { g } = replay(null, [{ k: 'new', a: [], t }], t); ({ g } = replay(g, [{ k: 'start', a: [1, 'Uno'], t }], t)); return g; };
const T0 = 1800000000000, HOUR = 3600e3, DAY = 24 * HOUR;
let g = fresh(T0), res;
g.coins = 500;
({ g, result: res } = replay(g, [{ k: 'buyEgg', a: [], t: T0 }], T0));
check('comprar un huevo: el servidor dice cuál toca', g.eggs.length === 1 && res.species === g.eggs[0].species && g.coins === 400);
({ g, result: res, resync: r } = replay(g, [{ k: 'hatch', a: [0, 'Dos'], t: T0 + 10 * DAY }], T0 + HOUR));
check('adelantar el reloj del dispositivo no abre el huevo', !r && !!res.error && g.eggs.length === 1 && g.pets.length === 1 && g.clock <= T0 + HOUR + 2000);
({ g, result: res } = replay(g, [{ k: 'hatch', a: [0, 'Dos'], t: T0 + 3 * DAY + 1000 }], T0 + 3 * DAY + 1000));
check('a los tres días de verdad sí se abre', !res.error && g.pets.length === 2 && g.pets[1].name === 'Dos' && g.active === 1 && g.eggs.length === 0);
// --- combates: el resultado lo pone el servidor, repitiendo lo que hizo la jugadora
// Un jugador automático que juega el combate apuntado en la partida (g.fight) con el mismo motor que usa el juego.
function botPlay(fight, { potion = false, good = true } = {}) {
  const d = duelOf(fight), sim = new Combat(d.player, d.rival, d.map, d.seed, d.opts).start();
  let k = fight.seed >>> 0;
  const rnd = () => { k = (k + 0x6d2b79f5) | 0; let t = Math.imul(k ^ (k >>> 15), 1 | k); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let wait = 0;
  while (!sim.ended && sim.tick < 120 * 60 * 20) {
    if (sim.canAct() && !sim.stepLeft && !sim.hold) {
      if (wait <= 0) wait = 30 + Math.floor(rnd() * 120);
      if (--wait === 0) {
        const f = sim.player, tgt = sim.rival;
        if (potion && f.hp < f.maxHp && sim.useItem('pocion')) { wait = 10; continue; }
        let best = null;
        for (let i = 0; i < (good ? 400 : 1); i++) {
          const angle = tgt.x > f.x ? 10 + rnd() * 72 : 98 + rnd() * 72, power = 25 + rnd() * 75, end = sim.trace(...sim.muzzle(f, angle), angle, power).end;
          if (!end) continue;
          const dd = Math.abs(end[0] - tgt.x) + Math.abs(end[1] - tgt.y) * 0.3;
          if (!best || dd < best.d) best = { d: dd, angle, power };
        }
        f.angle = good && best ? best.angle : 90; f.power = good && best ? best.power : 20;
        sim.fire(-1);
      }
    }
    sim.step(STEP);
  }
  return { log: JSON.parse(JSON.stringify(sim.log)), result: sim.result() };
}
const ms = ticks => Math.ceil((ticks / 120) * 1000) + 2000;      // lo que tarda de verdad un combate de esos pasos
// Juega un combate libre entero sobre la partida y devuelve lo que pasó.
function fightOnce(g, t, opts) {
  ({ g } = replay(g, [{ k: 'foe', a: [''], t }, { k: 'fight', a: [], t: t + 1000 }], t + 2000));
  const played = botPlay(g.fight, opts), before = { coins: g.coins, wins: g.wins, losses: g.losses || 0 }, end = t + 1000 + ms(played.result.ticks);
  const done = replay(g, [{ k: 'fightEnd', a: [played.log, played.result.ticks], t: end }], end + 1000);
  return { ...done, played, before, end };
}
let won = null, lost = null, t = T0;
g = fresh(T0);
for (let i = 0; i < 12 && !(won && lost); i++) {
  g.pets[0].energy = 100; g.pets[0].restUntil = 0;
  const f = fightOnce(g, t, { good: i % 2 === 0 });
  g = f.g; t = f.end + 5000;
  if (f.resync) { won = lost = null; check('un combate jugado de verdad se da por bueno', false, JSON.stringify(f.played.result)); break; }
  if (f.result.out.win && !won) won = f; else if (!f.result.out.win && !lost) lost = f;
}
check('un combate ganado de verdad: el servidor lo repite y paga', !!won && won.result.out.win === won.played.result.win && won.g.wins === won.before.wins + 1 && won.g.coins > won.before.coins && !won.g.fight && won.result.out.hpLeft === won.played.result.hpLeft, won ? JSON.stringify(won.result.out) : 'no ganó ninguno');
check('un combate perdido de verdad cuenta como derrota', !!lost && lost.g.losses === lost.before.losses + 1 && lost.g.wins === lost.before.wins && lost.g.coins <= lost.before.coins, lost ? JSON.stringify(lost.result.out) : 'no perdió ninguno');
g.pets[0].energy = 100; g.pets[0].restUntil = 0;
({ g } = replay(g, [{ k: 'foe', a: [''], t }, { k: 'fight', a: [], t: t + 1000 }], t + 2000));
const fair = botPlay(g.fight), stamp = t + 1000 + ms(fair.result.ticks), money = g.coins, victories = g.wins;
({ g, resync: r } = replay(g, [{ k: 'fightEnd', a: [fair.log, fair.result.ticks], t: t + 3000 }], t + 4000));
check('un combate no puede durar más que el tiempo que ha pasado de verdad', r === true && !!g.fight && g.wins === victories);
({ g, resync: r } = replay(g, [{ k: 'fightEnd', a: [[], fair.result.ticks], t: stamp }], stamp + 1000));
check('sin nada apuntado no hay resultado que valga', r === true && !!g.fight && g.coins === money);
const forged = fair.log.map(e => [...e]); forged[forged.length - 1][2] = 12.5;                 // el último disparo, cambiado a mano
({ g, resync: r } = replay(g, [{ k: 'fightEnd', a: [forged, fair.result.ticks], t: stamp }], stamp + 1000));
check('cambiar a mano un disparo: el combate ya no acaba donde dice y no se acepta', r === true && !!g.fight && g.wins === victories && g.coins === money);
({ g, resync: r } = replay(g, [{ k: 'fightEnd', a: [[[0, 'ganar'], [5, 'fire', 'x', {}, null], [9, 'item', 'bomba']], 400], t: stamp }], stamp + 1000));
check('apuntes sin sentido tampoco', r === true && !!g.fight);
({ g, resync: r, result: res } = replay(g, [{ k: 'fightEnd', a: [fair.log, fair.result.ticks], t: stamp }], stamp + 1000));
check('y el combate de verdad sigue valiendo después de los intentos', !r && res.out.win === fair.result.win && !g.fight);
const paid = g.coins;
({ g, resync: r } = replay(g, [{ k: 'fightEnd', a: [fair.log, fair.result.ticks], t: stamp + 2000 }], stamp + 3000));
check('un combate no se cobra dos veces', r === true && g.coins === paid);
// objetos: se gastan los que se usan, y no se pueden usar más de los que hay
t = stamp + 10000; g.pets[0].energy = 100; g.pets[0].restUntil = 0; g.items.pocion = 1;
({ g } = replay(g, [{ k: 'foe', a: [''], t }, { k: 'fight', a: [], t: t + 1000 }], t + 2000));
const sip = botPlay(g.fight, { potion: true });
({ g, resync: r, result: res } = replay(g, [{ k: 'fightEnd', a: [sip.log, sip.result.ticks], t: t + 1000 + ms(sip.result.ticks) }], t + 2000 + ms(sip.result.ticks)));
check('la poción usada en el combate se descuenta, y solo había una', !r && res.out.used.length === sip.result.used.length && sip.result.used.length <= 1 && g.items.pocion === 1 - sip.result.used.length, JSON.stringify(sip.result.used));
// en la expedición: se entra con la vida que queda y el resultado sigue con ella
t += 600000; g.pets[0].energy = 100; g.pets[0].restUntil = 0;
({ g } = replay(g, [{ k: 'advStart', a: ['islas'], t }], t));
const beast = A.zoneOf(g).pois.find(p => p.type === 'wild');
g.adv.hp = 0.5;
({ g } = replay(g, [{ k: 'fight', a: [beast.id], t: t + 1000 }], t + 2000));
const trek = botPlay(g.fight), need = duelOf(g.fight);
({ g, resync: r, result: res } = replay(g, [{ k: 'fightEnd', a: [trek.log, trek.result.ticks], t: t + 1000 + ms(trek.result.ticks) }], t + 2000 + ms(trek.result.ticks)));
check('en la expedición el combate empieza con la vida que queda', need.opts.hp === 0.5 && need.rival.pet.level === beast.level && !r);
check('y al acabar la expedición sigue (o termina) según diga el servidor', res.out.win ? g.adv.hp === res.out.hpLeft && g.adv.done.includes(beast.id) : g.adv === null, JSON.stringify(res.out));
g = fresh(T0); g.pets[0].energy = 10;
({ g, resync: r } = replay(g, [{ k: 'foe', a: [''], t: T0 }, { k: 'fight', a: [], t: T0 }], T0 + 1000));
check('sin energía no hay combate', r === true && !g.fight);
g = fresh(T0);
({ g, resync: r } = replay(g, [{ k: 'trainStart', a: ['pot'], t: T0 }, { k: 'train', a: [1], t: T0 + 5000 }], T0 + 6000));
const pot = g.pets[0].stats.pot;
check('un entrenamiento de verdad sube la estadística', !r && g.pets[0].trainsToday === 1 && !g.training);
({ g } = replay(g, [1, 2, 3, 4].flatMap(i => [{ k: 'trainStart', a: ['pot'], t: T0 + i * 10000 }, { k: 'train', a: [1], t: T0 + i * 10000 + 5000 }]), T0 + 60000));
check('solo tres entrenamientos al día, por mucho que se pidan', g.pets[0].trainsToday === 3 && g.pets[0].trained.pot === 3 && g.pets[0].stats.pot >= pot + 2, `${g.pets[0].trainsToday} ${g.pets[0].trained.pot}`);
g = fresh(T0); g.pets[0].level = 10;
({ g, resync: r } = replay(g, [{ k: 'evolve', a: [], t: T0 + DAY }], T0 + DAY));
check('con nivel pero sin los días de vida no evoluciona', r === true && g.pets[0].stage === 0);
({ g, resync: r } = replay(g, [{ k: 'evolve', a: [], t: T0 + 3 * DAY + 1000 }], T0 + 3 * DAY + 1000));
check('con nivel y sus tres días, sí', !r && g.pets[0].stage === 1);
g = fresh(T0);
({ g } = replay(g, [{ k: 'advStart', a: ['forja'], t: T0 }], T0));
check('una región cerrada no se abre pidiéndola', !g.adv);
({ g } = replay(g, [{ k: 'advStart', a: ['islas'], t: T0 }, { k: 'advChest', a: ['c1'], t: T0 + 1000 }, { k: 'advChest', a: ['c1'], t: T0 + 2000 }, { k: 'advChest', a: ['no-existe'], t: T0 + 3000 }], T0 + 5000));
check('un cofre se abre una sola vez, y solo si existe en esa zona', g.adv?.region === 'islas' && g.advChests.length === 1, JSON.stringify(g.advChests));
// El juego y el servidor sacan lo mismo: las mismas acciones sobre la misma partida dan la misma partida
g = fresh(T0);
const script = [{ k: 'tz', a: [120], t: T0 }, { k: 'daily', a: [], t: T0 + 500 }, { k: 'feed', a: ['bayas'], t: T0 + 1000 }, { k: 'stroke', a: [], t: T0 + 2000 }, { k: 'play', a: [], t: T0 + 3000 },
  { k: 'tick', a: [], t: T0 + 2 * HOUR }, { k: 'tick', a: [], t: T0 + 5 * HOUR }, { k: 'event', a: [], t: T0 + 5 * HOUR + 1 }, { k: 'eventPick', a: [0], t: T0 + 5 * HOUR + 2 },
  { k: 'foe', a: [''], t: T0 + 6 * HOUR }, { k: 'buyFood', a: ['galleta'], t: T0 + 6 * HOUR + 10 }, { k: 'trainStart', a: ['pun'], t: T0 + 7 * HOUR }, { k: 'train', a: [0.9], t: T0 + 7 * HOUR + 9000 }, { k: 'tick', a: [], t: T0 + 30 * HOUR }];
const mine = S.adopt(JSON.parse(JSON.stringify(g)));
for (const a of script) apply(mine, a.k, a.a, a.t);         // así lo aplica el juego
mine.news = [];
({ g, resync: r } = replay(g, script, T0 + 31 * HOUR));    // y así el servidor
check('el juego y el servidor llegan a la misma partida', !r && JSON.stringify(mine) === JSON.stringify(g) && !!g.foe && g.pets[0].trainsToday === 0 && g.tz === 120 && g.missions.length === 3);
check('las cifras del ranking salen de la partida del servidor', inspect(g).level === g.pets[0].level && inspect(g).wins === g.wins && inspect(g).testMode === false && inspect('hola') === null && inspect({ v: 2 }) === null);

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
check('y en el ranking salen las cifras de verdad, no las que se intentaron colar', r.json.rows[0].level === 1 && r.json.rows[0].coins === 28 && r.json.rows[0].wins === 0, JSON.stringify(r.json.rows[0]));
r = await call('GET', '/partida', { as: 'luis' });
check('con perfil pero sin partida: devuelve el perfil y ninguna partida', r.status === 200 && r.json.save === null && r.json.rev === 0 && r.json.profile.name === 'LuisRex');
r = await acts('luis', 0, ['new']);
await wait(GAP);
r = await acts('luis', r.json.rev, ['start', 2, 'Rayo'], ['foe', '']);
check('la partida de quien ya tenía perfil lleva su ficha', r.status === 200 && r.json.save.profile.name === 'LuisRex' && r.json.save.profile.country === 'MX' && r.json.save.pets[0].name === 'Rayo', JSON.stringify(r.json).slice(0, 160));
r = await call('GET', '/ranking?sort=level', { as: 'luis' });
check('ranking por nivel, marcando tu fila', r.json.rows.map(x => x.name).sort().join() === 'AnaPixel,LuisRex' && r.json.rows.find(x => x.name === 'LuisRex').me === true && !r.json.rows.find(x => x.name === 'AnaPixel').me);
r = await call('GET', '/ranking?sort=coins');
check('ranking por oro', r.json.rows.map(x => x.name).join() === 'LuisRex,AnaPixel');
r = await call('GET', '/ranking?sort=wins;drop table players');
check('un orden raro no rompe nada', r.status === 200 && r.json.rows.length === 2);
check('el ranking no enseña identificadores', !JSON.stringify(r.json).includes('did:privy'));

// una partida de antes (sin semilla ni zona horaria): se completa al leerla y sigue valiendo
await pool.query("insert into players (id, save, level, coins, wins, losses, test_mode, rev) values ('did:privy:vieja', $1, 7, 120, 4, 1, true, 5)",
  [JSON.stringify({ v: 3, coins: 120, wins: 4, losses: 1, testMode: true, eggs: [], active: 0, seen: [], foods: {}, lastTick: Date.now() - 60000, lastEvent: Date.now(), pets: [{ species: 'solaris', name: 'Sol', level: 7, exp: 0, stage: 0, stats: { pot: 5, agu: 5, pun: 5, agi: 5 }, hunger: 50, energy: 80, mood: 60, bond: 30, axes: { carino: 0, disciplina: 0, bravura: 0, descuido: 0 }, diet: {}, trained: { pot: 0, agu: 0, pun: 0, agi: 0 }, diary: [], born: Date.now() - 864e5, day: '' }] })]);
r = await call('GET', '/partida', { as: 'vieja' });
check('una partida de antes se completa al leerla', r.status === 200 && r.json.rev === 5 && Number.isInteger(r.json.save.rng.s) && r.json.save.tz === 0 && r.json.save.testMode === false && r.json.save.pets[0].level === 7);
const seed = r.json.save.rng.s;
r = await acts('vieja', 5, ['stroke']);
check('pero, como se jugó en modo prueba, sigue sin salir en el ranking', r.json.save.tested === true && !(await call('GET', '/ranking')).json.rows.some(x => x.level === 7));
check('y se puede seguir jugando con ella, con la misma semilla', r.status === 200 && r.json.rev === 6 && r.json.save.rng.s === seed && r.json.save.pets[0].strokesToday === 1, JSON.stringify(r.json).slice(0, 200));

// empezar de cero
r = await call('DELETE', '/partida', { as: 'ana' });
check('empezar de cero borra la partida', r.status === 200 && r.json.rev === anaRev + 1, JSON.stringify(r.json));
r = await call('GET', '/partida', { as: 'ana' });
check('y conserva el perfil', r.json.save === null && r.json.profile.name === 'AnaPixel' && r.json.rev === anaRev + 1);
r = await call('GET', '/ranking');
check('sin partida sale del ranking', !r.json.rows.some(x => x.name === 'AnaPixel'));
await wait(GAP);
r = await acts('ana', anaRev + 1, ['new']);
check('la partida nueva se crea encima', r.status === 200 && r.json.rev === anaRev + 2 && r.json.save.pets.length === 0 && r.json.save.coins === 30);
await wait(GAP);
r = await acts('ana', anaRev + 2, ['start', 0, 'Luna'], ['new']);
check('con una bestia ya no se puede pedir otra partida nueva sin borrar', r.json.resync === true && r.json.save.pets[0].name === 'Luna');

// CORS
r = await call('GET', '/salud', { origin: 'https://www.beastbound.fun' });
check('la web del juego puede llamar', r.cors === 'https://www.beastbound.fun');
r = await call('GET', '/salud', { origin: 'https://otra-web.com' });
check('otras webs no', r.cors === null);
const pre = await fetch(base + '/acciones', { method: 'OPTIONS', headers: { Origin: 'https://www.beastbound.fun', 'Access-Control-Request-Method': 'POST' } });
check('responde a la consulta previa del navegador', pre.status === 204 && /POST/.test(pre.headers.get('access-control-allow-methods') || ''));
r = await call('GET', '/nada', { as: 'ana' });
check('ruta desconocida', r.status === 404);

server.close();
console.log(out.join('\n'));
const bad = out.filter(l => l.startsWith('FALLA')).length;
console.log(`\n${out.length - bad} de ${out.length} correctas`);
process.exit(bad ? 1 : 0);
