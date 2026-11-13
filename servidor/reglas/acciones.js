// COPIA: este archivo se genera desde www/js con «node sync-reglas.mjs». No lo edites aquí.
// Las acciones de la partida. Todo lo que cambia una partida pasa por aquí, en el juego y en el servidor.
//
// El juego aplica cada acción al momento (para responder sin esperas) y la apunta. El servidor repite las mismas
// acciones con estas mismas reglas y con su propio reloj, y la partida que vale es la suya: lo que el navegador
// tenga en memoria no cuenta. Por eso aquí se comprueba todo lo que antes solo comprobaba la pantalla.
//
// Aún se fía de la jugadora en lo que depende de su habilidad: la nota de un entrenamiento y quién gana un combate
// (acotado: hay que haberlo empezado, cuesta energía y no puede durar menos de lo que dura uno de verdad).
import * as S from './state.js';
import * as A from './aventura.js';
import { ROSTER } from './roster.js';

// Algo que el juego nunca pediría (un dato imposible, un paso que no toca). El servidor corta ahí y manda su partida.
export class Reject extends Error {}
const need = (ok, why = 'no vale') => { if (!ok) throw new Reject(why); };
const str = (v, max = 24) => typeof v === 'string' && v.length > 0 && v.length <= max;
const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
const own = (table, id) => str(id) && Object.hasOwn(table, id);
const goodName = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 12;

export const MIN_FIGHT = 8000;      // un combate ganado no dura menos que esto
export const MIN_TRAIN = 3000;      // ni un entrenamiento
export const MIN_RACE = 6000;       // ni una carrera ganada
const STATS = Object.keys(S.STAT_NAMES);
const GUIDE_AFTER = { stroke: 'stroke', feed: 'feed', play: 'play', train: 'train', battle: 'fightEnd' };   // qué acción da por hecho cada paso de la guía

const pet = g => { need(g.pet, 'sin bestia'); return g.pet; };
// Algo de la zona en la que está la expedición, por su identificador.
function here(g, id, ...types) {
  const poi = g.adv && str(id) ? A.zoneOf(g)?.pois.find(p => p.id === id) : null;
  need(poi && types.includes(poi.type), 'no está aquí');
  return poi;
}

export const ACTIONS = {
  // --- el tiempo ---
  tick: () => null,                                   // solo deja pasar el tiempo (lo hace `apply` antes de cada acción)
  // La zona horaria decide cuándo empieza el día. Se puede cambiar como mucho una vez al mes.
  tz(g, minutes) {
    need(int(minutes, -720, 840));
    if (g.tz === minutes) return true;
    if (g.tzAt && S.at() - g.tzAt < 30 * 864e5) return false;
    g.tz = minutes; g.tzAt = S.at();
    return true;
  },

  // --- empezar ---
  start(g, index, name) {                             // abre el huevo elegido (lo sortea el servidor)
    need(!g.pets.length && int(index, 0, g.offer.length - 1) && goodName(name));
    S.startWith(g, index, name.trim());
  },
  daily: g => { pet(g); return S.claimDaily(g); },
  guide(g, kind) { need(own(GUIDE_AFTER, kind)); return g.last === GUIDE_AFTER[kind] ? S.guideAdvance(g, kind) : null; },
  guideSkip: g => S.guideSkip(g),

  // --- cuidados ---
  feed(g, food) { pet(g); need(own(S.FOODS, food)); return S.feed(g, food); },
  stroke: g => { pet(g); S.stroke(g); },
  play: g => { pet(g); return S.play(g); },
  sleep(g, want) {                                    // want: acostarla (true) o despertarla (false); si ya está así, no hace nada
    const p = pet(g);
    need(typeof want === 'boolean');
    return !!p.asleep === want ? { asleep: want } : S.toggleSleep(g);
  },
  active(g, index) {                                  // cambiar de bestia deja a medias lo que hubiera empezado la otra
    need(int(index, 0, S.MAX_PETS - 1) && g.pets[index]);
    delete g.fight; delete g.foe; delete g.training;
    S.setActive(g, index);
  },
  trainStart(g, stat) {
    pet(g); need(STATS.includes(stat));
    const error = S.canTrain(g);
    if (error) return { error };
    g.training = { stat, t: S.at() };
    return {};
  },
  train(g, score) {
    pet(g); need(num(score, 0, 1) && g.training && S.at() - g.training.t >= MIN_TRAIN);
    const { stat } = g.training;
    delete g.training;
    return S.train(g, stat, score);
  },
  evolve(g) { pet(g); need(S.evolveStatus(g)?.ready); return S.evolve(g); },
  event: g => { pet(g); return S.rollEvent(g); },
  eventPick(g, index) { pet(g); need(int(index, 0, 5)); return S.resolveEvent(g, index); },
  heal: g => { pet(g); return S.heal(g); },

  // --- huevos ---
  buyEgg: g => { pet(g); return S.buyEgg(g); },         // qué especie toca lo sortea el servidor
  hatch(g, index, name) {                             // y también cómo nace
    pet(g); need(int(index, 0, S.MAX_EGGS - 1) && goodName(name));
    const res = S.hatchEgg(g, index, name.trim());
    if (!res.error) S.setActive(g, res.pet);
    return res;
  },
  warm(g, index, delta) { need(int(index, 0, S.MAX_EGGS - 1) && (delta === 0.5 || delta === -0.5)); return S.warmEgg(g, index, delta); },
  clean(g, index, amount) { need(int(index, 0, S.MAX_EGGS - 1) && num(amount, 0, 1000)); return S.cleanEgg(g, index, Math.min(40, amount)); },

  // --- tienda y sala ---
  buyFood(g, id) { need(own(S.FOODS, id)); return S.buyFood(g, id); },
  buyItem(g, id) { need(own(S.ITEMS, id)); return S.buyItem(g, id); },
  buyDecor(g, id) { need(own(S.DECOR, id)); return S.buyDecor(g, id); },
  buyRoom(g, id) { need(own(S.ROOMS, id)); return S.buyRoom(g, id); },
  setRoom(g, id) { need(own(S.ROOMS, id)); S.setRoom(g, id); },
  moveDecor(g, id, x, y) { need(own(S.DECOR, id) && g.decor.includes(id) && num(x, -9999, 9999) && num(y, -9999, 9999)); S.moveDecor(g, id, x, y); },
  useDecor(g, id) { pet(g); need(own(S.DECOR, id)); return S.useDecor(g, id); },

  // --- combate ---
  // El rival se elige antes de aceptar el combate (se puede decir que no); la energía se gasta al empezarlo.
  foe(g, species) {
    pet(g); need(species === '' || ROSTER.some(r => r.id === species));
    g.foe = S.makeRival(g, species);
    return g.foe;
  },
  fight(g, id = '') {                                  // id: la bestia salvaje o el jefe de la expedición contra quien se lucha
    const p = pet(g);
    need(!p.asleep && p.energy >= S.FIGHT_ENERGY, 'no puede luchar');
    let rival, poi = null;
    if (id) { poi = here(g, id, 'wild', 'boss'); need(A.active(g, poi)); rival = A.makeWild(poi); }
    else { need(g.foe && !S.restLeft(p)); rival = g.foe; }
    delete g.foe;
    p.energy -= S.FIGHT_ENERGY;
    g.fight = { rival, t: S.at(), ...(poi ? { poi: poi.id } : {}) };
    return rival;
  },
  useItem(g, id) { need(g.fight && own(S.ITEMS, id)); return S.spendItem(g, id); },
  fightEnd(g, win, hpLeft, dianas, powerHits, mp) {
    const f = g.fight;
    need(f && g.pet && typeof win === 'boolean' && num(hpLeft, 0, 1) && int(dianas, 0, 99) && int(powerHits, 0, 99) && num(mp, 0, 999));
    need(!win || S.at() - f.t >= MIN_FIGHT, 'combate demasiado corto');
    delete g.fight;
    const r = S.finishBattle(g, win, f.rival, hpLeft, { dianas, powerHits });
    let adv = null;                                    // si era de la expedición: cómo sigue
    const poi = f.poi && g.adv ? A.zoneOf(g)?.pois.find(p => p.id === f.poi) : null;
    if (poi) {
      adv = A.afterBattle(g, poi, win, hpLeft, mp);
      if (win) { g.pet.restUntil = 0; r.rest = 0; }    // ganar malherida no te para: la vida ya se arrastra
    }
    return { r, adv };
  },

  // --- aventura ---
  advStart(g, region) {
    const p = pet(g);
    need(own(A.REGIONS, region) && !p.asleep);
    if (g.adv) need(g.adv.region === region); else need(A.open(g, region) && !S.restLeft(p));
    A.start(g, region);
  },
  advLeave: g => A.leave(g),
  advMove(g, x, y) { need(g.adv && num(x, 0, 1536) && num(y, 0, 864)); g.adv.x = Math.round(x); g.adv.y = Math.round(y); },
  advTravel(g, id) { const poi = here(g, id, 'gate'); need(poi.to); A.travel(g, poi); },
  advChest: (g, id) => A.openChest(g, here(g, id, 'chest')),
  advPick: (g, id) => A.pick(g, here(g, id, 'food', 'coin')),
  advCoal: (g, id) => A.takeCoal(g, here(g, id, 'coal', 'cub')),
  advSeal: (g, id) => A.takeSeal(g, here(g, id, 'seal')),
  advClue: (g, id) => { here(g, id, 'clue'); A.readClue(g); },
  advPress: (g, id) => A.press(g, here(g, id, 'switch')),
  advTalk(g, id) {
    const poi = here(g, id, 'npc'), said = A.talk(g, poi);
    if (said.race) g.adv.raceAt = S.at();
    return said;
  },
  advRace(g, id, win) {
    const poi = here(g, id, 'npc');
    need(poi.role === 'racer' && typeof win === 'boolean' && g.adv.raceAt && (!win || S.at() - g.adv.raceAt >= MIN_RACE));
    delete g.adv.raceAt;
    return A.raceDone(g, poi, win);
  },
  advDoor: (g, id) => { here(g, id, 'door'); return A.openDoor(g); },
  advRest: (g, id) => A.rest(g, here(g, id, 'rest')),
  advResolve(g, id, index) { need(int(index, 0, 5)); return A.resolve(g, here(g, id, 'event'), index, S.profile(pet(g)).maxMp); },
};

// Lo que sortea solo el servidor: en la nube el juego no lo aplica por su cuenta, espera la respuesta.
export const SERVER = new Set(['start', 'buyEgg', 'hatch']);

// Aplica una acción a la partida a la hora `t`. Antes deja pasar el tiempo hasta esa hora.
// `secure` es el azar del servidor para lo que sortea solo él. Lanza Reject si la acción no vale.
export function apply(g, kind, args, t, secure = null) {
  need(typeof kind === 'string' && Object.hasOwn(ACTIONS, kind) && Array.isArray(args) && args.length <= 6, 'acción desconocida');
  S.clock.now = t; S.clock.random = SERVER.has(kind) ? secure : null;
  try {
    if (g.pets.length && kind !== 'tz') { S.tick(g, t); S.rollMissions(g); }
    const out = ACTIONS[kind](g, ...args);
    g.clock = t;
    if (kind !== 'tick' && kind !== 'guide' && !(out && out.error)) g.last = kind;
    return out;
  } finally { S.clock.now = null; S.clock.random = null; }
}

// Partida nueva (en la nube la crea el servidor, con su azar).
export function create(t, secure = null) {
  S.clock.now = t; S.clock.random = secure;
  try { return S.newGame(); } finally { S.clock.now = null; S.clock.random = null; }
}

// Lo que un simple paso del tiempo puede cambiar de golpe (un deseo nuevo, despertarse, un día nuevo, las misiones).
// Si esto cambia al dejar pasar el tiempo, ese momento se apunta para que el servidor lo repita a la misma hora.
export const pulse = g => JSON.stringify([g.missionsDay, g.pets.map(p => [!!p.asleep, p.day, p.wish?.type, p.wish?.until, p.nextWish])]);
