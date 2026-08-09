import { z } from 'zod'

export const cuidSchema = z.string().min(1)
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
export const isoDateTimeSchema = z.string().datetime()

export const createHoldSchema = z.object({
  turfId: cuidSchema,
  date: isoDateSchema,
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema,
  idempotencyKey: z.string().min(1)
})

export const initiatePaymentSchema = z.object({
  bookingId: cuidSchema,
  idempotencyKey: z.string().min(1)
})

export const confirmBookingSchema = z.object({
  bookingId: cuidSchema
})

export const slotQuerySchema = z.object({
  turfId: cuidSchema,
  date: isoDateSchema
})

export const razorpayWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string(),
        amount: z.number(),
        status: z.string()
      })
    })
  })
})

export const clerkWebhookSchema = z.object({
  type: z.enum(['user.created', 'user.updated']),
  data: z.object({
    id: z.string(),
    email_addresses: z.array(
      z.object({
        email_address: z.string().email()
      })
    ),
    first_name: z.string().nullable(),
    last_name: z.string().nullable()
  })
})
