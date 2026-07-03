import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { env, assertEnv, razorpayEnabled } from './env.js';
import { connectDb } from './db.js';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import mistakesRouter from './routes/mistakes.js';
import paymentsRouter from './routes/payments.js';

const app = express();

app.use(cors({ origin: true }));

// Everything parses JSON.
app.use(express.json({ limit: '1mb' }));

// Liveness probe — also reports whether Razorpay is wired up.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, razorpay: razorpayEnabled() });
});

// Routers. Auth is mounted at both the root (/login, /register, /me — what the
// extension's src/lib/auth.ts calls) and under /auth as a namespaced alias.
app.use('/', authRouter);
app.use('/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api/mistakes', mistakesRouter);
// payments router owns both /api/checkout and /api/webhook.
app.use('/api', paymentsRouter);

// 404 for anything unmatched.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler so thrown/rejected handlers return clean 500s.
// (Express identifies error handlers by their four-argument signature.)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

async function main(): Promise<void> {
  // Fail fast with a clear message if MONGODB_URI / JWT_SECRET are missing.
  assertEnv();

  await connectDb();
  console.log('[db] connected to MongoDB');

  if (!razorpayEnabled()) {
    console.warn(
      '[razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set — /api/create-order and /api/verify ' +
        'will return 503. The rest of the API works normally.',
    );
  }

  app.listen(env.PORT, () => {
    console.log(`[server] BoardGPT cloud backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  // Missing MONGODB_URI / JWT_SECRET, or an unreachable DB, land here with a
  // clear message rather than a silent hang.
  console.error('[fatal] failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
