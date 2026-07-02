import 'dotenv/config';

/**
 * Centralized environment access.
 *
 * Values are read once here. The required vars (MONGODB_URI, JWT_SECRET) are
 * NOT validated at import — instead call {@link assertEnv} once at startup so a
 * missing var surfaces as a single clear log line (see index.ts) rather than a
 * stack trace thrown deep in an import graph.
 *
 * Stripe vars are optional: the payment routes degrade to 503 when they are
 * absent, which is why the whole server can still boot without them.
 */

function read(name: string): string {
  return (process.env[name] ?? '').trim();
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),

  // Required — enforced by assertEnv() at startup.
  MONGODB_URI: read('MONGODB_URI'),
  JWT_SECRET: read('JWT_SECRET'),

  // Optional — payment routes check these at request time.
  STRIPE_SECRET_KEY: read('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: read('STRIPE_WEBHOOK_SECRET'),
  STRIPE_PRICE_MONTHLY: read('STRIPE_PRICE_MONTHLY'),
  STRIPE_PRICE_YEARLY: read('STRIPE_PRICE_YEARLY'),

  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
} as const;

/**
 * Throws a clear error if any required env var is missing. Call once before
 * connecting to the database / starting the server.
 */
export function assertEnv(): void {
  const missing: string[] = [];
  if (!env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!env.JWT_SECRET) missing.push('JWT_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Copy .env.example to .env and set them (see README.md).`,
    );
  }
}

/** True when Stripe is configured enough to open a Checkout Session. */
export function stripeEnabled(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
