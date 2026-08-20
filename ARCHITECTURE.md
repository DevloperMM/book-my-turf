# TurfBooking — System Design & Build Spec

## 0. Constraints this doc satisfies

- No double-booking under concurrent requests (DB-level partial unique index on active holds/slots, not app-level locking)
- No double-charge under payment retry / webhook redelivery
- Public dashboard browsable without signup; booking requires Clerk auth
- Clerk → DB sync via Svix webhook
- UI mutations strictly use Server Actions (`src/actions/`); Route Handlers (`src/app/api/`) are external callers ONLY (webhooks, QStash job callbacks, SSE)
- Real-time SSE stream (`api/sse/turf/[id]`) backed by **Redis pub/sub** for instant slot availability broadcast
- Delayed/async work (hold expiry, post-payment confirmation) handled by **Upstash QStash** — no standalone worker process, no paid always-on host
- Pino + Sentry for telemetry
- UI (shadcn components) calls Server Actions directly — no fetch-based API layer in front; see §13 for the conventions this requires

---

## 1. Data model (Prisma)

```prisma
generator client {
  provider        = "prisma-client"
  previewFeatures = ["partialIndexes"]
}

datasource db {
  provider = "postgresql"
}

enum BookingStatus {
  HELD
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
  id        String    @id          // Clerk user id, synced via webhook
  email     String    @unique
  name      String?
  createdAt DateTime  @default(now())
  bookings  Booking[]
}

model Turf {
  id          String    @id @default(cuid())
  name        String
  location    String
  pricePerHr  Int
  openHour    Int
  closeHour   Int
  slotMinutes Int       @default(60)
  imageUrl    String?
  createdAt   DateTime  @default(now())
  bookings    Booking[]
}

model Booking {
  id             String        @id @default(cuid())
  turfId         String
  turf           Turf          @relation(fields: [turfId], references: [id])
  userId         String
  user           User          @relation(fields: [userId], references: [id])
  date           DateTime      @db.Date
  startTime      DateTime
  endTime        DateTime
  status         BookingStatus @default(HELD)
  holdExpiresAt  DateTime
  idempotencyKey String        @unique   // guards duplicate hold requests from the client
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  payment        Payment?

  @@unique([turfId, date, startTime], where: raw("status IN ('HELD', 'CONFIRMED')"), map: "unique_active_slot")
  @@index([turfId, date])
}

model Payment {
  id             String        @id @default(cuid())
  bookingId      String        @unique
  booking        Booking       @relation(fields: [bookingId], references: [id])
  gatewayOrderId String?       @unique
  amount         Int
  status         PaymentStatus @default(PENDING)
  idempotencyKey String        @unique   // guards duplicate "Pay" clicks/retries
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

model WebhookEvent {
  id          String   @id          // Razorpay's event id — the dedup key
  type        String
  processedAt DateTime @default(now())
}
```

**Why `startTime`/`endTime` as timestamps, not slot IDs from a pre-generated table:** slots are computed from `Turf.openHour/closeHour/slotMinutes` in the GET endpoint, never stored until someone holds one. Less state, nothing to seed, no "which slots exist for date X" migration problem.

**Why the partial unique index is the whole locking strategy:** Postgres enforces uniqueness atomically at the index level. Two concurrent `INSERT`s for the same `(turfId, date, startTime)` where status is `HELD`/`CONFIRMED` — one commits, one gets a `23505` unique-violation error. No `SELECT ... FOR UPDATE`, no transaction wrapping a check-then-insert, and it's correct across multiple app server instances by construction. The `where` clause means `EXPIRED`/`CANCELLED` rows don't count, so a slot frees up the instant a booking leaves an active state — no separate "release the slot" step.

**Why `Booking.status` has 4 states, not 5:** `Payment.status` already tracks the payment lifecycle (`PENDING`/`SUCCEEDED`/`FAILED`) separately. Adding a `PAID` booking-state on top would just duplicate a fact that already lives in `Payment` — one less state to keep in sync.

**Two separate idempotency keys, two separate problems:**

- `Booking.idempotencyKey` — guards against the client double-submitting a hold request (double-click, retried fetch after a timeout).
- `Payment.idempotencyKey` — same guard, but for the "Pay" click.
- `WebhookEvent.id` — a _different_ problem: the payment gateway redelivering the same event server-to-server. This is not client retry, it's gateway-guaranteed-at-least-once delivery. Needs its own dedup table because it's keyed on the gateway's event id, not anything the client generated.

---

## 2. Auth: Clerk signup → Neon sync

Don't create the `User` row on first booking request. Sync it via Clerk's webhook (Svix-verified) the moment someone signs up, so by the time they try to book, the row already exists and the booking action never has to worry about "does this user exist yet."

**Dashboard visibility:**

- `GET /api/turfs` and `GET /api/turfs/[id]/slots?date=...` are public Route Handlers, no Clerk middleware. Anyone can browse turfs and see what's free, signed in or not.
- The moment they click "hold this slot," the `createHold` Server Action requires `auth().userId`, throwing if missing. This is also the natural place to trigger Clerk's sign-in modal client-side if they're not logged in.
- Clerk middleware config: `publicRoutes` includes `/api/turfs(.*)` and `/api/sse(.*)`; everything else stays protected by default.

---

## 3. Server Actions vs Route Handlers — the boundary

- **`src/actions/`** — every UI-triggered mutation (`createHold`, `initiatePayment`, `cancelBooking`) is a Server Action, called directly from client components. This is the only path for anything a signed-in user does through the UI.
- **`src/app/api/`** — reserved strictly for callers that are _not_ the browser acting through a normal page interaction: Clerk's webhook, Razorpay's webhook, QStash's job callbacks, and the SSE stream. If it's not one of those four categories, it doesn't belong under `api/`.

---

## 4. Real-time updates: SSE + Redis pub/sub

Any action that changes a booking's status publishes a small message to a Redis channel scoped to that turf:

```ts
await redis.publish(`turf:${turfId}:slots`, JSON.stringify({ slotStartTime, status }))
```

`app/api/sse/turf/[id]/route.ts` runs on the **Node runtime** (not Edge — it needs a real persistent TCP connection to Redis, not just the REST API). When a browser opens the stream, the handler `SUBSCRIBE`s to that turf's channel and forwards every message straight into the open HTTP response as an SSE event. On disconnect, it unsubscribes and closes the Redis connection.

Publish points: `createHold` (→ `HELD`), the `expire-hold` job callback (→ `EXPIRED`), `confirm-payment` job callback (→ `CONFIRMED`), `cancelBooking` (→ `CANCELLED`).

**Known limit, worth naming out loud:** SSE connections stay open for as long as a user has the page open, and Vercel serverless functions have execution-time caps depending on plan. Fine for a portfolio project's realistic traffic; at real scale this is the piece you'd move to a persistent Node service.

---

## 5. Hold endpoint (the core locking logic)

`createHold` Server Action:

1. Generate/receive `idempotencyKey` from the client.
2. `INSERT` the `Booking` row, `status: HELD`, `holdExpiresAt: now + 10m`.
3. Catch `P2002` (partial unique index violation) → return "slot taken" — this is the whole concurrency guarantee, not app-level locking.
4. On success: publish to Redis (`HELD`), then `qstash.publishJSON({ url: '.../api/jobs/expire-hold', body: { bookingId }, delay: '10m' })`.

`expire-hold` job (Route Handler, called back by QStash):

1. Verify the QStash signature.
2. Re-read the booking — only flip `HELD → EXPIRED` if it's _still_ `HELD` (payment may have completed since the job was scheduled).
3. Publish the status change to Redis.

---

## 6. Payment idempotency

Two separate idempotency problems, both need solving:

**(a) Your own API being called twice** — user double-clicks "Pay," or the client retries a timed-out request. Solved by `Payment.idempotencyKey`.

**(b) The gateway redelivering the same webhook event** — Razorpay explicitly warns: expect duplicates, expect out-of-order delivery. Solved by `WebhookEvent.id` as an insert-first dedup gate.

`POST /api/webhooks/razorpay`:

1. Verify Razorpay's signature.
2. Try inserting into `WebhookEvent` keyed on the event id. Duplicate → insert fails → return `200` immediately, nothing else runs.
3. First-time delivery → insert succeeds → `qstash.publishJSON({ url: '.../api/jobs/confirm-payment', body: { bookingId, paymentId } })` → return `200` fast (webhook senders expect a quick ack, not a slow synchronous confirmation).

`confirm-payment` job (Route Handler, called back by QStash), inside one `$transaction`:

- `Payment.update({ where: { id, status: 'PENDING' }, data: { status: 'SUCCEEDED' } })`
- `Booking.update({ where: { id, status: 'HELD' }, data: { status: 'CONFIRMED' } })`
- Publish `CONFIRMED` to Redis.

Note the `where: { ..., status: 'PENDING' }` / `status: 'HELD'` pattern — Prisma's `update` only matches rows satisfying the full `where`, so a re-run of this job (in the rare case QStash retries a callback) that finds the row already past that state simply matches nothing and no-ops, instead of needing a manual `if (already done) return`.

---

## 7. Async work: Upstash QStash

No standalone worker process, no Redis-as-job-store, no second host to deploy or pay for. `lib/qstash.ts` wraps the client and the callback-signature verification helper. Every "do this later" or "do this async" need becomes: `qstash.publishJSON({ url, body, delay? })` from a Server Action or webhook handler, landing on a Route Handler under `app/api/jobs/`.

QStash needs a public URL to call back into, so job callbacks only work against a deployed URL (preview or prod) — local testing uses the QStash CLI's dev tunnel to forward callbacks to `localhost`.

---

## 8. Testing (this is what the CV claims actually need behind them)

**Concurrency test** — proves the partial unique index does its job:

```typescript
test('only one of two concurrent holds on the same slot succeeds', async () => {
  const payload = { turfId, date, startTime, endTime, idempotencyKey: crypto.randomUUID() }
  const [r1, r2] = await Promise.all([
    createHold({ ...payload, idempotencyKey: 'a' }),
    createHold({ ...payload, idempotencyKey: 'b' })
  ])
  const outcomes = [r1.ok, r2.ok].sort()
  expect(outcomes).toEqual([false, true])
})
```

**Idempotency test** — proves retries don't double-charge:

```typescript
test('retrying payment creation with same booking does not create two payments', async () => {
  const key = crypto.randomUUID()
  await Promise.all([
    initiatePayment({ bookingId, idempotencyKey: key }),
    initiatePayment({ bookingId, idempotencyKey: key })
  ])
  const count = await prisma.payment.count({ where: { bookingId } })
  expect(count).toBe(1)
})

test('redelivered webhook does not double-confirm a booking', async () => {
  const webhookPayload = buildSignedWebhook({ event: 'payment.captured', orderId })
  await fetch('/api/webhooks/razorpay', { method: 'POST', body: webhookPayload })
  await fetch('/api/webhooks/razorpay', { method: 'POST', body: webhookPayload }) // redelivery
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  expect(booking.status).toBe('CONFIRMED') // moved once, second call was a no-op
})
```

These three tests are the entire "DB-level locking tested for concurrent requests" and "idempotent payment APIs tested across simulated retry/webhook failures" CV lines, made literal. Put them front and center in the README with a CI screenshot — that's the artifact that actually convinces an interviewer.

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
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
      - run: pnpm lint
      - run: pnpm exec vitest --coverage --coverage.thresholds.lines=80
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          REDIS_URL: redis://localhost:6379
```

Runs against real local Postgres/Redis in CI, not Neon/Upstash — that's how the concurrency test actually means something (Neon's connection pooler can behave differently under parallel test requests than plain Postgres). QStash calls aren't exercised in CI directly; job-callback route handlers are tested by invoking them directly with a mocked/valid signature rather than round-tripping through QStash itself.

---

## 10. Deployment topology

- **Next.js app** → Vercel (Node runtime for any route touching Prisma transactions — avoid Edge runtime for `actions/`, `api/webhooks/*`, `api/jobs/*`, `api/sse/*`)
- **No worker process, no second host** — QStash's callbacks land directly on the Vercel deployment
- **Neon** → pooled connection string for the app
- **Redis** → Upstash, used for pub/sub (SSE) — confirm TCP/ioredis compatibility, not just the REST API, since pub/sub needs a persistent connection
- **QStash** → Upstash, free tier (1,000 messages/day) — no additional host

---

## 11. Directory structure

```
turfbooking/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── middleware.ts                        # Clerk middleware; publicRoutes: /api/turfs(.*), /api/sse(.*)
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                          # Homepage — all turfs, paginated
│   │   ├── (auth)/
│   │   │   ├── login/[[...sign-in]]/page.tsx
│   │   │   └── register/[[...sign-up]]/page.tsx
│   │   ├── (turfs)/
│   │   │   ├── page.tsx                      # Homepage stub
│   │   │   └── turf/[id]/page.tsx           # Turf detail + SlotGrid (SSE-driven)
│   │   ├── (me)/
│   │   │   ├── bookings/page.tsx             # Booking list
│   │   │   ├── booking/[id]/page.tsx         # Hold countdown, Pay button, status
│   │   │   └── profile/page.tsx              # Authenticated, from navbar
│   │   │
│   │   └── api/                              # Route Handlers = EXTERNAL callers only
│   │       ├── turfs/route.ts                # GET, public
│   │       ├── turfs/[id]/slots/route.ts     # GET, public — computes slots from open/close/slotMinutes
│   │       ├── webhooks/
│   │       │   ├── clerk/route.ts            # Svix-verified, syncs User on signup
│   │       │   └── razorpay/route.ts         # Signature verify -> WebhookEvent dedup -> QStash publish
│   │       ├── jobs/
│   │       │   ├── expire-hold/route.ts      # QStash calls back here after delay
│   │       │   └── confirm-payment/route.ts  # QStash calls back here after webhook dedup
│   │       └── sse/
│   │           └── turf/[id]/route.ts        # Node runtime, Redis SUBSCRIBE -> SSE stream
│   │
│   ├── actions/                              # Server Actions = ALL UI mutations
│   │   ├── booking.action.ts                 # createHold, cancelBooking, confirmBooking, getBooking, listBookings
│   │   ├── payment.action.ts                 # initiatePayment, confirmPayment, verifyPayment
│   │   ├── turf.action.ts                    # getTurfById, listTurfs, createTurf, updateTurf, deleteTurf
│   │   └── user.action.ts                    # getProfile
│   │
│   ├── components/
│   │   ├── Navbar.tsx                        # Sticky header with utility bar + primary nav
│   │   ├── SlotGrid.tsx                      # Slot grid component (placeholder)
│   │   └── ui/                               # shadcn components (to be installed)
│   │
│   ├── config/
│   │   └── env.ts                            # Zod-validated environment config
│   │
│   ├── lib/
│   │   ├── prisma.ts                         # Prisma client singleton (Neon adapter)
│   │   ├── redis.ts                          # ioredis client — getRedisConnection + createSubscriberConnection
│   │   ├── qstash.ts                         # QStash client + callback signature verification
│   │   ├── razorpay.ts                       # Razorpay client instance
│   │   ├── publish.ts                        # Redis pub/sub publisher (slot updates + cache invalidation)
│   │   ├── logger.ts                         # Pino logger
│   │   ├── errors.ts                         # AppError hierarchy (Conflict, NotFound, Unauthorized, etc.)
│   │   ├── response.ts                       # API response helpers (ok/fail)
│   │   └── schemas.ts                        # Zod schemas (turfSchema, razorpayWebhookSchema)
│   │
│   └── types/
│       ├── index.ts                          # Derived types (TurfForm, RazorpayWebhookEvent)
│       ├── globals.d.ts                      # CustomJwtSessionClaims (role?: string)
│       └── razorpay.d.ts                     # Window.Razorpay type declaration
│
├── .github/workflows/ci.yml
├── .env.example
├── package.json
├── tsconfig.json
├── components.json                           # shadcn/ui config
├── AGENTS.md                                 # This audit document
├── ARCHITECTURE.md                           # This build spec
└── DESIGN.md                                 # NVIDIA-inspired design system
```

---

## 12. Build order checklist

1. Prisma schema + migration, seed 2-3 turfs
2. Concurrency test green (raw Prisma, no HTTP yet) — proves the model before building actions on top of it
3. Clerk signup + webhook sync to `User`
4. Public `GET /api/turfs`, `GET /api/turfs/[id]/slots`
5. `createHold` Server Action + concurrency test at that level
6. `lib/qstash.ts` + `expire-hold` job route, wired to `createHold`
7. Mock payment gateway + idempotency tests
8. Real gateway (test mode) + webhook + `confirm-payment` job + webhook-dedup test
9. `lib/redis.ts` pub/sub + SSE route + publish calls wired into every status-changing action/job
10. Pino/Sentry
11. CI pipeline, coverage threshold, README with test screenshots
12. UI last

---

## 13. Consuming Server Actions directly from the UI (shadcn components, no API layer)

Since there's no `fetch`-based API layer in front of the UI — components call `src/actions/*` directly — a few conventions keep this from turning into ad hoc, inconsistent handling as the UI grows. Verified against the current Next.js docs (v16.3.1, June 2026).

**Actions return a result, they never throw for expected outcomes.** A thrown error inside a Server Action gets reduced to a generic message on the client in production for security reasons — the real error text is lost. So every action should return a typed result object (e.g. `{ success: true, data }` or `{ success: false, error }`) instead of throwing for anything that's a normal business outcome — "slot already taken," "not signed in," "hold already expired." Reserve actual `throw` for genuinely unexpected failures (a DB connection drop), which should be caught by a Next.js `error.tsx` boundary at the route segment, not handled ad hoc per component.

**Match the hook to the trigger, don't default to `useActionState` everywhere.** Most current Server Action guides show `useActionState`, but that hook is built specifically for `<form action={...}>` submissions and its pending/error state is form-shaped. The Book/Cancel/Pay buttons here aren't forms — they're plain clicks. For those, call the action directly inside `useTransition`, which gives an `isPending` flag to disable the button and keep the UI responsive without forcing a form wrapper. Save `useActionState` for the one genuine form in this app, if one gets added later (e.g. a cancellation-reason field).

**Don't `Promise.all` multiple Server Actions from the client — Next.js dispatches them one at a time per client anyway.** This is a framework property, not a suggestion: if a component triggers two actions in quick succession, the second genuinely waits for the first to finish server-side before running, so the client tree stays consistent with whichever action produced it. This mostly won't bite this app's flow (Book/Pay/Cancel are separate user-triggered clicks, not fired together), but it matters if any component is ever tempted to fire two actions concurrently for "speed" — that doesn't parallelize the way it would with two `fetch` calls. If a genuine need for parallel server work comes up, do it inside a single action, not as two actions raced from the client.

**Every action is a public, unauthenticated-by-default POST endpoint — treat it that way regardless of where it's rendered.** The docs are explicit that gating a button's _rendering_ behind Clerk auth is not itself a security boundary, because the action is still reachable by anyone who can send the same POST request directly. So every action — not just the ones for signed-out-visible pages — must independently call `auth()` and check the user itself, never rely on "this button only shows up if they're logged in" as the actual protection.

**Client sends a reference, the action re-derives the rest from the session — never trust ownership fields from the client.** For `cancelBooking(bookingId)`, the action should look up the booking scoped to the current session's user (e.g. `findFirst({ where: { id: bookingId, userId: session.user.id } })`), not accept a full booking object or a `userId` field from the client and trust it. Zod validation only confirms the _shape_ of what's sent, not that the caller actually owns the row — a well-formed but spoofed `bookingId` for someone else's booking would otherwise pass validation and still execute.

**Shape action return values to what the UI needs, not raw Prisma records.** Action returns are serialized straight to the client, so returning a full `Booking` or `Payment` model risks leaking fields the UI never needed (internal ids, other-table foreign keys, timestamps nobody's rendering). The `ActionResult<T>` pattern should have a narrow `T` per action — e.g. `{ bookingId, status, holdExpiresAt }` — not `{ booking: Booking }`.

**Validate again inside every action, not just in the UI.** With no API route in front, the Server Action itself is the actual trust boundary — client-side validation (shadcn form validation, disabled states) is UX only. Every action should re-validate its input with something like Zod before touching Prisma, regardless of what the client already checked.

**Use `useOptimistic` for instant feedback on Cancel/Book, but reconcile carefully with SSE.** Since SSE is already pushing the real status change moments after the mutation completes, the optimistic local update and the SSE-driven update need to agree rather than compound. Key the client-side slot/booking state by a stable identifier (slot start time, booking id) and always overwrite on update, never append — that way it doesn't matter whether the update came from the user's own optimistic click or from someone else's action arriving over SSE; the merge is idempotent either way.

**Prefer `updateTag` over `revalidatePath` for the actor's own immediate feedback; keep `revalidatePath` for the simple cases.** This is a newer, more precise tool than what's typically shown in older guides. When an action calls `updateTag` (or `revalidatePath`), Next.js re-renders the current route server-side and ships the fresh RSC payload back in the _same_ HTTP response as the action's result — no separate follow-up fetch, and the person who just acted sees their own change immediately ("read-your-own-writes"). `revalidateTag`, by contrast, is stale-while-revalidate — it does _not_ guarantee the action's own response reflects the change, only that a later read will. For this app: `createHold`/`cancelBooking` care about the acting user seeing their own result instantly, so `updateTag` (tagging the turf's slots fetch) is the more correct choice than plain `revalidatePath` if the slots query is set up with cache tags; `revalidatePath` remains the simpler fallback if tag-based caching isn't worth the setup for a project this size. Either way, SSE still separately covers _other_ users watching the same turf live — this tag/path choice is purely about the acting user's own page.

**Surface expected failures via toast, not inline form errors.** Since most of these mutations aren't forms, shadcn's toast component (Sonner) is the natural place for "slot taken" / "sign in first" style messages, rather than trying to force a form-error-banner pattern onto a plain button.

**One error boundary per route segment, not per component.** Add `error.tsx` under `app/turf/[id]/` and `app/booking/[id]/` to catch anything that does legitimately throw, rather than wrapping individual buttons in their own error handling — keeps the "expected vs. unexpected" split clean and matches how Next.js already scopes error boundaries.

**Deployment note: action IDs rotate on every deploy, even without code changes to the action.** A browser tab left open across a Vercel deploy (e.g. someone sitting on the booking-hold countdown while a new version ships) can end up calling an action ID the new deployment no longer recognizes, surfacing as a "Failed to find Server Action" error. Worth handling as a retry prompt in the UI ("something went wrong, try again") rather than a hard crash — a page refresh resolves it, since it picks up the current build's action IDs.

---

## 14. `src/components/` — shadcn `ui/` plus your own helper components

`src/components/ui/` stays exactly as the shadcn CLI generates it — every `npx shadcn add <component>` drops its file straight in there, imported via the `@/components/ui/...` alias the CLI already wires into `tsconfig.json`. Don't hand-reorganize this folder.

`src/components/` (the same level as `ui/`) holds your own helper/reusable components — the ones built out of shadcn primitives but specific to this app (`SlotGrid`, `BookingStatusBadge`, `TurfCard`, `Navbar`, etc.), imported directly into pages the same way as any shadcn primitive: `@/components/SlotGrid`, `@/components/ui/button`. No further split beyond `ui/` vs. everything else is needed at this project's size — add structure later only if the flat folder actually gets unwieldy.

**Server vs. Client boundary lives at the component, not the folder.** What decides `'use client'` is whether the component needs interactivity (`onClick`, hooks like `useTransition`/`useOptimistic`, browser APIs) — not which folder it's in. Default every new component to a Server Component; add `'use client'` only once something genuinely needs it.

**Pages import from `components/`, not the other way around.** Components never import from `app/` — keeps the dependency direction one-way (`app → components → lib/actions`).
