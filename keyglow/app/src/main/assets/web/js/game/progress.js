// Profiles (one per player, kids or adult), experience points, levels, streaks and achievements.

import { store } from '../store.js';
import { allLessons } from '../music/course.js';

export const AVATARS = ['🦉', '🦊', '🐼', '🐯', '🐙', '🦄', '🐸', '🐧', '🦁', '🐨', '🚀', '🎧', '🌙', '⚡', '🎸', '🌸'];

const KIDS_TITLES = ['Little Note', 'Key Explorer', 'Melody Maker', 'Rhythm Star', 'Chord Wizard', 'Song Superstar', 'Piano Hero', 'Keyboard Legend'];
const ADULT_TITLES = ['Beginner', 'Novice', 'Apprentice', 'Player', 'Intermediate', 'Skilled', 'Advanced', 'Virtuoso'];

/** XP needed to reach a level: 0, 100, 250, 450, 700… */
export const xpForLevel = (n) => 25 * (n - 1) * (n + 2);

export function levelInfo(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const from = xpForLevel(level), to = xpForLevel(level + 1);
  return { level, xp, from, to, progress: (xp - from) / (to - from) };
}

export function levelTitle(level, kids) {
  const t = kids ? KIDS_TITLES : ADULT_TITLES;
  return t[Math.min(t.length - 1, Math.floor((level - 1) / 2))];
}

export const ACHIEVEMENTS = [
  { id: 'first-note', icon: '🎵', title: 'First note', desc: 'Play your first note' },
  { id: 'first-lesson', icon: '🎓', title: 'First lesson', desc: 'Finish a lesson' },
  { id: 'first-song', icon: '🎤', title: 'First song', desc: 'Finish a song' },
  { id: 'three-stars', icon: '⭐', title: 'Star player', desc: 'Get 3 stars on anything' },
  { id: 'perfect', icon: '💎', title: 'Flawless', desc: '100% on a song or lesson' },
  { id: 'combo-25', icon: '🔥', title: 'On fire', desc: 'A 25-note combo' },
  { id: 'combo-100', icon: '☄️', title: 'Unstoppable', desc: 'A 100-note combo' },
  { id: 'both-hands', icon: '🤝', title: 'Teamwork', desc: 'Play hands together' },
  { id: 'play-mode', icon: '⏱️', title: 'In time', desc: 'Finish a song in Play mode' },
  { id: 'streak-3', icon: '📅', title: 'Habit forming', desc: 'Practise 3 days in a row' },
  { id: 'streak-7', icon: '🏆', title: 'Week of music', desc: 'Practise 7 days in a row' },
  { id: 'streak-30', icon: '👑', title: 'Devoted', desc: 'Practise 30 days in a row' },
  { id: 'goal', icon: '🎯', title: 'Goal!', desc: 'Reach your daily goal' },
  { id: 'unit-1', icon: '🎹', title: 'Keyboard friend', desc: 'Finish unit 1' },
  { id: 'half-course', icon: '🧭', title: 'Halfway there', desc: 'Finish half of the course' },
  { id: 'course', icon: '🏅', title: 'Graduate', desc: 'Finish the whole course' },
  { id: 'imported', icon: '📥', title: 'My own music', desc: 'Import a song' },
  { id: 'calibrated', icon: '🎙️', title: 'Tuned in', desc: 'Calibrate your keyboard' },
  { id: 'level-5', icon: '🚀', title: 'Rising', desc: 'Reach level 5' },
  { id: 'level-10', icon: '🌟', title: 'Shining', desc: 'Reach level 10' },
  { id: 'hour', icon: '⌛', title: 'An hour of music', desc: 'Practise for 60 minutes in total' },
];

const today = () => new Date().toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function blankProfile({ name, avatar, mode }) {
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, avatar, mode,
    created: Date.now(),
    xp: 0,
    goalMinutes: mode === 'kids' ? 10 : 15,
    streak: { count: 0, last: null, best: 0 },
    days: {},          // date → seconds practised
    totalSeconds: 0,
    lessons: {},       // id → {stars, best, done}
    songs: {},         // id → {stars, best, bestScore, plays, bestPlay}
    achievements: {},  // id → timestamp
    notes: 0,
  };
}

export const profiles = {
  list: () => store.get('profiles', []),
  current() {
    const id = store.get('currentProfile', null);
    return profiles.list().find((p) => p.id === id) || null;
  },
  select(id) { store.set('currentProfile', id); },
  create(opts) {
    const p = blankProfile(opts);
    store.set('profiles', [...profiles.list(), p]);
    profiles.select(p.id);
    return p;
  },
  save(p) {
    store.set('profiles', profiles.list().map((x) => (x.id === p.id ? p : x)));
    return p;
  },
  remove(id) {
    store.set('profiles', profiles.list().filter((x) => x.id !== id));
    if (store.get('currentProfile') === id) store.remove('currentProfile');
  },
};

/** Adds practice time (seconds) and keeps the streak. Returns new achievements. */
export function addPractice(p, seconds) {
  const d = today();
  const before = p.days[d] || 0;
  p.days[d] = before + seconds;
  p.totalSeconds += seconds;
  if (p.streak.last !== d) {
    p.streak.count = p.streak.last && dayDiff(p.streak.last, d) === 1 ? p.streak.count + 1 : 1;
    p.streak.last = d;
    p.streak.best = Math.max(p.streak.best || 0, p.streak.count);
  }
  const gained = [];
  const goal = p.goalMinutes * 60;
  if (before < goal && p.days[d] >= goal) { p.xp += 25; gained.push(...unlock(p, 'goal')); }
  p.xp += Math.floor((before + seconds) / 60) - Math.floor(before / 60); // 1 XP a minute
  if (p.streak.count >= 3) gained.push(...unlock(p, 'streak-3'));
  if (p.streak.count >= 7) gained.push(...unlock(p, 'streak-7'));
  if (p.streak.count >= 30) gained.push(...unlock(p, 'streak-30'));
  if (p.totalSeconds >= 3600) gained.push(...unlock(p, 'hour'));
  return gained;
}

export function unlock(p, id) {
  if (p.achievements[id]) return [];
  p.achievements[id] = Date.now();
  p.xp += 15;
  return [ACHIEVEMENTS.find((a) => a.id === id)].filter(Boolean);
}

/** Effective streak shown on the home screen (0 if a day was missed). */
export function liveStreak(p) {
  if (!p.streak.last) return 0;
  const gap = dayDiff(p.streak.last, today());
  return gap <= 1 ? p.streak.count : 0;
}

export const todaySeconds = (p) => p.days[today()] || 0;

/**
 * Records the result of a song, exercise or lesson. Returns {xp, levelUp, achievements, best}.
 * kind: 'lesson' | 'song' | 'exercise'
 */
export function recordResult(p, kind, id, res) {
  const before = levelInfo(p.xp).level;
  const achievements = [];
  let xp = 0;
  let best = false;
  if (kind === 'lesson') {
    const prev = p.lessons[id] || { stars: 0, best: 0, done: false };
    xp = prev.done ? 5 + Math.max(0, res.stars - prev.stars) * 10 : 20 + res.stars * 10;
    best = res.accuracy > prev.best;
    p.lessons[id] = { stars: Math.max(prev.stars, res.stars), best: Math.max(prev.best, res.accuracy), done: true };
    achievements.push(...unlock(p, 'first-lesson'));
    achievements.push(...courseAchievements(p));
  } else if (kind === 'song') {
    const prev = p.songs[id] || { stars: 0, best: 0, bestScore: 0, plays: 0 };
    xp = 8 + res.stars * 4 + (res.stars > prev.stars ? (res.stars - prev.stars) * 6 : 0) + (res.mode === 'play' ? 5 : 0);
    best = res.score > (prev.bestScore || 0);
    p.songs[id] = {
      stars: Math.max(prev.stars, res.stars),
      best: Math.max(prev.best, res.accuracy),
      bestScore: Math.max(prev.bestScore || 0, res.score),
      plays: (prev.plays || 0) + 1,
      last: Date.now(),
    };
    achievements.push(...unlock(p, 'first-song'));
    if (res.mode === 'play') achievements.push(...unlock(p, 'play-mode'));
  } else {
    xp = 6 + res.stars * 3;
  }
  if (res.stars >= 3) achievements.push(...unlock(p, 'three-stars'));
  if (res.accuracy >= 0.999 && res.total >= 8) achievements.push(...unlock(p, 'perfect'));
  if (res.maxCombo >= 25) achievements.push(...unlock(p, 'combo-25'));
  if (res.maxCombo >= 100) achievements.push(...unlock(p, 'combo-100'));
  if (res.hands && res.hands.length > 1) achievements.push(...unlock(p, 'both-hands'));
  p.xp += xp;
  achievements.push(...addPractice(p, res.seconds || 0));
  const after = levelInfo(p.xp).level;
  if (after >= 5) achievements.push(...unlock(p, 'level-5'));
  if (after >= 10) achievements.push(...unlock(p, 'level-10'));
  profiles.save(p);
  return { xp, levelUp: after > before ? after : 0, achievements, best };
}

function courseAchievements(p) {
  const lessons = allLessons();
  const done = lessons.filter((l) => p.lessons[l.id]?.done).length;
  const out = [];
  const unit1 = lessons.filter((l) => l.unit.id === 'u1');
  if (unit1.every((l) => p.lessons[l.id]?.done)) out.push(...unlock(p, 'unit-1'));
  if (done >= lessons.length / 2) out.push(...unlock(p, 'half-course'));
  if (done >= lessons.length) out.push(...unlock(p, 'course'));
  return out;
}

/** The next lesson to do: the first not yet finished. */
export function nextLesson(p) {
  const lessons = allLessons();
  return lessons.find((l) => !p.lessons[l.id]?.done) || lessons[lessons.length - 1];
}

/** A lesson is open when it is the first, or the one before it is done. */
export function lessonUnlocked(p, lessonId) {
  const lessons = allLessons();
  const i = lessons.findIndex((l) => l.id === lessonId);
  return i <= 0 || !!p.lessons[lessons[i - 1].id]?.done || !!p.lessons[lessonId]?.done || p.mode === 'adult' && i < 3;
}

/** Kids unlock songs by level; adults have everything open. */
export function songUnlocked(p, song) {
  if (p.mode !== 'kids' || !song.level) return true;
  const lvl = levelInfo(p.xp).level;
  return song.level <= 1 + Math.floor((lvl - 1) / 2) + 1 && song.level <= 1 + lvl;
}

export function songUnlockLevel(song) {
  // Inverse of songUnlocked for display: the first player level that opens this song.
  for (let lvl = 1; lvl < 30; lvl++) if (song.level <= 1 + Math.floor((lvl - 1) / 2) + 1 && song.level <= 1 + lvl) return lvl;
  return 1;
}
