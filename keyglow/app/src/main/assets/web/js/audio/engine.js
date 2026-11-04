// Sound out: the piano (Salamander Grand Piano samples), a metronome and little game sounds.

let ctx = null;
let master, pianoBus, sfxBus, reverbSend;
const buffers = new Map(); // sample midi → AudioBuffer
let loading = null;
const voices = new Map(); // midi → [{src, gain}]
let sustain = false;
const sustained = new Set();

const SAMPLE_NAMES = ['C', 'Ds', 'Fs', 'A'];
const SAMPLE_PCS = [0, 3, 6, 9];

export function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);
    pianoBus = ctx.createGain();
    pianoBus.gain.value = 0.8;
    pianoBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.5;
    sfxBus.connect(master);
    // A small room so the piano does not sound dry.
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 1.8, 2.6);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.18;
    pianoBus.connect(reverbSend).connect(verb).connect(master);
  }
  return ctx;
}

export async function resumeAudio() {
  const c = audioContext();
  if (c.state !== 'running') { try { await c.resume(); } catch (e) { /* needs a tap */ } }
  return c;
}

export function setVolumes({ piano, sfx } = {}) {
  audioContext();
  if (piano != null) pianoBus.gain.value = piano;
  if (sfx != null) sfxBus.gain.value = sfx;
}

function impulse(c, seconds, decay) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = ch + 1;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/** Loads the piano samples (once). Resolves when they are ready to play. */
export function loadPiano() {
  if (loading) return loading;
  const c = audioContext();
  const jobs = [];
  for (let oct = 0; oct <= 8; oct++) {
    SAMPLE_NAMES.forEach((n, i) => {
      const midi = (oct + 1) * 12 + SAMPLE_PCS[i];
      if (midi < 21 || midi > 108) return;
      jobs.push(fetch(`samples/piano/${n}${oct}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((ab) => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)))
        .then((b) => buffers.set(midi, b))
        .catch(() => {}));
    });
  }
  loading = Promise.all(jobs);
  return loading;
}

export const pianoReady = () => buffers.size > 0;

function nearestSample(midi) {
  let best = null;
  for (const k of buffers.keys()) if (best == null || Math.abs(k - midi) < Math.abs(best - midi)) best = k;
  return best;
}

/** Plays a key. `when` is an AudioContext time (default now). Returns a handle for noteOff. */
export function noteOn(midi, velocity = 0.7, when = 0, duration = 0) {
  const c = audioContext();
  const s = nearestSample(midi);
  const t = Math.max(c.currentTime, when || 0);
  if (s == null) { beep(midi, velocity, t, duration || 0.4); return null; }
  const src = c.createBufferSource();
  src.buffer = buffers.get(s);
  src.playbackRate.value = Math.pow(2, (midi - s) / 12);
  const g = c.createGain();
  const v = 0.15 + 0.85 * Math.pow(velocity, 1.3);
  g.gain.setValueAtTime(v, t);
  src.connect(g).connect(pianoBus);
  src.start(t);
  const voice = { src, gain: g, midi };
  const list = voices.get(midi) || [];
  list.push(voice);
  voices.set(midi, list);
  src.onended = () => {
    const l = voices.get(midi);
    if (l) { const i = l.indexOf(voice); if (i >= 0) l.splice(i, 1); }
  };
  if (duration > 0) release(voice, t + duration);
  return voice;
}

function release(voice, at) {
  const c = audioContext();
  const t = Math.max(c.currentTime, at);
  try {
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.setTargetAtTime(0, t, 0.12);
    voice.src.stop(t + 1.2);
  } catch (e) { /* already stopped */ }
}

export function noteOff(midi) {
  if (sustain) { sustained.add(midi); return; }
  const list = voices.get(midi);
  if (!list) return;
  for (const v of list.splice(0)) release(v, 0);
}

export function setSustain(on) {
  sustain = on;
  if (!on) { for (const m of sustained) noteOff(m); sustained.clear(); }
}

export function allNotesOff() {
  sustain = false;
  sustained.clear();
  for (const list of voices.values()) for (const v of list.splice(0)) release(v, 0);
}

function beep(midi, velocity, t, dur) {
  const c = audioContext();
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3 * velocity, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(pianoBus);
  o.start(t); o.stop(t + dur + 0.05);
}

// ---- Metronome and game sounds ------------------------------------------------------------------

export function click(accent = false, when = 0) {
  const c = audioContext();
  const t = Math.max(c.currentTime, when);
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.value = accent ? 1760 : 1175;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(sfxBus);
  o.start(t); o.stop(t + 0.08);
}

function tone(freq, t, dur, { type = 'sine', vol = 0.25, attack = 0.005 } = {}) {
  const c = audioContext();
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  good() { const t = audioContext().currentTime; tone(1318.5, t, 0.18, { vol: 0.12 }); tone(1975.5, t + 0.05, 0.25, { vol: 0.1 }); },
  wrong() { const t = audioContext().currentTime; tone(155, t, 0.18, { type: 'triangle', vol: 0.18 }); },
  tap() { const t = audioContext().currentTime; tone(880, t, 0.06, { vol: 0.08 }); },
  star(i = 0) { const t = audioContext().currentTime; [1046.5, 1318.5, 1568, 2093][i % 4] && tone([1046.5, 1318.5, 1568, 2093][i % 4], t, 0.5, { vol: 0.16, type: 'triangle' }); },
  complete() {
    const t = audioContext().currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.09, 0.6, { vol: 0.14, type: 'triangle' }));
  },
  levelUp() {
    const t = audioContext().currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.7, { vol: 0.12, type: 'triangle' }));
    tone(2093, t + 0.45, 1.2, { vol: 0.08 });
  },
};
