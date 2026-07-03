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
 * Razorpay webhook when a subscription activates/charges and back to 'free'
 * when it is cancelled/completed/halted. `passwordHash` is a bcrypt hash — the
 * plaintext never leaves the register/login handlers.
 */
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    plan: { type: String, enum: ['free', 'premium'], default: 'free', required: true },
    // Razorpay subscription this user started (sub_...). Used to resolve the
    // account from webhook events and to reconcile entitlement.
    razorpaySubscriptionId: { type: String },
    // End of the current paid billing cycle (from the subscription's current_end).
    subscriptionEnd: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
