// Portada: usa el mismo arte y el mismo motor que el juego.
// - Un duelo real jugándose solo (dos bandos automáticos) sobre los tres mapas.
// - Una criatura protagonista (por defecto el Draconoid de la ilustración) que se puede cambiar por cualquiera de las 15.

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
const PAIRS = [['draconoid', 'pyrorex'], ['voltix', 'aquarok'], ['frostine', 'shadowon'], ['solaris', 'toxipuff'], ['blaziky', 'gravion'], ['zephyra', 'mechapi'], ['tropicat', 'rokky']];
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

// ---------- Arranque ----------
buildRooms();
follow(ROSTER.find(r => r.id === 'draconoid'));
buildDuel().catch(err => { console.error(err); $('duel').closest('.arena').classList.add('failed'); });
buildEggs().catch(console.error);
// Las quince hojas se cargan cuando el visitante se acerca a esa sección.
const near = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { near.disconnect(); buildRoster(); } }, { rootMargin: '900px' });
near.observe($('especies'));
