// Combate de artillería por turnos: tirachinas, viento, terreno que se rompe,
// poderes con MP, ventajas entre elementos y efectos propios de cada mapa.

import { fit, scaled } from './sprites.js';
import { ELEMENT_COLOR, matchup } from './roster.js';
import { CHARS } from './state.js';
import { sfx } from './sfx.js';

export const W = 640;                   // ancho del campo en unidades de juego (el alto depende de la pantalla)
const GRAVITY = 300, WIND_K = 5, STEP = 1 / 120;
const SIZE = [{ h: 48, r: 15 }, { h: 60, r: 19 }, { h: 74, r: 23 }]; // alto y radio de golpe por etapa

const rad = d => (d * Math.PI) / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const speedOf = power => 110 + power * 3.9;

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

function makeTerrain(H) {
  const t = new Float32Array(W);
  const base = H - rand(104, 130), a1 = rand(10, 24), f1 = rand(0.006, 0.012), p1 = rand(0, 6.28);
  const a2 = rand(4, 9), f2 = rand(0.02, 0.035), p2 = rand(0, 6.28);
  const mid = Math.random() < 0.5 ? -rand(30, 72) : rand(30, 60); // colina o valle en medio
  const mx = rand(270, 370), mw = rand(45, 80);
  for (let x = 0; x < W; x++) {
    const y = base + Math.sin(x * f1 + p1) * a1 + Math.sin(x * f2 + p2) * a2 + mid * Math.exp(-((x - mx) ** 2) / (2 * mw * mw));
    t[x] = clamp(y, H - 250, H - 26);
  }
  return t;
}

export class Battle {
  // Cada bando: { pet, prof, species, sprite, powers }. hooks: { onEnd(win) }
  // H es el alto del campo; scale agranda a las criaturas en pantallas estrechas.
  constructor(canvas, player, rival, map, hooks, H = 420, scale = 1) {
    this.canvas = canvas; this.map = map; this.hooks = hooks; this.H = H; this.scale = scale;
    this.terrain = makeTerrain(H);
    this.ground = document.createElement('canvas');
    this.ground.width = W * 2; this.ground.height = H * 2;
    this.dirty = true;
    this.player = this.makeFighter(player, 92, 1, true);
    this.rival = this.makeFighter(rival, W - 92, -1, false);
    this.shots = []; this.fx = []; this.texts = []; this.gusts = []; this.parts = [];
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
      shield: 0, counter: 0, exposed: 0, poison: null, burn: null,
      frozen: false, frozenNext: false, blind: false, blindNext: false, rooted: false, rootNext: false,
      clutchUsed: false, hurt: 0, fall: 0, color: ELEMENT_COLOR[side.species.element] || '#fff6d8',
    };
  }

  // --- Efectos del mapa ---
  setupHazards(h) {
    const top = Math.min(...this.terrain);
    const slots = h.rocks === 1 ? [[280, 360]] : [[190, 280], [360, 450]];
    this.rocks = slots.slice(0, h.rocks || 0).map(([a, b]) => ({ x: rand(a, b), y: Math.max(64, top - rand(64, 140)), rx: rand(26, 38), ry: rand(13, 18) }));
    this.thermals = [[190, 290], [350, 450]].slice(0, h.thermals || 0).map(([a, b]) => ({ x: rand(a, b), w: rand(34, 48) }));
    this.birds = Array.from({ length: h.birds || 0 }, (_, i) => this.newBird(i, true));
    this.gusty = !!h.gusty;
    this.snow = h.snow ? Array.from({ length: 46 }, () => ({ x: rand(0, W), y: rand(0, this.H), v: rand(18, 46) })) : [];
  }
  newBird(i, anywhere = false) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { x: anywhere ? rand(0, W) : dir > 0 ? -20 : W + 20, y: rand(40, Math.max(60, this.H * 0.42)), dir, v: rand(36, 60), phase: i * 2.1, away: 0 };
  }
  rockAt(x, y) { return this.rocks.find(r => ((x - r.x) / r.rx) ** 2 + ((y - r.y) / r.ry) ** 2 < 1); }
  lift(x) { return this.thermals.some(t => Math.abs(x - t.x) < t.w / 2) ? 560 : 0; } // empuje hacia arriba
  windNow() { return this.wind + (this.gusty ? Math.sin(this.t * 1.9) * 4 : 0); }

  groundAt(x) { return this.terrain[clamp(Math.round(x), 0, W - 1)]; }
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
    for (let i = 0; i < 1400; i++) {
      vx += this.wind * WIND_K * STEP; vy += (GRAVITY - this.lift(x)) * STEP;
      x += vx * STEP; y += vy * STEP;
      if (limit && i % 3 === 0) { pts.push([x, y]); if (pts.length >= limit) return { pts, end: null }; }
      if (x < -80 || x > W + 80 || y > this.H + 30) return { pts, end: null };
      if (this.rockAt(x, y)) return { pts, end: null };
      if (x >= 0 && x < W && y >= this.groundAt(x)) return { pts, end: [x, y] };
    }
    return { pts, end: null };
  }

  // Tirachinas: se arrastra hacia atrás desde cualquier punto y se suelta para disparar.
  // Un toque sin arrastrar hace que la criatura camine hacia ese punto.
  pullStart(wx, wy) {
    if (!this.canAct()) return;
    this.pull = { sx: wx, sy: wy, x: wx, y: wy, aiming: false };
    this.moveTarget = null;
  }
  pullMove(wx, wy) {
    const p = this.pull;
    if (!p || !this.canAct()) return;
    p.x = wx; p.y = wy;
    const dx = p.sx - wx, dy = p.sy - wy, len = Math.hypot(dx, dy);
    p.aiming = len > 12;
    if (!p.aiming) return;
    const f = this.player;
    let a = (Math.atan2(-dy, dx) * 180) / Math.PI;
    if (a < 0) a = dx >= 0 ? 0 : 180;
    f.angle = clamp(a, 0, 180);
    f.power = clamp(len / 1.6, 5, 100);
  }
  pullEnd() {
    const p = this.pull;
    this.pull = null;
    if (!p || !this.canAct()) return;
    if (p.aiming) { if (this.player.power > 8) this.fire(this.armed); }
    else this.moveTarget = p.sx;
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
      if (sp.counter) f.counter = sp.counter;
      if (sp.heal) this.heal(f, Math.round(f.maxHp * sp.heal));
      if (sp.gust) this.wind = (foe.x > f.x ? 1 : -1) * 8;
    }
    this.volley = pw ? { f, index, name: pw.name, hit: false } : null;
    const n = sp.count ?? 1;
    for (let i = 0; i < n; i++) {
      const a = angle + (i - (n - 1) / 2) * (sp.spread ?? 0);
      const [x, y] = this.muzzle(f, a);
      const v = speedOf(f.power) * (sp.fast ?? 1);
      this.shots.push({
        x, y, vx: Math.cos(rad(a)) * v, vy: -Math.sin(rad(a)) * v, dmg, blast, owner: f, sp,
        age: 0, bounces: 0, pierceLeft: sp.pierce || 0, trail: [], big: blast > 40,
      });
    }
    this.phase = 'flying';
    if (pw) sfx.special(); else sfx.shoot();
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
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
      const dy = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)), g = this.terrain[x];
      if (g >= cy + dy) continue;                       // el suelo queda por debajo del hueco
      this.terrain[x] = Math.min(this.H - 10, g >= cy - dy ? cy + dy : g + 2 * dy);
    }
    this.dirty = true;
  }
  mound(cx, r) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
      const up = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)) * 1.25;
      this.terrain[x] = Math.max(this.H - 320, this.terrain[x] - up);
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
    sfx.boom();
    for (const f of [this.player, this.rival]) {
      const d = Math.hypot(f.x - s.x, f.y - f.r - s.y);
      if (d >= s.blast + f.r) continue;
      const k = clamp(1 - (d - f.r) / s.blast, 0, 1), foe = f !== me;
      let dmg = s.dmg * (0.3 + 0.7 * k), tag = '';
      if (foe) {                                        // ventaja o desventaja de elemento
        const mult = matchup(me.species.element, f.species.element);
        dmg *= mult;
        tag = mult > 1 ? '¡Eficaz!' : mult < 1 ? 'Poco eficaz' : '';
        if (f.exposed > 0) { dmg *= 1.25; f.exposed--; }
      }
      if (sp.crit && k > 0.45 && Math.random() < sp.crit) { dmg *= 2; this.note(f, '¡Crítico!', '#ffffff', 13); }
      const done = this.hurt(f, dmg, me, tag);
      if (!foe) continue;
      if (this.volley) this.volley.hit = true;
      const dot = turns => ({ turns, dmg: Math.max(2, Math.round(me.prof.dmg * 0.32)) });
      if (sp.drain) this.heal(me, Math.round(done * sp.drain));
      if (sp.poison) { f.poison = dot(sp.poison); this.note(f, '¡Envenenado!', '#9be33c', 13); }
      if (sp.burn) { f.burn = dot(sp.burn); this.note(f, '¡Quemado!', '#ff9d2e', 13); }
      if (sp.freeze) { f.frozenNext = true; this.note(f, '¡Congelado!', '#c9f1ff', 13); }
      if (sp.blind) { f.blindNext = true; this.note(f, '¡Cegado!', '#c9a8ff', 13); }
      if (sp.root) { f.rootNext = true; this.note(f, '¡Inmóvil!', '#d9b06a', 13); }
      if (sp.expose) { f.exposed = sp.expose; this.note(f, '¡Debilitado!', '#ff7a7a', 13); }
      if (sp.shock) { const lost = Math.min(f.mp, sp.shock); f.mp -= lost; if (lost) this.note(f, `-${lost} MP`, '#7fe9ff', 12); }
      if (sp.push) f.x = clamp(f.x + (f.x >= me.x ? 1 : -1) * sp.push, 14, W - 14);
    }
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
    const dx = dir * 42 * dt, nx = clamp(f.x + dx, 14, W - 14);
    if (f.y - this.groundAt(nx + dir * 2) > 5) return; // cuesta demasiado empinada
    f.x = nx;
    f.fuel = Math.max(0, f.fuel - Math.abs(dx));
    f.dir = dir;
  }

  planAI() {
    const f = this.rival, tgt = this.player, left = tgt.x < f.x;
    let best = null;
    for (let i = 0; i < 80; i++) {
      const angle = left ? rand(98, 172) : rand(8, 82), power = rand(25, 100);
      const [x, y] = this.muzzle(f, angle);
      const end = this.trace(x, y, angle, power).end;
      if (!end) continue;
      const d = Math.abs(end[0] - tgt.x) + Math.abs(end[1] - tgt.y) * 0.3;
      if (!best || d < best.d) best = { d, angle, power };
    }
    best = best || { angle: left ? 135 : 45, power: 60 };
    const err = Math.max(1, 7 - f.pet.level * 0.45) * (f.blind ? 2.5 : 1);
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
      if (f.hp <= 0) f.fall = Math.min(1, f.fall + dt * 2.2); // se desploma
      const g = this.groundAt(f.x);
      f.y = f.y < g ? Math.min(g, f.y + 220 * dt) : g;
    }
    this.fx = this.fx.filter(e => (e.t += dt) < 0.45);
    this.texts = this.texts.filter(e => (e.t += dt) < 1.2);
    for (const q of this.parts) { q.life += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    this.parts = this.parts.filter(q => q.life < q.max);
    this.birds.forEach((b, i) => {
      if (b.away > 0) { if ((b.away -= dt) <= 0) Object.assign(b, this.newBird(i)); return; }
      b.x += b.v * b.dir * dt;
      if (b.x < -30 || b.x > W + 30) Object.assign(b, this.newBird(i));
    });

    if (this.phase === 'aim') {
      const f = this.turn;
      if (f.isPlayer) {
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
      if (Math.round(s.age / dt) % 6 === 0) {         // estela con el aspecto de su elemento
        const look = fxOf(s.owner.species.element), kind = ['bolt', 'ray', 'swirl', 'wisp'].includes(look.kind) ? 'star' : look.kind;
        this.parts.push({ k: kind, x: s.x, y: s.y, vx: rand(-12, 12), vy: rand(-12, 12), g: kind === 'drop' || kind === 'rock' ? 160 : kind === 'ember' || kind === 'flame' ? -40 : 0, life: 0, max: rand(0.25, 0.5), c: look.c[Math.floor(rand(0, 3))], s: rand(1.5, 3), a: rand(0, 6) });
      }
      if (s.x < -80 || s.x > W + 80 || s.y > this.H + 30) { s.dead = true; continue; }
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
      if (s.dead || s.x < 0 || s.x >= W || s.y < this.groundAt(s.x)) continue;
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

  // --- Dibujo ---

  renderGround() {
    const g = this.ground.getContext('2d');
    const [rock, rock2, edge, top, light] = this.map.terrain;
    const H = this.H;
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, W, H);
    for (let x = 0; x < W; x += 2) {
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
    if (this.snow.length) {                           // nieve arrastrada por el viento
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      const wind = this.windNow();
      for (const s of this.snow) {
        s.x += wind * 0.22; s.y += s.v * 0.016;
        if (s.y > H) { s.y = -4; s.x = rand(0, W); }
        if (s.x > W + 4) s.x = -4; else if (s.x < -4) s.x = W + 4;
        ctx.fillRect(s.x, s.y, 2, 2);
      }
    }
  }

  // Lo que le pasa a la criatura se ve encima de ella.
  drawStatus(ctx, f, w) {
    const t = this.t, cx = f.x, top = f.y - f.h, mid = f.y - f.h * 0.5;
    ctx.save();
    ctx.lineCap = 'round';
    if (f.frozen || f.frozenNext) {                    // bloque de hielo
      ctx.fillStyle = 'rgba(160,220,255,.42)'; ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx - w * 0.55, top - 3, w * 1.1, f.h + 5, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - w * 0.36, top + 4); ctx.lineTo(cx - w * 0.12, top + f.h * 0.42);
      ctx.moveTo(cx - w * 0.2, top + 3); ctx.lineTo(cx - w * 0.06, top + f.h * 0.22); ctx.stroke();
    }
    if (f.rooted || f.rootNext) {                      // raíces que le sujetan las patas
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2;
      for (const i of [-1, -0.45, 0.45, 1]) {
        ctx.beginPath(); ctx.moveTo(cx + i * w * 0.52, f.y + 2);
        ctx.quadraticCurveTo(cx + i * w * 0.5, f.y - f.h * 0.24, cx + i * w * 0.22, f.y - f.h * 0.14); ctx.stroke();
        ctx.fillStyle = '#6fd45a'; ctx.fillRect(cx + i * w * 0.22 - 1.5, f.y - f.h * 0.14 - 3, 3, 3);
      }
    }
    if (f.burn) {                                      // llamas que suben por el cuerpo
      for (let i = 0; i < 5; i++) {
        const y = f.y - ((t * 40 + i * 19) % (f.h * 0.95)), x = cx + Math.sin(i * 2.1 + t * 3) * w * 0.38, k = 1 - (f.y - y) / f.h;
        ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff7a1f'; ctx.fillRect(x - 1.5 - k, y - 1.5 - k, 3 + k * 2, 3 + k * 2);
      }
    }
    if (f.poison) {                                    // burbujas verdes
      ctx.strokeStyle = '#9be33c'; ctx.fillStyle = 'rgba(155,227,60,.3)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const y = f.y - ((t * 22 + i * 23) % f.h), x = cx + Math.sin(i * 1.7 + t * 2) * w * 0.42;
        ctx.beginPath(); ctx.arc(x, y, 2 + (i % 2) * 1.2, 0, 6.3); ctx.fill(); ctx.stroke();
      }
    }
    if (f.blind || f.blindNext) {                      // nube oscura sobre los ojos
      const ey = top + f.h * 0.34;
      ctx.fillStyle = 'rgba(38,14,78,.88)';
      for (let i = 0; i < 6; i++) {
        const a = t * 2.4 + i * 1.05;
        ctx.beginPath(); ctx.arc(cx + f.dir * w * 0.1 + Math.cos(a) * w * 0.24, ey + Math.sin(a * 1.3) * f.h * 0.07, f.h * 0.13, 0, 6.3); ctx.fill();
      }
      ctx.fillStyle = '#c9a8ff';
      for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; ctx.fillRect(cx + Math.cos(a) * w * 0.34, ey + Math.sin(a) * f.h * 0.12, 2, 2); }
    }
    if (f.exposed > 0) {                               // grietas rojas: recibe más daño
      ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 9);
      ctx.beginPath(); ctx.moveTo(cx - w * 0.2, top + f.h * 0.22); ctx.lineTo(cx + w * 0.05, top + f.h * 0.42);
      ctx.lineTo(cx - w * 0.1, top + f.h * 0.58); ctx.lineTo(cx + w * 0.16, top + f.h * 0.8); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (f.shield > 0) {                                // burbuja protectora
      ctx.strokeStyle = 'rgba(120,205,255,.95)'; ctx.fillStyle = 'rgba(77,184,255,.16)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, mid, w * 0.62, f.h * 0.62, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    }
    if (f.counter > 0) {                               // anillo eléctrico que devuelve el golpe
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.ellipse(cx, mid, w * 0.68, f.h * 0.68, 0, 0, 6.3); ctx.stroke();
    }
    ctx.restore();
  }

  drawParts(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of this.parts) {
      const u = p.life / p.max;
      ctx.globalAlpha = Math.max(0, 1 - u);
      ctx.fillStyle = ctx.strokeStyle = p.c;
      if (p.k === 'bubble') {
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
    ctx.save();
    ctx.translate(f.x, f.y + 2);
    ctx.fillStyle = 'rgba(8,5,20,.45)';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    if (f.pet.char) {                                 // aro del color de su carácter
      ctx.strokeStyle = CHARS[f.pet.char].color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.46, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = dead ? 1 - f.fall * 0.45 : f.hurt > 0 && Math.floor(f.hurt * 30) % 2 ? 0.35 : 1;
    if (f.frozen) ctx.filter = 'saturate(0.3) brightness(1.3)';
    const bob = dead ? 0 : Math.round(Math.sin(this.t * 3 + f.x) * 1.2);
    ctx.scale(f.dir, 1);
    if (dead) ctx.rotate(-f.fall * 1.45);
    ctx.drawImage(img, -w / 2, -f.h + bob, w, f.h);
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

  draw() {
    const { ctx, w, dpr } = fit(this.canvas);
    const s = w / W, H = this.H, img = this.map.img;
    if (this.dirty) this.renderGround();
    ctx.save();
    ctx.scale(s, s);
    if (this.shake > 0.3) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    const bk = Math.max((W + 20) / img.width, (H + 16) / img.height); // el fondo cubre todo el campo
    ctx.drawImage(img, (W - img.width * bk) / 2, (H - img.height * bk) * 0.3, img.width * bk, img.height * bk);

    // Rachas de viento: más y más rápidas cuanto más sopla
    const wind = this.windNow(), want = Math.round(Math.abs(wind) * 2);
    while (this.gusts.length < want) this.gusts.push({ x: rand(0, W), y: rand(20, H * 0.62), len: rand(14, 34) });
    this.gusts.length = Math.min(this.gusts.length, want);
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const g of this.gusts) {
      g.x += wind * 0.55;
      if (g.x > W + 40) g.x = -40; else if (g.x < -40) g.x = W + 40;
      ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - Math.sign(wind) * g.len, g.y);
    }
    ctx.stroke();

    this.drawHazards(ctx);
    ctx.drawImage(this.ground, 0, 0, W, H);
    for (const f of [this.rival, this.player]) this.drawFighter(ctx, f, s * dpr);

    // Tirachinas: goma, potencia y guía de tiro (más larga cuanto más Puntería)
    const p = this.player, pl = this.pull;
    if (this.canAct() && this.armed >= 0) {            // poder preparado
      ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 8);
      ctx.beginPath(); ctx.arc(p.x, p.y - p.r, p.r + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.canAct() && pl?.aiming) {
      const a = rad(p.angle), cx = p.x, cy = p.y - p.r, back = 10 + p.power * 0.45;
      ctx.strokeStyle = this.armed >= 0 ? p.color : '#ffd76a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - Math.cos(a) * back, cy + Math.sin(a) * back); ctx.stroke();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(cx - Math.cos(a) * back, cy + Math.sin(a) * back, 4, 0, Math.PI * 2); ctx.fill();
      if (!p.blind) {
        const [mx, my] = this.muzzle(p, p.angle);
        const pts = this.trace(mx, my, p.angle, p.power, Math.min(60, p.prof.guide)).pts;
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

    for (const sh of this.shots) {
      const color = fxOf(sh.owner.species.element).c[1], size = sh.big ? 8 : 6;
      sh.trail.forEach((q, i) => { ctx.globalAlpha = (i + 1) / sh.trail.length * 0.6; ctx.fillStyle = color; ctx.fillRect(q[0] - 2, q[1] - 2, 4, 4); });
      ctx.globalAlpha = 1;
      ctx.fillStyle = color; ctx.fillRect(sh.x - size / 2, sh.y - size / 2, size, size);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sh.x - size / 4, sh.y - size / 4, size / 2, size / 2);
    }

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
    this.drawParts(ctx);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, this.flash * 2.4)})`; ctx.fillRect(-20, -20, W + 40, H + 40); }

    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const e of this.texts) {
      ctx.globalAlpha = Math.min(1, (1.2 - e.t) * 3);
      ctx.font = `900 ${e.size || 15}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = '#120c24';
      ctx.strokeText(e.text, e.x, e.y - e.t * 22);
      ctx.fillStyle = e.color; ctx.fillText(e.text, e.x, e.y - e.t * 22);
    }
    if (this.banner) {
      ctx.globalAlpha = Math.min(1, this.banner.t * 2.5);
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.lineWidth = 6; ctx.strokeStyle = '#120c24';
      ctx.strokeText(this.banner.text, W / 2, 60);
      ctx.fillStyle = '#ffd76a'; ctx.fillText(this.banner.text, W / 2, 60);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
