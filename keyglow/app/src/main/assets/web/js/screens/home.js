// Home: greeting, level, streak, today's goal, "continue" and the main sections.

import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { useApp, nav, effectiveInput } from '../app.js';
import { levelInfo, levelTitle, liveStreak, todaySeconds, nextLesson, ACHIEVEMENTS } from '../game/progress.js';
import { Ring, Speech, IconButton, Stars } from '../ui/components.js';
import { midiDevices, onMidiDevices } from '../input.js';
import { calibration } from '../audio/mic.js';
import { songById } from '../music/songs.js';

const KID_LINES = [
  'Ready to make some music? 🎶', 'Let’s find some new notes today!', 'Your fingers are getting so clever!',
  'I love it when you play! 🐦', 'Every day you practise, you get better!', 'Shall we play a song together?',
];

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function Home({ first }) {
  const { profile: p, settings } = useApp();
  const [, setDevices] = useState(midiDevices());
  useEffect(() => onMidiDevices(setDevices), []);
  if (!p) { nav.reset('welcome'); return null; }
  const kids = p.mode === 'kids';
  const lv = levelInfo(p.xp);
  const streak = liveStreak(p);
  const mins = Math.floor(todaySeconds(p) / 60);
  const next = nextLesson(p);
  const totalStars = Object.values(p.lessons).reduce((a, l) => a + (l.stars || 0), 0) + Object.values(p.songs).reduce((a, s) => a + (s.stars || 0), 0);
  const input = effectiveInput(settings);
  const cal = calibration();
  const recent = Object.entries(p.songs).filter(([, s]) => s.last).sort((a, b) => b[1].last - a[1].last).slice(0, 4).map(([id]) => songById(id)).filter(Boolean);

  const tiles = [
    { id: 'path', icon: '🗺️', t: kids ? 'Adventure' : 'Course', d: kids ? 'Step by step' : 'Guided lessons', color: '#ffd8c2' },
    { id: 'songs', icon: '🎵', t: 'Songs', d: kids ? 'Play your favourites' : 'Library & your imports', color: '#d9f5c7' },
    { id: 'practice', icon: '🏋️', t: 'Practice', d: 'Scales, chords, reading', color: '#d6dcff' },
    { id: 'freeplay', icon: '✨', t: 'Free play', d: 'Just play — see it glow', color: '#ffe3f4' },
    { id: 'import', icon: '📥', t: 'Import MP3', d: 'Learn any piano track', color: '#d2f6f3' },
    { id: 'calibrate', icon: '🎙️', t: 'Calibrate', d: cal ? 'Tuned to your keyboard ✓' : 'Teach me your keyboard', color: '#fff1c2' },
  ];

  return html`<div class="screen scroll"><div class="page">
    <div class="home-head">
      <button class="avatar" onClick=${() => nav.go('profile')}>${p.avatar}</button>
      <div style="flex:1;min-width:0">
        <div class="hello">${greeting()}, ${p.name}</div>
        <div class="row" style="margin-top:6px">
          <div class="level-pill"><div class="lv">${lv.level}</div>${levelTitle(lv.level, kids)}<div class="xpbar"><div style=${{ width: lv.progress * 100 + '%' }}></div></div></div>
        </div>
      </div>
      <div class="stat-pills">
        <div class="stat" title="Day streak">🔥 ${streak}</div>
        <div class="stat" title="Stars">⭐ ${totalStars}</div>
      </div>
      <${IconButton} icon="settings" title="Settings" onClick=${() => nav.go('settings')} />
    </div>

    ${kids ? html`<div style="margin:6px 0 18px"><${Speech} size=${88}>${first ? `Hi ${p.name}! I’m Pip. Let’s learn the piano together!` : KID_LINES[new Date().getDate() % KID_LINES.length]}</${Speech}></div>` : null}

    <div class="hero">
      <div class="card hero-card" onClick=${() => nav.go('lesson', { id: next.id })}>
        <div class="glow"></div>
        <div>
          <div class="eyebrow" style=${kids ? 'color:#7a3300' : ''}>${p.lessons[next.id]?.done ? 'Play again' : Object.keys(p.lessons).length ? 'Continue' : 'Start here'}</div>
          <h3>${kids ? next.kidsTitle || next.title : next.title}</h3>
          <div class="unit">${next.unit.icon} ${kids ? next.unit.kidsTitle : next.unit.title}</div>
        </div>
        <div class="row"><button class="btn ${kids ? 'blue' : ''}">▶ ${kids ? 'Let’s go!' : 'Start lesson'}</button><span class="spacer"></span><${Stars} n=${p.lessons[next.id]?.stars || 0} size=${24} /></div>
      </div>
      <div class="card goal-card">
        <${Ring} value=${mins / p.goalMinutes} size=${120} stroke=${12} color=${kids ? '#3dbb5c' : 'var(--accent)'}>
          <div><div style="font-size:30px">${mins}</div><div class="muted" style="font-size:13px">of ${p.goalMinutes} min</div></div>
        </${Ring}>
        <div>
          <div class="eyebrow">Today’s goal</div>
          <div style="font-size:22px;font-weight:700;margin:4px 0 8px">${mins >= p.goalMinutes ? (kids ? 'Goal done! 🎉' : 'Goal reached') : `${p.goalMinutes - mins} min to go`}</div>
          <div class="muted" style="font-size:14px">${input === 'midi' ? `🎹 ${midiDevices()[0]}` : input === 'mic' ? `🎙️ Listening with the microphone${cal ? ' · calibrated' : ''}` : '👆 On-screen keys'}</div>
        </div>
      </div>
    </div>

    <h2>${kids ? 'What shall we do?' : 'Explore'}</h2>
    <div class="tiles">
      ${tiles.map((t) => html`<div class="card tile tap" style=${{ '--tile-color': t.color }} onClick=${() => nav.go(t.id)}>
        <div class="ti">${t.icon}</div>
        <div><div class="tt">${t.t}</div><div class="td">${t.d}</div></div>
      </div>`)}
    </div>

    ${recent.length ? html`<h2>Played recently</h2>
      <div class="row wrap">${recent.map((s) => html`<button class="chip" onClick=${() => nav.go('songs', { open: s.id })}>${s.emoji} ${s.title} <${Stars} n=${p.songs[s.id].stars} size=${13} /></button>`)}</div>` : null}

    ${Object.keys(p.achievements).length ? html`<h2>${kids ? 'Your stickers' : 'Recent achievements'}</h2>
      <div class="row wrap">${Object.entries(p.achievements).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        return a ? html`<div class="badge">${a.icon} ${a.title}</div>` : null;
      })}</div>` : null}
  </div></div>`;
}
