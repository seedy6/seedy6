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
    $("gate").hidden = true;
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
    if (awayMin >= config.introAfterMinutes && !Intro.playing) playIntro();
  };
  // The Fire Stick woke from sleep (the projector was switched on). The projector may still be warming
  // up, so wait on the waiting screen and play the intro when a key is pressed.
  window.onWake = () => {
    lastSeen = Date.now();
    if (!Intro.playing) showGate();
  };

  // ---------- Waiting screen ----------
  function showGate() {
    $("drawer").hidden = true;
    $("photoView").hidden = true;
    $("gateName").textContent = config.name;
    document.body.classList.add("intro-on"); // keep the home screen out of sight behind it
    Ambient.stop();
    $("gate").hidden = false;
  }
  // Enter from the waiting screen, with the intro (OK, ▲, Home) or straight to the home screen (Back).
  function enterFromGate(withIntro) {
    if ($("gate").hidden) return;
    Sfx.unlock();
    if (withIntro) return playIntro();
    $("gate").hidden = true;
    document.body.classList.remove("intro-on");
    Ambient.start(theme);
    focusFirst();
  }
  window.onHomePressed = () => {
    if (!$("gate").hidden) enterFromGate(true);
    else if (!$("webApp").hidden) closeWebApp();
    else if (!$("drawer").hidden) closeDrawer();
    else focusFirst();
  };
  window.onBackKey = () => {
    if (!$("gate").hidden) enterFromGate(false);
    else if (Intro.playing) Intro.skip();
    else if (!$("homeSetup").hidden) { $("homeSetup").hidden = true; focusFirst(); }
    else if (!$("photoView").hidden) $("photoView").hidden = true;
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
  window.onUpdateCheck = (result) => {
    if (result === "none") toast("You're up to date");
    else if (result === "error") toast("Couldn't check for updates. Check the internet connection.");
    else window.onUpdate(result);
  };
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
    $("gateTime").textContent = $("clock").textContent;
    $("gateDate").textContent = $("gregDate").textContent;
    renderNextPrayer(now);
    renderIslamic(now);
  }

  // ---------- Islamic date and Shia events (events.js) ----------
  const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani",
    "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul Qadah", "Dhul Hijjah"]; // same spellings as Munajat
  // Umm al-Qura via Intl, as Munajat does; older WebViews may only have the civil calculation.
  const hijriFormat = (() => {
    for (const cal of ["islamic-umalqura", "islamic-civil", "islamic"]) {
      try {
        const f = new Intl.DateTimeFormat(`en-US-u-ca-${cal}`, { year: "numeric", month: "numeric", day: "numeric" });
        if (f.resolvedOptions().calendar === cal) return f;
      } catch (e) {}
    }
    return null;
  })();
  function hijri(date) {
    if (!hijriFormat) return null;
    const d = new Date(date);
    d.setDate(d.getDate() + (config.hijriAdjust || 0));
    const parts = hijriFormat.formatToParts(d);
    const get = (type) => Number((parts.find((p) => p.type === type) || {}).value);
    const h = { year: get("year"), month: get("month"), day: get("day") };
    return h.month && h.day ? h : null;
  }
  function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
  function eventsOn(date) {
    const h = hijri(date), next = hijri(addDays(date, 1));
    if (!h) return [];
    const isLastDay = next && next.month !== h.month;
    return (window.SHIA_EVENTS || []).filter((e) => e.month === h.month && (e.day === h.day || (e.day === "last" && isLastDay)));
  }

  // One saying a day, in order, the same all day (sayings.js).
  function renderSaying(now) {
    const list = window.NAHJ_SAYINGS || [];
    if (!list.length) return;
    const dayNumber = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
    const s = list[dayNumber % list.length];
    $("sayingAr").textContent = s.ar;
    $("sayingEn").textContent = s.en;
    $("sayingSrc").textContent = "Imam Ali · Nahj al-Balagha · " + (typeof s.n === "number" ? "Saying " + s.n : s.n);
    $("saying").hidden = false;
  }

  let islamicDay = "";
  function renderIslamic(now) {
    const key = dayKey(now);
    if (key === islamicDay) return; // only changes at midnight
    islamicDay = key;
    renderSaying(now);
    const h = hijri(now);
    $("hijriDate").textContent = h ? `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}` : "";
    $("hijriSep").hidden = !h;
    // Today's events, or else the next one in the coming three weeks.
    let found = [], offset = 0;
    for (; offset <= 21 && !found.length; offset++) found = eventsOn(addDays(now, offset));
    offset--;
    if (!found.length) { $("eventLine").hidden = true; return; }
    $("eventWhen").textContent = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : `In ${offset} days`;
    $("eventTitle").textContent = found.map((e) => e.title).join("  ·  ");
    $("eventLine").className = `event ev-${found[0].kind}${offset === 0 ? " ev-today" : ""}`;
    $("eventLine").hidden = false;
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

  // ---------- Weather (open-meteo.com) ----------
  const WX_PATHS = {
    sun: `<circle cx="32" cy="32" r="10"/><path d="M32 8v7M32 49v7M8 32h7M49 32h7M15 15l5 5M44 44l5 5M15 49l5-5M44 20l5-5"/>`,
    moon: `<path d="M40 12a20 20 0 1 0 12 30 16 16 0 0 1-12-30z"/>`,
    cloud: `<path d="M19 48h28a11 11 0 0 0 0-22 15 15 0 0 0-29-3 10 10 0 0 0 1 25z"/>`,
    smallSun: `<circle cx="22" cy="22" r="7"/><path d="M22 7v4M7 22h4M11 11l3 3M33 11l-3 3"/>`,
    smallMoon: `<path d="M26 9a11 11 0 1 0 6 17 9 9 0 0 1-6-17z"/>`,
    fog: `<path d="M12 26h40M8 36h48M14 46h36"/>`,
    drizzle: `<path d="M24 54v3M32 54v3M40 54v3"/>`,
    rain: `<path d="M24 52l-3 7M33 52l-3 7M42 52l-3 7"/>`,
    snow: `<path d="M24 55h0M32 58h0M40 55h0M28 50h0M36 50h0" stroke-width="5" stroke-linecap="round"/>`,
    bolt: `<path d="M34 46l-6 9h8l-6 9" />`
  };
  // WMO weather codes -> what to say and which icon to draw.
  function wxKind(code) {
    if (code === 0) return ["Clear", "clear"];
    if (code <= 2) return [code === 1 ? "Mostly clear" : "Partly cloudy", "partly"];
    if (code === 3) return ["Cloudy", "cloud"];
    if (code <= 48) return ["Fog", "fog"];
    if (code <= 57) return ["Drizzle", "drizzle"];
    if (code <= 67 || (code >= 80 && code <= 82)) return [code >= 65 || code === 82 ? "Heavy rain" : "Rain", "rain"];
    if (code <= 86) return ["Snow", "snow"];
    return ["Thunderstorms", "thunder"];
  }
  function wxIcon(code, day) {
    const kind = wxKind(code)[1];
    const parts = {
      clear: [day ? ["sun", WX_PATHS.sun] : ["moon", WX_PATHS.moon]],
      partly: [[day ? "sun" : "moon", day ? WX_PATHS.smallSun : WX_PATHS.smallMoon], ["cloud", WX_PATHS.cloud]],
      cloud: [["cloud", WX_PATHS.cloud]],
      fog: [["cloud", WX_PATHS.fog]],
      drizzle: [["cloud", WX_PATHS.cloud], ["drop", WX_PATHS.drizzle]],
      rain: [["cloud", WX_PATHS.cloud], ["drop", WX_PATHS.rain]],
      snow: [["cloud", WX_PATHS.cloud], ["drop", WX_PATHS.snow]],
      thunder: [["cloud", WX_PATHS.cloud], ["sun", WX_PATHS.bolt]]
    }[kind];
    return `<svg class="wx-svg" viewBox="0 0 64 64" aria-hidden="true">` +
      parts.map(([cls, d]) => `<g class="wx-${cls}">${d}</g>`).join("") + `</svg>`;
  }

  async function refreshWeather() {
    const w = config.weather;
    if (!w) return;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${w.latitude}&longitude=${w.longitude}` +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day" +
      "&hourly=temperature_2m,weather_code,precipitation_probability,is_day" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=Europe%2FLondon&forecast_days=2&wind_speed_unit=mph";
    let data = null, sample = false;
    try {
      data = await getJson(url);
      store.set("weather", { at: Date.now(), data });
    } catch (e) {
      const cached = store.get("weather");
      if (cached && Date.now() - cached.at < 6 * 3600000) data = cached.data;
      else if (!onDevice) { data = PreviewBridge.sampleWeather(); sample = true; }
    }
    if (!data || !data.current) { $("weatherPanel").hidden = true; return; }
    renderWeather(data, sample);
  }

  function renderWeather(d, sample) {
    const c = d.current, deg = (t) => `${Math.round(t)}°`;
    const [condition] = wxKind(c.weather_code);
    // Hourly times are local ("2026-10-25T17:00"); show the next six from the current hour on.
    const hourKey = c.time.slice(0, 13);
    let i = d.hourly.time.findIndex((t) => t.slice(0, 13) === hourKey);
    if (i < 0) i = 0;
    const hours = d.hourly.time.slice(i + 1, i + 7).map((t, k) => {
      const j = i + 1 + k;
      return `<div class="wx-hour"><div class="wx-h-time">${t.slice(11, 16)}</div>` +
        `<div class="wx-h-icon">${wxIcon(d.hourly.weather_code[j], d.hourly.is_day[j])}</div>` +
        `<div class="wx-h-temp">${deg(d.hourly.temperature_2m[j])}</div>` +
        `<div class="wx-h-rain">${d.hourly.precipitation_probability[j]}%</div></div>`;
    }).join("");
    $("weatherPlace").textContent = config.weather.place;
    $("weatherBadge").hidden = !sample;
    $("weather").innerHTML =
      `<div class="wx-now"><div class="wx-icon">${wxIcon(c.weather_code, c.is_day)}</div>` +
      `<div class="wx-temp">${deg(c.temperature_2m)}</div>` +
      `<div class="wx-what"><div class="wx-cond">${condition}</div>` +
      `<div class="wx-sub">Feels ${deg(c.apparent_temperature)} · Wind ${Math.round(c.wind_speed_10m)} mph</div></div></div>` +
      `<div class="wx-sep"></div>` +
      `<div class="wx-day"><div><span class="wx-k">High</span>${deg(d.daily.temperature_2m_max[0])}</div>` +
      `<div><span class="wx-k">Low</span>${deg(d.daily.temperature_2m_min[0])}</div>` +
      `<div><span class="wx-k">Rain</span>${d.daily.precipitation_probability_max[0]}%</div></div>` +
      `<div class="wx-sep"></div>` +
      `<div class="wx-hours">${hours}</div>`;
    $("weatherPanel").hidden = false;
  }

  // ---------- Metrics from the Mac mini ----------
  async function refreshMetrics() {
    let feed = null;
    if (config.metricsUrl) {
      try { feed = await getJson(config.metricsUrl); } catch (e) { feed = null; }
    }
    // Until the Mac mini feed is set up, leave the panel out rather than nag about it.
    $("metricsPanel").hidden = !config.metricsUrl;
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
    refresh: `<svg viewBox="0 0 64 64"><path d="M50 30a18 18 0 0 0-32-11l-4 4"/><path d="M14 12v11h11"/><path d="M14 34a18 18 0 0 0 32 11l4-4"/><path d="M50 52V41H39"/></svg>`,
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
  // A photo as a round tile at the far end of the apps row; selecting it shows it full-screen.
  function addPhotoTile(row) {
    const p = config.photoTile;
    if (!p) return;
    const b = document.createElement("button");
    b.className = "tile photo focusable";
    b.innerHTML = `<span class="ph-ring"><img src="${p.tile}" alt=""></span>`;
    b.onclick = () => {
      Sfx.select();
      $("photoFull").src = p.full;
      $("photoView").hidden = false;
    };
    row.appendChild(b);
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
    // An id is a package name, or "label:<name>" to match the name an app shows.
    const find = (id) => id.startsWith("label:")
      ? apps.find((a) => a.label.toLowerCase().replace(/\s+/g, "").includes(id.slice(6).toLowerCase().replace(/\s+/g, "")))
      : apps.find((a) => a.pkg === id);
    const replaced = (pkg) => (config.replacedBy[pkg] || []).some((other) => find(other));
    const pinned = [...new Set(config.pinnedApps.map(find).filter((a) => a && !replaced(a.pkg)))];
    const rest = apps.filter((a) => !pinned.includes(a) && !config.hiddenApps.includes(a.pkg));
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
      const tile = utilTile("pin", "Make this my home", () => {
        if (typeof native.enableHomeRedirect === "function" && native.enableHomeRedirect()) {
          tile.remove();
          focusFirst();
          toast("Home now opens Welcome Home");
        } else openHomeSetup();
      });
      row.appendChild(tile);
    }
    if (typeof native.checkForUpdates === "function") {
      row.appendChild(utilTile("refresh", "Check for updates", () => {
        toast("Checking for updates…");
        native.checkForUpdates();
      }));
    }
    row.appendChild(utilTile("settings", "Settings", () => native.openSettings()));
    addPhotoTile(row);
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
  $("homeSetup").onclick = () => { $("homeSetup").hidden = true; focusFirst(); };
  $("photoView").onclick = () => { $("photoView").hidden = true; };
  $("gate").onclick = () => enterFromGate(true);
  $("intro").onclick = () => Intro.playing && Intro.skip();

  // Fire TV hides third-party accessibility switches, so show how to turn it on with ADB instead.
  function openHomeSetup() {
    let address = "";
    try { address = typeof native.deviceAddress === "function" ? native.deviceAddress() : ""; } catch (e) {}
    $("hsAddress").textContent = address || "the address under Settings → My Fire TV → About → Network";
    $("homeSetup").hidden = false;
  }

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
    if (!$("gate").hidden) {
      e.preventDefault();
      enterFromGate(!(e.key === "Escape" || e.key === "Backspace"));
      return;
    }
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
    refreshWeather();
    setInterval(refreshWeather, 30 * 60000);
    if (params.has("nointro")) {
      document.body.classList.remove("intro-on");
      focusFirst();
    } else if (params.has("hold")) {
      // Wait for replayIntro() (used when recording demos).
    } else {
      // Start on the waiting screen: the projector may still be warming up, and browsers only allow
      // sound after a key press or tap anyway.
      showGate();
      if (onDevice) preload();
    }
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
      ["org.smarttube.beta", "SmartTube", "#d4242a", "#3a0809"],
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
      checkForUpdates: () => setTimeout(() => window.onUpdateCheck("none"), 800),
      isHomeRedirectOn: () => true,
      openAccessibilitySettings: () => true,
      deviceAddress: () => "192.168.0.15",
      enableHomeRedirect: () => false,
      fetch: () => {}
    };
  }
  PreviewBridge.samplePrayers = (key) => ({
    key, sample: true, hijri: "",
    timings: { Fajr: "05:28", Sunrise: "07:02", Dhuhr: "11:52", Maghrib: "16:59" }
  });
  PreviewBridge.sampleWeather = () => {
    const now = new Date(), pad = (n) => String(n).padStart(2, "0");
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = [...Array(48)].map((_, h) => `${day}T${pad(h % 24)}:00`);
    const codes = [3, 3, 61, 61, 80, 3, 2, 2, 1, 0, 0, 0, 1, 2, 3, 61, 61, 63, 3, 2, 1, 0, 0, 0];
    return {
      current: { time: `${day}T${pad(now.getHours())}:00`, temperature_2m: 11.4, apparent_temperature: 8.6, weather_code: 61, wind_speed_10m: 14, is_day: 1 },
      hourly: { time, temperature_2m: time.map((_, h) => 8 + 5 * Math.sin(((h % 24) - 8) / 24 * Math.PI * 2)),
        weather_code: time.map((_, h) => codes[h % 24]), precipitation_probability: time.map((_, h) => [10, 20, 60, 70, 55, 30][h % 6]),
        is_day: time.map((_, h) => (h % 24 >= 7 && h % 24 < 17 ? 1 : 0)) },
      daily: { temperature_2m_max: [13], temperature_2m_min: [6], precipitation_probability_max: [70] }
    };
  };
  start();
})();
