'use server'

import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { NotFoundError, UnauthorizedError } from '@/lib/errors'

export async function getProfile() {
  const { userId } = await auth()
  if (!userId) throw new UnauthorizedError()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      bookings: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          turfId: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          createdAt: true,
          turf: { select: { name: true, location: true } }
        }
      }
    }
  })

  if (!user) throw new NotFoundError('User not found')
  return user
}
