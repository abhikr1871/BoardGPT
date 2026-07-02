import { DEFAULT_SETTINGS, type Settings } from '../types';

const KEY = 'chessai:settings';

// chrome.storage may be unavailable in non-extension contexts (tests/dev preview).
function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export async function loadSettings(): Promise<Settings> {
  if (!hasChromeStorage()) return { ...DEFAULT_SETTINGS };
  const data = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(data[KEY] ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [KEY]: next });
  }
  return next;
}
