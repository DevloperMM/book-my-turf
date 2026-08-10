import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { okResponse, failResponse } from '@/lib/response'
import { UnauthorizedError, ValidationError, toAppError } from '@/lib/errors'
import { holdSlot, listMyBookings } from '@/services/booking'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) throw new UnauthorizedError()

    const booking = await holdSlot(userId, await req.json())
    return okResponse(booking, 201)
  } catch (err) {
    return failResponse(toAppError(err))
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) throw new UnauthorizedError()

    const scope = req.nextUrl.searchParams.get('scope')
    if (scope !== 'mine') throw new ValidationError('Unsupported or missing scope query param')

    const bookings = await listMyBookings(userId)
    return okResponse(bookings)
  } catch (err) {
    return failResponse(toAppError(err))
  }
}
