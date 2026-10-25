// The "Welcome, Saeed" opening sequence, one per theme, plus the ambient particles behind the home screen.
const Intro = (() => {
  const el = () => document.getElementById("intro");
  let timers = [], finish = null;

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function scramble(node, text, duration, onStep) {
    const glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#/<>";
    const start = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const settled = Math.floor(p * text.length);
      let out = text.slice(0, settled);
      for (let i = settled; i < text.length; i++) out += text[i] === " " ? " " : glyphs[(Math.random() * glyphs.length) | 0];
      node.textContent = out;
      if (onStep) onStep();
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }

  const builders = {
    spartan(root, name) {
      root.innerHTML = `
        <div class="hud"><i></i><i></i><i></i><i></i></div>
        <svg class="ring" viewBox="0 0 400 400" aria-hidden="true">
          <circle class="ring-track" cx="200" cy="200" r="180"/>
          <circle class="ring-fill ring-glow" cx="200" cy="200" r="180"/>
          <circle class="ring-fill" cx="200" cy="200" r="180"/>
          <circle class="ring-inner" cx="200" cy="200" r="150"/>
        </svg>
        <div class="charge"><b id="chargePct">0</b><span>% shields</span></div>
        <div class="title"><div class="t1"></div><div class="t2"></div></div>
        <div class="sub">Systems online · your day is ready</div>
        <div class="scan"></div>`;
      const pct = root.querySelector("#chargePct");
      at(50, () => {
        root.classList.add("go");
        Sfx.spartanCharge();
        const start = performance.now();
        (function count(now) {
          const p = Math.min(1, (now - start) / 1400);
          pct.textContent = Math.round(p * 100);
          if (p < 1) requestAnimationFrame(count);
        })(start);
      });
      at(1500, () => { root.classList.add("charged"); Sfx.spartanChime(); });
      let blips = 0;
      const blip = () => { if (blips++ % 3 === 0) Sfx.blip(); };
      at(1550, () => scramble(root.querySelector(".t1"), "WELCOME", 650, blip));
      at(2050, () => scramble(root.querySelector(".t2"), name.toUpperCase(), 800, blip));
      at(3000, () => root.classList.add("online"));
      return 4300;
    },

    fengwei(root, name) {
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
      const shake = () => {
        root.classList.remove("shake");
        void root.offsetWidth;
        root.classList.add("shake");
      };
      at(150, () => { root.classList.add("go"); Sfx.whoosh(); });
      at(650, () => root.classList.add("ink"));
      at(1050, () => { root.classList.add("hit1"); Sfx.impact(false); shake(); });
      at(1550, () => { root.classList.add("hit2"); Sfx.impact(true); shake(); });
      at(2050, () => Sfx.gong());
      at(2600, () => root.classList.add("ready"));
      return 4300;
    }
  };

  function play(theme, name, done) {
    stop();
    const root = el();
    root.className = "intro " + theme;
    root.hidden = false;
    document.body.classList.add("intro-on");
    const length = builders[theme](root, name);
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

  return { play, skip: stop, get playing() { return !!finish; } };
})();

// Ambient particles: rising embers for Feng Wei, slow drifting star dust for Spartan.
const Ambient = (() => {
  let canvas, g, parts = [], theme = "fengwei", raf = 0;
  const W = 960, H = 540; // drawn at half resolution and stretched, to spare the Fire Stick's GPU

  function spawn(initial) {
    if (theme === "fengwei") {
      return { x: Math.random() * W, y: initial ? Math.random() * H : H + 10, r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.25, vy: -(0.25 + Math.random() * 0.7), life: Math.random() * Math.PI * 2,
        hue: 10 + Math.random() * 30 };
    }
    return { x: Math.random() * W, y: Math.random() * H, r: 0.4 + Math.random() * 1.1,
      vx: -(0.04 + Math.random() * 0.12), vy: (Math.random() - 0.5) * 0.03, life: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.8 ? 190 : 95 };
  }

  function frame() {
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.life += 0.03;
      const flicker = 0.45 + 0.4 * Math.sin(p.life * (theme === "fengwei" ? 3 : 1));
      g.fillStyle = theme === "fengwei" ? `hsla(${p.hue},95%,58%,${flicker})` : `hsla(${p.hue},90%,70%,${flicker * 0.8})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
      if (p.y < -10 || p.x < -10 || p.x > W + 10) Object.assign(p, spawn(false), theme === "spartan" ? { x: W + 5 } : {});
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    start(t) {
      canvas = canvas || document.getElementById("fx");
      g = g || canvas.getContext("2d");
      canvas.width = W; canvas.height = H;
      theme = t;
      parts = Array.from({ length: t === "fengwei" ? 46 : 70 }, () => spawn(true));
      cancelAnimationFrame(raf);
      frame();
    }
  };
})();
