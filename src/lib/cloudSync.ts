import { loadSettings } from './storage';
import { listGames } from './games';
import { listMistakes } from './mistakeDB';

/**
 * Cloud sync (Phase 3). Pushes locally-stored games and mistake drills to the
 * backend when the user is logged in. Everything is best-effort: no method ever
 * throws to the caller — each returns a small status object so the UI can render
 * a friendly result. When there is no backend or token configured we short
 * circuit with a `skipped: 'no-backend'` status.
 */

export interface SyncResult {
  ok: boolean;
  synced: number;
  skipped?: 'no-backend' | 'error';
  total?: number;
  message?: string;
}

export interface SyncAllResult {
  ok: boolean;
  games: SyncResult;
  mistakes: SyncResult;
  message: string;
}

interface Endpoint {
  base: string;
  token: string;
}

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Resolve the configured backend + token, or null when either is missing. */
async function resolveEndpoint(): Promise<Endpoint | null> {
  const settings = await loadSettings();
  const base = trimBaseUrl(settings.apiBaseUrl ?? '');
  const token = settings.apiToken?.trim() ?? '';
  if (!base || !token) return null;
  return { base, token };
}

async function pushCollection(
  path: '/api/games' | '/api/mistakes',
  key: 'games' | 'mistakes',
  items: unknown[],
): Promise<SyncResult> {
  const endpoint = await resolveEndpoint();
  if (!endpoint) {
    return { ok: true, synced: 0, skipped: 'no-backend', total: items.length };
  }

  if (items.length === 0) {
    return { ok: true, synced: 0, total: 0 };
  }

  try {
    const res = await fetch(`${endpoint.base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${endpoint.token}`,
      },
      body: JSON.stringify({ [key]: items }),
    });

    if (!res.ok) {
      return {
        ok: false,
        synced: 0,
        skipped: 'error',
        total: items.length,
        message: `Server responded ${res.status}.`,
      };
    }

    // The server may report how many rows it accepted; fall back to "all".
    let accepted = items.length;
    try {
      const body = (await res.json()) as { synced?: number; count?: number };
      if (typeof body.synced === 'number') accepted = body.synced;
      else if (typeof body.count === 'number') accepted = body.count;
    } catch {
      /* non-JSON body is fine */
    }

    return { ok: true, synced: accepted, total: items.length };
  } catch (e) {
    return {
      ok: false,
      synced: 0,
      skipped: 'error',
      total: items.length,
      message: (e as Error).message || 'Network error while syncing.',
    };
  }
}

/** Push local games to the backend. No-op (synced: 0) without a backend/token. */
export async function syncGames(): Promise<SyncResult> {
  try {
    const games = await listGames();
    return await pushCollection('/api/games', 'games', games);
  } catch (e) {
    return { ok: false, synced: 0, skipped: 'error', message: (e as Error).message };
  }
}

/** Push local mistake drills to the backend. No-op without a backend/token. */
export async function syncMistakes(): Promise<SyncResult> {
  try {
    const mistakes = await listMistakes();
    return await pushCollection('/api/mistakes', 'mistakes', mistakes);
  } catch (e) {
    return { ok: false, synced: 0, skipped: 'error', message: (e as Error).message };
  }
}

/** Run both syncs and summarise. Never throws. */
export async function syncAll(): Promise<SyncAllResult> {
  const [games, mistakes] = await Promise.all([syncGames(), syncMistakes()]);

  if (games.skipped === 'no-backend' && mistakes.skipped === 'no-backend') {
    return {
      ok: true,
      games,
      mistakes,
      message: 'Sign in and set a Backend API URL to enable cloud sync.',
    };
  }

  const ok = games.ok && mistakes.ok;
  const total = games.synced + mistakes.synced;
  const message = ok
    ? `Synced ${games.synced} game(s) and ${mistakes.synced} mistake(s).`
    : `Sync finished with issues: ${[games.message, mistakes.message]
        .filter(Boolean)
        .join(' ') || 'unknown error.'}`;

  return { ok, games, mistakes, message: total === 0 && ok ? 'Everything is already up to date.' : message };
}
