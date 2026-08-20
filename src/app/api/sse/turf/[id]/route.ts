import { NextRequest } from 'next/server'
import { createSubscriberConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: turfId } = await params

  const subscriber = createSubscriberConnection()
  const channel = `turf:${turfId}:slots`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const messageHandler = (message: string) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`))
      }

      subscriber.subscribe(channel, (err?: Error | null) => {
        if (err) {
          logger.error({ err, turfId }, 'Redis subscribe error')
          controller.close()
          return
        }
      })

      subscriber.on('message', (ch: string, message: string) => {
        if (ch === channel) {
          messageHandler(message)
        }
      })

      req.signal.addEventListener('abort', () => {
        subscriber.unsubscribe(channel)
        subscriber.disconnect()
        logger.debug({ turfId }, 'SSE connection closed')
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  })
}
