// Modo aventura (PvE): expediciones por un mapa que se recorre a pie, con movimiento libre.
// Aquí están los datos de cada zona y las reglas; la vista que se pasea por el mapa está en explorar.js.
//
// Una expedición empieza en el portal con la vida entera. La vida y el MP NO se rellenan entre combates:
// se arrastran hasta que vuelves a casa, descansas en un sitio del mapa o caes. Las bestias salvajes tienen
// nivel fijo (no el tuyo), así que criar bien a la tuya sirve para llegar más lejos.
//
// En la partida:  g.adv        la expedición en curso (o null): { region, zone, x, y, hp, mp, done }
//                 g.advChests  cofres ya abiertos (solo se abren una vez)
//                 g.advCleared regiones cuyo jefe has vencido: { islas: veces }

import { speciesOf } from './roster.js';
import { ITEMS, grantEgg } from './state.js';

const STATS = ['pot', 'agu', 'pun', 'agi'];

// Cada zona es una imagen (1536 × 864) con el suelo marcado a mano encima:
//   ground  el contorno por donde se puede andar, más los puentes (bridges)
//   blocks  lo que estorba: círculos [x, y, radio], rectángulos y el estanque
//   trees   árboles altos: se choca con el tronco y se puede pasar por detrás de la copa
//   grass   hierba alta: tapa los pies (y esconde cofres)
const PORTAL = {
  id: 'portal', img: 'assets/aventura/islas-portal.webp', w: 1536, h: 864, start: [700, 352],
  ground: [[80, 0], [1395, 0], [1470, 90], [1480, 280], [1450, 440], [1445, 560], [1400, 700], [1300, 758], [1250, 775], [770, 770], [600, 742], [500, 732], [400, 712], [300, 680], [215, 610], [120, 600], [95, 500], [80, 440]],
  bridges: [[1380, 306, 1536, 388]],
  circles: [
    [290, 45, 34], [370, 262, 18], [913, 248, 36], [1008, 280, 20], [1043, 240, 16], [1143, 242, 26], [1258, 252, 28], [1398, 115, 24], [375, 472, 24], [785, 642, 58], [1343, 457, 34], [1100, 685, 28],   // rocas
    [475, 195, 24], [285, 275, 24], [675, 65, 20], [990, 425, 36], [405, 512, 22], [400, 582, 28], [310, 627, 22], [510, 647, 26], [555, 642, 22], [1075, 540, 26], [1245, 440, 34], [1313, 525, 20], [1413, 525, 22], [1428, 65, 20], [1463, 82, 18],   // arbustos
    [882, 330, 9], [480, 585, 9], [505, 272, 12], [675, 272, 12], [505, 412, 12], [675, 412, 12], [537, 48, 12], [642, 48, 12], [1387, 292, 12], [1387, 384, 12], [828, 428, 7], [1098, 230, 15],                    // faroles, pilares, cartel y columna
  ],
  rects: [[906, 95, 1010, 132], [1006, 80, 1040, 198], [1038, 160, 1066, 200], [928, 192, 980, 220], [205, 512, 375, 578], [903, 492, 1030, 514], [1326, 548, 1366, 612]],   // ruinas, tronco caído, arco, valla y columna caída
  ponds: [[342, 185, 114, 90]],                                                                                                     // [x, y, radio horizontal, radio vertical]
  // [x del tronco, y de la base, forma, radio de la copa, altura]
  trees: [
    [210, 150, 'round', 60, 125], [132, 68, 'pine', 42, 150], [410, 85, 'pine', 45, 150], [750, 135, 'pine', 42, 140], [825, 125, 'pine', 45, 155], [165, 280, 'round', 55, 125],
    [88, 260, 'pine', 38, 110], [213, 485, 'pine', 40, 135], [1338, 150, 'pine', 40, 125], [1343, 295, 'round', 55, 125], [1418, 235, 'round', 45, 115], [755, 580, 'round', 55, 130],
    [688, 592, 'pine', 32, 90], [853, 597, 'pine', 42, 127], [940, 692, 'pine', 45, 147], [1165, 655, 'pine', 48, 173], [1238, 625, 'round', 56, 143],
  ],
  grass: [[100, 270, 250, 330], [720, 150, 860, 245], [1118, 50, 1298, 180], [595, 622, 710, 712], [968, 582, 1028, 657], [1233, 617, 1318, 677]],
  // Lo que hay en la zona. Las bestias salvajes patrullan entre `x,y` y `to`; los cofres con `hidden` no se ven hasta estar muy cerca.
  pois: [
    { id: 'salida', type: 'exit', x: 590, y: 345, r: 38 },
    { id: 's1', type: 'wild', x: 1010, y: 362, to: [1240, 358], species: 'zephyra', level: 2 },
    { id: 's2', type: 'wild', x: 545, y: 688, to: [735, 716], species: 'tropicat', level: 3 },
    { id: 'c1', type: 'chest', x: 1215, y: 138, coins: 40, hidden: true },
    { id: 'c2', type: 'chest', x: 655, y: 668, item: 'escudo', hidden: true },
    { id: 'c3', type: 'chest', x: 168, y: 104, item: 'elixir', hidden: true },
    { id: 'd1', type: 'rest', x: 486, y: 258 },
    { id: 'cartel', type: 'sign', x: 828, y: 448, text: 'El cartel señala dos caminos: al norte, el jardín; al este, las ruinas. Los dos puentes siguen cerrados.' },
    { id: 'norte', type: 'gate', x: 590, y: 14, r: 40, text: 'El puente del norte lleva al jardín. Todavía está cerrado.' },
    { id: 'este', type: 'gate', x: 1512, y: 347, r: 40, text: 'El puente del este lleva a las ruinas. Todavía está cerrado.' },
  ],
};

export const REGIONS = {
  islas: { id: 'islas', name: 'Islas del Castillo', map: 'castillo', first: 'portal', zones: { portal: PORTAL }, boss: 'solaris', reward: { coins: 150, item: 'pocion' } },
};

export const REST_HEAL = 0.5;

export const regionOf = g => (g.adv ? REGIONS[g.adv.region] : null);
export const zoneOf = g => (g.adv ? REGIONS[g.adv.region].zones[g.adv.zone] : null);
export const cleared = (g, region) => (g.advCleared || {})[region] || 0;

// Sale de expedición (o sigue con la que tenía a medias, si es de esta versión del mapa).
export function start(g, region) {
  const r = REGIONS[region];
  if (g.adv && g.adv.region === region && r.zones[g.adv.zone]) return g.adv;
  const zone = r.zones[r.first];
  g.adv = { region, zone: zone.id, x: zone.start[0], y: zone.start[1], hp: 1, mp: null, done: [] };
  return g.adv;
}
export function leave(g) { g.adv = null; }

// ¿Sigue ahí? Los cofres se abren una sola vez para siempre; lo demás vuelve en cada expedición.
export function active(g, poi) {
  if (!g.adv) return false;
  if (poi.type === 'exit' || poi.type === 'gate' || poi.type === 'sign') return true;
  if (poi.type === 'chest') return !(g.advChests || []).includes(`${g.adv.region}:${poi.id}`);
  return !g.adv.done.includes(poi.id);
}

export function openChest(g, poi) {
  if (!active(g, poi)) return null;
  (g.advChests ||= []).push(`${g.adv.region}:${poi.id}`);
  if (poi.coins) g.coins += poi.coins;
  if (poi.item) g.items[poi.item] = (g.items[poi.item] || 0) + 1;
  return { coins: poi.coins || 0, item: poi.item || '' };
}

export function rest(g, poi) {
  if (!active(g, poi)) return false;
  g.adv.hp = Math.min(1, g.adv.hp + REST_HEAL);
  g.adv.done.push(poi.id);
  return true;
}

// Un encuentro del camino: aplica lo que trae la respuesta elegida. maxMp es el MP máximo de tu bestia ahora.
export function resolve(g, poi, index, maxMp) {
  const choice = poi.choices?.[index];
  if (!choice || !active(g, poi)) return null;
  const fx = choice.fx;
  if (fx.hp) g.adv.hp = Math.max(0.05, Math.min(1, g.adv.hp + fx.hp));
  if (fx.mp) g.adv.mp = Math.min(maxMp, (g.adv.mp ?? maxMp) + fx.mp);
  if (fx.coins) g.coins = Math.max(0, g.coins + fx.coins);
  g.adv.done.push(poi.id);
  return choice.result;
}

// La bestia salvaje de un punto del mapa: nivel y forma fijos, con las estadísticas que tendría una criada hasta ese nivel.
export function makeWild(poi) {
  const sp = speciesOf(poi.species), stats = { pot: sp.base[0], agu: sp.base[1], pun: sp.base[2], agi: sp.base[3] };
  const best = STATS[sp.base.indexOf(Math.max(...sp.base))];
  for (let lv = 1; lv < poi.level; lv++) { stats[best]++; stats[STATS[lv % 4]]++; }
  const boss = poi.type === 'boss';
  if (boss) { stats.agu += 4; stats.pot += 1; }
  const stage = poi.stage ?? (poi.level >= 30 ? 2 : poi.level >= 10 ? 1 : 0);
  return {
    species: sp.id, name: sp.name, level: poi.level, stage, stats, hue: 0, hunger: 70, mood: 70, bond: 55,
    char: boss ? 'feroz' : '', mastery: stage === 2 ? best : '', wild: true, boss,
  };
}

// Tras un combate de la expedición. hp (0–1) y mp son con lo que acabó tu bestia.
// Devuelve { over } si la expedición termina, y { reward } la primera vez que cae el jefe.
export function afterBattle(g, poi, win, hp, mp) {
  if (!g.adv) return { over: true };
  if (!win) { g.adv = null; return { over: true }; }
  g.adv.hp = Math.max(0.02, Math.min(1, hp));
  g.adv.mp = Math.max(0, Math.round(mp));
  g.adv.done.push(poi.id);
  if (poi.type !== 'boss') return { over: false };
  const region = REGIONS[g.adv.region], first = !cleared(g, region.id);
  (g.advCleared ||= {})[region.id] = cleared(g, region.id) + 1;
  g.adv = null;
  if (!first) return { over: true, boss: true };
  const reward = { ...region.reward, egg: grantEgg(g, poi.species) };
  g.coins += reward.coins;
  if (reward.item) g.items[reward.item] = (g.items[reward.item] || 0) + 1;
  return { over: true, boss: true, reward };
}

export const itemName = id => ITEMS[id]?.name || id;

// ---------- El suelo ----------

function inPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ¿Se puede poner un pie en (x, y)?
export function ground(zone, x, y) {
  if (x < 0 || y < 0 || x > zone.w || y > zone.h) return false;
  if (!inPolygon(zone.ground, x, y) && !zone.bridges.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3])) return false;
  for (const [cx, cy, r] of zone.circles) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return false;
  for (const [x0, y0, x1, y1] of zone.rects) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return false;
  for (const [cx, cy, rx, ry] of zone.ponds) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) return false;
  for (const [tx, ty] of zone.trees) if ((x - tx) ** 2 + (y - (ty - 6)) ** 2 < 16 * 16) return false;   // el tronco
  return true;
}
// ¿Cabe una bestia con los pies en (x, y)? Se mira el centro y un poco alrededor.
export const walkable = (zone, x, y) => ground(zone, x, y) && ground(zone, x - 11, y) && ground(zone, x + 11, y) && ground(zone, x, y - 6) && ground(zone, x, y + 5);

// Da un paso de (x, y) hacia (x + dx, y + dy). Si choca, resbala: primero a lo largo de una pared recta y,
// si no, rodeando el obstáculo (roca, tronco) por el lado que quede libre. Devuelve dónde queda.
const TURNS = [0.6, -0.6, 1.15, -1.15];
export function step(zone, x, y, dx, dy) {
  if (walkable(zone, x + dx, y + dy)) return [x + dx, y + dy];
  if (dx && dy) {
    if (walkable(zone, x + dx, y)) return [x + dx, y];
    if (walkable(zone, x, y + dy)) return [x, y + dy];
  }
  for (const a of TURNS) {
    const c = Math.cos(a), s = Math.sin(a), rx = (dx * c - dy * s) * 0.85, ry = (dx * s + dy * c) * 0.85;
    if (walkable(zone, x + rx, y + ry)) return [x + rx, y + ry];
  }
  return [x, y];
}

export const inGrass = (zone, x, y) => zone.grass.some(g => x >= g[0] && x <= g[2] && y >= g[1] && y <= g[3]);

// ---------- Buscar camino (para ir a un punto tocado) ----------

const CELL = 8, grids = new WeakMap();
function gridOf(zone) {
  let g = grids.get(zone);
  if (!g) {
    const cols = Math.ceil(zone.w / CELL) + 1, rows = Math.ceil(zone.h / CELL) + 1, ok = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) ok[i + j * cols] = walkable(zone, i * CELL, j * CELL) ? 1 : 0;
    grids.set(zone, g = { cols, rows, ok });
  }
  return g;
}
// ¿Se puede ir en línea recta de un punto a otro sin chocar?
export function clear(zone, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
  for (let i = 1; i <= n; i++) if (!walkable(zone, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}
// Camino andando de (x, y) hasta lo más cerca posible de (tx, ty), rodeando obstáculos. Lista de puntos, o [] si no hay.
export function pathTo(zone, x, y, tx, ty) {
  const { cols, rows, ok } = gridOf(zone), at = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && ok[i + j * cols];
  const near = (px, py) => {                           // la casilla pisable más cercana a un punto
    const ci = Math.round(px / CELL), cj = Math.round(py / CELL);
    let best = null;
    for (let r = 0; r <= 15 && !best; r++) for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || !at(i, j)) continue;
      const d = Math.hypot(i * CELL - px, j * CELL - py);
      if (!best || d < best.d) best = { i, j, d };
    }
    return best;
  };
  const from = near(x, y), to = near(tx, ty);
  if (!from || !to) return [];
  const id = (i, j) => i + j * cols, goal = id(to.i, to.j), start = id(from.i, from.j);
  const cost = new Map([[start, 0]]), prev = new Map(), open = [[0, from.i, from.j]], done = new Set();
  const guess = (i, j) => { const a = Math.abs(i - to.i), b = Math.abs(j - to.j); return Math.max(a, b) + 0.41 * Math.min(a, b); };
  let found = false;
  while (open.length) {
    let k = 0;
    for (let n = 1; n < open.length; n++) if (open[n][0] < open[k][0]) k = n;
    const [, i, j] = open.splice(k, 1)[0], here = id(i, j);
    if (here === goal) { found = true; break; }
    if (done.has(here)) continue;
    done.add(here);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if ((!di && !dj) || !at(i + di, j + dj)) continue;
      if (di && dj && (!at(i + di, j) || !at(i, j + dj))) continue;       // no cortar esquinas
      const n = id(i + di, j + dj), c = cost.get(here) + (di && dj ? 1.41 : 1);
      if (c < (cost.get(n) ?? Infinity)) { cost.set(n, c); prev.set(n, here); open.push([c + guess(i + di, j + dj), i + di, j + dj]); }
    }
  }
  if (!found) return [];
  const path = [];
  for (let n = goal; n !== undefined && n !== start; n = prev.get(n)) path.unshift([(n % cols) * CELL, Math.floor(n / cols) * CELL]);
  if (walkable(zone, tx, ty) && path.length && Math.hypot(path.at(-1)[0] - tx, path.at(-1)[1] - ty) < CELL * 1.5) path[path.length - 1] = [tx, ty];
  return path;
}
