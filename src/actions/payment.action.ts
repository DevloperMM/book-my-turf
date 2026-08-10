'use server'

import { auth } from '@clerk/nextjs/server'
import { ok, fail } from '@/lib/response'
import { UnauthorizedError, toAppError } from '@/lib/errors'
import { initiatePayment } from '@/services/payment'
import type { ApiResponse } from '@/lib/response'
import type { InitiatePaymentInput, InitiatePaymentResult } from '@/types'

export async function initiatePaymentAction(
  input: InitiatePaymentInput
): Promise<ApiResponse<InitiatePaymentResult>> {
  try {
    const { userId } = await auth()
    if (!userId) throw new UnauthorizedError()

    const result = await initiatePayment(userId, input)
    return ok(result)
  } catch (err) {
    return fail(toAppError(err))
  }
}
