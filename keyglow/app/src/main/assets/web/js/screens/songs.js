// The song library: built-in songs by level, plus the person's own imports.

import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { useApp, nav } from '../app.js';
import { SONGS, songById } from '../music/songs.js';
import { compileSong, measureDifficulty } from '../music/notation.js';
import { songUnlocked, songUnlockLevel } from '../game/progress.js';
import { library } from '../store.js';
import { IconButton, Stars, Difficulty, Modal, Segmented, Icon, toast } from '../ui/components.js';

export function Songs({ open, tab: initialTab }) {
  const { profile: p } = useApp();
  const kids = p.mode === 'kids';
  const [tab, setTab] = useState(initialTab || 'library');
  const [level, setLevel] = useState(0);
  const [mine, setMine] = useState([]);
  const [selected, setSelected] = useState(open ? songById(open) : null);
  const reload = () => library.all().then(setMine);
  useEffect(() => { reload(); }, []);

  const list = SONGS.filter((s) => (!level || s.level === level) && (!kids || s.kids));
  return html`<div class="screen scroll">
    <div class="topbar">
      <${IconButton} icon="back" title="Back" onClick=${() => nav.back()} />
      <h1>Songs</h1>
      <${Segmented} value=${tab} onChange=${setTab} options=${[{ value: 'library', label: kids ? '🎵 Songs' : 'Library' }, { value: 'mine', label: `${kids ? '⭐ ' : ''}My songs${mine.length ? ` (${mine.length})` : ''}` }]} />
    </div>
    <div class="page">
      ${tab === 'library' ? html`
        <div class="row wrap" style="margin-bottom:18px">
          ${[0, 1, 2, 3, 4, 5].map((l) => html`<button class=${'chip' + (level === l ? ' on' : '')} onClick=${() => setLevel(l)}>${l === 0 ? 'All' : `Level ${l}`}</button>`)}
        </div>
        <div class="songs">${list.map((s) => {
          const open = songUnlocked(p, s);
          const rec = p.songs[s.id];
          return html`<div class=${'card song-card tap' + (open ? '' : ' locked')} onClick=${() => (open ? setSelected(s) : toast(`Reach level ${songUnlockLevel(s)} to unlock this song 🔒`))}>
            <div class="art" style=${{ background: `linear-gradient(140deg, ${s.color}, ${s.color}aa)` }}>${s.emoji}</div>
            <div style="min-width:0;flex:1">
              <div class="title">${s.title}</div>
              <div class="by">${s.composer}</div>
              <div class="meta"><${Difficulty} level=${s.level} />${rec ? html`<${Stars} n=${rec.stars} size=${14} />` : html`<span class="faint">New</span>`}</div>
            </div>
            ${open ? null : html`<div class="lock">🔒 Lv ${songUnlockLevel(s)}</div>`}
          </div>`;
        })}</div>` : html`
        <div class="songs">
          <div class="card song-card tap" onClick=${() => nav.go('import')}>
            <div class="art" style="background:linear-gradient(140deg,#6ee7f9,#a78bfa)"><${Icon} name="upload" size=${34} /></div>
            <div><div class="title">Import a song</div><div class="by">MP3 or other audio of piano, or a MIDI file</div></div>
          </div>
          ${mine.map((s) => {
            const rec = p.songs[s.id];
            return html`<div class="card song-card tap" onClick=${() => setSelected(s)}>
              <div class="art" style=${{ background: `linear-gradient(140deg, ${s.color || '#5b6cff'}, #22c3e6)` }}>${s.emoji || '🎧'}</div>
              <div style="min-width:0;flex:1">
                <div class="title">${s.title}</div>
                <div class="by">${s.source === 'midi' ? 'From a MIDI file' : 'From a recording'} · ${s.notes.length} notes</div>
                <div class="meta"><${Difficulty} level=${s.level || 3} />${rec ? html`<${Stars} n=${rec.stars} size=${14} />` : null}</div>
              </div>
            </div>`;
          })}
        </div>
        ${mine.length === 0 ? html`<p class="muted center" style="margin-top:30px">Songs you import will appear here.</p>` : null}`}
    </div>
    ${selected ? html`<${SongSheet} song=${selected} kids=${kids} rec=${p.songs[selected.id]} onClose=${() => setSelected(null)} onDeleted=${() => { setSelected(null); reload(); }} />` : null}
  </div>`;
}

function SongSheet({ song, kids, rec, onClose, onDeleted }) {
  const chart = compileSong(song);
  const [hands, setHands] = useState(chart.hands.length > 1 && kids ? ['R'] : chart.hands);
  const [mode, setMode] = useState('wait');
  const [tempo, setTempo] = useState(kids ? 0.8 : 1);
  const both = chart.hands.length > 1;
  const minutes = Math.max(1, Math.round(chart.length / 60));
  const go = () => {
    onClose();
    nav.go('player', { song, hands, mode, tempo, kind: 'song', id: song.id });
  };
  return html`<${Modal} onClose=${onClose}>
    <div class="row" style="align-items:flex-start;gap:18px">
      <div class="art" style=${{ width: '96px', height: '96px', borderRadius: '24px', display: 'grid', placeItems: 'center', fontSize: '50px', background: `linear-gradient(140deg, ${song.color || '#5b6cff'}, ${(song.color || '#5b6cff')}99)`, flex: 'none' }}>${song.emoji || '🎧'}</div>
      <div style="flex:1">
        <h2 style="margin:0 0 4px">${song.title}</h2>
        <div class="muted">${song.composer || (song.imported ? 'Imported' : '')}</div>
        <div class="row" style="margin-top:8px"><${Difficulty} level=${song.level || measureDifficulty(chart)} /><span class="muted">· ${chart.notes.length} notes · ~${minutes} min · ${chart.bpm} bpm</span></div>
        ${rec ? html`<div class="row" style="margin-top:6px"><${Stars} n=${rec.stars} /><span class="muted">Best ${Math.round(rec.best * 100)}% · ${rec.bestScore?.toLocaleString() || 0} pts</span></div>` : null}
      </div>
    </div>
    ${song.desc ? html`<p class="muted" style="font-size:17px">${song.desc}</p>` : null}
    <div class="field"><div class="lbl">Mode</div>
      <${Segmented} value=${mode} onChange=${setMode} options=${[{ value: 'wait', label: kids ? '🐢 Learn (waits for you)' : 'Learn — waits for you' }, { value: 'play', label: kids ? '⚡ Play' : 'Play — scored on timing' }, { value: 'listen', label: 'Listen' }]} />
    </div>
    ${both ? html`<div class="field"><div class="lbl">Hands</div>
      <${Segmented} value=${hands.length > 1 ? 'both' : hands[0]} onChange=${(v) => setHands(v === 'both' ? chart.hands : [v])} options=${[{ value: 'R', label: 'Right hand' }, { value: 'L', label: 'Left hand' }, { value: 'both', label: 'Both hands' }]} />
    </div>` : null}
    <div class="field"><div class="lbl">Speed: ${Math.round(tempo * 100)}%</div>
      <input type="range" min="0.4" max="1.25" step="0.05" value=${tempo} onInput=${(e) => setTempo(parseFloat(e.target.value))} style="width:100%;accent-color:var(--accent)" />
    </div>
    <div class="row" style="margin-top:20px">
      ${song.imported ? html`<button class="btn ghost small" onClick=${async () => { if (confirm(`Delete “${song.title}”?`)) { await library.remove(song.id); onDeleted(); } }}><${Icon} name="trash" size=${18} /> Delete</button>` : null}
      <span class="spacer"></span>
      <button class="btn ghost" onClick=${onClose}>Close</button>
      <button class="btn big" onClick=${go}><${Icon} name="play" /> ${kids ? 'Play!' : 'Start'}</button>
    </div>
  </${Modal}>`;
}
