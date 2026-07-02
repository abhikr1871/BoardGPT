import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Chess } from 'chess.js';
import { createStore } from './db.js';
import { reviewPgn } from './review.js';

/**
 * BoardGPT backend (blueprint §11). Endpoints:
 *   GET    /health
 *   POST   /api/analyze              (API key)  — analyze a FEN
 *   POST   /api/explain              (API key)  — explanation for moves
 *   POST   /api/games                (JWT)      — save a completed game
 *   GET    /api/games                (JWT)      — list saved games
 *   GET    /api/games/:id            (JWT)      — one game
 *   GET    /api/games/:id/moves      (JWT)      — move-by-move review
 *   POST   /api/games/:id/coach      (JWT)      — coaching summary
 *   GET    /api/user/stats           (JWT)      — performance stats
 *   DELETE /api/games/:id            (JWT)      — delete a game
 *
 * Auth is intentionally light for the demo: if API_KEY / require-auth env vars
 * are unset, requests pass through. Wire real Auth0/JWT here for production.
 */

const store = createStore();
await store.init();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const API_KEY = process.env.API_KEY || '';
const USER_ID = process.env.DEMO_USER_ID || 'demo';

function requireApiKey(req, reply) {
  if (!API_KEY) return true;
  if (req.headers['x-api-key'] === API_KEY) return true;
  reply.code(401).send({ error: 'invalid api key' });
  return false;
}

// --- Health ---
app.get('/health', async () => ({ ok: true, store: store.kind }));

// --- Analyze a FEN (material-based; swap in Stockfish for production) ---
app.post('/api/analyze', async (req, reply) => {
  if (!requireApiKey(req, reply)) return;
  const { fen, multipv = 3 } = req.body ?? {};
  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    return reply.code(400).send({ error: 'invalid FEN' });
  }
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const legal = chess.moves({ verbose: true });
  const scored = legal.map((m) => {
    chess.move(m);
    let mat = 0;
    for (const row of chess.board())
      for (const sq of row) if (sq) mat += (sq.color === 'w' ? 1 : -1) * VALUE[sq.type];
    chess.undo();
    const cp = (chess.turn() === 'w' ? 1 : -1) * mat;
    return { uci: m.from + m.to + (m.promotion ?? ''), san: m.san, cp };
  });
  scored.sort((a, b) => b.cp - a.cp);
  const top = scored.slice(0, multipv).map((s, i) => ({
    rank: i + 1,
    ...s,
    label: i === 0 ? 'BEST' : s.cp >= scored[0].cp - 50 ? 'GOOD' : 'EQUAL',
  }));
  return { fen, evaluation: (top[0]?.cp ?? 0) / 100, moves: top };
});

// --- Explain moves (Claude if key present, else placeholder) ---
app.post('/api/explain', async (req, reply) => {
  if (!requireApiKey(req, reply)) return;
  const { fen, moves = [] } = req.body ?? {};
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { moves: moves.map((m) => ({ ...m, explanation: `${m.san}: engine's choice in this position.` })) };
  }
  // Minimal Claude call; extension already has a richer client.
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-5',
        max_tokens: 500,
        system: 'You are a concise chess coach. Explain each move in 2 sentences as "SAN: explanation".',
        messages: [{ role: 'user', content: `FEN: ${fen}\nMoves: ${moves.map((m) => m.san).join(', ')}` }],
      }),
    });
    const data = await res.json();
    const text = data?.content?.[0]?.text ?? '';
    return { explanation: text, moves };
  } catch (e) {
    return reply.code(502).send({ error: String(e) });
  }
});

// --- Games CRUD ---
app.post('/api/games', async (req) => {
  const { id, pgn, result, source } = req.body ?? {};
  const saved = await store.insertGame({
    client_id: id ?? null,
    user_id: USER_ID,
    pgn: pgn ?? '',
    result: result ?? '*',
    source: source ?? 'chess.com',
  });
  return { id: saved.id, createdAt: saved.created_at };
});

app.get('/api/games', async () => {
  const games = await store.listGames(USER_ID);
  return { games };
});

app.get('/api/games/:id', async (req, reply) => {
  const g = await store.getGame(req.params.id);
  if (!g) return reply.code(404).send({ error: 'not found' });
  return g;
});

app.get('/api/games/:id/moves', async (req, reply) => {
  const g = await store.getGame(req.params.id);
  if (!g) return reply.code(404).send({ error: 'not found' });
  return reviewPgn(g.pgn);
});

app.post('/api/games/:id/coach', async (req, reply) => {
  const g = await store.getGame(req.params.id);
  if (!g) return reply.code(404).send({ error: 'not found' });
  const review = reviewPgn(g.pgn);
  const worst = [...review.moves].sort((a, b) => b.cpLoss - a.cpLoss)[0];
  const summary =
    `You played with ${review.accuracy.white}% (White) / ${review.accuracy.black}% (Black) accuracy. ` +
    (worst && worst.cpLoss >= 100
      ? `The turning point was move ${worst.moveNumber} (${worst.san}). Focus on checking forcing replies before committing.`
      : `Solid game with no major blunders — keep it up.`);
  await store.updateAnalysis(req.params.id, { review, summary });
  return { summary, accuracy: review.accuracy };
});

app.get('/api/user/stats', async () => store.stats(USER_ID));

app.delete('/api/games/:id', async (req, reply) => {
  const ok = await store.deleteGame(req.params.id);
  if (!ok) return reply.code(404).send({ error: 'not found' });
  return { deleted: true };
});

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
