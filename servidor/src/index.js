// Arranque: lee la configuración del entorno, conecta con Postgres y escucha.
//   PRIVY_APP_ID   el App ID de Privy (público)
//   DATABASE_URL   la dirección de Postgres (en Railway la pone el propio Railway)
//   ORIGENES       opcional: webs que pueden llamar, separadas por comas
//   PORT           lo pone Railway
import http from 'node:http';
import { createApp } from './app.js';
import { migrate } from './db.js';
import { privyVerifier, devVerifier } from './auth.js';

const { PRIVY_APP_ID, DATABASE_URL, PORT = 8787 } = process.env;
const onRailway = !!process.env.RAILWAY_ENVIRONMENT;
const dev = !onRailway && process.env.DEV_AUTH === '1';     // en Railway nunca se acepta el modo de desarrollo
const origins = (process.env.ORIGENES || 'https://www.beastbound.fun,https://beastbound.fun,https://beastbound-six.vercel.app,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

if (!PRIVY_APP_ID && !dev) throw new Error('Falta PRIVY_APP_ID');

let pool;
if (dev && process.env.DEV_DB === 'mem') {
  const { newDb } = await import('pg-mem');              // base de datos en memoria: se pierde al parar
  pool = new (newDb({ noAstCoverageCheck: true }).adapters.createPg().Pool)();
} else {
  if (!DATABASE_URL) throw new Error('Falta DATABASE_URL');
  const { default: pg } = await import('pg');
  pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5, ssl: /railway\.internal|localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false } });
}
await migrate(pool);

const real = PRIVY_APP_ID ? privyVerifier(PRIVY_APP_ID) : async () => { throw new Error('sin Privy'); };
const app = createApp({ pool, verify: dev ? devVerifier(real) : real, origins });
http.createServer(app).listen(PORT, '0.0.0.0', () => console.log(`Servidor de Beast Bound en el puerto ${PORT}${dev ? ' (modo desarrollo)' : ''}`));
