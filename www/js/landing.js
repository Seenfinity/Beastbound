// Portada: usa el mismo arte y el mismo motor que el juego.
// - Un duelo real jugándose solo (dos bandos automáticos) sobre los tres mapas.
// - Una criatura protagonista (por defecto Solaris, la de la ilustración) que se puede cambiar por cualquiera de las 15.

import { loadMoods, loadGrid, loadImage } from './sprites.js';
import { ROSTER, ELEMENT_COLOR, EGG_ORDER, STAGES, MOOD, MAPS, moodSheet, powersOf } from './roster.js';
import { Battle, W } from './battle.js';
import * as S from './state.js';
import { hush } from './sfx.js';

hush(true);                                           // la portada no suena, y no toca el ajuste de sonido del juego

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hojas de cada especie: se piden la primera vez que hacen falta.
const sheets = new Map();
const sheetOf = id => { if (!sheets.has(id)) sheets.set(id, loadMoods(moodSheet(id))); return sheets.get(id); };
// Un sprite recortado, como imagen.
const urls = new WeakMap();
const src = cv => { if (!urls.has(cv)) urls.set(cv, cv.toDataURL()); return urls.get(cv); };

// ---------- La criatura protagonista ----------
let shown = null;
async function follow(sp) {
  shown = sp;
  const grid = await sheetOf(sp.id);
  if (shown !== sp) return;
  document.documentElement.style.setProperty('--el', ELEMENT_COLOR[sp.element]);
  const fig = (cv, label, size, note = '') => `<figure style="--h:${Math.round(size * (cv.rel || 1))}px"><img src="${src(cv)}" alt="${sp.name}: ${label}"><figcaption>${label}${note ? `<small>${note}</small>` : ''}</figcaption></figure>`;
  $('moods').innerHTML = [['calm', 'Tranquila'], ['happy', 'Contenta'], ['sad', 'Triste'], ['sleep', 'Dormida'], ['attack', 'En combate']].map(([m, label]) => fig(grid[1][MOOD[m]], label, 124)).join('');
  $('stages').innerHTML = [0, 1, 2].map(i => fig(grid[i][MOOD.calm], STAGES[i], [100, 138, 188][i], ['Al nacer', 'Nivel 10', 'Nivel 30'][i])).join('<span class="then" aria-hidden="true">›</span>');
  $('room-pet').src = src(grid[1][MOOD.happy]);
  $('room-pet').alt = `${sp.name} en su sala`;
  for (const b of document.querySelectorAll('#grid button')) b.classList.toggle('on', b.dataset.id === sp.id);
}

// ---------- Habitaciones ----------
const ROOMS = [['sala', 'Guardería nocturna'], ['sala-bosque', 'Cabaña del bosque'], ['sala-espacio', 'Estación espacial'], ['sala-dojo', 'Dojo de montaña']];
function buildRooms() {
  $('rooms').innerHTML = ROOMS.map(([id, name], i) => `<button role="tab" aria-selected="${i === 0}" data-room="${id}" title="${name}"><img src="assets/landing/${id}.webp" alt="${name}" loading="lazy"></button>`).join('');
  $('rooms').addEventListener('click', e => {
    const b = e.target.closest('[data-room]');
    if (!b) return;
    $('room').style.backgroundImage = `url(assets/landing/${b.dataset.room}.webp)`;
    for (const x of $('rooms').children) x.setAttribute('aria-selected', x === b);
  });
}

// ---------- Huevos y categorías ----------
async function buildEggs() {
  const eggs = (await loadGrid('assets/landing/huevos.webp', 4, 4)).flat();
  $('eggs').innerHTML = EGG_ORDER.map((el, i) => `<img src="${src(eggs[i])}" alt="Huevo de ${el}" title="Huevo de ${el}" style="--el:${ELEMENT_COLOR[el]}">`).join('');
  $('grades').innerHTML = S.GRADES.map(g => `<li style="--c:${g.color}"><b>${g.name}</b><span>${g.desc}</span></li>`).join('');
}

// ---------- Las quince especies ----------
async function buildRoster() {
  const grid = $('grid');
  grid.innerHTML = ROSTER.map(sp => `<button data-id="${sp.id}" style="--el:${ELEMENT_COLOR[sp.element]}"><span class="pic"></span><b>${sp.name}</b><span class="el">${sp.element}</span><span class="role">${sp.role}</span></button>`).join('');
  grid.addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    follow(ROSTER.find(r => r.id === b.dataset.id));
    $('crianza').scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  });
  await Promise.all(ROSTER.map(async sp => {
    const g = await sheetOf(sp.id), b = grid.querySelector(`[data-id="${sp.id}"]`);
    b.querySelector('.pic').innerHTML = `<img src="${src(g[2][MOOD.calm])}" alt="${sp.name} en su forma Final">`;
    b.classList.toggle('on', shown === sp);
  }));
}

// ---------- Duelo en vivo ----------
// Dos criaturas en su forma Final, con sus poderes, peleando solas con el motor del juego.
const PAIRS = [['solaris', 'shadowon'], ['voltix', 'aquarok'], ['frostine', 'pyrorex'], ['zephyra', 'toxipuff'], ['blaziky', 'gravion'], ['draconoid', 'mechapi'], ['tropicat', 'rokky']];
const canvas = $('duel');
let duel = null, mapIndex = 0, pairIndex = 0, mapImgs = [], thinking = 0, visible = false, last = 0, restart = 0;

async function side(id) {
  const sp = ROSTER.find(r => r.id === id), grid = await sheetOf(id);
  const pet = { species: id, name: sp.name, level: 14, stage: 2, stats: { pot: sp.base[0] + 9, agu: sp.base[1] + 9, pun: sp.base[2] + 9, agi: sp.base[3] + 9 }, hunger: 85, mood: 85, bond: 80, char: '', mastery: '', hue: 0 };
  return { pet, prof: S.profile(pet), species: sp, sprite: grid[2][0], sprites: grid[2], powers: powersOf(sp, pet).filter(p => p.unlocked) };
}

async function startDuel() {
  clearTimeout(restart); clearTimeout(thinking); thinking = 0;
  const [a, b] = PAIRS[pairIndex % PAIRS.length], map = { ...MAPS[mapIndex], img: mapImgs[mapIndex] };
  const [me, foe] = await Promise.all([side(a), side(b)]);
  const box = canvas.getBoundingClientRect(), VH = Math.round((W * box.height) / box.width) || 360;
  const fight = new Battle(canvas, me, foe, map, { onEnd: () => { restart = setTimeout(() => { pairIndex++; mapIndex = (mapIndex + 1) % MAPS.length; startDuel(); }, 2800); } }, VH, box.width < 520 ? 1.5 : 1.15, {}, 0);
  // Los rótulos del juego hablan de «tu turno»: aquí son dos criaturas con nombre.
  const say = fight.say.bind(fight);
  fight.say = (text, time) => say(text === '¡Tu turno!' ? `Turno de ${me.pet.name}` : text === '¡Victoria!' ? `¡Gana ${me.pet.name}!` : text === 'Derrota…' ? `¡Gana ${foe.pet.name}!` : text.replace(' falló: tardará más en volver', ' falló'), time);
  fight.banner = null; fight.say('¡Tu turno!');
  fight.setView(true, true);
  duel = fight;
  $('versus').innerHTML = `<span style="--el:${ELEMENT_COLOR[me.species.element]}"><b>${me.pet.name}</b>${me.species.element}</span><i>contra</i><span style="--el:${ELEMENT_COLOR[foe.species.element]}"><b>${foe.pet.name}</b>${foe.species.element}</span>`;
  for (const t of $('maps').children) t.setAttribute('aria-selected', +t.dataset.map === mapIndex);
}

// El bando de la izquierda apunta como lo haría la máquina, con algo de error para que no acierte siempre.
function autoAim(fight) {
  thinking = 0;
  if (fight !== duel || !fight.canAct()) return;
  const f = fight.player, tgt = fight.rival, right = tgt.x > f.x;
  let best = null;
  for (let i = 0; i < 140; i++) {
    const angle = right ? rand(10, 82) : rand(98, 170), power = rand(25, 100);
    const end = fight.trace(...fight.muzzle(f, angle), angle, power).end;
    if (!end) continue;
    const d = Math.abs(end[0] - tgt.x) + Math.abs(end[1] - tgt.y) * 0.3;
    if (!best || d < best.d) best = { d, angle, power };
  }
  if (best) { f.angle = best.angle + rand(-4, 4); f.power = Math.min(100, Math.max(10, best.power + rand(-4, 4))); }
  const ready = f.powers.map((_, i) => i).filter(i => fight.canUse(f, i));
  if (ready.length && Math.random() < 0.7) fight.arm(ready[Math.floor(Math.random() * ready.length)]);
  fight.fire(fight.armed);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!duel || !visible || document.hidden) return;
  if (duel.canAct() && !thinking) { const fight = duel; thinking = setTimeout(() => autoAim(fight), 1300); }
  duel.update(dt);
  duel.draw();
}

async function buildDuel() {
  $('maps').innerHTML = MAPS.map((m, i) => `<button role="tab" data-map="${i}" aria-selected="${i === 0}"><img src="assets/landing/${m.id}.webp" alt="" loading="lazy"><span><b>${m.name}</b>${m.effect}</span></button>`).join('');
  $('maps').addEventListener('click', e => { const b = e.target.closest('[data-map]'); if (b) { mapIndex = +b.dataset.map; pairIndex++; startDuel(); } });
  mapImgs = await Promise.all(MAPS.map(m => loadImage(`assets/landing/${m.id}.webp`)));
  await startDuel();
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: 0.15 }).observe(canvas);
  if (still) { visible = false; duel.update(0.016); duel.draw(); }       // sin movimiento: se queda en la primera imagen
  else requestAnimationFrame(frame);
}

// ---------- La ilustración de portada, con vida ----------
// Coordenadas sobre la ilustración original (1536 × 864). Las luces laten, los huevos se mecen y la cría respira.
const ART = { w: 1536, h: 864 };
const GLOWS = [   // x, y, ancho, proporción, color, clase
  [970, 108, 300, 3, '#ffd98a', ''], [565, 312, 190, 3, '#ffd98a', ''], [1380, 343, 190, 3, '#ffe2a8', ''],                // lámparas de las cúpulas
  [430, 80, 120, 1, '#ffb347', 'flame'], [25, 565, 130, 1, '#ffb347', 'flame'], [1418, 228, 84, 1, '#ffb347', 'flame'],     // farolillos
  [420, 180, 84, 1, '#7fe9c8', ''], [605, 170, 84, 1, '#b06bff', ''], [665, 45, 70, 1, '#6fa8ff', ''],                      // frascos
  [211, 144, 120, 1, '#cfd8ff', ''], [225, 330, 240, 1, '#8f7bff', 'soft'],                                                // luna y ciudad
  [730, 745, 84, 1, '#7fe9ff', ''], [967, 763, 88, 1, '#7fe9ff', ''], [1196, 747, 84, 1, '#7fe9ff', ''],                    // luces de las bases
  [437, 660, 58, 1, '#7fe9ff', ''], [578, 667, 60, 1, '#7fe9ff', ''], [1297, 687, 54, 1, '#7fe9ff', ''], [1413, 690, 56, 1, '#7fe9ff', ''], [1492, 687, 50, 1, '#7fe9ff', ''],
  [562, 505, 300, .9, '#ff9a2e', ''], [1380, 525, 300, .9, '#8fd0ff', ''],                                                  // el brillo de cada huevo
  [992, 208, 160, 2.6, '#ffe08a', ''], [942, 535, 170, 1, '#ffd24a', ''], [975, 400, 560, 1, '#ffd98a', 'soft'],            // halo, sol del cascarón y contraluz
];
const PIECES = [  // x0, y0, x1, y1, clase, duración, retraso: solo los dos huevos sin abrir se mecen
  [466, 392, 662, 618, 'egg', 2.6, 0], [1283, 422, 1480, 642, 'egg', 3.1, -1.2],
];
function buildArt() {
  const art = $('hero-art'), pct = (v, of) => `${(v / of) * 100}%`, bits = [];
  for (const [x0, y0, x1, y1, cls, t, d] of PIECES) {
    const w = x1 - x0, h = y1 - y0;
    bits.push(`<i class="piece ${cls}" style="left:${pct(x0, ART.w)};top:${pct(y0, ART.h)};width:${pct(w, ART.w)};height:${pct(h, ART.h)};background-size:${(ART.w / w) * 100}% ${(ART.h / h) * 100}%;background-position:${(x0 / (ART.w - w)) * 100}% ${(y0 / (ART.h - h)) * 100}%;--t:${t}s;--d:${d}s"></i>`);
  }
  GLOWS.forEach(([x, y, w, r, c, cls], i) => bits.push(`<i class="glow ${cls}" style="--x:${pct(x, ART.w)};--y:${pct(y, ART.h)};--w:${pct(w, ART.w)};--r:${r};--c:${c};--t:${(2.2 + (i * 0.37) % 1.9).toFixed(2)}s;--d:${(-(i * 0.71) % 3).toFixed(2)}s"></i>`));
  // Destellos: muchos en la cúpula central (dorados), sin tapar a la cría ni su huevo, y unos pocos en las de los lados.
  const spark = (x, y, c) => bits.push(`<i class="spark" style="--x:${pct(x, ART.w)};--y:${pct(y, ART.h)};--s:${rand(1.1, 2.6).toFixed(2)}%;--c:${c};--t:${rand(1.6, 3.4).toFixed(2)}s;--d:${(-rand(0, 3.4)).toFixed(2)}s"></i>`);
  const inside = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  for (let i = 0; i < 20; i++) {
    let x, y;
    do { x = rand(745, 1195); y = rand(190, 640); } while (inside(x, y, 965, 360, 175, 190) || inside(x, y, 950, 545, 150, 115));
    spark(x, y, '#ffe9a8');
  }
  for (let i = 0; i < 5; i++) spark(rand(455, 675), rand(370, 600), '#ffcf8a');
  for (let i = 0; i < 5; i++) spark(rand(1275, 1495), rand(400, 630), '#bfe6ff');
  // Motas de luz que suben flotando por la sala.
  for (let i = 0; i < 30; i++) bits.push(`<i class="mote" style="--x:${pct(rand(0, ART.w), ART.w)};--y:${pct(rand(260, 860), ART.h)};--s:${rand(0.45, 1.1).toFixed(2)}%;--c:${['#ffd98a', '#c9a8ff', '#8fd0ff'][i % 3]};--dx:${rand(-3, 3).toFixed(1)}vw;--t:${rand(6, 12).toFixed(1)}s;--d:${(-rand(0, 12)).toFixed(1)}s"></i>`);
  bits.push('<i class="shine"></i>');
  art.innerHTML = bits.join('');
  // La capa se coloca igual que lo haría un fondo «cover», para que todo lo de encima case con el dibujo.
  const hero = art.parentElement, narrow = matchMedia('(max-width: 860px)');
  const place = () => {
    const W = hero.clientWidth, H = hero.clientHeight;
    let w, h, x, y;
    if (narrow.matches) { h = innerHeight * 0.62; w = (h * ART.w) / ART.h; if (w < W) { w = W; h = (w * ART.h) / ART.w; } x = (W - w) * 0.66; y = 0; }
    else { const k = Math.max(W / ART.w, H / ART.h); w = ART.w * k; h = ART.h * k; x = (W - w) * 0.62; y = (H - h) * 0.5; }
    Object.assign(art.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    art.classList.add('placed');
  };
  place();
  new ResizeObserver(place).observe(hero);
  addEventListener('resize', place);
}

// ---------- Arranque ----------
buildArt();
buildRooms();
follow(ROSTER.find(r => r.id === 'solaris'));
buildDuel().catch(err => { console.error(err); $('duel').closest('.arena').classList.add('failed'); });
buildEggs().catch(console.error);
// Las quince hojas se cargan cuando el visitante se acerca a esa sección.
const near = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { near.disconnect(); buildRoster(); } }, { rootMargin: '900px' });
near.observe($('especies'));
