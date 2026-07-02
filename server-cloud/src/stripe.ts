import Stripe from 'stripe';
import { env } from './env.js';

/**
 * Lazily-constructed Stripe client. Returns null when STRIPE_SECRET_KEY is
 * absent so the app can boot without Stripe configured — the payment routes
 * translate a null client into a 503 instead of crashing. We deliberately do
 * NOT pin `apiVersion` so the installed SDK's default (which matches its bundled
 * types) is used, keeping this type-safe across stripe-node minor upgrades.
 */
let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  client = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  return client;
}
