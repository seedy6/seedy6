// Measures how well the microphone detector hears real piano recordings.
//   KEYGLOW_PCM=<dir with v12 .f32 files> node tools/eval-detector.mjs [--calibrated] [--noise 0.002]
// Templates come from the bundled (v8) recordings; the test audio is a different velocity layer (v12),
// so this checks the detector on a piano it was not built from.

import { SpectrumAnalyzer } from '../app/src/main/assets/web/js/audio/dsp.js';
import { NoteTracker, buildTemplates, KeyRecorder, NoiseRecorder } from '../app/src/main/assets/web/js/audio/tracker.js';
import bundled from '../app/src/main/assets/web/js/audio/piano-templates.js';
import { loadSampleSet, renderPhrase, renderKey, addNoise, runTracker } from '../tests/helpers.mjs';

const SR = 48000;
const args = process.argv.slice(2);
const noise = Number(args[args.indexOf('--noise') + 1]) || 0.002;
const calibrated = args.includes('--calibrated');
const set = loadSampleSet(process.env.KEYGLOW_PCM);
const an = new SpectrumAnalyzer(SR);
const range = [36, 96];

function makeTracker(tuning) {
  let measured = {};
  let noiseInfo = { template: null, level: 0 };
  if (calibrated) {
    const quiet = addNoise(new Float32Array(SR * 2), noise, SR, 99);
    const nr = new NoiseRecorder(an);
    for (let e = an.n; e < quiet.length; e += 720) nr.feed(quiet, e - an.n);
    noiseInfo = nr.result();
    for (let m = range[0]; m <= range[1]; m++) {
      const buf = addNoise(new Float32Array(SR * 1.2), noise, SR, m);
      const key = renderKey(set, m, SR, 1.0, 0.8);
      buf.set(key.map((v, i) => v + buf[i + Math.round(0.1 * SR)]), Math.round(0.1 * SR));
      const rec = new KeyRecorder(an, noiseInfo.level);
      for (let e = an.n; e < buf.length; e += 720) {
        if (rec.feed(buf, e / SR, e - an.n) === 'done') break;
      }
      measured[m] = rec.template();
    }
  }
  const templates = buildTemplates(an, { measured, bundled });
  return new NoteTracker({ analyzer: an, range, templates, noise: noiseInfo.template, noiseLevel: noiseInfo.level, tuning });
}

function score(truth, events, tol = 0.13) {
  const ons = events.filter((e) => e.type === 'on');
  const used = new Set();
  let hit = 0, lat = 0;
  for (const n of truth) {
    const i = ons.findIndex((e, j) => !used.has(j) && e.midi === n.midi && e.time >= n.t && e.time <= n.t + tol + an.n / SR);
    if (i >= 0) { used.add(i); hit++; lat += ons[i].time - n.t; }
  }
  const fp = ons.filter((_, j) => !used.has(j));
  return { recall: hit / truth.length, precision: ons.length ? hit / ons.length : 1, latency: hit ? lat / hit : 0, fp };
}

function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function suite(name, truth, tuning, expectedMode = false) {
  const tr = makeTracker(tuning);
  const buf = addNoise(renderPhrase(set, truth.map((n) => ({ ...n, t: n.t + 0.3 })), SR), noise, SR, 7);
  const shifted = truth.map((n) => ({ ...n, t: n.t + 0.3 }));
  let events;
  if (expectedMode) {
    // Tell the tracker which notes are due, like wait mode does.
    const n = tr.windowSize, hop = 720;
    events = [];
    for (let end = n; end <= buf.length; end += hop) {
      const t = end / SR;
      tr.setExpected(shifted.filter((x) => x.t - 0.3 < t && x.t + x.d > t).map((x) => x.midi));
      events.push(...tr.process(buf, t, end - n));
    }
  } else events = runTracker(tr, buf, SR);
  const s = score(shifted, events);
  const fpNames = s.fp.slice(0, 12).map((e) => `${e.midi}@${e.time.toFixed(2)}`).join(' ');
  console.log(`${name.padEnd(28)} recall ${(s.recall * 100).toFixed(1).padStart(5)}%  precision ${(s.precision * 100).toFixed(1).padStart(5)}%  latency ${(s.latency * 1000).toFixed(0)} ms  ${s.fp.length ? 'extra: ' + fpNames : ''}`);
  return s;
}

const tuning = process.env.ABS ? { absOn: Number(process.env.ABS) } : {};
const r = rng(3);
// 1. Every key on its own.
const singles = [];
for (let m = range[0], t = 0; m <= range[1]; m++, t += 0.7) singles.push({ midi: m, t, d: 0.5 });
suite('single keys C2–C7', singles, tuning);
// 2. Melody with repeated notes (Twinkle).
const tw = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60];
const twinkle = tw.map((m, i) => ({ midi: m, t: i * 0.45, d: i % 7 === 6 ? 0.85 : 0.4 }));
suite('melody, repeated notes', twinkle, tuning);
// 3. Fast scale.
const scale = [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60].map((m, i) => ({ midi: m, t: i * 0.22, d: 0.2 }));
suite('fast scale (4.5 notes/s)', scale, tuning);
// 4. Triads.
const triads = [];
for (let i = 0, t = 0; i < 24; i++, t += 1.0) {
  const root = 48 + Math.floor(r() * 24);
  const third = r() < 0.5 ? 4 : 3;
  for (const iv of [0, third, 7]) triads.push({ midi: root + iv, t, d: 0.8 });
}
suite('triads C3–C5', triads, tuning);
// 5. Two hands: bass + melody.
const twoHands = [];
for (let i = 0; i < 16; i++) {
  twoHands.push({ midi: [60, 64, 67, 72, 71, 67, 64, 62][i % 8], t: i * 0.5, d: 0.45 });
  if (i % 2 === 0) twoHands.push({ midi: [48, 43, 45, 41][(i / 2) % 4], t: i * 0.5, d: 0.95 });
}
suite('bass + melody', twoHands, tuning);
suite('triads, notes expected', triads, tuning, true);
suite('bass + melody, expected', twoHands, tuning, true);
