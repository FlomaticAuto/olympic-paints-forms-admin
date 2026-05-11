import { NextRequest, NextResponse } from 'next/server';

const LOGIN_PATH   = '/admin/login';
const COOKIE_NAME  = 'oly_admin_auth';
// 7-day session cookie
const COOKIE_MAX   = 60 * 60 * 24 * 7;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin/* routes — let API routes use their own header check
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Always allow the login page through (prevent redirect loop)
  if (pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME);
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    // Misconfigured — fail closed
    return new NextResponse('Server misconfiguration: ADMIN_SECRET not set', { status: 500 });
  }

  if (!cookie || cookie.value !== secret) {
    // Redirect to login, preserving the intended destination
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all /admin paths; skip _next internals and static files
  matcher: ['/admin/:path*'],
};
