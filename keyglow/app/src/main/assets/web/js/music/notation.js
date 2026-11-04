// A small text notation for writing songs by hand, and the compiler that turns a song into a "chart":
// a flat, time-sorted list of notes in seconds that the player, the waterfall and the scorer all share.
//
//   "E4:q D4 C4 D4 | E4 E4 E4:h | C4+E4+G4:w"
//
//   pitch      C4, F#3, Bb2  (octave 4 holds middle C)
//   chord      C4+E4+G4
//   rest       r
//   duration   :w whole, :h half, :q quarter, :e eighth, :s sixteenth,  "." dotted, "t" triplet,
//              or a number of beats (:1.5). A duration carries on to the following notes until changed.
//   finger     @1 … @5 (thumb is 1)
//   bar line   |  (only for readability)

import { parseNote } from './theory.js';

const DUR = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, t32: 0.125 };

export function parseDuration(s) {
  if (!s) return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const m = /^(w|h|q|e|s)(\.?)(t?)$/.exec(s);
  if (!m) return NaN;
  let d = DUR[m[1]];
  if (m[2]) d *= 1.5;
  if (m[3]) d *= 2 / 3;
  return d;
}

/** Parses one hand's line into notes measured in beats. Throws with the token on a mistake. */
export function parseTrack(text, hand = 'R') {
  const notes = [];
  let t = 0;
  let dur = 1;
  for (const raw of text.split(/\s+/)) {
    if (!raw || raw === '|') continue;
    let tok = raw;
    let finger = null;
    const at = tok.indexOf('@');
    if (at >= 0) { finger = tok.slice(at + 1).split('+').map(Number); tok = tok.slice(0, at); }
    const colon = tok.indexOf(':');
    if (colon >= 0) {
      const d = parseDuration(tok.slice(colon + 1));
      if (!(d > 0)) throw new Error(`Bad duration in "${raw}"`);
      dur = d;
      tok = tok.slice(0, colon);
    }
    if (tok === 'r' || tok === '-') { t += dur; continue; }
    const pitches = tok.split('+').map(parseNote);
    if (pitches.some((p) => Number.isNaN(p))) throw new Error(`Bad note "${raw}"`);
    pitches.forEach((midi, i) => {
      notes.push({ midi, start: t, dur, hand, finger: finger ? (finger[i] ?? finger[0]) : null });
    });
    t += dur;
  }
  return { notes, length: t };
}

let chartCounter = 0;

/**
 * Song → chart. A song is either written in notation ({bpm, tracks: {R, L}}) or already a list of
 * timed notes from an import ({notes: [{midi, t, d, hand}]}, times in seconds).
 */
export function compileSong(song) {
  const bpm = song.bpm || 100;
  const beat = 60 / bpm;
  const beatsPerBar = song.beatsPerBar || 4;
  let notes = [];
  let length = 0;
  if (song.notes) {
    notes = song.notes.map((n) => ({ midi: n.midi, t: n.t, d: n.d, hand: n.hand || 'R', finger: n.finger ?? null, vel: n.vel ?? 0.7 }));
    length = Math.max(0, ...notes.map((n) => n.t + n.d));
  } else {
    for (const [hand, text] of Object.entries(song.tracks || {})) {
      if (!text) continue;
      const tr = parseTrack(text, hand);
      for (const n of tr.notes) notes.push({ midi: n.midi, t: n.start * beat, d: n.dur * beat, hand, finger: n.finger, vel: 0.7 });
      length = Math.max(length, tr.length * beat);
    }
  }
  notes.sort((a, b) => a.t - b.t || a.midi - b.midi);
  notes.forEach((n, i) => { n.id = i; });
  const lo = notes.length ? Math.min(...notes.map((n) => n.midi)) : 60;
  const hi = notes.length ? Math.max(...notes.map((n) => n.midi)) : 72;
  return {
    key: `${song.id || 'song'}#${++chartCounter}`,
    song,
    notes,
    length,
    bpm,
    beat,
    beatsPerBar,
    lo,
    hi,
    hands: [...new Set(notes.map((n) => n.hand))].sort().reverse(), // R before L
  };
}

/**
 * Groups notes that start together (within `tol` seconds) into steps — what "wait mode" waits for.
 * Each step lists the indexes of its notes.
 */
export function buildSteps(notes, hands, tol = 0.035) {
  const steps = [];
  let cur = null;
  for (const n of notes) {
    if (!hands.includes(n.hand)) continue;
    if (cur && n.t - cur.t <= tol) cur.notes.push(n);
    else { cur = { t: n.t, notes: [n] }; steps.push(cur); }
  }
  return steps;
}

/** A short, kind description of a chart's difficulty from note density and spread. */
export function measureDifficulty(chart) {
  if (!chart.notes.length) return 1;
  const nps = chart.notes.length / Math.max(1, chart.length);
  const span = chart.hi - chart.lo;
  const hands = chart.hands.length;
  const chordy = chart.notes.length / buildSteps(chart.notes, chart.hands).length;
  const score = nps * 0.9 + span / 14 + (hands - 1) * 1.2 + (chordy - 1) * 1.5;
  return Math.max(1, Math.min(5, Math.round(score / 1.4)));
}
