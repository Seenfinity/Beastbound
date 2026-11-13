// Base de datos (Postgres): una fila por jugador, con su partida entera y las cifras del ranking aparte.
// `pool` es un Pool de pg (o algo con el mismo query(), como el de las pruebas).

export async function migrate(pool) {
  await pool.query(`create table if not exists players (
    id text primary key,
    username text,
    username_key text unique,
    country text not null default '',
    save jsonb,
    level integer not null default 1,
    coins integer not null default 0,
    wins integer not null default 0,
    losses integer not null default 0,
    test_mode boolean not null default true,
    rev integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
}

export async function getPlayer(pool, id) {
  const { rows } = await pool.query('select id, username, country, save, rev, updated_at from players where id = $1', [id]);
  return rows[0] || null;
}

// Guarda la partida si `rev` es la versión que el jugador tenía. Devuelve { rev } o { conflict: fila actual }.
export async function putSave(pool, id, save, stats, rev) {
  const current = await getPlayer(pool, id);
  const values = [JSON.stringify(save), stats.level, stats.coins, stats.wins, stats.losses, stats.testMode];
  if (!current) {
    await pool.query('insert into players (id, save, level, coins, wins, losses, test_mode, rev) values ($7, $1, $2, $3, $4, $5, $6, 1)', [...values, id]);
    return { rev: 1 };
  }
  if (current.save && current.rev !== rev) return { conflict: current };
  const out = await pool.query('update players set save = $1, level = $2, coins = $3, wins = $4, losses = $5, test_mode = $6, rev = rev + 1, updated_at = now() where id = $7 and rev = $8',
    [...values, id, current.rev]);
  if (!out.rowCount) return { conflict: await getPlayer(pool, id) };
  return { rev: current.rev + 1 };
}

// Empezar de cero: quita la partida y deja el perfil.
export async function clearSave(pool, id) {
  await pool.query('update players set save = null, level = 1, coins = 0, wins = 0, losses = 0, rev = rev + 1, updated_at = now() where id = $1', [id]);
  const p = await getPlayer(pool, id);
  return p ? p.rev : 0;
}

// Usuario y país. Devuelve false si el usuario ya es de otro jugador.
export async function setProfile(pool, id, username, country) {
  const key = username.toLowerCase();
  const taken = await pool.query('select id from players where username_key = $1 and id <> $2', [key, id]);
  if (taken.rows.length) return false;
  try {
    const out = await pool.query('update players set username = $1, username_key = $2, country = $3 where id = $4', [username, key, country, id]);
    if (!out.rowCount) await pool.query('insert into players (id, username, username_key, country) values ($1, $2, $3, $4)', [id, username, key, country]);
    return true;
  } catch (err) {
    if (err.code === '23505') return false;             // otro jugador lo cogió justo a la vez
    throw err;
  }
}

const SORTS = { level: 'level', coins: 'coins', wins: 'wins' };
export async function ranking(pool, sort, limit = 50) {
  const col = SORTS[sort] || 'level';
  const { rows } = await pool.query(`select id, username, country, level, coins, wins, losses from players
    where username is not null and save is not null and test_mode = false
    order by ${col} desc, wins desc, level desc, username asc limit ${Math.max(1, Math.min(100, limit | 0))}`);
  return rows;
}
