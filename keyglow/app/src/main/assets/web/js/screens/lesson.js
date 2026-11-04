// A lesson: tips, things to play and quizzes, one after another, then stars for the lesson.

import { html, useState } from '../vendor/preact-htm.js';
import { useApp, nav, refreshProfile } from '../app.js';
import { lessonById } from '../music/course.js';
import { songById } from '../music/songs.js';
import { recordResult } from '../game/progress.js';
import { starsFor } from '../game/session.js';
import { PlayerView, Results } from './player.js';
import { QuizView } from './quiz.js';
import { KeyboardStrip } from '../ui/keyboard-strip.js';
import { IconButton, Mascot, Stars } from '../ui/components.js';
import { fitRange } from '../music/theory.js';
import * as audio from '../audio/engine.js';

export function Lesson({ id }) {
  const { profile: p } = useApp();
  const lesson = lessonById(id);
  const kids = p.mode === 'kids';
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [between, setBetween] = useState(null); // result of the step just played
  const [final, setFinal] = useState(null);
  if (!lesson) { nav.back(); return null; }
  const step = lesson.steps[index];
  const total = lesson.steps.length;

  const nextStep = (res) => {
    const all = res ? [...scores, res] : scores;
    if (res) setScores(all);
    setBetween(null);
    if (index + 1 < total) { setIndex(index + 1); return; }
    // Lesson finished.
    const acc = all.length ? all.reduce((a, r) => a + r.accuracy, 0) / all.length : 1;
    const summary = {
      mode: 'wait', accuracy: acc, stars: Math.max(kids ? 1 : 0, starsFor(acc, kids)),
      score: all.reduce((a, r) => a + (r.score || 0), 0), maxCombo: Math.max(0, ...all.map((r) => r.maxCombo || 0)),
      counts: all.reduce((c, r) => { for (const k in r.counts) c[k] = (c[k] || 0) + r.counts[k]; return c; }, {}),
      total: all.reduce((a, r) => a + (r.total || 0), 0), seconds: all.reduce((a, r) => a + (r.seconds || 0), 0),
      hands: [...new Set(all.flatMap((r) => r.hands || []))],
    };
    const rec = recordResult(p, 'lesson', lesson.id, summary);
    refreshProfile();
    if (rec.levelUp) audio.sfx.levelUp();
    setFinal({ res: summary, rec });
  };

  const header = html`<div class="player-bar">
    <${IconButton} icon="close" title="Leave lesson" onClick=${() => nav.back()} />
    <div class="player-title" style="flex:1">${kids ? lesson.kidsTitle || lesson.title : lesson.title}<div class="sub">${lesson.unit.icon} ${kids ? lesson.unit.kidsTitle : lesson.unit.title}</div></div>
    <div class="row" style="gap:6px">${lesson.steps.map((_, i) => html`<div style=${{ width: '28px', height: '8px', borderRadius: '9px', background: i < index ? '#4ade80' : i === index ? '#6ee7f9' : 'rgba(255,255,255,.15)' }}></div>`)}</div>
  </div>`;

  let body;
  if (final) {
    body = html`<div class="stage"></div><${Results} kids=${kids} ...${final} doneLabel=${kids ? 'Back to the map' : 'Continue'} onRetry=${() => { setFinal(null); setScores([]); setIndex(0); }} onDone=${() => nav.back()} />`;
  } else if (between) {
    body = html`<div class="stage" style="display:grid;place-items:center">
      <div class="tip-card center">
        ${kids ? html`<div style="display:flex;justify-content:center"><${Mascot} size=${90} mood=${between.stars >= 2 ? 'wow' : 'happy'} /></div>` : null}
        <h2>${between.stars >= 3 ? (kids ? 'Perfect! 🌟' : 'Excellent') : between.stars >= 2 ? (kids ? 'Super! 🎉' : 'Well played') : between.stars >= 1 ? (kids ? 'Good job!' : 'Good') : (kids ? 'Nice try!' : 'Keep practising')}</h2>
        <div style="margin:6px 0 14px"><${Stars} n=${between.stars} size=${40} /></div>
        <p>${Math.round(between.accuracy * 100)}% correct</p>
        <div class="row" style="justify-content:center">
          <button class="btn ghost" onClick=${() => setBetween(null) || setIndex(index)}>↻ Again</button>
          <button class="btn" onClick=${() => nextStep(between)}>${index + 1 < total ? 'Next' : 'Finish'} →</button>
        </div>
      </div>
    </div>`;
  } else if (step.kind === 'tip') {
    const range = step.keys.length ? fitRange(Math.min(...step.keys), Math.max(...step.keys), { minWhite: 15, margin: 4 }) : [48, 84];
    body = html`<div class="stage" style="display:flex;flex-direction:column;justify-content:space-between">
      <div style="flex:1;display:grid;place-items:center;padding:20px">
        <div class="tip-card">
          ${kids ? html`<div class="row" style="align-items:flex-start"><${Mascot} size=${100} /><div><h2>${step.title}</h2><p>${step.kids || step.text}</p></div></div>`
            : html`<h2>${step.title}</h2><p>${step.text}</p>`}
          <div class="row" style="justify-content:flex-end"><button class="btn" onClick=${() => nextStep(null)}>${kids ? 'Got it!' : 'Continue'} →</button></div>
        </div>
      </div>
      <${KeyboardStrip} key=${'kb' + index} range=${range} highlight=${step.keys} mode=${p.mode} height=${200} />
    </div>`;
  } else if (step.kind === 'quiz') {
    body = html`<${QuizView} key=${'q' + index} embedded clef=${step.clef} notes=${step.notes} count=${step.count} onFinish=${(res) => setBetween(res)} />`;
  } else {
    const song = step.songId ? songById(step.songId) : step.song || step.exercise();
    body = html`<div class="stage" style="display:flex"><div style="position:relative;flex:1">
      <${PlayerView} key=${'p' + index + ':' + scores.length} embedded song=${song} hands=${step.hands} mode="wait" tempo=${step.tempo || (kids ? 0.85 : 1)}
        title=${step.title || song.title} subtitle=${`Step ${index + 1} of ${total}`}
        onExit=${() => nav.back()} onFinish=${(res) => setTimeout(() => setBetween(res), 600)} />
    </div></div>`;
  }

  return html`<div class="screen"><div class="player">${step.kind === 'play' && !between && !final ? null : header}${body}</div></div>`;
}
