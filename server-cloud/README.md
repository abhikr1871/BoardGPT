# BoardGPT — Cloud Backend (`server-cloud`)

A self-contained cloud API for the BoardGPT chess extension implementing
**Phase 3-cloud + Phase 5** of the roadmap:

- **MongoDB** game + mistake history (Mongoose 8)
- **JWT auth** (register / login / me) with bcrypt password hashing
- **Razorpay** subscription payments (hosted checkout + signed webhook)

> This service is **independent** of the existing [`../server`](../server) (a
> Fastify + Postgres backend for local/demo use). You can run either or both;
> they share no code, database, or port. Use `../server` for zero-setup local
> Postgres, and this one when you want hosted MongoDB Atlas + accounts + billing.

## Stack

Node 20+, TypeScript (ESM), Express 4, Mongoose 8, jsonwebtoken, bcryptjs,
razorpay, cors, dotenv. Runs via [`tsx`](https://github.com/privatenumber/tsx) —
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
| `RAZORPAY_KEY_ID` | no* | `rzp_test_…` / `rzp_live_…` from **Dashboard → Settings → API Keys**. Without it, the payment routes return 503. |
| `RAZORPAY_KEY_SECRET` | no* | The secret shown once when you generate the API key. Also used to verify the `/api/payment/verify` signature. |
| `RAZORPAY_WEBHOOK_SECRET` | no* | The signing secret you set when creating the webhook. Needed to verify `/api/webhook` events. |
| `RAZORPAY_PLAN_MONTHLY` | no* | A subscription **Plan** ID (`plan_…`) for the ₹99/month plan. |
| `RAZORPAY_PLAN_YEARLY` | no* | A subscription **Plan** ID (`plan_…`) for the ₹799/year plan. |
| `PREMIUM_TOTAL_COUNT_MONTHLY` | no | Billing cycles before a monthly subscription completes. Default `120` (~10 years). |
| `PREMIUM_TOTAL_COUNT_YEARLY` | no | Billing cycles before a yearly subscription completes. Default `10` (10 years). |
| `CLIENT_URL` | no | Where the client returns after checkout. Defaults to `http://localhost:5173`. |

\* Razorpay vars are optional for boot. If the keys are unset the server still
starts; `/api/checkout` degrades to a `503` with a clear message (it also
requires **both** plan IDs). **The server will refuse to start if `MONGODB_URI`
or `JWT_SECRET` is missing**, printing which one.

### Setting up Razorpay Subscriptions (optional)

1. **API keys** — In the [Razorpay dashboard](https://dashboard.razorpay.com/app/keys),
   go to **Settings → API Keys → Generate Key**. Put the key ID in
   `RAZORPAY_KEY_ID` and the secret (shown once) in `RAZORPAY_KEY_SECRET`.
2. **Plans** — Create two subscription **Plans**: **monthly ₹99** and **yearly
   ₹799** (currency INR). The quickest way is:
   ```bash
   npm run create-plans   # uses your keys, prints both plan IDs
   ```
   Paste the printed IDs into `RAZORPAY_PLAN_MONTHLY` / `RAZORPAY_PLAN_YEARLY`.
   (Or create them by hand under **Subscriptions → Plans → Create Plan** —
   amounts are in paise: ₹99 = `9900`, ₹799 = `79900`.)
3. **Webhook** — Under **Settings → Webhooks → Add New Webhook**, set the URL to
   `https://YOUR_HOST/api/webhook`, choose a secret, and put that same value in
   `RAZORPAY_WEBHOOK_SECRET`. Subscribe to these events:
   `subscription.activated`, `subscription.charged`, `subscription.resumed`,
   `subscription.cancelled`, `subscription.completed`, `subscription.halted`.

The extension opens the subscription's hosted checkout page via the `short_url`
returned by `/api/checkout` — no client-side Razorpay SDK integration needed.

## Run

```bash
cd server-cloud
npm install
npm run dev      # tsx watch — reloads on change → http://localhost:4000
# or
npm start        # tsx (no watch)
npm run typecheck  # tsc --noEmit
npm run create-plans  # create the ₹99/₹799 Razorpay plans, print their IDs
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
| POST | `/api/checkout` | JWT | Body `{ interval: "monthly" \| "yearly" }` → `{ subscriptionId, shortUrl, keyId }`. Creates a Razorpay Subscription and returns its hosted-checkout `short_url`. 503 if subscriptions aren't configured (keys + both plan IDs). |
| POST | `/api/webhook` | Razorpay sig | Raw-body, HMAC-verified webhook. Grants `plan='premium'` (+ `subscriptionEnd` from `current_end`) on `subscription.activated`/`charged`/`resumed`; reverts to `free` on `subscription.cancelled`/`completed`/`halted`. Returns `{ received: true }` (400 on bad signature). |
| POST | `/api/payment/verify` | JWT | Body `{ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }`. Verifies the subscription signature and immediately sets the user premium (covers webhook lag) → `{ success: true }`. 400 on an invalid signature. |

### Misc

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | `{ ok: true, razorpay: boolean }` |

## Data models (MongoDB)

- **User** — `email` (unique), `passwordHash`, `plan` (`free`/`premium`),
  `razorpaySubscriptionId?`, `subscriptionEnd?`, `createdAt`.
- **Game** — `userId` (ref), `clientId` (unique sparse), `pgn`, `result`,
  `platform`, `playedAt`, `opponent?`, `timeControl?`, `myColor`, `accuracy?`,
  `blunders?`, `mistakes?`, `tags[]`.
- **Mistake** — `userId` (ref), `fen`, `badMove`, `bestMove`, `cpLoss`, `theme`,
  `nextReview`, `interval`, `ease`, `reps`, `createdAt` (+ `clientId` for sync).
  Mirrors the extension's `lib/mistakeDB.ts` shape; unique on
  `(userId, fen, badMove)`.
