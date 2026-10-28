// Injected into every page the TV browser (WebActivity) opens: moves focus between links and
// buttons with the remote's arrows, shows a gold focus ring, and gives videos simple controls.
// Pages that handle an arrow key themselves (slide decks call preventDefault) keep it.
(() => {
  if (window.__tvNav) return;
  window.__tvNav = true;

  const style = document.createElement("style");
  style.textContent = ":focus { outline: 4px solid #f2b84b !important; outline-offset: 3px !important;" +
    " box-shadow: 0 0 0 9px rgba(242, 184, 75, 0.3) !important; }";
  (document.head || document.documentElement).appendChild(style);

  const FOCUSABLE = "a[href], button, input, select, textarea, video, summary, [tabindex]:not([tabindex='-1']), [role='button'], [onclick]";
  const MAYBE = "div, li, span, img, label, td, tr, svg"; // clickable only if styled as such

  function shown(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && !el.disabled;
  }
  function candidates() {
    const list = [...document.querySelectorAll(FOCUSABLE)];
    for (const el of document.querySelectorAll(MAYBE)) {
      if (getComputedStyle(el).cursor === "pointer" && !el.parentElement.closest(FOCUSABLE)) list.push(el);
    }
    return list.filter(shown);
  }
  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function move(dir) {
    const items = candidates();
    const cur = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    let best = null, bestScore = Infinity;
    if (!cur) {
      // Nothing focused yet: start with the first thing on screen.
      best = items.find((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }) || items[0];
    } else {
      const a = center(cur.getBoundingClientRect());
      for (const el of items) {
        if (el === cur || el.contains(cur) || cur.contains(el)) continue;
        const b = center(el.getBoundingClientRect());
        const dx = b.x - a.x, dy = b.y - a.y;
        const along = { left: -dx, right: dx, up: -dy, down: dy }[dir];
        if (along <= 2) continue;
        const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
        const score = along + across * 2.5;
        if (score < bestScore) { bestScore = score; best = el; }
      }
    }
    if (!best) {
      // Nothing further that way: scroll instead, so long pages can still be read.
      if (dir === "up" || dir === "down") scrollBy({ top: (dir === "down" ? 1 : -1) * innerHeight * 0.6, behavior: "smooth" });
      return;
    }
    if (!best.matches("a[href], button, input, select, textarea, video, summary, [tabindex]")) best.tabIndex = -1;
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  const DIRS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return; // the page used the key itself (e.g. next slide)
    const t = document.activeElement;
    const typing = t && (t.isContentEditable || t.tagName === "TEXTAREA" ||
      (t.tagName === "INPUT" && !["button", "submit", "checkbox", "radio", "range"].includes(t.type)));
    if (typing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return; // move the caret
    if (t && t.tagName === "VIDEO") {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        t.currentTime += e.key === "ArrowRight" ? 10 : -10;
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") { t.paused ? t.play() : t.pause(); e.preventDefault(); return; }
    }
    if (DIRS[e.key]) { e.preventDefault(); move(DIRS[e.key]); return; }
    if (e.key === "Enter" && t && t !== document.body && !t.matches("a[href], button, input, select, textarea, summary")) {
      e.preventDefault();
      t.click();
    }
  });
})();
