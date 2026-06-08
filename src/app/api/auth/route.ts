import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const configPin = process.env.APP_PIN || '1234';

    if (pin === configPin) {
      const cookieStore = await cookies();
      cookieStore.set('session_auth', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Incorrect PIN' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const auth = cookieStore.get('session_auth');
  
  if (auth && auth.value === 'true') {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('session_auth');
  return NextResponse.json({ success: true });
}
