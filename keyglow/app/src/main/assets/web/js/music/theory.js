// Notes, keys, names and chords. Pure functions, no DOM.

export const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const SOLFEGE = ['Do', 'Di', 'Re', 'Ri', 'Mi', 'Fa', 'Fi', 'Sol', 'Si', 'La', 'Li', 'Ti'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Boomwhacker-style colours per pitch class: the kids' mode paints every key its own colour. */
export const PITCH_COLORS = [
  '#ff4d6d', '#ff7a45', '#ff9f1c', '#ffc93c', '#ffe156', '#8bd346',
  '#2ec4b6', '#3fa7f5', '#5b6cff', '#8e5bff', '#c45bff', '#ff5bc8',
];

export const isBlack = (midi) => BLACK.has(((midi % 12) + 12) % 12);
export const pitchClass = (midi) => ((midi % 12) + 12) % 12;
export const octaveOf = (midi) => Math.floor(midi / 12) - 1;
export const midiToFreq = (midi, a4 = 440) => a4 * Math.pow(2, (midi - 69) / 12);
export const freqToMidi = (f, a4 = 440) => 69 + 12 * Math.log2(f / a4);

export function noteName(midi, { flats = false, octave = true, style = 'letter' } = {}) {
  const pc = pitchClass(midi);
  let n = style === 'solfege' ? SOLFEGE[pc] : (flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pc];
  return octave ? n + octaveOf(midi) : n;
}

/** "C4", "F#3", "Bb2", "c#5" → MIDI number. Returns NaN for anything else. */
export function parseNote(str) {
  const m = /^([A-Ga-g])([#♯b♭]*)(-?\d)$/.exec(str.trim());
  if (!m) return NaN;
  let pc = LETTER_PC[m[1].toUpperCase()];
  for (const c of m[2]) pc += (c === '#' || c === '♯') ? 1 : -1;
  return (parseInt(m[3], 10) + 1) * 12 + pc;
}

/** White keys between two MIDI notes, inclusive. */
export function whiteKeysBetween(lo, hi) {
  let n = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) n++;
  return n;
}

/** Widen a range so it starts and ends on white keys, with some margin, and at least `minWhite` white keys. */
export function fitRange(lo, hi, { margin = 2, minWhite = 15, min = 21, max = 108 } = {}) {
  lo = Math.max(min, lo - margin);
  hi = Math.min(max, hi + margin);
  while (isBlack(lo) && lo > min) lo--;
  while (isBlack(hi) && hi < max) hi++;
  let grow = 0;
  while (whiteKeysBetween(lo, hi) < minWhite) {
    if (grow++ % 2 === 0 ? hi < max : lo <= min) { hi++; while (isBlack(hi) && hi < max) hi++; }
    else { lo--; while (isBlack(lo) && lo > min) lo--; }
    if (lo <= min && hi >= max) break;
  }
  // Start on a C or F when it is close, it reads better.
  return [lo, hi];
}

// ---- Scales and chords ---------------------------------------------------------------------

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export function scaleNotes(root, type = 'major', octaves = 1) {
  const steps = SCALES[type];
  const out = [];
  for (let o = 0; o < octaves; o++) for (const s of steps) out.push(root + o * 12 + s);
  out.push(root + octaves * 12);
  return out;
}

const CHORD_SHAPES = [
  { name: '', intervals: [0, 4, 7], label: 'major' },
  { name: 'm', intervals: [0, 3, 7], label: 'minor' },
  { name: '7', intervals: [0, 4, 7, 10], label: 'dominant 7th' },
  { name: 'maj7', intervals: [0, 4, 7, 11], label: 'major 7th' },
  { name: 'm7', intervals: [0, 3, 7, 10], label: 'minor 7th' },
  { name: 'dim', intervals: [0, 3, 6], label: 'diminished' },
  { name: 'aug', intervals: [0, 4, 8], label: 'augmented' },
  { name: 'sus2', intervals: [0, 2, 7], label: 'suspended 2nd' },
  { name: 'sus4', intervals: [0, 5, 7], label: 'suspended 4th' },
  { name: '5', intervals: [0, 7], label: 'power chord' },
];

export function chordNotes(root, quality = '') {
  const shape = CHORD_SHAPES.find((c) => c.name === quality) || CHORD_SHAPES[0];
  return shape.intervals.map((i) => root + i);
}

/** Names the chord made by a set of held notes, e.g. [60,64,67] → "C", [57,60,64] → "Am". */
export function detectChord(midis) {
  const pcs = [...new Set(midis.map(pitchClass))];
  if (pcs.length < 2) return null;
  const bass = pitchClass(Math.min(...midis));
  let best = null;
  for (const root of pcs) {
    const rel = new Set(pcs.map((p) => (p - root + 12) % 12));
    for (const shape of CHORD_SHAPES) {
      if (shape.intervals.length !== rel.size) continue;
      if (!shape.intervals.every((i) => rel.has(i))) continue;
      const score = (root === bass ? 2 : 0) + shape.intervals.length;
      if (!best || score > best.score) best = { root, shape, score };
    }
  }
  if (!best) return null;
  const name = NOTE_NAMES_SHARP[best.root] + best.shape.name;
  const slash = best.root !== bass ? '/' + NOTE_NAMES_SHARP[bass] : '';
  return { name: name + slash, label: `${NOTE_NAMES_SHARP[best.root]} ${best.shape.label}`, root: best.root };
}

/** Interval names for ear training. */
export const INTERVALS = [
  'unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone',
  'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th', 'octave',
];
