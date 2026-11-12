// Elenco de la primera generación, elementos, poderes y mapas.
// base = [Potencia, Aguante, Puntería, Agilidad] con las que nace cada especie.
// special = el poder propio de la especie (se desbloquea en la forma Final).
// Las claves de los poderes (dmg, blast, burn…) las interpreta battle.js.

export const SHEETS = [1, 2, 3, 4, 5].map(n => `assets/criaturas/hoja-${n}.png`);
export const STAGES = ['Baby', 'Teen', 'Final'];

export const ROSTER = [
  { id: 'blaziky', name: 'Blaziky', element: 'Fuego', role: 'Ataques explosivos', sheet: 1, row: 0, base: [4, 2, 3, 3],
    special: { name: 'Bomba Fénix', desc: 'Explosión enorme.', dmg: 1.3, blast: 50 } },
  { id: 'aquarok', name: 'Aquarok', element: 'Agua', role: 'Defensa y proyectiles', sheet: 1, row: 1, base: [2, 5, 3, 2],
    special: { name: 'Caracola', desc: 'Dispara y se cubre: el próximo golpe que reciba hace la mitad.', dmg: 0.9, shield: 0.5 } },
  { id: 'voltix', name: 'Voltix', element: 'Eléctrico', role: 'Velocidad y precisión', sheet: 1, row: 2, base: [3, 2, 3, 4],
    special: { name: 'Rayo', desc: 'Vuela muy rápido y el viento no lo desvía.', dmg: 1.2, noWind: true, fast: 1.35 } },
  { id: 'gravion', name: 'Gravion', element: 'Tierra', role: 'Resistencia y terreno', sheet: 0, row: 2, base: [3, 5, 2, 2],
    special: { name: 'Muralla', desc: 'Levanta un muro de roca donde cae.', dmg: 0.6, mound: 40 } },
  { id: 'zephyra', name: 'Zephyra', element: 'Viento', role: 'Manipulación del viento', sheet: 2, row: 0, base: [2, 3, 3, 4],
    special: { name: 'Vendaval', desc: 'Pone el viento a tu favor y empuja al rival.', dmg: 0.9, push: 46, gust: true } },
  { id: 'shadowon', name: 'Shadowon', element: 'Oscuridad', role: 'Sigilo y críticos', sheet: 2, row: 1, base: [4, 2, 4, 2],
    special: { name: 'Golpe Sombrío', desc: 'Mitad de probabilidad de crítico: daño doble.', dmg: 1, crit: 0.5, blast: 24 } },
  { id: 'pyrorex', name: 'Pyrorex', element: 'Fuego', role: 'Daño masivo', sheet: 2, row: 2, base: [5, 3, 2, 2],
    special: { name: 'Puño Magma', desc: 'Daño brutal en un área muy pequeña.', dmg: 1.9, blast: 20 } },
  { id: 'frostine', name: 'Frostine', element: 'Hielo', role: 'Congelación y control', sheet: 3, row: 0, base: [3, 3, 4, 2],
    special: { name: 'Ventisca', desc: 'Congela: el rival no se mueve ni apunta bien en su turno.', dmg: 0.9, freeze: true } },
  { id: 'toxipuff', name: 'Toxipuff', element: 'Veneno', role: 'Daño progresivo', sheet: 0, row: 1, base: [3, 4, 3, 2],
    special: { name: 'Nube Tóxica', desc: 'Envenena 3 turnos en un área grande.', dmg: 0.7, poison: 3, blast: 44 } },
  { id: 'mechapi', name: 'Mechapi', element: 'Metal', role: 'Tecnología y versatilidad', sheet: 0, row: 0, base: [3, 3, 3, 3],
    special: { name: 'Triple Cañón', desc: 'Tres disparos en abanico.', dmg: 0.55, count: 3, spread: 6, blast: 24 } },
  { id: 'tropicat', name: 'Tropicat', element: 'Naturaleza', role: 'Curación', sheet: 3, row: 1, base: [2, 4, 3, 3],
    special: { name: 'Semilla Vital', desc: 'Se cura con la mitad del daño que hace.', dmg: 1, drain: 0.5 } },
  { id: 'draconoid', name: 'Draconoid', element: 'Dragón', role: 'Poder destructivo', sheet: 3, row: 2, base: [5, 3, 2, 2],
    special: { name: 'Aliento Dragón', desc: 'Perfora el terreno antes de estallar.', dmg: 1.3, pierce: 70, blast: 34 } },
  { id: 'bounzy', name: 'Bounzy', element: 'Normal', role: 'Rebotes impredecibles', sheet: 4, row: 0, base: [3, 3, 2, 4],
    special: { name: 'Bola Loca', desc: 'Rebota dos veces y pega más en cada bote.', dmg: 0.85, bounce: 2 } },
  { id: 'solaris', name: 'Solaris', element: 'Luz', role: 'Soporte y protección', sheet: 4, row: 1, base: [2, 4, 4, 2],
    special: { name: 'Luz Sanadora', desc: 'Recupera mucha vida y además dispara.', dmg: 0.6, heal: 0.25 } },
  { id: 'rokky', name: 'Rokky', element: 'Eléctrico/Tierra', role: 'Absorción y contraataque', sheet: 4, row: 2, base: [3, 5, 2, 2],
    special: { name: 'Batería', desc: 'Devuelve al rival buena parte del próximo golpe que reciba.', dmg: 0.8, counter: 0.6 } },
];

export const speciesOf = id => ROSTER.find(r => r.id === id);

export const ELEMENT_COLOR = {
  Fuego: '#ff7a3d', Agua: '#4db8ff', 'Eléctrico': '#ffe14a', Tierra: '#d9a441', Viento: '#8ff0d0',
  Oscuridad: '#a06bff', Hielo: '#9fdcff', Veneno: '#9be33c', Metal: '#b9c7e8', Naturaleza: '#6fd45a',
  'Dragón': '#8d7bff', Normal: '#f1c9a0', Luz: '#ffe9a0', 'Eléctrico/Tierra': '#ffd23f',
};

// --- Ventajas entre elementos ---
// Cada elemento hace más daño (×1,3) a los de su lista y menos (×0,77) a los que lo tienen en la suya.
export const STRONG = {
  Fuego: ['Naturaleza', 'Hielo', 'Metal'],
  Agua: ['Fuego', 'Tierra'],
  'Eléctrico': ['Agua', 'Viento', 'Metal'],
  Tierra: ['Eléctrico', 'Fuego', 'Veneno'],
  Viento: ['Naturaleza', 'Veneno'],
  Oscuridad: ['Luz', 'Normal'],
  Hielo: ['Dragón', 'Viento', 'Naturaleza'],
  Veneno: ['Naturaleza', 'Agua', 'Normal'],
  Metal: ['Hielo', 'Luz', 'Dragón'],
  Naturaleza: ['Agua', 'Tierra'],
  'Dragón': ['Fuego', 'Eléctrico', 'Oscuridad'],
  Normal: [],
  Luz: ['Oscuridad', 'Dragón'],
};
const parts = element => element.split('/');           // «Eléctrico/Tierra» cuenta como los dos

export function matchup(attacker, defender) {
  let score = 0;
  for (const a of parts(attacker)) for (const d of parts(defender)) {
    if (STRONG[a].includes(d)) score++;
    if (STRONG[d].includes(a)) score--;
  }
  return score > 0 ? 1.3 : score < 0 ? 0.77 : 1;
}
export const strongAgainst = element => [...new Set(parts(element).flatMap(a => STRONG[a]))].filter(d => matchup(element, d) > 1);
export const weakAgainst = element => Object.keys(STRONG).filter(d => matchup(element, d) < 1);

// --- Poderes ---
// Cada elemento tiene tres poderes que se desbloquean con el nivel. El cuarto es el propio de la especie.
// Gastan MP y tienen enfriamiento (cd, en turnos); si el disparo falla, tardan dos turnos más en volver.
export const POWER_SLOTS = [{ level: 2, mp: 8, cd: 2 }, { level: 5, mp: 12, cd: 3 }, { level: 8, mp: 16, cd: 3 }];
const SIGNATURE = { mp: 22, cd: 4 };
const P = (name, desc, flags) => ({ name, desc, ...flags });

export const POWERS = {
  Fuego: [P('Ascuas', 'Quema al rival durante 2 turnos.', { dmg: 0.8, burn: 2 }),
    P('Llamarada', 'Explosión grande.', { dmg: 1.1, blast: 46 }),
    P('Lluvia de Fuego', 'Tres disparos que queman.', { dmg: 0.5, count: 3, spread: 7, burn: 1 })],
  Agua: [P('Burbuja', 'Te cubre: el próximo golpe hace menos daño.', { dmg: 0.7, shield: 0.4 }),
    P('Oleaje', 'Empuja al rival hacia atrás.', { dmg: 0.9, push: 50 }),
    P('Marea Sanadora', 'Recuperas vida al disparar.', { dmg: 0.6, heal: 0.18 })],
  'Eléctrico': [P('Chispa', 'Rápido y sin desvío por el viento.', { dmg: 0.9, noWind: true, fast: 1.3 }),
    P('Descarga', 'Le quita 10 MP al rival.', { dmg: 0.9, shock: 10 }),
    P('Tormenta', 'Dos rayos que ignoran el viento y quitan MP.', { dmg: 0.7, count: 2, spread: 5, noWind: true, shock: 6 })],
  Tierra: [P('Pedrusco', 'Golpe fuerte en poca área.', { dmg: 1.2, blast: 24 }),
    P('Muro', 'Levanta un muro de roca donde cae.', { dmg: 0.5, mound: 36 }),
    P('Terremoto', 'Área enorme: el rival no podrá moverse.', { dmg: 0.9, blast: 58, root: true })],
  Viento: [P('Brisa', 'Pone el viento a tu favor.', { dmg: 0.8, gust: true }),
    P('Empujón', 'Lanza al rival hacia atrás.', { dmg: 0.8, push: 55 }),
    P('Tornado', 'Área grande que arrastra al rival.', { dmg: 1, blast: 44, push: 40 })],
  Oscuridad: [P('Sombra', 'Ciega al rival: apuntará peor.', { dmg: 0.8, blind: true }),
    P('Acecho', 'Buena probabilidad de crítico.', { dmg: 1, crit: 0.4 }),
    P('Eclipse', 'Ciega y te cura con el daño.', { dmg: 1, blind: true, drain: 0.5 })],
  Hielo: [P('Escarcha', 'El rival no podrá moverse.', { dmg: 0.8, root: true }),
    P('Granizo', 'Tres disparos en abanico.', { dmg: 0.45, count: 3, spread: 6 }),
    P('Glaciar', 'Congela: ni se mueve ni apunta bien.', { dmg: 0.9, freeze: true })],
  Veneno: [P('Esporas', 'Envenena 2 turnos.', { dmg: 0.6, poison: 2 }),
    P('Ácido', 'Corroe: sus 2 próximos golpes recibidos duelen más.', { dmg: 0.8, expose: 2 }),
    P('Miasma', 'Envenena 3 turnos en un área grande.', { dmg: 0.7, poison: 3, blast: 44 })],
  Metal: [P('Perdigón', 'Disparo muy rápido.', { dmg: 1, fast: 1.3 }),
    P('Blindaje', 'Te cubre: el próximo golpe hace la mitad.', { dmg: 0.6, shield: 0.5 }),
    P('Taladro', 'Perfora el terreno antes de estallar.', { dmg: 1.15, pierce: 60 })],
  Naturaleza: [P('Semilla', 'Te cura con parte del daño.', { dmg: 0.8, drain: 0.4 }),
    P('Raíces', 'El rival no podrá moverse.', { dmg: 0.8, root: true }),
    P('Floración', 'Recuperas vida al disparar.', { dmg: 0.6, heal: 0.2 })],
  'Dragón': [P('Colmillo', 'Golpe fuerte en poca área.', { dmg: 1.3, blast: 22 }),
    P('Rugido', 'Intimida: sus 2 próximos golpes recibidos duelen más.', { dmg: 0.7, expose: 2 }),
    P('Cometa', 'El golpe más fuerte de todos.', { dmg: 1.5, blast: 40 })],
  Normal: [P('Rebote', 'Rebota una vez en el suelo.', { dmg: 0.9, bounce: 1 }),
    P('Doble', 'Dos disparos seguidos.', { dmg: 0.6, count: 2, spread: 4 }),
    P('Golpe Limpio', 'Probabilidad de crítico.', { dmg: 1.1, crit: 0.35 })],
  Luz: [P('Destello', 'Ciega al rival: apuntará peor.', { dmg: 0.8, blind: true }),
    P('Bendición', 'Recuperas vida al disparar.', { dmg: 0.5, heal: 0.2 }),
    P('Rayo Solar', 'Rápido, fuerte y sin desvío por el viento.', { dmg: 1.2, noWind: true, fast: 1.4 })],
  'Eléctrico/Tierra': [P('Chispa Roca', 'Golpea y le quita 6 MP al rival.', { dmg: 1.1, shock: 6 }),
    P('Pararrayos', 'Devuelve parte del próximo golpe que recibas.', { dmg: 0.6, counter: 0.5 }),
    P('Sismo Eléctrico', 'Área enorme que quita MP.', { dmg: 0.9, blast: 52, shock: 8 })],
};

// Los cuatro poderes de una criatura, con lo que cuestan y si ya los tiene.
export function powersOf(sp, pet) {
  const kit = POWERS[sp.element].map((p, i) => ({ ...p, ...POWER_SLOTS[i], unlocked: pet.level >= POWER_SLOTS[i].level, need: `Nivel ${POWER_SLOTS[i].level}` }));
  kit.push({ ...sp.special, ...SIGNATURE, signature: true, unlocked: pet.stage >= 2, need: 'Forma Final' });
  return kit;
}

// --- Mapas ---
// terrain: colores del suelo, de la roca del fondo al borde iluminado.
// hazards: lo que hay en el aire y cambia los disparos (lo interpreta battle.js).
export const MAPS = [
  { id: 'castillo', name: 'Islas del Castillo', bg: 'assets/mapas/castillo.png', terrain: ['#2a1f3d', '#4a3558', '#3f8a35', '#74c043', '#b6e36a'], duel: ['mechapi', 'shadowon'],
    hazards: { rocks: 2, birds: 3 }, effect: 'Rocas flotantes que bloquean disparos y pájaros que se cruzan.' },
  { id: 'volcan', name: 'Forja Volcánica', bg: 'assets/mapas/volcan.png', terrain: ['#1c1114', '#3a1d1c', '#8a2a16', '#e2531e', '#ffb347'], duel: ['pyrorex', 'aquarok'],
    hazards: { thermals: 2, rocks: 1 }, effect: 'Columnas de aire caliente que elevan los disparos.' },
  { id: 'aurora', name: 'Tundra de la Aurora', bg: 'assets/mapas/aurora.png', terrain: ['#16233f', '#2c4470', '#7fa9dc', '#cfe6ff', '#ffffff'], duel: ['frostine', 'rokky'],
    hazards: { gusty: true, snow: true, rocks: 2 }, effect: 'Ventisca: el viento cambia a ráfagas en pleno vuelo.' },
];

// Orden de los huevos en assets/ui/huevos.png (de izquierda a derecha y de arriba abajo).
export const EGG_ORDER = ['Fuego', 'Agua', 'Eléctrico', 'Tierra', 'Viento', 'Oscuridad', 'Hielo', 'Veneno', 'Metal', 'Naturaleza', 'Dragón', 'Normal', 'Luz', 'Eléctrico/Tierra'];
// Orden de los objetos en assets/ui/objetos.png.
export const ICON_ORDER = ['filete', 'bayas', 'semillas', 'pelota', 'moneda', 'corazon', 'espadas', 'pesa', 'diana', 'roca', 'rayo', 'escudo', 'estrella', 'libro', 'engranaje', 'casa'];
