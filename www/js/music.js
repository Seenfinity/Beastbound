// Música de combate sintetizada: no hay archivos de audio, un pequeño secuenciador la toca al vuelo.
// Cada mapa tiene su tema (tono, ritmo e instrumentos propios) y se acelera cuando el combate aprieta.

const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
let ctx = null, master = null, noiseBuf = null, timer = null;
let song = null, step = 0, nextTime = 0, intensity = 0, enabled = true;
try { enabled = localStorage.getItem('petbound-music') !== '0'; } catch { /* sin almacenamiento */ }

const VOLUME = 0.5;
const MAJOR = [0, 2, 4, 5, 7, 9, 11], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10], LYDIAN = [0, 2, 4, 6, 7, 9, 11];

// Notación: la melodía y el bajo van en corcheas (8 por compás); el arpegio y la batería, en semicorcheas (16).
// Melodía: grado de la escala (0 = tónica), "-" mantiene la nota, "." silencio.
// prog: grado sobre el que se construye el acorde de cada compás.
const SONGS = {
  // Islas del Castillo: aventura heroica, luminosa.
  castillo: {
    bpm: 124, root: 62, scale: MAJOR, prog: [0, 4, 5, 3, 0, 4, 5, 4],
    lead: { wave: 'square', vol: 0.05, len: 0.9, notes: [
      '4 - 7 - 9 - 7 8', '8 - 6 - 4 - . 6', '7 - 9 - 11 - 9 7', '8 7 5 - 3 - 5 -',
      '4 - 7 - 9 - 11 -', '10 - 8 - 6 - 8 10', '9 - 7 - 5 - 7 9', '8 - - - 6 4 6 8'] },
    bass: { wave: 'triangle', vol: 0.11, octave: -2, pattern: [0, -1, 0, 4, 0, -1, 2, 4] },
    arp: { wave: 'triangle', vol: 0.035, len: 0.5, pattern: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1] },
    kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
  },
  // Forja Volcánica: tensa y rápida, con bajo machacón.
  volcan: {
    bpm: 148, root: 52, scale: PHRYGIAN, prog: [0, 1, 0, 6, 0, 1, 0, 6],
    lead: { wave: 'sawtooth', vol: 0.04, len: 0.8, octave: 1, notes: [
      '7 . 7 6 7 . 4 .', '5 . 5 4 5 . 3 .', '7 . 9 8 7 . 6 4', '6 - 5 - 3 - 1 -',
      '4 . 4 7 4 . 2 .', '5 . 5 8 5 . 3 .', '7 8 9 - 11 - 9 7', '6 - 5 - 4 - - -'] },
    bass: { wave: 'sawtooth', vol: 0.085, octave: -1, pattern: [0, 0, 7, 0, 0, 7, 0, 4] },
    arp: { wave: 'square', vol: 0.02, len: 0.35, pattern: [0, -1, 2, -1, 1, -1, 2, 0, -1, 2, -1, 1, 3, -1, 2, -1] },
    kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
  },
  // Tundra de la Aurora: etérea y lenta, de campanas y arpegios largos.
  aurora: {
    bpm: 96, root: 57, scale: LYDIAN, prog: [0, 1, 5, 4, 0, 1, 5, 4],
    lead: { wave: 'sine', vol: 0.09, len: 1.6, octave: 1, notes: [
      '4 - - - 6 - 7 -', '8 - - - 6 - 3 -', '5 - - - 7 - 9 -', '8 - - 6 4 - - -',
      '4 - 7 - 9 - 8 -', '10 - - - 8 - 6 -', '9 - 7 - 5 - 7 -', '8 - - - - - - -'] },
    bass: { wave: 'sine', vol: 0.13, octave: -1, pattern: [0, -1, -1, -1, 4, -1, -1, 7] },
    arp: { wave: 'triangle', vol: 0.045, len: 1.4, pattern: [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2] },
    kick: 'x.........x.....', snare: '........x.......', hat: '..x...x...x...x.',
  },
};
for (const s of Object.values(SONGS)) s.lead.bars = s.lead.notes.map(bar => bar.split(' '));

const freq = midi => 440 * 2 ** ((midi - 69) / 12);
const degree = (s, d) => s.root + s.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

function ensure() {
  if (!AC) return false;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

function note(midi, t, dur, wave, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(freq(midi), t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}
function drum(kind, t, vol) {
  if (kind === 'kick') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.18);
    return;
  }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), dur = kind === 'snare' ? 0.13 : 0.035;
  s.buffer = noiseBuf;
  f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1900 : 7500;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.02);
}

// Programa las notas de una semicorchea.
function schedule(s, i, t, sixteenth) {
  const bars = s.prog.length, bar = Math.floor(i / 16) % bars, pos = i % 16, chord = s.prog[bar];
  const tones = [chord, chord + 2, chord + 4, chord + 7];            // tríada sobre el grado del compás
  if (pos % 2 === 0) {
    const e = pos / 2, cell = s.lead.bars[bar][e];
    if (cell !== '.' && cell !== '-') {                              // la nota dura hasta el siguiente ataque o silencio
      let held = 1;
      while (e + held < 8 && s.lead.bars[bar][e + held] === '-') held++;
      note(degree(s, +cell) + 12 * (s.lead.octave || 0), t, sixteenth * 2 * held * s.lead.len, s.lead.wave, s.lead.vol);
    }
    const b = s.bass.pattern[e];
    if (b >= 0) note(degree(s, chord + b) + 12 * s.bass.octave, t, sixteenth * 1.8, s.bass.wave, s.bass.vol);   // b: nota del acorde (0 fundamental, 2 tercera, 4 quinta, 7 octava)
  }
  const a = s.arp.pattern[pos];
  if (a >= 0) note(degree(s, tones[a]) + 12, t, sixteenth * 4 * s.arp.len, s.arp.wave, s.arp.vol);
  if (s.kick[pos] === 'x') drum('kick', t, 0.3);
  if (s.snare[pos] === 'x') drum('snare', t, 0.11);
  if (s.hat[pos] === 'x' || intensity > 0) drum('hat', t, s.hat[pos] === 'x' ? 0.035 : 0.02);   // con tensión, platillos en todas las semicorcheas
}

function tick() {
  if (!song || !ctx) return;
  const sixteenth = 60 / (song.bpm * (1 + intensity * 0.09)) / 4;
  while (nextTime < ctx.currentTime + 0.25) {
    schedule(song, step, nextTime, sixteenth);
    nextTime += sixteenth; step++;
  }
}

export const music = {
  // Empieza el tema de un mapa (o no hace nada si la música está apagada).
  play(id) {
    this.wanted = id;
    if (!enabled || !SONGS[id] || !ensure()) return;
    song = SONGS[id]; step = 0; intensity = 0; nextTime = ctx.currentTime + 0.12;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 0.6);
    clearInterval(timer);
    timer = setInterval(tick, 60);
    tick();
  },
  stop(fade = 0.8) {
    this.wanted = '';
    clearInterval(timer); timer = null; song = null;
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
  },
  // 0 = normal, 1 = alguien va muy justo de vida: más rápida y con más percusión.
  tension(level) { intensity = level ? 1 : 0; },
  playing: () => !!song,
  isOn: () => enabled,
  setOn(value) {
    enabled = value;
    try { localStorage.setItem('petbound-music', value ? '1' : '0'); } catch { /* sin almacenamiento */ }
    if (!value) { const again = this.wanted; this.stop(0.2); this.wanted = again; }
    else if (this.wanted) this.play(this.wanted);
  },
  // Al ocultar la pestaña se calla; al volver, sigue.
  pause(hidden) { if (ctx) (hidden ? ctx.suspend() : ctx.resume()); },
  songs: Object.keys(SONGS),
};
