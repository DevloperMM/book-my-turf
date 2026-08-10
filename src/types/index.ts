import { z } from 'zod'
import {
  createHoldSchema,
  initiatePaymentSchema,
  confirmBookingSchema,
  slotQuerySchema,
  razorpayWebhookSchema,
  clerkWebhookSchema
} from '@/lib/schemas'
import type {
  Turf as PrismaTurf,
  Booking as PrismaBooking,
  Payment as PrismaPayment
} from '@prisma-client'

export type CreateHoldInput = z.infer<typeof createHoldSchema>
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>
export type SlotQueryInput = z.infer<typeof slotQuerySchema>
export type RazorpayWebhookPayload = z.infer<typeof razorpayWebhookSchema>
export type ClerkWebhookPayload = z.infer<typeof clerkWebhookSchema>

type DateKeys<T> = { [K in keyof T]: T[K] extends Date ? K : never }[keyof T]
type Serialized<T> = Omit<T, DateKeys<T>> & Record<DateKeys<T>, string>

export type Turf = Pick<
  PrismaTurf,
  'id' | 'name' | 'location' | 'pricePerHr' | 'openHour' | 'closeHour' | 'slotMinutes' | 'imageUrl'
>

export type PaymentSummary = Pick<PrismaPayment, 'id' | 'status' | 'gatewayOrderId' | 'amount'>
export type PaymentStatus = PrismaPayment['status']
export type BookingStatus = PrismaBooking['status']

export type Booking = Serialized<
  Pick<
    PrismaBooking,
    | 'id'
    | 'turfId'
    | 'userId'
    | 'date'
    | 'startTime'
    | 'endTime'
    | 'status'
    | 'holdExpiresAt'
    | 'idempotencyKey'
  >
> & {
  turf?: Turf
  payment?: PaymentSummary | null
}

export interface Slot {
  startTime: string
  endTime: string
  status: 'AVAILABLE' | 'HELD' | 'BOOKED'
}

export interface InitiatePaymentResult {
  gatewayOrderId: string | null
  amount: number
  keyId: string
}
