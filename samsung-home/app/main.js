/* Salam: a home screen for a 2015 Samsung TV (Tizen 2.3).
   Plain ES5 only: the 2015 web engine has no fetch, no Intl calendars, and partial ES6.
   Everything is calculated on the TV, so it works with no internet. */
(function () {
  "use strict";

  var NAME = "Abu Saeed";
  var LAT = 53.58, LON = -2.43;          // Bolton
  var HIJRI_ADJUST = 0;                  // days; set to -1 or 1 if Najaf's moon sighting differs
  var SAYING_SECONDS = 60;               // a new saying each minute
  var MOVE_MINUTES = 4;                  // the greeting moves to a new place every few minutes
  var SLOTS = [[150, 90], [430, 110], [290, 70], [520, 85]];

  // YouTube on this TV. The Tizen app IDs are tried in order; the last resort is the
  // TV's own REST API, which knows YouTube as 111299001912 (read from :8001/api/v2).
  var YOUTUBE_APP_IDS = ["9Ur5IzDKqV.TizenYouTube", "111299001912"];
  var YOUTUBE_REST = "http://127.0.0.1:8001/api/v2/applications/111299001912";

  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];
  var HIJRI_MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani",
                      "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah"];

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var onTV = typeof window.tizen !== "undefined" && window.tizen.application;
  function now() { return window.SKY_TEST ? new Date(window.SKY_TEST.getTime()) : new Date(); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function hm(mins) {
    if (isNaN(mins)) return "--:--";
    mins = Math.round(mins);
    return pad(Math.floor(mins / 60) % 24) + ":" + pad(mins % 60);
  }
  function setText(el, s) { el.innerHTML = ""; el.appendChild(document.createTextNode(s)); }

  // ---------- fit the 1920x1080 stage to the screen ----------
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var t = "scale(" + s + ")";
    stage.style.webkitTransform = t;
    stage.style.transform = t;
  }
  window.addEventListener("resize", fit);
  fit();

  // ---------- sun: sunrise, sunset and prayer times (Jafari method) ----------
  var RAD = Math.PI / 180;
  function sunPos(d) {
    // Declination (radians) and equation of time (minutes) for this date (NOAA).
    var start = new Date(d.getFullYear(), 0, 1);
    var doy = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000) + 1;
    var g = 2 * Math.PI / 365 * (doy - 1 + 0.5);
    var eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) -
              0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
               0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    return { decl: decl, eqt: eqt };
  }
  // Minutes after local midnight when the sun is `depression` degrees below the horizon
  // (morning if am, else evening).
  function sunAt(d, depression, am) {
    var p = sunPos(d), tz = -d.getTimezoneOffset();
    var noon = 720 - 4 * LON - p.eqt + tz;
    var c = (Math.sin(-depression * RAD) - Math.sin(LAT * RAD) * Math.sin(p.decl)) /
            (Math.cos(LAT * RAD) * Math.cos(p.decl));
    if (c < -1 || c > 1) return NaN;      // no such moment today (high summer)
    var ha = Math.acos(c) / RAD * 4;
    return am ? noon - ha : noon + ha;
  }
  function prayerTimes(d) {
    var p = sunPos(d), tz = -d.getTimezoneOffset();
    return {
      fajr: sunAt(d, 16, true),
      sunrise: sunAt(d, 0.833, true),
      dhuhr: 720 - 4 * LON - p.eqt + tz,
      maghrib: sunAt(d, 4, false),
      sunset: sunAt(d, 0.833, false)
    };
  }

  // ---------- sky colour for the part of the day ----------
  function partOfDay(d) {
    var h = d.getHours(), m = h * 60 + d.getMinutes(), t = prayerTimes(d), sky;
    if (m >= t.sunrise - 50 && m < t.sunrise + 50) sky = "dawn";
    else if (m >= t.sunset - 50 && m < t.sunset + 40) sky = "dusk";
    else if (m >= t.sunrise + 50 && m < t.sunset - 50) sky = "day";
    else sky = "night";
    var hello = h < 4 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    return [sky, hello];
  }

  // ---------- Hijri date (Umm al-Qura table in data.js) ----------
  function dayNum(y, m, d) { return Math.floor(Date.UTC(y, m, d) / 86400000); }
  function hijriOf(d) {
    var n = dayNum(d.getFullYear(), d.getMonth(), d.getDate()) + HIJRI_ADJUST;
    var t = window.HIJRI_MONTH_STARTS || [];
    for (var i = t.length - 2; i >= 0; i--) {
      var s = t[i][2].split("-"), first = dayNum(+s[0], +s[1] - 1, +s[2]);
      if (first <= n) {
        var e = t[i + 1][2].split("-"), next = dayNum(+e[0], +e[1] - 1, +e[2]);
        if (n >= next) return null;       // past the end of the table
        return { y: t[i][0], m: t[i][1], d: n - first + 1, len: next - first };
      }
    }
    return null;
  }
  function eventsOn(h) {
    var out = [], ev = window.SHIA_EVENTS || [];
    for (var i = 0; i < ev.length; i++) {
      if (ev[i].month === h.m && (ev[i].day === h.d || (ev[i].day === "last" && h.d === h.len))) out.push(ev[i]);
    }
    return out;
  }
  function renderIslamic(d) {
    var h = hijriOf(d), el = $("event");
    if (!h) { setText($("hijri"), ""); setText(el, ""); return; }
    setText($("hijri"), h.d + " " + HIJRI_MONTHS[h.m - 1] + " " + h.y + " AH");
    el.innerHTML = ""; el.className = "";
    for (var k = 0; k <= 45; k++) {
      var day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k, 12);
      var hk = hijriOf(day);
      if (!hk) break;
      var found = eventsOn(hk);
      if (found.length) {
        var e = found[0];
        var when = k === 0 ? "Today" : k === 1 ? "Tomorrow" : "In " + k + " days";
        var b = document.createElement("b"); b.appendChild(document.createTextNode(when));
        el.appendChild(b); el.appendChild(document.createTextNode(e.title));
        el.className = e.kind || "";
        return;
      }
    }
  }

  // ---------- prayer row ----------
  var ORDER = ["fajr", "sunrise", "dhuhr", "maghrib"];
  function renderPrayers(d) {
    var t = prayerTimes(d), m = d.getHours() * 60 + d.getMinutes(), next = "fajr";
    for (var i = 0; i < ORDER.length; i++) {
      if (ORDER[i] !== "sunrise" && t[ORDER[i]] > m) { next = ORDER[i]; break; }
    }
    var cells = $("prayers").getElementsByTagName("div");
    for (var j = 0; j < cells.length; j++) {
      var c = cells[j], key = c.getAttribute("data-p");
      if (!key) continue;
      c.className = "p" + (key === next ? " next" : "");
      setText(c.getElementsByTagName("div")[1], hm(t[key]));
    }
  }

  // ---------- clock ----------
  var lastPart = "", lastDay = "";
  function tick() {
    var d = now();
    setText($("time"), pad(d.getHours()) + ":" + pad(d.getMinutes()));
    setText($("date"), DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]);
    var p = partOfDay(d);
    if (p[0] !== lastPart) { stage.className = p[0]; lastPart = p[0]; }
    setText($("part"), p[1]);
    var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    if (key !== lastDay) { lastDay = key; renderIslamic(d); }
    renderPrayers(d);
  }
  window.helloTick = function () { lastDay = ""; tick(); };
  $("hello").getElementsByTagName("span")[0].innerHTML = NAME;
  tick();
  setInterval(tick, 10000);

  // ---------- sayings: a new one each minute, with a fade ----------
  var sayings = window.SALAM_SAYINGS || [];
  var sayingIndex = (function () {
    var d = now();
    return sayings.length ? (d.getDate() * 24 + d.getHours()) * 7 % sayings.length : 0;
  })();
  function showSaying() {
    if (!sayings.length) return;
    var s = sayings[sayingIndex % sayings.length], box = $("saying"), divs = box.getElementsByTagName("div");
    setText(divs[0], s.ar);
    setText(divs[1], s.en);
    setText(divs[2], s.by + "  ·  " + s.src);
  }
  function nextSaying() {
    var box = $("saying");
    box.className = "fade out";
    setTimeout(function () {
      sayingIndex = (sayingIndex + 1) % sayings.length;
      showSaying();
      box.className = "fade";
    }, 1500);
  }
  showSaying();
  setInterval(nextSaying, SAYING_SECONDS * 1000);
  window.nextSaying = nextSaying;

  // ---------- the greeting moves every few minutes (and saves the screen from burn-in) ----------
  var slot = 0;
  function moveGreeting() {
    var box = $("hello");
    box.className = "fade out";
    setTimeout(function () {
      slot = (slot + 1) % SLOTS.length;
      box.style.left = SLOTS[slot][0] + "px";
      box.style.top = SLOTS[slot][1] + "px";
      box.className = "fade";
    }, 1500);
  }
  setInterval(moveGreeting, MOVE_MINUTES * 60000);
  window.moveGreeting = moveGreeting;

  // ---------- stars (drawn once) ----------
  (function drawStars() {
    var c = $("stars"), g = c.getContext && c.getContext("2d");
    if (!g) return;
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 170; i++) {
      var x = rnd() * 1920, y = rnd() * 760, r = rnd() * 1.6 + 0.3;
      g.globalAlpha = 0.25 + rnd() * 0.75;
      g.fillStyle = rnd() > 0.85 ? "#ffd9c2" : "#ffffff";
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  })();

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    setText(t, msg);
    t.className = "show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ""; }, 6000);
  }

  // ---------- launch YouTube ----------
  function launchByRest() {
    var x = new XMLHttpRequest();
    x.open("POST", YOUTUBE_REST, true);
    x.onload = function () { if (x.status >= 300) toast("YouTube did not open (REST " + x.status + ")"); };
    x.onerror = function () { toast("YouTube did not open"); };
    x.send();
  }
  function launchYouTube() {
    if (!onTV) { toast("Preview: YouTube opens on the TV"); return; }
    var i = 0;
    (function next() {
      if (i >= YOUTUBE_APP_IDS.length) { launchByRest(); return; }
      var id = YOUTUBE_APP_IDS[i++];
      try {
        window.tizen.application.launch(id, function () {}, function () { next(); });
      } catch (e) { next(); }
    })();
  }

  // ---------- remote ----------
  var KEY_ENTER = 13, KEY_RETURN = 10009, KEY_LEFT = 37, KEY_RIGHT = 39;
  document.addEventListener("keydown", function (e) {
    var k = e.keyCode;
    if (k === KEY_ENTER) { e.preventDefault(); launchYouTube(); }
    else if (k === KEY_RIGHT) { e.preventDefault(); nextSaying(); }   // a new saying now
    else if (k === KEY_RETURN || k === KEY_LEFT) { e.preventDefault(); } // this is home: Back stays here
  });
  $("yt").addEventListener("click", launchYouTube);
})();
