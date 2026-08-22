export {}

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: string
    }
  }
}

declare global {
  interface Window {
    // eslint-disable-next-line no-unused-vars
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void
      // eslint-disable-next-line no-unused-vars
      on: (event: string, callback: (response: unknown) => void) => void
    }
  }
}
