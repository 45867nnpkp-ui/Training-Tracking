// Winziger Schlüssel-Wert-Speicher in IndexedDB. Hält den Trainingsplan, die
// laufende Einheit und die Warteschlange für das Hochladen – auch offline.

const DB_NAME = "training-tracking";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>("readonly", (s) => s.get(key));
}

export function idbSet<T>(key: string, value: T): Promise<void> {
  return run<IDBValidKey>("readwrite", (s) => s.put(value, key)).then(() => undefined);
}

export function idbDelete(key: string): Promise<void> {
  return run<undefined>("readwrite", (s) => s.delete(key));
}
