# AGENTS.md — BookMySlot

Context file for AI coding assistants working on this repo. Read this before generating or editing any code.

## Next.js Rules & Conventions Notice

This repository utilizes modern Next.js conventions and App Router standards.

- Read documentation in `node_modules/next/dist/docs/` before implementing new code patterns.
- Always check for deprecated Next.js features and prefer current patterns (e.g., Server Actions, App Router conventions).

## What this project is

A real-time turf/slot booking app that solves two specific, real failure modes — not generic SaaS boilerplate:

1. **Double-booking**: two people confirm the same slot because there's no real locking (typical of WhatsApp/form-based booking).
2. **Double-charging**: a payment retry or webhook replay charges the same booking twice.

Every technical decision in this repo traces back to eliminating these two failures. If a suggested pattern doesn't serve one of them, don't add it "for best practices."

## Core user flow

Browse turf → pick a slot → slot is **held** → pay → booking **confirmed**.
If someone else grabs the same slot while a user is paying, that user must be told **immediately** (live, via SSE) — not after they've paid.

Customer auth exists (via Clerk). No owner dashboard/login, no multi-tenant management, no rate limiting in this build — these were deliberately scoped out. Don't add them unless explicitly asked; if raised as a question, they're answered verbally as "future work," not built.

## Stack

Next.js (App Router, TS strict) · PostgreSQL + Prisma · Redis (ioredis) · BullMQ · Clerk (auth) · Razorpay (payments) · Zod · Pino · Sentry · Vitest (unit) · Supertest (integration) · GitHub Actions

## The two non-negotiable invariants

1. **Partial unique index** on active holds per slot — enforced at the DB level, not in application code. This is what actually prevents double-booking under concurrency.
2. **Unique constraint on `booking_id`** (or idempotency key) in the `payments` table — this is what actually prevents double-charging, not client-side debounce logic.

Never "fix" these with application-level checks alone (e.g. `SELECT` then `INSERT`). Race conditions require DB constraints.

## Architecture rules

- **Server Actions** (`src/actions/`) — all UI-initiated mutations (create hold, initiate payment, confirm booking). Read `userId` via Clerk's `auth()` server-side inside the action; never trust a `userId` passed from the client.
- **Route Handlers** (`src/app/api/`) — external callers ONLY: payment webhook (Razorpay), Clerk webhook (user sync), cron (expire holds), SSE stream. Do not create Route Handlers for things the UI itself triggers.
- **Auth**: Clerk owns identity, session, and login UI entirely. The app's own `User` table only stores `clerkId` plus relations (holds, bookings) — no password/OTP fields, no custom session logic.
- **Webhook verification is mandatory, not optional**: Clerk webhook verified via Svix headers, Razorpay webhook verified via its HMAC signature. An unverified webhook route is a spoofable "payment succeeded" call — treat this as part of the core invariant, not a nice-to-have.
- **Hold expiry is cron-driven** (`api/cron/expire-holds/route.ts`), sweeping every 30–60s. This is a deliberate simplicity choice over event-driven (e.g. Redis keyspace notifications) — defensible as "scheduled sweep," not claimed as instant expiry.
- **Services** — services hold both business logic and direct Prisma DB calls. No separate repository layer or port/interface abstractions.
- **Error hierarchy**: `AppError`, `ConflictError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`. (No `RateLimitError` usage in this build — rate limiting is out of scope.)
- **Response envelope**: all Server Actions and Route Handlers return via `ok()` / `fail()`, wrapped by `response.ts`.
- **BullMQ** is used only for async booking confirmation after payment succeeds (receipt, finalization) — runs in a separate `worker.ts` process, deployed separately from the Next.js app (Next.js serverless can't host a long-running worker).
- **SSE** (`api/slots/[slotId]/stream/route.ts`, edge runtime) backed by Redis pub/sub — publishes on hold created / hold expired via cron / slot booked. This is the headline differentiator ("told immediately" instead of after payment); don't replace with polling unless asked.
- **Slot times stored in UTC** in the DB (`startsAt`/`endsAt`), converted to local time only at render.

## Directory structure

```
src/
├── middleware.ts          # clerkMiddleware — guards /checkout, /bookings
├── app/                   # pages, sign-in/sign-up (Clerk), + 4 external-facing Route Handlers
│   └── api/
│       ├── webhooks/{payment,clerk}/route.ts
│       ├── cron/expire-holds/route.ts
│       └── slots/[slotId]/stream/route.ts   # SSE, edge runtime
├── actions/               # Server Actions (create-hold, initiate-payment, confirm-booking)
├── services/              # hold.service, payment.service, slot.service
├── queue/                 # BullMQ queue + worker for async confirmation
└── lib/                   # db (Prisma), redis, logger (Pino), errors, response, schema
```

Models: `User` (clerkId only, no custom auth fields) · `Owner` · `Turf` · `Slot` · `Hold` (partial unique index on active holds per slot) · `Booking` · `Payment` (unique idempotency key / `bookingId`). No `Owner` login — owners are seeded relational data only.

## Testing requirements

- `tests/unit/` (Vitest) — services, error handling.
- `tests/integration/` (Supertest) — Route Handlers end-to-end, including webhook flow.
- `tests/concurrency/` — fire 50+ parallel hold attempts on one slot; assert exactly one succeeds.
- `tests/idempotency/` — fire 100+ retries/replays of one payment event; assert exactly one charge.
- Target: 80%+ coverage, enforced as a CI gate (build fails below threshold), not just measured.

## Observability

- Pino for structured logs.
- Sentry for error tracking.

## When suggesting changes

- Prefer the smallest change that preserves both invariants over a "more scalable" rewrite.
- Don't introduce: owner login/dashboard, multi-tenancy beyond the existing `Owner` relation, port/interface abstractions, rate limiting, or event-driven (Redis keyspace notification) hold expiry — all deliberately scoped out. If the person asks about these, answer as a verbal "future work" point, don't build it.
- Any new async/background work goes through BullMQ, not ad-hoc `setTimeout` or inline `await` chains in a request path.
- Any new external-caller endpoint goes in `app/api/`; anything a logged-in user triggers is a Server Action.
- Everything built should map back to one of: the two invariants (no double-booking, no double-charging), the SSE live-notice differentiator, or an explicit CV claim (BullMQ async confirmation, Vitest/Supertest coverage, Pino/Sentry telemetry). If a suggestion doesn't map to one of these, flag it as optional rather than adding it by default.
