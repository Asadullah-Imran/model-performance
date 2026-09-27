import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    const authResult = await authenticateUser(username, password);

    if (!authResult.user || !authResult.token) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Invalid credentials' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: authResult.user,
      token: authResult.token,
    });

    // Set secure HTTP-only cookie
    response.cookies.set('auth_token', authResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
