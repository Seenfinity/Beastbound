// Combate de artillería por turnos: tirachinas, viento, terreno que se rompe,
// poderes con MP, ventajas entre elementos y efectos propios de cada mapa.

import { fit, scaled } from './sprites.js';
import { ELEMENT_COLOR, matchup } from './roster.js';
import { CHARS } from './state.js';
import { sfx } from './sfx.js';

export const W = 640;                   // ancho de lo que cabe en pantalla, en unidades de juego (el alto depende de la pantalla)
export const WORLD = 1200;              // ancho del campo entero: la cámara lo recorre
const SKY = 240;                        // cielo por encima de lo que cabe en pantalla, para ver los tiros altos
const GRAVITY = 300, WIND_K = 5, STEP = 1 / 120;
export const TURN_TIME = 30;            // segundos para apuntar y disparar; si se acaban, se pierde el turno
const SIZE = [{ h: 48, r: 15 }, { h: 60, r: 19 }, { h: 74, r: 23 }]; // alto y radio de golpe por etapa

const rad = d => (d * Math.PI) / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const speedOf = power => 120 + power * 5;          // a tope, un tiro cruza todo el campo

// Aspecto de cada elemento: colores de la explosión y partículas del impacto.
const FX = {
  Fuego: { c: ['#ff4d1f', '#ffa53d', '#fff0a8'], kind: 'ember' },            // brasas que suben
  Agua: { c: ['#2f7fe0', '#7fd0ff', '#ffffff'], kind: 'drop' },              // salpicadura
  'Eléctrico': { c: ['#ffd21f', '#fff27a', '#ffffff'], kind: 'bolt' },        // rayos
  Tierra: { c: ['#8a5a2b', '#c9954a', '#f0d9a8'], kind: 'rock' },            // cascotes
  Viento: { c: ['#5fd6b0', '#b8ffe6', '#ffffff'], kind: 'swirl' },           // remolino
  Oscuridad: { c: ['#3a1d6e', '#8a4dff', '#e0c8ff'], kind: 'wisp' },         // sombras que se cierran
  Hielo: { c: ['#5fb8ff', '#bfe9ff', '#ffffff'], kind: 'shard' },            // esquirlas
  Veneno: { c: ['#4f9a1f', '#9be33c', '#e6ffb0'], kind: 'bubble' },          // burbujas que flotan
  Metal: { c: ['#7f8db0', '#d5def5', '#ffffff'], kind: 'spark' },            // chispas
  Naturaleza: { c: ['#2f9a4a', '#8fe36a', '#ffd0e0'], kind: 'leaf' },        // hojas y pétalos
  'Dragón': { c: ['#4a3dff', '#b08cff', '#ffffff'], kind: 'flame' },          // llamarada violeta
  Normal: { c: ['#d9a86a', '#ffe9c4', '#ffffff'], kind: 'star' },            // estrellas
  Luz: { c: ['#ffd76a', '#fff6c4', '#ffffff'], kind: 'ray', flash: 0.26 },   // haces de luz y destello
  'Eléctrico/Tierra': { c: ['#c9954a', '#ffd21f', '#ffffff'], kind: 'bolt', extra: 'rock' },
};
const fxOf = element => FX[element] || FX.Normal;

function zigzag(x, y, a, len) {
  const pts = [[x, y]];
  for (let i = 1; i <= 5; i++) {
    const d = (len * i) / 5, off = i < 5 ? rand(-len * 0.16, len * 0.16) : 0;
    pts.push([x + Math.cos(a) * d - Math.sin(a) * off, y + Math.sin(a) * d + Math.cos(a) * off]);
  }
  return pts;
}

// Terreno: ondulación suave, una meseta alta o una hondonada donde aparece cada bando
// y dos o tres obstáculos (picos o fosos) entre ambos.
function makeTerrain(H) {                              // H: la altura a la que acaba lo que se ve del suelo
  const t = new Float32Array(WORLD);
  const base = H - rand(96, 124), a1 = rand(10, 22), f1 = rand(0.004, 0.009), p1 = rand(0, 6.28);
  const a2 = rand(4, 8), f2 = rand(0.02, 0.035), p2 = rand(0, 6.28);
  const feats = [];
  const spawn = left => {
    const high = Math.random() < 0.5, x = left ? rand(110, 300) : rand(WORLD - 300, WORLD - 110);
    feats.push({ x, w: rand(70, 105), h: high ? rand(110, 200) : -rand(8, 36), flat: true });
    return { x, high };
  };
  const spawns = [spawn(true), spawn(false)];
  const n = 2 + Math.floor(rand(0, 2));
  for (let i = 0; i < n; i++) {
    const x = 430 + ((WORLD - 860) * (i + rand(0.2, 0.8))) / n;
    feats.push(Math.random() < 0.65 ? { x, w: rand(34, 70), h: rand(80, 210) } : { x, w: rand(50, 90), h: -rand(30, 60) });
  }
  for (let x = 0; x < WORLD; x++) {
    let y = base + Math.sin(x * f1 + p1) * a1 + Math.sin(x * f2 + p2) * a2;
    for (const f of feats) { const d = Math.abs(x - f.x) / f.w; y -= f.h * Math.exp(f.flat ? -(d ** 4) : -(d * d) / 2); }
    t[x] = clamp(y, H - 340, H - 26);
  }
  return { t, spawns };
}

export class Battle {
  // Cada bando: { pet, prof, species, sprite, powers }. hooks: { onEnd(win) }
  // H es el alto del campo; scale agranda a las criaturas en pantallas estrechas.
  // art: { vfx: {nombre: lienzo}, icon(nombreDePoder) → lienzo } para los efectos e iconos.
  // pad: franja de abajo que tapan los botones; el suelo se levanta para que no quede debajo.
  constructor(canvas, player, rival, map, hooks, H = 420, scale = 1, art = {}, pad = 0) {
    this.canvas = canvas; this.map = map; this.hooks = hooks; this.scale = scale; this.art = art;
    this.VH = H;                                     // alto de lo que se ve
    this.pad = pad = clamp(pad, 0, H * 0.5);
    this.H = H = Math.max(H + 120, 360 + SKY);        // alto del campo entero
    this.clock = TURN_TIME; this.beep = 6;
    this.stats = { dianas: 0, powerHits: 0 };       // lo que hizo el jugador: cuenta para las misiones
    this.itemUsed = false;
    const land = makeTerrain(H - pad);
    this.terrain = land.t; this.spawns = land.spawns;
    this.ground = document.createElement('canvas');
    this.ground.width = WORLD * 2; this.ground.height = H * 2;
    this.dirty = true;
    this.player = this.makeFighter(player, land.spawns[0].x, 1, true);
    this.rival = this.makeFighter(rival, land.spawns[1].x, -1, false);
    this.shots = []; this.fx = []; this.texts = []; this.gusts = []; this.parts = [];
    this.rings = []; this.pillars = []; this.casts = [];   // adornos de los poderes
    // Cámara: empieza enseñando al rival y luego viaja hasta quien tenga el turno.
    this.cam = { x: clamp(this.rival.x - W / 2, 0, WORLD - W), y: clamp(this.rival.y - (this.VH - pad) * 0.62, 0, H - this.VH) };
    this.look = null; this.pan = false; this.intro = 1.3;
    this.t = 0; this.acc = 0; this.shake = 0; this.flash = 0; this.wind = 0;
    this.pull = null; this.armed = -1; this.moveTarget = null; this.volley = null;
    this.banner = null; this.ended = false;
    this.setupHazards(map.hazards || {});
    this.startTurn(this.player);
  }

  makeFighter(side, x, dir, isPlayer) {
    const z = SIZE[side.pet.stage];
    return {
      ...side, isPlayer, x, y: this.groundAt(x), dir, r: z.r * this.scale, h: z.h * this.scale,
      hp: side.prof.maxHp, maxHp: side.prof.maxHp, mp: side.prof.maxMp, maxMp: side.prof.maxMp,
      cds: side.powers.map(() => 0), turns: 0, angle: dir > 0 ? 55 : 125, power: 60, fuel: 0,
      shield: 0, shieldLook: 'burbuja', counter: 0, exposed: 0, poison: null, burn: null,
      frozen: false, frozenNext: false, blind: false, blindNext: false, rooted: false, rootNext: false,
      clutchUsed: false, hurt: 0, fall: 0, lunge: 0, hitDir: 0, color: ELEMENT_COLOR[side.species.element] || '#fff6d8',
    };
  }

  // --- Efectos del mapa ---
  setupHazards(h) {
    // Todo se reparte por la zona central, entre los dos bandos.
    const spread = (n, make) => Array.from({ length: n }, (_, i) => make(rand(340 + ((WORLD - 680) * i) / n, 340 + ((WORLD - 680) * (i + 0.9)) / n)));
    this.rocks = spread((h.rocks || 0) * 2, x => ({ x, y: Math.max(40, this.groundAt(x) - rand(80, 210)), rx: rand(26, 40), ry: rand(13, 18) }));
    this.thermals = spread((h.thermals || 0) * 2, x => ({ x, w: rand(34, 48) }));
    this.birds = Array.from({ length: (h.birds || 0) * 2 }, (_, i) => this.newBird(i, true));
    this.gusty = !!h.gusty;
    this.snow = h.snow ? Array.from({ length: 46 }, () => ({ x: rand(0, W), y: rand(0, this.VH), v: rand(18, 46) })) : [];
  }
  newBird(i, anywhere = false) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { x: anywhere ? rand(0, WORLD) : dir > 0 ? -20 : WORLD + 20, y: rand(this.H - this.VH + 30, this.H - this.pad - 210), dir, v: rand(36, 60), phase: i * 2.1, away: 0 };
  }
  rockAt(x, y) { return this.rocks.find(r => ((x - r.x) / r.rx) ** 2 + ((y - r.y) / r.ry) ** 2 < 1); }
  lift(x) { return this.thermals.some(t => Math.abs(x - t.x) < t.w / 2) ? 560 : 0; } // empuje hacia arriba
  windNow() { return this.wind + (this.gusty ? Math.sin(this.t * 1.9) * 4 : 0); }

  groundAt(x) { return this.terrain[clamp(Math.round(x), 0, WORLD - 1)]; }
  other(f) { return f === this.player ? this.rival : this.player; }
  say(text, time = 1.6) { this.banner = { text, t: time }; }
  note(f, text, color = '#fff6d8', size = 15) { this.texts.push({ x: f.x, y: f.y - f.h - 12 - this.texts.filter(e => e.t < 0.3).length * 16, text, t: 0, color, size }); }
  canAct() { return this.phase === 'aim' && this.turn === this.player; }
  canUse(f, i) { const p = f.powers[i]; return !!p && this.phase === 'aim' && this.turn === f && f.cds[i] === 0 && f.mp >= p.mp; }

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
    this.wind = Math.round(rand(-10, 10));
    this.phase = 'aim';
    this.clock = TURN_TIME; this.beep = 6;
    this.itemUsed = false; f.sight = false;
    this.look = null;
    if (f.isPlayer) sfx.turn();
    this.say(f.frozen ? `${f.pet.name} está congelado` : f.blind ? `${f.pet.name} está cegado: apunta peor` : f.rooted ? `${f.pet.name} no puede moverse` : f.isPlayer ? '¡Tu turno!' : `Turno de ${f.pet.name}`);
    if (!f.isPlayer) { this.aiTimer = 1.5; this.aiReady = false; }
  }

  muzzle(f, angle) {
    const a = rad(angle), d = f.r + 6;
    return [f.x + Math.cos(a) * d, f.y - f.r - Math.sin(a) * d];
  }

  // Simula un disparo normal (con rocas y aire caliente): es la guía de tiro y como apunta la máquina.
  trace(x, y, angle, power, limit = 0) {
    const v = speedOf(power);
    let vx = Math.cos(rad(angle)) * v, vy = -Math.sin(rad(angle)) * v;
    const pts = [];
    for (let i = 0; i < 1800; i++) {
      vx += this.wind * WIND_K * STEP; vy += (GRAVITY - this.lift(x)) * STEP;
      x += vx * STEP; y += vy * STEP;
      if (limit && i % 3 === 0) { pts.push([x, y]); if (pts.length >= limit) return { pts, end: null }; }
      if (x < -80 || x > WORLD + 80 || y > this.H + 30) return { pts, end: null };
      if (this.rockAt(x, y)) return { pts, end: null };
      if (x >= 0 && x < WORLD && y >= this.groundAt(x)) return { pts, end: [x, y] };
    }
    return { pts, end: null };
  }

  // Minimapa: arriba, en el centro. Tocarlo o arrastrarlo mueve la cámara para mirar el campo.
  mini() {
    const w = 180, floor = this.H - this.pad, y0 = Math.max(0, floor - 480), k = w / WORLD;
    return { x: (W - w) / 2, y: 6, w, h: (floor - y0) * k, k, y0 };
  }
  inMini(vx, vy) { const m = this.mini(); return vx > m.x - 6 && vx < m.x + m.w + 6 && vy > m.y - 6 && vy < m.y + m.h + 8; }
  lookAt(vx) { const m = this.mini(); this.look = { x: clamp((vx - m.x) / m.k, 0, WORLD) }; }

  // Tirachinas: se arrastra hacia atrás desde cualquier punto y se suelta para disparar.
  // Un toque sin arrastrar hace que la criatura camine hacia ese punto.
  // Las coordenadas son las de la pantalla (0..W, 0..VH); aquí se pasan al campo.
  pullStart(vx, vy) {
    this.intro = 0;
    if (this.inMini(vx, vy)) { this.pan = true; this.pull = null; return this.lookAt(vx); }
    if (!this.canAct()) return;
    this.look = null;
    this.pull = { sx: vx, sy: vy, x: vx, y: vy, wx: vx + this.cam.x, aiming: false };
    this.moveTarget = null;
  }
  pullMove(vx, vy) {
    if (this.pan) return this.lookAt(vx);
    const p = this.pull;
    if (!p || !this.canAct()) return;
    p.x = vx; p.y = vy;
    const dx = p.sx - vx, dy = p.sy - vy, len = Math.hypot(dx, dy);
    p.aiming = len > 12;
    if (!p.aiming) return;
    const f = this.player;
    let a = (Math.atan2(-dy, dx) * 180) / Math.PI;
    if (a < 0) a = dx >= 0 ? 0 : 180;
    f.angle = clamp(a, 0, 180);
    f.power = clamp(len / 1.6, 5, 100);
  }
  pullEnd() {
    if (this.pan) { this.pan = false; return; }
    const p = this.pull;
    this.pull = null;
    if (!p || !this.canAct()) return;
    if (p.aiming) { if (this.player.power > 8) this.fire(this.armed); }
    else this.moveTarget = clamp(p.wx, 14, WORLD - 14);
  }
  // Usa un objeto de la mochila: uno por turno y sin gastar el turno. Devuelve si se pudo usar.
  useItem(id) {
    if (!this.canAct() || this.itemUsed) return false;
    const f = this.player;
    if (id === 'pocion') { if (f.hp >= f.maxHp) return false; this.heal(f, Math.round(f.maxHp * 0.3)); }
    else if (id === 'elixir') { if (f.mp >= f.maxMp) return false; const got = Math.min(15, f.maxMp - f.mp); f.mp += got; this.note(f, `+${got} MP`, '#7fe9ff'); this.puff('mana', f.x, f.y - f.h * 0.7, f.h * 0.8, 0.8, -30); }
    else if (id === 'escudo') { if (f.shield >= 0.5) return false; f.shield = 0.5; f.shieldLook = 'burbuja'; this.note(f, 'Escudo', '#4db8ff'); }
    else if (id === 'mira') { if (f.sight) return false; f.sight = true; this.note(f, 'Mira', '#ffd76a'); }
    else return false;
    this.itemUsed = true;
    sfx.coin();
    return true;
  }

  // Prepara (o quita) un poder para sumarlo al próximo disparo.
  arm(i) {
    if (this.armed === i) this.armed = -1;
    else if (this.canUse(this.player, i)) this.armed = i;
  }

  fire(index = -1) {
    if (this.phase !== 'aim') return;
    const f = this.turn, foe = this.other(f);
    if (index >= 0 && !this.canUse(f, index)) index = -1;
    const pw = index >= 0 ? f.powers[index] : null, sp = pw || {};
    const m = pw ? f.prof.mastery : '';
    if (f.isPlayer) this.armed = -1;
    let angle = f.angle;
    if (f.isPlayer && Math.random() < f.prof.disobey) {
      angle += (Math.random() < 0.5 ? -1 : 1) * rand(5, 9);
      this.say(`¡${f.pet.name} no te hizo caso!`);
    } else if (pw) {
      this.say(`${f.pet.name}: ¡${pw.name}!`);
    }
    let dmg = f.prof.dmg * (sp.dmg ?? 1) * (m === 'pot' ? 1.25 : 1);
    if (f.pet.char === 'feroz' && f.hp < f.maxHp / 2) dmg *= 1.2;
    const blast = (sp.blast ?? 30) * (m === 'pun' ? 1.3 : 1);
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
    if (pw) this.cast(f, pw, style);
    this.look = null; this.intro = 0;
    const n = sp.count ?? 1;
    for (let i = 0; i < n; i++) {
      const a = angle + (i - (n - 1) / 2) * (sp.spread ?? 0);
      const [x, y] = this.muzzle(f, a);
      const v = speedOf(f.power) * (sp.fast ?? 1);
      this.shots.push({
        x, y, vx: Math.cos(rad(a)) * v, vy: -Math.sin(rad(a)) * v, dmg, blast, owner: f, sp,
        age: 0, bounces: 0, pierceLeft: sp.pierce || 0, trail: [], big: blast > 40, style,
      });
    }
    f.lunge = 1;                                      // se abalanza al disparar
    this.phase = 'flying';
    if (pw) sfx.special(); else sfx.shoot();
  }

  // Al lanzar un poder: ondas, partículas de su elemento y su emblema sobre la criatura.
  cast(f, pw, style) {
    const look = fxOf(f.species.element), cy = f.y - f.h * 0.5;
    this.rings.push({ x: f.x, y: cy, r: f.h * 1.5, t: 0, max: 0.5, c: look.c[1], w: 4 });
    this.rings.push({ x: f.x, y: cy, r: f.h * 2.3, t: -0.12, max: 0.6, c: look.c[2], w: 2 });
    if (style === 'wave') for (let i = 0; i < 3; i++) this.rings.push({ x: f.x + f.dir * f.h * 0.4, y: f.y - f.h * 0.7, r: f.h * (2.6 + i), t: -0.1 * i, max: 0.7, c: '#ffffff', w: 3 });
    this.spray(f.x, cy, f.species.element, 26);
    this.casts.push({ f, icon: this.art.icon?.(pw.name), t: 0, max: 1 });
    this.shake = Math.max(this.shake, style === 'wave' ? 7 : 3);
  }

  // Al impactar un poder: onda expansiva, más partículas y la marca de lo que provoca.
  impact(s) {
    const sp = s.sp, element = s.owner.species.element, look = fxOf(element), b = s.blast;
    this.rings.push({ x: s.x, y: s.y, r: b * 2.2, t: 0, max: 0.5, c: look.c[1], w: 5 });
    this.rings.push({ x: s.x, y: s.y, r: b * 3.3, t: -0.1, max: 0.65, c: look.c[2], w: 2.5 });
    this.spray(s.x, s.y, element, b * 1.5);
    if (s.style === 'comet') {                        // golpe gordo: columna de luz, cascotes y más temblor
      this.pillars.push({ x: s.x, y: s.y, w: b * 1.2, t: 0, max: 0.7, c: look.c });
      this.shake = Math.min(16, b / 2.4 + 4); this.flash = Math.max(this.flash, 0.22);
      for (let i = 0; i < 16; i++) this.parts.push({ k: 'rock', x: s.x + rand(-b, b) * 0.5, y: s.y, vx: rand(-150, 150), vy: -rand(120, 330), g: 520, life: 0, max: rand(0.7, 1.3), c: look.c[i % 2], s: rand(3, 7), a: rand(0, 6) });
    } else if (s.style === 'wave') {
      for (let i = 0; i < 3; i++) this.rings.push({ x: s.x, y: s.y, r: b * (1.6 + i * 0.9), t: -0.08 * i, max: 0.6, c: '#ffffff', w: 3 });
      this.shake = Math.max(this.shake, 8);
    }
    const mark = sp.freeze ? 'hielo' : sp.root ? 'raices' : sp.blind ? 'nubeOscura' : sp.poison ? 'burbujasVeneno' : sp.burn ? 'llamas' : sp.expose ? 'escudoRoto'
      : sp.shock ? 'anilloRayo' : sp.crit ? 'estrellas' : sp.drain || sp.heal ? 'curar' : sp.push || sp.gust ? 'polvo' : '';
    if (mark) this.puff(mark, s.x, s.y - b * 0.4, b * 3, 0.85, -16);
  }

  surrender() {
    if (this.phase === 'over') return;
    this.player.hp = 0;
    this.finish(0.3);
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
      const dy = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)), g = this.terrain[x];
      if (g >= cy + dy) continue;                       // el suelo queda por debajo del hueco
      this.terrain[x] = Math.min(this.H - this.pad - 10, g >= cy - dy ? cy + dy : g + 2 * dy);
    }
    this.dirty = true;
  }
  mound(cx, r) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(WORLD - 1, Math.ceil(cx + r)); x++) {
      const up = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)) * 1.25;
      this.terrain[x] = Math.max(this.H - this.pad - 360, this.terrain[x] - up);
    }
    this.dirty = true;
  }

  explode(s) {
    s.dead = true;
    const sp = s.sp, me = s.owner;
    if (sp.mound) this.mound(s.x, sp.mound); else this.carve(s.x, s.y, s.blast * 0.75);
    const look = fxOf(me.species.element);
    this.fx.push({ x: s.x, y: s.y, r: s.blast, t: 0, colors: look.c });
    this.spray(s.x, s.y, me.species.element, s.blast);
    this.shake = Math.min(9, s.blast / 5);
    this.flash = look.flash || 0.14;
    if (look.flash) this.puff('destello', s.x, s.y, s.blast * 3.2, 0.45);
    if (s.style) this.impact(s);
    sfx.boom();
    for (const f of [this.player, this.rival]) {
      const d = Math.hypot(f.x - s.x, f.y - f.r - s.y);
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
        if (me.isPlayer) { this.stats.dianas++; sfx.good(); }
        for (let i = 0; i < 10; i++) { const a = rand(0, 6.283), v = rand(40, 130); this.parts.push({ k: 'star', x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: 0, max: rand(0.4, 0.8), c: '#ffd76a', s: rand(4, 7), a }); }
      }
      if (sp.crit && k > 0.45 && Math.random() < sp.crit) { dmg *= 2; this.note(f, '¡Crítico!', '#ffffff', 13); }
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

  // Un efecto dibujado (de la hoja de efectos) que aparece, crece un poco y se desvanece.
  puff(name, x, y, size, time = 0.6, rise = 0) {
    const img = this.art.vfx?.[name];
    if (img) this.parts.push({ k: 'img', img, x, y, vx: 0, vy: rise, g: 0, life: 0, max: time, s: size, c: '#fff' });
  }
  vfx(ctx, name, x, y, size, o = {}) {
    const img = this.art.vfx?.[name];
    if (!img) return;
    const k = size / Math.max(img.width, img.height);
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((o.sx || 1) * k, (o.sy || 1) * k);
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }
  // Mientras hay un poder preparado, la criatura se carga con partículas de su elemento.
  charge(f) {
    const look = fxOf(f.species.element), kind = ['bolt', 'ray', 'swirl', 'wisp'].includes(look.kind) ? 'star' : look.kind;
    this.parts.push({ k: kind, x: f.x + rand(-f.h * 0.5, f.h * 0.5), y: f.y - rand(0, f.h * 0.5), vx: rand(-8, 8), vy: -rand(28, 70), g: 0, life: 0, max: rand(0.5, 0.95), c: look.c[Math.floor(rand(0, 3))], s: rand(2, 4), a: rand(0, 6) });
  }

  // Partículas del impacto, distintas para cada elemento.
  spray(x, y, element, blast) {
    const look = fxOf(element), n = Math.round(8 + blast * 0.35);
    for (const kind of [look.kind, look.extra].filter(Boolean)) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), v = rand(30, 60 + blast * 2.2);
        const p = { k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: 0, max: rand(0.45, 0.9), c: look.c[i % 3], s: rand(2, 4), a };
        if (kind === 'ember' || kind === 'flame') { p.vx *= 0.5; p.vy = -Math.abs(p.vy) * 0.9 - 20; p.g = -60; p.s = rand(2, kind === 'flame' ? 6 : 4.5); p.max = rand(0.6, 1.1); }
        else if (kind === 'drop') { p.vy = -Math.abs(p.vy); p.g = 420; p.max = rand(0.6, 1); }
        else if (kind === 'rock') { p.vy = -Math.abs(p.vy) * 0.9; p.g = 480; p.s = rand(3, 6); p.max = rand(0.7, 1.1); }
        else if (kind === 'bubble') { p.vx *= 0.35; p.vy = -rand(12, 45); p.s = rand(2.5, 6); p.max = rand(1, 1.8); }
        else if (kind === 'leaf') { p.vx *= 0.6; p.vy = p.vy * 0.4 - 30; p.g = 90; p.s = rand(3, 5); p.max = rand(0.9, 1.5); }
        else if (kind === 'wisp') { p.x = x + Math.cos(a) * blast * 1.2; p.y = y + Math.sin(a) * blast * 1.2; p.vx = -Math.cos(a) * blast * 2; p.vy = -Math.sin(a) * blast * 2; p.s = rand(3, 6); p.max = 0.55; }
        else if (kind === 'shard') { p.vx *= 1.4; p.vy *= 1.4; p.s = rand(4, 8); p.max = rand(0.35, 0.6); }
        else if (kind === 'spark') { p.vx *= 1.8; p.vy *= 1.8; p.g = 200; p.max = rand(0.2, 0.4); }
        else if (kind === 'star') { p.s = rand(3, 6); p.max = rand(0.4, 0.7); }
        else if (kind === 'ray') { if (i >= 12) break; p.vx = p.vy = 0; p.s = blast * rand(1.1, 2.1); p.max = rand(0.35, 0.6); }
        else if (kind === 'bolt') { if (i >= 7) break; p.vx = p.vy = 0; p.pts = zigzag(x, y, a, blast * rand(0.9, 1.7)); p.max = rand(0.18, 0.34); }
        else if (kind === 'swirl') { if (i >= 9) break; p.vx = p.vy = 0; p.s = blast * rand(0.4, 1.2); p.spin = rand(5, 9) * (i % 2 ? 1 : -1); p.max = rand(0.5, 0.8); }
        this.parts.push(p);
      }
    }
  }

  // Una roca flotante para el disparo y se va rompiendo.
  hitRock(rock, s) {
    s.dead = true;
    this.fx.push({ x: s.x, y: s.y, r: 16, t: 0.15, color: '#cfd3e6' });
    rock.rx *= 0.62; rock.ry *= 0.72;
    if (rock.rx < 15) this.rocks = this.rocks.filter(r => r !== rock);
    sfx.bounce();
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
    const f = this.rival, tgt = this.player, left = tgt.x < f.x;
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
    const learn = Math.max(0.45, 1 - 0.2 * f.tries++);
    const err = Math.max(1, 7 - f.pet.level * 0.45) * learn * clamp(520 / Math.abs(tgt.x - f.x), 0.5, 1) * (f.blind ? 2.5 : 1);
    f.angle = clamp(best.angle + rand(-err, err), 0, 180);
    f.power = clamp(best.power + rand(-err, err) * 1.2, 10, 100);
  }
  // La máquina usa a veces el poder más caro que pueda pagar.
  pickPower(f) {
    const ready = f.powers.map((p, i) => i).filter(i => this.canUse(f, i));
    return ready.length && Math.random() < 0.6 ? ready.reduce((a, b) => (f.powers[b].mp > f.powers[a].mp ? b : a)) : -1;
  }

  finish(delay = 1.3) {
    this.phase = 'over';
    this.overTimer = delay;
    const win = this.rival.hp <= 0 && this.player.hp > 0;
    this.say(win ? '¡Victoria!' : 'Derrota…', 9);
  }

  // --- Bucle ---

  update(dt) {
    this.t += dt;
    this.acc += dt;
    while (this.acc >= STEP) { this.step(STEP); this.acc -= STEP; }
  }

  step(dt) {
    this.shake *= 0.94;
    this.flash = Math.max(0, this.flash - dt);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    for (const f of [this.player, this.rival]) {
      f.hurt = Math.max(0, f.hurt - dt);
      f.lunge = Math.max(0, f.lunge - dt * 3.2);
      if (f.hp <= 0) f.fall = Math.min(1, f.fall + dt * 2.2); // se desploma
      const g = this.groundAt(f.x);
      f.y = f.y < g ? Math.min(g, f.y + 220 * dt) : g;
    }
    this.fx = this.fx.filter(e => (e.t += dt) < 0.45);
    for (const list of ['rings', 'pillars', 'casts']) this[list] = this[list].filter(e => (e.t += dt) < e.max);
    this.updateCam(dt);
    this.texts = this.texts.filter(e => (e.t += dt) < 1.2);
    for (const q of this.parts) { q.life += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    this.parts = this.parts.filter(q => q.life < q.max);
    this.birds.forEach((b, i) => {
      if (b.away > 0) { if ((b.away -= dt) <= 0) Object.assign(b, this.newBird(i)); return; }
      b.x += b.v * b.dir * dt;
      if (b.x < -30 || b.x > WORLD + 30) Object.assign(b, this.newBird(i));
    });

    if (this.phase === 'aim') {
      const f = this.turn;
      if (f.isPlayer) {
        if (this.intro <= 0) this.clock -= dt;         // el reloj espera a que la cámara llegue
        if (this.clock <= 5 && Math.ceil(this.clock) < this.beep) { this.beep = Math.ceil(this.clock); sfx.tap(); }
        if (this.clock <= 0) {                         // se acabó el tiempo: pierde el turno
          this.clock = 0; this.pull = null; this.armed = -1; this.moveTarget = null;
          this.say('¡Se acabó el tiempo!', 1.6); sfx.bad();
          this.phase = 'resolve'; this.timer = 1.2;
          return;
        }
        if (this.armed >= 0 && Math.random() < dt * 30) this.charge(f);
        if (this.moveTarget !== null) {               // camina hacia donde tocaste
          const d = this.moveTarget - f.x, before = f.x;
          if (Math.abs(d) > 3 && f.fuel > 0) this.tryMove(f, d > 0 ? 1 : -1, dt);
          if (Math.abs(d) <= 3 || f.fuel <= 0 || f.x === before) this.moveTarget = null;
        } else if (this.pull?.aiming) f.dir = Math.cos(rad(f.angle)) >= 0 ? 1 : -1;
      } else {
        this.aiTimer -= dt;
        if (!this.aiReady && this.aiTimer <= 0.6) { this.planAI(); this.aiReady = true; f.dir = Math.cos(rad(f.angle)) >= 0 ? 1 : -1; }
        if (this.aiTimer <= 0) this.fire(this.pickPower(f));
      }
    }

    for (const s of this.shots) {
      s.age += dt;
      if (!s.sp.noWind) s.vx += this.windNow() * WIND_K * dt;
      s.vy += (GRAVITY - this.lift(s.x)) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (Math.round(s.age / dt) % 3 === 0) { s.trail.push([s.x, s.y]); if (s.trail.length > 10) s.trail.shift(); }
      if (Math.round(s.age / dt) % (s.style ? 2 : 6) === 0) {   // estela con el aspecto de su elemento (más densa en los poderes)
        const look = fxOf(s.owner.species.element), kind = ['bolt', 'ray', 'swirl', 'wisp'].includes(look.kind) ? 'star' : look.kind;
        this.parts.push({ k: kind, x: s.x, y: s.y, vx: rand(-12, 12), vy: rand(-12, 12), g: kind === 'drop' || kind === 'rock' ? 160 : kind === 'ember' || kind === 'flame' ? -40 : 0, life: 0, max: rand(0.25, 0.5), c: look.c[Math.floor(rand(0, 3))], s: s.style ? rand(3, 5.5) : rand(1.5, 3), a: rand(0, 6) });
      }
      if (s.x < -80 || s.x > WORLD + 80 || s.y > this.H + 30) { s.dead = true; continue; }
      const rock = this.rockAt(s.x, s.y);
      if (rock) { this.hitRock(rock, s); continue; }
      const bird = this.birds.find(b => b.away <= 0 && Math.hypot(b.x - s.x, b.y - s.y) < 9);
      if (bird) {                                    // un pájaro se cruza y se lleva el disparo
        bird.away = 5; s.dead = true;
        this.fx.push({ x: s.x, y: s.y, r: 12, t: 0.2, color: '#ffffff' });
        this.texts.push({ x: s.x, y: s.y - 10, text: '¡Un pájaro!', t: 0, color: '#fff6d8', size: 12 });
        continue;
      }
      for (const f of [this.player, this.rival]) {
        if (f === s.owner && s.age < 0.3) continue;
        if (Math.hypot(f.x - s.x, f.y - f.r - s.y) < f.r + 3) { this.explode(s); break; }
      }
      if (s.dead || s.x < 0 || s.x >= WORLD || s.y < this.groundAt(s.x)) continue;
      if (s.pierceLeft > 0) {                       // perfora el terreno
        this.carve(s.x, s.y, 7);
        s.pierceLeft -= Math.hypot(s.vx, s.vy) * dt;
        if (s.pierceLeft <= 0) this.explode(s);
      } else if (s.bounces < (s.sp.bounce || 0)) {  // rebota contra la pendiente
        let nx = this.groundAt(s.x + 3) - this.groundAt(s.x - 3), ny = -6;
        const len = Math.hypot(nx, ny); nx /= len; ny /= len;
        const dot = s.vx * nx + s.vy * ny;
        s.vx = (s.vx - 2 * dot * nx) * 0.72; s.vy = (s.vy - 2 * dot * ny) * 0.72;
        s.y = this.groundAt(s.x) - 2;
        s.bounces++; s.dmg *= 1.25;
        this.fx.push({ x: s.x, y: s.y, r: 10, t: 0.2, color: '#ffffff' });
      } else {
        this.explode(s);
      }
    }
    this.shots = this.shots.filter(s => !s.dead);

    if (this.phase === 'flying' && !this.shots.length) {
      const v = this.volley;
      if (v && !v.hit) {                             // falló el poder: tarda más en volver
        v.f.cds[v.index] += 2;
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
      this.ended = true;
      this.hooks.onEnd(this.rival.hp <= 0 && this.player.hp > 0);
    }
  }

  // La cámara sigue al disparo; si no hay, a quien le toca (un poco adelantada hacia su rival)
  // o a donde el jugador esté mirando con el minimapa. Tras un impacto se queda mirándolo.
  updateCam(dt) {
    const cam = this.cam, f = this.turn, shot = this.shots[0];
    let fx, fy, speed = 3;
    if (this.intro > 0) { this.intro -= dt; fx = this.rival.x; fy = this.rival.y - this.rival.h * 0.5; }
    else if (shot) { fx = shot.x + shot.vx * 0.16; fy = shot.y; speed = 8; }
    else if (this.phase === 'over') { const win = this.rival.hp <= 0 ? this.player : this.rival; fx = win.x; fy = win.y - win.h * 0.5; }
    else if (this.phase !== 'aim') return;
    else if (this.look) { fx = this.look.x; fy = this.groundAt(this.look.x) - 50; speed = 10; }
    else { fx = f.x + Math.sign(this.other(f).x - f.x) * W * 0.2; fy = f.y - f.h * 0.5; }
    const k = 1 - Math.exp(-speed * dt);
    cam.x += (clamp(fx - W / 2, 0, WORLD - W) - cam.x) * k;
    cam.y += (clamp(fy - (this.VH - this.pad) * 0.6, 0, this.H - this.VH) - cam.y) * k;
  }

  // --- Dibujo ---

  renderGround() {
    const g = this.ground.getContext('2d');
    const [rock, rock2, edge, top, light] = this.map.terrain;
    const H = this.H;
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, WORLD, H);
    for (let x = 0; x < WORLD; x += 2) {
      const y = Math.round(this.terrain[x]);
      g.fillStyle = rock; g.fillRect(x, y, 2, H - y);
      g.fillStyle = rock2; g.fillRect(x, y + 9, 2, 10 + ((x * 7) % 5) * 3);
      g.fillStyle = edge; g.fillRect(x, y, 2, 8 + ((x * 13) % 4) * 2);
      g.fillStyle = top; g.fillRect(x, y, 2, 4);
      g.fillStyle = light; g.fillRect(x, y, 2, 1.5);
    }
    this.dirty = false;
  }

  drawHazards(ctx) {
    const [rock, rock2, edge, top, light] = this.map.terrain, H = this.H;
    for (const t of this.thermals) {                  // columna de aire caliente con chispas que suben
      const g = ctx.createLinearGradient(t.x - t.w / 2, 0, t.x + t.w / 2, 0);
      g.addColorStop(0, 'rgba(255,170,80,0)'); g.addColorStop(0.5, 'rgba(255,170,80,.20)'); g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g; ctx.fillRect(t.x - t.w / 2, 0, t.w, this.groundAt(t.x));
      ctx.fillStyle = '#ffd08a';
      for (let i = 0; i < 9; i++) {
        const y = H - ((this.t * 70 + i * 61) % H), x = t.x + Math.sin(i * 2.3 + this.t * 2) * t.w * 0.3;
        if (y < this.groundAt(t.x)) ctx.fillRect(x, y, 2, 2);
      }
    }
    for (const r of this.rocks) {                     // roca flotante, con el mismo aspecto que el suelo
      for (let x = Math.ceil((r.x - r.rx) / 2) * 2; x < r.x + r.rx; x += 2) {
        const k = Math.sqrt(Math.max(0, 1 - ((x - r.x) / r.rx) ** 2));
        const y0 = Math.round(r.y - r.ry * k * 0.7), h = Math.round(r.ry * k * 2.3);
        if (h < 1) continue;
        ctx.fillStyle = rock; ctx.fillRect(x, y0, 2, h);
        ctx.fillStyle = rock2; ctx.fillRect(x, y0 + 5, 2, Math.max(0, Math.min(h - 5, 6 + ((x * 7) % 4) * 2)));
        ctx.fillStyle = edge; ctx.fillRect(x, y0, 2, Math.min(h, 5));
        ctx.fillStyle = top; ctx.fillRect(x, y0, 2, Math.min(h, 3));
        ctx.fillStyle = light; ctx.fillRect(x, y0, 2, 1.2);
      }
    }
    for (const b of this.birds) {                     // pájaro: dos alas que aletean
      if (b.away > 0) continue;
      const up = Math.sin(this.t * 14 + b.phase) > 0 ? -3 : 2;
      ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x - 6, b.y + up); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + 6, b.y + up); ctx.stroke();
      ctx.fillStyle = '#ffd76a'; ctx.fillRect(b.x + b.dir * 2 - 1, b.y - 1, 2, 2);
    }
  }
  drawSnow(ctx) {                                     // nieve arrastrada por el viento (pegada a la pantalla)
    if (!this.snow.length) return;
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    const wind = this.windNow();
    for (const s of this.snow) {
      s.x += wind * 0.22; s.y += s.v * 0.016;
      if (s.y > this.VH) { s.y = -4; s.x = rand(0, W); }
      if (s.x > W + 4) s.x = -4; else if (s.x < -4) s.x = W + 4;
      ctx.fillRect(s.x, s.y, 2, 2);
    }
  }

  // Lo que le pasa a la criatura se ve encima de ella, con los dibujos de la hoja de efectos.
  drawStatus(ctx, f, w) {
    const t = this.t, cx = f.x, top = f.y - f.h, mid = f.y - f.h * 0.5, big = Math.max(w, f.h);
    if (f.rooted || f.rootNext) this.vfx(ctx, 'raices', cx, f.y - big * 0.1, big * 1.3, { sy: 0.8 });
    if (f.frozen || f.frozenNext) this.vfx(ctx, 'hielo', cx, f.y - big * 0.36, big * 1.4, { alpha: 0.92 });
    if (f.poison) this.vfx(ctx, 'burbujasVeneno', cx + Math.sin(t * 2) * 3, top + f.h * 0.28 + Math.sin(t * 3) * 3, big * 0.95, { alpha: 0.92 });
    if (f.blind || f.blindNext) this.vfx(ctx, 'nubeOscura', cx + f.dir * w * 0.08 + Math.sin(t * 2.2) * 2, top + f.h * 0.34, big * 1.05, { sy: 0.78, rot: Math.sin(t * 1.5) * 0.08 });
    if (f.exposed > 0) {
      this.vfx(ctx, 'escudoRoto', cx - f.dir * w * 0.46, top + f.h * 0.2, big * 0.44, { alpha: 0.75 + 0.25 * Math.sin(t * 9) });
      this.vfx(ctx, 'debuff', cx + f.dir * w * 0.5, top + f.h * 0.22 + Math.sin(t * 6) * 2.5, big * 0.32);
    }
    if (f.shield > 0) this.vfx(ctx, f.shieldLook, cx, mid, big * 1.5 * (1 + Math.sin(t * 4) * 0.03), { rot: f.shieldLook === 'hexagono' ? t * 0.5 : Math.sin(t * 1.3) * 0.06, alpha: 0.95 });
    if (f.counter > 0) this.vfx(ctx, 'anilloRayo', cx, mid, big * 1.55, { rot: -t * 1.6 });
  }

  drawParts(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of this.parts) {
      const u = p.life / p.max;
      ctx.globalAlpha = Math.max(0, 1 - u);
      ctx.fillStyle = ctx.strokeStyle = p.c;
      if (p.k === 'img') {
        const k = (p.s * (0.7 + u * 0.4)) / Math.max(p.img.width, p.img.height);
        ctx.drawImage(p.img, p.x - (p.img.width * k) / 2, p.y - (p.img.height * k) / 2, p.img.width * k, p.img.height * k);
      } else if (p.k === 'bubble') {
        ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x + Math.sin(p.life * 8 + p.a) * 2, p.y, p.s, 0, 6.3); ctx.stroke();
        ctx.globalAlpha *= 0.35; ctx.fill();
      } else if (p.k === 'wisp') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 - u * 0.6), 0, 6.3); ctx.fill();
      } else if (p.k === 'shard') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(p.s, 0); ctx.lineTo(0, p.s * 0.35); ctx.lineTo(-p.s, 0); ctx.lineTo(0, -p.s * 0.35); ctx.fill();
        ctx.restore();
      } else if (p.k === 'spark') {
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
      } else if (p.k === 'leaf' || p.k === 'rock') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 6 + p.a);
        ctx.fillRect(-p.s / 2, p.k === 'leaf' ? -p.s / 4 : -p.s / 2, p.s, p.k === 'leaf' ? p.s / 2 : p.s);
        ctx.restore();
      } else if (p.k === 'star') {
        ctx.fillRect(p.x - p.s / 2, p.y - 0.75, p.s, 1.5); ctx.fillRect(p.x - 0.75, p.y - p.s / 2, 1.5, p.s);
      } else if (p.k === 'ray') {
        ctx.lineWidth = 3.5 * (1 - u) + 0.5;
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.a) * 5, p.y + Math.sin(p.a) * 5);
        ctx.lineTo(p.x + Math.cos(p.a) * p.s * (0.45 + u * 0.55), p.y + Math.sin(p.a) * p.s * (0.45 + u * 0.55)); ctx.stroke();
      } else if (p.k === 'bolt') {
        ctx.lineWidth = 2.4; ctx.beginPath();
        p.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.9; ctx.stroke();
      } else if (p.k === 'swirl') {
        const a = p.a + p.spin * p.life;
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.3 + u), a, a + 1.7); ctx.stroke();
      } else {
        ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      }
    }
    ctx.restore();
  }

  drawFighter(ctx, f, px) {
    const img = scaled(f.sprite, f.h * px);
    const w = (img.width / img.height) * f.h;
    const dead = f.hp <= 0;
    if (f.burn && !dead) {                            // arde: llamas por detrás que asoman alrededor
      const big = Math.max(w, f.h);
      this.vfx(ctx, 'llamas', f.x, f.y - big * 0.55, big * 1.45, { sy: 1 + Math.sin(this.t * 14) * 0.07, sx: 1 + Math.cos(this.t * 11) * 0.05 });
    }
    ctx.save();
    ctx.translate(f.x, f.y + 2);
    ctx.fillStyle = 'rgba(8,5,20,.45)';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    if (f.pet.char) {                                 // aro del color de su carácter
      ctx.strokeStyle = CHARS[f.pet.char].color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.46, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // Poses por código: respira, se abalanza al disparar, retrocede y se dobla al recibir un golpe,
    // se agacha al cargar un poder, da pasitos al caminar y salta al ganar.
    const hk = Math.min(1, f.hurt / 0.35), lk = Math.sin(f.lunge * Math.PI);
    const won = this.phase === 'over' && !dead, armed = f.isPlayer && this.armed >= 0 && this.canAct();
    const walking = f.isPlayer && this.moveTarget !== null && this.turn === f;
    const hop = won ? Math.abs(Math.sin(this.t * 8)) * 12 : walking ? Math.abs(Math.sin(this.t * 14)) * 3 : 0;
    const breathe = dead || f.frozen ? 0 : Math.sin(this.t * 3 + f.x) * 0.02;
    ctx.globalAlpha = dead ? 1 - f.fall * 0.45 : 1;
    ctx.filter = f.frozen ? 'saturate(0.3) brightness(1.3)' : hk > 0.62 ? 'brightness(2.4)' : 'none';
    ctx.translate(f.hitDir * hk * 7 + f.dir * lk * 8, -hop);
    ctx.scale(f.dir, 1);
    if (dead) ctx.rotate(-f.fall * 1.45);
    else ctx.rotate(hk * 0.28 * f.hitDir * f.dir + lk * 0.14 - (armed ? 0.05 : 0));
    ctx.scale(1 + lk * 0.14 - hk * 0.08 + (armed ? 0.04 : 0), 1 - lk * 0.1 + hk * 0.1 + breathe - (armed ? 0.06 : 0));
    ctx.drawImage(img, -w / 2, -f.h, w, f.h);
    ctx.restore();
    if (!dead) this.drawStatus(ctx, f, w);

    // Vida, MP y estados sobre la cabeza
    const bx = f.x - 18, by = f.y - f.h - 11;
    ctx.fillStyle = 'rgba(8,5,20,.8)'; ctx.fillRect(bx - 1, by - 1, 38, 9);
    ctx.fillStyle = f.isPlayer ? '#6fe36a' : '#ff5a5a';
    ctx.fillRect(bx, by, 36 * (f.hp / f.maxHp), 4);
    ctx.fillStyle = '#4db8ff';
    ctx.fillRect(bx, by + 5, 36 * (f.mp / f.maxMp), 2);
    const pips = [[f.burn, '#ff9d2e'], [f.poison, '#9be33c'], [f.shield > 0, '#4db8ff'], [f.counter > 0, '#ffd23f'],
      [f.frozen || f.frozenNext, '#c9f1ff'], [f.blind || f.blindNext, '#a06bff'], [f.rooted || f.rootNext, '#b58a4a'], [f.exposed > 0, '#ff5a5a']].filter(p => p[0]);
    pips.forEach((p, i) => { ctx.fillStyle = p[1]; ctx.fillRect(bx + i * 7, by - 8, 5, 5); });
    if (this.phase === 'aim' && this.turn === f && !this.pull?.aiming) {   // flecha: a quién le toca
      const ay = by - 6 + Math.sin(this.t * 6) * 2.5;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.moveTo(f.x - 6, ay - 9); ctx.lineTo(f.x + 6, ay - 9); ctx.lineTo(f.x, ay - 1); ctx.fill();
    }
  }

  // Proyectil: los disparos normales son un cuadradito; los de un poder llevan cola, halo y forma propia.
  drawShot(ctx, sh) {
    const look = fxOf(sh.owner.species.element), color = look.c[1], size = sh.big ? 8 : 6;
    sh.trail.forEach((q, i) => { ctx.globalAlpha = (i + 1) / sh.trail.length * 0.6; ctx.fillStyle = color; ctx.fillRect(q[0] - 2, q[1] - 2, 4, 4); });
    ctx.globalAlpha = 1;
    if (!sh.style) {
      ctx.fillStyle = color; ctx.fillRect(sh.x - size / 2, sh.y - size / 2, size, size);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sh.x - size / 4, sh.y - size / 4, size / 2, size / 2);
      return;
    }
    const a = Math.atan2(sh.vy, sh.vx), pulse = 1 + Math.sin(this.t * 30) * 0.12;
    const R = sh.style === 'comet' ? 20 : sh.style === 'beam' ? 9 : 12, len = (sh.style === 'beam' ? 130 : sh.style === 'comet' ? 115 : 56) * (0.9 + Math.sin(this.t * 41) * 0.1);
    ctx.save();
    ctx.translate(sh.x, sh.y); ctx.rotate(a);
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, R * 2.6 * pulse);
    halo.addColorStop(0, '#ffffff'); halo.addColorStop(0.3, look.c[1] + 'dd'); halo.addColorStop(1, look.c[0] + '00');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, R * 2.6 * pulse, 0, 6.3); ctx.fill();
    for (const [k, c, alpha] of [[1, look.c[0], 0.8], [0.68, look.c[1], 0.92], [0.36, '#ffffff', 0.95]]) {   // cola en tres capas
      ctx.globalAlpha = alpha; ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(R * 0.3, -R * 0.95 * k); ctx.lineTo(-len * (0.55 + 0.45 * k), 0); ctx.lineTo(R * 0.3, R * 0.95 * k); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (sh.style === 'wave') {                        // rugido: medias lunas que avanzan
      ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 1 - i * 0.28; ctx.lineWidth = 3.4 - i * 0.7;
        ctx.beginPath(); ctx.arc(-i * 10 - 6, 0, 10 + i * 5, -0.95, 0.95); ctx.stroke();
      }
    } else {                                          // núcleo en píxel, girando
      for (const [k, c] of [[0.8, '#120c24'], [0.68, look.c[1]], [0.4, '#ffffff']]) {   // cabeza redonda hecha de franjas
        ctx.fillStyle = c;
        for (let yy = -R * k; yy < R * k; yy += 2) { const half = Math.sqrt(Math.max(0, (R * k) ** 2 - (yy + 1) ** 2)); ctx.fillRect(-half, yy, half * 2, 2); }
      }
    }
    ctx.restore();
  }

  // Adornos de los poderes: columnas de luz, ondas expansivas y el emblema del poder sobre quien lo lanza.
  drawPowerFx(ctx) {
    for (const p of this.pillars) {
      const u = p.t / p.max, w = p.w * (1 - u * 0.8), top = p.y - 340;
      const g = ctx.createLinearGradient(0, p.y, 0, top);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, p.c[1] + 'dd'); g.addColorStop(1, p.c[0] + '00');
      ctx.globalAlpha = 1 - u; ctx.fillStyle = g;
      ctx.fillRect(p.x - w / 2, top, w, p.y - top + 6);
    }
    for (const r of this.rings) {
      if (r.t <= 0) continue;
      const u = r.t / r.max, rad2 = r.r * (1 - (1 - u) ** 2.2);
      ctx.globalAlpha = 1 - u; ctx.strokeStyle = r.c; ctx.lineWidth = r.w * (1 - u * 0.6);
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rad2, rad2 * 0.82, 0, 0, 6.3); ctx.stroke();
    }
    for (const c of this.casts) {
      if (!c.icon) continue;
      const u = c.t / c.max, pop = u < 0.18 ? u / 0.18 : 1, size = 46 * (0.35 + 0.65 * pop) * (1 + Math.max(0, 0.18 - u) * 1.4);
      ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      ctx.drawImage(c.icon, c.f.x - size / 2, c.f.y - c.f.h - 40 - u * 16 - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Minimapa con el campo entero, los dos bandos, los disparos y el trozo que se está viendo.
  drawMini(ctx) {
    const m = this.mini(), cam = this.cam, bottom = m.y + m.h;
    const my = y => clamp(m.y + (y - m.y0) * m.k, m.y, bottom);
    ctx.fillStyle = 'rgba(8,6,24,.74)'; ctx.fillRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
    ctx.fillStyle = this.map.terrain[3] || '#8a7aa8';
    for (let i = 0; i < m.w; i += 2) { const y = my(this.terrain[Math.min(WORLD - 1, Math.round(i / m.k))]); ctx.fillRect(m.x + i, y, 2, bottom - y); }
    ctx.fillStyle = '#cfd3e6';
    for (const r of this.rocks) ctx.fillRect(m.x + (r.x - r.rx) * m.k, my(r.y), Math.max(3, r.rx * 2 * m.k), 2);
    for (const [f, c] of [[this.rival, '#ff5a5a'], [this.player, '#6fe36a']]) {
      ctx.fillStyle = '#0a0720'; ctx.fillRect(m.x + f.x * m.k - 3.5, my(f.y) - 7.5, 7, 7);
      ctx.fillStyle = c; ctx.fillRect(m.x + f.x * m.k - 2.5, my(f.y) - 6.5, 5, 5);
    }
    ctx.fillStyle = '#ffffff';
    for (const sh of this.shots) ctx.fillRect(m.x + clamp(sh.x, 0, WORLD) * m.k - 1.5, my(sh.y) - 1.5, 3, 3);
    ctx.strokeStyle = this.look ? '#ffd76a' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 1;
    ctx.strokeRect(m.x + cam.x * m.k, my(cam.y), W * m.k, Math.max(4, my(cam.y + this.VH) - my(cam.y)));
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.strokeRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
  }

  // Flechas en el borde hacia lo que queda fuera de la pantalla: el otro bando y los disparos altos.
  drawEdges(ctx) {
    const cam = this.cam, VH = this.VH;
    for (const [f, c] of [[this.rival, '#ff5a5a'], [this.player, '#6fe36a']]) {
      const vx = f.x - cam.x;
      if (vx > -10 && vx < W + 10) continue;
      const side = vx < 0 ? -1 : 1, x = side < 0 ? 12 : W - 12, y = clamp(f.y - f.h * 0.5 - cam.y, 70, VH - this.pad - 30) + Math.sin(this.t * 5) * 2;
      ctx.fillStyle = '#0a0720'; ctx.beginPath(); ctx.moveTo(x + side * 9, y); ctx.lineTo(x - side * 7, y - 11); ctx.lineTo(x - side * 7, y + 11); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + side * 6, y); ctx.lineTo(x - side * 5, y - 7.5); ctx.lineTo(x - side * 5, y + 7.5); ctx.fill();
      ctx.font = '800 10px system-ui, sans-serif'; ctx.textAlign = side < 0 ? 'left' : 'right';
      ctx.lineWidth = 3; ctx.strokeStyle = '#0a0720';
      const label = `${Math.round(Math.abs(f.x - this.other(f).x))}`;
      ctx.strokeText(label, x - side * 11, y + 3.5); ctx.fillStyle = '#fff6d8'; ctx.fillText(label, x - side * 11, y + 3.5);
    }
    ctx.fillStyle = '#ffffff';
    for (const sh of this.shots) {
      if (sh.y >= cam.y) continue;
      const x = clamp(sh.x - cam.x, 10, W - 10);
      ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x - 6, 13); ctx.lineTo(x + 6, 13); ctx.fill();
    }
  }

  draw() {
    const { ctx, w, dpr } = fit(this.canvas);
    const s = w / W, H = this.H, VH = this.VH, img = this.map.img, cam = this.cam;
    if (this.dirty) this.renderGround();
    ctx.save();
    ctx.scale(s, s);
    if (this.shake > 0.3) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    // El fondo se mueve menos que el suelo: da sensación de distancia.
    const bk = Math.max((W + 170) / img.width, (VH + 70) / img.height), bw = img.width * bk, bh = img.height * bk;
    const px = cam.x / (WORLD - W), py = H > VH ? cam.y / (H - VH) : 1;
    ctx.drawImage(img, -20 - (bw - W - 40) * px, -20 - (bh - VH - 40) * py, bw, bh);

    // Rachas de viento: más y más rápidas cuanto más sopla
    const wind = this.windNow(), want = Math.round(Math.abs(wind) * 2);
    while (this.gusts.length < want) this.gusts.push({ x: rand(0, W), y: rand(20, VH * 0.62), len: rand(14, 34) });
    this.gusts.length = Math.min(this.gusts.length, want);
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const g of this.gusts) {
      g.x += wind * 0.55;
      if (g.x > W + 40) g.x = -40; else if (g.x < -40) g.x = W + 40;
      ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - Math.sign(wind) * g.len, g.y);
    }
    ctx.stroke();

    // --- El campo, visto desde la cámara ---
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    this.drawHazards(ctx);
    ctx.drawImage(this.ground, cam.x * 2, cam.y * 2, W * 2, VH * 2, cam.x, cam.y, W, VH);
    for (const f of [this.rival, this.player]) this.drawFighter(ctx, f, s * dpr);

    // Tirachinas: goma, potencia y guía de tiro (más larga cuanto más Puntería)
    const p = this.player, pl = this.pull;
    if (this.canAct() && this.armed >= 0) {            // poder preparado: se carga con su elemento
      const look = fxOf(p.species.element), pulse = 0.55 + 0.25 * Math.sin(this.t * 7);
      const glow = ctx.createRadialGradient(p.x, p.y - p.h * 0.35, 2, p.x, p.y - p.h * 0.35, p.h * 0.95);
      glow.addColorStop(0, look.c[1] + Math.round(pulse * 150).toString(16).padStart(2, '0'));
      glow.addColorStop(1, look.c[0] + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(p.x - p.h, p.y - p.h * 1.4, p.h * 2, p.h * 1.6);
      const icon = this.art.icon?.(p.powers[this.armed].name);
      if (icon) {
        const size = 26, iy = p.y - p.h - 46 + Math.sin(this.t * 4) * 3;
        ctx.drawImage(icon, p.x - size / 2, iy, size, size);
      }
    }
    if (this.canAct() && pl?.aiming) {
      const a = rad(p.angle), cx = p.x, cy = p.y - p.r, back = 10 + p.power * 0.45;
      ctx.strokeStyle = this.armed >= 0 ? p.color : '#ffd76a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - Math.cos(a) * back, cy + Math.sin(a) * back); ctx.stroke();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(cx - Math.cos(a) * back, cy + Math.sin(a) * back, 4, 0, Math.PI * 2); ctx.fill();
      if (!p.blind || p.sight) {
        const [mx, my] = this.muzzle(p, p.angle);
        const pts = this.trace(mx, my, p.angle, p.power, p.sight ? 500 : Math.min(60, p.prof.guide)).pts;
        pts.forEach((q, i) => { ctx.globalAlpha = 1 - (i / pts.length) * 0.75; ctx.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3); });
        ctx.globalAlpha = 1;
      }
      ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#120c24';
      const label = `${Math.round(p.angle <= 90 ? p.angle : 180 - p.angle)}° · ${Math.round(p.power)}`;
      ctx.strokeText(label, cx, p.y + 16); ctx.fillStyle = '#fff6d8'; ctx.fillText(label, cx, p.y + 16);
    }
    if (this.moveTarget !== null) {                    // marca de destino
      ctx.fillStyle = '#7fe9ff'; ctx.fillRect(this.moveTarget - 1, this.groundAt(this.moveTarget) - 9, 2, 9);
    }

    for (const sh of this.shots) this.drawShot(ctx, sh);

    // Explosiones en "píxel": círculos hechos de franjas
    for (const e of this.fx) {
      const k = e.t / 0.45, r = e.r * (0.35 + 0.65 * k);
      ctx.globalAlpha = 1 - k * 0.8;
      const cols = e.colors || [e.color, '#ffe36b', '#ffffff'];
      for (const [f, c] of [[1, cols[0]], [0.68, cols[1]], [0.36, cols[2]]]) {
        ctx.fillStyle = c;
        for (let yy = -r * f; yy <= r * f; yy += 3) {
          const half = Math.round(Math.sqrt((r * f) ** 2 - yy * yy) / 3) * 3;
          ctx.fillRect(e.x - half, e.y + yy, half * 2, 3);
        }
      }
      ctx.globalAlpha = 1;
    }
    this.drawPowerFx(ctx);
    this.drawParts(ctx);

    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const e of this.texts) {
      ctx.globalAlpha = Math.min(1, (1.2 - e.t) * 3);
      ctx.font = `900 ${e.size || 15}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = '#120c24';
      ctx.strokeText(e.text, e.x, e.y - e.t * 22);
      ctx.fillStyle = e.color; ctx.fillText(e.text, e.x, e.y - e.t * 22);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // --- Pegado a la pantalla ---
    this.drawSnow(ctx);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, this.flash * 2.4)})`; ctx.fillRect(-20, -20, W + 40, VH + 40); }
    ctx.lineJoin = 'round';
    this.drawEdges(ctx);
    this.drawMini(ctx);
    if (this.banner) {
      const m = this.mini();
      ctx.globalAlpha = Math.min(1, this.banner.t * 2.5);
      ctx.font = '900 24px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = '#120c24';
      ctx.strokeText(this.banner.text, W / 2, m.y + m.h + 36);
      ctx.fillStyle = '#ffd76a'; ctx.fillText(this.banner.text, W / 2, m.y + m.h + 36);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
