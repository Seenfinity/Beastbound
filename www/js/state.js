// Reglas de crianza y partida guardada. Aquí no se dibuja nada.

import { ROSTER, speciesOf, matchup } from './roster.js';
import { EVENTS } from './events.js';

// Partida guardada. Con ?slot=nombre en la dirección se usa una partida aparte (útil para probar sin tocar la tuya).
const slot = new URLSearchParams(globalThis.location?.search || '').get('slot');
const KEY = 'petbound-save-v3' + (slot ? '-' + slot.replace(/[^a-z0-9]/gi, '') : '');
const STATS = ['pot', 'agu', 'pun', 'agi'];

export const STAT_NAMES = { pot: 'Potencia', agu: 'Aguante', pun: 'Puntería', agi: 'Agilidad' };
export const STAT_HELP = { pot: 'más daño', agu: 'más vida', pun: 'guía de tiro más larga', agi: 'se mueve más por turno' };

// Comida. hunger = cuánto llena; lean = qué estadística cría (decide qué sube al ganar nivel).
// Algunas apenas llenan pero animan o dan energía; otras llenan muchísimo.
export const FOODS = {
  filete: { name: 'Filete', desc: 'Llena mucho. Cría Potencia.', hunger: 35, mood: 0, energy: 0, lean: 'pot', price: 7 },
  bayas: { name: 'Bayas', desc: 'Dulces y sanas. Crían Aguante.', hunger: 24, mood: 6, energy: 0, lean: 'agu', price: 4 },
  semillas: { name: 'Semillas', desc: 'Ligeras, dan energía. Crían Agilidad.', hunger: 16, mood: 0, energy: 14, lean: 'agi', price: 4 },
  pescado: { name: 'Pescado', desc: 'Llena bien. Cría Puntería.', hunger: 28, mood: 0, energy: 0, lean: 'pun', price: 6 },
  galleta: { name: 'Galleta', desc: 'Un bocado: casi no llena, pero anima.', hunger: 8, mood: 10, energy: 0, lean: 'agi', price: 2 },
  miel: { name: 'Miel', desc: 'Llena poco; anima y da algo de energía.', hunger: 12, mood: 14, energy: 6, lean: 'agu', price: 5 },
  sopa: { name: 'Sopa', desc: 'Llena muchísimo. Cría Aguante.', hunger: 45, mood: 3, energy: 0, lean: 'agu', price: 9 },
  banquete: { name: 'Banquete', desc: 'Lo que más llena, pero deja pesado. Cría Potencia.', hunger: 60, mood: 0, energy: -8, lean: 'pot', price: 14 },
  queso: { name: 'Queso', desc: 'Llena algo. Cría Puntería.', hunger: 20, mood: 0, energy: 0, lean: 'pun', price: 4 },
  manzana: { name: 'Manzana', desc: 'Ligera y fresca. Cría Agilidad.', hunger: 14, mood: 3, energy: 0, lean: 'agi', price: 3 },
  leche: { name: 'Leche', desc: 'Llena poco y da mucha energía.', hunger: 10, mood: 0, energy: 20, lean: 'agu', price: 5 },
  pastel: { name: 'Pastel', desc: 'Llena poco, pero le encanta a casi todas.', hunger: 15, mood: 25, energy: 0, lean: 'pot', price: 12 },
  sandia: { name: 'Sandía', desc: 'Refrescante. Cría Agilidad.', hunger: 22, mood: 0, energy: 5, lean: 'agi', price: 4 },
  zanahoria: { name: 'Zanahoria', desc: 'Buena para la vista. Cría Puntería.', hunger: 18, mood: 0, energy: 0, lean: 'pun', price: 3 },
  pan: { name: 'Pan', desc: 'Llena bastante. Cría Aguante.', hunger: 30, mood: 0, energy: 0, lean: 'agu', price: 6 },
  chile: { name: 'Chile', desc: 'No llena nada: pica, espabila y enfada un poco.', hunger: 5, mood: -6, energy: 25, lean: 'pot', price: 6 },
  helado: { name: 'Helado', desc: 'Un capricho: no llena, anima mucho.', hunger: 6, mood: 18, energy: 0, lean: 'agi', price: 6 },
  huevo: { name: 'Huevo frito', desc: 'Llena bien. Cría Potencia.', hunger: 26, mood: 0, energy: 0, lean: 'pot', price: 5 },
  seta: { name: 'Seta', desc: 'Llena algo. Cría Puntería.', hunger: 16, mood: 0, energy: 0, lean: 'pun', price: 3 },
};
// Orden de las comidas nuevas en assets/ui/comida.png.
export const FOOD_SHEET = ['pescado', 'galleta', 'miel', 'sopa', 'banquete', 'queso', 'manzana', 'leche', 'pastel', 'sandia', 'zanahoria', 'pan', 'chile', 'helado', 'huevo', 'seta'];

// Habitaciones: son solo aspecto. Se compran una vez y se cambia entre ellas cuando quieras.
export const ROOMS = {
  sala: { name: 'Guardería nocturna', bg: 'assets/ui/sala.png', price: 0 },
  bosque: { name: 'Cabaña del bosque', bg: 'assets/ui/sala-bosque.png', price: 250 },
  espacio: { name: 'Estación espacial', bg: 'assets/ui/sala-espacio.png', price: 300 },
  dojo: { name: 'Dojo de montaña', bg: 'assets/ui/sala-dojo.png', price: 300 },
};

// El carácter se fija al evolucionar, según cómo la hayas tratado en esa etapa.
export const CHARS = {
  feroz: { name: 'Feroz', desc: 'Pega un 20% más fuerte cuando le queda menos de media vida.', why: 'Lo curtiste a base de combates.', color: '#ff6b4a' },
  leal: { name: 'Leal', desc: 'Una vez por combate aguanta un golpe mortal con 1 de vida.', why: 'Lo criaste con mucho cariño.', color: '#ffb36b' },
  astuto: { name: 'Astuto', desc: 'Su guía de tiro es mucho más larga.', why: 'Lo criaste con disciplina y entrenamiento.', color: '#7fe9ff' },
  sereno: { name: 'Sereno', desc: 'Recupera un poco de vida al empezar cada turno.', why: 'Lo criaste con equilibrio.', color: '#9be3a0' },
  resentido: { name: 'Resentido', desc: 'Pega un 12% más fuerte, pero a veces no obedece.', why: 'Pasó demasiado tiempo con hambre o triste.', color: '#b08cff' },
};

// La maestría sale de lo que más hayas entrenado y mejora el especial en la forma Final.
export const MASTERY = {
  pot: { name: 'Maestría de Potencia', desc: 'Su especial hace un 25% más de daño.' },
  agu: { name: 'Maestría de Aguante', desc: 'Al usar el especial gana un escudo.' },
  pun: { name: 'Maestría de Puntería', desc: 'Su especial explota en un área mayor.' },
  agi: { name: 'Maestría de Agilidad', desc: 'Recarga el especial un turno antes.' },
};

// Rasgo: cada individuo nace con uno, aunque sea de la misma especie.
export const QUIRKS = {
  gloton: { name: 'Glotón', desc: 'Le entra hambre antes, pero tiene 10 de vida más.' },
  dormilon: { name: 'Dormilón', desc: 'Recobra la energía un 50% más rápido.' },
  jugueton: { name: 'Juguetón', desc: 'Jugar le sube mucho más el ánimo.' },
  duro: { name: 'Duro', desc: 'Se recupera de los combates un 25% antes.' },
  listo: { name: 'Listo', desc: 'Gana un 10% más de experiencia.' },
  mimoso: { name: 'Mimoso', desc: 'Las caricias le dan el doble de vínculo.' },
};

// Deseos: de vez en cuando pide algo; cumplirlo a tiempo sube el vínculo.
export const WISHES = {
  play: { text: 'Quiere jugar a la pelota', icon: 'pelota' },
  pet: { text: 'Quiere mimos', icon: 'corazon' },
  food: { text: 'Se le antoja comer algo', icon: 'filete' },
  sleep: { text: 'Tiene sueño', icon: 'luna' },
  train: { text: 'Quiere entrenar', icon: 'pesa' },
  fight: { text: 'Quiere pelear', icon: 'espadas' },
};

// Objetos de combate: se usan uno por turno, sin gastar el turno. Son casi una trampa,
// así que son lo más caro de la tienda.
export const ITEMS = {
  pocion: { name: 'Poción', desc: 'Recupera el 30% de la vida.', price: 999, icon: 'botiquin' },
  elixir: { name: 'Elixir', desc: 'Recupera 15 MP.', price: 500, icon: 'rayo' },
  escudo: { name: 'Escudo de un uso', desc: 'El próximo golpe que reciba hace la mitad de daño.', price: 350, icon: 'escudo' },
  mira: { name: 'Mira', desc: 'Este turno ves la trayectoria completa.', price: 999, icon: 'diana' },
};

// Decoración de la sala: se compra en la tienda y cada mueble ayuda en algo.
// x, y = dónde apoya en la sala (imagen de 1536×864); w = ancho con que se dibuja.
// Los "acogedores" (cozy) hacen que el ánimo baje más despacio; los demás tienen su propio efecto.
export const DECOR = {
  alfombra: { name: 'Alfombra', desc: 'Acogedor: el ánimo baja más despacio.', price: 20, cozy: true, floor: true, x: 768, y: 846, w: 440 },
  cama: { name: 'Cama', desc: 'Dormida recobra energía un 30% más rápido.', price: 45, x: 505, y: 752, w: 215 },
  cuenco: { name: 'Cuenco', desc: 'La barriga baja un 10% más despacio.', price: 25, x: 900, y: 806, w: 100 },
  juguetes: { name: 'Baúl de juguetes', desc: 'Jugar le sube 6 de ánimo más.', price: 30, x: 1105, y: 712, w: 175 },
  muneco: { name: 'Muñeco de entrenamiento', desc: 'Cada entrenamiento da 3 de experiencia más.', price: 50, x: 418, y: 706, w: 140 },
  trofeo: { name: 'Pedestal de trofeos', desc: 'Ganas un 10% más de monedas en combate.', price: 60, x: 905, y: 606, w: 100 },
  peluche: { name: 'Peluche', desc: 'Cumplir un deseo da 1 de vínculo más.', price: 35, x: 640, y: 604, w: 95 },
  musica: { name: 'Caja de música', desc: 'Acogedor: el ánimo baja más despacio.', price: 30, cozy: true, x: 612, y: 814, w: 95 },
  pecera: { name: 'Pecera', desc: 'Acogedor: el ánimo baja más despacio.', price: 40, cozy: true, x: 250, y: 726, w: 165 },
  lampara: { name: 'Farol', desc: 'Acogedor: el ánimo baja más despacio.', price: 30, cozy: true, x: 1262, y: 716, w: 78 },
  planta: { name: 'Planta', desc: 'Acogedor: el ánimo baja más despacio.', price: 25, cozy: true, x: 1395, y: 724, w: 165 },
  puff: { name: 'Puf', desc: 'Acogedor: el ánimo baja más despacio.', price: 35, cozy: true, x: 1215, y: 822, w: 170 },
  saco: { name: 'Saco de boxeo', desc: 'Entrenar gasta 5 de energía menos.', price: 45, x: 118, y: 730, w: 150 },
  libros: { name: 'Libros', desc: 'Gana un 5% más de experiencia.', price: 55, x: 1010, y: 716, w: 92 },
  torre: { name: 'Torre de juegos', desc: 'Jugar le sube 4 de ánimo más.', price: 40, x: 1466, y: 744, w: 125 },
  cofre: { name: 'Cofre', desc: 'El regalo diario trae 5 monedas más.', price: 70, x: 772, y: 590, w: 96 },
};
export const DECOR_ORDER = Object.keys(DECOR);          // mismo orden que assets/ui/decoracion.png
const has = (g, id) => !!g.decor?.includes(id);
// Cada mueble acogedor frena un 6% la bajada de ánimo, hasta un 30%.
const cozy = g => 1 - 0.06 * Math.min(5, (g.decor || []).filter(id => DECOR[id]?.cozy).length);
export const trainCost = g => TRAIN_ENERGY - (has(g, 'saco') ? 5 : 0);

// Dónde está cada mueble: donde lo hayas dejado tú o, si no lo has movido, su sitio de fábrica.
export const decorAt = (g, id) => ({ id, ...DECOR[id], ...(g.decorPos?.[id] || {}) });
export function moveDecor(g, id, x, y) {
  if (!DECOR[id]) return;
  g.decorPos[id] = { x: Math.round(Math.max(40, Math.min(1496, x))), y: Math.round(Math.max(560, Math.min(858, y))) };
}
// La criatura usa un mueble por su cuenta: le sube un poco el ánimo (hasta 8 veces al día).
export function useDecor(g, id) {
  const p = g.pet;
  rollDay(p);
  if (!has(g, id) || (p.usesToday || 0) >= 8) return false;
  p.usesToday = (p.usesToday || 0) + 1;
  p.mood = clamp(p.mood + 2);
  return true;
}

export function buyRoom(g, id) {
  const r = ROOMS[id];
  if (g.rooms.includes(id)) return { error: 'Esa habitación ya es tuya.' };
  if (g.coins < r.price) return { error: `Te faltan ${r.price - g.coins} monedas.` };
  g.coins -= r.price;
  g.rooms.push(id);
  g.room = id;
  return {};
}
export function setRoom(g, id) {
  if (g.rooms.includes(id)) g.room = id;
}

export function buyDecor(g, id) {
  const d = DECOR[id];
  if (has(g, id)) return { error: 'Eso ya está en tu sala.' };
  if (g.coins < d.price) return { error: 'No te alcanzan las monedas.' };
  g.coins -= d.price;
  g.decor.push(id);
  return {};
}

// Misiones diarias: una de cuidado, una de entrenamiento y una de combate.
// ok(pet) dice si tiene sentido proponerla hoy; on(evento) cuánto avanza con cada cosa que pasa.
const yes = v => (v ? 1 : 0);
export const MISSIONS = {
  fav: { cat: 'care', text: 'Descubre cuál es su comida favorita', goal: 1, coins: 25, ok: p => !p.favKnown, on: e => yes(e.type === 'feed' && e.loved) },
  favfeed: { cat: 'care', text: 'Dale su comida favorita', goal: 1, coins: 15, ok: p => p.favKnown, on: e => yes(e.type === 'feed' && e.loved) },
  strokes: { cat: 'care', text: 'Acaríciala 10 veces', goal: 10, coins: 15, on: e => yes(e.type === 'stroke') },
  catch: { cat: 'care', text: 'Que atrape la pelota 3 veces', goal: 3, coins: 15, on: e => yes(e.type === 'catch') },
  wish: { cat: 'care', text: 'Cumple uno de sus deseos', goal: 1, coins: 25, on: e => yes(e.type === 'wish') },
  perfect: { cat: 'train', text: 'Saca «Perfecto» en un minijuego', goal: 1, coins: 25, on: e => yes(e.type === 'train' && e.grade === 'perfecto') },
  weak: { cat: 'train', text: 'Entrena su estadística más baja', goal: 1, coins: 20, on: e => yes(e.type === 'train' && e.gained && e.wasLowest) },
  train2: { cat: 'train', text: 'Mejora dos veces entrenando', goal: 2, coins: 20, on: e => yes(e.type === 'train' && e.gained) },
  win: { cat: 'fight', text: 'Gana un combate', goal: 1, coins: 25, on: e => yes(e.type === 'battle' && e.win) },
  diana: { cat: 'fight', text: 'Acierta 2 dianas en combate', goal: 2, coins: 30, on: e => (e.type === 'battle' ? e.dianas || 0 : 0) },
  power: { cat: 'fight', text: 'Acierta 2 poderes en combate', goal: 2, coins: 30, ok: p => p.level >= 2, on: e => (e.type === 'battle' ? e.powerHits || 0 : 0) },
  clean: { cat: 'fight', text: 'Gana conservando más de media vida', goal: 1, coins: 35, on: e => yes(e.type === 'battle' && e.win && e.hpLeft > 0.5) },
  under: { cat: 'fight', text: 'Gana a un rival con ventaja de elemento sobre ti', goal: 1, coins: 45, on: e => yes(e.type === 'battle' && e.win && e.disadvantage) },
};
export const MISSION_BONUS = 40;

// Requisitos para evolucionar: nivel y días de vida. [Baby→Teen, Teen→Final]
export const EVOLVE = [{ level: 10, days: 3 }, { level: 30, days: 14 }];

export const FIGHT_ENERGY = 20, TRAIN_ENERGY = 25, PLAY_ENERGY = 6, TRAINS_PER_DAY = 3, MAX_EGGS = 3, MAX_PETS = 6;
export const DEFEATS_FOR_EGG = 10;      // victorias contra una misma especie para ganar su huevo
export const MIN_SLEEP = 5 * 60000;     // una vez dormida, no se la puede despertar antes de este tiempo
export const MAX_SLEEP = 8 * 3600000;   // se cansa de dormir y se despierta sola pasado este tiempo

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const pick = list => list[Math.floor(Math.random() * list.length)];
const today = () => new Date().toDateString();
const argmax = (obj, keys) => keys.reduce((best, k) => (obj[k] > obj[best] ? k : best), keys[0]);
const fill = (text, pet) => text.replaceAll('{n}', pet.name);

export const expNeeded = level => 25 + level * 15;
export const ageDays = pet => (Date.now() - pet.born) / 864e5;

// g.pet es siempre la criatura activa (no se guarda: se calcula).
function attach(g) {
  Object.defineProperty(g, 'pet', { get() { return this.pets[this.active] || null; }, enumerable: false, configurable: true });
  return g;
}

// Color propio: casi siempre una variación suave; una de cada diez veces, un color raro.
export const rollHue = () => (Math.random() < 0.1 ? pick([120, 180, -120]) : Math.round(Math.random() * 56 - 28));
export const isRare = pet => Math.abs(pet.hue || 0) > 60;

function makePet(species, name, grade = '') {
  const now = Date.now(), sp = speciesOf(species), foods = Object.keys(FOODS), fav = pick(foods);
  const g = GRADES.find(x => x.id === grade), best = [0, 1, 2, 3].sort((a, b) => sp.base[b] - sp.base[a]);
  const extra = i => (g ? g.all + (best.indexOf(i) < g.top ? 1 : 0) : 0);     // lo que suma su categoría a cada estadística
  const pet = makeBase(species, name, now, sp, fav, foods);
  STATS.forEach((k, i) => { pet.stats[k] += extra(i); });
  if (g) { pet.grade = g.id; if (g.rare && !isRare(pet)) pet.hue = (Math.random() < 0.5 ? -1 : 1) * (80 + Math.floor(Math.random() * 80)); }
  return pet;
}
function makeBase(species, name, now, sp, fav, foods) {
  return {
    species, name, born: now, level: 1, exp: 0, stage: 0,
    stats: { pot: sp.base[0], agu: sp.base[1], pun: sp.base[2], agi: sp.base[3] },
    hunger: 70, energy: 100, mood: 75, bond: 20,
    char: '', mastery: '', fav, hate: pick(foods.filter(f => f !== fav)), favKnown: false, hateKnown: false,
    axes: { carino: 0, disciplina: 0, bravura: 0, descuido: 0 },
    diet: { pot: 0, agu: 0, pun: 0, agi: 0 }, trained: { pot: 0, agu: 0, pun: 0, agi: 0 },
    quirk: pick(Object.keys(QUIRKS)), hue: rollHue(), wish: null, nextWish: 0,
    day: today(), trainsToday: 0, playsToday: 0, strokesToday: 0,
    diary: [{ t: now, text: `${name} salió del huevo.` }],
  };
}

// Partida nueva: tres huevos misteriosos (solo se ve el elemento). Te quedas con uno.
export function newGame() {
  const pool = [...ROSTER], now = Date.now();
  const offer = [0, 1, 2].map(() => pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
  return attach({
    v: 3, coins: 30, foods: { filete: 2, bayas: 2, semillas: 2 }, pets: [], eggs: [], offer, active: 0, seen: [], defeats: {},
    wins: 0, losses: 0, streak: 0, lastDaily: '', lastTick: now, lastEvent: now, lastEventId: '', pendingEvent: '',
    lastTrain: null, testMode: true, items: { pocion: 0, elixir: 0, escudo: 0, mira: 1 }, news: [], decor: [], decorPos: {}, rooms: ['sala'], room: 'sala',
  });
}

// Abre el huevo elegido. Los otros dos no te los quedas: los huevos nuevos hay que ganárselos.
export function startWith(g, index, name) {
  g.pets.push(makePet(g.offer[index], name));
  g.seen.push(g.offer[index]);
  g.offer = [];
  g.active = 0;
}

export function load() {
  try {
    const g = JSON.parse(localStorage.getItem(KEY));
    if (!(g && g.v === 3 && Array.isArray(g.pets) && g.pets.every(p => speciesOf(p.species)))) return null;
    g.defeats ||= {};                     // partidas guardadas antes de que existieran estas cosas
    g.items ||= { pocion: 1, elixir: 0, escudo: 0, mira: 1 };
    g.news = [];
    g.decor ||= []; g.decorPos ||= {}; g.rooms ||= ['sala']; g.room ||= 'sala';
    for (const p of g.pets) { p.quirk ||= pick(Object.keys(QUIRKS)); p.hue ||= 0; }
    return attach(g);
  } catch {
    return null;
  }
}
export function save(g) {
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* sin almacenamiento: se juega igual */ }
}
export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* nada que borrar */ }
}

function log(g, text) {
  g.pet.diary.unshift({ t: Date.now(), text });
  g.pet.diary.length = Math.min(g.pet.diary.length, 40);
}
function rollDay(p) {
  if (p.day !== today()) { p.day = today(); p.trainsToday = 0; p.playsToday = 0; p.strokesToday = 0; p.usesToday = 0; }
}

// El tiempo pasa para todas tus criaturas, aunque el juego esté cerrado.
// Dormida: recobra energía más rápido, se recupera del combate al doble de velocidad y gasta menos.
export function tick(g, now = Date.now()) {
  tickEggs(g, now);
  const elapsed = now - g.lastTick, h = elapsed / 3600000;
  if (h <= 0) return;
  for (const p of g.pets) {
    const slow = p.asleep ? 0.5 : 1, hungry = 5 * slow * (p.quirk === 'gloton' ? 1.3 : 1) * (has(g, 'cuenco') ? 0.9 : 1), sad = 3 * slow * cozy(g);
    const badHours = Math.max(0, h - Math.min(p.hunger / hungry, p.mood / sad));
    const starving = Math.max(0, h - p.hunger / hungry); // horas con la barriga a cero
    p.hunger = clamp(p.hunger - hungry * h);
    p.mood = clamp(p.mood - sad * h - 4 * starving);
    p.energy = g.testMode ? 100 : clamp(p.energy + (p.asleep ? 40 * (has(g, 'cama') ? 1.3 : 1) : 12) * (p.quirk === 'dormilon' ? 1.5 : 1) * h); // en modo prueba no se cansa
    if (badHours > 0) { p.bond = clamp(p.bond - badHours); p.axes.descuido += badHours * 0.4; }
    if (p.asleep) {
      if (p.restUntil > now) p.restUntil = Math.max(now, p.restUntil - elapsed); // el descanso cuenta doble
      if (now - p.sleptAt >= maxSleep(g)) {            // solo se despierta sola cuando se cansa de dormir
        p.asleep = false;
        p.mood = clamp(p.mood + 5);
        p.diary.unshift({ t: now, text: 'Se despertó descansada.' });
      }
    }
    rollDay(p);
  }
  g.lastTick = now;
  updateWish(g, now);
}

// Acostarla o despertarla. Dormida no se puede jugar, entrenar ni pelear con ella,
// y hay que dejarla dormir un mínimo antes de poder despertarla.
const minSleep = g => (g.testMode ? 60000 : MIN_SLEEP);       // en modo prueba: 60 segundos
const maxSleep = g => (g.testMode ? 180000 : MAX_SLEEP);     // en modo prueba: 3 minutos
export const sleepLeft = (g, pet = g.pet) => (pet.asleep ? Math.max(0, pet.sleptAt + minSleep(g) - Date.now()) : 0);
export function toggleSleep(g) {
  const p = g.pet, want = !p.asleep;   // se decide antes de avanzar el tiempo: al avanzar puede despertarse sola
  if (p.asleep && sleepLeft(g) > 0) return { error: `${p.name} acaba de dormirse. Déjala descansar un poco.`, asleep: true };
  tick(g);
  p.asleep = want;
  if (p.asleep) { p.sleptAt = Date.now(); grant(g, 'sleep'); }
  return { asleep: p.asleep };
}

export function claimDaily(g) {
  if (g.lastDaily === today()) return null;
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  g.streak = g.lastDaily === yesterday ? g.streak + 1 : 1;
  g.lastDaily = today();
  const coins = 10 + Math.min(g.streak, 7) * 2 + (has(g, 'cofre') ? 5 : 0);
  g.coins += coins;
  g.pet.bond = clamp(g.pet.bond + 3);
  return { coins, streak: g.streak };
}

// --- Deseos ---

const wishGap = test => (test ? 40e3 + Math.random() * 30e3 : (40 + Math.random() * 50) * 60e3);
// Se llama al avanzar el tiempo: caduca el deseo si no se cumplió y, cuando toca, le da uno nuevo que tenga sentido ahora.
function updateWish(g, now) {
  const p = g.pet;
  if (!p) return;
  if (p.wish && now > p.wish.until) { p.wish = null; p.mood = clamp(p.mood - 4); p.nextWish = now + wishGap(g.testMode); }
  if (!p.nextWish) p.nextWish = now + wishGap(g.testMode);
  if (p.wish || p.asleep || now < p.nextWish) return;
  const options = ['pet', 'play'];
  if (p.hunger < 85) options.push('food');
  if (restLeft(p) > 0 || p.energy < 50) options.push('sleep');
  if (trainsLeft(g) > 0 && p.energy >= TRAIN_ENERGY) options.push('train');
  if (!restLeft(p) && p.energy >= FIGHT_ENERGY) options.push('fight');
  p.wish = { type: pick(options), until: now + (g.testMode ? 70e3 : 15 * 60e3), got: 0 };
}
// Cumple el deseo si lo que acaba de pasar es lo que pedía (los mimos piden 5 caricias).
function grant(g, type) {
  const p = g.pet, w = p.wish;
  if (!w || w.type !== type) return false;
  if (type === 'pet' && ++w.got < 5) return false;
  p.wish = null;
  p.nextWish = Date.now() + wishGap(g.testMode);
  p.bond = clamp(p.bond + 3 + (has(g, 'peluche') ? 1 : 0)); p.mood = clamp(p.mood + 8); p.axes.carino += 1;
  log(g, `Cumpliste su deseo: ${WISHES[type].text.toLowerCase()}.`);
  news(g, `¡Deseo cumplido! Sube el vínculo con ${p.name}.`);
  track(g, { type: 'wish' });
  return true;
}

// --- Misiones y avisos ---

// Avisos para enseñar en pantalla (misión cumplida, deseo cumplido…). main.js los va sacando.
function news(g, text) { (g.news ||= []).push(text); }

// Las tres misiones de hoy, con su texto y recompensa. Se eligen al empezar el día según la criatura activa.
export function dailyMissions(g) {
  if (g.missionsDay !== today() || !g.missions) {
    const p = g.pet;
    g.missionsDay = today(); g.missionsBonus = false;
    g.missions = ['care', 'train', 'fight'].map(cat => {
      const pool = Object.keys(MISSIONS).filter(id => MISSIONS[id].cat === cat && (!MISSIONS[id].ok || MISSIONS[id].ok(p)));
      return { id: pick(pool), got: 0, done: false };
    });
  }
  return g.missions.map(m => ({ ...m, ...MISSIONS[m.id] }));
}
// Algo ha pasado: avanza las misiones que correspondan y paga las que se completen.
export function track(g, e) {
  if (!g.pet) return;
  dailyMissions(g);
  for (const m of g.missions) {
    const def = MISSIONS[m.id];
    if (m.done || !def) continue;
    m.got = Math.min(def.goal, m.got + def.on(e));
    if (m.got >= def.goal) { m.done = true; g.coins += def.coins; news(g, `Misión cumplida: ${def.text}. +${def.coins} monedas`); }
  }
  if (!g.missionsBonus && g.missions.every(m => m.done)) { g.missionsBonus = true; g.coins += MISSION_BONUS; news(g, `¡Las tres misiones de hoy! +${MISSION_BONUS} monedas extra`); }
}

// --- Objetos ---

export function buyItem(g, id) {
  const it = ITEMS[id];
  if (g.coins < it.price) return { error: 'No te alcanzan las monedas.' };
  g.coins -= it.price;
  g.items[id] = (g.items[id] || 0) + 1;
  return {};
}
export function spendItem(g, id) {
  if (!(g.items[id] > 0)) return false;
  g.items[id]--;
  return true;
}

// --- Huevos ---
// Solo se consiguen comprándolos o derrotando 10 veces a una misma especie, y nunca repetidos.

// Un huevo tarda 3 días en incubarse y hay que cuidarlo: la temperatura se va desviando y se ensucia.
// Cuanto más tiempo pasa en buenas condiciones, mejor categoría tiene la criatura al nacer.
export const EGG_DAYS = 3;
export const EGG_TEMP = { ideal: 37, ok: 2, min: 30, max: 44 };   // bien entre 35 y 39 °C
export const EGG_DIRTY = 60;                                       // a partir de aquí está sucio
export const GRADES = [                                            // de peor a mejor; min = parte del tiempo bien cuidado
  { id: 'comun', name: 'Común', min: 0, all: 0, top: 0, color: '#c9cbe6', desc: 'Sin extras.' },
  { id: 'buena', name: 'Buena', min: 0.45, all: 0, top: 2, color: '#7dff9b', desc: '+1 en sus dos mejores estadísticas.' },
  { id: 'excelente', name: 'Excelente', min: 0.75, all: 1, top: 0, color: '#7fe9ff', desc: '+1 en todas las estadísticas.' },
  { id: 'perfecta', name: 'Perfecta', min: 0.93, all: 2, top: 0, rare: true, color: '#ffd76a', desc: '+2 en todas las estadísticas y color raro.' },
];
export const gradeOf = care => [...GRADES].reverse().find(x => care >= x.min);
export const eggDay = g => (g.testMode ? 60e3 : 24 * 3600e3);      // en modo prueba un «día» dura un minuto
const newDrift = () => (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 0.8);   // °C por día
const newEgg = species => ({ species, laidAt: Date.now(), last: Date.now(), temp: EGG_TEMP.ideal, drift: newDrift(), dirt: 0, good: 0 });

export const eggReadyAt = (g, egg) => egg.laidAt + EGG_DAYS * eggDay(g);
export const eggReady = (g, egg) => Date.now() >= eggReadyAt(g, egg);

// Pasa el tiempo en la incubadora: la temperatura se desvía, se ensucia y se cuenta cuánto estuvo bien.
export function tickEggs(g, now = Date.now()) {
  const day = eggDay(g);
  for (const e of g.eggs) {
    if (e.temp === undefined) Object.assign(e, { temp: EGG_TEMP.ideal, drift: newDrift(), dirt: 0, last: now, good: Math.max(0, Math.min(now, eggReadyAt(g, e)) - e.laidAt) });  // huevo de antes: lo pasado cuenta como bien cuidado
    const until = Math.min(now, eggReadyAt(g, e)), dt = until - e.last;
    if (dt <= 0) continue;
    const d = dt / day;                                             // días transcurridos
    // Cuánto de ese rato siguió bien: hasta que la temperatura sale de su margen o la suciedad pasa del límite.
    const edge = EGG_TEMP.ideal + Math.sign(e.drift) * EGG_TEMP.ok;
    const okNow = Math.abs(e.temp - EGG_TEMP.ideal) <= EGG_TEMP.ok && e.dirt < EGG_DIRTY;
    const tTemp = (edge - e.temp) / e.drift, tDirt = (EGG_DIRTY - e.dirt) / 75;
    if (okNow) e.good += clamp(Math.min(tTemp, tDirt), 0, d) * day;
    e.temp = clamp(e.temp + e.drift * d, EGG_TEMP.min, EGG_TEMP.max);
    e.dirt = clamp(e.dirt + 75 * d);
    e.last = until;
  }
}
// Cómo va un huevo: para la pantalla.
export function eggStatus(g, egg) {
  const total = EGG_DAYS * eggDay(g), elapsed = Math.max(1, Math.min(Date.now(), eggReadyAt(g, egg)) - egg.laidAt);
  const cold = egg.temp < EGG_TEMP.ideal - EGG_TEMP.ok, hot = egg.temp > EGG_TEMP.ideal + EGG_TEMP.ok, dirty = egg.dirt >= EGG_DIRTY;
  const care = clamp((egg.good || 0) / elapsed, 0, 1), ready = eggReady(g, egg);
  return { ready, left: Math.max(0, eggReadyAt(g, egg) - Date.now()), day: Math.min(EGG_DAYS, Math.floor(elapsed / eggDay(g)) + 1), progress: elapsed / total,
    cold, hot, dirty, ok: !cold && !hot && !dirty, care, grade: gradeOf(ready ? (egg.good || 0) / total : care) };
}
// Subir o bajar la temperatura. Cada ajuste cambia hacia dónde se irá desviando después.
export function warmEgg(g, index, delta) {
  const e = g.eggs[index];
  if (!e || eggReady(g, e)) return false;
  tickEggs(g);
  e.temp = clamp(Math.round((e.temp + delta) * 10) / 10, EGG_TEMP.min, EGG_TEMP.max);
  e.drift = newDrift();
  return true;
}
export function cleanEgg(g, index, amount) {
  const e = g.eggs[index];
  if (!e || eggReady(g, e) || e.dirt <= 0) return false;
  tickEggs(g);
  e.dirt = clamp(e.dirt - amount);
  return true;
}
export const owns = (g, species) => g.pets.some(p => p.species === species) || g.eggs.some(e => e.species === species);
const hasRoom = g => g.eggs.length < MAX_EGGS && g.pets.length + g.eggs.length < MAX_PETS;
export const eggPrice = g => 100 * (g.pets.length + g.eggs.length);

// Huevo misterioso: una especie al azar que aún no tengas.
export function buyEgg(g) {
  const free = ROSTER.filter(r => !owns(g, r.id));
  if (!free.length) return { error: 'Ya tienes todas las especies.' };
  if (!hasRoom(g)) return { error: 'No te caben más huevos ni criaturas.' };
  const price = eggPrice(g);
  if (g.coins < price) return { error: `Te faltan ${price - g.coins} monedas.` };
  g.coins -= price;
  const sp = pick(free);
  g.eggs.push(newEgg(sp.id));
  return { species: sp.id };
}

export function hatchEgg(g, index, name) {
  const egg = g.eggs[index];
  if (!egg || !eggReady(g, egg)) return { error: 'Ese huevo aún no está listo.' };
  if (g.pets.length >= MAX_PETS) return { error: 'No te caben más criaturas.' };
  tickEggs(g);
  const grade = gradeOf((egg.good || 0) / (EGG_DAYS * eggDay(g)));
  g.eggs.splice(index, 1);
  g.pets.push(makePet(egg.species, name, grade.id));
  if (!g.seen.includes(egg.species)) g.seen.push(egg.species);
  return { pet: g.pets.length - 1, grade };
}

export function setActive(g, index) {
  if (!g.pets[index]) return;
  g.active = index;
  g.pendingEvent = '';
}

// Al subir de nivel: +1 según la dieta reciente y +1 en lo que mejor se le da a su especie.
export function addExp(g, amount) {
  const p = g.pet, sp = speciesOf(p.species);
  const gains = [];
  let levels = 0;
  p.exp += Math.round(amount * (p.quirk === 'listo' ? 1.1 : 1) * (has(g, 'libros') ? 1.05 : 1));
  while (p.exp >= expNeeded(p.level)) {
    p.exp -= expNeeded(p.level);
    p.level++; levels++;
    const diet = Object.fromEntries(STATS.map(k => [k, p.diet[k] || 0]));
    const fed = STATS.some(k => diet[k] > 0);
    const byDiet = fed ? argmax(diet, STATS) : pick(STATS);
    const byKind = STATS[sp.base.indexOf(Math.max(...sp.base))];
    p.stats[byDiet]++; p.stats[byKind]++;
    gains.push(byDiet, byKind);
    p.diet = { pot: 0, agu: 0, pun: 0, agi: 0 };
    log(g, `Subió al nivel ${p.level}.`);
  }
  return { levels, gains };
}

// --- Cuidados. Devuelven { error } o el resultado. ---

export function feed(g, food) {
  tick(g);
  const p = g.pet, f = FOODS[food];
  if (p.asleep) return { error: 'Zzz…' };
  if (!(g.foods[food] > 0)) return { error: `No te queda ${f.name.toLowerCase()}.` };
  if (p.hunger >= 96) return { error: 'No tengo hambre.' };
  const attentive = p.hunger < 35;
  g.foods[food]--;
  p.hunger = clamp(p.hunger + f.hunger);
  p.mood = clamp(p.mood + f.mood);
  p.energy = clamp(p.energy + f.energy);
  p.diet[f.lean] = (p.diet[f.lean] || 0) + 1;
  let reaction = '¡Ñam!', loved = false, hated = false;
  if (food === p.fav) {
    loved = true;
    p.mood = clamp(p.mood + 8); p.bond = clamp(p.bond + 1); p.axes.carino += 1;
    reaction = '¡Mi favorito!';
    if (!p.favKnown) { p.favKnown = true; log(g, `Descubriste que su comida favorita es: ${f.name.toLowerCase()}.`); }
  } else if (food === p.hate) {
    hated = true;
    p.mood = clamp(p.mood - 5);
    reaction = 'Puaj…';
    p.hateKnown = true;
  } else if (!p.favKnown && f.lean === FOODS[p.fav].lean) {
    reaction = 'Mmm… se parece a lo que me gusta';   // pista: su favorita cría lo mismo que esta
  }
  if (attentive) { p.axes.carino += 0.5; p.bond = clamp(p.bond + 0.5); }
  track(g, { type: 'feed', food, loved });
  grant(g, 'food');
  return { reaction, loved, hated, up: addExp(g, 2) };
}

export function buyFood(g, food) {
  const f = FOODS[food];
  if (g.coins < f.price) return { error: 'No te alcanzan las monedas.' };
  g.coins -= f.price;
  g.foods[food] = (g.foods[food] || 0) + 1;
  return {};
}

// Caricias: suben el ánimo siempre; el vínculo, hasta un tope diario.
export function stroke(g) {
  const p = g.pet;
  rollDay(p);
  p.mood = clamp(p.mood + 2);
  if (p.strokesToday < 15) { p.bond = clamp(p.bond + (p.quirk === 'mimoso' ? 0.8 : 0.4)); p.axes.carino += 0.2; }
  p.strokesToday++;
  track(g, { type: 'stroke' });
  grant(g, 'pet');
}

// Atrapar la pelota.
export function play(g) {
  tick(g);
  const p = g.pet;
  if (p.asleep) return { error: 'Zzz…' };
  if (p.energy < PLAY_ENERGY) return { error: 'Estoy agotado…' };
  p.energy -= PLAY_ENERGY;
  p.mood = clamp(p.mood + (p.quirk === 'jugueton' ? 28 : 18) + (has(g, 'juguetes') ? 6 : 0) + (has(g, 'torre') ? 4 : 0));
  if (p.playsToday < 5) { p.bond = clamp(p.bond + 1); p.axes.carino += 1; }
  p.playsToday++;
  track(g, { type: 'catch' });
  grant(g, 'play');
  return {};                             // jugar sube ánimo y vínculo, no experiencia
}

export function trainsLeft(g) {
  rollDay(g.pet);
  return g.testMode ? Infinity : Math.max(0, TRAINS_PER_DAY - g.pet.trainsToday);
}
export function canTrain(g) {
  tick(g);
  const p = g.pet;
  if (p.asleep) return 'Zzz…';
  if (trainsLeft(g) <= 0) return 'Ya entrené 3 veces hoy.';
  if (p.energy < trainCost(g)) return 'Estoy agotado…';
  if (p.hunger < 10) return 'Tengo demasiada hambre.';
  return '';
}
// score (0–1) es lo bien que salió el minijuego: decide si gana el punto y cuánta experiencia.
export function train(g, stat, score) {
  const p = g.pet;
  const grade = score >= 0.8 ? 'perfecto' : score >= 0.4 ? 'bien' : 'flojo';
  const wasLowest = p.stats[stat] === Math.min(...STATS.map(k => p.stats[k]));
  p.energy = clamp(p.energy - trainCost(g));
  p.hunger = clamp(p.hunger - 8);
  p.mood = clamp(p.mood - (grade === 'flojo' ? 8 : 4));
  p.trainsToday++;
  p.axes.disciplina += grade === 'flojo' ? 0.75 : 1.5;
  const gained = grade !== 'flojo';
  if (gained) { p.stats[stat]++; p.trained[stat]++; }
  g.lastTrain = { stat, grade, gained, t: Date.now() };
  track(g, { type: 'train', stat, grade, gained, wasLowest });
  grant(g, 'train');
  return { grade, gained, up: addExp(g, { perfecto: 12, bien: 8, flojo: 4 }[grade] + (has(g, 'muneco') ? 3 : 0)) };
}

// --- Carácter y evolución ---

function computeChar(a) {
  if (a.descuido >= 5 && a.descuido > a.carino) return 'resentido';
  const ranked = [['leal', a.carino], ['astuto', a.disciplina], ['feroz', a.bravura]].sort((x, y) => y[1] - x[1]);
  if (ranked[0][1] < 4 || ranked[0][1] - ranked[1][1] < 1.5) return 'sereno';
  return ranked[0][0];
}
// Hacia qué carácter va con el trato que lleva en esta etapa (null si aún es pronto para saberlo).
export function trendOf(pet) {
  if (pet.stage >= 2) return null;
  const a = pet.axes;
  return a.carino + a.disciplina + a.bravura + a.descuido < 2 ? null : computeChar(a);
}

export function evolveStatus(g) {
  const p = g.pet;
  if (p.stage >= 2) return null;
  const req = EVOLVE[p.stage];
  const okLevel = p.level >= req.level;
  const okTime = g.testMode || ageDays(p) >= req.days;
  return { ready: okLevel && okTime && !p.asleep, okLevel, okTime, req, daysLeft: Math.max(0, Math.ceil(req.days - ageDays(p))) };
}

export function evolve(g) {
  const p = g.pet;
  const prevChar = p.char;
  p.stage++;
  p.char = computeChar(p.axes);
  if (p.stage === 2) {
    const any = STATS.some(k => p.trained[k] > 0);
    p.mastery = any ? argmax(p.trained, STATS) : argmax(p.stats, STATS);
  }
  for (const k of STATS) p.stats[k]++;
  p.axes = { carino: 0, disciplina: 0, bravura: 0, descuido: 0 };
  p.bond = clamp(p.bond + 5);
  log(g, `Evolucionó a ${['', 'Teen', 'Final'][p.stage]}. Carácter: ${CHARS[p.char].name}.`);
  return { char: p.char, prevChar, mastery: p.mastery };
}

// --- Momentos de crianza ---

export function currentEvent(g) {
  if (!g.pendingEvent) {
    const wait = g.testMode ? 75e3 : 3 * 3600e3;      // además, la pantalla solo lo enseña tras un buen rato sin tocar nada
    if (Date.now() - g.lastEvent < wait) return null;
    g.pendingEvent = pick(EVENTS.filter(e => e.id !== g.lastEventId)).id;
  }
  const ev = EVENTS.find(e => e.id === g.pendingEvent);
  return { id: ev.id, text: fill(ev.text, g.pet), choices: ev.choices.map(c => c.label) };
}

export function resolveEvent(g, index) {
  const p = g.pet;
  const ev = EVENTS.find(e => e.id === g.pendingEvent);
  const choice = ev?.choices[index];
  if (!choice) return null;                            // ya se resolvió (doble toque)
  const fx = choice.fx;
  for (const k of ['carino', 'disciplina', 'bravura', 'descuido']) if (fx[k]) p.axes[k] += fx[k];
  for (const k of ['bond', 'mood', 'energy', 'hunger']) if (fx[k]) p[k] = clamp(p[k] + fx[k]);
  if (fx.coins) g.coins = Math.max(0, g.coins + fx.coins);
  g.lastEventId = ev.id; g.pendingEvent = ''; g.lastEvent = Date.now();
  const text = fill(choice.result, p);
  log(g, text);
  return { text, up: addExp(g, fx.exp || 3) };
}

// --- Combate ---

// Traduce la crianza a números de combate.
export function profile(pet) {
  const s = pet.stats;
  const condition = 0.88 + ((pet.hunger + pet.mood) / 200) * 0.22; // bien cuidado pega más
  const resentful = pet.char === 'resentido';
  return {
    maxHp: Math.round(70 + s.agu * 7 + pet.stage * 10 + (pet.quirk === 'gloton' ? 10 : 0)),
    // MP para los poderes: sube con el nivel, con cada evolución y con lo bien cuidada y unida a ti que esté.
    maxMp: Math.round(12 + pet.level * 2 + pet.stage * 4 + (pet.hunger + pet.mood) / 20 + pet.bond / 10),
    mpRegen: pet.mood > 70 ? 4 : 3,       // el MP se recupera poco: hay que elegir cuándo gastar
    dmg: 22 * (1 + s.pot * 0.04) * condition * (resentful ? 1.12 : 1),
    guide: Math.round((8 + s.pun * 2) * (pet.char === 'astuto' ? 1.6 : 1) * (pet.bond >= 50 ? 1.2 : 1)),
    fuel: 40 + s.agi * 6,
    disobey: Math.max(0, (30 - pet.bond) / 100) + (resentful ? 0.12 : 0),
    clutch: (pet.char === 'leal' && pet.bond >= 40) || pet.bond >= 80,
    regen: pet.char === 'sereno' ? 0.04 : 0,
    mastery: pet.stage === 2 ? pet.mastery : '',
  };
}

// Tras un combate hay que recuperarse: más cuanto más herida acabe, y mucho más si pierde.
export const restLeft = pet => Math.max(0, (pet.restUntil || 0) - Date.now());
export const healCost = (g, pet = g.pet) => 5 + (g.testMode ? 0 : Math.ceil(restLeft(pet) / 60000));
export function heal(g) {
  const cost = healCost(g);
  if (g.coins < cost) return { error: 'No te alcanzan las monedas.' };
  g.coins -= cost;
  g.pet.restUntil = 0;
  return {};
}

const RIVAL_NAMES = ['Tizón', 'Burbu', 'Zarza', 'Pompa', 'Chisgo', 'Liana', 'Humo', 'Charco', 'Musgo', 'Fogón', 'Rocío', 'Espina', 'Trasto', 'Nube', 'Colmillo'];

// Rival de la máquina con un poder parecido al tuyo (misma etapa, nivel cercano).
// Si se indica especie, es un reto a esa especie; si no, sale una al azar.
export function makeRival(pet, species = '') {
  const sp = species ? speciesOf(species) : pick(ROSTER.filter(r => r.id !== pet.species));
  const level = Math.max(1, pet.level + pick([-1, 0, 0, 1]));
  const stats = { pot: sp.base[0], agu: sp.base[1], pun: sp.base[2], agi: sp.base[3] };
  const mine = STATS.reduce((sum, k) => sum + pet.stats[k], 0);
  const target = Math.round(12 + (mine - 12) * (0.8 + Math.random() * 0.25) + (level - pet.level) * 2);
  for (let i = STATS.reduce((sum, k) => sum + stats[k], 0); i < target; i++) stats[pick(STATS)]++;
  return {
    species: sp.id, name: pick(RIVAL_NAMES), level, stage: pet.stage, stats, hue: rollHue(),
    hunger: 70, mood: 70, bond: 55,
    char: pet.stage >= 1 ? pick(['feroz', 'leal', 'astuto', 'sereno']) : '',
    mastery: pet.stage === 2 ? pick(STATS) : '',
  };
}

// Al ganar te quedas con su botín. A la décima victoria contra una especie que no tengas, ganas su huevo.
// hpLeft (0–1) es la vida con la que acabó tu criatura: decide cuánto tarda en recuperarse.
export function finishBattle(g, win, rival, hpLeft = 0, stats = {}) {
  const p = g.pet;
  let exp, coins = 0, stolen = 0, egg = false;
  if (!g.seen.includes(rival.species)) g.seen.push(rival.species);
  if (win) {
    exp = 24 + rival.level * 5;
    coins = Math.round((8 + rival.level * 2) * (has(g, 'trofeo') ? 1.1 : 1));
    g.coins += coins; g.wins++;
    p.mood = clamp(p.mood + 10); p.bond = clamp(p.bond + 2);
    g.defeats[rival.species] = (g.defeats[rival.species] || 0) + 1;
    if (g.defeats[rival.species] >= DEFEATS_FOR_EGG && !owns(g, rival.species) && hasRoom(g)) {
      g.eggs.push(newEgg(rival.species));
      egg = true;
    }
    log(g, `Ganó a ${rival.name}${egg ? ' y se ganó un huevo de su especie' : ' y se quedó con su botín'}.`);
  } else {
    exp = 10;
    stolen = Math.min(3, g.coins);
    g.coins -= stolen; g.losses++;
    p.mood = clamp(p.mood - 8); p.bond = clamp(p.bond + 1);
    log(g, `Perdió contra ${rival.name}.`);
  }
  const hurt = 1 - Math.max(0, Math.min(1, hpLeft));
  const minutes = win ? hurt * 10 : 15 + hurt * 20;
  const rest = minutes * (g.testMode ? 1000 : 60000) * (p.quirk === 'duro' ? 0.75 : 1);   // en modo prueba, segundos en vez de minutos
  p.restUntil = Date.now() + rest;
  p.axes.bravura += rival.level > p.level ? 2.5 : 1.5;
  p.hunger = clamp(p.hunger - 10);
  const mine = speciesOf(p.species).element, theirs = speciesOf(rival.species).element;
  track(g, { type: 'battle', win, hpLeft, dianas: stats.dianas, powerHits: stats.powerHits, disadvantage: matchup(theirs, mine) > 1 });
  grant(g, 'fight');
  return { exp, coins, stolen, egg, rest, defeats: g.defeats[rival.species] || 0, up: addExp(g, exp) };
}
