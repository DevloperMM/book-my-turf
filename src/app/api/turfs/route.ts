import prisma from '@/lib/prisma'
import { okResponse, failResponse } from '@/lib/response'
import { toAppError } from '@/lib/errors'

export async function GET() {
  try {
    const turfs = await prisma.turf.findMany({ orderBy: { name: 'asc' } })
    return okResponse(turfs)
  } catch (err) {
    return failResponse(toAppError(err))
  }
}
