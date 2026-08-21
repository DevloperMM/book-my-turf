'use server'

import prisma from '@/lib/prisma'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { BookingStatus } from '@prisma-client'
import { SlotStatus } from '@/types'
import { getRedisConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { generateISTSlots } from '@/lib/timezone'

export async function getTurfById(id: string) {
  const turf = await prisma.turf.findUnique({ where: { id } })
  if (!turf) throw new NotFoundError('Turf not found')
  return turf
}

export async function listTurfs() {
  return prisma.turf.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function createTurf(formData: FormData) {
  const name = formData.get('name') as string
  const location = formData.get('location') as string
  const pricePerHr = formData.get('pricePerHr') as string
  const openHour = formData.get('openHour') as string
  const closeHour = formData.get('closeHour') as string
  const slotMinutes = formData.get('slotMinutes') as string
  const imageUrl = formData.get('imageUrl') as string

  if (Number(openHour) < 0 || Number(openHour) > 23) {
    throw new ValidationError('openHour must be between 0 and 23')
  }
  if (Number(closeHour) < 0 || Number(closeHour) > 23) {
    throw new ValidationError('closeHour must be between 0 and 23')
  }
  if (Number(openHour) === Number(closeHour)) {
    throw new ValidationError('openHour and closeHour cannot be the same')
  }
  if (Number(slotMinutes) < 15 || Number(slotMinutes) > 180) {
    throw new ValidationError('slotMinutes must be between 15 and 180')
  }

  return prisma.turf.create({
    data: {
      name,
      location,
      pricePerHr: Number(pricePerHr),
      openHour: Number(openHour),
      closeHour: Number(closeHour),
      slotMinutes: Number(slotMinutes),
      imageUrl
    }
  })
}

export async function updateTurf(
  id: string,
  data: Partial<{
    name: string
    location: string
    pricePerHr: number
    openHour: number
    closeHour: number
    slotMinutes: number
    imageUrl: string
  }>
) {
  const turf = await prisma.turf.findUnique({ where: { id } })
  if (!turf) throw new NotFoundError('Turf not found')

  if (data.openHour !== undefined && data.closeHour !== undefined) {
    if (data.openHour === data.closeHour) {
      throw new ValidationError('openHour and closeHour cannot be the same')
    }
  }

  return prisma.turf.update({ where: { id }, data })
}

export async function deleteTurf(id: string) {
  const turf = await prisma.turf.findUnique({ where: { id } })
  if (!turf) throw new NotFoundError('Turf not found')

  const activeBookings = await prisma.booking.count({
    where: {
      turfId: id,
      status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] }
    }
  })

  if (activeBookings > 0) {
    throw new ValidationError('Turf with active bookings cannot be deleted !')
  }

  return prisma.turf.delete({ where: { id } })
}

export async function getTurfSlots(turfId: string, date: string) {
  const redis = getRedisConnection()
  const cacheKey = `cache:turf:${turfId}:slots:${date}`

  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached) as Array<{
      startTime: string
      endTime: string
      status: SlotStatus
    }>
  }

  const turf = await prisma.turf.findUnique({ where: { id: turfId } })
  if (!turf) throw new NotFoundError('Turf not found')

  const dateObj = new Date(date + 'T00:00:00.000Z')

  const now = new Date()
  const bookings = await prisma.booking.findMany({
    where: {
      turfId,
      date: dateObj,
      status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] }
    },
    select: {
      startTime: true,
      endTime: true,
      status: true,
      holdExpiresAt: true
    }
  })

  const bookedMap = new Map<string, SlotStatus>()
  for (const b of bookings) {
    if (b.status === BookingStatus.HELD && b.holdExpiresAt <= now) {
      continue
    }
    if (b.status === BookingStatus.PAID) {
      continue
    }
    const key = b.startTime.toISOString()
    const isBooked = b.status === BookingStatus.CONFIRMED
    bookedMap.set(key, isBooked ? 'booked' : 'held')
  }

  const istSlots = generateISTSlots(turf.openHour, turf.closeHour, turf.slotMinutes, date)

  const slots: Array<{ startTime: string; endTime: string; status: SlotStatus }> = []

  for (const istSlot of istSlots) {
    const key = istSlot.startTime
    const slotEnd = new Date(istSlot.endTime)
    const isPast = slotEnd <= now

    let status: SlotStatus = 'available'
    if (!isPast) {
      const booked = bookedMap.get(key)
      if (booked) status = booked
    }

    slots.push({
      startTime: key,
      endTime: istSlot.endTime,
      status
    })
  }

  await redis.setex(cacheKey, 30, JSON.stringify(slots))

  logger.debug({ turfId, date, slotCount: slots.length }, 'Turf slots computed')

  return slots
}
