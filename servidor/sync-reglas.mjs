// Copia al servidor las reglas del juego (son las mismas en los dos sitios; las que se editan son las de www/js).
// Uso: node sync-reglas.mjs           copia
//      node sync-reglas.mjs --check   solo comprueba que las copias están al día (para las pruebas)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), from = join(here, '..', 'www', 'js'), to = join(here, 'reglas');
export const FILES = ['state.js', 'roster.js', 'events.js', 'aventura.js', 'acciones.js'];
const check = process.argv.includes('--check');
const note = '// COPIA: este archivo se genera desde www/js con «node sync-reglas.mjs». No lo edites aquí.\n';
let stale = 0;
if (!existsSync(from)) { console.log('Sin www/js a mano (así se despliega): se usan las copias que hay.'); process.exit(0); }
mkdirSync(to, { recursive: true });
for (const f of FILES) {
  const want = note + readFileSync(join(from, f), 'utf8');
  const have = existsSync(join(to, f)) ? readFileSync(join(to, f), 'utf8') : '';
  if (want === have) continue;
  stale++;
  if (!check) writeFileSync(join(to, f), want);
  console.log(`${check ? 'DESFASADA' : 'copiada'} reglas/${f}`);
}
if (check && stale) { console.log('Las reglas del servidor no están al día: ejecuta «node sync-reglas.mjs».'); process.exit(1); }
console.log(stale ? `${stale} archivo(s) ${check ? 'por copiar' : 'copiados'}` : 'Las reglas del servidor están al día');
