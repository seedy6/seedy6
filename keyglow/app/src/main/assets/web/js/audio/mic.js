// Listening through the microphone: Web Audio in, NoteTracker out, events into the input bus.

import { audioContext, resumeAudio } from './engine.js';
import { SpectrumAnalyzer, packTemplate, unpackTemplate, KEY_LO, KEY_HI } from './dsp.js';
import { NoteTracker, buildTemplates, KeyRecorder, NoiseRecorder } from './tracker.js';
import bundled from './piano-templates.js';
import { emit } from '../input.js';
import { store } from '../store.js';

let stream = null;
let source = null;
let analyserNode = null;
let buf = null;
let timer = null;
let tracker = null;
let analyzer = null;
let frameHook = null; // calibration takes the frames while it runs
const levelListeners = new Set();
let lastLevelPush = 0;
let state = 'off'; // off | starting | on | denied | error
const stateListeners = new Set();

export const micState = () => state;
export const onMicState = (fn) => { stateListeners.add(fn); return () => stateListeners.delete(fn); };
function setState(s) { state = s; for (const fn of stateListeners) fn(s); }

/** Listeners get {rms, levels: Float32Array per key, keys: [midi…], held: [midi…]} ~20 times a second. */
export const onMicLevels = (fn) => { levelListeners.add(fn); return () => levelListeners.delete(fn); };

export function calibration() {
  return store.get('calibration', null);
}

export function getAnalyzer() {
  if (!analyzer) analyzer = new SpectrumAnalyzer(audioContext().sampleRate);
  return analyzer;
}

function makeTracker() {
  const an = getAnalyzer();
  const cal = calibration();
  const range = store.get('settings', {}).keyRange || [36, 96];
  const templates = buildTemplates(an, { measured: cal?.templates || {}, bundled });
  tracker = new NoteTracker({
    analyzer: an,
    range: [Math.max(KEY_LO, range[0]), Math.min(KEY_HI, range[1])],
    templates,
    noise: cal?.noise ? unpackTemplate(cal.noise) : null,
    noiseLevel: cal?.noiseLevel || 0,
    sensitivity: store.get('settings', {}).micSensitivity ?? 1,
  });
  return tracker;
}

/** Rebuild the detector (after calibration or a change of keyboard range / sensitivity). */
export function reloadDetector() {
  if (tracker) makeTracker();
}

export async function startMic() {
  if (state === 'on' || state === 'starting') return true;
  setState('starting');
  try {
    const c = await resumeAudio();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    source = c.createMediaStreamSource(stream);
    analyserNode = c.createAnalyser();
    const an = getAnalyzer();
    analyserNode.fftSize = Math.max(2048, an.n);
    analyserNode.smoothingTimeConstant = 0;
    source.connect(analyserNode);
    buf = new Float32Array(analyserNode.fftSize);
    makeTracker();
    timer = setInterval(tick, 12);
    setState('on');
    return true;
  } catch (e) {
    console.warn('microphone', e);
    setState(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'error');
    return false;
  }
}

export function stopMic() {
  clearInterval(timer);
  timer = null;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  try { source && source.disconnect(); } catch (e) { /* gone */ }
  source = null;
  if (tracker) for (const m of tracker.held()) emit('off', m, 0, 'mic');
  setState('off');
}

function tick() {
  if (!analyserNode) return;
  analyserNode.getFloatTimeDomainData(buf);
  const c = audioContext();
  const time = c.currentTime;
  const an = getAnalyzer();
  const offset = buf.length - an.n;
  if (frameHook) { frameHook(buf, time, offset); return; }
  const events = tracker.process(buf, time, offset);
  const now = performance.now();
  for (const ev of events) emit(ev.type, ev.midi, ev.velocity ?? 0.7, 'mic', now);
  if (levelListeners.size && now - lastLevelPush > 50) {
    lastLevelPush = now;
    const payload = { rms: tracker.lastRms, levels: tracker.levels, keys: tracker.keys, held: tracker.held(), noise: tracker.noiseLevel, total: tracker.lastTotal };
    for (const fn of levelListeners) fn(payload);
  }
}

export function setExpected(midis) { if (tracker) tracker.setExpected(midis); }
export function suppress(midi, untilAudioTime) { if (tracker) tracker.suppress(midi, untilAudioTime); }
export function setSensitivity(s) { if (tracker) tracker.sensitivity = s; }

// ---- Calibration --------------------------------------------------------------------------------

/** Measures the room for `seconds`. Resolves {level}. */
export function measureNoise(seconds = 1.5, onProgress) {
  return new Promise((resolve) => {
    const an = getAnalyzer();
    const rec = new NoiseRecorder(an);
    const start = audioContext().currentTime;
    frameHook = (b, time, offset) => {
      rec.feed(b, offset);
      const p = (time - start) / seconds;
      onProgress && onProgress(Math.min(1, p));
      if (p >= 1) {
        frameHook = null;
        resolve(rec.result());
      }
    };
  });
}

/**
 * Waits for one key to be played and records it. Resolves {template, match} or null on cancel.
 * `noiseLevel` comes from measureNoise. onLevel(0..1) drives a meter while waiting.
 */
export function recordKey(noise, onLevel) {
  let cancelled = false;
  const p = new Promise((resolve) => {
    const an = getAnalyzer();
    const rec = new KeyRecorder(an, noise.level);
    rec.noise = noise.spectrum;
    frameHook = (b, time, offset) => {
      if (cancelled) { frameHook = null; resolve(null); return; }
      const st = rec.feed(b, time, offset);
      onLevel && onLevel(st);
      if (st === 'done') {
        frameHook = null;
        resolve({ template: rec.template(), recorder: rec });
      }
    };
  });
  p.cancel = () => { cancelled = true; };
  return p;
}

export function cancelCalibrationHook() { frameHook = null; }

/** Saves a finished calibration: {templates: {midi: Float32Array}, noise, range}. */
export function saveCalibration({ templates, noise, range }) {
  const packed = {};
  for (const [m, t] of Object.entries(templates)) packed[m] = packTemplate(t);
  store.set('calibration', {
    templates: packed,
    noise: noise ? packTemplate(noise.template) : null,
    noiseLevel: noise ? noise.level : 0,
    range,
    date: Date.now(),
    sampleRate: audioContext().sampleRate,
  });
  makeTracker();
}

export function clearCalibration() {
  store.remove('calibration');
  if (tracker) makeTracker();
}

/** Templates the detector is using now (for checking a recorded key against). */
export function currentTemplates() {
  const cal = calibration();
  return buildTemplates(getAnalyzer(), { measured: cal?.templates || {}, bundled });
}
