'use server'

import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { UnauthorizedError, ValidationError } from '@/lib/errors'
import { initiatePaymentSchema, verifyPaymentSchema } from '@/lib/schemas'
import { razorpay } from '@/lib/razorpay'
import { logger } from '@/lib/logger'
import { type InitiatePaymentInput, type InitiatePaymentResult } from '@/types'
import Razorpay from 'razorpay'
import { BookingStatus, PaymentStatus } from '@prisma-client'
import { env } from '@/config/env'

export async function initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  const { userId } = await auth()
  if (!userId) throw new UnauthorizedError()

  const parsed = initiatePaymentSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Invalid input')

  const { bookingId } = parsed.data

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { turf: true, payment: true }
  })

  if (!booking) return { ok: false, reason: 'BOOKING_NOT_FOUND' }
  if (booking.status !== BookingStatus.HELD) {
    return { ok: false, reason: 'BOOKING_NOT_HELD' }
  }

  const existingPayment = booking.payment
  if (existingPayment && existingPayment.gatewayOrderId) {
    logger.info({ bookingId, orderId: existingPayment.gatewayOrderId }, 'Returning existing order')
    return {
      ok: true,
      orderId: existingPayment.gatewayOrderId,
      amount: existingPayment.amount,
      keyId: process.env.RAZORPAY_KEY_ID!
    }
  }

  const idempotencyKey = `pay_${bookingId}`

  const order = await razorpay.orders.create({
    amount: booking.turf.pricePerHr * 100,
    currency: 'INR',
    receipt: bookingId,
    notes: { bookingId }
  })

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      gatewayOrderId: order.id,
      amount: booking.turf.pricePerHr,
      status: PaymentStatus.PENDING,
      idempotencyKey
    },
    update: {
      gatewayOrderId: order.id,
      idempotencyKey
    }
  })

  logger.info({ bookingId, paymentId: payment.id, orderId: order.id }, 'Payment initiated')

  return {
    ok: true,
    orderId: order.id,
    amount: booking.turf.pricePerHr,
    keyId: process.env.RAZORPAY_KEY_ID!
  }
}

export async function verifyPaymentSignature(input: {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = verifyPaymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid input' }

  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'Unauthenticated' }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = parsed.data

  const body = razorpay_order_id + '|' + razorpay_payment_id
  const expectedSignature = Razorpay.validateWebhookSignature(
    body,
    razorpay_signature,
    env.RAZORPAY_KEY_SECRET!
  )

  if (!expectedSignature) {
    logger.warn({ razorpay_order_id, razorpay_payment_id }, 'Payment signature verification failed')
    return { ok: false, error: 'Invalid payment signature' }
  }

  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId: razorpay_order_id },
    include: { booking: true }
  })

  if (!payment || payment.booking.userId !== userId) {
    return { ok: false, error: 'Payment not found' }
  }

  logger.info({ bookingId: payment.bookingId, paymentId: payment.id }, 'Payment signature verified')
  return { ok: true }
}
