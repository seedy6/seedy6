// The "Welcome, Saeed" opening sequences, plus the ambient particles behind the home screen.
// Each builder draws into the intro element and schedules its beats with at(ms, fn), so the same
// timeline can drive the screen live or be replayed offline to render the soundtrack for a video.
const Intro = (() => {
  const el = () => document.getElementById("intro");
  let timers = [], finish = null;

  function scramble(node, text, duration) {
    if (!node.isConnected) return;
    const glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#/<>";
    const start = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const settled = Math.floor(p * text.length);
      let out = text.slice(0, settled);
      for (let i = settled; i < text.length; i++) out += text[i] === " " ? " " : glyphs[(Math.random() * glyphs.length) | 0];
      node.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }

  function blips(at, from, duration, count) {
    for (let i = 0; i < count; i++) at(from + (duration / count) * i, () => Sfx.blip());
  }

  function shake(root) {
    root.classList.remove("shake");
    void root.offsetWidth;
    root.classList.add("shake");
  }

  // Original artwork, kept abstract: a wireframe Spartan helmet with only its visor lit.
  // Feng Wei's side is brush calligraphy, pre-rendered from art/fengwei-ink.html into web/art.
  const HELMET_FACETS = "M300 56 L 218 68 L 156 116 L 126 196 L 124 288 L 116 384 L 160 446 L 204 424 " +
    "L 216 448 L 300 480 L 384 448 L 396 424 L 440 446 L 484 384 L 476 288 L 474 196 L 444 116 L 382 68 Z " +
    "M300 56 L 300 220 M218 68 L 182 120 L 148 236 M382 68 L 418 120 L 452 236 M124 288 L 168 350 L 204 424 " +
    "M476 288 L 432 350 L 396 424 M200 356 L 216 448 M400 356 L 384 448 M300 376 L 300 480 " +
    "M98 318 L 124 304 M98 318 L 102 380 L 116 384 M502 318 L 476 304 M502 318 L 498 380 L 484 384 " +
    "M246 452 L 228 528 M354 452 L 372 528 M228 528 L 372 528 M196 492 L 92 520 L 34 590 L 20 700 " +
    "M404 492 L 508 520 L 566 590 L 580 700 M196 492 L 236 520 L 222 700 M404 492 L 364 520 L 378 700";

  const SPARTAN_SVG = `
    <svg class="helm" viewBox="0 0 600 700" aria-hidden="true">
      <defs>
        <linearGradient id="visor" x1="0" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#ffe6a3"/><stop offset="0.28" stop-color="#e79a2c"/><stop offset="0.62" stop-color="#6e2f06"/><stop offset="1" stop-color="#120601"/></linearGradient>
        <linearGradient id="gleam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <linearGradient id="wire" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fe9ff" stop-opacity="0.15"/><stop offset="0.6" stop-color="#7fe9ff" stop-opacity="0.6"/><stop offset="1" stop-color="#7fe9ff" stop-opacity="0.9"/></linearGradient>
        <clipPath id="visorClip"><path d="M148 236 L 300 220 L 452 236 L 466 296 L 432 350 L 300 372 L 168 350 L 134 296 Z"/></clipPath>
      </defs>
      <path class="wire" fill="none" stroke="url(#wire)" stroke-width="1.6" stroke-linejoin="round" d="${HELMET_FACETS}"/>
      <path class="visor" fill="url(#visor)" d="M148 236 L 300 220 L 452 236 L 466 296 L 432 350 L 300 372 L 168 350 L 134 296 Z"/>
      <path fill="#fff6dc" fill-opacity="0.75" d="M160 246 L 300 231 L 392 236 L 300 240 L 176 256 Z"/>
      <g clip-path="url(#visorClip)"><rect class="gleam" x="-260" y="180" width="90" height="240" fill="url(#gleam)" transform="skewX(-28)"/></g>
    </svg>`;

  let grainUrl = null;
  function grain() {
    if (grainUrl) return grainUrl;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d"), img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 26;
    }
    g.putImageData(img, 0, 0);
    return (grainUrl = c.toDataURL());
  }

  const builders = {
    spartan(root, name, at) {
      root.innerHTML = `
        <div class="hud"><i></i><i></i><i></i><i></i></div>
        <svg class="ring" viewBox="0 0 400 400" aria-hidden="true">
          <circle class="ring-track" cx="200" cy="200" r="180"/>
          <circle class="ring-fill ring-glow" cx="200" cy="200" r="180"/>
          <circle class="ring-fill" cx="200" cy="200" r="180"/>
          <circle class="ring-inner" cx="200" cy="200" r="150"/>
        </svg>
        <div class="charge"><b class="pct">0</b><span>% shields</span></div>
        <div class="title"><div class="t1"></div><div class="t2"></div></div>
        <div class="sub">Systems online · your day is ready</div>
        <div class="scan"></div>`;
      const pct = root.querySelector(".pct");
      at(50, () => {
        root.classList.add("go");
        Sfx.spartanCharge();
        const start = performance.now();
        (function count(now) {
          const p = Math.min(1, (now - start) / 1400);
          pct.textContent = Math.round(p * 100);
          if (p < 1 && root.isConnected) requestAnimationFrame(count);
        })(start);
      });
      at(1500, () => { root.classList.add("charged"); Sfx.spartanChime(); });
      at(1550, () => scramble(root.querySelector(".t1"), "WELCOME", 650));
      at(2050, () => scramble(root.querySelector(".t2"), name.toUpperCase(), 800));
      blips(at, 1550, 1300, 12);
      at(3000, () => root.classList.add("online"));
      return 4300;
    },

    fengwei(root, name, at) {
      root.innerHTML = `
        <svg class="slash" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
          <path class="brush b1" d="M-80 780 C 420 610, 1200 560, 2000 250"/>
          <path class="brush b2" d="M-80 820 C 520 660, 1250 620, 2000 330"/>
        </svg>
        <div class="kanji" aria-hidden="true">冯威</div>
        <div class="title"><div class="t1">Welcome</div><div class="t2"></div></div>
        <div class="sub">Ready for today</div>
        <div class="flash"></div>`;
      root.querySelector(".t2").textContent = name;
      at(150, () => { root.classList.add("go"); Sfx.whoosh(); });
      at(650, () => root.classList.add("ink"));
      at(1050, () => { root.classList.add("hit1"); Sfx.impact(false); shake(root); });
      at(1550, () => { root.classList.add("hit2"); Sfx.impact(true); shake(root); });
      at(2050, () => Sfx.gong());
      at(2600, () => root.classList.add("ready"));
      return 4300;
    },

    // Both at once: the Spartan and Feng Wei sweep in from opposite sides, collide, and the name locks in.
    versus(root, name, at) {
      root.innerHTML = `
        <div class="side left">
          <div class="side-bg"></div>
          <svg class="rings" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="190"/><circle class="dash" cx="200" cy="200" r="168"/></svg>
          ${SPARTAN_SVG}
          <div class="hud top"><span>Spartan · 117</span><span>Shield 100</span></div>
          <div class="hud bottom"><span>Biometric</span><span>${name}</span></div>
          <div class="tag">Spartan</div>
        </div>
        <div class="side right">
          <img class="ink-bg" src="art/fengwei-bg.webp" alt="">
          <img class="ink-chars" src="art/fengwei-chars.webp" alt="">
          <img class="ink-stroke" src="art/fengwei-stroke.webp" alt="">
          <img class="ink-seal" src="art/fengwei-seal.webp" alt="">
          <div class="embers">${"<i></i>".repeat(14)}</div>
          <div class="tag">Feng Wei</div>
        </div>
        <svg class="seam" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true"><line x1="1080" y1="0" x2="880" y2="1080"/></svg>
        <div class="streak"></div>
        <div class="title"><div class="t1">Welcome</div><div class="t2"><span class="decode"></span><span class="name">${name}</span></div></div>
        <div class="sub">Ready for today</div>
        <div class="flash"></div>
        <div class="grain" style="background-image:url(${grain()})"></div>
        <div class="vignette"></div>
        <div class="bars"><i></i><i></i></div>`;
      at(0, () => { root.classList.add("open"); Sfx.rumble(3); });
      at(300, () => { root.classList.add("in-left"); Sfx.whooshDeep({ dur: 1.1, pan: -0.9, pan2: -0.2 }); });
      at(1000, () => { root.classList.add("visor"); Sfx.metal(-0.4); });
      at(1300, () => { root.classList.add("in-right"); Sfx.whooshDeep({ dur: 1.1, pan: 0.9, pan2: 0.2 }); });
      at(1500, () => { root.classList.add("brush"); Sfx.whooshDeep({ dur: 0.55, pan: -0.1, pan2: 0.8, peak: 0.4 }); });
      at(1850, () => { root.classList.add("ink"); Sfx.drum(0.4); });
      at(2150, () => { root.classList.add("seal"); Sfx.drum(0.6); Sfx.metal(0.6); });
      at(1600, () => Sfx.riser(0.85));
      at(2450, () => { root.classList.add("clash"); Sfx.boom(1.1); Sfx.braam(); shake(root); });
      at(3050, () => { root.classList.add("hit1"); Sfx.whooshDeep({ dur: 0.8, peak: 0.35 }); });
      at(3550, () => { root.classList.add("decoding"); scramble(root.querySelector(".decode"), name.toUpperCase(), 650); });
      blips(at, 3550, 650, 8);
      at(4250, () => { root.classList.add("lock"); Sfx.boom(0.8); Sfx.shimmer(); });
      at(5000, () => root.classList.add("ready"));
      at(6750, () => { root.classList.add("part"); Sfx.whooshDeep({ dur: 0.9, peak: 0.5 }); });
      return 7400;
    }
  };

  function play(theme, name, done) {
    stop();
    const root = el();
    root.className = "intro " + theme;
    root.hidden = false;
    document.body.classList.add("intro-on");
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const length = builders[theme](root, name, at);
    finish = () => {
      finish = null;
      timers.forEach(clearTimeout);
      timers = [];
      root.classList.add("out");
      document.body.classList.remove("intro-on");
      setTimeout(() => { root.hidden = true; root.innerHTML = ""; }, 650);
      if (done) done();
    };
    at(length, () => finish && finish());
  }

  function stop() { if (finish) finish(); }

  /** Replays a theme's sound cues through at(ms, fn) without touching the screen. Returns its length in ms. */
  function cues(theme, name, at) {
    return builders[theme](document.createElement("div"), name, at);
  }

  return { play, skip: stop, cues, get playing() { return !!finish; } };
})();

// Ambient particles: embers (Feng Wei), star dust (Spartan), or both drifting together (versus).
const Ambient = (() => {
  let canvas, g, parts = [], theme = "versus", raf = 0;
  const W = 960, H = 540; // drawn at half resolution and stretched, to spare the Fire Stick's GPU

  function spawn(initial, kind) {
    if (kind === "ember") {
      return { kind, x: Math.random() * W, y: initial ? Math.random() * H : H + 10, r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.25, vy: -(0.25 + Math.random() * 0.7), life: Math.random() * Math.PI * 2,
        hue: 10 + Math.random() * 30 };
    }
    return { kind, x: initial ? Math.random() * W : W + 5, y: Math.random() * H, r: 0.4 + Math.random() * 1.1,
      vx: -(0.04 + Math.random() * 0.12), vy: (Math.random() - 0.5) * 0.03, life: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.8 ? 190 : 95 };
  }

  function frame() {
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.life += 0.03;
      const ember = p.kind === "ember";
      const flicker = 0.45 + 0.4 * Math.sin(p.life * (ember ? 3 : 1));
      g.fillStyle = ember ? `hsla(${p.hue},95%,58%,${flicker})` : `hsla(${p.hue},90%,70%,${flicker * 0.8})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
      if (p.y < -10 || p.x < -10 || p.x > W + 10) Object.assign(p, spawn(false, p.kind));
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    start(t) {
      canvas = canvas || document.getElementById("fx");
      g = g || canvas.getContext("2d");
      canvas.width = W; canvas.height = H;
      theme = t;
      const embers = t === "fengwei" ? 46 : t === "versus" ? 30 : 0;
      const stars = t === "spartan" ? 70 : t === "versus" ? 40 : 0;
      parts = [
        ...Array.from({ length: embers }, () => spawn(true, "ember")),
        ...Array.from({ length: stars }, () => spawn(true, "star"))
      ];
      cancelAnimationFrame(raf);
      frame();
    }
  };
})();
