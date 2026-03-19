import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  
  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // IMPORTANT: Change 'admin' and 'password123' to what you want!
    if (user === 'admin' && pwd === 'password123') {
      return NextResponse.next();
    }
  }
  
  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' }
  });
}

