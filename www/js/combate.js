// El motor del combate: solo calcula. No dibuja, no suena y no sabe de pantallas (eso es battle.js).
//
// Un combate queda decidido por tres cosas: cómo son los dos bandos, la semilla de la que sale todo el azar
// (terreno, viento, pájaros, críticos, la puntería de la máquina) y lo que hace el jugador en cada instante.
// Con esas tres cosas el combate se puede repetir en cualquier sitio y sale idéntico: así lo comprobará el servidor.
//
// Para que salga idéntico en un móvil y en el servidor:
//  - el campo mide siempre lo mismo (no depende de la pantalla);
//  - el azar es propio y con semilla (el de los adornos va aparte, en battle.js);
//  - el tiempo avanza a pasos fijos de 1/120 s y lo que hace el jugador se apunta con el paso en que ocurre;
//  - senos, cosenos y exponenciales se calculan aquí con sumas y productos, porque los del navegador no dan
//    exactamente lo mismo en todos los aparatos.

import { matchup } from './roster.js';

export const WORLD = 1200;              // ancho del campo entero
export const FLOOR = 1000;              // altura a la que está el fondo del campo (lo de arriba es cielo)
export const TURN_TIME = 30;            // segundos para apuntar y disparar; si se acaban, se pierde el turno
export const STEP = 1 / 120;            // un paso de tiempo
export const STEP_LEN = 16;             // lo que avanza un paso corto
const GRAVITY = 300, WIND_K = 5;
const WARM = 1.3;                       // al empezar, el reloj del primer turno espera a que la cámara llegue
export const SIZE = [{ h: 48, r: 15 }, { h: 60, r: 19 }, { h: 74, r: 23 }]; // alto y radio de golpe por etapa
export const MAX_TICKS = 120 * 60 * 40; // un combate no dura más de 40 minutos

// --- Matemáticas iguales en todas partes ---
const TAU = 6.283185307179586, HALF_PI = 1.5707963267948966, LN2 = 0.6931471805599453;
export function dsin(x) {
  x -= TAU * Math.round(x / TAU);                                         // a [-π, π]
  if (x > HALF_PI) x = Math.PI - x; else if (x < -HALF_PI) x = -Math.PI - x;   // a [-π/2, π/2]
  const q = x * x;
  return x * (1 + q * (-1 / 6 + q * (1 / 120 + q * (-1 / 5040 + q * (1 / 362880 + q * (-1 / 39916800 + q * (1 / 6227020800 + q * (-1 / 1307674368000))))))));
}
export const dcos = x => dsin(x + HALF_PI);
export function dexp(x) {
  if (x < -700) return 0;
  if (x > 700) return Infinity;
  const k = Math.round(x / LN2), r = x - k * LN2;
  let term = 1, sum = 1;
  for (let i = 1; i <= 14; i++) { term *= r / i; sum += term; }
  let p = 1, b = k < 0 ? 0.5 : 2;
  for (let n = Math.abs(k); n > 0; n >>= 1) { if (n & 1) p *= b; b *= b; }
  return sum * p;
}
const dist = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
const rad = d => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const speedOf = power => 120 + power * 5;          // a tope, un tiro cruza todo el campo

// Azar con semilla: la misma semilla da siempre la misma tirada.
function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Terreno: ondulación suave, una meseta alta o una hondonada donde aparece cada bando
// y dos o tres obstáculos (picos o fosos) entre ambos.
function makeTerrain(rand, rnd) {
  const t = new Float32Array(WORLD);
  const base = FLOOR - rand(96, 124), a1 = rand(10, 22), f1 = rand(0.004, 0.009), p1 = rand(0, 6.28);
  const a2 = rand(4, 8), f2 = rand(0.02, 0.035), p2 = rand(0, 6.28);
  const feats = [];
  const spawn = left => {
    const high = rnd() < 0.5, x = left ? rand(110, 300) : rand(WORLD - 300, WORLD - 110);
    feats.push({ x, w: rand(70, 105), h: high ? rand(110, 200) : -rand(8, 36), flat: true });
    return { x, high };
  };
  const spawns = [spawn(true), spawn(false)];
  const n = 1 + Math.floor(rand(0, 2));               // uno o dos obstáculos entre ambos
  for (let i = 0; i < n; i++) {
    const x = 430 + ((WORLD - 860) * (i + rand(0.2, 0.8))) / n;
    feats.push(rnd() < 0.65 ? { x, w: rand(40, 76), h: rand(60, 150) } : { x, w: rand(50, 90), h: -rand(30, 60) });
  }
  for (let x = 0; x < WORLD; x++) {
    let y = base + dsin(x * f1 + p1) * a1 + dsin(x * f2 + p2) * a2;
    for (const f of feats) { const d = Math.abs(x - f.x) / f.w; y -= f.h * dexp(f.flat ? -(d * d * d * d) : -(d * d) / 2); }
    t[x] = clamp(y, FLOOR - 340, FLOOR - 26);
  }
  return { t, spawns };
}

export class Combat {
  // Cada bando: { pet: { name, stage, level, char }, prof, species: { element }, powers }.
  // map: { hazards }. seed: entero. opts: { hp, mp } con lo que entra el jugador (en la expedición), tutor (primer combate),
  // scale (solo para la demostración de la portada: bestias más grandes; en el juego siempre 1).
  // Tras crearlo hay que llamar a start().
  constructor(player, rival, map, seed, opts = {}) {
    this.map = map; this.seed = seed >>> 0; this.opts = opts;
    this.sides = [player, rival];                   // tal como llegaron: con esto, la semilla y lo apuntado se repite el combate
    this.rnd = dice(this.seed);
    this.rand = (a, b) => a + this.rnd() * (b - a);
    this.scale = opts.scale || 1;
    this.floor = FLOOR;
    this.clock = TURN_TIME; this.warm = WARM;
    this.stats = { dianas: 0, powerHits: 0 };       // lo que hizo el jugador: cuenta para las misiones
    this.itemUsed = false; this.used = [];          // objetos gastados en este combate
    const land = makeTerrain(this.rand, this.rnd);
    this.terrain = land.t; this.spawns = land.spawns;
    this.player = this.makeFighter(player, land.spawns[0].x, 1, true);
    this.rival = this.makeFighter(rival, land.spawns[1].x, -1, false);
    this.shots = [];
    this.t = 0; this.tick = 0; this.wind = 0; this.round = 0;
    this.volley = null;
    this.stepLeft = 0; this.stepDir = 1; this.hold = false;   // pasos cortos del jugador
    this.tutor = !!opts.tutor;
    this.phase = 'aim'; this.turn = this.player;
    this.ended = false; this.won = false;
    this.log = [];                                  // lo que hace el jugador: [paso, qué, ...datos]
    this.setupHazards(map.hazards || {});
  }

  start() {
    this.startTurn(this.player);
    const me = this.player, o = this.opts;          // en la expedición se entra con la vida y el MP que te queden
    if (o.hp != null) me.hp = Math.max(1, Math.round(me.maxHp * clamp(o.hp, 0, 1)));
    if (o.mp != null) me.mp = Math.min(me.maxMp, Math.max(0, o.mp));
    return this;
  }

  makeFighter(side, x, dir, isPlayer) {
    const z = SIZE[side.pet.stage];
    return {
      ...side, isPlayer, x, y: this.groundAt(x), dir, r: z.r * this.scale, h: z.h * this.scale,
      hp: side.prof.maxHp, maxHp: side.prof.maxHp, mp: side.prof.maxMp, maxMp: side.prof.maxMp,
      cds: side.powers.map(() => 0), turns: 0, angle: dir > 0 ? 55 : 125, power: 60, fuel: 0,
      shield: 0, shieldLook: 'burbuja', counter: 0, exposed: 0, poison: null, burn: null,
      frozen: false, frozenNext: false, blind: false, blindNext: false, rooted: false, rootNext: false,
      clutchUsed: false, hurt: 0, fall: 0, lunge: 0, hitDir: 0, sight: false, aimedAt: undefined, tries: 0,
    };
  }

  // --- Efectos del mapa ---
  setupHazards(h) {
    const rand = this.rand;
    // Todo se reparte por la zona central, entre los dos bandos.
    const spread = (n, make) => Array.from({ length: n }, (_, i) => make(rand(340 + ((WORLD - 680) * i) / n, 340 + ((WORLD - 680) * (i + 0.9)) / n)));
    this.rocks = spread(h.rocks ? h.rocks + 1 : 0, x => ({ x, y: Math.max(FLOOR - 560, this.groundAt(x) - rand(80, 210)), rx: rand(26, 40), ry: rand(13, 18) }));
    this.thermals = spread(h.thermals ? h.thermals + 1 : 0, x => ({ x, w: rand(34, 48) }));
    this.birds = Array.from({ length: h.birds || 0 }, (_, i) => this.newBird(i, true));
    this.gusty = !!h.gusty;
  }
  newBird(i, anywhere = false) {
    const rand = this.rand, dir = this.rnd() < 0.5 ? 1 : -1;
    return { x: anywhere ? rand(0, WORLD) : dir > 0 ? -20 : WORLD + 20, y: rand(FLOOR - 400, FLOOR - 210), dir, v: rand(36, 60), phase: i * 2.1, away: 0 };
  }
  rockAt(x, y) { return this.rocks.find(r => { const a = (x - r.x) / r.rx, b = (y - r.y) / r.ry; return a * a + b * b < 1; }); }
  lift(x) { return this.thermals.some(t => Math.abs(x - t.x) < t.w / 2) ? 560 : 0; } // empuje hacia arriba
  windNow() { return this.wind + (this.gusty ? dsin(this.t * 1.9) * 2.5 : 0); }

  groundAt(x) { return this.terrain[clamp(Math.round(x), 0, WORLD - 1)]; }
  other(f) { return f === this.player ? this.rival : this.player; }
  canAct() { return this.phase === 'aim' && this.turn === this.player; }
  canUse(f, i) { const p = f.powers[i]; return !!p && this.phase === 'aim' && this.turn === f && f.cds[i] === 0 && f.mp >= p.mp; }
  stepsLeft(f = this.player) { return Math.ceil(f.fuel / STEP_LEN - 0.05); }

  // --- Lo que se ve y se oye: aquí no hace nada; battle.js lo pone ---
  say() {}                                           // un rótulo
  note() {}                                          // un texto sobre una bestia
  puff() {}                                          // un efecto dibujado
  emit() {}                                          // todo lo demás (disparo, explosión, fin…)

  startTurn(f) {
    this.turn = f;
    for (const [key, tag] of [['burn', 'Quemadura'], ['poison', 'Veneno']]) {
      if (!f[key]) continue;
      this.hurt(f, f[key].dmg, null, tag);
      if (--f[key].turns <= 0) f[key] = null;
      if (f.hp <= 0) return this.finish();
    }
    if (f.prof.regen && f.hp < f.maxHp) this.heal(f, Math.round(f.maxHp * f.prof.regen));
    f.frozen = f.frozenNext; f.blind = f.blindNext || f.frozen; f.rooted = f.rootNext || f.frozen;
    f.frozenNext = f.blindNext = f.rootNext = false;
    f.fuel = f.rooted ? 0 : f.prof.fuel;
    f.cds = f.cds.map(c => Math.max(0, c - 1));
    if (f.turns++ > 0) f.mp = Math.min(f.maxMp, f.mp + f.prof.mpRegen);
    // El viento dura toda la ronda (tu turno y el del rival) y cambia poco: lo aprendido en un tiro sirve para el siguiente.
    if (f.isPlayer) this.wind = this.round++ ? clamp(this.wind + Math.round(this.rand(-3, 3)), -8, 8) : Math.round(this.rand(-6, 6));
    this.phase = 'aim';
    this.clock = TURN_TIME;
    this.itemUsed = false; f.sight = !!(this.tutor && f.isPlayer);   // tutor: en el primer combate se ve la trayectoria entera
    this.emit('turn', f);
    this.say(f.frozen ? `${f.pet.name} está congelado` : f.blind ? `${f.pet.name} está cegado: apunta peor` : f.rooted ? `${f.pet.name} no puede moverse` : f.isPlayer ? '¡Tu turno!' : `Turno de ${f.pet.name}`);
    if (!f.isPlayer) { this.aiTimer = 1.5; this.aiReady = false; }
  }

  muzzle(f, angle) {
    const a = rad(angle), d = f.r + 6;
    return [f.x + dcos(a) * d, f.y - f.r - dsin(a) * d];
  }

  // Simula un disparo normal (con rocas y aire caliente): es la guía de tiro y como apunta la máquina.
  trace(x, y, angle, power, limit = 0) {
    const v = speedOf(power);
    let vx = dcos(rad(angle)) * v, vy = -dsin(rad(angle)) * v;
    const pts = [];
    for (let i = 0; i < 1800; i++) {
      vx += this.wind * WIND_K * STEP; vy += (GRAVITY - this.lift(x)) * STEP;
      x += vx * STEP; y += vy * STEP;
      if (limit && i % 3 === 0) { pts.push([x, y]); if (pts.length >= limit) return { pts, end: null }; }
      if (x < -80 || x > WORLD + 80 || y > FLOOR + 60) return { pts, end: null };
      if (this.rockAt(x, y)) return { pts, end: null };
      if (x >= 0 && x < WORLD && y >= this.groundAt(x)) return { pts, end: [x, y] };
    }
    return { pts, end: null };
  }

  // --- Lo que hace el jugador ---
  // Cada cosa se apunta con el paso en que ocurre y luego se aplica: repetir el combate es volver a aplicar lo apuntado.
  input(kind, ...args) {
    this.log.push([this.tick, kind, ...args]);
    this.apply(kind, args);
  }
  apply(kind, args) {
    const f = this.player;
    if (kind === 'surrender') {
      if (this.phase === 'over') return;
      f.hp = 0;
      return this.finish(0.3);
    }
    if (!this.canAct()) return;
    if (kind === 'fire') {
      const [angle, power, index] = args;
      if (!Number.isFinite(angle) || !Number.isFinite(power)) return;
      f.angle = clamp(angle, 0, 180); f.power = clamp(power, 5, 100);
      this.shoot(Number.isInteger(index) ? index : -1);
    } else if (kind === 'nudge') {
      if (f.fuel <= 0) { if (!this.hold) this.note(f, f.rooted ? 'No puede moverse' : 'Sin pasos este turno', '#9aa0c8', 12); return; }
      this.stepDir = args[0] > 0 ? 1 : -1; this.stepLeft = STEP_LEN; this.hold = !!args[1];
    } else if (kind === 'release') {
      this.hold = false;
    } else if (kind === 'item') {
      this.spend(args[0]);
    }
  }

  // Pasos cortos: cada toque avanza un poco; si se mantiene pulsado, sigue andando.
  nudge(dir, hold = false) {
    if (!this.canAct()) return;
    this.emit('input');
    this.input('nudge', dir > 0 ? 1 : -1, hold ? 1 : 0);
  }
  release() { if (this.hold) this.input('release'); }
  fire(index = -1) {
    if (!this.canAct()) return;
    this.input('fire', this.player.angle, this.player.power, index);
  }
  surrender() {
    if (this.phase !== 'over') this.input('surrender');
  }
  // Usa un objeto de la mochila: uno por turno y sin gastar el turno. Devuelve si se pudo usar.
  useItem(id) {
    if (!this.itemOk(id)) return false;
    this.input('item', id);
    return true;
  }
  itemOk(id) {
    if (!this.canAct() || this.itemUsed) return false;
    const f = this.player;
    return id === 'pocion' ? f.hp < f.maxHp : id === 'elixir' ? f.mp < f.maxMp : id === 'escudo' ? f.shield < 0.5 : id === 'mira' ? !f.sight : false;
  }
  spend(id) {
    if (!this.itemOk(id)) return;
    const f = this.player;
    if (id === 'pocion') this.heal(f, Math.round(f.maxHp * 0.3));
    else if (id === 'elixir') { const got = Math.min(15, f.maxMp - f.mp); f.mp += got; this.note(f, `+${got} MP`, '#7fe9ff'); this.puff('mana', f.x, f.y - f.h * 0.7, f.h * 0.8, 0.8, -30); }
    else if (id === 'escudo') { f.shield = 0.5; f.shieldLook = 'burbuja'; this.note(f, 'Escudo', '#4db8ff'); }
    else if (id === 'mira') { f.sight = true; this.note(f, 'Mira', '#ffd76a'); }
    this.itemUsed = true;
    this.used.push(id);
    this.emit('item', id);
  }

  // Dispara quien tenga el turno, con el ángulo y la fuerza que tenga puestos. index: el poder que suma (-1: ninguno).
  shoot(index = -1) {
    if (this.phase !== 'aim') return;
    const f = this.turn, foe = this.other(f);
    if (index >= 0 && !this.canUse(f, index)) index = -1;
    const pw = index >= 0 ? f.powers[index] : null, sp = pw || {};
    const m = pw ? f.prof.mastery : '';
    let angle = f.angle;
    if (f.isPlayer && this.rnd() < f.prof.disobey) {
      angle += (this.rnd() < 0.5 ? -1 : 1) * this.rand(5, 9);
      this.say(`¡${f.pet.name} no te hizo caso!`);
    } else if (pw) {
      this.say(`${f.pet.name}: ¡${pw.name}!`);
    }
    let dmg = f.prof.dmg * (sp.dmg ?? 1) * (m === 'pot' ? 1.25 : 1);
    if (f.pet.char === 'feroz' && f.hp < f.maxHp / 2) dmg *= 1.2;
    const blast = (sp.blast ?? 36) * (m === 'pun' ? 1.3 : 1);
    if (pw) {
      f.mp -= pw.mp;
      f.cds[index] = Math.max(1, pw.cd - (m === 'agi' ? 1 : 0)) + 1; // +1 porque baja al empezar su próximo turno
      if (sp.shield) f.shield = sp.shield;
      if (m === 'agu') f.shield = Math.max(f.shield, 0.3);
      f.shieldLook = ['Metal', 'Tierra', 'Eléctrico/Tierra'].includes(f.species.element) ? 'hexagono' : 'burbuja';
      if (sp.counter) f.counter = sp.counter;
      if (sp.heal) this.heal(f, Math.round(f.maxHp * sp.heal));
      if (sp.gust) this.wind = (foe.x > f.x ? 1 : -1) * 8;
    }
    this.volley = pw ? { f, index, name: pw.name, hit: false } : null;
    // Cómo se ve el proyectil de un poder: onda (rugidos), cometa (golpes gordos), rayo (rápidos) u orbe.
    const style = !pw ? '' : sp.expose ? 'wave' : (sp.dmg ?? 1) >= 1.3 || blast >= 40 ? 'comet' : sp.fast || sp.noWind || sp.pierce ? 'beam' : 'orb';
    const n = sp.count ?? 1;
    for (let i = 0; i < n; i++) {
      const a = angle + (i - (n - 1) / 2) * (sp.spread ?? 0);
      const [x, y] = this.muzzle(f, a);
      const v = speedOf(f.power) * (sp.fast ?? 1);
      this.shots.push({
        x, y, vx: dcos(rad(a)) * v, vy: -dsin(rad(a)) * v, dmg, blast, owner: f, sp,
        age: 0, bounces: 0, pierceLeft: sp.pierce || 0, trail: [], big: blast > 40, style, rec: f.isPlayer && i === Math.floor((n - 1) / 2),
      });
    }
    this.stepLeft = 0; this.hold = false;
    f.lunge = 1;                                      // se abalanza al disparar
    this.phase = 'flying';
    this.emit('fire', f, pw, style);
  }

  // --- Efectos ---

  heal(f, amount) {
    const real = Math.min(amount, f.maxHp - f.hp);
    if (real <= 0) return;
    f.hp += real;
    this.note(f, `+${real}`, '#7dff9b');
    this.puff('curar', f.x, f.y - f.h * 0.6, f.h * 1.1, 0.9, -26);
  }

  hurt(f, amount, from, tag = '') {
    let dmg = Math.max(1, Math.round(amount));
    if (f.shield > 0 && from) { dmg = Math.max(1, Math.round(dmg * (1 - f.shield))); f.shield = 0; this.note(f, 'Escudo', '#4db8ff', 12); }
    if (f.counter > 0 && from && from !== f) {
      const back = Math.max(1, Math.round(dmg * f.counter));
      f.counter = 0;
      from.hp = Math.max(0, from.hp - back); from.hurt = 0.35;
      this.note(from, `-${back} devuelto`, '#ffd23f');
    }
    if (f.hp - dmg <= 0 && f.prof.clutch && !f.clutchUsed) {
      f.clutchUsed = true;
      dmg = f.hp - 1;
      this.say(f.isPlayer ? `¡${f.pet.name} aguanta por ti!` : `¡${f.pet.name} se niega a caer!`, 1.8);
    }
    f.hp = Math.max(0, f.hp - dmg);
    f.hurt = 0.35;
    const strong = tag === '¡Eficaz!', weak = tag === 'Poco eficaz';
    this.note(f, `-${dmg}${tag ? ' ' + tag : ''}`, strong ? '#ff8a3d' : weak ? '#9aa0c8' : tag === 'Veneno' ? '#9be33c' : tag === 'Quemadura' ? '#ff9d2e' : '#ffd76a', strong ? 19 : weak ? 13 : 15);
    return dmg;
  }

  carve(cx, cy, r) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(WORLD - 1, Math.ceil(cx + r)); x++) {
      const dy = Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx))), g = this.terrain[x];
      if (g >= cy + dy) continue;                       // el suelo queda por debajo del hueco
      this.terrain[x] = Math.min(FLOOR - 10, g >= cy - dy ? cy + dy : g + 2 * dy);
    }
    this.emit('terrain');
  }
  mound(cx, r) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(WORLD - 1, Math.ceil(cx + r)); x++) {
      const up = Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx))) * 1.25;
      this.terrain[x] = Math.max(FLOOR - 360, this.terrain[x] - up);
    }
    this.emit('terrain');
  }

  explode(s) {
    s.dead = true;
    const sp = s.sp, me = s.owner;
    if (sp.mound) this.mound(s.x, sp.mound); else this.carve(s.x, s.y, s.blast * 0.75);
    this.emit('explode', s);
    for (const f of [this.player, this.rival]) {
      const d = dist(f.x - s.x, f.y - f.r - s.y);
      if (d >= s.blast + f.r) continue;
      const k = clamp(1 - (d - f.r) / s.blast, 0, 1), foe = f !== me;
      f.hitDir = Math.sign(f.x - s.x) || (foe ? Math.sign(f.x - me.x) : 0);   // hacia dónde lo empuja el golpe
      let dmg = s.dmg * (0.3 + 0.7 * k), tag = '';
      if (foe) {                                        // ventaja o desventaja de elemento
        const mult = matchup(me.species.element, f.species.element);
        dmg *= mult;
        tag = mult > 1 ? '¡Eficaz!' : mult < 1 ? 'Poco eficaz' : '';
        if (f.exposed > 0) { dmg *= 1.25; f.exposed--; }
      }
      if (foe && k >= 0.9) {                            // impacto directo: premio a la puntería
        dmg *= 1.2;
        this.note(f, '¡Diana!', '#ffd76a', 14);
        if (me.isPlayer) this.stats.dianas++;
        this.emit('diana', s, me);
      }
      if (sp.crit && k > 0.45 && this.rnd() < sp.crit) { dmg *= 2; this.note(f, '¡Crítico!', '#ffffff', 13); }
      const done = this.hurt(f, dmg, me, tag);
      if (!foe) continue;
      if (this.volley && !this.volley.hit) { this.volley.hit = true; if (me.isPlayer) this.stats.powerHits++; }
      const dot = turns => ({ turns, dmg: Math.max(2, Math.round(me.prof.dmg * 0.32)) });
      if (sp.drain) this.heal(me, Math.round(done * sp.drain));
      if (sp.poison) { f.poison = dot(sp.poison); this.note(f, '¡Envenenado!', '#9be33c', 13); }
      if (sp.burn) { f.burn = dot(sp.burn); this.note(f, '¡Quemado!', '#ff9d2e', 13); }
      if (sp.freeze) { f.frozenNext = true; this.note(f, '¡Congelado!', '#c9f1ff', 13); }
      if (sp.blind) { f.blindNext = true; this.note(f, '¡Cegado!', '#c9a8ff', 13); }
      if (sp.root) { f.rootNext = true; this.note(f, '¡Inmóvil!', '#d9b06a', 13); }
      if (sp.expose) { f.exposed = sp.expose; this.note(f, '¡Debilitado!', '#ff7a7a', 13); }
      if (sp.shock) { const lost = Math.min(f.mp, sp.shock); f.mp -= lost; if (lost) { this.note(f, `-${lost} MP`, '#7fe9ff', 12); this.puff('mana', f.x, f.y - f.h * 0.7, f.h * 0.7, 0.8, -34); } }
      if (sp.push) f.x = clamp(f.x + (f.x >= me.x ? 1 : -1) * sp.push, 14, WORLD - 14);
    }
  }

  // Una roca flotante para el disparo y se va rompiendo.
  hitRock(rock, s) {
    s.dead = true;
    rock.rx *= 0.62; rock.ry *= 0.72;
    if (rock.rx < 15) this.rocks = this.rocks.filter(r => r !== rock);
    this.emit('rock', s);
  }

  tryMove(f, dir, dt) {
    if (f.fuel <= 0) return;
    const dx = dir * 42 * dt, nx = clamp(f.x + dx, 14, WORLD - 14);
    if (f.y - this.groundAt(nx + dir * 2) > 5) return; // cuesta demasiado empinada
    f.x = nx;
    f.fuel = Math.max(0, f.fuel - Math.abs(dx));
    f.dir = dir;
  }

  planAI() {
    const f = this.rival, tgt = this.player, left = tgt.x < f.x, rand = this.rand;
    let best = null;
    const tryShot = (angle, power) => {
      const [x, y] = this.muzzle(f, angle);
      const end = this.trace(x, y, angle, power).end;
      if (!end) return;
      const d = Math.abs(end[0] - tgt.x) + Math.abs(end[1] - tgt.y) * 0.3;
      if (!best || d < best.d) best = { d, angle, power };
    };
    for (let i = 0; i < 160; i++) tryShot(left ? rand(98, 172) : rand(8, 82), rand(25, 100));
    for (let i = 0; best && i < 60; i++) tryShot(clamp(best.angle + rand(-5, 5), 0, 180), clamp(best.power + rand(-7, 7), 10, 100));
    best = best || { angle: left ? 135 : 45, power: 70 };
    // Como un jugador: el primer tiro es a ojo y va corrigiendo mientras el objetivo no se mueva.
    if (f.aimedAt === undefined || Math.abs(tgt.x - f.aimedAt) > 30) f.tries = 0;
    f.aimedAt = tgt.x;
    const learn = Math.max(0.5, 1 - 0.12 * f.tries++);
    const err = clamp(11 - f.pet.level * 0.25, 3.5, 11) * learn * (f.blind ? 2.2 : 1);
    f.angle = clamp(best.angle + rand(-err, err), 0, 180);
    f.power = clamp(best.power + rand(-err, err) * 1.2, 10, 100);
  }
  // La máquina usa a veces el poder más caro que pueda pagar.
  pickPower(f) {
    const ready = f.powers.map((p, i) => i).filter(i => this.canUse(f, i));
    return ready.length && this.rnd() < 0.6 ? ready.reduce((a, b) => (f.powers[b].mp > f.powers[a].mp ? b : a)) : -1;
  }

  finish(delay = 1.3) {
    this.phase = 'over';
    this.overTimer = delay;
    const win = this.rival.hp <= 0 && this.player.hp > 0;
    this.say(win ? '¡Victoria!' : 'Derrota…', 9);
  }

  // Cómo acabó (o cómo va): lo que cuenta para la partida.
  result() {
    const me = this.player;
    return { over: this.ended, win: this.won, hpLeft: clamp(me.hp / me.maxHp, 0, 1), mp: me.mp, dianas: this.stats.dianas, powerHits: this.stats.powerHits, used: [...this.used], ticks: this.ended ? this.endTick : this.tick };
  }

  // --- Un paso de tiempo ---
  step(dt = STEP) {
    this.tick++;
    this.t = this.tick * STEP;
    for (const f of [this.player, this.rival]) {
      f.hurt = Math.max(0, f.hurt - dt);
      f.lunge = Math.max(0, f.lunge - dt * 3.2);
      if (f.hp <= 0) f.fall = Math.min(1, f.fall + dt * 2.2); // se desploma
      const g = this.groundAt(f.x);
      f.y = f.y < g ? Math.min(g, f.y + 220 * dt) : g;
    }
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (b.away > 0) { if ((b.away -= dt) <= 0) Object.assign(b, this.newBird(i)); continue; }
      b.x += b.v * b.dir * dt;
      if (b.x < -30 || b.x > WORLD + 30) Object.assign(b, this.newBird(i));
    }

    if (this.phase === 'aim') {
      const f = this.turn;
      if (f.isPlayer) {
        if (this.warm > 0) this.warm -= dt; else this.clock -= dt;
        if (this.clock <= 0) {                         // se acabó el tiempo: pierde el turno
          this.clock = 0; this.stepLeft = 0; this.hold = false;
          this.say('¡Se acabó el tiempo!', 1.6);
          this.emit('timeout');
          this.phase = 'resolve'; this.timer = 1.2;
          return;
        }
        if (this.stepLeft > 0 || this.hold) {         // da pasos cortos
          const before = f.x;
          this.tryMove(f, this.stepDir, dt);
          const moved = Math.abs(f.x - before);
          this.stepLeft = Math.max(0, this.stepLeft - moved);
          if (!moved) {                               // sin pasos, o la cuesta es demasiado empinada
            if (f.fuel > 0) this.note(f, 'Muy empinado', '#9aa0c8', 12);
            this.stepLeft = 0; this.hold = false;
          }
        }
      } else {
        this.aiTimer -= dt;
        if (!this.aiReady && this.aiTimer <= 0.6) { this.planAI(); this.aiReady = true; f.dir = dcos(rad(f.angle)) >= 0 ? 1 : -1; }
        if (this.aiTimer <= 0) this.shoot(this.pickPower(f));
      }
    }

    for (const s of this.shots) {
      s.age += dt;
      if (!s.sp.noWind) s.vx += this.windNow() * WIND_K * dt;
      s.vy += (GRAVITY - this.lift(s.x)) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      this.emit('shot', s, dt);
      if (s.x < -80 || s.x > WORLD + 80 || s.y > FLOOR + 60) { s.dead = true; continue; }
      const rock = this.rockAt(s.x, s.y);
      if (rock) { this.hitRock(rock, s); continue; }
      const bird = this.birds.find(b => b.away <= 0 && dist(b.x - s.x, b.y - s.y) < 9);
      if (bird) {                                    // un pájaro se cruza y se lleva el disparo
        bird.away = 5; s.dead = true;
        this.emit('bird', s);
        continue;
      }
      for (const f of [this.player, this.rival]) {
        if (f === s.owner && s.age < 0.3) continue;
        if (dist(f.x - s.x, f.y - f.r - s.y) < f.r + 3) { this.explode(s); break; }
      }
      if (s.dead || s.x < 0 || s.x >= WORLD || s.y < this.groundAt(s.x)) continue;
      if (s.pierceLeft > 0) {                       // perfora el terreno
        this.carve(s.x, s.y, 7);
        s.pierceLeft -= dist(s.vx, s.vy) * dt;
        if (s.pierceLeft <= 0) this.explode(s);
      } else if (s.bounces < (s.sp.bounce || 0)) {  // rebota contra la pendiente
        let nx = this.groundAt(s.x + 3) - this.groundAt(s.x - 3), ny = -6;
        const len = dist(nx, ny); nx /= len; ny /= len;
        const dot = s.vx * nx + s.vy * ny;
        s.vx = (s.vx - 2 * dot * nx) * 0.72; s.vy = (s.vy - 2 * dot * ny) * 0.72;
        s.y = this.groundAt(s.x) - 2;
        s.bounces++; s.dmg *= 1.25;
        this.emit('bounce', s);
      } else {
        this.explode(s);
      }
    }
    this.shots = this.shots.filter(s => !s.dead);

    if (this.phase === 'flying' && !this.shots.length) {
      const v = this.volley;
      if (v && !v.hit) {                             // falló el poder: tarda más en volver
        v.f.cds[v.index] += 1;
        if (v.f.isPlayer) this.say(`${v.name} falló: tardará más en volver`, 1.8);
      }
      this.volley = null;
      this.phase = 'resolve'; this.timer = 0.9;
    }
    if (this.phase === 'resolve' && (this.timer -= dt) <= 0) {
      if (this.player.hp <= 0 || this.rival.hp <= 0) this.finish();
      else this.startTurn(this.other(this.turn));
    }
    if (this.phase === 'over' && !this.ended && (this.overTimer -= dt) <= 0) {
      this.ended = true; this.endTick = this.tick;
      this.won = this.rival.hp <= 0 && this.player.hp > 0;
      this.emit('end', this.won);
    }
  }

  // Repite un combate entero a partir de lo apuntado y devuelve cómo acabó. `ticks` es cuántos pasos duró según el juego:
  // no se simula más allá (si para entonces no ha acabado, over es false: lo apuntado no cuenta un combate entero).
  static replay(player, rival, map, seed, opts, log, ticks = MAX_TICKS) {
    const sim = new Combat(player, rival, map, seed, opts).start(), max = Math.min(MAX_TICKS, ticks);
    let i = 0;
    while (!sim.ended && sim.tick < max) {
      while (i < log.length && log[i][0] <= sim.tick) { sim.apply(log[i][1], log[i].slice(2)); i++; }
      sim.step(STEP);
    }
    return sim.result();
  }
}
