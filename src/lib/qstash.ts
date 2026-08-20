import { Client, Receiver } from '@upstash/qstash'

const isDevMode = process.env.QSTASH_DEV === 'true'

export const qstashClient = new Client(
  isDevMode
    ? { devMode: true }
    : {
        baseUrl: process.env.QSTASH_URL,
        token: process.env.QSTASH_TOKEN
      }
)

export const qstashReceiver = new Receiver(
  isDevMode
    ? { devMode: true }
    : {
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!
      }
)
