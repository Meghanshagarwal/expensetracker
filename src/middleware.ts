import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect server-side API endpoints from unauthorized requests
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth')
  ) {
    const authCookie = request.cookies.get('session_auth');
    if (!authCookie || authCookie.value !== 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
