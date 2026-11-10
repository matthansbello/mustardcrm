import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Soft gate: prefers Firebase session cookie; falls back to client hint cookie
 * set after successful Firebase Auth (AuthGuard is the hard gate).
 */
export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session')?.value;
  const hint = request.cookies.get('__mustard_auth')?.value;

  if (!session && !hint) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/contacts/:path*',
    '/companies/:path*',
    '/deals/:path*',
    '/sequences/:path*',
    '/team/:path*',
    '/settings/:path*',
    '/onboarding/:path*',
  ],
};
