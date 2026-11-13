// Partida en la nube: la partida vive en la cuenta del jugador, en nuestro servidor (carpeta servidor/), y es él
// quien la lleva. El juego aplica cada acción al momento y la apunta; cada poco envía lo apuntado, el servidor lo
// repite con sus reglas y su reloj y devuelve la partida buena, que sustituye a la de aquí.
//
// En el ordenador de desarrollo: ?invitado=nombre entra sin Privy y ?nube usa el servidor local (npm run dev en servidor/).
// Un invitado sin ?nube juega sin servidor: las acciones se aplican aquí y la partida se guarda en el navegador.

import { API_URL } from './config.js';
import { account, accessToken } from './account.js';
import * as S from './state.js';
import { apply, pulse } from './acciones.js';

const params = new URLSearchParams(globalThis.location?.search || '');
export const DEV = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);
export const guest = DEV && params.has('invitado') ? `dev:${(params.get('invitado') || 'invitado').replace(/[^\w-]/g, '') || 'invitado'}` : '';
// En desarrollo: ?nube usa el servidor local; un invitado sin ?nube juega sin nube (el servidor real no acepta invitados).
const base = DEV && params.has('nube') ? 'http://localhost:8787' : guest ? '' : API_URL;

// status: '' (nada que contar) · 'saving' · 'saved' · 'offline'
export const cloud = { on: !!base, rev: 0, status: '' };
export const me = () => guest || account.user?.id || '';

const MAX_BATCH = 200;
const queue = [];                                      // acciones aplicadas aquí que el servidor aún no ha confirmado
let timer = 0, busy = false, hooks = {}, live = null;  // live: la partida en juego
export function watchCloud(h) { hooks = h; }
const setStatus = s => { if (cloud.status !== s) { cloud.status = s; hooks.status?.(); } };
const wait = ms => new Promise(done => setTimeout(done, ms));
const plan = (ms = 2500) => { if (!timer) timer = setTimeout(flush, ms); };   // lo apuntado sale junto, cada pocos segundos
const stamp = game => Math.max(S.at(), game?.clock || 0);   // la hora de una acción: nunca anterior a la última

async function call(method, path, body, keepalive = false) {
  const token = guest || await accessToken();
  const res = await fetch(base + path, {
    method, keepalive,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, json };
}
// La hora del servidor, vista desde aquí. Se queda un pelo por detrás (lo que tarda la respuesta), nunca por delante.
const setClock = serverNow => { if (Number.isFinite(serverNow)) S.clock.offset = serverNow - Date.now(); };

// La partida de la cuenta: { save, profile } (save es null si aún no tiene). Lanza un error si el servidor no responde.
export async function pull() {
  queue.length = 0;
  const r = await call('GET', '/partida');
  if (r.status === 404) { cloud.rev = 0; setClock(r.json?.now); return { save: null, profile: null }; }
  if (r.status !== 200) throw new Error('nube ' + r.status);
  cloud.rev = r.json.rev;
  setClock(r.json.now);
  setStatus(r.json.save ? 'saved' : '');
  return r.json;
}

// Hace algo en la partida: se aplica aquí al momento y, con la partida en la nube, queda apuntado para el servidor.
// Devuelve lo que devuelva la regla.
export function act(game, kind, ...args) {
  live = game;
  const t = stamp(game), out = apply(game, kind, args, t);
  if (cloud.on) { queue.push({ k: kind, a: args, t }); plan(); }
  return out;
}

// Deja pasar el tiempo. Solo se apunta si con ello ha cambiado algo de golpe (un deseo, despertarse, un día nuevo).
export function tickNow(game) {
  live = game;
  const t = stamp(game), before = pulse(game);
  apply(game, 'tick', [], t);
  if (cloud.on && pulse(game) !== before) { queue.push({ k: 'tick', a: [], t }); plan(); }
}

// La partida buena llega del servidor: sustituye a la de aquí y encima se repite lo que aún no se le ha enviado.
function settle(json) {
  cloud.rev = json.rev;
  setClock(json.now);
  setStatus('saved');
  if (!json.save) return;
  if (json.resync) queue.length = 0;                   // el servidor no dio por buena alguna acción: manda su partida
  live = hooks.adopt?.(json.save, json.conflict ? 'conflict' : json.resync ? 'resync' : '') || live;
  if (!live) return;
  const news = live.news;
  for (const a of queue) { try { apply(live, a.k, a.a, a.t); } catch { /* ya no tiene sentido sobre la partida buena */ } }
  live.news = news;                                    // los avisos de lo repetido ya se enseñaron
}

async function post(batch, keepalive = false) {
  const r = await call('POST', '/acciones', { rev: cloud.rev, actions: batch }, keepalive);
  if (r.status === 200) { queue.splice(0, batch.filter(a => queue.includes(a)).length); settle(r.json); }
  else if (r.status === 409 && r.json?.save) { queue.length = 0; settle({ ...r.json, resync: true, conflict: true }); }   // otro dispositivo jugó antes
  return r;
}

// Envía ya lo apuntado. `keepalive` es para cuando la página se está cerrando.
export async function flush(keepalive = false) {
  clearTimeout(timer); timer = 0;
  if (!cloud.on || busy || !queue.length) return;
  busy = true;
  setStatus('saving');
  let retry = 1200;
  try {
    const r = await post(queue.slice(0, MAX_BATCH), keepalive === true);
    if (r.status === 429) setStatus('saved');
    else if (r.status !== 200 && r.status !== 409) throw new Error('nube ' + r.status);
  } catch {
    setStatus('offline');                              // sin red: se reintenta
    retry = 8000;
  }
  busy = false;
  if (queue.length) plan(retry);
}

// Algo que sortea el servidor (abrir un huevo, comprar uno): se envía ya, con lo que hubiera apuntado, y se espera
// la respuesta. Devuelve lo que devuelva la regla, o { error } si no hay conexión.
export async function ask(game, kind, ...args) {
  if (!cloud.on) return act(game, kind, ...args);
  live = game;
  const failed = { error: 'No se pudo guardar. Inténtalo de nuevo.' };
  while (busy) await wait(60);
  clearTimeout(timer); timer = 0;
  busy = true;
  setStatus('saving');
  try {
    while (queue.length > MAX_BATCH - 1) { const r = await post(queue.slice(0, MAX_BATCH)); if (r.status !== 200) return failed; }
    const batch = [...queue, { k: kind, a: args, t: stamp(game) }];
    for (let tries = 0; tries < 4; tries++) {
      const r = await post(batch);
      if (r.status === 429) { await wait(900); continue; }
      if (r.status !== 200) break;
      return r.json.resync ? failed : r.json.result ?? null;
    }
    setStatus('saved');
    return failed;
  } catch {
    setStatus('offline');
    return failed;
  } finally {
    busy = false;
    if (queue.length) plan();
  }
}

// Al salir de la cuenta no queda nada pendiente de otra persona.
export function forget() { clearTimeout(timer); timer = 0; queue.length = 0; live = null; cloud.rev = 0; cloud.status = ''; }

// Empezar de cero también en la cuenta.
export async function wipe() {
  clearTimeout(timer); timer = 0; queue.length = 0; live = null;
  try { const r = await call('DELETE', '/partida'); if (r.status === 200) { cloud.rev = r.json.rev; setStatus(''); return true; } } catch { /* sin red */ }
  return false;
}

// Usuario y país. Devuelve 'ok', 'taken' (ya existe) o 'error'.
export async function saveProfile(name, country) {
  try { const r = await call('PUT', '/perfil', { name, country }); return r.status === 200 ? 'ok' : r.status === 409 ? 'taken' : 'error'; } catch { return 'error'; }
}

// Los primeros del ranking, o null si el servidor no responde.
export async function fetchRanking(sort) {
  try { const r = await call('GET', '/ranking?sort=' + encodeURIComponent(sort)); return r.status === 200 ? r.json.rows : null; } catch { return null; }
}
