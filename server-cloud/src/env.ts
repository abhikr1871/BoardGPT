import 'dotenv/config';

/**
 * Centralized environment access.
 *
 * Values are read once here. The required vars (MONGODB_URI, JWT_SECRET) are
 * NOT validated at import — instead call {@link assertEnv} once at startup so a
 * missing var surfaces as a single clear log line (see index.ts) rather than a
 * stack trace thrown deep in an import graph.
 *
 * Razorpay vars are optional: the payment routes degrade to 503 when they are
 * absent, which is why the whole server can still boot without them. Checkout
 * additionally requires the two plan IDs — see {@link razorpaySubscriptionsEnabled}.
 */

function read(name: string): string {
  return (process.env[name] ?? '').trim();
}

/** Reads an integer env var, falling back to `fallback` when unset/invalid. */
function readInt(name: string, fallback: number): number {
  const raw = read(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),

  // Required — enforced by assertEnv() at startup.
  MONGODB_URI: read('MONGODB_URI'),
  JWT_SECRET: read('JWT_SECRET'),

  // Optional — the payment routes check these at request time.
  // API keys (also used to verify the /payment/verify signature).
  RAZORPAY_KEY_ID: read('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: read('RAZORPAY_KEY_SECRET'),
  // Webhook signing secret — verifies POST /api/webhook payloads.
  RAZORPAY_WEBHOOK_SECRET: read('RAZORPAY_WEBHOOK_SECRET'),
  // Subscription Plan IDs (plan_...) created in the Razorpay dashboard.
  RAZORPAY_PLAN_MONTHLY: read('RAZORPAY_PLAN_MONTHLY'),
  RAZORPAY_PLAN_YEARLY: read('RAZORPAY_PLAN_YEARLY'),

  // How many billing cycles a subscription runs before it completes.
  // 120 monthly cycles ≈ 10 years; 10 yearly cycles = 10 years.
  PREMIUM_TOTAL_COUNT_MONTHLY: readInt('PREMIUM_TOTAL_COUNT_MONTHLY', 120),
  PREMIUM_TOTAL_COUNT_YEARLY: readInt('PREMIUM_TOTAL_COUNT_YEARLY', 10),

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

/**
 * True when Razorpay API keys are present. Enough to verify a webhook /
 * payment signature, but NOT enough to open a hosted subscription checkout —
 * that also needs the plan IDs (see {@link razorpaySubscriptionsEnabled}).
 */
export function razorpayEnabled(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/**
 * True when Razorpay is configured enough to create a hosted Subscription
 * checkout: API keys AND both plan IDs. `POST /api/checkout` requires this.
 */
export function razorpaySubscriptionsEnabled(): boolean {
  return Boolean(
    razorpayEnabled() && env.RAZORPAY_PLAN_MONTHLY && env.RAZORPAY_PLAN_YEARLY,
  );
}
