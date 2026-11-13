// Quién llama: se comprueba la firma del token de sesión de Privy con sus claves públicas (no hace falta ninguna clave secreta).
import { createRemoteJWKSet, jwtVerify } from 'jose';

export function privyVerifier(appId) {
  const keys = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));
  return async token => {
    const { payload } = await jwtVerify(token, keys, { issuer: 'privy.io', audience: appId });
    if (!payload.sub) throw new Error('token sin usuario');
    return payload.sub;                                 // el identificador del jugador en Privy (did:privy:…)
  };
}

// Solo para desarrollo en local: acepta «dev:nombre» como token, sin Privy.
export const devVerifier = real => async token => (token.startsWith('dev:') && /^dev:[\w-]{1,40}$/.test(token) ? token : real(token));
