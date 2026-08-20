import { z } from 'zod'
import {
  razorpayWebhookSchema,
  turfSchema,
  holdSlotSchema,
  cancelBookingSchema,
  initiatePaymentSchema
} from '@/lib/schemas'

export type TurfForm = z.infer<typeof turfSchema>
export type RazorpayWebhookEvent = z.infer<typeof razorpayWebhookSchema>
export type HoldSlotInput = z.infer<typeof holdSlotSchema>
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>

export type SlotStatus = 'available' | 'held' | 'booked'

export type HoldSlotResult =
  { ok: true; bookingId: string } | { ok: false; reason: 'UNAUTHENTICATED' | 'SLOT_TAKEN' }

export type CancelBookingResult = { ok: true } | { ok: false; reason: 'INVALID_STATUS' }

export type InitiatePaymentResult =
  | { ok: true; orderId: string; amount: number; keyId: string }
  | { ok: false; reason: 'BOOKING_NOT_FOUND' | 'BOOKING_NOT_HELD' }
