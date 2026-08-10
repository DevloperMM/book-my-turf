import { NextRequest } from 'next/server'
import { Webhook } from 'svix'
import prisma from '@/lib/prisma'
import { clerkWebhookSchema } from '@/lib/schemas'
import { okResponse, failResponse } from '@/lib/response'
import { ValidationError, toAppError } from '@/lib/errors'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text()

    const svixId = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new ValidationError('Missing svix headers')
    }

    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET)

    let event: unknown
    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature
      })
    } catch {
      throw new ValidationError('Invalid webhook signature')
    }

    const parsed = clerkWebhookSchema.safeParse(event)
    if (!parsed.success) {
      // Not every Clerk event type matches this schema (we only care about
      // user.created/updated) — no-op instead of erroring on the rest.
      return okResponse({ received: true, ignored: true })
    }

    const { id, email_addresses, first_name, last_name } = parsed.data.data
    const name = [first_name, last_name].filter(Boolean).join(' ') || 'Player'

    await prisma.user.upsert({
      where: { id },
      create: { id, email: email_addresses[0].email_address, name },
      update: { email: email_addresses[0].email_address, name }
    })

    logger.info({ userId: id }, 'user synced from Clerk')
    return okResponse({ received: true })
  } catch (err) {
    return failResponse(toAppError(err))
  }
}
