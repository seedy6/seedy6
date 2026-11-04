// Note reading (a note on the staff → play it) and ear training (hear a note → find it).

import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useApp, nav, ensureListening, refreshProfile } from '../app.js';
import { onInput } from '../input.js';
import { noteName, pitchClass, fitRange } from '../music/theory.js';
import { starsFor } from '../game/session.js';
import { recordResult } from '../game/progress.js';
import { Staff } from '../ui/staff.js';
import { KeyboardStrip } from '../ui/keyboard-strip.js';
import { IconButton, Segmented, Mascot } from '../ui/components.js';
import { Results } from './player.js';
import { QUIZZES } from '../music/course.js';
import * as audio from '../audio/engine.js';
import * as mic from '../audio/mic.js';

export function QuizView({ clef = 'treble', notes, count = 10, kind = 'read', onFinish, embedded, title }) {
  const { profile: p } = useApp();
  const kids = p.mode === 'kids';
  const pick = (prev) => {
    let n;
    do n = notes[Math.floor(Math.random() * notes.length)]; while (notes.length > 1 && n === prev);
    return n;
  };
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(() => pick(null));
  const [tries, setTries] = useState(0);
  const [feedback, setFeedback] = useState(null); // {ok, text}
  const [marks, setMarks] = useState(new Map());
  const stats = useRef({ first: 0, total: 0, started: performance.now() });
  const busy = useRef(false);
  const state = useRef({});
  state.current = { target, tries, round };

  const range = fitRange(Math.min(...notes) - 2, Math.max(...notes) + 2, { minWhite: 15 });

  useEffect(() => {
    ensureListening();
    audio.loadPiano();
    return onInput((ev) => {
      if (ev.type !== 'on' || busy.current) return;
      const { target: t, tries: n } = state.current;
      const ok = ev.midi === t || (kids && kind === 'read' && pitchClass(ev.midi) === pitchClass(t));
      if (ok) {
        busy.current = true;
        if (n === 0) stats.current.first++;
        stats.current.total++;
        audio.sfx.good();
        setMarks(new Map([[ev.midi, '#4ade80']]));
        setFeedback({ ok: true, text: `${kids ? 'Yes! ' : ''}${noteName(t, { octave: !kids })} ✓` });
        setTimeout(next, 750);
      } else {
        setTries(n + 1);
        audio.sfx.wrong();
        setMarks(new Map([[ev.midi, '#fb7185']]));
        setFeedback({ ok: false, text: n + 1 >= 2 ? `Look for the glowing key` : (kids ? 'Oops, try again!' : 'Not quite — try again') });
        if (kind === 'ear' && n + 1 < 3) setTimeout(() => replay(), 500);
      }
    });
  }, []);

  useEffect(() => { mic.setExpected([target]); if (kind === 'ear') setTimeout(replay, 400); }, [target]);
  useEffect(() => () => mic.setExpected([]), []);

  function replay() {
    audio.resumeAudio().then(() => {
      const c = audio.audioContext();
      audio.noteOn(state.current.target, 0.75, c.currentTime + 0.02, 1.0);
      mic.suppress(state.current.target, c.currentTime + 1.6);
    });
  }

  function next() {
    busy.current = false;
    setMarks(new Map());
    setFeedback(null);
    setTries(0);
    const r = state.current.round + 1;
    if (r >= count) {
      const accuracy = stats.current.first / count;
      onFinish({
        mode: 'wait', accuracy, stars: starsFor(accuracy, kids), score: stats.current.first * 100, maxCombo: 0,
        counts: { hit: stats.current.first, wrong: count - stats.current.first }, total: count,
        seconds: (performance.now() - stats.current.started) / 1000, hands: [],
      });
      return;
    }
    setRound(r);
    setTarget(pick(state.current.target));
  }

  const showHint = tries >= 2;
  return html`<div class="stage" style="display:flex;flex-direction:column">
    <div class="quiz-wrap">
      <div class="eyebrow" style="color:#cfd5f5">${title || (kind === 'ear' ? 'Ear training' : `Note reading · ${clef} clef`)} · ${round + 1} of ${count}</div>
      ${kind === 'read' ? html`<div class="staff-card"><${Staff} midi=${target} clef=${clef} noteColor=${feedback?.ok ? '#3dbb5c' : undefined} /></div>`
        : html`<div class="staff-card center" style="width:360px;padding:30px">
            ${kids ? html`<div style="display:flex;justify-content:center"><${Mascot} size=${80} /></div>` : html`<div style="font-size:64px">👂</div>`}
            <div style="color:#2b2160;font-size:20px;font-weight:600;margin:10px 0">Listen, then play the same key</div>
            <button class="btn blue" onClick=${replay}>🔊 Play again</button>
          </div>`}
      <div class="quiz-feedback" style=${{ color: feedback ? (feedback.ok ? '#4ade80' : '#fb7185') : '#cfd5f5' }}>${feedback ? feedback.text : (kids ? 'Which key is it?' : 'Play this note')}</div>
    </div>
    <${KeyboardStrip} range=${range} mode=${p.mode} height=${200} labels=${kids || showHint ? 'letters' : 'c-only'} highlight=${showHint ? [target] : null} marks=${marks} />
  </div>`;
}

export function Quiz({ preset = 'treble', kind = 'read' }) {
  const { profile: p } = useApp();
  const kids = p.mode === 'kids';
  const [which, setWhich] = useState(preset);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState(null);
  const q = kind === 'ear' ? { clef: 'treble', notes: kids ? [60, 62, 64, 65, 67] : [60, 62, 64, 65, 67, 69, 71, 72] } : QUIZZES[which];
  const finish = (res) => {
    const rec = recordResult(p, 'exercise', `quiz-${kind}-${which}`, res);
    refreshProfile();
    setResult({ res, rec });
  };
  return html`<div class="screen"><div class="player">
    <div class="player-bar">
      <${IconButton} icon="back" title="Back" onClick=${() => nav.back()} />
      <div class="player-title" style="flex:1">${kind === 'ear' ? 'Ear training' : 'Note reading'}</div>
      ${kind === 'read' ? html`<${Segmented} value=${which} onChange=${(v) => { setWhich(v); setRun(run + 1); }} options=${[
        { value: 'trebleC', label: 'Treble: C–G' }, { value: 'treble', label: 'Treble' }, { value: 'bassC', label: 'Bass: C–G' }, { value: 'bass', label: 'Bass' },
      ]} />` : null}
    </div>
    <${QuizView} key=${which + run} clef=${q.clef} notes=${q.notes} count=${10} kind=${kind} onFinish=${finish} />
    ${result ? html`<${Results} kids=${kids} ...${result} onRetry=${() => { setResult(null); setRun(run + 1); }} onDone=${() => nav.back()} />` : null}
  </div></div>`;
}
