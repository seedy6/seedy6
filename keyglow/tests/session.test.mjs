import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSong } from '../app/src/main/assets/web/js/music/notation.js';
import { Session, starsFor } from '../app/src/main/assets/web/js/game/session.js';
import { COURSE, allLessons } from '../app/src/main/assets/web/js/music/course.js';
import { songById } from '../app/src/main/assets/web/js/music/songs.js';
import { PRACTICE } from '../app/src/main/assets/web/js/music/exercises.js';

const chart = compileSong({ id: 't', bpm: 60, tracks: { R: 'C4:q D4 E4 C4+E4', L: 'C3:w' } });

function run(session, script, until = 10) {
  // script: [[timeSec, midi], …] presses at wall-clock times
  const presses = [...script];
  for (let ms = 0; ms <= until * 1000; ms += 10) {
    while (presses.length && presses[0][0] * 1000 <= ms) {
      const [, midi] = presses.shift();
      session.input({ type: 'on', midi, at: ms });
    }
    session.update(ms);
    if (session.finished) break;
  }
  return session.results();
}

test('wait mode waits, and counts mistakes', () => {
  const played = [];
  const s = new Session({ chart, hands: ['R'], mode: 'wait', leadIn: 1, hooks: { play: (n) => played.push(n.midi) } });
  s.start(0);
  // Notes arrive at wall 1s, 2s, 3s, 4s. Play the second one late, with a wrong note first.
  const r = run(s, [[1.0, 60], [2.5, 61], [3.0, 62], [3.7, 64], [4.8, 60], [4.8, 64]]);
  assert.ok(s.finished);
  assert.equal(r.counts.hit, 5);
  assert.equal(r.counts.wrong, 1);
  assert.ok(r.accuracy > 0.8 && r.accuracy < 0.85);
  assert.deepEqual(played, [48]); // the left hand played itself
});

test('wait mode stops the clock', () => {
  const s = new Session({ chart, hands: ['R'], mode: 'wait', leadIn: 1 });
  s.start(0);
  for (let ms = 0; ms <= 3000; ms += 10) s.update(ms);
  assert.equal(s.waiting, true);
  assert.equal(s.time, 0);
});

test('play mode judges timing', () => {
  const s = new Session({ chart, hands: ['R'], mode: 'play', leadIn: 1 });
  s.start(0);
  // Arrivals at 1, 2, 3, 4 s: perfect, great (+0.1), good (-0.2), miss both of the last chord except one.
  const r = run(s, [[1.01, 60], [2.1, 62], [2.8, 64], [4.0, 60]], 8);
  assert.equal(r.counts.perfect, 2);
  assert.equal(r.counts.great, 1);
  assert.equal(r.counts.good, 1);
  assert.equal(r.counts.miss, 1);
  assert.ok(r.stars <= 1);
});

test('tempo slows the clock', () => {
  const s = new Session({ chart, hands: ['R'], mode: 'play', leadIn: 0, tempo: 0.5 });
  s.start(0);
  s.update(1000);
  assert.ok(Math.abs(s.time - 0.5) < 1e-9);
});

test('stars', () => {
  assert.equal(starsFor(0.97), 3);
  assert.equal(starsFor(0.9), 2);
  assert.equal(starsFor(0.5), 0);
  assert.equal(starsFor(0.5, true), 1);
});

test('every lesson step can be built', () => {
  assert.ok(COURSE.length >= 6);
  for (const l of allLessons()) {
    assert.ok(l.steps.length > 0, l.id);
    for (const st of l.steps) {
      if (st.kind !== 'play') continue;
      const song = st.songId ? songById(st.songId) : st.song || st.exercise();
      assert.ok(song, `${l.id}: missing song ${st.songId}`);
      const c = compileSong(song);
      assert.ok(c.notes.length > 0, `${l.id} ${st.title}`);
      if (st.hands) for (const h of st.hands) assert.ok(c.hands.includes(h), `${l.id}: ${song.id} has no ${h} hand`);
    }
  }
});

test('every practice exercise builds', () => {
  for (const p of PRACTICE) {
    for (const hands of ['R', 'L', 'RL']) {
      const c = compileSong(p.make({ key: 'G', hands, level: 2 }));
      assert.ok(c.notes.length >= 4, p.id);
      assert.ok(c.lo >= 28 && c.hi <= 100, `${p.id} range ${c.lo}-${c.hi}`);
    }
  }
});
