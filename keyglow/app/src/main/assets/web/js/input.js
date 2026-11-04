// One stream of "key went down / key came up" events, whatever the source:
//   mic   – your keyboard heard through the tablet's microphone
//   midi  – a USB/Bluetooth MIDI keyboard (exact)
//   touch – the on-screen keyboard
//   kbd   – a computer keyboard (A W S E D F T G Y H U J K = C4…C5), handy for testing
// Each event: {type: 'on'|'off', midi, velocity, source, at} where `at` is performance.now() ms,
// already corrected for the source's latency.

import * as audio from './audio/engine.js';

const listeners = new Set();
const held = new Map(); // midi → source
let soundFor = { touch: true, kbd: true, midi: false, mic: false };
const latencyMs = { mic: 70, midi: 8, touch: 15, kbd: 15 };

export function onInput(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function heldNotes() { return [...held.keys()]; }
export function setInputSound(map) { soundFor = { ...soundFor, ...map }; }
export function setLatency(source, ms) { latencyMs[source] = ms; }
export function getLatency(source) { return latencyMs[source]; }

export function emit(type, midi, velocity = 0.7, source = 'touch', at = performance.now()) {
  if (midi < 21 || midi > 108) return;
  if (type === 'on') {
    held.set(midi, source);
    if (soundFor[source]) audio.noteOn(midi, velocity);
  } else {
    if (!held.has(midi)) return;
    held.delete(midi);
    if (soundFor[source]) audio.noteOff(midi);
  }
  const ev = { type, midi, velocity, source, at: at - (latencyMs[source] || 0) };
  for (const fn of listeners) { try { fn(ev); } catch (e) { console.error(e); } }
}

export function releaseAll() {
  for (const [m, s] of [...held]) emit('off', m, 0, s);
}

// ---- MIDI ---------------------------------------------------------------------------------------

let midiNames = [];
const midiListeners = new Set();
export const onMidiDevices = (fn) => { midiListeners.add(fn); return () => midiListeners.delete(fn); };
export const midiDevices = () => midiNames;

function handleMidi(status, d1, d2) {
  const type = status & 0xf0;
  if (type === 0x90 && d2 > 0) emit('on', d1, d2 / 127, 'midi');
  else if (type === 0x80 || (type === 0x90 && d2 === 0)) emit('off', d1, 0, 'midi');
  else if (type === 0xb0 && d1 === 64 && soundFor.midi) audio.setSustain(d2 >= 64);
}

function refreshMidiDevices(list) {
  midiNames = list;
  for (const fn of midiListeners) fn(list);
}

export function initMidi() {
  // From the Android app (MidiBridge.kt).
  window.__kgMidi = handleMidi;
  window.__kgMidiDevices = () => {
    try { refreshMidiDevices(JSON.parse(window.KeyglowAndroid.midiDevices()).map((d) => d.name)); } catch (e) { /* no bridge */ }
  };
  if (window.KeyglowAndroid) { window.__kgMidiDevices(); return; }
  // In a desktop browser, Web MIDI.
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then((access) => {
      const wire = () => {
        const names = [];
        access.inputs.forEach((inp) => { inp.onmidimessage = (e) => handleMidi(e.data[0], e.data[1], e.data[2] ?? 0); names.push(inp.name); });
        refreshMidiDevices(names);
      };
      access.onstatechange = wire;
      wire();
    }).catch(() => {});
  }
}

// ---- Computer keyboard (for testing on a laptop) -----------------------------------------------------

const KEYMAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76, z: 48, x: 50, c: 52, v: 53, b: 55, n: 57, m: 59 };
export function initComputerKeyboard() {
  const down = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const m = KEYMAP[e.key.toLowerCase()];
    if (m == null || down.has(m) || e.repeat || e.ctrlKey || e.metaKey) return;
    down.add(m);
    emit('on', m, 0.75, 'kbd');
  });
  window.addEventListener('keyup', (e) => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (m == null) return;
    down.delete(m);
    emit('off', m, 0, 'kbd');
  });
}
