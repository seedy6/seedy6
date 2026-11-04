// App-wide state: the current player profile, device settings and navigation between screens.

import { useEffect, useState } from './vendor/preact-htm.js';
import { store } from './store.js';
import { profiles } from './game/progress.js';
import { setInputSound, setLatency, midiDevices } from './input.js';
import { setVolumes } from './audio/engine.js';
import { startMic, stopMic, micState, setSensitivity } from './audio/mic.js';

export const KEYBOARD_SIZES = {
  25: [48, 72], 32: [53, 84], 37: [48, 84], 49: [36, 84], 54: [36, 89], 61: [36, 96], 76: [28, 103], 88: [21, 108],
};

export const DEFAULT_SETTINGS = {
  input: 'auto',            // auto | mic | midi | touch
  keyboardSize: 61,
  keyRange: [36, 96],
  micSensitivity: 1,
  micLatency: 70,
  midiLatency: 8,
  labels: 'letters',        // letters | solfege | c-only | none
  showFingers: true,
  pianoVolume: 0.8,
  sfxVolume: 0.5,
  midiSound: false,         // play the app's piano for a MIDI keyboard (for controllers without speakers)
  noteSpeed: 3.2,           // seconds of music visible above the keys
  countIn: true,
  metronome: false,
};

let listeners = new Set();
let state = {
  profile: profiles.current(),
  settings: { ...DEFAULT_SETTINGS, ...store.get('settings', {}) },
  stack: [],
};

function emitChange() { for (const fn of listeners) fn(state); }

export function useApp() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return state;
}

export const getState = () => state;

export function applySettings(s = state.settings) {
  setVolumes({ piano: s.pianoVolume, sfx: s.sfxVolume });
  setInputSound({ midi: s.midiSound, mic: false, touch: true, kbd: true });
  setLatency('mic', s.micLatency);
  setLatency('midi', s.midiLatency);
  setSensitivity(s.micSensitivity);
}

export function updateSettings(patch) {
  state = { ...state, settings: { ...state.settings, ...patch } };
  store.set('settings', state.settings);
  applySettings();
  emitChange();
}

export function setProfile(p) {
  if (p) profiles.select(p.id);
  state = { ...state, profile: p };
  document.documentElement.dataset.mode = p ? p.mode : 'adult';
  emitChange();
}

/** Re-read the profile after progress.js saved it. */
export function refreshProfile() {
  setProfile(profiles.current());
}

// ---- Navigation -------------------------------------------------------------------------------------

const backHandlers = [];
/** A screen can intercept the back button (e.g. to pause first). Returns an unregister function. */
export function onBack(fn) { backHandlers.push(fn); return () => { const i = backHandlers.indexOf(fn); if (i >= 0) backHandlers.splice(i, 1); }; }

export const nav = {
  go(screen, params = {}) {
    state = { ...state, stack: [...state.stack, { screen, params, key: Math.random() }] };
    emitChange();
  },
  replace(screen, params = {}) {
    state = { ...state, stack: [...state.stack.slice(0, -1), { screen, params, key: Math.random() }] };
    emitChange();
  },
  reset(screen, params = {}) {
    state = { ...state, stack: [{ screen, params, key: Math.random() }] };
    emitChange();
  },
  back() {
    if (state.stack.length <= 1) return false;
    state = { ...state, stack: state.stack.slice(0, -1) };
    emitChange();
    return true;
  },
  get current() { return state.stack[state.stack.length - 1]; },
};

window.__kgBack = () => {
  for (let i = backHandlers.length - 1; i >= 0; i--) if (backHandlers[i]()) return true;
  return nav.back();
};

// ---- Listening ----------------------------------------------------------------------------------------------

/** What will hear the person play: 'midi', 'mic' or 'touch'. */
export function effectiveInput(s = state.settings) {
  if (s.input === 'auto') return midiDevices().length ? 'midi' : 'mic';
  return s.input;
}

/** Called by screens that listen (player, free play, quizzes). Starts the microphone if it is the input. */
export async function ensureListening() {
  const mode = effectiveInput();
  if (mode === 'mic') return startMic();
  if (micState() === 'on') stopMic();
  return true;
}

export function stopListening() {
  if (micState() === 'on') stopMic();
}
