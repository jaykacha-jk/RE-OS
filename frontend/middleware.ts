import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'reos_access';
const REFRESH_COOKIE = 'reos_refresh';

const DASHBOARD_PREFIXES = [
  '/dashboard',
  '/analytics',
  '/performance',
  '/properties',
  '/inquiries',
  '/pipeline',
  '/chat',
  '/lead-sources',
  '/ai',
  '/employees',
  '/notifications',
  '/billing',
  '/settings',
  '/audit-logs',
  '/platform',
];

const AUTH_PREFIXES = ['/login', '/register', '/accept-invitation'];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const hasAuthCookie = req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);

  if (matchesPrefix(pathname, DASHBOARD_PREFIXES) && !hasAuthCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (matchesPrefix(pathname, AUTH_PREFIXES) && hasAuthCookie) {
    const dashboardUrl = req.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/analytics/:path*',
    '/performance/:path*',
    '/properties/:path*',
    '/inquiries/:path*',
    '/pipeline/:path*',
    '/chat/:path*',
    '/lead-sources/:path*',
    '/ai/:path*',
    '/employees/:path*',
    '/notifications/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/audit-logs/:path*',
    '/platform/:path*',
    '/login',
    '/register',
    '/accept-invitation/:path*',
  ],
};
