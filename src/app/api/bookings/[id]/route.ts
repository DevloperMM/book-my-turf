import { auth } from '@clerk/nextjs/server'
import { okResponse, failResponse } from '@/lib/response'
import { UnauthorizedError, toAppError } from '@/lib/errors'
import { getBooking } from '@/services/booking'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) throw new UnauthorizedError()

    const booking = await getBooking(userId, params.id)
    return okResponse(booking)
  } catch (err) {
    return failResponse(toAppError(err))
  }
}
