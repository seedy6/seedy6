# Salam: home screen for the Samsung TV

A Tizen web app for a 2015 Samsung TV (UE55J6240, Tizen 2.3, 1920x1080).
It shows:

- "سلام، أبو سعيد", which fades slowly to "سلام، أم سعيد" and back.
- The time, the English date and the Arabic Hijri date on one line, with the
  next Shia event below.
- The weather for Bolton in Arabic: now (with a moving picture), feels-like,
  high and low, wind and chance of rain, and cards for the next three days.
- A saying or hadith each minute, in Arabic and English.
- Bolton prayer times and a YouTube tile.
- A sky that follows the sun, with sparkles and shooting stars at night.

The weather comes from Open-Meteo over plain HTTP: its HTTPS certificate chains
to ISRG Root X2, which this TV does not trust. All other data is on the TV.

## Files

- `app/`: the app (ES5 and old-WebKit CSS only; the 2015 engine has no fetch,
  no CSS variables, no grid and no Intl calendars).
- `app/data.js`: generated sayings, hadith and the Umm al-Qura month table.
- `app/events.js`: Shia events, copied from `firestick-home`.
- `tools/build_data.py`: makes `app/data.js` from thaqalayn.net.
- `app/icons/`: the weather pictures (SVG layers, drawn for this app).
- `tools/subset_font.py`: cuts Amiri down to the Arabic the app uses.
- `deploy.sh`: builds, signs, installs and starts the app.

## Remote

- OK: open YouTube.
- Right: show the next saying now.
- Up: show a report (screen size, engine, weather status).
- Back and Left: do nothing (this is the home screen).

## Install

1. Install Tizen Studio in `~/tizen-studio`, with the Certificate Manager,
   `cert-add-on`, `TV-SAMSUNG-Extension-Tools` and `TV-SAMSUNG-Extension-Resources`.
2. On the TV, open Apps, press 1 2 3 4 5, turn on Developer Mode, and enter
   this computer's IP. Turn the TV off at the wall, then on.
3. Make a signing profile named `salam` (a plain Tizen author certificate works
   on this TV; a Samsung certificate is not necessary):

   ```bash
   ~/tizen-studio/tools/ide/bin/tizen certificate -a SalamHome -p <password> -f salam-author
   ~/tizen-studio/tools/ide/bin/tizen security-profiles add -n salam -a ~/tizen-studio-data/keystore/author/salam-author.p12 -p <password>
   ```

4. Run `./deploy.sh`. Set `TV_IP` if the TV has a different address.

## Known limits

- When YouTube opens, the TV closes Salam. When you exit YouTube, the TV goes
  to the last input. Press the Smart Hub button to go back to Salam.
- At start-up the TV briefly reports a 1280-wide window. The app must not
  resize the page from that value, or the page shrinks into a corner.
- The TV plays only opacity and transform animations. Effects that repaint
  (for example a background-clip text shimmer) do not show.
- `tizen run` fails on Tizen 2.3, so `deploy.sh` starts the app with
  `sdb shell 0 was_execute`.
- Prayer times are calculated with the Jafari method (Fajr 16°, Maghrib 4°).
  They can differ from najaf.org by a few minutes.
- The Hijri date is Umm al-Qura. Set `HIJRI_ADJUST` in `app/main.js` if Najaf's
  moon sighting differs. The table ends in 2032; run `tools/build_data.py` again
  before then.
