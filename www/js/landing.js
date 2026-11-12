// Portada: un huevo que se abre al tocarlo, y el resto de la página sigue a la criatura que salió.
// Usa el mismo arte y el mismo recortador que el juego.

import { loadMoods, loadGrid } from './sprites.js';
import { ROSTER, ELEMENT_COLOR, EGG_ORDER, STAGES, MOOD, moodSheet } from './roster.js';

const $ = id => document.getElementById(id);
const pick = list => list[Math.floor(Math.random() * list.length)];
const calm = !matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hojas de cada especie: se piden la primera vez que hacen falta.
const sheets = new Map();
const sheetOf = id => { if (!sheets.has(id)) sheets.set(id, loadMoods(moodSheet(id))); return sheets.get(id); };
// Un sprite recortado, como imagen.
const urls = new WeakMap();
const src = cv => { if (!urls.has(cv)) urls.set(cv, cv.toDataURL()); return urls.get(cv); };

let eggs = [], egg = pick(ROSTER), shown = null, busy = false;   // egg: la especie que hay dentro; shown: la que sigue la página

function showEgg() {
  const i = EGG_ORDER.indexOf(egg.element);
  $('egg-img').src = src(eggs[i]);
  $('egg-img').hidden = false; $('baby-img').hidden = true;
  $('egg-btn').classList.remove('open');
  $('egg-btn').disabled = false;
  $('egg-btn').parentElement.style.setProperty('--el', ELEMENT_COLOR[egg.element]);
  $('hatch-line').textContent = `Huevo de ${egg.element}. Tócalo.`;
  $('again').hidden = true;
  sheetOf(egg.id);                                    // se va descargando mientras el visitante mira
}

async function hatch() {
  if (busy) return;
  busy = true;
  const sp = egg, btn = $('egg-btn');
  btn.disabled = true;
  btn.classList.add('shaking');
  const [grid] = await Promise.all([sheetOf(sp.id), new Promise(done => setTimeout(done, calm ? 900 : 0))]);
  btn.classList.remove('shaking');
  btn.classList.add('open');
  $('egg-img').hidden = true;
  $('baby-img').src = src(grid[0][MOOD.happy]);
  $('baby-img').alt = `${sp.name} recién nacido`;
  $('baby-img').hidden = false;
  $('hatch-line').textContent = `Te ha salido ${sp.name}, de elemento ${sp.element}.`;
  $('again').hidden = false;
  follow(sp, grid);
  busy = false;
}

// La página pasa a contar la vida de esta criatura.
function follow(sp, grid) {
  shown = sp;
  document.documentElement.style.setProperty('--el', ELEMENT_COLOR[sp.element]);
  $('vida').classList.remove('unknown');
  const fig = (cv, label, size, note = '') => `<figure style="--h:${Math.round(size * (cv.rel || 1))}px"><img src="${src(cv)}" alt="${sp.name}: ${label}"><figcaption>${label}${note ? `<small>${note}</small>` : ''}</figcaption></figure>`;
  $('moods').innerHTML = [['calm', 'Tranquila'], ['happy', 'Contenta'], ['sad', 'Triste'], ['sleep', 'Dormida']].map(([m, label]) => fig(grid[0][MOOD[m]], label, 118)).join('');
  $('stages').innerHTML = [0, 1, 2].map(i => fig(grid[i][MOOD.calm], STAGES[i], [104, 142, 190][i], ['Al nacer', 'Nivel 10', 'Nivel 30'][i])).join('<span class="then" aria-hidden="true">›</span>');
  $('duel-me').src = src(grid[2][MOOD.attack]);
  for (const b of document.querySelectorAll('#grid button')) b.classList.toggle('on', b.dataset.id === sp.id);
  // El rival: otra especie, la primera que encuentre de otro elemento.
  const foe = ROSTER[(ROSTER.indexOf(sp) + 7) % ROSTER.length];
  sheetOf(foe.id).then(g => { if (shown === sp) $('duel-foe').src = src(g[2][MOOD.calm]); });
}

// Las quince especies: se cargan cuando el visitante se acerca a esa sección.
async function buildRoster() {
  const grid = $('grid');
  grid.innerHTML = ROSTER.map(sp => `<button data-id="${sp.id}" style="--el:${ELEMENT_COLOR[sp.element]}"><span class="pic"></span><b>${sp.name}</b><span class="el">${sp.element}</span></button>`).join('');
  await Promise.all(ROSTER.map(async sp => {
    const g = await sheetOf(sp.id), b = grid.querySelector(`[data-id="${sp.id}"]`);
    b.querySelector('.pic').innerHTML = `<img src="${src(g[2][MOOD.calm])}" alt="${sp.name} en su forma Final">`;
    b.classList.toggle('on', shown === sp);
  }));
}
$('grid').addEventListener('click', async e => {
  const b = e.target.closest('button[data-id]');
  if (!b || busy) return;
  const sp = ROSTER.find(r => r.id === b.dataset.id), grid = await sheetOf(sp.id);
  egg = sp;
  $('egg-btn').classList.add('open'); $('egg-btn').disabled = true;
  $('egg-btn').parentElement.style.setProperty('--el', ELEMENT_COLOR[sp.element]);
  $('egg-img').hidden = true;
  $('baby-img').src = src(grid[0][MOOD.happy]); $('baby-img').alt = `${sp.name} recién nacido`; $('baby-img').hidden = false;
  $('hatch-line').textContent = `Elegiste a ${sp.name}, de elemento ${sp.element}.`;
  $('again').hidden = false;
  follow(sp, grid);
  $('vida').scrollIntoView({ behavior: calm ? 'smooth' : 'auto', block: 'start' });
});

$('egg-btn').addEventListener('click', hatch);
$('again').addEventListener('click', () => { egg = pick(ROSTER.filter(r => r !== egg)); showEgg(); $('egg-btn').focus(); });

try {
  eggs = (await loadGrid('assets/landing/huevos.webp', 4, 4)).flat();
  showEgg();
  const near = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { near.disconnect(); buildRoster(); } }, { rootMargin: '600px' });
  near.observe($('especies'));
} catch (err) {
  console.error(err);
  $('hatch-line').textContent = 'No se pudo cargar el huevo. Recarga la página.';
}
