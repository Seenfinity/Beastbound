// Combate de artillería por turnos: ángulo, potencia, viento y terreno que se rompe.

import { fit, scaled } from './sprites.js';
import { ELEMENT_COLOR } from './roster.js';
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
  // sides: { pet, prof, species, sprite } para player y rival. hooks: { onEnd(win) }
  // H es el alto del campo: en un móvil en vertical hay más cielo para tiros altos.
  // scale agranda a las criaturas en pantallas estrechas.
  constructor(canvas, player, rival, map, hooks, H = 420, scale = 1) {
    this.canvas = canvas; this.map = map; this.hooks = hooks; this.H = H; this.scale = scale; this.flash = 0;
    this.terrain = makeTerrain(H);
    this.ground = document.createElement('canvas');
    this.ground.width = W * 2; this.ground.height = H * 2;
    this.pull = null; this.armed = false; this.moveTarget = null; this.gusts = [];
    this.dirty = true;
    this.player = this.makeFighter(player, 92, 1, true);
    this.rival = this.makeFighter(rival, W - 92, -1, false);
    this.shots = []; this.fx = []; this.texts = [];
    this.t = 0; this.acc = 0; this.shake = 0;
    this.wind = 0; this.banner = null; this.ended = false;
    this.startTurn(this.player);
  }

  makeFighter(side, x, dir, isPlayer) {
    const z = SIZE[side.pet.stage];
    return {
      ...side, isPlayer, x, y: this.groundAt(x), dir, r: z.r * this.scale, h: z.h * this.scale,
      hp: side.prof.maxHp, maxHp: side.prof.maxHp, angle: dir > 0 ? 55 : 125, power: 60,
      fuel: 0, cd: 2, shield: 0, counter: 0, poison: null, frozen: false, frozenNext: false,
      clutchUsed: false, hurt: 0, color: ELEMENT_COLOR[side.species.element] || '#fff6d8',
    };
  }

  groundAt(x) { return this.terrain[clamp(Math.round(x), 0, W - 1)]; }
  other(f) { return f === this.player ? this.rival : this.player; }
  say(text, time = 1.5) { this.banner = { text, t: time }; }
  canAct() { return this.phase === 'aim' && this.turn === this.player; }
  canSpecial() { const f = this.player; return this.canAct() && f.pet.stage >= 1 && f.cd === 0; }

  startTurn(f) {
    this.turn = f;
    if (f.poison) {
      this.hurt(f, f.poison.dmg, null, 'Veneno');
      if (--f.poison.turns <= 0) f.poison = null;
      if (f.hp <= 0) return this.finish();
    }
    if (f.prof.regen && f.hp < f.maxHp) this.heal(f, Math.round(f.maxHp * f.prof.regen));
    f.frozen = f.frozenNext; f.frozenNext = false;
    f.fuel = f.frozen ? 0 : f.prof.fuel;
    if (f.cd > 0) f.cd--;
    this.wind = Math.round(rand(-10, 10));
    this.phase = 'aim';
    if (f.isPlayer) sfx.turn();
    this.say(f.frozen ? `${f.pet.name} está congelado` : f.isPlayer ? '¡Tu turno!' : `Turno de ${f.pet.name}`);
    if (!f.isPlayer) { this.aiTimer = 1.5; this.aiReady = false; }
  }

  muzzle(f, angle) {
    const a = rad(angle), d = f.r + 6;
    return [f.x + Math.cos(a) * d, f.y - f.r - Math.sin(a) * d];
  }

  // Simula un disparo normal: sirve para la guía de tiro y para que la máquina apunte.
  trace(x, y, angle, power, limit = 0) {
    const v = speedOf(power);
    let vx = Math.cos(rad(angle)) * v, vy = -Math.sin(rad(angle)) * v;
    const pts = [];
    for (let i = 0; i < 1400; i++) {
      vx += this.wind * WIND_K * STEP; vy += GRAVITY * STEP;
      x += vx * STEP; y += vy * STEP;
      if (limit && i % 3 === 0) { pts.push([x, y]); if (pts.length >= limit) return { pts, end: null }; }
      if (x < -80 || x > W + 80 || y > this.H + 30) return { pts, end: null };
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
  toggleSpecial() {
    if (this.canSpecial()) this.armed = !this.armed;
  }

  fire(special = false) {
    if (this.phase !== 'aim') return;
    const f = this.turn, foe = this.other(f);
    if (special && (f.pet.stage < 1 || f.cd > 0)) return;
    if (f.isPlayer) this.armed = false;
    const sp = special ? f.species.special : {};
    const m = special ? f.prof.mastery : '';
    let angle = f.angle;
    if (f.isPlayer && Math.random() < f.prof.disobey) {
      angle += (Math.random() < 0.5 ? -1 : 1) * rand(5, 9);
      this.say(`¡${f.pet.name} no te hizo caso!`);
    } else if (special) {
      this.say(`${f.pet.name}: ¡${sp.name}!`);
    }
    let dmg = f.prof.dmg * (sp.dmg ?? 1) * (m === 'pot' ? 1.25 : 1);
    if (f.pet.char === 'feroz' && f.hp < f.maxHp / 2) dmg *= 1.2;
    const blast = (sp.blast ?? 30) * (m === 'pun' ? 1.3 : 1);
    if (special) {
      f.cd = f.prof.cdSpecial;
      if (sp.shield) f.shield = sp.shield;
      if (m === 'agu') f.shield = Math.max(f.shield, 0.3);
      if (sp.counter) f.counter = sp.counter;
      if (sp.heal) this.heal(f, Math.round(f.maxHp * sp.heal));
      if (sp.gust) this.wind = (foe.x > f.x ? 1 : -1) * 8;
    }
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
    if (special) sfx.special(); else sfx.shoot();
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
    this.texts.push({ x: f.x, y: f.y - f.h - 12, text: `+${real}`, t: 0, color: '#7dff9b' });
  }

  hurt(f, amount, from, tag = '') {
    let dmg = Math.max(1, Math.round(amount));
    if (f.shield > 0 && from) { dmg = Math.max(1, Math.round(dmg * (1 - f.shield))); f.shield = 0; tag = 'Escudo'; }
    if (f.counter > 0 && from && from !== f) {
      const back = Math.max(1, Math.round(dmg * f.counter));
      f.counter = 0;
      from.hp = Math.max(0, from.hp - back); from.hurt = 0.35;
      this.texts.push({ x: from.x, y: from.y - from.h - 12, text: `-${back} Batería`, t: 0, color: '#ffd23f' });
    }
    if (f.hp - dmg <= 0 && f.prof.clutch && !f.clutchUsed) {
      f.clutchUsed = true;
      dmg = f.hp - 1;
      this.say(f.isPlayer ? `¡${f.pet.name} aguanta por ti!` : `¡${f.pet.name} se niega a caer!`, 1.8);
    }
    f.hp = Math.max(0, f.hp - dmg);
    f.hurt = 0.35;
    this.texts.push({ x: f.x, y: f.y - f.h - 12, text: `-${dmg}${tag ? ' ' + tag : ''}`, t: 0, color: tag === 'Veneno' ? '#9be33c' : '#ffd76a' });
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
    const sp = s.sp;
    if (sp.mound) this.mound(s.x, sp.mound); else this.carve(s.x, s.y, s.blast * 0.75);
    this.fx.push({ x: s.x, y: s.y, r: s.blast, t: 0, color: s.owner.color });
    this.flash = 0.14;
    sfx.boom();
    this.shake = Math.min(9, s.blast / 5);
    for (const f of [this.player, this.rival]) {
      const d = Math.hypot(f.x - s.x, f.y - f.r - s.y);
      if (d >= s.blast + f.r) continue;
      const k = clamp(1 - (d - f.r) / s.blast, 0, 1);
      let dmg = s.dmg * (0.3 + 0.7 * k), tag = '';
      if (sp.crit && k > 0.45 && Math.random() < sp.crit) { dmg *= 2; tag = '¡Crítico!'; }
      const done = this.hurt(f, dmg, s.owner, tag);
      if (f === s.owner) continue;
      if (sp.drain) this.heal(s.owner, Math.round(done * sp.drain));
      if (sp.poison) f.poison = { turns: sp.poison, dmg: Math.max(2, Math.round(s.owner.prof.dmg * 0.3)) };
      if (sp.freeze) f.frozenNext = true;
      if (sp.push) f.x = clamp(f.x + (f.x >= s.owner.x ? 1 : -1) * sp.push, 14, W - 14);
    }
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
    const err = Math.max(1, 7 - f.pet.level * 0.45) * (f.frozen ? 2.5 : 1);
    f.angle = clamp(best.angle + rand(-err, err), 0, 180);
    f.power = clamp(best.power + rand(-err, err) * 1.2, 10, 100);
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
      if (f.hp <= 0) f.fall = Math.min(1, (f.fall || 0) + dt * 2.2); // se desploma
      const g = this.groundAt(f.x);
      f.y = f.y < g ? Math.min(g, f.y + 220 * dt) : g;
    }
    this.fx = this.fx.filter(e => (e.t += dt) < 0.45);
    this.texts = this.texts.filter(e => (e.t += dt) < 1.1);

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
        if (this.aiTimer <= 0) this.fire(f.pet.stage >= 1 && f.cd === 0 && Math.random() < 0.6);
      }
    }

    for (const s of this.shots) {
      s.age += dt;
      if (!s.sp.noWind) s.vx += this.wind * WIND_K * dt;
      s.vy += GRAVITY * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (Math.round(s.age / dt) % 3 === 0) { s.trail.push([s.x, s.y]); if (s.trail.length > 10) s.trail.shift(); }
      if (s.x < -80 || s.x > W + 80 || s.y > this.H + 30) { s.dead = true; continue; }
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

    if (this.phase === 'flying' && !this.shots.length) { this.phase = 'resolve'; this.timer = 0.9; }
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
    ctx.globalAlpha = dead ? 1 - (f.fall || 0) * 0.45 : f.hurt > 0 && Math.floor(f.hurt * 30) % 2 ? 0.35 : 1;
    if (f.frozen) ctx.filter = 'saturate(0.3) brightness(1.3)';
    const bob = dead ? 0 : Math.round(Math.sin(this.t * 3 + f.x) * 1.2);
    ctx.scale(f.dir, 1);
    if (dead) ctx.rotate(-(f.fall || 0) * 1.45);
    ctx.drawImage(img, -w / 2, -f.h + bob, w, f.h);
    ctx.restore();

    // Vida y estados sobre la cabeza
    const bx = f.x - 18, by = f.y - f.h - 9;
    ctx.fillStyle = 'rgba(8,5,20,.8)'; ctx.fillRect(bx - 1, by - 1, 38, 6);
    ctx.fillStyle = f.isPlayer ? '#6fe36a' : '#ff5a5a';
    ctx.fillRect(bx, by, 36 * (f.hp / f.maxHp), 4);
    const pips = [[f.poison, '#9be33c'], [f.shield > 0, '#4db8ff'], [f.counter > 0, '#ffd23f'], [f.frozen || f.frozenNext, '#c9f1ff']].filter(p => p[0]);
    pips.forEach((p, i) => { ctx.fillStyle = p[1]; ctx.fillRect(bx + i * 7, by - 8, 5, 5); });
    if (this.phase === 'aim' && this.turn === f && !this.pull?.aiming) {   // flecha: a quién le toca
      const ay = by - 6 + Math.sin(this.t * 6) * 2.5;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.moveTo(f.x - 6, ay - 9); ctx.lineTo(f.x + 6, ay - 9); ctx.lineTo(f.x, ay - 1); ctx.fill();
    }
  }

  draw() {
    const { ctx, w, dpr } = fit(this.canvas);
    const s = w / W;
    if (this.dirty) this.renderGround();
    ctx.save();
    ctx.scale(s, s);
    if (this.shake > 0.3) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    const H = this.H, img = this.map.img;
    const bk = Math.max((W + 20) / img.width, (H + 16) / img.height); // el fondo cubre todo el campo
    ctx.drawImage(img, (W - img.width * bk) / 2, (H - img.height * bk) * 0.3, img.width * bk, img.height * bk);

    // Rachas de viento: más y más rápidas cuanto más sopla
    const want = Math.abs(this.wind) * 2;
    while (this.gusts.length < want) this.gusts.push({ x: rand(0, W), y: rand(20, H * 0.62), len: rand(14, 34) });
    this.gusts.length = Math.min(this.gusts.length, want);
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const g of this.gusts) {
      g.x += this.wind * 0.55;
      if (g.x > W + 40) g.x = -40; else if (g.x < -40) g.x = W + 40;
      ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - Math.sign(this.wind) * g.len, g.y);
    }
    ctx.stroke();

    ctx.drawImage(this.ground, 0, 0, W, H);

    for (const f of [this.rival, this.player]) this.drawFighter(ctx, f, s * dpr);

    // Tirachinas: goma, potencia y guía de tiro (más larga cuanto más Puntería)
    const p = this.player, pl = this.pull;
    if (this.canAct() && this.armed) {                 // especial preparado
      ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 8);
      ctx.beginPath(); ctx.arc(p.x, p.y - p.r, p.r + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.canAct() && pl?.aiming) {
      const a = rad(p.angle), cx = p.x, cy = p.y - p.r, back = 10 + p.power * 0.45;
      ctx.strokeStyle = this.armed ? p.color : '#ffd76a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - Math.cos(a) * back, cy + Math.sin(a) * back); ctx.stroke();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(cx - Math.cos(a) * back, cy + Math.sin(a) * back, 4, 0, Math.PI * 2); ctx.fill();
      if (!p.frozen) {
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
      ctx.globalAlpha = Math.min(1, (1.1 - e.t) * 3);
      ctx.font = '900 15px system-ui, sans-serif';
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
