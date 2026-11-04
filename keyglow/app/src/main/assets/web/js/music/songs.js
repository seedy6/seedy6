// The built-in song library: public-domain melodies (traditional tunes and classical pieces),
// arranged simply, plus a few original warm-up tunes for kids. Notation is described in notation.js.
// level: 1 (first week) … 5 (a challenge). Tracks: R = right hand, L = left hand
// (a key like "L2" is a second left-hand voice).

export const SONGS = [
  // ---- Level 1 ---------------------------------------------------------------------------------
  {
    id: 'hello-c', title: 'Hello, Middle C', composer: 'Keyglow original', level: 1, bpm: 84, kids: true,
    emoji: '👋', color: '#ff7a45', tags: ['warm-up'],
    desc: 'Three friendly notes: C, D and E with your thumb, pointer and middle finger.',
    tracks: { R: 'C4:q@1 D4@2 E4:h@3 | E4:q@3 D4@2 C4:h@1 | C4:q D4 E4 D4 | C4:w | E4:q E4 D4 D4 | C4:h E4:h | D4:q E4 D4 C4 | C4:w' },
  },
  {
    id: 'hot-cross-buns', title: 'Hot Cross Buns', composer: 'Traditional', level: 1, bpm: 92, kids: true,
    emoji: '🥐', color: '#ff9f1c', tags: ['nursery'],
    desc: 'The classic first song: just E, D and C.',
    tracks: { R: 'E4:q@3 D4@2 C4:h@1 | E4:q D4 C4:h | C4:e C4 C4 C4 D4 D4 D4 D4 | E4:q D4 C4:h' },
  },
  {
    id: 'five-fingers', title: 'Five Little Fingers', composer: 'Keyglow original', level: 1, bpm: 90, kids: true,
    emoji: '🖐️', color: '#ffc93c', tags: ['warm-up'],
    desc: 'Walk up and down C D E F G — one finger for every key.',
    tracks: { R: 'C4:q@1 D4@2 E4@3 F4@4 | G4:w@5 | G4:q@5 F4@4 E4@3 D4@2 | C4:w@1 | C4:q E4 G4 E4 | C4:h G4:h | F4:q E4 D4 E4 | C4:w' },
  },
  {
    id: 'mary', title: 'Mary Had a Little Lamb', composer: 'Traditional', level: 1, bpm: 100, kids: true,
    emoji: '🐑', color: '#8bd346', tags: ['nursery'],
    desc: 'A gentle tune with lots of repeated notes.',
    tracks: {
      R: 'E4:q@3 D4@2 C4@1 D4@2 | E4 E4 E4:h | D4:q D4 D4:h | E4:q G4@5 G4:h | E4:q D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:w',
      L: 'C3:w | C3:w | G2:w | C3:w | C3:w | C3:w | G2:w | C3:w',
    },
  },
  {
    id: 'joy-opening', title: 'Joy to the World (opening)', composer: 'G. F. Handel (attr.)', level: 1, bpm: 96, kids: true,
    emoji: '🌟', color: '#ffe156', tags: ['holiday'],
    desc: 'A whole C major scale, walking down. Perfect after your first scale.',
    tracks: {
      R: 'C5:h B4:q. A4:e | G4:h. F4:q | E4:h D4:h | C4:h. G4:q | A4:h. A4:q | B4:h. B4:q | C5:w',
      L: 'C3:w | C3:w | G2:w | C3:w | F2:w | G2:w | C3:w',
    },
  },
  {
    id: 'twinkle', title: 'Twinkle Twinkle Little Star', composer: 'Traditional', level: 1, bpm: 92, kids: true,
    emoji: '⭐', color: '#3fa7f5', tags: ['nursery'],
    desc: 'Jumps from C up to G, then steps back down.',
    tracks: {
      R: 'C4:q@1 C4 G4@5 G4 | A4 A4 G4:h | F4:q@4 F4 E4 E4 | D4 D4 C4:h | G4:q G4 F4 F4 | E4 E4 D4:h | G4:q G4 F4 F4 | E4 E4 D4:h | C4:q C4 G4 G4 | A4 A4 G4:h | F4:q F4 E4 E4 | D4 D4 C4:h',
      L: 'C3:w | F3:h C3:h | F3:h C3:h | G2:h C3:h | C3:h G2:h | C3:h G2:h | C3:h G2:h | C3:h G2:h | C3:w | F3:h C3:h | F3:h C3:h | G2:h C3:h',
    },
  },
  {
    id: 'au-clair', title: 'Au Clair de la Lune', composer: 'Traditional (France)', level: 1, bpm: 96, kids: true,
    emoji: '🌙', color: '#8e5bff', tags: ['folk'],
    desc: 'A moonlit French folk song with a little trip down to G.',
    tracks: {
      R: 'C4:q C4 C4 D4 | E4:h D4:h | C4:q E4 D4 D4 | C4:w | C4:q C4 C4 D4 | E4:h D4:h | C4:q E4 D4 D4 | C4:w | D4:q D4 D4 D4 | A3:h A3:h | D4:q C4 B3 A3 | G3:w | C4:q C4 C4 D4 | E4:h D4:h | C4:q E4 D4 D4 | C4:w',
      L: 'C3:w | G2:w | C3:w | C3:w | C3:w | G2:w | C3:w | C3:w | D3:w | D3:w | D3:w | G2:w | C3:w | G2:w | C3:h G2:h | C3:w',
    },
  },
  {
    id: 'robot-march', title: 'Robot March', composer: 'Keyglow original', level: 1, bpm: 104, kids: true,
    emoji: '🤖', color: '#2ec4b6', tags: ['warm-up', 'left hand'],
    desc: 'Beep boop! Left hand marches on C and G while the right hand answers.',
    tracks: {
      L: 'C3:q G3 C3 G3 | C3 G3 C3:h | C3:q G3 C3 G3 | G3 C3 G3:h | r:w | r:w | C3:q G3 C3 G3 | C3:w',
      R: 'r:w | r:w | r:w | r:w | E4:q G4 E4 G4 | E4 D4 C4:h | E4:q D4 E4 D4 | C4:w',
    },
  },
  // ---- Level 2 ---------------------------------------------------------------------------------
  {
    id: 'ode-to-joy', title: 'Ode to Joy', composer: 'Ludwig van Beethoven', level: 2, bpm: 100, kids: true,
    emoji: '🎻', color: '#5b6cff', tags: ['classical'],
    desc: 'From the Ninth Symphony. Mostly steps — watch the dotted rhythm at the ends of lines.',
    tracks: {
      R: 'E4:q@3 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:q. D4:e D4:h | E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:q. C4:e C4:h | D4:q D4 E4 C4 | D4 E4:e F4:e E4:q C4 | D4 E4:e F4:e E4:q D4 | C4 D4 G3:h | E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:q. C4:e C4:h',
      L: 'C3:w | G2:w | C3:w | G2:w | C3:w | G2:w | C3:w | G2:h C3:h | G2:w | C3:w | G2:w | C3:h G2:h | C3:w | G2:w | C3:w | G2:h C3:h',
    },
  },
  {
    id: 'frere-jacques', title: 'Frère Jacques', composer: 'Traditional (France)', level: 2, bpm: 104, kids: true,
    emoji: '🔔', color: '#ff5bc8', tags: ['folk', 'round'],
    desc: 'Are you sleeping, Brother John? Each line comes twice.',
    tracks: {
      R: 'C4:q D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:h | E4:q F4 G4:h | G4:e A4 G4 F4 E4:q C4 | G4:e A4 G4 F4 E4:q C4 | C4 G3 C4:h | C4:q G3 C4:h',
      L: 'C3:h G2:h | C3:h G2:h | C3:h G2:h | C3:h G2:h | C3:h G2:h | C3:h G2:h | C3:h G2:h | C3:w',
    },
  },
  {
    id: 'old-macdonald', title: 'Old MacDonald', composer: 'Traditional', level: 2, bpm: 108, kids: true,
    emoji: '🐮', color: '#8bd346', tags: ['nursery'],
    desc: 'E-I-E-I-O! Your thumb reaches down to G and A.',
    tracks: {
      R: 'C4:q C4 C4 G3 | A3 A3 G3:h | E4:q E4 D4 D4 | C4:h. G3:q | C4 C4 C4 G3 | A3 A3 G3:h | E4:q E4 D4 D4 | C4:w',
      L: 'C3:w | F2:h C3:h | C3:h G2:h | C3:w | C3:w | F2:h C3:h | C3:h G2:h | C3:w',
    },
  },
  {
    id: 'london-bridge', title: 'London Bridge', composer: 'Traditional', level: 2, bpm: 104, kids: true,
    emoji: '🌉', color: '#3fa7f5', tags: ['nursery'],
    desc: 'Falling down, falling down… a bouncy dotted rhythm.',
    tracks: {
      R: 'G4:q. A4:e G4:q F4 | E4 F4 G4:h | D4:q E4 F4:h | E4:q F4 G4:h | G4:q. A4:e G4:q F4 | E4 F4 G4:h | D4:h G4:h | E4:q C4:h.',
      L: 'C3:w | C3:w | G2:w | C3:w | C3:w | C3:w | G2:w | C3:w',
    },
  },
  {
    id: 'yankee-doodle', title: 'Yankee Doodle', composer: 'Traditional', level: 2, bpm: 112, kids: true,
    emoji: '🎩', color: '#ff4d6d', tags: ['folk'],
    desc: 'Quick and cheerful, with a jump down to G at the end of the first line.',
    tracks: {
      R: 'C4:q C4 D4 E4 | C4 E4 D4 G3 | C4 C4 D4 E4 | C4:h B3:h | C4:q C4 D4 E4 | F4 E4 D4 C4 | B3 G3 A3 B3 | C4:h C4:h',
      L: 'C3:w | C3:h G2:h | C3:w | C3:h G2:h | C3:w | F2:h F2:h | G2:w | C3:w',
    },
  },
  {
    id: 'row-row', title: 'Row, Row, Row Your Boat', composer: 'Traditional', level: 2, bpm: 132, beatsPerBar: 3, kids: true,
    emoji: '🚣', color: '#2ec4b6', tags: ['nursery', 'round'],
    desc: 'Gently down the stream, in a rolling 6/8 lilt.',
    tracks: {
      R: 'C4:q. C4:q. | C4:q D4:e E4:q. | E4:q D4:e E4:q F4:e | G4:h. | C5:e C5 C5 G4 G4 G4 | E4 E4 E4 C4 C4 C4 | G4:q F4:e E4:q D4:e | C4:h.',
      L: 'C3:h. | C3:h. | C3:h. | C3:h. | C3:h. | C3:h. | G2:h. | C3:h.',
    },
  },
  {
    id: 'saints', title: 'When the Saints Go Marching In', composer: 'Traditional (spiritual)', level: 2, bpm: 120, kids: true,
    emoji: '🎺', color: '#ffc93c', tags: ['jazz', 'folk'],
    desc: 'Lots of long notes to hold — count them out.',
    tracks: {
      R: 'r:q C4 E4 F4 | G4:w | r:q C4 E4 F4 | G4:w | r:q C4 E4 F4 | G4:h E4:h | C4:h E4:h | D4:w | r:q E4 E4 D4 | C4:h. C4:q | E4:h G4:q G4:q | F4:w | r:q E4 F4 G4 | E4:h C4:h | D4:h D4:h | C4:w',
      L: 'r:w | C3:w | r:w | C3:w | r:w | C3:w | C3:w | G2:w | r:w | C3:w | C3:w | F2:w | r:w | C3:w | G2:w | C3:w',
    },
  },
  {
    id: 'merry-christmas', title: 'We Wish You a Merry Christmas', composer: 'Traditional (England)', level: 2, bpm: 120, beatsPerBar: 3, kids: true,
    emoji: '🎄', color: '#ff4d6d', tags: ['holiday'],
    desc: 'A festive waltz with quick eighth notes.',
    tracks: {
      R: 'G4:q | C5 C5:e D5:e C5:e B4:e | A4:q A4 A4 | D5 D5:e E5:e D5:e C5:e | B4:q G4 G4 | E5 E5:e F5:e E5:e D5:e | C5:q A4 G4:e G4:e | A4:q D5 B4 | C5:h.',
      L: 'r:q | C3:h. | F2:h. | D3:h. | G2:h. | E3:h. | F2:h. | G2:h. | C3:h.',
    },
  },
  // ---- Level 3 ---------------------------------------------------------------------------------
  {
    id: 'jingle-bells', title: 'Jingle Bells (chorus)', composer: 'James Lord Pierpont', level: 3, bpm: 120, kids: true,
    emoji: '🛷', color: '#2ec4b6', tags: ['holiday'],
    desc: 'Many repeated Es — keep a steady beat.',
    tracks: {
      R: 'E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:e | E4:w | F4:q F4 F4:q. F4:e | F4:q E4 E4 E4:e E4:e | E4:q D4 D4 E4 | D4:h G4:h | E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:e | E4:w | F4:q F4 F4:q. F4:e | F4:q E4 E4 E4:e E4:e | G4:q G4 F4 D4 | C4:w',
      L: 'C3:w | C3:w | C3:w | C3:w | F2:w | C3:w | G2:w | G2:w | C3:w | C3:w | C3:w | C3:w | F2:w | C3:w | G2:w | C3:w',
    },
  },
  {
    id: 'happy-birthday', title: 'Happy Birthday', composer: 'Mildred & Patty Hill', level: 3, bpm: 100, beatsPerBar: 3, kids: true,
    emoji: '🎂', color: '#ff5bc8', tags: ['party'],
    desc: 'Play it for someone special! Watch the big jump on "dear…".',
    tracks: {
      R: 'G4:e. G4:s | A4:q G4 C5 | B4:h G4:e. G4:s | A4:q G4 D5 | C5:h G4:e. G4:s | G5:q E5 C5 | B4 A4 F5:e. F5:s | E5:q C5 D5 | C5:h.',
      L: 'r:q | C3:h. | G2:h. | G2:h. | C3:h. | C3:h. | F2:h. | C3:q G2:h | C3:h.',
    },
  },
  {
    id: 'amazing-grace', title: 'Amazing Grace', composer: 'John Newton (trad. melody)', level: 3, bpm: 84, beatsPerBar: 3, kids: false,
    emoji: '🕊️', color: '#8e5bff', tags: ['hymn'],
    desc: 'A slow, singing waltz. Let each long note ring.',
    tracks: {
      R: 'G3:q | C4:h E4:e C4:e | E4:h D4:q | C4:h A3:q | G3:h G3:q | C4:h E4:e C4:e | E4:h D4:e E4:e | G4:h E4:q | G4:h E4:e C4:e | E4:h D4:q | C4:h A3:q | G3:h G3:q | C4:h E4:e C4:e | E4:h D4:q | C4:h.',
      L: 'r:q | C3:h. | C3:h. | F2:h. | C3:h. | C3:h. | G2:h. | G2:h. | C3:h. | G2:h. | F2:h. | C3:h. | C3:h. | G2:h. | C3:h.',
    },
  },
  {
    id: 'auld-lang-syne', title: 'Auld Lang Syne', composer: 'Traditional (Scotland)', level: 3, bpm: 88, kids: false,
    emoji: '🥂', color: '#ffc93c', tags: ['folk'],
    desc: 'The New Year song, with its gentle dotted rhythm.',
    tracks: {
      R: 'G3:q | C4:q. C4:e C4:q E4 | D4:q. C4:e D4:q E4:e D4:e | C4:q. C4:e E4:q G4 | A4:h. A4:q | G4:q. E4:e E4:q C4 | D4:q. C4:e D4:q E4:e D4:e | C4:q. A3:e A3:q G3 | C4:h.',
      L: 'r:q | C3:w | G2:w | C3:w | F2:w | C3:w | G2:w | F2:h G2:h | C3:h.',
    },
  },
  {
    id: 'goin-home', title: 'Largo (“Goin’ Home”)', composer: 'Antonín Dvořák', level: 3, bpm: 66, kids: false,
    emoji: '🌄', color: '#ff9f1c', tags: ['classical'],
    desc: 'The famous theme from the New World Symphony. Slow and warm.',
    tracks: {
      R: 'E4:q. G4:e G4:h | E4:q. D4:e C4:h | D4:q E4 G4 E4 | D4:w | E4:q. G4:e G4:h | E4:q. D4:e C4:h | D4:q E4 D4 C4 | C4:w',
      L: 'C3+G3:w | C3+G3:w | G2+D3:w | G2+D3:w | C3+G3:w | A2+E3:w | G2+D3:w | C3+G3:w',
    },
  },
  {
    id: 'greensleeves', title: 'Greensleeves', composer: 'Traditional (England)', level: 3, bpm: 108, beatsPerBar: 3, kids: false,
    emoji: '🍃', color: '#8bd346', tags: ['folk'],
    desc: 'A minor-key Tudor melody with G♯ — your first sharp in a song.',
    tracks: {
      R: 'A4:q | C5:h D5:q | E5:q. F5:e E5:q | D5:h B4:q | G4:q. A4:e B4:q | C5:h A4:q | A4:q. G#4:e A4:q | B4:h G#4:q | E4:h A4:q | C5:h D5:q | E5:q. F5:e E5:q | D5:h B4:q | G4:q. A4:e B4:q | C5:q. B4:e A4:q | G#4:q. F#4:e G#4:q | A4:h.',
      L: 'r:q | A2:h. | C3:h. | G2:h. | E2:h. | A2:h. | E2:h. | E2:h. | A2:h. | A2:h. | C3:h. | G2:h. | E2:h. | A2:h. | E2:h. | A2:h.',
    },
  },
  {
    id: 'silent-night', title: 'Silent Night', composer: 'Franz Xaver Gruber', level: 3, bpm: 80, beatsPerBar: 3, kids: true,
    emoji: '🌌', color: '#5b6cff', tags: ['holiday'],
    desc: 'A slow lullaby waltz reaching up to F.',
    tracks: {
      R: 'G4:q. A4:e G4:q | E4:h. | G4:q. A4:e G4:q | E4:h. | D5:h D5:q | B4:h. | C5:h C5:q | G4:h. | A4:h A4:q | C5:q. B4:e A4:q | G4:q. A4:e G4:q | E4:h. | A4:h A4:q | C5:q. B4:e A4:q | G4:q. A4:e G4:q | E4:h. | D5:h D5:q | F5:q. D5:e B4:q | C5:h. | E5:h. | C5:q G4 E4 | G4:q. F4:e D4:q | C4:h.',
      L: 'C3:h. | C3:h. | C3:h. | C3:h. | G2:h. | G2:h. | C3:h. | C3:h. | F2:h. | F2:h. | C3:h. | C3:h. | F2:h. | F2:h. | C3:h. | C3:h. | G2:h. | G2:h. | C3:h. | C3:h. | C3:h. | G2:h. | C3:h.',
    },
  },
  // ---- Level 4 ---------------------------------------------------------------------------------
  {
    id: 'fur-elise', title: 'Für Elise (opening)', composer: 'Ludwig van Beethoven', level: 4, bpm: 66, beatsPerBar: 1.5, kids: false,
    emoji: '🎹', color: '#ff4d6d', tags: ['classical'],
    desc: 'The famous E–D♯ wiggle, then broken chords passed between the hands.',
    tracks: {
      R: 'E5:s D#5 | E5 D#5 E5 B4 D5 C5 | A4:e r:s C4:s E4 A4 | B4:e r:s E4:s G#4 B4 | C5:e r:s E4:s E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4:e r:s C4:s E4 A4 | B4:e r:s E4:s C5 B4 | A4:q.',
      L: 'r:e | r:q. | A2:s E3 A3 r:s r:e | E2:s E3 G#3 r:s r:e | A2:s E3 A3 r:s r:e | r:q. | A2:s E3 A3 r:s r:e | E2:s E3 G#3 r:s r:e | A2:q.',
    },
  },
  {
    id: 'minuet-g', title: 'Minuet in G', composer: 'Christian Petzold', level: 4, bpm: 104, beatsPerBar: 3, kids: false,
    emoji: '👑', color: '#ffc93c', tags: ['classical', 'baroque'],
    desc: 'From the Anna Magdalena Bach notebook. In G major — mind the F♯.',
    tracks: {
      R: 'D5:q G4:e A4 B4 C5 | D5:q G4 G4 | E5:q C5:e D5 E5 F#5 | G5:q G4 G4 | C5:q D5:e C5 B4 A4 | B4:q C5:e B4 A4 G4 | F#4:q G4:e A4 B4 G4 | A4:h.',
      L: 'G3+B3:h A3:q | B3:h. | C4:h. | B3:h. | A3:h. | G3:h. | D3:h. | D3:q C3 B2',
    },
  },
  {
    id: 'kleine-nachtmusik', title: 'Eine kleine Nachtmusik', composer: 'Wolfgang Amadeus Mozart', level: 4, bpm: 120, kids: false,
    emoji: '🎼', color: '#5b6cff', tags: ['classical'],
    desc: 'The bold opening, all built from a G major chord, then D7.',
    tracks: {
      R: 'G4:q r:e D4:e G4:q r:e D4:e | G4:e D4 G4 B4 D5:q r:q | C5:q r:e A4:e C5:q r:e A4:e | C5:e A4 F#4 A4 D4:q r:q',
      L: 'G2:q r:e D3:e G2:q r:e D3:e | G2:e D3 G3 B3 D4:q r:q | D3:q r:e A2:e D3:q r:e A2:e | D3:e A2 F#2 A2 D2:q r:q',
    },
  },
  {
    id: 'canon', title: 'Canon (simplified)', composer: 'Johann Pachelbel', level: 4, bpm: 72, kids: false,
    emoji: '💒', color: '#c45bff', tags: ['classical', 'baroque'],
    desc: 'The famous bass line repeats while the melody grows. Arranged in C.',
    tracks: {
      R: 'E5:h D5 | C5 B4 | A4 G4 | A4 B4 | C5 B4 | A4 G4 | F4 E4 | F4 D4 | C4:q E4 G4 F4 | E4 C4 E4 D4 | C4 A3 C4 G4 | F4 A4 G4 F4 | E4 C4 D4 B4 | C5 E5 G5 G4 | A4 F4 G4 E4 | D4 C5 C5 B4 | C5:w',
      L: 'C3:h G2 | A2 E2 | F2 C2 | F2 G2 | C3 G2 | A2 E2 | F2 C2 | F2 G2 | C3 G2 | A2 E2 | F2 C2 | F2 G2 | C3 G2 | A2 E2 | F2 C2 | F2 G2 | C3:w',
    },
  },
  // ---- Level 5 ---------------------------------------------------------------------------------
  {
    id: 'prelude-c', title: 'Prelude in C', composer: 'Johann Sebastian Bach', level: 5, bpm: 66, kids: false,
    emoji: '🌊', color: '#2ec4b6', tags: ['classical', 'baroque'],
    desc: 'BWV 846, first eight bars: rolling broken chords. Hold the bass notes down.',
    tracks: {
      L: 'C3:h C3 | C3 C3 | B2 B2 | C3 C3 | C3 C3 | C3 C3 | B2 B2 | B2 B2',
      L2: 'r:s E3:1.75 r:s E3:1.75 | r:s D3:1.75 r:s D3:1.75 | r:s D3:1.75 r:s D3:1.75 | r:s E3:1.75 r:s E3:1.75 | r:s E3:1.75 r:s E3:1.75 | r:s D3:1.75 r:s D3:1.75 | r:s D3:1.75 r:s D3:1.75 | r:s C3:1.75 r:s C3:1.75',
      R: 'r:e G3:s C4 E4 G3 C4 E4 r:e G3:s C4 E4 G3 C4 E4 | r:e A3:s D4 F4 A3 D4 F4 r:e A3:s D4 F4 A3 D4 F4 | r:e G3:s D4 F4 G3 D4 F4 r:e G3:s D4 F4 G3 D4 F4 | r:e G3:s C4 E4 G3 C4 E4 r:e G3:s C4 E4 G3 C4 E4 | r:e A3:s E4 A4 A3 E4 A4 r:e A3:s E4 A4 A3 E4 A4 | r:e F#3:s A3 D4 F#3 A3 D4 r:e F#3:s A3 D4 F#3 A3 D4 | r:e G3:s D4 G4 G3 D4 G4 r:e G3:s D4 G4 G3 D4 G4 | r:e E3:s G3 C4 E3 G3 C4 r:e E3:s G3 C4 E3 G3 C4',
    },
  },
];

export const songById = (id) => SONGS.find((s) => s.id === id);
