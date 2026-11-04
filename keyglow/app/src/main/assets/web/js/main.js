// Start-up and the screen switcher.

import { html, render } from './vendor/preact-htm.js';
import { useApp, nav, applySettings, getState, setProfile } from './app.js';
import { initMidi, initComputerKeyboard, onMidiDevices, emit } from './input.js';
import { resumeAudio, loadPiano, allNotesOff } from './audio/engine.js';
import { ToastHost, toast } from './ui/components.js';
import { Welcome } from './screens/welcome.js';
import { Home } from './screens/home.js';
import { Path } from './screens/path.js';
import { Songs } from './screens/songs.js';
import { Practice } from './screens/practice.js';
import { Player } from './screens/player.js';
import { Lesson } from './screens/lesson.js';
import { FreePlay } from './screens/freeplay.js';
import { Calibrate } from './screens/calibrate.js';
import { Import } from './screens/import.js';
import { Settings } from './screens/settings.js';
import { Profile } from './screens/profile.js';
import { Quiz } from './screens/quiz.js';

const SCREENS = {
  welcome: Welcome, home: Home, path: Path, songs: Songs, practice: Practice, player: Player, lesson: Lesson,
  freeplay: FreePlay, calibrate: Calibrate, import: Import, settings: Settings, profile: Profile, quiz: Quiz,
};

function App() {
  const st = useApp();
  const top = st.stack[st.stack.length - 1];
  if (!top) return null;
  const Screen = SCREENS[top.screen] || Home;
  return html`<${Screen} key=${top.key} ...${top.params} /><${ToastHost} />`;
}

function boot() {
  applySettings();
  initMidi();
  initComputerKeyboard();
  const p = getState().profile;
  setProfile(p);
  nav.reset(p ? 'home' : 'welcome');
  render(html`<${App} />`, document.getElementById('app'));
  // Audio may only start after a touch; get it going on the first one, and fetch the piano early.
  const unlock = () => { resumeAudio().then(() => loadPiano()); };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  let lastCount = 0;
  onMidiDevices((list) => {
    if (list.length > lastCount) toast(`🎹 ${list[list.length - 1]} connected`);
    lastCount = list.length;
  });
  window.__kgPause = () => { allNotesOff(); window.dispatchEvent(new Event('kg-pause')); };
  window.__kgResume = () => { resumeAudio(); };
  window.__kgSharedFile = (f) => { nav.go('import', { shared: f }); };
  window.__kgTest = { emit, nav }; // used by the automated browser tests
}

boot();
