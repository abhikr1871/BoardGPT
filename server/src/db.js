import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Data layer. Uses Postgres when DATABASE_URL is set (production/docker),
 * otherwise an in-memory store so the server boots with zero setup for demos
 * and tests. Both expose the same async interface.
 */

function memoryStore() {
  const games = new Map();
  return {
    kind: 'memory',
    async init() {},
    async insertGame(g) {
      // idempotency on client_id
      if (g.client_id) {
        for (const existing of games.values()) {
          if (existing.client_id === g.client_id) return existing;
        }
      }
      const row = {
        id: g.id ?? crypto.randomUUID(),
        client_id: g.client_id ?? null,
        user_id: g.user_id ?? 'demo',
        pgn: g.pgn,
        result: g.result ?? '*',
        source: g.source ?? 'chess.com',
        analysis: g.analysis ?? null,
        created_at: new Date().toISOString(),
      };
      games.set(row.id, row);
      return row;
    },
    async getGame(id) {
      return games.get(id) ?? null;
    },
    async listGames(userId, limit = 50) {
      return [...games.values()]
        .filter((g) => g.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    },
    async updateAnalysis(id, analysis) {
      const g = games.get(id);
      if (g) g.analysis = analysis;
      return g ?? null;
    },
    async deleteGame(id) {
      return games.delete(id);
    },
    async stats(userId) {
      const all = [...games.values()].filter((g) => g.user_id === userId);
      const wins = all.filter((g) => g.result === '1-0').length;
      const losses = all.filter((g) => g.result === '0-1').length;
      const draws = all.filter((g) => g.result === '1/2-1/2').length;
      return { games: all.length, wins, losses, draws };
    },
  };
}

function pgStore(connectionString) {
  const pool = new pg.Pool({ connectionString });
  return {
    kind: 'postgres',
    async init() {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
      await pool.query(sql);
    },
    async insertGame(g) {
      const { rows } = await pool.query(
        `INSERT INTO games (client_id, user_id, pgn, result, source, analysis)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (client_id) WHERE client_id IS NOT NULL
         DO UPDATE SET pgn = EXCLUDED.pgn, result = EXCLUDED.result
         RETURNING *`,
        [g.client_id ?? null, g.user_id ?? 'demo', g.pgn, g.result ?? '*', g.source ?? 'chess.com', g.analysis ?? null],
      );
      return rows[0];
    },
    async getGame(id) {
      const { rows } = await pool.query('SELECT * FROM games WHERE id = $1', [id]);
      return rows[0] ?? null;
    },
    async listGames(userId, limit = 50) {
      const { rows } = await pool.query(
        'SELECT * FROM games WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit],
      );
      return rows;
    },
    async updateAnalysis(id, analysis) {
      const { rows } = await pool.query(
        'UPDATE games SET analysis = $2 WHERE id = $1 RETURNING *',
        [id, analysis],
      );
      return rows[0] ?? null;
    },
    async deleteGame(id) {
      const { rowCount } = await pool.query('DELETE FROM games WHERE id = $1', [id]);
      return rowCount > 0;
    },
    async stats(userId) {
      const { rows } = await pool.query(
        `SELECT
           count(*)::int AS games,
           count(*) FILTER (WHERE result = '1-0')::int AS wins,
           count(*) FILTER (WHERE result = '0-1')::int AS losses,
           count(*) FILTER (WHERE result = '1/2-1/2')::int AS draws
         FROM games WHERE user_id = $1`,
        [userId],
      );
      return rows[0];
    },
  };
}

export function createStore() {
  const url = process.env.DATABASE_URL;
  return url ? pgStore(url) : memoryStore();
}
