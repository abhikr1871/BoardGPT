import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel, toPlan } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../types.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCredentials(body: unknown): { email: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed) || password.length < 6) return null;
  return { email: trimmed, password };
}

/** POST /register — create an account, return a JWT. */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const creds = parseCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: 'Provide a valid email and a password of at least 6 characters' });
    return;
  }

  const existing = await UserModel.findOne({ email: creds.email }).lean();
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(creds.password, 10);
  const user = await UserModel.create({ email: creds.email, passwordHash });

  const plan = toPlan(user.plan);
  const token = signToken({ userId: user.id, email: user.email, plan });
  // Top-level email/plan mirror the nested user for the extension's auth client.
  res.status(201).json({ token, email: user.email, plan, user: { id: user.id, email: user.email, plan } });
}));

/** POST /login — verify credentials, return a JWT. */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const creds = parseCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: 'Provide a valid email and password' });
    return;
  }

  const user = await UserModel.findOne({ email: creds.email });
  // Same response whether the user is missing or the password is wrong.
  if (!user || !(await bcrypt.compare(creds.password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const plan = toPlan(user.plan);
  const token = signToken({ userId: user.id, email: user.email, plan });
  res.json({ token, email: user.email, plan, user: { id: user.id, email: user.email, plan } });
}));

/** GET /me — the current user, without the password hash. */
router.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  const user = await UserModel.findById(userId).select('-passwordHash').lean();
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user });
}));

export default router;
