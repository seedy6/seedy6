// All sound is synthesised with Web Audio, so there are no audio files to ship.
// Everything runs through a compressor and a long convolution reverb for a big, cinematic space.
const Sfx = (() => {
  let ctx = null, bus = null, master = null, noiseBuf = null;
  let enabled = true, volume = 0.8, theme = "versus";
  let offline = false, clock = 0; // clock: seconds added to every cue while rendering offline

  function makeNoise(c) {
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeImpulse(c, seconds, decay) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // bus -> compressor -> master, with a reverb send from bus into the compressor.
  function build(c) {
    master = c.createGain();
    master.gain.value = volume;
    master.connect(c.destination);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;
    comp.connect(master);
    bus = c.createGain();
    bus.connect(comp);
    const verb = c.createConvolver();
    verb.buffer = makeImpulse(c, 2.8, 2.4); // long enough to feel big, short enough for the Fire Stick
    const wet = c.createGain();
    wet.gain.value = 0.45;
    bus.connect(verb);
    verb.connect(wet);
    wet.connect(comp);
    noiseBuf = makeNoise(c);
  }

  function audio() {
    if (!enabled) return null;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
      build(ctx);
    }
    if (!offline && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  const now = (c, at) => c.currentTime + clock + at;

  // Where a sound goes: straight to the bus, or through a panner that can sweep pan -> pan2.
  function route(c, t, dur, pan, pan2) {
    if (pan === undefined || !c.createStereoPanner) return bus;
    const p = c.createStereoPanner();
    p.pan.setValueAtTime(pan, t);
    if (pan2 !== undefined) p.pan.linearRampToValueAtTime(pan2, t + dur);
    p.connect(bus);
    return p;
  }

  function envelope(c, t, attack, peak, decay, dest) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  function tone({ type = "sine", f, f2, at = 0, attack = 0.005, peak = 0.2, decay = 0.2, pan, pan2, detune = 0 }) {
    const c = audio(); if (!c) return;
    const t = now(c, at), dur = attack + decay;
    const o = c.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    o.connect(envelope(c, t, attack, peak, decay, route(c, t, dur, pan, pan2)));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Filtered noise. With fPeak the filter sweeps f -> fPeak -> f2 (a whoosh that passes by).
  function noise({ at = 0, attack = 0.01, decay = 0.3, peak = 0.3, type = "bandpass", f = 1000, fPeak, f2, q = 1, pan, pan2 }) {
    const c = audio(); if (!c) return;
    const t = now(c, at), dur = attack + decay;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f, t);
    if (fPeak) filter.frequency.exponentialRampToValueAtTime(fPeak, t + attack);
    if (f2) filter.frequency.exponentialRampToValueAtTime(f2, t + dur);
    src.connect(filter);
    filter.connect(envelope(c, t, attack, peak, decay, route(c, t, dur, pan, pan2)));
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  const fx = {
    // A deep sub-bass hit: the floor drops out.
    boom(size = 1) {
      tone({ f: 64, f2: 24, attack: 0.004, peak: 0.95 * size, decay: 2.4 * size });
      tone({ type: "triangle", f: 120, f2: 38, attack: 0.002, peak: 0.35 * size, decay: 0.5 });
      noise({ type: "lowpass", f: 320, f2: 50, q: 0.7, attack: 0.003, peak: 0.55 * size, decay: 0.6 });
    },
    // The low brass "braam" of film trailers: detuned saws a fifth apart through an opening filter.
    braam(at = 0) {
      const c = audio(); if (!c) return;
      const t = now(c, at);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 2;
      lp.frequency.setValueAtTime(110, t);
      lp.frequency.exponentialRampToValueAtTime(950, t + 0.35);
      lp.frequency.exponentialRampToValueAtTime(160, t + 3);
      lp.connect(envelope(c, t, 0.12, 0.5, 2.9, bus));
      for (const f of [43.65, 65.4, 87.3]) {
        for (const detune of [-14, 0, 14]) {
          const o = c.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = f;
          o.detune.value = detune;
          o.connect(lp);
          o.start(t);
          o.stop(t + 3.2);
        }
      }
      tone({ at, f: 43.65, attack: 0.1, peak: 0.45, decay: 2.8 });
    },
    // A slow, heavy whoosh that sweeps across the stereo field.
    whooshDeep({ dur = 1.1, pan, pan2, peak = 0.55 } = {}) {
      noise({ attack: dur * 0.62, decay: dur * 0.38, peak, f: 110, fPeak: 900, f2: 140, q: 0.9, pan, pan2 });
      noise({ attack: dur * 0.6, decay: dur * 0.4, peak: peak * 0.35, type: "highpass", f: 900, fPeak: 3800, f2: 1200, q: 0.5, pan, pan2 });
      tone({ f: 70, f2: 42, attack: dur * 0.55, peak: peak * 0.5, decay: dur * 0.5, pan, pan2 });
    },
    // A long build of air and rising tone into a hit.
    riser(dur = 1.2) {
      noise({ attack: dur, decay: 0.05, peak: 0.32, type: "highpass", f: 250, fPeak: 6500, q: 0.8 });
      tone({ type: "sawtooth", f: 55, f2: 220, attack: dur, peak: 0.07, decay: 0.05 });
      tone({ f: 110, f2: 440, attack: dur, peak: 0.08, decay: 0.05 });
    },
    // A low rumble bed under the opening.
    rumble(dur = 2.6) {
      noise({ attack: dur * 0.6, decay: dur * 0.6, peak: 0.5, type: "lowpass", f: 70, fPeak: 140, f2: 60, q: 0.6 });
      tone({ f: 36, attack: dur * 0.5, peak: 0.32, decay: dur * 0.7 });
    },
    // Struck armour: inharmonic partials ringing out into the reverb.
    metal(pan) {
      [311, 742, 1187, 1789, 2633].forEach((f, i) => tone({ f, attack: 0.002, peak: 0.07 / (1 + i * 0.4), decay: 1.6 - i * 0.2, pan }));
    },
    // A low drum, like a taiko struck hard.
    drum(pan) {
      tone({ f: 96, f2: 44, attack: 0.002, peak: 0.85, decay: 0.9, pan });
      noise({ type: "lowpass", f: 600, f2: 120, attack: 0.002, peak: 0.4, decay: 0.25, pan });
    },
    // A glassy high pad that blooms into the reverb.
    shimmer() {
      [1318.5, 1975.5, 2637].forEach((f, i) => {
        tone({ f, attack: 0.6, peak: 0.035, decay: 3.2, detune: -6 + i * 6 });
        tone({ f: f * 1.004, attack: 0.8, peak: 0.02, decay: 3 });
      });
    },
    // Quiet data ticks while the name decodes.
    blip() { tone({ f: 2200 + Math.random() * 600, attack: 0.002, peak: 0.018, decay: 0.035 }); },

    // Single-character themes reuse the same palette.
    spartanCharge() {
      tone({ type: "sawtooth", f: 55, f2: 220, attack: 1.3, peak: 0.08, decay: 0.3 });
      noise({ attack: 1.3, decay: 0.3, peak: 0.2, type: "lowpass", f: 200, fPeak: 2500, q: 2 });
      tone({ f: 41, attack: 0.8, peak: 0.3, decay: 1.2 });
    },
    spartanChime() {
      [261.6, 392, 523.25, 784].forEach((f, i) => tone({ f, at: i * 0.05, attack: 0.01, peak: 0.08, decay: 3 }));
      fx.shimmer();
    },
    whoosh() { fx.whooshDeep({ dur: 0.7 }); },
    impact(heavy = false) { heavy ? fx.boom(1) : fx.drum(); },
    gong() {
      [1, 1.47, 2.09, 2.56, 3.11].forEach((m, i) => {
        tone({ f: 65 * m, attack: 0.02, peak: 0.2 / (i + 1), decay: 4 - i * 0.4 });
        tone({ f: 65 * m * 1.004, attack: 0.03, peak: 0.1 / (i + 1), decay: 3.4 - i * 0.3 });
      });
    },

    // UI feedback: a soft tick to move, a deep thud to select.
    tick() { tone({ f: theme === "fengwei" ? 900 : 1900, attack: 0.002, peak: 0.04, decay: 0.05 }); },
    select() {
      tone({ f: 130, f2: 60, attack: 0.003, peak: 0.45, decay: 0.35 });
      fx.metal();
    }
  };

  return {
    ...fx,
    configure(opts) {
      if (opts.sound !== undefined) enabled = !!opts.sound;
      if (opts.volume !== undefined) volume = opts.volume;
      if (opts.theme) theme = opts.theme;
      if (master) master.gain.value = volume;
    },
    unlock() { audio(); },

    /**
     * Render cues to a WAV file instead of the speakers (used to put sound on the demo video).
     * script(at) is called once; at(seconds, fn) runs fn with its sounds placed at that time.
     */
    async render(seconds, script) {
      const saved = { ctx, bus, master, noiseBuf, enabled };
      const off = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
      ctx = off;
      build(off);
      enabled = true;
      offline = true;
      try {
        script((sec, fn) => { clock = sec; try { fn(); } finally { clock = 0; } });
      } finally {
        ({ ctx, bus, master, noiseBuf, enabled } = saved);
        offline = false;
      }
      return toWav(await off.startRendering());
    }
  };

  function toWav(buf) {
    const ch = buf.numberOfChannels, n = buf.length, bytes = 44 + n * ch * 2;
    const v = new DataView(new ArrayBuffer(bytes));
    const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF"); v.setUint32(4, bytes - 8, true); str(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true);
    v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * ch * 2, true);
    const data = [...Array(ch)].map((_, i) => buf.getChannelData(i));
    for (let i = 0, o = 44; i < n; i++) {
      for (let c = 0; c < ch; c++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true);
    }
    return v.buffer;
  }
})();
