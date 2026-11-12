// Secuencia de evolución a pantalla completa:
// carga de energía → siluetas que alternan → destello → forma nueva → resumen animado.

import { fit } from './sprites.js';
import { sfx } from './sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
const hex = alpha => Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, '0');

// Momentos de la secuencia, en segundos.
const CHARGE = 1.1, FLASH = 4.3, REVEAL = 4.7, PANEL = 6;

// La misma figura, toda en blanco.
function silhouette(sp) {
  const c = document.createElement('canvas');
  c.width = sp.width; c.height = sp.height;
  const g = c.getContext('2d');
  g.drawImage(sp, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// o = { name, stage, before, after (lienzos), color, burst (lienzo opcional),
//       stats: [{ label, before, after }], char: { name, color, why, desc },
//       extras: [html], onDone }
export function playEvolution(o) {
  const root = document.getElementById('evo'), cv = document.getElementById('evo-canvas'), ui = document.getElementById('evo-ui');
  const whiteA = silhouette(o.before), whiteB = silhouette(o.after);
  const parts = [];
  let t0 = performance.now(), last = t0, flick = 0, spawn = 0, panel = 0;
  let burst = false, shown = false, closed = false;
  root.hidden = false; ui.hidden = true; ui.innerHTML = '';
  sfx.rise();

  const draw = (ctx, img, cx, base, height, scale = 1) => {
    const k = (height * scale) / img.height;
    ctx.drawImage(img, cx - (img.width * k) / 2, base - img.height * k, img.width * k, img.height * k);
  };

  function showPanel() {
    shown = true;
    ui.hidden = false;
    const top = Math.max(...o.stats.slice(0, 4).map(s => s.after)) * 1.15;
    const pct = (s, v, i) => Math.min(100, (v / (i < 4 ? top : s.after * 1.1)) * 100);
    ui.innerHTML = `<div class="evo-stats">${o.stats.map((s, i) => `<div class="evo-stat"><span>${s.label}</span>
        <div class="bar"><i style="width:${pct(s, s.before, i)}%"></i></div><b>${s.before}</b><em>+${s.after - s.before}</em></div>`).join('')}</div>
      <div class="evo-char" style="--c:${o.char.color}"><small>Carácter</small><b>${o.char.name}</b><p>${o.char.why} <i>${o.char.desc}</i></p></div>
      ${o.extras.join('')}
      <button class="btn primary big" id="evo-done">Continuar</button>`;
    const rows = [...ui.querySelectorAll('.evo-stat')];
    o.stats.forEach((s, i) => setTimeout(() => {     // las estadísticas suben una a una
      if (closed) return;
      rows[i].classList.add('up');
      rows[i].querySelector('b').textContent = s.after;
      rows[i].querySelector('.bar i').style.width = pct(s, s.after, i) + '%';
      sfx.tap();
    }, 400 + i * 260));
    setTimeout(() => { if (!closed) { ui.querySelector('.evo-char').classList.add('in'); sfx.good(); } }, 650 + o.stats.length * 260);
    document.getElementById('evo-done').onclick = () => { closed = true; root.hidden = true; o.onDone?.(); };
  }

  // Un toque durante la animación salta directamente al resultado.
  cv.onclick = () => { if (!shown) t0 = performance.now() - PANEL * 1000; };

  function frame(now) {
    if (closed) return;
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const { ctx, w, h } = fit(cv);
    const wide = w > h * 1.1;
    panel = clamp(panel + (t >= PANEL ? dt * 2.2 : 0), 0, 1);
    const ease = 1 - (1 - panel) ** 3;
    // Al salir el resumen, la criatura se aparta: a la izquierda en pantallas anchas, arriba en estrechas.
    const cx = lerp(w / 2, wide ? w * 0.3 : w / 2, ease);
    const base = lerp(h * 0.66, wide ? h * 0.68 : h * 0.4, ease);
    const size = Math.min(w, h) * lerp(0.42, wide ? 0.42 : 0.26, ease);
    const mid = base - size * 0.5, reach = Math.max(w, h) * 0.75;
    const charge = clamp((t - CHARGE) / (FLASH - CHARGE), 0, 1), revealed = t >= REVEAL;

    // Fondo oscuro con resplandor del color del elemento
    ctx.fillStyle = '#04030d';
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(cx, mid, 10, cx, mid, reach);
    glow.addColorStop(0, o.color + hex(revealed ? 0.4 : 0.12 + charge * 0.4));
    glow.addColorStop(1, o.color + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const shake = revealed ? 0 : charge * charge * 7;
    ctx.translate(rand(-shake, shake), rand(-shake, shake));

    // Haces de luz girando detrás
    ctx.save();
    ctx.translate(cx, mid);
    ctx.rotate(t * (revealed ? 0.22 : 0.5 + charge * 1.2));
    ctx.fillStyle = revealed ? '#ffe9a0' : o.color;
    ctx.globalAlpha = revealed ? 0.2 : charge * 0.32;
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-reach * 0.07, -reach); ctx.lineTo(reach * 0.07, -reach); ctx.fill();
    }
    ctx.restore();

    // Energía que gira hacia la criatura mientras se carga
    if (t >= CHARGE && !revealed) {
      spawn += dt * (40 + charge * 190);
      while (spawn >= 1) {
        spawn--;
        const r = rand(0.45, 0.95) * size * 1.5;
        parts.push({ a: rand(0, 6.283), r, va: rand(2, 5) * (Math.random() < 0.5 ? 1 : -1), vr: -r / rand(0.45, 0.9), c: Math.random() < 0.35 ? '#ffffff' : o.color, s: rand(3, 7), life: 0, max: 1.2 });
      }
    }
    if (!burst && revealed) {                        // estallido al aparecer la forma nueva
      burst = true;
      sfx.reveal();
      for (let i = 0; i < 130; i++) {
        const a = rand(0, 6.283), v = rand(120, 760);
        parts.push({ x: cx, y: mid, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, c: [o.color, '#ffffff', '#ffd76a'][i % 3], s: rand(3, 8), life: 0, max: rand(0.7, 1.7) });
      }
    }
    for (const p of parts) {
      p.life += dt;
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.985; }
      else { p.a += p.va * dt; p.r = Math.max(0, p.r + p.vr * dt); p.x = cx + Math.cos(p.a) * p.r; p.y = mid + Math.sin(p.a) * p.r * 0.85; if (p.r <= 2) p.life = p.max; }
      ctx.globalAlpha = clamp(1 - p.life / p.max, 0, 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life >= parts[i].max) parts.splice(i, 1);
    ctx.globalAlpha = 1;

    // La criatura
    ctx.imageSmoothingQuality = 'high';
    if (t < CHARGE) {
      draw(ctx, o.before, cx, base, size, 1 + Math.sin(t * 8) * 0.015);
    } else if (!revealed) {                          // siluetas que alternan cada vez más rápido
      flick += dt * (3 + charge * charge * 40);
      const useNew = charge > 0.22 && Math.floor(flick) % 2 === 1;
      ctx.shadowColor = o.color; ctx.shadowBlur = 30 + charge * 60;
      draw(ctx, useNew ? whiteB : whiteA, cx, base, size, 1 + Math.sin(t * 24) * 0.04 + charge * 0.08);
      ctx.shadowBlur = 0;
    } else {
      const since = t - REVEAL, pop = 1 + 0.28 * Math.exp(-since * 5) * Math.cos(since * 14);
      if (o.burst) {
        const k = (size * 2.6) / o.burst.width;
        ctx.save(); ctx.translate(cx, mid); ctx.rotate(t * 0.3); ctx.globalAlpha = 0.55;
        ctx.drawImage(o.burst, (-o.burst.width * k) / 2, (-o.burst.height * k) / 2, o.burst.width * k, o.burst.height * k);
        ctx.restore();
      }
      draw(ctx, o.after, cx, base, size, pop);
    }

    // Onda expansiva
    if (t >= FLASH && t < FLASH + 1.3) {
      const k = (t - FLASH) / 1.3;
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 12 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(cx, mid, k * reach, 0, 6.283); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Destello blanco entre una forma y otra
    const white = t < FLASH ? 0 : t < REVEAL ? (t - FLASH) / (REVEAL - FLASH) : Math.max(0, 1 - (t - REVEAL) / 0.8);
    if (white > 0) { ctx.fillStyle = `rgba(255,255,255,${white})`; ctx.fillRect(0, 0, w, h); }

    // Título
    const title = t < CHARGE ? `¿Qué le pasa a ${o.name}?` : !revealed ? `¡${o.name} está evolucionando!` : `¡${o.name} evolucionó a ${o.stage}!`;
    const fs = clamp(w * 0.045, 22, 52) * (revealed ? 1 : 0.86);
    ctx.font = `900 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = fs * 0.24; ctx.strokeStyle = '#0a0720';
    const ty = lerp(h * 0.14, wide ? h * 0.14 : h * 0.08, ease), tx = lerp(w / 2, wide ? w * 0.3 : w / 2, ease);
    ctx.globalAlpha = revealed ? 1 : 0.75 + 0.25 * Math.sin(t * 9);
    ctx.strokeText(title, tx, ty);
    ctx.fillStyle = revealed ? '#ffd76a' : '#ffffff';
    ctx.fillText(title, tx, ty);
    ctx.globalAlpha = 1;

    if (!shown && t >= PANEL) showPanel();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
