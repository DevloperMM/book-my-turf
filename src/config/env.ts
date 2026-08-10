import { z } from 'zod'
import { logger } from '@/lib/logger'

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  SENTRY_ORG: z.string().min(1),
  SENTRY_PROJECT: z.string().min(1),
  SENTRY_AUTH_TOKEN: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().min(1)
})

const clientSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url()
})

const serverParsed = serverSchema.safeParse(process.env)
const clientParsed = clientSchema.safeParse(process.env)

if (!serverParsed.success) {
  logger.fatal({ err: serverParsed.error }, 'Invalid server environment variables')
  throw new Error(
    `Invalid server environment variables: ${JSON.stringify(serverParsed.error.flatten().fieldErrors)}`
  )
}

if (!clientParsed.success) {
  logger.fatal({ err: clientParsed.error }, 'Invalid client environment variables')
  throw new Error(
    `Invalid client environment variables: ${JSON.stringify(clientParsed.error.flatten().fieldErrors)}`
  )
}

export const env = {
  ...serverParsed.data,
  ...clientParsed.data
} as const
