// Turning a recording (MP3, WAV, M4A…) or a MIDI file into a song you can learn.
//
// Audio goes through Spotify's Basic Pitch model (polyphonic note transcription, Apache 2.0), which
// gives note events. Then: tidy up, guess the tempo, optionally snap to a grid, split into hands,
// and optionally simplify (melody only / easy / full).

import { compileSong, measureDifficulty } from './notation.js';

let vendor = null;
/** The model and tf.js are big, so they are loaded only when someone imports a song. */
export async function loadVendor() {
  if (!vendor) vendor = import('../vendor/basic-pitch.bundle.js');
  return vendor;
}

export const DETAIL = {
  clean: { onset: 0.6, frame: 0.4, minLen: 9, label: 'Clean' },
  balanced: { onset: 0.5, frame: 0.3, minLen: 6, label: 'Balanced' },
  detailed: { onset: 0.38, frame: 0.25, minLen: 4, label: 'Detailed' },
};

// ---- Audio → model output ----------------------------------------------------------------------------

/** Decodes and resamples to 22.05 kHz mono, which is what the model expects. */
export async function decodeTo22k(arrayBuffer, audioCtx) {
  const decoded = await new Promise((res, rej) => audioCtx.decodeAudioData(arrayBuffer.slice(0), res, rej));
  const maxSeconds = 8 * 60;
  const seconds = Math.min(decoded.duration, maxSeconds);
  const off = new OfflineAudioContext(1, Math.ceil(seconds * 22050), 22050);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return { samples: rendered.getChannelData(0), duration: seconds, truncated: decoded.duration > maxSeconds };
}

/** Runs the model. Returns {frames, onsets, contours} (kept so detail can change without re-running). */
export async function runModel(samples, onProgress, modelUrl = 'model/model.json') {
  const { BasicPitch, tf } = await loadVendor();
  try { await tf.setBackend('webgl'); } catch (e) { await tf.setBackend('cpu'); }
  await tf.ready();
  const bp = new BasicPitch(tf.loadGraphModel(modelUrl));
  const frames = [], onsets = [], contours = [];
  await bp.evaluateModel(samples, (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); }, (p) => onProgress && onProgress(p));
  return { frames, onsets, contours };
}

/** Model output → note events [{midi, t, d, vel}] at a chosen detail level. */
export async function modelToNotes(out, detail = 'clean') {
  const { outputToNotesPoly, noteFramesToTime } = await loadVendor();
  const d = DETAIL[detail] || DETAIL.balanced;
  const events = noteFramesToTime(outputToNotesPoly(out.frames, out.onsets, d.onset, d.frame, d.minLen, true, null, null, true, 11));
  const notes = events.map((e) => ({ midi: e.pitchMidi, t: e.startTimeSeconds, d: e.durationSeconds, amp: e.amplitude, vel: Math.min(1, 0.25 + e.amplitude) }));
  return removeOctaveGhosts(notes, { whileSounding: detail !== 'detailed' });
}

/**
 * Piano harmonics fool the model into hearing a quiet extra note an octave (or a twelfth) above or
 * below a loud one, starting at the same moment. Real octaves are played about equally loud, so drop
 * an octave partner only when it is much quieter.
 */
export function removeOctaveGhosts(notes, { ratio = 0.62, wideRatio = 0.68, ringRatio = 0.5, whileSounding = true } = {}) {
  const sorted = [...notes].sort((a, b) => a.t - b.t);
  const drop = new Set();
  const loud = (n) => n.amp ?? n.vel;
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    for (let j = 0; j < sorted.length; j++) {
      const m = sorted[j];
      if (m === n || m.t > n.t + 0.06) { if (m.t > n.t + 0.06) break; continue; }
      const iv = Math.abs(n.midi - m.midi);
      if (iv !== 12 && iv !== 19 && iv !== 24) continue;
      // m started with n, or (optionally) is still ringing when n appears
      const together = Math.abs(m.t - n.t) < 0.06;
      const ringing = whileSounding && n.midi > m.midi && m.t <= n.t && m.t + m.d > n.t + 0.03; // overtones ring upwards
      if (!together && !ringing) continue;
      const r = together ? (iv === 12 ? ratio : wideRatio) : ringRatio;
      if (loud(n) < loud(m) * r) { drop.add(n); break; }
    }
  }
  return sorted.filter((n) => !drop.has(n));
}

// ---- MIDI files ----------------------------------------------------------------------------------------

export async function midiToNotes(arrayBuffer) {
  const { Midi } = await loadVendor();
  const midi = new Midi(arrayBuffer);
  const notes = [];
  const named = [];
  midi.tracks.forEach((tr, i) => {
    if (tr.channel === 9 || tr.instrument?.percussion) return; // drums
    for (const n of tr.notes) notes.push({ midi: n.midi, t: n.time, d: n.duration, vel: n.velocity, track: i });
    named.push(tr.name || '');
  });
  const bpm = midi.header.tempos?.[0]?.bpm || null;
  const ts = midi.header.timeSignatures?.[0]?.timeSignature;
  // Two piano tracks (common in piano MIDI files): the higher one is the right hand.
  const tracks = [...new Set(notes.map((n) => n.track))];
  let handsFromTracks = null;
  if (tracks.length === 2) {
    const avg = (t) => { const ns = notes.filter((n) => n.track === t); return ns.reduce((a, n) => a + n.midi, 0) / ns.length; };
    const [hi, lo] = avg(tracks[0]) >= avg(tracks[1]) ? tracks : [tracks[1], tracks[0]];
    handsFromTracks = { [hi]: 'R', [lo]: 'L' };
  }
  return { notes, bpm, beatsPerBar: ts ? ts[0] * (4 / ts[1]) : 4, handsFromTracks, name: midi.name };
}

/** MIDI files start "MThd". */
export function isMidiFile(buf, name = '') {
  const b = new Uint8Array(buf, 0, 4);
  return (b[0] === 0x4d && b[1] === 0x54 && b[2] === 0x68 && b[3] === 0x64) || /\.midi?$/i.test(name);
}

// ---- Tidying -------------------------------------------------------------------------------------------

export function cleanNotes(notes, { lo = 21, hi = 108, minDur = 0.06, minVel = 0.12 } = {}) {
  let out = notes
    .filter((n) => n.midi >= lo && n.midi <= hi && n.d >= minDur * 0.6 && (n.vel ?? 1) >= minVel)
    .map((n) => ({ ...n, d: Math.min(Math.max(n.d, minDur), 6) }))
    .sort((a, b) => a.t - b.t || a.midi - b.midi);
  // Merge same-pitch notes that overlap or nearly touch (a sustained note split in two).
  const last = new Map();
  const merged = [];
  for (const n of out) {
    const prev = last.get(n.midi);
    if (prev && n.t <= prev.t + prev.d + 0.03 && n.t - prev.t < 0.08) {
      prev.d = Math.max(prev.d, n.t + n.d - prev.t);
      continue;
    }
    if (prev && n.t < prev.t + prev.d) prev.d = Math.max(0.05, n.t - prev.t - 0.01);
    merged.push(n);
    last.set(n.midi, n);
  }
  // Start the song near zero.
  const t0 = merged.length ? Math.max(0, merged[0].t - 0.2) : 0;
  return merged.map((n) => ({ ...n, t: n.t - t0 }));
}

/**
 * Guesses the beat from note onsets: for each tempo, how well do onsets line up on a grid?
 * A gentle preference for 70–140 bpm settles double/half-time ambiguity. Returns {bpm, offset, confidence}.
 */
export function estimateTempo(notes) {
  const onsets = [];
  for (const n of notes) {
    const last = onsets[onsets.length - 1];
    if (last && n.t - last.t < 0.04) { last.w += n.vel ?? 0.7; continue; }
    onsets.push({ t: n.t, w: n.vel ?? 0.7 });
  }
  if (onsets.length < 8) return { bpm: 100, offset: 0, confidence: 0 };
  let best = { bpm: 100, offset: 0, score: -1, R: 0 };
  for (let bpm = 50; bpm <= 200; bpm += 0.5) {
    const beat = 60 / bpm;
    let re = 0, im = 0, W = 0;
    for (const o of onsets) {
      const a = (2 * Math.PI * o.t) / beat;
      re += o.w * Math.cos(a); im += o.w * Math.sin(a); W += o.w;
    }
    const R = Math.hypot(re, im) / W;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 100) / 0.55, 2));
    const score = R * (0.55 + 0.45 * prior);
    if (score > best.score) {
      let phase = Math.atan2(im, re);
      if (phase < 0) phase += 2 * Math.PI;
      best = { bpm, offset: (phase / (2 * Math.PI)) * beat, score, R };
    }
  }
  return { bpm: Math.round(best.bpm * 2) / 2, offset: best.offset, confidence: best.R };
}

/** Snaps starts (and lengths) to a grid of `div` steps per beat. */
export function quantize(notes, bpm, offset = 0, div = 4) {
  const step = 60 / bpm / div;
  return notes.map((n) => {
    const t = offset + Math.round((n.t - offset) / step) * step;
    const end = offset + Math.round((n.t + n.d - offset) / step) * step;
    return { ...n, t: Math.max(0, t), d: Math.max(step, end - t) };
  });
}

/** Groups notes that start together. */
export function clusters(notes, tol = 0.045) {
  const out = [];
  let cur = null;
  for (const n of notes) {
    if (cur && n.t - cur.t <= tol) cur.notes.push(n);
    else { cur = { t: n.t, notes: [n] }; out.push(cur); }
  }
  return out;
}

/** Splits notes between the hands, following where each hand has been playing. */
export function splitHands(notes) {
  let rh = 67, lh = 50;
  const out = [];
  for (const c of clusters(notes)) {
    const sorted = [...c.notes].sort((a, b) => a.midi - b.midi);
    let gapAt = -1, gap = 0;
    for (let i = 1; i < sorted.length; i++) {
      const g = sorted[i].midi - sorted[i - 1].midi;
      if (g > gap) { gap = g; gapAt = i; }
    }
    let assign;
    if (sorted.length > 1 && (gap >= 5 || sorted[sorted.length - 1].midi - sorted[0].midi > 14)) {
      assign = sorted.map((n, i) => (i >= gapAt ? 'R' : 'L'));
    } else {
      const mid = (sorted[0].midi + sorted[sorted.length - 1].midi) / 2;
      const h = Math.abs(mid - rh) <= Math.abs(mid - lh) ? 'R' : 'L';
      assign = sorted.map(() => h);
    }
    // One hand cannot stretch much more than an octave.
    const rIdx = sorted.map((n, i) => (assign[i] === 'R' ? i : -1)).filter((i) => i >= 0);
    while (rIdx.length > 1 && sorted[rIdx[rIdx.length - 1]].midi - sorted[rIdx[0]].midi > 14) { assign[rIdx[0]] = 'L'; rIdx.shift(); }
    const lIdx = sorted.map((n, i) => (assign[i] === 'L' ? i : -1)).filter((i) => i >= 0);
    while (lIdx.length > 1 && sorted[lIdx[lIdx.length - 1]].midi - sorted[lIdx[0]].midi > 14) { assign[lIdx[lIdx.length - 1]] = 'R'; lIdx.pop(); }
    sorted.forEach((n, i) => {
      out.push({ ...n, hand: assign[i] });
      if (assign[i] === 'R') rh = rh * 0.8 + n.midi * 0.2; else lh = lh * 0.8 + n.midi * 0.2;
    });
    if (rh - lh < 7) { const m = (rh + lh) / 2; rh = m + 3.5; lh = m - 3.5; }
  }
  return out.sort((a, b) => a.t - b.t || a.midi - b.midi);
}

/**
 * level: 'melody' – the top line only, right hand
 *        'easy'   – the melody plus one bass note per beat
 *        'full'   – everything that was heard
 */
export function simplify(notes, level, bpm = 100) {
  if (level === 'full') return notes;
  const melody = [];
  for (const c of clusters(notes)) {
    const top = c.notes.filter((n) => n.hand !== 'L').sort((a, b) => b.midi - a.midi)[0] || (level === 'melody' ? c.notes.sort((a, b) => b.midi - a.midi)[0] : null);
    if (top) melody.push({ ...top, hand: 'R' });
  }
  // A melody plays one note at a time.
  for (let i = 0; i + 1 < melody.length; i++) melody[i].d = Math.min(melody[i].d, Math.max(0.08, melody[i + 1].t - melody[i].t - 0.01));
  if (level === 'melody') return melody;
  const beat = 60 / bpm;
  const bass = [];
  for (const c of clusters(notes)) {
    const low = c.notes.filter((n) => n.hand === 'L').sort((a, b) => a.midi - b.midi)[0];
    if (!low) continue;
    const prev = bass[bass.length - 1];
    if (prev && low.t - prev.t < beat * 0.9) continue;
    bass.push({ ...low, hand: 'L' });
  }
  for (let i = 0; i + 1 < bass.length; i++) bass[i].d = Math.min(bass[i].d, Math.max(0.1, bass[i + 1].t - bass[i].t - 0.02));
  return [...melody, ...bass].sort((a, b) => a.t - b.t || a.midi - b.midi);
}

const COLORS = ['#ff7a45', '#3fa7f5', '#8e5bff', '#2ec4b6', '#ff5bc8', '#ffc93c', '#5b6cff'];
const EMOJI = ['🎧', '🎼', '🎹', '💿', '🌙', '🌊', '🔥', '🌸'];

export function buildSong({ title, notes, bpm, beatsPerBar = 4, source, audioId = null }) {
  const id = 'imp-' + Date.now().toString(36);
  const song = {
    id, title: title || 'My song', imported: true, source, bpm, beatsPerBar,
    notes: notes.map((n) => ({ midi: n.midi, t: Math.round(n.t * 1000) / 1000, d: Math.round(n.d * 1000) / 1000, hand: n.hand || 'R', vel: Math.round((n.vel ?? 0.7) * 100) / 100 })),
    created: Date.now(), audioId,
    color: COLORS[Math.floor(Math.random() * COLORS.length)], emoji: EMOJI[Math.floor(Math.random() * EMOJI.length)],
    composer: source === 'midi' ? 'Imported MIDI' : 'Imported recording',
  };
  song.level = measureDifficulty(compileSong(song));
  return song;
}

/** Everything after the model (or MIDI parse): the options the import screen lets you change. */
export function arrange(rawNotes, { quantizeDiv = 0, level = 'full', tempo = null, handsFromTracks = null } = {}) {
  let notes = cleanNotes(rawNotes);
  const tempoInfo = tempo ? { bpm: tempo, offset: 0, confidence: 1 } : estimateTempo(notes);
  if (quantizeDiv) notes = quantize(notes, tempoInfo.bpm, tempoInfo.offset, quantizeDiv);
  notes = handsFromTracks ? notes.map((n) => ({ ...n, hand: handsFromTracks[n.track] || 'R' })) : splitHands(notes);
  notes = simplify(notes, level, tempoInfo.bpm);
  return { notes, tempo: tempoInfo };
}
