import { Router, type Request, type Response } from 'express';
import type Stripe from 'stripe';
import { env, stripeEnabled } from '../env.js';
import { getStripe } from '../stripe.js';
import { UserModel } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../types.js';

const router = Router();

/** 503 helper for when Stripe is not configured. */
function stripeUnavailable(res: Response): void {
  res.status(503).json({
    error:
      'Payments are not configured on this server. Set STRIPE_SECRET_KEY ' +
      '(and the price/webhook secrets) to enable checkout.',
  });
}

/**
 * POST /api/checkout — create a Stripe Checkout Session for a subscription.
 * Body: { interval: "monthly" | "yearly" }. Returns { url } to redirect to.
 * Reuses/creates the user's Stripe customer so subscriptions stay linked.
 */
router.post('/checkout', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const stripe = getStripe();
  if (!stripe || !stripeEnabled()) {
    stripeUnavailable(res);
    return;
  }

  const { userId } = req as AuthedRequest;
  const interval = (req.body?.interval as string) === 'yearly' ? 'yearly' : 'monthly';
  const price = interval === 'yearly' ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;
  if (!price) {
    res.status(503).json({ error: `No Stripe price configured for ${interval} plan` });
    return;
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Ensure a Stripe customer exists and is persisted for future webhooks.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { userId: user.id, interval },
    success_url: `${env.CLIENT_URL}?checkout=success`,
    cancel_url: `${env.CLIENT_URL}?checkout=cancel`,
  });

  res.json({ url: session.url });
}));

/**
 * POST /api/webhook — Stripe webhook receiver. Mounted with a RAW body parser
 * in index.ts (signature verification needs the exact bytes). Handles:
 *   - checkout.session.completed      → set plan 'premium' + subscriptionEnd
 *   - customer.subscription.deleted   → revert plan to 'free'
 */
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    stripeUnavailable(res);
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a Buffer here thanks to express.raw() in index.ts.
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.userId;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

      // Look up the subscription's current period end for subscriptionEnd.
      let subscriptionEnd: Date | undefined;
      if (typeof session.subscription === 'string') {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        subscriptionEnd = periodEnd(sub);
      }

      const query = userId ? { _id: userId } : customerId ? { stripeCustomerId: customerId } : null;
      if (query) {
        await UserModel.updateOne(query, {
          $set: {
            plan: 'premium',
            ...(customerId ? { stripeCustomerId: customerId } : {}),
            ...(subscriptionEnd ? { subscriptionEnd } : {}),
          },
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      if (customerId) {
        await UserModel.updateOne(
          { stripeCustomerId: customerId },
          { $set: { plan: 'free', subscriptionEnd: periodEnd(sub) ?? new Date() } },
        );
      }
    }
  } catch (err) {
    // Log and still 200 so Stripe does not hammer us with retries on our bug.
    console.error('[webhook] handler error:', err);
  }

  res.json({ received: true });
}));

/**
 * `current_period_end` moved off the top-level Subscription in newer Stripe API
 * versions (it now lives on subscription items). Read it defensively from either
 * place without fighting the SDK types.
 */
function periodEnd(sub: Stripe.Subscription): Date | undefined {
  const anySub = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const seconds = anySub.current_period_end ?? anySub.items?.data?.[0]?.current_period_end;
  return typeof seconds === 'number' ? new Date(seconds * 1000) : undefined;
}

export default router;
