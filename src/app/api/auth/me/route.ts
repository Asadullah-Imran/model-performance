import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  // Read token from cookie or Authorization header
  const token =
    req.cookies.get('auth_token')?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const payload = verifyJwtToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: payload,
  });
}
