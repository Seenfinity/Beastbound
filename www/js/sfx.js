// Efectos de sonido sintetizados: no hay archivos de audio, se generan al vuelo.

const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
let ctx = null, noiseBuf = null, muted = false, hushed = false;   // hushed: silencio solo en esta página, sin tocar el ajuste guardado
try { muted = localStorage.getItem('petbound-mute') === '1'; } catch { /* sin almacenamiento */ }

// El navegador solo deja sonar tras un gesto del usuario; se crea en la primera llamada.
function audio() {
  if (!AC || muted || hushed) return null;
  if (!ctx) {
    ctx = new AC();
    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Una nota: frecuencia inicial, duración y, opcionalmente, frecuencia final (para barridos).
function tone(freq, dur, { type = 'square', vol = 0.06, to = 0, at = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

// Ruido filtrado: golpes, mordiscos y explosiones.
function noise(dur, { vol = 0.12, freq = 900, at = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination);
  s.start(t); s.stop(t + dur + 0.02);
}

const seq = (notes, step, opts = {}) => notes.forEach((n, i) => tone(n, step * 1.4, { ...opts, at: (opts.at || 0) + i * step }));

export const sfx = {
  tap: () => tone(660, 0.05, { vol: 0.04 }),
  heart: () => { tone(880, 0.09, { type: 'sine', vol: 0.07 }); tone(1320, 0.12, { type: 'sine', vol: 0.06, at: 0.07 }); },
  eat: () => [0, 0.11, 0.22].forEach(at => noise(0.06, { vol: 0.08, freq: 1400, at })),
  yuck: () => tone(220, 0.25, { type: 'sawtooth', vol: 0.05, to: 120 }),
  throw: () => tone(300, 0.18, { type: 'triangle', vol: 0.07, to: 700 }),
  bounce: () => tone(180, 0.07, { type: 'triangle', vol: 0.06, to: 90 }),
  catch: () => seq([660, 880], 0.07, { type: 'triangle', vol: 0.07 }),
  coin: () => seq([988, 1319], 0.06, { vol: 0.05 }),
  error: () => tone(160, 0.16, { type: 'sawtooth', vol: 0.05 }),
  good: () => seq([523, 659, 784], 0.07, { vol: 0.05 }),
  bad: () => seq([330, 262], 0.12, { type: 'sawtooth', vol: 0.05 }),
  level: () => seq([523, 659, 784, 1047], 0.08, { vol: 0.06 }),
  evolve: () => seq([392, 523, 659, 784, 1047, 1319], 0.1, { type: 'triangle', vol: 0.08 }),
  rise: () => { tone(150, 3.3, { type: 'sawtooth', vol: 0.045, to: 1500 }); tone(75, 3.3, { type: 'sine', vol: 0.08, to: 300 }); },
  reveal: () => { noise(0.6, { vol: 0.24, freq: 1200 }); seq([523, 659, 784, 1047, 1319, 1568], 0.11, { type: 'triangle', vol: 0.08, at: 0.15 }); },
  hatch: () => { noise(0.12, { vol: 0.1, freq: 2500 }); seq([659, 880, 1175], 0.09, { type: 'triangle', vol: 0.07, at: 0.05 }); },
  shoot: () => { noise(0.12, { vol: 0.1, freq: 1800 }); tone(420, 0.16, { vol: 0.05, to: 140 }); },
  special: () => { tone(200, 0.3, { type: 'sawtooth', vol: 0.06, to: 900 }); noise(0.2, { vol: 0.08, freq: 3000 }); },
  boom: () => { noise(0.45, { vol: 0.22, freq: 700 }); tone(90, 0.3, { type: 'sine', vol: 0.14, to: 40 }); },
  hurt: () => tone(260, 0.12, { vol: 0.05, to: 130 }),
  turn: () => tone(784, 0.08, { type: 'triangle', vol: 0.05 }),
  win: () => seq([523, 659, 784, 1047, 784, 1047], 0.11, { vol: 0.07 }),
  lose: () => seq([392, 330, 262, 196], 0.16, { type: 'triangle', vol: 0.07 }),
};

export const isMuted = () => muted;
export const hush = value => { hushed = value; };
export function setMuted(value) {
  muted = value;
  try { localStorage.setItem('petbound-mute', value ? '1' : '0'); } catch { /* sin almacenamiento */ }
}
