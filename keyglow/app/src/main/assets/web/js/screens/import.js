// Import: pick an MP3 (or any audio) of solo piano / keyboard, or a MIDI file → a song to learn.

import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useApp, nav, refreshProfile } from '../app.js';
import * as T from '../music/transcribe.js';
import { audioContext, resumeAudio } from '../audio/engine.js';
import { library } from '../store.js';
import { profiles, unlock } from '../game/progress.js';
import { IconButton, Segmented, Speech, Icon, toast } from '../ui/components.js';
import { noteName } from '../music/theory.js';

export function Import({ shared }) {
  const { profile: p } = useApp();
  const kids = p.mode === 'kids';
  const [stage, setStage] = useState('pick'); // pick | decoding | analysing | review | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('full');
  const [detail, setDetail] = useState('clean');
  const [grid, setGrid] = useState(0);
  const [keepAudio, setKeepAudio] = useState(true);
  const [result, setResult] = useState(null); // {notes, tempo}
  const fileRef = useRef();
  const src = useRef({}); // {kind, out, midi, blob}

  useEffect(() => {
    if (shared) fetch(shared.url).then((r) => r.blob()).then((b) => handle(b, shared.name)).catch(() => { setError('Could not open the shared file.'); setStage('error'); });
  }, []);

  useEffect(() => { if (stage === 'review') rearrange(); }, [level, detail, grid]);

  async function handle(blob, name) {
    setTitle(name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
    setError('');
    try {
      await resumeAudio();
      const buf = await blob.arrayBuffer();
      if (T.isMidiFile(buf, name)) {
        setStage('decoding');
        const m = await T.midiToNotes(buf);
        if (!m.notes.length) throw new Error('That MIDI file has no notes.');
        src.current = { kind: 'midi', midi: m };
        if (m.name && !title) setTitle(m.name);
      } else {
        setStage('decoding');
        const { samples, truncated } = await T.decodeTo22k(buf, audioContext());
        if (truncated) toast('Long recording: only the first 8 minutes are used.', 4000);
        setStage('analysing');
        setProgress(0);
        const out = await T.runModel(samples, (pr) => setProgress(pr));
        src.current = { kind: 'audio', out, blob };
      }
      await rearrange(true);
      setStage('review');
    } catch (e) {
      console.error(e);
      setError(e && e.message ? e.message : String(e));
      setStage('error');
    }
  }

  async function rearrange() {
    const s = src.current;
    if (!s.kind) return;
    let raw, opts = { level, quantizeDiv: grid };
    if (s.kind === 'midi') {
      raw = s.midi.notes;
      opts = { ...opts, tempo: s.midi.bpm ? Math.round(s.midi.bpm) : null, handsFromTracks: s.midi.handsFromTracks };
    } else {
      raw = await T.modelToNotes(s.out, detail);
    }
    const r = T.arrange(raw, opts);
    if (s.kind === 'midi' && s.midi.bpm) r.tempo = { bpm: Math.round(s.midi.bpm), offset: 0, confidence: 1 };
    setResult(r);
  }

  async function save(playNow) {
    const s = src.current;
    let audioId = null;
    if (s.kind === 'audio' && keepAudio && s.blob) {
      audioId = 'aud-' + Date.now().toString(36);
      await library.putAudio(audioId, s.blob);
    }
    const song = T.buildSong({ title: title || 'My song', notes: result.notes, bpm: result.tempo.bpm, beatsPerBar: s.midi?.beatsPerBar || 4, source: s.kind, audioId });
    await library.put(song);
    const prof = profiles.current();
    if (prof) { unlock(prof, 'imported'); profiles.save(prof); refreshProfile(); }
    toast(`Saved “${song.title}”`);
    if (playNow) nav.replace('player', { song, mode: 'wait', hands: song.notes.some((n) => n.hand === 'L') && kids ? ['R'] : undefined, kind: 'song', id: song.id });
    else nav.replace('songs', { tab: 'mine' });
  }

  const pick = () => fileRef.current && fileRef.current.click();
  return html`<div class="screen scroll">
    <div class="topbar"><${IconButton} icon="back" title="Back" onClick=${() => nav.back()} /><h1>Import a song</h1></div>
    <div class="page" style="max-width:980px">
      <input ref=${fileRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.mid,.midi" style="display:none"
        onChange=${(e) => { const f = e.target.files[0]; if (f) handle(f, f.name); e.target.value = ''; }} />
      ${stage === 'pick' || stage === 'error' ? html`
        ${kids ? html`<${Speech}>Got a piano song? Give it to me and I’ll turn it into notes you can play! 🎶</${Speech}>` : null}
        <div class="card drop" style="margin-top:20px" onClick=${pick}>
          <div class="big-emoji">🎧</div>
          <h2 style="margin:10px 0 6px">Choose an MP3 or a MIDI file</h2>
          <p class="muted" style="max-width:560px;margin:0 auto 18px">Works best with solo piano or keyboard — one instrument, little reverb. Keyglow listens to the recording, writes down every note, finds the beat and splits it between your hands. Everything happens on this tablet.</p>
          <button class="btn big"><${Icon} name="upload" /> Choose file</button>
        </div>
        ${stage === 'error' ? html`<p style="color:var(--bad);margin-top:16px">Sorry, that did not work: ${error}</p>` : null}
        <div class="tiles" style="margin-top:22px">
          <div class="card tile"><div class="ti">🎵</div><div><div class="tt">MP3, WAV, M4A</div><div class="td">AI transcription (Basic Pitch by Spotify)</div></div></div>
          <div class="card tile"><div class="ti">🎼</div><div><div class="tt">MIDI files</div><div class="td">Exact notes, hands kept from the tracks</div></div></div>
          <div class="card tile"><div class="ti">✂️</div><div><div class="tt">Make it easier</div><div class="td">Melody only, easy, or every note</div></div></div>
        </div>` : null}

      ${stage === 'decoding' || stage === 'analysing' ? html`<div class="card pad center" style="margin-top:40px">
        <div style="font-size:56px">${stage === 'decoding' ? '📂' : '🧠'}</div>
        <h2>${stage === 'decoding' ? 'Opening the file…' : kids ? 'Listening very carefully…' : 'Transcribing the notes…'}</h2>
        ${stage === 'analysing' ? html`<div class="progress" style="max-width:520px;margin:18px auto"><div style=${{ width: progress * 100 + '%' }}></div></div>
          <p class="muted">${Math.round(progress * 100)}% · this takes about a quarter of the song’s length</p>` : null}
      </div>` : null}

      ${stage === 'review' && result ? html`
        <div class="card pad" style="margin-top:10px">
          <div class="field"><div class="lbl">Title</div><input class="text-input" style="width:100%" value=${title} onInput=${(e) => setTitle(e.target.value)} /></div>
          <${Roll} notes=${result.notes} />
          <div class="muted" style="margin:10px 0">${result.notes.length} notes · ${noteRange(result.notes)} · about ${Math.round(result.tempo.bpm)} bpm${result.tempo.confidence < 0.25 && src.current.kind === 'audio' ? ' (rough guess)' : ''}</div>
          <div class="field"><div class="lbl">How much to play</div>
            <${Segmented} value=${level} onChange=${setLevel} options=${[{ value: 'melody', label: 'Melody only' }, { value: 'easy', label: 'Easy: melody + bass' }, { value: 'full', label: 'Every note' }]} /></div>
          ${src.current.kind === 'audio' ? html`<div class="field"><div class="lbl">Transcription</div>
            <${Segmented} value=${detail} onChange=${setDetail} options=${Object.entries(T.DETAIL).map(([k, v]) => ({ value: k, label: v.label }))} />
            <div class="muted" style="font-size:13px;margin-top:6px">Clean drops faint and doubtful notes; Detailed keeps quiet inner notes.</div></div>` : null}
          <div class="field"><div class="lbl">Snap to the beat</div>
            <${Segmented} value=${grid} onChange=${setGrid} options=${[{ value: 0, label: 'Off (as played)' }, { value: 2, label: 'Eighths' }, { value: 4, label: 'Sixteenths' }]} /></div>
          ${src.current.kind === 'audio' ? html`<div class="field row"><input type="checkbox" checked=${keepAudio} onChange=${(e) => setKeepAudio(e.target.checked)} style="width:22px;height:22px" /><span>Keep the recording so I can play along with the original</span></div>` : null}
          <div class="row" style="margin-top:18px">
            <button class="btn ghost" onClick=${() => { src.current = {}; setResult(null); setStage('pick'); }}>Start over</button>
            <span class="spacer"></span>
            <button class="btn ghost" onClick=${() => save(false)}>Save</button>
            <button class="btn big" onClick=${() => save(true)}><${Icon} name="play" /> Save & learn it</button>
          </div>
        </div>` : null}
    </div>
  </div>`;
}

function noteRange(notes) {
  if (!notes.length) return '';
  const lo = Math.min(...notes.map((n) => n.midi)), hi = Math.max(...notes.map((n) => n.midi));
  return `${noteName(lo)}–${noteName(hi)}`;
}

/** A piano-roll preview of the transcription. */
function Roll({ notes }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#06070e'; ctx.fillRect(0, 0, w, h);
    if (!notes.length) return;
    const end = Math.max(...notes.map((n) => n.t + n.d));
    const lo = Math.min(...notes.map((n) => n.midi)) - 2, hi = Math.max(...notes.map((n) => n.midi)) + 2;
    const y = (m) => h - ((m - lo) / (hi - lo)) * h;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let m = lo; m <= hi; m++) if (m % 12 === 0) ctx.fillRect(0, y(m), w, 1);
    for (const n of notes) {
      ctx.fillStyle = n.hand === 'L' ? '#a78bfa' : '#6ee7f9';
      ctx.fillRect((n.t / end) * w, y(n.midi) - 2, Math.max(1.5, (n.d / end) * w), 3);
    }
  }, [notes]);
  return html`<canvas ref=${ref} class="preview-roll"></canvas>`;
}
