# TurfBooking Audit & Implementation Plan

## 1. AGENTS.md vs ARCHITECTURE.md Discrepancies

| Section                 | AGENTS.md (v1)                                | ARCHITECTURE.md (v2)                    | Resolution                       |
| ----------------------- | --------------------------------------------- | --------------------------------------- | -------------------------------- |
| **Queue System**        | BullMQ + `worker/` process                    | Upstash QStash (no worker)              | Follow v2 (QStash)               |
| **Job Delivery**        | Redis-backed queue                            | Signed HTTP callbacks to Route Handlers | Follow v2                        |
| **Worker Directory**    | `worker/index.ts`, `worker/jobs/`             | Does not exist                          | Not needed in v2                 |
| **lib/queue.ts**        | Queue instance for BullMQ                     | Not needed                              | Remove from scope                |
| **lib/sweeps.ts**       | `sweepExpiredHolds`, `reconcileStuckPayments` | QStash delay jobs handle expiry         | Follow v2                        |
| **Directory Structure** | `src/actions/` (read/write mixed)             | Same                                    | Keep as-is (deviation confirmed) |
| **lib/redis.ts**        | BullMQ + pub/sub                              | Pub/sub only for SSE                    | Follow v2                        |

**Key Insight:** ARCHITECTURE.md v2 supersedes AGENTS.md on queue/worker architecture. AGENTS.md remains valid for concurrency, payment idempotency, validation, and UI patterns.

---

## 2. Current Implementation Status

### ✅ Complete

- Prisma schema with partial unique index (concurrency control)
- Clerk auth + webhook sync to User
- Server Actions: `turf.action.ts` (CRUD), `booking.action.ts`, `payment.action.ts`, `user.action.ts`
- Razorpay webhook handler with signature verify + dedup
- Redis pub/sub publisher (`lib/publish.ts`)
- Zod schemas (`lib/schemas.ts`) + derived types (`types/index.ts`)
- Error class hierarchy (`lib/errors.ts`)
- Pino logger + Sentry instrumentation
- Middleware with admin route protection (`/admin(.*)`)
- Design system tokens in `globals.css` (dark oklch palette)

### ❌ Not Implemented

- shadcn/ui components (configured, not installed)
- `src/components/ui/` directory
- `src/hooks/` directory
- Admin pages (`/admin/*`)
- Frontend pages (turf detail, bookings, profile - all empty)
- SSE route (empty file)
- QStash job routes (empty files)

---

## 3. File Structure Reference

```
src/
├── actions/
│   ├── booking.action.ts    # createHold, cancelBooking, confirmBooking, getBooking, listBookings
│   ├── payment.action.ts    # initiatePayment, confirmPayment, verifyPayment
│   ├── turf.action.ts       # getTurfById, listTurfs, createTurf, updateTurf, deleteTurf
│   └── user.action.ts       # getProfile
├── app/
│   ├── layout.tsx           # Root layout (ClerkProvider + Navbar)
│   ├── globals.css          # Tailwind v4 + shadcn + custom theme
│   ├── (auth)/              # login, register pages
│   ├── (me)/                # booking/[id], bookings, profile (EMPTY)
│   ├── (turfs)/             # homepage, turf/[id] (EMPTY)
│   └── api/                 # webhooks, jobs, sse
├── components/
│   ├── Navbar.tsx           # Two-tier nav (utility + primary)
│   └── SlotGrid.tsx         # EMPTY
├── config/env.ts            # Zod-validated env
├── lib/
│   ├── errors.ts            # AppError hierarchy
│   ├── logger.ts            # Pino
│   ├── prisma.ts            # Prisma singleton (Neon adapter)
│   ├── publish.ts           # Redis pub/sub publisher
│   ├── qstash.ts            # QStash client
│   ├── razorpay.ts          # Razorpay client
│   ├── redis.ts             # ioredis (getRedisConnection + createSubscriberConnection)
│   ├── response.ts          # ok/fail response helpers
│   └── schemas.ts           # Zod schemas (turfSchema, razorpayWebhookSchema)
├── types/
│   ├── index.ts             # TurfForm, RazorpayWebhookEvent
│   ├── globals.d.ts         # CustomJwtSessionClaims (role?: string)
│   └── razorpay.d.ts        # Window.Razorpay
├── middleware.ts             # Clerk middleware (admin route protection)
└── instrumentation.ts       # Sentry
```

---

## 4. Slot Actions Location

The slot-related operations (`getTurfSlots`) should go in **`src/actions/turf.action.ts`** since:

- It's turf-specific (slots are computed from Turf.openHour/closeHour/slotMinutes)
- The file already has `getTurfById` and `listTurfs`
- Keeps turf-related reads together
- No need for a separate `slot.action.ts` file

---

## 5. Admin Navbar Implementation

### Current Navbar (`src/components/Navbar.tsx`)

- Two-tier layout: utility bar + primary nav
- Conditional "My Bookings" link for signed-in users
- No admin-specific navigation

### Plan

1. Extract `role` from Clerk's `useUser()` hook via `sessionClaims.metadata.role`
2. Add "Manage Turfs" link in primary nav, visible only when `role === 'admin'`
3. Link to `/admin/turfs` route
4. Follow DESIGN.md styling: `text-sm font-medium text-ink hover:opacity-70 transition-opacity`

```tsx
// Conditional rendering pattern
{
  isSignedIn && role === 'admin' && (
    <Link
      href="/admin/turfs"
      className="text-sm font-medium text-ink hover:opacity-70 transition-opacity"
    >
      Manage Turfs
    </Link>
  )
}
```

---

## 6. Turf Management UI

### Dependencies to Install

```bash
pnpm add react-hook-form @hookform/resolvers
pnpm dlx shadcn@latest init  # if not already done
pnpm dlx shadcn@latest add button input card dialog table form label select
```

### File Structure

```
src/
├── app/admin/
│   └── turfs/
│       └── page.tsx          # Turf list + edit/update
├── components/
│   ├── TurfList.tsx          # Table view with actions
│   ├── TurfFormDialog.tsx    # Modal form for create/edit
│   └── ui/                   # shadcn components
```

### TurfList Component

- Server Component calling `listTurfs()` from `turf.action.ts`
- Table with columns: Name, Location, Price/Hr, Hours, Actions
- Actions: Edit (opens dialog), Delete (with confirmation)
- Follow DESIGN.md: `rounded-sm`, `border-hairline`, `bg-canvas`

### TurfFormDialog Component

- Client Component using `react-hook-form` + `@hookform/resolvers/zod`
- Reuses existing `turfSchema` from `lib/schemas.ts`
- Fields: name, location, pricePerHr, openHour, closeHour, slotMinutes, imageUrl
- On submit: calls `createTurf()` or `updateTurf()` Server Action
- Uses `useTransition` for pending state (per ARCHITECTURE.md §13)

---

## 7. Styling Strategy (DESIGN.md)

- **Angular aesthetic:** `rounded-sm` (2px) on all interactive elements
- **Color tokens:** `bg-canvas`, `text-ink`, `border-hairline`
- **Primary accent:** `bg-primary text-primary-foreground` for CTAs
- **Cards:** `border border-hairline rounded-sm` (no shadows)
- **Typography:** Inter font, weight 400/700 hierarchy

---

## 8. Form Pattern (per ARCHITECTURE.md §13)

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTransition } from 'react'
import { turfSchema } from '@/lib/schemas'
import { createTurf } from '@/actions/turf.action'

export function TurfForm() {
  const [isPending, startTransition] = useTransition()
  const form = useForm<TurfForm>({
    resolver: zodResolver(turfSchema),
    defaultValues: { ... }
  })

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await createTurf(data)
      // handle result
    })
  })

  return <form onSubmit={onSubmit}>...</form>
}
```

---

## 9. Implementation Steps

| Step | Action                          | Files                               |
| ---- | ------------------------------- | ----------------------------------- |
| 1    | Install dependencies            | `package.json`                      |
| 2    | Initialize shadcn/ui            | `src/components/ui/`                |
| 3    | Update Navbar with admin link   | `src/components/Navbar.tsx`         |
| 4    | Create admin layout             | `src/app/admin/layout.tsx`          |
| 5    | Create turf list page           | `src/app/admin/turfs/page.tsx`      |
| 6    | Create TurfList component       | `src/components/TurfList.tsx`       |
| 7    | Create TurfFormDialog component | `src/components/TurfFormDialog.tsx` |
| 8    | Test edit/update flow           | Manual verification                 |

---

## 10. Audit Checklist (AGENTS.md Compliance)

### Concurrency ✅

- Partial unique index on `(turfId, date, startTime)` with `WHERE status IN ('HELD','CONFIRMED')`
- `holdSlot` uses INSERT + P2002 catch (no TOCTOU)
- `getTurfSlots` treats expired holds as available

### Payment Idempotency ✅

- `Payment.bookingId` is `@unique`
- `Payment.idempotencyKey` = `pay_${bookingId}` (server-derived)
- Webhook dedup via `WebhookEvent.id`

### Directory Structure ⚠️

- `src/actions/` contains all operations (deviation confirmed, keep as-is)
- No `worker/` directory (v2 uses QStash, not BullMQ)

### Redis ✅

- `lib/redis.ts` exports `getRedisConnection` + `createSubscriberConnection`
- ioredis with `maxRetriesPerRequest: null`
- SSE subscribes per turf channel

### Validation ✅

- `lib/schemas.ts` with Zod schemas
- `types/index.ts` derives via `z.infer`
- Discriminated union return types

### UI/State ⏳

- Read-only pages as Server Components (not yet implemented)
- `SlotGrid` seeds from `initialSlots` (not yet implemented)
- SSE in dedicated hook (not yet implemented)

### Telemetry ✅

- Pino logger + Sentry init
- Error class hierarchy with status codes

### Cancellation ✅

- Status-guarded update in `cancelBooking`
- No refund API call (manual out-of-band)

---

## 11. Deferred Items

| Item               | Reason                        |
| ------------------ | ----------------------------- |
| Rate limiting      | Not required per §4 deviation |
| Reconciliation     | Optional per §6               |
| Worker process     | Replaced by QStash in v2      |
| Tests              | Not in scope for this task    |
| SSE implementation | Empty file, deferred          |
| QStash job routes  | Empty files, deferred         |

---

## Summary

The project has a solid backend foundation (Prisma, Clerk, Redis, QStash) but lacks frontend implementation. The immediate work is:

1. **Install shadcn/ui + react-hook-form**
2. **Add admin Navbar link** with role-based visibility
3. **Create `/admin/turfs` page** with list view + edit/update dialog
4. **Apply DESIGN.md styling** (angular 2px radius, dark oklch palette, no shadows)

All backend patterns (concurrency, idempotency, validation) are correctly implemented per ARCHITECTURE.md v2. The frontend should follow ARCHITECTURE.md §13 conventions (Server Actions, discriminated unions, useTransition for pending state).

**Slot actions location:** `src/actions/turf.action.ts` (not a new file)
