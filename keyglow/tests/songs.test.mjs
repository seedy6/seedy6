import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../app/src/main/assets/web/js/music/songs.js';
import { parseTrack, compileSong, parseDuration, buildSteps } from '../app/src/main/assets/web/js/music/notation.js';
import { parseNote, detectChord, fitRange } from '../app/src/main/assets/web/js/music/theory.js';

/** Duration of every bar in a track (durations carry over between bars, like the parser). */
function barLengths(text) {
  let dur = 1;
  return text.split('|').map((bar) => {
    let len = 0;
    for (const tok of bar.trim().split(/\s+/).filter(Boolean)) {
      const t = tok.split('@')[0];
      const c = t.indexOf(':');
      if (c >= 0) dur = parseDuration(t.slice(c + 1));
      len += dur;
    }
    return Math.round(len * 1000) / 1000;
  });
}

test('note names', () => {
  assert.equal(parseNote('C4'), 60);
  assert.equal(parseNote('A0'), 21);
  assert.equal(parseNote('F#3'), 54);
  assert.equal(parseNote('Bb2'), 46);
  assert.equal(parseNote('C8'), 108);
  assert.ok(Number.isNaN(parseNote('H4')));
});

test('durations', () => {
  assert.equal(parseDuration('q'), 1);
  assert.equal(parseDuration('h.'), 3);
  assert.equal(parseDuration('e'), 0.5);
  assert.equal(parseDuration('1.75'), 1.75);
  assert.ok(Math.abs(parseDuration('et') - 1 / 3) < 1e-9);
});

test('parser carries durations and reads chords and fingers', () => {
  const { notes, length } = parseTrack('C4:h@1 D4 C4+E4+G4:q r F4@4', 'R');
  assert.equal(notes.length, 6);
  assert.equal(notes[1].dur, 2);
  assert.equal(notes[2].start, 4);
  assert.equal(notes[4].midi, 67);
  assert.equal(notes[5].start, 6);
  assert.equal(notes[5].finger, 4);
  assert.equal(length, 7);
});

for (const song of SONGS) {
  test(`song "${song.title}" is well formed`, () => {
    const per = song.beatsPerBar || 4;
    const totals = {};
    for (const [hand, text] of Object.entries(song.tracks)) {
      const bars = barLengths(text);
      bars.forEach((len, i) => {
        if (i === 0 || i === bars.length - 1) assert.ok(len <= per + 1e-6, `${hand} bar ${i + 1} is ${len} beats`);
        else assert.equal(len, per, `${song.id} ${hand} bar ${i + 1} has ${len} beats, expected ${per}`);
      });
      totals[hand] = bars.reduce((a, b) => a + b, 0);
      parseTrack(text, hand[0]);
    }
    const vals = Object.values(totals);
    for (const v of vals) assert.ok(Math.abs(v - vals[0]) < 1e-6, `${song.id}: hands differ in length ${JSON.stringify(totals)}`);
    const chart = compileSong(song);
    assert.ok(chart.notes.length > 4);
    assert.ok(chart.lo >= 36 && chart.hi <= 96, `${song.id} fits a 61-key keyboard`);
    assert.ok(song.level >= 1 && song.level <= 5);
  });
}

test('song ids are unique', () => {
  assert.equal(new Set(SONGS.map((s) => s.id)).size, SONGS.length);
});

test('steps group chords', () => {
  const chart = compileSong({ id: 'x', bpm: 60, tracks: { R: 'C4+E4+G4:q D4', L: 'C3:h' } });
  const steps = buildSteps(chart.notes, ['R', 'L']);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].notes.length, 4);
  assert.equal(buildSteps(chart.notes, ['R']).length, 2);
});

test('chord names', () => {
  assert.equal(detectChord([60, 64, 67]).name, 'C');
  assert.equal(detectChord([57, 60, 64]).name, 'Am');
  assert.equal(detectChord([55, 59, 62, 65]).name, 'G7');
  assert.equal(detectChord([64, 67, 72]).name, 'C/E');
  assert.equal(detectChord([60]), null);
});

test('keyboard range fits', () => {
  const [lo, hi] = fitRange(60, 67);
  assert.ok(lo <= 58 && hi >= 69);
});
