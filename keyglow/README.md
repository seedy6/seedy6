# Keyglow: learn the keyboard on an Android tablet

Keyglow listens to your keyboard through the tablet's microphone (or a USB/Bluetooth MIDI cable). It shows the
notes falling onto a glowing on-screen keyboard and teaches you step by step, with levels, stars, streaks and
achievements. It has a **Kids mode** (bright, playful, with Pip the bird, gentle scoring) and an **Adult mode**
(sleek dark look, timing scores, every song open).

## Install on the tablet

On the Android tablet, open this link in the browser and install the APK:

**https://github.com/seedy6/seedy6/releases/download/keyglow-latest/keyglow.apk**

Android will ask you to allow installs from the browser the first time. Every push to `keyglow/` rebuilds the
APK at the same link, signed with the same key, so new versions install over the old one. In the app,
**Settings → Get the latest version** opens that link.

## What's inside

| | |
| --- | --- |
| **Hearing your keyboard** | The microphone's sound is matched against a "fingerprint" of every key. It handles single notes, chords and both hands, with about 50–60 ms delay. **Calibrate** records your own keyboard in your room (about 30 seconds for the quick version). A MIDI cable is detected automatically and is exact. |
| **Course** | 7 units, 25 lessons: finding middle C, finger numbers, C position, rhythm, note reading (treble and bass), the left hand, hands together, chords, scales with thumb-under, sharps, minor keys, then Beethoven, Mozart, Bach and Pachelbel. Lessons unlock one by one. |
| **Songs** | 28 public-domain songs at levels 1–5, from *Hot Cross Buns* to Bach's *Prelude in C*, most with both hands. You can choose the hands, the speed and the mode for each song. |
| **Modes** | **Learn** waits for you at every note. **Play** keeps time and scores each note Perfect, Great or Good, with combos. **Listen** plays the song to you. You can also loop two bars, use a metronome, set the speed from 40% to 125%, and have the app play the other hand. |
| **Practice** | Scales (major, natural minor, harmonic minor) with fingering, five-finger patterns, chords (I–IV–V–I), arpeggios, contrary motion, rhythm drills, endless random sight-reading, note-reading quizzes and ear training. |
| **Import MP3** | Pick a recording of solo piano or keyboard. Spotify's Basic Pitch model writes down the notes on the tablet itself, then the app finds the tempo and splits the notes between your hands. You choose *melody only*, *easy* or *every note*, and can play along with the original recording. MIDI files import exactly. |
| **Progress** | XP and levels, 21 achievements (stickers in Kids mode), a daily-minutes goal, a streak and a two-week chart. Several players can share one tablet. |
| **Free play** | Play anything and the notes float up as light, with live note and chord names. |

### Tips for the microphone
- Put the tablet near the keyboard's speakers and use a piano sound.
- Calibrate once (Home → Calibrate). The timing check at the end improves Play-mode scores.
- If notes are missed, raise **Settings → Microphone sensitivity**. If notes appear by themselves, lower it.
- Headphones on the tablet stop the app's own sound (the other hand, Listen mode) reaching the microphone.

## How it's built

An Android app (Kotlin, `MainActivity.kt`) shows the web app in `app/src/main/assets/web` full-screen. The page is
served from `https://appassets.androidplatform.net/`, which counts as a secure origin and so can use the
microphone. The Android side adds the microphone permission, the file picker, MIDI (`MidiBridge.kt`), "open with"
for audio files, and the back button.

```
app/src/main/assets/web/js/
  audio/dsp.js          FFT, log-frequency spectrum, template decomposition (NMF)
  audio/tracker.js      note on/off decisions, calibration recorders
  audio/mic.js          microphone → tracker → input events
  audio/engine.js       sampled piano, metronome, sound effects
  music/                theory, song notation, the song library, course, exercises, MP3/MIDI transcription
  game/session.js       wait/play/listen clock, timing judgements, scoring, stars
  game/progress.js      profiles, XP, levels, streaks, achievements
  ui/piano.js           canvas waterfall and keyboard
  screens/              one file per screen (Preact + htm, no build step)
```

**Tests:** `node --test tests/*.test.mjs` runs on every build. It checks that every bar of every song adds up, that
every lesson and exercise builds, and the wait/play scoring rules.

**Detector check:** `KEYGLOW_PCM=<dir> node tools/eval-detector.mjs [--calibrated]` plays real piano recordings
through the detector. On a piano it was not built from, after calibration, it finds 96–100% of single notes,
melodies and triads, and all of them in lesson (expected-note) mode.

## Credits and licences

- Piano samples: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC-BY 3.0
  (via the `@audio-samples/piano-mp3-velocity8` package)
- Transcription: [Basic Pitch](https://github.com/spotify/basic-pitch-ts) by Spotify, Apache 2.0, with TensorFlow.js
  (Apache 2.0) and @tonejs/midi (MIT)
- UI: [Preact](https://preactjs.com) and [htm](https://github.com/developit/htm), MIT
- Fonts: Outfit and Fredoka, SIL Open Font License
- Songs: traditional and classical melodies in the public domain, arranged for learning. Hello Middle C, Five Little
  Fingers and Robot March are original.

`tools/` holds the scripts that rebuilt the vendor bundles (`bp-entry.js`, `ui-entry.js` with esbuild) and the
piano templates (`build-templates.mjs`). `art/` holds the app icon.
