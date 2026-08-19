/* IndexedDB derived cache (D14: discardable acceleration, never evidence).
   Data layer: may touch storage, may not touch the DOM.

   Every operation resolves rather than rejects. The cache is an accelerator, so
   a browser that refuses it degrades to "no cache", never to an error. */

import {POLICY} from '../domain/policy.ts';
import type {NostrEvent} from '../domain/event.ts';

const DB_NAME = 'nosmaps-catalog';
/* v1 held manifest blobs keyed by curator:scope. Revision 2 caches signed
   30078 events keyed by coordinate, so the store changes with the version. */
const DB_VERSION = 2;
const STORE = 'records';
const LEGACY_STORE = 'manifests';

/** A cached record: the signed event plus when we last verified it. */
export interface CachedRecord {
  readonly coordinate: string;
  readonly event: NostrEvent;
  readonly verifiedAt: number;
  readonly relays?: readonly string[];
}

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/** Resolves to an IDBDatabase or null; never rejects. Degrades when IndexedDB
    is unavailable (e.g. node globals) so the app does not throw at load time. */
export function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (!idbAvailable()) {
      resolve(null);
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        if (db.objectStoreNames.contains(LEGACY_STORE)) db.deleteObjectStore(LEGACY_STORE);
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, {keyPath: 'coordinate'});
        }
      } catch { /* noop */ }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function closeQuietly(db: IDBDatabase): void {
  try {
    db.close();
  } catch { /* noop */ }
}

export function putRecord(record: CachedRecord): Promise<void> {
  return new Promise(resolve => {
    void open().then(db => {
      if (!db) {
        resolve();
        return;
      }
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        tx.oncomplete = () => { closeQuietly(db); resolve(); };
        tx.onerror = () => { closeQuietly(db); resolve(); };
        tx.onabort = () => { closeQuietly(db); resolve(); };
      } catch {
        closeQuietly(db);
        resolve();
      }
    });
  });
}

export function getRecord(coordinate: string): Promise<CachedRecord | null> {
  return new Promise(resolve => {
    void open().then(db => {
      if (!db) {
        resolve(null);
        return;
      }
      try {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get(coordinate);
        r.onsuccess = () => {
          closeQuietly(db);
          const result: unknown = r.result;
          resolve(result ? (result as CachedRecord) : null);
        };
        r.onerror = () => { closeQuietly(db); resolve(null); };
      } catch {
        closeQuietly(db);
        resolve(null);
      }
    });
  });
}

export function getAll(): Promise<CachedRecord[]> {
  return new Promise(resolve => {
    void open().then(db => {
      if (!db) {
        resolve([]);
        return;
      }
      try {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).getAll();
        r.onsuccess = () => {
          closeQuietly(db);
          const result: unknown = r.result;
          resolve(Array.isArray(result) ? (result as CachedRecord[]) : []);
        };
        r.onerror = () => { closeQuietly(db); resolve([]); };
      } catch {
        closeQuietly(db);
        resolve([]);
      }
    });
  });
}

export function wipe(): Promise<void> {
  return new Promise(resolve => {
    void open().then(db => {
      if (!db) {
        resolve();
        return;
      }
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => { closeQuietly(db); resolve(); };
        tx.onerror = () => { closeQuietly(db); resolve(); };
        tx.onabort = () => { closeQuietly(db); resolve(); };
      } catch {
        closeQuietly(db);
        resolve();
      }
    });
  });
}

export function deleteDatabase(): Promise<void> {
  return new Promise(resolve => {
    if (!idbAvailable()) {
      resolve();
      return;
    }
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function isFresh(record: CachedRecord | null | undefined, nowMs: number): boolean {
  if (!record || !Number.isFinite(record.verifiedAt)) return false;
  return (nowMs - record.verifiedAt) < POLICY.CATALOG_STALE_AFTER_MS;
}

export const cache = {open, putRecord, getRecord, getAll, wipe, deleteDatabase, isFresh};
