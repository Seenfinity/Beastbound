// La vista del modo aventura: una zona del mapa vista desde arriba, por la que tu bestia anda libremente.
// Se mueve con las flechas o WASD, o tocando hacia dónde ir. Choca con rocas, troncos y agua, pasa por detrás
// de los árboles y la hierba alta le tapa los pies. Las bestias salvajes patrullan y van a por ti si te acercas.
// Al llegar a algo se para y avisa con hooks.onReach(poi). Las reglas y los datos del mapa están en aventura.js.

import * as A from './aventura.js';
import { tr } from './i18n.js';

const SPEED = 165, WILD_SLOW = 42, WILD_FAST = 92, NOTICE = 150, LEASH = 250, TOUCH = 40, REVEAL = 105, HINT = 330;   // en píxeles del mapa
const ME = 66, WILD = 62, BOSS = 120, CELL = 2;        // alturas de las bestias y tamaño del «píxel» del mapa
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Deja un dibujo con el grano de píxel y la luz de noche del mapa, para que no parezca un recorte pegado encima.
const cache = new WeakMap();
function blend(img, height) {
  let byHeight = cache.get(img);
  if (!byHeight) cache.set(img, byHeight = new Map());
  let out = byHeight.get(height);
  if (!out) {
    out = document.createElement('canvas');
    out.height = Math.max(4, Math.round(height / CELL));
    out.width = Math.max(4, Math.round((img.width / img.height) * out.height));
    const c = out.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, out.width, out.height);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(26, 34, 118, .24)';
    c.fillRect(0, 0, out.width, out.height);
    byHeight.set(height, out);
  }
  return out;
}

export class Explore {
  // art: { map (imagen), player (lienzo), wild(poi) → lienzo, icon(nombre) → lienzo, chest (lienzo), glint (lienzo) }
  // hooks: { onReach(poi), onMove() }
  constructor(canvas, game, art, hooks) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.g = game; this.zone = A.zoneOf(game); this.art = art; this.hooks = hooks;
    this.x = game.adv.x; this.y = game.adv.y;
    if (!A.walkable(this.zone, this.x, this.y)) [this.x, this.y] = this.zone.start;
    this.dir = 1; this.t = 0; this.hop = 0; this.moving = false; this.busy = false;
    this.keys = { x: 0, y: 0 }; this.goal = null; this.path = []; this.stuck = 0;
    this.skip = 'salida'; this.safe = [this.x, this.y]; this.saved = 0;
    // Las bestias salvajes de la zona, con su patrulla.
    this.wilds = this.zone.pois.filter(p => p.type === 'wild' || p.type === 'boss').map(poi => ({ poi, x: poi.x, y: poi.y, way: 1, dir: -1, wait: 0, hop: 0 }));
    this.cam = { x: 0, y: 0 }; this.zoom = 1; this.near = !!art.near;
    // Luciérnagas: puntos de luz que flotan por la zona.
    this.flies = Array.from({ length: 26 }, (_, i) => ({ x: (i * 397 + 120) % this.zone.w, y: (i * 251 + 90) % (this.zone.h - 160), p: i * 1.7, r: 26 + (i % 5) * 9 }));
    this.resize();
    this.center(true);
  }

  // El lienzo ocupa su caja; se ve aproximadamente media zona a lo ancho, para estar cerca de la bestia.
  resize() {
    const box = this.canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = Math.max(1, box.width); this.vh = Math.max(1, box.height);
    this.canvas.width = Math.round(this.vw * dpr); this.canvas.height = Math.round(this.vh * dpr);
    this.dpr = dpr;
    // De lejos se ve casi toda la zona a lo ancho; de cerca, algo más de la mitad.
    this.zoom = Math.max(this.vw / Math.min(this.zone.w, this.near ? 840 : 1240), this.vh / this.zone.h, this.vw / this.zone.w);
  }
  center(now = false) {
    const w = this.vw / this.zoom, h = this.vh / this.zoom;
    const tx = clamp(this.x - w / 2, 0, Math.max(0, this.zone.w - w)), ty = clamp(this.y - 30 - h / 2, 0, Math.max(0, this.zone.h - h));
    const k = now ? 1 : 0.14;
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
  }
  setNear(near) { this.near = near; this.resize(); this.center(true); }
  toMap(x, y) { return [this.cam.x + x / this.zoom, this.cam.y + y / this.zoom]; }   // de un toque en el lienzo (píxeles CSS) al mapa

  // Entradas: dirección del teclado (−1, 0, 1 en cada eje) o un punto tocado al que ir.
  setKeys(x, y) { this.keys.x = x; this.keys.y = y; if (x || y) { this.goal = null; this.path = []; this.wantExit = false; } }
  goTo(x, y) {
    if (this.busy) return;
    const [tx, ty] = this.toMap(x, y);
    this.path = A.pathTo(this.zone, this.x, this.y, tx, ty);   // rodea rocas, árboles y agua
    const exit = this.zone.pois.find(p => p.type === 'exit');
    this.wantExit = !!exit && Math.hypot(tx - exit.x, ty - exit.y) < 46;   // el portal solo pregunta si lo tocas a propósito
    this.goal = this.path.length ? this.path.at(-1) : null;
    this.stuck = 0;
  }
  halt() { this.goal = null; this.path = []; this.keys.x = this.keys.y = 0; }
  // Al dar media vuelta: vuelve a donde estaba antes de acercarse y la bestia salvaje se queda quieta un momento.
  back(poi) {
    [this.x, this.y] = this.safe;
    this.halt(); this.skip = '';
    const w = this.wilds.find(v => v.poi === poi);
    if (w) { w.wait = 3; w.x = poi.x; w.y = poi.y; }
  }

  pois() { return this.zone.pois.filter(p => A.active(this.g, p)); }

  update(dt) {
    this.t += dt;
    if (this.busy) { this.moving = false; return; }
    // Hacia dónde quiere ir
    let dx = this.keys.x, dy = this.keys.y;
    if (!dx && !dy && this.goal) {
      while (this.path.length > 1 && A.clear(this.zone, this.x, this.y, ...this.path[1])) this.path.shift();   // ataja si ve el siguiente punto
      const next = this.path[0] || this.goal, gx = next[0] - this.x, gy = next[1] - this.y, d = Math.hypot(gx, gy);
      if (d < 5) { this.path.shift(); if (!this.path.length) this.goal = null; } else { dx = gx / d; dy = gy / d; }
    }
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    if (this.moving) {
      const k = (SPEED * dt) / len, [nx, ny] = A.step(this.zone, this.x, this.y, dx * k, dy * k);
      const moved = Math.hypot(nx - this.x, ny - this.y);
      if (Math.abs(dx) > 0.2) this.dir = dx > 0 ? 1 : -1;
      this.x = nx; this.y = ny;
      this.hop += dt;
      if (this.goal && moved < SPEED * dt * 0.25 && (this.stuck += dt) > 0.35) { this.goal = null; this.path = []; }   // no hay forma de llegar
      else if (moved > 0) this.stuck = 0;
      this.g.adv.x = Math.round(this.x); this.g.adv.y = Math.round(this.y);
      if ((this.saved += dt) > 4) { this.saved = 0; this.hooks.onMove?.(); }
    } else this.hop = 0;

    this.roam(dt);
    this.meet();
    this.center();
  }

  // Las bestias salvajes patrullan; si te ven cerca y no te han dejado ir hace un momento, van a por ti.
  roam(dt) {
    for (const w of this.wilds) {
      if (!A.active(this.g, w.poi)) continue;
      if (w.wait > 0) { w.wait -= dt; w.hop = 0; continue; }
      const { poi } = w, toMe = Math.hypot(this.x - w.x, this.y - w.y), home = [(poi.x + (poi.to?.[0] ?? poi.x)) / 2, (poi.y + (poi.to?.[1] ?? poi.y)) / 2];
      const chase = toMe < NOTICE && Math.hypot(this.x - home[0], this.y - home[1]) < LEASH && !poi.still;
      const target = chase ? [this.x, this.y] : w.way > 0 && poi.to ? poi.to : [poi.x, poi.y];
      const gx = target[0] - w.x, gy = target[1] - w.y, d = Math.hypot(gx, gy);
      w.chasing = chase;
      if (d < 4) { if (!chase && poi.to) { w.way = -w.way; w.wait = 0.8; } continue; }
      const k = ((chase ? WILD_FAST : WILD_SLOW) * dt) / d;
      [w.x, w.y] = A.step(this.zone, w.x, w.y, gx * k, gy * k);
      if (Math.abs(gx) > 2) w.dir = gx > 0 ? 1 : -1;
      w.hop += dt;
    }
  }

  // ¿Ha llegado a algo?
  meet() {
    let near = false;
    for (const poi of this.pois()) {
      const w = this.wilds.find(v => v.poi === poi), px = w ? w.x : poi.x, py = w ? w.y : poi.y;
      const d = Math.hypot(px - this.x, py - this.y), r = poi.r || (w ? TOUCH : poi.type === 'food' || poi.type === 'coin' ? 24 : poi.type === 'chest' ? 32 : 34);
      if (d < r + (w ? 70 : 24)) near = true;
      if (d > r || this.skip === poi.id || (poi.type === 'exit' && !this.wantExit)) continue;
      this.halt(); this.skip = poi.id;
      return this.hooks.onReach(poi);
    }
    if (!near) { this.skip = ''; this.safe = [this.x, this.y]; }
  }

  draw() {
    const { ctx, zone, cam, zoom } = this, k = zoom * this.dpr;
    ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.art.map, 0, 0, zone.w, zone.h);

    // Todo lo que tiene altura se pinta de atrás hacia delante: bestias, cofres y los árboles que tapan.
    const list = [{ me: true, y: this.y }];
    for (const w of this.wilds) if (A.active(this.g, w.poi)) list.push({ wild: w, y: w.y });
    for (const poi of this.pois()) if (poi.type === 'chest') list.push({ chest: poi, y: poi.y }); else if (poi.type === 'food' || poi.type === 'coin') list.push({ loot: poi, y: poi.y });
    for (const tree of zone.trees) list.push({ tree, y: tree[1] });
    list.sort((p, q) => p.y - q.y);
    const drawn = [];                                    // lo ya pintado, por si un árbol de delante tiene que taparlo
    for (const it of list) {
      if (it.tree) { if (drawn.some(b => this.behind(it.tree, b))) this.cover(it.tree); continue; }
      if (it.me) drawn.push(this.beast(this.art.player, this.x, this.y, ME, this.dir, this.moving ? Math.abs(Math.sin(this.hop * 12)) * 8 : Math.sin(this.t * 2.4) * 1.2));
      else if (it.wild) {
        const w = it.wild, boss = w.poi.type === 'boss';
        drawn.push(this.beast(this.art.wild(w.poi), w.x, w.y, boss ? BOSS : WILD, w.dir, w.hop ? Math.abs(Math.sin(w.hop * (w.chasing ? 14 : 9))) * 6 : 0));
      } else if (it.loot) drawn.push(this.beast(this.art.icon(it.loot.type === 'coin' ? 'moneda' : it.loot.food), it.loot.x, it.loot.y + 4 - Math.abs(Math.sin(this.t * 2 + it.loot.x)) * 2, 26, 1, 0, false));
      else if (Math.hypot(it.chest.x - this.x, it.chest.y - this.y) < REVEAL || !it.chest.hidden) drawn.push(this.beast(this.art.chest, it.chest.x, it.chest.y + 6, 44, 1, 0, false));
    }

    // Luciérnagas
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flies) {
      const fx = f.x + Math.sin(this.t * 0.5 + f.p) * f.r, fy = f.y + Math.cos(this.t * 0.37 + f.p * 1.3) * f.r * 0.6, glow = 0.35 + 0.65 * Math.abs(Math.sin(this.t * 1.3 + f.p));
      const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 7);
      grad.addColorStop(0, `rgba(255, 244, 170, ${0.85 * glow})`); grad.addColorStop(1, 'rgba(255, 220, 120, 0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(fx, fy, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Por encima de todo: rótulos, marcas y el brillo que delata un cofre escondido cuando pasas cerca.
    for (const w of this.wilds) {
      if (!A.active(this.g, w.poi)) continue;
      const boss = w.poi.type === 'boss';
      this.label(`${boss ? tr(w.poi.title) : tr('Salvaje')} · ${tr(`Nv ${w.poi.level}`)}`, w.x, w.y - (boss ? BOSS : WILD) - 8, w.chasing ? '#ff9d7a' : boss ? '#ffd76a' : '#ffffff');
    }
    for (const poi of this.pois()) {
      const d = Math.hypot(poi.x - this.x, poi.y - this.y);
      if (poi.type === 'rest') this.marker(this.art.icon('corazon'), poi.x, poi.y - 34 + Math.sin(this.t * 2.2) * 3, 26);
      else if (poi.type === 'event') this.marker(this.art.icon('estrella'), poi.x, poi.y - 30 + Math.sin(this.t * 2.2 + 1) * 3, 26);
      else if (poi.type === 'exit' && d > 80) this.marker(this.art.icon('casa'), poi.x, poi.y - 46 + Math.sin(this.t * 2.2) * 3, 28);
      else if (poi.type === 'chest' && poi.hidden && d > REVEAL && d < HINT && this.art.glint) {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 3.2 + poi.x), close = 1 - (d - REVEAL) / (HINT - REVEAL);   // más fuerte cuanto más cerca
        ctx.globalAlpha = 0.35 + 0.65 * pulse;
        this.marker(this.art.glint, poi.x, poi.y - 14, 22 + pulse * 16 + close * 18);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Pinta una bestia (o un cofre) integrada en el mapa: sombra, grano de píxel y, en la hierba alta, los pies tapados.
  // Devuelve la caja que ocupa.
  beast(img, x, y, height, dir, lift, shadow = true) {
    if (!img) return { x, y, w: 0, h: 0 };
    const { ctx, zone } = this, sprite = blend(img, height), w = sprite.width * CELL, h = sprite.height * CELL;
    if (shadow) { ctx.fillStyle = 'rgba(6, 5, 22, .5)'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.33, h * 0.11, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y - lift));
    ctx.scale(dir, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, -w / 2, -h, w, h);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    if (A.inGrass(zone, x, y)) {                          // la hierba alta le llega a media pata
      const gx = x - w / 2, gy = y - h * 0.3, gh = h * 0.3 + 4;
      ctx.globalAlpha = 0.82;
      ctx.drawImage(this.art.map, gx * this.sx, gy * this.sy, w * this.sx, gh * this.sy, gx, gy, w, gh);
      ctx.globalAlpha = 1;
    }
    return { x, y, w, h };
  }
  get sx() { return this.art.map.width / this.zone.w; }
  get sy() { return this.art.map.height / this.zone.h; }

  // ¿Queda `b` (una caja ya pintada) detrás de este árbol?
  behind([tx, ty, , r, h], b) { return b.y < ty && b.y > ty - h - 20 && Math.abs(b.x - tx) < r + b.w / 2 && b.y - b.h < ty; }
  // Repinta la copa del árbol por encima de lo que tiene detrás.
  cover([tx, ty, kind, r, h]) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    if (kind === 'round') { ctx.ellipse(tx, ty - h + r, r + 5, r + 4, 0, 0, Math.PI * 2); ctx.rect(tx - 13, ty - h + r, 26, h - r); }
    else { ctx.moveTo(tx, ty - h - 4); ctx.lineTo(tx + r + 2, ty - 16); ctx.lineTo(tx + 11, ty - 16); ctx.lineTo(tx + 11, ty); ctx.lineTo(tx - 11, ty); ctx.lineTo(tx - 11, ty - 16); ctx.lineTo(tx - r - 2, ty - 16); ctx.closePath(); }
    ctx.clip();
    const x0 = tx - r - 8, y0 = Math.max(0, ty - h - 8), w = (r + 8) * 2, hh = ty - y0 + 2;
    ctx.drawImage(this.art.map, x0 * this.sx, y0 * this.sy, w * this.sx, hh * this.sy, x0, y0, w, hh);
    ctx.restore();
  }

  marker(img, x, y, size) { if (img) this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size); }
  label(text, x, y, color) {
    const { ctx } = this;
    ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 4; ctx.strokeStyle = '#120c24'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
}
