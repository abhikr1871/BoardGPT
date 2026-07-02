import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A completed game synced from the extension. `clientId` is the id the client
 * generated (crypto.randomUUID); it is unique+sparse so re-syncing the same
 * game is idempotent (upsert) while games without a clientId are still allowed.
 * Field names mirror the extension's StoredGame / GameReview shapes.
 */
const gameSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: String, unique: true, sparse: true },
    pgn: { type: String, required: true },
    result: { type: String, default: '*' },
    platform: { type: String, default: 'chess.com' },
    playedAt: { type: Date, default: Date.now },
    opponent: { type: String },
    timeControl: { type: String },
    myColor: { type: String, enum: ['w', 'b'], required: true },
    accuracy: { type: Number },
    blunders: { type: Number },
    mistakes: { type: Number },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false },
);

// Fast "my games, newest first" listing.
gameSchema.index({ userId: 1, playedAt: -1 });

export type Game = InferSchemaType<typeof gameSchema>;
export type GameDoc = HydratedDocument<Game>;
export const GameModel = model('Game', gameSchema);
