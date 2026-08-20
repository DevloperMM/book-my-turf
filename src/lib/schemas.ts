import { z } from 'zod'

export const turfSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  location: z.string().min(2, 'Location is required'),
  pricePerHr: z.coerce.number().positive('Price must be greater than 0'),
  openHour: z.coerce.number().int().min(0).max(23),
  closeHour: z.coerce.number().int().min(1).max(24),
  slotMinutes: z.coerce.number().int().default(60),
  imageUrl: z.url('Must be a valid URL').optional().or(z.literal(''))
})

export const holdSlotSchema = z.object({
  turfId: z.string().min(1, 'Turf ID is required'),
  startTime: z.string().min(1, 'Start time is required')
})

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required')
})

export const initiatePaymentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required')
})

export const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_signature: z.string().min(1)
})

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
