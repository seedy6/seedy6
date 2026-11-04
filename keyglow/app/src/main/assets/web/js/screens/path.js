// The course as a winding path of lessons, grouped in units.

import { html, useEffect, useRef } from '../vendor/preact-htm.js';
import { useApp, nav } from '../app.js';
import { COURSE } from '../music/course.js';
import { lessonUnlocked, nextLesson } from '../game/progress.js';
import { IconButton, Stars, Mascot } from '../ui/components.js';
import { toast } from '../ui/components.js';

export function Path() {
  const { profile: p } = useApp();
  const kids = p.mode === 'kids';
  const next = nextLesson(p);
  const currentRef = useRef();
  useEffect(() => { currentRef.current?.scrollIntoView({ block: 'center' }); }, []);
  let n = 0;
  return html`<div class="screen scroll">
    <div class="topbar"><${IconButton} icon="back" title="Back" onClick=${() => nav.back()} /><h1>${kids ? 'Piano Adventure' : 'Course'}</h1></div>
    <div class="page">
      ${COURSE.map((u) => {
        const done = u.lessons.filter((l) => p.lessons[l.id]?.done).length;
        return html`<div class="unit" style=${{ '--u': u.color }}>
          <div class="unit-head">
            <div class="ui">${u.icon}</div>
            <div style="flex:1"><h3>${kids ? u.kidsTitle : u.title}</h3><div class="sub">${done} of ${u.lessons.length} lessons</div></div>
          </div>
          <div class="lesson-path">
            ${u.lessons.map((l) => {
              n++;
              const rec = p.lessons[l.id];
              const open = lessonUnlocked(p, l.id);
              const isCurrent = l.id === next.id;
              const cls = 'lesson-node' + (rec?.done ? ' done' : '') + (isCurrent ? ' current' : '') + (!open ? ' locked' : '');
              const steps = l.steps.filter((s) => s.kind !== 'tip').length;
              return html`<div class=${cls} ref=${isCurrent ? currentRef : null}
                onClick=${() => (open ? nav.go('lesson', { id: l.id }) : toast(kids ? 'Finish the lesson before this one first! 🔒' : 'Finish the previous lesson to unlock this one'))}>
                <div class="dot">${rec?.done ? '✓' : open ? n : '🔒'}</div>
                <div class="info">
                  <div class="lt">${kids ? l.kidsTitle || l.title : l.title}</div>
                  <div class="ls">${steps} ${steps === 1 ? 'activity' : 'activities'} ${rec?.done ? html`· <${Stars} n=${rec.stars} size=${14} />` : ''}</div>
                </div>
                ${isCurrent && kids ? html`<${Mascot} size=${64} />` : null}
              </div>`;
            })}
          </div>
        </div>`;
      })}
    </div>
  </div>`;
}
