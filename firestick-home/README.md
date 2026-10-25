# Welcome Home: a custom Fire Stick home screen

A replacement home screen for the Fire TV Stick that plugs into the Hisense projector. It opens with an
animated "Welcome, Saeed" intro with sound, then shows:

- the time, the date and the Hijri date
- today's prayer times, with the next one highlighted and a countdown
- daily metrics from the Mac mini
- your apps, with the ones you use first and Amazon's clutter kept out of the row

It has three themes. The Menu (≡) button on the remote cycles through them, and Play/Pause replays the intro.

| Theme | Look |
| --- | --- |
| **Spartan × Feng Wei** (default) | Letterboxed, film-grain versus screen: a wireframe Spartan helmet whose visor lights up sweeps in from the left, Feng Wei in red rim light from the right; they meet in a flash of light, then the name decodes and locks in brushed metal |
| **Feng Wei** | Black and crimson, a brush-stroke slash, gold title slams with impact hits and a gong, rising embers |
| **Spartan** | A HUD with a charging shield ring, decoding text, a "systems online" chime, hex grid and star dust |

All artwork and sound is original and generated in code (CSS, SVG, Web Audio), so there are no game assets
in the app. The fonts (Orbitron, Rajdhani and Bebas Neue) are under the SIL Open Font License.

## Install on the Fire Stick

1. On the Fire Stick, go to **Settings → My Fire TV → About** and click the device name 7 times to turn on
   Developer Options.
2. Install **Downloader** from the Amazon Appstore. In **Settings → My Fire TV → Developer Options → Install
   unknown apps**, allow Downloader.
3. In Downloader, enter:
   `https://github.com/seedy6/seedy6/releases/download/firestick-home-latest/welcome-home.apk`
4. Install it, then open **Welcome Home** from your apps.

Every push to this folder rebuilds the APK at that same link. Every build is signed with the same key, so
new versions install over the old one.

## Make the Home button open it

Fire OS always sends the Home button to Amazon's launcher, and there is no setting to change that. Welcome Home
includes a small accessibility service that notices when Amazon's home screen appears and brings Welcome Home
straight back in front. It only listens to Amazon's launcher, nothing else.

To turn it on, go to **Settings → Accessibility** and switch on **Welcome Home: Home button**, if Fire OS
lists it there. If it isn't listed, turn it on with ADB from the Mac mini on the same Wi-Fi:

```sh
adb connect <fire-stick-ip>:5555
adb shell settings put secure enabled_accessibility_services com.seedy6.welcome/com.seedy6.welcome.HomeRedirectService
adb shell settings put secure accessibility_enabled 1
```

The first `settings put` replaces the list of enabled accessibility services. If you use another one, such as
a button mapper, append it with a `:` separator.

Turn off ADB debugging when you're done. An open ADB port on the Wi-Fi gives full control of the Fire Stick
to anything on the network.

## Settings

Defaults live in [`app/src/main/assets/web/config.js`](app/src/main/assets/web/config.js): name, theme,
sound, prayer location and method, apps to pin and apps to hide. Set `remoteConfigUrl` to a JSON file on the
Mac mini to change any of these without reinstalling.

Prayer times come from the Mac mini when `prayerUrl` is set (`/tv/prayers.json` from `mac-mini/tv_feed.py`, meant to
carry SalahLog's PraySo times). Otherwise they are calculated for Manchester by
[api.aladhan.com](https://aladhan.com/prayer-times-api) with `method: 0`, Shia Ithna-Ashari (Jafari), and the
screen labels them "calculated". Either way they are cached for the day.

## Mac mini metrics

The home screen reads `metricsUrl`, a JSON feed on the local network:

```json
{
  "updated": "2026-10-25T14:00:00Z",
  "metrics": [
    { "label": "Steps", "value": 7420, "target": 10000 },
    { "label": "Sleep", "value": 6.8, "unit": "h", "target": 8 }
  ]
}
```

It shows up to 5 metrics. `target` is optional and adds a progress ring. To try it, run
`python3 mac-mini/tv_feed.py` on the Mac mini, then set `metricsUrl` to
`http://<mac-mini-ip>:8787/tv/metrics.json`. That script serves `metrics.sample.json` until it is wired to
Cortana's real data.

## Working on the design

The whole screen is the web page in `app/src/main/assets/web`. Open `index.html` in a desktop browser to
preview it with stand-in apps and clearly labelled sample data. Use the arrow keys to move, Enter to select,
`m` to switch theme and Esc for Back. Add `?nointro` to the URL to skip the intro.

On the device, `chrome://inspect` on a computer connected over ADB can debug the live page.
