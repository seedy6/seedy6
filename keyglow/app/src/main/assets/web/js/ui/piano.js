// Canvas drawing for the keyboard and the falling notes ("waterfall"), plus touch input on the keys.

import { isBlack, pitchClass, noteName, PITCH_COLORS } from '../music/theory.js';
import { emit } from '../input.js';

// ---- Colours --------------------------------------------------------------------------------------

export function paletteFor(mode) {
  if (mode === 'kids') {
    return {
      kids: true,
      bgTop: '#2a2470', bgBottom: '#1b1650', lane: 'rgba(255,255,255,0.05)', laneC: 'rgba(255,255,255,0.10)',
      beat: 'rgba(255,255,255,0.06)', bar: 'rgba(255,255,255,0.16)',
      R: ['#ffb36b', '#ff6a3d'], L: ['#7f8cff', '#4b5bff'],
      hit: '#5bd97a', wrong: '#ff4d6d', expect: '#ffe156', auto: 'rgba(255,255,255,0.65)',
      text: '#ffffff', hitLine: '#ffe156', pitchColors: true,
    };
  }
  return {
    kids: false,
    bgTop: '#06070f', bgBottom: '#0b0d1d', lane: 'rgba(255,255,255,0.025)', laneC: 'rgba(255,255,255,0.07)',
    beat: 'rgba(255,255,255,0.04)', bar: 'rgba(130,140,255,0.16)',
    R: ['#7ff3ff', '#22c3e6'], L: ['#c4a6ff', '#8b5cf6'],
    hit: '#4ade80', wrong: '#fb7185', expect: '#fbbf24', auto: 'rgba(200,210,255,0.55)',
    text: '#06101a', hitLine: '#6ee7f9', pitchColors: false,
  };
}

// ---- Layout ------------------------------------------------------------------------------------------

/** Key rectangles for a range across a width. Black keys sit between their whites, nudged like a real piano. */
export function layoutKeys(lo, hi, width) {
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const ww = width / whites.length;
  const keys = new Map();
  whites.forEach((m, i) => keys.set(m, { midi: m, x: i * ww, w: ww, black: false }));
  const bw = ww * 0.6;
  const nudge = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 };
  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) continue;
    const left = keys.get(m - 1);
    const x = left ? left.x + ww : 0;
    keys.set(m, { midi: m, x: x - bw / 2 + nudge[pitchClass(m)] * bw, w: bw, black: true });
  }
  return { keys, whiteW: ww, lo, hi };
}

export function keyAt(layout, x, y, kbTop, kbH) {
  if (y < kbTop || y > kbTop + kbH) return null;
  const blackH = kbH * 0.62;
  if (y - kbTop < blackH) {
    for (const k of layout.keys.values()) if (k.black && x >= k.x && x <= k.x + k.w) return k.midi;
  }
  for (const k of layout.keys.values()) if (!k.black && x >= k.x && x <= k.x + k.w) return k.midi;
  return null;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ---- Keyboard --------------------------------------------------------------------------------------------

/**
 * state: {pressed: Map midi→color, expect: Set, labels: 'letters'|'solfege'|'none', glow: Map midi→0..1, fingers: Map midi→n}
 */
export function drawKeyboard(ctx, layout, top, height, pal, state) {
  const { keys } = layout;
  const t = performance.now() / 1000;
  // Felt strip
  ctx.fillStyle = pal.kids ? '#ff6a3d' : '#7f1d3a';
  ctx.fillRect(0, top - 3, layout.whiteW * [...keys.values()].filter((k) => !k.black).length, 3);
  for (const k of keys.values()) {
    if (k.black) continue;
    const pressed = state.pressed?.get(k.midi);
    const expect = state.expect?.has(k.midi);
    const x = k.x + 0.5, w = k.w - 1;
    let g = ctx.createLinearGradient(0, top, 0, top + height);
    if (pressed) { g.addColorStop(0, pressed); g.addColorStop(1, hexA(pressed.startsWith('#') ? pressed : '#ffffff', 0.85)); }
    else if (pal.kids && state.colorKeys) { const c = PITCH_COLORS[pitchClass(k.midi)]; g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#ffffff'); g.addColorStop(1, hexA(c, 0.55)); }
    else { g.addColorStop(0, '#f4f5fb'); g.addColorStop(0.85, '#ffffff'); g.addColorStop(1, '#dfe2ee'); }
    ctx.fillStyle = g;
    roundRect(ctx, x, top, w, height, Math.min(6, w * 0.2));
    ctx.fill();
    if (expect && !pressed) {
      const a = 0.45 + 0.35 * Math.sin(t * 6);
      ctx.fillStyle = hexA(pal.expect, a);
      roundRect(ctx, x + 2, top + height * 0.45, w - 4, height * 0.55 - 3, 5);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + w, top, 1, height);
    labelKey(ctx, k, top, height, pal, state, false);
  }
  for (const k of keys.values()) {
    if (!k.black) continue;
    const pressed = state.pressed?.get(k.midi);
    const expect = state.expect?.has(k.midi);
    const h = height * 0.62;
    const g = ctx.createLinearGradient(0, top, 0, top + h);
    if (pressed) { g.addColorStop(0, pressed); g.addColorStop(1, '#222'); }
    else { g.addColorStop(0, '#2a2c38'); g.addColorStop(0.8, '#0f1017'); g.addColorStop(1, '#3a3d4c'); }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, k.x + 2, top, k.w, h + 3, 4);
    ctx.fill();
    ctx.fillStyle = g;
    roundRect(ctx, k.x, top - 1, k.w, h, 4);
    ctx.fill();
    if (!pressed) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, k.x + k.w * 0.18, top + 2, k.w * 0.64, h * 0.75, 3);
      ctx.fill();
    }
    if (expect && !pressed) {
      const a = 0.55 + 0.35 * Math.sin(t * 6);
      ctx.fillStyle = hexA(pal.expect, a);
      roundRect(ctx, k.x + 2, top + h * 0.5, k.w - 4, h * 0.45, 3);
      ctx.fill();
    }
    labelKey(ctx, k, top, h, pal, state, true);
  }
}

function labelKey(ctx, k, top, h, pal, state, black) {
  const mode = state.labels || 'letters';
  const finger = state.fingers?.get(k.midi);
  const size = Math.max(9, Math.min(16, k.w * (black ? 0.5 : 0.42)));
  if (finger) {
    const r = Math.min(k.w * 0.38, 13);
    const cy = top + h - r - (black ? 6 : 34);
    ctx.fillStyle = pal.expect;
    ctx.beginPath(); ctx.arc(k.x + k.w / 2, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1300';
    ctx.font = `800 ${Math.round(r * 1.25)}px ${pal.kids ? 'Fredoka' : 'Outfit'}, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(finger), k.x + k.w / 2, cy + 1);
  }
  if (mode === 'none' || black) return;
  const isC = pitchClass(k.midi) === 0;
  if (mode === 'c-only' && !isC) return;
  ctx.font = `${isC ? 700 : 500} ${size}px ${pal.kids ? 'Fredoka' : 'Outfit'}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = pal.kids && state.colorKeys ? PITCH_COLORS[pitchClass(k.midi)] : (isC ? '#5b6cff' : '#9aa0b8');
  const label = noteName(k.midi, { octave: isC && mode !== 'solfege', style: mode === 'solfege' ? 'solfege' : 'letter' });
  ctx.fillText(label, k.x + k.w / 2, top + h - 10);
}

// ---- Particles ------------------------------------------------------------------------------------------------

export class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, n = 16, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const v = (80 + Math.random() * 260) * power;
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, size: 2 + Math.random() * 3.5, color });
    }
    if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
  }
  draw(ctx, dt) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.985;
      p.life -= dt * 1.6;
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    this.list = this.list.filter((p) => p.life > 0);
  }
}

// ---- Waterfall --------------------------------------------------------------------------------------------------

/**
 * Draws one frame: background lanes and beat lines, falling notes, the hit line, judgement pop-ups and
 * the keyboard. Stateless apart from particles and pop-ups, so the screen just calls draw() each frame.
 */
export class Waterfall {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pal = paletteFor(opts.mode);
    this.range = opts.range;
    this.labels = opts.labels || 'letters';
    this.showFingers = opts.showFingers ?? true;
    this.colorKeys = opts.colorKeys ?? this.pal.kids;
    this.secondsVisible = opts.secondsVisible || 3.2;
    this.particles = new Particles();
    this.popups = [];
    this.keyFlash = new Map(); // midi → {color, until}
    this.lastFrame = performance.now();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.kbH = Math.round(Math.min(220, Math.max(110, this.h * 0.27)));
    this.kbTop = this.h - this.kbH;
    this.layout = layoutKeys(this.range[0], this.range[1], this.w);
  }

  setRange(range) { this.range = range; this.layout = layoutKeys(range[0], range[1], this.w); }

  noteColor(n) {
    if (this.pal.pitchColors) { const c = PITCH_COLORS[pitchClass(n.midi)]; return [c, c]; }
    return this.pal[n.hand === 'L' ? 'L' : 'R'];
  }

  flash(midi, color, ms = 220) { this.keyFlash.set(midi, { color, until: performance.now() + ms }); }

  judge(j) {
    const k = this.layout.keys.get(j.midi);
    if (!k) return;
    const x = k.x + k.w / 2;
    const colors = { perfect: '#6ee7f9', great: '#4ade80', good: '#fbbf24', hit: this.pal.hit, miss: '#9aa3c7', wrong: this.pal.wrong };
    const labels = { perfect: 'Perfect', great: 'Great', good: 'Good', miss: 'Miss', wrong: '' , hit: '' };
    const c = colors[j.grade];
    if (j.grade !== 'miss' && j.grade !== 'wrong') {
      const base = j.note ? this.noteColor(j.note)[0] : c;
      this.particles.burst(x, this.kbTop - 2, base, j.grade === 'perfect' ? 22 : 14, j.grade === 'perfect' ? 1.2 : 0.9);
      this.particles.burst(x, this.kbTop - 2, '#ffffff', 5, 0.6);
    }
    if (j.grade === 'wrong') this.flash(j.midi, this.pal.wrong, 350);
    if (labels[j.grade]) this.popups.push({ x, y: this.kbTop - 28, text: labels[j.grade], color: c, born: performance.now() });
    if (j.combo && j.combo % 10 === 0 && j.combo >= 10) this.popups.push({ x: this.w / 2, y: this.kbTop * 0.45, text: `${j.combo} combo!`, color: '#fbbf24', born: performance.now(), big: true });
    if (this.popups.length > 20) this.popups.shift();
  }

  /**
   * @param f.chart, f.time (chart seconds), f.noteState (id→{judged}), f.hands (user hands)
   * @param f.pressed Map midi→source, f.auto Map midi→true (other hand sounding), f.expect Set
   * @param f.loop [a,b] | null, f.tempo
   */
  draw(f) {
    const { ctx, w, h, kbTop, layout, pal } = this;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const pps = kbTop / this.secondsVisible; // pixels per chart second
    const time = f.time;
    const yOf = (t) => kbTop - (t - time) * pps;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, kbTop);
    bg.addColorStop(0, pal.bgTop); bg.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, kbTop);
    // Lanes: a faint line at every C and F
    for (const k of layout.keys.values()) {
      if (k.black) continue;
      const pc = pitchClass(k.midi);
      if (pc === 0 || pc === 5) { ctx.fillStyle = pc === 0 ? pal.laneC : pal.lane; ctx.fillRect(Math.round(k.x), 0, 1, kbTop); }
    }
    for (const k of layout.keys.values()) if (k.black) { ctx.fillStyle = 'rgba(255,255,255,0.018)'; ctx.fillRect(k.x, 0, k.w, kbTop); }
    // Beat and bar lines
    if (f.chart) {
      const beat = f.chart.beat;
      const bpb = f.chart.beatsPerBar || 4;
      const first = Math.floor((time - 0.5) / beat);
      const last = Math.ceil((time + this.secondsVisible + 0.5) / beat);
      for (let b = Math.max(0, first); b <= last; b++) {
        const y = yOf(b * beat);
        if (y < 0 || y > kbTop) continue;
        const isBar = Math.abs((b / bpb) - Math.round(b / bpb)) < 1e-6;
        ctx.fillStyle = isBar ? pal.bar : pal.beat;
        ctx.fillRect(0, Math.round(y), w, isBar ? 2 : 1);
      }
      if (f.loop) {
        ctx.fillStyle = 'rgba(251,191,36,0.10)';
        const y1 = yOf(f.loop[1]), y0 = yOf(f.loop[0]);
        ctx.fillRect(0, Math.max(0, y1), w, Math.min(kbTop, y0) - Math.max(0, y1));
        ctx.fillStyle = 'rgba(251,191,36,0.7)';
        if (y1 > 0 && y1 < kbTop) ctx.fillRect(0, y1, w, 2);
        if (y0 > 0 && y0 < kbTop) ctx.fillRect(0, y0, w, 2);
      }
    }

    // Notes
    const fingers = new Map();
    if (f.chart) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const font = pal.kids ? 'Fredoka' : 'Outfit';
      for (const n of f.chart.notes) {
        const yBottom = yOf(n.t);
        const yTop = yOf(n.t + n.d);
        if (yTop >= kbTop) continue; // already gone past
        if (yBottom < -4) break;
        const k = layout.keys.get(n.midi);
        if (!k) continue;
        const st = f.noteState?.get(n.id);
        const user = f.hands.includes(n.hand) && f.mode !== 'listen';
        const [c1, c2] = this.noteColor(n);
        const pad = k.black ? 1 : Math.max(1.5, k.w * 0.08);
        const x = k.x + pad, nw = k.w - pad * 2;
        const top = Math.max(-10, yTop), bottom = Math.min(kbTop, yBottom - 1);
        if (bottom <= top) continue;
        const judged = st && st.judged;
        const playing = n.t <= time && n.t + n.d > time;
        ctx.globalAlpha = user ? (judged === 'miss' ? 0.35 : 1) : 0.42;
        const g = ctx.createLinearGradient(x, 0, x + nw, 0);
        g.addColorStop(0, c1); g.addColorStop(1, c2);
        if (playing && user) { ctx.shadowColor = c1; ctx.shadowBlur = 18; }
        ctx.fillStyle = judged === 'miss' ? '#59607d' : g;
        roundRect(ctx, x, top, nw, bottom - top, Math.min(8, nw * 0.35));
        ctx.fill();
        ctx.shadowBlur = 0;
        // Gloss
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        roundRect(ctx, x + 2, top + 2, Math.max(1, nw * 0.35), Math.max(1, bottom - top - 4), Math.min(6, nw * 0.2));
        ctx.fill();
        if (judged && judged !== 'miss' && judged !== 'skipped') {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          roundRect(ctx, x, top, nw, bottom - top, Math.min(8, nw * 0.35));
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Letter inside the note
        if (user && this.labels !== 'none' && nw > 16 && bottom - top > 20) {
          ctx.fillStyle = pal.kids ? '#ffffff' : 'rgba(6,16,26,0.85)';
          ctx.font = `700 ${Math.round(Math.min(18, nw * 0.5))}px ${font}, sans-serif`;
          const label = noteName(n.midi, { octave: false, style: this.labels === 'solfege' ? 'solfege' : 'letter' });
          ctx.fillText(label, x + nw / 2, Math.max(top + 12, bottom - 14));
        }
        if (user && this.showFingers && n.finger && !judged && n.t - time < this.secondsVisible * 0.6 && n.t >= time - 0.05) {
          if (!fingers.has(n.midi)) fingers.set(n.midi, n.finger);
        }
      }
    }

    // Hit line
    const hl = ctx.createLinearGradient(0, kbTop - 14, 0, kbTop);
    hl.addColorStop(0, 'rgba(0,0,0,0)');
    hl.addColorStop(1, hexA(pal.hitLine, f.waiting ? 0.55 : 0.28));
    ctx.fillStyle = hl;
    ctx.fillRect(0, kbTop - 14, w, 14);

    // Keyboard
    const pressed = new Map();
    for (const [m, color] of f.auto || []) pressed.set(m, color === true ? pal.auto : color);
    for (const [m] of f.pressed || []) pressed.set(m, f.expectHit?.has(m) ? pal.hit : (f.colorForPress ? f.colorForPress(m) : pal.R[0]));
    for (const [m, fl] of this.keyFlash) {
      if (fl.until < now) this.keyFlash.delete(m);
      else pressed.set(m, fl.color);
    }
    drawKeyboard(ctx, layout, kbTop, this.kbH, pal, { pressed, expect: f.expect, labels: this.labels, fingers: this.showFingers ? fingers : null, colorKeys: this.colorKeys });
    // Glow above pressed keys
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [m, color] of pressed) {
      const k = layout.keys.get(m);
      if (!k) continue;
      const g = ctx.createRadialGradient(k.x + k.w / 2, kbTop, 0, k.x + k.w / 2, kbTop, k.w * 2.2);
      g.addColorStop(0, hexA(color.startsWith('#') ? color : '#ffffff', 0.55));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(k.x - k.w * 2, kbTop - k.w * 2.2, k.w * 5, k.w * 2.2);
    }
    ctx.restore();

    this.particles.draw(ctx, dt);
    // Pop-ups
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.popups = this.popups.filter((p) => now - p.born < 800);
    for (const p of this.popups) {
      const a = (now - p.born) / 800;
      ctx.globalAlpha = 1 - a;
      ctx.font = `800 ${p.big ? 44 : 20}px ${pal.kids ? 'Fredoka' : 'Outfit'}, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(5,6,14,0.85)';
      ctx.strokeText(p.text, p.x, p.y - a * 40);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - a * 40);
    }
    ctx.globalAlpha = 1;

    // Progress along the top
    if (f.chart && f.chart.length > 0) {
      const p = Math.max(0, Math.min(1, time / f.chart.length));
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, w, 4);
      const pg = ctx.createLinearGradient(0, 0, w, 0);
      pg.addColorStop(0, pal.R[0]); pg.addColorStop(1, pal.L[1]);
      ctx.fillStyle = pg;
      ctx.fillRect(0, 0, w * p, 4);
    }
  }
}

// ---- Touch on the on-screen keys ------------------------------------------------------------------------------

/** Lets fingers play the drawn keyboard (with glissando). getGeom() → {layout, top, height}. */
export function attachTouch(canvas, getGeom, { source = 'touch', enabled = () => true } = {}) {
  const active = new Map(); // pointerId → midi
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => {
    if (!enabled()) return;
    const g = getGeom();
    const [x, y] = pos(e);
    const m = keyAt(g.layout, x, y, g.top, g.height);
    if (m == null) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    active.set(e.pointerId, m);
    const vel = Math.min(1, 0.45 + ((y - g.top) / g.height) * 0.55);
    emit('on', m, vel, source);
  };
  const move = (e) => {
    if (!active.has(e.pointerId)) return;
    const g = getGeom();
    const [x, y] = pos(e);
    const m = keyAt(g.layout, x, y, g.top, g.height);
    const cur = active.get(e.pointerId);
    if (m === cur) return;
    emit('off', cur, 0, source);
    if (m == null) { active.delete(e.pointerId); return; }
    active.set(e.pointerId, m);
    emit('on', m, 0.7, source);
  };
  const up = (e) => {
    const m = active.get(e.pointerId);
    if (m == null) return;
    active.delete(e.pointerId);
    emit('off', m, 0, source);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', up);
  return () => {
    for (const m of active.values()) emit('off', m, 0, source);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('pointerleave', up);
  };
}
