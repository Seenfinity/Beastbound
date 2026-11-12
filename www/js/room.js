// La sala donde vive la criatura. Todo se hace tocando la escena:
// frotarla para acariciarla, lanzarle la pelota, soltarle comida encima, mantener pulsado para evolucionar.

import { fit, scaled } from './sprites.js';
import { createMini, MINI_INFO, FLOOR } from './minigames.js';
import { sfx } from './sfx.js';

const SW = 1536, SH = 864;               // tamaño de la imagen de la sala
const SIZE = [210, 265, 325];            // alto de la criatura por etapa
// Qué hace la criatura con cada mueble cuando va a usarlo, y qué dice al mirarlo.
const ACT = {
  alfombra: 'roll', cama: 'nap', cuenco: 'eat', juguetes: 'jump', muneco: 'punch', trofeo: 'watch', peluche: 'hug', musica: 'dance',
  pecera: 'watch', lampara: 'watch', planta: 'watch', puff: 'sit', saco: 'punch', libros: 'watch', torre: 'jump', cofre: 'watch',
};
const SAY = { trofeo: '¡Algún día ganaré otro!', pecera: '¡Pececitos!', lampara: 'Qué calentito…', planta: 'Mmm, huele bien', libros: 'A ver qué pone aquí…', cofre: '¡Cuántas monedas!' };
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
    this.sleepK = 0;                         // 0 = despierta, 1 = dormida del todo (luces apagadas, acurrucada)
    this.editing = false;                    // modo decorar: se arrastran los muebles
    this.items = [];                         // muebles colocados (se refresca en cada fotograma)
    this.view = { x0: 0, w: SW, cx: SW / 2, k: 1 };
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); this.down(...this.toScene(e)); });
    canvas.addEventListener('pointermove', e => this.move(...this.toScene(e)));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => this.up(...this.toScene(e)));
  }

  setPet(pet) { this.pet = pet; this.c.mode = 'idle'; this.c.t = 1; this.mini = null; this.result = null; this.bubble = null; this.sleepK = pet.asleep ? 1 : 0; }
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

  // --- Muebles ---
  box(d) { const h = d.img.height * (d.w / d.img.width); return { x0: d.x - d.w / 2, x1: d.x + d.w / 2, y0: d.y - h, y1: d.y, h }; }
  itemAt(x, y) {                            // el mueble que está más delante bajo el dedo (la alfombra, la última)
    return [...this.items].sort((a, b) => (a.floor ? 1 : 0) - (b.floor ? 1 : 0) || b.y - a.y).find(d => { const b = this.box(d); return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1; });
  }
  // La criatura camina hasta un mueble para usarlo.
  goUse(d) {
    if (this.asleep || this.mini || !d) return;
    const c = this.c, front = d.floor || d.y > FLOOR + 14;      // los de delante (o el suelo) los usa encima; los de detrás, desde un lado
    const side = c.x <= d.x ? -1 : 1;
    c.use = d.id; c.mode = 'goto';
    c.target = clamp(front ? d.x : d.x + side * (d.w / 2 + this.size * 0.28), this.view.x0 + 110, this.view.x0 + this.view.w - 110);
  }
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
    if (this.asleep && !this.editing) {              // dormida: solo responde con un ronquido
      if (this.onCreature(x, y)) this.say(this.hooks.onTap(), 1.6);
      return;
    }
    if (this.editing) {                              // modo decorar: se agarra el mueble que haya debajo
      const d = this.itemAt(x, y);
      this.ptr = d ? { on: 'decor', id: d.id, dx: d.x - x, dy: d.y - y, x, y } : null;
      return;
    }
    const b = this.ball, [hx, hy] = this.ballHome();
    const bx = b.active ? b.x : hx, by = b.active ? b.y : hy;
    if (Math.hypot(x - bx, y - by) < 85) {
      Object.assign(b, { held: true, active: true, x, y, vx: 0, vy: 0, life: 0 });
      this.ptr = { on: 'ball', x, y, t: performance.now() };
    } else if (this.onCreature(x, y)) {
      this.ptr = { on: 'pet', x, y, rub: 0, moved: 0, time: 0 };
      if (this.c.mode === 'walk' || this.c.mode === 'antic') { this.c.mode = 'idle'; this.c.t = 1.5; } // se queda quieta mientras la tocas
    } else {
      this.ptr = { on: 'floor', x, y, moved: 0, item: this.itemAt(x, y)?.id };
    }
  }
  move(x, y) {
    if (this.mini) { if (!this.result) this.mini.move(x, y); return; }
    const p = this.ptr;
    if (!p) return;
    if (p.on === 'decor') { this.hooks.onMoveDecor(p.id, x + p.dx, y + p.dy); p.x = x; p.y = y; return; }
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
    if (p.on === 'decor') return this.hooks.onDropDecor();
    if (p.on === 'floor' && p.moved < 22 && p.item) return this.goUse(this.items.find(d => d.id === p.item));   // tocar un mueble: va a usarlo
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
    c.squash *= 0.86; c.lift = 0; c.lunge = 0; c.tilt = 0; c.sit = 1;
    if (this.asleep) {
      // Irse a dormir: camina hasta el centro de la sala, se acurruca y se apagan las luces poco a poco.
      b.active = false; b.held = false; this.ptr = null;
      const bedAt = this.hooks.bedX?.();
      const bed = bedAt && bedAt > this.view.x0 + 120 && bedAt < this.view.x0 + this.view.w - 120 ? bedAt : this.view.cx, d = bed - c.x;
      if (Math.abs(d) > 6 && this.sleepK < 0.05) {
        c.dir = d > 0 ? 1 : -1;
        c.x += clamp(d, -210 * dt, 210 * dt);
        c.lift = Math.abs(Math.sin(this.t * 7)) * 6;   // pasitos cansados
      } else {
        this.sleepK = Math.min(1, this.sleepK + dt / 1.8);
        if (this.sleepK > 0.9 && (this.zz = (this.zz || 0) - dt) <= 0) {
          this.zz = 1.1;
          this.parts.push({ text: 'z', x: c.x + c.dir * this.size * 0.3, y: FLOOR - this.size * 0.7, vx: 22 * c.dir, vy: -55, life: 0, max: 1.8, size: rand(28, 44) });
        }
      }
      return;
    }
    this.sleepK = Math.max(0, this.sleepK - dt / 0.9);   // al despertar, las luces vuelven

    const p = this.ptr;
    if (p && p.on === 'pet') p.time += dt;
    if (this.evolveReady && (this.glint = (this.glint || 0) - dt) <= 0) {   // lista para evolucionar: suelta destellos
      this.glint = 0.22;
      this.parts.push({ icon: 'estrella', x: c.x + rand(-this.size * 0.5, this.size * 0.5), y: FLOOR - rand(0, this.size * 0.8), vx: rand(-15, 15), vy: rand(-150, -70), life: 0, max: rand(0.7, 1.2), size: rand(18, 34) });
    }

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
    } else if (c.mode === 'goto') {                  // va hacia un mueble
      const item = this.items.find(i => i.id === c.use), d = c.target - c.x;
      if (!item) { c.mode = 'idle'; c.t = 1; }
      else if (Math.abs(d) < 6) {
        c.mode = 'use'; c.act = ACT[item.id] || 'watch'; c.t = rand(2.4, 3.6); c.ut = 0;
        c.dir = item.x >= c.x ? 1 : -1;
        this.hooks.onUse(item.id);
        if (SAY[item.id]) this.say(SAY[item.id], 2.2);
      } else { c.dir = d > 0 ? 1 : -1; c.x += clamp(d, -speed * 1.2 * dt, speed * 1.2 * dt); c.lift = Math.abs(Math.sin(this.t * 10)) * 11; }
    } else if (c.mode === 'use') {                   // lo está usando
      c.ut += dt;
      const item = this.items.find(i => i.id === c.use), k = c.ut;
      const spark = (icon, every, o = {}) => { if (Math.floor(k / every) !== Math.floor((k - dt) / every)) this.parts.push({ icon, x: (o.x ?? c.x) + rand(-30, 30), y: (o.y ?? FLOOR - this.size * 0.8), vx: rand(-30, 30), vy: -110, life: 0, max: 1, size: o.size || 40, ...o.extra }); };
      if (c.act === 'punch') { c.lunge = Math.abs(Math.sin(k * 9)); if (item) spark('estrella', 0.35, { x: item.x, y: item.y - this.box(item).h * 0.6, size: 30 }); }
      else if (c.act === 'jump') c.lift = Math.abs(Math.sin(k * 7)) * 70;
      else if (c.act === 'dance') { c.tilt = Math.sin(k * 9) * 0.14; c.lift = Math.abs(Math.sin(k * 9)) * 14; if (Math.floor(k / 0.5) !== Math.floor((k - dt) / 0.5)) this.parts.push({ text: '♪', x: c.x + rand(-60, 60), y: FLOOR - this.size, vx: rand(-20, 20), vy: -70, life: 0, max: 1.3, size: rand(30, 44) }); }
      else if (c.act === 'hug') { c.lunge = 0.35; c.tilt = c.dir * 0.08; spark('corazon', 0.7); }
      else if (c.act === 'eat') { c.squash = Math.sin(this.t * 22) * 0.5; }
      else if (c.act === 'roll') { c.tilt = Math.sin(k * 6) * 0.5; c.sit = 0.85; }   // se revuelca en la alfombra
      else if (c.act === 'sit') { c.sit = 0.86; c.lift = item ? this.box(item).h * 0.42 : 0; }
      else if (c.act === 'nap') { c.sit = 0.8; if (Math.floor(k / 0.9) !== Math.floor((k - dt) / 0.9)) this.parts.push({ text: 'z', x: c.x + 40, y: FLOOR - this.size * 0.7, vx: 18, vy: -50, life: 0, max: 1.5, size: 30 }); }
      if ((c.t -= dt) <= 0) { c.mode = 'idle'; c.t = rand(1.5, 3); c.use = null; }
    } else if (c.mode === 'antic') {                 // se entretiene sola: persigue su cola, salta, se sienta, se estira…
      const k = (c.ut += dt);
      if (c.act === 'spin') { c.dir = Math.floor(k * 5) % 2 ? 1 : -1; c.lift = Math.abs(Math.sin(k * 10)) * 12; }
      else if (c.act === 'hop') { c.lift = Math.abs(Math.sin(k * 6.5)) * 64; if (Math.floor(k / 0.48) !== Math.floor((k - dt) / 0.48)) this.parts.push({ icon: 'estrella', x: c.x + rand(-50, 50), y: FLOOR - this.size * 0.9, vx: rand(-30, 30), vy: -120, life: 0, max: 0.9, size: 32 }); }
      else if (c.act === 'sit') { c.sit = 0.86; if (Math.floor(k / 1.1) !== Math.floor((k - dt) / 1.1)) c.dir *= -1; }
      else if (c.act === 'stretch') { c.squash = Math.sin(k * 3.2) * 1.8; }
      else if (c.act === 'sniff') { c.lunge = 0.28 + Math.sin(k * 11) * 0.07; c.tilt = c.dir * 0.1; c.x = clamp(c.x + c.dir * 34 * dt, lo, hi); }
      else if (c.act === 'dance') { c.tilt = Math.sin(k * 9) * 0.13; c.lift = Math.abs(Math.sin(k * 9)) * 14; if (Math.floor(k / 0.6) !== Math.floor((k - dt) / 0.6)) this.parts.push({ text: '♪', x: c.x + rand(-60, 60), y: FLOOR - this.size, vx: rand(-20, 20), vy: -70, life: 0, max: 1.3, size: rand(28, 40) }); }
      if ((c.t -= dt) <= 0) { c.mode = 'idle'; c.t = rand(1.2, 3); }
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
      const usable = this.sad || this.editing ? [] : this.items.filter(d => d.x > lo && d.x < hi);
      if (usable.length && Math.random() < 0.45) this.goUse(usable[Math.floor(Math.random() * usable.length)]);   // a veces va a usar un mueble
      else if (!this.sad && !this.asleep && Math.random() < 0.4) {   // o se entretiene sola
        c.mode = 'antic'; c.ut = 0; c.t = rand(1.6, 2.8);
        c.act = ['spin', 'hop', 'sit', 'stretch', 'sniff', 'dance'][Math.floor(Math.random() * 6)];
      }
      else if (Math.random() < (this.sad ? 0.3 : 0.75)) { c.mode = 'walk'; c.target = rand(lo, hi); }
      else { c.t = rand(1.5, 3.5); if (Math.random() < 0.4) c.dir *= -1; }   // a veces solo mira hacia el otro lado
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
    if (o.tilt) ctx.rotate(o.tilt);
    const k = this.sleepK;                            // se va acurrucando a medida que se duerme
    const awake = (1 - sq * 0.1 + Math.sin(this.t * 3) * 0.012) * (o.sit || 1), curled = 0.78 + Math.sin(this.t * 1.6) * 0.035;
    ctx.scale(o.dir * (1 + sq * 0.1 * (1 - k) + 0.09 * k), awake + (curled - awake) * k);
    if (k > 0) ctx.filter = `brightness(${1 - 0.22 * k})`;
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
    ctx.drawImage(this.hooks.bg?.() || this.art.bg, 0, 0, SW, SH);
    const decor = this.mini ? [] : [...(this.hooks.decor?.() || [])].sort((a, b) => a.y - b.y);   // de atrás hacia delante
    this.items = decor;
    const put = d => {
      const k = d.w / d.img.width, hh = d.img.height * k;
      ctx.drawImage(d.img, d.x - d.w / 2, d.y - hh, d.w, hh);
      if (this.editing) {                              // modo decorar: marco para ver qué se puede arrastrar
        ctx.save(); ctx.strokeStyle = this.ptr?.id === d.id ? '#ffd76a' : 'rgba(255,255,255,.75)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
        ctx.strokeRect(d.x - d.w / 2 - 6, d.y - hh - 6, d.w + 12, hh + 12); ctx.restore();
      }
    };
    for (const d of decor) if (d.floor) put(d);                              // alfombra: en el suelo
    for (const d of decor) if (!d.floor && d.y <= FLOOR + 14) put(d);          // lo que queda detrás de la criatura
    if (this.sleepK > 0 && !this.mini) {              // luces que se apagan y una luna de noche
      ctx.fillStyle = `rgba(6,4,34,${0.58 * this.sleepK})`; ctx.fillRect(x0, 0, vw, SH);
      // Un charco de luz de luna donde duerme
      const halo = ctx.createRadialGradient(this.c.x, FLOOR - 40, 20, this.c.x, FLOOR - 40, 380);
      halo.addColorStop(0, `rgba(170,195,255,${0.26 * this.sleepK})`); halo.addColorStop(1, 'rgba(170,195,255,0)');
      ctx.fillStyle = halo; ctx.fillRect(this.c.x - 380, FLOOR - 420, 760, 760);
    }

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
      const tilt = c.mode === 'pet' ? Math.sin(this.t * 16) * 0.07 : c.mode === 'walk' ? c.dir * 0.05 : c.mode === 'happy' ? Math.sin(this.t * 12) * 0.05 : 0;
      this.drawCreature(ctx, c.x, { dir: c.dir, squash: c.squash, lift: c.lift, lunge: c.lunge, sit: c.sit, tilt: this.sleepK > 0 ? 0 : c.tilt || tilt }, px);
      if (b.active) {
        ctx.save(); ctx.translate(b.x, b.y - 40); ctx.rotate(b.x / 60);
        this.drawIcon(ctx, 'pelota', 0, 0, 82);
        ctx.restore();
      }
      const say = this.editing ? '' : this.bubble?.text || (this.evolveReady && !this.asleep ? '¡Siento que voy a evolucionar!' : '');
      if (say) {
        ctx.font = '800 30px system-ui, sans-serif';
        const tw = ctx.measureText(say).width + 48, bx = clamp(c.x - tw / 2, x0 + 12, x0 + vw - tw - 12), by = FLOOR - this.size - 96 - c.lift * 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.roundRect(bx, by, tw, 62, 22); ctx.fill();
        ctx.beginPath(); ctx.moveTo(c.x - 14, by + 60); ctx.lineTo(c.x + 14, by + 60); ctx.lineTo(c.x, by + 82); ctx.fill();
        ctx.fillStyle = '#1b1433'; ctx.textAlign = 'center'; ctx.fillText(say, bx + tw / 2, by + 42);
      }
    }

    if (decor.length) {                               // lo que queda delante de la criatura
      if (this.sleepK > 0) ctx.filter = `brightness(${1 - 0.5 * this.sleepK})`;
      for (const d of decor) if (!d.floor && d.y > FLOOR + 14) put(d);
      ctx.filter = 'none';
    }

    // Deseo: una nube de pensamiento con lo que pide
    const wish = !m && !this.asleep && !this.bubble && !this.evolveReady ? this.hooks.wish?.() : null;
    if (wish) {
      const wx = c.x + c.dir * this.size * 0.42, wy = FLOOR - this.size - 92 + Math.sin(this.t * 2) * 5 - c.lift * 0.4;
      ctx.fillStyle = '#ffffff';
      for (const [dx, dy, r] of [[0, 0, 50], [-38, 14, 30], [38, 12, 32], [-10, -24, 34], [22, -22, 30]]) { ctx.beginPath(); ctx.arc(wx + dx, wy + dy, r, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.arc(wx - c.dir * 46, wy + 62, 12, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(wx - c.dir * 64, wy + 84, 7, 0, 7); ctx.fill();
      this.drawIcon(ctx, wish, wx, wy, 66);
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
