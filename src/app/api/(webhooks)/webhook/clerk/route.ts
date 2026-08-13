import { WebhookEvent } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { okResponse, failResponse } from '@/lib/response'
import { ValidationError, toAppError } from '@/lib/errors'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const SECRET = env.CLERK_WEBHOOK_SIGNING_SECRET

  if (!SECRET) {
    throw new ValidationError('Missing Clerk Webhook secret')
  }

  const headerPayload = await headers()

  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new ValidationError('Missing svix headers')
  }

  const body = await req.text()

  const wh = new Webhook(SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    }) as WebhookEvent
  } catch (err) {
    logger.error({ err }, 'Error verifying webhoook')
    throw new ValidationError('Invalid webhook signature')
  }

  const evtType = evt.type

  if (evtType === 'user.created') {
    try {
      const { first_name, last_name, email_addresses } = evt.data

      if (!first_name || !last_name) {
        throw new ValidationError('Missing first name or last name')
      }

      const email = email_addresses?.[0]?.email_address
      if (!email) {
        throw new ValidationError('Missing email')
      }

      const newUser = await prisma.user.create({
        data: {
          id: evt.data.id!,
          email: email,
          name: `${first_name} ${last_name}`
        }
      })

      logger.info({ user: newUser }, 'user synced from Clerk')
      return okResponse(evt.data)
    } catch (err) {
      logger.error({ err }, 'Error syncing user from Clerk')
      return failResponse(toAppError(err))
    }
  }
}
