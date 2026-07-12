import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { env, razorpayEnabled } from '../env.js';
import { getRazorpay } from '../razorpay.js';
import { UserModel } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../types.js';

const router = Router();

/** 503 when Razorpay keys aren't configured. */
function paymentsUnavailable(res: Response): void {
  res.status(503).json({
    error: 'Payments are not configured on this server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable checkout.',
  });
}

const PRICE_MAP: Record<'monthly' | 'yearly', number> = {
  monthly: 9900, // ₹99
  yearly: 79900, // ₹799
};

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
 * POST /api/checkout — create a Razorpay Payment Link and return its
 * short_url so the extension can open the hosted checkout page.
 *
 * Body: { interval: 'monthly' | 'yearly' }
 * → 200 { linkId, shortUrl, keyId }
 * → 503 when payments are not configured, 404 when the user is missing.
 */
router.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!razorpayEnabled()) {
      paymentsUnavailable(res);
      return;
    }

    const { userId } = req as AuthedRequest;
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const interval = parseInterval(req.body);
    const amount = PRICE_MAP[interval];

    const link = (await getRazorpay().paymentLink.create({
      amount,
      currency: 'INR',
      description: `BoardGPT Premium (${interval === 'yearly' ? 'Yearly' : 'Monthly'})`,
      customer: { email: user.email },
      notify: { email: true },
      notes: { userId, interval },
    })) as any;

    const shortUrl = (link as any).short_url;
    if (!shortUrl) {
      res.status(500).json({ error: 'Razorpay did not return a checkout URL' });
      return;
    }

    // Remember the payment link ID so the webhook can resolve this user later.
    user.razorpayPaymentLinkId = link.id;
    await user.save();

    res.json({
      linkId: link.id,
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
    payment_link?: {
      entity?: {
        id?: string;
        notes?: Record<string, unknown> | null;
      };
    };
  };
}

/** A hydrated User document as our queries return it (respects the schema's versionKey: false). */
type ResolvedUser = ReturnType<typeof UserModel.hydrate>;

/**
 * Resolves the account a payment link event belongs to: first by the stored
 * `razorpayPaymentLinkId`, then by the `userId` we stamped into the
 * link's notes at checkout.
 */
async function resolveUser(
  linkId: string | undefined,
  notesUserId: string | undefined,
): Promise<ResolvedUser | null> {
  if (linkId) {
    const bySub = await UserModel.findOne({ razorpayPaymentLinkId: linkId });
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
    const entity = body.payload?.payment_link?.entity;
    const linkId = entity?.id;
    const notesUserId =
      typeof entity?.notes?.userId === 'string' ? (entity.notes.userId as string) : undefined;
    const interval = typeof entity?.notes?.interval === 'string' ? (entity.notes.interval as string) : 'monthly';

    if (event === 'payment_link.paid') {
      const user = await resolveUser(linkId, notesUserId);
      if (user) {
        user.plan = 'premium';
        if (linkId) user.razorpayPaymentLinkId = linkId;
        
        // Calculate subscription end date (30 days or 365 days)
        const days = interval === 'yearly' ? 365 : 30;
        const end = new Date();
        end.setDate(end.getDate() + days);
        user.subscriptionEnd = end;

        await user.save();
      }
    }

    // Signature verified: acknowledge so Razorpay stops retrying, even for
    // event types we intentionally ignore.
    res.status(200).json({ received: true });
  }),
);

// Webhook is sufficient.

export default router;
