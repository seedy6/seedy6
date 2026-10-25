// Welcome Home: clock, prayer times, Mac mini metrics, apps and remote navigation.
(() => {
  const $ = (id) => document.getElementById(id);
  const config = Object.assign({}, window.HOME_CONFIG);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------- Native bridge (window.Android on the Fire Stick; a stand-in in a desktop browser) ----------
  const onDevice = !!window.Android;
  const native = window.Android || PreviewBridge();
  const pending = {};
  let nextId = 0;
  window.__bridgeResolve = (id, ok, body) => {
    const p = pending[id];
    if (!p) return;
    delete pending[id];
    ok ? p.resolve(body) : p.reject(new Error(body));
  };
  function getText(url) {
    if (!onDevice) return fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error("HTTP " + r.status))));
    return new Promise((resolve, reject) => {
      const id = "r" + nextId++;
      pending[id] = { resolve, reject };
      native.fetch(id, url);
    });
  }
  const getJson = (url) => getText(url).then(JSON.parse);

  // ---------- Stage scaling: the page is designed at 1920x1080 ----------
  // On the Fire Stick the WebView itself lays the page out 1920 wide (viewport meta + wide viewport),
  // so this comes out at 1; in a browser it shrinks the stage to the window. Sizes can be 0 or stale
  // before the first layout, so it runs again once things settle.
  function fit() {
    const w = document.documentElement.clientWidth || innerWidth, h = document.documentElement.clientHeight || innerHeight;
    if (!w || !h) return;
    const s = Math.min(w / 1920, h / 1080);
    const x = (w - 1920 * s) / 2, y = (h - 1080 * s) / 2;
    $("stage").style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  }
  addEventListener("resize", fit);
  addEventListener("load", fit);
  fit();
  [100, 500, 1500].forEach((ms) => setTimeout(fit, ms));

  // ---------- Theme ----------
  const THEMES = { versus: "Spartan × Feng Wei", spartan: "Spartan", fengwei: "Feng Wei" };
  let theme = store.get("theme") || config.theme;
  if (!THEMES[theme]) theme = "versus";
  function applyTheme() {
    document.body.dataset.theme = theme;
    Sfx.configure({ theme });
    Ambient.start(theme);
  }

  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- Intro ----------
  let lastSeen = Date.now();
  function playIntro() {
    $("drawer").hidden = true;
    Ambient.stop(); // the intro covers it; no point drawing it underneath
    Intro.play(theme, config.name, () => { Ambient.start(theme); focusFirst(); });
  }

  // Decode the intro's artwork and fonts up front so the first frames don't stutter.
  function preload() {
    const images = ["fengwei-bg", "fengwei-chars", "fengwei-stroke", "fengwei-seal"].map((n) => {
      const img = new Image();
      img.src = `art/${n}.webp`;
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    });
    const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2500));
    return Promise.race([Promise.all([...images, fonts]), timeout]);
  }
  window.replayIntro = playIntro;
  window.onHomeResume = () => {
    // Timers stop while another app is in front, so lastSeen is when we were last on screen.
    const awayMin = (Date.now() - lastSeen) / 60000;
    lastSeen = Date.now();
    tickClock();
    refreshPrayers();
    if (awayMin >= config.introAfterMinutes) playIntro();
  };
  window.onHomePressed = () => {
    if (!$("webApp").hidden) closeWebApp();
    else if (!$("drawer").hidden) closeDrawer();
    else focusFirst();
  };
  window.onBackKey = () => {
    if (Intro.playing) Intro.skip();
    else if (!$("webApp").hidden) closeWebApp();
    else if (!$("drawer").hidden) closeDrawer();
  };
  window.onMenuKey = switchTheme;

  // ---------- Updates (see Updater.kt) ----------
  window.onUpdate = (kind) => {
    if (kind === "web") {
      // A new page is downloaded: switch to it once nothing is playing.
      const swap = () => {
        if (Intro.playing || !$("webApp").hidden) return setTimeout(swap, 2000);
        toast("Updated");
        setTimeout(() => native.reloadLatest(), 1200);
      };
      swap();
    } else if (kind === "apk" && !document.getElementById("updateTile")) {
      const tile = utilTile("update", "Update app", () => {
        toast("Downloading the update…");
        native.installUpdate();
      });
      tile.id = "updateTile";
      $("appRow").insertBefore(tile, $("appRow").firstChild);
      toast("An app update is ready");
    }
  };
  window.onUpdateError = (message) => toast("Update failed: " + message);
  function switchTheme() {
    const order = Object.keys(THEMES);
    theme = order[(order.indexOf(theme) + 1) % order.length];
    store.set("theme", theme);
    applyTheme();
    toast("Theme: " + THEMES[theme]);
    playIntro();
  }

  // ---------- Clock and greeting ----------
  function tickClock() {
    const now = new Date();
    lastSeen = Date.now();
    $("clock").textContent = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const h = now.getHours();
    $("eyebrow").textContent = h < 5 ? "Peaceful night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    $("gregDate").textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    renderNextPrayer(now);
  }

  // ---------- Prayer times (api.aladhan.com, cached for the day) ----------
  // Three prayer times, as SalahLog and najaf.org give them (Asr is prayed with Dhuhr, Isha with
  // Maghrib), plus sunrise as the end of Fajr.
  const PRAYERS = ["Fajr", "Sunrise", "Dhuhr", "Maghrib"];
  const PRAYER_LABELS = { Dhuhr: "Dhuhr & Asr", Maghrib: "Maghrib & Isha" };
  const label = (p) => PRAYER_LABELS[p] || p;
  let today = null; // { key, times: {Fajr: Date, ...}, hijri, sample }

  function dayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function toDate(hhmm, base) {
    const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  }

  async function refreshPrayers() {
    const now = new Date();
    const key = dayKey(now);
    if (today && today.key === key) return renderPrayers();
    let data = store.get("prayers");
    if (config.salahLogUrl && (!data || data.key !== key || data.source !== "SalahLog")) {
      // SalahLog's times win over calculated ones.
      try {
        const res = await getJson(config.salahLogUrl);
        const day = res.days && res.days[0];
        const timings = {};
        for (const p of PRAYERS) if (day && day[p.toLowerCase()]) timings[p] = day[p.toLowerCase()];
        if (timings.Fajr && timings.Dhuhr && timings.Maghrib) {
          data = { key, timings, hijri: (data && data.key === key && data.hijri) || "", source: "SalahLog" };
          store.set("prayers", data);
        }
      } catch (e) {}
    }
    if (!data || data.key !== key) {
      const { city, country, method } = config.prayer;
      const d = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const url = `https://api.aladhan.com/v1/timingsByCity/${d}?city=${encodeURIComponent(city)}` +
        `&country=${encodeURIComponent(country)}&method=${method}`;
      try {
        const res = await getJson(url);
        const h = res.data.date.hijri;
        data = { key, timings: res.data.timings, hijri: `${h.day} ${h.month.en} ${h.year} AH`, source: "" };
        store.set("prayers", data);
      } catch (e) {
        data = onDevice ? null : PreviewBridge.samplePrayers(key);
      }
    }
    if (!data) {
      today = null;
      $("prayerRow").innerHTML = `<div class="empty">Prayer times unavailable. Check the internet connection.</div>`;
      return;
    }
    today = { key, hijri: data.hijri, sample: !!data.sample, source: data.source, times: {} };
    for (const p of PRAYERS) if (data.timings[p]) today.times[p] = toDate(data.timings[p], now);
    renderPrayers();
  }

  function renderPrayers() {
    if (!today) return;
    $("prayerPlace").textContent = config.prayer.city + (today.source ? " · " + today.source : " · calculated");
    $("prayerBadge").hidden = !today.sample;
    $("prayerBadge").textContent = "Sample times";
    $("hijriDate").textContent = today.hijri;
    $("hijriSep").hidden = !today.hijri;
    const now = new Date();
    const shown = PRAYERS.filter((p) => today.times[p]);
    const next = shown.find((p) => p !== "Sunrise" && today.times[p] > now);
    $("prayerRow").style.gridTemplateColumns = `repeat(${shown.length}, 1fr)`;
    $("prayerRow").innerHTML = shown.map((p) => {
      const t = today.times[p];
      const cls = p === next ? "next" : t < now ? "passed" : "";
      return `<div class="prayer ${cls}" data-prayer="${p}"><div class="p-name">${label(p)}</div>` +
        `<div class="p-time">${t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div></div>`;
    }).join("");
    renderNextPrayer(now);
  }

  function renderNextPrayer(now) {
    if (!today) { $("nextPrayer").textContent = ""; return; }
    const next = PRAYERS.find((p) => p !== "Sunrise" && today.times[p] && today.times[p] > now);
    if (!next) { $("nextPrayer").textContent = "Fajr tomorrow"; return; }
    const mins = Math.ceil((today.times[next] - now) / 60000);
    const span = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
    $("nextPrayer").textContent = `${label(next)} in ${span}`;
    // Re-render the row as each prayer time passes.
    const current = document.querySelector(".prayer.next");
    if (current && current.dataset.prayer !== next) renderPrayers();
  }

  // ---------- Metrics from the Mac mini ----------
  async function refreshMetrics() {
    let feed = null, sample = false;
    if (config.metricsUrl) {
      try { feed = await getJson(config.metricsUrl); } catch (e) { feed = null; }
    } else if (!onDevice) {
      feed = PreviewBridge.sampleMetrics();
      sample = true;
    }
    $("metricsBadge").hidden = !sample;
    $("metricsBadge").textContent = "Sample data";
    // Until the Mac mini feed is set up, leave the panel out rather than nag about it.
    $("metricsPanel").hidden = !config.metricsUrl && !sample;
    if (!feed || !Array.isArray(feed.metrics) || !feed.metrics.length) {
      $("metricsUpdated").textContent = "";
      $("metricRow").innerHTML = `<div class="empty" style="grid-column: 1 / -1">` +
        "Can't reach the Mac mini right now." + `</div>`;
      return;
    }
    $("metricsUpdated").textContent = feed.updated
      ? "updated " + new Date(feed.updated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
    const C = 2 * Math.PI * 40;
    $("metricRow").innerHTML = feed.metrics.slice(0, 5).map((m) => {
      const hasTarget = typeof m.target === "number" && m.target > 0;
      const pct = hasTarget ? Math.max(0, Math.min(1, m.value / m.target)) : 0;
      const ring = hasTarget
        ? `<svg viewBox="0 0 96 96"><circle class="track" cx="48" cy="48" r="40"/>` +
          `<circle class="fill" cx="48" cy="48" r="40" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>` : "";
      const value = typeof m.value === "number" ? m.value.toLocaleString("en-GB") : esc(m.value);
      return `<div class="metric ${pct >= 1 ? "done" : ""}">${ring}<div>` +
        `<div class="m-label">${esc(m.label)}</div>` +
        `<div class="m-value">${value}<span class="m-unit">${esc(m.unit || "")}</span></div>` +
        (hasTarget ? `<div class="m-target">of ${m.target.toLocaleString("en-GB")}</div>` : "") +
        `</div></div>`;
    }).join("");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ---------- Apps ----------
  let apps = [];
  const ICONS = {
    grid: `<svg viewBox="0 0 64 64"><rect x="8" y="8" width="18" height="18"/><rect x="38" y="8" width="18" height="18"/><rect x="8" y="38" width="18" height="18"/><rect x="38" y="38" width="18" height="18"/></svg>`,
    theme: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22"/><path d="M32 10 A22 22 0 0 1 32 54 Z" fill="currentColor"/></svg>`,
    replay: `<svg viewBox="0 0 64 64"><path d="M14 32 A18 18 0 1 0 20 18"/><path d="M12 10 L20 18 L10 22"/></svg>`,
    update: `<svg viewBox="0 0 64 64"><path d="M32 10v30M20 28l12 12 12-12"/><path d="M12 46v8h40v-8"/></svg>`,
    firetv: `<svg viewBox="0 0 64 64"><rect x="8" y="14" width="48" height="30" rx="3"/><path d="M24 54h16M32 44v10"/></svg>`,
    pin: `<svg viewBox="0 0 64 64"><path d="M10 30 L32 12 L54 30"/><path d="M16 26v26h32V26"/><path d="M27 52V38h10v14"/></svg>`,
    settings: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="9"/><path d="M32 6v10M32 48v10M6 32h10M48 32h10M13.6 13.6l7 7M43.4 43.4l7 7M13.6 50.4l7-7M43.4 20.6l7-7"/></svg>`
  };

  function appTile(app) {
    const b = document.createElement("button");
    b.className = "tile focusable" + (app.banner ? "" : " icon-only");
    b.style.backgroundImage = `url("${app.icon}")`;
    b.innerHTML = `<span class="label">${esc(app.label)}</span>`;
    b.onclick = () => { Sfx.select(); if (!native.launch(app.pkg)) toast("Couldn't open " + app.label); };
    return b;
  }
  function webTile(app) {
    const b = document.createElement("button");
    b.className = "tile web focusable";
    b.innerHTML = `<span class="w-name">${esc(app.label)}</span><span class="w-sub">${esc(app.subtitle || "")}</span>` +
      `<span class="label">${esc(app.label)}</span>`;
    b.onclick = () => {
      Sfx.select();
      if (onDevice) openWebApp(app);
      else toast(`On the TV this opens ${app.label} full-screen`);
    };
    return b;
  }
  function utilTile(icon, label, action) {
    const b = document.createElement("button");
    b.className = "tile util focusable";
    b.innerHTML = ICONS[icon] + `<span class="label">${label}</span>`;
    b.onclick = () => { Sfx.select(); action(); };
    return b;
  }

  function loadApps() {
    try { apps = JSON.parse(native.getApps()); } catch (e) { apps = []; }
    apps.sort((a, b) => a.label.localeCompare(b.label));
    const byPkg = Object.fromEntries(apps.map((a) => [a.pkg, a]));
    const replaced = (pkg) => (config.replacedBy[pkg] || []).some((other) => byPkg[other]);
    const pinned = config.pinnedApps.map((p) => byPkg[p]).filter((a) => a && !replaced(a.pkg));
    const rest = apps.filter((a) => !config.pinnedApps.includes(a.pkg) && !config.hiddenApps.includes(a.pkg));
    const row = $("appRow");
    row.innerHTML = "";
    // Fall back to other apps if none of the pinned ones are installed, so the row is never empty.
    const shown = config.onlyPinnedApps && pinned.length ? pinned : [...pinned, ...rest];
    shown.slice(0, 8).forEach((a) => row.appendChild(appTile(a)));
    (config.webApps || []).filter((w) => w.url).forEach((w) => row.appendChild(webTile(w)));
    row.appendChild(utilTile("grid", "All apps", openDrawer));
    row.appendChild(utilTile("theme", "Theme", switchTheme));
    row.appendChild(utilTile("replay", "Replay intro", playIntro));
    row.appendChild(utilTile("firetv", "Fire TV home", () => {
      if (native.openFireTvHome()) toast("Open Welcome Home from your apps to come back");
      else toast("Couldn't find the Fire TV home screen");
    }));
    if (onDevice && !native.isHomeRedirectOn()) {
      // The Home-button switch is off, so Home and start-up still go to Amazon's screen.
      row.appendChild(utilTile("pin", "Make this my home", () => {
        if (!native.openAccessibilitySettings()) toast("See the README: switch it on with ADB from the Mac mini");
        else toast("Switch on “Welcome Home: Home button”");
      }));
    }
    row.appendChild(utilTile("settings", "Settings", () => native.openSettings()));
  }

  // Web apps run in a full-screen frame over the home screen; Back or Home closes it.
  function openWebApp(app) {
    const frame = $("webFrame");
    frame.src = app.url;
    $("webApp").hidden = false;
    frame.focus();
  }
  function closeWebApp() {
    $("webApp").hidden = true;
    $("webFrame").src = "about:blank";
    focusFirst();
  }

  document.querySelector(".drawer-title").onclick = () => closeDrawer();
  $("intro").onclick = () => Intro.playing && Intro.skip();

  function openDrawer() {
    const grid = $("drawerGrid");
    grid.innerHTML = "";
    apps.forEach((a) => grid.appendChild(appTile(a)));
    $("drawer").hidden = false;
    grid.scrollTop = 0;
    focusFirst();
  }
  function closeDrawer() {
    $("drawer").hidden = true;
    focusFirst();
  }

  // ---------- Remote control navigation ----------
  function scope() { return $("drawer").hidden ? $("appRow") : $("drawerGrid"); }
  function focusFirst() {
    const first = scope().querySelector(".focusable");
    if (first) first.focus({ preventScroll: true });
  }
  function move(dir) {
    const items = [...scope().querySelectorAll(".focusable")];
    const cur = document.activeElement;
    if (!items.includes(cur)) return focusFirst();
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const along = { left: -dx, right: dx, up: -dy, down: dy }[dir];
      if (along <= 1) continue;
      const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (!best) return;
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: "nearest", inline: "nearest" });
    Sfx.tick();
  }
  const KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  document.addEventListener("keydown", (e) => {
    if (document.getElementById("startGate")) return;
    Sfx.unlock();
    if (Intro.playing) { Intro.skip(); e.preventDefault(); return; }
    if (!$("webApp").hidden) return; // keys belong to the web app; Back is handled natively
    if (KEYS[e.key]) { move(KEYS[e.key]); e.preventDefault(); }
    else if (e.key === "Escape" || e.key === "Backspace") { window.onBackKey(); e.preventDefault(); }
    else if (e.key === "m") switchTheme(); // desktop preview stand-in for the Menu button
  });

  // ---------- Start ----------
  async function start() {
    if (config.remoteConfigUrl) {
      try { Object.assign(config, await getJson(config.remoteConfigUrl)); } catch (e) {}
    }
    const params = new URLSearchParams(location.search);
    Sfx.configure({ sound: config.sound && !params.has("silent"), volume: config.volume });
    $("name").textContent = config.name;
    applyTheme();
    tickClock();
    setInterval(tickClock, 15000);
    loadApps();
    refreshPrayers();
    refreshMetrics();
    setInterval(refreshMetrics, 5 * 60000);
    if (params.has("nointro")) {
      document.body.classList.remove("intro-on");
      focusFirst();
    } else if (params.has("hold")) {
      // Wait for replayIntro() (used when recording demos).
    } else if (onDevice) preload().then(() => { fit(); playIntro(); });
    else showStartButton(); // browsers only allow sound after a tap
  }

  function showStartButton() {
    const gate = document.createElement("button");
    gate.id = "startGate";
    gate.innerHTML = `<span class="g-play">Play intro</span><span class="g-sub">Sound on · or use the arrow keys, Enter and Esc</span>`;
    gate.onclick = () => { gate.remove(); Sfx.unlock(); playIntro(); };
    $("stage").appendChild(gate);
    gate.focus();
  }

  // ---------- Desktop preview stand-in for window.Android ----------
  function PreviewBridge() {
    const art = (label, c1, c2) => "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
      `<rect width="320" height="180" fill="url(#g)"/><text x="160" y="104" font-family="sans-serif" font-size="34" ` +
      `font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`);
    const list = [
      ["com.stremio.one", "Stremio", "#5b2bb5", "#1b0d3d"],
      ["com.amazon.firetv.youtube", "YouTube", "#c4302b", "#5c0d0b"],
      ["com.netflix.ninja", "Netflix", "#141414", "#5a0a0e"],
      ["com.amazon.firebat", "Prime Video", "#0f79af", "#06263d"],
      ["com.disney.disneyplus", "Disney+", "#113ccf", "#0a1a4f"],
      ["uk.co.bbc.iplayer", "BBC iPlayer", "#e2007a", "#3d0b2b"],
      ["com.spotify.tv.android", "Spotify", "#1db954", "#0b3a1c"],
      ["org.xbmc.kodi", "Kodi", "#17b2e7", "#0b3240"]
    ];
    return {
      getApps: () => JSON.stringify(list.map(([pkg, label, c1, c2]) => ({ pkg, label, banner: true, icon: art(label, c1, c2) }))),
      launch: (pkg) => { toast("Would open " + pkg); return true; },
      openSettings: () => toast("Would open Fire TV settings"),
      openFireTvHome: () => true,
      isHomeRedirectOn: () => true,
      openAccessibilitySettings: () => true,
      fetch: () => {}
    };
  }
  PreviewBridge.samplePrayers = (key) => ({
    key, sample: true, hijri: "",
    timings: { Fajr: "05:28", Sunrise: "07:02", Dhuhr: "11:52", Maghrib: "16:59" }
  });
  PreviewBridge.sampleMetrics = () => ({
    updated: new Date().toISOString(),
    metrics: [
      { label: "Steps", value: 7420, target: 10000 },
      { label: "Sleep", value: 6.8, unit: "h", target: 8 },
      { label: "Qur'an", value: 4, unit: "pages", target: 5 },
      { label: "Water", value: 1.6, unit: "L", target: 2.5 },
      { label: "Prayers", value: 3, unit: "/ 5", target: 5 }
    ]
  });
  start();
})();
