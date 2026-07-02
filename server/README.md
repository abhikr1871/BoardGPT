# BoardGPT — Backend

Fastify + Postgres API for recording games and serving analysis (blueprint §11).

## Run it

Zero-setup (in-memory store, great for trying the extension):

```bash
cd server
npm install
npm start           # → http://localhost:3000  (store: memory)
```

With Postgres via Docker:

```bash
cd server
docker compose up   # starts Postgres + the API on :3000 (store: postgres)
```

Or point the API at your own Postgres:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/chessai npm start
```

## Connect the extension

Open the extension **Settings** → set **Backend API URL** to `http://localhost:3000`
(and a token if you set `API_KEY`). Finished Chess.com games are then POSTed to
`/api/games` automatically and appear in the post-game dashboard with a ☁ marker.

## Endpoints (blueprint §11)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | liveness + which store is active |
| POST | `/api/analyze` | analyze a FEN (material eval; swap in Stockfish for prod) |
| POST | `/api/explain` | move explanations (Claude if `ANTHROPIC_API_KEY` set) |
| POST | `/api/games` | save a completed game (used by the extension) |
| GET | `/api/games` | list saved games |
| GET | `/api/games/:id` | one game |
| GET | `/api/games/:id/moves` | move-by-move review |
| POST | `/api/games/:id/coach` | coaching summary (cached to `analysis`) |
| GET | `/api/user/stats` | wins/losses/draws |
| DELETE | `/api/games/:id` | delete a game |

Auth is light for the demo: set `API_KEY` to require `x-api-key` on analyze/explain.
Wire real Auth0/JWT (blueprint §4) for production.

## Env

See `.env.example`. Everything is optional — with no env the server runs in-memory.
