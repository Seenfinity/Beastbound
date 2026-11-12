// Minijuegos de entrenamiento, uno por estadística. Se juegan dentro de la sala.
// Cada uno expone: update(dt), draw(ctx, room), down/move/up(x, y), done y score (0–1).
// view = { x0, w, cx } es la parte visible de la sala; FLOOR es la altura del suelo.

import { sfx } from './sfx.js';

export const FLOOR = 716;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const MINI_INFO = {
  pot: { title: 'Golpe justo', help: 'Toca cuando la marca pase por el centro.' },
  pun: { title: 'Tiro al blanco', help: 'Arrastra hacia atrás y suelta para dar a las dianas.' },
  agu: { title: 'Empuja la roca', help: 'Toca rápido para llevarla hasta la estrella.' },
  agi: { title: 'Esquiva', help: 'Arrastra a los lados para que no le caigan encima.' },
};

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(8,6,24,.8)';
  ctx.beginPath(); ctx.roundRect(x - 4, y - 4, w + 8, h + 8, h); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w * clamp(frac, 0, 1)), h, h / 2); ctx.fill();
}

// Potencia: una marca va y viene; hay que tocar justo cuando pasa por el centro. Tres golpes.
function golpe(view) {
  return {
    t: rand(0, 3), round: 0, scores: [], wait: 0, done: false, score: 0, cx: view.cx - 200, dir: 1, lunge: 0, shake: 0, msg: null, at: 0.5,
    pos() { return this.wait > 0 ? this.at : 0.5 + 0.5 * Math.sin(this.t * (3 + this.round * 1.2)); },
    zone() { return 0.09 - this.round * 0.018; },
    down() {
      if (this.wait > 0 || this.done) return;
      const p = this.pos(), d = Math.abs(p - 0.5), z = this.zone();
      const s = d < z ? 1 : d < z * 2.4 ? 0.5 : 0;
      this.scores.push(s); this.at = p; this.wait = 0.85; this.lunge = 1; this.shake = s ? 0.4 : 0;
      this.msg = { text: s === 1 ? '¡Perfecto!' : s ? 'Casi' : 'Fallo', t: 0.8 };
      if (s === 1) sfx.good(); else if (s) sfx.tap(); else sfx.bad();
    },
    move() {}, up() {},
    update(dt) {
      this.lunge = Math.max(0, this.lunge - dt * 3); this.shake = Math.max(0, this.shake - dt);
      if (this.wait > 0) {
        if ((this.wait -= dt) <= 0) {
          this.round++; this.t = rand(0, 3);
          if (this.round >= 3) { this.done = true; this.score = this.scores.reduce((a, b) => a + b, 0) / 3; }
        }
      } else this.t += dt;
    },
    draw(ctx, room) {
      const hits = this.scores.reduce((a, b) => a + b, 0);
      room.drawIcon(ctx, 'roca', view.cx + 210 + (this.shake > 0 ? rand(-9, 9) : 0), FLOOR - 120, 270 - hits * 22);
      const bw = Math.min(720, view.w * 0.8), bx = view.cx - bw / 2, by = 190, z = this.zone();
      bar(ctx, bx, by, bw, 30, 1, '#2a2f6a');
      ctx.fillStyle = '#ffc83d'; ctx.fillRect(bx + bw * (0.5 - z * 2.4), by, bw * z * 4.8, 30);
      ctx.fillStyle = '#6fe36a'; ctx.fillRect(bx + bw * (0.5 - z), by, bw * z * 2, 30);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + bw * this.pos() - 5, by - 12, 10, 54);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < this.scores.length ? ['#ff5a5a', '#ffc83d', '#6fe36a'][this.scores[i] * 2] : 'rgba(255,255,255,.25)';
        ctx.beginPath(); ctx.arc(view.cx - 34 + i * 34, by + 66, 10, 0, 7); ctx.fill();
      }
    },
  };
}

// Puntería: tirachinas contra tres dianas, con cinco tiros. El mismo gesto que en combate.
function tiro(view) {
  const right = view.x0 + view.w - 110;
  return {
    done: false, score: 0, cx: view.x0 + 190, dir: 1, lunge: 0, msg: null, shots: 5, hits: 0, pull: null, pellet: null,
    targets: [[0.45, 380], [0.72, 560], [1, 290]].map(([f, y]) => ({ x: view.cx + (right - view.cx) * f, y: y + rand(-40, 40) })),
    origin() { return [this.cx + 70, FLOOR - 170]; },
    aim() {
      const dx = this.pull.sx - this.pull.x, dy = this.pull.sy - this.pull.y, len = Math.hypot(dx, dy);
      const v = Math.min(len, 340) * 4.6;
      return len > 30 ? [(dx / len) * v, (dy / len) * v] : null;
    },
    down(x, y) { if (!this.pellet && this.shots > 0 && !this.done) this.pull = { sx: x, sy: y, x, y }; },
    move(x, y) { if (this.pull) { this.pull.x = x; this.pull.y = y; } },
    up() {
      if (!this.pull) return;
      const v = this.aim();
      if (v) { const [x, y] = this.origin(); this.pellet = { x, y, vx: v[0], vy: v[1] }; this.shots--; this.lunge = 1; sfx.shoot(); }
      this.pull = null;
    },
    update(dt) {
      this.lunge = Math.max(0, this.lunge - dt * 3);
      const p = this.pellet;
      if (p) {
        p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const hit = this.targets.find(t => !t.hit && Math.hypot(t.x - p.x, t.y - p.y) < 62);
        if (hit) { hit.hit = true; this.hits++; this.pellet = null; this.msg = { text: '¡Diana!', t: 0.7 }; sfx.good(); }
        else if (p.y > FLOOR + 40 || p.x > view.x0 + view.w + 60 || p.x < view.x0 - 60) this.pellet = null;
      }
      if (!this.pellet && (this.hits === 3 || this.shots === 0)) { this.done = true; this.score = this.hits / 3; }
    },
    draw(ctx, room) {
      for (const t of this.targets) { ctx.globalAlpha = t.hit ? 0.25 : 1; room.drawIcon(ctx, 'diana', t.x, t.y + 14, 140); }
      ctx.globalAlpha = 1;
      const [ox, oy] = this.origin();
      if (this.pull) {
        const v = this.aim();
        ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - (this.pull.sx - this.pull.x) * 0.5, oy - (this.pull.sy - this.pull.y) * 0.5); ctx.stroke();
        if (v) {
          let x = ox, y = oy, vx = v[0], vy = v[1];
          ctx.fillStyle = '#fff6d8';
          for (let i = 0; i < 12; i++) {
            vy += 1500 * 0.04; x += vx * 0.04; y += vy * 0.04;
            ctx.globalAlpha = 1 - i / 14; ctx.fillRect(x - 5, y - 5, 10, 10);
          }
          ctx.globalAlpha = 1;
        }
      }
      if (this.pellet) { ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(this.pellet.x, this.pellet.y, 13, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.pellet.x - 3, this.pellet.y - 3, 5, 0, 7); ctx.fill(); }
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i < this.shots ? '#ffe36b' : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(view.cx - 68 + i * 34, 200, 10, 0, 7); ctx.fill(); }
    },
  };
}

// Aguante: empujar una roca a base de toques antes de que se acabe el tiempo.
function empuja(view) {
  const start = view.cx - 160, goal = Math.min(view.cx + 430, view.x0 + view.w - 130);
  return {
    done: false, score: 0, cx: start - 175, dir: 1, lunge: 0, msg: null, bx: start, v: 0, time: 7,
    down() { if (!this.done) { this.v += 72; this.lunge = 0.6; sfx.tap(); } },
    move() {}, up() {},
    update(dt) {
      this.lunge = Math.max(0, this.lunge - dt * 4);
      this.v = Math.max(-50, this.v - 170 * dt);
      this.bx = Math.max(start, this.bx + this.v * dt);
      this.cx = this.bx - 175;
      this.time -= dt;
      if (this.bx >= goal) { this.done = true; this.score = 1; }
      else if (this.time <= 0) { this.done = true; this.score = (this.bx - start) / (goal - start); }
    },
    draw(ctx, room) {
      ctx.fillStyle = '#c9a25a'; ctx.fillRect(goal + 96, FLOOR - 230, 10, 240);
      room.drawIcon(ctx, 'estrella', goal + 100, FLOOR - 220, 96);
      ctx.save(); ctx.translate(this.bx, FLOOR - 110); ctx.rotate((this.bx - start) / 110);
      room.drawIcon(ctx, 'roca', 0, 0, 220);
      ctx.restore();
      bar(ctx, view.cx - 260, 190, 520, 24, this.time / 7, '#4db8ff');
    },
  };
}

// Agilidad: caen rocas durante diez segundos; hay que mover a la criatura para esquivarlas.
function esquiva(view) {
  const left = view.x0 + 90, right = view.x0 + view.w - 90;
  return {
    done: false, score: 0, cx: view.cx, dir: 1, lunge: 0, hurt: 0, msg: null, target: view.cx, time: 10, spawn: 0.8, hits: 0, rocks: [],
    down(x) { this.target = x; }, move(x) { this.target = x; }, up() {},
    update(dt) {
      const d = clamp(this.target - this.cx, -950 * dt, 950 * dt);
      if (Math.abs(d) > 0.5) this.dir = d > 0 ? 1 : -1;
      this.cx = clamp(this.cx + d, left, right);
      this.hurt = Math.max(0, this.hurt - dt);
      const heat = 10 - this.time;
      if ((this.spawn -= dt) <= 0) {
        this.spawn = Math.max(0.27, 0.62 - heat * 0.032);
        this.rocks.push({ x: Math.random() < 0.35 ? this.cx : rand(left, right), y: -70, v: rand(470, 620) + heat * 26, r: rand(0, 6) });
      }
      for (const r of this.rocks) {
        r.y += r.v * dt;
        if (!r.gone && Math.abs(r.x - this.cx) < 78 && r.y > FLOOR - 200 && r.y < FLOOR - 20) { r.gone = true; this.hits++; this.hurt = 0.5; this.msg = { text: '¡Ay!', t: 0.5 }; sfx.hurt(); }
        if (r.y > FLOOR + 10) r.gone = true;
      }
      this.rocks = this.rocks.filter(r => !r.gone);
      if ((this.time -= dt) <= 0) { this.done = true; this.score = Math.max(0, 1 - this.hits / 4); }
    },
    draw(ctx, room) {
      for (const r of this.rocks) {
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.r + r.y / 160);
        room.drawIcon(ctx, 'roca', 0, 0, 104);
        ctx.restore();
      }
      bar(ctx, view.cx - 260, 190, 520, 24, this.time / 10, '#4db8ff');
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i < this.hits ? '#ff5a5a' : 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(view.cx - 51 + i * 34, 246, 10, 0, 7); ctx.fill(); }
    },
  };
}

export function createMini(kind, view) {
  const m = { pot: golpe, pun: tiro, agu: empuja, agi: esquiva }[kind](view);
  m.kind = kind;
  return m;
}
