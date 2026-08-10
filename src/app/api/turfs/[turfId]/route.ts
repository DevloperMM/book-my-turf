import prisma from '@/lib/prisma'
import { okResponse, failResponse } from '@/lib/response'
import { NotFoundError, toAppError } from '@/lib/errors'

export async function GET(_req: Request, { params }: { params: Promise<{ turfId: string }> }) {
  try {
    const { turfId } = await params
    const turf = await prisma.turf.findUnique({ where: { id: turfId } })
    if (!turf) throw new NotFoundError('Turf not found')
    return okResponse(turf)
  } catch (err) {
    return failResponse(toAppError(err))
  }
}
