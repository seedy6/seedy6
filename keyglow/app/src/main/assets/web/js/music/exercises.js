// Practice material made on the fly: scales, five-finger patterns, chords, arpeggios, rhythm drills and
// random sight-reading tunes. Each generator returns a song object ({notes: [...]}, times in seconds)
// that the player treats exactly like a song from the library.

import { NOTE_NAMES_SHARP, NOTE_NAMES_FLAT, SCALES, chordNotes } from './theory.js';

export const KEYS = [
  { name: 'C', root: 60, flats: false },
  { name: 'G', root: 55, flats: false },
  { name: 'D', root: 62, flats: false },
  { name: 'A', root: 57, flats: false },
  { name: 'E', root: 64, flats: false },
  { name: 'F', root: 65, flats: true },
  { name: 'B♭', root: 58, flats: true },
  { name: 'E♭', root: 63, flats: true },
];

// Standard one-octave fingerings, thumb = 1.
const RH_FINGERS = {
  C: [1, 2, 3, 1, 2, 3, 4, 5], G: [1, 2, 3, 1, 2, 3, 4, 5], D: [1, 2, 3, 1, 2, 3, 4, 5],
  A: [1, 2, 3, 1, 2, 3, 4, 5], E: [1, 2, 3, 1, 2, 3, 4, 5], F: [1, 2, 3, 4, 1, 2, 3, 4],
  'B♭': [4, 1, 2, 3, 1, 2, 3, 4], 'E♭': [3, 1, 2, 3, 4, 1, 2, 3],
};
const LH_FINGERS = {
  C: [5, 4, 3, 2, 1, 3, 2, 1], G: [5, 4, 3, 2, 1, 3, 2, 1], D: [5, 4, 3, 2, 1, 3, 2, 1],
  A: [5, 4, 3, 2, 1, 3, 2, 1], E: [5, 4, 3, 2, 1, 3, 2, 1], F: [5, 4, 3, 2, 1, 3, 2, 1],
  'B♭': [3, 2, 1, 4, 3, 2, 1, 3], 'E♭': [3, 2, 1, 4, 3, 2, 1, 3],
};

/** Builds a song from voices of {midis, beats, finger} items. */
export function fromVoices({ id, title, bpm = 80, beatsPerBar = 4, voices, desc = '', level = 1 }) {
  const beat = 60 / bpm;
  const notes = [];
  for (const v of voices) {
    let t = 0;
    for (const it of v.items) {
      for (const [i, m] of (it.midis || []).entries()) {
        notes.push({ midi: m, t: t * beat, d: it.beats * beat * (it.legato ?? 0.95), hand: v.hand, finger: Array.isArray(it.finger) ? it.finger[i] : it.finger ?? null });
      }
      t += it.beats;
    }
  }
  return { id, title, bpm, beatsPerBar, notes, desc, level, exercise: true };
}

const noteLabel = (k) => k.name;

export function scaleExercise({ key = 'C', type = 'major', hands = 'R', octaves = 1, bpm = 80, beats = 1 } = {}) {
  const k = KEYS.find((x) => x.name === key) || KEYS[0];
  const root = k.root - (type === 'major' ? 0 : 3) + (k.root > 62 ? -12 : 0); // relative minor below
  const steps = SCALES[type === 'major' ? 'major' : type];
  const up = [];
  for (let o = 0; o < octaves; o++) for (const s of steps) up.push(root + o * 12 + s);
  up.push(root + octaves * 12);
  const line = [...up, ...up.slice(0, -1).reverse()];
  const fingersFor = (map) => {
    if (octaves !== 1 || type !== 'major' || !map[k.name]) return line.map(() => null);
    const f = map[k.name];
    return [...f, ...f.slice(0, -1).reverse()];
  };
  const voices = [];
  if (hands.includes('R')) {
    const f = fingersFor(RH_FINGERS);
    voices.push({ hand: 'R', items: line.map((m, i) => ({ midis: [m], beats, finger: f[i] })) });
  }
  if (hands.includes('L')) {
    const f = fingersFor(LH_FINGERS);
    voices.push({ hand: 'L', items: line.map((m, i) => ({ midis: [m - 12], beats, finger: f[i] })) });
  }
  const name = type === 'major' ? `${noteLabel(k)} major` : `${(k.flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[((root % 12) + 12) % 12]} ${type.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
  return fromVoices({
    id: `scale-${key}-${type}-${hands}-${octaves}`, title: `${name} scale`, bpm,
    voices, desc: hands.length > 1 ? 'Both hands, an octave apart.' : (hands === 'R' ? 'Right hand' : 'Left hand'),
  });
}

export function fiveFinger({ key = 'C', minor = false, hands = 'R', bpm = 90 } = {}) {
  const k = KEYS.find((x) => x.name === key) || KEYS[0];
  const steps = minor ? [0, 2, 3, 5, 7] : [0, 2, 4, 5, 7];
  const pattern = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 0];
  const beatsOf = (i) => (i === 8 || i === pattern.length - 1 ? 2 : 1);
  const voices = [];
  const root = k.root > 64 ? k.root - 12 : k.root;
  if (hands.includes('R')) voices.push({ hand: 'R', items: pattern.map((p, i) => ({ midis: [root + steps[p]], beats: beatsOf(i), finger: p + 1 })) });
  if (hands.includes('L')) voices.push({ hand: 'L', items: pattern.map((p, i) => ({ midis: [root - 12 + steps[p]], beats: beatsOf(i), finger: 5 - p })) });
  return fromVoices({ id: `five-${key}-${minor}-${hands}`, title: `${k.name} ${minor ? 'minor' : 'major'} five-finger`, bpm, voices, desc: 'Keep every finger over its own key.' });
}

export function chordProgression({ key = 'C', hands = 'R', broken = false, bpm = 72 } = {}) {
  const k = KEYS.find((x) => x.name === key) || KEYS[0];
  const r = k.root > 62 ? k.root - 12 : k.root;
  // I – IV – V – I with close voicings (IV in 2nd inversion, V in 1st) so the hand barely moves.
  const I = chordNotes(r, '');
  const IV = [r, r + 5, r + 9];
  const V = [r - 1, r + 2, r + 7];
  const prog = [I, IV, V, I];
  const voices = [];
  const fingersRH = [[1, 3, 5], [1, 2, 5], [1, 2, 5], [1, 3, 5]];
  if (hands.includes('R')) {
    voices.push({
      hand: 'R',
      items: prog.flatMap((c, i) => (broken
        ? [...c, c[1]].map((m, j) => ({ midis: [m], beats: 1, finger: fingersRH[i][[0, 1, 2, 1][j]] }))
        : [{ midis: c, beats: 4, finger: fingersRH[i] }])),
    });
  }
  if (hands.includes('L')) {
    const bass = [r - 12, r - 7, r - 5, r - 12];
    voices.push({ hand: 'L', items: bass.map((m) => ({ midis: [m], beats: 4, finger: m === r - 12 ? 5 : (m === r - 7 ? 2 : 1) })) });
  }
  return fromVoices({ id: `chords-${key}-${hands}-${broken}`, title: `${k.name}: I–IV–V–I${broken ? ' (broken)' : ''}`, bpm, voices, desc: 'The three chords behind thousands of songs.' });
}

export function arpeggio({ key = 'C', minor = false, hands = 'R', bpm = 84 } = {}) {
  const k = KEYS.find((x) => x.name === key) || KEYS[0];
  const r = k.root > 62 ? k.root - 12 : k.root;
  const c = chordNotes(r, minor ? 'm' : '');
  const line = [c[0], c[1], c[2], c[0] + 12, c[2], c[1], c[0]];
  const voices = [];
  if (hands.includes('R')) voices.push({ hand: 'R', items: line.map((m, i) => ({ midis: [m], beats: i === line.length - 1 ? 2 : 1, finger: [1, 2, 3, 5, 3, 2, 1][i] })) });
  if (hands.includes('L')) voices.push({ hand: 'L', items: line.map((m, i) => ({ midis: [m - 12], beats: i === line.length - 1 ? 2 : 1, finger: [5, 3, 2, 1, 2, 3, 5][i] })) });
  return fromVoices({ id: `arp-${key}-${minor}-${hands}`, title: `${k.name}${minor ? 'm' : ''} arpeggio`, bpm, voices, desc: 'Broken chord, up and back.' });
}

export function contraryMotion({ bpm = 76 } = {}) {
  const up = [60, 62, 64, 65, 67, 65, 64, 62, 60];
  const down = [48, 47, 45, 43, 41, 43, 45, 47, 48];
  return fromVoices({
    id: 'contrary', title: 'Contrary motion', bpm,
    voices: [
      { hand: 'R', items: up.map((m, i) => ({ midis: [m], beats: i === up.length - 1 ? 2 : 1, finger: [1, 2, 3, 4, 5, 4, 3, 2, 1][i] })) },
      { hand: 'L', items: down.map((m, i) => ({ midis: [m], beats: i === down.length - 1 ? 2 : 1, finger: [1, 2, 3, 4, 5, 4, 3, 2, 1][i] })) },
    ],
    desc: 'Both thumbs start on C and the hands move away from each other.',
  });
}

/** A rhythm drill on one key: quarters, halves, eighths and rests. */
export function rhythmDrill({ level = 1, midi = 60, bpm = 84, seed = 1 } = {}) {
  const rnd = mulberry(seed);
  const cells = level <= 1
    ? [[1, 1, 1, 1], [2, 2], [1, 1, 2], [2, 1, 1], [4]]
    : [[1, 1, 1, 1], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 2], [1.5, 0.5, 2], [1, -1, 1, 1], [0.5, 0.5, 0.5, 0.5, 2]];
  const items = [];
  for (let bar = 0; bar < 8; bar++) {
    const cell = cells[Math.floor(rnd() * cells.length)];
    for (const b of cell) items.push(b < 0 ? { midis: [], beats: -b } : { midis: [midi], beats: b, legato: 0.8 });
  }
  return fromVoices({ id: `rhythm-${level}-${seed}`, title: `Rhythm drill ${level}`, bpm, voices: [{ hand: 'R', items }], desc: 'One key — it is all about timing. Use Play mode to be scored on rhythm.' });
}

/** A random tune that stays in a five-finger position: different every time. */
export function sightReading({ key = 'C', level = 1, hands = 'R', seed = Date.now() } = {}) {
  const rnd = mulberry(seed);
  const k = KEYS.find((x) => x.name === key) || KEYS[0];
  const root = k.root > 64 ? k.root - 12 : k.root;
  const steps = [0, 2, 4, 5, 7, 9, 11, 12];
  const span = level <= 1 ? 5 : level === 2 ? 6 : 8;
  const maxJump = level <= 1 ? 1 : level === 2 ? 2 : 4;
  const durs = level <= 1 ? [1, 1, 1, 2] : level === 2 ? [1, 1, 0.5, 2, 1] : [1, 0.5, 0.5, 1.5, 2, 1];
  const items = [];
  let pos = 0;
  let beats = 0;
  const total = 32;
  while (beats < total) {
    let d = durs[Math.floor(rnd() * durs.length)];
    const barLeft = 4 - (beats % 4);
    if (d > barLeft) d = barLeft;
    if (beats + d >= total - 0.01) d = total - beats;
    const isEnd = beats + d >= total - 0.01;
    if (isEnd) pos = 0; // end on the home note
    items.push({ midis: [root + steps[pos]], beats: d, finger: pos < 5 ? pos + 1 : null });
    beats += d;
    let next = pos + Math.round((rnd() * 2 - 1) * maxJump);
    if (next === pos) next += rnd() < 0.5 ? 1 : -1;
    pos = Math.max(0, Math.min(span - 1, next));
  }
  const voices = [{ hand: 'R', items }];
  if (hands.includes('L')) {
    const bass = [];
    for (let b = 0; b < total; b += 4) bass.push({ midis: [root - 12 + (b % 16 === 8 ? 7 : 0)], beats: 4, finger: b % 16 === 8 ? 1 : 5 });
    voices.push({ hand: 'L', items: bass });
  }
  return fromVoices({ id: `sight-${seed}`, title: `Sight-reading in ${k.name}`, bpm: level <= 1 ? 72 : 84, voices, desc: 'A brand-new tune every time. No peeking!' });
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The practice menu. Each entry knows how to make its exercise from the chosen options. */
export const PRACTICE = [
  { id: 'five', title: 'Five-finger patterns', icon: '🖐️', kids: true, minLevel: 1, desc: 'Warm up every finger.', make: (o) => fiveFinger(o), options: ['key', 'minor', 'hands'] },
  { id: 'scale', title: 'Scales', icon: '🪜', kids: true, minLevel: 2, desc: 'Major and minor scales with proper fingering.', make: (o) => scaleExercise(o), options: ['key', 'type', 'hands', 'octaves'] },
  { id: 'chords', title: 'Chords', icon: '🎶', kids: true, minLevel: 3, desc: 'I–IV–V–I, block or broken.', make: (o) => chordProgression(o), options: ['key', 'hands', 'broken'] },
  { id: 'arpeggio', title: 'Arpeggios', icon: '🌈', kids: false, minLevel: 3, desc: 'Broken chords across the keys.', make: (o) => arpeggio(o), options: ['key', 'minor', 'hands'] },
  { id: 'contrary', title: 'Contrary motion', icon: '🦋', kids: true, minLevel: 2, desc: 'Hands mirror each other.', make: (o) => contraryMotion(o), options: [] },
  { id: 'rhythm', title: 'Rhythm drills', icon: '🥁', kids: true, minLevel: 1, desc: 'Timing on a single key.', make: (o) => rhythmDrill({ ...o, seed: Math.floor(Math.random() * 1e6) }), options: ['level'] },
  { id: 'sight', title: 'Sight-reading', icon: '👀', kids: true, minLevel: 2, desc: 'A new random tune every time.', make: (o) => sightReading({ ...o, seed: Math.floor(Math.random() * 1e9) }), options: ['key', 'level', 'hands'] },
];
