import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { computeSlotsForDate } from '@/lib/utils'
import { isoDateSchema } from '@/lib/schemas'
import { okResponse, failResponse } from '@/lib/response'
import { NotFoundError, ValidationError, toAppError } from '@/lib/errors'

export async function GET(req: NextRequest, { params }: { params: Promise<{ turfId: string }> }) {
  try {
    const { turfId } = await params

    const date = req.nextUrl.searchParams.get('date')
    const parsed = isoDateSchema.safeParse(date)
    if (!parsed.success) throw new ValidationError('date query param must be YYYY-MM-DD')

    const turf = await prisma.turf.findUnique({ where: { id: turfId } })
    if (!turf) throw new NotFoundError('Turf not found')

    const slots = await computeSlotsForDate(turf, parsed.data)
    return okResponse(slots)
  } catch (err) {
    return failResponse(toAppError(err))
  }
}
