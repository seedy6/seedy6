// The play screen: falling notes onto a glowing keyboard, with wait / play / listen modes,
// hand selection, tempo, looping, metronome and live scoring. Used for songs and exercises, and
// inside lessons (embedded).

import { html, useEffect, useMemo, useRef, useState } from '../vendor/preact-htm.js';
import { useApp, nav, onBack, ensureListening, effectiveInput, refreshProfile } from '../app.js';
import { compileSong } from '../music/notation.js';
import { fitRange, noteName } from '../music/theory.js';
import { songById } from '../music/songs.js';
import { Session } from '../game/session.js';
import { recordResult } from '../game/progress.js';
import { Waterfall, attachTouch } from '../ui/piano.js';
import { IconButton, Icon, Segmented, Modal, Stars, Confetti, Mascot, toast } from '../ui/components.js';
import * as audio from '../audio/engine.js';
import * as mic from '../audio/mic.js';
import { onInput, releaseAll } from '../input.js';
import { library } from '../store.js';

const HAND_LABEL = { R: 'Right', L: 'Left' };

/**
 * props: song, hands, mode, tempo, embedded, title, subtitle, onFinish(results), onExit()
 */
export function PlayerView(props) {
  const { profile: p, settings } = useApp();
  const kids = p?.mode === 'kids';
  const chart = useMemo(() => compileSong(props.song), [props.song]);
  const available = chart.hands;
  const [mode, setMode] = useState(props.mode || 'wait');
  const [hands, setHands] = useState(() => {
    const h = (props.hands || available).filter((x) => available.includes(x));
    return h.length ? h : available;
  });
  const [tempo, setTempo] = useState(props.tempo || (kids ? 0.85 : 1));
  const [phase, setPhase] = useState('ready'); // ready | running | paused | done
  const [hud, setHud] = useState({ score: 0, combo: 0, acc: 1, waiting: false, label: '' });
  const [loopOn, setLoopOn] = useState(false);
  const [metro, setMetro] = useState(settings.metronome);
  const [count, setCount] = useState(null);
  const [original, setOriginal] = useState(null); // HTMLAudioElement for imported songs
  const [useOriginal, setUseOriginal] = useState(false);
  const [inputState, setInputState] = useState(mic.micState());

  const canvasRef = useRef();
  const stageRef = useRef();
  const wf = useRef(null);
  const sess = useRef(null);
  const pressed = useRef(new Map());
  const lastJudge = useRef(new Map());
  const expected = useRef(new Set());
  const raf = useRef(0);
  const lastBeat = useRef(null);
  const origRef = useRef(null);
  origRef.current = original;
  const countRef = useRef(null);
  const live = useRef({ mode, hands, tempo, metro, loopOn, useOriginal });
  live.current = { mode, hands, tempo, metro, loopOn, useOriginal };

  const range = useMemo(() => {
    const r = fitRange(chart.lo, chart.hi, { minWhite: kids ? 15 : 22, margin: 2 });
    return r;
  }, [chart]);

  // ---- Set up canvas, input and the frame loop -------------------------------------------------------
  useEffect(() => {
    const w = new Waterfall(canvasRef.current, {
      mode: p?.mode, range, labels: settings.labels, showFingers: settings.showFingers, secondsVisible: settings.noteSpeed,
    });
    wf.current = w;
    const ro = new ResizeObserver(() => w.resize());
    ro.observe(stageRef.current);
    const detachTouch = attachTouch(canvasRef.current, () => ({ layout: w.layout, top: w.kbTop, height: w.kbH }));
    const offInput = onInput((ev) => {
      if (ev.type === 'on') pressed.current.set(ev.midi, ev.source);
      else pressed.current.delete(ev.midi);
      if (sess.current && sess.current.running) sess.current.input(ev);
    });
    const offMic = mic.onMicState(setInputState);
    ensureListening();
    audio.loadPiano();
    if (props.song.audioId) {
      library.getAudio(props.song.audioId).then((blob) => {
        if (!blob) return;
        const a = new Audio(URL.createObjectURL(blob));
        a.preservesPitch = true;
        a.preload = 'auto';
        setOriginal(a);
      });
    }
    const onPause = () => pause();
    window.addEventListener('kg-pause', onPause);

    const frame = () => {
      raf.current = requestAnimationFrame(frame);
      const now = performance.now();
      const s = sess.current;
      if (s && s.running) s.update(now);
      const t = s ? s.time : -2;
      // Metronome and count-in clicks on each beat.
      if (s && s.running && !s.waiting) {
        const beatIdx = Math.floor(t / chart.beat + 1e-6);
        if (lastBeat.current !== beatIdx) {
          lastBeat.current = beatIdx;
          const inBar = ((beatIdx % chart.beatsPerBar) + chart.beatsPerBar) % chart.beatsPerBar;
          if (t < 0 && settings.countIn && t > -chart.beat * chart.beatsPerBar - 0.01) {
            audio.click(inBar === 0);
            countRef.current = String(-beatIdx);
            setCount(countRef.current);
          } else if (t >= 0) {
            if (countRef.current !== null) { countRef.current = null; setCount(null); }
            if (live.current.metro && live.current.mode !== 'listen') audio.click(inBar === 0);
          }
        }
      }
      if (t >= 0 && countRef.current !== null) { countRef.current = null; setCount(null); }
      syncOriginal(s, t);
      const auto = new Map();
      if (s) {
        for (const n of chart.notes) {
          if (n.t > t) break;
          if (n.t + n.d > t && (!live.current.hands.includes(n.hand) || live.current.mode === 'listen')) auto.set(n.midi, true);
        }
      }
      const nowMs = now;
      w.draw({
        chart, time: t, noteState: s?.state, hands: live.current.hands, mode: live.current.mode,
        pressed: pressed.current, auto, expect: live.current.mode === 'listen' ? null : expected.current,
        waiting: s?.waiting, loop: s?.loop, tempo: live.current.tempo,
        colorForPress: (m) => {
          const j = lastJudge.current.get(m);
          if (j && nowMs - j.at < 600) return j.grade === 'wrong' ? w.pal.wrong : w.pal.hit;
          return w.pal.R[0];
        },
      });
    };
    raf.current = requestAnimationFrame(frame);
    const hudTimer = setInterval(() => {
      const s = sess.current;
      if (!s) return;
      const step = s.currentStep;
      setHud({
        score: s.score, combo: s.combo, acc: s.liveAccuracy(), waiting: s.waiting,
        label: s.waiting && step ? step.notes.filter((n) => !s.stepHits.has(n.id)).map((n) => noteName(n.midi, { octave: false })).join(' + ') : '',
      });
    }, 120);
    return () => {
      cancelAnimationFrame(raf.current);
      clearInterval(hudTimer);
      ro.disconnect();
      detachTouch();
      offInput();
      offMic();
      window.removeEventListener('kg-pause', onPause);
      audio.allNotesOff();
      releaseAll();
      mic.setExpected([]);
      if (origRef.current) origRef.current.pause();
    };
  }, []);

  useEffect(() => () => { if (original) { original.pause(); URL.revokeObjectURL(original.src); } }, [original]);

  // Back: pause first, then leave.
  useEffect(() => onBack(() => {
    if (phase === 'running') { pause(); return true; }
    return false;
  }), [phase]);

  function syncOriginal(s, t) {
    const a = origRef.current;
    if (!a) return;
    const shouldPlay = live.current.useOriginal && s && s.running && !s.waiting && t >= 0;
    if (!shouldPlay) { if (!a.paused) a.pause(); return; }
    a.playbackRate = live.current.tempo;
    if (Math.abs(a.currentTime - t) > 0.12) a.currentTime = Math.max(0, t);
    if (a.paused) a.play().catch(() => {});
  }

  function makeSession(startAt = null) {
    const w = wf.current;
    const lead = Math.max(settings.noteSpeed * 0.9, chart.beat * chart.beatsPerBar * (settings.countIn ? 1 : 0.5));
    const s = new Session({
      chart, hands: live.current.hands, mode: live.current.mode, tempo: live.current.tempo,
      leadIn: lead, kids,
      maxMistakesPerStep: effectiveInput() === 'mic' ? 1 : 2,
      hooks: {
        play: (n, delay, dur) => {
          if (live.current.useOriginal && origRef.current) return;
          const c = audio.audioContext();
          audio.noteOn(n.midi, n.vel ?? 0.7, c.currentTime + delay, Math.max(0.15, dur));
          mic.suppress(n.midi, c.currentTime + delay + dur + 0.3);
        },
        judge: (j) => {
          w.judge(j);
          lastJudge.current.set(j.midi, { grade: j.grade, at: performance.now() });
          if (j.grade === 'wrong' && kids) audio.sfx.wrong();
        },
        expect: (midis) => { expected.current = new Set(midis); mic.setExpected(midis); },
        finish: (res) => finished(res),
      },
    });
    if (startAt != null) s.seek(startAt, performance.now());
    return s;
  }

  async function start() {
    await audio.resumeAudio();
    audio.loadPiano();
    ensureListening();
    lastJudge.current.clear();
    lastBeat.current = null;
    const s = makeSession();
    sess.current = s;
    window.__kgSession = s; // for automated tests
    if (live.current.loopOn) setLoop(true, s);
    s.start(performance.now());
    setPhase('running');
  }

  function pause() {
    const s = sess.current;
    if (!s || !s.running) return;
    s.pause(performance.now());
    audio.allNotesOff();
    setPhase('paused');
  }

  function resume() {
    const s = sess.current;
    if (!s) return start();
    s.resume(performance.now());
    setPhase('running');
  }

  function restart() {
    audio.allNotesOff();
    sess.current = null;
    setCount(null);
    start();
  }

  function finished(res) {
    setPhase('done');
    setCount(null);
    audio.allNotesOff();
    if (origRef.current) origRef.current.pause();
    if (res.mode !== 'listen' && res.stars >= 1) audio.sfx.complete();
    props.onFinish && props.onFinish(res, { mode: live.current.mode, hands: live.current.hands, tempo: live.current.tempo });
  }

  function setLoop(on, s = sess.current) {
    setLoopOn(on);
    if (!s) return;
    if (!on) { s.loop = null; return; }
    const barLen = chart.beat * chart.beatsPerBar;
    const from = Math.max(0, Math.floor(Math.max(0, s.time) / barLen) * barLen);
    s.loop = [from, Math.min(chart.length, from + barLen * 2)];
    toast('Looping these two bars');
  }

  function changeTempo(v) {
    setTempo(v);
    if (sess.current) sess.current.setTempo(v, performance.now());
  }

  function changeMode(m) {
    setMode(m);
    live.current.mode = m;
    if (phase !== 'ready') { sess.current = null; setPhase('ready'); audio.allNotesOff(); }
  }

  function changeHands(h) {
    setHands(h);
    live.current.hands = h;
    if (phase !== 'ready') { sess.current = null; setPhase('ready'); audio.allNotesOff(); }
  }

  const handOptions = available.length > 1
    ? [...available.map((h) => ({ value: h, label: kids ? (h === 'R' ? '🫱 Right' : '🫲 Left') : HAND_LABEL[h] })), { value: 'both', label: 'Both' }]
    : null;
  const handValue = hands.length > 1 ? 'both' : hands[0];
  const exit = () => { audio.allNotesOff(); props.onExit ? props.onExit() : nav.back(); };

  return html`<div class="player">
    <div class="player-bar">
      <${IconButton} icon="back" title="Back" onClick=${exit} />
      <div class="player-title" style="flex:1">
        ${props.title || props.song.title}
        <div class="sub">${props.subtitle || props.song.composer || ''}</div>
      </div>
      ${props.lockMode ? null : html`<${Segmented} value=${mode} onChange=${changeMode} options=${[
        { value: 'wait', label: kids ? '🐢 Learn' : 'Learn' },
        { value: 'play', label: kids ? '⚡ Play' : 'Play' },
        { value: 'listen', label: kids ? '👂 Listen' : 'Listen' },
      ]} />`}
      ${handOptions && !props.lockHands ? html`<${Segmented} value=${handValue} onChange=${(v) => changeHands(v === 'both' ? available : [v])} options=${handOptions} />` : null}
      <div class="tempo hide-sm"><span>🐢</span><input type="range" min="0.4" max="1.25" step="0.05" value=${tempo} onInput=${(e) => changeTempo(parseFloat(e.target.value))} /><span>${Math.round(tempo * 100)}%</span></div>
      ${original ? html`<${IconButton} icon="music" title="Original recording" on=${useOriginal} onClick=${() => setUseOriginal(!useOriginal)} />` : null}
      <${IconButton} icon="loop" title="Loop two bars" on=${loopOn} onClick=${() => setLoop(!loopOn)} />
      <${IconButton} icon="metronome" title="Metronome" on=${metro} onClick=${() => setMetro(!metro)} />
      <${IconButton} icon="restart" title="Restart" onClick=${restart} />
      <${IconButton} icon=${phase === 'running' ? 'pause' : 'play'} title="Play / pause" onClick=${() => (phase === 'running' ? pause() : phase === 'paused' ? resume() : start())} />
      <div class="hud">
        ${mode !== 'listen' ? html`
          <div><div class="v">${hud.score.toLocaleString()}</div><div class="k">Score</div></div>
          <div class="hide-sm"><div class="v" style=${hud.combo >= 10 ? 'color:#fbbf24' : ''}>${hud.combo}×</div><div class="k">Combo</div></div>
          <div><div class="v">${Math.round(hud.acc * 100)}%</div><div class="k">Accuracy</div></div>` : null}
      </div>
    </div>
    <div class="stage" ref=${stageRef}>
      <canvas ref=${canvasRef}></canvas>
      <div class="overlay">
        ${count ? html`<div class="count-in" key=${count}>${count}</div>` : null}
        ${phase === 'ready' ? html`<${ReadyCard} kids=${kids} mode=${mode} hands=${hands} song=${props.song} inputState=${inputState} onStart=${start} />` : null}
        ${phase === 'paused' ? html`<div class="tip-card center">
          <h2>${kids ? 'Taking a break' : 'Paused'}</h2>
          <div class="row" style="justify-content:center;margin-top:18px">
            <button class="btn ghost" onClick=${exit}>Exit</button>
            <button class="btn ghost" onClick=${restart}>Restart</button>
            <button class="btn" onClick=${resume}>Resume</button>
          </div></div>` : null}
      </div>
      ${phase === 'running' && hud.waiting && mode === 'wait' && hud.label ? html`<div class="toast" style="top:24px">${kids ? '🎯 Play ' : 'Waiting for '}${hud.label}</div>` : null}
    </div>
  </div>`;
}

function ReadyCard({ kids, mode, hands, song, inputState, onStart }) {
  const inp = effectiveInput();
  const what = mode === 'wait' ? (kids ? 'The music waits for you. Play each glowing key!' : 'Learn mode: the music waits until you play each note.')
    : mode === 'play' ? (kids ? 'The music keeps going — play in time to score big!' : 'Play mode: keep time — every note is scored Perfect, Great or Good.')
    : 'Listen mode: sit back and hear how it goes.';
  const handText = hands.length > 1 ? 'both hands' : `your ${hands[0] === 'R' ? 'right' : 'left'} hand`;
  return html`<div class="tip-card center">
    ${kids ? html`<div style="display:flex;justify-content:center"><${Mascot} size=${90} /></div>` : null}
    <h2>${song.title}</h2>
    <p style="margin-bottom:10px">${what}${mode !== 'listen' ? ` You play ${handText}.` : ''}</p>
    <p style="font-size:15px;margin-bottom:20px">${inp === 'midi' ? '🎹 Listening to your MIDI keyboard' : inp === 'mic'
      ? (inputState === 'on' ? '🎙️ Listening through the microphone' : inputState === 'denied' ? '⚠️ Microphone blocked — allow it in Android settings, or use the on-screen keys' : '🎙️ Starting the microphone…')
      : '👆 Tap the keys on screen'}</p>
    <button class="btn big" onClick=${onStart}><${Icon} name="play" /> ${kids ? 'Start!' : 'Start'}</button>
  </div>`;
}

// ---- Standalone screen with results -------------------------------------------------------------------

export function Player({ songId, song: given, hands, mode, tempo, kind = 'song', id }) {
  const { profile: p } = useApp();
  const song = given || songById(songId);
  const [result, setResult] = useState(null);
  const [runKey, setRunKey] = useState(0);
  if (!song) { nav.back(); return null; }
  const kids = p?.mode === 'kids';
  const onFinish = (res, ctx) => {
    let rec = { xp: 0, achievements: [], levelUp: 0 };
    if (p && res.mode !== 'listen') {
      rec = recordResult(p, kind === 'exercise' || song.exercise ? 'exercise' : 'song', id || song.id, res);
      refreshProfile();
    }
    if (rec.levelUp) audio.sfx.levelUp();
    setResult({ res, rec, ctx });
  };
  return html`<div class="screen">
    <${PlayerView} key=${runKey} song=${song} hands=${result?.ctx.hands || hands} mode=${result?.ctx.mode || mode} tempo=${result?.ctx.tempo || tempo} onFinish=${onFinish} />
    ${result ? html`<${Results} kids=${kids} ...${result} onRetry=${() => { setResult(null); setRunKey((k) => k + 1); }} onDone=${() => nav.back()} />` : null}
  </div>`;
}

export function Results({ res, rec, kids, onRetry, onDone, doneLabel }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => { i++; setShown(i); if (i <= res.stars) audio.sfx.star(i - 1); if (i >= 3) clearInterval(t); }, 380);
    return () => clearInterval(t);
  }, []);
  const msg = res.mode === 'listen' ? 'That’s how it goes!'
    : res.stars === 3 ? (kids ? 'WOW! Superstar! 🌟' : 'Outstanding')
    : res.stars === 2 ? (kids ? 'Great job! 🎉' : 'Great playing')
    : res.stars === 1 ? (kids ? 'Nice work! Keep going!' : 'Good — practise it again')
    : (kids ? 'Good try! Let’s try again 💪' : 'Keep at it — slow it down and try again');
  return html`<${Modal}>
    ${res.stars >= 2 ? html`<${Confetti} />` : null}
    <div class="results">
      ${kids ? html`<div style="display:flex;justify-content:center"><${Mascot} size=${100} mood=${res.stars >= 2 ? 'wow' : 'happy'} /></div>` : null}
      <h2 style="margin:6px 0">${msg}</h2>
      ${res.mode !== 'listen' ? html`
        <div class="big-stars">${[1, 2, 3].map((i) => html`<span class=${shown >= i && res.stars >= i ? 'on' : ''}>⭐</span>`)}</div>
        <div class="acc">${Math.round(res.accuracy * 100)}%</div>
        <div class="breakdown">
          ${res.mode === 'play' ? html`
            <div><b style="color:#6ee7f9">${res.counts.perfect}</b><small>Perfect</small></div>
            <div><b style="color:#4ade80">${res.counts.great}</b><small>Great</small></div>
            <div><b style="color:#fbbf24">${res.counts.good}</b><small>Good</small></div>
            <div><b style="color:#9aa3c7">${res.counts.miss}</b><small>Missed</small></div>` : html`
            <div><b style="color:var(--good)">${res.counts.hit}</b><small>Correct</small></div>`}
          <div><b style="color:var(--bad)">${res.counts.wrong}</b><small>Wrong keys</small></div>
          <div><b>${res.maxCombo}</b><small>Best combo</small></div>
          <div><b>${res.score.toLocaleString()}</b><small>Score</small></div>
        </div>` : null}
      ${rec?.xp ? html`<div class="xp-gain">+${rec.xp} XP${rec.levelUp ? ` · Level ${rec.levelUp}! 🎉` : ''}</div>` : null}
      ${rec?.achievements?.length ? html`<div class="badge-row">${rec.achievements.map((a, i) => html`<div class="badge" style=${{ animationDelay: 0.6 + i * 0.15 + 's' }}>${a.icon} ${a.title}</div>`)}</div>` : null}
      <div class="row" style="justify-content:center">
        ${onRetry ? html`<button class="btn ghost" onClick=${onRetry}>↻ ${kids ? 'Again!' : 'Try again'}</button>` : null}
        <button class="btn" onClick=${onDone}>${doneLabel || (kids ? 'Yay, done!' : 'Done')}</button>
      </div>
    </div>
  </${Modal}>`;
}
