import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { okResponse, failResponse } from '@/lib/response'
import { UnauthorizedError, toAppError } from '@/lib/errors'
import { initiatePayment } from '@/services/payment'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) throw new UnauthorizedError()

    const result = await initiatePayment(userId, await req.json())
    return okResponse(result, 201)
  } catch (err) {
    return failResponse(toAppError(err))
  }
}
