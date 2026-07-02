import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { MistakeModel } from '../models/Mistake.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../types.js';

const router = Router();
router.use(requireAuth);

/** Shape the extension sends (mirrors lib/mistakeDB.ts `Mistake`). */
interface MistakeInput {
  id?: string;
  fen?: unknown;
  badMove?: unknown;
  bestMove?: unknown;
  cpLoss?: unknown;
  theme?: unknown;
  nextReview?: unknown;
  interval?: unknown;
  ease?: unknown;
  reps?: unknown;
  createdAt?: unknown;
}

function normalize(userId: mongoose.Types.ObjectId, m: MistakeInput) {
  if (
    typeof m.fen !== 'string' ||
    typeof m.badMove !== 'string' ||
    typeof m.bestMove !== 'string' ||
    typeof m.cpLoss !== 'number' ||
    typeof m.theme !== 'string'
  ) {
    return null;
  }
  const now = Date.now();
  return {
    userId,
    clientId: typeof m.id === 'string' ? m.id : undefined,
    fen: m.fen,
    badMove: m.badMove,
    bestMove: m.bestMove,
    cpLoss: m.cpLoss,
    theme: m.theme,
    nextReview: typeof m.nextReview === 'number' ? m.nextReview : now,
    interval: typeof m.interval === 'number' ? m.interval : 1,
    ease: typeof m.ease === 'number' ? m.ease : 2.5,
    reps: typeof m.reps === 'number' ? m.reps : 0,
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : now,
  };
}

/** GET /api/mistakes — every mistake for the user, most recent first. */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  const mistakes = await MistakeModel.find({ userId }).sort({ createdAt: -1 }).lean();
  res.json({ mistakes });
}));

/**
 * POST /api/mistakes — bulk upsert for cloud sync of the spaced-repetition data.
 * Accepts either an array or `{ mistakes: [...] }`. Dedupes on (userId, fen,
 * badMove) so re-syncing updates the SM-2 fields (interval/ease/reps/nextReview)
 * in place rather than duplicating drills.
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  const oid = new mongoose.Types.ObjectId(userId);

  const raw = Array.isArray(req.body) ? req.body : (req.body?.mistakes as unknown);
  if (!Array.isArray(raw)) {
    res.status(400).json({ error: 'Expected an array of mistakes or { mistakes: [...] }' });
    return;
  }

  const docs = raw.map((m) => normalize(oid, m as MistakeInput)).filter((d): d is NonNullable<typeof d> => d !== null);
  if (docs.length === 0) {
    res.json({ synced: 0, upserted: 0, skipped: raw.length });
    return;
  }

  const ops: mongoose.AnyBulkWriteOperation[] = docs.map((doc) => ({
    updateOne: {
      filter: { userId: oid, fen: doc.fen, badMove: doc.badMove },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const result = await MistakeModel.bulkWrite(ops, { ordered: false });
  const synced = result.upsertedCount + result.modifiedCount;
  // `synced` is what the extension's cloudSync reads back as the accepted count.
  res.json({
    synced,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
    skipped: raw.length - docs.length,
  });
}));

export default router;
