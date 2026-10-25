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

  // Original artwork: an armoured Spartan bust with a gold visor, and a kenpo fighter mid-stance.
  const SPARTAN_SVG = `
    <svg class="spartan-bust" viewBox="0 0 600 700" aria-hidden="true">
      <defs>
        <linearGradient id="armLit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8c9b4e"/><stop offset="1" stop-color="#4f5d2a"/></linearGradient>
        <linearGradient id="armDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5728"/><stop offset="1" stop-color="#232a13"/></linearGradient>
        <linearGradient id="visor" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset="0.3" stop-color="#f5ad35"/><stop offset="0.7" stop-color="#b0560e"/><stop offset="1" stop-color="#3d1904"/></linearGradient>
        <linearGradient id="glint" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <clipPath id="visorClip"><path d="M148 236 L 300 220 L 452 236 L 466 296 L 432 350 L 300 372 L 168 350 L 134 296 Z"/></clipPath>
      </defs>
      <!-- shoulders and chest -->
      <path fill="url(#armDark)" d="M210 700 L 214 520 L 386 520 L 390 700 Z"/>
      <path fill="url(#armLit)" d="M232 540 L 300 530 L 300 700 L 222 700 Z"/>
      <path fill="#2f3719" d="M296 532 L 304 532 L 304 700 L 296 700 Z"/>
      <path fill="url(#armLit)" d="M20 700 L 34 590 L 92 520 L 196 492 L 236 520 L 222 700 Z"/>
      <path fill="#6f7d3b" d="M34 590 L 92 520 L 196 492 L 206 512 L 104 546 L 56 610 Z"/>
      <path fill="url(#armDark)" d="M580 700 L 566 590 L 508 520 L 404 492 L 364 520 L 378 700 Z"/>
      <path fill="#3a4520" d="M566 590 L 508 520 L 404 492 L 394 512 L 496 546 L 544 610 Z"/>
      <path fill="#14170f" d="M246 452 L 354 452 L 372 528 L 228 528 Z"/>
      <path fill="none" stroke="#2c3124" stroke-width="5" d="M244 476 L 356 476 M240 500 L 360 500"/>
      <!-- helmet: lit left faces, shadowed right faces -->
      <path fill="url(#armLit)" d="M300 56 L 300 236 L 148 236 L 124 288 L 126 196 L 156 116 L 218 68 Z"/>
      <path fill="url(#armDark)" d="M300 56 L 300 236 L 452 236 L 476 288 L 474 196 L 444 116 L 382 68 Z"/>
      <path fill="#a4b25e" d="M286 58 L 314 58 L 318 200 L 282 200 Z"/>
      <path fill="#9aa957" d="M218 68 L 156 116 L 138 170 L 182 120 Z"/>
      <path fill="url(#armLit)" d="M124 288 L 134 296 L 168 350 L 204 424 L 160 446 L 116 384 Z"/>
      <path fill="url(#armDark)" d="M476 288 L 466 296 L 432 350 L 396 424 L 440 446 L 484 384 Z"/>
      <path fill="#2b3122" d="M98 318 L 124 304 L 128 392 L 102 380 Z M502 318 L 476 304 L 472 392 L 498 380 Z"/>
      <path fill="#3b4232" d="M200 356 L 300 376 L 400 356 L 384 448 L 300 480 L 216 448 Z"/>
      <path fill="#535b47" d="M290 378 L 310 378 L 306 474 L 294 474 Z"/>
      <path fill="none" stroke="#1b1e16" stroke-width="5" d="M240 396 L 248 440 M262 400 L 268 452 M338 400 L 332 452 M360 396 L 352 440"/>
      <!-- visor -->
      <path fill="url(#visor)" stroke="#120c04" stroke-width="7" stroke-linejoin="round" d="M148 236 L 300 220 L 452 236 L 466 296 L 432 350 L 300 372 L 168 350 L 134 296 Z"/>
      <g clip-path="url(#visorClip)"><rect class="glint" x="-220" y="180" width="130" height="240" fill="url(#glint)" transform="skewX(-25)"/></g>
      <path fill="none" stroke="#fff6d2" stroke-opacity="0.6" stroke-width="6" stroke-linecap="round" d="M170 250 L 300 236 L 380 240"/>
      <!-- cyan rim light on the shadow side -->
      <path fill="none" stroke="#5fe9ff" stroke-opacity="0.85" stroke-width="4" stroke-linejoin="round" d="M382 68 L 444 116 L 474 196 L 476 288 L 484 384 L 440 446 M508 520 L 566 590 L 580 700"/>
    </svg>`;

  const FIGHTER_SVG = `
    <svg class="fighter" viewBox="0 0 700 820" aria-hidden="true">
      <g fill="#070404">
        <path d="M380 128 C 376 96 400 80 424 82 C 438 70 456 74 470 66 C 466 82 476 90 488 92 C 474 100 470 112 464 120 C 466 146 458 168 438 178 C 412 186 384 168 380 128 Z"/>
        <path d="M402 168 L 438 168 L 444 204 L 396 204 Z"/>
        <path d="M352 206 C 384 190 472 190 494 210 C 504 262 492 332 474 398 L 360 404 C 350 340 344 270 352 206 Z"/>
        <path d="M364 214 C 320 220 270 226 230 228 C 180 230 132 222 104 212 L 96 238 C 134 252 186 260 236 260 C 286 260 332 254 368 250 Z"/>
        <path d="M104 214 L 86 166 L 99 162 L 108 194 L 106 152 L 119 151 L 120 192 L 130 156 L 143 160 L 130 210 L 132 238 L 96 242 Z"/>
        <path d="M480 214 C 522 230 544 280 534 330 C 528 362 502 386 472 394 L 452 372 C 478 360 496 340 500 314 C 503 280 490 254 468 244 Z"/>
        <circle cx="460" cy="384" r="24"/>
        <path d="M352 396 L 480 402 L 490 456 L 342 460 Z"/>
        <path d="M346 436 C 300 500 252 562 240 640 C 234 700 238 750 232 788 L 168 798 L 172 778 L 202 768 C 198 700 198 640 212 580 C 232 510 272 462 304 432 Z"/>
        <path d="M418 436 L 488 444 C 532 522 582 622 640 760 L 664 792 L 600 798 C 570 722 520 622 448 532 Z"/>
      </g>
      <path fill="#e0302a" d="M350 394 L 482 400 L 484 426 L 348 420 Z"/>
      <path fill="#b3120e" d="M474 408 C 534 412 584 442 636 420 L 626 452 C 580 470 532 440 472 428 Z"/>
      <path fill="none" stroke="#ff5a40" stroke-width="4" stroke-linejoin="round" stroke-opacity="0.9" d="M464 120 C 466 146 458 168 438 178 M494 210 C 504 262 492 332 474 398 M534 330 C 528 362 502 386 472 394 M488 444 C 532 522 582 622 640 760"/>
      <circle class="palm-glow" cx="112" cy="200" r="40" fill="#f2b84b"/>
    </svg>`;

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
        <div class="sub"><span class="seal">神拳</span> Ready for today</div>
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

    // Both at once: the Spartan and Feng Wei fly in from opposite sides, clash, and the name lands.
    versus(root, name, at) {
      root.innerHTML = `
        <div class="side left">
          <div class="side-bg"></div>
          <svg class="ring" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="180"/><circle class="dash" cx="200" cy="200" r="150"/></svg>
          ${SPARTAN_SVG}
          <div class="tag"><small>Shields 100%</small>Spartan</div>
        </div>
        <div class="side right">
          <div class="side-bg"></div>
          <div class="kanji" aria-hidden="true">冯威</div>
          <svg class="slash" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true"><path d="M2000 140 C 1500 380, 1250 620, 900 1180"/></svg>
          ${FIGHTER_SVG}
          <div class="tag"><small>God Fist</small>Feng Wei</div>
        </div>
        <svg class="seam" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
          <polyline class="bolt" points="1060,0 1035,140 1060,230 1000,400 1030,520 960,700 990,820 900,1080"/>
        </svg>
        <div class="title"><div class="t1">Welcome</div><div class="t2"><span class="decode"></span><span class="fire">${name}</span></div></div>
        <div class="sub">Spartan <b>×</b> God Fist · ready for today</div>
        <div class="flash"></div>
        <div class="bars"><i></i><i></i></div>`;
      at(0, () => { root.classList.add("open"); Sfx.rumble(2.6); });
      at(350, () => { root.classList.add("in-left"); Sfx.swoosh(); });
      at(500, () => Sfx.spartanCharge());
      at(1050, () => root.classList.add("glint"));
      at(1250, () => { root.classList.add("in-right"); Sfx.swoosh(); });
      at(1450, () => { Sfx.impact(false); shake(root); });
      at(1500, () => Sfx.riser(0.75));
      at(2250, () => { root.classList.add("clash"); Sfx.impact(true); Sfx.zap(); shake(root); });
      at(2850, () => { root.classList.add("hit1"); Sfx.impact(false); Sfx.whoosh(); });
      at(3350, () => { root.classList.add("decoding"); scramble(root.querySelector(".decode"), name.toUpperCase(), 700); });
      blips(at, 3350, 700, 9);
      at(4100, () => { root.classList.add("ignite"); Sfx.impact(true); Sfx.spartanChime(); Sfx.gong(); shake(root); });
      at(5000, () => root.classList.add("ready"));
      at(6700, () => { root.classList.add("part"); Sfx.swoosh(); });
      return 7300;
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
