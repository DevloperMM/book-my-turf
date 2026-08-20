import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { failResponse } from './lib/response'
import { UnauthorizedError, ForbiddenError } from './lib/errors'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/register(.*)',
  '/turf(.*)',
  '/api/webhook(.*)'
])

const isAdminRoute = createRouteMatcher(['/api/admin(.*)', '/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  const isApiRoute = req.nextUrl.pathname.startsWith('/api')

  // --- RULE 1: Unauthenticated User Protection ---
  if (!userId && !isPublicRoute(req)) {
    if (isApiRoute) {
      return failResponse(new UnauthorizedError('You are not authenticated!'))
    }

    return NextResponse.redirect(new URL('/login', req.url))
  }

  // --- RULE 2: Admin-Only Route Protection ---
  if (isAdminRoute(req)) {
    const role = sessionClaims?.metadata?.role

    if (role !== 'admin') {
      if (isApiRoute) {
        return failResponse(new ForbiddenError('You do not have enough persmission'))
      }

      return NextResponse.redirect(new URL('/', req.url))
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk-specific frontend API routes
    '/__clerk/(.*)'
  ]
}
