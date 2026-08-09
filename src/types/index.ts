import { z } from 'zod'
import {
  createHoldSchema,
  initiatePaymentSchema,
  confirmBookingSchema,
  slotQuerySchema,
  razorpayWebhookSchema,
  clerkWebhookSchema
} from '@/lib/schemas'

export type CreateHoldInput = z.infer<typeof createHoldSchema>
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>
export type SlotQueryInput = z.infer<typeof slotQuerySchema>
export type RazorpayWebhookPayload = z.infer<typeof razorpayWebhookSchema>
export type ClerkWebhookPayload = z.infer<typeof clerkWebhookSchema>
