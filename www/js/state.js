// Reglas de crianza y partida guardada. Aquí no se dibuja nada.

import { ROSTER, speciesOf } from './roster.js';
import { EVENTS } from './events.js';

// Partida guardada. Con ?slot=nombre en la dirección se usa una partida aparte (útil para probar sin tocar la tuya).
const slot = new URLSearchParams(globalThis.location?.search || '').get('slot');
const KEY = 'petbound-save-v3' + (slot ? '-' + slot.replace(/[^a-z0-9]/gi, '') : '');
const STATS = ['pot', 'agu', 'pun', 'agi'];

export const STAT_NAMES = { pot: 'Potencia', agu: 'Aguante', pun: 'Puntería', agi: 'Agilidad' };
export const STAT_HELP = { pot: 'más daño', agu: 'más vida', pun: 'guía de tiro más larga', agi: 'se mueve más por turno' };

// Lo que come decide qué sube al ganar nivel.
export const FOODS = {
  filete: { name: 'Filete', desc: 'Llena mucho. Cría músculo: Potencia.', hunger: 35, mood: 0, energy: 0, lean: 'pot', price: 6 },
  bayas: { name: 'Bayas', desc: 'Dulces y sanas. Cría cuerpo: Aguante.', hunger: 24, mood: 6, energy: 0, lean: 'agu', price: 4 },
  semillas: { name: 'Semillas', desc: 'Ligeras, dan energía. Cría patas: Agilidad.', hunger: 16, mood: 0, energy: 14, lean: 'agi', price: 4 },
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

// Requisitos para evolucionar: nivel y días de vida. [Baby→Teen, Teen→Final]
export const EVOLVE = [{ level: 4, days: 3 }, { level: 10, days: 14 }];

export const FIGHT_ENERGY = 20, TRAIN_ENERGY = 25, PLAY_ENERGY = 6, TRAINS_PER_DAY = 3, MAX_EGGS = 3, MAX_PETS = 6;
export const DEFEATS_FOR_EGG = 10;
export const MIN_SLEEP = 5 * 60000;     // una vez dormida, no se la puede despertar antes de este tiempo      // victorias contra una misma especie para ganar su huevo

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

function makePet(species, name) {
  const now = Date.now(), sp = speciesOf(species), foods = Object.keys(FOODS), fav = pick(foods);
  return {
    species, name, born: now, level: 1, exp: 0, stage: 0,
    stats: { pot: sp.base[0], agu: sp.base[1], pun: sp.base[2], agi: sp.base[3] },
    hunger: 70, energy: 100, mood: 75, bond: 20,
    char: '', mastery: '', fav, hate: pick(foods.filter(f => f !== fav)), favKnown: false, hateKnown: false,
    axes: { carino: 0, disciplina: 0, bravura: 0, descuido: 0 },
    diet: { pot: 0, agu: 0, agi: 0 }, trained: { pot: 0, agu: 0, pun: 0, agi: 0 },
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
    lastTrain: null, testMode: true,
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
    g.defeats ||= {};                     // partidas guardadas antes de que existiera el contador
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
  if (p.day !== today()) { p.day = today(); p.trainsToday = 0; p.playsToday = 0; p.strokesToday = 0; }
}

// El tiempo pasa para todas tus criaturas, aunque el juego esté cerrado.
// Dormida: recobra energía más rápido, se recupera del combate al doble de velocidad y gasta menos.
export function tick(g, now = Date.now()) {
  const elapsed = now - g.lastTick, h = elapsed / 3600000;
  if (h <= 0) return;
  for (const p of g.pets) {
    const slow = p.asleep ? 0.5 : 1;
    const badHours = Math.max(0, h - Math.min(p.hunger / (5 * slow), p.mood / (3 * slow)));
    const starving = Math.max(0, h - p.hunger / (5 * slow)); // horas con la barriga a cero
    p.hunger = clamp(p.hunger - 5 * slow * h);
    p.mood = clamp(p.mood - 3 * slow * h - 4 * starving);
    p.energy = g.testMode ? 100 : clamp(p.energy + (p.asleep ? 40 : 12) * h); // en modo prueba no se cansa
    if (badHours > 0) { p.bond = clamp(p.bond - badHours); p.axes.descuido += badHours * 0.4; }
    if (p.asleep) {
      if (p.restUntil > now) p.restUntil = Math.max(now, p.restUntil - elapsed); // el descanso cuenta doble
      if (restLeft(p) === 0 && p.energy >= 100 && now - p.sleptAt >= minSleep(g)) { // se despierta sola al estar lista
        p.asleep = false;
        p.mood = clamp(p.mood + 5);
        p.diary.unshift({ t: now, text: 'Se despertó descansada.' });
      }
    }
    rollDay(p);
  }
  g.lastTick = now;
}

// Acostarla o despertarla. Dormida no se puede jugar, entrenar ni pelear con ella,
// y hay que dejarla dormir un mínimo antes de poder despertarla.
const minSleep = g => (g.testMode ? 15000 : MIN_SLEEP);
export const sleepLeft = (g, pet = g.pet) => (pet.asleep ? Math.max(0, pet.sleptAt + minSleep(g) - Date.now()) : 0);
export function toggleSleep(g) {
  const p = g.pet, want = !p.asleep;   // se decide antes de avanzar el tiempo: al avanzar puede despertarse sola
  if (p.asleep && sleepLeft(g) > 0) return { error: `${p.name} acaba de dormirse. Déjala descansar un poco.`, asleep: true };
  tick(g);
  p.asleep = want;
  if (p.asleep) p.sleptAt = Date.now();
  return { asleep: p.asleep };
}

export function claimDaily(g) {
  if (g.lastDaily === today()) return null;
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  g.streak = g.lastDaily === yesterday ? g.streak + 1 : 1;
  g.lastDaily = today();
  const coins = 10 + Math.min(g.streak, 7) * 2;
  g.coins += coins;
  g.pet.bond = clamp(g.pet.bond + 3);
  return { coins, streak: g.streak };
}

// --- Huevos ---
// Solo se consiguen comprándolos o derrotando 10 veces a una misma especie, y nunca repetidos.

export const eggReadyAt = (g, egg) => egg.laidAt + (g.testMode ? Math.min(egg.hours * 20e3, 90e3) : egg.hours * 3600e3);
export const eggReady = (g, egg) => Date.now() >= eggReadyAt(g, egg);
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
  g.eggs.push({ species: sp.id, laidAt: Date.now(), hours: 6 });
  return { species: sp.id };
}

export function hatchEgg(g, index, name) {
  const egg = g.eggs[index];
  if (!egg || !eggReady(g, egg)) return { error: 'Ese huevo aún no está listo.' };
  if (g.pets.length >= MAX_PETS) return { error: 'No te caben más criaturas.' };
  g.eggs.splice(index, 1);
  g.pets.push(makePet(egg.species, name));
  if (!g.seen.includes(egg.species)) g.seen.push(egg.species);
  return { pet: g.pets.length - 1 };
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
  p.exp += amount;
  while (p.exp >= expNeeded(p.level)) {
    p.exp -= expNeeded(p.level);
    p.level++; levels++;
    const dietKeys = ['pot', 'agu', 'agi'];
    const fed = dietKeys.some(k => p.diet[k] > 0);
    const byDiet = fed ? argmax(p.diet, dietKeys) : pick(dietKeys);
    const byKind = STATS[sp.base.indexOf(Math.max(...sp.base))];
    p.stats[byDiet]++; p.stats[byKind]++;
    gains.push(byDiet, byKind);
    p.diet = { pot: 0, agu: 0, agi: 0 };
    log(g, `Subió al nivel ${p.level}.`);
  }
  return { levels, gains };
}

// --- Cuidados. Devuelven { error } o el resultado. ---

export function feed(g, food) {
  tick(g);
  const p = g.pet, f = FOODS[food];
  if (p.asleep) return { error: 'Zzz…' };
  if (g.foods[food] <= 0) return { error: `No te queda ${f.name.toLowerCase()}.` };
  if (p.hunger >= 96) return { error: 'No tengo hambre.' };
  const attentive = p.hunger < 35;
  g.foods[food]--;
  p.hunger = clamp(p.hunger + f.hunger);
  p.mood = clamp(p.mood + f.mood);
  p.energy = clamp(p.energy + f.energy);
  p.diet[f.lean]++;
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
  }
  if (attentive) { p.axes.carino += 0.5; p.bond = clamp(p.bond + 0.5); }
  return { reaction, loved, hated, up: addExp(g, 2) };
}

export function buyFood(g, food) {
  const f = FOODS[food];
  if (g.coins < f.price) return { error: 'No te alcanzan las monedas.' };
  g.coins -= f.price;
  g.foods[food]++;
  return {};
}

// Caricias: suben el ánimo siempre; el vínculo, hasta un tope diario.
export function stroke(g) {
  const p = g.pet;
  rollDay(p);
  p.mood = clamp(p.mood + 2);
  if (p.strokesToday < 15) { p.bond = clamp(p.bond + 0.4); p.axes.carino += 0.2; }
  p.strokesToday++;
}

// Atrapar la pelota.
export function play(g) {
  tick(g);
  const p = g.pet;
  if (p.asleep) return { error: 'Zzz…' };
  if (p.energy < PLAY_ENERGY) return { error: 'Estoy agotado…' };
  p.energy -= PLAY_ENERGY;
  p.mood = clamp(p.mood + 18);
  if (p.playsToday < 5) { p.bond = clamp(p.bond + 1); p.axes.carino += 1; }
  p.playsToday++;
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
  if (p.energy < TRAIN_ENERGY) return 'Estoy agotado…';
  if (p.hunger < 10) return 'Tengo demasiada hambre.';
  return '';
}
// score (0–1) es lo bien que salió el minijuego: decide si gana el punto y cuánta experiencia.
export function train(g, stat, score) {
  const p = g.pet;
  const grade = score >= 0.8 ? 'perfecto' : score >= 0.4 ? 'bien' : 'flojo';
  p.energy = clamp(p.energy - TRAIN_ENERGY);
  p.hunger = clamp(p.hunger - 8);
  p.mood = clamp(p.mood - (grade === 'flojo' ? 8 : 4));
  p.trainsToday++;
  p.axes.disciplina += grade === 'flojo' ? 0.75 : 1.5;
  const gained = grade !== 'flojo';
  if (gained) { p.stats[stat]++; p.trained[stat]++; }
  g.lastTrain = { stat, grade, gained, t: Date.now() };
  return { grade, gained, up: addExp(g, { perfecto: 12, bien: 8, flojo: 4 }[grade]) };
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
    const wait = g.testMode ? 75e3 : 8 * 3600e3;
    if (Date.now() - g.lastEvent < wait) return null;
    g.pendingEvent = pick(EVENTS.filter(e => e.id !== g.lastEventId)).id;
  }
  const ev = EVENTS.find(e => e.id === g.pendingEvent);
  return { id: ev.id, text: fill(ev.text, g.pet), choices: ev.choices.map(c => c.label) };
}

export function resolveEvent(g, index) {
  const p = g.pet;
  const ev = EVENTS.find(e => e.id === g.pendingEvent);
  const choice = ev.choices[index];
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
    maxHp: Math.round(70 + s.agu * 7 + pet.stage * 10),
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
    species: sp.id, name: pick(RIVAL_NAMES), level, stage: pet.stage, stats,
    hunger: 70, mood: 70, bond: 55,
    char: pet.stage >= 1 ? pick(['feroz', 'leal', 'astuto', 'sereno']) : '',
    mastery: pet.stage === 2 ? pick(STATS) : '',
  };
}

// Al ganar te quedas con su botín. A la décima victoria contra una especie que no tengas, ganas su huevo.
// hpLeft (0–1) es la vida con la que acabó tu criatura: decide cuánto tarda en recuperarse.
export function finishBattle(g, win, rival, hpLeft = 0) {
  const p = g.pet;
  let exp, coins = 0, stolen = 0, egg = false;
  if (!g.seen.includes(rival.species)) g.seen.push(rival.species);
  if (win) {
    exp = 24 + rival.level * 5;
    coins = 8 + rival.level * 2;
    g.coins += coins; g.wins++;
    p.mood = clamp(p.mood + 10); p.bond = clamp(p.bond + 2);
    g.defeats[rival.species] = (g.defeats[rival.species] || 0) + 1;
    if (g.defeats[rival.species] >= DEFEATS_FOR_EGG && !owns(g, rival.species) && hasRoom(g)) {
      g.eggs.push({ species: rival.species, laidAt: Date.now(), hours: 6 });
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
  const rest = minutes * (g.testMode ? 1000 : 60000);   // en modo prueba, segundos en vez de minutos
  p.restUntil = Date.now() + rest;
  p.axes.bravura += rival.level > p.level ? 2.5 : 1.5;
  p.hunger = clamp(p.hunger - 10);
  return { exp, coins, stolen, egg, rest, defeats: g.defeats[rival.species] || 0, up: addExp(g, exp) };
}
