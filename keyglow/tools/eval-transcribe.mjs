// Checks MP3 import end to end without a browser: render a two-hand piece from real piano recordings,
// run Basic Pitch on it (tf.js CPU backend), and compare the arranged notes with what was played.
//   KEYGLOW_PCM22=<dir of 22.05 kHz .f32 samples> node tools/eval-transcribe.mjs
import fs from 'node:fs';
import path from 'node:path';
import { loadSampleSet, renderPhrase } from '../tests/helpers.mjs';
import { runModel, modelToNotes, arrange } from '../app/src/main/assets/web/js/music/transcribe.js';
import { compileSong } from '../app/src/main/assets/web/js/music/notation.js';
import { songById } from '../app/src/main/assets/web/js/music/songs.js';

const SR = 22050;
const set = loadSampleSet(process.env.KEYGLOW_PCM22);
const modelDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../app/src/main/assets/web/model');
const handler = {
  load: async () => {
    const json = JSON.parse(fs.readFileSync(path.join(modelDir, 'model.json'), 'utf8'));
    const bin = fs.readFileSync(path.join(modelDir, 'group1-shard1of1.bin'));
    return { modelTopology: json.modelTopology, weightSpecs: json.weightsManifest[0].weights, weightData: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.length), format: json.format, generatedBy: json.generatedBy, convertedBy: json.convertedBy };
  },
};

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ['twinkle', 'ode-to-joy', 'minuet-g']) {
  const chart = compileSong(songById(id));
  const truth = chart.notes.map((n) => ({ midi: n.midi, t: n.t + 0.5, d: n.d * 0.9, gain: n.hand === 'L' ? 0.6 : 0.85, hand: n.hand }));
  const buf = renderPhrase(set, truth, SR);
  const t0 = Date.now();
  const out = await runModel(buf, null, handler);
  const raw = await modelToNotes(out, 'balanced');
  const { notes, tempo } = arrange(raw, { level: 'full' });
  // Align: arrange() shifts the song to start near 0.
  const shift = truth[0].t - (notes[0]?.t ?? 0);
  const used = new Set();
  let hit = 0, handOk = 0;
  for (const n of truth) {
    const i = notes.findIndex((x, j) => !used.has(j) && x.midi === n.midi && Math.abs(x.t + shift - n.t) < 0.08);
    if (i >= 0) { used.add(i); hit++; if (notes[i].hand === n.hand) handOk++; }
  }
  console.log(`${id.padEnd(14)} ${truth.length} notes played, ${notes.length} found · recall ${(100 * hit / truth.length).toFixed(1)}% · precision ${(100 * hit / notes.length).toFixed(1)}% · hands right ${(100 * handOk / Math.max(1, hit)).toFixed(0)}% · tempo ${tempo.bpm} (true ${chart.bpm}) · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
