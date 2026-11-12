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
    this.shots = []; this.fx = []; this.texts = []; this.gusts = [];
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
    this.say(f.frozen ? `${f.pet.name} está congelado` : f.rooted ? `${f.pet.name} no puede moverse` : f.isPlayer ? '¡Tu turno!' : `Turno de ${f.pet.name}`);
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
    this.fx.push({ x: s.x, y: s.y, r: s.blast, t: 0, color: me.color });
    this.shake = Math.min(9, s.blast / 5);
    this.flash = 0.14;
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
      if (sp.poison) f.poison = dot(sp.poison);
      if (sp.burn) f.burn = dot(sp.burn);
      if (sp.freeze) f.frozenNext = true;
      if (sp.blind) f.blindNext = true;
      if (sp.root) f.rootNext = true;
      if (sp.expose) f.exposed = sp.expose;
      if (sp.shock) { const lost = Math.min(f.mp, sp.shock); f.mp -= lost; if (lost) this.note(f, `-${lost} MP`, '#7fe9ff', 12); }
      if (sp.push) f.x = clamp(f.x + (f.x >= me.x ? 1 : -1) * sp.push, 14, W - 14);
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
      const color = sh.owner.color, size = sh.big ? 8 : 6;
      sh.trail.forEach((q, i) => { ctx.globalAlpha = (i + 1) / sh.trail.length * 0.6; ctx.fillStyle = color; ctx.fillRect(q[0] - 2, q[1] - 2, 4, 4); });
      ctx.globalAlpha = 1;
      ctx.fillStyle = color; ctx.fillRect(sh.x - size / 2, sh.y - size / 2, size, size);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sh.x - size / 4, sh.y - size / 4, size / 2, size / 2);
    }

    // Explosiones en "píxel": círculos hechos de franjas
    for (const e of this.fx) {
      const k = e.t / 0.45, r = e.r * (0.35 + 0.65 * k);
      ctx.globalAlpha = 1 - k * 0.8;
      for (const [f, c] of [[1, e.color], [0.68, '#ffe36b'], [0.36, '#ffffff']]) {
        ctx.fillStyle = c;
        for (let yy = -r * f; yy <= r * f; yy += 3) {
          const half = Math.round(Math.sqrt((r * f) ** 2 - yy * yy) / 3) * 3;
          ctx.fillRect(e.x - half, e.y + yy, half * 2, 3);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, this.flash * 2.4)})`; ctx.fillRect(-20, -20, W + 40, H + 40); }

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
