// Calibration: teach the detector what your keyboard sounds like through this tablet's microphone.
//   1. keyboard size   2. a moment of quiet (room noise)   3. play the keys it asks for
//   4. try it out, adjust sensitivity, and (optionally) measure the timing delay

import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useApp, nav, updateSettings, KEYBOARD_SIZES, refreshProfile } from '../app.js';
import * as mic from '../audio/mic.js';
import * as audio from '../audio/engine.js';
import { onInput, getLatency } from '../input.js';
import { noteName, pitchClass } from '../music/theory.js';
import { KeyboardStrip } from '../ui/keyboard-strip.js';
import { IconButton, Segmented, Speech, Ring, toast } from '../ui/components.js';
import { unlock, profiles } from '../game/progress.js';

export function Calibrate() {
  const { profile: p, settings } = useApp();
  const kids = p.mode === 'kids';
  const [stage, setStage] = useState('intro');
  const [size, setSize] = useState(settings.keyboardSize || 61);
  const [method, setMethod] = useState('quick');
  const [noise, setNoise] = useState(null);
  const [progress, setProgress] = useState(0);
  const [keys, setKeys] = useState([]);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState('waiting');
  const [warn, setWarn] = useState(null);
  const templates = useRef({});
  const pending = useRef(null);
  const keysRef = useRef([]);
  const idxRef = useRef(0);
  const noiseRef = useRef(null);
  const range = KEYBOARD_SIZES[size];

  useEffect(() => () => { pending.current?.cancel?.(); mic.cancelCalibrationHook(); }, []);

  async function begin() {
    updateSettings({ keyboardSize: size, keyRange: range, input: settings.input === 'touch' ? 'auto' : settings.input });
    const ok = await mic.startMic();
    if (!ok) { toast('The microphone is not available. Allow it in Android settings → Apps → Keyglow → Permissions.', 5000); return; }
    setStage('quiet');
    setProgress(0);
    await new Promise((r) => setTimeout(r, 600));
    const n = await mic.measureNoise(2, setProgress);
    setNoise(n);
    noiseRef.current = n;
    const list = [];
    for (let m = range[0]; m <= range[1]; m++) if (method === 'full' || [0, 3, 6, 9].includes(pitchClass(m))) list.push(m);
    // Start in the middle, where most playing happens, then fan out.
    list.sort((a, b) => Math.abs(a - 62) - Math.abs(b - 62));
    setKeys(list);
    keysRef.current = list;
    idxRef.current = 0;
    setIdx(0);
    templates.current = {};
    setStage('keys');
    listenFor(list[0], n);
  }

  function listenFor(midi, n = noiseRef.current) {
    setStatus('waiting');
    setWarn(null);
    const job = mic.recordKey(n, (st) => setStatus(st));
    pending.current = job;
    job.then((r) => {
      if (!r) return;
      // Check it sounds like the key we asked for (or the same note in another octave).
      const match = r.recorder.bestMatch(mic.currentTemplates());
      const off = match.midi - midi;
      templates.current[midi] = r.template;
      if (Math.abs(off) >= 2 && Math.abs(off) !== 12 && match.score > 0.7) {
        setWarn({ midi, heard: match.midi });
        setStatus('check');
        return;
      }
      setStatus('done');
      audio.sfx.good();
      setTimeout(advance, 450);
    });
  }

  function advance() {
    const next = idxRef.current + 1;
    idxRef.current = next;
    setIdx(next);
    if (next < keysRef.current.length) listenFor(keysRef.current[next]);
    else finish();
  }

  function skip() {
    pending.current?.cancel?.();
    mic.cancelCalibrationHook();
    advance();
  }

  function finish() {
    mic.saveCalibration({ templates: templates.current, noise: noiseRef.current, range });
    const prof = profiles.current();
    if (prof) { unlock(prof, 'calibrated'); profiles.save(prof); refreshProfile(); }
    audio.sfx.complete();
    setStage('test');
  }

  const target = keys[idx];
  return html`<div class="screen scroll">
    <div class="topbar"><${IconButton} icon="back" title="Back" onClick=${() => nav.back()} /><h1>${kids ? 'Teach me your piano' : 'Calibrate'}</h1></div>
    <div class="page" style="max-width:1000px">
      ${stage === 'intro' ? html`
        ${kids ? html`<${Speech}>Let me listen to your piano so I can hear every note you play! 🎧</${Speech}>` : html`<p class="muted" style="font-size:18px">Keyglow hears your keyboard through the tablet’s microphone. Calibration records what each key sounds like in your room, so detection is fast and accurate. It takes about a minute.</p>`}
        <div class="card pad" style="margin-top:20px">
          <div class="field"><div class="lbl">How many keys does your keyboard have?</div>
            <div class="row wrap">${Object.keys(KEYBOARD_SIZES).map((k) => html`<button class=${'chip' + (Number(k) === size ? ' on' : '')} onClick=${() => setSize(Number(k))}>${k} keys</button>`)}</div>
            <div class="muted" style="margin-top:8px;font-size:14px">From ${noteName(range[0])} to ${noteName(range[1])}. Not sure? Count the white keys: 36 white = 61 keys, 52 white = 88 keys.</div>
          </div>
          <div class="field"><div class="lbl">Method</div>
            <${Segmented} value=${method} onChange=${setMethod} options=${[{ value: 'quick', label: `Quick (${Math.ceil((range[1] - range[0] + 1) / 3)} keys)` }, { value: 'full', label: `Every key (${range[1] - range[0] + 1})` }]} />
          </div>
          <ul class="muted" style="line-height:1.8;font-size:16px">
            <li>Put the tablet near the keyboard’s speakers, screen facing you.</li>
            <li>Set the keyboard to a <b>piano</b> sound, at a normal volume.</li>
            <li>Play each key firmly once and let it ring until the next one lights up.</li>
            <li>Have a USB MIDI cable? Plug it in instead — it needs no calibration.</li>
          </ul>
          <div class="row" style="justify-content:flex-end"><button class="btn big" onClick=${begin}>🎙️ Start</button></div>
        </div>` : null}

      ${stage === 'quiet' ? html`<div class="card pad center" style="margin-top:40px">
        <h2>${kids ? 'Shhh… quiet as a mouse 🐭' : 'Stay quiet for a moment'}</h2>
        <p class="muted">Measuring the background noise in the room.</p>
        <div class="progress" style="max-width:420px;margin:20px auto"><div style=${{ width: progress * 100 + '%' }}></div></div>
      </div>` : null}

      ${stage === 'keys' && target != null ? html`<div class="card pad center" style="margin-top:10px">
        <div class="row" style="justify-content:center;gap:30px">
          <${Ring} value=${idx / keys.length} size=${110} stroke=${10}><div style="font-size:22px">${idx}/${keys.length}</div></${Ring}>
          <div style="text-align:left">
            <div class="eyebrow">Play this key</div>
            <div style="font-size:64px;font-weight:800;line-height:1">${noteName(target)}</div>
            <div class="muted" style="margin-top:6px;font-size:17px">${status === 'waiting' ? 'Listening… play it once and let it ring.' : status === 'recording' ? 'Recording… 🎵' : status === 'done' ? 'Got it! ✓' : status === 'check' ? '' : ''}</div>
          </div>
        </div>
        ${warn ? html`<div style="margin-top:14px"><p>That sounded more like <b>${noteName(warn.heard)}</b>. Was it the glowing key?</p>
          <div class="row" style="justify-content:center"><button class="btn ghost" onClick=${() => { delete templates.current[warn.midi]; listenFor(warn.midi); }}>Try again</button><button class="btn" onClick=${() => { setWarn(null); advance(); }}>Yes, keep it</button></div></div>` : null}
        <div class="row" style="justify-content:center;margin-top:14px"><button class="btn ghost small" onClick=${skip}>Skip this key</button></div>
      </div>
      <div style="margin-top:18px"><${KeyboardStrip} range=${range} highlight=${[target]} mode=${p.mode} height=${170} touch=${false} labels="c-only" /></div>` : null}

      ${stage === 'test' ? html`<${MicTest} kids=${kids} range=${range} />` : null}
      ${stage === 'intro' ? html`<div class="row" style="margin-top:24px"><button class="btn ghost small" onClick=${() => setStage('test')}>Test the microphone without calibrating</button>
        ${mic.calibration() ? html`<button class="btn ghost small" onClick=${() => { mic.clearCalibration(); toast('Calibration cleared'); }}>Clear calibration</button>` : null}</div>` : null}
    </div>
  </div>`;
}

/** Live check: what the detector hears, sensitivity, and a timing test. */
function MicTest({ kids, range }) {
  const { settings } = useApp();
  const [heard, setHeard] = useState([]);
  const [level, setLevel] = useState(0);
  const [sens, setSens] = useState(settings.micSensitivity);
  const [latency, setLatencyState] = useState(null);
  useEffect(() => {
    mic.startMic();
    const off = onInput((ev) => { if (ev.type === 'on' && ev.source === 'mic') setHeard((h) => [noteName(ev.midi), ...h].slice(0, 12)); });
    const offL = mic.onMicLevels((l) => setLevel(Math.min(1, Math.sqrt(l.rms) * 4)));
    return () => { off(); offL(); };
  }, []);
  async function timing() {
    await audio.resumeAudio();
    const c = audio.audioContext();
    const beat = 60 / 90;
    const start = c.currentTime + 0.6;
    const clicks = [];
    const outLat = (c.outputLatency || c.baseLatency || 0) * 1000;
    for (let i = 0; i < 12; i++) {
      audio.click(i % 4 === 0, start + i * beat);
      if (i >= 4) clicks.push(performance.now() + (start + i * beat - c.currentTime) * 1000 + outLat);
    }
    setLatencyState('listening');
    const raw = [];
    const off = onInput((ev) => { if (ev.type === 'on' && ev.source === 'mic') raw.push(ev.at + getLatency('mic')); });
    setTimeout(() => {
      off();
      const offsets = clicks.map((ct) => {
        let best = null;
        for (const r of raw) if (best == null || Math.abs(r - ct) < Math.abs(best - ct)) best = r;
        return best == null ? null : best - ct;
      }).filter((d) => d != null && d > -150 && d < 400).sort((a, b) => a - b);
      if (offsets.length < 4) { setLatencyState('failed'); return; }
      const median = Math.round(offsets[Math.floor(offsets.length / 2)]);
      updateSettings({ micLatency: Math.max(0, median) });
      setLatencyState(median);
    }, (0.6 + 12 * beat + 0.8) * 1000);
  }
  return html`<div class="card pad">
    <h2 style="margin-top:0">${kids ? 'Play something! 🎹' : 'Try it out'}</h2>
    <p class="muted">Play single notes and chords. The keys below light up with what Keyglow hears.</p>
    <div class="row"><span class="muted" style="width:90px">Input level</span><div class="meter" style="flex:1"><div style=${{ width: level * 100 + '%' }}></div></div></div>
    <div style="margin:16px 0;min-height:40px;font-size:22px;font-weight:700">${heard.join('  ')}</div>
    <${KeyboardStrip} range=${range} mode=${kids ? 'kids' : 'adult'} height=${160} touch=${false} labels="c-only" />
    <div class="set-row" style="padding:16px 0">
      <div class="grow"><div class="st">Sensitivity</div><div class="sd">Higher hears quiet notes; lower ignores noise and talking.</div></div>
      <input type="range" min="0.5" max="2" step="0.1" value=${sens} onInput=${(e) => { const v = parseFloat(e.target.value); setSens(v); updateSettings({ micSensitivity: v }); mic.reloadDetector(); }} />
      <b style="width:40px">${sens.toFixed(1)}</b>
    </div>
    <div class="set-row" style="padding:16px 0">
      <div class="grow"><div class="st">Timing check</div><div class="sd">After 4 count-in clicks, play middle C on each of the next 8 clicks. Used for Play-mode scoring. Now: ${settings.micLatency} ms.</div></div>
      <button class="btn small" onClick=${timing} disabled=${latency === 'listening'}>${latency === 'listening' ? 'Listening…' : 'Start'}</button>
    </div>
    ${typeof latency === 'number' ? html`<p style="color:var(--good)">Measured delay: ${latency} ms — saved.</p>` : latency === 'failed' ? html`<p style="color:var(--bad)">Did not catch enough notes. Try again, a little louder.</p>` : null}
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" onClick=${() => nav.back()}>Done</button></div>
  </div>`;
}
