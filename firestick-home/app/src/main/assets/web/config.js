// Defaults for Welcome Home. Anything here can be overridden without reinstalling the app
// by pointing remoteConfigUrl at a JSON file (for example one served by the Mac mini).
window.HOME_CONFIG = {
  name: "Saeed",
  theme: "versus", // "versus" (both), "spartan" or "fengwei"; the Menu (≡) button cycles them
  sound: true,
  volume: 0.7,
  // The intro plays when the Fire Stick starts or wakes from sleep. Coming back from an app after
  // this many minutes away plays it too.
  introAfterMinutes: 120,

  // Prayer times from SalahLog (najaf.org times, cached in Cortana's PocketBase). If it can't be
  // reached they are calculated by api.aladhan.com for the city below with method 0 = Shia
  // Ithna-Ashari (Jafari), and the screen says so.
  salahLogUrl: "https://salah-log.vercel.app/api/prayer-times?location=united-kingdom_manchester",
  prayer: { city: "Manchester", country: "United Kingdom", method: 0 },

  // The Islamic date is calculated (Umm al-Qura), which can be a day off Najaf's moon sighting.
  // Set to -1 or 1 to shift it, the same as Munajat's Hijri adjustment setting.
  hijriAdjust: 0,

  // Weather from open-meteo.com (free, no key).
  weather: { place: "Bolton", latitude: 53.5769, longitude: -2.4282 },

  // JSON feed of daily metrics from the Mac mini; see mac-mini/README.md for the format.
  // Example: "http://192.168.0.10:8787/tv/metrics.json"
  metricsUrl: "",
  remoteConfigUrl: "",

  // The apps row: these apps in this order, when installed. All apps shows everything else.
  pinnedApps: [
    "com.stremio.one", // Stremio
    "org.smarttube.stable", // SmartTube (ad-free YouTube for TV)
    "org.smarttube.beta",
    "label:SmartTube", // any app called SmartTube, in case its package name changes again
    "com.amazon.firetv.youtube", // YouTube on Fire TV
    "com.google.android.youtube.tv" // YouTube on other Android TV devices
  ],
  onlyPinnedApps: true, // false: fill the rest of the row with other installed apps
  // Leave an app out of the row when one of these is installed (SmartTube stands in for YouTube).
  // Entries are package names, or "label:<name>" to match an app by the name it shows.
  replacedBy: {
    "com.amazon.firetv.youtube": ["label:SmartTube"],
    "com.google.android.youtube.tv": ["label:SmartTube"]
  },

  // A photo shown as a round tile in the apps row for `minutes` from when the TV first shows it,
  // and never after `notAfter`. Set to null to turn it off.
  photoTile: { tile: "photos/special-tile.jpg", full: "photos/special-full.jpg", minutes: 10, notAfter: "2026-10-27T23:06:38Z" },

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
