// Shared helpers for the Node tests: real piano recordings → arbitrary keys, chords and phrases.
import fs from 'node:fs';
import path from 'node:path';

const NAMES = { C: 0, Cs: 1, Ds: 3, Fs: 6, A: 9 };

/** Loads 48 kHz mono float32 files named like C4.f32 / Ds4.f32 / Fs4.f32 / A4.f32. */
export function loadSampleSet(dir) {
  const set = {};
  for (const f of fs.readdirSync(dir)) {
    const m = /^([A-G]s?)(\d)\.f32$/.exec(f);
    if (!m) continue;
    const midi = (Number(m[2]) + 1) * 12 + NAMES[m[1]];
    const buf = fs.readFileSync(path.join(dir, f));
    set[midi] = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  }
  return set;
}

/** One key, made from the nearest recording by resampling (as the app's own piano does). */
export function renderKey(set, midi, sr, seconds = 1, gain = 1) {
  let near = null;
  for (const k of Object.keys(set).map(Number)) if (near == null || Math.abs(k - midi) < Math.abs(near - midi)) near = k;
  const src = set[near];
  const rate = Math.pow(2, (midi - near) / 12);
  const n = Math.round(seconds * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * rate;
    const i0 = Math.floor(p);
    if (i0 + 1 >= src.length) break;
    const fr = p - i0;
    out[i] = (src[i0] * (1 - fr) + src[i0 + 1] * fr) * gain;
  }
  return out;
}

/** Mixes [{midi, t, d, gain}] into one buffer with a damper-like fade at each note's end. */
export function renderPhrase(set, notes, sr, tail = 0.6) {
  const len = Math.max(...notes.map((n) => n.t + n.d)) + tail;
  const out = new Float32Array(Math.ceil(len * sr));
  for (const n of notes) {
    const key = renderKey(set, n.midi, sr, n.d + 0.25, n.gain ?? 1);
    const start = Math.round(n.t * sr);
    const fadeStart = Math.round(n.d * sr);
    const fadeLen = Math.round(0.12 * sr);
    for (let i = 0; i < key.length && start + i < out.length; i++) {
      let g = 1;
      if (i > fadeStart) g = Math.max(0, 1 - (i - fadeStart) / fadeLen);
      out[start + i] += key[i] * g;
    }
  }
  return out;
}

/** Deterministic noise (room hiss and hum) so tests repeat exactly. */
export function addNoise(buf, level, sr, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  let pink = 0;
  for (let i = 0; i < buf.length; i++) {
    pink = pink * 0.97 + rnd() * 0.03;
    buf[i] += level * (rnd() * 0.5 + pink * 6 + 0.3 * Math.sin((2 * Math.PI * 50 * i) / sr));
  }
  return buf;
}

/** Runs a tracker over a buffer with a fixed hop, returning all events. */
export function runTracker(tracker, buf, sr, hopSec = 0.015) {
  const n = tracker.windowSize;
  const hop = Math.round(hopSec * sr);
  const events = [];
  for (let end = n; end <= buf.length; end += hop) {
    const ev = tracker.process(buf, end / sr, end - n);
    events.push(...ev);
  }
  return events;
}

export const PCM_DIR = process.env.KEYGLOW_PCM || '';
