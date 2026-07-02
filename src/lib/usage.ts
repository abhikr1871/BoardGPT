import { loadSettings } from './storage';
import { getAuth } from './auth';

/**
 * Free-tier usage tracking. Non-logged-in, non-premium users get a limited
 * number of post-game analyses; after that they're prompted to log in / upgrade.
 * Counter is stored in chrome.storage (falls back to a memory value off-extension).
 */
export const FREE_ANALYSIS_LIMIT = 3;

const KEY = 'boardgpt:freeUses';
let memoryCount = 0;

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

async function getCount(): Promise<number> {
  if (!hasChromeStorage()) return memoryCount;
  const data = await chrome.storage.local.get(KEY);
  return (data[KEY] as number) ?? 0;
}

async function setCount(n: number): Promise<void> {
  memoryCount = n;
  if (hasChromeStorage()) await chrome.storage.local.set({ [KEY]: n });
}

/** Premium (or logged-in with a premium plan) users are never limited. */
export async function isUnlimited(): Promise<boolean> {
  const [settings, auth] = await Promise.all([
    loadSettings().catch(() => null),
    getAuth().catch(() => null),
  ]);
  if (settings?.plan === 'premium') return true;
  if (auth?.plan === 'premium') return true;
  // Any logged-in account gets unlimited analyses on the free plan too;
  // the limit is specifically for anonymous users.
  if (auth?.token) return true;
  return false;
}

export async function freeUsesLeft(): Promise<number> {
  if (await isUnlimited()) return Infinity;
  return Math.max(0, FREE_ANALYSIS_LIMIT - (await getCount()));
}

export async function canAnalyze(): Promise<boolean> {
  return (await freeUsesLeft()) > 0;
}

/** Record one analysis. Returns remaining uses (Infinity if unlimited). */
export async function consumeAnalysis(): Promise<number> {
  if (await isUnlimited()) return Infinity;
  const next = (await getCount()) + 1;
  await setCount(next);
  return Math.max(0, FREE_ANALYSIS_LIMIT - next);
}
