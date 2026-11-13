// Modo aventura (PvE): expediciones por un mapa que se recorre a pie, con movimiento libre.
// Aquí están los datos de cada zona y las reglas; la vista que se pasea por el mapa está en explorar.js.
//
// Una expedición empieza en el portal con la vida entera. La vida y el MP NO se rellenan entre combates:
// se arrastran hasta que vuelves a casa, descansas en un sitio del mapa o caes. Las bestias salvajes tienen
// nivel fijo (no el tuyo), así que criar bien a la tuya sirve para llegar más lejos.
//
// En la partida:  g.adv        la expedición en curso (o null): { region, zone, x, y, hp, mp, done }
//                 g.advChests  cofres ya abiertos (solo se abren una vez); los identificadores no se repiten entre zonas
//                 g.advCleared regiones cuyo jefe has vencido: { islas: veces }

import { speciesOf } from './roster.js';
import { ITEMS, grantEgg } from './state.js';

const STATS = ['pot', 'agu', 'pun', 'agi'];

// Cada zona es una imagen (1536 × 864) con el suelo marcado a mano encima:
//   ground  el contorno por donde se puede andar, más los puentes (bridges)
//   blocks  lo que estorba: círculos [x, y, radio], rectángulos y el estanque
//   trees   árboles altos (y columnas): se choca con el tronco y se puede pasar por detrás de la copa
//   grass   hierba alta: tapa los pies (y esconde cofres)
const PORTAL = {
  id: 'portal', name: 'Isla del portal', img: 'assets/aventura/islas-portal.webp', w: 1536, h: 864, start: [700, 352],
  ground: [[80, 0], [1395, 0], [1470, 90], [1480, 280], [1450, 440], [1445, 560], [1400, 700], [1300, 758], [1250, 775], [770, 770], [600, 742], [500, 732], [400, 712], [300, 680], [215, 610], [120, 600], [95, 500], [80, 440]],
  bridges: [[1380, 306, 1536, 388]],
  circles: [
    [290, 45, 34], [370, 262, 18], [913, 248, 36], [1008, 280, 20], [1043, 240, 16], [1143, 242, 26], [1258, 252, 28], [1398, 115, 24], [375, 472, 24], [785, 642, 58], [1343, 457, 34], [1100, 685, 28],   // rocas
    [475, 195, 24], [285, 275, 24], [675, 65, 20], [990, 425, 36], [405, 512, 22], [400, 582, 28], [310, 627, 22], [510, 647, 26], [555, 642, 22], [1075, 540, 26], [1245, 440, 34], [1313, 525, 20], [1413, 525, 22], [1428, 65, 20], [1463, 82, 18],   // arbustos
    [882, 330, 9], [480, 585, 9], [505, 272, 12], [675, 272, 12], [505, 412, 12], [675, 412, 12], [537, 48, 12], [642, 48, 12], [1387, 292, 12], [1387, 384, 12], [828, 428, 7], [1098, 230, 15],                    // faroles, pilares, cartel y columna
  ],
  rects: [[906, 95, 1010, 132], [1006, 80, 1040, 198], [1038, 160, 1066, 200], [928, 192, 980, 220], [205, 512, 375, 578], [903, 492, 1030, 514], [1326, 548, 1366, 612]],   // ruinas, tronco caído, arco, valla y columna caída
  ponds: [[342, 185, 114, 90]],                                                                                                     // [x, y, radio horizontal, radio vertical]
  // [x del tronco, y de la base, forma, radio de la copa, altura]. La forma 'post' es una columna o una estatua: alta y estrecha.
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
    { id: 's3', type: 'wild', x: 1120, y: 204, to: [1300, 206], species: 'bounzy', level: 4 },
    { id: 'c1', type: 'chest', x: 1215, y: 138, coins: 40, hidden: true },
    { id: 'c2', type: 'chest', x: 655, y: 668, item: 'escudo', hidden: true },
    { id: 'c3', type: 'chest', x: 168, y: 104, item: 'elixir', hidden: true },
    { id: 'd1', type: 'rest', x: 338, y: 298, r: 26 },              // en la orilla del estanque, fuera de los caminos
    // Encuentros: una situación con dos respuestas.
    { id: 'e1', type: 'event', x: 292, y: 598, text: 'Un arco antiguo zumba con una energía extraña.',
      choices: [{ label: 'Cruzarlo', result: 'Sientes un cosquilleo: recuperas todo el MP.', fx: { mp: 999 } },
        { label: 'Rodearlo', result: 'Mejor no tentar a la suerte. Entre las ruinas encuentras 15 monedas.', fx: { coins: 15 } }] },
    { id: 'e2', type: 'event', x: 790, y: 252, text: 'Entre la hierba alta hay flores que brillan en la oscuridad.',
      choices: [{ label: 'Oler las flores', result: 'El aroma reconforta: recuperas un cuarto de la vida.', fx: { hp: 0.25 } },
        { label: 'Recoger pétalos', result: 'Los pétalos valen algo: +25 monedas.', fx: { coins: 25 } }] },
    // Cosas por el suelo: comida para la despensa y monedas sueltas. Vuelven en cada expedición.
    { id: 'f1', type: 'food', x: 150, y: 300, food: 'bayas' }, { id: 'f2', type: 'food', x: 1180, y: 110, food: 'seta' }, { id: 'f3', type: 'food', x: 1000, y: 620, food: 'manzana' },
    { id: 'f4', type: 'food', x: 640, y: 640, food: 'semillas' }, { id: 'f5', type: 'food', x: 1270, y: 650, food: 'miel' }, { id: 'f6', type: 'food', x: 440, y: 120, food: 'bayas' },
    { id: 'm1', type: 'coin', x: 1060, y: 130, coins: 6 }, { id: 'm2', type: 'coin', x: 250, y: 420, coins: 5 }, { id: 'm3', type: 'coin', x: 1420, y: 620, coins: 8 }, { id: 'm4', type: 'coin', x: 900, y: 720, coins: 6 },
    { id: 'cartel', type: 'sign', x: 828, y: 448, text: 'El cartel señala dos caminos: al norte, el jardín; al este, las ruinas.' },
    { id: 'norte', type: 'gate', x: 590, y: 14, r: 40, to: { zone: 'jardin', x: 546, y: 752 } },
    { id: 'este', type: 'gate', x: 1512, y: 347, r: 40, to: { zone: 'ruinas', x: 108, y: 411 } },
  ],
};

// El jardín, al norte del portal: un estanque con fuente en el centro, el cenador, setos y parterres.
const JARDIN = {
  id: 'jardin', name: 'Jardín lunar', img: 'assets/aventura/islas-jardin.webp', w: 1536, h: 864, start: [546, 752],
  ground: [[70, 0], [1350, 0], [1400, 40], [1415, 70], [1405, 130], [1385, 200], [1375, 250], [1380, 310], [1425, 345], [1475, 410], [1505, 480], [1508, 560], [1480, 625], [1395, 662], [1340, 702], [1200, 712], [1090, 728], [1040, 765], [960, 795], [440, 790], [290, 755], [205, 700], [150, 650], [108, 570], [105, 480], [100, 400], [95, 260], [70, 200], [35, 150], [35, 60]],
  bridges: [[472, 770, 620, 864], [1370, 256, 1536, 300]],
  circles: [
    [225, 490, 44], [378, 672, 48], [1188, 130, 46], [1400, 557, 48],                                                                    // rocas
    [345, 305, 36], [472, 188, 36], [710, 128, 30], [1040, 232, 36], [1133, 28, 34], [1313, 395, 36], [538, 600, 35], [730, 717, 36],   // rosales y arbustos
    [562, 120, 10], [1333, 292, 10], [908, 597, 10], [1133, 388, 48],                                                                    // faroles y la estatua con su corro de flores
  ],
  // cenador, setos, bancos, parterres, valla y los pilares del puente
  rects: [[190, 0, 368, 200], [520, 158, 588, 208], [730, 92, 806, 128], [718, 140, 765, 222], [793, 152, 936, 238], [1028, 140, 1128, 185], [1085, 140, 1131, 270], [1198, 182, 1288, 232],
    [960, 355, 1010, 440], [925, 420, 1000, 522], [1040, 460, 1131, 505], [995, 527, 1163, 575], [974, 607, 1196, 680], [1222, 655, 1343, 696], [272, 545, 448, 621], [445, 775, 471, 864], [621, 775, 648, 864]],
  ponds: [[742, 388, 205, 132]],
  trees: [
    [95, 78, 'pine', 38, 80], [112, 158, 'pine', 30, 75], [185, 392, 'pine', 45, 155], [222, 287, 'pine', 20, 50], [287, 474, 'pine', 45, 160], [470, 58, 'pine', 35, 60], [722, 50, 'pine', 35, 55],
    [665, 95, 'pine', 28, 68], [873, 132, 'round', 72, 140], [980, 208, 'pine', 45, 145], [1318, 170, 'round', 75, 165], [200, 617, 'round', 62, 135], [478, 722, 'pine', 42, 145],
    [775, 697, 'round', 65, 145], [1255, 592, 'round', 70, 155], [1365, 500, 'pine', 30, 92], [843, 822, 'round', 42, 95], [1133, 398, 'post', 22, 130],
  ],
  grass: [[395, 60, 535, 145], [953, 25, 1100, 130], [330, 385, 410, 508], [1168, 260, 1250, 338], [836, 582, 913, 682], [888, 680, 1028, 772]],
  pois: [
    { id: 'j-sur', type: 'gate', x: 546, y: 842, r: 36, to: { zone: 'portal', x: 590, y: 92 } },
    { id: 'j-este', type: 'gate', x: 1516, y: 278, r: 36, text: 'El puente del este lleva al bosque. Todavía está cerrado.' },
    { id: 'js1', type: 'wild', x: 455, y: 330, to: [440, 480], species: 'aquarok', level: 4 },
    { id: 'js2', type: 'wild', x: 690, y: 562, to: [860, 548], species: 'toxipuff', level: 5 },
    { id: 'js3', type: 'wild', x: 1180, y: 302, to: [1300, 332], species: 'tropicat', level: 6 },
    { id: 'jc1', type: 'chest', x: 1070, y: 72, coins: 50, hidden: true },           // entre las flores altas del norte
    { id: 'jc2', type: 'chest', x: 1332, y: 108, item: 'elixir', hidden: true },     // detrás del árbol grande
    { id: 'jc3', type: 'chest', x: 172, y: 574, item: 'escudo', hidden: true },      // detrás del árbol del acantilado
    { id: 'jd1', type: 'rest', x: 300, y: 236, r: 26 },                              // los escalones del cenador
    { id: 'je1', type: 'event', x: 742, y: 548, text: 'El agua de la fuente brilla con luz propia.',
      choices: [{ label: 'Beber un poco', result: 'Está fresca y sienta bien: recuperas un tercio de la vida.', fx: { hp: 0.33 } },
        { label: 'Echar una moneda', result: 'La moneda se hunde y el agua chispea: recuperas todo el MP.', fx: { coins: -1, mp: 999 } }] },
    { id: 'je2', type: 'event', x: 1133, y: 458, text: 'Una estatua sostiene un cuenco de piedra vacío.',
      choices: [{ label: 'Dejar unas flores', result: 'Sientes que alguien te lo agradece: recuperas un cuarto de la vida.', fx: { hp: 0.25 } },
        { label: 'Mirar detrás', result: 'Alguien olvidó aquí una bolsita: +30 monedas.', fx: { coins: 30 } }] },
    { id: 'jf1', type: 'food', x: 450, y: 104, food: 'bayas' }, { id: 'jf2', type: 'food', x: 370, y: 452, food: 'manzana' }, { id: 'jf3', type: 'food', x: 960, y: 738, food: 'sandia' },
    { id: 'jf4', type: 'food', x: 1215, y: 284, food: 'miel' }, { id: 'jf5', type: 'food', x: 140, y: 300, food: 'zanahoria' }, { id: 'jf6', type: 'food', x: 868, y: 640, food: 'semillas' },
    { id: 'jm1', type: 'coin', x: 640, y: 40, coins: 8 }, { id: 'jm2', type: 'coin', x: 1440, y: 500, coins: 10 }, { id: 'jm3', type: 'coin', x: 250, y: 700, coins: 7 }, { id: 'jm4', type: 'coin', x: 1285, y: 628, coins: 8 },
  ],
};

// Las ruinas, al este del portal: una plaza de losas rotas, un arco que brilla, columnas caídas y un pozo seco.
const RUINAS = {
  id: 'ruinas', name: 'Ruinas antiguas', img: 'assets/aventura/islas-ruinas.webp', w: 1536, h: 864, start: [108, 411],
  ground: [[230, 0], [1080, 0], [1085, 35], [1230, 25], [1300, 40], [1420, 80], [1480, 170], [1505, 290], [1500, 430], [1440, 490], [1410, 580], [1370, 650], [1300, 745], [1200, 790], [1085, 800], [360, 805], [340, 752], [300, 712], [215, 697], [150, 632], [100, 580], [100, 475], [40, 475], [40, 200], [70, 110], [140, 50]],
  bridges: [[0, 388, 170, 434], [957, 0, 1040, 60], [958, 780, 1052, 864]],
  circles: [
    [462, 145, 44], [1235, 232, 55], [1248, 682, 44], [478, 380, 16], [783, 657, 14], [1090, 565, 32],                                           // rocas y escombros
    [217, 240, 22], [1265, 445, 24], [557, 745, 24],                                                                                             // cristales
    [150, 165, 22], [240, 145, 22], [492, 65, 28], [928, 150, 24], [868, 280, 22], [1108, 235, 20], [1453, 340, 26], [1185, 682, 20], [480, 792, 24],   // arbustos
    [429, 562, 44], [270, 360, 10], [1213, 610, 10], [655, 232, 14],                                                                             // pozo, faroles y un pilar roto
  ],
  rects: [
    [655, 10, 725, 240], [805, 10, 885, 245], [725, 0, 805, 205],                                                                 // el arco
    [0, 345, 162, 388], [0, 434, 162, 472], [925, 0, 957, 88], [1040, 0, 1072, 88], [925, 755, 957, 864], [1053, 755, 1085, 864],   // barandillas y pilares de los puentes
    [417, 213, 475, 250], [368, 268, 430, 298], [535, 615, 602, 655], [702, 605, 745, 705], [1012, 518, 1080, 553], [1333, 348, 1385, 385],   // tambores de columna caídos
    [612, 275, 655, 320], [580, 305, 630, 350], [888, 262, 918, 305], [1026, 398, 1058, 480], [1050, 462, 1120, 498], [1105, 478, 1172, 516],
    [405, 455, 480, 490], [465, 470, 538, 508], [525, 527, 558, 582], [548, 552, 620, 590], [605, 570, 668, 606],                 // muros derruidos
    [1032, 265, 1098, 300], [1098, 695, 1128, 735],                                                                               // estatua y columna con hiedra
  ],
  ponds: [],
  trees: [
    [200, 152, 'round', 70, 150], [135, 346, 'round', 66, 135], [90, 192, 'pine', 40, 130], [287, 94, 'pine', 40, 95], [425, 108, 'round', 42, 85], [540, 58, 'round', 42, 60],
    [325, 268, 'post', 20, 130], [625, 228, 'post', 22, 175], [1065, 300, 'post', 32, 145], [1315, 386, 'post', 20, 108], [1113, 735, 'post', 18, 85],
    [527, 372, 'pine', 42, 148], [1125, 155, 'round', 30, 60], [1166, 182, 'round', 30, 60], [1250, 130, 'pine', 45, 130], [1338, 172, 'round', 66, 145], [1193, 82, 'round', 32, 70],
    [1413, 282, 'round', 70, 145], [1085, 414, 'pine', 24, 65], [200, 624, 'pine', 58, 135], [272, 552, 'round', 30, 70], [320, 672, 'pine', 40, 135], [420, 794, 'round', 66, 135],
    [750, 800, 'round', 32, 65], [855, 772, 'pine', 42, 140], [1168, 779, 'round', 34, 75], [1303, 662, 'pine', 45, 165], [1365, 547, 'pine', 42, 135],
  ],
  grass: [[505, 50, 600, 200], [360, 315, 495, 395], [1105, 345, 1228, 448], [590, 667, 720, 802]],
  pois: [
    { id: 'r-oeste', type: 'gate', x: 14, y: 411, r: 34, to: { zone: 'portal', x: 1425, y: 347 } },
    { id: 'r-norte', type: 'gate', x: 998, y: 14, r: 34, text: 'El puente del norte lleva al bosque. Todavía está cerrado.' },
    { id: 'r-sur', type: 'gate', x: 1005, y: 846, r: 34, text: 'El puente del sur lleva a la torre. Todavía está cerrado.' },
    { id: 'rs1', type: 'wild', x: 700, y: 430, to: [900, 520], species: 'gravion', level: 5 },
    { id: 'rs2', type: 'wild', x: 480, y: 682, to: [660, 700], species: 'shadowon', level: 6 },
    { id: 'rs3', type: 'wild', x: 1135, y: 318, to: [1290, 322], species: 'rokky', level: 7 },
    { id: 'rc1', type: 'chest', x: 430, y: 742, coins: 60, hidden: true },           // detrás del árbol grande del sur
    { id: 'rc2', type: 'chest', x: 1425, y: 236, item: 'pocion', hidden: true },     // detrás del árbol del acantilado
    { id: 'rc3', type: 'chest', x: 565, y: 122, item: 'mira', hidden: true },        // entre las flores altas, junto a la roca
    { id: 'rd1', type: 'rest', x: 1160, y: 608, r: 26 },                             // a la luz del farol
    { id: 're1', type: 'event', x: 765, y: 264, text: 'Dentro del arco flota una luz azul que parece llamarte.',
      choices: [{ label: 'Tocar la luz', result: 'Un chispazo te recorre: recuperas todo el MP, pero pierdes un poco de vida.', fx: { mp: 999, hp: -0.1 } },
        { label: 'Buscar por los escalones', result: 'Entre las losas hay monedas antiguas: +25 monedas.', fx: { coins: 25 } }] },
    { id: 're2', type: 'event', x: 429, y: 628, text: 'Un pozo seco. Al fondo brilla algo.',
      choices: [{ label: 'Bajar el cubo', result: 'El cubo sube con un puñado de monedas: +35 monedas.', fx: { coins: 35 } },
        { label: 'Pedir un deseo', result: 'Pides fuerzas para seguir, y algo te escucha: recuperas un tercio de la vida.', fx: { hp: 0.33 } }] },
    { id: 'rf1', type: 'food', x: 420, y: 352, food: 'seta' }, { id: 'rf2', type: 'food', x: 640, y: 724, food: 'bayas' }, { id: 'rf3', type: 'food', x: 1165, y: 402, food: 'seta' },
    { id: 'rf4', type: 'food', x: 900, y: 215, food: 'queso' }, { id: 'rf5', type: 'food', x: 1450, y: 420, food: 'manzana' }, { id: 'rf6', type: 'food', x: 265, y: 598, food: 'semillas' },
    { id: 'rm1', type: 'coin', x: 770, y: 620, coins: 10 }, { id: 'rm2', type: 'coin', x: 1350, y: 462, coins: 9 }, { id: 'rm3', type: 'coin', x: 505, y: 268, coins: 8 }, { id: 'rm4', type: 'coin', x: 1088, y: 118, coins: 12 },
  ],
};

export const REGIONS = {
  islas: { id: 'islas', name: 'Islas del Castillo', map: 'castillo', first: 'portal', zones: { portal: PORTAL, jardin: JARDIN, ruinas: RUINAS }, boss: 'solaris', reward: { coins: 150, item: 'pocion' } },
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

// Cruza un puente: pasa a la zona de al lado y aparece junto al puente por el que llega. Devuelve la zona nueva.
export function travel(g, poi) {
  const zone = g.adv && poi.to ? REGIONS[g.adv.region].zones[poi.to.zone] : null;
  if (!zone) return null;
  g.adv.zone = zone.id; g.adv.x = poi.to.x; g.adv.y = poi.to.y;
  return zone;
}

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

// Recoge algo del suelo: comida para la despensa o unas monedas.
export function pick(g, poi) {
  if (!active(g, poi)) return null;
  g.adv.done.push(poi.id);
  if (poi.type === 'coin') { g.coins += poi.coins; return { coins: poi.coins }; }
  g.foods[poi.food] = (g.foods[poi.food] || 0) + 1;
  return { food: poi.food };
}

// Cuántos cofres de la región has abierto ya, y cuántos hay.
export function chests(g, region) {
  const all = Object.values(REGIONS[region].zones).flatMap(z => z.pois.filter(p => p.type === 'chest'));
  return { found: all.filter(p => (g.advChests || []).includes(`${region}:${p.id}`)).length, total: all.length };
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
