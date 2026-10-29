// Injected into every page the TV browser (WebActivity) opens: moves focus between links and
// buttons with the remote's arrows, shows a gold focus ring, and gives videos simple controls.
// Pages that handle an arrow key themselves (slide decks call preventDefault) keep it.
// OK on a video, or on a "Play" button, plays the video full screen with sound; Back leaves full screen.
// A page can name what to select first with data-tv-focus (or autofocus).
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
      if (getComputedStyle(el).cursor !== "pointer" || el.parentElement.closest(FOCUSABLE)) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 16 && r.height >= 16) list.push(el); // not thin bars (a video's progress bar)
    }
    return list.filter(shown);
  }
  // A header that stays on screen while the page scrolls (position fixed or sticky).
  function pinned(el) {
    for (let x = el; x && x !== document.body; x = x.parentElement) {
      const p = getComputedStyle(x).position;
      if (p === "fixed" || p === "sticky") return x;
    }
    return null;
  }
  const onScreen = (r) => r.bottom > 0 && r.top < innerHeight;

  function select(el, scroll = true) {
    if (!el.matches("a[href], button, input, select, textarea, summary, [tabindex]")) el.tabIndex = -1;
    el.focus({ preventScroll: true });
    // A video without controls can't take focus until it has a tabindex.
    if (document.activeElement !== el) { el.tabIndex = -1; el.focus({ preventScroll: true }); }
    if (!scroll || pinned(el)) return;
    // Keep the selection away from the screen's edges, so what comes next is in view too.
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.12 || r.bottom > innerHeight * 0.88) {
      el.scrollIntoView({ block: r.height > innerHeight * 0.7 ? "start" : "center", inline: "nearest", behavior: "smooth" });
    }
  }

  // Where the selection was, so it can come back when the page redraws (a new slide, Example 2, a speed button).
  let last = null;
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el === document.body || el === document.documentElement) return;
    const r = el.getBoundingClientRect();
    last = { el, x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY, tag: el.tagName, text: (el.textContent || "").trim().slice(0, 60) };
  });
  function current() {
    const a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement && a.isConnected) return a;
    if (!last) return null;
    if (last.el.isConnected && shown(last.el)) { select(last.el, false); return last.el; }
    // The same control in the new content, or else whatever is nearest to where it was.
    let best = null, bestScore = Infinity;
    for (const el of candidates()) {
      const r = el.getBoundingClientRect();
      let score = Math.hypot(r.left + r.width / 2 + scrollX - last.x, r.top + r.height / 2 + scrollY - last.y);
      if (el.tagName === last.tag && (el.textContent || "").trim().slice(0, 60) === last.text) score -= 1e4;
      if (!onScreen(r)) score += 5e4; // a ring you can't see is no help: prefer what is on screen
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) select(best, false);
    return best;
  }

  // What to select when a page (or a route of a one-page app) opens: the page's choice, else the first thing in its content.
  function selectFirst() {
    const items = candidates();
    const named = items.find((el) => el.matches("[data-tv-focus], [autofocus]"));
    const main = document.querySelector("main, [role='main'], #view, #app");
    const inMain = main && items.filter((el) => main.contains(el) && onScreen(el.getBoundingClientRect()));
    const pick = named || (inMain && inMain[0]) || items.find((el) => onScreen(el.getBoundingClientRect()));
    if (pick) select(pick);
    return pick;
  }
  function selectFirstSoon() {
    last = null;
    // One-page apps draw the new route a moment later; select only if the user hasn't moved meanwhile.
    for (const ms of [250, 800, 1600]) {
      setTimeout(() => {
        const a = document.activeElement;
        if (!a || a === document.body || !a.isConnected || !shown(a)) selectFirst();
      }, ms);
    }
  }
  addEventListener("hashchange", selectFirstSoon);
  addEventListener("popstate", selectFirstSoon);
  selectFirstSoon();

  // The nearest control in that direction. Things in the same row (or column) come first; distance is
  // measured between edges, so a big video or card is reached as easily as a small button.
  function move(dir) {
    const cur = current();
    if (!cur) { if (!selectFirst()) scrollPage(dir); return; }
    let a = cur.getBoundingClientRect();
    // Scrolled away from the selection (reading): start from the edge of the screen, and the
    // selection itself is a place to go back to.
    const away = a.bottom < 0 || a.top > innerHeight;
    if (a.bottom < 0) a = { left: a.left, right: a.right, top: -2, bottom: -1 };
    else if (a.top > innerHeight) a = { left: a.left, right: a.right, top: innerHeight + 1, bottom: innerHeight + 2 };
    const curBar = pinned(cur);
    let best = null, bestScore = Infinity, bestGap = 0;
    for (const el of candidates()) {
      if (el === cur ? !away : el.contains(cur) || cur.contains(el)) continue;
      // From the page, a pinned header is only reached with Up, when nothing else is above.
      const bar = !curBar && pinned(el);
      if (bar && dir !== "up") continue;
      const b = el.getBoundingClientRect();
      let gap, off, ok;
      if (dir === "down" || dir === "up") {
        ok = dir === "down" ? b.top >= a.top + 4 && b.bottom > a.bottom : b.bottom <= a.bottom - 4 && b.top < a.top;
        gap = dir === "down" ? b.top - a.bottom : a.top - b.bottom;
        off = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
      } else {
        ok = dir === "right" ? b.left >= a.left + 4 && b.right > a.right : b.right <= a.right - 4 && b.left < a.left;
        gap = dir === "right" ? b.left - a.right : a.left - b.right;
        off = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
      }
      if (!ok) continue;
      gap = Math.max(0, gap);
      const along = dir === "down" || dir === "up" ? Math.abs(b.left - a.left) : Math.abs(b.top + b.height / 2 - a.top - a.height / 2);
      const score = gap + off * 3 + (off > 0 ? 40 : 0) + along * 0.05 + (bar ? 1e5 : 0);
      if (score < bestScore) { bestScore = score; best = el; bestGap = gap; }
    }
    if (!best) { scrollPage(dir); return; }
    // Text between here and the next control: scroll through it first, so it can be read.
    const far = (dir === "down" || dir === "up") && bestGap > innerHeight * 0.5 && !onScreen(best.getBoundingClientRect());
    // Up reaches the pinned header only from the top of the page.
    if (far || bestScore >= 1e5 && scrollY > 0) { scrollPage(dir); return; }
    select(best);
  }
  function scrollPage(dir) {
    if (dir === "up" || dir === "down") scrollBy({ top: (dir === "down" ? 1 : -1) * innerHeight * 0.6, behavior: "smooth" });
  }

  // Left and Right jump 10 s, or a tenth of a short clip.
  function seek(v, key) {
    const step = isFinite(v.duration) ? Math.min(10, Math.max(1, v.duration / 10)) : 10;
    v.currentTime += key === "ArrowRight" ? step : -step;
  }

  // Full screen for the video that OK just started. Pages that start videos themselves (a new slide) stay as they are.
  let wantFull = 0;
  function fullScreen(v) {
    if (document.fullscreenElement || !v.requestFullscreen) return;
    v.muted = false;
    if (v.paused) v.play().catch(() => {});
    if (!v.hasAttribute("tabindex")) v.tabIndex = -1;
    v.focus({ preventScroll: true });
    v.requestFullscreen().catch(() => {});
  }
  // A page's own "Full screen" button: sound on, and the clip keeps playing.
  document.addEventListener("fullscreenchange", () => {
    const v = document.fullscreenElement;
    if (v && v.tagName === "VIDEO") { v.muted = false; if (v.paused) v.play().catch(() => {}); }
  });
  document.addEventListener("play", (e) => {
    if (e.target.tagName === "VIDEO" && Date.now() - wantFull < 3000) { wantFull = 0; fullScreen(e.target); }
  }, true);
  // The video a "Play" button belongs to: the nearest one in the button's surroundings.
  function videoNear(el) {
    for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
      const v = box.querySelector("video");
      if (v) return v;
    }
    return null;
  }

  // A full-screen video takes OK, Left and Right before the page does (Lab would change slide under it).
  window.addEventListener("keydown", (e) => {
    const v = document.fullscreenElement;
    if (!v || v.tagName !== "VIDEO") return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") seek(v, e.key);
    else if (e.key === "Enter") v.paused ? v.play().catch(() => {}) : v.pause();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  const DIRS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) {
      // The page used the key itself (e.g. next slide). If that redrew what was selected, select it again.
      setTimeout(current, 120);
      return;
    }
    const t = current();
    const typing = t && (t.isContentEditable || t.tagName === "TEXTAREA" ||
      (t.tagName === "INPUT" && !["button", "submit", "checkbox", "radio", "range"].includes(t.type)));
    if (typing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return; // move the caret
    if (t && t.tagName === "VIDEO") {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        seek(t, e.key);
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") { fullScreen(t); e.preventDefault(); return; }
    }
    if (DIRS[e.key]) { e.preventDefault(); move(DIRS[e.key]); return; }
    if (e.key !== "Enter" || !t) return;
    if (t.tagName === "BUTTON" && /^\W*play\b/i.test(t.textContent.trim()) && videoNear(t)) wantFull = Date.now();
    if (!t.matches("a[href], button, input, select, textarea, summary")) {
      e.preventDefault();
      t.click();
    }
    // A button that redraws its part of the page loses the selection: bring it back.
    setTimeout(current, 150);
    setTimeout(current, 600);
  });
})();
