# Salam: home screen for the Samsung TV

A Tizen web app for a 2015 Samsung TV (UE55J6240, Tizen 2.3, 1920x1080).
It shows "Salam, Abu Saeed", the time and date, the Hijri date, the next Shia
event, a saying or hadith each minute, Bolton prayer times and a YouTube tile.

All data is on the TV. The app makes no network calls, except to the TV's own
API at `127.0.0.1:8001` to open YouTube.

## Files

- `app/`: the app (ES5 and old-WebKit CSS only; the 2015 engine has no fetch,
  no CSS variables, no grid and no Intl calendars).
- `app/data.js`: generated sayings, hadith and the Umm al-Qura month table.
- `app/events.js`: Shia events, copied from `firestick-home`.
- `tools/build_data.py`: makes `app/data.js` from thaqalayn.net.
- `tools/subset_font.py`: cuts Amiri down to the Arabic in `data.js`.
- `deploy.sh`: builds, signs, installs and starts the app.

## Remote

- OK: open YouTube.
- Right: show the next saying now.
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
- `tizen run` fails on Tizen 2.3, so `deploy.sh` starts the app with
  `sdb shell 0 was_execute`.
- Prayer times are calculated with the Jafari method (Fajr 16°, Maghrib 4°).
  They can differ from najaf.org by a few minutes.
- The Hijri date is Umm al-Qura. Set `HIJRI_ADJUST` in `app/main.js` if Najaf's
  moon sighting differs. The table ends in 2032; run `tools/build_data.py` again
  before then.
