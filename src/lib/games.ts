import { loadSettings } from './storage';

/** A recorded game (blueprint §11 games resource). */
export interface StoredGame {
  id: string;
  pgn: string;
  result: string;
  source: string;
  createdAt: number;
  syncedToServer?: boolean;
}

const KEY = 'chessai:games';

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export async function listGames(): Promise<StoredGame[]> {
  if (!hasChromeStorage()) return [];
  const data = await chrome.storage.local.get(KEY);
  return (data[KEY] as StoredGame[]) ?? [];
}

/**
 * Persist a finished game locally and (best-effort) push it to the backend
 * through the service worker so the API host-permission / CORS is handled there.
 */
export async function recordGame(input: {
  pgn: string;
  result: string;
  source: string;
}): Promise<StoredGame> {
  const game: StoredGame = {
    id: crypto.randomUUID(),
    pgn: input.pgn,
    result: input.result,
    source: input.source,
    createdAt: Date.now(),
    syncedToServer: false,
  };

  if (hasChromeStorage()) {
    const games = await listGames();
    games.unshift(game);
    await chrome.storage.local.set({ [KEY]: games.slice(0, 200) });
  }

  // Fire-and-forget server sync via background worker.
  const settings = await loadSettings().catch(() => null);
  if (settings?.apiBaseUrl && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime
      .sendMessage({ type: 'SAVE_GAME', game })
      .then((res: any) => {
        if (res?.type === 'GAME_SAVED') void markSynced(game.id);
      })
      .catch(() => {});
  }

  return game;
}

async function markSynced(id: string): Promise<void> {
  if (!hasChromeStorage()) return;
  const games = await listGames();
  const g = games.find((x) => x.id === id);
  if (g) {
    g.syncedToServer = true;
    await chrome.storage.local.set({ [KEY]: games });
  }
}
