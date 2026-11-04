// Turns microphone audio into note-on / note-off events (see dsp.js for the method).
// Pure JavaScript: the app feeds it from Web Audio, the tests feed it from decoded files.

import {
  SpectrumAnalyzer, Decomposer, NUM_BANDS, KEY_LO, KEY_HI,
  normalize, shiftTemplate, synthTemplate, defaultNoiseTemplate, unpackTemplate,
} from './dsp.js';

export const DEFAULT_TUNING = {
  iters: 12,
  sparsity: 0.04,
  relOn: 0.12,         // share of all note energy a new note needs
  relOnExpected: 0.06, // …if the lesson is waiting for that note
  flux: 0.25,          // share of a key's sound that must be new (struck, not ringing on)
  fluxExpected: 0.15,
  fluxLag: 3,          // frames back to compare with
  rise: 2.2,           // activation must jump by this factor over the last ~100 ms
  riseExpected: 1.7,
  absOn: 4,            // × the room's noise level (halved for expected notes)
  release: 0.12,       // note ends below this share of its peak…
  relOff: 0.05,        // …or this share of everything sounding
  minGap: 0.09,        // seconds before the same key can strike again
  historyFrames: 7,
};

/**
 * Builds the 88 key templates: measured ones from calibration first, then a nearby measured one
 * shifted into place, then the bundled piano ones, then synthetic ones.
 */
export function buildTemplates(analyzer, { measured = {}, bundled = {} } = {}) {
  const out = {};
  const measuredKeys = Object.keys(measured).map(Number).sort((a, b) => a - b);
  const bundledKeys = Object.keys(bundled).map(Number).sort((a, b) => a - b);
  const get = (src, m) => (typeof src[m] === 'string' ? unpackTemplate(src[m]) : normalize(src[m]));
  for (let m = KEY_LO; m <= KEY_HI; m++) {
    if (measured[m]) { out[m] = get(measured, m); continue; }
    const near = nearest(measuredKeys, m);
    if (near != null && Math.abs(near - m) <= 4) { out[m] = shiftTemplate(get(measured, near), m - near); continue; }
    if (bundled[m]) { out[m] = get(bundled, m); continue; }
    const nb = nearest(bundledKeys, m);
    if (nb != null && Math.abs(nb - m) <= 3) { out[m] = shiftTemplate(get(bundled, nb), m - nb); continue; }
    out[m] = synthTemplate(m, analyzer);
  }
  return out;
}

function nearest(sorted, m) {
  let best = null;
  for (const k of sorted) if (best == null || Math.abs(k - m) < Math.abs(best - m)) best = k;
  return best;
}

export class NoteTracker {
  /**
   * @param opts.sampleRate
   * @param opts.range      [lowest, highest] key on the keyboard
   * @param opts.templates  {midi: Float32Array} (from buildTemplates)
   * @param opts.noise      Float32Array room-noise template, or null
   * @param opts.noiseLevel measured room noise (sum of bands), or 0 to learn it on the fly
   */
  constructor(opts) {
    this.analyzer = opts.analyzer || new SpectrumAnalyzer(opts.sampleRate);
    this.tuning = { ...DEFAULT_TUNING, ...(opts.tuning || {}) };
    this.sensitivity = opts.sensitivity ?? 1;
    this.baseNoise = opts.noiseLevel || 0;
    this.noiseLevel = this.baseNoise;
    this.blockMins = [];
    this.blockMin = Infinity;
    this.blockStart = -1;
    this.expected = new Set();
    this.suppressed = new Map(); // midi → until (notes the app itself is playing)
    this.setTemplates(opts.templates, opts.noise, opts.range || [36, 96]);
  }

  setTemplates(templates, noise, range) {
    this.range = range;
    this.keys = [];
    const cols = [];
    for (let m = range[0]; m <= range[1]; m++) { this.keys.push(m); cols.push(templates[m]); }
    this.noiseIndex = cols.length;
    cols.push(noise || defaultNoiseTemplate());
    // A flat column soaks up clicks and knocks so they do not turn into notes.
    cols.push(normalize(new Float32Array(NUM_BANDS).fill(1)));
    this.decomposer = new Decomposer(cols);
    const K = this.keys.length;
    this.hist = Array.from({ length: K }, () => new Float32Array(this.tuning.historyFrames));
    this.histPos = 0;
    this.state = Array.from({ length: K }, () => ({ on: false, peak: 0, since: -1, last: -1, pending: -1, pendingE: 0 }));
    this.lam = new Float64Array(cols.length).fill(this.tuning.sparsity);
    this.lam[this.noiseIndex] = 0;
    this.lam[this.noiseIndex + 1] = 0;
    this.levels = new Float32Array(K);
    this.past = Array.from({ length: this.tuning.fluxLag }, () => new Float32Array(NUM_BANDS));
    this.pastPos = 0;
    this.flux = new Float32Array(K);
  }

  /** For each key: how much of the sound in its bands is new since a few frames ago. */
  computeFlux(bands) {
    const prev = this.past[this.pastPos];
    const W = this.decomposer.W, support = this.decomposer.support;
    for (let k = 0; k < this.keys.length; k++) {
      const w = W[k], s = support[k];
      let num = 0, den = 1e-12;
      for (let j = 0; j < s.length; j++) {
        const b = s[j];
        const d = bands[b] - prev[b];
        if (d > 0) num += w[b] * d;
        den += w[b] * bands[b];
      }
      this.flux[k] = num / den;
    }
    prev.set(bands);
    this.pastPos = (this.pastPos + 1) % this.past.length;
  }

  setExpected(midis) { this.expected = new Set(midis); }

  /**
   * The room's noise level: the quietest moment of each half second, lowest over the last 8 s.
   * Kept near the calibrated level so a long passage of playing cannot pass for "noise".
   */
  trackNoise(total, time) {
    if (this.blockStart < 0) this.blockStart = time;
    if (total < this.blockMin) this.blockMin = total;
    if (!this.noiseLevel) this.noiseLevel = total;
    if (time - this.blockStart >= 0.5 || time < this.blockStart) {
      this.blockMins.push(this.blockMin);
      if (this.blockMins.length > 16) this.blockMins.shift();
      this.blockMin = Infinity;
      this.blockStart = time;
      let est = Math.min(...this.blockMins);
      if (this.baseNoise) est = Math.min(this.baseNoise * 3, Math.max(this.baseNoise * 0.9, est));
      this.noiseLevel = est;
    } else if (total < this.noiseLevel) {
      this.noiseLevel = total; // quieter than we thought: believe it at once
      if (this.baseNoise) this.noiseLevel = Math.max(this.baseNoise * 0.9, total);
    }
  }

  /** Ignore a key for a while (the app is playing it through the speaker). */
  suppress(midi, until) { this.suppressed.set(midi, until); }

  get windowSize() { return this.analyzer.n; }

  /** Analyse the latest window of samples at `time` (seconds). Returns the events in this frame. */
  process(samples, time, offset = 0) {
    const { bands, rms } = this.analyzer.analyze(samples, offset);
    const T = this.tuning;
    let total = 0;
    for (let b = 0; b < NUM_BANDS; b++) total += bands[b];
    this.trackNoise(total, time);
    const events = [];
    const K = this.keys.length;
    const sens = this.sensitivity;
    const floorAbs = Math.max(this.noiseLevel, 1e-4) * T.absOn / sens;
    let h;
    if (total < this.noiseLevel * 1.6) {
      h = this.decomposer.h; h.fill(0);
    } else {
      h = this.decomposer.solve(bands, T.iters, this.lam);
    }
    this.computeFlux(bands);
    let noteSum = 0, maxE = 0;
    for (let k = 0; k < K; k++) { noteSum += h[k]; if (h[k] > maxE) maxE = h[k]; }
    const pos = this.histPos;
    for (let k = 0; k < K; k++) {
      const e = h[k];
      this.levels[k] = e;
      const hist = this.hist[k];
      let minRecent = Infinity;
      for (let i = 0; i < hist.length; i++) if (hist[i] < minRecent) minRecent = hist[i];
      hist[pos] = e;
      const st = this.state[k];
      const midi = this.keys[k];
      const exp = this.expected.has(midi);
      const sup = this.suppressed.get(midi);
      if (sup && sup < time) this.suppressed.delete(midi);
      const muted = sup && sup >= time;
      const share = noteSum > 0 ? e / noteSum : 0;
      const relOn = (exp ? T.relOnExpected : T.relOn) / sens;
      const rise = exp ? T.riseExpected : T.rise;
      const strongEnough = e > floorAbs * (exp ? 0.5 : 1) && share >= relOn && e >= maxE * (exp ? 0.1 : 0.2);
      const fresh = this.flux[k] >= (exp ? T.fluxExpected : T.flux);
      const jumped = fresh && e > minRecent * rise + floorAbs * 0.25;
      if (!st.on) {
        if (st.pending >= 0) {
          // A candidate from the last frame: keep it if it is still strong and no louder
          // neighbour explains it (the hammer's thump smears across nearby keys).
          if (strongEnough && !this.dominated(k, h) && !muted) {
            st.on = true; st.peak = Math.max(e, st.pendingE); st.since = st.pending; st.last = st.pending;
            events.push({ type: 'on', midi, time: st.pending, velocity: Math.min(1, Math.sqrt(st.peak / (floorAbs * 8))) });
          }
          st.pending = -1;
        } else if (strongEnough && jumped && !muted && time - st.last >= T.minGap) {
          st.pending = time; st.pendingE = e;
        }
      } else {
        if (e > st.peak) st.peak = e;
        const faded = e < st.peak * T.release || share < T.relOff || e < floorAbs * 0.5;
        if (faded) {
          st.on = false;
          events.push({ type: 'off', midi, time });
        } else if (jumped && strongEnough && e > st.peak * 0.6 && time - st.last >= Math.max(T.minGap, 0.12) && minRecent < st.peak * 0.55) {
          // Struck again while still ringing.
          st.peak = e; st.last = time;
          events.push({ type: 'off', midi, time });
          events.push({ type: 'on', midi, time, velocity: Math.min(1, Math.sqrt(e / (floorAbs * 8))) });
        }
      }
    }
    this.histPos = (pos + 1) % T.historyFrames;
    this.lastTotal = total;
    this.lastRms = rms;
    return events;
  }

  /** True when a key a semitone or two away is far louder: this one is likely its shadow. */
  dominated(k, h) {
    const e = h[k];
    const midi = this.keys[k];
    const low = midi < 55; // low notes smear across neighbours more
    for (const d of [-2, -1, 1, 2]) {
      const j = k + d;
      if (j < 0 || j >= this.keys.length) continue;
      if (h[j] > e * (Math.abs(d) === 1 ? (low ? 1.6 : 2.5) : (low ? 2.5 : 4))) return true;
    }
    // An octave above a loud note often lights up from its harmonics. Unless the lesson asks for it.
    if (!this.expected.has(midi)) {
      const j = k - 12;
      if (j >= 0 && h[j] > e * 2.2 && this.state[j] && (this.state[j].on || this.state[j].pending >= 0)) return true;
    }
    return false;
  }

  /** Keys currently held, by MIDI number. */
  held() {
    const out = [];
    this.state.forEach((s, k) => { if (s.on) out.push(this.keys[k]); });
    return out;
  }

  reset() {
    this.state.forEach((s) => { s.on = false; s.peak = 0; });
    this.hist.forEach((h) => h.fill(0));
    this.decomposer.h.fill(0);
  }
}

// ---- Calibration -----------------------------------------------------------------------------------

/**
 * Records what one key sounds like. Feed it frames while the person holds the key; it keeps the
 * frames from the loud, steady part after the strike and averages their spectra.
 */
export class KeyRecorder {
  constructor(analyzer, noiseLevel) {
    this.analyzer = analyzer;
    this.noiseLevel = noiseLevel;
    this.reset();
  }

  reset() {
    this.sum = new Float64Array(NUM_BANDS);
    this.frames = 0;
    this.peak = 0;
    this.started = -1;
  }

  /** Returns 'waiting' | 'recording' | 'done'. */
  feed(samples, time, offset = 0) {
    const { bands } = this.analyzer.analyze(samples, offset);
    let total = 0;
    for (let b = 0; b < NUM_BANDS; b++) total += bands[b];
    if (this.started < 0) {
      if (total > this.noiseLevel * 5) { this.started = time; this.peak = total; }
      return 'waiting';
    }
    if (total > this.peak) this.peak = total;
    const age = time - this.started;
    // Skip the hammer's thump (first 40 ms), then collect ~0.4 s while the note is still strong.
    if (age > 0.04 && total > this.peak * 0.2) {
      for (let b = 0; b < NUM_BANDS; b++) this.sum[b] += Math.max(0, bands[b] - this.noiseSpectrum(b));
      this.frames++;
    }
    if (age > 0.5 || (age > 0.1 && total < this.peak * 0.2)) return this.frames >= 3 ? 'done' : (this.reset(), 'waiting');
    return 'recording';
  }

  noiseSpectrum(b) { return this.noise ? this.noise[b] : 0; }

  template() { return normalize(this.sum); }

  /** Which key this recording sounds most like, so a mis-press can be caught. */
  bestMatch(templates) {
    const t = this.template();
    let best = null, bestScore = -1;
    for (const [m, w] of Object.entries(templates)) {
      let dot = 0, a = 0, b = 0;
      for (let i = 0; i < t.length; i++) { dot += t[i] * w[i]; a += t[i] * t[i]; b += w[i] * w[i]; }
      const s = dot / Math.sqrt(a * b + 1e-20);
      if (s > bestScore) { bestScore = s; best = Number(m); }
    }
    return { midi: best, score: bestScore };
  }
}

/** Measures room noise: average spectrum and level over ~1.5 s of quiet. */
export class NoiseRecorder {
  constructor(analyzer) {
    this.analyzer = analyzer;
    this.sum = new Float64Array(NUM_BANDS);
    this.totals = [];
  }

  feed(samples, offset = 0) {
    const { bands } = this.analyzer.analyze(samples, offset);
    let total = 0;
    for (let b = 0; b < NUM_BANDS; b++) { this.sum[b] += bands[b]; total += bands[b]; }
    this.totals.push(total);
  }

  result() {
    const sorted = [...this.totals].sort((a, b) => a - b);
    const level = sorted[Math.floor(sorted.length * 0.6)] || 0;
    return { template: normalize(this.sum), level, spectrum: Float32Array.from(this.sum, (v) => v / Math.max(1, this.totals.length)) };
  }
}
