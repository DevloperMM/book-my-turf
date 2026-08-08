import * as Sentry from '@sentry/nextjs'

const isDev = process.env.NODE_ENV !== 'production'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [Sentry.replayIntegration()],

  tracesSampleRate: isDev ? 1.0 : 0.1,
  enableLogs: true,

  replaysSessionSampleRate: isDev ? 0 : 0.1,
  replaysOnErrorSampleRate: isDev ? 0 : 1.0
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
