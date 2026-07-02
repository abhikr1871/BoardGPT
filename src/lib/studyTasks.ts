/**
 * Local persistence for scheduled study-plan tasks (Phase 5 calendar).
 *
 * Tasks are stored in `chrome.storage.local` under a single key. When
 * chrome.storage is unavailable (tests / dev preview / SSR) we fall back to an
 * in-memory array so the calendar still works, mirroring the graceful-degrade
 * pattern used by {@link ../lib/games}.
 */

const KEY = 'boardgpt:studyTasks';

/** A single training task the user has scheduled on a given calendar day. */
export interface StudyTask {
  id: string;
  /** Calendar day the task is scheduled for, formatted YYYY-MM-DD (local). */
  date: string;
  title: string;
  category: 'tactics' | 'openings' | 'endgames' | 'review' | 'other';
  done: boolean;
  createdAt: number;
}

// chrome.storage may be unavailable in non-extension contexts (tests/dev preview).
function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

/** In-memory fallback used only when chrome.storage is unavailable. */
let memoryTasks: StudyTask[] = [];

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readAll(): Promise<StudyTask[]> {
  if (!hasChromeStorage()) return memoryTasks.slice();
  try {
    const data = await chrome.storage.local.get(KEY);
    const list = data[KEY] as StudyTask[] | undefined;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeAll(tasks: StudyTask[]): Promise<void> {
  if (!hasChromeStorage()) {
    memoryTasks = tasks.slice();
    return;
  }
  try {
    await chrome.storage.local.set({ [KEY]: tasks });
  } catch {
    /* best-effort persistence; ignore quota / context errors */
  }
}

/** Every scheduled task, most recently created first. */
export async function listTasks(): Promise<StudyTask[]> {
  const all = await readAll();
  return all.slice().sort((a, b) => b.createdAt - a.createdAt);
}

/** Adds a task to the given day (YYYY-MM-DD) and returns the created record. */
export async function addTask(
  date: string,
  title: string,
  category: StudyTask['category'],
): Promise<StudyTask> {
  const task: StudyTask = {
    id: newId(),
    date,
    title: title.trim(),
    category,
    done: false,
    createdAt: Date.now(),
  };
  const all = await readAll();
  all.push(task);
  await writeAll(all);
  return task;
}

/** Flips the `done` flag on a task by id (no-op if the id is unknown). */
export async function toggleTask(id: string): Promise<void> {
  const all = await readAll();
  let changed = false;
  const next = all.map((t) => {
    if (t.id !== id) return t;
    changed = true;
    return { ...t, done: !t.done };
  });
  if (changed) await writeAll(next);
}

/** Deletes a task by id (no-op if the id is unknown). */
export async function removeTask(id: string): Promise<void> {
  const all = await readAll();
  const next = all.filter((t) => t.id !== id);
  if (next.length !== all.length) await writeAll(next);
}
