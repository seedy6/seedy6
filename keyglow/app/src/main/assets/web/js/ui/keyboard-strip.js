// A keyboard on its own (no falling notes): for tips, free play, calibration and quizzes.

import { html, useEffect, useRef } from '../vendor/preact-htm.js';
import { layoutKeys, drawKeyboard, paletteFor, attachTouch, Particles } from './piano.js';
import { onInput } from '../input.js';
import { PITCH_COLORS, pitchClass } from '../music/theory.js';

/**
 * props: range [lo, hi], highlight Set|array (glowing keys), mode ('kids'|'adult'), labels,
 *        touch (bool), height, colorFor(midi) for pressed keys, ribbons (bool: notes float up), marks Map midi→color
 */
export function KeyboardStrip(props) {
  const ref = useRef();
  const wrap = useRef();
  const p = useRef(props);
  p.current = props;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const pal = paletteFor(props.mode);
    let layout, w, h, kbTop, kbH;
    const pressed = new Map();
    const ribbons = [];
    const particles = new Particles();
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [lo, hi] = p.current.range;
      layout = layoutKeys(lo, hi, w);
      kbH = p.current.ribbons ? Math.min(h * 0.42, 240) : h;
      kbTop = h - kbH;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current);
    let lastRange = props.range.join();
    const off = onInput((ev) => {
      if (ev.type === 'on') {
        pressed.set(ev.midi, true);
        const k = layout.keys.get(ev.midi);
        if (k && p.current.ribbons) {
          const color = pal.kids ? PITCH_COLORS[pitchClass(ev.midi)] : (k.black ? pal.L[0] : pal.R[0]);
          ribbons.push({ midi: ev.midi, x: k.x, w: k.w, start: performance.now(), end: null, color });
          particles.burst(k.x + k.w / 2, kbTop - 2, color, 12, 0.8);
        }
      } else {
        pressed.delete(ev.midi);
        for (const r of ribbons) if (r.midi === ev.midi && r.end == null) r.end = performance.now();
      }
    });
    const detach = props.touch !== false ? attachTouch(canvas, () => ({ layout, top: kbTop, height: kbH })) : () => {};
    let raf, last = performance.now();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (p.current.range.join() !== lastRange) { lastRange = p.current.range.join(); resize(); }
      ctx.clearRect(0, 0, w, h);
      if (p.current.ribbons) {
        const speed = 140; // px/s upwards
        ctx.save();
        for (let i = ribbons.length - 1; i >= 0; i--) {
          const r = ribbons[i];
          const yTop = kbTop - (now - r.start) / 1000 * speed;
          const yBottom = r.end == null ? kbTop : kbTop - (now - r.end) / 1000 * speed;
          if (yBottom < -20) { ribbons.splice(i, 1); continue; }
          const g = ctx.createLinearGradient(0, yTop, 0, yBottom);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.3, r.color);
          g.addColorStop(1, r.color);
          ctx.shadowColor = r.color; ctx.shadowBlur = 16;
          ctx.fillStyle = g;
          const pad = r.w * 0.12;
          ctx.fillRect(r.x + pad, Math.max(0, yTop), r.w - pad * 2, yBottom - Math.max(0, yTop));
        }
        ctx.restore();
        particles.draw(ctx, dt);
      }
      const hl = p.current.highlight ? new Set(p.current.highlight) : null;
      const press = new Map();
      for (const m of pressed.keys()) press.set(m, p.current.colorFor ? p.current.colorFor(m) : (pal.kids ? PITCH_COLORS[pitchClass(m)] : pal.R[0]));
      if (p.current.marks) for (const [m, c] of p.current.marks) press.set(m, c);
      drawKeyboard(ctx, layout, kbTop, kbH, pal, { pressed: press, expect: hl, labels: p.current.labels || 'letters', colorKeys: pal.kids });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); off(); detach(); };
  }, []);
  return html`<div ref=${wrap} style=${{ position: 'relative', width: '100%', height: (props.height || 180) + 'px', flex: props.flex ? '1' : 'none' }}>
    <canvas ref=${ref} style="position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block"></canvas>
  </div>`;
}
