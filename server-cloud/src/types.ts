import type { Request } from 'express';

/**
 * Claims we sign into every JWT. `email`/`plan` are included so the extension's
 * client-side auth helper (src/lib/auth.ts) can display them from the token
 * without an extra round-trip; the server remains the source of truth.
 */
export interface JwtPayload {
  userId: string;
  email: string;
  plan: 'free' | 'premium';
}

/**
 * Express `Request` after the auth middleware has run. `userId` is guaranteed
 * present (the middleware 401s otherwise); `plan` is the value from the token
 * at issue time and may be stale relative to the DB, so treat the DB as source
 * of truth for entitlement checks.
 */
export interface AuthedRequest extends Request {
  userId: string;
  plan: 'free' | 'premium';
}
