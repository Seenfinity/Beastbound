// Partida en la nube: la partida vive en la cuenta del jugador, en nuestro servidor (carpeta servidor/).
// Al entrar se descarga; mientras se juega, cada guardado se sube solo (como mucho cada 15 segundos).
// El navegador guarda además una copia, para no depender de la red en cada instante.
//
// En el ordenador de desarrollo: ?invitado=nombre entra sin Privy y ?nube usa el servidor local (npm run dev en servidor/).

import { API_URL } from './config.js';
import { account, accessToken } from './account.js';

const params = new URLSearchParams(globalThis.location?.search || '');
export const DEV = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);
export const guest = DEV && params.has('invitado') ? `dev:${(params.get('invitado') || 'invitado').replace(/[^\w-]/g, '') || 'invitado'}` : '';
const base = DEV && params.has('nube') ? 'http://localhost:8787' : API_URL;

// status: '' (nada que contar) · 'saving' · 'saved' · 'offline'
export const cloud = { on: !!base, rev: 0, status: '' };
export const me = () => guest || account.user?.id || '';

let dirty = null, timer = 0, busy = false, lastPush = 0, hooks = {};
export function watchCloud(h) { hooks = h; }
const setStatus = s => { if (cloud.status !== s) { cloud.status = s; hooks.status?.(); } };

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

// La partida de la cuenta: { save, profile } (save es null si aún no tiene). Lanza un error si el servidor no responde.
export async function pull() {
  const r = await call('GET', '/partida');
  if (r.status === 404) { cloud.rev = 0; return { save: null, profile: null }; }
  if (r.status !== 200) throw new Error('nube ' + r.status);
  cloud.rev = r.json.rev;
  setStatus(r.json.save ? 'saved' : '');
  return r.json;
}

// Hay cambios: se subirán dentro de un momento.
export function touch(game) {
  if (!cloud.on || !game?.pet || !me()) return;
  game.owner = me();                                   // de quién es la copia que queda en este navegador
  dirty = game;
  if (!timer) timer = setTimeout(flush, Math.max(3000, 15000 - (Date.now() - lastPush)));
}

// Sube ya lo pendiente. `keepalive` es para cuando la página se está cerrando.
export async function flush(keepalive = false) {
  clearTimeout(timer); timer = 0;
  if (!dirty || busy) return;
  const game = dirty;
  dirty = null; busy = true;
  setStatus('saving');
  try {
    const r = await call('PUT', '/partida', { save: game, rev: cloud.rev }, keepalive === true);
    lastPush = Date.now();
    if (r.status === 200) { cloud.rev = r.json.rev; setStatus('saved'); }
    else if (r.status === 409) { cloud.rev = r.json.rev; dirty = null; setStatus('saved'); hooks.conflict?.(r.json.save); }   // otro dispositivo guardó antes: manda la suya
    else if (r.status === 429) { dirty ||= game; setStatus('saved'); }
    else throw new Error('nube ' + r.status);
  } catch {
    dirty ||= game;                                    // sin red: se reintenta
    setStatus('offline');
  }
  busy = false;
  if (dirty && !timer) timer = setTimeout(flush, 15000);
}

// Al salir de la cuenta no queda nada pendiente de otra persona.
export function forget() { clearTimeout(timer); timer = 0; dirty = null; cloud.rev = 0; cloud.status = ''; }

// Empezar de cero también en la cuenta.
export async function wipe() {
  clearTimeout(timer); timer = 0; dirty = null;
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
