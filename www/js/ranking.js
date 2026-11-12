// Ranking mundial: nivel, oro y combates de cada jugador, con su usuario y su país.
// Todavía no hay servidor ni cuentas, así que la única fila real es la tuya.
// Cuando llegue el registro, fetchRanking y submitScore hablarán con el servidor y lo demás no cambia.

export const COUNTRIES = [
  ['AR', 'Argentina'], ['BO', 'Bolivia'], ['BR', 'Brasil'], ['CL', 'Chile'], ['CO', 'Colombia'], ['CR', 'Costa Rica'], ['CU', 'Cuba'],
  ['EC', 'Ecuador'], ['SV', 'El Salvador'], ['ES', 'España'], ['US', 'Estados Unidos'], ['GT', 'Guatemala'], ['HN', 'Honduras'], ['MX', 'México'],
  ['NI', 'Nicaragua'], ['PA', 'Panamá'], ['PY', 'Paraguay'], ['PE', 'Perú'], ['PR', 'Puerto Rico'], ['DO', 'República Dominicana'], ['UY', 'Uruguay'], ['VE', 'Venezuela'],
  ['DE', 'Alemania'], ['AU', 'Australia'], ['CA', 'Canadá'], ['CN', 'China'], ['KR', 'Corea del Sur'], ['PH', 'Filipinas'], ['FR', 'Francia'], ['IN', 'India'],
  ['ID', 'Indonesia'], ['IT', 'Italia'], ['JP', 'Japón'], ['NG', 'Nigeria'], ['NL', 'Países Bajos'], ['PL', 'Polonia'], ['PT', 'Portugal'], ['GB', 'Reino Unido'],
  ['TR', 'Turquía'], ['VN', 'Vietnam'],
];
export const countryName = code => COUNTRIES.find(c => c[0] === code)?.[1] || '';
// La bandera es un emoji que se forma con las dos letras del país.
export const flag = code => (/^[A-Z]{2}$/.test(code || '') ? String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🏳️');

export const SORTS = { level: 'Nivel', coins: 'Oro', wins: 'Victorias' };
export const validName = name => /^[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ]{3,16}$/.test(name || '');

// Lo que cuenta de tu partida: el nivel de tu mejor bestia, tu oro y tus combates.
export const myStats = g => ({ level: Math.max(1, ...g.pets.map(p => p.level)), coins: g.coins, wins: g.wins || 0, losses: g.losses || 0 });

// Filas de muestra para ver cómo quedará la tabla. No son jugadores reales y la pantalla las marca como «ejemplo».
export const EXAMPLES = [
  ['LunaPixel', 'MX', 34, 5210, 88, 41], ['TioGravion', 'ES', 31, 3980, 120, 97], ['Kira_07', 'AR', 28, 7400, 64, 30], ['DonVoltix', 'CO', 22, 1850, 51, 44],
  ['MapacheAzul', 'CL', 19, 2630, 39, 35], ['Sombra99', 'PE', 15, 940, 27, 31], ['NubeRosa', 'JP', 12, 1320, 18, 12], ['ElFenix', 'US', 9, 610, 11, 16],
].map(([name, country, level, coins, wins, losses]) => ({ name, country, level, coins, wins, losses, demo: true }));

// Sin servidor todavía: no hay más jugadores que tú.
export async function fetchRanking() { return []; }
export async function submitScore() { return false; }

// Ordena la tabla por una columna (desempata con las victorias y luego el nivel) y numera los puestos.
export function buildBoard(rows, sort = 'level') {
  return [...rows]
    .sort((a, b) => b[sort] - a[sort] || b.wins - a.wins || b.level - a.level || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
