// All sound effects are synthesised with Web Audio, so there are no audio files to ship.
const Sfx = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let enabled = true, volume = 0.7, theme = "fengwei";

  function audio() {
    if (!enabled) return null;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function gainEnv(t, attack, peak, decay, dest = master) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  function tone({ type = "sine", f, f2, at = 0, attack = 0.005, peak = 0.2, decay = 0.2, dest }) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + attack + decay);
    o.connect(gainEnv(t, attack, peak, decay, dest));
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  function noise({ at = 0, dur = 0.3, peak = 0.3, type = "bandpass", f = 1000, f2, q = 1, attack = 0.01 }) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f, t);
    if (f2) filter.frequency.exponentialRampToValueAtTime(f2, t + dur);
    src.connect(filter);
    filter.connect(gainEnv(t, attack, peak, dur));
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  const fx = {
    // Spartan: shield charge, decode blips and a bright "systems online" chord.
    spartanCharge() {
      const c = audio(); if (!c) return;
      const t = c.currentTime;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(4000, t + 1.5);
      lp.connect(gainEnv(t, 1.3, 0.22, 0.4));
      for (const detune of [-8, 8]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.detune.value = detune;
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(440, t + 1.5);
        o.connect(lp);
        o.start(t);
        o.stop(t + 1.8);
      }
      tone({ f: 55, attack: 0.6, peak: 0.25, decay: 1.2 });
    },
    spartanChime() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone({ f, at: i * 0.06, attack: 0.01, peak: 0.12, decay: 2.4 });
        tone({ f: f * 1.003, at: i * 0.06, attack: 0.01, peak: 0.06, decay: 2.0 });
      });
      tone({ f: 2093, at: 0.25, attack: 0.02, peak: 0.04, decay: 1.6 });
    },
    blip() { tone({ type: "square", f: 1400 + Math.random() * 400, attack: 0.002, peak: 0.025, decay: 0.03 }); },

    // Feng Wei: brush whoosh, body-blow impacts and a temple gong.
    whoosh() { noise({ dur: 0.38, peak: 0.35, f: 300, f2: 3500, q: 0.8, attack: 0.08 }); },
    impact(heavy = false) {
      tone({ f: heavy ? 150 : 180, f2: 38, attack: 0.003, peak: heavy ? 0.9 : 0.6, decay: heavy ? 0.45 : 0.28 });
      noise({ dur: heavy ? 0.22 : 0.12, peak: heavy ? 0.5 : 0.3, type: "lowpass", f: 2500, f2: 300, attack: 0.002 });
      if (heavy) tone({ type: "triangle", f: 70, f2: 30, attack: 0.002, peak: 0.5, decay: 0.7 });
    },
    gong() {
      [1, 1.47, 2.09, 2.56, 3.11, 4.2].forEach((m, i) => {
        tone({ f: 98 * m, attack: 0.01, peak: 0.16 / (i + 1), decay: 3.8 - i * 0.4 });
        tone({ f: 98 * m * 1.004, attack: 0.02, peak: 0.08 / (i + 1), decay: 3.2 - i * 0.3 });
      });
    },

    // UI feedback, flavoured per theme.
    tick() {
      if (theme === "spartan") tone({ f: 1900, attack: 0.002, peak: 0.05, decay: 0.05 });
      else tone({ type: "triangle", f: 820, f2: 520, attack: 0.002, peak: 0.12, decay: 0.06 });
    },
    select() {
      if (theme === "spartan") {
        tone({ f: 880, attack: 0.004, peak: 0.1, decay: 0.15 });
        tone({ f: 1320, at: 0.07, attack: 0.004, peak: 0.1, decay: 0.25 });
      } else fx.impact(false);
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
    unlock() { audio(); }
  };
})();
