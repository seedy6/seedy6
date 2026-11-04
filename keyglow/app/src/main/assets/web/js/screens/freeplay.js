// Free play: a big keyboard; notes float up as glowing ribbons, with note and chord names.

import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { useApp, nav, ensureListening, effectiveInput } from '../app.js';
import { onInput, heldNotes } from '../input.js';
import { detectChord, noteName } from '../music/theory.js';
import { KeyboardStrip } from '../ui/keyboard-strip.js';
import { IconButton, Segmented } from '../ui/components.js';
import { micState, onMicState } from '../audio/mic.js';
import { loadPiano } from '../audio/engine.js';

export function FreePlay() {
  const { profile: p, settings } = useApp();
  const kids = p.mode === 'kids';
  const [held, setHeld] = useState([]);
  const [last, setLast] = useState(null);
  const [mic, setMic] = useState(micState());
  const [range, setRange] = useState(settings.keyRange[1] - settings.keyRange[0] > 60 ? [36, 96] : settings.keyRange);
  useEffect(() => {
    ensureListening();
    loadPiano();
    const off = onInput(() => {
      const h = heldNotes().sort((a, b) => a - b);
      setHeld(h);
      if (h.length) setLast(h);
    });
    const offMic = onMicState(setMic);
    return () => { off(); offMic(); };
  }, []);
  const show = held.length ? held : last || [];
  const chord = show.length >= 2 ? detectChord(show) : null;
  const inp = effectiveInput(settings);
  return html`<div class="screen"><div class="player">
    <div class="player-bar">
      <${IconButton} icon="back" title="Back" onClick=${() => nav.back()} />
      <div class="player-title" style="flex:1">Free play<div class="sub">${inp === 'midi' ? 'MIDI keyboard' : inp === 'mic' ? (mic === 'on' ? 'Listening through the microphone' : 'Microphone ' + mic) : 'On-screen keys'}</div></div>
      <${Segmented} value=${range.join('-')} onChange=${(v) => setRange(v.split('-').map(Number))} options=${[
        { value: '48-72', label: '2 octaves' }, { value: '41-84', label: '3½ octaves' }, { value: '36-96', label: '61 keys' }, { value: '21-108', label: '88 keys' },
      ]} />
    </div>
    <div class="stage" style="display:flex;flex-direction:column">
      <div style="padding:30px 20px 0">
        <div class="chord-name" style=${held.length ? '' : 'opacity:.45'}>${chord ? chord.name : show.length ? show.map((m) => noteName(m, { octave: !kids })).join(' ') : (kids ? '🎹 Play anything!' : 'Play anything')}</div>
        <div class="chord-sub">${chord ? chord.label : show.length === 1 ? noteName(show[0]) : ''}</div>
      </div>
      <${KeyboardStrip} key=${range.join()} range=${range} mode=${p.mode} ribbons flex height=${400} labels=${settings.labels} />
    </div>
  </div></div>`;
}
