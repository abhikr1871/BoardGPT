import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/** Subscription tier. */
export type Plan = 'free' | 'premium';

/**
 * Narrows an arbitrary value (e.g. a Mongoose enum path, which infers as
 * `string`) to the {@link Plan} union, defaulting to 'free'. Keeps the JWT and
 * API responses type-safe without fighting Mongoose's schema inference.
 */
export function toPlan(value: unknown): Plan {
  return value === 'premium' ? 'premium' : 'free';
}

/**
 * An account. `plan` gates premium features; it is flipped to 'premium' by the
 * Stripe webhook on a completed checkout and back to 'free' when a subscription
 * is deleted. `passwordHash` is a bcrypt hash — the plaintext never leaves the
 * register/login handlers.
 */
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    plan: { type: String, enum: ['free', 'premium'], default: 'free', required: true },
    stripeCustomerId: { type: String },
    subscriptionEnd: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
