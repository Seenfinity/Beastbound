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
//                 g.advQuest   la historia de cada región, que queda hecha para siempre:
//                              { forja: { started, seals: [quién te lo dio], smith, coal: [trozos], clue, door } }

import { speciesOf } from './roster.js';
import { ITEMS, grantEgg } from './state.js';

const STATS = ['pot', 'agu', 'pun', 'agi'];

// Cada zona es una imagen (1536 × 864) con el suelo marcado a mano encima:
//   ground  el contorno por donde se puede andar, menos los huecos (holes: un río de lava), más los puentes (bridges)
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

// ---------- Forja Volcánica ----------
// La isla de ceniza: el portal en una plaza con braseros, una poza de lava, una fragua y un río de lava
// (holes: zonas dentro de la isla que no se pisan) que se cruza por un puente pequeño.
const CENIZA = {
  id: 'ceniza', name: 'Isla de ceniza', img: 'assets/aventura/forja-entrada.webp', w: 1536, h: 864, start: [650, 436],
  ground: [[210, 0], [1420, 0], [1455, 60], [1480, 140], [1480, 265], [1440, 275], [1440, 392], [1475, 410], [1490, 470], [1536, 500], [1536, 864], [560, 864], [500, 830], [420, 775], [330, 715], [230, 670], [170, 610], [160, 560], [120, 500], [60, 440], [55, 385], [115, 345], [150, 305], [265, 300], [265, 190], [150, 180], [130, 100], [150, 40]],
  holes: [[[1536, 495], [1468, 520], [1393, 540], [1318, 560], [1258, 595], [1218, 625], [1168, 650], [1038, 715], [968, 740], [893, 775], [818, 795], [768, 815], [720, 832], [680, 864],
    [878, 864], [900, 852], [968, 808], [1048, 778], [1088, 768], [1138, 738], [1150, 705], [1175, 692], [1218, 680], [1258, 655], [1318, 625], [1393, 600], [1468, 580], [1536, 555]]],
  bridges: [[1430, 302, 1536, 358], [1000, 656, 1100, 694], [1080, 668, 1185, 712]],
  circles: [
    [440, 225, 34], [553, 165, 36], [278, 283, 26], [815, 45, 22], [1158, 65, 28], [1400, 55, 45], [1445, 40, 30], [1343, 200, 38], [1283, 250, 46], [510, 612, 36], [320, 682, 26], [475, 707, 34], [717, 667, 26], [1008, 487, 40], [1495, 770, 40], [1288, 840, 44],   // rocas
    [590, 88, 18], [660, 135, 38], [625, 175, 22], [110, 385, 24], [215, 405, 30], [215, 600, 34], [265, 610, 34], [240, 570, 26], [662, 805, 34], [920, 570, 22], [1310, 475, 34], [1345, 445, 30], [1208, 615, 22], [1283, 690, 20], [1113, 795, 24], [990, 840, 22],   // púas de obsidiana
    [800, 280, 26], [1400, 260, 16], [978, 370, 16], [545, 582, 16], [740, 702, 16], [750, 757, 16], [885, 530, 18], [1073, 582, 20], [1488, 832, 16],   // matas rojas
    [380, 386, 14], [693, 353, 14], [537, 530, 14], [617, 718, 14], [1025, 416, 14], [943, 65, 16], [1088, 65, 16],                                    // braseros
    [1025, 645, 12], [1018, 702, 12], [1157, 670, 12], [1155, 728, 12],                                                                             // pilares del puente pequeño
  ],
  rects: [[478, 300, 562, 400], [745, 160, 800, 235], [790, 205, 850, 262], [840, 232, 912, 292], [705, 222, 750, 262], [1040, 150, 1195, 300], [872, 402, 970, 455], [770, 455, 838, 498],
    [1420, 268, 1536, 302], [1420, 358, 1536, 392]],   // portal, muro, fragua, cadenas, yunque y barandillas
  ponds: [[275, 100, 122, 82]],
  trees: [
    [480, 138, 'round', 75, 150], [1235, 197, 'round', 72, 160], [1225, 447, 'round', 72, 160], [395, 694, 'round', 72, 160], [1395, 819, 'round', 75, 165],
    [890, 200, 'post', 14, 100], [1110, 460, 'post', 12, 85], [1113, 632, 'post', 12, 80], [1478, 697, 'post', 12, 95], [520, 400, 'post', 45, 110],
  ],
  grass: [[535, 200, 680, 250], [690, 30, 835, 130], [823, 180, 953, 245], [1340, 110, 1480, 195], [1273, 10, 1368, 70], [225, 305, 320, 370], [165, 420, 375, 535], [400, 652, 560, 792], [1053, 462, 1218, 542], [1043, 802, 1208, 864], [1413, 642, 1536, 712], [785, 690, 900, 755]],
  pois: [
    { id: 'salida', type: 'exit', x: 520, y: 425, r: 38 },
    { id: 'f-norte', type: 'gate', x: 1018, y: 14, r: 36, to: { zone: 'fundicion', x: 980, y: 752 } },
    { id: 'f-este', type: 'gate', x: 1516, y: 330, r: 34, to: { zone: 'ladera', x: 118, y: 322 } },
    { id: 'fs1', type: 'wild', x: 780, y: 340, to: [980, 322], species: 'blaziky', level: 8 },
    { id: 'fs2', type: 'wild', x: 1290, y: 322, to: [1400, 330], species: 'mechapi', level: 9 },
    // La élite: guarda uno de los tres sellos, no se mueve de su sitio y no vuelve una vez vencida.
    { id: 'fs3', type: 'wild', x: 1250, y: 762, species: 'pyrorex', level: 11, still: true, seal: true, title: 'Guardián del sello',
      intro: 'Guarda uno de los tres sellos y no piensa moverse. Es más fuerte que las bestias del camino.' },
    // Brasa cuenta de qué va la región y da pistas según lo que lleves hecho.
    { id: 'brasa', type: 'npc', role: 'guide', x: 760, y: 420, species: 'blaziky', stage: 2, name: 'Brasa', say: {
      first: ['¡Una bestia de fuera! Soy Brasa, la que vigila este portal.',
        'La puerta del volcán lleva años cerrada con tres sellos. Uno lo guarda un Pyrorex, al otro lado del río de lava. Otro lo tiene Yunque, el herrero de la fundición, al norte. El tercero se perdió en la ladera, al este.',
        'Reúne los tres y la puerta se abrirá. Lo que hay detrás… mejor ve con la vida entera.'],
      more: ['Aún te faltan sellos. Mira tu diario: ahí está lo que sabemos de cada uno.'],
      ready: ['¡Los tres sellos! La puerta está en la ladera, al este. Descansa antes de llamar.'],
      open: ['La puerta ya está abierta. El Señor de la Forja te espera en la ladera.'],
      done: ['Venciste al Señor de la Forja. Por aquí se hablará de ti mucho tiempo.'] } },
    { id: 'fc1', type: 'chest', x: 1415, y: 760, item: 'pocion', hidden: true },     // al otro lado del río, detrás del árbol
    { id: 'fc2', type: 'chest', x: 740, y: 80, coins: 80, hidden: true },            // entre la hierba seca del norte
    { id: 'fc3', type: 'chest', x: 400, y: 640, item: 'elixir', hidden: true },      // detrás del árbol del acantilado
    { id: 'fd1', type: 'rest', x: 655, y: 700, r: 26 },                              // junto al brasero del sur
    { id: 'fe1', type: 'event', x: 1118, y: 326, text: 'La fragua sigue encendida, aunque no hay nadie.',
      choices: [{ label: 'Avivar el fuego', result: 'Las llamas te llenan de energía: recuperas todo el MP.', fx: { mp: 999 } },
        { label: 'Rebuscar entre las herramientas', result: 'Debajo de un cubo hay una bolsa: +35 monedas.', fx: { coins: 35 } }] },
    { id: 'fe2', type: 'event', x: 803, y: 524, text: 'Un yunque partido. Hay algo encajado en la grieta.',
      choices: [{ label: 'Tirar con fuerza', result: 'Sale de golpe y te llevas un rasguño: +45 monedas, pero pierdes un poco de vida.', fx: { coins: 45, hp: -0.1 } },
        { label: 'Sentarse un momento', result: 'El metal aún guarda calor: recuperas un quinto de la vida.', fx: { hp: 0.2 } }] },
    { id: 'ff1', type: 'food', x: 590, y: 226, food: 'chile' }, { id: 'ff2', type: 'food', x: 272, y: 340, food: 'filete' }, { id: 'ff3', type: 'food', x: 1420, y: 152, food: 'pan' },
    { id: 'ff4', type: 'food', x: 1150, y: 505, food: 'huevo' }, { id: 'ff5', type: 'food', x: 1125, y: 838, food: 'chile' }, { id: 'ff6', type: 'food', x: 250, y: 480, food: 'filete' },
    { id: 'fm1', type: 'coin', x: 335, y: 240, coins: 10 }, { id: 'fm2', type: 'coin', x: 1470, y: 662, coins: 14 }, { id: 'fm3', type: 'coin', x: 600, y: 800, coins: 12 }, { id: 'fm4', type: 'coin', x: 1320, y: 32, coins: 11 },
  ],
};

// La fundición, al norte de la isla de ceniza: el horno grande, dos crisoles de metal fundido y un canal que se cruza por un puente.
const FUNDICION = {
  id: 'fundicion', name: 'La fundición', img: 'assets/aventura/forja-fundicion.webp', w: 1536, h: 864, start: [980, 752],
  ground: [[110, 0], [1200, 0], [1300, 25], [1355, 70], [1370, 140], [1425, 185], [1460, 230], [1450, 320], [1490, 345], [1495, 520], [1470, 610], [1440, 700], [1395, 750], [1250, 800], [1070, 812], [890, 812], [420, 808], [300, 788], [200, 758], [125, 700], [92, 640], [62, 560], [72, 500], [50, 400], [35, 300], [45, 200], [62, 100]],
  holes: [[[1022, 350], [1500, 350], [1500, 392], [1022, 392]]],
  bridges: [[918, 780, 1040, 864], [1183, 335, 1252, 405]],
  circles: [
    [568, 500, 50], [1250, 155, 40], [1410, 185, 25], [1345, 465, 18], [1162, 668, 26],                                            // rocas
    [470, 75, 26], [525, 55, 28], [675, 650, 34], [780, 760, 42], [1408, 492, 40],                                                 // púas de obsidiana
    [285, 162, 14], [1135, 188, 14], [330, 722, 14], [1210, 750, 14], [360, 185, 26], [405, 605, 26], [1097, 695, 36],            // braseros, chimeneas y cadenas
  ],
  rects: [
    [578, 0, 938, 232],                                                                                                             // el horno
    [398, 198, 462, 246], [843, 278, 908, 330], [473, 368, 550, 422], [1313, 256, 1368, 302], [935, 526, 998, 580], [1240, 434, 1288, 472],   // lingotes
    [430, 152, 550, 200], [520, 190, 578, 248], [1060, 205, 1128, 250], [1105, 240, 1155, 282], [888, 455, 975, 500], [960, 480, 1050, 515], [1040, 500, 1092, 630], [380, 678, 535, 738],   // muros
    [418, 250, 510, 304], [555, 268, 640, 338], [828, 372, 918, 444], [710, 312, 780, 352], [948, 222, 1000, 278], [1178, 222, 1280, 272], [972, 590, 1040, 632],                          // carbón, carros, yunques y pilas
    [888, 760, 917, 864], [1041, 760, 1070, 864],
  ],
  ponds: [[250, 285, 104, 70], [290, 437, 104, 72]],
  trees: [[170, 172, 'round', 85, 170], [1040, 162, 'round', 85, 165], [222, 697, 'round', 85, 165], [575, 707, 'round', 55, 120], [1265, 682, 'round', 85, 175], [360, 205, 'post', 26, 110], [405, 625, 'post', 26, 110]],
  grass: [[300, 30, 430, 95], [945, 312, 1040, 385], [1045, 410, 1165, 470], [540, 700, 720, 790], [1320, 620, 1440, 745], [400, 450, 510, 555], [85, 290, 150, 380]],
  pois: [
    { id: 'fu-sur', type: 'gate', x: 980, y: 846, r: 34, to: { zone: 'ceniza', x: 1018, y: 102 } },
    // Yunque, el herrero: da su sello a cambio de carbón para el horno.
    { id: 'yunque', type: 'npc', role: 'smith', x: 660, y: 292, species: 'gravion', stage: 1, name: 'Yunque', say: {
      first: ['Soy Yunque, el herrero. ¿El sello? Lo tengo yo, sí; lo uso de pisapapeles.',
        'Te lo cambio por un favor: el horno se me apaga. Tráeme tres trozos de carbón; andan tirados por la fundición.'],
      wait: ['Aún me falta carbón. Busca por los rincones de la fundición.'],
      give: ['¡Eso es! Con esto el horno aguanta otra temporada.', 'Toma, el sello es tuyo. Cuídalo más que yo.'],
      after: ['El horno tira que da gusto. Suerte con esa puerta.'] } },
    { id: 'ca1', type: 'coal', x: 598, y: 362 }, { id: 'ca2', type: 'coal', x: 1392, y: 300 }, { id: 'ca3', type: 'coal', x: 118, y: 470 },
    { id: 'fus2', type: 'wild', x: 1120, y: 522, to: [1300, 502], species: 'pyrorex', level: 11 },
    { id: 'fus3', type: 'wild', x: 1100, y: 302, to: [1290, 320], species: 'draconoid', level: 12 },
    { id: 'fuc1', type: 'chest', x: 1290, y: 630, coins: 90, hidden: true },         // detrás del árbol del sureste
    { id: 'fuc2', type: 'chest', x: 200, y: 120, item: 'mira', hidden: true },       // detrás del árbol de la esquina
    { id: 'fuc3', type: 'chest', x: 640, y: 745, item: 'escudo', hidden: true },     // entre la hierba seca del sur
    { id: 'fud1', type: 'rest', x: 1170, y: 770, r: 26 },
    { id: 'fue1', type: 'event', x: 755, y: 262, text: 'El horno grande ruge solo, como si alguien lo alimentara.',
      choices: [{ label: 'Echar carbón', result: 'El fuego crece y te contagia su fuerza: recuperas todo el MP.', fx: { mp: 999 } },
        { label: 'Calentarse un rato', result: 'El calor te afloja los músculos: recuperas un tercio de la vida.', fx: { hp: 0.33 } }] },
    { id: 'fue2', type: 'event', x: 402, y: 348, text: 'El metal del crisol sigue líquido. Algo brilla en el borde.',
      choices: [{ label: 'Cogerlo deprisa', result: 'Quema, pero es una pepita de oro: +50 monedas y pierdes un poco de vida.', fx: { coins: 50, hp: -0.1 } },
        { label: 'Empujarlo con un palo', result: 'Cae al suelo y se enfría: +25 monedas.', fx: { coins: 25 } }] },
    { id: 'fuf1', type: 'food', x: 360, y: 62, food: 'pan' }, { id: 'fuf2', type: 'food', x: 990, y: 350, food: 'filete' }, { id: 'fuf3', type: 'food', x: 1100, y: 440, food: 'chile' },
    { id: 'fuf4', type: 'food', x: 450, y: 502, food: 'huevo' }, { id: 'fuf5', type: 'food', x: 1380, y: 680, food: 'filete' }, { id: 'fuf6', type: 'food', x: 112, y: 340, food: 'pan' },
    { id: 'fum1', type: 'coin', x: 1400, y: 262, coins: 12 }, { id: 'fum2', type: 'coin', x: 150, y: 540, coins: 12 }, { id: 'fum3', type: 'coin', x: 830, y: 690, coins: 10 }, { id: 'fum4', type: 'coin', x: 1320, y: 420, coins: 13 },
  ],
};

// La ladera del volcán, al este: la puerta sellada, dos pozas, campos de púas y el río de lava con su puente.
const LADERA = {
  id: 'ladera', name: 'Ladera del volcán', img: 'assets/aventura/forja-ladera.webp', w: 1536, h: 864, start: [118, 322],
  ground: [[18, 88], [1480, 88], [1500, 200], [1505, 420], [1495, 480], [1455, 530], [1440, 620], [1400, 700], [1350, 735], [1280, 735], [1215, 712], [1135, 755], [1100, 835], [430, 850], [330, 818], [235, 780], [180, 740], [110, 690], [42, 640], [15, 580], [32, 520], [80, 440], [62, 380], [18, 380]],
  holes: [[[1380, 0], [1400, 50], [1415, 100], [1365, 180], [1380, 250], [1355, 330], [1340, 385], [1285, 480], [1250, 560], [1265, 620], [1295, 680], [1285, 730], [1285, 864],
    [1345, 864], [1345, 730], [1350, 680], [1325, 620], [1315, 560], [1345, 480], [1395, 385], [1405, 330], [1430, 250], [1425, 180], [1475, 100], [1450, 50], [1425, 0]]],
  bridges: [[0, 300, 110, 345], [1262, 402, 1395, 452]],
  circles: [
    [1185, 225, 30], [1305, 275, 28], [1225, 300, 26], [570, 540, 20], [856, 580, 38], [1152, 655, 36], [930, 635, 16], [990, 662, 16], [430, 645, 30], [665, 715, 40], [1205, 400, 48],   // rocas, respiradero y púas
    [160, 180, 18], [690, 265, 28], [822, 330, 44], [990, 245, 42], [385, 480, 22], [330, 510, 18], [135, 405, 42], [95, 545, 30], [795, 460, 40], [985, 610, 20], [1130, 598, 18], [970, 520, 22], [385, 755, 18], [790, 645, 25], [680, 830, 40],   // matas y arbolillos
    [145, 288, 14], [640, 175, 16], [908, 175, 16], [1263, 242, 14], [880, 512, 14], [1278, 392, 10], [1385, 390, 10], [1268, 460, 10], [1378, 462, 10],                                       // braseros y pilares del puente
  ],
  rects: [
    [690, 0, 890, 105], [545, 85, 655, 150], [895, 85, 985, 150], [365, 85, 525, 135], [1175, 25, 1345, 170],   // la puerta y la pared de roca
    [245, 150, 460, 268], [125, 520, 320, 635], [420, 670, 568, 775], [955, 680, 1125, 765],                       // campos de púas
    [645, 440, 760, 528], [842, 645, 925, 745], [738, 725, 858, 815], [0, 262, 100, 300], [0, 345, 100, 372], [1425, 88, 1536, 285],     // estatua, columna caída, basalto, barandillas y el acantilado del noreste
  ],
  ponds: [[565, 290, 102, 58], [1105, 325, 88, 54]],
  trees: [[60, 192, 'round', 62, 150], [1030, 227, 'round', 45, 100], [290, 492, 'round', 75, 150], [1060, 632, 'round', 75, 160], [315, 777, 'round', 60, 130], [1455, 395, 'round', 45, 95],
    [1118, 247, 'post', 14, 100], [540, 532, 'post', 14, 115], [1250, 692, 'post', 12, 80], [702, 528, 'post', 45, 165]],
  grass: [[100, 170, 240, 250], [385, 530, 650, 640], [600, 530, 780, 572], [1010, 765, 1110, 835], [400, 778, 530, 845]],
  pois: [
    { id: 'la-oeste', type: 'gate', x: 14, y: 322, r: 34, to: { zone: 'ceniza', x: 1425, y: 330 } },
    { id: 'las1', type: 'wild', x: 330, y: 330, to: [430, 345], species: 'blaziky', level: 11 },
    { id: 'las2', type: 'wild', x: 900, y: 400, to: [1000, 440], species: 'pyrorex', level: 12 },
    { id: 'las3', type: 'wild', x: 1150, y: 485, to: [1205, 545], species: 'mechapi', level: 13 },   // lejos de la puerta: delante de ella solo espera el jefe
    { id: 'lac1', type: 'chest', x: 1440, y: 352, item: 'pocion', hidden: true },    // al otro lado del río, detrás del arbolillo
    { id: 'lac2', type: 'chest', x: 1075, y: 575, coins: 100, hidden: true },        // detrás del árbol del sur
    { id: 'lac3', type: 'chest', x: 600, y: 600, item: 'elixir', hidden: true },     // entre la hierba seca, bajo la estatua
    { id: 'lad1', type: 'rest', x: 912, y: 542, r: 26 },
    // La puerta se abre con los tres sellos; detrás espera el jefe, que solo está cuando la puerta ya se abrió.
    { id: 'puerta', type: 'door', x: 788, y: 128, r: 30, text: 'Una puerta enorme, con tres huecos redondos en la piedra. Las runas laten como brasas.',
      opens: 'Los tres sellos encajan en sus huecos. Las runas se apagan una a una, la puerta se abre… y algo enorme sale a tu encuentro.' },
    { id: 'jefe', type: 'boss', x: 788, y: 152, species: 'draconoid', level: 15, stage: 2, still: true, locked: true, title: 'Señor de la Forja',
      intro: 'Llevaba años encerrado tras la puerta. Es mucho más fuerte que cualquier bestia del camino.' },
    { id: 'estatua', type: 'clue', x: 702, y: 562, text: 'En el pedestal de la estatua hay unas palabras medio borradas: «El tercer sello duerme donde la tierra respira, entre las púas del sur».' },
    { id: 'sello', type: 'seal', x: 608, y: 770, hidden: true },   // junto al respiradero del sur; sin la pista no hay destello que lo delate
    { id: 'laf1', type: 'food', x: 170, y: 212, food: 'chile' }, { id: 'laf2', type: 'food', x: 500, y: 612, food: 'filete' }, { id: 'laf3', type: 'food', x: 1060, y: 800, food: 'pan' },
    { id: 'laf4', type: 'food', x: 460, y: 812, food: 'huevo' }, { id: 'laf5', type: 'food', x: 740, y: 552, food: 'chile' }, { id: 'laf6', type: 'food', x: 1400, y: 580, food: 'filete' },
    { id: 'lam1', type: 'coin', x: 200, y: 330, coins: 12 }, { id: 'lam2', type: 'coin', x: 1300, y: 335, coins: 13 }, { id: 'lam3', type: 'coin', x: 80, y: 610, coins: 14 }, { id: 'lam4', type: 'coin', x: 900, y: 800, coins: 12 },
  ],
};

// ---------- Tundra de la Aurora ----------
// La isla nevada: el portal en una plaza despejada, un estanque helado, un santuario y cristales de hielo.
const NEVADA = {
  id: 'nevada', name: 'Isla nevada', img: 'assets/aventura/tundra-entrada.webp', w: 1536, h: 864, start: [705, 398],
  ground: [[300, 0], [1180, 0], [1300, 30], [1385, 90], [1400, 150], [1365, 205], [1345, 245], [1345, 398], [1378, 405], [1378, 430], [1330, 470], [1312, 540], [1340, 600], [1390, 640], [1385, 680], [1320, 735], [1245, 785], [1170, 815], [1065, 835], [880, 840], [420, 830], [360, 805], [300, 770], [235, 730], [180, 700], [120, 630], [105, 590], [100, 420], [108, 320], [175, 300], [170, 250], [112, 240], [112, 200], [205, 150], [262, 95]],
  bridges: [[1340, 283, 1536, 343], [915, 800, 1030, 864]],
  circles: [
    [280, 65, 20], [355, 268, 44], [350, 360, 20], [806, 410, 22], [235, 542, 32], [180, 567, 26], [482, 652, 28], [740, 440, 36], [735, 507, 16], [1068, 567, 42], [903, 597, 46], [813, 812, 30],   // rocas nevadas
    [460, 60, 40], [280, 365, 44], [843, 315, 30], [600, 740, 34], [670, 777, 22], [790, 520, 30], [1123, 800, 30],                                                                             // cristales de hielo
    [835, 55, 24], [900, 15, 30], [670, 200, 18], [700, 228, 18], [1278, 260, 26], [1183, 320, 16], [1268, 160, 18], [625, 607, 16], [620, 647, 16], [515, 747, 18], [1288, 652, 40], [1188, 590, 16], [820, 712, 20], [1098, 762, 16], [288, 170, 16],   // arbustos con nieve
    [148, 250, 14], [300, 690, 14], [398, 175, 12], [376, 695, 12], [957, 520, 12],                                                                                                            // árboles pelados y farolas
  ],
  // portal, santuario, valla, tronco caído, barandillas y pilares de los puentes
  rects: [[520, 220, 640, 350], [550, 40, 625, 145], [195, 438, 350, 466], [330, 540, 400, 592], [390, 520, 460, 572], [450, 500, 522, 550], [1345, 245, 1536, 283], [1345, 343, 1536, 398], [880, 770, 915, 864], [1030, 770, 1065, 864]],
  ponds: [[1038, 138, 172, 110]],
  trees: [
    [347, 95, 'pine', 50, 95], [530, 52, 'pine', 40, 55], [640, 45, 'round', 50, 60], [322, 178, 'pine', 32, 78], [352, 198, 'pine', 36, 60], [685, 175, 'pine', 42, 125], [752, 234, 'round', 52, 120],
    [220, 307, 'pine', 50, 160], [815, 262, 'pine', 36, 118], [1310, 154, 'pine', 50, 140], [1233, 77, 'pine', 45, 80], [1218, 537, 'pine', 42, 125], [165, 562, 'pine', 50, 135], [225, 707, 'pine', 45, 150],
    [555, 687, 'pine', 48, 165], [450, 797, 'pine', 42, 95], [740, 842, 'pine', 45, 155], [873, 527, 'pine', 42, 105], [1140, 574, 'round', 60, 150], [1205, 774, 'round', 62, 150], [578, 350, 'post', 55, 135],
  ],
  grass: [[475, 85, 548, 155], [625, 50, 690, 100], [710, 0, 790, 55], [888, 225, 993, 315], [1088, 200, 1273, 320], [325, 425, 475, 510], [650, 652, 740, 722], [1018, 432, 1093, 487], [953, 600, 1168, 697], [1168, 577, 1273, 642]],
  pois: [
    { id: 'salida', type: 'exit', x: 578, y: 388, r: 38 },
    { id: 't-este', type: 'gate', x: 1516, y: 313, r: 34, to: { zone: 'cristal', x: 138, y: 372 } },
    { id: 't-sur', type: 'gate', x: 972, y: 846, r: 34, to: { zone: 'observatorio', x: 985, y: 128 } },
    { id: 'ts1', type: 'wild', x: 950, y: 376, to: [1200, 372], species: 'frostine', level: 14 },
    { id: 'ts2', type: 'wild', x: 330, y: 640, to: [430, 650], species: 'zephyra', level: 15 },
    { id: 'ts3', type: 'wild', x: 850, y: 200, to: [790, 100], species: 'aquarok', level: 16 },
    { id: 'tc1', type: 'chest', x: 1215, y: 715, coins: 110, hidden: true },         // detrás del árbol nevado del sureste
    { id: 'tc2', type: 'chest', x: 1200, y: 255, item: 'escudo', hidden: true },     // entre la hierba helada, junto al estanque
    { id: 'tc3', type: 'chest', x: 228, y: 262, item: 'pocion', hidden: true },      // detrás del pino grande del oeste
    { id: 'td1', type: 'rest', x: 1000, y: 540, r: 26 },                             // a la luz de la farola
    { id: 'te1', type: 'event', x: 588, y: 170, text: 'Un santuario pequeño, medio enterrado en la nieve.',
      choices: [{ label: 'Quitarle la nieve', result: 'Dentro arde una vela que no se apaga: recuperas un cuarto de la vida.', fx: { hp: 0.25 } },
        { label: 'Mirar dentro', result: 'Alguien dejó una ofrenda hace mucho: +30 monedas.', fx: { coins: 30 } }] },
    { id: 'te2', type: 'event', x: 1038, y: 272, text: 'Bajo el hielo del estanque se mueve una luz.',
      choices: [{ label: 'Romper el hielo', result: 'El agua helada te salpica, pero sacas una bolsa: +40 monedas y pierdes un poco de vida.', fx: { coins: 40, hp: -0.1 } },
        { label: 'Quedarse mirando', result: 'La luz baila bajo el hielo y te despeja la cabeza: recuperas todo el MP.', fx: { mp: 999 } }] },
    { id: 'tf1', type: 'food', x: 510, y: 122, food: 'helado' }, { id: 'tf2', type: 'food', x: 940, y: 272, food: 'pescado' }, { id: 'tf3', type: 'food', x: 400, y: 485, food: 'leche' },
    { id: 'tf4', type: 'food', x: 700, y: 690, food: 'galleta' }, { id: 'tf5', type: 'food', x: 1060, y: 652, food: 'pescado' }, { id: 'tf6', type: 'food', x: 1222, y: 612, food: 'helado' },
    { id: 'tm1', type: 'coin', x: 150, y: 380, coins: 12 }, { id: 'tm2', type: 'coin', x: 1280, y: 440, coins: 14 }, { id: 'tm3', type: 'coin', x: 640, y: 812, coins: 12 }, { id: 'tm4', type: 'coin', x: 755, y: 62, coins: 15 },
  ],
};

// El bosque de cristal, al este de la isla nevada: cristales gigantes y un arroyo helado con su puente.
// Los cristales grandes van como árboles de copa en punta ('pine'): se pasa por detrás.
const CRISTAL = {
  id: 'cristal', name: 'Bosque de cristal', img: 'assets/aventura/tundra-cristal.webp', w: 1536, h: 864, start: [138, 372],
  ground: [[150, 0], [1395, 0], [1425, 60], [1450, 130], [1445, 250], [1385, 300], [1400, 380], [1435, 430], [1452, 520], [1445, 600], [1395, 680], [1290, 695], [1230, 735], [1010, 775], [1000, 864], [400, 864], [390, 800], [330, 762], [250, 748], [110, 705], [100, 650], [72, 600], [75, 555], [100, 500], [80, 420], [80, 320], [85, 250], [100, 130], [130, 60]],
  holes: [[[1000, 0], [998, 100], [1015, 200], [1035, 290], [1045, 390], [1058, 480], [1055, 570], [1085, 610], [1140, 655], [1215, 700], [1215, 760],
    [1300, 760], [1295, 690], [1265, 650], [1200, 600], [1135, 560], [1145, 480], [1145, 390], [1145, 290], [1100, 200], [1080, 100], [1150, 20], [1150, 0]]],
  bridges: [[0, 350, 140, 395], [1005, 312, 1165, 350]],
  circles: [
    [770, 145, 22], [865, 200, 30], [945, 50, 30], [462, 635, 38], [857, 815, 44], [985, 395, 22], [1130, 240, 30], [1170, 270, 22],                                   // rocas nevadas
    [470, 325, 30], [755, 185, 25], [967, 245, 38], [205, 500, 40], [1015, 418, 26], [1340, 245, 28], [1165, 540, 26], [880, 570, 14],                                 // cristales pequeños
    [165, 265, 35], [500, 270, 36], [585, 70, 25], [780, 40, 18], [235, 445, 30], [105, 535, 16], [135, 450, 18], [355, 565, 32], [430, 465, 30], [178, 695, 48], [545, 665, 28], [700, 830, 18], [1015, 730, 30], [1095, 745, 34],
    [995, 545, 38], [1335, 80, 30], [1280, 45, 28], [1190, 405, 28], [1222, 515, 34], [1410, 545, 24], [170, 95, 16],                                                   // arbustos y pinos pequeños
    [505, 195, 12], [495, 562, 12], [960, 692, 12], [1008, 300, 10], [1158, 300, 10], [1008, 362, 10], [1158, 362, 10],                                              // farolas y pilares del puente
  ],
  rects: [
    [145, 110, 320, 225], [258, 240, 368, 335], [608, 40, 740, 138], [220, 590, 352, 692], [620, 665, 778, 748], [1268, 510, 1392, 585], [1082, 100, 1180, 168],   // la base de los cristales grandes
    [1188, 160, 1305, 248], [1015, 630, 1100, 690], [1085, 655, 1170, 718], [0, 320, 135, 350], [0, 395, 135, 420],                                               // estatua, tronco caído y barandillas
  ],
  ponds: [[732, 400, 108, 72]],                         // el cristal del claro, con su corro de piedras
  trees: [
    [230, 225, 'pine', 88, 175], [312, 335, 'pine', 55, 130], [672, 138, 'pine', 66, 138], [735, 440, 'pine', 75, 185], [285, 692, 'pine', 66, 165], [697, 748, 'pine', 78, 145], [1330, 585, 'pine', 62, 150], [1130, 168, 'pine', 50, 128],
    [345, 162, 'pine', 40, 130], [115, 264, 'pine', 38, 120], [425, 314, 'pine', 42, 125], [460, 152, 'round', 55, 125], [835, 162, 'round', 60, 125], [925, 214, 'pine', 40, 125],
    [295, 530, 'pine', 40, 115], [385, 535, 'pine', 42, 115], [180, 602, 'pine', 35, 95], [395, 740, 'pine', 42, 130], [515, 760, 'pine', 38, 110], [460, 834, 'pine', 42, 130], [632, 850, 'pine', 42, 135],
    [920, 605, 'pine', 42, 125], [1365, 170, 'pine', 40, 110], [1290, 420, 'pine', 40, 120], [1240, 474, 'pine', 40, 100], [1375, 607, 'pine', 32, 88], [1245, 248, 'post', 45, 172],
  ],
  grass: [[545, 135, 720, 250], [810, 245, 910, 330], [805, 455, 900, 520], [540, 510, 720, 610], [815, 705, 965, 800]],
  pois: [
    { id: 'cr-oeste', type: 'gate', x: 14, y: 372, r: 34, to: { zone: 'nevada', x: 1420, y: 313 } },
    { id: 'crs1', type: 'wild', x: 330, y: 380, to: [520, 385], species: 'frostine', level: 16 },
    { id: 'crs2', type: 'wild', x: 760, y: 620, to: [860, 652], species: 'zephyra', level: 17 },
    { id: 'crs3', type: 'wild', x: 1250, y: 300, to: [1340, 320], species: 'voltix', level: 18 },
    { id: 'crc1', type: 'chest', x: 230, y: 95, coins: 120, hidden: true },          // detrás del cristal grande del noroeste
    { id: 'crc2', type: 'chest', x: 1330, y: 495, item: 'mira', hidden: true },      // al otro lado del arroyo, detrás del cristal
    { id: 'crc3', type: 'chest', x: 640, y: 560, item: 'elixir', hidden: true },     // entre la hierba helada
    { id: 'crd1', type: 'rest', x: 925, y: 702, r: 26 },
    { id: 'cre1', type: 'event', x: 735, y: 494, text: 'El cristal gigante vibra con un zumbido grave.',
      choices: [{ label: 'Apoyarse en él', result: 'El zumbido te recorre entera: recuperas todo el MP.', fx: { mp: 999 } },
        { label: 'Arrancar una esquirla', result: 'Corta como el hielo, pero vale lo suyo: +45 monedas y pierdes un poco de vida.', fx: { coins: 45, hp: -0.1 } }] },
    { id: 'cre2', type: 'event', x: 1245, y: 276, text: 'Una bestia de piedra cubierta de escarcha. Parece vigilar el arroyo.',
      choices: [{ label: 'Quitarle la escarcha', result: 'Bajo el hielo la piedra está tibia: recuperas un tercio de la vida.', fx: { hp: 0.33 } },
        { label: 'Mirar entre sus patas', result: 'Alguien escondió aquí una bolsa: +35 monedas.', fx: { coins: 35 } }] },
    { id: 'crf1', type: 'food', x: 630, y: 192, food: 'helado' }, { id: 'crf2', type: 'food', x: 860, y: 290, food: 'pescado' }, { id: 'crf3', type: 'food', x: 850, y: 490, food: 'leche' },
    { id: 'crf4', type: 'food', x: 572, y: 542, food: 'galleta' }, { id: 'crf5', type: 'food', x: 890, y: 752, food: 'pescado' }, { id: 'crf6', type: 'food', x: 1400, y: 252, food: 'helado' },
    { id: 'crm1', type: 'coin', x: 700, y: 282, coins: 14 }, { id: 'crm2', type: 'coin', x: 300, y: 722, coins: 15 }, { id: 'crm3', type: 'coin', x: 1212, y: 52, coins: 16 }, { id: 'crm4', type: 'coin', x: 1390, y: 440, coins: 14 },
  ],
};

// El observatorio, al sur: el edificio con cúpula, la terraza con el mapa de estrellas, telescopios y un estanque helado.
const OBSERVATORIO = {
  id: 'observatorio', name: 'El observatorio', img: 'assets/aventura/tundra-observatorio.webp', w: 1536, h: 864, start: [985, 128],
  ground: [[170, 55], [900, 55], [1085, 62], [1170, 55], [1335, 95], [1405, 150], [1480, 235], [1500, 290], [1450, 345], [1495, 470], [1500, 545], [1465, 610], [1445, 685], [1375, 745], [1220, 782], [1050, 802], [1000, 864], [700, 864], [690, 800], [640, 765], [300, 762], [225, 722], [130, 690], [100, 620], [82, 560], [108, 500], [62, 430], [52, 330], [32, 250], [28, 190], [62, 120], [130, 88]],
  bridges: [[925, 0, 1045, 70]],
  circles: [
    [505, 265, 28], [1115, 432, 34], [987, 688, 38], [1205, 548, 45], [1075, 632, 32], [1355, 630, 34], [1110, 715, 22], [1130, 580, 26],   // rocas nevadas
    [467, 228, 32], [1118, 150, 42], [1310, 392, 42], [345, 545, 50], [355, 640, 36],                                                       // cristales de hielo
    [150, 110, 18], [688, 248, 36], [750, 165, 32], [470, 375, 30], [1430, 280, 50], [1380, 580, 34], [1340, 690, 28], [540, 695, 52], [635, 705, 28], [860, 590, 26],   // arbustos con nieve
    [252, 335, 20], [428, 315, 20], [893, 190, 12], [600, 430, 14], [998, 430, 14], [693, 732, 14], [685, 215, 20], [485, 525, 22], [1140, 312, 22], [998, 528, 52],   // farolas, columna, telescopios y reloj de sol
  ],
  rects: [[160, 0, 418, 290], [505, 140, 600, 185], [585, 160, 665, 215], [1105, 365, 1190, 402], [1180, 320, 1272, 392], [400, 575, 515, 660], [838, 622, 952, 682], [890, 0, 924, 100], [1046, 0, 1082, 100]],   // edificio, muros, cajas, columna caída y pilares
  ponds: [[1215, 648, 150, 100]],
  trees: [
    [90, 290, 'pine', 42, 150], [150, 332, 'pine', 45, 135], [605, 105, 'pine', 50, 105], [1240, 167, 'round', 75, 145], [1300, 240, 'pine', 38, 110], [1345, 182, 'pine', 35, 100], [1400, 252, 'pine', 42, 150],
    [1390, 490, 'pine', 40, 135], [1440, 552, 'round', 45, 100], [235, 537, 'round', 62, 130], [185, 650, 'pine', 45, 140], [265, 690, 'pine', 42, 145], [1030, 817, 'pine', 42, 115],
    [685, 228, 'post', 22, 135], [485, 540, 'post', 34, 120], [1140, 326, 'post', 34, 110],
  ],
  grass: [[430, 45, 530, 110], [760, 78, 880, 150], [745, 190, 862, 248], [510, 262, 628, 335], [85, 352, 212, 430], [245, 405, 345, 478], [515, 500, 670, 585], [300, 672, 430, 748], [880, 685, 990, 760], [1000, 272, 1075, 328], [1172, 198, 1292, 272], [1120, 432, 1195, 496], [1240, 482, 1365, 540]],
  pois: [
    { id: 'ob-norte', type: 'gate', x: 985, y: 14, r: 34, to: { zone: 'nevada', x: 972, y: 758 } },
    { id: 'obs1', type: 'wild', x: 720, y: 380, to: [880, 420], species: 'aquarok', level: 18 },
    { id: 'obs2', type: 'wild', x: 760, y: 620, to: [640, 622], species: 'frostine', level: 19 },
    { id: 'obs3', type: 'wild', x: 330, y: 396, to: [420, 420], species: 'rokky', level: 20 },
    { id: 'obc1', type: 'chest', x: 250, y: 495, coins: 130, hidden: true },         // detrás del árbol nevado del oeste
    { id: 'obc2', type: 'chest', x: 1260, y: 120, item: 'pocion', hidden: true },    // detrás del árbol grande del noreste
    { id: 'obc3', type: 'chest', x: 915, y: 730, item: 'escudo', hidden: true },     // entre la hierba helada del sur
    { id: 'obd1', type: 'rest', x: 998, y: 600, r: 26 },                             // al pie del reloj de sol
    { id: 'obe1', type: 'event', x: 342, y: 332, text: 'La puerta del observatorio está cerrada. Por una rendija se escapa luz de estrellas.',
      choices: [{ label: 'Llamar a la puerta', result: 'Nadie contesta, pero en el escalón hay monedas: +35 monedas.', fx: { coins: 35 } },
        { label: 'Sentarse en los escalones', result: 'La luz que sale por la rendija reconforta: recuperas un tercio de la vida.', fx: { hp: 0.33 } }] },
    { id: 'obe2', type: 'event', x: 1140, y: 348, text: 'Un telescopio apunta al cielo. La lente sigue limpia.',
      choices: [{ label: 'Mirar por él', result: 'Ves la aurora tan cerca que casi la tocas: recuperas todo el MP.', fx: { mp: 999 } },
        { label: 'Desmontar una pieza', result: 'Una rueda de latón siempre se vende bien: +40 monedas.', fx: { coins: 40 } }] },
    { id: 'obf1', type: 'food', x: 480, y: 80, food: 'helado' }, { id: 'obf2', type: 'food', x: 820, y: 116, food: 'pescado' }, { id: 'obf3', type: 'food', x: 150, y: 396, food: 'leche' },
    { id: 'obf4', type: 'food', x: 590, y: 545, food: 'galleta' }, { id: 'obf5', type: 'food', x: 1300, y: 512, food: 'pescado' }, { id: 'obf6', type: 'food', x: 360, y: 716, food: 'helado' },
    { id: 'obm1', type: 'coin', x: 1230, y: 236, coins: 15 }, { id: 'obm2', type: 'coin', x: 780, y: 830, coins: 14 }, { id: 'obm3', type: 'coin', x: 130, y: 470, coins: 16 }, { id: 'obm4', type: 'coin', x: 1420, y: 420, coins: 15 },
  ],
};

// Cada región lleva la luz con que se tiñen las bestias (tint) y lo que flota en el aire (motes).
export const REGIONS = {
  islas: { id: 'islas', name: 'Islas del Castillo', map: 'castillo', first: 'portal', zones: { portal: PORTAL, jardin: JARDIN, ruinas: RUINAS }, boss: 'solaris', reward: { coins: 150, item: 'pocion' },
    win: '¡Has vencido al Guardián del Castillo!', again: 'Ya venciste al Guardián del Castillo. Puedes volver a por lo que dejaste.',
    tint: 'rgba(26, 34, 118, .24)', motes: 'fireflies' },
  forja: { id: 'forja', name: 'Forja Volcánica', map: 'volcan', first: 'ceniza', zones: { ceniza: CENIZA, fundicion: FUNDICION, ladera: LADERA }, tint: 'rgba(120, 28, 6, .2)', motes: 'embers',
    // La historia de la región: tres sellos abren la puerta del jefe. `discover` esconde las marcas de lo que hay hasta que te acercas.
    discover: true, reward: { coins: 250, item: 'pocion', again: 60 },
    intro: 'Tres sellos cierran la puerta del volcán. Reúnelos, ábrela y vence al Señor de la Forja. La vida no se recupera entre combates.',
    win: '¡Has vencido al Señor de la Forja!', again: 'Ya venciste al Señor de la Forja. Puedes volver a por lo que dejaste.',
    quest: {
      start: 'Habla con Brasa, junto al portal.',
      elite: 'Vence al guardián del sello, al otro lado del río de lava de la isla de ceniza.',
      ask: 'Pregunta por el sello al herrero de la fundición, al norte.',
      fetch: 'Carbón para el herrero',
      bring: 'Lleva el carbón al herrero.',
      seek: 'Busca una pista del sello perdido en la ladera del volcán, al este.',
      clue: 'El sello perdido está donde la tierra respira, entre las púas del sur de la ladera.',
      door: 'Lleva los tres sellos a la puerta de la ladera del volcán.',
      boss: 'Vence al Señor de la Forja.',
      done: 'Venciste al Señor de la Forja. Puedes seguir explorando a tu aire.',
    } },
  tundra: { id: 'tundra', name: 'Tundra de la Aurora', map: 'aurora', first: 'nevada', zones: { nevada: NEVADA, cristal: CRISTAL, observatorio: OBSERVATORIO }, tint: 'rgba(30, 70, 170, .2)', motes: 'snow' },
};

export const REST_HEAL = 0.5;

export const regionOf = g => (g.adv ? REGIONS[g.adv.region] : null);
export const zoneOf = g => (g.adv ? REGIONS[g.adv.region].zones[g.adv.zone] : null);
export const cleared = (g, region) => (g.advCleared || {})[region] || 0;
// De qué nivel a qué nivel son las bestias salvajes de una región.
export function levels(region) {
  const all = Object.values(REGIONS[region].zones).flatMap(z => z.pois.filter(p => p.type === 'wild' || p.type === 'boss').map(p => p.level));
  return [Math.min(...all), Math.max(...all)];
}

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
  const q = questOf(g, g.adv.region);
  if (['exit', 'gate', 'sign', 'npc', 'clue'].includes(poi.type)) return true;
  if (poi.type === 'chest') return !(g.advChests || []).includes(`${g.adv.region}:${poi.id}`);
  if (poi.type === 'door') return !q.door;
  if (poi.type === 'seal') return !q.seals.includes(poi.id);
  if (poi.type === 'coal') return !!q.smith && !q.coal.includes(poi.id);     // el carbón solo importa cuando el herrero lo pide
  if (poi.seal && q.seals.includes(poi.id)) return false;                    // la élite que ya te dio su sello
  if (poi.locked && !q.door) return false;                                   // el jefe, mientras la puerta siga cerrada
  return !g.adv.done.includes(poi.id);
}

// ---------- La historia de una región: sellos, encargo, puerta y jefe ----------

const EMPTY = { seals: [], coal: [] };
export const questOf = (g, region) => g.advQuest?.[region] || EMPTY;
const questW = (g, region) => ((g.advQuest ||= {})[region] ||= { seals: [], coal: [] });
// Quién da cada sello en una región: la élite, el herrero y el que está escondido.
function parts(region) {
  const all = Object.values(REGIONS[region].zones).flatMap(z => z.pois);
  return { elite: all.find(p => p.type === 'wild' && p.seal), smith: all.find(p => p.type === 'npc' && p.role === 'smith'), hidden: all.find(p => p.type === 'seal'), coal: all.filter(p => p.type === 'coal') };
}
// Cuántos sellos llevas y cuántos hay; null si la región no tiene historia.
export function seals(g, region) {
  if (!REGIONS[region].quest) return null;
  const p = parts(region);
  return { found: questOf(g, region).seals.length, total: [p.elite, p.smith, p.hidden].filter(Boolean).length };
}
// El diario: qué toca hacer ahora en la región de la expedición. Lista de frases (vacía si no hay historia).
export function objective(g) {
  const r = regionOf(g), t = r?.quest;
  if (!t) return [];
  const q = questOf(g, r.id), p = parts(r.id), s = seals(g, r.id), has = poi => poi && q.seals.includes(poi.id);
  if (cleared(g, r.id)) return [t.done];
  if (q.door) return [t.boss];
  if (s.found >= s.total) return [t.door];
  if (!q.started && !q.seals.length && !q.smith && !q.clue) return [t.start];
  const out = [];
  if (p.elite && !has(p.elite)) out.push(t.elite);
  if (p.smith && !has(p.smith)) out.push(!q.smith ? t.ask : q.coal.length < p.coal.length ? `${t.fetch}: ${q.coal.length} de ${p.coal.length}` : t.bring);
  if (p.hidden && !has(p.hidden)) out.push(q.clue ? t.clue : t.seek);
  return out;
}
// Hablar con un personaje. Devuelve { text: [frases], seal } y apunta lo que cambie.
export function talk(g, poi) {
  const r = regionOf(g), q = questW(g, r.id), say = poi.say;
  if (poi.role === 'smith') {
    if (q.seals.includes(poi.id)) return { text: say.after };
    if (!q.smith) { q.smith = true; return { text: say.first }; }
    if (q.coal.length < parts(r.id).coal.length) return { text: say.wait };
    q.seals.push(poi.id);
    return { text: say.give, seal: true };
  }
  if (cleared(g, r.id)) return { text: say.done };
  if (!q.started) { q.started = true; return { text: say.first }; }
  if (q.door) return { text: say.open };
  const s = seals(g, r.id);
  return { text: s.found >= s.total ? say.ready : say.more };
}
export function takeCoal(g, poi) {
  if (!active(g, poi)) return null;
  const q = questW(g, g.adv.region);
  q.coal.push(poi.id);
  return { have: q.coal.length, need: parts(g.adv.region).coal.length };
}
export function takeSeal(g, poi) {
  if (!active(g, poi)) return false;
  questW(g, g.adv.region).seals.push(poi.id);
  return true;
}
export function readClue(g) { questW(g, g.adv.region).clue = true; }
// Llamar a la puerta: se abre (para siempre) si llevas todos los sellos.
export function openDoor(g) {
  const s = seals(g, g.adv.region);
  if (s.found < s.total) return { open: false, ...s };
  questW(g, g.adv.region).door = true;
  return { open: true, ...s };
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

// En qué forma sale una bestia del mapa: la que diga el punto o la que toque por su nivel.
export const stageOf = poi => poi.stage ?? (poi.level >= 30 ? 2 : poi.level >= 10 ? 1 : 0);

// La bestia salvaje de un punto del mapa: nivel y forma fijos, con las estadísticas que tendría una criada hasta ese nivel.
export function makeWild(poi) {
  const sp = speciesOf(poi.species), stats = { pot: sp.base[0], agu: sp.base[1], pun: sp.base[2], agi: sp.base[3] };
  const best = STATS[sp.base.indexOf(Math.max(...sp.base))];
  for (let lv = 1; lv < poi.level; lv++) { stats[best]++; stats[STATS[lv % 4]]++; }
  const boss = poi.type === 'boss';
  if (boss) { stats.agu += 4; stats.pot += 1; }
  if (poi.seal) { stats.agu += 2; stats.pot += 1; }                           // la élite aguanta y pega algo más
  const stage = stageOf(poi);
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
  if (poi.type !== 'boss') {
    if (!poi.seal) return { over: false };
    questW(g, g.adv.region).seals.push(poi.id);                               // la élite suelta su sello
    return { over: false, seal: true };
  }
  const region = REGIONS[g.adv.region], first = !cleared(g, region.id);
  (g.advCleared ||= {})[region.id] = cleared(g, region.id) + 1;
  g.adv = null;
  if (!first) { const coins = region.reward?.again || 0; g.coins += coins; return { over: true, boss: true, coins }; }   // repetir da solo unas monedas
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
  const bridge = zone.bridges.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
  if (!bridge && (!inPolygon(zone.ground, x, y) || zone.holes?.some(h => inPolygon(h, x, y)))) return false;
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
