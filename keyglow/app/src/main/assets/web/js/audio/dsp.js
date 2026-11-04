// Signal processing for hearing a keyboard through the microphone. Pure JavaScript, no Web Audio,
// so the same code runs in the app and in the Node tests.
//
// How it works:
//  1. Every ~15 ms take the latest ~85 ms of microphone audio, window it and FFT it.
//  2. Fold the spectrum onto a log-frequency scale: 3 bands per semitone, A0 up to ~E8 (one bank).
//  3. Explain that spectrum as a sum of note "templates" — what each key sounds like — with a few
//     rounds of non-negative matrix factorisation (KL divergence, fixed templates, warm-started).
//     Templates come from real piano recordings by default; calibration replaces them with the
//     sound of *your* keyboard through *your* tablet's microphone.
//  4. A note starts when its activation jumps up and is a big enough share of what is sounding;
//     it ends when it fades. Notes a lesson is waiting for get a lower bar ("expected" notes).

export const BAND_LO = 20;        // MIDI of the first band (just under A0)
export const BAND_HI = 124;       // MIDI of the last band (~6.6 kHz)
export const BANDS_PER_SEMI = 3;
export const NUM_BANDS = (BAND_HI - BAND_LO) * BANDS_PER_SEMI + 1;
export const KEY_LO = 21;         // A0
export const KEY_HI = 108;        // C8
export const NUM_KEYS = KEY_HI - KEY_LO + 1;

export const bandOfMidi = (m) => Math.round((m - BAND_LO) * BANDS_PER_SEMI);
export const midiOfBand = (b) => BAND_LO + b / BANDS_PER_SEMI;

const nextPow2 = (n) => 1 << Math.ceil(Math.log2(n));

// ---- FFT --------------------------------------------------------------------------------------

export class FFT {
  constructor(size) {
    this.size = size;
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
    this.rev = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(size / 2);
    this.sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / size);
    }
  }

  /** In-place transform of this.re / this.im. */
  run() {
    const { size, re, im, rev, cos, sin } = this;
    for (let i = 0; i < size; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= size; len <<= 1) {
      const half = len >> 1;
      const step = size / len;
      for (let i = 0; i < size; i += len) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j;
          const b = a + half;
          const tr = re[b] * cos[k] - im[b] * sin[k];
          const ti = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  }
}

// ---- Spectrum on a log-frequency scale -----------------------------------------------------------

export class SpectrumAnalyzer {
  /**
   * @param sampleRate  audio sample rate
   * @param windowSec   analysis window; ~85 ms is a good balance of speed and low-note accuracy
   */
  constructor(sampleRate, windowSec = 0.085) {
    this.sampleRate = sampleRate;
    this.n = nextPow2(sampleRate * windowSec * 0.75); // 4096 at 44.1/48 kHz
    this.fftSize = this.n * 2; // zero-padded for smoother interpolation
    this.fft = new FFT(this.fftSize);
    this.window = new Float64Array(this.n);
    let wsum = 0;
    for (let i = 0; i < this.n; i++) {
      this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (this.n - 1));
      wsum += this.window[i];
    }
    this.scale = 2 / wsum; // a full-scale sine reads ~1.0
    this.mag = new Float64Array(this.fftSize / 2);
    // For each band, either interpolate at its centre (narrow bands, low notes) or take the
    // largest bin inside it (wide bands, high notes).
    const binHz = sampleRate / this.fftSize;
    this.bandFrom = new Int32Array(NUM_BANDS);
    this.bandTo = new Int32Array(NUM_BANDS);
    this.bandCenter = new Float64Array(NUM_BANDS);
    for (let b = 0; b < NUM_BANDS; b++) {
      const m = midiOfBand(b);
      const f = 440 * Math.pow(2, (m - 69) / 12);
      const fLo = 440 * Math.pow(2, (m - 0.5 / BANDS_PER_SEMI - 69) / 12);
      const fHi = 440 * Math.pow(2, (m + 0.5 / BANDS_PER_SEMI - 69) / 12);
      this.bandCenter[b] = f / binHz;
      this.bandFrom[b] = Math.ceil(fLo / binHz);
      this.bandTo[b] = Math.floor(fHi / binHz);
    }
    this.bands = new Float32Array(NUM_BANDS);
  }

  /** samples: the latest `this.n` samples (older first). Returns {bands, rms}. */
  analyze(samples, offset = 0) {
    const { n, fft, window, mag, scale } = this;
    const re = fft.re, im = fft.im;
    let sum = 0;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += samples[offset + i];
    mean /= n;
    for (let i = 0; i < n; i++) {
      const s = samples[offset + i] - mean;
      sum += s * s;
      re[i] = s * window[i];
      im[i] = 0;
    }
    for (let i = n; i < this.fftSize; i++) { re[i] = 0; im[i] = 0; }
    fft.run();
    const half = this.fftSize / 2;
    for (let i = 0; i < half; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * scale;
    const bands = this.bands;
    for (let b = 0; b < NUM_BANDS; b++) {
      const from = this.bandFrom[b], to = this.bandTo[b];
      let v;
      if (to - from >= 1) {
        v = 0;
        for (let i = from; i <= to && i < half; i++) if (mag[i] > v) v = mag[i];
      } else {
        const c = this.bandCenter[b];
        const i0 = Math.floor(c);
        const fr = c - i0;
        v = i0 + 1 < half ? mag[i0] * (1 - fr) + mag[i0 + 1] * fr : 0;
      }
      bands[b] = v;
    }
    return { bands, rms: Math.sqrt(sum / n) };
  }
}

// ---- Templates ------------------------------------------------------------------------------------

/** Normalises a template so its bands sum to 1 (activations then read as "amount of sound"). */
export function normalize(vec) {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i];
  const out = new Float32Array(vec.length);
  if (s > 0) for (let i = 0; i < vec.length; i++) out[i] = vec[i] / s;
  return out;
}

/** Moves a template up or down by whole semitones (3 bands each), for keys without a recording. */
export function shiftTemplate(vec, semitones) {
  const shift = Math.round(semitones * BANDS_PER_SEMI);
  const out = new Float32Array(vec.length);
  for (let b = 0; b < vec.length; b++) {
    const src = b - shift;
    if (src >= 0 && src < vec.length) out[b] = vec[src];
  }
  return normalize(out);
}

/** A rough piano-like spectrum made from harmonics, used only when nothing better is known. */
export function synthTemplate(midi, analyzer) {
  const sr = analyzer.sampleRate;
  const f0 = 440 * Math.pow(2, (midi - 69) / 12);
  const buf = new Float32Array(analyzer.n);
  const B = 0.00025 * Math.pow(2, Math.abs(midi - 60) / 18);
  for (let k = 1; k * f0 < Math.min(7000, sr / 2.2); k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    let a = 1 / Math.pow(k, 1.1);
    if (midi < 48 && k === 1) a *= 0.45;
    if (midi < 40 && k === 2) a *= 0.8;
    const w = (2 * Math.PI * fk) / sr;
    for (let i = 0; i < buf.length; i++) buf[i] += a * Math.sin(w * i + k);
  }
  return normalize(analyzer.analyze(buf).bands);
}

/** Background noise: a gently falling spectrum. Replaced by the measured room noise after calibration. */
export function defaultNoiseTemplate() {
  const v = new Float32Array(NUM_BANDS);
  for (let b = 0; b < NUM_BANDS; b++) v[b] = 1 / (1 + b / 60);
  return normalize(v);
}

/** Packs templates into a compact string (8-bit log scale) for storage. */
export function packTemplate(vec) {
  let max = 0;
  for (const v of vec) if (v > max) max = v;
  const bytes = new Uint8Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    const r = max > 0 ? vec[i] / max : 0;
    bytes[i] = r <= 1e-4 ? 0 : Math.max(1, Math.min(255, Math.round(255 + 255 * (Math.log10(r) / 4))));
  }
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return (typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64'));
}

export function unpackTemplate(str) {
  const bin = typeof atob === 'function' ? atob(str) : Buffer.from(str, 'base64').toString('binary');
  const out = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    const b = bin.charCodeAt(i);
    out[i] = b === 0 ? 0 : Math.pow(10, ((b - 255) / 255) * 4);
  }
  return normalize(out);
}

// ---- Decomposition ----------------------------------------------------------------------------------

/**
 * Explains a spectrum as a non-negative mix of templates.
 * W is stored column by column (one Float32Array per template, each summing to 1).
 */
export class Decomposer {
  constructor(templates) {
    this.setTemplates(templates);
  }

  setTemplates(templates) {
    this.W = templates;
    this.K = templates.length;
    this.h = new Float64Array(this.K);
    this.approx = new Float64Array(NUM_BANDS);
    this.ratio = new Float64Array(NUM_BANDS);
    // Each template's useful bands (skip zeros: most of a template is empty).
    this.support = templates.map((w) => {
      const idx = [];
      for (let b = 0; b < w.length; b++) if (w[b] > 1e-5) idx.push(b);
      return Int32Array.from(idx);
    });
  }

  /**
   * @param v        spectrum bands
   * @param iters    multiplicative-update rounds
   * @param sparsity L1 weight per template (array or number): higher = harder to switch on
   */
  solve(v, iters = 12, sparsity = 0) {
    const { W, K, h, approx, ratio, support } = this;
    let total = 0;
    for (let b = 0; b < NUM_BANDS; b++) total += v[b];
    if (total <= 1e-9) { h.fill(0); return h; }
    // Warm start: last frame's answer, plus a little of everything so silent notes can come in.
    const floor = total / K * 0.05;
    for (let k = 0; k < K; k++) h[k] = h[k] * 0.9 + floor;
    const lam = typeof sparsity === 'number' ? null : sparsity;
    for (let it = 0; it < iters; it++) {
      approx.fill(1e-12);
      for (let k = 0; k < K; k++) {
        const hk = h[k];
        if (hk <= 0) continue;
        const w = W[k], s = support[k];
        for (let j = 0; j < s.length; j++) { const b = s[j]; approx[b] += w[b] * hk; }
      }
      for (let b = 0; b < NUM_BANDS; b++) ratio[b] = v[b] / approx[b];
      for (let k = 0; k < K; k++) {
        const w = W[k], s = support[k];
        let num = 0;
        for (let j = 0; j < s.length; j++) { const b = s[j]; num += w[b] * ratio[b]; }
        const l = lam ? lam[k] : sparsity;
        h[k] *= num / (1 + l);
      }
    }
    return h;
  }
}
