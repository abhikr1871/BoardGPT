import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { env, razorpaySubscriptionsEnabled } from '../env.js';
import { getRazorpay } from '../razorpay.js';
import { UserModel } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../types.js';

const router = Router();

/** 503 when Razorpay subscriptions aren't configured (keys + both plan IDs). */
function subscriptionsUnavailable(res: Response): void {
  res.status(503).json({
    error:
      'Subscriptions are not configured on this server. Set RAZORPAY_KEY_ID, ' +
      'RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_MONTHLY and RAZORPAY_PLAN_YEARLY to enable checkout.',
  });
}

/** Timing-safe compare of two hex signatures of equal length. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

type Interval = 'monthly' | 'yearly';

/** Narrows the request body's `interval`, defaulting to 'monthly'. */
function parseInterval(body: unknown): Interval {
  const raw = (body as { interval?: unknown } | null)?.interval;
  return raw === 'yearly' ? 'yearly' : 'monthly';
}

/**
 * POST /api/checkout — create a hosted Razorpay Subscription and return its
 * short_url so the extension can open the hosted checkout page.
 *
 * Body: { interval: 'monthly' | 'yearly' }
 * → 200 { subscriptionId, shortUrl, keyId }
 * → 503 when subscriptions are not configured, 404 when the user is missing.
 */
router.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!razorpaySubscriptionsEnabled()) {
      subscriptionsUnavailable(res);
      return;
    }

    const { userId } = req as AuthedRequest;
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const interval = parseInterval(req.body);
    const plan_id =
      interval === 'yearly' ? env.RAZORPAY_PLAN_YEARLY : env.RAZORPAY_PLAN_MONTHLY;
    const total_count =
      interval === 'yearly'
        ? env.PREMIUM_TOTAL_COUNT_YEARLY
        : env.PREMIUM_TOTAL_COUNT_MONTHLY;

    const sub = await getRazorpay().subscriptions.create({
      plan_id,
      total_count,
      customer_notify: 1,
      notes: { userId, email: user.email, interval },
    });

    // short_url is documented on the hosted-checkout subscription response but
    // may be missing/untyped depending on the SDK — cast narrowly and 500 if
    // Razorpay didn't return one so the client never gets an unusable payload.
    const shortUrl = (sub as { short_url?: string }).short_url;
    if (!shortUrl) {
      res.status(500).json({ error: 'Razorpay did not return a checkout URL' });
      return;
    }

    // Remember the subscription so the webhook can resolve this user later.
    user.razorpaySubscriptionId = sub.id;
    await user.save();

    res.json({
      subscriptionId: sub.id,
      shortUrl,
      keyId: env.RAZORPAY_KEY_ID,
    });
  }),
);

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/** Events that grant premium. */
const ACTIVATING_EVENTS = new Set([
  'subscription.activated',
  'subscription.charged',
  'subscription.resumed',
]);

/** Events that revoke premium. */
const DEACTIVATING_EVENTS = new Set([
  'subscription.cancelled',
  'subscription.completed',
  'subscription.halted',
]);

/** The slice of a Razorpay webhook body this route relies on. */
interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    subscription?: {
      entity?: {
        id?: string;
        current_end?: number | null;
        notes?: Record<string, unknown> | null;
      };
    };
  };
}

/** A hydrated User document as our queries return it (respects the schema's versionKey: false). */
type ResolvedUser = ReturnType<typeof UserModel.hydrate>;

/**
 * Resolves the account a subscription event belongs to: first by the stored
 * `razorpaySubscriptionId`, then by the `userId` we stamped into the
 * subscription's notes at checkout.
 */
async function resolveUser(
  subscriptionId: string | undefined,
  notesUserId: string | undefined,
): Promise<ResolvedUser | null> {
  if (subscriptionId) {
    const bySub = await UserModel.findOne({ razorpaySubscriptionId: subscriptionId });
    if (bySub) return bySub;
  }
  if (notesUserId) {
    const byNotes = await UserModel.findById(notesUserId).catch(() => null);
    if (byNotes) return byNotes;
  }
  return null;
}

/**
 * POST /api/webhook — Razorpay calls this with a signed, RAW JSON body.
 *
 * `express.raw()` (registered in index.ts before express.json) makes req.body a
 * Buffer here. We HMAC that raw buffer with RAZORPAY_WEBHOOK_SECRET and compare
 * to the `x-razorpay-signature` header before trusting anything.
 *
 * → 400 on a missing secret or bad signature.
 * → 200 { received: true } once verified, even for events we don't act on.
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      res.status(400).json({ error: 'Webhook secret is not configured' });
      return;
    }

    const signature = req.headers['x-razorpay-signature'];
    // req.body is a Buffer thanks to express.raw(); fall back defensively.
    const rawBody: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (typeof signature !== 'string' || !safeEqualHex(expected, signature)) {
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    let body: RazorpayWebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookBody;
    } catch {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    const event = body.event;
    const entity = body.payload?.subscription?.entity;
    const subscriptionId = entity?.id;
    const notesUserId =
      typeof entity?.notes?.userId === 'string' ? (entity.notes.userId as string) : undefined;

    if (event && (ACTIVATING_EVENTS.has(event) || DEACTIVATING_EVENTS.has(event))) {
      const user = await resolveUser(subscriptionId, notesUserId);
      if (user) {
        if (ACTIVATING_EVENTS.has(event)) {
          user.plan = 'premium';
          if (subscriptionId) user.razorpaySubscriptionId = subscriptionId;
          const currentEnd = entity?.current_end;
          if (typeof currentEnd === 'number' && currentEnd > 0) {
            user.subscriptionEnd = new Date(currentEnd * 1000);
          }
        } else {
          user.plan = 'free';
        }
        await user.save();
      }
    }

    // Signature verified: acknowledge so Razorpay stops retrying, even for
    // event types we intentionally ignore.
    res.status(200).json({ received: true });
  }),
);

// ---------------------------------------------------------------------------
// Client-side signature verification (covers webhook lag)
// ---------------------------------------------------------------------------

/**
 * POST /api/payment/verify — the hosted-checkout success handler posts back the
 * subscription payment IDs + signature. We verify them and flip the user to
 * premium immediately so entitlement isn't blocked on webhook delivery.
 *
 * Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 * → 200 { success: true } on a valid signature, 400 otherwise.
 */
router.post(
  '/payment/verify',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!razorpaySubscriptionsEnabled()) {
      subscriptionsUnavailable(res);
      return;
    }

    const { userId } = req as AuthedRequest;
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    } = (req.body ?? {}) as Record<string, unknown>;

    if (
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_subscription_id !== 'string' ||
      typeof razorpay_signature !== 'string'
    ) {
      res.status(400).json({ error: 'Missing payment verification details' });
      return;
    }

    // For subscriptions the signed message is `payment_id|subscription_id`.
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');

    if (!safeEqualHex(expected, razorpay_signature)) {
      res.status(400).json({ error: 'Invalid payment signature' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.plan = 'premium';
    user.razorpaySubscriptionId = razorpay_subscription_id;
    await user.save();

    res.json({ success: true });
  }),
);

export default router;
