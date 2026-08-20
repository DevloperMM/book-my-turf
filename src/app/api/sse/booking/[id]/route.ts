import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSubscriberConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) {
    return new Response('data: {"error":"unauthorized"}\n\n', {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  }

  const { id: bookingId } = await params
  const subscriber = createSubscriberConnection()
  const channel = `booking:${bookingId}:status`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const messageHandler = (message: string) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`))
      }

      subscriber.subscribe(channel, (err?: Error | null) => {
        if (err) {
          logger.error({ err, bookingId }, 'Redis subscribe error')
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
        logger.debug({ bookingId }, 'Booking SSE connection closed')
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
