// Saved data. Small things live in localStorage; imported songs (and their audio) in IndexedDB.

const PREFIX = 'keyglow.';
const memory = new Map(); // fallback when storage is unavailable

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? (memory.has(key) ? memory.get(key) : fallback) : JSON.parse(v);
    } catch (e) {
      return memory.has(key) ? memory.get(key) : fallback;
    }
  },
  set(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* full or blocked */ }
  },
  remove(key) {
    memory.delete(key);
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* blocked */ }
  },
  update(key, fallback, fn) {
    const v = fn(store.get(key, fallback));
    store.set(key, v);
    return v;
  },
};

// ---- IndexedDB for imported songs ----------------------------------------------------------------

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open('keyglow', 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(storeName, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(storeName, mode);
    const s = t.objectStore(storeName);
    const r = fn(s);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
  }));
}

export const library = {
  async all() {
    try {
      const d = await db();
      return await new Promise((resolve, reject) => {
        const req = d.transaction('songs').objectStore('songs').getAll();
        req.onsuccess = () => resolve(req.result.sort((a, b) => (b.created || 0) - (a.created || 0)));
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return store.get('importedFallback', []);
    }
  },
  async put(song) {
    try { await tx('songs', 'readwrite', (s) => s.put(song)); }
    catch (e) { store.update('importedFallback', [], (l) => [song, ...l.filter((x) => x.id !== song.id)]); }
  },
  async remove(id) {
    try {
      await tx('songs', 'readwrite', (s) => s.delete(id));
      await tx('audio', 'readwrite', (s) => s.delete(id));
    } catch (e) { store.update('importedFallback', [], (l) => l.filter((x) => x.id !== id)); }
  },
  async putAudio(id, blob) {
    try { await tx('audio', 'readwrite', (s) => s.put(blob, id)); } catch (e) { /* audio is optional */ }
  },
  async getAudio(id) {
    try {
      const d = await db();
      return await new Promise((resolve) => {
        const req = d.transaction('audio').objectStore('audio').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  },
};
