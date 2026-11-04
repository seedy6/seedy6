// A player's progress: level, totals, practice history and achievements.

import { html } from '../vendor/preact-htm.js';
import { useApp, nav } from '../app.js';
import { levelInfo, levelTitle, ACHIEVEMENTS, liveStreak } from '../game/progress.js';
import { allLessons } from '../music/course.js';
import { IconButton, Ring } from '../ui/components.js';

export function Profile() {
  const { profile: p } = useApp();
  const kids = p.mode === 'kids';
  const lv = levelInfo(p.xp);
  const lessons = allLessons();
  const done = lessons.filter((l) => p.lessons[l.id]?.done).length;
  const stars = Object.values(p.lessons).reduce((a, l) => a + l.stars, 0) + Object.values(p.songs).reduce((a, s) => a + s.stars, 0);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push({ d, m: Math.round((p.days[d] || 0) / 60) });
  }
  const maxM = Math.max(p.goalMinutes, ...days.map((x) => x.m));
  return html`<div class="screen scroll">
    <div class="topbar"><${IconButton} icon="back" title="Back" onClick=${() => nav.back()} /><h1>${p.avatar} ${p.name}</h1>
      <button class="btn small ghost" onClick=${() => nav.reset('welcome')}>Switch player</button></div>
    <div class="page">
      <div class="hero">
        <div class="card pad row" style="gap:26px">
          <${Ring} value=${lv.progress} size=${140} stroke=${14}><div><div style="font-size:42px">${lv.level}</div><div class="muted" style="font-size:13px">LEVEL</div></div></${Ring}>
          <div>
            <div style="font-size:28px;font-weight:700">${levelTitle(lv.level, kids)}</div>
            <div class="muted" style="margin:6px 0">${p.xp - lv.from} / ${lv.to - lv.from} XP to level ${lv.level + 1}</div>
            <div class="row wrap" style="margin-top:12px">
              <div class="stat">🔥 ${liveStreak(p)} day streak</div>
              <div class="stat">⭐ ${stars}</div>
            </div>
          </div>
        </div>
        <div class="card pad">
          <div class="eyebrow">Last two weeks (minutes)</div>
          <div style="display:flex;align-items:flex-end;gap:6px;height:130px;margin-top:14px">
            ${days.map((x) => html`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
              <div style=${{ width: '100%', height: Math.max(3, (x.m / maxM) * 100) + 'px', borderRadius: '6px', background: x.m >= p.goalMinutes ? 'var(--good)' : 'var(--accent)', opacity: x.m ? 1 : 0.25 }}></div>
              <div class="faint" style="font-size:11px">${new Date(x.d).toLocaleDateString(undefined, { weekday: 'narrow' })}</div>
            </div>`)}
          </div>
        </div>
      </div>
      <div class="tiles" style="margin-top:18px">
        <div class="card tile"><div class="ti">🎓</div><div><div class="tt">${done} / ${lessons.length}</div><div class="td">Lessons finished</div></div></div>
        <div class="card tile"><div class="ti">🎵</div><div><div class="tt">${Object.keys(p.songs).length}</div><div class="td">Songs played</div></div></div>
        <div class="card tile"><div class="ti">⌛</div><div><div class="tt">${Math.round(p.totalSeconds / 60)} min</div><div class="td">Total practice</div></div></div>
        <div class="card tile"><div class="ti">🏆</div><div><div class="tt">${p.streak.best || 0} days</div><div class="td">Best streak</div></div></div>
      </div>
      <h2>${kids ? 'Sticker book' : 'Achievements'} · ${Object.keys(p.achievements).length} / ${ACHIEVEMENTS.length}</h2>
      <div class="tiles">
        ${ACHIEVEMENTS.map((a) => {
          const got = p.achievements[a.id];
          return html`<div class="card tile" style=${got ? '' : 'opacity:.4;filter:grayscale(1)'}>
            <div class="ti">${a.icon}</div><div><div class="tt">${a.title}</div><div class="td">${a.desc}</div></div>
          </div>`;
        })}
      </div>
    </div>
  </div>`;
}
