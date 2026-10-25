// Defaults for Welcome Home. Anything here can be overridden without reinstalling the app
// by pointing remoteConfigUrl at a JSON file (for example one served by the Mac mini).
window.HOME_CONFIG = {
  name: "Saeed",
  theme: "versus", // "versus" (both), "spartan" or "fengwei"; the Menu (≡) button cycles them
  sound: true,
  volume: 0.7,
  // Replay the intro when you come back to the home screen after this many minutes away.
  introAfterMinutes: 120,

  // Prayer times from api.aladhan.com. method 0 = Shia Ithna-Ashari (Jafari);
  // see https://aladhan.com/calculation-methods for the others.
  prayer: { city: "London", country: "United Kingdom", method: 0 },

  // JSON feed of daily metrics from the Mac mini; see mac-mini/README.md for the format.
  // Example: "http://192.168.0.10:8787/tv/metrics.json"
  metricsUrl: "",
  remoteConfigUrl: "",

  // Shown first in the apps row, in this order, when installed. Others follow, minus hiddenApps.
  pinnedApps: [
    "com.amazon.firetv.youtube",
    "com.netflix.ninja",
    "com.amazon.firebat",
    "com.disney.disneyplus",
    "uk.co.bbc.iplayer",
    "com.spotify.tv.android",
    "com.plexapp.android",
    "org.xbmc.kodi"
  ],
  // Kept out of the apps row (they still appear under All apps).
  hiddenApps: [
    "com.amazon.tv.launcher",
    "com.amazon.venezia",
    "com.amazon.tv.notificationcenter",
    "com.amazon.tv.settings.v2",
    "com.amazon.ssm",
    "com.amazon.kso"
  ]
};
