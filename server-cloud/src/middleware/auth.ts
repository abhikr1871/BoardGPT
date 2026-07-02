import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import type { AuthedRequest, JwtPayload } from '../types.js';

/**
 * Verifies `Authorization: Bearer <jwt>` and attaches `req.userId` / `req.plan`.
 * Responds 401 on any missing/invalid/expired token. Downstream handlers can
 * safely cast `req` to {@link AuthedRequest}.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!decoded?.userId) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    const authed = req as AuthedRequest;
    authed.userId = decoded.userId;
    authed.plan = decoded.plan ?? 'free';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Signs a JWT for a user. 30-day expiry keeps the extension logged in. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '30d' });
}
