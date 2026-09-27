import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'spatial-multiomics-dashboard-jwt-secret-key-2026'
);

// Public paths that do not require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/experiments/upload', // allow Python ML scripts to upload data
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public static assets, favicon, and next internal files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/data') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.') ||
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return NextResponse.next();
  }

  // 2. Read auth token from cookie or Authorization header
  const token =
    request.cookies.get('auth_token')?.value ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    // If navigating to a page, redirect to /login
    if (!pathname.startsWith('/api')) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  try {
    // 3. Verify JWT token signature at the edge
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch (err) {
    // Token is invalid or expired
    if (!pathname.startsWith('/api')) {
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('auth_token');
      return response;
    }
    return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
