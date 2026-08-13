import { z } from 'zod'
import {
  holdSlotSchema,
  cancelBookingSchema,
  initiatePaymentSchema,
  getTurfSlotsSchema,
  razorpayWebhookSchema
} from '@/lib/schemas'

// Inputs — derived from the schemas above, never hand-written separately

export type HoldSlotInput = z.infer<typeof holdSlotSchema>
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>
export type GetTurfSlotsInput = z.infer<typeof getTurfSlotsSchema>
export type RazorpayWebhookEvent = z.infer<typeof razorpayWebhookSchema>

// Server Action results — discriminated unions, not thrown exceptions

export type HoldSlotResult =
  { ok: true; bookingId: string } | { ok: false; reason: 'SLOT_TAKEN' | 'UNAUTHENTICATED' }

export type InitiatePaymentResult =
  | { ok: true; orderId: string; amount: number; keyId: string }
  | { ok: false; reason: 'BOOKING_NOT_FOUND' | 'BOOKING_NOT_HELD' }

// Read-side view model — deliberately NOT the Prisma Booking type

export type SlotStatus = 'available' | 'held' | 'booked'

export interface Slot {
  startTime: string
  endTime: string
  status: SlotStatus
  bookingId?: string
}

// SSE wire payload — what's actually published to Redis and streamed

export interface SlotUpdateEvent {
  turfId: string
  startTime: string
  status: SlotStatus
}
