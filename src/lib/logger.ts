import pino from 'pino'

const isEdge = process.env.NEXT_RUNTIME === 'edge'
const isBrowser = typeof window !== 'undefined'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: null,
  ...(process.env.NODE_ENV !== 'production' && !isEdge && !isBrowser
    ? { transport: { target: 'pino-pretty' } }
    : {}),
  ...((isEdge || isBrowser) && {
    browser: {
      write: {
        /* eslint-disable no-console */
        info: (o) => console.log(JSON.stringify(o)),
        warn: (o) => console.warn(JSON.stringify(o)),
        error: (o) => console.error(JSON.stringify(o)),
        fatal: (o) => console.error(JSON.stringify(o))
        /* eslint-enable no-console */
      }
    }
  })
})
