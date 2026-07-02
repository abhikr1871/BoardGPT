/**
 * IndexedDB cache of engine evaluations (blueprint Phase 1.2).
 *
 * Runs in the offscreen document (extension origin) so the cache is shared
 * across Chess.com / Lichess / Chess24 and survives page reloads. Keyed by the
 * full FEN + depth + multipv so castling/en-passant differences never collide.
 * A cache hit returns instantly (0 ms) instead of re-running Stockfish.
 */
import type { RawLine } from './builtinEngine';

export interface CachedEval {
  lines: RawLine[];
  engine: 'stockfish' | 'builtin';
  depth: number;
  ts: number;
}

const DB_NAME = 'boardgpt-eval-cache';
const STORE = 'evals';
const MAX_ENTRIES = 20_000;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

function keyFor(fen: string, depth: number, multipv: number): string {
  return `${fen}|d${depth}|m${multipv}`;
}

export async function getCachedEval(
  fen: string,
  depth: number,
  multipv: number,
): Promise<CachedEval | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(keyFor(fen, depth, multipv));
      req.onsuccess = () => resolve(req.result ? (req.result.value as CachedEval) : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putCachedEval(
  fen: string,
  depth: number,
  multipv: number,
  value: CachedEval,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put({ key: keyFor(fen, depth, multipv), value });
    // Opportunistic trim to bound growth.
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_ENTRIES) {
        const cursorReq = store.openCursor();
        let removed = 0;
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor && removed < 2000) {
            cursor.delete();
            removed++;
            cursor.continue();
          }
        };
      }
    };
  } catch {
    // ignore cache write failures
  }
}
