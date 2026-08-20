import * as Sentry from '@sentry/nextjs'
import { registerQStashDev } from '@upstash/qstash/nextjs'

export async function register() {
  registerQStashDev()

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
