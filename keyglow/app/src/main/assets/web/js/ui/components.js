// Small shared pieces: icons, stars, progress ring, the kids' mascot, modals, toasts and confetti.

import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';

const PATHS = {
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  restart: 'M4 4v6h6M4.5 15a8 8 0 1 0 1.9-8.3L4 10',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  metronome: 'M9 3h6l4 18H5zM12 17l5-9',
  loop: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  check: 'M5 12l5 5 9-11',
  ear: 'M6 9a6 6 0 1 1 12 0c0 4-4 5-4 9a3 3 0 0 1-6 0M10 9a2 2 0 1 1 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

export function Icon({ name, size = 22, stroke = 2.2 }) {
  const fill = name === 'play' || name === 'pause';
  return html`<svg viewBox="0 0 24 24" width=${size} height=${size} fill=${fill ? 'currentColor' : 'none'} stroke=${fill ? 'none' : 'currentColor'} stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round"><path d=${PATHS[name]} /></svg>`;
}

export function IconButton({ icon, onClick, title, on, children }) {
  return html`<button class=${'icon-btn' + (on ? ' on' : '')} onClick=${onClick} title=${title} aria-label=${title}>${icon ? html`<${Icon} name=${icon} />` : children}</button>`;
}

export function Stars({ n = 0, max = 3, size = 18 }) {
  return html`<span class="stars" style=${{ fontSize: size + 'px' }}>${Array.from({ length: max }, (_, i) => html`<span class=${'s' + (i < n ? ' on' : '')}>★</span>`)}</span>`;
}

export function Difficulty({ level }) {
  return html`<span class="diff" title=${'Level ' + level}>${[1, 2, 3, 4, 5].map((i) => html`<i class=${i <= level ? 'on' : ''}></i>`)}</span>`;
}

export function Ring({ value, size = 96, stroke = 10, color = 'var(--accent)', track = 'var(--surface-2)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return html`<div class="ring" style=${{ width: size + 'px', height: size + 'px' }}>
    <svg width=${size} height=${size}>
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${track} stroke-width=${stroke} />
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${color} stroke-width=${stroke} stroke-linecap="round"
        stroke-dasharray=${c} stroke-dashoffset=${c * (1 - Math.max(0, Math.min(1, value)))} style="transition: stroke-dashoffset .8s" />
    </svg>
    <div class="label">${children}</div>
  </div>`;
}

/** Pip, the kids' guide: a round little bird with headphones. */
export function Mascot({ size = 110, mood = 'happy' }) {
  const mouth = mood === 'wow' ? html`<ellipse cx="60" cy="74" rx="6" ry="7" fill="#7a2e00" />`
    : html`<path d="M50 70 Q60 80 70 70" stroke="#7a2e00" stroke-width="4" fill="none" stroke-linecap="round" />`;
  return html`<svg class="mascot" width=${size} height=${size} viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <radialGradient id="pipBody" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffd36b" /><stop offset="1" stop-color="#ff9a3c" /></radialGradient>
      <linearGradient id="pipBelly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dc" /><stop offset="1" stop-color="#ffe2a8" /></linearGradient>
    </defs>
    <ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(60,50,140,0.18)" />
    <path d="M22 66 Q8 60 12 46 Q24 54 30 60z" fill="#ff8a2a" />
    <path d="M98 66 Q112 60 108 46 Q96 54 90 60z" fill="#ff8a2a" />
    <circle cx="60" cy="62" r="42" fill="url(#pipBody)" />
    <ellipse cx="60" cy="78" rx="26" ry="22" fill="url(#pipBelly)" />
    <path d="M48 22 Q52 8 60 14 Q66 4 72 20" fill="#ff8a2a" />
    <path d="M20 52 A40 40 0 0 1 100 52" stroke="#5b6cff" stroke-width="7" fill="none" stroke-linecap="round" />
    <rect x="12" y="46" width="16" height="24" rx="8" fill="#5b6cff" />
    <rect x="92" y="46" width="16" height="24" rx="8" fill="#5b6cff" />
    <circle cx="46" cy="55" r="11" fill="#fff" /><circle cx="74" cy="55" r="11" fill="#fff" />
    <circle cx="48" cy="57" r="6" fill="#2b2160" /><circle cx="72" cy="57" r="6" fill="#2b2160" />
    <circle cx="50" cy="54" r="2.2" fill="#fff" /><circle cx="74" cy="54" r="2.2" fill="#fff" />
    <path d="M55 64 L65 64 L60 70z" fill="#ff6a3d" />
    ${mouth}
    <circle cx="36" cy="70" r="5" fill="#ff7aa8" opacity=".55" /><circle cx="84" cy="70" r="5" fill="#ff7aa8" opacity=".55" />
  </svg>`;
}

export function Speech({ children, size = 96, mood }) {
  return html`<div class="mascot-row"><${Mascot} size=${size} mood=${mood} /><div class="bubble">${children}</div></div>`;
}

export function Modal({ children, onClose, wide }) {
  return html`<div class="scrim" onClick=${(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
    <div class=${'modal' + (wide ? ' wide' : '')}>${children}</div>
  </div>`;
}

export function Switch({ on, onChange }) {
  return html`<div class=${'switch' + (on ? ' on' : '')} role="switch" aria-checked=${on} onClick=${() => onChange(!on)}></div>`;
}

export function Segmented({ value, options, onChange }) {
  return html`<div class="segmented">${options.map((o) => html`<button class=${o.value === value ? 'on' : ''} onClick=${() => onChange(o.value)}>${o.label}</button>`)}</div>`;
}

export function Logo({ size = 64 }) {
  return html`<svg class="logo-mark" width=${size} height=${size} viewBox="0 0 64 64">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ee7f9" /><stop offset=".55" stop-color="#818cf8" /><stop offset="1" stop-color="#c084fc" /></linearGradient></defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="#0d1026" stroke="url(#lg)" stroke-width="2.5" />
    <rect x="13" y="12" width="7" height="22" rx="3.5" fill="url(#lg)" opacity=".55" />
    <rect x="28.5" y="8" width="7" height="30" rx="3.5" fill="url(#lg)" />
    <rect x="44" y="16" width="7" height="18" rx="3.5" fill="url(#lg)" opacity=".75" />
    <rect x="10" y="40" width="44" height="14" rx="4" fill="#f4f5fb" />
    <rect x="20.5" y="40" width="1.5" height="14" fill="#c8cbe0" /><rect x="31.25" y="40" width="1.5" height="14" fill="#c8cbe0" /><rect x="42" y="40" width="1.5" height="14" fill="#c8cbe0" />
    <rect x="17" y="40" width="6" height="8" rx="1.5" fill="#1a1c2c" /><rect x="39" y="40" width="6" height="8" rx="1.5" fill="#1a1c2c" />
    <rect x="28.5" y="40" width="7" height="14" rx="2" fill="url(#lg)" />
  </svg>`;
}

// ---- Toasts --------------------------------------------------------------------------------------------

let pushToast = null;
export function toast(text, ms = 2200) { pushToast && pushToast(text, ms); }
export function ToastHost() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let timer;
    pushToast = (text, ms) => { setMsg({ text, id: Math.random() }); clearTimeout(timer); timer = setTimeout(() => setMsg(null), ms); };
    return () => { pushToast = null; clearTimeout(timer); };
  }, []);
  return msg ? html`<div class="toast" key=${msg.id}>${msg.text}</div>` : null;
}

// ---- Confetti ---------------------------------------------------------------------------------------------

export function Confetti({ run = true, count = 140 }) {
  const ref = useRef();
  useEffect(() => {
    if (!run) return;
    const c = ref.current;
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#ff4d6d', '#ffc93c', '#6ee7f9', '#a78bfa', '#4ade80', '#ff9f1c', '#ff5bc8'];
    const parts = Array.from({ length: count }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 900, vy: -300 - Math.random() * 600, r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let last = performance.now(), raf, alive = true;
    const step = (now) => {
      const dt = Math.min(0.04, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      let any = false;
      for (const p of parts) {
        p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        if (p.y < innerHeight + 20) any = true;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (any && alive) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [run]);
  return html`<canvas ref=${ref} style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60"></canvas>`;
}
