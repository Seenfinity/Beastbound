// Elenco de la primera generación y mapas.
// base = [Potencia, Aguante, Puntería, Agilidad] con las que nace cada especie.
// special = su disparo propio (se desbloquea en Teen). Las claves las interpreta battle.js.

export const SHEETS = [1, 2, 3, 4, 5].map(n => `assets/criaturas/hoja-${n}.png`);
export const STAGES = ['Baby', 'Teen', 'Final'];

export const ROSTER = [
  { id: 'blaziky', name: 'Blaziky', element: 'Fuego', role: 'Ataques explosivos', sheet: 1, row: 0, base: [4, 2, 3, 3],
    special: { name: 'Bomba Fénix', desc: 'Explosión enorme.', dmg: 1.3, blast: 50 } },
  { id: 'aquarok', name: 'Aquarok', element: 'Agua', role: 'Defensa y proyectiles', sheet: 1, row: 1, base: [2, 5, 3, 2],
    special: { name: 'Caracola', desc: 'Dispara y se cubre: el próximo golpe que reciba hace la mitad.', dmg: 0.9, shield: 0.5 } },
  { id: 'voltix', name: 'Voltix', element: 'Eléctrico', role: 'Velocidad y precisión', sheet: 1, row: 2, base: [3, 2, 3, 4],
    special: { name: 'Rayo', desc: 'Vuela muy rápido y el viento no lo desvía.', dmg: 1.1, noWind: true, fast: 1.35 } },
  { id: 'gravion', name: 'Gravion', element: 'Tierra', role: 'Resistencia y terreno', sheet: 0, row: 2, base: [3, 5, 2, 2],
    special: { name: 'Muralla', desc: 'Levanta un muro de roca donde cae.', dmg: 0.6, mound: 40 } },
  { id: 'zephyra', name: 'Zephyra', element: 'Viento', role: 'Manipulación del viento', sheet: 2, row: 0, base: [2, 3, 3, 4],
    special: { name: 'Vendaval', desc: 'Pone el viento a tu favor y empuja al rival.', dmg: 0.8, push: 46, gust: true } },
  { id: 'shadowon', name: 'Shadowon', element: 'Oscuridad', role: 'Sigilo y críticos', sheet: 2, row: 1, base: [4, 2, 4, 2],
    special: { name: 'Golpe Sombrío', desc: 'Mitad de probabilidad de crítico: daño doble.', dmg: 1, crit: 0.5, blast: 24 } },
  { id: 'pyrorex', name: 'Pyrorex', element: 'Fuego', role: 'Daño masivo', sheet: 2, row: 2, base: [5, 3, 2, 2],
    special: { name: 'Puño Magma', desc: 'Daño brutal en un área muy pequeña.', dmg: 1.9, blast: 20 } },
  { id: 'frostine', name: 'Frostine', element: 'Hielo', role: 'Congelación y control', sheet: 3, row: 0, base: [3, 3, 4, 2],
    special: { name: 'Ventisca', desc: 'Congela: el rival no se mueve ni apunta bien en su turno.', dmg: 0.8, freeze: true } },
  { id: 'toxipuff', name: 'Toxipuff', element: 'Veneno', role: 'Daño progresivo', sheet: 0, row: 1, base: [3, 4, 3, 2],
    special: { name: 'Nube Tóxica', desc: 'Envenena durante 3 turnos.', dmg: 0.6, poison: 3, blast: 40 } },
  { id: 'mechapi', name: 'Mechapi', element: 'Metal', role: 'Tecnología y versatilidad', sheet: 0, row: 0, base: [3, 3, 3, 3],
    special: { name: 'Triple Cañón', desc: 'Tres disparos en abanico.', dmg: 0.55, count: 3, spread: 6, blast: 24 } },
  { id: 'tropicat', name: 'Tropicat', element: 'Naturaleza', role: 'Curación', sheet: 3, row: 1, base: [2, 4, 3, 3],
    special: { name: 'Semilla Vital', desc: 'Se cura con la mitad del daño que hace.', dmg: 0.9, drain: 0.5 } },
  { id: 'draconoid', name: 'Draconoid', element: 'Dragón', role: 'Poder destructivo', sheet: 3, row: 2, base: [5, 3, 2, 2],
    special: { name: 'Aliento Dragón', desc: 'Perfora el terreno antes de estallar.', dmg: 1.25, pierce: 70, blast: 34 } },
  { id: 'bounzy', name: 'Bounzy', element: 'Normal', role: 'Rebotes impredecibles', sheet: 4, row: 0, base: [3, 3, 2, 4],
    special: { name: 'Bola Loca', desc: 'Rebota dos veces y pega más en cada bote.', dmg: 0.8, bounce: 2 } },
  { id: 'solaris', name: 'Solaris', element: 'Luz', role: 'Soporte y protección', sheet: 4, row: 1, base: [2, 4, 4, 2],
    special: { name: 'Luz Sanadora', desc: 'Recupera vida y además dispara.', dmg: 0.6, heal: 0.22 } },
  { id: 'rokky', name: 'Rokky', element: 'Eléctrico/Tierra', role: 'Absorción y contraataque', sheet: 4, row: 2, base: [3, 5, 2, 2],
    special: { name: 'Batería', desc: 'Devuelve al rival parte del próximo golpe que reciba.', dmg: 0.8, counter: 0.6 } },
];

export const speciesOf = id => ROSTER.find(r => r.id === id);

export const ELEMENT_COLOR = {
  Fuego: '#ff7a3d', Agua: '#4db8ff', 'Eléctrico': '#ffe14a', Tierra: '#d9a441', Viento: '#8ff0d0',
  Oscuridad: '#a06bff', Hielo: '#9fdcff', Veneno: '#9be33c', Metal: '#b9c7e8', Naturaleza: '#6fd45a',
  'Dragón': '#8d7bff', Normal: '#f1c9a0', Luz: '#ffe9a0', 'Eléctrico/Tierra': '#ffd23f',
};

// Orden de los huevos en assets/ui/huevos.png (de izquierda a derecha y de arriba abajo).
export const EGG_ORDER = ['Fuego', 'Agua', 'Eléctrico', 'Tierra', 'Viento', 'Oscuridad', 'Hielo', 'Veneno', 'Metal', 'Naturaleza', 'Dragón', 'Normal', 'Luz', 'Eléctrico/Tierra'];
// Orden de los objetos en assets/ui/objetos.png.
export const ICON_ORDER = ['filete', 'bayas', 'semillas', 'pelota', 'moneda', 'corazon', 'espadas', 'pesa', 'diana', 'roca', 'rayo', 'escudo', 'estrella', 'libro', 'engranaje', 'casa'];

// Colores del terreno de cada mapa, de la roca del fondo al borde iluminado.
export const MAPS = [
  { id: 'castillo', name: 'Islas del Castillo', bg: 'assets/mapas/castillo.png', terrain: ['#2a1f3d', '#4a3558', '#3f8a35', '#74c043', '#b6e36a'], duel: ['mechapi', 'shadowon'] },
  { id: 'volcan', name: 'Forja Volcánica', bg: 'assets/mapas/volcan.png', terrain: ['#1c1114', '#3a1d1c', '#8a2a16', '#e2531e', '#ffb347'], duel: ['pyrorex', 'aquarok'] },
  { id: 'aurora', name: 'Tundra de la Aurora', bg: 'assets/mapas/aurora.png', terrain: ['#16233f', '#2c4470', '#7fa9dc', '#cfe6ff', '#ffffff'], duel: ['frostine', 'rokky'] },
];
