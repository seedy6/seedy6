// One run through a chart: the clock, wait mode, timing judgments, combos, scoring and stars.
// No DOM and no audio here — the player screen passes in the time and gets callbacks — so the
// rules can be tested in Node.
//
// Modes
//   wait    the music stops at each note until you play it (learning)
//   play    the music keeps going and every note is judged on timing (performing)
//   listen  everything plays itself, to hear how it goes

import { buildSteps } from '../music/notation.js';

export const WINDOWS = { perfect: 0.075, great: 0.15, good: 0.26 }; // seconds, real time
const POINTS = { perfect: 300, great: 200, good: 100 };
const WEIGHT = { perfect: 1, great: 0.8, good: 0.5 };

export function starsFor(accuracy, kids = false) {
  const t = kids ? [0.9, 0.7, 0.4] : [0.95, 0.85, 0.6];
  return accuracy >= t[0] ? 3 : accuracy >= t[1] ? 2 : accuracy >= t[2] ? 1 : 0;
}

export class Session {
  /**
   * @param o.chart      compiled chart (notation.compileSong)
   * @param o.hands      hands the person plays, e.g. ['R'] — the rest play themselves
   * @param o.mode       'wait' | 'play' | 'listen'
   * @param o.tempo      speed factor (1 = as written)
   * @param o.loop       [from, to] in chart seconds, or null
   * @param o.leadIn     seconds of falling notes before the first one arrives
   * @param o.kids       gentler stars
   * @param o.hooks      {play(note, inSeconds), judge(j), finish(results), expect(midis)}
   */
  constructor(o) {
    this.chart = o.chart;
    this.hands = o.hands && o.hands.length ? o.hands : this.chart.hands;
    this.mode = o.mode || 'wait';
    this.tempo = o.tempo || 1;
    this.loop = o.loop || null;
    this.leadIn = o.leadIn ?? 2.5;
    this.kids = !!o.kids;
    this.hooks = o.hooks || {};
    this.maxMistakesPerStep = o.maxMistakesPerStep ?? 2;
    this.reset();
  }

  reset() {
    const notes = this.chart.notes;
    this.isUser = (n) => this.mode !== 'listen' && this.hands.includes(n.hand);
    this.userNotes = notes.filter(this.isUser);
    this.steps = this.mode === 'wait' ? buildSteps(notes, this.hands) : [];
    this.state = new Map(notes.map((n) => [n.id, { played: false, judged: null }]));
    this.stepIndex = 0;
    this.stepMistakes = 0;
    this.stepHits = new Set();
    this.t = -this.leadIn;
    this.anchor = null; // {now, t}
    this.running = false;
    this.frozen = false;
    this.finished = false;
    this.playCursor = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0, hit: 0 };
    this.mistakes = 0;
    this.recentHits = new Map(); // midi → chart time of last hit (ignore detector double-triggers)
    this.startedAt = null;
    this.activeMs = 0;
    this.lastExpect = '';
  }

  get time() { return this.t; }
  get waiting() { return this.frozen; }
  get currentStep() { return this.steps[this.stepIndex] || null; }

  start(now) {
    this.running = true;
    this.anchor = { now, t: this.t };
    if (this.startedAt == null) this.startedAt = now;
  }

  pause(now) {
    if (!this.running) return;
    this.update(now);
    this.running = false;
  }

  resume(now) {
    if (this.running || this.finished) return;
    this.running = true;
    this.anchor = { now, t: this.t };
  }

  setTempo(tempo, now) {
    if (this.running) this.update(now);
    this.tempo = tempo;
    this.anchor = { now, t: this.t };
  }

  /** Jump to a chart time (used by loops and the scrub bar). */
  seek(t, now) {
    this.t = t;
    this.anchor = { now, t };
    this.frozen = false;
    this.finished = false;
    for (const n of this.chart.notes) {
      const s = this.state.get(n.id);
      if (n.t >= t - 0.001) { s.played = false; s.judged = null; }
      else { s.played = true; if (!s.judged && this.isUser(n)) s.judged = 'skipped'; }
    }
    this.playCursor = this.chart.notes.findIndex((n) => n.t >= t - 0.001);
    if (this.playCursor < 0) this.playCursor = this.chart.notes.length;
    this.stepIndex = this.steps.findIndex((s) => s.t >= t - 0.001);
    if (this.stepIndex < 0) this.stepIndex = this.steps.length;
    this.stepMistakes = 0;
    this.stepHits = new Set();
  }

  /** Chart time at a given performance.now() (for timing an input that happened a moment ago). */
  timeAt(now) {
    if (!this.running || this.frozen || !this.anchor) return this.t;
    return this.anchor.t + ((now - this.anchor.now) / 1000) * this.tempo;
  }

  update(now) {
    if (!this.running || this.finished) return this.t;
    const prev = this.t;
    let t = this.frozen ? this.t : this.anchor.t + ((now - this.anchor.now) / 1000) * this.tempo;
    if (t > prev && t - prev < 1) this.activeMs += ((t - prev) / this.tempo) * 1000;

    // Wait mode: stop at the next step until it is played.
    if (this.mode === 'wait') {
      const step = this.currentStep;
      if (step && t >= step.t) {
        t = step.t;
        if (!this.frozen) { this.frozen = true; this.anchor = { now, t }; }
      }
    }

    // Loop back.
    if (this.loop && t >= this.loop[1]) {
      this.seek(this.loop[0], now);
      this.hooks.loop && this.hooks.loop();
      return this.t;
    }

    this.t = t;
    this.scheduleAutoplay();

    if (this.mode === 'play') {
      const late = WINDOWS.good * this.tempo;
      for (const n of this.userNotes) {
        if (n.t > t - late) break;
        const s = this.state.get(n.id);
        if (!s.judged) { s.judged = 'miss'; this.counts.miss++; this.combo = 0; this.hooks.judge && this.hooks.judge({ grade: 'miss', note: n, midi: n.midi, combo: 0 }); }
      }
    }

    this.updateExpected();

    const end = this.loop ? this.loop[1] : this.chart.length + 0.6;
    const stepsDone = this.mode !== 'wait' || this.stepIndex >= this.steps.length;
    if (t >= end && stepsDone) this.finish();
    return this.t;
  }

  /** Plays the other hand(s) — or everything in listen mode — slightly ahead of time for accuracy. */
  scheduleAutoplay() {
    const notes = this.chart.notes;
    const look = 0.08 * this.tempo;
    const limit = this.mode === 'wait' && this.currentStep ? Math.min(this.t + look, this.currentStep.t) : this.t + look;
    while (this.playCursor < notes.length && notes[this.playCursor].t <= limit + 1e-6) {
      const n = notes[this.playCursor++];
      const s = this.state.get(n.id);
      if (s.played) continue;
      s.played = true;
      if (this.isUser(n)) continue;
      const delay = Math.max(0, (n.t - this.t) / this.tempo);
      this.hooks.play && this.hooks.play(n, delay, n.d / this.tempo);
    }
  }

  updateExpected() {
    if (!this.hooks.expect) return;
    let midis;
    if (this.mode === 'wait') {
      const step = this.currentStep;
      midis = step ? step.notes.filter((n) => !this.stepHits.has(n.id)).map((n) => n.midi) : [];
    } else if (this.mode === 'play') {
      const w = 0.45 * this.tempo;
      midis = this.userNotes.filter((n) => Math.abs(n.t - this.t) < w && !this.state.get(n.id).judged).map((n) => n.midi);
    } else midis = [];
    const key = midis.join(',');
    if (key !== this.lastExpect) { this.lastExpect = key; this.hooks.expect(midis); }
  }

  /** A key went down or up. ev: {type, midi, at}. */
  input(ev) {
    if (ev.type !== 'on' || this.finished || this.mode === 'listen') return;
    if (this.mode === 'wait') this.inputWait(ev);
    else this.inputPlay(ev);
  }

  inputWait(ev) {
    const step = this.currentStep;
    if (!step) return;
    const target = step.notes.find((n) => n.midi === ev.midi && !this.stepHits.has(n.id));
    // Playing ahead is fine in learn mode: the right key counts even before its note arrives —
    // unless it is the same key just played (most likely the microphone hearing it twice).
    if (step.t - this.t > 0.4 * this.tempo) {
      if (!target) { this.wrong(ev.midi, true); return; }
      const last = this.recentHits.get(ev.midi);
      if (last != null && this.t - last < 0.3 * this.tempo) return;
    }
    if (target) {
      this.stepHits.add(target.id);
      this.state.get(target.id).judged = 'hit';
      this.counts.hit++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 100 + Math.min(this.combo, 50) * 2;
      this.recentHits.set(ev.midi, this.t);
      this.hooks.judge && this.hooks.judge({ grade: 'hit', note: target, midi: ev.midi, combo: this.combo });
      if (step.notes.every((n) => this.stepHits.has(n.id))) this.advanceStep(ev.at);
      return;
    }
    if (step.notes.some((n) => n.midi === ev.midi)) return; // already got that one
    this.wrong(ev.midi, false);
  }

  advanceStep(now) {
    this.stepIndex++;
    this.stepMistakes = 0;
    this.stepHits = new Set();
    if (this.frozen) {
      this.frozen = false;
      this.anchor = { now: now ?? performance.now(), t: this.t };
    }
    this.hooks.step && this.hooks.step(this.stepIndex);
  }

  inputPlay(ev) {
    const tIn = this.timeAt(ev.at);
    const win = WINDOWS.good * this.tempo;
    let best = null, bestD = Infinity;
    for (const n of this.userNotes) {
      if (n.t > tIn + win) break;
      if (n.midi !== ev.midi) continue;
      const s = this.state.get(n.id);
      if (s.judged) continue;
      const d = Math.abs(n.t - tIn);
      if (d <= win && d < bestD) { best = n; bestD = d; }
    }
    if (!best) { this.wrong(ev.midi, false); return; }
    const real = bestD / this.tempo;
    const grade = real <= WINDOWS.perfect ? 'perfect' : real <= WINDOWS.great ? 'great' : 'good';
    this.state.get(best.id).judged = grade;
    this.counts[grade]++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += Math.round(POINTS[grade] * this.multiplier());
    this.recentHits.set(ev.midi, tIn);
    this.hooks.judge && this.hooks.judge({ grade, note: best, midi: ev.midi, combo: this.combo, offset: (tIn - best.t) / this.tempo });
  }

  multiplier() { return Math.min(4, 1 + Math.floor(this.combo / 10) * 0.5); }

  wrong(midi, early) {
    // A key that was just played correctly sounding again is most likely the microphone hearing it twice.
    const last = this.recentHits.get(midi);
    if (last != null && Math.abs(this.t - last) < 0.35 * this.tempo) return;
    if (this.mode === 'wait') {
      if (this.stepMistakes >= this.maxMistakesPerStep) return;
      this.stepMistakes++;
      this.mistakes++;
    }
    this.counts.wrong++;
    this.combo = 0;
    this.hooks.judge && this.hooks.judge({ grade: 'wrong', midi, combo: 0, early });
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this.hooks.finish && this.hooks.finish(this.results());
  }

  /** Accuracy so far, counting only notes already reached (for the live display). */
  liveAccuracy() {
    const c = this.counts;
    if (this.mode === 'wait') return c.hit + this.mistakes ? c.hit / (c.hit + this.mistakes) : 1;
    const judged = c.perfect + c.great + c.good + c.miss;
    if (!judged && !c.wrong) return 1;
    return (c.perfect * WEIGHT.perfect + c.great * WEIGHT.great + c.good * WEIGHT.good) / Math.max(1, judged + c.wrong * 0.5);
  }

  results() {
    const total = this.userNotes.filter((n) => this.state.get(n.id).judged !== 'skipped').length;
    let accuracy;
    if (this.mode === 'wait') {
      accuracy = this.counts.hit / Math.max(1, this.counts.hit + this.mistakes);
      if (this.counts.hit < total) accuracy *= this.counts.hit / Math.max(1, total);
    } else if (this.mode === 'play') {
      const w = this.counts.perfect * WEIGHT.perfect + this.counts.great * WEIGHT.great + this.counts.good * WEIGHT.good;
      accuracy = w / Math.max(1, total + this.counts.wrong * 0.5);
    } else accuracy = 1;
    accuracy = Math.max(0, Math.min(1, accuracy));
    return {
      mode: this.mode,
      accuracy,
      stars: this.mode === 'listen' ? 0 : starsFor(accuracy, this.kids),
      score: this.score,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      total,
      seconds: this.activeMs / 1000,
      hands: this.hands,
      tempo: this.tempo,
    };
  }
}
