import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const hasClerk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')

async function withClerk(req: NextRequest) {
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server')
  const isProtected = createRouteMatcher(['/app(.*)'])
  return clerkMiddleware((auth) => {
    if (isProtected(req)) auth().protect()
  })(req, {} as any)
}

export async function middleware(req: NextRequest) {
  if (!hasClerk) return NextResponse.next()
  try {
    return await withClerk(req)
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
