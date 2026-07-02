# BoardGPT — Cloud Backend (`server-cloud`)

A self-contained cloud API for the BoardGPT chess extension implementing
**Phase 3-cloud + Phase 5** of the roadmap:

- **MongoDB** game + mistake history (Mongoose 8)
- **JWT auth** (register / login / me) with bcrypt password hashing
- **Stripe** subscription payments (Checkout + webhook)

> This service is **independent** of the existing [`../server`](../server) (a
> Fastify + Postgres backend for local/demo use). You can run either or both;
> they share no code, database, or port. Use `../server` for zero-setup local
> Postgres, and this one when you want hosted MongoDB Atlas + accounts + billing.

## Stack

Node 20+, TypeScript (ESM), Express 4, Mongoose 8, jsonwebtoken, bcryptjs,
stripe, cors, dotenv. Runs via [`tsx`](https://github.com/privatenumber/tsx) —
no build step needed.

## Configure

Copy the example env file and fill it in:

```bash
cd server-cloud
cp .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | Defaults to `4000`. |
| `MONGODB_URI` | **yes** | MongoDB connection string. For [MongoDB Atlas](https://www.mongodb.com/atlas): create a free cluster → **Connect** → **Drivers** → copy the `mongodb+srv://…` URI and put your DB user's password in it. |
| `JWT_SECRET` | **yes** | Any long random string. Used to sign JWTs. |
| `STRIPE_SECRET_KEY` | no* | `sk_test_…` / `sk_live_…` from the [Stripe dashboard](https://dashboard.stripe.com/apikeys). Without it, the payment routes return 503. |
| `STRIPE_WEBHOOK_SECRET` | no* | `whsec_…` from your webhook endpoint (or `stripe listen`). Needed to verify webhook events. |
| `STRIPE_PRICE_MONTHLY` | no* | A recurring **Price** ID (`price_…`) for the monthly plan. |
| `STRIPE_PRICE_YEARLY` | no* | A recurring **Price** ID for the yearly plan. |
| `CLIENT_URL` | no | Where Stripe Checkout redirects back to. Defaults to `http://localhost:5173`. |

\* Stripe vars are optional for boot. If `STRIPE_SECRET_KEY` is unset the server
still starts; only `/api/checkout` and `/api/webhook` degrade to a `503` with a
clear message. **The server will refuse to start if `MONGODB_URI` or
`JWT_SECRET` is missing**, printing which one.

### Setting up Stripe (optional)

1. In the Stripe dashboard, create a **Product** with two recurring **Prices**
   (monthly and yearly). Copy each Price ID into `STRIPE_PRICE_MONTHLY` /
   `STRIPE_PRICE_YEARLY`.
2. Copy your secret key into `STRIPE_SECRET_KEY`.
3. For webhooks locally, run the [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:4000/api/webhook
   ```
   It prints a `whsec_…` signing secret — put it in `STRIPE_WEBHOOK_SECRET`.
   In production, add a webhook endpoint pointing at `https://YOUR_HOST/api/webhook`
   for the events `checkout.session.completed` and `customer.subscription.deleted`.

## Run

```bash
cd server-cloud
npm install
npm run dev      # tsx watch — reloads on change → http://localhost:4000
# or
npm start        # tsx (no watch)
npm run typecheck  # tsc --noEmit
```

## Endpoints

All `/api/*` and `/me` routes require `Authorization: Bearer <jwt>`.

### Auth

Auth routes are served at the root (matching the extension's `src/lib/auth.ts`)
**and** under an `/auth` alias — e.g. both `POST /login` and `POST /auth/login`
work.

| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| POST | `/register` (`/auth/register`) | – | `{ email, password }` → `{ token, email, plan, user }` |
| POST | `/login` (`/auth/login`) | – | `{ email, password }` → `{ token, email, plan, user }` |
| GET | `/me` (`/auth/me`) | JWT | current user (no `passwordHash`) |

### Games

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/games` | JWT | Create/upsert. Accepts a single game, an array, or `{ games: [...] }` (the extension's cloudSync form). Upserts by `clientId` (falls back to the extension's `id`) for idempotency. Also maps the extension's `StoredGame` fields (`source`→`platform`, `id`→`clientId`, `createdAt`→`playedAt`). Body fields: `{ pgn, myColor?, clientId?, result?, platform?, playedAt?, opponent?, timeControl?, accuracy?, blunders?, mistakes?, tags? }`. Auto-derives tags from PGN headers; `myColor` defaults to `"w"` if absent. Returns `{ synced, ... }`. |
| GET | `/api/games` | JWT | Paginated: `?page&limit`. Filters: `?platform&result`. |
| GET | `/api/games/:id` | JWT | One game (owned by caller). |
| DELETE | `/api/games/:id` | JWT | Delete a game (owned by caller). |

### Mistakes (spaced-repetition sync)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/mistakes` | JWT | All mistakes for the user. |
| POST | `/api/mistakes` | JWT | Bulk upsert. Body: an array or `{ mistakes: [...] }` of the extension's IndexedDB `Mistake` records. Dedupes on `(fen, badMove)`. |

### Payments

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/checkout` | JWT | Body `{ interval: "monthly" \| "yearly" }` → `{ url }` (Stripe Checkout). 503 if Stripe unset. |
| POST | `/api/webhook` | Stripe sig | Raw-body webhook. Sets `plan`/`subscriptionEnd` on `checkout.session.completed`; reverts to `free` on `customer.subscription.deleted`. |

### Misc

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | `{ ok: true, stripe: boolean }` |

## Data models (MongoDB)

- **User** — `email` (unique), `passwordHash`, `plan` (`free`/`premium`),
  `stripeCustomerId?`, `subscriptionEnd?`, `createdAt`.
- **Game** — `userId` (ref), `clientId` (unique sparse), `pgn`, `result`,
  `platform`, `playedAt`, `opponent?`, `timeControl?`, `myColor`, `accuracy?`,
  `blunders?`, `mistakes?`, `tags[]`.
- **Mistake** — `userId` (ref), `fen`, `badMove`, `bestMove`, `cpLoss`, `theme`,
  `nextReview`, `interval`, `ease`, `reps`, `createdAt` (+ `clientId` for sync).
  Mirrors the extension's `lib/mistakeDB.ts` shape; unique on
  `(userId, fen, badMove)`.
