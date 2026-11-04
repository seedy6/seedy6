// Settings for this tablet (input, keyboard, sound, display) and for the current player.

import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { useApp, nav, updateSettings, KEYBOARD_SIZES, setProfile, effectiveInput } from '../app.js';
import { profiles } from '../game/progress.js';
import { midiDevices, onMidiDevices } from '../input.js';
import { calibration, reloadDetector, stopMic } from '../audio/mic.js';
import { IconButton, Switch, Segmented, toast } from '../ui/components.js';
import { noteName } from '../music/theory.js';

export function Settings() {
  const { profile: p, settings: s } = useApp();
  const [devices, setDevices] = useState(midiDevices());
  useEffect(() => onMidiDevices(setDevices), []);
  const cal = calibration();
  const set = (patch) => updateSettings(patch);
  const version = window.KeyglowAndroid ? window.KeyglowAndroid.version() : 'web';
  return html`<div class="screen scroll">
    <div class="topbar"><${IconButton} icon="back" title="Back" onClick=${() => nav.back()} /><h1>Settings</h1></div>
    <div class="page" style="max-width:900px">
      <h2>Hearing your keyboard</h2>
      <div class="card settings-group">
        <div class="set-row"><div class="grow"><div class="st">Input</div><div class="sd">Now using: ${{ mic: 'microphone', midi: 'MIDI', touch: 'on-screen keys' }[effectiveInput(s)]}${devices.length ? ` · ${devices.join(', ')}` : ''}</div></div>
          <${Segmented} value=${s.input} onChange=${(v) => { set({ input: v }); if (v !== 'mic' && v !== 'auto') stopMic(); }} options=${[{ value: 'auto', label: 'Automatic' }, { value: 'mic', label: 'Microphone' }, { value: 'midi', label: 'MIDI' }, { value: 'touch', label: 'Screen only' }]} />
        </div>
        <div class="set-row"><div class="grow"><div class="st">Keyboard size</div><div class="sd">${noteName(s.keyRange[0])} – ${noteName(s.keyRange[1])}</div></div>
          <select class="chip" value=${s.keyboardSize} onChange=${(e) => { const k = Number(e.target.value); set({ keyboardSize: k, keyRange: KEYBOARD_SIZES[k] }); reloadDetector(); }}>
            ${Object.keys(KEYBOARD_SIZES).map((k) => html`<option value=${k}>${k} keys</option>`)}
          </select>
        </div>
        <div class="set-row"><div class="grow"><div class="st">Calibration</div><div class="sd">${cal ? `Calibrated ${new Date(cal.date).toLocaleDateString()} · ${Object.keys(cal.templates).length} keys recorded` : 'Not calibrated — using a grand-piano model'}</div></div>
          <button class="btn small" onClick=${() => nav.go('calibrate')}>${cal ? 'Recalibrate' : 'Calibrate'}</button>
        </div>
        <div class="set-row"><div class="grow"><div class="st">Microphone sensitivity</div><div class="sd">Raise it if quiet notes are missed; lower it if notes appear by themselves.</div></div>
          <input type="range" min="0.5" max="2" step="0.1" value=${s.micSensitivity} onInput=${(e) => set({ micSensitivity: parseFloat(e.target.value) })} /><b style="width:36px">${s.micSensitivity.toFixed(1)}</b>
        </div>
        <div class="set-row"><div class="grow"><div class="st">Microphone delay</div><div class="sd">Timing correction for Play mode (calibration can measure it).</div></div>
          <input type="range" min="0" max="300" step="5" value=${s.micLatency} onInput=${(e) => set({ micLatency: Number(e.target.value) })} /><b style="width:60px">${s.micLatency} ms</b>
        </div>
        <div class="set-row"><div class="grow"><div class="st">Play the app’s piano for MIDI keys</div><div class="sd">Turn on for MIDI controllers without their own speakers.</div></div>
          <${Switch} on=${s.midiSound} onChange=${(v) => set({ midiSound: v })} />
        </div>
      </div>

      <h2>Display</h2>
      <div class="card settings-group">
        <div class="set-row"><div class="grow"><div class="st">Note names</div></div>
          <${Segmented} value=${s.labels} onChange=${(v) => set({ labels: v })} options=${[{ value: 'letters', label: 'C D E' }, { value: 'solfege', label: 'Do Re Mi' }, { value: 'c-only', label: 'Only C' }, { value: 'none', label: 'None' }]} />
        </div>
        <div class="set-row"><div class="grow"><div class="st">Finger numbers</div><div class="sd">Show which finger to use on the keys.</div></div><${Switch} on=${s.showFingers} onChange=${(v) => set({ showFingers: v })} /></div>
        <div class="set-row"><div class="grow"><div class="st">Look-ahead</div><div class="sd">How much music falls into view at once.</div></div>
          <input type="range" min="1.8" max="6" step="0.2" value=${s.noteSpeed} onInput=${(e) => set({ noteSpeed: parseFloat(e.target.value) })} /><b style="width:50px">${s.noteSpeed.toFixed(1)} s</b>
        </div>
        <div class="set-row"><div class="grow"><div class="st">Count-in</div><div class="sd">A bar of clicks before the music starts.</div></div><${Switch} on=${s.countIn} onChange=${(v) => set({ countIn: v })} /></div>
        <div class="set-row"><div class="grow"><div class="st">Metronome on by default</div></div><${Switch} on=${s.metronome} onChange=${(v) => set({ metronome: v })} /></div>
      </div>

      <h2>Sound</h2>
      <div class="card settings-group">
        <div class="set-row"><div class="grow"><div class="st">Piano volume</div></div><input type="range" min="0" max="1" step="0.05" value=${s.pianoVolume} onInput=${(e) => set({ pianoVolume: parseFloat(e.target.value) })} /></div>
        <div class="set-row"><div class="grow"><div class="st">Effects and metronome</div></div><input type="range" min="0" max="1" step="0.05" value=${s.sfxVolume} onInput=${(e) => set({ sfxVolume: parseFloat(e.target.value) })} /></div>
      </div>

      <h2>Player: ${p.avatar} ${p.name}</h2>
      <div class="card settings-group">
        <div class="set-row"><div class="grow"><div class="st">Mode</div><div class="sd">Kids mode is brighter and gentler; adult mode opens every song.</div></div>
          <${Segmented} value=${p.mode} onChange=${(v) => { p.mode = v; profiles.save(p); setProfile({ ...p }); }} options=${[{ value: 'kids', label: '🧸 Kids' }, { value: 'adult', label: '🎹 Adult' }]} />
        </div>
        <div class="set-row"><div class="grow"><div class="st">Daily goal</div></div>
          <${Segmented} value=${p.goalMinutes} onChange=${(v) => { p.goalMinutes = v; profiles.save(p); setProfile({ ...p }); }} options=${[5, 10, 15, 20, 30].map((m) => ({ value: m, label: `${m} min` }))} />
        </div>
        <div class="set-row"><div class="grow"><div class="st">Switch player</div></div><button class="btn small ghost" onClick=${() => nav.reset('welcome')}>Switch</button></div>
        <div class="set-row"><div class="grow"><div class="st">Delete this player</div><div class="sd">Removes their progress from this tablet.</div></div>
          <button class="btn small ghost" style="color:var(--bad)" onClick=${() => { if (confirm(`Delete ${p.name} and all their progress?`)) { profiles.remove(p.id); setProfile(null); nav.reset('welcome'); } }}>Delete</button>
        </div>
      </div>

      <h2>About</h2>
      <div class="card settings-group">
        <div class="set-row"><div class="grow"><div class="st">Keyglow ${version}</div><div class="sd">Piano: Salamander Grand Piano by Alexander Holm (CC-BY 3.0). Transcription: Spotify Basic Pitch (Apache 2.0). Fonts: Outfit and Fredoka (SIL OFL). Songs: public-domain melodies, arranged for learning.</div></div></div>
        ${window.KeyglowAndroid ? html`<div class="set-row"><div class="grow"><div class="st">Get the latest version</div><div class="sd">Opens the download page in the browser.</div></div>
          <button class="btn small" onClick=${() => window.KeyglowAndroid.openUrl('https://github.com/seedy6/seedy6/releases/download/keyglow-latest/keyglow.apk')}>Update</button></div>` : null}
        <div class="set-row"><div class="grow"><div class="st">Reset everything</div><div class="sd">All players, calibration and imported songs on this tablet.</div></div>
          <button class="btn small ghost" style="color:var(--bad)" onClick=${() => { if (confirm('Erase all Keyglow data on this tablet?')) { localStorage.clear(); indexedDB.deleteDatabase('keyglow'); toast('Reset'); setTimeout(() => location.reload(), 500); } }}>Reset</button>
        </div>
      </div>
    </div>
  </div>`;
}
