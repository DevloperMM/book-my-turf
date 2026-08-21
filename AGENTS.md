# TurfBooking — Implementation Audit & Update Prompt

Use this as an instruction set for a coding agent (Claude Code or similar) working on the existing TurfBooking repo. For each section: check whether the current implementation matches, and if not, update it to match — explain any deviation you keep, don't silently ignore a mismatch.

---

## 1. Concurrency — no double-booking

- [ ] `Booking` has a **partial** unique index on `(turfId, date, startTime)`, scoped to `WHERE status IN ('HELD','CONFIRMED')` — added via raw SQL migration, since Prisma's schema syntax can't express a predicate. A plain (non-partial) unique index is a bug here: it would block re-booking a slot after a cancellation. `PAID` is excluded because a PAID booking means the hold expired and the slot is available for others — including PAID would block new holds on that slot.
- [ ] `holdSlot` never reads availability before inserting (no check-then-insert / TOCTOU pattern). It goes straight to `INSERT`, catches Prisma error `P2002` (unique violation), and returns a typed result (`{ ok: false, reason: 'SLOT_TAKEN' }`) — never a raw thrown 500.
- [ ] `getTurfSlots` (the read side) treats any `HELD` row past `holdExpiresAt` as available, independent of whether the QStash expiry job has run yet — correctness must not depend on job timing.
- [ ] `initiatePayment` does **not** extend `Booking.holdExpiresAt`. The hold countdown runs uninterrupted from the moment the slot is held — payment must complete within the original TTL or the slot expires.

## 2. Payment idempotency (Razorpay)

- [ ] `Payment.bookingId` is `@unique`, and `initiatePayment` is a get-or-create against it — a retried "Pay" click must return the _existing_ order, never create a second `Payment` row.
- [ ] `Payment.idempotencyKey` is derived server-side as `pay_${bookingId}` — never a client-supplied UUID.
- [ ] Webhook route (`api/webhooks/razorpay/route.ts`):
  - Reads the **raw** request body (not pre-parsed JSON) before verifying `x-razorpay-signature` via HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET`. Signature check happens on raw bytes, before any JSON parsing or schema validation.
  - Rejects with 400 on signature mismatch, does not process further.
  - Only after signature passes: parses and validates against a Zod schema (see §7), then inserts into `WebhookEvent` keyed on Razorpay's event ID as dedupe — if the insert finds a duplicate, returns 200 immediately with no further work.
  - Publishes a QStash job (`confirm-payment`) and returns 200 immediately — does **not** perform the DB write inline (Razorpay retries slow/failed responses for up to 24h, which would manufacture more duplicate deliveries).
- [ ] Subscribed webhook events are exactly `payment.captured` and `payment.failed` — no `refund.processed` subscription, since refunds are handled manually outside the app (see §10), not via a Razorpay refund webhook.
- [ ] Razorpay order created with auto-capture (`payment_capture: 1`), not manual capture — funds are captured immediately on successful payment rather than left authorized-only pending a separate capture call.
- [ ] The client-side Razorpay `handler` callback (`razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`) is used **only** for optimistic UI feedback — it is never what marks a booking `CONFIRMED`. That state transition happens exclusively in the `confirm-payment` job callback, triggered by the webhook.
- [ ] `confirm-payment` job (Route Handler) uses a status-guarded update: `UPDATE Payment SET status='SUCCEEDED' WHERE bookingId=? AND status='PENDING'`. If zero rows match, the job returns immediately — this covers both a redelivered webhook and a QStash retry. **No email/side-effect step follows this** — the app sends no emails anywhere (see §10); the job's only job is the DB write.

## 3. Directory structure

- [ ] Single Next.js repo — no monorepo tooling (`apps/`, `packages/`). No standalone worker process — QStash delivers delayed/async jobs as signed HTTP callbacks to Route Handlers under `api/jobs/`.
- [ ] **Deviation (confirmed, keep as-is):** `src/actions/` contains **all** operation functions — reads and writes together (`holdSlot`, `cancelBooking`, `initiatePayment`, `getTurfSlots`, `getUserBookings`, etc.). There is no separate `src/queries/` folder. Keep the read/write boundary legible via naming instead (`getX` = read, `holdX`/`cancelX`/`initiateX` = write), since there's no folder enforcing it.
- [ ] `src/app/api/` contains only: webhooks, QStash job callbacks, and the SSE stream route. If any UI-triggered mutation is implemented as a Route Handler instead of a Server Action, flag and migrate it.
- [ ] `lib/redis.ts`, `lib/qstash.ts` are separate files with single responsibilities — not merged into one "redis stuff" file, and not duplicated inline at each call site. Redis pub/sub publishing (slot updates, booking status updates, cache invalidation) lives in `lib/redis.ts` alongside the connection helpers.

## 4. Redis

- [ ] `lib/redis.ts` exports a cached singleton (`getRedisConnection`) for general use, and a separate `createSubscriberConnection` (via `.duplicate()`) for SSE — never one shared client for both, since a connection in subscribe mode can't issue normal commands.
- [ ] Connection string is Upstash's `rediss://` TCP endpoint (via `ioredis`), **not** their REST SDK (`@upstash/redis`) — pub/sub needs a long-held connection the REST model can't provide.
- [ ] `ioredis` client is constructed with `maxRetriesPerRequest: null`.
- [ ] SSE subscribes on **one channel per turf** (`turf:${turfId}:slots`), not one per slot — keeps concurrent-connection count bounded by open turf pages, relevant given Upstash's free-tier connection ceiling.
- [ ] Every SSE route handler disconnects its subscriber connection on `req.signal`'s `abort` event — a missing cleanup leaks a held connection.
- [ ] `getTurfSlots` cache: read-through cache keyed `cache:turf:${turfId}:slots:${date}`, short TTL (~30s) as a backstop, invalidated primarily via `redis.del(...)` inside `publishSlotUpdate` (same call site as the SSE publish — not a separate invalidation path that could drift out of sync).
- [ ] This cache is read only by `getTurfSlots` for display — `holdSlot` must never consult it before inserting. Confirm no code path uses the cache to decide whether a hold should be attempted.
- [ ] **Deviation (confirmed, deferred):** no rate limiting implemented. Not required for now — don't force it in, just don't claim it as built.

## 5. Async work: Upstash QStash

- [ ] `lib/qstash.ts` wraps the QStash client and the callback-signature verification helper.
- [ ] Every "do this later" or "do this async" need becomes: `qstash.publishJSON({ url, body, delay? })` from a Server Action or webhook handler, landing on a Route Handler under `app/api/jobs/`.
- [ ] QStash needs a public URL to call back into, so job callbacks only work against a deployed URL (preview or prod) — local testing uses the QStash CLI's dev tunnel to forward callbacks to `localhost`.
- [ ] `expire-hold` job: verifies QStash signature, re-reads booking, only flips `HELD → EXPIRED` if it's _still_ `HELD`, publishes status change to Redis (both turf slot channel and booking status channel).
- [ ] `confirm-payment` job: verifies QStash signature, updates `Payment.status` to `SUCCEEDED` and `Booking.status` to `CONFIRMED` (if still `HELD`) or `PAID` (if already `EXPIRED`) inside one `$transaction` with status-guarded updates, publishes result to Redis.

## 6. Cron / scheduled sweeps

- [ ] `lib/sweeps.ts` contains `sweepExpiredHolds` and `reconcileStuckPayments` as plain exported functions — logic is separate from whatever triggers it.
- [ ] Confirm which trigger mechanism is actually used: QStash delay jobs (recommended) vs. Vercel Cron hitting an `api/cron/*` route. Either is acceptable — flag if both exist redundantly, or if neither is wired up.
- [ ] `reconcile-payments` is explicitly optional/hardening — not a hard requirement. If not implemented, that's fine; don't need to force it in, just don't claim it as built if it isn't.

## 7. Validation & types

- [ ] `lib/schemas.ts` holds Zod schemas for every Server Action input, the `getTurfSlots` query input, and both webhook payloads (Razorpay, Clerk) — validated at the entry point of each, not deep inside business logic.
- [ ] `types/index.ts` derives types via `z.infer<typeof schema>` — no hand-duplicated interfaces that could drift from the schema.
- [ ] Server Action results (`HoldSlotResult`, `InitiatePaymentResult`, `CancelBookingResult`, etc.) are discriminated unions (`{ ok: true, ... } | { ok: false, reason }`), not thrown exceptions — losing the slot race, or cancelling an already-cancelled booking, is expected control flow, not an error path.
- [ ] `Slot`/`SlotStatus` (client-facing, 3 states) are distinct from `Booking`/`BookingStatus` (backend, 5 states: HELD, PAID, CONFIRMED, EXPIRED, CANCELLED) — the collapse from 5→3 happens once, inside `getTurfSlots`, not scattered as ad-hoc checks in components.

## 8. UI / state

- [ ] Read-only pages (turfs list, bookings list, booking detail, profile) are Server Components with no client-side fetching — no React Query/SWR/global state library anywhere in the app (not needed at this app's scale; would compete with Postgres as a second source of truth).
- [ ] `turf/[id]` page: turf detail (Server Component) + `SlotGrid` (client, real-time via SSE). `SlotGrid`'s Book button calls `holdSlot`, and on success redirects to `/bookings/[id]`.
- [ ] `SlotGrid` seeds its `useState` from server-rendered `initialSlots` — no client-side fetch on mount.
- [ ] SSE subscription logic lives in a dedicated hook (`useSlotStream`), not inlined in `SlotGrid` — component stays focused on rendering.
- [ ] `onBook` in `SlotGrid` updates local state optimistically _before_ `holdSlot` resolves, and rolls back only on `{ ok: false }` — check this isn't waiting for the round-trip before showing any UI change.
- [ ] `EventSource.onerror` triggers a one-time refetch of `getTurfSlots` on reconnect, to correct any update missed during the (expected, Vercel-timeout-driven) disconnect gap.
- [ ] `/bookings/[id]` page: shows a Pay button while the booking is `HELD` and unpaid, with a countdown against `holdExpiresAt`. If the countdown elapses before payment is initiated, the booking is cancelled (via the sweep) and the page reflects that (disable Pay, show expired state — a re-fetch or redirect back to the turf page on expiry is acceptable).
- [ ] Clicking Pay calls `initiatePayment`, which does **not** extend `holdExpiresAt`. The hold countdown runs uninterrupted from the original TTL.
- [ ] After the Razorpay `handler` fires (optimistic only, per §2), the booking page needs to reflect the real confirmation once the `confirm-payment` job lands — via a per-booking SSE subscription, since the webhook → job path is async relative to the client-side checkout completing. The SSE delivers `{ status, paymentStatus }` updates in real-time.
- [ ] `BookingList`'s cancel action is local `useState` + optimistic removal — no SSE needed here, since one user's booking list isn't affected by other users' actions.

## 9. Telemetry

- [ ] `src/lib/logger.ts` (Pino) and a Sentry init exist for the Next.js app — confirm both exist.
- [ ] Server Actions/routes log `{ action, ms, ok/status }` on completion — the concrete basis for the "API latency and success rate" telemetry claim.

## 10. Cancellation & refunds

- [ ] `cancelBooking` is a status-guarded update — only transitions from `HELD`/`PAID`/`CONFIRMED` to `CANCELLED`; cancelling an already-cancelled booking is a no-op (`{ ok: true }`, not an error), not a thrown exception.
- [ ] No Razorpay refund API call, no email sent by the app on cancellation — refunds are entirely manual and out-of-band.
- [ ] Slot release is implicit, not a separate write: once `status = 'CANCELLED'`, the row falls outside the partial unique index's `WHERE` clause (§1), so the `(turfId, date, startTime)` slot is immediately available for a new `holdSlot` insert. No explicit "free the slot" step exists or is needed.
- [ ] On successful cancellation, the UI shows a static message instructing the user to email support@mangalmv.live with their booking ID for a refund (relevant only if the booking was `CONFIRMED`). This is plain client-side copy — ideally with the booking ID pre-filled into a `mailto:` link — not a triggered email or queued job.
- [ ] `PAID` status means payment was received but the slot was **not** booked (hold expired before confirmation). The UI clearly communicates this: "Payment received, slot not booked" with instructions to email support for a refund. `PAID` is not equivalent to `CONFIRMED` — it exists to enable future automatic refund flows and to surface the payment receipt to the user.

---

**For every checkbox above that's unimplemented or implemented differently**: report the current state, explain the gap against the reasoning given, and either fix it or state explicitly why it's being deferred (e.g. "reconciliation cron: not built, noting as deferred per §6").
