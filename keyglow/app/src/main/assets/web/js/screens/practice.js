// Practice: exercises with options (key, hands, …), note reading and ear training.

import { html, useState } from '../vendor/preact-htm.js';
import { useApp, nav } from '../app.js';
import { PRACTICE, KEYS } from '../music/exercises.js';
import { levelInfo } from '../game/progress.js';
import { IconButton, Modal, Segmented, Icon } from '../ui/components.js';

const EXTRA = [
  { id: 'read', title: 'Note reading', icon: '📖', kids: true, desc: 'A note on the staff — find it on the keys.', go: () => nav.go('quiz', { preset: 'trebleC', kind: 'read' }) },
  { id: 'ear', title: 'Ear training', icon: '👂', kids: true, desc: 'Hear a note, then find it.', go: () => nav.go('quiz', { kind: 'ear' }) },
  { id: 'free', title: 'Free play', icon: '✨', kids: true, desc: 'Play anything and watch it glow.', go: () => nav.go('freeplay') },
];

export function Practice() {
  const { profile: p } = useApp();
  const kids = p.mode === 'kids';
  const lvl = levelInfo(p.xp).level;
  const [open, setOpen] = useState(null);
  const items = PRACTICE.filter((x) => !kids || x.kids);
  return html`<div class="screen scroll">
    <div class="topbar"><${IconButton} icon="back" title="Back" onClick=${() => nav.back()} /><h1>${kids ? 'Practice Gym' : 'Practice'}</h1></div>
    <div class="page">
      <div class="tiles">
        ${items.map((x) => html`<div class="card tile tap" onClick=${() => setOpen(x)}>
          <div class="ti">${x.icon}</div>
          <div><div class="tt">${x.title}</div><div class="td">${x.desc}${!kids && x.minLevel > lvl ? ' · suggested from level ' + x.minLevel : ''}</div></div>
        </div>`)}
        ${EXTRA.map((x) => html`<div class="card tile tap" onClick=${x.go}>
          <div class="ti">${x.icon}</div>
          <div><div class="tt">${x.title}</div><div class="td">${x.desc}</div></div>
        </div>`)}
      </div>
    </div>
    ${open ? html`<${ExerciseSheet} ex=${open} kids=${kids} onClose=${() => setOpen(null)} />` : null}
  </div>`;
}

function ExerciseSheet({ ex, kids, onClose }) {
  const [o, setO] = useState({ key: 'C', hands: 'R', type: 'major', minor: false, octaves: 1, broken: false, level: 1 });
  const set = (k, v) => setO({ ...o, [k]: v });
  const keys = kids ? KEYS.slice(0, 3) : KEYS;
  const start = () => {
    const song = ex.make(o);
    onClose();
    nav.go('player', { song, mode: 'wait', kind: 'exercise', id: song.id });
  };
  return html`<${Modal} onClose=${onClose}>
    <h2>${ex.icon} ${ex.title}</h2>
    <p class="muted">${ex.desc}</p>
    ${ex.options.includes('key') ? html`<div class="field"><div class="lbl">Key</div>
      <div class="row wrap">${keys.map((k) => html`<button class=${'chip' + (o.key === k.name ? ' on' : '')} onClick=${() => set('key', k.name)}>${k.name}</button>`)}</div></div>` : null}
    ${ex.options.includes('type') ? html`<div class="field"><div class="lbl">Scale</div>
      <${Segmented} value=${o.type} onChange=${(v) => set('type', v)} options=${[{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Natural minor' }, { value: 'harmonicMinor', label: 'Harmonic minor' }]} /></div>` : null}
    ${ex.options.includes('minor') ? html`<div class="field"><div class="lbl">Quality</div>
      <${Segmented} value=${o.minor ? 'm' : 'M'} onChange=${(v) => set('minor', v === 'm')} options=${[{ value: 'M', label: 'Major' }, { value: 'm', label: 'Minor' }]} /></div>` : null}
    ${ex.options.includes('hands') ? html`<div class="field"><div class="lbl">Hands</div>
      <${Segmented} value=${o.hands} onChange=${(v) => set('hands', v)} options=${[{ value: 'R', label: 'Right' }, { value: 'L', label: 'Left' }, { value: 'RL', label: 'Both' }]} /></div>` : null}
    ${ex.options.includes('octaves') ? html`<div class="field"><div class="lbl">Octaves</div>
      <${Segmented} value=${o.octaves} onChange=${(v) => set('octaves', v)} options=${[{ value: 1, label: 'One' }, { value: 2, label: 'Two' }]} /></div>` : null}
    ${ex.options.includes('broken') ? html`<div class="field"><div class="lbl">Style</div>
      <${Segmented} value=${o.broken ? 'b' : 's'} onChange=${(v) => set('broken', v === 'b')} options=${[{ value: 's', label: 'Block chords' }, { value: 'b', label: 'Broken chords' }]} /></div>` : null}
    ${ex.options.includes('level') ? html`<div class="field"><div class="lbl">Difficulty</div>
      <${Segmented} value=${o.level} onChange=${(v) => set('level', v)} options=${[{ value: 1, label: 'Easy' }, { value: 2, label: 'Medium' }, { value: 3, label: 'Hard' }]} /></div>` : null}
    <div class="row" style="justify-content:flex-end;margin-top:20px">
      <button class="btn ghost" onClick=${onClose}>Close</button>
      <button class="btn big" onClick=${start}><${Icon} name="play" /> Start</button>
    </div>
  </${Modal}>`;
}
