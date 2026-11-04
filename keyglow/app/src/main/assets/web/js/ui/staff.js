// A five-line staff with one note on it, drawn in SVG (for note-reading quizzes).

import { html } from '../vendor/preact-htm.js';
import { pitchClass, octaveOf } from '../music/theory.js';

const LETTER_STEP = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
const diatonic = (midi) => {
  const pc = pitchClass(midi);
  const step = LETTER_STEP[pc] ?? LETTER_STEP[pc - 1];
  return octaveOf(midi) * 7 + step;
};

const TREBLE_BOTTOM = diatonic(64); // E4 on the bottom line
const BASS_BOTTOM = diatonic(43);   // G2 on the bottom line

export function Staff({ midi, clef = 'treble', width = 360, color = '#2b2160', noteColor, sharp = false }) {
  const gap = 18;
  const top = 60;
  const lines = [0, 1, 2, 3, 4].map((i) => top + i * gap);
  const bottomStep = clef === 'treble' ? TREBLE_BOTTOM : BASS_BOTTOM;
  const bottomY = top + 4 * gap;
  const step = midi != null ? diatonic(midi) : null;
  const y = step != null ? bottomY - (step - bottomStep) * (gap / 2) : null;
  const x = width * 0.62;
  const ledgers = [];
  if (step != null) {
    for (let s = bottomStep - 2; s >= step; s -= 2) ledgers.push(bottomY - (s - bottomStep) * (gap / 2));
    for (let s = bottomStep + 10; s <= step; s += 2) ledgers.push(bottomY - (s - bottomStep) * (gap / 2));
  }
  const h = top * 2 + 4 * gap;
  return html`<svg width=${width} height=${h} viewBox=${`0 0 ${width} ${h}`}>
    ${lines.map((ly) => html`<line x1="10" x2=${width - 10} y1=${ly} y2=${ly} stroke=${color} stroke-width="2" />`)}
    ${clef === 'treble' ? html`<g transform=${`translate(22 ${top - 26})`} fill="none" stroke=${color} stroke-width="4" stroke-linecap="round">
        <path d="M26 118 Q14 120 14 108 Q14 98 26 98 Q36 98 36 110 L30 6 Q30 -6 40 2 Q48 14 30 36 Q4 62 8 84 Q12 100 30 100 Q50 100 50 84 Q50 70 34 70 Q22 70 22 82" />
      </g>` : html`<g transform=${`translate(22 ${top - 4})`} fill=${color} stroke=${color} stroke-width="4" stroke-linecap="round">
        <path d="M6 14 Q8 0 22 0 Q42 0 42 22 Q42 50 8 70" fill="none" />
        <circle cx="10" cy="14" r="6" stroke="none" />
        <circle cx="52" cy="10" r="3.5" stroke="none" /><circle cx="52" cy="28" r="3.5" stroke="none" />
      </g>`}
    ${ledgers.map((ly) => html`<line x1=${x - 22} x2=${x + 22} y1=${ly} y2=${ly} stroke=${color} stroke-width="2" />`)}
    ${y != null ? html`<g>
      ${sharp ? html`<text x=${x - 34} y=${y + 8} font-size="28" fill=${noteColor || color}>♯</text>` : null}
      <ellipse cx=${x} cy=${y} rx="12" ry="9" transform=${`rotate(-20 ${x} ${y})`} fill=${noteColor || color} />
      <line x1=${step >= bottomStep + 4 ? x - 11 : x + 11} x2=${step >= bottomStep + 4 ? x - 11 : x + 11} y1=${y} y2=${step >= bottomStep + 4 ? y + 54 : y - 54} stroke=${noteColor || color} stroke-width="2.5" />
    </g>` : null}
  </svg>`;
}
