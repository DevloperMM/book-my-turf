# TurfBooking — System Design & Build Spec

## 0. Constraints this doc satisfies

- No double-booking under concurrent requests (DB-level partial unique index on active holds/slots, not app-level locking)
- No double-charge under payment retry / webhook redelivery
- Public dashboard browsable without signup; booking requires Clerk auth
- Clerk → DB sync via Svix webhook
- UI mutations strictly use Server Actions (`src/actions/`); Route Handlers (`src/app/api/`) are external callers ONLY (webhooks, cron, SSE)
- Real-time SSE stream (`api/slots/[slotId]/stream`) backed by Redis pub/sub for instant slot availability broadcast
- Scheduled cron sweep (`api/cron/expire-holds`) for hold expiration
- BullMQ/Redis worker process for async post-payment confirmation, Pino + Sentry for telemetry

---

## 1. Data model (Prisma)

```prisma
enum BookingStatus {
  HELD
  PAID
  CONFIRMED
  EXPIRED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
}

model User {
  id        String   @id
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  bookings  Booking[]
}

model Turf {
  id          String   @id @default(cuid())
  name        String
  location    String
  pricePerHr  Int
  openHour    Int
  closeHour   Int
  slotMinutes Int      @default(60)
  imageUrl    String?
  createdAt   DateTime @default(now())
  bookings    Booking[]
}

model Booking {
  id            String        @id @default(cuid())
  turfId        String
  turf          Turf          @relation(fields: [turfId], references: [id])
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  date          DateTime      @db.Date
  startTime     DateTime
  endTime       DateTime
  status        BookingStatus @default(HELD)
  holdExpiresAt DateTime
  idempotencyKey String       @unique
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  payment       Payment?

  @@unique([turfId, date, startTime]) // Partial Indexes
  @@index([turfId, date])
}

model Payment {
  id             String        @id @default(cuid())
  bookingId      String        @unique
  booking        Booking       @relation(fields: [bookingId], references: [id])
  gatewayOrderId String?       @unique
  amount         Int
  status         PaymentStatus @default(PENDING)
  idempotencyKey String        @unique
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

model WebhookEvent {
  id          String   @id
  type        String
  processedAt DateTime @default(now())
}
```

**Why `startTime`/`endTime` as timestamps, not slot IDs from a pre-generated table:** slots are _computed_ from `Turf.openHour/closeHour/slotMinutes` in your GET endpoint, never stored until someone holds one. Less state, nothing to seed, no "which slots exist for date X" migration problem.

**Why the composite unique index is the whole locking strategy:** Postgres enforces uniqueness atomically at the index level. Two concurrent `INSERT`s for the same `(turfId, date, startTime)` — one commits, one gets a `23505` unique-violation error. You don't need `SELECT ... FOR UPDATE`, don't need a transaction wrapping the check-then-insert, and it works correctly even across multiple app server instances, which a `SELECT FOR UPDATE` inside a single request's transaction handles too but with more code and more chance you get it wrong.

## 2 Auth: Clerk signup → Neon sync

**Don't create the `User` row on first booking request.** Sync it via Clerk's webhook the moment someone signs up, so by the time they try to book, the row already exists and your booking route never has to worry about "does this user exist yet."

**Dashboard visibility — your actual question:**

- `GET /api/turfs` and `GET /api/turfs/[id]/slots?date=...` are **public routes**, no Clerk middleware. Anyone can browse turfs and see what's free, signed in or not. This is good UX — people decide before they commit to signing up.
- The moment they click "hold this slot," that route (`POST /api/bookings`) _is_ behind Clerk (`auth().userId` required, throw `UnauthorizedError` if missing). This is also the natural place to trigger Clerk's sign-in modal client-side if they're not logged in.
- In Clerk's middleware config, list `/api/turfs(.*)` in `publicRoutes` and leave everything under `/api/bookings` and `/api/payments` protected.

## 3. Hold endpoint (the core locking logic)

**Reading availability must also respect expired holds lazily**, because the BullMQ job could be delayed:

---

## 4. Payment idempotency

Two separate idempotency problems, both need solving:

**(a) Your own API being called twice** (user double-clicks "Pay", or the client retries a timed-out request).

**(b) The gateway redelivering the same webhook event** (Razorpay/Stripe both explicitly warn: expect duplicates, expect out-of-order delivery).

Note the `where: { ..., status: "PENDING" }` / `status: "HELD"` pattern — Prisma's `update` only matches rows satisfying the full `where`, so a redelivered event that finds the row already past that state simply matches nothing and no-ops, instead of you needing a manual `if (already done) return`.

---

## 5. BullMQ setup

**Deployment reality:** this worker file cannot run inside a Vercel serverless/edge function — it needs to stay alive listening on Redis. Deploy it as a small always-on service (Railway, Render, Fly.io, or a `node worker/index.js` process on a $5 VM) pointed at the same Redis your Next.js app uses. Decide this before you write the app, not after — it changes your `.env` story (both services need `DATABASE_URL` and `REDIS_URL`).

## 6. Testing (this is what your CV claims actually need behind them)

**Concurrency test** — proves the unique constraint does its job:

```typescript
test('only one of two concurrent holds on the same slot succeeds', async () => {
  const payload = { turfId, date, startTime, endTime }
  const [r1, r2] = await Promise.all([
    fetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) }),
    fetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) })
  ])
  const statuses = [r1.status, r2.status].sort()
  expect(statuses).toEqual([201, 409])
})
```

**Idempotency test** — proves retries don't double-charge:

```typescript
test('retrying payment creation with same booking does not create two payments', async () => {
  const [r1, r2] = await Promise.all([
    fetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ bookingId })
    }),
    fetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ bookingId })
    })
  ])
  const count = await prisma.payment.count({ where: { bookingId } })
  expect(count).toBe(1)
})

test('redelivered webhook does not double-confirm a booking', async () => {
  const webhookPayload = buildSignedWebhook({
    event: 'payment.captured',
    orderId
  })
  await fetch('/api/webhooks/payment', { method: 'POST', body: webhookPayload })
  await fetch('/api/webhooks/payment', { method: 'POST', body: webhookPayload }) // redelivery
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  expect(booking.status).toBe('PAID') // moved once, second call was a no-op
})
```

These three tests are your entire "DB-level locking, tested for concurrent requests" and "idempotent payment APIs... simulated retry/webhook failures" CV lines, made literal. Put them front and center in your README with a screenshot of them passing in CI — that's the artifact that actually convinces an interviewer.

---

## 9. GitHub Actions CI

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma migrate deploy
        env: { DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres }
      - run: pnpm lint
      - run: pnpm test --coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          REDIS_URL: redis://localhost:6379
      - run: pnpm exec vitest --coverage --coverage.thresholds.lines=80
```

Note: this runs against real local Postgres/Redis in CI, not Neon/Upstash — that's how you get the actual concurrency test to mean something (Neon's connection pooler can behave differently under parallel test requests than plain Postgres).

---

## 10. Deployment topology

- **Next.js app** → Vercel (Node runtime for any route touching Prisma transactions — avoid Edge runtime for `/api/bookings`, `/api/payments`, `/api/webhooks/*`)
- **Worker process** → Railway/Render/Fly.io, always-on, connects to same Neon + Redis
- **Neon** → use the pooled connection string for the app; consider a direct (unpooled) connection for the worker if you ever need long transactions
- **Redis** → Upstash (confirm TCP/BullMQ compatibility, not just their REST API) or a small managed Redis instance on the same host as the worker

---

## 11. Build order checklist

1. Prisma schema + migration, seed 2-3 turfs
2. Concurrency test green (raw Prisma, no HTTP yet) — proves the model before you build routes on top of it
3. Clerk signup + webhook sync to `User`
4. Public `GET /api/turfs`, `GET /api/turfs/:id/slots`
5. `POST /api/bookings` (hold) + concurrency test at the HTTP level
6. Mock payment gateway + idempotency tests
7. Real gateway (test mode) + webhook + webhook-idempotency test
8. BullMQ worker (hold-expiry, confirmation) as a separate deployable
9. Pino/Sentry
10. CI pipeline, coverage threshold, README with test screenshots
11. UI last

Want me to start scaffolding the actual repo from step 1 — Prisma schema, migrations, and the concurrency test — so you have a running project to build on?
