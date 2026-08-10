'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { ok, fail } from '@/lib/response'
import { UnauthorizedError, toAppError } from '@/lib/errors'
import { holdSlot } from '@/services/booking'
import type { ApiResponse } from '@/lib/response'
import type { Booking, CreateHoldInput } from '@/types'

export async function holdSlotAction(input: CreateHoldInput): Promise<ApiResponse<Booking>> {
  try {
    const { userId } = await auth()
    if (!userId) throw new UnauthorizedError()

    const booking = await holdSlot(userId, input)
    revalidatePath(`/turfs/${input.turfId}`)
    return ok(booking as unknown as Booking)
  } catch (err) {
    return fail(toAppError(err))
  }
}
