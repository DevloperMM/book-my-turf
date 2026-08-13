import { z } from 'zod'

// Server Action Inputs

export const holdSlotSchema = z.object({
  turfId: z.string().cuid(),
  startTime: z.coerce.date()
})

export const cancelBookingSchema = z.object({
  bookingId: z.string().cuid()
})

export const initiatePaymentSchema = z.object({
  bookingId: z.string().cuid()
})

// Query Inputs

export const getTurfSlotsSchema = z.object({
  turfId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
})

// Razorpay webhook payload

export const razorpayWebhookSchema = z.object({
  event: z.enum(['payment.captured', 'payment.failed']),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          order_id: z.string(),
          amount: z.number(),
          status: z.string()
        })
      })
      .optional()
  })
})
