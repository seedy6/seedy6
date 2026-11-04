// The learning path: units of short lessons, from finding middle C to playing Bach.
// Every lesson is a list of steps:
//   tip   – a card that explains something (with a kids' wording), optionally lighting up keys
//   play  – something to play in wait mode: a song from the library, a notation line, or an exercise
//   quiz  – note reading: a note appears on the staff, play it
// Stars for a lesson come from the average accuracy of its play/quiz steps.

import { fiveFinger, scaleExercise, chordProgression, arpeggio, contraryMotion, rhythmDrill } from './exercises.js';

const line = (id, title, R, opts = {}) => ({ kind: 'play', title, song: { id, title, bpm: opts.bpm || 80, beatsPerBar: opts.beatsPerBar || 4, tracks: { R, ...(opts.L ? { L: opts.L } : {}) } }, hands: opts.hands, tempo: opts.tempo });
const lineL = (id, title, L, opts = {}) => ({ kind: 'play', title, song: { id, title, bpm: opts.bpm || 80, tracks: { L } }, hands: ['L'] });
const song = (id, hands = ['R'], tempo) => ({ kind: 'play', songId: id, hands, tempo });
const tip = (title, text, kids, keys = []) => ({ kind: 'tip', title, text, kids, keys });

export const COURSE = [
  {
    id: 'u1', title: 'Meet the keyboard', kidsTitle: 'Hello, Piano!', icon: '🎹', color: '#ff7a45',
    lessons: [
      {
        id: 'u1l1', title: 'Find middle C', kidsTitle: 'Where is C?',
        steps: [
          tip('Black keys come in groups', 'Look at the black keys: they come in groups of two and three. The white key just to the left of every group of two is a C.', 'See the black keys? Some are in pairs — like two bunny ears! 🐰 The white key just left of the bunny ears is called C.', [60, 61, 63]),
          tip('Middle C', 'The C nearest the middle of your keyboard is "middle C" (C4). It is home base for both hands. Put your right thumb on it.', 'Find the C in the middle of your piano. That is Middle C — our home! Put your right thumb on it. 👍', [60]),
          line('find-c', 'Play middle C', 'C4:h@1 r C4:h@1 r C4:h@1 r C4:w@1', { bpm: 70 }),
          tip('Every C', 'There is a C in every octave. They all sound alike — just higher or lower.', 'There are lots of Cs! They are like a family — big, middle and little voices.', [48, 60, 72]),
          line('find-cs', 'High and low Cs', 'C4:h r C5:h r C4:h r C3:h r C4:w', { bpm: 70 }),
        ],
      },
      {
        id: 'u1l2', title: 'C, D and E', kidsTitle: 'Three new friends',
        steps: [
          tip('Fingers have numbers', 'Your thumb is finger 1, pointer 2, middle 3, ring 4 and pinky 5 — on both hands. Right hand: 1 on C, 2 on D, 3 on E.', 'Your fingers have numbers! Thumb is 1, then 2, 3, 4, and pinky is 5. 🖐️ Thumb on C, finger 2 on D, finger 3 on E.', [60, 62, 64]),
          line('cde-1', 'C D E', 'C4:q@1 D4@2 E4:h@3 | E4:q@3 D4@2 C4:h@1 | C4:q D4 E4 D4 | C4:w', { bpm: 72 }),
          line('cde-2', 'Mix them up', 'E4:q C4 D4 E4 | D4 C4 D4:h | E4:q E4 D4 D4 | C4:w', { bpm: 76 }),
          song('hello-c'),
        ],
      },
      {
        id: 'u1l3', title: 'F and G: the full hand', kidsTitle: 'All five fingers',
        steps: [
          tip('C position', 'Rest your right hand with one finger per key: C D E F G. This "C position" is where most first songs live.', 'Now put ALL your fingers down: C D E F G. One finger on each key, like a hand-print! 🖐️', [60, 62, 64, 65, 67]),
          line('fg', 'F and G', 'F4:q@4 G4@5 F4@4 G4@5 | F4 E4 D4 C4 | G4:h F4 | E4 D4 | C4:w', { bpm: 76 }),
          song('five-fingers'),
          tip('Curve your fingers', 'Keep your fingers curved as if holding a small ball, and play with the fingertips.', 'Make your hand round, like you are holding a bubble 🫧 — do not pop it!'),
        ],
      },
      {
        id: 'u1l4', title: 'First song', kidsTitle: 'Your first song!',
        steps: [
          tip('Hot Cross Buns', 'A song with just three notes: E, D and C. In wait mode, the music waits for you — take your time.', 'Time for a real song! 🥐 It only uses E, D and C. The music will wait for you, so no rush!', [64, 62, 60]),
          song('hot-cross-buns'),
          song('mary'),
        ],
      },
    ],
  },
  {
    id: 'u2', title: 'Right-hand melodies', kidsTitle: 'Melody Land', icon: '🎵', color: '#ffc93c',
    lessons: [
      {
        id: 'u2l1', title: 'Counting beats', kidsTitle: 'Long and short',
        steps: [
          tip('Note lengths', 'A quarter note lasts one beat, a half note two, a whole note four. In the falling notes, longer bars mean longer notes — hold the key until the bar ends.', 'Some notes are short and some are long! A long bar means hold the key down… 1, 2, 3, 4!'),
          line('beats', 'Quarters, halves and wholes', 'C4:q C4 C4 C4 | E4:h E4 | G4:w | E4:q E4 D4:h | C4:w', { bpm: 80 }),
          { kind: 'play', title: 'Rhythm on one key', exercise: () => rhythmDrill({ level: 1, seed: 7 }) },
        ],
      },
      {
        id: 'u2l2', title: 'Twinkle, Twinkle', kidsTitle: 'Little Star',
        steps: [
          tip('Jumps', 'Twinkle jumps from C up to G (a fifth), then walks back down step by step.', 'This song jumps from C all the way to G — like a little star leaping! ⭐', [60, 67]),
          song('twinkle'),
        ],
      },
      {
        id: 'u2l3', title: 'Ode to Joy', kidsTitle: 'A happy tune',
        steps: [
          tip('Beethoven', 'Ode to Joy stays in C position except for one low G — let your thumb stretch down for it.', 'This song is by Beethoven, a very famous composer! 🎻 Watch out for one low note at the end of line 3.', [55]),
          song('ode-to-joy'),
        ],
      },
      {
        id: 'u2l4', title: 'Folk songs', kidsTitle: 'Songs from far away',
        steps: [
          song('au-clair'),
          song('frere-jacques'),
        ],
      },
    ],
  },
  {
    id: 'u3', title: 'The left hand', kidsTitle: 'Lefty Time', icon: '🫲', color: '#2ec4b6',
    lessons: [
      {
        id: 'u3l1', title: 'Left-hand C position', kidsTitle: 'Hello, left hand!',
        steps: [
          tip('Mirror image', 'Put your left hand on the C below middle C (C3): pinky (5) on C, thumb (1) on G. The numbers run the other way!', 'Now your left hand! Pinky on the low C, thumb on G. It is a mirror! 🪞', [48, 50, 52, 53, 55]),
          lineL('lh-1', 'C D E F G with the left hand', 'C3:q@5 D3@4 E3@3 F3@2 | G3:w@1 | G3:q@1 F3@2 E3@3 D3@4 | C3:w@5'),
          { kind: 'play', title: 'Five-finger, left hand', exercise: () => fiveFinger({ key: 'C', hands: 'L' }) },
        ],
      },
      {
        id: 'u3l2', title: 'Bass notes', kidsTitle: 'Low and strong',
        steps: [
          tip('Bass lines', 'The left hand usually plays the low notes that hold a song up. Try the bass part of Twinkle on its own.', 'The left hand plays the big, low notes — like a bear walking! 🐻'),
          song('twinkle', ['L']),
          song('robot-march', ['L']),
        ],
      },
    ],
  },
  {
    id: 'u4', title: 'Hands together', kidsTitle: 'Teamwork!', icon: '🤝', color: '#5b6cff',
    lessons: [
      {
        id: 'u4l1', title: 'One hand waits, one plays', kidsTitle: 'Take turns',
        steps: [
          tip('Taking turns', 'Start with music where the hands take turns. Robot March: left hand first, then the right answers.', 'The hands take turns — left, then right. Beep boop! 🤖'),
          song('robot-march', ['R', 'L']),
        ],
      },
      {
        id: 'u4l2', title: 'Together at last', kidsTitle: 'Both at once',
        steps: [
          tip('Long notes in the left hand', 'In Mary Had a Little Lamb, the left hand plays one long note per bar while the right plays the tune. Practise slowly.', 'Left hand holds one long note, right hand plays the tune. You can do it! 💪'),
          song('mary', ['R', 'L'], 0.8),
          { kind: 'play', title: 'Contrary motion', exercise: () => contraryMotion({}) },
          song('twinkle', ['R', 'L'], 0.8),
        ],
      },
      {
        id: 'u4l3', title: 'Ode to Joy, hands together', kidsTitle: 'Big Ode to Joy',
        steps: [song('ode-to-joy', ['R', 'L'], 0.85), song('saints', ['R', 'L'])],
      },
    ],
  },
  {
    id: 'u5', title: 'Chords', kidsTitle: 'Chord Magic', icon: '✨', color: '#c45bff',
    lessons: [
      {
        id: 'u5l1', title: 'The C major chord', kidsTitle: 'Three keys at once',
        steps: [
          tip('Triads', 'A chord is three or more notes together. C major is C, E and G — fingers 1, 3 and 5. Press them at exactly the same time.', 'Press three keys together: C, E and G. That is a chord — it sounds like sunshine! ☀️', [60, 64, 67]),
          line('c-chord', 'C chord', 'C4+E4+G4:h@1+3+5 r | C4+E4+G4:h r | C4+E4+G4:w', { bpm: 70 }),
        ],
      },
      {
        id: 'u5l2', title: 'F and G chords', kidsTitle: 'More magic',
        steps: [
          tip('Moving chords', 'From C, keep your thumb on C and move fingers 2 and 5 up for F (C F A). For G, play B D G with fingers 1, 2 and 5.', 'Little moves make new chords! Watch the glowing keys. ✨', [60, 65, 69]),
          { kind: 'play', title: 'C – F – G – C', exercise: () => chordProgression({ key: 'C', hands: 'R' }) },
          { kind: 'play', title: 'With the bass', exercise: () => chordProgression({ key: 'C', hands: 'RL' }) },
          { kind: 'play', title: 'Broken chords', exercise: () => chordProgression({ key: 'C', hands: 'R', broken: true }) },
        ],
      },
      {
        id: 'u5l3', title: 'Arpeggios', kidsTitle: 'Rainbow chords',
        steps: [
          { kind: 'play', title: 'C arpeggio', exercise: () => arpeggio({ key: 'C' }) },
          { kind: 'play', title: 'A minor arpeggio', exercise: () => arpeggio({ key: 'A', minor: true }) },
          song('goin-home', ['R', 'L'], 0.85),
        ],
      },
    ],
  },
  {
    id: 'u6', title: 'Black keys & scales', kidsTitle: 'Sharps and Flats', icon: '🖤', color: '#ff4d6d',
    lessons: [
      {
        id: 'u6l1', title: 'Sharps', kidsTitle: 'Black-key adventure',
        steps: [
          tip('Sharp and flat', 'A sharp (♯) is the next key up, a flat (♭) the next key down. Most of the time that is a black key: F♯ is just right of F.', 'The black keys have names too! F sharp lives just to the right of F. 🏠', [65, 66, 67]),
          line('sharps', 'Find the sharps', 'F4:q F#4 G4:h | C4:q C#4 D4:h | G4:q G#4 A4:h | F#4:q G#4 A#4:h | F#4:w', { bpm: 72 }),
        ],
      },
      {
        id: 'u6l2', title: 'The C major scale', kidsTitle: 'Climbing the stairs',
        steps: [
          tip('Thumb under', 'A scale has more notes than fingers. After E (finger 3), tuck your thumb under to play F, then carry on 2 3 4 5.', 'Eight notes, five fingers… the trick is to tuck your thumb under! 🪜', [60, 62, 64, 65, 67, 69, 71, 72]),
          { kind: 'play', title: 'C major scale', exercise: () => scaleExercise({ key: 'C' }) },
          song('joy-opening', ['R']),
          { kind: 'play', title: 'G major scale', exercise: () => scaleExercise({ key: 'G' }) },
        ],
      },
      {
        id: 'u6l3', title: 'Minor keys', kidsTitle: 'Moody music',
        steps: [
          tip('Minor', 'Minor keys sound darker. A minor uses only white keys, but its "harmonic" version adds G♯.', 'Minor music can sound sad or spooky! 👻'),
          { kind: 'play', title: 'A minor scale', exercise: () => scaleExercise({ key: 'C', type: 'minor' }) },
          song('greensleeves', ['R'], 0.85),
        ],
      },
    ],
  },
  {
    id: 'u7', title: 'Classics', kidsTitle: 'Famous Music', icon: '🏛️', color: '#3fa7f5',
    lessons: [
      { id: 'u7l1', title: 'Minuet in G', kidsTitle: 'A royal dance', steps: [song('minuet-g', ['R'], 0.8), song('minuet-g', ['R', 'L'], 0.75)] },
      { id: 'u7l2', title: 'Für Elise', kidsTitle: 'Für Elise', steps: [tip('E and D♯', 'Für Elise begins by rocking between E and D♯ with fingers 4 and 3, then shares broken chords between the hands.', 'Rock between two keys, like a see-saw! 🎢', [76, 75]), song('fur-elise', ['R', 'L'], 0.7)] },
      { id: 'u7l3', title: 'Mozart', kidsTitle: 'Mozart’s night music', steps: [song('kleine-nachtmusik', ['R'], 0.8), song('kleine-nachtmusik', ['R', 'L'], 0.75)] },
      { id: 'u7l4', title: 'Canon & Prelude', kidsTitle: 'Big pieces', steps: [song('canon', ['R', 'L'], 0.8), song('prelude-c', ['R', 'L'], 0.7)] },
    ],
  },
];

/** Note-reading quizzes appear as their own practice item and inside lessons. */
export const QUIZZES = {
  trebleC: { clef: 'treble', notes: [60, 62, 64, 65, 67] },
  treble: { clef: 'treble', notes: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79] },
  bassC: { clef: 'bass', notes: [48, 50, 52, 53, 55] },
  bass: { clef: 'bass', notes: [41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60] },
};

// Note reading goes into the path after each hand learns its position.
COURSE[1].lessons.splice(1, 0, {
  id: 'u2l0', title: 'Reading notes (treble)', kidsTitle: 'Notes on lines',
  steps: [
    tip('The treble staff', 'Right-hand music is written on the treble staff. Middle C sits on a little line of its own just below it; each line and space above is the next white key.', 'Music is written on five lines. Each line and space is a key! Middle C wears a little hat line. 🎩', [60, 62, 64]),
    { kind: 'quiz', title: 'Name that note', ...QUIZZES.trebleC, count: 10 },
  ],
});
COURSE[2].lessons.splice(1, 0, {
  id: 'u3l0', title: 'Reading notes (bass)', kidsTitle: 'Low notes on lines',
  steps: [
    tip('The bass staff', 'Left-hand music uses the bass staff. Its top line is A3 and middle C sits just above it.', 'The low notes have their own five lines. 🐻', [48, 50, 52]),
    { kind: 'quiz', title: 'Name that note', ...QUIZZES.bassC, count: 10 },
  ],
});

export const allLessons = () => COURSE.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u })));
export const lessonById = (id) => allLessons().find((l) => l.id === id);
