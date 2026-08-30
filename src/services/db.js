// SpecBridge — IndexedDB persistence service
// Stores projects, LLM config, and generated specs locally in the browser.

const DB_NAME = 'specbridge';
const DB_VERSION = 1;
const STORES = {
  projects: 'projects',
  config: 'config',
  templates: 'templates',
};

let db = null;

function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORES.projects)) {
        d.createObjectStore(STORES.projects, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(STORES.config)) {
        d.createObjectStore(STORES.config, { keyPath: 'key' });
      }
      if (!d.objectStoreNames.contains(STORES.templates)) {
        d.createObjectStore(STORES.templates, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

function txn(storeName, mode = 'readonly') {
  return openDB().then((d) => {
    const tx = d.transaction(storeName, mode);
    return tx.objectStore(storeName);
  });
}

export async function dbGet(store, key) {
  const os = await txn(store);
  return new Promise((resolve, reject) => {
    const req = os.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(store, value) {
  const os = await txn(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = os.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll(store) {
  const os = await txn(store);
  return new Promise((resolve, reject) => {
    const req = os.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(store, key) {
  const os = await txn(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = os.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---- Config helpers (localStorage for fast sync access) ----

export function saveConfig(key, value) {
  try {
    localStorage.setItem(`specbridge:${key}`, JSON.stringify(value));
  } catch (_) {}
}

export function loadConfig(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(`specbridge:${key}`);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

export function clearConfig(key) {
  localStorage.removeItem(`specbridge:${key}`);
}
