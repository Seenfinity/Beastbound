// Inicio de sesión con Privy (Google, correo o wallet de Solana; los métodos se activan en el panel de Privy). Privy solo se ofrece para React, así que esta pieza
// es una isla de React sin interfaz propia: monta el proveedor y pasa al juego el estado de la cuenta.
// El juego (JavaScript normal) la usa a través de lo que devuelve mount().
import { createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider, usePrivy, useLogin } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

// Lo que el juego necesita saber de quien ha entrado.
function summary(user) {
  const wallets = (user.linkedAccounts || []).filter(a => a.type === 'wallet' && a.chainType === 'solana');
  const wallet = wallets.find(w => w.walletClientType !== 'privy') || wallets[0];   // primero la suya; si no, la que le crea Privy
  return { id: user.id, email: user.email?.address || user.google?.email || '', wallet: wallet?.address || '', embedded: !!wallet && wallet.walletClientType === 'privy' };
}

function Bridge({ api, onState }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { login } = useLogin();
  api.login = () => { if (ready && !authenticated) login(); };
  api.logout = () => (authenticated ? logout() : Promise.resolve());
  api.token = () => (authenticated ? getAccessToken() : Promise.resolve(null));
  useEffect(() => { onState({ ready, user: ready && authenticated && user ? summary(user) : null }); }, [ready, authenticated, user]);
  return null;
}

// Arranca Privy. onState({ ready, user }) se llama cada vez que cambia la cuenta.
export function mount({ appId, clientId, header, message, accent = '#ffc83d', onState }) {
  const api = { login() {}, logout: () => Promise.resolve(), token: () => Promise.resolve(null) };
  const box = document.createElement('div');
  box.id = 'privy-island';
  box.setAttribute('translate', 'no');
  document.body.append(box);
  document.body.style.setProperty('--privy-color-accent', accent);
  const config = {
    appearance: { theme: 'dark', logo: '', landingHeader: header, loginMessage: message, walletChainType: 'solana-only', showWalletLoginFirst: false },
    embeddedWallets: { solana: { createOnLogin: 'users-without-wallets' } },
    externalWallets: { solana: { connectors: toSolanaWalletConnectors({ shouldAutoConnect: false }) } },
  };
  createRoot(box).render(h(PrivyProvider, { appId, ...(clientId ? { clientId } : {}), config }, h(Bridge, { api, onState })));
  return api;
}
