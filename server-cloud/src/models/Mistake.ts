import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A spaced-repetition drill mirroring the extension's IndexedDB `Mistake`
 * record (lib/mistakeDB.ts): a position where the player went wrong, scheduled
 * with an SM-2-ish algorithm. `clientId` carries the client's own record id so
 * bulk sync is idempotent per user (see routes/mistakes.ts). The (userId, fen,
 * badMove) index enforces the client's dedupe rule on the server too.
 */
const mistakeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** The client's own record id (crypto.randomUUID), used for idempotent sync. */
    clientId: { type: String },
    /** Position (FEN) the player faced when the mistake was made. */
    fen: { type: String, required: true },
    /** The inferior move the player actually chose (SAN). */
    badMove: { type: String, required: true },
    /** The move the engine recommended instead (SAN). */
    bestMove: { type: String, required: true },
    /** Centipawns lost by playing badMove instead of bestMove. */
    cpLoss: { type: Number, required: true },
    /** Coarse tag, e.g. 'hanging-piece' or 'tactics'. */
    theme: { type: String, required: true },
    /** Epoch ms of the next scheduled review. */
    nextReview: { type: Number, required: true },
    /** Current review interval in days. */
    interval: { type: Number, default: 1 },
    /** SM-2 ease factor (higher = seen less often). */
    ease: { type: Number, default: 2.5 },
    /** Number of successful consecutive reviews. */
    reps: { type: Number, default: 0 },
    createdAt: { type: Number, default: () => Date.now() },
  },
  { versionKey: false },
);

// Enforce the client's (fen + badMove) dedupe rule per user.
mistakeSchema.index({ userId: 1, fen: 1, badMove: 1 }, { unique: true });

export type Mistake = InferSchemaType<typeof mistakeSchema>;
export type MistakeDoc = HydratedDocument<Mistake>;
export const MistakeModel = model('Mistake', mistakeSchema);
