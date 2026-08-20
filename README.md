# BookMySlot

Real-time turf/slot booking app that eliminates double-booking and double-charging through DB-level constraints.

## Tech Stack

- Next.js 16 (App Router, TypeScript strict)
- PostgreSQL + Prisma
- Redis (ioredis) + BullMQ
- Clerk (auth)
- Razorpay (payments)
- Pino (logging) + Sentry (error tracking)

## Getting Started

```bash
pnpm install
pnpm prisma migrate dev
pnpm dev
```

## Architecture

- **Server Actions** — UI-initiated mutations (hold, payment, booking)
- **Route Handlers** — external callers only (webhooks, SSE, etc)
- **DB constraints** — partial unique index prevents double-booking; unique constraint on payment idempotency key prevents double-charging

## Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm lint         # Run ESLint
pnpm format:fix   # Fix formatting with Prettier
```
