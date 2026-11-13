// Cuenta del jugador: entrar con correo o wallet de Solana a través de Privy.
// La parte de Privy (React) está compilada en cuenta/ y solo se descarga si hay un App ID configurado,
// y después de que el juego haya cargado, para no retrasarlo.
// De momento la cuenta solo identifica al jugador: la partida sigue guardándose en el dispositivo.

import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from './config.js';
import { tr } from './i18n.js';

// state: 'off' (sin configurar) · 'loading' · 'ready' · 'failed'.   user: null o { id, email, wallet, embedded }
export const account = { state: PRIVY_APP_ID ? 'loading' : 'off', user: null };

const listeners = new Set();
let api = null, started = false;
const tell = () => { for (const cb of listeners) cb(account); };

export function onAccount(cb) { listeners.add(cb); cb(account); }

export async function startAccount() {
  if (account.state === 'off' || started) return;
  started = true;
  const giveUp = setTimeout(() => { if (account.state === 'loading') { account.state = 'failed'; tell(); } }, 20000);
  try {
    const { mount } = await import('./cuenta/cuenta.js');
    api = mount({
      appId: PRIVY_APP_ID, clientId: PRIVY_CLIENT_ID,
      header: tr('Entra en Beast Bound'), message: tr('Con tu correo o tu wallet de Solana.'),
      onState: ({ ready, user }) => {
        if (!ready) return;
        clearTimeout(giveUp);
        account.state = 'ready'; account.user = user;
        tell();
      },
    });
  } catch (err) {
    console.error(err);
    clearTimeout(giveUp);
    account.state = 'failed';
    tell();
  }
}

export const login = () => api?.login();
export const logout = () => api?.logout();
export const accessToken = () => (api ? api.token() : Promise.resolve(null));   // para identificarse ante nuestro servidor

// «7xKX…9fQa»: una wallet abreviada para enseñarla.
export const shortWallet = address => (address && address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address || '');
