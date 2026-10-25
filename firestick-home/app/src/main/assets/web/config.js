// Defaults for Welcome Home. Anything here can be overridden without reinstalling the app
// by pointing remoteConfigUrl at a JSON file (for example one served by the Mac mini).
window.HOME_CONFIG = {
  name: "Saeed",
  theme: "versus", // "versus" (both), "spartan" or "fengwei"; the Menu (≡) button cycles them
  sound: true,
  volume: 0.7,
  // Replay the intro when you come back to the home screen after this many minutes away.
  introAfterMinutes: 120,

  // Prayer times from SalahLog (najaf.org times, cached in Cortana's PocketBase). If it can't be
  // reached they are calculated by api.aladhan.com for the city below with method 0 = Shia
  // Ithna-Ashari (Jafari), and the screen says so.
  salahLogUrl: "https://salah-log.vercel.app/api/prayer-times?location=united-kingdom_manchester",
  prayer: { city: "Manchester", country: "United Kingdom", method: 0 },

  // JSON feed of daily metrics from the Mac mini; see mac-mini/README.md for the format.
  // Example: "http://192.168.0.10:8787/tv/metrics.json"
  metricsUrl: "",
  remoteConfigUrl: "",

  // The apps row: these apps in this order, when installed. All apps shows everything else.
  pinnedApps: [
    "com.stremio.one", // Stremio
    "com.teamsmart.videomanager.tv", // SmartTube (ad-free YouTube for TV); its package name has
    "com.liskovsoft.smarttubetv.beta", // changed between releases, so any of these that is installed
    "com.liskovsoft.smarttubetv", // shows up
    "com.amazon.firetv.youtube", // YouTube on Fire TV
    "com.google.android.youtube.tv" // YouTube on other Android TV devices
  ],
  onlyPinnedApps: true, // false: fill the rest of the row with other installed apps

  // Web apps (for example from the Mac mini) opened full-screen on the TV; Back returns home.
  // A tile only appears once its url is set.
  webApps: [
    { label: "Munajat", subtitle: "Duas", url: "https://munajatlog.vercel.app" }
  ],

  // Kept out of the apps row when onlyPinnedApps is false (they still appear under All apps).
  hiddenApps: [
    "com.amazon.tv.launcher",
    "com.amazon.venezia",
    "com.amazon.tv.notificationcenter",
    "com.amazon.tv.settings.v2",
    "com.amazon.ssm",
    "com.amazon.kso"
  ]
};
