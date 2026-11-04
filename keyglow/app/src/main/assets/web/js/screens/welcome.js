// Who is playing? Pick a profile or make one (kids or adult).

import { html, useState } from '../vendor/preact-htm.js';
import { profiles, AVATARS } from '../game/progress.js';
import { setProfile, nav } from '../app.js';
import { Logo, Mascot } from '../ui/components.js';
import { sfx } from '../audio/engine.js';

export function Welcome({ adding = false }) {
  const list = profiles.list();
  const [creating, setCreating] = useState(adding || list.length === 0);
  if (creating) return html`<${CreateProfile} onCancel=${list.length ? () => setCreating(false) : null} />`;
  return html`<div class="screen scroll"><div class="welcome">
    <div class="logo-row"><${Logo} size=${64} /><div class="logo-word">Keyglow</div></div>
    <div class="tagline">Who’s playing today?</div>
    <div class="profiles">
      ${list.map((p) => html`<button class="profile-bubble" onClick=${() => { sfx.tap(); setProfile(p); nav.reset('home'); }}>
        <div class="av" style=${p.mode === 'kids' ? 'background:linear-gradient(160deg,#ffe08a,#ff9bd0)' : ''}>${p.avatar}</div>
        <div class="name">${p.name}</div>
        <div class="mode">${p.mode === 'kids' ? 'Kids mode' : 'Adult mode'}</div>
      </button>`)}
      <button class="profile-bubble add" onClick=${() => setCreating(true)}><div class="av">+</div><div class="name">Add player</div><div class="mode"> </div></button>
    </div>
  </div></div>`;
}

function CreateProfile({ onCancel }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('adult');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const create = () => {
    const p = profiles.create({ name: name.trim() || (mode === 'kids' ? 'Little pianist' : 'Pianist'), avatar, mode });
    sfx.complete();
    setProfile(p);
    nav.reset('home', { first: true });
  };
  return html`<div class="screen scroll"><div class="welcome" style="gap:18px">
    <div class="logo-row"><${Logo} size=${52} /><div class="logo-word" style="font-size:40px">Keyglow</div></div>
    <div class="tagline" style="margin:0">Learn the keyboard, one glowing note at a time.</div>
    <div class="mode-cards">
      <button class=${'mode-card kids' + (mode === 'kids' ? ' on' : '')} onClick=${() => { setMode('kids'); if (avatar === AVATARS[0]) setAvatar('🦊'); }}>
        <div class="row"><${Mascot} size=${70} /><div><h3 style="font-family:Fredoka">Kids mode</h3><div>Bright colours, Pip the bird, big buttons, gentle scoring and stickers.</div></div></div>
      </button>
      <button class=${'mode-card adult' + (mode === 'adult' ? ' on' : '')} onClick=${() => setMode('adult')}>
        <div class="row"><div class="big-emoji">🎹</div><div><h3>Adult mode</h3><div style="color:#9aa3c7">A sleek look, timing scores, every song open, deeper practice tools.</div></div></div>
      </button>
    </div>
    <input class="text-input" placeholder="Your name" value=${name} maxlength="20" onInput=${(e) => setName(e.target.value)} />
    <div class="avatar-pick">${AVATARS.map((a) => html`<button class=${a === avatar ? 'on' : ''} onClick=${() => setAvatar(a)}>${a}</button>`)}</div>
    <div class="row" style="margin-top:8px">
      ${onCancel ? html`<button class="btn ghost" onClick=${onCancel}>Back</button>` : null}
      <button class="btn big" onClick=${create}>Let’s play</button>
    </div>
  </div></div>`;
}
