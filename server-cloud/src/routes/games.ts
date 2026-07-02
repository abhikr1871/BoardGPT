import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { GameModel } from '../models/Game.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../types.js';

const router = Router();
router.use(requireAuth);

/**
 * Best-effort auto-tagging. Derives a few coarse, human-readable tags from the
 * PGN headers and the supplied metadata — opening name/ECO, result for the
 * player, and time-control bucket. Never throws; unknown fields are skipped.
 */
export function deriveTags(input: {
  pgn?: string;
  result?: string;
  myColor?: 'w' | 'b';
  timeControl?: string;
}): string[] {
  const tags = new Set<string>();
  const pgn = input.pgn ?? '';

  const header = (name: string): string | undefined => {
    const m = pgn.match(new RegExp(`\\[${name}\\s+"([^"]*)"\\]`));
    return m?.[1]?.trim() || undefined;
  };

  // Opening name / ECO code from PGN headers, when present.
  const opening = header('Opening') ?? header('ECOUrl')?.split('/').pop()?.replace(/-/g, ' ');
  if (opening) tags.add(`opening:${opening.toLowerCase()}`);
  const eco = header('ECO');
  if (eco) tags.add(`eco:${eco.toUpperCase()}`);

  // Win / loss / draw from the player's point of view.
  const result = input.result ?? header('Result') ?? '*';
  const color = input.myColor;
  if (result === '1/2-1/2') {
    tags.add('draw');
  } else if (color && (result === '1-0' || result === '0-1')) {
    const won = (color === 'w' && result === '1-0') || (color === 'b' && result === '0-1');
    tags.add(won ? 'win' : 'loss');
  }

  // Time-control bucket from a "seconds+increment" style control.
  const tc = input.timeControl ?? header('TimeControl');
  if (tc && tc !== '-') {
    const base = Number(tc.split('+')[0]);
    if (Number.isFinite(base)) {
      if (base <= 120) tags.add('bullet');
      else if (base <= 600) tags.add('blitz');
      else if (base <= 1800) tags.add('rapid');
      else tags.add('classical');
    }
  }

  return [...tags];
}

/**
 * Normalizes one incoming game into a DB doc. Accepts both this API's field
 * names and the extension's `StoredGame` shape (lib/games.ts), which uses
 * `source`/`id`/`createdAt` instead of `platform`/`clientId`/`playedAt` and
 * carries no `myColor`. Returns null if there is no PGN to store. `myColor`
 * defaults to 'w' when the client does not supply it (StoredGame has none).
 */
function buildGameDoc(userId: string, raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as Record<string, unknown>;

  const pgn = typeof body.pgn === 'string' ? body.pgn : '';
  if (!pgn) return null;

  const myColor = body.myColor === 'b' ? 'b' : 'w';
  const result = typeof body.result === 'string' ? body.result : '*';
  const timeControl = typeof body.timeControl === 'string' ? body.timeControl : undefined;
  const platform =
    typeof body.platform === 'string'
      ? body.platform
      : typeof body.source === 'string'
        ? body.source
        : 'chess.com';

  const providedTags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [];
  const tags = [...new Set([...providedTags, ...deriveTags({ pgn, result, myColor, timeControl })])];

  // playedAt from an explicit date, or the StoredGame's createdAt epoch ms.
  const playedAt = body.playedAt
    ? new Date(body.playedAt as string)
    : typeof body.createdAt === 'number'
      ? new Date(body.createdAt)
      : new Date();

  // clientId from an explicit field, or the StoredGame's own id (for idempotency).
  const clientId =
    typeof body.clientId === 'string' ? body.clientId : typeof body.id === 'string' ? body.id : undefined;

  return {
    doc: {
      userId: new mongoose.Types.ObjectId(userId),
      pgn,
      result,
      myColor,
      platform,
      playedAt,
      opponent: typeof body.opponent === 'string' ? body.opponent : undefined,
      timeControl,
      accuracy: typeof body.accuracy === 'number' ? body.accuracy : undefined,
      blunders: typeof body.blunders === 'number' ? body.blunders : undefined,
      mistakes: typeof body.mistakes === 'number' ? body.mistakes : undefined,
      tags,
    },
    clientId,
  };
}

/** Upsert one game (by clientId) or insert it; returns the stored doc. */
async function upsertGame(built: NonNullable<ReturnType<typeof buildGameDoc>>) {
  const { doc, clientId } = built;
  if (clientId) {
    return GameModel.findOneAndUpdate(
      { clientId, userId: doc.userId },
      { $set: { ...doc, clientId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
  }
  const created = await GameModel.create(doc);
  return created.toObject();
}

/**
 * POST /api/games — create/upsert games. Accepts a single game object, an array
 * of games, or `{ games: [...] }` (what the extension's cloudSync sends).
 * Upserts by clientId (falling back to the StoredGame `id`) for idempotency.
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  const body = req.body as unknown;

  // Bulk form: an array, or { games: [...] }.
  const list = Array.isArray(body)
    ? body
    : typeof body === 'object' && body !== null && Array.isArray((body as { games?: unknown }).games)
      ? ((body as { games: unknown[] }).games)
      : null;

  if (list) {
    const built = list.map((g) => buildGameDoc(userId, g)).filter((b): b is NonNullable<typeof b> => b !== null);
    const saved = await Promise.all(built.map(upsertGame));
    res.status(201).json({ synced: saved.length, skipped: list.length - built.length, games: saved });
    return;
  }

  // Single-game form.
  const built = buildGameDoc(userId, body);
  if (!built) {
    res.status(400).json({ error: 'pgn is required (and myColor "w" | "b" is recommended)' });
    return;
  }
  const game = await upsertGame(built);
  res.status(201).json({ synced: 1, game });
}));

/** GET /api/games — paginated list with optional platform / result filters. */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) };
  if (typeof req.query.platform === 'string') filter.platform = req.query.platform;
  if (typeof req.query.result === 'string') filter.result = req.query.result;

  const [games, total] = await Promise.all([
    GameModel.find(filter)
      .sort({ playedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    GameModel.countDocuments(filter),
  ]);

  res.json({ games, page, limit, total, totalPages: Math.ceil(total / limit) });
}));

/** GET /api/games/:id — one game owned by the user. */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid game id' });
    return;
  }
  const game = await GameModel.findOne({ _id: req.params.id, userId }).lean();
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json({ game });
}));

/** DELETE /api/games/:id — delete a game owned by the user. */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid game id' });
    return;
  }
  const result = await GameModel.deleteOne({ _id: req.params.id, userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json({ deleted: true });
}));

export default router;
