// La sala donde vive la criatura. Todo se hace tocando la escena:
// frotarla para acariciarla, lanzarle la pelota, soltarle comida encima, mantener pulsado para evolucionar.

import { fit, scaled } from './sprites.js';
import { createMini, MINI_INFO, FLOOR } from './minigames.js';
import { sfx } from './sfx.js';

const SW = 1536, SH = 864;               // tamaño de la imagen de la sala
const SIZE = [210, 265, 325];            // alto de la criatura por etapa
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Room {
  // art: { bg, icons: {nombre: lienzo}, sprite(pet) }
  // hooks: { onStroke(), onTap() → texto, onPlay() → {error}, onEvolve(), onTrainDone(kind, score) → texto, charColor() }
  constructor(canvas, art, hooks) {
    this.canvas = canvas; this.art = art; this.hooks = hooks;
    this.pet = null; this.evolveReady = false;
    this.c = { x: 768, dir: 1, mode: 'idle', t: 1.5, target: 768, squash: 0, lift: 0 };
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, held: false, active: false, life: 0 };
    this.parts = []; this.bubble = null; this.mini = null; this.result = null;
    this.hold = 0; this.flash = 0; this.t = 0; this.ptr = null; this.food = null;
    this.view = { x0: 0, w: SW, cx: SW / 2, k: 1 };
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); this.down(...this.toScene(e)); });
    canvas.addEventListener('pointermove', e => this.move(...this.toScene(e)));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => this.up(...this.toScene(e)));
  }

  setPet(pet) { this.pet = pet; this.c.mode = 'idle'; this.c.t = 1; this.mini = null; this.result = null; this.bubble = null; }
  toScene(e) {
    const r = this.canvas.getBoundingClientRect(), k = r.height / SH;
    return [this.view.x0 + (e.clientX - r.left) / k, (e.clientY - r.top) / k];
  }
  get size() { return SIZE[this.pet.stage]; }
  get sad() { return this.pet.mood < 25 || this.pet.hunger < 25; }
  get asleep() { return !!this.pet.asleep; }
  ballHome() { return [this.view.x0 + this.view.w - 150, FLOOR + 62]; }
  onCreature(x, y, pad = 0) { return Math.abs(x - this.c.x) < this.size * 0.45 + pad && y > FLOOR - this.size - pad && y < FLOOR + 30 + pad; }

  say(text, time = 2.2) { this.bubble = { text, t: time }; }
  burst(icon, n = 5, x = this.c.x, y = FLOOR - this.size * 0.7) {
    for (let i = 0; i < n; i++) this.parts.push({ icon, x: x + rand(-50, 50), y: y + rand(-30, 30), vx: rand(-60, 60), vy: rand(-190, -90), life: 0, max: rand(0.8, 1.3), size: rand(38, 60) });
  }
  cheer() { this.c.mode = 'happy'; this.c.t = 0.9; }

  // --- Comida arrastrada desde la bandeja (la mueve main.js) ---
  hover(e) { this.food = e ? this.toScene(e) : null; }
  canDrop(e) { const [x, y] = this.toScene(e); return this.onCreature(x, y, 70); }
  eat(icon, reaction, loved, hated) {
    this.food = null;
    this.c.mode = 'eat'; this.c.t = 0.9;
    this.burst(loved ? 'corazon' : hated ? null : 'estrella', loved ? 7 : 4);
    this.parts.push({ icon, x: this.c.x + this.c.dir * 40, y: FLOOR - this.size * 0.5, vx: 0, vy: -40, life: 0, max: 0.6, size: 70 });
    this.say(reaction);
    if (loved) sfx.heart(); else if (hated) sfx.yuck(); else sfx.eat();
  }

  startMini(kind) {
    this.mini = createMini(kind, this.view);
    this.result = null; this.bubble = null; this.ball.active = false; this.ball.held = false;
  }

  // --- Dedo ---
  down(x, y) {
    if (!this.pet) return;
    if (this.mini) { if (!this.result) this.mini.down(x, y); return; }
    if (this.asleep) {                               // dormida: solo responde con un ronquido
      if (this.onCreature(x, y)) this.say(this.hooks.onTap(), 1.6);
      return;
    }
    const b = this.ball, [hx, hy] = this.ballHome();
    const bx = b.active ? b.x : hx, by = b.active ? b.y : hy;
    if (Math.hypot(x - bx, y - by) < 85) {
      Object.assign(b, { held: true, active: true, x, y, vx: 0, vy: 0, life: 0 });
      this.ptr = { on: 'ball', x, y, t: performance.now() };
    } else if (this.onCreature(x, y)) {
      this.ptr = { on: 'pet', x, y, rub: 0, moved: 0, time: 0 };
      if (this.c.mode === 'walk') { this.c.mode = 'idle'; this.c.t = 1.5; } // se queda quieta mientras la tocas
    } else {
      this.ptr = { on: 'floor', x, y, moved: 0 };
    }
  }
  move(x, y) {
    if (this.mini) { if (!this.result) this.mini.move(x, y); return; }
    const p = this.ptr;
    if (!p) return;
    const d = Math.hypot(x - p.x, y - p.y);
    if (p.on === 'ball') {
      const now = performance.now(), dt = Math.max(8, now - p.t) / 1000, b = this.ball;
      b.vx = b.vx * 0.5 + ((x - p.x) / dt) * 0.5; b.vy = b.vy * 0.5 + ((y - p.y) / dt) * 0.5;
      b.x = x; b.y = Math.min(y, FLOOR + 80); p.t = now;
    } else if (p.on === 'pet') {
      p.rub += d; p.moved += d;
      if (p.rub > 85) {                             // cada tramo de frote es una caricia
        p.rub = 0;
        this.hooks.onStroke();
        sfx.heart();
        this.parts.push({ icon: 'corazon', x, y: y - 20, vx: rand(-40, 40), vy: -150, life: 0, max: 1, size: 50 });
        this.c.mode = 'pet'; this.c.t = 0.5;
      }
    } else p.moved += d;
    p.x = x; p.y = y;
  }
  up(x, y) {
    if (this.mini) { if (!this.result) this.mini.up(x, y); return; }
    const p = this.ptr;
    this.ptr = null;
    if (!p) return;
    if (p.on === 'ball') {
      const b = this.ball;
      b.held = false; b.vx = clamp(b.vx, -2600, 2600); b.vy = clamp(b.vy, -2600, 1500);
      if (Math.hypot(b.vx, b.vy) < 120) b.active = false; // la soltó sin lanzarla
      else sfx.throw();
    } else if (p.on === 'pet' && p.moved < 22 && p.time < 0.35) {
      this.c.mode = 'happy'; this.c.t = 0.45;
      sfx.tap();
      const text = this.hooks.onTap();
      if (text) this.say(text);
    } else if (p.on === 'floor' && p.moved < 22 && y > FLOOR - 140) {
      this.c.target = clamp(x, this.view.x0 + 130, this.view.x0 + this.view.w - 130);
      this.c.mode = 'walk';
    }
  }

  // --- Lógica ---
  update(dt) {
    if (!this.pet) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 1.6);
    if (this.bubble && (this.bubble.t -= dt) <= 0) this.bubble = null;
    for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
    this.parts = this.parts.filter(p => p.life < p.max);

    if (this.mini) {
      const m = this.mini;
      if (m.msg && (m.msg.t -= dt) <= 0) m.msg = null;
      if (this.result) {
        if ((this.result.t -= dt) <= 0) { this.mini = null; this.result = null; this.c.x = this.view.cx; this.cheer(); }
      } else {
        m.update(dt);
        if (m.done) this.result = { t: 1.9, text: this.hooks.onTrainDone(m.kind, m.score) };
      }
      return;
    }

    const c = this.c, b = this.ball, lo = this.view.x0 + 130, hi = this.view.x0 + this.view.w - 130;
    c.x = clamp(c.x, lo, hi);
    c.squash *= 0.86; c.lift = 0;
    if (this.asleep) {                               // dormida: quieta, respirando y soltando zetas
      c.mode = 'idle'; c.t = 1; b.active = false; b.held = false; this.hold = 0; this.ptr = null;
      if ((this.zz = (this.zz || 0) - dt) <= 0) {
        this.zz = 1.1;
        this.parts.push({ text: 'z', x: c.x + c.dir * this.size * 0.3, y: FLOOR - this.size * 0.7, vx: 22 * c.dir, vy: -55, life: 0, max: 1.8, size: rand(28, 44) });
      }
      return;
    }

    // Mantener pulsado para evolucionar
    const p = this.ptr;
    if (p && p.on === 'pet') p.time += dt;
    if (p && p.on === 'pet' && p.moved < 28 && this.evolveReady && p.time > 0.3) {
      this.hold += dt / 1.5;
      if (this.hold >= 1) { this.hold = 0; this.ptr = null; this.flash = 1; this.hooks.onEvolve(); }
    } else this.hold = Math.max(0, this.hold - dt * 2);

    // Pelota
    if (b.active && !b.held) {
      b.life += dt;
      b.vy += 2300 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      const ground = FLOOR + 62;
      if (b.y > ground) { b.y = ground; b.vy *= -0.6; b.vx *= 0.82; if (Math.abs(b.vy) < 90) b.vy = 0; else sfx.bounce(); }
      if (b.x < this.view.x0 + 40) { b.x = this.view.x0 + 40; b.vx *= -0.7; }
      if (b.x > this.view.x0 + this.view.w - 40) { b.x = this.view.x0 + this.view.w - 40; b.vx *= -0.7; }
      if (b.y < 40) { b.y = 40; b.vy *= -0.5; }
      if (b.life > 0.25 && Math.abs(b.x - c.x) < 95 && b.y > FLOOR - this.size - 40) {   // ¡la atrapa!
        b.active = false;
        const res = this.hooks.onPlay();
        if (res.error) { this.say(res.error); sfx.error(); } else { this.cheer(); this.burst('corazon', 5); sfx.catch(); }
      } else if (b.life > 7) b.active = false;
    }

    // Qué hace la criatura
    const speed = this.sad ? 80 : 150;
    if (b.active && !b.held && c.mode !== 'eat') {            // persigue la pelota
      const d = b.x - c.x;
      if (Math.abs(d) > 30) { c.dir = d > 0 ? 1 : -1; c.x += clamp(d, -360 * dt, 360 * dt); }
      c.lift = Math.abs(Math.sin(this.t * 13)) * 16;
    } else if (this.food && c.mode !== 'eat') {              // mira la comida que le acercas
      c.dir = this.food[0] >= c.x ? 1 : -1;
      c.lift = Math.abs(Math.sin(this.t * 9)) * (this.sad ? 6 : 22);
    } else if (c.mode === 'walk') {
      const d = c.target - c.x;
      if (Math.abs(d) < 6) { c.mode = 'idle'; c.t = rand(1.5, 4); }
      else { c.dir = d > 0 ? 1 : -1; c.x += clamp(d, -speed * dt, speed * dt); c.lift = Math.abs(Math.sin(this.t * 10)) * 11; }
    } else if (c.mode === 'happy') {
      c.lift = Math.abs(Math.sin(c.t * 10)) * 70;
      if ((c.t -= dt) <= 0) { c.mode = 'idle'; c.t = 1; }
    } else if (c.mode === 'eat' || c.mode === 'pet') {
      c.squash = Math.sin(this.t * 22) * 0.5;
      if ((c.t -= dt) <= 0) { c.mode = 'idle'; c.t = 1.5; }
    } else if ((c.t -= dt) <= 0 && !this.ptr) {
      if (Math.random() < (this.sad ? 0.3 : 0.75)) { c.mode = 'walk'; c.target = rand(lo, hi); }
      else c.t = rand(1.5, 3.5);
    }
  }

  // --- Dibujo ---
  drawIcon(ctx, name, x, y, size) {
    const img = this.art.icons[name];
    if (!img) return;
    const k = size / Math.max(img.width, img.height);
    ctx.drawImage(img, x - (img.width * k) / 2, y - (img.height * k) / 2, img.width * k, img.height * k);
  }

  drawCreature(ctx, x, o, px) {
    const sp = this.art.sprite(this.pet), h = this.size, w = (sp.width / sp.height) * h;
    const img = scaled(sp, h * px);
    const sq = o.squash || 0, lift = o.lift || 0;
    ctx.fillStyle = 'rgba(8,5,30,.4)';
    ctx.beginPath(); ctx.ellipse(x, FLOOR + 8, w * 0.38 * (1 - Math.min(0.5, lift / 300)), 16, 0, 0, 7); ctx.fill();
    ctx.save();
    ctx.translate(x + (o.lunge || 0) * 46 * o.dir, FLOOR + 10 - lift);
    if (this.asleep) ctx.scale(o.dir * 1.08, 0.8 + Math.sin(this.t * 1.6) * 0.035); // acurrucada, respiración lenta
    else ctx.scale(o.dir * (1 + sq * 0.1), 1 - sq * 0.1 + Math.sin(this.t * 3) * 0.012);
    if (this.asleep) ctx.filter = 'brightness(0.78)';
    else if (this.sad) ctx.filter = 'saturate(0.55) brightness(0.85)';
    if (o.hurt && Math.floor(this.t * 20) % 2) ctx.globalAlpha = 0.4;
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  text(ctx, str, x, y, size, color = '#fff', stroke = '#120c24') {
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.26; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  draw() {
    const { ctx, w, h, dpr } = fit(this.canvas);
    if (!this.pet || !h) return;
    const k = h / SH, vw = Math.min(SW, w / k), x0 = (SW - vw) / 2;
    Object.assign(this.view, { x0, w: vw, cx: x0 + vw / 2, k });
    const c = this.c, px = k * dpr;
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(-x0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.art.bg, 0, 0, SW, SH);
    if (this.asleep && !this.mini) { ctx.fillStyle = 'rgba(6,4,34,.55)'; ctx.fillRect(x0, 0, vw, SH); } // luces apagadas

    const color = this.hooks.charColor();
    if (color || this.evolveReady) {                      // aura: color del carácter, o dorada si puede evolucionar
      const pulse = this.evolveReady ? 0.5 + 0.3 * Math.sin(this.t * 5) : 0.35;
      const g = ctx.createRadialGradient(c.x, FLOOR - this.size * 0.5, 10, c.x, FLOOR - this.size * 0.5, this.size * 0.95);
      const col = this.evolveReady ? '#ffd76a' : color;
      g.addColorStop(0, col + Math.round(pulse * 255).toString(16).padStart(2, '0'));
      g.addColorStop(1, col + '00');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - this.size, FLOOR - this.size * 1.5, this.size * 2, this.size * 2);
    }

    const m = this.mini;
    if (m) {
      ctx.fillStyle = 'rgba(8,6,24,.5)'; ctx.fillRect(x0, 0, vw, SH);
      m.draw(ctx, this);
      this.drawCreature(ctx, m.cx, { dir: m.dir, lunge: m.lunge, hurt: m.hurt > 0, lift: m.kind === 'agu' ? 0 : Math.abs(Math.sin(this.t * 6)) * 5 }, px);
      this.text(ctx, MINI_INFO[m.kind].title, this.view.cx, 86, 52, '#ffd76a');
      this.text(ctx, MINI_INFO[m.kind].help, this.view.cx, 134, 27);
      if (m.msg) this.text(ctx, m.msg.text, this.view.cx, 350, 60, '#fff6d8');
      if (this.result) {
        ctx.fillStyle = 'rgba(8,6,24,.72)'; ctx.fillRect(x0, 0, vw, SH);
        this.result.text.split('\n').forEach((line, i) => this.text(ctx, line, this.view.cx, 390 + i * 76, i ? 40 : 72, i ? '#fff' : '#ffd76a'));
      }
    } else {
      const b = this.ball, [hx, hy] = this.ballHome();
      if (!b.active) this.drawIcon(ctx, 'pelota', hx, hy - 40, 82);
      this.drawCreature(ctx, c.x, { dir: c.dir, squash: c.squash, lift: c.lift }, px);
      if (b.active) {
        ctx.save(); ctx.translate(b.x, b.y - 40); ctx.rotate(b.x / 60);
        this.drawIcon(ctx, 'pelota', 0, 0, 82);
        ctx.restore();
      }
      if (this.hold > 0) {                                // anillo de carga de la evolución
        ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(c.x, FLOOR - this.size * 0.5, this.size * 0.7, -Math.PI / 2, -Math.PI / 2 + this.hold * Math.PI * 2); ctx.stroke();
      }
      const say = this.bubble?.text || (this.evolveReady && !this.hold && !this.asleep ? 'Mantén pulsado sobre mí' : '');
      if (say) {
        ctx.font = '800 30px system-ui, sans-serif';
        const tw = ctx.measureText(say).width + 48, bx = clamp(c.x - tw / 2, x0 + 12, x0 + vw - tw - 12), by = FLOOR - this.size - 96 - c.lift * 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.roundRect(bx, by, tw, 62, 22); ctx.fill();
        ctx.beginPath(); ctx.moveTo(c.x - 14, by + 60); ctx.lineTo(c.x + 14, by + 60); ctx.lineTo(c.x, by + 82); ctx.fill();
        ctx.fillStyle = '#1b1433'; ctx.textAlign = 'center'; ctx.fillText(say, bx + tw / 2, by + 42);
      }
    }

    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, (p.max - p.life) * 3);
      if (p.text) this.text(ctx, p.text, p.x, p.y, p.size, '#cfe0ff');
      else if (p.icon) this.drawIcon(ctx, p.icon, p.x, p.y, p.size);
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(x0, 0, vw, SH); }
    ctx.restore();
  }
}
