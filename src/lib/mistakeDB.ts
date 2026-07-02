import type { GameReview } from '../types';

/**
 * Client-side spaced-repetition store for chess mistakes (Phase 3 learning
 * platform). Everything lives in IndexedDB — there is no server. Each mistake
 * is a position where the player went wrong, scheduled for review with an
 * SM-2-ish algorithm so weak spots resurface until they are learned.
 */

const DB_NAME = 'boardgpt-mistakes';
const DB_VERSION = 1;
const STORE = 'mistakes';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Mistake {
  id: string;
  /** Position (FEN) the player faced when the mistake was made. */
  fen: string;
  /** The inferior move the player actually chose (SAN). */
  badMove: string;
  /** The move the engine recommended instead (SAN). */
  bestMove: string;
  /** Centipawns lost by playing badMove instead of bestMove. */
  cpLoss: number;
  /** Coarse tag, e.g. 'hanging-piece' or 'tactics'. */
  theme: string;
  createdAt: number;
  /** Epoch ms of the next scheduled review. */
  nextReview: number;
  /** Current review interval in days. */
  interval: number;
  /** SM-2 ease factor (higher = seen less often). */
  ease: number;
  /** Number of successful consecutive reviews. */
  reps: number;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/**
 * Opens (and lazily migrates) the mistake database. Resolves to null when
 * IndexedDB is unavailable (e.g. SSR, private-mode edge cases) so every caller
 * can degrade gracefully instead of throwing.
 */
function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('nextReview', 'nextReview', { unique: false });
        store.createIndex('fenBadMove', ['fen', 'badMove'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

/** Wraps an IDBRequest in a promise, resolving to a fallback on failure. */
function reqToPromise<T>(req: IDBRequest<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(fallback);
  });
}

async function readAll(): Promise<Mistake[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(STORE, 'readonly');
    const all = await reqToPromise<Mistake[]>(
      tx.objectStore(STORE).getAll() as IDBRequest<Mistake[]>,
      [],
    );
    return all;
  } finally {
    db.close();
  }
}

async function putRecord(m: Mistake): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(m);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}

async function getRecord(id: string): Promise<Mistake | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  try {
    const tx = db.transaction(STORE, 'readonly');
    const rec = await reqToPromise<Mistake | undefined>(
      tx.objectStore(STORE).get(id) as IDBRequest<Mistake | undefined>,
      undefined,
    );
    return rec ?? undefined;
  } finally {
    db.close();
  }
}

/** Every stored mistake, most recently created first. */
export async function listMistakes(): Promise<Mistake[]> {
  const all = await readAll();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** Mistakes whose next review is due (nextReview <= now), soonest first. */
export async function dueMistakes(now: number = Date.now()): Promise<Mistake[]> {
  const all = await readAll();
  return all
    .filter((m) => m.nextReview <= now)
    .sort((a, b) => a.nextReview - b.nextReview);
}

/**
 * Persists a new mistake. Deduplicates on the (fen + badMove) pair: if the same
 * blunder from the same position already exists, the existing record is
 * returned unchanged rather than creating a duplicate drill.
 */
export async function saveMistake(
  m: Omit<Mistake, 'id' | 'createdAt' | 'nextReview' | 'interval' | 'ease' | 'reps'>,
): Promise<Mistake> {
  const now = Date.now();
  const existing = (await readAll()).find(
    (x) => x.fen === m.fen && x.badMove === m.badMove,
  );
  if (existing) return existing;

  const record: Mistake = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`,
    fen: m.fen,
    badMove: m.badMove,
    bestMove: m.bestMove,
    cpLoss: m.cpLoss,
    theme: m.theme,
    createdAt: now,
    nextReview: now, // due immediately
    interval: 1,
    ease: 2.5,
    reps: 0,
  };
  await putRecord(record);
  return record;
}

/**
 * Grades a review. On a correct answer the interval roughly doubles
 * (1 → 2 → 4 → … days) and the ease drifts up; on a miss the interval resets to
 * one day and the ease drops (floored at 1.3), so hard positions come back fast.
 */
export async function reviewMistake(id: string, correct: boolean): Promise<void> {
  const rec = await getRecord(id);
  if (!rec) return;

  const now = Date.now();
  if (correct) {
    rec.reps += 1;
    // First success promotes to a 1-day gap, then doubling thereafter.
    rec.interval = rec.reps <= 1 ? 1 : Math.min(rec.interval * 2, 365);
    rec.ease = Math.min(rec.ease + 0.15, 3.0);
  } else {
    rec.reps = 0;
    rec.interval = 1;
    rec.ease = Math.max(rec.ease - 0.2, 1.3);
  }
  rec.nextReview = now + rec.interval * DAY_MS;
  await putRecord(rec);
}

/**
 * Coarse theme heuristic. A very large centipawn loss usually means a piece
 * was left hanging; smaller (but still mistake-level) losses are typically
 * missed tactics.
 */
function themeFor(cpLoss: number): string {
  return cpLoss >= 300 ? 'hanging-piece' : 'tactics';
}

/**
 * Walks a completed {@link GameReview} and captures every mistake/blunder the
 * given side made as a spaced-repetition drill. Returns how many new mistakes
 * were saved (duplicates are skipped by {@link saveMistake}).
 */
export async function captureFromReview(
  review: GameReview,
  myColor: 'w' | 'b',
): Promise<number> {
  let saved = 0;
  for (const move of review.moves) {
    if (move.color !== myColor) continue;
    if (move.quality !== 'mistake' && move.quality !== 'blunder') continue;

    const before = await readAll();
    const existed = before.some(
      (x) => x.fen === move.fenBefore && x.badMove === move.san,
    );
    await saveMistake({
      fen: move.fenBefore,
      badMove: move.san,
      bestMove: move.bestSan,
      cpLoss: move.cpLoss,
      theme: themeFor(move.cpLoss),
    });
    if (!existed) saved += 1;
  }
  return saved;
}
